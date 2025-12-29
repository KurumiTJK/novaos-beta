// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21: SCIENCE-BASED LEARNING SYSTEM — Main Exports
// NovaOS — Deliberate Practice Engine Enhancement
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Learning Domains
  type LearningDomain,
  LEARNING_DOMAINS,
  type DomainProfile,
  DOMAIN_PROFILES,
  type ResourceType,
  
  // Drill Day Types
  type DrillDayType,
  DRILL_DAY_TYPES,
  type ResourcePolicy,
  type DayTypeConfig,
  DAY_TYPE_CONFIGS,
  getDayType,
  getDayNumber,
  
  // Given Material
  type GivenMaterialType,
  
  // Enhanced Fields
  type EnhancedDrillFields,
  type EnhancedWeekPlanFields,
  type FetchedResource,
  
  // Validation Constants
  DONE_BANNED_WORDS,
  UNSTUCK_BANNED_PHRASES,
  STUCK_BANNED_PHRASES,
  
  // Type Guards
  isLearningDomain,
  isDrillDayType,
} from './types/enhanced-types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DOMAIN DETECTOR
// ─────────────────────────────────────────────────────────────────────────────────

export {
  DomainDetector,
  createDomainDetector,
  detectDomainSync,
  type DomainDetectorConfig,
  type DomainDetectionResult,
} from './types/domain-detector.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  validateDrill,
  validateWeek,
  formatValidationResult,
  type ValidationSeverity,
  type ValidationIssue,
  type DrillValidationResult,
  type WeekValidationResult,
} from './validators/drill-validator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Prime Linker
  linkPrimes,
  linkWeekPrimes,
  getLastDrillOfWeek,
  extractPrimeFromDrill,
  type DrillContent,
  type WeekContent,
  type LinkedDrillContent,
  type PrimePair,
} from './generators/prime-linker.js';

export {
  // Quality Generator
  QualityGenerator,
  createQualityGenerator,
  type QualityGeneratorConfig,
  type GenerationContext,
  type GeneratedWeek,
  type GeneratedLessonPlan,
} from './generators/quality-generator.js';
