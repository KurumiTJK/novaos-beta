// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE TYPES — Phase 19: Skill Tree & Multi-Week Quests
// NovaOS — Phase 19A: Enhanced Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module defines the enhanced types for the Deliberate Practice system:
//
// KEY ENHANCEMENTS:
//   - QuestDuration: Flexible 1-day to multi-week quest durations
//   - SkillType: Foundation → Building → Compound → Synthesis progression
//   - Cross-quest skill dependencies: Skills can build on ANY previous quest
//   - Structured daily drills: Warmup → Main → Stretch sections
//   - Milestone: End-of-quest proof of competence
//   - Enhanced WeekPlan: Multi-week quest tracking with cross-quest context
//
// DESIGN PRINCIPLES:
//   - Every Skill is actionable (verb-first)
//   - Skills form a tree with prerequisites (not a flat list)
//   - Compound skills explicitly combine skills from ANY quest
//   - Synthesis skill at end of each quest proves mastery
//   - Weekly tracking works for any quest duration
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

// Phase 21: Science-Based Learning Types
import type {
  DrillDayType,
  LearningDomain,
  ResourcePolicy,
  GivenMaterialType,
} from './phase21/types/enhanced-types.js';

import type { DurationType } from '../spark-engine/types.js';

// Re-export for convenience
export type { DurationType };

// ═══════════════════════════════════════════════════════════════════════════════
// JIT GENERATION CONSTANTS (Phase 19A)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Placeholder WeekPlanId for JIT-generated drills.
 * These drills don't belong to a pre-generated week plan.
 */
export const JIT_WEEK_PLAN_ID = 'wp_jit_00000000' as WeekPlanId;

/**
 * Default planning horizon for ongoing goals (in days).
 * Used for initial skill distribution calculations.
 */
export const ONGOING_PLANNING_HORIZON_DAYS = 28;

// ═══════════════════════════════════════════════════════════════════════════════
// QUEST DURATION TYPES (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Duration unit for quest timing.
 */
export type DurationUnit = 'days' | 'weeks';

/**
 * Flexible duration for a quest.
 * Supports anything from 1 day to multiple weeks.
 *
 * Examples:
 *   - { unit: 'days', value: 3 } → 3-day mini-quest
 *   - { unit: 'weeks', value: 1 } → Standard 1-week quest (5 practice days)
 *   - { unit: 'weeks', value: 3 } → Multi-week quest (15 practice days)
 */
export interface QuestDuration {
  /** Duration unit */
  readonly unit: DurationUnit;

  /** Number of units */
  readonly value: number;

  /** Total practice days (computed: weeks × 5 or days × 1) */
  readonly practiceDays: number;

  /** Starting week number within the goal (1-based) */
  readonly weekStart: number;

  /** Ending week number within the goal (same as start for ≤1 week) */
  readonly weekEnd: number;

  /** Display label (e.g., "Week 1", "Weeks 2-4", "Days 1-3") */
  readonly displayLabel: string;
}

/**
 * Create a QuestDuration from weeks.
 */
export function createWeeksDuration(
  weeks: number,
  weekStart: number
): QuestDuration {
  const practiceDays = weeks * 5;
  const weekEnd = weekStart + weeks - 1;
  const displayLabel =
    weeks === 1 ? `Week ${weekStart}` : `Weeks ${weekStart}-${weekEnd}`;

  return {
    unit: 'weeks',
    value: weeks,
    practiceDays,
    weekStart,
    weekEnd,
    displayLabel,
  };
}

/**
 * Create a QuestDuration from days.
 */
export function createDaysDuration(
  days: number,
  weekStart: number
): QuestDuration {
  const weeksNeeded = Math.ceil(days / 5);
  const weekEnd = weekStart + weeksNeeded - 1;
  const displayLabel =
    days <= 5
      ? `Week ${weekStart}`
      : `Weeks ${weekStart}-${weekEnd}`;

  return {
    unit: 'days',
    value: days,
    practiceDays: days,
    weekStart,
    weekEnd,
    displayLabel,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TYPE DEFINITIONS (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// SKILL TYPE (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Skill type in the learning progression.
 *
 * - foundation: Core concept, no prereqs within quest (may depend on previous quests)
 * - building: Builds on foundations within same quest
 * - compound: Combines 2+ skills (can span quests)
 * - synthesis: Final skill of quest, combines everything (IS the milestone)
 */
export type SkillType = 'foundation' | 'building' | 'compound' | 'synthesis';

/**
 * All valid skill types in progression order.
 */
export const SKILL_TYPES: readonly SkillType[] = [
  'foundation',
  'building',
  'compound',
  'synthesis',
] as const;

/**
 * Check if a value is a valid SkillType.
 */
export function isSkillType(value: unknown): value is SkillType {
  return typeof value === 'string' && SKILL_TYPES.includes(value as SkillType);
}

// ─────────────────────────────────────────────────────────────────────────────────
// SKILL DIFFICULTY (unchanged from Phase 18)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Skill difficulty tier for scheduling.
 *
 * - intro: Entry-level, first exposure
 * - practice: Standard practice difficulty
 * - challenge: Advanced, requires solid foundations
 * - synthesis: Combines multiple concepts
 */
export type SkillDifficulty = 'intro' | 'practice' | 'challenge' | 'synthesis';

/**
 * All valid skill difficulties.
 */
export const SKILL_DIFFICULTIES: readonly SkillDifficulty[] = [
  'intro',
  'practice',
  'challenge',
  'synthesis',
] as const;

/**
 * Check if a value is a valid SkillDifficulty.
 */
export function isSkillDifficulty(value: unknown): value is SkillDifficulty {
  return (
    typeof value === 'string' &&
    SKILL_DIFFICULTIES.includes(value as SkillDifficulty)
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SKILL MASTERY (unchanged from Phase 18)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Skill mastery status progression.
 *
 * - not_started: Never attempted
 * - attempting: Tried at least once, not yet passed
 * - practicing: Passed at least once, needs reinforcement
 * - mastered: Passed consistently (3+ times)
 */
export type SkillMastery = 'not_started' | 'attempting' | 'practicing' | 'mastered';

/**
 * All valid skill mastery levels.
 */
export const SKILL_MASTERY_LEVELS: readonly SkillMastery[] = [
  'not_started',
  'attempting',
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

/**
 * Check if a value is a valid SkillMastery.
 */
export function isSkillMastery(value: unknown): value is SkillMastery {
  return (
    typeof value === 'string' &&
    SKILL_MASTERY_LEVELS.includes(value as SkillMastery)
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SKILL STATUS (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Skill availability status based on prerequisites.
 *
 * - locked: Prerequisites not yet mastered
 * - available: Can be practiced (prereqs met)
 * - in_progress: Currently being practiced
 * - mastered: Fully mastered
 */
export type SkillStatus = 'locked' | 'available' | 'in_progress' | 'mastered';

/**
 * All valid skill statuses.
 */
export const SKILL_STATUSES: readonly SkillStatus[] = [
  'locked',
  'available',
  'in_progress',
  'mastered',
] as const;

/**
 * Check if a value is a valid SkillStatus.
 */
export function isSkillStatus(value: unknown): value is SkillStatus {
  return (
    typeof value === 'string' &&
    SKILL_STATUSES.includes(value as SkillStatus)
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SKILL (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Atomic competence unit — what the learner can DO.
 *
 * ENHANCED in Phase 19:
 *   - skillType: foundation/building/compound/synthesis
 *   - Cross-quest dependencies: prerequisiteSkillIds can reference ANY quest
 *   - Compound skill support: componentSkillIds lists skills being combined
 *   - Enhanced scheduling: weekNumber, dayInWeek, dayInQuest
 *   - Depth in skill tree: 0=foundation, 1=building, 2=compound, 3=synthesis
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
   * Skill title (human-readable name).
   * @example "For Loops", "Type Conversion", "Loop + Condition"
   */
  readonly title: string;

  /**
   * Topic this skill belongs to (from quest.topics).
   * @example "for loops", "type conversion"
   */
  readonly topic: string;

  /**
   * Verb-first actionable statement.
   * Must start with an action verb (e.g., "Write", "Build", "Debug").
   * @example "Write a for loop that iterates over a list and prints each item"
   */
  readonly action: string;

  /**
   * Binary pass criteria — how do we know it worked?
   * Must be observable and unambiguous.
   * @example "Loop correctly prints each item without errors"
   */
  readonly successSignal: string;

  /**
   * What to hold constant for clean feedback.
   * Isolates the skill from confounding variables.
   * @example ["Don't use while loops", "Use only basic iteration"]
   */
  readonly lockedVariables: readonly string[];

  /**
   * Estimated time in minutes.
   * Must fit within daily time budget.
   */
  readonly estimatedMinutes: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Type & Tree Structure (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Type of skill in the progression.
   */
  readonly skillType: SkillType;

  /**
   * Depth in the skill tree.
   * 0 = foundation (root), 1 = building, 2 = compound, 3 = synthesis
   */
  readonly depth: number;

  /**
   * Prerequisite skills (must master before this one).
   * CAN REFERENCE SKILLS FROM ANY QUEST (cross-quest dependencies).
   * Empty array = no prerequisites (foundation skill).
   */
  readonly prerequisiteSkillIds: readonly SkillId[];

  /**
   * Quest IDs that prerequisites come from.
   * Used for quick filtering and display.
   * Computed from prerequisiteSkillIds.
   */
  readonly prerequisiteQuestIds: readonly QuestId[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Compound Skill Support (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Whether this is a compound skill (combines multiple skills).
   */
  readonly isCompound: boolean;

  /**
   * Skills being combined (for compound/synthesis skills).
   * These are the "building blocks" this skill integrates.
   */
  readonly componentSkillIds?: readonly SkillId[];

  /**
   * Quests the component skills come from.
   * For cross-quest compounds, lists all source quests.
   */
  readonly componentQuestIds?: readonly QuestId[];

  /**
   * Context for how components are combined.
   * Explains the integration.
   * @example "Filter items in a loop using conditional logic"
   */
  readonly combinationContext?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Scheduling (ENHANCED)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Week number in the goal (1-based).
   * For multi-week quests, tracks which week within the goal.
   */
  readonly weekNumber: number;

  /**
   * Day within the week (1-5 for weekdays).
   */
  readonly dayInWeek: number;

  /**
   * Day within the quest (1-based).
   * For a 3-week quest, ranges from 1-15.
   */
  readonly dayInQuest: number;

  /**
   * Scheduled date (YYYY-MM-DD).
   * Computed when the goal starts.
   */
  readonly scheduledDate?: string;

  /**
   * Order within the quest (1-based, for sorting).
   */
  readonly order: number;

  /**
   * Difficulty tier for adaptive scheduling.
   */
  readonly difficulty: SkillDifficulty;

  // ─────────────────────────────────────────────────────────────────────────────
  // Mastery Tracking (unchanged from Phase 18)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Current mastery status */
  readonly mastery: SkillMastery;

  /** Availability status based on prerequisites */
  readonly status: SkillStatus;

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

  /** When mastered */
  readonly masteredAt?: Timestamp;

  /** When unlocked (prerequisites met) */
  readonly unlockedAt?: Timestamp;

  // ─────────────────────────────────────────────────────────────────────────────
  // Resilience Layer (from CapabilityStage)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Intentional failure scenario — the adversary.
   * A specific way to break the skill to learn from.
   * @example "Use wrong loop variable"
   */
  readonly adversarialElement?: string;

  /**
   * What happens when it fails — visible impact.
   * @example "Infinite loop or index error"
   */
  readonly failureMode?: string;

  /**
   * How to recover and learn from failure.
   * @example "Add print statements to trace execution"
   */
  readonly recoverySteps?: string;

  /**
   * How to generalize the skill to new contexts.
   * @example "Apply to different data structures"
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
// DAILY DRILL TYPES (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// DRILL SECTION TYPE (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Type of drill section.
 *
 * - warmup: Review of prerequisites or previous quest skills (5 min)
 * - main: Today's primary skill practice (15-25 min)
 * - stretch: Optional challenge extension (5 min)
 */
export type DrillSectionType = 'warmup' | 'main' | 'stretch';

/**
 * All valid drill section types.
 */
export const DRILL_SECTION_TYPES: readonly DrillSectionType[] = [
  'warmup',
  'main',
  'stretch',
] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// DRILL SECTION (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A section within a daily drill.
 *
 * Drills now have structure:
 *   - warmup: Review prerequisite or previous quest skill
 *   - main: Today's skill practice
 *   - stretch: Optional challenge
 */
export interface DrillSection {
  /** Section type */
  readonly type: DrillSectionType;

  /** Section title */
  readonly title: string;

  /** What to do */
  readonly action: string;

  /** Success criteria (for main section) */
  readonly passSignal?: string;

  /** Constraint to follow */
  readonly constraint?: string;

  /** Estimated time in minutes */
  readonly estimatedMinutes: number;

  /** Whether this section is optional */
  readonly isOptional?: boolean;

  /** Whether this reviews a skill from a previous quest */
  readonly isFromPreviousQuest?: boolean;

  /** Source quest ID (if from previous quest) */
  readonly sourceQuestId?: QuestId;

  /** Source skill ID (if reviewing a specific skill) */
  readonly sourceSkillId?: SkillId;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DRILL OUTCOME (unchanged from Phase 18)
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

// ─────────────────────────────────────────────────────────────────────────────────
// DRILL STATUS (unchanged from Phase 18)
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

/**
 * Check if a value is a valid DrillStatus.
 */
export function isDrillStatus(value: unknown): value is DrillStatus {
  return (
    typeof value === 'string' &&
    DRILL_STATUSES.includes(value as DrillStatus)
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// DAILY DRILL (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A single day's practice session.
 *
 * ENHANCED in Phase 19:
 *   - Structured sections: warmup, main, stretch
 *   - Cross-quest context tracking
 *   - Enhanced scheduling: dayInWeek, dayInQuest, weekNumber
 *   - Skill type awareness
 *
 * DailyDrill replaces Step for deliberate practice:
 *   - One skill per day (focused)
 *   - Binary pass/fail outcome
 *   - Roll-forward context from previous days
 *   - Locked variables for clean feedback
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

  /** Quest identifier (denormalized) */
  readonly questId: QuestId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Scheduling (ENHANCED)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Scheduled date (YYYY-MM-DD) */
  readonly scheduledDate: string;

  /** Day number in the overall plan (1-based) */
  readonly dayNumber: number;

  /** Week number in the goal (1-based) */
  readonly weekNumber: number;

  /** Day within the week (1-5) */
  readonly dayInWeek: number;

  /** Day within the quest (1-based, for multi-week quests) */
  readonly dayInQuest: number;

  /** Current status */
  readonly status: DrillStatus;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Context (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Type of skill being practiced */
  readonly skillType: SkillType;

  /** Skill title (denormalized) */
  readonly skillTitle: string;

  /** Whether this is a compound skill drill */
  readonly isCompoundDrill: boolean;

  /** Component skill IDs (for compound skills) */
  readonly componentSkillIds?: readonly SkillId[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Cross-Quest Context (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Quest IDs this drill builds on (for compound skills) */
  readonly buildsOnQuestIds: readonly QuestId[];

  /** Skill ID being reviewed in warmup (if any) */
  readonly reviewSkillId?: SkillId;

  /** Quest ID the review skill comes from */
  readonly reviewQuestId?: QuestId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Structured Sections (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Warmup section (review prerequisite or previous quest skill) */
  readonly warmup?: DrillSection;

  /** Main practice section */
  readonly main: DrillSection;

  /** Stretch challenge section (optional) */
  readonly stretch?: DrillSection;

  // ─────────────────────────────────────────────────────────────────────────────
  // Legacy Fields (for backward compatibility)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Today's specific action (from main section).
   * @deprecated Use main.action instead
   */
  readonly action: string;

  /**
   * Binary success criteria (from main section).
   * @deprecated Use main.passSignal instead
   */
  readonly passSignal: string;

  /**
   * What NOT to change today.
   */
  readonly lockedVariables: readonly string[];

  /**
   * Single focus constraint.
   */
  readonly constraint: string;

  /** Estimated time in minutes (total) */
  readonly estimatedMinutes: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Outcome Tracking (unchanged from Phase 18)
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
  // Roll-Forward Context (unchanged from Phase 18)
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
  // Spark Integration (unchanged from Phase 18)
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

  // ─────────────────────────────────────────────────────────────────────────────
  // JIT Generation Metadata (Phase 19A)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Whether this drill was generated JIT (just-in-time).
   * True for drills generated on-demand, false for pre-generated drills.
   */
  readonly isJIT?: boolean;

  /**
   * Context explaining why this skill was selected.
   * Examples: "Retry needed", "Next skill in sequence", "Reinforcing mastered skill"
   */
  readonly generationContext?: string;

  /**
   * Timestamp when drill was generated.
   * For JIT drills, this is when getTodayPractice() was called.
   */
  readonly generatedAt?: Timestamp;

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 21: Science-Based Learning Fields
  // ─────────────────────────────────────────────────────────────────────────────

  /** Day type based on 5-day E/S/C/F/P pattern. */
  readonly dayType?: DrillDayType;

  /** Global day number across entire goal (1, 2, 3... N). */
  readonly globalDayNumber?: number;

  /** Quick recall question from previous day. Null for Week 1 Day 1. */
  readonly prime?: string | null;

  /** Answer to prime question. */
  readonly primeAnswer?: string | null;

  /** Concrete action for today. Verb-first, specific. */
  readonly do?: string;

  /** Given material for ENCOUNTER and FAIL days. */
  readonly givenMaterial?: string | null;

  /** Type of given material for rendering. */
  readonly givenMaterialType?: GivenMaterialType | null;

  /** Binary (yes/no) success signal. Observable, verifiable. */
  readonly done?: string;

  /** Where 80% of learners fail. Specific error/problem. */
  readonly stuck?: string;

  /** Single concrete recovery action. Verb-first, actionable. */
  readonly unstuck?: string;

  /** Why this matters. Connection to bigger picture. */
  readonly why?: string;

  /** End-of-session reflection prompt. */
  readonly reflect?: string;

  /** Topics for fresh resource search at drill start. */
  readonly resourceTopics?: readonly string[];

  /** Resource availability policy based on day type. */
  readonly resourcePolicy?: ResourcePolicy;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK PLAN TYPES (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// WEEK PLAN STATUS (unchanged from Phase 18)
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

/**
 * Check if a value is a valid WeekPlanStatus.
 */
export function isWeekPlanStatus(value: unknown): value is WeekPlanStatus {
  return (
    typeof value === 'string' &&
    WEEK_PLAN_STATUSES.includes(value as WeekPlanStatus)
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// DAY PLAN (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A single day's plan within a week.
 * Captures what skill is scheduled and its context.
 */
export interface DayPlan {
  /** Day number within the week (1-5) */
  readonly dayNumber: number;

  /** Day number within the quest (1-based) */
  readonly dayInQuest: number;

  /** Scheduled date (YYYY-MM-DD) */
  readonly scheduledDate?: string;

  /** Skill scheduled for this day */
  readonly skillId: SkillId;

  /** Skill type */
  readonly skillType: SkillType;

  /** Skill title (denormalized) */
  readonly skillTitle: string;

  /** Skill to review in warmup (from previous quest) */
  readonly reviewSkillId?: SkillId;

  /** Quest the review skill comes from */
  readonly reviewQuestId?: QuestId;

  /** Day status */
  readonly status: 'pending' | 'completed' | 'skipped';

  /** Associated drill ID (when generated) */
  readonly drillId?: DrillId;
}

// ─────────────────────────────────────────────────────────────────────────────────
// WEEK PLAN (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Weekly learning plan — groups drills into a focused week.
 *
 * ENHANCED in Phase 19:
 *   - weekInQuest: Track position within multi-week quests
 *   - isFirstWeekOfQuest/isLastWeekOfQuest: Milestone triggers
 *   - days: Structured day plans
 *   - Cross-quest context: reviewsFromQuestIds, buildsOnSkillIds
 *   - Skill type counts
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

  /** Quest this week belongs to */
  readonly questId: QuestId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Week Timing (ENHANCED)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Week number in the goal (1-based) */
  readonly weekNumber: number;

  /** Week number within the quest (1-based, for multi-week quests) */
  readonly weekInQuest: number;

  /** Whether this is the first week of the quest */
  readonly isFirstWeekOfQuest: boolean;

  /** Whether this is the last week of the quest (has milestone) */
  readonly isLastWeekOfQuest: boolean;

  /** Start date (YYYY-MM-DD, typically Monday) */
  readonly startDate: string;

  /** End date (YYYY-MM-DD, typically Sunday) */
  readonly endDate: string;

  /** Current status */
  readonly status: WeekPlanStatus;

  // ─────────────────────────────────────────────────────────────────────────────
  // Weekly Focus (unchanged from Phase 18)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Capability gained by week end.
   * Verb-based, verifiable outcome.
   * @example "Implement conditional logic and loops"
   */
  readonly weeklyCompetence: string;

  /**
   * Theme for the week.
   * Human-friendly label.
   * @example "Control Flow Fundamentals"
   */
  readonly theme: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Day Plans (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Structured day plans for this week.
   * 5 practice days (Monday-Friday).
   */
  readonly days: readonly DayPlan[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Scheduling (ENHANCED)
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
  // Skill Type Counts (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Number of foundation skills this week */
  readonly foundationCount: number;

  /** Number of building skills this week */
  readonly buildingCount: number;

  /** Number of compound skills this week */
  readonly compoundCount: number;

  /** Whether this week has the synthesis skill (milestone) */
  readonly hasSynthesis: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Cross-Quest Context (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Previous quest IDs that skills this week review.
   * For warmup selection.
   */
  readonly reviewsFromQuestIds: readonly QuestId[];

  /**
   * Key prerequisite skill IDs from previous quests.
   * These are the foundations this week builds on.
   */
  readonly buildsOnSkillIds: readonly SkillId[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Progress Tracking (unchanged from Phase 18)
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

  /** Number of skills mastered this week */
  readonly skillsMastered: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Weekly Review (unchanged from Phase 18)
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

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 21: Science-Based Learning Fields
  // ─────────────────────────────────────────────────────────────────────────────

  /** The ONE skill for this week. Verb-first, specific, domain-appropriate. */
  readonly skill?: string;

  /** Day 5 PROVE criteria. Binary, observable, achievable with Days 1-4 knowledge. */
  readonly competenceProof?: string;

  /** Learning domain for this week's content. */
  readonly domain?: LearningDomain;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE TYPES (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Milestone status in the quest lifecycle.
 */
export type MilestoneStatus = 'locked' | 'available' | 'in_progress' | 'completed';

/**
 * All valid milestone statuses.
 */
export const MILESTONE_STATUSES: readonly MilestoneStatus[] = [
  'locked',
  'available',
  'in_progress',
  'completed',
] as const;

/**
 * Check if a value is a valid MilestoneStatus.
 */
export function isMilestoneStatus(value: unknown): value is MilestoneStatus {
  return (
    typeof value === 'string' &&
    MILESTONE_STATUSES.includes(value as MilestoneStatus)
  );
}

/**
 * A milestone is the capstone project at the end of a quest.
 * It proves mastery by combining all skills learned.
 *
 * The synthesis skill IS the milestone.
 */
export interface QuestMilestone {
  /** Milestone title */
  readonly title: string;

  /** Detailed description */
  readonly description: string;

  /** The deliverable (what you build) */
  readonly artifact: string;

  /** Acceptance criteria (checkable items) */
  readonly acceptanceCriteria: readonly string[];

  /** Estimated time in minutes */
  readonly estimatedMinutes: number;

  /** Required mastery percentage to unlock (e.g., 0.75 = 75%) */
  readonly requiredMasteryPercent: number;

  /** Current status */
  readonly status: MilestoneStatus;

  /** When unlocked */
  readonly unlockedAt?: Timestamp;

  /** When completed */
  readonly completedAt?: Timestamp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING PLAN TYPES (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete learning plan for a goal.
 *
 * ENHANCED in Phase 19:
 *   - questDurations: Track multi-week quest durations
 *   - totalPracticeDays: Actual practice days (not calendar days)
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
  // Duration Configuration (Phase 19A)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Duration type - fixed or ongoing.
   * Required field that determines plan behavior.
   * Phase 19A addition.
   */
  readonly durationType: DurationType;

  // ─────────────────────────────────────────────────────────────────────────────
  // Plan Overview (ENHANCED - Phase 19A: optional for ongoing)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Total weeks in the plan.
   * Undefined for ongoing goals.
   */
  readonly totalWeeks?: number;

  /**
   * Total practice days (sum of all quest practice days).
   * Undefined for ongoing goals.
   */
  readonly totalPracticeDays?: number;

  /** Total skills to master */
  readonly totalSkills: number;

  /**
   * Total drills planned (approximate).
   * Undefined for ongoing goals.
   */
  readonly totalDrills?: number;

  /**
   * Estimated completion date (YYYY-MM-DD).
   * Undefined for ongoing goals.
   */
  readonly estimatedCompletionDate?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Quest Mapping (ENHANCED - Phase 19A: some optional for JIT)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Quest to skills mapping.
   * Each quest's decomposed skills.
   * Always required - skills are decomposed upfront even for JIT.
   */
  readonly questSkillMapping: readonly QuestSkillMapping[];

  /**
   * Quest to weeks mapping.
   * Which weeks cover which quests.
   * Optional in JIT mode - weeks not pre-generated.
   */
  readonly questWeekMapping?: readonly QuestWeekMapping[];

  /**
   * Quest durations (NEW).
   * Duration for each quest, indexed by quest order.
   * Optional in JIT mode.
   */
  readonly questDurations?: readonly QuestDuration[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Type Summary (NEW - Phase 19A: optional)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Total foundation skills */
  readonly foundationSkillCount?: number;

  /** Total building skills */
  readonly buildingSkillCount?: number;

  /** Total compound skills */
  readonly compoundSkillCount?: number;

  /** Total synthesis skills (equals number of quests) */
  readonly synthesisSkillCount?: number;

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
 * ENHANCED with skill type counts.
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

  // NEW in Phase 19
  /** Foundation skill count */
  readonly foundationCount: number;

  /** Building skill count */
  readonly buildingCount: number;

  /** Compound skill count */
  readonly compoundCount: number;

  /** Whether this quest has a synthesis skill */
  readonly hasSynthesis: boolean;

  /** Milestone for this quest */
  readonly milestone?: QuestMilestone;
}

/**
 * Maps a quest to its allocated weeks.
 * ENHANCED with duration info.
 */
export interface QuestWeekMapping {
  /** Quest identifier */
  readonly questId: QuestId;

  /** Week numbers allocated to this quest (1-based) */
  readonly weekNumbers: readonly number[];

  /** Week plan IDs */
  readonly weekPlanIds: readonly WeekPlanId[];

  /** Quest duration (NEW) */
  readonly duration: QuestDuration;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS TYPES (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Overall goal progress.
 * ENHANCED with skill type breakdown and cross-quest stats.
 */
export interface GoalProgress {
  /** Goal identifier */
  readonly goalId: GoalId;

  // ─────────────────────────────────────────────────────────────────────────────
  // Overall
  // ─────────────────────────────────────────────────────────────────────────────

  /** Total practice days */
  readonly totalDays: number;

  /** Days completed */
  readonly daysCompleted: number;

  /** Overall progress percentage (0-100) */
  readonly percentComplete: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Quest Progress
  // ─────────────────────────────────────────────────────────────────────────────

  /** Total quests */
  readonly questsTotal: number;

  /** Quests completed */
  readonly questsCompleted: number;

  /** Current quest progress */
  readonly currentQuest: QuestProgress;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Progress (ENHANCED)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Total skills */
  readonly skillsTotal: number;

  /** Skills mastered */
  readonly skillsMastered: number;

  /** Skills in progress */
  readonly skillsPracticing: number;

  /** Skills locked (prereqs not met) */
  readonly skillsLocked: number;

  /** Skills not started (available but not attempted) */
  readonly skillsNotStarted: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Type Breakdown (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Foundation skills mastered */
  readonly foundationSkillsMastered: number;

  /** Building skills mastered */
  readonly buildingSkillsMastered: number;

  /** Compound skills mastered */
  readonly compoundSkillsMastered: number;

  /** Synthesis skills mastered (milestones completed) */
  readonly synthesisSkillsMastered: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Cross-Quest Stats (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Number of compound skills that use previous quest skills */
  readonly crossQuestSkillsCompleted: number;

  /** Number of connections formed between quests */
  readonly questConnectionsFormed: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Streaks & Performance
  // ─────────────────────────────────────────────────────────────────────────────

  /** Current practice streak (consecutive days) */
  readonly currentStreak: number;

  /** Longest streak achieved */
  readonly longestStreak: number;

  /** Overall pass rate (0-1) */
  readonly overallPassRate: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Schedule
  // ─────────────────────────────────────────────────────────────────────────────

  /** Whether on track with schedule */
  readonly onTrack: boolean;

  /** Days behind schedule */
  readonly daysBehind: number;

  /** Estimated completion date */
  readonly estimatedCompletionDate: string;

  /** Last practice date */
  readonly lastPracticeDate: string | null;
}

/**
 * Progress within a specific quest.
 */
export interface QuestProgress {
  /** Quest identifier */
  readonly questId: QuestId;

  /** Quest title */
  readonly title: string;

  /** Duration display label (e.g., "Weeks 2-4") */
  readonly durationLabel: string;

  /** Current week number within the quest */
  readonly currentWeek: number;

  /** Total weeks in this quest */
  readonly totalWeeks: number;

  /** Current day within the quest */
  readonly currentDay: number;

  /** Total practice days in this quest */
  readonly totalDays: number;

  /** Skills in this quest */
  readonly skillsTotal: number;

  /** Skills mastered in this quest */
  readonly skillsMastered: number;

  /** Progress percentage for this quest (0-100) */
  readonly percentComplete: number;

  /** Milestone status */
  readonly milestoneStatus: MilestoneStatus;

  /** Milestone title */
  readonly milestoneTitle: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION CONFIGURATION (unchanged from Phase 18)
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
// UTILITY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parameters for creating a new skill.
 * ENHANCED with Phase 19 fields.
 */
export interface CreateSkillParams {
  readonly questId: QuestId;
  readonly goalId: GoalId;
  readonly userId: UserId;
  readonly title: string;
  readonly topic: string;
  readonly action: string;
  readonly successSignal: string;
  readonly lockedVariables: readonly string[];
  readonly estimatedMinutes: number;
  readonly skillType: SkillType;
  readonly depth: number;
  readonly difficulty: SkillDifficulty;
  readonly order: number;
  readonly weekNumber: number;
  readonly dayInWeek: number;
  readonly dayInQuest: number;
  readonly prerequisiteSkillIds?: readonly SkillId[];
  readonly prerequisiteQuestIds?: readonly QuestId[];
  readonly isCompound?: boolean;
  readonly componentSkillIds?: readonly SkillId[];
  readonly componentQuestIds?: readonly QuestId[];
  readonly combinationContext?: string;
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
 * ENHANCED with Phase 19 fields.
 */
export interface CreateDrillParams {
  readonly weekPlanId: WeekPlanId;
  readonly skillId: SkillId;
  readonly userId: UserId;
  readonly goalId: GoalId;
  readonly questId: QuestId;
  readonly scheduledDate: string;
  readonly dayNumber: number;
  readonly weekNumber: number;
  readonly dayInWeek: number;
  readonly dayInQuest: number;
  readonly skillType: SkillType;
  readonly skillTitle: string;
  readonly isCompoundDrill: boolean;
  readonly componentSkillIds?: readonly SkillId[];
  readonly buildsOnQuestIds?: readonly QuestId[];
  readonly reviewSkillId?: SkillId;
  readonly reviewQuestId?: QuestId;
  readonly warmup?: DrillSection;
  readonly main: DrillSection;
  readonly stretch?: DrillSection;
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
 * ENHANCED with Phase 19 fields.
 */
export interface CreateWeekPlanParams {
  readonly goalId: GoalId;
  readonly userId: UserId;
  readonly questId: QuestId;
  readonly weekNumber: number;
  readonly weekInQuest: number;
  readonly isFirstWeekOfQuest: boolean;
  readonly isLastWeekOfQuest: boolean;
  readonly startDate: string;
  readonly endDate: string;
  readonly weeklyCompetence: string;
  readonly theme: string;
  readonly days: readonly DayPlan[];
  readonly scheduledSkillIds: readonly SkillId[];
  readonly carryForwardSkillIds?: readonly SkillId[];
  readonly foundationCount: number;
  readonly buildingCount: number;
  readonly compoundCount: number;
  readonly hasSynthesis: boolean;
  readonly reviewsFromQuestIds?: readonly QuestId[];
  readonly buildsOnSkillIds?: readonly SkillId[];
  readonly drillsTotal: number;
}

/**
 * Result of drill completion analysis.
 */
export interface DrillCompletionAnalysis {
  /** Updated skill mastery */
  readonly newMastery: SkillMastery;

  /** Updated skill status */
  readonly newStatus: SkillStatus;

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

  /** Skills unlocked by this completion */
  readonly unlockedSkillIds: readonly SkillId[];

  /** Whether milestone is now available */
  readonly milestoneUnlocked: boolean;
}

/**
 * Skill generation distribution targets.
 * Controls how many of each skill type to generate.
 */
export interface SkillDistribution {
  /** Percentage of skills that should be foundation (0-1) */
  readonly foundationPercent: number;

  /** Percentage of skills that should be building (0-1) */
  readonly buildingPercent: number;

  /** Percentage of skills that should be compound (0-1) */
  readonly compoundPercent: number;

  /** Percentage of skills that should be synthesis (0-1, typically small) */
  readonly synthesisPercent: number;
}

/**
 * Default skill distribution for a quest.
 */
export const DEFAULT_SKILL_DISTRIBUTION: SkillDistribution = {
  foundationPercent: 0.35,
  buildingPercent: 0.25,
  compoundPercent: 0.30,
  synthesisPercent: 0.10,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// JIT HELPER FUNCTIONS (Phase 19A)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a drill was generated JIT (just-in-time).
 *
 * @param drill - The drill to check
 * @returns true if drill was JIT-generated
 */
export function isJITDrill(drill: DailyDrill): boolean {
  return drill.isJIT === true || drill.weekPlanId === JIT_WEEK_PLAN_ID;
}

/**
 * Check if a learning plan uses JIT generation.
 * Currently, all ongoing plans use JIT, but fixed plans may also opt-in.
 *
 * @param plan - The learning plan to check
 * @returns true if plan uses JIT generation
 */
export function usesJITGeneration(plan: LearningPlan): boolean {
  // All ongoing plans use JIT
  if (plan.durationType === 'ongoing') {
    return true;
  }

  // Fixed plans use JIT if they don't have week mappings
  return !plan.questWeekMapping || plan.questWeekMapping.length === 0;
}
