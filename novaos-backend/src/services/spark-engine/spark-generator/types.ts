// ═══════════════════════════════════════════════════════════════════════════════
// SPARK GENERATOR TYPES — Configuration & Escalation Types
// NovaOS Spark Engine — Phase 10: Spark Generation
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module defines types for the SparkGenerator:
//   - SparkGenerationConfig: Configuration for spark generation
//   - EscalationBounds: Bounds for escalation levels
//   - ActionTemplates: Templates for generating action text
//   - SparkGenerationResult: Result of spark generation with diagnostics
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { SparkVariant, ActivityType } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION BOUNDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Escalation level bounds.
 *
 * Level 0: Full action (complete activity)
 * Level 1: Reduced action (partial activity)
 * Level 2: Minimal action (just start)
 * Level 3: Minimal + skip option
 */
export const ESCALATION_BOUNDS = {
  /** Minimum escalation level */
  MIN: 0,

  /** Maximum escalation level (from config default) */
  MAX: 3,

  /** Level at which variant becomes 'reduced' */
  REDUCED_THRESHOLD: 1,

  /** Level at which variant becomes 'minimal' */
  MINIMAL_THRESHOLD: 2,
} as const;

/**
 * Mapping from escalation level to spark variant.
 */
export const ESCALATION_TO_VARIANT: Record<number, SparkVariant> = {
  0: 'full',
  1: 'reduced',
  2: 'minimal',
  3: 'minimal',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TIME ESTIMATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Time estimation bounds for sparks.
 */
export const TIME_BOUNDS = {
  /** Minimum minutes for any spark */
  MIN_MINUTES: 5,

  /** Default maximum minutes (can be overridden by config) */
  DEFAULT_MAX_MINUTES: 30,

  /** Divisor for reduced variant time */
  REDUCED_DIVISOR: 2,

  /** Fixed minutes for minimal variant */
  MINIMAL_MINUTES: 5,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Action verb templates by activity type.
 */
export const ACTION_VERBS: Record<ActivityType, ActionVerbSet> = {
  read: {
    full: 'Read',
    reduced: 'Skim',
    minimal: 'Open',
  },
  watch: {
    full: 'Watch',
    reduced: 'Watch the first part of',
    minimal: 'Start',
  },
  code: {
    full: 'Complete',
    reduced: 'Start',
    minimal: 'Open',
  },
  exercise: {
    full: 'Complete',
    reduced: 'Try the first problem in',
    minimal: 'Look at',
  },
  quiz: {
    full: 'Complete',
    reduced: 'Answer the first question in',
    minimal: 'Open',
  },
  project: {
    full: 'Work on',
    reduced: 'Spend 10 minutes on',
    minimal: 'Open the files for',
  },
};

/**
 * Verb set for different escalation levels.
 */
export interface ActionVerbSet {
  /** Verb for full action */
  readonly full: string;

  /** Verb for reduced action */
  readonly reduced: string;

  /** Verb for minimal action */
  readonly minimal: string;
}

/**
 * Generated action with metadata.
 */
export interface GeneratedAction {
  /** The action text (imperative, actionable) */
  readonly text: string;

  /** The spark variant this action represents */
  readonly variant: SparkVariant;

  /** Estimated minutes for this action */
  readonly estimatedMinutes: number;

  /** Whether skip option should be shown */
  readonly showSkipOption: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for SparkGenerator.
 */
export interface SparkGenerationConfig {
  /** Maximum escalation level (default: 3) */
  readonly maxEscalationLevel: number;

  /** Minimum spark minutes (default: 5) */
  readonly minSparkMinutes: number;

  /** Maximum spark minutes (default: 30) */
  readonly maxSparkMinutes: number;

  /** Whether to include resource URLs in action text */
  readonly includeResourceUrls: boolean;

  /** Whether to enable skip option at max escalation */
  readonly enableSkipAtMaxEscalation: boolean;
}

/**
 * Default SparkGenerator configuration.
 */
export const DEFAULT_SPARK_GENERATION_CONFIG: SparkGenerationConfig = {
  maxEscalationLevel: ESCALATION_BOUNDS.MAX,
  minSparkMinutes: TIME_BOUNDS.MIN_MINUTES,
  maxSparkMinutes: TIME_BOUNDS.DEFAULT_MAX_MINUTES,
  includeResourceUrls: true,
  enableSkipAtMaxEscalation: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATION RESULT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Diagnostics from spark generation.
 */
export interface SparkGenerationDiagnostics {
  /** Original escalation level requested */
  readonly requestedEscalationLevel: number;

  /** Actual escalation level used (after bounding) */
  readonly actualEscalationLevel: number;

  /** Whether escalation was clamped */
  readonly escalationClamped: boolean;

  /** Activity index selected from step */
  readonly activityIndex: number;

  /** Whether a resource was available */
  readonly hasResource: boolean;

  /** Whether URL was sanitized */
  readonly urlSanitized: boolean;

  /** Original URL (if sanitized) */
  readonly originalUrl?: string;

  /** Generation timestamp */
  readonly generatedAt: string;
}

/**
 * Result of spark generation with diagnostics.
 */
export interface SparkGenerationResult {
  /** Generated action */
  readonly action: GeneratedAction;

  /** Diagnostics for debugging/telemetry */
  readonly diagnostics: SparkGenerationDiagnostics;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error codes for spark generation failures.
 */
export const SparkGenerationErrorCode = {
  /** Step has no activities */
  NO_ACTIVITIES: 'SPARK_NO_ACTIVITIES',

  /** Step has no resources */
  NO_RESOURCES: 'SPARK_NO_RESOURCES',

  /** Invalid escalation level */
  INVALID_ESCALATION: 'SPARK_INVALID_ESCALATION',

  /** Resource URL failed sanitization */
  URL_SANITIZATION_FAILED: 'SPARK_URL_SANITIZATION_FAILED',

  /** Activity references missing resource */
  MISSING_RESOURCE: 'SPARK_MISSING_RESOURCE',
} as const;

export type SparkGenerationErrorCode =
  typeof SparkGenerationErrorCode[keyof typeof SparkGenerationErrorCode];

// ═══════════════════════════════════════════════════════════════════════════════
// URL SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Allowed URL schemes for display.
 */
export const ALLOWED_URL_SCHEMES = ['http:', 'https:'] as const;

/**
 * Blocked URL schemes (XSS prevention).
 */
export const BLOCKED_URL_SCHEMES = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:',
  'blob:',
] as const;

/**
 * Result of URL sanitization.
 */
export interface UrlSanitizationResult {
  /** Whether the URL is safe */
  readonly safe: boolean;

  /** Sanitized URL (if safe) */
  readonly sanitizedUrl?: string;

  /** Reason for rejection (if unsafe) */
  readonly rejectionReason?: string;

  /** Original URL */
  readonly originalUrl: string;
}
