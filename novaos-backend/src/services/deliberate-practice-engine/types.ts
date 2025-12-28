// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE TYPES — Core Entity Definitions
// NovaOS — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module defines the core types for the Deliberate Practice system:
//   - Skill: Atomic competence unit from CapabilityStage decomposition
//   - DailyDrill: Single day's practice session with pass/fail outcome
//   - WeekPlan: Week-level learning plan with skill scheduling
//   - DrillOutcome: Binary outcome with nuance
//   - LearningPlan: Complete plan for a goal
//
// Design Principles:
//   - Every Skill is actionable (verb-first)
//   - Every Drill has a binary pass signal (no ambiguity)
//   - Locked variables isolate feedback (clean signal)
//   - Roll-forward logic connects days (continuity)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  GoalId,
  QuestId,
  SkillId,
  DrillId,
  WeekPlanId,
  SparkId,
  UserId,
  Timestamp,
} from '../../types/branded.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// SKILL DIFFICULTY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Skill difficulty tier for scheduling.
 *
 * - foundation: Core skill, must pass before others
 * - practice: Regular skill, can be interleaved
 * - challenge: Advanced skill, scheduled after foundations
 */
export type SkillDifficulty = 'foundation' | 'practice' | 'challenge';

/**
 * All valid skill difficulties.
 */
export const SKILL_DIFFICULTIES: readonly SkillDifficulty[] = [
  'foundation',
  'practice',
  'challenge',
] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// SKILL MASTERY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Skill mastery status progression.
 *
 * - not_started: Never attempted
 * - attempted: Tried at least once, not yet passed
 * - practicing: Passed at least once, needs reinforcement
 * - mastered: Passed consistently (3+ times)
 */
export type SkillMastery = 'not_started' | 'attempted' | 'practicing' | 'mastered';

/**
 * All valid skill mastery levels.
 */
export const SKILL_MASTERY_LEVELS: readonly SkillMastery[] = [
  'not_started',
  'attempted',
  'practicing',
  'mastered',
] as const;

/**
 * Mastery thresholds for progression.
 */
export const MASTERY_THRESHOLDS = {
  /** Passes required to reach 'practicing' */
  PRACTICING: 1,
  /** Passes required to reach 'mastered' */
  MASTERED: 3,
  /** Consecutive passes required for mastery */
  CONSECUTIVE_FOR_MASTERY: 2,
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// SKILL
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Atomic competence unit — what the learner can DO.
 *
 * Skills are decomposed from Quest capability stages.
 * Each skill is:
 *   - Actionable (verb-first statement)
 *   - Measurable (binary pass/fail signal)
 *   - Scoped (fits daily time budget)
 *   - Isolated (locked variables for clean feedback)
 *
 * The resilience layer (adversarialElement, failureMode, recoverySteps)
 * comes directly from CapabilityStage's designedFailure/consequence/recovery.
 */
export interface Skill {
  /** Unique skill identifier */
  readonly id: SkillId;

  /** Parent quest identifier */
  readonly questId: QuestId;

  /** Parent goal identifier (denormalized for queries) */
  readonly goalId: GoalId;

  /** User identifier (denormalized for queries) */
  readonly userId: UserId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Core Skill Definition
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verb-first actionable statement.
   * Must start with an action verb (e.g., "Profile", "Refactor", "Debug").
   * @example "Profile the calculateTax() function and identify the slowest path"
   */
  readonly action: string;

  /**
   * Binary pass criteria — how do we know it worked?
   * Must be observable and unambiguous.
   * @example "Baseline runtime recorded, slowest path identified in notes"
   */
  readonly successSignal: string;

  /**
   * What to hold constant for clean feedback.
   * Isolates the skill from confounding variables.
   * @example ["Don't change the algorithm", "Don't optimize yet", "Use the same dataset"]
   */
  readonly lockedVariables: readonly string[];

  /**
   * Estimated time in minutes.
   * Must fit within daily time budget.
   */
  readonly estimatedMinutes: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Sequencing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Prerequisite skills (must pass before this one).
   * Empty array = no prerequisites (foundation skill).
   */
  readonly prerequisiteSkillIds: readonly SkillId[];

  /**
   * Difficulty tier for scheduling.
   */
  readonly difficulty: SkillDifficulty;

  /**
   * Order within the quest (1-based).
   */
  readonly order: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Mastery Tracking
  // ─────────────────────────────────────────────────────────────────────────────

  /** Current mastery status */
  readonly mastery: SkillMastery;

  /** Total number of times passed */
  readonly passCount: number;

  /** Total number of times failed */
  readonly failCount: number;

  /** Consecutive pass streak (resets on fail) */
  readonly consecutivePasses: number;

  /** Last drill outcome */
  readonly lastOutcome?: 'pass' | 'fail';

  /** When last practiced */
  readonly lastPracticedAt?: Timestamp;

  // ─────────────────────────────────────────────────────────────────────────────
  // Resilience Layer (from CapabilityStage)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Intentional failure scenario — the adversary.
   * A specific way to break the skill to learn from.
   * From CapabilityStage.designedFailure.
   * @example "Profile without clearing cache between runs"
   */
  readonly adversarialElement?: string;

  /**
   * What happens when it fails — visible impact.
   * The observable consequence that teaches.
   * From CapabilityStage.consequence.
   * @example "Timings will be inconsistent, making comparisons meaningless"
   */
  readonly failureMode?: string;

  /**
   * How to recover and learn from failure.
   * The fix + prevention pattern.
   * From CapabilityStage.recovery.
   * @example "Always run warmup iterations, document cache clearing protocol"
   */
  readonly recoverySteps?: string;

  /**
   * How to generalize the skill to new contexts.
   * From CapabilityStage.transfer.
   * @example "Profile a different function type (I/O bound vs CPU bound)"
   */
  readonly transferScenario?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────────────────

  /** Source capability stage title (for reference) */
  readonly sourceStageTitle?: string;

  /** Source capability stage index (1-5) */
  readonly sourceStageIndex?: number;

  /** Topics for resource discovery */
  readonly topics?: readonly string[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────────────────

  /** Creation timestamp */
  readonly createdAt: Timestamp;

  /** Last update timestamp */
  readonly updatedAt: Timestamp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY DRILL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// DRILL OUTCOME
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Drill outcome — binary with nuance.
 *
 * - pass: Success signal met
 * - fail: Success signal not met (retry tomorrow)
 * - partial: Some progress, needs continuation
 * - skipped: User chose to skip (reason tracked)
 */
export type DrillOutcome = 'pass' | 'fail' | 'partial' | 'skipped';

/**
 * All valid drill outcomes.
 */
export const DRILL_OUTCOMES: readonly DrillOutcome[] = [
  'pass',
  'fail',
  'partial',
  'skipped',
] as const;

/**
 * Outcomes that count as attempting the skill.
 */
export const ATTEMPTED_OUTCOMES: readonly DrillOutcome[] = ['pass', 'fail', 'partial'];

/**
 * Outcomes that require retry tomorrow.
 */
export const RETRY_OUTCOMES: readonly DrillOutcome[] = ['fail', 'partial'];

// ─────────────────────────────────────────────────────────────────────────────────
// DRILL STATUS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Drill status in the daily flow.
 */
export type DrillStatus = 'scheduled' | 'active' | 'completed' | 'missed';

/**
 * All valid drill statuses.
 */
export const DRILL_STATUSES: readonly DrillStatus[] = [
  'scheduled',
  'active',
  'completed',
  'missed',
] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// DAILY DRILL
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A single day's practice session.
 *
 * DailyDrill replaces Step for deliberate practice:
 *   - One skill per day (focused)
 *   - Binary pass/fail outcome
 *   - Roll-forward context from previous days
 *   - Locked variables for clean feedback
 *
 * The drill may adapt the skill's action based on:
 *   - Previous failures (simplified retry)
 *   - Carry-forward context (continuation)
 *   - Time constraints (escalation level)
 */
export interface DailyDrill {
  /** Unique drill identifier */
  readonly id: DrillId;

  /** Parent week plan identifier */
  readonly weekPlanId: WeekPlanId;

  /** The skill being practiced */
  readonly skillId: SkillId;

  /** User identifier */
  readonly userId: UserId;

  /** Goal identifier (denormalized) */
  readonly goalId: GoalId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Scheduling
  // ─────────────────────────────────────────────────────────────────────────────

  /** Scheduled date (YYYY-MM-DD) */
  readonly scheduledDate: string;

  /** Day number in the overall plan (1-based) */
  readonly dayNumber: number;

  /** Current status */
  readonly status: DrillStatus;

  // ─────────────────────────────────────────────────────────────────────────────
  // Action & Success Criteria
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Today's specific action.
   * May be adapted from skill's action based on context.
   */
  readonly action: string;

  /**
   * Binary success criteria for today.
   * May be adapted from skill's successSignal based on context.
   */
  readonly passSignal: string;

  /**
   * What NOT to change today (for clean feedback).
   * Typically inherited from skill.
   */
  readonly lockedVariables: readonly string[];

  /**
   * Single focus enforcement — the constraint.
   * What to focus on exclusively today.
   * @example "Only measure, don't optimize"
   */
  readonly constraint: string;

  /** Estimated time in minutes */
  readonly estimatedMinutes: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Outcome Tracking
  // ─────────────────────────────────────────────────────────────────────────────

  /** Drill outcome (set on completion) */
  readonly outcome?: DrillOutcome;

  /**
   * What actually happened (user observation).
   * Free-form notes about the attempt.
   */
  readonly observation?: string;

  /**
   * What tomorrow should focus on.
   * Generated from outcome analysis.
   */
  readonly carryForward?: string;

  /** Should retry this skill tomorrow? */
  readonly repeatTomorrow: boolean;

  /** User's subjective difficulty rating (1-5) */
  readonly difficultyRating?: 1 | 2 | 3 | 4 | 5;

  /** Actual time spent in minutes */
  readonly actualMinutes?: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Roll-Forward Context
  // ─────────────────────────────────────────────────────────────────────────────

  /** Link to previous drill (for continuation) */
  readonly previousDrillId?: DrillId;

  /**
   * Context from roll-forward analysis.
   * Explains why this drill was selected/adapted.
   */
  readonly continuationContext?: string;

  /**
   * Whether this is a retry of a failed skill.
   */
  readonly isRetry: boolean;

  /**
   * Retry count for this skill in current sequence.
   * Resets after pass.
   */
  readonly retryCount: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Spark Integration
  // ─────────────────────────────────────────────────────────────────────────────

  /** Associated spark ID (for reminder system) */
  readonly sparkId?: SparkId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────────────────

  /** Creation timestamp */
  readonly createdAt: Timestamp;

  /** Last update timestamp */
  readonly updatedAt: Timestamp;

  /** When started */
  readonly startedAt?: Timestamp;

  /** When completed */
  readonly completedAt?: Timestamp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK PLAN TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// WEEK PLAN STATUS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Week plan status in the goal lifecycle.
 */
export type WeekPlanStatus = 'pending' | 'active' | 'completed';

/**
 * All valid week plan statuses.
 */
export const WEEK_PLAN_STATUSES: readonly WeekPlanStatus[] = [
  'pending',
  'active',
  'completed',
] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// WEEK PLAN
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Weekly learning plan — groups drills into a focused week.
 *
 * WeekPlan provides:
 *   - Week-level competence target (what you can DO after this week)
 *   - Skill scheduling with carry-forward logic
 *   - Progress aggregation for weekly review
 *   - Automatic next-week focus generation
 */
export interface WeekPlan {
  /** Unique week plan identifier */
  readonly id: WeekPlanId;

  /** Parent goal identifier */
  readonly goalId: GoalId;

  /** User identifier (denormalized) */
  readonly userId: UserId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Week Timing
  // ─────────────────────────────────────────────────────────────────────────────

  /** Week number in the plan (1-based) */
  readonly weekNumber: number;

  /** Start date (YYYY-MM-DD, typically Monday) */
  readonly startDate: string;

  /** End date (YYYY-MM-DD, typically Sunday) */
  readonly endDate: string;

  /** Current status */
  readonly status: WeekPlanStatus;

  // ─────────────────────────────────────────────────────────────────────────────
  // Weekly Focus
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Capability gained by week end.
   * Verb-based, verifiable outcome.
   * @example "Debug memory-related issues in Rust programs"
   */
  readonly weeklyCompetence: string;

  /**
   * Theme for the week.
   * Human-friendly label.
   * @example "Memory Safety & Ownership"
   */
  readonly theme: string;

  /**
   * Quest this week belongs to.
   */
  readonly questId: QuestId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Scheduling
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Skills scheduled for this week.
   * In order of intended practice.
   */
  readonly scheduledSkillIds: readonly SkillId[];

  /**
   * Skills that need more practice (carry-forward from previous week).
   * These take priority over new skills.
   */
  readonly carryForwardSkillIds: readonly SkillId[];

  /**
   * Skills completed this week (passed).
   */
  readonly completedSkillIds: readonly SkillId[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Progress Tracking
  // ─────────────────────────────────────────────────────────────────────────────

  /** Number of drills completed */
  readonly drillsCompleted: number;

  /** Number of drills total (planned for the week) */
  readonly drillsTotal: number;

  /** Number of drills passed */
  readonly drillsPassed: number;

  /** Number of drills failed */
  readonly drillsFailed: number;

  /** Number of drills skipped */
  readonly drillsSkipped: number;

  /**
   * Pass rate for the week (0-1).
   * Calculated as drillsPassed / (drillsPassed + drillsFailed).
   */
  readonly passRate?: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Weekly Review
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Aggregated learnings from the week.
   * Generated from drill observations.
   */
  readonly weeklyObservations?: string;

  /**
   * Auto-generated focus for next week.
   * Based on what needs more practice.
   */
  readonly nextWeekFocus?: string;

  /**
   * Skills to carry forward to next week.
   * Determined at week completion.
   */
  readonly skillsToCarryForward?: readonly SkillId[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────────────────

  /** Creation timestamp */
  readonly createdAt: Timestamp;

  /** Last update timestamp */
  readonly updatedAt: Timestamp;

  /** When completed */
  readonly completedAt?: Timestamp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING PLAN TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete learning plan for a goal.
 *
 * Created when a goal is initialized, maps out:
 *   - Total weeks and skills
 *   - Quest to skills mapping
 *   - Estimated completion timeline
 */
export interface LearningPlan {
  /** Parent goal identifier */
  readonly goalId: GoalId;

  /** User identifier */
  readonly userId: UserId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Plan Overview
  // ─────────────────────────────────────────────────────────────────────────────

  /** Total weeks in the plan */
  readonly totalWeeks: number;

  /** Total skills to master */
  readonly totalSkills: number;

  /** Total drills planned (approximate) */
  readonly totalDrills: number;

  /** Estimated completion date (YYYY-MM-DD) */
  readonly estimatedCompletionDate: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Quest Mapping
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Quest to skills mapping.
   * Each quest's decomposed skills.
   */
  readonly questSkillMapping: readonly QuestSkillMapping[];

  /**
   * Quest to weeks mapping.
   * Which weeks cover which quests.
   */
  readonly questWeekMapping: readonly QuestWeekMapping[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────────────────

  /** Generation timestamp */
  readonly generatedAt: Timestamp;

  /** Last recalculation timestamp (on carry-forward changes) */
  readonly recalculatedAt?: Timestamp;
}

/**
 * Maps a quest to its decomposed skills.
 */
export interface QuestSkillMapping {
  /** Quest identifier */
  readonly questId: QuestId;

  /** Quest title (denormalized) */
  readonly questTitle: string;

  /** Quest order (1-based) */
  readonly questOrder: number;

  /** Skill IDs for this quest */
  readonly skillIds: readonly SkillId[];

  /** Number of skills */
  readonly skillCount: number;

  /** Estimated days for all skills */
  readonly estimatedDays: number;
}

/**
 * Maps a quest to its allocated weeks.
 */
export interface QuestWeekMapping {
  /** Quest identifier */
  readonly questId: QuestId;

  /** Week numbers allocated to this quest (1-based) */
  readonly weekNumbers: readonly number[];

  /** Week plan IDs */
  readonly weekPlanIds: readonly WeekPlanId[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Spark variant — scope reduction for escalation.
 */
export type SparkVariant = 'full' | 'reduced' | 'minimal';

/**
 * Reminder tone — urgency progression.
 */
export type ReminderTone = 'encouraging' | 'gentle' | 'urgent' | 'last_chance';

/**
 * Escalation level configuration.
 * Defines what happens at each reminder level.
 */
export interface EscalationLevelConfig {
  /** Escalation level (0-3) */
  readonly level: number;

  /** Hour to send reminder (0-23, in user's timezone) */
  readonly hour: number;

  /** Spark variant at this level */
  readonly variant: SparkVariant;

  /** Tone for the reminder */
  readonly tone: ReminderTone;

  /**
   * Time multiplier for estimated minutes.
   * 1.0 = full time, 0.5 = half time, 0.25 = quarter time
   */
  readonly timeMultiplier: number;

  /**
   * Pass signal adaptation.
   * How to simplify the success criteria at this level.
   */
  readonly passSignalPrefix?: string;
}

/**
 * Default escalation configuration.
 *
 * Level 0 (9 AM): Full scope, encouraging
 * Level 1 (12 PM): Full scope, gentle reminder
 * Level 2 (3 PM): Reduced scope (half time), urgent
 * Level 3 (6 PM): Minimal scope (quarter time), last chance
 */
export const DEFAULT_ESCALATION_CONFIG: readonly EscalationLevelConfig[] = [
  {
    level: 0,
    hour: 9,
    variant: 'full',
    tone: 'encouraging',
    timeMultiplier: 1.0,
  },
  {
    level: 1,
    hour: 12,
    variant: 'full',
    tone: 'gentle',
    timeMultiplier: 1.0,
  },
  {
    level: 2,
    hour: 15,
    variant: 'reduced',
    tone: 'urgent',
    timeMultiplier: 0.5,
    passSignalPrefix: 'At minimum: ',
  },
  {
    level: 3,
    hour: 18,
    variant: 'minimal',
    tone: 'last_chance',
    timeMultiplier: 0.25,
    passSignalPrefix: 'Just start: ',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a value is a valid SkillDifficulty.
 */
export function isSkillDifficulty(value: unknown): value is SkillDifficulty {
  return (
    typeof value === 'string' &&
    SKILL_DIFFICULTIES.includes(value as SkillDifficulty)
  );
}

/**
 * Check if a value is a valid SkillMastery.
 */
export function isSkillMastery(value: unknown): value is SkillMastery {
  return (
    typeof value === 'string' &&
    SKILL_MASTERY_LEVELS.includes(value as SkillMastery)
  );
}

/**
 * Check if a value is a valid DrillOutcome.
 */
export function isDrillOutcome(value: unknown): value is DrillOutcome {
  return (
    typeof value === 'string' &&
    DRILL_OUTCOMES.includes(value as DrillOutcome)
  );
}

/**
 * Check if a value is a valid DrillStatus.
 */
export function isDrillStatus(value: unknown): value is DrillStatus {
  return (
    typeof value === 'string' &&
    DRILL_STATUSES.includes(value as DrillStatus)
  );
}

/**
 * Check if a value is a valid WeekPlanStatus.
 */
export function isWeekPlanStatus(value: unknown): value is WeekPlanStatus {
  return (
    typeof value === 'string' &&
    WEEK_PLAN_STATUSES.includes(value as WeekPlanStatus)
  );
}

/**
 * Check if an outcome requires retry.
 */
export function requiresRetry(outcome: DrillOutcome): boolean {
  return RETRY_OUTCOMES.includes(outcome);
}

/**
 * Check if an outcome counts as an attempt.
 */
export function countsAsAttempt(outcome: DrillOutcome): boolean {
  return ATTEMPTED_OUTCOMES.includes(outcome);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parameters for creating a new skill.
 */
export interface CreateSkillParams {
  readonly questId: QuestId;
  readonly goalId: GoalId;
  readonly userId: UserId;
  readonly action: string;
  readonly successSignal: string;
  readonly lockedVariables: readonly string[];
  readonly estimatedMinutes: number;
  readonly difficulty: SkillDifficulty;
  readonly order: number;
  readonly prerequisiteSkillIds?: readonly SkillId[];
  readonly adversarialElement?: string;
  readonly failureMode?: string;
  readonly recoverySteps?: string;
  readonly transferScenario?: string;
  readonly sourceStageTitle?: string;
  readonly sourceStageIndex?: number;
  readonly topics?: readonly string[];
}

/**
 * Parameters for creating a new drill.
 */
export interface CreateDrillParams {
  readonly weekPlanId: WeekPlanId;
  readonly skillId: SkillId;
  readonly userId: UserId;
  readonly goalId: GoalId;
  readonly scheduledDate: string;
  readonly dayNumber: number;
  readonly action: string;
  readonly passSignal: string;
  readonly lockedVariables: readonly string[];
  readonly constraint: string;
  readonly estimatedMinutes: number;
  readonly previousDrillId?: DrillId;
  readonly continuationContext?: string;
  readonly isRetry: boolean;
  readonly retryCount: number;
}

/**
 * Parameters for creating a new week plan.
 */
export interface CreateWeekPlanParams {
  readonly goalId: GoalId;
  readonly userId: UserId;
  readonly questId: QuestId;
  readonly weekNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly weeklyCompetence: string;
  readonly theme: string;
  readonly scheduledSkillIds: readonly SkillId[];
  readonly carryForwardSkillIds?: readonly SkillId[];
  readonly drillsTotal: number;
}

/**
 * Result of drill completion analysis.
 */
export interface DrillCompletionAnalysis {
  /** Updated skill mastery */
  readonly newMastery: SkillMastery;

  /** Whether skill should be retried tomorrow */
  readonly shouldRetry: boolean;

  /** Context for tomorrow's drill */
  readonly carryForward: string;

  /** Updated pass count */
  readonly newPassCount: number;

  /** Updated fail count */
  readonly newFailCount: number;

  /** Updated consecutive passes */
  readonly newConsecutivePasses: number;
}
