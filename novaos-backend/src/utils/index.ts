// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES INDEX — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CANONICALIZATION — Numeric String Normalization
// ─────────────────────────────────────────────────────────────────────────────────

export {
  canonicalizeNumeric,
  extractNumericValue,
  isNumericString,
  numericEquals,
  numericApproxEquals,
  generateCanonicalVariants,
  formatNumeric,
  extractAllNumbers,
  type VariantOptions,
} from './canonicalize.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REGEX — Safe Regular Expression Handling
// ─────────────────────────────────────────────────────────────────────────────────

export {
  freshRegex,
  resetRegex,
  safeTest,
  safeTestImmutable,
  safeMatchAll,
  safeMatchStrings,
  safeExec,
  safeExecImmutable,
  safeReplace,
  safeReplaceAll,
  safeSplit,
  escapeRegex,
  createAlternation,
  createWordBoundary,
  isValidRegex,
  tryCreateRegex,
  getMatchesWithPositions,
  hasOverlappingMatch,
  type MatchInfo,
} from './regex.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REDACTION — Sensitive Data Protection
// ─────────────────────────────────────────────────────────────────────────────────

export {
  redact,
  redactWithPatterns,
  redactObject,
  truncateForLog,
  safeLogValue,
  redactHeaders,
  redactError,
  redactUrl,
  containsSensitiveData,
  getRedactionPatternNames,
} from './redaction.js';
