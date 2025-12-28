// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE INTERFACES — Dependency Contracts
// NovaOS — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module defines the interface contracts for the Deliberate Practice system:
//   - ISkillDecomposer: CapabilityStage → Skills conversion
//   - IDrillGenerator: Daily drill generation with roll-forward
//   - IWeekTracker: Week state management and transitions
//   - IDeliberatePracticeEngine: Main orchestrator
//
// Store interfaces follow the pattern from spark-engine/store/types.ts:
//   - ISkillStore, IDrillStore, IWeekPlanStore
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
  DrillCompletionAnalysis,
  CreateSkillParams,
  CreateDrillParams,
  CreateWeekPlanParams,
} from './types.js';

// Re-export store types from spark-engine pattern
import type {
  SaveOptions,
  GetOptions,
  ListOptions,
  SaveResult,
  DeleteResult,
  ListResult,
} from '../spark-engine/store/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL DECOMPOSER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for skill decomposition.
 */
export interface SkillDecompositionContext {
  /** The quest being decomposed */
  readonly quest: Quest;

  /** Parent goal */
  readonly goal: Goal;

  /** Capability stages from the quest */
  readonly stages: readonly CapabilityStage[];

  /** Daily time budget in minutes */
  readonly dailyMinutes: number;

  /** User's skill level */
  readonly userLevel: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Result of skill decomposition.
 */
export interface SkillDecompositionResult {
  /** Generated skills (not yet saved) */
  readonly skills: readonly Skill[];

  /** Total estimated days for all skills */
  readonly totalDays: number;

  /** Warnings or gaps identified */
  readonly warnings: readonly string[];

  /** Suggested week allocation */
  readonly suggestedWeekCount: number;
}

/**
 * Decomposes Quest capability stages into actionable Skills.
 *
 * The decomposer:
 *   - Extracts action, successSignal, lockedVariables from each stage
 *   - Ensures each skill fits the daily time budget
 *   - Preserves the resilience layer (adversarialElement, failureMode, etc.)
 *   - Establishes prerequisite chains
 */
export interface ISkillDecomposer {
  /**
   * Decompose a quest's capability stages into skills.
   *
   * @param context - Decomposition context with quest, goal, stages
   * @returns Generated skills and metadata
   */
  decompose(context: SkillDecompositionContext): AsyncAppResult<SkillDecompositionResult>;

  /**
   * Validate a skill meets all requirements.
   *
   * Requirements:
   *   - Has verb-first action
   *   - Has binary success signal
   *   - Has at least one locked variable
   *   - Fits time budget
   *
   * @returns Error message if invalid, undefined if valid
   */
  validateSkill(skill: Skill, dailyMinutes: number): string | undefined;

  /**
   * Split a skill that exceeds time budget into smaller skills.
   *
   * @param skill - The oversized skill
   * @param dailyMinutes - Target time budget
   * @returns Array of smaller skills
   */
  splitSkill(skill: Skill, dailyMinutes: number): AsyncAppResult<readonly Skill[]>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRILL GENERATOR INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for generating a daily drill.
 */
export interface DrillGenerationContext {
  /** User identifier */
  readonly userId: UserId;

  /** Goal identifier */
  readonly goalId: GoalId;

  /** Current week plan */
  readonly weekPlan: WeekPlan;

  /** Available skills (with current mastery state) */
  readonly availableSkills: readonly Skill[];

  /** Previous drill (if any, for roll-forward) */
  readonly previousDrill?: DailyDrill;

  /** Date to generate drill for (YYYY-MM-DD) */
  readonly date: string;

  /** Day number in the overall plan */
  readonly dayNumber: number;

  /** Daily time budget in minutes */
  readonly dailyMinutes: number;
}

/**
 * Result of roll-forward analysis.
 */
export interface RollForwardResult {
  /**
   * Should retry the same skill?
   * True if previous drill failed or was partial.
   */
  readonly repeatSkill: boolean;

  /**
   * Suggested adaptation for retry.
   * How to adjust the action for better success.
   */
  readonly adaptation?: string;

  /**
   * Context to carry forward.
   * Information from previous attempt.
   */
  readonly carryForward: string;

  /**
   * Skill to practice.
   * Same skill if retry, next skill otherwise.
   */
  readonly nextSkillId: SkillId;

  /**
   * Retry count (incremented if retrying same skill).
   */
  readonly retryCount: number;
}

/**
 * Generates daily drills with roll-forward logic.
 *
 * The generator:
 *   - Selects the optimal skill for today
 *   - Analyzes previous drill for roll-forward context
 *   - Adapts skills for retry after failure
 *   - Creates coherent drill sequences
 */
export interface IDrillGenerator {
  /**
   * Generate a drill for the given context.
   *
   * @param context - Generation context
   * @returns Generated drill (not yet saved)
   */
  generate(context: DrillGenerationContext): AsyncAppResult<DailyDrill>;

  /**
   * Analyze previous drill and determine next action.
   *
   * @param previousDrill - The drill to analyze
   * @param skills - Available skills for selection
   * @returns Roll-forward decision
   */
  analyzeAndRollForward(
    previousDrill: DailyDrill,
    skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult>;

  /**
   * Select the optimal skill for today.
   *
   * Priority order:
   *   1. Carry-forward (retry failed skills)
   *   2. Prerequisites (unblocked skills)
   *   3. Sequence (next in order)
   *   4. Review (reinforcement of mastered skills)
   *
   * @param context - Generation context
   * @returns Selected skill
   */
  selectSkill(context: DrillGenerationContext): AsyncAppResult<Skill>;

  /**
   * Adapt a skill for retry after failure.
   *
   * Simplifications may include:
   *   - Reduced scope
   *   - Explicit hints
   *   - Smaller success criteria
   *
   * @param skill - The skill to adapt
   * @param previousDrill - The failed drill attempt
   * @param retryCount - How many times this has been retried
   * @returns Adapted action and pass signal
   */
  adaptSkillForRetry(
    skill: Skill,
    previousDrill: DailyDrill,
    retryCount: number
  ): AsyncAppResult<{
    action: string;
    passSignal: string;
    constraint: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK TRACKER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of week completion.
 */
export interface WeekCompletionResult {
  /** The completed week plan */
  readonly completedWeek: WeekPlan;

  /** Skills that need carry-forward */
  readonly carryForwardSkills: readonly Skill[];

  /** Generated focus for next week */
  readonly nextWeekFocus: string;

  /** Weekly summary for user */
  readonly summary: string;

  /** Next week plan (if created) */
  readonly nextWeek?: WeekPlan;
}

/**
 * Week progress update.
 */
export interface WeekProgressUpdate {
  /** Updated drill counts */
  readonly drillsCompleted: number;
  readonly drillsPassed: number;
  readonly drillsFailed: number;
  readonly drillsSkipped: number;

  /** Recalculated pass rate */
  readonly passRate: number;

  /** Newly completed skills */
  readonly newlyCompletedSkillIds: readonly SkillId[];
}

/**
 * Tracks week-level progress and transitions.
 *
 * The tracker:
 *   - Manages week lifecycle (pending → active → completed)
 *   - Updates progress after each drill
 *   - Handles week transitions with carry-forward
 *   - Generates weekly summaries
 */
export interface IWeekTracker {
  /**
   * Get or create the current week plan for a goal.
   *
   * @param goalId - Goal identifier
   * @returns Current active week plan
   */
  getCurrentWeek(goalId: GoalId): AsyncAppResult<WeekPlan | null>;

  /**
   * Activate a week plan (pending → active).
   *
   * @param weekPlanId - Week plan to activate
   * @returns Activated week plan
   */
  activateWeek(weekPlanId: WeekPlanId): AsyncAppResult<WeekPlan>;

  /**
   * Complete a week and prepare the next one.
   *
   * @param weekPlanId - Week plan to complete
   * @returns Completion result with next week info
   */
  completeWeek(weekPlanId: WeekPlanId): AsyncAppResult<WeekCompletionResult>;

  /**
   * Update week progress after drill completion.
   *
   * @param weekPlanId - Week plan to update
   * @param drillOutcome - Outcome of the completed drill
   * @param skillId - The skill that was practiced
   * @returns Updated progress
   */
  updateProgress(
    weekPlanId: WeekPlanId,
    drillOutcome: DrillOutcome,
    skillId: SkillId
  ): AsyncAppResult<WeekProgressUpdate>;

  /**
   * Get week plan by week number.
   *
   * @param goalId - Goal identifier
   * @param weekNumber - Week number (1-based)
   * @returns Week plan if exists
   */
  getWeekByNumber(goalId: GoalId, weekNumber: number): AsyncAppResult<WeekPlan | null>;

  /**
   * Get all week plans for a goal.
   *
   * @param goalId - Goal identifier
   * @returns All week plans in order
   */
  getAllWeeks(goalId: GoalId): AsyncAppResult<readonly WeekPlan[]>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Today's practice result.
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

  /**
   * Roll-forward context (why this drill).
   * Explains the drill selection.
   */
  readonly context: string | null;

  /** Goal ID */
  readonly goalId: GoalId | null;

  /** Quest ID */
  readonly questId: QuestId | null;
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
 * Overall progress for a goal.
 */
export interface GoalProgress {
  /** Goal identifier */
  readonly goalId: GoalId;

  /** Skills mastered (passed 3+ times) */
  readonly skillsMastered: number;

  /** Skills in progress (practicing) */
  readonly skillsPracticing: number;

  /** Skills not started */
  readonly skillsNotStarted: number;

  /** Total skills */
  readonly skillsTotal: number;

  /** Weeks completed */
  readonly weeksCompleted: number;

  /** Weeks total */
  readonly weeksTotal: number;

  /** Current week number */
  readonly currentWeek: number;

  /** Current streak (consecutive days practiced) */
  readonly currentStreak: number;

  /** Longest streak achieved */
  readonly longestStreak: number;

  /** Overall pass rate (0-1) */
  readonly overallPassRate: number;

  /** Days completed */
  readonly daysCompleted: number;

  /** Days total (planned) */
  readonly daysTotal: number;

  /** On track with schedule? */
  readonly onTrack: boolean;

  /** Days behind (if any) */
  readonly daysBehind: number;

  /** Estimated completion date */
  readonly estimatedCompletionDate: string;

  /** Last practice date */
  readonly lastPracticeDate: string | null;
}

/**
 * Main orchestrator for the Deliberate Practice system.
 *
 * Coordinates:
 *   - Learning plan initialization from goals
 *   - Daily drill generation with roll-forward
 *   - Outcome recording and mastery updates
 *   - Week transitions and carry-forward
 *   - Progress tracking
 */
export interface IDeliberatePracticeEngine {
  // ─────────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Initialize a learning plan from goal and quests.
   *
   * Steps:
   *   1. Decompose each quest into skills
   *   2. Create week plans with skill allocation
   *   3. Activate first week
   *   4. Generate first drill
   *
   * @param goal - The learning goal
   * @param quests - The goal's quests
   * @param stages - Capability stages (from LessonPlanGenerator)
   * @returns The created learning plan
   */
  initializePlan(
    goal: Goal,
    quests: readonly Quest[],
    stagesByQuest: ReadonlyMap<QuestId, readonly CapabilityStage[]>
  ): AsyncAppResult<LearningPlan>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Daily Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get today's practice for a user.
   *
   * If no drill exists for today:
   *   1. Analyze yesterday's drill (roll-forward)
   *   2. Select skill for today
   *   3. Generate drill
   *   4. Create spark with reminders
   *
   * @param userId - User identifier
   * @param goalId - Goal identifier
   * @returns Today's practice content
   */
  getTodayPractice(userId: UserId, goalId: GoalId): AsyncAppResult<TodayPracticeResult>;

  /**
   * Generate a drill for a specific date.
   *
   * Used by scheduler for pre-generation.
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
   *
   * @param drillId - Drill identifier
   * @returns Drill if found
   */
  getDrill(drillId: DrillId): AsyncAppResult<DailyDrill | null>;

  /**
   * Get drill for a specific date.
   *
   * @param userId - User identifier
   * @param goalId - Goal identifier
   * @param date - Date (YYYY-MM-DD)
   * @returns Drill if found
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
   * Steps:
   *   1. Update drill with outcome
   *   2. Update skill mastery
   *   3. Update week progress
   *   4. Generate carry-forward for tomorrow
   *   5. Complete associated spark
   *
   * @param drillId - Drill identifier
   * @param params - Completion parameters
   * @returns Updated drill
   */
  recordOutcome(
    drillId: DrillId,
    params: DrillCompletionParams
  ): AsyncAppResult<DailyDrill>;

  /**
   * Skip a drill with reason.
   *
   * The skill will be scheduled for retry tomorrow.
   *
   * @param drillId - Drill identifier
   * @param reason - Why skipped (optional)
   * @returns Updated drill
   */
  skipDrill(drillId: DrillId, reason?: string): AsyncAppResult<DailyDrill>;

  /**
   * Mark a drill as missed (end of day reconciliation).
   *
   * @param drillId - Drill identifier
   * @returns Updated drill
   */
  markMissed(drillId: DrillId): AsyncAppResult<DailyDrill>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get skill by ID.
   *
   * @param skillId - Skill identifier
   * @returns Skill if found
   */
  getSkill(skillId: SkillId): AsyncAppResult<Skill | null>;

  /**
   * Get skills for a quest.
   *
   * @param questId - Quest identifier
   * @returns Skills in order
   */
  getSkillsByQuest(questId: QuestId): AsyncAppResult<readonly Skill[]>;

  /**
   * Update skill mastery manually.
   *
   * Used for admin corrections or external validation.
   *
   * @param skillId - Skill identifier
   * @param mastery - New mastery level
   * @returns Updated skill
   */
  updateSkillMastery(skillId: SkillId, mastery: SkillMastery): AsyncAppResult<Skill>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Week Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get current week plan for a goal.
   *
   * @param goalId - Goal identifier
   * @returns Current active week plan
   */
  getCurrentWeek(goalId: GoalId): AsyncAppResult<WeekPlan | null>;

  /**
   * Get all week plans for a goal.
   *
   * @param goalId - Goal identifier
   * @returns All week plans in order
   */
  getWeeks(goalId: GoalId): AsyncAppResult<readonly WeekPlan[]>;

  /**
   * Complete the current week and transition to next.
   *
   * @param weekPlanId - Week plan to complete
   * @returns Completion result
   */
  completeWeek(weekPlanId: WeekPlanId): AsyncAppResult<WeekCompletionResult>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Progress
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get overall progress for a goal.
   *
   * @param goalId - Goal identifier
   * @returns Progress summary
   */
  getProgress(goalId: GoalId): AsyncAppResult<GoalProgress>;

  /**
   * Get learning plan for a goal.
   *
   * @param goalId - Goal identifier
   * @returns Learning plan if initialized
   */
  getLearningPlan(goalId: GoalId): AsyncAppResult<LearningPlan | null>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Skill store interface.
 * Follows IGoalStore pattern from spark-engine/store/types.ts.
 */
export interface ISkillStore {
  save(skill: Skill, options?: SaveOptions): AsyncAppResult<SaveResult<Skill>>;
  get(skillId: SkillId, options?: GetOptions): AsyncAppResult<Skill | null>;
  delete(skillId: SkillId): AsyncAppResult<DeleteResult>;
  getByQuest(questId: QuestId, options?: ListOptions): AsyncAppResult<ListResult<Skill>>;
  getByGoal(goalId: GoalId, options?: ListOptions): AsyncAppResult<ListResult<Skill>>;
  getByUser(userId: UserId, options?: ListOptions): AsyncAppResult<ListResult<Skill>>;
  updateMastery(
    skillId: SkillId,
    mastery: SkillMastery,
    passCount: number,
    failCount: number,
    consecutivePasses: number
  ): AsyncAppResult<Skill>;
}

/**
 * Drill store interface.
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
  updateOutcome(
    drillId: DrillId,
    outcome: DrillOutcome,
    observation?: string,
    carryForward?: string
  ): AsyncAppResult<DailyDrill>;
}

/**
 * Week plan store interface.
 */
export interface IWeekPlanStore {
  save(weekPlan: WeekPlan, options?: SaveOptions): AsyncAppResult<SaveResult<WeekPlan>>;
  get(weekPlanId: WeekPlanId, options?: GetOptions): AsyncAppResult<WeekPlan | null>;
  delete(weekPlanId: WeekPlanId): AsyncAppResult<DeleteResult>;
  getByGoal(goalId: GoalId, options?: ListOptions): AsyncAppResult<ListResult<WeekPlan>>;
  getActiveByGoal(goalId: GoalId): AsyncAppResult<WeekPlan | null>;
  getByWeekNumber(goalId: GoalId, weekNumber: number): AsyncAppResult<WeekPlan | null>;
  updateStatus(weekPlanId: WeekPlanId, status: 'pending' | 'active' | 'completed'): AsyncAppResult<WeekPlan>;
  updateProgress(
    weekPlanId: WeekPlanId,
    drillsCompleted: number,
    drillsPassed: number,
    drillsFailed: number,
    drillsSkipped: number
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
 * Combined interface for all Deliberate Practice Engine stores.
 */
export interface IDeliberatePracticeStores {
  readonly skills: ISkillStore;
  readonly drills: IDrillStore;
  readonly weekPlans: IWeekPlanStore;
  readonly learningPlans: ILearningPlanStore;
}
