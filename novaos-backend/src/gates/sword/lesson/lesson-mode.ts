// ═══════════════════════════════════════════════════════════════════════════════
// LESSON MODE — Simplified Practice System
// NovaOS Gates — Phase 20: Simplified Lesson Mode
// ═══════════════════════════════════════════════════════════════════════════════
//
// State machine for lesson mode with 6 commands:
//   - view: Show goals / goal details / current drill
//   - start: Start lesson (enters lesson mode)
//   - complete: Mark done (exits lesson mode)
//   - pause: Save and exit
//   - delete: Delete goal
//   - cancel: Exit without saving
//
// State transitions:
//   idle → start → selecting (if multiple goals) → active
//   idle → start [goal] → active (direct)
//   active → complete/pause/cancel → idle
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../../types/result.js';
import { ok, err, appError } from '../../../types/result.js';
import type { UserId, GoalId, DrillId } from '../../../types/branded.js';
import type { IRefinementStore } from '../../../services/spark-engine/store/types.js';
import type { IDeliberatePracticeEngine } from '../../../services/deliberate-practice-engine/interfaces.js';
import type { ISparkEngine } from '../../../services/spark-engine/interfaces.js';
import type { Goal } from '../../../services/spark-engine/types.js';
import type { 
  DailyDrill, 
  Skill, 
  WeekPlan,
  SkillMastery,
} from '../../../services/deliberate-practice-engine/types.js';
import type { TodayPracticeResult } from '../../../services/deliberate-practice-engine/interfaces.js';
import type { Quest, QuestResource } from '../../../services/spark-engine/types.js';

import type {
  LessonIntent,
  LessonModeInput,
  LessonModeOutput,
  LessonModeConfig,
  LessonModeState,
  GoalSummary,
} from './types.js';
import { DEFAULT_LESSON_MODE_CONFIG } from './types.js';

import { LessonStore, createLessonStore } from './lesson-store.js';
import {
  LessonIntentClassifier,
  createLessonIntentClassifier,
  type LessonIntentContext,
} from './lesson-intent-classifier.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON MODE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dependencies for LessonMode.
 */
export interface LessonModeDependencies {
  readonly baseStore: IRefinementStore;
  readonly practiceEngine: IDeliberatePracticeEngine;
  readonly sparkEngine: ISparkEngine;
  readonly config?: Partial<LessonModeConfig>;
}

/**
 * Main lesson mode handler.
 */
export class LessonMode {
  private readonly store: LessonStore;
  private readonly classifier: LessonIntentClassifier | null;
  private readonly practiceEngine: IDeliberatePracticeEngine;
  private readonly sparkEngine: ISparkEngine;
  private readonly config: LessonModeConfig;

  constructor(deps: LessonModeDependencies) {
    this.config = { ...DEFAULT_LESSON_MODE_CONFIG, ...deps.config };
    this.store = createLessonStore(deps.baseStore, this.config);
    this.classifier = createLessonIntentClassifier(this.config.openaiApiKey);
    this.practiceEngine = deps.practiceEngine;
    this.sparkEngine = deps.sparkEngine;

    console.log('[LESSON_MODE] Initialized');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle a lesson mode interaction.
   */
  async execute(input: LessonModeInput): AsyncAppResult<LessonModeOutput> {
    const { userId, message } = input;

    // Get or create session state
    const stateResult = await this.store.getOrCreate(userId);
    if (!stateResult.ok) {
      return err(stateResult.error);
    }

    const state = stateResult.value;

    // Get user's goals
    const goalsResult = await this.getGoalSummaries(userId);
    if (!goalsResult.ok) {
      return err(goalsResult.error);
    }

    const goals = goalsResult.value;

    // Classify intent
    const intentResult = await this.classifyIntent(message, state, goals);

    console.log(`[LESSON_MODE] Stage: ${state.stage}, Intent: ${intentResult.intent}, Goal: ${intentResult.goalReference ?? 'none'}`);

    // Route to handler based on intent
    return this.routeToHandler(input, state, intentResult, goals);
  }

  /**
   * Check if user is in lesson mode.
   */
  async isInLessonMode(userId: UserId): AsyncAppResult<boolean> {
    return this.store.isInLessonMode(userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTENT CLASSIFICATION
  // ═══════════════════════════════════════════════════════════════════════════════

  private async classifyIntent(
    message: string,
    state: LessonModeState,
    goals: readonly GoalSummary[]
  ): Promise<{ intent: LessonIntent; goalReference: string | null }> {
    if (!this.classifier) {
      // Fallback: simple pattern matching
      return this.classifyWithPatterns(message, state);
    }

    const context: LessonIntentContext = {
      stage: state.stage,
      goals: goals.map(g => ({
        id: g.id,
        title: g.title,
        completedToday: g.completedToday,
      })),
    };

    const result = await this.classifier.classify(message, context);
    return {
      intent: result.intent,
      goalReference: result.goalReference,
    };
  }

  /**
   * Fallback pattern-based classification.
   */
  private classifyWithPatterns(
    message: string,
    state: LessonModeState
  ): { intent: LessonIntent; goalReference: string | null } {
    const lower = message.toLowerCase().trim();

    // Simple patterns
    if (/^(done|finished|completed|did it)/.test(lower)) {
      return { intent: 'complete', goalReference: null };
    }
    if (/^(cancel|nevermind|exit|quit)/.test(lower)) {
      return { intent: 'cancel', goalReference: null };
    }
    if (/^(pause|stop|save|break)/.test(lower)) {
      return { intent: 'pause', goalReference: null };
    }
    if (/^(start|begin|go|let'?s)/.test(lower)) {
      const goalMatch = lower.match(/(?:start|begin)\s+(.+)/i);
      return { intent: 'start', goalReference: goalMatch?.[1] ?? null };
    }
    if (/^(view|show|list|goals|my goals)/.test(lower)) {
      return { intent: 'view', goalReference: null };
    }
    if (/^(delete|remove)/.test(lower)) {
      const goalMatch = lower.match(/(?:delete|remove)\s+(?:goal\s*)?(.+)/i);
      return { intent: 'delete', goalReference: goalMatch?.[1] ?? null };
    }
    if (/^#?[1-9]\d?\.?$/.test(lower)) {
      // Extract just the number
      const num = lower.replace(/[#.]/g, '');
      return { intent: 'select', goalReference: num };
    }
    // Handle ordinals: first, second, third, fourth, fifth
    const ordinalMatch = lower.match(/^(the\s+)?(first|second|third|fourth|fifth)(\s+one)?$/i);
    if (ordinalMatch) {
      const ordinalMap: Record<string, string> = { first: '1', second: '2', third: '3', fourth: '4', fifth: '5' };
      return { intent: 'select', goalReference: ordinalMap[ordinalMatch[2]!.toLowerCase()] ?? '1' };
    }

    // In active mode, treat unknown as question
    if (state.stage === 'active') {
      return { intent: 'question', goalReference: null };
    }

    // Default to view
    return { intent: 'view', goalReference: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTENT ROUTING
  // ═══════════════════════════════════════════════════════════════════════════════

  private async routeToHandler(
    input: LessonModeInput,
    state: LessonModeState,
    intentResult: { intent: LessonIntent; goalReference: string | null },
    goals: readonly GoalSummary[]
  ): AsyncAppResult<LessonModeOutput> {
    const { intent, goalReference } = intentResult;

    switch (intent) {
      case 'view':
        return this.handleView(input.userId, goalReference, goals, state);

      case 'start':
        return this.handleStart(input.userId, goalReference, goals, state);

      case 'complete':
        return this.handleComplete(input.userId, state);

      case 'pause':
        return this.handlePause(input.userId, state);

      case 'delete':
        return this.handleDelete(input.userId, goalReference, goals);

      case 'cancel':
        return this.handleCancel(input.userId, state);

      case 'select':
        return this.handleSelect(input.userId, goalReference, goals, state);

      case 'question':
        return this.handleQuestion(input.userId, input.message, state);

      default:
        return this.handleView(input.userId, null, goals, state);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle VIEW intent.
   */
  private async handleView(
    userId: UserId,
    goalReference: string | null,
    goals: readonly GoalSummary[],
    state: LessonModeState
  ): AsyncAppResult<LessonModeOutput> {
    // If in active mode, show current drill
    if (state.stage === 'active' && state.goalId) {
      return this.showCurrentDrill(userId, state);
    }

    // If no goals, prompt to create
    if (goals.length === 0) {
      return ok({
        response: "📚 You don't have any learning goals yet.\n\nSay **\"I want to learn...\"** to create one!",
        stage: 'idle',
        suppressModelGeneration: true,
        intent: 'view',
        goals: [],
      });
    }

    // If goal reference provided, show that goal's details
    if (goalReference) {
      const goal = this.resolveGoalReference(goalReference, goals);
      if (goal) {
        return this.showGoalDetails(userId, goal);
      }
    }

    // Show all goals
    return this.showAllGoals(goals);
  }

  /**
   * Handle START intent.
   */
  private async handleStart(
    userId: UserId,
    goalReference: string | null,
    goals: readonly GoalSummary[],
    state: LessonModeState
  ): AsyncAppResult<LessonModeOutput> {
    // No goals?
    if (goals.length === 0) {
      return ok({
        response: "📚 You don't have any learning goals yet.\n\nSay **\"I want to learn...\"** to create one!",
        stage: 'idle',
        suppressModelGeneration: true,
        intent: 'start',
      });
    }

    // If goal reference provided, start that goal directly
    if (goalReference) {
      const goal = this.resolveGoalReference(goalReference, goals);
      if (goal) {
        return this.startGoal(userId, goal);
      }
    }

    // If confirming_review and user said yes
    if (state.stage === 'confirming_review' && state.goalId) {
      const goal = goals.find(g => g.id === state.goalId);
      if (goal) {
        return this.startGoalAsReview(userId, goal);
      }
    }

    // If only one goal, start it
    if (goals.length === 1) {
      return this.startGoal(userId, goals[0]!);
    }

    // Multiple goals: enter selecting mode
    await this.store.enterSelecting(userId);

    const goalsList = goals
      .map((g, i) => {
        const status = g.completedToday ? '✅' : g.paused ? '⏸️' : '🟢';
        const priority = g.priority ? ` (P${g.priority})` : '';
        return `${i + 1}. ${status} **${g.title}**${priority} — Day ${g.dayNumber}`;
      })
      .join('\n');

    return ok({
      response: `Which goal would you like to practice?\n\n${goalsList}\n\nSay a **number** or **goal name**.`,
      stage: 'selecting',
      suppressModelGeneration: true,
      intent: 'start',
      goals,
    });
  }

  /**
   * Handle COMPLETE intent.
   */
  private async handleComplete(
    userId: UserId,
    state: LessonModeState
  ): AsyncAppResult<LessonModeOutput> {
    // Must be in active mode
    if (state.stage !== 'active') {
      return ok({
        response: "I don't see an active lesson. Say **\"start\"** to begin practicing!",
        stage: state.stage,
        suppressModelGeneration: true,
        intent: 'complete',
      });
    }

    // If it's a review, just exit (don't record outcome)
    if (state.isReview) {
      await this.store.exitToIdle(userId);
      return ok({
        response: `✅ **Review complete!**\n\nGood job revisiting **${state.goalTitle}**. See you next time!`,
        stage: 'idle',
        suppressModelGeneration: true,
        intent: 'complete',
        completed: true,
      });
    }

    // Record drill completion
    if (state.drillId) {
      try {
        const result = await this.practiceEngine.recordOutcome(state.drillId, {
          passSignalMet: true,
        });

        if (result.ok) {
          const encouragements = [
            "🎉 Excellent work! You nailed it!",
            "✅ Great job! Keep that momentum going!",
            "🌟 Awesome! You're making real progress!",
            "💪 Nice work! One step closer to mastery!",
            "🔥 Crushed it! See you tomorrow!",
          ];
          const encouragement = encouragements[Math.floor(Math.random() * encouragements.length)];

          await this.store.exitToIdle(userId);

          return ok({
            response: `${encouragement}\n\n**${state.goalTitle}** — Day complete!\n\nCome back tomorrow for your next challenge.`,
            stage: 'idle',
            suppressModelGeneration: true,
            intent: 'complete',
            completed: true,
            goalId: state.goalId ?? undefined,
          });
        }
      } catch (error) {
        console.error('[LESSON_MODE] Failed to record outcome:', error);
      }
    }

    // Fallback: just exit
    await this.store.exitToIdle(userId);
    return ok({
      response: `✅ **Lesson complete!**\n\nGreat work on **${state.goalTitle}**!`,
      stage: 'idle',
      suppressModelGeneration: true,
      intent: 'complete',
      completed: true,
    });
  }

  /**
   * Handle PAUSE intent.
   */
  private async handlePause(
    userId: UserId,
    state: LessonModeState
  ): AsyncAppResult<LessonModeOutput> {
    // If not in active mode, just acknowledge
    if (state.stage !== 'active') {
      return ok({
        response: "👍 No active lesson to pause. Say **\"start\"** when you're ready to practice!",
        stage: 'idle',
        suppressModelGeneration: true,
        intent: 'pause',
      });
    }

    // Exit to idle (progress is automatically saved)
    await this.store.exitToIdle(userId);

    return ok({
      response: `⏸️ **Paused!**\n\n**${state.goalTitle}** saved. Say **\"start\"** when you're ready to continue.`,
      stage: 'idle',
      suppressModelGeneration: true,
      intent: 'pause',
    });
  }

  /**
   * Handle DELETE intent.
   */
  private async handleDelete(
    userId: UserId,
    goalReference: string | null,
    goals: readonly GoalSummary[]
  ): AsyncAppResult<LessonModeOutput> {
    // Delete all?
    if (goalReference?.toLowerCase() === 'all') {
      let deletedCount = 0;
      for (const goal of goals) {
        try {
          await this.sparkEngine.deleteGoal(goal.id as GoalId);
          deletedCount++;
        } catch (error) {
          console.error(`[LESSON_MODE] Failed to delete goal ${goal.id}:`, error);
        }
      }

      return ok({
        response: `🗑️ **Deleted ${deletedCount} goals!**\n\nStarting fresh. Say **\"I want to learn...\"** to create a new goal.`,
        stage: 'idle',
        suppressModelGeneration: true,
        intent: 'delete',
        deleted: true,
      });
    }

    // Delete specific goal
    if (goalReference) {
      const goal = this.resolveGoalReference(goalReference, goals);
      if (goal) {
        try {
          await this.sparkEngine.deleteGoal(goal.id as GoalId);

          return ok({
            response: `🗑️ **Deleted:** ${goal.title}\n\nSay **\"view\"** to see your remaining goals.`,
            stage: 'idle',
            suppressModelGeneration: true,
            intent: 'delete',
            deleted: true,
          });
        } catch (error) {
          return ok({
            response: `❌ Failed to delete goal: ${error instanceof Error ? error.message : 'Unknown error'}`,
            stage: 'idle',
            suppressModelGeneration: true,
            intent: 'delete',
          });
        }
      }
    }

    // No goal specified, ask which one
    if (goals.length === 0) {
      return ok({
        response: "📚 You don't have any goals to delete.",
        stage: 'idle',
        suppressModelGeneration: true,
        intent: 'delete',
      });
    }

    const goalsList = goals
      .map((g, i) => `${i + 1}. ${g.title}`)
      .join('\n');

    return ok({
      response: `Which goal would you like to delete?\n\n${goalsList}\n\nSay **\"delete 1\"** or **\"delete [name]\"** or **\"delete all\"**.`,
      stage: 'idle',
      suppressModelGeneration: true,
      intent: 'delete',
      goals,
    });
  }

  /**
   * Handle CANCEL intent.
   */
  private async handleCancel(
    userId: UserId,
    state: LessonModeState
  ): AsyncAppResult<LessonModeOutput> {
    await this.store.exitToIdle(userId);

    if (state.stage === 'active') {
      return ok({
        response: `👋 Exited lesson mode.\n\nYour progress on **${state.goalTitle}** was not saved. Say **\"start\"** when you're ready to try again.`,
        stage: 'idle',
        suppressModelGeneration: true,
        intent: 'cancel',
      });
    }

    return ok({
      response: "👋 Cancelled. Say **\"start\"** when you're ready to practice!",
      stage: 'idle',
      suppressModelGeneration: true,
      intent: 'cancel',
    });
  }

  /**
   * Handle SELECT intent.
   */
  private async handleSelect(
    userId: UserId,
    goalReference: string | null,
    goals: readonly GoalSummary[],
    state: LessonModeState
  ): AsyncAppResult<LessonModeOutput> {
    if (!goalReference) {
      return this.handleStart(userId, null, goals, state);
    }

    const goal = this.resolveGoalReference(goalReference, goals);
    if (!goal) {
      return ok({
        response: `❓ I couldn't find a goal matching "${goalReference}".\n\nSay **\"view\"** to see your goals.`,
        stage: state.stage,
        suppressModelGeneration: true,
        intent: 'select',
      });
    }

    return this.startGoal(userId, goal);
  }

  /**
   * Handle QUESTION intent (when in lesson mode).
   */
  private async handleQuestion(
    userId: UserId,
    message: string,
    state: LessonModeState
  ): AsyncAppResult<LessonModeOutput> {
    // Only valid in active mode
    if (state.stage !== 'active') {
      return ok({
        response: "I'm not sure what you're asking about. Say **\"start\"** to begin a lesson!",
        stage: state.stage,
        suppressModelGeneration: true,
        intent: 'question',
      });
    }

    // For now, pass through to LLM (don't suppress generation)
    // The context about the current lesson should help the LLM answer
    return ok({
      response: '', // Let the main LLM handle this
      stage: 'active',
      suppressModelGeneration: false, // Let LLM respond
      intent: 'question',
      goalId: state.goalId ?? undefined,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get goal summaries for a user.
   */
  private async getGoalSummaries(userId: UserId): AsyncAppResult<GoalSummary[]> {
    const goalsResult = await this.sparkEngine.getUserGoals(userId, { status: 'active' });
    if (!goalsResult.ok) {
      return err(goalsResult.error);
    }

    const today = new Date().toISOString().split('T')[0]!;
    const summaries: GoalSummary[] = [];

    for (const goal of goalsResult.value) {
      // Get practice status for today
      let completedToday = false;
      let dayNumber = 1;

      try {
        const practiceResult = await this.practiceEngine.getTodayPractice(userId, goal.id as GoalId);
        if (practiceResult.ok && practiceResult.value.drill) {
          completedToday = practiceResult.value.drill.status === 'completed';
          dayNumber = practiceResult.value.drill.dayNumber;
        }
      } catch {
        // Ignore errors, use defaults
      }

      summaries.push({
        id: goal.id as GoalId,
        title: goal.title,
        priority: goal.priority ?? null,
        progress: 0, // TODO: Calculate actual progress
        dayNumber,
        completedToday,
        paused: !!(goal.pausedUntil && goal.pausedUntil > today),
      });
    }

    // Sort by priority (lower = higher priority)
    summaries.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    return ok(summaries);
  }

  /**
   * Resolve goal reference (number or name) to a goal.
   */
  private resolveGoalReference(
    reference: string,
    goals: readonly GoalSummary[]
  ): GoalSummary | null {
    const trimmed = reference.trim().toLowerCase();

    // Try as number
    const num = parseInt(trimmed.replace(/^goal\s*/i, ''), 10);
    if (!isNaN(num) && num >= 1 && num <= goals.length) {
      return goals[num - 1] ?? null;
    }

    // Try as name (partial match)
    for (const goal of goals) {
      if (goal.title.toLowerCase().includes(trimmed)) {
        return goal;
      }
    }

    return null;
  }

  /**
   * Show all goals.
   */
  private async showAllGoals(goals: readonly GoalSummary[]): AsyncAppResult<LessonModeOutput> {
    const goalsList = goals
      .map((g, i) => {
        const status = g.completedToday ? '✅' : g.paused ? '⏸️' : '🟢';
        const priority = g.priority ? ` (P${g.priority})` : '';
        return `${i + 1}. ${status} **${g.title}**${priority}`;
      })
      .join('\n');

    return ok({
      response: `📚 **Your Learning Goals**\n\n${goalsList}\n\n---\n• Say **\"start\"** to begin practicing\n• Say **\"start [name]\"** for a specific goal\n• Say **\"view [name]\"** for details`,
      stage: 'idle',
      suppressModelGeneration: true,
      intent: 'view',
      goals,
    });
  }

  /**
   * Show details for a specific goal.
   */
  private async showGoalDetails(
    userId: UserId,
    goal: GoalSummary
  ): AsyncAppResult<LessonModeOutput> {
    const status = goal.completedToday ? '✅ Completed today' : goal.paused ? '⏸️ Paused' : '🟢 Active';

    return ok({
      response: `📚 **${goal.title}**\n\n${status}\nDay ${goal.dayNumber}\n\n---\nSay **\"start ${goal.title.split(' ')[1]?.toLowerCase() ?? ''}\"** to practice.`,
      stage: 'idle',
      suppressModelGeneration: true,
      intent: 'view',
      goalId: goal.id,
    });
  }

  /**
   * Show current drill (when in active mode).
   */
  private async showCurrentDrill(
    userId: UserId,
    state: LessonModeState
  ): AsyncAppResult<LessonModeOutput> {
    if (!state.goalId) {
      return this.handleCancel(userId, state);
    }

    // Get current drill
    try {
      const practiceResult = await this.practiceEngine.getTodayPractice(userId, state.goalId);
      if (practiceResult.ok && practiceResult.value.drill) {
        const drill = practiceResult.value.drill;
        const response = this.formatDrill(drill, state.goalTitle ?? 'Your Goal', state.isReview);

        return ok({
          response,
          stage: 'active',
          suppressModelGeneration: true,
          intent: 'view',
          goalId: state.goalId,
          drill: {
            action: drill.action,
            passSignal: drill.passSignal,
            constraint: drill.constraint,
            dayNumber: drill.dayNumber,
            estimatedMinutes: drill.estimatedMinutes,
          },
        });
      }
    } catch (error) {
      console.error('[LESSON_MODE] Failed to get current drill:', error);
    }

    return ok({
      response: `📚 **${state.goalTitle}** — In Progress\n\nSay **\"complete\"** when done or **\"pause\"** to save and exit.`,
      stage: 'active',
      suppressModelGeneration: true,
      intent: 'view',
      goalId: state.goalId,
    });
  }

  /**
   * Start a goal (enter lesson mode).
   */
  private async startGoal(
    userId: UserId,
    goal: GoalSummary
  ): AsyncAppResult<LessonModeOutput> {
    // If already completed today, ask about review
    if (goal.completedToday) {
      await this.store.enterConfirmingReview(userId, goal.id, goal.title);

      return ok({
        response: `✅ You already completed **${goal.title}** today!\n\nWant to review the same lesson? (yes/no)`,
        stage: 'confirming_review',
        suppressModelGeneration: true,
        intent: 'start',
        goalId: goal.id,
      });
    }

    // Get today's practice with full context
    const today = new Date().toISOString().split('T')[0]!;
    let practiceResult: TodayPracticeResult | null = null;

    try {
      const result = await this.practiceEngine.getTodayPractice(userId, goal.id);
      if (result.ok && result.value.drill) {
        practiceResult = result.value;
      } else if (result.ok && !result.value.drill) {
        // No drill exists, try to generate one
        const generateResult = await this.practiceEngine.generateDrill(userId, goal.id, today);
        if (generateResult.ok) {
          // Re-fetch to get full context
          const refetch = await this.practiceEngine.getTodayPractice(userId, goal.id);
          if (refetch.ok) {
            practiceResult = refetch.value;
          }
        }
      }
    } catch (error) {
      console.error('[LESSON_MODE] Failed to get/generate drill:', error);
    }

    if (!practiceResult?.drill) {
      return ok({
        response: `⚠️ Couldn't load lesson for **${goal.title}**.\n\nThe learning plan may not be fully initialized. Try again in a moment.`,
        stage: 'idle',
        suppressModelGeneration: true,
        intent: 'start',
      });
    }

    const drill = practiceResult.drill;

    // Fetch quest resources if available
    let questResources: readonly QuestResource[] = [];
    if (practiceResult.questId && practiceResult.goalId) {
      try {
        // getQuest doesn't exist, so we fetch all quests and filter
        const questsResult = await this.sparkEngine.getQuestsForGoal(practiceResult.goalId);
        if (questsResult.ok) {
          const quest = questsResult.value.find(q => q.id === practiceResult.questId);
          if (quest?.verifiedResources) {
            questResources = quest.verifiedResources;
          }
        }
      } catch (error) {
        // Resources are optional, don't fail
        console.log('[LESSON_MODE] Could not fetch quest resources:', error);
      }
    }

    // Enter active mode
    await this.store.enterActive(
      userId,
      goal.id,
      drill.id,
      goal.title,
      false,
      `Practicing: ${drill.action}`
    );

    const response = this.formatRichDrill(practiceResult, goal.title, questResources, false);

    return ok({
      response,
      stage: 'active',
      suppressModelGeneration: true,
      intent: 'start',
      goalId: goal.id,
      drill: {
        action: drill.action,
        passSignal: drill.passSignal,
        constraint: drill.constraint,
        dayNumber: drill.dayNumber,
        estimatedMinutes: drill.estimatedMinutes,
      },
    });
  }

  /**
   * Start a goal as review (already completed today).
   */
  private async startGoalAsReview(
    userId: UserId,
    goal: GoalSummary
  ): AsyncAppResult<LessonModeOutput> {
    // Get today's practice with full context
    let practiceResult: TodayPracticeResult | null = null;

    try {
      const result = await this.practiceEngine.getTodayPractice(userId, goal.id);
      if (result.ok && result.value.drill) {
        practiceResult = result.value;
      }
    } catch (error) {
      console.error('[LESSON_MODE] Failed to get drill for review:', error);
    }

    if (!practiceResult?.drill) {
      await this.store.exitToIdle(userId);
      return ok({
        response: `⚠️ Couldn't load the lesson for review. Try again later.`,
        stage: 'idle',
        suppressModelGeneration: true,
        intent: 'start',
      });
    }

    const drill = practiceResult.drill;

    // Fetch quest resources if available
    let questResources: readonly QuestResource[] = [];
    if (practiceResult.questId && practiceResult.goalId) {
      try {
        // getQuest doesn't exist, so we fetch all quests and filter
        const questsResult = await this.sparkEngine.getQuestsForGoal(practiceResult.goalId);
        if (questsResult.ok) {
          const quest = questsResult.value.find(q => q.id === practiceResult.questId);
          if (quest?.verifiedResources) {
            questResources = quest.verifiedResources;
          }
        }
      } catch (error) {
        console.log('[LESSON_MODE] Could not fetch quest resources:', error);
      }
    }

    // Enter active mode as review
    await this.store.enterActive(
      userId,
      goal.id,
      drill.id,
      goal.title,
      true, // isReview
      `Reviewing: ${drill.action}`
    );

    const response = this.formatRichDrill(practiceResult, goal.title, questResources, true);

    return ok({
      response,
      stage: 'active',
      suppressModelGeneration: true,
      intent: 'start',
      goalId: goal.id,
      drill: {
        action: drill.action,
        passSignal: drill.passSignal,
        constraint: drill.constraint,
        dayNumber: drill.dayNumber,
        estimatedMinutes: drill.estimatedMinutes,
      },
    });
  }

  /**
   * Format drill for display (legacy fallback).
   */
  private formatDrill(
    drill: DailyDrill,
    goalTitle: string,
    isReview: boolean
  ): string {
    const lines: string[] = [];

    const reviewTag = isReview ? ' (Review)' : '';
    lines.push(`📚 **${goalTitle}** — Day ${drill.dayNumber}${reviewTag}`);
    lines.push('');
    lines.push(`🎯 **Today's Practice:**`);
    lines.push(drill.action);
    lines.push('');
    lines.push(`✅ **Success Signal:**`);
    lines.push(drill.passSignal);

    if (drill.constraint) {
      lines.push('');
      lines.push(`🔒 **Focus:** ${drill.constraint}`);
    }

    if (drill.estimatedMinutes) {
      lines.push('');
      lines.push(`⏱️ ~${drill.estimatedMinutes} minutes`);
    }

    lines.push('');
    lines.push('---');
    lines.push('Say **\"complete\"** when done, **\"pause\"** to save for later.');

    return lines.join('\n');
  }

  /**
   * Format rich drill display with full context.
   */
  private formatRichDrill(
    practice: TodayPracticeResult,
    goalTitle: string,
    resources: readonly QuestResource[],
    isReview: boolean
  ): string {
    const { drill, skill, weekPlan, context } = practice;
    
    if (!drill) {
      return 'No drill available.';
    }

    // Check if this is a Phase 21 drill (has dayType field)
    const isPhase21 = !!(drill as any).dayType;
    
    if (isPhase21) {
      return this.formatPhase21Drill(drill, weekPlan, goalTitle, resources, isReview);
    }

    // Legacy format for non-Phase 21 drills
    return this.formatLegacyDrill(drill, skill, weekPlan, goalTitle, resources, isReview, context);
  }

  /**
   * Format Phase 21 drill with science-based display.
   */
  private formatPhase21Drill(
    drill: DailyDrill,
    weekPlan: WeekPlan | null,
    goalTitle: string,
    resources: readonly QuestResource[],
    isReview: boolean
  ): string {
    const d = drill as any;
    const lines: string[] = [];
    
    const dayTypeIcons: Record<string, string> = {
      encounter: '👋',
      struggle: '💪',
      connect: '🔗',
      fail: '🔧',
      prove: '🎯',
    };
    const dayTypeLabels: Record<string, string> = {
      encounter: 'ENCOUNTER — First Exposure',
      struggle: 'STRUGGLE — Try Without Aids',
      connect: 'CONNECT — Link Knowledge',
      fail: 'FAIL — Diagnose & Repair',
      prove: 'PROVE — Demonstrate Mastery',
    };

    // Header
    const icon = dayTypeIcons[d.dayType] ?? '📚';
    const reviewTag = isReview ? ' 🔄' : '';
    if (weekPlan) {
      lines.push(`${icon} **${goalTitle}** — Week ${weekPlan.weekNumber}${reviewTag}`);
      if ((weekPlan as any).skill) {
        lines.push(`   *Skill: ${(weekPlan as any).skill}*`);
      }
    } else {
      lines.push(`${icon} **${goalTitle}**${reviewTag}`);
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    // Day Type Banner
    const dayLabel = dayTypeLabels[d.dayType] ?? d.dayType?.toUpperCase();
    lines.push(`📅 **Day ${d.globalDayNumber ?? drill.dayNumber}** | ${dayLabel}`);
    lines.push('');

    // PRIME (if present)
    if (d.prime) {
      lines.push(`🧠 **PRIME** *(recall from yesterday)*`);
      lines.push(`   ${d.prime}`);
      lines.push('');
      lines.push(`   💡 Answer: ||${d.primeAnswer}||`);
      lines.push('');
      lines.push('───────────────────────────────────────');
      lines.push('');
    }

    // DO (main action)
    lines.push(`📝 **DO:**`);
    lines.push(`   ${d.do ?? drill.action}`);
    
    // Given Material (for ENCOUNTER/FAIL days)
    if (d.givenMaterial) {
      lines.push('');
      if (d.givenMaterialType === 'code' || d.givenMaterialType === 'broken_code') {
        lines.push('```');
        lines.push(d.givenMaterial);
        lines.push('```');
      } else {
        lines.push(`   📋 ${d.givenMaterial}`);
      }
    }
    lines.push('');

    // DONE (success signal)
    lines.push(`✅ **DONE WHEN:**`);
    lines.push(`   ${d.done ?? drill.passSignal}`);
    lines.push('');

    // STUCK/UNSTUCK
    if (d.stuck) {
      lines.push(`⚠️ **IF STUCK:** ${d.stuck}`);
      lines.push(`🔧 **FIX:** ${d.unstuck}`);
      lines.push('');
    }

    // WHY (motivation)
    if (d.why) {
      lines.push(`💡 **WHY:** ${d.why}`);
      lines.push('');
    }

    // Resources (based on policy)
    const policy = d.resourcePolicy ?? 'available';
    if (policy !== 'none' && resources.length > 0) {
      const policyNote = policy === 'after_attempt' 
        ? ' *(only after 5-min attempt)*'
        : policy === 'hint_only'
        ? ' *(hint only)*'
        : '';
      lines.push(`📖 **RESOURCES**${policyNote}:`);
      for (const resource of resources.slice(0, 3)) {
        lines.push(`   • ${resource.title}`);
      }
      lines.push('');
    } else if (policy === 'none') {
      lines.push(`📖 **RESOURCES:** *None — prove it from memory!*`);
      lines.push('');
    }

    // Time
    if (drill.estimatedMinutes) {
      lines.push(`⏱️ ~${drill.estimatedMinutes} minutes`);
      lines.push('');
    }

    // REFLECT (end of session prompt)
    if (d.reflect) {
      lines.push('───────────────────────────────────────');
      lines.push(`💭 **REFLECT (after):** ${d.reflect}`);
      lines.push('');
    }

    // Footer
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('Say **"done"** when complete, **"stuck"** for help, **"pause"** to save.');

    return lines.join('\n');
  }

  /**
   * Format legacy drill (non-Phase 21).
   */
  private formatLegacyDrill(
    drill: DailyDrill,
    skill: Skill | null,
    weekPlan: WeekPlan | null,
    goalTitle: string,
    resources: readonly QuestResource[],
    isReview: boolean,
    context: string | null
  ): string {
    const lines: string[] = [];
    const reviewTag = isReview ? ' 🔄 REVIEW' : '';

    if (weekPlan) {
      lines.push(`📚 **${goalTitle}** — Week ${weekPlan.weekNumber}: ${weekPlan.theme}${reviewTag}`);
    } else {
      lines.push(`📚 **${goalTitle}**${reviewTag}`);
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    const skillName = skill?.action?.split(' ').slice(0, 6).join(' ') || 'Practice';
    lines.push(`📅 **Day ${drill.dayNumber}** | Skill: ${skillName}`);
    
    if (skill) {
      const masteryIcon = this.getMasteryIcon(skill.mastery);
      const masteryLabel = this.getMasteryLabel(skill.mastery);
      lines.push(`   Mastery: ${masteryIcon} ${masteryLabel}`);
    }
    lines.push('');

    lines.push(`📝 **TODAY'S ACTION:**`);
    lines.push(`   ${drill.action}`);
    lines.push('');

    lines.push(`✅ **YOU'LL KNOW IT WORKED WHEN:**`);
    lines.push(`   ${drill.passSignal}`);
    lines.push('');

    if (drill.lockedVariables && drill.lockedVariables.length > 0) {
      lines.push(`🔒 **KEEP THESE CONSTANT:**`);
      for (const locked of drill.lockedVariables) {
        lines.push(`   • ${locked}`);
      }
      lines.push('');
    } else if (drill.constraint) {
      lines.push(`🔒 **FOCUS:** ${drill.constraint}`);
      lines.push('');
    }

    if (skill?.adversarialElement) {
      lines.push(`⚠️ **WATCH OUT FOR:**`);
      lines.push(`   ${skill.adversarialElement}`);
      lines.push('');
    }

    if (drill.isRetry && skill?.recoverySteps) {
      lines.push(`🔁 **RETRY TIP (attempt ${drill.retryCount + 1}):**`);
      lines.push(`   ${skill.recoverySteps}`);
      lines.push('');
    }

    if (drill.continuationContext) {
      lines.push(`📌 **CONTINUING FROM YESTERDAY:**`);
      lines.push(`   ${drill.continuationContext}`);
      lines.push('');
    }

    if (resources.length > 0) {
      lines.push(`📖 **RESOURCES:**`);
      for (const resource of resources.slice(0, 3)) {
        const typeIcon = this.getResourceTypeIcon(resource.type);
        lines.push(`   ${typeIcon} ${resource.title}`);
        lines.push(`      ${resource.url}`);
      }
      if (resources.length > 3) {
        lines.push(`   ... and ${resources.length - 3} more`);
      }
      lines.push('');
    }

    if (drill.estimatedMinutes) {
      lines.push(`⏱️ ~${drill.estimatedMinutes} minutes`);
      lines.push('');
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('Say **"complete"** when done, **"pause"** to save for later.');

    return lines.join('\n');
  }
  private getMasteryIcon(mastery: SkillMastery): string {
    switch (mastery) {
      case 'not_started': return '⚪';
      case 'practicing': return '🔵';
      case 'mastered': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Get mastery label for display.
   */
  private getMasteryLabel(mastery: SkillMastery): string {
    switch (mastery) {
      case 'not_started': return 'Not Started (needs 3 passes)';
      case 'practicing': return 'Practicing (1+ passes)';
      case 'mastered': return 'Mastered ✓';
      default: return 'Unknown';
    }
  }

  /**
   * Get resource type icon.
   */
  private getResourceTypeIcon(type: string): string {
    switch (type) {
      case 'video': return '📺';
      case 'article': return '📄';
      case 'tutorial': return '📝';
      case 'documentation': return '📚';
      case 'course': return '🎓';
      case 'book': return '📖';
      case 'interactive': return '🎮';
      default: return '🔗';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a LessonMode instance.
 */
export function createLessonMode(deps: LessonModeDependencies): LessonMode {
  return new LessonMode(deps);
}
