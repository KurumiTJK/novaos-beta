// ═══════════════════════════════════════════════════════════════════════════════
// CURRICULUM MODULE — LLM-Based Curriculum Generation
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Secure curriculum generation from verified resources:
//   - Prompt injection protection
//   - Token limit enforcement
//   - Circuit breaker for availability
//   - Output validation
//   - Hallucination detection
//   - Fallback patterns
//
// INVARIANT: LLM only organizes verified resources, never fabricates them.
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Constants
  CURRICULUM_CONSTRAINTS,
  
  // Difficulty
  type DifficultyLevel,
  type DifficultyProgression,
  
  // Resource assignment
  type ResourceAssignment,
  type ResolvedResourceAssignment,
  
  // Learning objectives
  type LearningObjective,
  
  // Exercises
  type ExerciseType,
  type Exercise,
  
  // Curriculum day
  type CurriculumDay,
  type ResolvedCurriculumDay,
  
  // Structured curriculum
  type CurriculumMetadata,
  type StructuredCurriculum,
  type ResolvedCurriculum,
  
  // Raw LLM output
  type RawResourceAssignment,
  type RawExercise,
  type RawCurriculumDay,
  type RawCurriculumOutput,
  
  // Validation
  type ValidationSeverity,
  type ValidationIssue,
  type CurriculumValidationResult,
  
  // Generation
  type CurriculumGenerationRequest,
  type CurriculumGenerationResult,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Zod schemas
  DifficultyLevelSchema,
  DifficultyProgressionSchema,
  ResourceAssignmentSchema,
  LearningObjectiveSchema,
  ExerciseTypeSchema,
  ExerciseSchema,
  CurriculumDaySchema,
  CurriculumMetadataSchema,
  RawCurriculumOutputSchema,
  
  // Dynamic schema
  createCurriculumSchema,
  
  // Validation helpers
  validateResourceIndices,
  validateDaySequence,
  validateMinutesSum,
  parseRawCurriculumOutput,
  validateCurriculum,
  
  // Utilities
  isAsciiPrintable,
} from './schemas.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM LAYER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type LLMPurpose,
  type SecureLLMRequest,
  type SecureLLMResponse,
  type LLMError,
  type LLMErrorCode,
  type LLMAudit,
  type SecureLLMConfig,
  
  // Sanitization
  sanitizeText,
  sanitizeResourceText,
  sanitizePromptInput,
  sanitizeResourceContext,
  type SanitizationResult,
  type SuspiciousPattern,
  
  // Token counting
  estimateTokens,
  validateTokenLimits,
  truncateToTokenLimit,
  TimeoutError,
  
  // Client
  SecureLLMClient,
  getSecureLLMClient,
  initSecureLLMClient,
  initSecureLLMClientFromManager,
  resetSecureLLMClient,
  createLLMRequest,
  createMockProvider,
} from './llm/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STRUCTURER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Main function
  generateCurriculum,
  
  // Configuration
  type CurriculumStructurerConfig,
  
  // Internals (for testing)
  CURRICULUM_SYSTEM_PROMPT,
  buildUserPrompt,
  extractJson,
  parseResponse,
  buildCurriculum,
  resolveCurriculum,
} from './structurer.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────────

export {
  validateCurriculumOutput,
  validateSchema,
  validateStructure,
  validateContent,
} from './validator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HALLUCINATION DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Main detector
  detectHallucinations,
  hasCriticalHallucinations,
  hasAnyUrls,
  
  // Types
  type HallucinationType,
  type HallucinationSeverity,
  type Hallucination,
  type HallucinationDetectionResult,
  
  // Internals (for testing)
  extractUrls,
  normalizeUrl,
  detectFabricatedIndices,
  detectFabricatedUrls,
  detectSuspiciousReferences,
} from './hallucination-detector.js';

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Patterns
  EXERCISE_TEMPLATES,
  OBJECTIVE_TEMPLATES,
  DAY_STRUCTURE_TEMPLATES,
  SELF_GUIDED_NOTES,
  
  // Selection
  selectExercises,
  selectObjectives,
  selectDayStructure,
  generateSelfGuidedNotes,
  
  // Versioning
  PATTERNS_VERSION,
  PATTERN_METADATA,
  type FallbackReason,
  type FallbackUsageRecord,
  createFallbackUsageRecord,
} from './fallback/index.js';
