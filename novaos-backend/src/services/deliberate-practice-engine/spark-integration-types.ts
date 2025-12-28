// ═══════════════════════════════════════════════════════════════════════════════
// SPARK INTEGRATION TYPES — Extended Types for Deliberate Practice
// NovaOS Deliberate Practice Engine — Phase 18: SparkEngine Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// Extends existing Spark and Quest types with Deliberate Practice fields.
// Uses declaration merging to add optional properties without breaking changes.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  SparkId,
  DrillId,
  SkillId,
  QuestId,
} from '../../types/branded.js';
import type { Spark, Quest, SparkVariant } from '../spark-engine/types.js';
import type { DrillOutcome } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENDED SPARK TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extended Spark with Deliberate Practice integration.
 *
 * Adds:
 * - drillId: Links spark to its parent drill
 * - passSignal: Binary success signal from skill
 * - lockedVariables: Constraints for clean feedback
 * - constraint: Active constraint for this attempt
 */
export interface DrillSpark extends Spark {
  /** Parent drill identifier (when generated from Deliberate Practice) */
  readonly drillId?: DrillId;

  /** Binary pass/fail signal from the skill */
  readonly passSignal?: string;

  /** Locked variables for clean feedback */
  readonly lockedVariables?: readonly string[];

  /** Active constraint for this drill attempt */
  readonly constraint?: string;

  /**
   * Whether this spark was generated from Deliberate Practice.
   * True if drillId is present.
   */
  readonly isDrillBased?: boolean;
}

/**
 * Type guard for DrillSpark.
 */
export function isDrillSpark(spark: Spark): spark is DrillSpark {
  return 'drillId' in spark && spark.drillId !== undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENDED QUEST TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extended Quest with Deliberate Practice integration.
 *
 * Adds:
 * - skillIds: Skills generated from this quest's capability stages
 * - competence: Weekly competence statement
 */
export interface SkillQuest extends Quest {
  /** Skill IDs generated from this quest's capability stages */
  readonly skillIds?: readonly SkillId[];

  /** Weekly competence statement (what learner can DO after) */
  readonly competence?: string;

  /** Whether skills have been decomposed for this quest */
  readonly skillsDecomposed?: boolean;
}

/**
 * Type guard for SkillQuest.
 */
export function isSkillQuest(quest: Quest): quest is SkillQuest {
  return 'skillIds' in quest && quest.skillIds !== undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPARK CREATION PARAMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parameters for creating a spark from a drill.
 */
export interface CreateSparkFromDrillParams {
  /** Drill ID */
  readonly drillId: DrillId;

  /** Action text (from drill) */
  readonly action: string;

  /** Pass signal (from skill) */
  readonly passSignal: string;

  /** Locked variables (from skill) */
  readonly lockedVariables: readonly string[];

  /** Constraint (from drill) */
  readonly constraint: string;

  /** Estimated minutes */
  readonly estimatedMinutes: number;

  /** Variant based on retry count */
  readonly variant: SparkVariant;

  /** Escalation level (0 for fresh, higher for retries) */
  readonly escalationLevel: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPARK COMPLETION RESULT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of completing a drill-based spark.
 */
export interface DrillSparkCompletionResult {
  /** Spark ID */
  readonly sparkId: SparkId;

  /** Drill ID */
  readonly drillId: DrillId;

  /** Outcome determined from pass signal */
  readonly outcome: DrillOutcome;

  /** User observation (optional) */
  readonly observation?: string;

  /** Whether pass signal was met */
  readonly passSignalMet: boolean;

  /** Carry-forward for next drill */
  readonly carryForward?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps a drill to its spark(s).
 */
export interface DrillSparkMapping {
  readonly drillId: DrillId;
  readonly sparkIds: readonly SparkId[];
  readonly activeSparkId: SparkId | null;
}

/**
 * Maps a skill to its quest.
 */
export interface SkillQuestMapping {
  readonly skillId: SkillId;
  readonly questId: QuestId;
  readonly skillOrder: number;
}
