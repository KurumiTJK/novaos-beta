// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION LOGIC — Bounded Escalation & Variant Selection
// NovaOS Spark Engine — Phase 10: Spark Generation
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module handles escalation-related logic:
//   - Bounding escalation levels to configured maximum
//   - Mapping escalation levels to spark variants
//   - Selecting activities based on escalation
//   - Time estimation based on variant
//
// Escalation Pattern:
//   Level 0 → full    → Complete activity
//   Level 1 → reduced → Partial activity
//   Level 2 → minimal → Just start
//   Level 3 → minimal → Minimal + skip option
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { SparkVariant, Activity } from '../types.js';
import type { SparkGenerationConfig } from './types.js';
import {
  ESCALATION_BOUNDS,
  ESCALATION_TO_VARIANT,
  TIME_BOUNDS,
  DEFAULT_SPARK_GENERATION_CONFIG,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION LEVEL BOUNDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clamp an escalation level to valid bounds.
 *
 * @param level - Requested escalation level
 * @param maxLevel - Maximum allowed level (from config)
 * @returns Clamped escalation level and whether it was modified
 */
export function clampEscalationLevel(
  level: number,
  maxLevel: number = DEFAULT_SPARK_GENERATION_CONFIG.maxEscalationLevel
): { level: number; clamped: boolean } {
  const min = ESCALATION_BOUNDS.MIN;
  const max = Math.min(maxLevel, ESCALATION_BOUNDS.MAX);

  if (level < min) {
    return { level: min, clamped: true };
  }

  if (level > max) {
    return { level: max, clamped: true };
  }

  // Ensure integer
  const intLevel = Math.floor(level);
  return {
    level: intLevel,
    clamped: intLevel !== level,
  };
}

/**
 * Validate that an escalation level is within bounds.
 *
 * @param level - Escalation level to validate
 * @param maxLevel - Maximum allowed level
 * @returns Whether the level is valid
 */
export function isValidEscalationLevel(
  level: number,
  maxLevel: number = DEFAULT_SPARK_GENERATION_CONFIG.maxEscalationLevel
): boolean {
  return (
    Number.isInteger(level) &&
    level >= ESCALATION_BOUNDS.MIN &&
    level <= Math.min(maxLevel, ESCALATION_BOUNDS.MAX)
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the spark variant for an escalation level.
 *
 * Mapping:
 *   0 → 'full'
 *   1 → 'reduced'
 *   2+ → 'minimal'
 *
 * @param escalationLevel - Bounded escalation level (0-3)
 * @returns SparkVariant for this level
 */
export function getVariantForLevel(escalationLevel: number): SparkVariant {
  // Use lookup table for known levels
  const variant = ESCALATION_TO_VARIANT[escalationLevel];
  if (variant !== undefined) {
    return variant;
  }

  // Fallback for any level >= minimal threshold
  if (escalationLevel >= ESCALATION_BOUNDS.MINIMAL_THRESHOLD) {
    return 'minimal';
  }

  // Fallback for reduced threshold
  if (escalationLevel >= ESCALATION_BOUNDS.REDUCED_THRESHOLD) {
    return 'reduced';
  }

  // Default to full
  return 'full';
}

/**
 * Check if skip option should be shown at this escalation level.
 *
 * Skip is shown at maximum escalation level when enabled in config.
 *
 * @param escalationLevel - Current escalation level
 * @param config - Spark generation config
 * @returns Whether to show skip option
 */
export function shouldShowSkipOption(
  escalationLevel: number,
  config: SparkGenerationConfig = DEFAULT_SPARK_GENERATION_CONFIG
): boolean {
  return (
    config.enableSkipAtMaxEscalation &&
    escalationLevel >= config.maxEscalationLevel
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Select an activity from a step's activities list.
 *
 * Selection strategy:
 *   - For 'full' variant: Select the first activity (primary)
 *   - For 'reduced' variant: Select the shortest activity
 *   - For 'minimal' variant: Select the shortest activity
 *
 * @param activities - List of activities from a step
 * @param variant - Spark variant to select for
 * @returns Selected activity and its index, or null if no activities
 */
export function selectActivity(
  activities: readonly Activity[] | undefined,
  variant: SparkVariant
): { activity: Activity; index: number } | null {
  if (!activities || activities.length === 0) {
    return null;
  }

  // For full variant, always use the first (primary) activity
  if (variant === 'full') {
    return { activity: activities[0]!, index: 0 };
  }

  // For reduced/minimal, select the shortest activity
  let shortestIndex = 0;
  let shortestMinutes = activities[0]!.minutes;

  for (let i = 1; i < activities.length; i++) {
    const activity = activities[i]!;
    if (activity.minutes < shortestMinutes) {
      shortestMinutes = activity.minutes;
      shortestIndex = i;
    }
  }

  return { activity: activities[shortestIndex]!, index: shortestIndex };
}

/**
 * Get the primary activity from a step (first activity).
 *
 * @param activities - List of activities from a step
 * @returns Primary activity or null
 */
export function getPrimaryActivity(
  activities: readonly Activity[] | undefined
): Activity | null {
  if (!activities || activities.length === 0) {
    return null;
  }
  return activities[0]!;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME ESTIMATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estimate minutes for an activity at a given variant.
 *
 * Time calculation:
 *   - full: activity.minutes (capped at maxSparkMinutes)
 *   - reduced: max(minSparkMinutes, activity.minutes / 2)
 *   - minimal: minSparkMinutes (fixed)
 *
 * @param activity - Activity to estimate time for
 * @param variant - Spark variant
 * @param config - Spark generation config (for bounds)
 * @returns Estimated minutes (bounded)
 */
export function estimateMinutes(
  activity: Activity,
  variant: SparkVariant,
  config: SparkGenerationConfig = DEFAULT_SPARK_GENERATION_CONFIG
): number {
  const minMinutes = config.minSparkMinutes;
  const maxMinutes = config.maxSparkMinutes;

  let minutes: number;

  switch (variant) {
    case 'full':
      // Full activity time, capped at max
      minutes = Math.min(activity.minutes, maxMinutes);
      break;

    case 'reduced':
      // Half the activity time, at least min
      minutes = Math.max(
        minMinutes,
        Math.floor(activity.minutes / TIME_BOUNDS.REDUCED_DIVISOR)
      );
      break;

    case 'minimal':
      // Fixed minimal time
      minutes = TIME_BOUNDS.MINIMAL_MINUTES;
      break;

    default:
      // Fallback to minimal
      minutes = minMinutes;
  }

  // Ensure within bounds
  return Math.max(minMinutes, Math.min(minutes, maxMinutes));
}

/**
 * Estimate minutes for a step based on escalation level.
 *
 * Convenience function that combines variant selection and time estimation.
 *
 * @param activities - Step's activities
 * @param escalationLevel - Escalation level (0-3)
 * @param config - Spark generation config
 * @returns Estimated minutes or null if no activities
 */
export function estimateMinutesForStep(
  activities: readonly Activity[] | undefined,
  escalationLevel: number,
  config: SparkGenerationConfig = DEFAULT_SPARK_GENERATION_CONFIG
): number | null {
  const variant = getVariantForLevel(escalationLevel);
  const selected = selectActivity(activities, variant);

  if (!selected) {
    return null;
  }

  return estimateMinutes(selected.activity, variant, config);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION METADATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Metadata about an escalation level.
 */
export interface EscalationMetadata {
  /** The escalation level */
  readonly level: number;

  /** Corresponding spark variant */
  readonly variant: SparkVariant;

  /** Whether this is the maximum level */
  readonly isMaxLevel: boolean;

  /** Whether skip option should be shown */
  readonly showSkipOption: boolean;

  /** Descriptive label for this level */
  readonly label: string;
}

/**
 * Get metadata for an escalation level.
 *
 * @param level - Escalation level
 * @param config - Spark generation config
 * @returns Escalation metadata
 */
export function getEscalationMetadata(
  level: number,
  config: SparkGenerationConfig = DEFAULT_SPARK_GENERATION_CONFIG
): EscalationMetadata {
  const { level: clampedLevel } = clampEscalationLevel(level, config.maxEscalationLevel);
  const variant = getVariantForLevel(clampedLevel);
  const isMaxLevel = clampedLevel >= config.maxEscalationLevel;

  const labels: Record<SparkVariant, string> = {
    full: 'Complete activity',
    reduced: 'Partial activity',
    minimal: isMaxLevel ? 'Just start (skip available)' : 'Just start',
  };

  return {
    level: clampedLevel,
    variant,
    isMaxLevel,
    showSkipOption: shouldShowSkipOption(clampedLevel, config),
    label: labels[variant],
  };
}
