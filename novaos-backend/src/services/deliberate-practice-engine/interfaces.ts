// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE INTERFACES — Phase 19: Enhanced Contracts
// NovaOS — Phase 19A: Interface Definitions
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module defines the enhanced interface contracts for the Deliberate Practice system:
//
// KEY ENHANCEMENTS:
//   - ISkillTreeGenerator: Generate skills with tree structure and cross-quest deps
//   - IWeekPlanGenerator: Generate week plans for any quest duration
//   - IDailyDrillEngine: Generate structured drills (warmup/main/stretch)
//   - IUnlockService: Handle skill and milestone unlocking
//   - IMasteryService: Track mastery progression with unlock triggers
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import type {
  GoalId,
  QuestId,
  SkillId,
  DrillId,
  WeekPlanId,
  SparkId,
  UserId,
} from '../../types/branded.js';
import type { Goal, Quest, Spark } from '../spark-engine/types.js';
import type { CapabilityStage } from '../../gates/sword/capability-generator.js';
import type {
  Skill,
  DailyDrill,
  WeekPlan,
  LearningPlan,
  DrillOutcome,
  SkillMastery,
  SkillStatus,
  SkillType,
  DrillCompletionAnalysis,
  CreateSkillParams,
  CreateDrillParams,
  CreateWeekPlanParams,
  QuestDuration,
  DayPlan,
  DrillSection,
  QuestMilestone,
  GoalProgress,
  QuestProgress,
  SkillDistribution,
} from './types.js';

// Phase 21: Science-Based Learning Types
import type { GeneratedLessonPlan } from './phase21/index.js';

// Import store types for local use
import type {
  SaveOptions,
  GetOptions,
  ListOptions,
  SaveResult,
  DeleteResult,
  ListResult,
} from '../spark-engine/store/types.js';

// Re-export store types for consumers
export type {
  SaveOptions,
  GetOptions,
  ListOptions,
  SaveResult,
  DeleteResult,
  ListResult,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TREE GENERATOR INTERFACE (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for skill tree generation.
 */
export interface SkillTreeGenerationContext {
  /** The quest being decomposed */
  readonly quest: Quest;

  /** Parent goal */
  readonly goal: Goal;

  /** Capability stages from the quest */
  readonly stages: readonly CapabilityStage[];

  /** Quest duration */
  readonly duration: QuestDuration;

  /** Daily time budget in minutes */
  readonly dailyMinutes: number;

  /** User's skill level */
  readonly userLevel: 'beginner' | 'intermediate' | 'advanced';

  /** ALL skills from previous quests (for cross-quest dependencies) */
  readonly previousQuestSkills: readonly Skill[];

  /** Previous quests (for context) */
  readonly previousQuests: readonly Quest[];

  /** Target skill distribution */
  readonly distribution?: SkillDistribution;
}

/**
 * Result of skill tree generation.
 */
export interface SkillTreeGenerationResult {
  /** Generated skills with tree structure */
  readonly skills: readonly Skill[];

  /** Root skill IDs (no prerequisites within this quest) */
  readonly rootSkillIds: readonly SkillId[];

  /** Synthesis skill ID (the milestone skill) */
  readonly synthesisSkillId: SkillId;

  /** Skill IDs that reference previous quest skills */
  readonly crossQuestSkillIds: readonly SkillId[];

  /** Total estimated days for all skills */
  readonly totalDays: number;

  /** Warnings or gaps identified */
  readonly warnings: readonly string[];

  /** Quest milestone */
  readonly milestone: QuestMilestone;

  /** Skill distribution achieved */
  readonly distribution: {
    readonly foundation: number;
    readonly building: number;
    readonly compound: number;
    readonly synthesis: number;
  };
}

/**
 * Generates skill trees from Quest capability stages.
 *
 * KEY DIFFERENCES from Phase 18 SkillDecomposer:
 *   - Generates TREE structure, not flat list
 *   - Handles CROSS-QUEST dependencies
 *   - Creates COMPOUND and SYNTHESIS skills
 *   - Respects quest duration (multi-week)
 */
export interface ISkillTreeGenerator {
  /**
   * Generate a skill tree for a quest.
   *
   * @param context - Generation context with quest, previous skills, duration
   * @returns Generated skills with tree structure
   */
  generate(context: SkillTreeGenerationContext): AsyncAppResult<SkillTreeGenerationResult>;

  /**
   * Find relevant skills from previous quests for dependencies.
   *
   * @param topics - Topics the current quest covers
   * @param previousSkills - All skills from previous quests
   * @returns Skills that are relevant prerequisites
   */
  findRelevantPriorSkills(
    topics: readonly string[],
    previousSkills: readonly Skill[]
  ): readonly Skill[];

  /**
   * Create compound skill that combines multiple skills.
   *
   * @param componentSkills - Skills to combine (can span quests)
   * @param context - Generation context
   * @returns Compound skill
   */
  createCompoundSkill(
    componentSkills: readonly Skill[],
    context: SkillTreeGenerationContext
  ): AsyncAppResult<Skill>;

  /**
   * Create synthesis skill (milestone skill) for end of quest.
   *
   * @param allQuestSkills - All skills in this quest
   * @param context - Generation context
   * @returns Synthesis skill
   */
  createSynthesisSkill(
    allQuestSkills: readonly Skill[],
    context: SkillTreeGenerationContext
  ): AsyncAppResult<Skill>;

  /**
   * Validate a skill meets all requirements.
   *
   * @returns Error message if invalid, undefined if valid
   */
  validateSkill(skill: Skill, dailyMinutes: number): string | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK PLAN GENERATOR INTERFACE (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for week plan generation.
 */
export interface WeekPlanGenerationContext {
  /** Goal being planned */
  readonly goal: Goal;

  /** Quest this week belongs to */
  readonly quest: Quest;

  /** Quest duration */
  readonly duration: QuestDuration;

  /** Week number within the goal (1-based) */
  readonly weekNumber: number;

  /** Week number within the quest (1-based) */
  readonly weekInQuest: number;

  /** Skills scheduled for this week */
  readonly weekSkills: readonly Skill[];

  /** All skills from previous quests */
  readonly previousQuestSkills: readonly Skill[];

  /** Skills carried forward from previous week */
  readonly carryForwardSkills: readonly Skill[];

  /** Start date for the week */
  readonly startDate: string;
}

/**
 * Result of week plan generation.
 */
export interface WeekPlanGenerationResult {
  /** Generated week plan */
  readonly weekPlan: WeekPlan;

  /** Day plans within the week */
  readonly dayPlans: readonly DayPlan[];

  /** Skills that need review from previous quests */
  readonly reviewSkills: readonly Skill[];

  /** Warnings about scheduling */
  readonly warnings: readonly string[];
}

/**
 * Generates week plans with day-by-day scheduling.
 *
 * KEY FEATURES:
 *   - Works for any quest duration (1 day to multi-week)
 *   - Schedules skills respecting dependencies
 *   - Identifies review skills from previous quests
 *   - Places compound skills after their prerequisites
 *   - Places synthesis at end of quest's last week
 */
export interface IWeekPlanGenerator {
  /**
   * Generate a week plan.
   *
   * @param context - Generation context
   * @returns Week plan with day schedules
   */
  generate(context: WeekPlanGenerationContext): AsyncAppResult<WeekPlanGenerationResult>;

  /**
   * Generate all week plans for a quest.
   *
   * @param quest - The quest
   * @param duration - Quest duration
   * @param skills - All skills for this quest
   * @param previousQuestSkills - Skills from previous quests
   * @param goal - Parent goal
   * @param startWeekNumber - Starting week number in the goal
   * @param startDate - Start date for first week
   * @returns All week plans for the quest
   */
  generateForQuest(
    quest: Quest,
    duration: QuestDuration,
    skills: readonly Skill[],
    previousQuestSkills: readonly Skill[],
    goal: Goal,
    startWeekNumber: number,
    startDate: string
  ): AsyncAppResult<readonly WeekPlan[]>;

  /**
   * Identify skills from previous quests to review in warmups.
   *
   * @param weekSkills - Skills scheduled for this week
   * @param previousQuestSkills - All previous quest skills
   * @returns Skills to review
   */
  identifyReviewSkills(
    weekSkills: readonly Skill[],
    previousQuestSkills: readonly Skill[]
  ): readonly Skill[];

  /**
   * Assign skills to days respecting dependencies.
   *
   * @param skills - Skills to assign
   * @param daysAvailable - Number of practice days
   * @returns Skills assigned to each day
   */
  assignSkillsToDays(
    skills: readonly Skill[],
    daysAvailable: number
  ): readonly (Skill | null)[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY DRILL ENGINE INTERFACE (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for daily drill generation.
 */
export interface DailyDrillGenerationContext {
  /** Skill to practice */
  readonly skill: Skill;

  /** Day plan this drill is for */
  readonly dayPlan: DayPlan;

  /** Week plan context */
  readonly weekPlan: WeekPlan;

  /** Goal context */
  readonly goal: Goal;

  /** Quest context */
  readonly quest: Quest;

  /** Previous drill (if any, for roll-forward) */
  readonly previousDrill?: DailyDrill;

  /** Skills from previous quests (for warmup selection) */
  readonly previousQuestSkills: readonly Skill[];

  /** Component skills (for compound/synthesis drills) */
  readonly componentSkills?: readonly Skill[];

  /** Daily time budget in minutes */
  readonly dailyMinutes: number;
}

/**
 * Result of daily drill generation.
 */
export interface DailyDrillGenerationResult {
  /** Generated drill */
  readonly drill: DailyDrill;

  /** Warmup section (if any) */
  readonly warmup: DrillSection | null;

  /** Main practice section */
  readonly main: DrillSection;

  /** Stretch challenge section (if any) */
  readonly stretch: DrillSection | null;

  /** Context explaining drill selection */
  readonly context: string;
}

/**
 * Generates structured daily drills with warmup/main/stretch sections.
 *
 * KEY FEATURES:
 *   - Structured drill format (warmup → main → stretch)
 *   - Cross-quest review in warmups
 *   - Compound skill drills combine multiple skills
 *   - Roll-forward logic from previous drills
 *   - Adaptation for retries
 */
export interface IDailyDrillEngine {
  /**
   * Generate a drill for the given context.
   *
   * @param context - Generation context
   * @returns Structured drill
   */
  generate(context: DailyDrillGenerationContext): AsyncAppResult<DailyDrillGenerationResult>;

  /**
   * Generate warmup section.
   *
   * @param skill - Today's skill
   * @param dayPlan - Day plan with review info
   * @param previousQuestSkills - Skills from previous quests
   * @returns Warmup section or null
   */
  generateWarmup(
    skill: Skill,
    dayPlan: DayPlan,
    previousQuestSkills: readonly Skill[]
  ): AsyncAppResult<DrillSection | null>;

  /**
   * Generate main practice section.
   *
   * @param skill - Skill to practice
   * @param componentSkills - Component skills for compound drills
   * @param dailyMinutes - Time budget
   * @returns Main section
   */
  generateMain(
    skill: Skill,
    componentSkills: readonly Skill[] | undefined,
    dailyMinutes: number
  ): AsyncAppResult<DrillSection>;

  /**
   * Generate stretch challenge section.
   *
   * @param skill - Today's skill
   * @returns Stretch section or null
   */
  generateStretch(skill: Skill): AsyncAppResult<DrillSection | null>;

  /**
   * Adapt a drill for retry after failure.
   *
   * @param skill - Skill to retry
   * @param previousDrill - Failed drill
   * @param retryCount - How many retries so far
   * @returns Adapted sections
   */
  adaptForRetry(
    skill: Skill,
    previousDrill: DailyDrill,
    retryCount: number
  ): AsyncAppResult<{
    main: DrillSection;
    warmup?: DrillSection;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNLOCK SERVICE INTERFACE (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of checking skill prerequisites.
 */
export interface PrerequisiteCheckResult {
  /** Whether all prerequisites are met */
  readonly allMet: boolean;

  /** Prerequisites that are met */
  readonly metPrerequisites: readonly SkillId[];

  /** Prerequisites still needed */
  readonly missingPrerequisites: readonly SkillId[];

  /** Which quests the missing prerequisites come from */
  readonly missingFromQuests: readonly QuestId[];
}

/**
 * Result of unlocking skills.
 */
export interface UnlockResult {
  /** Skills that were unlocked */
  readonly unlockedSkillIds: readonly SkillId[];

  /** Skills still locked */
  readonly stillLockedSkillIds: readonly SkillId[];

  /** Whether milestone was unlocked */
  readonly milestoneUnlocked: boolean;
}

/**
 * Handles skill and milestone unlocking based on prerequisites.
 */
export interface IUnlockService {
  /**
   * Check if a skill's prerequisites are met.
   *
   * @param skillId - Skill to check
   * @returns Prerequisite check result
   */
  checkPrerequisites(skillId: SkillId): AsyncAppResult<PrerequisiteCheckResult>;

  /**
   * Unlock skills whose prerequisites are now met.
   *
   * Called after skill mastery updates.
   *
   * @param masteredSkillId - Skill that was just mastered
   * @returns Skills that were unlocked
   */
  unlockEligibleSkills(masteredSkillId: SkillId): AsyncAppResult<UnlockResult>;

  /**
   * Check if milestone can be unlocked.
   *
   * @param questId - Quest to check
   * @param requiredMasteryPercent - Required mastery percentage
   * @returns Whether milestone is available
   */
  checkMilestoneAvailability(
    questId: QuestId,
    requiredMasteryPercent: number
  ): AsyncAppResult<boolean>;

  /**
   * Get all locked skills and their missing prerequisites.
   *
   * @param goalId - Goal to check
   * @returns Map of skill ID to missing prerequisites
   */
  getLockedSkillsWithReasons(
    goalId: GoalId
  ): AsyncAppResult<ReadonlyMap<SkillId, readonly SkillId[]>>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTERY SERVICE INTERFACE (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of recording a drill outcome.
 */
export interface MasteryUpdateResult {
  /** Updated skill */
  readonly skill: Skill;

  /** Previous mastery level */
  readonly previousMastery: SkillMastery;

  /** New mastery level */
  readonly newMastery: SkillMastery;

  /** Previous status */
  readonly previousStatus: SkillStatus;

  /** New status */
  readonly newStatus: SkillStatus;

  /** Whether skill was just mastered */
  readonly justMastered: boolean;

  /** Skills unlocked by this mastery change */
  readonly unlockedSkills: readonly Skill[];

  /** Whether milestone is now available */
  readonly milestoneUnlocked: boolean;
}

/**
 * Tracks skill mastery and triggers unlocks.
 */
export interface IMasteryService {
  /**
   * Update skill mastery after drill completion.
   *
   * @param skillId - Skill that was practiced
   * @param outcome - Drill outcome
   * @returns Mastery update result with unlock info
   */
  recordOutcome(
    skillId: SkillId,
    outcome: DrillOutcome
  ): AsyncAppResult<MasteryUpdateResult>;

  /**
   * Get current mastery summary for a goal.
   *
   * @param goalId - Goal to summarize
   * @returns Mastery counts by level
   */
  getMasterySummary(goalId: GoalId): AsyncAppResult<{
    readonly notStarted: number;
    readonly attempting: number;
    readonly practicing: number;
    readonly mastered: number;
    readonly total: number;
  }>;

  /**
   * Calculate mastery percentage for a quest.
   *
   * @param questId - Quest to check
   * @returns Mastery percentage (0-1)
   */
  getQuestMasteryPercent(questId: QuestId): AsyncAppResult<number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS SERVICE INTERFACE (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Weekly summary for display.
 */
export interface WeeklySummary {
  /** Week number */
  readonly weekNumber: number;

  /** Week theme */
  readonly theme: string;

  /** Quest title */
  readonly questTitle: string;

  /** Skills mastered this week */
  readonly skillsMastered: readonly string[];

  /** Skills in progress */
  readonly skillsInProgress: readonly string[];

  /** Cross-quest skills completed */
  readonly crossQuestSkills: readonly {
    readonly skillTitle: string;
    readonly combinedFromQuests: readonly string[];
  }[];

  /** Days practiced */
  readonly daysPracticed: number;

  /** Days total */
  readonly daysTotal: number;

  /** Pass rate (0-1) */
  readonly passRate: number;

  /** Current streak */
  readonly currentStreak: number;

  /** Whether milestone is available */
  readonly milestoneAvailable: boolean;

  /** Milestone title */
  readonly milestoneTitle: string;

  /** Next week preview (if any) */
  readonly nextWeekPreview?: string;
}

/**
 * Provides progress tracking and summaries.
 */
export interface IProgressService {
  /**
   * Get overall goal progress.
   *
   * @param goalId - Goal to check
   * @returns Full progress summary
   */
  getGoalProgress(goalId: GoalId): AsyncAppResult<GoalProgress>;

  /**
   * Get current quest progress.
   *
   * @param questId - Quest to check
   * @returns Quest progress
   */
  getQuestProgress(questId: QuestId): AsyncAppResult<QuestProgress>;

  /**
   * Get weekly summary.
   *
   * @param weekPlanId - Week to summarize
   * @returns Weekly summary
   */
  getWeeklySummary(weekPlanId: WeekPlanId): AsyncAppResult<WeeklySummary>;

  /**
   * Calculate current streak.
   *
   * @param userId - User to check
   * @param goalId - Goal to check
   * @returns Current streak in days
   */
  calculateStreak(userId: UserId, goalId: GoalId): AsyncAppResult<number>;

  /**
   * Check if user is on track.
   *
   * @param goalId - Goal to check
   * @returns Whether on track and days behind
   */
  checkScheduleStatus(goalId: GoalId): AsyncAppResult<{
    readonly onTrack: boolean;
    readonly daysBehind: number;
    readonly estimatedCompletionDate: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE INTERFACE (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Today's practice result.
 * ENHANCED with cross-quest context.
 */
export interface TodayPracticeResult {
  /** Whether there's practice scheduled */
  readonly hasContent: boolean;

  /** Today's drill (if any) */
  readonly drill: DailyDrill | null;

  /** Active spark for the drill */
  readonly spark: Spark | null;

  /** Current week plan */
  readonly weekPlan: WeekPlan | null;

  /** The skill being practiced */
  readonly skill: Skill | null;

  /** Today's date (YYYY-MM-DD) */
  readonly date: string;

  /** User's timezone */
  readonly timezone: string;

  /** Roll-forward context (why this drill) */
  readonly context: string | null;

  /** Goal ID */
  readonly goalId: GoalId | null;

  /** Quest ID */
  readonly questId: QuestId | null;

  // NEW in Phase 19
  /** Skill type */
  readonly skillType: SkillType | null;

  /** Component skills (for compound drills) */
  readonly componentSkills: readonly Skill[] | null;

  /** Review skill from warmup (if any) */
  readonly reviewSkill: Skill | null;

  /** Review skill's quest title */
  readonly reviewQuestTitle: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-GOAL PRACTICE TYPES (Phase 19B)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Practice entry for a single goal within a bundle.
 * Contains all info needed to practice one goal.
 */
export interface GoalPracticeEntry {
  /** Goal identifier */
  readonly goalId: GoalId;

  /** Goal title (denormalized for display) */
  readonly goalTitle: string;

  /** Goal priority (lower = higher priority) */
  readonly priority: number;

  /** Today's practice result for this goal */
  readonly practice: TodayPracticeResult;

  /** Whether this goal is the primary focus today */
  readonly isPrimary: boolean;

  /** Reason for priority position */
  readonly priorityReason: string;
}

/**
 * Bundle of practices across multiple active goals.
 * Returned by getTodayPracticeBundle().
 *
 * Phase 19B: Multi-goal support.
 */
export interface TodayPracticeBundle {
  /** Today's date (YYYY-MM-DD) */
  readonly date: string;

  /** User's timezone */
  readonly timezone: string;

  /** Total active goals */
  readonly totalActiveGoals: number;

  /** Goals with practice available, sorted by priority */
  readonly entries: readonly GoalPracticeEntry[];

  /** Primary goal (first entry with hasContent) */
  readonly primaryGoal: GoalPracticeEntry | null;

  /** Goals that are paused */
  readonly pausedGoalCount: number;

  /** Goals completed for today (already practiced) */
  readonly completedTodayCount: number;

  /** Whether any practice is available */
  readonly hasPractice: boolean;

  /** Summary message for display */
  readonly summary: string;
}

/**
 * Result of Phase 21 plan initialization.
 * Contains counts of created entities.
 */
export interface Phase21InitResult {
  /** Number of week plans created */
  readonly weekPlanCount: number;

  /** Number of skills created */
  readonly skillCount: number;

  /** Number of drills created */
  readonly drillCount: number;

  /** The created learning plan */
  readonly learningPlan: LearningPlan;

  /** Whether initialization was successful */
  readonly success: boolean;

  /** Any warnings during initialization */
  readonly warnings: readonly string[];
}

/**
 * Drill completion parameters from user.
 */
export interface DrillCompletionParams {
  /**
   * Did the pass signal get met?
   * Binary outcome — no middle ground.
   */
  readonly passSignalMet: boolean;

  /**
   * User's observation of what happened.
   * Free-form notes for roll-forward context.
   */
  readonly observation?: string;

  /**
   * Subjective difficulty rating (1-5).
   * Used for adaptive scheduling.
   */
  readonly difficulty?: 1 | 2 | 3 | 4 | 5;

  /**
   * Actual time spent in minutes.
   * Used for time estimation refinement.
   */
  readonly actualMinutes?: number;
}

/**
 * Week completion result.
 */
export interface WeekCompletionResult {
  /** The completed week plan */
  readonly completedWeek: WeekPlan;

  /** Skills that need carry-forward */
  readonly carryForwardSkills: readonly Skill[];

  /** Generated focus for next week */
  readonly nextWeekFocus: string;

  /** Weekly summary for user */
  readonly summary: WeeklySummary;

  /** Next week plan (if created) */
  readonly nextWeek?: WeekPlan;

  /** Whether milestone was completed */
  readonly milestoneCompleted: boolean;

  /** Whether next quest was unlocked */
  readonly nextQuestUnlocked: boolean;
}

/**
 * Main orchestrator for the Deliberate Practice system.
 *
 * ENHANCED in Phase 19:
 *   - Multi-week quest support
 *   - Skill tree generation
 *   - Cross-quest dependency tracking
 *   - Structured drill generation
 *   - Milestone management
 */
export interface IDeliberatePracticeEngine {
  // ─────────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Initialize a learning plan from goal and quests.
   *
   * ENHANCED: Handles multi-week quests, generates skill trees.
   *
   * @param goal - The learning goal
   * @param quests - The goal's quests (with durations)
   * @param stages - Capability stages by quest
   * @returns The created learning plan
   */
  initializePlan(
    goal: Goal,
    quests: readonly Quest[],
    stagesByQuest: ReadonlyMap<QuestId, readonly CapabilityStage[]>
  ): AsyncAppResult<LearningPlan>;

  /**
   * Initialize a learning plan from a Phase 21 pre-generated plan.
   *
   * Phase 21 generates complete drill content during the suggest mode.
   * This method persists that content directly, avoiding regeneration.
   *
   * @param goal - The learning goal
   * @param quests - The goal's quests
   * @param phase21Plan - The pre-generated Phase 21 plan
   * @returns Result with counts of created entities
   */
  initializeFromPhase21Plan(
    goal: Goal,
    quests: readonly Quest[],
    phase21Plan: GeneratedLessonPlan
  ): AsyncAppResult<Phase21InitResult>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Daily Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get today's practice for a user.
   *
   * ENHANCED: Returns structured drill with warmup/main/stretch.
   *
   * @param userId - User identifier
   * @param goalId - Goal identifier
   * @returns Today's practice content
   */
  getTodayPractice(userId: UserId, goalId: GoalId): AsyncAppResult<TodayPracticeResult>;

  /**
   * Get today's practice bundle across ALL active goals.
   *
   * Phase 19B: Multi-goal support.
   *
   * Returns practices for all active goals sorted by priority.
   * Paused goals and goals completed for today are tracked separately.
   *
   * @param userId - User identifier
   * @returns Bundle containing practices for all active goals
   */
  getTodayPracticeBundle(userId: UserId): AsyncAppResult<TodayPracticeBundle>;

  /**
   * Generate a drill for a specific date.
   *
   * @param userId - User identifier
   * @param goalId - Goal identifier
   * @param date - Date to generate for (YYYY-MM-DD)
   * @returns Generated drill
   */
  generateDrill(
    userId: UserId,
    goalId: GoalId,
    date: string
  ): AsyncAppResult<DailyDrill>;

  /**
   * Get drill by ID.
   */
  getDrill(drillId: DrillId): AsyncAppResult<DailyDrill | null>;

  /**
   * Get drill for a specific date.
   */
  getDrillByDate(
    userId: UserId,
    goalId: GoalId,
    date: string
  ): AsyncAppResult<DailyDrill | null>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Completion
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record drill outcome and update mastery.
   *
   * ENHANCED: Triggers unlock checks, updates cross-quest stats.
   *
   * @param drillId - Drill identifier
   * @param params - Completion parameters
   * @returns Updated drill with unlock info
   */
  recordOutcome(
    drillId: DrillId,
    params: DrillCompletionParams
  ): AsyncAppResult<DailyDrill & { readonly analysis: DrillCompletionAnalysis }>;

  /**
   * Skip a drill with reason.
   */
  skipDrill(drillId: DrillId, reason?: string): AsyncAppResult<DailyDrill>;

  /**
   * Mark a drill as missed.
   */
  markMissed(drillId: DrillId): AsyncAppResult<DailyDrill>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get skill by ID.
   */
  getSkill(skillId: SkillId): AsyncAppResult<Skill | null>;

  /**
   * Get skills for a quest.
   */
  getSkillsByQuest(questId: QuestId): AsyncAppResult<readonly Skill[]>;

  /**
   * Get skills for a goal.
   */
  getSkillsByGoal(goalId: GoalId): AsyncAppResult<readonly Skill[]>;

  /**
   * Get available skills (unlocked, not mastered).
   */
  getAvailableSkills(goalId: GoalId): AsyncAppResult<readonly Skill[]>;

  /**
   * Get locked skills with their missing prerequisites.
   */
  getLockedSkills(goalId: GoalId): AsyncAppResult<ReadonlyMap<SkillId, readonly Skill[]>>;

  /**
   * Update skill mastery manually.
   */
  updateSkillMastery(skillId: SkillId, mastery: SkillMastery): AsyncAppResult<Skill>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Week Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get current week plan for a goal.
   */
  getCurrentWeek(goalId: GoalId): AsyncAppResult<WeekPlan | null>;

  /**
   * Get all week plans for a goal.
   */
  getWeeks(goalId: GoalId): AsyncAppResult<readonly WeekPlan[]>;

  /**
   * Complete the current week and transition to next.
   */
  completeWeek(weekPlanId: WeekPlanId): AsyncAppResult<WeekCompletionResult>;

  /**
   * Get weekly summary.
   */
  getWeeklySummary(weekPlanId: WeekPlanId): AsyncAppResult<WeeklySummary>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Progress
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get overall progress for a goal.
   */
  getProgress(goalId: GoalId): AsyncAppResult<GoalProgress>;

  /**
   * Get quest progress.
   */
  getQuestProgress(questId: QuestId): AsyncAppResult<QuestProgress>;

  /**
   * Get learning plan for a goal.
   */
  getLearningPlan(goalId: GoalId): AsyncAppResult<LearningPlan | null>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone Management (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get milestone status for a quest.
   */
  getMilestone(questId: QuestId): AsyncAppResult<QuestMilestone | null>;

  /**
   * Start working on a milestone.
   */
  startMilestone(questId: QuestId): AsyncAppResult<QuestMilestone>;

  /**
   * Complete a milestone.
   */
  completeMilestone(
    questId: QuestId,
    selfAssessment: readonly { criterion: string; met: boolean }[]
  ): AsyncAppResult<QuestMilestone>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE INTERFACES (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Skill store interface.
 * ENHANCED with skill type and status queries.
 */
export interface ISkillStore {
  save(skill: Skill, options?: SaveOptions): AsyncAppResult<SaveResult<Skill>>;
  get(skillId: SkillId, options?: GetOptions): AsyncAppResult<Skill | null>;
  delete(skillId: SkillId): AsyncAppResult<DeleteResult>;
  getByQuest(questId: QuestId, options?: ListOptions): AsyncAppResult<ListResult<Skill>>;
  getByGoal(goalId: GoalId, options?: ListOptions): AsyncAppResult<ListResult<Skill>>;
  getByUser(userId: UserId, options?: ListOptions): AsyncAppResult<ListResult<Skill>>;
  
  // ENHANCED methods
  getByStatus(goalId: GoalId, status: SkillStatus): AsyncAppResult<readonly Skill[]>;
  getByType(questId: QuestId, skillType: SkillType): AsyncAppResult<readonly Skill[]>;
  getAvailable(goalId: GoalId): AsyncAppResult<readonly Skill[]>;
  getLocked(goalId: GoalId): AsyncAppResult<readonly Skill[]>;
  
  updateMastery(
    skillId: SkillId,
    mastery: SkillMastery,
    passCount: number,
    failCount: number,
    consecutivePasses: number
  ): AsyncAppResult<Skill>;
  
  updateStatus(skillId: SkillId, status: SkillStatus): AsyncAppResult<Skill>;
}

/**
 * Drill store interface.
 * ENHANCED with section queries.
 */
export interface IDrillStore {
  save(drill: DailyDrill, options?: SaveOptions): AsyncAppResult<SaveResult<DailyDrill>>;
  get(drillId: DrillId, options?: GetOptions): AsyncAppResult<DailyDrill | null>;
  delete(drillId: DrillId): AsyncAppResult<DeleteResult>;
  getByWeek(weekPlanId: WeekPlanId, options?: ListOptions): AsyncAppResult<ListResult<DailyDrill>>;
  getByDate(userId: UserId, goalId: GoalId, date: string): AsyncAppResult<DailyDrill | null>;
  getByDateRange(
    userId: UserId,
    goalId: GoalId,
    startDate: string,
    endDate: string
  ): AsyncAppResult<readonly DailyDrill[]>;
  getActiveForUser(userId: UserId): AsyncAppResult<DailyDrill | null>;
  
  // ENHANCED methods
  getBySkillType(
    goalId: GoalId,
    skillType: SkillType
  ): AsyncAppResult<readonly DailyDrill[]>;
  getCompoundDrills(goalId: GoalId): AsyncAppResult<readonly DailyDrill[]>;

  /**
   * Get all drills for a goal.
   * Phase 19A: Required for JIT day number calculation.
   */
  getByGoal(goalId: GoalId, options?: ListOptions): AsyncAppResult<ListResult<DailyDrill>>;
  
  updateOutcome(
    drillId: DrillId,
    outcome: DrillOutcome,
    observation?: string,
    carryForward?: string
  ): AsyncAppResult<DailyDrill>;
}

/**
 * Week plan store interface.
 * ENHANCED with quest-level queries.
 */
export interface IWeekPlanStore {
  save(weekPlan: WeekPlan, options?: SaveOptions): AsyncAppResult<SaveResult<WeekPlan>>;
  get(weekPlanId: WeekPlanId, options?: GetOptions): AsyncAppResult<WeekPlan | null>;
  delete(weekPlanId: WeekPlanId): AsyncAppResult<DeleteResult>;
  getByGoal(goalId: GoalId, options?: ListOptions): AsyncAppResult<ListResult<WeekPlan>>;
  getActiveByGoal(goalId: GoalId): AsyncAppResult<WeekPlan | null>;
  getByWeekNumber(goalId: GoalId, weekNumber: number): AsyncAppResult<WeekPlan | null>;
  
  // ENHANCED methods
  getByQuest(questId: QuestId): AsyncAppResult<readonly WeekPlan[]>;
  getLastWeekOfQuest(questId: QuestId): AsyncAppResult<WeekPlan | null>;
  
  updateStatus(weekPlanId: WeekPlanId, status: 'pending' | 'active' | 'completed'): AsyncAppResult<WeekPlan>;
  updateProgress(
    weekPlanId: WeekPlanId,
    drillsCompleted: number,
    drillsPassed: number,
    drillsFailed: number,
    drillsSkipped: number,
    skillsMastered: number
  ): AsyncAppResult<WeekPlan>;
}

/**
 * Learning plan store interface.
 */
export interface ILearningPlanStore {
  save(plan: LearningPlan): AsyncAppResult<LearningPlan>;
  get(goalId: GoalId): AsyncAppResult<LearningPlan | null>;
  delete(goalId: GoalId): AsyncAppResult<boolean>;
  update(goalId: GoalId, updates: Partial<LearningPlan>): AsyncAppResult<LearningPlan>;
}

/**
 * Goal store interface for Deliberate Practice Engine.
 * Phase 19B: Multi-goal support.
 */
export interface IGoalStore {
  /** Get a goal by ID */
  get(goalId: GoalId): AsyncAppResult<Goal | null>;

  /** Get all active goals for a user */
  getActiveGoals(userId: UserId): AsyncAppResult<readonly Goal[]>;

  /** Get active goals sorted by priority (Phase 19B) */
  getActiveGoalsByPriority(userId: UserId): AsyncAppResult<readonly Goal[]>;

  /** Get active non-paused goals sorted by priority (Phase 19B) */
  getActiveNonPausedGoals(userId: UserId, today: string): AsyncAppResult<readonly Goal[]>;

  /** Set goal priority (Phase 19B) */
  setGoalPriority(goalId: GoalId, priority: number): AsyncAppResult<Goal>;

  /** Pause goal until date (Phase 19B) */
  pauseGoal(goalId: GoalId, until?: string): AsyncAppResult<Goal>;

  /** Resume a paused goal (Phase 19B) */
  resumeGoal(goalId: GoalId): AsyncAppResult<Goal>;
}

/**
 * Combined interface for all Deliberate Practice Engine stores.
 */
export interface IDeliberatePracticeStores {
  readonly skills: ISkillStore;
  readonly drills: IDrillStore;
  readonly weekPlans: IWeekPlanStore;
  readonly learningPlans: ILearningPlanStore;
  /** Goal store - required for Phase 19B multi-goal support */
  readonly goals: IGoalStore;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY — Legacy Interface Names
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Alias for backward compatibility.
 * @deprecated Use DailyDrillGenerationContext instead
 */
export type DrillGenerationContext = DailyDrillGenerationContext;

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL DECOMPOSER INTERFACE (Legacy Support)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for skill decomposition.
 */
export interface SkillDecompositionContext {
  /** Quest being decomposed */
  readonly quest: Quest;
  
  /** Parent goal */
  readonly goal: Goal;
  
  /** Capability stages to decompose */
  readonly stages: readonly CapabilityStage[];
  
  /** Daily time budget in minutes */
  readonly dailyMinutes: number;
  
  /** User ID for ownership */
  readonly userId: UserId;
}

/**
 * Result of skill decomposition.
 */
export interface SkillDecompositionResult {
  /** Generated skills */
  readonly skills: readonly Skill[];
  
  /** Total estimated practice time in minutes */
  readonly totalMinutes: number;
  
  /** Estimated practice days */
  readonly estimatedDays: number;
  
  /** Warnings during decomposition */
  readonly warnings: readonly string[];
}

/**
 * Decomposes capability stages into actionable skills.
 */
export interface ISkillDecomposer {
  /**
   * Decompose stages into skills.
   */
  decompose(context: SkillDecompositionContext): AsyncAppResult<SkillDecompositionResult>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRILL GENERATOR INTERFACE (Legacy Support)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of roll-forward logic.
 */
export interface RollForwardResult {
  /** Skill to practice */
  readonly skill: Skill;
  
  /** Is this a retry of a failed skill? */
  readonly isRetry: boolean;
  
  /** Retry count (0 if not a retry) */
  readonly retryCount: number;
  
  /** Previous failure reason (if retry) */
  readonly previousFailureReason?: string;
  
  /** Carry-forward context from previous attempt */
  readonly carryForwardContext?: string;
}

/**
 * Generates daily drills with roll-forward logic.
 */
export interface IDrillGenerator {
  /**
   * Generate a drill for today.
   */
  generate(context: DailyDrillGenerationContext): AsyncAppResult<DailyDrill>;
  
  /**
   * Determine next skill using roll-forward logic.
   */
  rollForward(
    previousDrill: DailyDrill | null,
    availableSkills: readonly Skill[],
    weekPlan: WeekPlan
  ): AsyncAppResult<RollForwardResult>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK TRACKER INTERFACE (Legacy Support)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Progress update for a week.
 */
export interface WeekProgressUpdate {
  /** Drills completed */
  readonly drillsCompleted: number;
  
  /** Drills passed */
  readonly drillsPassed: number;
  
  /** Drills failed */
  readonly drillsFailed: number;
  
  /** Drills skipped */
  readonly drillsSkipped: number;
  
  /** Skills mastered */
  readonly skillsMastered: number;
}

/**
 * Tracks week lifecycle and progress.
 */
export interface IWeekTracker {
  /**
   * Get the current active week for a goal.
   */
  getCurrentWeek(goalId: GoalId): AsyncAppResult<WeekPlan | null>;
  
  /**
   * Update week progress after a drill.
   */
  updateProgress(
    weekPlanId: WeekPlanId,
    update: WeekProgressUpdate
  ): AsyncAppResult<WeekPlan>;
  
  /**
   * Complete a week and prepare next.
   */
  completeWeek(weekPlanId: WeekPlanId): AsyncAppResult<WeekCompletionResult>;
  
  /**
   * Create next week plan.
   */
  createNextWeek(
    goalId: GoalId,
    previousWeek: WeekPlan
  ): AsyncAppResult<WeekPlan>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORTS — Types from types.ts for convenience
// ═══════════════════════════════════════════════════════════════════════════════

export type { GoalProgress, QuestProgress } from './types.js';
