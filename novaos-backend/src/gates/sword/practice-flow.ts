// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE FLOW — Chat-Based Practice Interaction
// NovaOS Gates — Phase 18B: SwordGate Practice Mode
// Phase 19F: Enhanced Response Formats
// ═══════════════════════════════════════════════════════════════════════════════
//
// Handles practice interactions through chat:
//
//   "What's my lesson today?"     → getTodayPractice()
//   "I'm done" / "I finished"     → completePractice(pass)
//   "I failed" / "I couldn't"     → completePractice(fail)
//   "Skip today"                  → skipPractice()
//   "Show my progress"            → getProgress()
//   "Show my goals"               → viewGoals()
//   "Show this week"              → viewWeek()
//   "Show milestone"              → viewMilestone() [NEW Phase 19F]
//   "Delete goal X"               → deleteGoal()
//   "Delete all goals"            → deleteAllGoals()
//   "Start now" / "Begin today"   → startNow()
//
// Phase 19F Enhancements:
//   - Structured drill display with warmup/main/stretch sections
//   - Week summary with day breakdown and skill types
//   - Progress display with skill tree
//   - Milestone display with requirements
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError, isOk } from '../../types/result.js';
import type { UserId, GoalId, SkillId } from '../../types/branded.js';
import type { IDeliberatePracticeEngine, TodayPracticeResult } from '../../services/deliberate-practice-engine/interfaces.js';
import type { Goal, Quest } from '../../services/spark-engine/types.js';
import type { ISparkEngine } from '../../services/spark-engine/interfaces.js';
import type { WeekPlan, DailyDrill, Skill, QuestMilestone, GoalProgress } from '../../services/deliberate-practice-engine/types.js';

// Phase 19F: Import display types and builders
import type {
  TodayDrillDisplay,
  WeekSummaryDisplay,
  GoalProgressDisplay,
  MilestoneDisplay,
} from './practice-display-types.js';

import {
  buildTodayDrillDisplay,
  buildWeekSummaryDisplay,
  buildGoalProgressDisplay,
  buildMilestoneDisplay,
  buildDrillDisplayFromPracticeResult,
} from './practice-display-builder.js';

import {
  formatDrillForChat,
  formatWeekForChat,
  formatProgressForChat,
  formatMilestoneForChat,
  formatDrillCompact,
  formatProgressCompact,
} from './practice-response-formatter.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Practice intent detected from user message.
 */
export type PracticeIntent =
  | 'view_today'      // "What's my lesson today?"
  | 'complete_pass'   // "I finished", "I did it", "Done"
  | 'complete_fail'   // "I couldn't do it", "I failed"
  | 'skip'            // "Skip today", "I'll do it tomorrow"
  | 'view_progress'   // "Show my progress", "How am I doing?"
  | 'view_week'       // "What's this week's plan?"
  | 'view_goals'      // "Show my goals", "List my goals"
  | 'view_milestone'  // "Show milestone", "What's the milestone?" [NEW Phase 19F]
  | 'delete_goal'     // "Delete goal 1", "Remove this goal"
  | 'delete_all'      // "Delete all goals", "Clear all"
  | 'start_now'       // "Start now", "Begin today", "Practice now"
  | 'switch_goal'     // "Switch to goal 2", "Use goal X"
  | 'unknown';

/**
 * Result of practice flow execution.
 */
export interface PracticeFlowResult {
  /** The intent that was handled */
  readonly intent: PracticeIntent;

  /** Response message for the user */
  readonly response: string;

  /** Goal ID if relevant */
  readonly goalId?: GoalId;

  /** Whether the practice was completed */
  readonly completed?: boolean;

  /** Whether the practice was skipped */
  readonly skipped?: boolean;

  /** Today's drill info (for view_today) - legacy format */
  readonly drill?: {
    action: string;
    passSignal: string;
    skillName?: string;
    constraint?: string;
  };

  /** Enhanced drill display (Phase 19F) */
  readonly drillDisplay?: TodayDrillDisplay;

  /** Week summary display (Phase 19F) */
  readonly weekDisplay?: WeekSummaryDisplay;

  /** Progress info (for view_progress) - legacy format */
  readonly progress?: GoalProgress;

  /** Enhanced progress display (Phase 19F) */
  readonly progressDisplay?: GoalProgressDisplay;

  /** Milestone display (Phase 19F) */
  readonly milestoneDisplay?: MilestoneDisplay;

  /** Goals list (for view_goals) */
  readonly goals?: readonly Goal[];

  /** Whether a goal was deleted */
  readonly deleted?: boolean;

  /** Count of deleted goals */
  readonly deletedCount?: number;
}

/**
 * Dependencies for PracticeFlow.
 */
export interface PracticeFlowDependencies {
  practiceEngine: IDeliberatePracticeEngine;
  sparkEngine?: ISparkEngine;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

const VIEW_TODAY_PATTERNS = [
  /what('?s| is)?\s+(my\s+)?(lesson|practice|drill|task)\s*(today|for today)?/i,
  /today('?s)?\s+(lesson|practice|drill|task)/i,
  /what\s+(should|do)\s+i\s+(practice|learn|do)\s*(today)?/i,
  /show\s+(me\s+)?(my\s+)?(today'?s?\s+)?(lesson|practice|drill)/i,
  /^(lesson|practice|drill)\s*(today)?$/i,
  /what('?s| is)?\s+on\s+(the\s+)?agenda/i,
];

const COMPLETE_PASS_PATTERNS = [
  /^(done|finished|completed|did it|i did it|got it|nailed it)\.?$/i,
  /i('?m| am)?\s*(done|finished|completed)/i,
  /i\s+(did|finished|completed)\s+(it|the\s+(lesson|practice|drill|task))/i,
  /^(yes|yep|yeah|yup)[\s,]+(i\s+)?(did|done|finished)/i,
  /mark\s+(it\s+)?(as\s+)?(done|complete|finished|passed)/i,
  /i\s+passed/i,
  /that\s+was\s+(easy|great|good)/i,
  /✅|👍|🎉/,
];

const COMPLETE_FAIL_PATTERNS = [
  /i\s+(couldn'?t|could not|failed|didn'?t|did not)\s+(do\s+it|finish|complete|pass)/i,
  /^(failed|couldn'?t do it|didn'?t pass)\.?$/i,
  /i\s+failed/i,
  /didn'?t\s+(work|go well)/i,
  /mark\s+(it\s+)?(as\s+)?(failed|incomplete)/i,
  /❌|👎/,
];

const SKIP_PATTERNS = [
  /skip\s+(today|this|it)/i,
  /i('?ll| will)?\s+(skip|pass on)\s+(today|this|it)/i,
  /not\s+today/i,
  /do\s+(it\s+)?tomorrow/i,
  /can'?t\s+(today|do it today)/i,
  /postpone/i,
];

const VIEW_PROGRESS_PATTERNS = [
  /how('?s| is)?\s+(my\s+)?progress/i,
  /(show|what'?s)\s+(my\s+)?progress/i,
  /how\s+am\s+i\s+doing/i,
  /my\s+stats/i,
  /what\s+have\s+i\s+(learned|mastered|completed)/i,
];

const VIEW_WEEK_PATTERNS = [
  /this\s+week('?s)?\s+(plan|schedule|lessons)/i,
  /what('?s| is)?\s+(the\s+)?week('?s)?\s+(plan|schedule)/i,
  /weekly\s+(plan|schedule|overview)/i,
  /show\s+(me\s+)?(the\s+)?week/i,
];

// Phase 19F: New milestone patterns
const VIEW_MILESTONE_PATTERNS = [
  /show\s+(me\s+)?(the\s+)?milestone/i,
  /what('?s| is)?\s+(the\s+)?milestone/i,
  /milestone\s+(status|info|details)/i,
  /^milestone$/i,
  /quest\s+milestone/i,
  /view\s+milestone/i,
];

const VIEW_GOALS_PATTERNS = [
  /(show|list|view|what('?s| is| are)?)\s+(my\s+)?goals/i,
  /my\s+goals/i,
  /all\s+(my\s+)?goals/i,
  /what\s+am\s+i\s+learning/i,
  /learning\s+goals/i,
];

const DELETE_GOAL_PATTERNS = [
  /delete\s+(goal\s*)?(#?\d+|this|current)/i,
  /remove\s+(goal\s*)?(#?\d+|this|current)/i,
  /cancel\s+(goal\s*)?(#?\d+|this|current)/i,
];

const DELETE_ALL_PATTERNS = [
  /delete\s+all(\s+goals)?/i,
  /remove\s+all(\s+goals)?/i,
  /clear\s+all(\s+goals)?/i,
  /reset\s+(all\s+)?goals/i,
  /start\s+fresh/i,
  /wipe\s+(all\s+)?goals/i,
];

const START_NOW_PATTERNS = [
  /start\s+(now|today|early|my\s+lesson)/i,
  /begin\s+(now|today|early)/i,
  /practice\s+now/i,
  /let('?s| me)?\s+start/i,
  /i\s+want\s+to\s+(start|begin|practice)/i,
  /give\s+me\s+(my\s+)?(first\s+)?(lesson|drill)/i,
  /can\s+i\s+start/i,
];

const SWITCH_GOAL_PATTERNS = [
  /switch\s+(to\s+)?goal\s*(#?\d+)/i,
  /use\s+goal\s*(#?\d+)/i,
  /change\s+(to\s+)?goal\s*(#?\d+)/i,
  /select\s+goal\s*(#?\d+)/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE FLOW
// ═══════════════════════════════════════════════════════════════════════════════

export class PracticeFlow {
  private readonly practiceEngine: IDeliberatePracticeEngine;
  private readonly sparkEngine?: ISparkEngine;
  
  // Track selected goal per user (in-memory, resets on restart)
  private selectedGoalByUser: Map<string, GoalId> = new Map();

  constructor(deps: PracticeFlowDependencies) {
    this.practiceEngine = deps.practiceEngine;
    this.sparkEngine = deps.sparkEngine;
  }

  /**
   * Helper: Get a Quest by ID using getQuestsForGoal.
   * Since getQuest() doesn't exist on ISparkEngine, we fetch all quests and filter.
   */
  private async getQuestById(goalId: GoalId, questId: string): Promise<Quest | null> {
    if (!this.sparkEngine) return null;
    
    const questsResult = await this.sparkEngine.getQuestsForGoal(goalId);
    if (!isOk(questsResult)) return null;
    
    return questsResult.value.find(q => q.id === questId) ?? null;
  }

  /**
   * Detect practice intent from user message.
   */
  detectIntent(message: string): PracticeIntent {
    const trimmed = message.trim();

    // Check patterns in order of specificity (most specific first)
    if (DELETE_ALL_PATTERNS.some(p => p.test(trimmed))) {
      return 'delete_all';
    }
    if (DELETE_GOAL_PATTERNS.some(p => p.test(trimmed))) {
      return 'delete_goal';
    }
    if (SWITCH_GOAL_PATTERNS.some(p => p.test(trimmed))) {
      return 'switch_goal';
    }
    if (START_NOW_PATTERNS.some(p => p.test(trimmed))) {
      return 'start_now';
    }
    if (VIEW_GOALS_PATTERNS.some(p => p.test(trimmed))) {
      return 'view_goals';
    }
    // Phase 19F: Check milestone before other view patterns
    if (VIEW_MILESTONE_PATTERNS.some(p => p.test(trimmed))) {
      return 'view_milestone';
    }
    if (COMPLETE_PASS_PATTERNS.some(p => p.test(trimmed))) {
      return 'complete_pass';
    }
    if (COMPLETE_FAIL_PATTERNS.some(p => p.test(trimmed))) {
      return 'complete_fail';
    }
    if (SKIP_PATTERNS.some(p => p.test(trimmed))) {
      return 'skip';
    }
    if (VIEW_PROGRESS_PATTERNS.some(p => p.test(trimmed))) {
      return 'view_progress';
    }
    if (VIEW_WEEK_PATTERNS.some(p => p.test(trimmed))) {
      return 'view_week';
    }
    if (VIEW_TODAY_PATTERNS.some(p => p.test(trimmed))) {
      return 'view_today';
    }

    return 'unknown';
  }

  /**
   * Extract goal number from message (e.g., "delete goal 2" → 2)
   */
  private extractGoalNumber(message: string): number | null {
    const match = message.match(/#?(\d+)/);
    return match ? parseInt(match[1]!, 10) : null;
  }

  /**
   * Check if message is a practice-related query.
   */
  isPracticeQuery(message: string): boolean {
    return this.detectIntent(message) !== 'unknown';
  }

  /**
   * Execute practice flow based on detected intent.
   */
  async execute(
    userId: UserId,
    message: string,
    goalId?: GoalId
  ): AsyncAppResult<PracticeFlowResult> {
    const intent = this.detectIntent(message);

    // Get all goals for the user
    let allGoals: readonly Goal[] = [];
    if (this.sparkEngine) {
      const goalsResult = await this.sparkEngine.getGoalsForUser(userId);
      if (isOk(goalsResult)) {
        // Sort by createdAt descending (newest first)
        allGoals = [...goalsResult.value].sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return bTime - aTime;
        });
      }
    }

    // If no goalId provided, use selected or most recent active goal
    let effectiveGoalId = goalId;
    if (!effectiveGoalId) {
      // Check if user has a selected goal
      const selected = this.selectedGoalByUser.get(userId);
      if (selected && allGoals.some(g => g.id === selected)) {
        effectiveGoalId = selected;
      } else if (allGoals.length > 0) {
        const activeGoal = allGoals.find(g => g.status === 'active');
        effectiveGoalId = activeGoal?.id ?? allGoals[0]?.id;
      }
      
      if (effectiveGoalId) {
        console.log(`[PRACTICE_FLOW] Selected goal: ${effectiveGoalId} (total goals: ${allGoals.length})`);
      }
    }

    // Handle intents that don't require a goal
    switch (intent) {
      case 'view_goals':
        return this.handleViewGoals(userId, allGoals);
        
      case 'delete_all':
        return this.handleDeleteAll(userId, allGoals);
        
      case 'switch_goal':
        return this.handleSwitchGoal(userId, message, allGoals);
    }

    // Check if we need a goal for other intents
    if (!effectiveGoalId && intent !== 'unknown') {
      return ok({
        intent,
        response: "I don't see any active learning goals. Would you like to create one? Just tell me what you'd like to learn!",
      });
    }

    // Get current goal for context
    const currentGoal = allGoals.find(g => g.id === effectiveGoalId) ?? null;

    switch (intent) {
      case 'view_today':
        return this.handleViewToday(userId, effectiveGoalId!, currentGoal);

      case 'complete_pass':
        return this.handleComplete(userId, effectiveGoalId!, true, message);

      case 'complete_fail':
        return this.handleComplete(userId, effectiveGoalId!, false, message);

      case 'skip':
        return this.handleSkip(userId, effectiveGoalId!, message);

      case 'view_progress':
        return this.handleViewProgress(effectiveGoalId!, currentGoal);

      case 'view_week':
        return this.handleViewWeek(effectiveGoalId!, currentGoal);

      // Phase 19F: New milestone handler
      case 'view_milestone':
        return this.handleViewMilestone(effectiveGoalId!, currentGoal);

      case 'delete_goal':
        return this.handleDeleteGoal(userId, message, allGoals);

      case 'start_now':
        return this.handleStartNow(userId, effectiveGoalId!, allGoals, currentGoal);

      default:
        return ok({
          intent: 'unknown',
          response: "I'm not sure what you mean. You can ask:\n" +
            "• \"What's my lesson today?\" — view today's practice\n" +
            "• \"I'm done\" — mark practice complete\n" +
            "• \"Show my progress\" — see your stats\n" +
            "• \"Show this week\" — see week plan\n" +
            "• \"Show milestone\" — see quest milestone\n" +
            "• \"Show my goals\" — list all goals\n" +
            "• \"Start now\" — begin practicing early\n" +
            "• \"Delete goal 1\" — remove a specific goal\n" +
            "• \"Delete all goals\" — clear everything",
        });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  private async handleViewToday(
    userId: UserId,
    goalId: GoalId,
    goal: Goal | null
  ): AsyncAppResult<PracticeFlowResult> {
    const result = await this.practiceEngine.getTodayPractice(userId, goalId);

    if (!isOk(result)) {
      return ok({
        intent: 'view_today',
        response: `Couldn't fetch today's practice: ${result.error.message}`,
        goalId,
      });
    }

    const practice = result.value;

    if (!practice.hasContent || !practice.drill) {
      return ok({
        intent: 'view_today',
        response: "🎉 No practice scheduled for today! You're all caught up. Enjoy your break!\n\n" +
          "💡 **Tip:** Say \"start now\" if you want to practice early!",
        goalId,
      });
    }

    const drill = practice.drill;
    const skill = practice.skill;

    // Get quest for context
    let quest: Quest | null = null;
    if (drill.questId) {
      quest = await this.getQuestById(goalId, drill.questId);
    }

    // Phase 19F: Build enhanced drill display
    const drillDisplay = buildTodayDrillDisplay({
      drill,
      skill,
      weekPlan: practice.weekPlan,
      goal,
      quest,
    });

    // Use new formatter for response
    const response = formatDrillForChat(drillDisplay);

    return ok({
      intent: 'view_today',
      response,
      goalId,
      // Legacy drill format for backward compatibility
      drill: {
        action: drill.action,
        passSignal: drill.passSignal,
        skillName: skill?.action,
        constraint: drill.constraint,
      },
      // Phase 19F: Enhanced display
      drillDisplay,
    });
  }

  private async handleComplete(
    userId: UserId,
    goalId: GoalId,
    passed: boolean,
    observation?: string
  ): AsyncAppResult<PracticeFlowResult> {
    // Get today's drill first
    const todayResult = await this.practiceEngine.getTodayPractice(userId, goalId);

    if (!isOk(todayResult) || !todayResult.value.drill) {
      return ok({
        intent: passed ? 'complete_pass' : 'complete_fail',
        response: "I don't see an active practice for today. Say \"What's my lesson?\" to get started!",
        goalId,
      });
    }

    const drillId = todayResult.value.drill.id;

    // Record the outcome
    const result = await this.practiceEngine.recordOutcome(drillId, {
      passSignalMet: passed,
      observation: observation,
    });

    if (!isOk(result)) {
      return ok({
        intent: passed ? 'complete_pass' : 'complete_fail',
        response: `Couldn't record your result: ${result.error.message}`,
        goalId,
      });
    }

    const response = passed
      ? this.generatePassResponse(todayResult.value)
      : this.generateFailResponse(todayResult.value);

    return ok({
      intent: passed ? 'complete_pass' : 'complete_fail',
      response,
      goalId,
      completed: true,
    });
  }

  private async handleSkip(
    userId: UserId,
    goalId: GoalId,
    reason?: string
  ): AsyncAppResult<PracticeFlowResult> {
    // Get today's drill
    const todayResult = await this.practiceEngine.getTodayPractice(userId, goalId);

    if (!isOk(todayResult) || !todayResult.value.drill) {
      return ok({
        intent: 'skip',
        response: "No practice to skip today!",
        goalId,
      });
    }

    const drillId = todayResult.value.drill.id;

    // Skip the drill
    const result = await this.practiceEngine.skipDrill(drillId, reason);

    if (!isOk(result)) {
      return ok({
        intent: 'skip',
        response: `Couldn't skip: ${result.error.message}`,
        goalId,
      });
    }

    return ok({
      intent: 'skip',
      response: "⏭️ **Skipped for today.**\n\nNo worries — the skill will be waiting tomorrow. Take care!",
      goalId,
      skipped: true,
    });
  }

  private async handleViewProgress(
    goalId: GoalId,
    goal: Goal | null
  ): AsyncAppResult<PracticeFlowResult> {
    const result = await this.practiceEngine.getProgress(goalId);

    if (!isOk(result)) {
      return ok({
        intent: 'view_progress',
        response: `Couldn't fetch progress: ${result.error.message}`,
        goalId,
      });
    }

    const progress = result.value;

    // Get quests for enhanced display
    let quests: readonly Quest[] = [];
    let questProgress: readonly any[] = [];
    if (this.sparkEngine) {
      const questsResult = await this.sparkEngine.getQuestsForGoal(goalId);
      if (isOk(questsResult)) {
        quests = questsResult.value;
      }
    }

    // Get skills for skill tree (optional)
    let skills: readonly Skill[] = [];
    const skillsResult = await this.practiceEngine.getSkillsByGoal(goalId);
    if (isOk(skillsResult)) {
      skills = skillsResult.value;
    }

    // Phase 19F: Build enhanced progress display
    let progressDisplay: GoalProgressDisplay | undefined;
    if (goal) {
      progressDisplay = buildGoalProgressDisplay({
        goal,
        progress,
        quests,
        questProgress: [],
        skills,
        includeSkillTree: false, // Don't include full tree in chat
      });
    }

    // Use new formatter for response
    const response = progressDisplay
      ? formatProgressForChat(progressDisplay)
      : this.formatProgressResponseLegacy(progress);

    return ok({
      intent: 'view_progress',
      response,
      goalId,
      progress, // Legacy format
      progressDisplay, // Phase 19F
    });
  }

  private async handleViewWeek(
    goalId: GoalId,
    goal: Goal | null
  ): AsyncAppResult<PracticeFlowResult> {
    const result = await this.practiceEngine.getCurrentWeek(goalId);

    if (!isOk(result)) {
      return ok({
        intent: 'view_week',
        response: `Couldn't fetch week plan: ${result.error.message}`,
        goalId,
      });
    }

    const weekPlan = result.value;

    if (!weekPlan) {
      return ok({
        intent: 'view_week',
        response: "No active week plan found. Your learning plan may not have started yet.",
        goalId,
      });
    }

    // Get skills for this week
    let skills: readonly Skill[] = [];
    if (weekPlan.scheduledSkillIds && weekPlan.scheduledSkillIds.length > 0) {
      const skillResults = await Promise.all(
        weekPlan.scheduledSkillIds.map((id: SkillId) => this.practiceEngine.getSkill(id))
      );
      skills = skillResults
        .filter(isOk)
        .map((r: { value: Skill | null }) => r.value)
        .filter((s: Skill | null): s is Skill => s !== null);
    }

    // Get drills for this week
    let drills: readonly DailyDrill[] = [];
    // In production, we'd have a method to get drills by week

    // Get quest for context
    let quest: Quest | null = null;
    if (weekPlan.questId) {
      quest = await this.getQuestById(goalId, weekPlan.questId);
    }

    // Phase 19F: Build enhanced week display
    const weekDisplay = buildWeekSummaryDisplay({
      weekPlan,
      goal,
      quest,
      skills,
      drills,
      today: new Date().toISOString().split('T')[0],
    });

    // Use new formatter for response
    const response = formatWeekForChat(weekDisplay);

    return ok({
      intent: 'view_week',
      response,
      goalId,
      weekDisplay, // Phase 19F
    });
  }

  // Phase 19F: New milestone handler
  private async handleViewMilestone(
    goalId: GoalId,
    goal: Goal | null
  ): AsyncAppResult<PracticeFlowResult> {
    // Get current week to find current quest
    const weekResult = await this.practiceEngine.getCurrentWeek(goalId);
    
    if (!isOk(weekResult) || !weekResult.value) {
      return ok({
        intent: 'view_milestone',
        response: "No active learning plan found. Create a goal first to see milestones.",
        goalId,
      });
    }

    const weekPlan = weekResult.value;
    const questId = weekPlan.questId;

    if (!questId) {
      return ok({
        intent: 'view_milestone',
        response: "Couldn't find the current quest. Try again later.",
        goalId,
      });
    }

    // Get milestone for current quest
    const milestoneResult = await this.practiceEngine.getMilestone(questId);

    if (!isOk(milestoneResult) || !milestoneResult.value) {
      return ok({
        intent: 'view_milestone',
        response: "No milestone found for the current quest. Keep practicing!",
        goalId,
      });
    }

    const milestone = milestoneResult.value;

    // Get quest for context
    let quest: Quest | null = null;
    quest = await this.getQuestById(goalId, questId);

    if (!quest) {
      return ok({
        intent: 'view_milestone',
        response: "Couldn't load quest details. Try again.",
        goalId,
      });
    }

    // Get skills for this quest
    const skillsResult = await this.practiceEngine.getSkillsByQuest(questId);
    const skills = isOk(skillsResult) ? skillsResult.value : [];

    // Build milestone display
    const milestoneDisplay = buildMilestoneDisplay({
      milestone,
      quest,
      skills,
    });

    // Format for chat
    const response = formatMilestoneForChat(milestoneDisplay);

    return ok({
      intent: 'view_milestone',
      response,
      goalId,
      milestoneDisplay,
    });
  }

  private async handleViewGoals(
    userId: UserId,
    goals: readonly Goal[]
  ): AsyncAppResult<PracticeFlowResult> {
    if (goals.length === 0) {
      return ok({
        intent: 'view_goals',
        response: "You don't have any learning goals yet. Tell me what you'd like to learn!",
        goals: [],
      });
    }

    const lines: string[] = ['📚 **Your Learning Goals**\n'];

    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i]!;
      const num = i + 1;
      const status = goal.status === 'active' ? '🟢' : goal.status === 'completed' ? '✅' : '⏸️';
      lines.push(`${num}. ${status} **${goal.title}**`);
    }

    lines.push('\n---');
    lines.push('• Say **"switch to goal N"** to change your active goal');
    lines.push('• Say **"delete goal N"** to remove a goal');
    lines.push('• Say **"what\'s my lesson"** to see today\'s practice');

    return ok({
      intent: 'view_goals',
      response: lines.join('\n'),
      goals,
    });
  }

  private async handleDeleteGoal(
    userId: UserId,
    message: string,
    goals: readonly Goal[]
  ): AsyncAppResult<PracticeFlowResult> {
    if (!this.sparkEngine) {
      return ok({
        intent: 'delete_goal',
        response: "Goal deletion is not available.",
      });
    }

    const goalNumber = this.extractGoalNumber(message);

    if (goalNumber === null) {
      return ok({
        intent: 'delete_goal',
        response: "Please specify which goal to delete (e.g., \"delete goal 1\").",
      });
    }

    if (goalNumber < 1 || goalNumber > goals.length) {
      return ok({
        intent: 'delete_goal',
        response: `Invalid goal number. You have ${goals.length} goals. Say "show my goals" to see the list.`,
      });
    }

    const goalToDelete = goals[goalNumber - 1]!;

    // Delete the goal
    const result = await this.sparkEngine.deleteGoal(goalToDelete.id);

    if (!isOk(result)) {
      return ok({
        intent: 'delete_goal',
        response: `Couldn't delete goal: ${result.error.message}`,
      });
    }

    // Clear selected goal if it was the deleted one
    if (this.selectedGoalByUser.get(userId) === goalToDelete.id) {
      this.selectedGoalByUser.delete(userId);
    }

    return ok({
      intent: 'delete_goal',
      response: `🗑️ Deleted: **${goalToDelete.title}**`,
      deleted: true,
      deletedCount: 1,
    });
  }

  private async handleDeleteAll(
    userId: UserId,
    goals: readonly Goal[]
  ): AsyncAppResult<PracticeFlowResult> {
    if (!this.sparkEngine) {
      return ok({
        intent: 'delete_all',
        response: "Goal deletion is not available.",
      });
    }

    if (goals.length === 0) {
      return ok({
        intent: 'delete_all',
        response: "You don't have any goals to delete.",
      });
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const goal of goals) {
      const result = await this.sparkEngine.deleteGoal(goal.id);
      if (isOk(result)) {
        deletedCount++;
      } else {
        errors.push(`${goal.title}: ${result.error.message}`);
      }
    }

    // Clear selected goal for this user
    this.selectedGoalByUser.delete(userId);

    if (errors.length > 0) {
      return ok({
        intent: 'delete_all',
        response: `🗑️ Deleted ${deletedCount} of ${goals.length} goals.\n\nFailed to delete:\n${errors.join('\n')}`,
        deleted: true,
        deletedCount,
      });
    }

    return ok({
      intent: 'delete_all',
      response: `🗑️ **All ${deletedCount} goals deleted!**\n\nYou're starting fresh. Tell me what you'd like to learn!`,
      deleted: true,
      deletedCount,
    });
  }

  private async handleSwitchGoal(
    userId: UserId,
    message: string,
    goals: readonly Goal[]
  ): AsyncAppResult<PracticeFlowResult> {
    const goalNumber = this.extractGoalNumber(message);

    if (goalNumber === null || goalNumber < 1 || goalNumber > goals.length) {
      return ok({
        intent: 'switch_goal',
        response: `Invalid goal number. You have ${goals.length} goals. Say "show my goals" to see the list.`,
      });
    }

    const selectedGoal = goals[goalNumber - 1]!;
    this.selectedGoalByUser.set(userId, selectedGoal.id);

    return ok({
      intent: 'switch_goal',
      response: `✅ Switched to: **${selectedGoal.title}**\n\nNow when you ask for your lesson or progress, it'll be for this goal.`,
      goalId: selectedGoal.id,
    });
  }

  private async handleStartNow(
    userId: UserId,
    goalId: GoalId,
    goals: readonly Goal[],
    goal: Goal | null
  ): AsyncAppResult<PracticeFlowResult> {
    if (!goal) {
      return ok({
        intent: 'start_now',
        response: "Couldn't find the goal. Say \"show my goals\" to see your list.",
      });
    }

    // Try to generate a drill for today
    const today = new Date().toISOString().split('T')[0]!;
    
    try {
      const drillResult = await this.practiceEngine.generateDrill(userId, goalId, today);
      
      if (!isOk(drillResult)) {
        // If generation fails, try getting today's practice (might already exist)
        const todayResult = await this.practiceEngine.getTodayPractice(userId, goalId);
        
        if (isOk(todayResult) && todayResult.value.hasContent && todayResult.value.drill) {
          const drill = todayResult.value.drill;
          const skill = todayResult.value.skill;

          // Get quest for context
          let quest: Quest | null = null;
          if (drill.questId) {
            quest = await this.getQuestById(goalId, drill.questId);
          }

          // Build enhanced display
          const drillDisplay = buildTodayDrillDisplay({
            drill,
            skill,
            weekPlan: todayResult.value.weekPlan,
            goal,
            quest,
          });

          return ok({
            intent: 'start_now',
            response: `🚀 **Let's get started!**\n\n${formatDrillForChat(drillDisplay)}`,
            goalId,
            drill: {
              action: drill.action,
              passSignal: drill.passSignal,
              skillName: skill?.action,
              constraint: drill.constraint,
            },
            drillDisplay,
          });
        }
        
        return ok({
          intent: 'start_now',
          response: `Couldn't start practice: ${drillResult.error.message}\n\nThe learning plan may not be fully initialized yet. Try again in a moment.`,
          goalId,
        });
      }

      const drill = drillResult.value;
      
      // Get the skill for this drill
      let skill: Skill | null = null;
      if (drill.skillId) {
        const skillResult = await this.practiceEngine.getSkill(drill.skillId);
        if (isOk(skillResult)) {
          skill = skillResult.value;
        }
      }

      // Get quest for context
      let quest: Quest | null = null;
      if (drill.questId) {
        quest = await this.getQuestById(goalId, drill.questId);
      }

      // Build enhanced display
      const drillDisplay = buildTodayDrillDisplay({
        drill,
        skill,
        weekPlan: null,
        goal,
        quest,
      });

      return ok({
        intent: 'start_now',
        response: `🚀 **Let's get started!**\n\n${formatDrillForChat(drillDisplay)}`,
        goalId,
        drill: {
          action: drill.action,
          passSignal: drill.passSignal,
          skillName: skill?.action,
          constraint: drill.constraint,
        },
        drillDisplay,
      });
    } catch (error) {
      return ok({
        intent: 'start_now',
        response: `Couldn't start practice: ${error instanceof Error ? error.message : 'Unknown error'}`,
        goalId,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESPONSE GENERATORS
  // ─────────────────────────────────────────────────────────────────────────────

  private generatePassResponse(practice: TodayPracticeResult): string {
    const encouragements = [
      "🎉 Excellent work! You nailed it!",
      "✅ Great job! Keep that momentum going!",
      "🌟 Awesome! You're making real progress!",
      "💪 Nice work! One step closer to mastery!",
      "🔥 Crushed it! See you tomorrow!",
    ];

    const random = encouragements[Math.floor(Math.random() * encouragements.length)];

    if (practice.skill) {
      return `${random}\n\nSkill practiced: **${practice.skill.action}**\n\nCome back tomorrow for your next challenge!`;
    }

    return `${random}\n\nCome back tomorrow for your next challenge!`;
  }

  private generateFailResponse(practice: TodayPracticeResult): string {
    const encouragements = [
      "No worries! Learning takes practice.",
      "That's okay — every expert was once a beginner.",
      "Struggles are part of growth. You've got this!",
      "Not quite there yet, but you're building the foundation.",
    ];

    const random = encouragements[Math.floor(Math.random() * encouragements.length)];

    return `${random}\n\nWe'll retry this skill tomorrow with a fresh approach. 💪`;
  }

  // Legacy progress formatter (fallback)
  private formatProgressResponseLegacy(progress: GoalProgress): string {
    const lines: string[] = [];

    lines.push("📊 **Your Progress**\n");

    const total = progress.skillsTotal || 1;
    const mastered = progress.skillsMastered ?? 0;
    const practicing = progress.skillsPracticing ?? 0;
    const notStarted = progress.skillsNotStarted ?? 0;

    const percentage = Math.round(((mastered + practicing * 0.5) / total) * 100);

    lines.push(`**Overall:** ${percentage}% complete\n`);

    lines.push(`**Skills Breakdown:**`);
    lines.push(`• ✅ Mastered: ${mastered}`);
    lines.push(`• 🔄 Practicing: ${practicing}`);
    lines.push(`• ⏳ Not Started: ${notStarted}`);
    lines.push(`• **Total:** ${total}\n`);

    if (progress.currentWeek) {
      lines.push(`**Current Week:** Week ${progress.currentWeek}`);
    }

    if (progress.currentStreak && progress.currentStreak > 0) {
      lines.push(`**Streak:** ${progress.currentStreak} days 🔥`);
    }

    if (progress.overallPassRate !== undefined) {
      lines.push(`**Pass Rate:** ${Math.round(progress.overallPassRate * 100)}%`);
    }

    return lines.join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createPracticeFlow(deps: PracticeFlowDependencies): PracticeFlow {
  return new PracticeFlow(deps);
}
