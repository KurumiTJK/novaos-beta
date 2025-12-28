// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE — Main Orchestrator
// NovaOS Deliberate Practice Engine — Phase 18: Core Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// The main orchestrator that coordinates:
//   - Learning plan initialization from goals
//   - Daily drill generation with roll-forward
//   - Outcome recording and mastery updates
//   - Week transitions and carry-forward
//   - Progress tracking
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';
import type {
  GoalId,
  QuestId,
  SkillId,
  DrillId,
  WeekPlanId,
  UserId,
  Timestamp,
} from '../../types/branded.js';
import { createWeekPlanId, createTimestamp } from '../../types/branded.js';
import type { Goal, Quest } from '../spark-engine/types.js';
import type { CapabilityStage } from '../../gates/sword/capability-generator.js';
import type {
  Skill,
  DailyDrill,
  WeekPlan,
  LearningPlan,
  DrillOutcome,
  SkillMastery,
  QuestSkillMapping,
  QuestWeekMapping,
} from './types.js';
import { MASTERY_THRESHOLDS, countsAsAttempt, requiresRetry } from './types.js';
import type {
  IDeliberatePracticeEngine,
  TodayPracticeResult,
  DrillCompletionParams,
  GoalProgress,
  IDeliberatePracticeStores,
} from './interfaces.js';
import type { DrillCompletionAnalysis } from './types.js';
import { SkillDecomposer, type SkillDecomposerConfig } from './skill-decomposer.js';
import { DrillGenerator, type DrillGeneratorConfig } from './drill-generator.js';
import { WeekTracker } from './week-tracker.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default daily time budget in minutes.
 */
const DEFAULT_DAILY_MINUTES = 30;

/**
 * Default practice days per week.
 */
const PRACTICE_DAYS_PER_WEEK = 5;

/**
 * Default user level for new learners.
 */
const DEFAULT_USER_LEVEL: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';

// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for DeliberatePracticeEngine.
 */
export interface DeliberatePracticeEngineConfig {
  /** Daily time budget in minutes */
  dailyMinutes?: number;
  /** User's skill level */
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
  /** User's timezone */
  timezone?: string;
  /** OpenAI API key for LLM features */
  openaiApiKey?: string;
  /** Whether to use LLM for smart decomposition/adaptation */
  useLLM?: boolean;
}

/**
 * Dependencies for DeliberatePracticeEngine.
 */
export interface DeliberatePracticeEngineDependencies {
  stores: IDeliberatePracticeStores;
  config?: DeliberatePracticeEngineConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main orchestrator for the Deliberate Practice system.
 *
 * Coordinates skill decomposition, drill generation, outcome recording,
 * and week transitions to create a complete learning experience.
 */
export class DeliberatePracticeEngine implements IDeliberatePracticeEngine {
  private readonly stores: IDeliberatePracticeStores;
  private readonly skillDecomposer: SkillDecomposer;
  private readonly drillGenerator: DrillGenerator;
  private readonly weekTracker: WeekTracker;
  private readonly config: Required<DeliberatePracticeEngineConfig>;

  constructor(deps: DeliberatePracticeEngineDependencies) {
    this.stores = deps.stores;

    // Set defaults
    this.config = {
      dailyMinutes: deps.config?.dailyMinutes ?? DEFAULT_DAILY_MINUTES,
      userLevel: deps.config?.userLevel ?? DEFAULT_USER_LEVEL,
      timezone: deps.config?.timezone ?? 'UTC',
      openaiApiKey: deps.config?.openaiApiKey ?? '',
      useLLM: deps.config?.useLLM ?? false,
    };

    // Create sub-components
    this.skillDecomposer = new SkillDecomposer({
      openaiApiKey: this.config.openaiApiKey,
      useLLM: this.config.useLLM,
    });

    this.drillGenerator = new DrillGenerator({
      openaiApiKey: this.config.openaiApiKey,
      useLLM: this.config.useLLM,
    });

    this.weekTracker = new WeekTracker({
      weekPlanStore: this.stores.weekPlans,
      skillStore: this.stores.skills,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Initialize a learning plan from goal and quests.
   */
  async initializePlan(
    goal: Goal,
    quests: readonly Quest[],
    stagesByQuest: ReadonlyMap<QuestId, readonly CapabilityStage[]>
  ): AsyncAppResult<LearningPlan> {
    const userId = goal.userId;
    const goalId = goal.id;

    // Check if plan already exists
    const existingPlan = await this.stores.learningPlans.get(goalId);
    if (existingPlan.ok && existingPlan.value !== null) {
      return ok(existingPlan.value);
    }

    // Decompose each quest into skills
    const questSkillMappings: QuestSkillMapping[] = [];
    const questWeekMappings: QuestWeekMapping[] = [];
    let totalSkills = 0;
    let totalDays = 0;
    let weekNumber = 1;

    for (let questIndex = 0; questIndex < quests.length; questIndex++) {
      const quest = quests[questIndex]!;
      const stages = stagesByQuest.get(quest.id);

      if (!stages || stages.length === 0) {
        continue;
      }

      // Decompose this quest
      const decompositionResult = await this.skillDecomposer.decompose({
        quest,
        goal,
        stages,
        dailyMinutes: this.config.dailyMinutes,
        userLevel: this.config.userLevel,
      });

      if (!decompositionResult.ok) {
        // Log warning but continue with other quests
        console.warn(`Failed to decompose quest ${quest.id}: ${decompositionResult.error.message}`);
        continue;
      }

      const { skills, totalDays: questDays, suggestedWeekCount } = decompositionResult.value;

      // Save skills
      for (const skill of skills) {
        const saveResult = await this.stores.skills.save(skill);
        if (!saveResult.ok) {
          console.warn(`Failed to save skill ${skill.id}: ${saveResult.error.message}`);
        }
      }

      // Record mapping
      questSkillMappings.push({
        questId: quest.id,
        questTitle: quest.title,
        questOrder: questIndex + 1,
        skillIds: skills.map(s => s.id),
        skillCount: skills.length,
        estimatedDays: questDays,
      });

      // Calculate week allocation for this quest
      const questWeeks: number[] = [];
      const questWeekPlanIds: WeekPlanId[] = [];

      for (let i = 0; i < suggestedWeekCount; i++) {
        questWeeks.push(weekNumber + i);
      }

      questWeekMappings.push({
        questId: quest.id,
        weekNumbers: questWeeks,
        weekPlanIds: questWeekPlanIds, // Will be filled when weeks are created
      });

      totalSkills += skills.length;
      totalDays += questDays;
      weekNumber += suggestedWeekCount;
    }

    if (totalSkills === 0) {
      return err(appError('PROCESSING_ERROR', 'No skills could be generated from quests'));
    }

    // Calculate total weeks and estimated completion
    const totalWeeks = Math.ceil(totalDays / PRACTICE_DAYS_PER_WEEK);
    const startDate = new Date();
    const estimatedCompletionDate = new Date(startDate);
    estimatedCompletionDate.setDate(startDate.getDate() + (totalWeeks * 7));

    const now = createTimestamp();

    // Create learning plan
    const learningPlan: LearningPlan = {
      goalId,
      userId,
      totalWeeks,
      totalSkills,
      totalDrills: totalDays, // Approximate: 1 drill per day
      estimatedCompletionDate: estimatedCompletionDate.toISOString().split('T')[0]!,
      questSkillMapping: questSkillMappings,
      questWeekMapping: questWeekMappings,
      generatedAt: now,
    };

    // Save learning plan
    const savePlanResult = await this.stores.learningPlans.save(learningPlan);
    if (!savePlanResult.ok) {
      return err(savePlanResult.error);
    }

    // Create first week plan
    await this.createFirstWeekPlan(goal, quests[0]!, questSkillMappings[0]!);

    return ok(learningPlan);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DAILY OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get today's practice for a user.
   */
  async getTodayPractice(userId: UserId, goalId: GoalId): AsyncAppResult<TodayPracticeResult> {
    const today = this.getToday();

    // Check for existing drill
    const existingDrill = await this.stores.drills.getByDate(userId, goalId, today);
    if (existingDrill.ok && existingDrill.value !== null) {
      const drill = existingDrill.value;
      const skill = await this.stores.skills.get(drill.skillId);
      const weekPlan = await this.stores.weekPlans.get(drill.weekPlanId);

      return ok({
        hasContent: true,
        drill,
        spark: null, // Spark integration happens in Phase 4
        weekPlan: weekPlan.ok ? weekPlan.value : null,
        skill: skill.ok ? skill.value : null,
        date: today,
        timezone: this.config.timezone,
        context: drill.continuationContext ?? null,
        goalId,
        questId: weekPlan.ok && weekPlan.value ? weekPlan.value.questId : null,
      });
    }

    // Generate new drill
    const drillResult = await this.generateDrill(userId, goalId, today);
    if (!drillResult.ok) {
      // No drill available - might be completed or error
      return ok({
        hasContent: false,
        drill: null,
        spark: null,
        weekPlan: null,
        skill: null,
        date: today,
        timezone: this.config.timezone,
        context: null,
        goalId: null,
        questId: null,
      });
    }

    const drill = drillResult.value;
    const skill = await this.stores.skills.get(drill.skillId);
    const weekPlan = await this.stores.weekPlans.get(drill.weekPlanId);

    return ok({
      hasContent: true,
      drill,
      spark: null,
      weekPlan: weekPlan.ok ? weekPlan.value : null,
      skill: skill.ok ? skill.value : null,
      date: today,
      timezone: this.config.timezone,
      context: drill.continuationContext ?? null,
      goalId,
      questId: weekPlan.ok && weekPlan.value ? weekPlan.value.questId : null,
    });
  }

  /**
   * Generate a drill for a specific date.
   */
  async generateDrill(
    userId: UserId,
    goalId: GoalId,
    date: string
  ): AsyncAppResult<DailyDrill> {
    // Get current week plan
    const weekPlanResult = await this.weekTracker.getCurrentWeek(goalId);
    if (!weekPlanResult.ok) {
      return err(weekPlanResult.error);
    }

    const weekPlan = weekPlanResult.value;
    if (!weekPlan) {
      return err(appError('NOT_FOUND', 'No active week plan found'));
    }

    // Get available skills for this week
    const skillsResult = await this.stores.skills.getByGoal(goalId);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }

    const allSkills = skillsResult.value.items;
    const weekSkillIds = new Set([
      ...weekPlan.scheduledSkillIds,
      ...weekPlan.carryForwardSkillIds,
    ]);
    const availableSkills = allSkills.filter(s => weekSkillIds.has(s.id));

    if (availableSkills.length === 0) {
      return err(appError('NOT_FOUND', 'No skills available for this week'));
    }

    // Get previous drill for roll-forward
    const previousDrillResult = await this.getPreviousDrill(userId, goalId, date);
    const previousDrill = previousDrillResult.ok ? previousDrillResult.value : undefined;

    // Calculate day number
    const dayNumber = await this.calculateDayNumber(goalId, date);

    // Generate drill
    const drillResult = await this.drillGenerator.generate({
      userId,
      goalId,
      weekPlan,
      availableSkills,
      previousDrill,
      date,
      dayNumber,
      dailyMinutes: this.config.dailyMinutes,
    });

    if (!drillResult.ok) {
      return err(drillResult.error);
    }

    const drill = drillResult.value;

    // Save drill
    const saveResult = await this.stores.drills.save(drill);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    return ok(drill);
  }

  /**
   * Get drill by ID.
   */
  async getDrill(drillId: DrillId): AsyncAppResult<DailyDrill | null> {
    return this.stores.drills.get(drillId);
  }

  /**
   * Get drill for a specific date.
   */
  async getDrillByDate(
    userId: UserId,
    goalId: GoalId,
    date: string
  ): AsyncAppResult<DailyDrill | null> {
    return this.stores.drills.getByDate(userId, goalId, date);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPLETION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record drill outcome and update mastery.
   */
  async recordOutcome(
    drillId: DrillId,
    params: DrillCompletionParams
  ): AsyncAppResult<DailyDrill> {
    // Get the drill
    const drillResult = await this.stores.drills.get(drillId);
    if (!drillResult.ok) {
      return err(drillResult.error);
    }
    if (drillResult.value === null) {
      return err(appError('NOT_FOUND', `Drill not found: ${drillId}`));
    }

    const drill = drillResult.value;

    // Determine outcome
    const outcome: DrillOutcome = params.passSignalMet ? 'pass' : 'fail';

    // Generate carry-forward based on outcome and observation
    const carryForward = this.generateCarryForward(outcome, params.observation);

    // Update drill with outcome
    const updateResult = await this.stores.drills.updateOutcome(
      drillId,
      outcome,
      params.observation,
      carryForward
    );

    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    const updatedDrill = updateResult.value;

    // Update skill mastery based on outcome
    if (outcome === 'pass') {
      await this.updateSkillMastery(drill.skillId, 'practicing');
    } else if (outcome === 'fail' || outcome === 'partial') {
      await this.updateSkillMastery(drill.skillId, 'attempted');
    }
    // 'skipped' doesn't update mastery

    // Update week progress
    await this.weekTracker.updateProgress(drill.weekPlanId, outcome, drill.skillId);

    return ok(updatedDrill);
  }

  /**
   * Skip a drill with reason.
   */
  async skipDrill(drillId: DrillId, reason?: string): AsyncAppResult<DailyDrill> {
    return this.stores.drills.updateOutcome(drillId, 'skipped', reason, 'Rescheduled for next session');
  }

  /**
   * Mark a drill as missed (end of day reconciliation).
   */
  async markMissed(drillId: DrillId): AsyncAppResult<DailyDrill> {
    const drillResult = await this.stores.drills.get(drillId);
    if (!drillResult.ok) {
      return err(drillResult.error);
    }
    if (drillResult.value === null) {
      return err(appError('NOT_FOUND', `Drill not found: ${drillId}`));
    }

    const drill = drillResult.value;

    // Update drill status to missed
    const now = createTimestamp();
    const missedDrill: DailyDrill = {
      ...drill,
      status: 'missed',
      outcome: 'skipped',
      repeatTomorrow: true,
      carryForward: 'Missed - rescheduled for next session',
      updatedAt: now,
    };

    // Save updated drill
    const saveResult = await this.stores.drills.save(missedDrill);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    return ok(saveResult.value.entity);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SKILL MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get skill by ID.
   */
  async getSkill(skillId: SkillId): AsyncAppResult<Skill | null> {
    return this.stores.skills.get(skillId);
  }

  /**
   * Get skills for a quest.
   */
  async getSkillsByQuest(questId: QuestId): AsyncAppResult<readonly Skill[]> {
    const result = await this.stores.skills.getByQuest(questId);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.items);
  }

  /**
   * Update skill mastery manually.
   */
  async updateSkillMastery(skillId: SkillId, mastery: SkillMastery): AsyncAppResult<Skill> {
    const skillResult = await this.stores.skills.get(skillId);
    if (!skillResult.ok) {
      return err(skillResult.error);
    }
    if (skillResult.value === null) {
      return err(appError('NOT_FOUND', `Skill not found: ${skillId}`));
    }

    const skill = skillResult.value;

    // Calculate new counts based on mastery level
    let passCount = skill.passCount;
    let failCount = skill.failCount;
    let consecutivePasses = skill.consecutivePasses;

    // If called from recordOutcome, mastery is the outcome cast to SkillMastery
    // We need to handle this appropriately
    if (mastery === 'pass' as unknown as SkillMastery) {
      passCount++;
      consecutivePasses++;

      // Determine actual mastery level based on counts
      if (passCount >= MASTERY_THRESHOLDS.MASTERED && consecutivePasses >= MASTERY_THRESHOLDS.CONSECUTIVE_FOR_MASTERY) {
        mastery = 'mastered';
      } else if (passCount >= MASTERY_THRESHOLDS.PRACTICING) {
        mastery = 'practicing';
      } else {
        mastery = 'attempted';
      }
    } else if (mastery === 'fail' as unknown as SkillMastery) {
      failCount++;
      consecutivePasses = 0;
      mastery = passCount > 0 ? 'practicing' : 'attempted';
    }

    return this.stores.skills.updateMastery(skillId, mastery, passCount, failCount, consecutivePasses);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WEEK MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get current week plan for a goal.
   */
  async getCurrentWeek(goalId: GoalId): AsyncAppResult<WeekPlan | null> {
    return this.weekTracker.getCurrentWeek(goalId);
  }

  /**
   * Get all week plans for a goal.
   */
  async getWeeks(goalId: GoalId): AsyncAppResult<readonly WeekPlan[]> {
    return this.weekTracker.getAllWeeks(goalId);
  }

  /**
   * Complete the current week and transition to next.
   */
  async completeWeek(weekPlanId: WeekPlanId): AsyncAppResult<import('./interfaces.js').WeekCompletionResult> {
    return this.weekTracker.completeWeek(weekPlanId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROGRESS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get overall progress for a goal.
   */
  async getProgress(goalId: GoalId): AsyncAppResult<GoalProgress> {
    // Get learning plan
    const planResult = await this.stores.learningPlans.get(goalId);
    if (!planResult.ok) {
      return err(planResult.error);
    }
    const learningPlan = planResult.value;

    // Get all skills for the goal
    const skillsResult = await this.stores.skills.getByGoal(goalId);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }
    const skills = skillsResult.value.items;

    // Get all weeks
    const weeksResult = await this.weekTracker.getAllWeeks(goalId);
    if (!weeksResult.ok) {
      return err(weeksResult.error);
    }
    const weeks = weeksResult.value;

    // Calculate skill mastery counts
    const skillsMastered = skills.filter(s => s.mastery === 'mastered').length;
    const skillsPracticing = skills.filter(s => s.mastery === 'practicing' || s.mastery === 'attempted').length;
    const skillsNotStarted = skills.filter(s => s.mastery === 'not_started').length;

    // Calculate week progress
    const weeksCompleted = weeks.filter(w => w.status === 'completed').length;
    const currentWeekPlan = weeks.find(w => w.status === 'active');
    const currentWeek = currentWeekPlan?.weekNumber ?? 1;

    // Calculate drill statistics
    const totalDrillsCompleted = weeks.reduce((sum, w) => sum + w.drillsCompleted, 0);
    const totalDrillsPassed = weeks.reduce((sum, w) => sum + w.drillsPassed, 0);
    const totalDrillsFailed = weeks.reduce((sum, w) => sum + w.drillsFailed, 0);
    const totalAttempted = totalDrillsPassed + totalDrillsFailed;
    const overallPassRate = totalAttempted > 0 ? totalDrillsPassed / totalAttempted : 0;

    // Calculate streaks (simplified)
    const currentStreak = this.calculateCurrentStreak([...skills]);
    const longestStreak = currentStreak; // Would need drill history for accurate count

    // Calculate schedule status
    const totalWeeks = learningPlan?.totalWeeks ?? weeks.length;
    const expectedDays = currentWeek * PRACTICE_DAYS_PER_WEEK;
    const daysBehind = Math.max(0, expectedDays - totalDrillsCompleted);
    const onTrack = daysBehind <= 2;

    // Last practice date
    const lastPracticedSkill = skills
      .filter(s => s.lastPracticedAt)
      .sort((a, b) => (b.lastPracticedAt ?? '').localeCompare(a.lastPracticedAt ?? ''))[0];

    return ok({
      goalId,
      skillsMastered,
      skillsPracticing,
      skillsNotStarted,
      skillsTotal: skills.length,
      weeksCompleted,
      weeksTotal: totalWeeks,
      currentWeek,
      currentStreak,
      longestStreak,
      overallPassRate,
      daysCompleted: totalDrillsCompleted,
      daysTotal: learningPlan?.totalDrills ?? skills.length,
      onTrack,
      daysBehind,
      estimatedCompletionDate: learningPlan?.estimatedCompletionDate ?? '',
      lastPracticeDate: lastPracticedSkill?.lastPracticedAt?.split('T')[0] ?? null,
    });
  }

  /**
   * Get learning plan for a goal.
   */
  async getLearningPlan(goalId: GoalId): AsyncAppResult<LearningPlan | null> {
    return this.stores.learningPlans.get(goalId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get today's date in YYYY-MM-DD format.
   */
  private getToday(): string {
    return new Date().toISOString().split('T')[0]!;
  }

  /**
   * Get the previous drill for roll-forward analysis.
   */
  private async getPreviousDrill(
    userId: UserId,
    goalId: GoalId,
    date: string
  ): AsyncAppResult<DailyDrill | undefined> {
    const yesterday = this.addDays(date, -1);
    const result = await this.stores.drills.getByDate(userId, goalId, yesterday);
    if (result.ok && result.value) {
      return ok(result.value);
    }
    return ok(undefined);
  }

  /**
   * Calculate the day number for a drill.
   */
  private async calculateDayNumber(goalId: GoalId, date: string): Promise<number> {
    // Get learning plan for start date
    const planResult = await this.stores.learningPlans.get(goalId);
    if (!planResult.ok || !planResult.value) {
      return 1;
    }

    const plan = planResult.value;
    const startDate = new Date(plan.generatedAt);
    const currentDate = new Date(date);

    const diffTime = currentDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(1, diffDays);
  }

  /**
   * Generate carry-forward text based on outcome.
   */
  private generateCarryForward(outcome: DrillOutcome, observation?: string): string {
    switch (outcome) {
      case 'pass':
        return observation
          ? `Completed successfully. Note: ${observation.slice(0, 100)}`
          : 'Completed successfully. Ready to advance.';
      case 'fail':
        return observation
          ? `Needs retry. Issue: ${observation.slice(0, 100)}`
          : 'Needs retry. Focus on the blocking issue.';
      case 'partial':
        return observation
          ? `Continue tomorrow. Progress: ${observation.slice(0, 100)}`
          : 'Continue tomorrow from where you left off.';
      case 'skipped':
        return 'Rescheduled for next session.';
      default:
        return 'Continue practice.';
    }
  }

  /**
   * Calculate current practice streak.
   */
  private calculateCurrentStreak(skills: Skill[]): number {
    // Simplified: count skills with recent practice
    const recentlyPracticed = skills.filter(s => {
      if (!s.lastPracticedAt) return false;
      const lastDate = new Date(s.lastPracticedAt);
      const now = new Date();
      const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 1;
    });
    return recentlyPracticed.length;
  }

  /**
   * Create the first week plan for a goal.
   */
  private async createFirstWeekPlan(
    goal: Goal,
    firstQuest: Quest,
    firstMapping: QuestSkillMapping
  ): AsyncAppResult<WeekPlan> {
    const now = new Date();
    const startDate = now.toISOString().split('T')[0]!;
    const endDate = this.addDays(startDate, 6);

    const timestamp = createTimestamp();

    const weekPlan: WeekPlan = {
      id: createWeekPlanId(),
      goalId: goal.id,
      userId: goal.userId,
      questId: firstQuest.id,
      weekNumber: 1,
      startDate,
      endDate,
      status: 'active',
      weeklyCompetence: firstQuest.description ?? 'Complete first week of practice',
      theme: firstQuest.title,
      scheduledSkillIds: firstMapping.skillIds.slice(0, PRACTICE_DAYS_PER_WEEK),
      carryForwardSkillIds: [],
      completedSkillIds: [],
      drillsCompleted: 0,
      drillsTotal: Math.min(firstMapping.skillIds.length, PRACTICE_DAYS_PER_WEEK),
      drillsPassed: 0,
      drillsFailed: 0,
      drillsSkipped: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saveResult = await this.stores.weekPlans.save(weekPlan);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    return ok(weekPlan);
  }

  /**
   * Add days to a date string.
   */
  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]!;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a DeliberatePracticeEngine instance.
 */
export function createDeliberatePracticeEngine(
  deps: DeliberatePracticeEngineDependencies
): DeliberatePracticeEngine {
  return new DeliberatePracticeEngine(deps);
}
