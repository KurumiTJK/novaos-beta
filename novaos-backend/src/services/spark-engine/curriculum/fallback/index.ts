// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK MODULE — Pre-Written Curriculum Patterns
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type ExerciseTemplate,
  type ObjectiveTemplate,
  type DayStructureTemplate,
  
  // Template collections
  EXERCISE_TEMPLATES,
  OBJECTIVE_TEMPLATES,
  DAY_STRUCTURE_TEMPLATES,
  
  // Selection functions
  selectExercises,
  selectObjectives,
  selectDayStructure,
  
  // Self-guided patterns
  SELF_GUIDED_NOTES,
  generateSelfGuidedNotes,
  
  // Utilities
  applyTemplate,
} from './patterns.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VERSIONING
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Version info
  PATTERNS_VERSION,
  PATTERN_METADATA,
  VERSION_HISTORY,
  
  // Types
  type PatternSetMetadata,
  type VersionHistoryEntry,
  type FallbackReason,
  type FallbackUsageRecord,
  
  // Version utilities
  parseVersion,
  compareVersions,
  isCompatible,
  needsUpdate,
  
  // Cache utilities
  generateCacheKey,
  isCacheKeyCurrent,
  
  // Usage tracking
  createFallbackUsageRecord,
} from './versioning.js';
