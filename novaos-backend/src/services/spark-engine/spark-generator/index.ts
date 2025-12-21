// ═══════════════════════════════════════════════════════════════════════════════
// SPARK GENERATOR MODULE — Public API Exports
// NovaOS Spark Engine — Phase 10: Spark Generation
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module exports the SparkGenerator public API:
//   - SparkGenerator class (implements ISparkGenerator)
//   - Configuration types and defaults
//   - Escalation utilities
//   - URL sanitization utilities
//
// Usage:
//   import {
//     SparkGenerator,
//     createSparkGenerator,
//     sanitizeDisplayUrl,
//   } from './spark-generator';
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN CLASS & FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

export {
  SparkGenerator,
  createSparkGenerator,
  createSparkGeneratorFromLimits,
  generateSparkForStep,
  generateSparkVariants,
} from './generator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  SparkGenerationConfig,
  SparkGenerationDiagnostics,
  SparkGenerationResult,
  GeneratedAction,
  ActionVerbSet,
  UrlSanitizationResult,
} from './types.js';

export {
  // Constants
  ESCALATION_BOUNDS,
  ESCALATION_TO_VARIANT,
  TIME_BOUNDS,
  ACTION_VERBS,
  ALLOWED_URL_SCHEMES,
  BLOCKED_URL_SCHEMES,
  
  // Defaults
  DEFAULT_SPARK_GENERATION_CONFIG,
  
  // Error codes
  SparkGenerationErrorCode,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ESCALATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Level management
  clampEscalationLevel,
  isValidEscalationLevel,
  
  // Variant selection
  getVariantForLevel,
  shouldShowSkipOption,
  
  // Activity selection
  selectActivity,
  getPrimaryActivity,
  
  // Time estimation
  estimateMinutes,
  estimateMinutesForStep,
  
  // Metadata
  getEscalationMetadata,
  type EscalationMetadata,
} from './escalation.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ACTION GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Individual generators
  generateFullAction,
  generateReducedAction,
  generateMinimalAction,
  
  // Unified generators
  generateActionText,
  generateAction,
  generateActionWithTime,
  
  // Fallback generators
  generateFallbackAction,
  generateFallbackActionWithMetadata,
  
  // Utilities
  appendUrlToAction,
  formatTimeEstimate,
} from './action-generator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// URL SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Core sanitization
  sanitizeUrl,
  sanitizeDisplayUrl,
  sanitizeUrlStrict,
  
  // Validation
  isAllowedScheme,
  isBlockedScheme,
  extractScheme,
  isValidUrlStructure,
  hasSuspiciousEncoding,
  
  // Formatting
  formatDisplayUrl,
  sanitizeAndFormatUrl,
  
  // Batch operations
  sanitizeUrls,
  filterSafeUrls,
} from './url-sanitizer.js';
