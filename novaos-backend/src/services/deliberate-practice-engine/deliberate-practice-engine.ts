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
  QuestDuration,
  DrillCompletionAnalysis,
  SkillType,
  DayPlan,
  MilestoneStatus,
  QuestMilestone,
} from './types.js';
import { MASTERY_THRESHOLDS, countsAsAttempt, requiresRetry } from './types.js';
import type {
  IDeliberatePracticeEngine,
  TodayPracticeResult,
  DrillCompletionParams,
  GoalProgress,
  QuestProgress,
  IDeliberatePracticeStores,
  WeekProgressUpdate,
  WeeklySummary,
} from './interfaces.js';
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
    const questDurations: QuestDuration[] = [];
    let totalSkills = 0;
    let totalDays = 0;
    let weekNumber = 1;
    let totalFoundationSkills = 0;
    let totalBuildingSkills = 0;
    let totalCompoundSkills = 0;
    let totalSynthesisSkills = 0;

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
        userId: goal.userId,
      });

      if (!decompositionResult.ok) {
        // Log warning but continue with other quests
        console.warn(`Failed to decompose quest ${quest.id}: ${decompositionResult.error.message}`);
        continue;
      }

      const { skills, estimatedDays: questDays, totalMinutes } = decompositionResult.value;
      const suggestedWeekCount = Math.ceil(questDays / 5); // 5 practice days per week

      // Save skills
      for (const skill of skills) {
        const saveResult = await this.stores.skills.save(skill);
        if (!saveResult.ok) {
          console.warn(`Failed to save skill ${skill.id}: ${saveResult.error.message}`);
        }
      }

      // Record mapping with skill type counts
      const foundationCount = skills.filter((s: Skill) => s.skillType === 'foundation').length;
      const buildingCount = skills.filter((s: Skill) => s.skillType === 'building').length;
      const compoundCount = skills.filter((s: Skill) => s.skillType === 'compound').length;
      const hasSynthesis = skills.some((s: Skill) => s.skillType === 'synthesis');

      questSkillMappings.push({
        questId: quest.id,
        questTitle: quest.title,
        questOrder: questIndex + 1,
        skillIds: skills.map((s: Skill) => s.id),
        skillCount: skills.length,
        estimatedDays: questDays,
        foundationCount,
        buildingCount,
        compoundCount,
        hasSynthesis,
      });

      // Calculate week allocation for this quest
      const questWeeks: number[] = [];
      const questWeekPlanIds: WeekPlanId[] = [];

      for (let i = 0; i < suggestedWeekCount; i++) {
        questWeeks.push(weekNumber + i);
      }

      // Create quest duration
      const duration: QuestDuration = {
        unit: 'weeks',
        value: suggestedWeekCount,
        practiceDays: questDays,
        weekStart: weekNumber,
        weekEnd: weekNumber + suggestedWeekCount - 1,
        displayLabel: suggestedWeekCount === 1
          ? `Week ${weekNumber}`
          : `Weeks ${weekNumber}-${weekNumber + suggestedWeekCount - 1}`,
      };

      questDurations.push(duration);

      questWeekMappings.push({
        questId: quest.id,
        weekNumbers: questWeeks,
        weekPlanIds: questWeekPlanIds, // Will be filled when weeks are created
        duration,
      });

      // Accumulate skill type totals
      totalFoundationSkills += foundationCount;
      totalBuildingSkills += buildingCount;
      totalCompoundSkills += compoundCount;
      totalSynthesisSkills += hasSynthesis ? 1 : 0;

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
      totalPracticeDays: totalDays,
      totalSkills,
      totalDrills: totalDays, // Approximate: 1 drill per day
      estimatedCompletionDate: estimatedCompletionDate.toISOString().split('T')[0]!,
      questSkillMapping: questSkillMappings,
      questWeekMapping: questWeekMappings,
      questDurations,
      foundationSkillCount: totalFoundationSkills,
      buildingSkillCount: totalBuildingSkills,
      compoundSkillCount: totalCompoundSkills,
      synthesisSkillCount: totalSynthesisSkills,
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

      const skillValue = skill.ok ? skill.value : null;
      const weekPlanValue = weekPlan.ok ? weekPlan.value : null;

      // Get component skills for compound drills
      let componentSkills: readonly Skill[] | null = null;
      if (skillValue?.isCompound && skillValue.componentSkillIds?.length) {
        const components = await Promise.all(
          skillValue.componentSkillIds.map(id => this.stores.skills.get(id))
        );
        componentSkills = components
          .filter(r => r.ok && r.value)
          .map(r => r.value!);
      }

      // Get review skill if present
      let reviewSkill: Skill | null = null;
      let reviewQuestTitle: string | null = null;
      if (drill.reviewSkillId) {
        const reviewResult = await this.stores.skills.get(drill.reviewSkillId);
        if (reviewResult.ok && reviewResult.value) {
          reviewSkill = reviewResult.value;
          // Get quest title from learning plan
          const planResult = await this.stores.learningPlans.get(goalId);
          if (planResult.ok && planResult.value) {
            const mapping = planResult.value.questSkillMapping.find(m => m.questId === reviewSkill!.questId);
            reviewQuestTitle = mapping?.questTitle ?? null;
          }
        }
      }

      return ok({
        hasContent: true,
        drill,
        spark: null, // Spark integration happens in Phase 4
        weekPlan: weekPlanValue,
        skill: skillValue,
        date: today,
        timezone: this.config.timezone,
        context: drill.continuationContext ?? null,
        goalId,
        questId: weekPlanValue?.questId ?? null,
        skillType: skillValue?.skillType ?? null,
        componentSkills,
        reviewSkill,
        reviewQuestTitle,
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
        skillType: null,
        componentSkills: null,
        reviewSkill: null,
        reviewQuestTitle: null,
      });
    }

    const drill = drillResult.value;
    const skill = await this.stores.skills.get(drill.skillId);
    const weekPlan = await this.stores.weekPlans.get(drill.weekPlanId);

    const skillValue = skill.ok ? skill.value : null;
    const weekPlanValue = weekPlan.ok ? weekPlan.value : null;

    // Get component skills for compound drills
    let componentSkills: readonly Skill[] | null = null;
    if (skillValue?.isCompound && skillValue.componentSkillIds?.length) {
      const components = await Promise.all(
        skillValue.componentSkillIds.map(id => this.stores.skills.get(id))
      );
      componentSkills = components
        .filter(r => r.ok && r.value)
        .map(r => r.value!);
    }

    // Get review skill if present
    let reviewSkill: Skill | null = null;
    let reviewQuestTitle: string | null = null;
    if (drill.reviewSkillId) {
      const reviewResult = await this.stores.skills.get(drill.reviewSkillId);
      if (reviewResult.ok && reviewResult.value) {
        reviewSkill = reviewResult.value;
        // Get quest title from learning plan
        const planResult = await this.stores.learningPlans.get(goalId);
        if (planResult.ok && planResult.value) {
          const mapping = planResult.value.questSkillMapping.find(m => m.questId === reviewSkill!.questId);
          reviewQuestTitle = mapping?.questTitle ?? null;
        }
      }
    }

    return ok({
      hasContent: true,
      drill,
      spark: null,
      weekPlan: weekPlanValue,
      skill: skillValue,
      date: today,
      timezone: this.config.timezone,
      context: drill.continuationContext ?? null,
      goalId,
      questId: weekPlanValue?.questId ?? null,
      skillType: skillValue?.skillType ?? null,
      componentSkills,
      reviewSkill,
      reviewQuestTitle,
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
    const availableSkills = allSkills.filter((s: Skill) => weekSkillIds.has(s.id));

    if (availableSkills.length === 0) {
      return err(appError('NOT_FOUND', 'No skills available for this week'));
    }

    // Get previous drill for roll-forward
    const previousDrillResult = await this.getPreviousDrill(userId, goalId, date);
    const previousDrill = previousDrillResult.ok ? previousDrillResult.value : undefined;

    // Use roll-forward to determine next skill
    const rollForwardResult = await this.drillGenerator.rollForward(
      previousDrill ?? null,
      availableSkills,
      weekPlan
    );
    if (!rollForwardResult.ok) {
      return err(rollForwardResult.error);
    }

    const { skill, isRetry, retryCount } = rollForwardResult.value;

    // Get goal and quest info from learning plan
    const planResult = await this.stores.learningPlans.get(goalId);
    const learningPlan = planResult.ok ? planResult.value : null;

    // Create goal placeholder with required info
    const goal: Goal = {
      id: goalId,
      userId,
      title: 'Learning Goal',
      description: '',
      status: 'active',
      createdAt: createTimestamp(),
      updatedAt: createTimestamp(),
    } as Goal;

    // Create quest placeholder with required info
    const questMapping = learningPlan?.questSkillMapping.find(m => m.questId === skill.questId);
    const quest: Quest = {
      id: skill.questId,
      goalId,
      title: questMapping?.questTitle ?? 'Quest',
      description: '',
      order: questMapping?.questOrder ?? 1,
      status: 'active',
      createdAt: createTimestamp(),
      updatedAt: createTimestamp(),
    } as Quest;

    // Calculate day number
    const dayNumber = await this.calculateDayNumber(goalId, date);

    // Build day plan
    const dayPlan: DayPlan = {
      dayNumber,
      dayInQuest: dayNumber, // Will be refined
      scheduledDate: date,
      skillId: skill.id,
      skillType: skill.skillType,
      skillTitle: skill.title,
      reviewSkillId: undefined,
      reviewQuestId: undefined,
      status: 'pending',
    };

    // Get previous quest skills for warmup
    const previousQuestSkillsResult = await this.getPreviousQuestSkills(goalId, skill.questId);
    const previousQuestSkills = previousQuestSkillsResult.ok ? previousQuestSkillsResult.value : [];

    // Get component skills for compound drills
    let componentSkills: readonly Skill[] | undefined;
    if (skill.isCompound && skill.componentSkillIds?.length) {
      const components = await Promise.all(
        skill.componentSkillIds.map(id => this.stores.skills.get(id))
      );
      componentSkills = components
        .filter(r => r.ok && r.value)
        .map(r => r.value!);
    }

    // Generate drill with proper context
    const drillResult = await this.drillGenerator.generate({
      skill,
      dayPlan,
      weekPlan,
      goal,
      quest,
      previousDrill,
      previousQuestSkills,
      componentSkills,
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
  ): AsyncAppResult<DailyDrill & { readonly analysis: DrillCompletionAnalysis }> {
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

    // Get skill for mastery update
    const skillResult = await this.stores.skills.get(drill.skillId);
    const skill = skillResult.ok ? skillResult.value : null;

    // Calculate new mastery state
    let newMastery: SkillMastery = skill?.mastery ?? 'not_started';
    let newPassCount = skill?.passCount ?? 0;
    let newFailCount = skill?.failCount ?? 0;
    let newConsecutivePasses = skill?.consecutivePasses ?? 0;

    if (outcome === 'pass') {
      newPassCount++;
      newConsecutivePasses++;
      if (newConsecutivePasses >= 3) {
        newMastery = 'mastered';
      } else if (newPassCount >= 1) {
        newMastery = 'practicing';
      }
    } else {
      // 'fail' outcome
      newFailCount++;
      newConsecutivePasses = 0;
      newMastery = 'attempting';
    }

    // Update skill mastery
    if (outcome === 'pass') {
      await this.updateSkillMastery(drill.skillId, 'practicing');
    } else {
      await this.updateSkillMastery(drill.skillId, 'attempting');
    }

    // Update week progress
    const progressUpdate: WeekProgressUpdate = {
      drillsCompleted: 1,
      drillsPassed: outcome === 'pass' ? 1 : 0,
      drillsFailed: outcome === 'fail' ? 1 : 0,
      drillsSkipped: 0, // This method only handles pass/fail
      skillsMastered: newMastery === 'mastered' ? 1 : 0,
    };
    await this.weekTracker.updateProgress(drill.weekPlanId, progressUpdate);

    // Create analysis
    const analysis: DrillCompletionAnalysis = {
      newMastery,
      newStatus: newMastery === 'mastered' ? 'mastered' : 'available',
      shouldRetry: outcome === 'fail',
      carryForward,
      newPassCount,
      newFailCount,
      newConsecutivePasses,
      unlockedSkillIds: [], // TODO: Calculate unlocked skills
      milestoneUnlocked: false, // TODO: Check milestone
    };

    return ok({ ...updatedDrill, analysis });
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
   * Get skills for a goal.
   */
  async getSkillsByGoal(goalId: GoalId): AsyncAppResult<readonly Skill[]> {
    const result = await this.stores.skills.getByGoal(goalId);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.items);
  }

  /**
   * Get available skills (unlocked, not mastered).
   */
  async getAvailableSkills(goalId: GoalId): AsyncAppResult<readonly Skill[]> {
    const result = await this.stores.skills.getByGoal(goalId);
    if (!result.ok) {
      return err(result.error);
    }
    const available = result.value.items.filter(
      (s: Skill) => s.status === 'available' && s.mastery !== 'mastered'
    );
    return ok(available);
  }

  /**
   * Get locked skills with their missing prerequisites.
   */
  async getLockedSkills(goalId: GoalId): AsyncAppResult<ReadonlyMap<SkillId, readonly Skill[]>> {
    const result = await this.stores.skills.getByGoal(goalId);
    if (!result.ok) {
      return err(result.error);
    }
    
    const allSkills = result.value.items;
    const lockedSkills = allSkills.filter((s: Skill) => s.status === 'locked');
    
    const lockedMap = new Map<SkillId, readonly Skill[]>();
    for (const skill of lockedSkills) {
      // Find unmet prerequisites
      const prereqIds = skill.prerequisiteSkillIds ?? [];
      const unmetPrereqs = allSkills.filter(
        (s: Skill) => prereqIds.includes(s.id) && s.mastery !== 'mastered'
      );
      lockedMap.set(skill.id, unmetPrereqs);
    }
    
    return ok(lockedMap);
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
        mastery = 'attempting';
      }
    } else if (mastery === 'fail' as unknown as SkillMastery) {
      failCount++;
      consecutivePasses = 0;
      mastery = passCount > 0 ? 'practicing' : 'attempting';
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

  /**
   * Get weekly summary.
   */
  async getWeeklySummary(weekPlanId: WeekPlanId): AsyncAppResult<WeeklySummary> {
    return this.weekTracker.getWeeklySummary(weekPlanId);
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

    // Calculate skill mastery counts by type
    const skillsMastered = skills.filter((s: Skill) => s.mastery === 'mastered').length;
    const skillsPracticing = skills.filter((s: Skill) => s.mastery === 'practicing' || s.mastery === 'attempting').length;
    const skillsNotStarted = skills.filter((s: Skill) => s.mastery === 'not_started').length;
    const skillsLocked = skills.filter((s: Skill) => s.status === 'locked').length;

    // Skill type breakdown
    const foundationSkillsMastered = skills.filter((s: Skill) => s.skillType === 'foundation' && s.mastery === 'mastered').length;
    const buildingSkillsMastered = skills.filter((s: Skill) => s.skillType === 'building' && s.mastery === 'mastered').length;
    const compoundSkillsMastered = skills.filter((s: Skill) => s.skillType === 'compound' && s.mastery === 'mastered').length;
    const synthesisSkillsMastered = skills.filter((s: Skill) => s.skillType === 'synthesis' && s.mastery === 'mastered').length;

    // Cross-quest stats
    const crossQuestSkillsCompleted = skills.filter((s: Skill) => s.isCompound && s.mastery === 'mastered').length;
    const questConnectionsFormed = 0; // TODO: Calculate from skill dependencies

    // Calculate week progress
    const weeksCompleted = weeks.filter(w => w.status === 'completed').length;
    const currentWeekPlan = weeks.find(w => w.status === 'active');
    const currentWeekNumber = currentWeekPlan?.weekNumber ?? 1;

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
    const totalDays = learningPlan?.totalPracticeDays ?? (totalWeeks * PRACTICE_DAYS_PER_WEEK);
    const expectedDays = currentWeekNumber * PRACTICE_DAYS_PER_WEEK;
    const daysBehind = Math.max(0, expectedDays - totalDrillsCompleted);
    const onTrack = daysBehind <= 2;
    const percentComplete = totalDays > 0 ? Math.round((totalDrillsCompleted / totalDays) * 100) : 0;

    // Quest progress
    const questsTotal = learningPlan?.questSkillMapping?.length ?? 1;
    const questsCompleted = 0; // TODO: Track completed quests

    // Current quest info
    const currentQuestId = currentWeekPlan?.questId;
    const currentQuestTitle = learningPlan?.questSkillMapping?.find(q => q.questId === currentQuestId)?.questTitle ?? 'Current Quest';
    const currentQuestDuration = learningPlan?.questDurations?.[0]?.displayLabel ?? 'Week 1';
    const currentQuestWeek = currentWeekPlan?.weekInQuest ?? 1;
    const currentQuestTotalWeeks = 1; // TODO: Calculate from duration

    // Build current quest progress
    const currentQuest: QuestProgress = {
      questId: currentQuestId ?? ('' as QuestId),
      title: currentQuestTitle,
      durationLabel: currentQuestDuration,
      currentWeek: currentQuestWeek,
      totalWeeks: currentQuestTotalWeeks,
      currentDay: currentWeekPlan?.drillsCompleted ?? 0,
      totalDays: currentQuestTotalWeeks * 5, // 5 days per week
      skillsTotal: skills.filter((s: Skill) => s.questId === currentQuestId).length,
      skillsMastered: skills.filter((s: Skill) => s.questId === currentQuestId && s.mastery === 'mastered').length,
      percentComplete: 0, // TODO: Calculate
      milestoneStatus: 'locked',
      milestoneTitle: '',
    };

    // Last practice date
    const lastPracticedSkill = skills
      .filter((s: Skill) => s.lastPracticedAt)
      .sort((a: Skill, b: Skill) => (b.lastPracticedAt ?? '').localeCompare(a.lastPracticedAt ?? ''))[0];

    return ok({
      goalId,
      totalDays,
      daysCompleted: totalDrillsCompleted,
      percentComplete,
      questsTotal,
      questsCompleted,
      currentQuest,
      skillsTotal: skills.length,
      skillsMastered,
      skillsPracticing,
      skillsLocked,
      skillsNotStarted,
      foundationSkillsMastered,
      buildingSkillsMastered,
      compoundSkillsMastered,
      synthesisSkillsMastered,
      crossQuestSkillsCompleted,
      questConnectionsFormed,
      currentStreak,
      longestStreak,
      overallPassRate,
      onTrack,
      daysBehind,
      estimatedCompletionDate: learningPlan?.estimatedCompletionDate ?? '',
      lastPracticeDate: lastPracticedSkill?.lastPracticedAt?.split('T')[0] ?? null,
    });
  }

  /**
   * Get quest progress.
   */
  async getQuestProgress(questId: QuestId): AsyncAppResult<QuestProgress> {
    // Get skills for this quest
    const skillsResult = await this.stores.skills.getByQuest(questId);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }
    const skills = skillsResult.value.items;

    // Get learning plan for quest info
    const goalId = skills[0]?.goalId;
    let questTitle = 'Quest';
    let durationLabel = 'Week 1';
    let totalWeeks = 1;
    let totalDays = skills.length;
    let milestoneTitle = 'Complete Quest';

    if (goalId) {
      const planResult = await this.stores.learningPlans.get(goalId);
      if (planResult.ok && planResult.value) {
        const mapping = planResult.value.questSkillMapping.find(m => m.questId === questId);
        if (mapping) {
          questTitle = mapping.questTitle;
          totalDays = mapping.estimatedDays;
          milestoneTitle = mapping.milestone?.title ?? 'Complete Quest';
        }
        const weekMapping = planResult.value.questWeekMapping.find(m => m.questId === questId);
        if (weekMapping) {
          durationLabel = weekMapping.duration.displayLabel;
          totalWeeks = weekMapping.weekNumbers.length;
        }
      }
    }

    const skillsMastered = skills.filter((s: Skill) => s.mastery === 'mastered').length;
    const skillsTotal = skills.length;
    const percentComplete = skillsTotal > 0 ? Math.round((skillsMastered / skillsTotal) * 100) : 0;

    // Determine milestone status
    let milestoneStatus: MilestoneStatus = 'locked';
    if (percentComplete >= 80) {
      milestoneStatus = 'available';
    }
    if (percentComplete === 100) {
      milestoneStatus = 'completed';
    }

    return ok({
      questId,
      title: questTitle,
      durationLabel,
      currentWeek: 1,
      totalWeeks,
      currentDay: skillsMastered + 1,
      totalDays,
      skillsTotal,
      skillsMastered,
      percentComplete,
      milestoneStatus,
      milestoneTitle,
    });
  }

  /**
   * Get learning plan for a goal.
   */
  async getLearningPlan(goalId: GoalId): AsyncAppResult<LearningPlan | null> {
    return this.stores.learningPlans.get(goalId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MILESTONE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get milestone for a quest.
   */
  async getMilestone(questId: QuestId): AsyncAppResult<QuestMilestone | null> {
    // Get skills to find the goal
    const skillsResult = await this.stores.skills.getByQuest(questId);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }
    const skills = skillsResult.value.items;
    const goalId = skills[0]?.goalId;

    if (!goalId) {
      return ok(null);
    }

    // Get learning plan for milestone info
    const planResult = await this.stores.learningPlans.get(goalId);
    if (!planResult.ok || !planResult.value) {
      return ok(null);
    }

    const mapping = planResult.value.questSkillMapping.find(m => m.questId === questId);
    if (!mapping?.milestone) {
      return ok(null);
    }

    return ok(mapping.milestone);
  }

  /**
   * Start a milestone.
   */
  async startMilestone(questId: QuestId): AsyncAppResult<QuestMilestone> {
    const milestoneResult = await this.getMilestone(questId);
    if (!milestoneResult.ok) {
      return err(milestoneResult.error);
    }
    if (!milestoneResult.value) {
      return err(appError('NOT_FOUND', `No milestone found for quest ${questId}`));
    }

    const milestone = milestoneResult.value;
    if (milestone.status !== 'available') {
      return err(appError('INVALID_STATE', `Milestone is not available (status: ${milestone.status})`));
    }

    // Update milestone status to in_progress
    const updatedMilestone: QuestMilestone = {
      ...milestone,
      status: 'in_progress',
      unlockedAt: createTimestamp(),
    };

    // Note: We'd need to persist this update to the learning plan
    // For now, return the updated milestone
    return ok(updatedMilestone);
  }

  /**
   * Complete a milestone.
   */
  async completeMilestone(
    questId: QuestId,
    selfAssessment: readonly { criterion: string; met: boolean }[]
  ): AsyncAppResult<QuestMilestone> {
    const milestoneResult = await this.getMilestone(questId);
    if (!milestoneResult.ok) {
      return err(milestoneResult.error);
    }
    if (!milestoneResult.value) {
      return err(appError('NOT_FOUND', `No milestone found for quest ${questId}`));
    }

    const milestone = milestoneResult.value;
    if (milestone.status !== 'in_progress' && milestone.status !== 'available') {
      return err(appError('INVALID_STATE', `Milestone cannot be completed (status: ${milestone.status})`));
    }

    // Verify all criteria are met
    const allMet = selfAssessment.every(a => a.met);
    if (!allMet) {
      return err(appError('INVALID_INPUT', 'Not all acceptance criteria are met'));
    }

    // Update milestone status to completed
    const completedMilestone: QuestMilestone = {
      ...milestone,
      status: 'completed',
      completedAt: createTimestamp(),
    };

    // Note: We'd need to persist this update to the learning plan
    return ok(completedMilestone);
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
   * Get skills from previous quests for warmup selection.
   */
  private async getPreviousQuestSkills(
    goalId: GoalId,
    currentQuestId: QuestId
  ): AsyncAppResult<readonly Skill[]> {
    // Get all skills for the goal
    const skillsResult = await this.stores.skills.getByGoal(goalId);
    if (!skillsResult.ok) {
      return ok([]);
    }

    // Filter to mastered skills from previous quests
    const previousQuestSkills = skillsResult.value.items.filter(
      (s: Skill) => s.questId !== currentQuestId && s.mastery === 'mastered'
    );

    return ok(previousQuestSkills);
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
    const recentlyPracticed = skills.filter((s: Skill) => {
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

    // Get first week's skills
    const weekSkillIds = firstMapping.skillIds.slice(0, PRACTICE_DAYS_PER_WEEK);

    // Get skill details for day plans
    const skillResults = await Promise.all(
      weekSkillIds.map(id => this.stores.skills.get(id))
    );
    const weekSkills = skillResults
      .filter(r => r.ok && r.value)
      .map(r => r.value!);

    // Create day plans
    const days: DayPlan[] = weekSkills.map((skill, index) => ({
      dayNumber: index + 1,
      dayInQuest: index + 1,
      scheduledDate: this.addDays(startDate, index),
      skillId: skill.id,
      skillType: skill.skillType,
      skillTitle: skill.title,
      reviewSkillId: undefined,
      reviewQuestId: undefined,
      status: 'pending' as const,
    }));

    const weekPlan: WeekPlan = {
      id: createWeekPlanId(),
      goalId: goal.id,
      userId: goal.userId,
      questId: firstQuest.id,
      weekNumber: 1,
      weekInQuest: 1,
      isFirstWeekOfQuest: true,
      isLastWeekOfQuest: firstMapping.estimatedDays <= PRACTICE_DAYS_PER_WEEK,
      startDate,
      endDate,
      status: 'active',
      weeklyCompetence: firstQuest.description ?? 'Complete first week of practice',
      theme: firstQuest.title,
      days,
      scheduledSkillIds: weekSkillIds,
      carryForwardSkillIds: [],
      completedSkillIds: [],
      foundationCount: firstMapping.foundationCount,
      buildingCount: firstMapping.buildingCount,
      compoundCount: firstMapping.compoundCount,
      hasSynthesis: firstMapping.hasSynthesis,
      reviewsFromQuestIds: [],
      buildsOnSkillIds: [],
      drillsCompleted: 0,
      drillsTotal: weekSkillIds.length,
      drillsPassed: 0,
      drillsFailed: 0,
      drillsSkipped: 0,
      skillsMastered: 0,
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
