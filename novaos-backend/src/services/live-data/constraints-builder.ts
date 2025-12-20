// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRAINTS BUILDER — Build ResponseConstraints from Semantics
// PATCHED STUB: Provides exports needed by index.ts
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory } from '../../types/categories.js';
import type {
  ResponseConstraints,
  NumericToken,
  NumericTokenSet,
  NumericExemptions,
} from '../../types/constraints.js';
import type { ProviderOkResult } from '../../types/provider-results.js';
import type { FailureSemantics, ConstraintLevel } from './failure-semantics.js';

import {
  createDefaultConstraints,
  createStrictConstraints,
  createDegradedConstraints,
  createQualitativeConstraints,
  createInsufficientConstraints,
  createEmptyExemptions,
  createEmptyTokenSet,
  DEFAULT_ALWAYS_EXEMPT,
} from '../../types/constraints.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for building constraints.
 */
export interface ConstraintBuildOptions {
  /** Whether to include stale data warnings */
  readonly includeStaleWarnings?: boolean;
  
  /** Custom banned phrases */
  readonly customBannedPhrases?: readonly string[];
  
  /** Custom must-include phrases */
  readonly customMustInclude?: readonly string[];
  
  /** Override constraint level */
  readonly overrideLevel?: ConstraintLevel;
}

/**
 * Result of building constraints.
 */
export interface ConstraintBuildResult {
  /** Built constraints */
  readonly constraints: ResponseConstraints;
  
  /** Token set if applicable */
  readonly tokenSet: NumericTokenSet | null;
  
  /** Warnings generated */
  readonly warnings: readonly string[];
  
  /** Whether constraints are complete */
  readonly complete: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXEMPTION PRESETS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Exemptions for quote_evidence_only mode.
 * Allow dates, years, ordinals, and rankings.
 */
export const QUOTE_EVIDENCE_EXEMPTIONS: NumericExemptions = {
  alwaysExempt: DEFAULT_ALWAYS_EXEMPT,
  contextExemptions: new Map(),
};

/**
 * Exemptions for forbid_numeric_claims mode.
 * Very restrictive - only basic dates/years.
 */
export const FORBID_NUMERIC_EXEMPTIONS: NumericExemptions = {
  alwaysExempt: [
    /^\d{4}$/,                    // Years only
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // Dates
  ],
  contextExemptions: new Map(),
};

/**
 * Exemptions for qualitative_only mode.
 * Even more restrictive.
 */
export const QUALITATIVE_EXEMPTIONS: NumericExemptions = {
  alwaysExempt: [
    /^\d{4}$/,  // Years only
  ],
  contextExemptions: new Map(),
};

/**
 * No exemptions at all.
 */
export const NO_EXEMPTIONS: NumericExemptions = {
  alwaysExempt: [],
  contextExemptions: new Map(),
};

/**
 * Permissive exemptions (allow all).
 */
export const PERMISSIVE_EXEMPTIONS: NumericExemptions = {
  alwaysExempt: [/.*/],
  contextExemptions: new Map(),
};

// ─────────────────────────────────────────────────────────────────────────────────
// BANNED PHRASES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Universal banned phrases for all modes.
 */
export const UNIVERSAL_BANNED_PHRASES: readonly string[] = [
  "I'm always here for you",
  "I'm so proud of you",
  "You should definitely",
  "Trust me",
  "I promise",
  "I guarantee",
  "Without a doubt",
  "100% certain",
];

// ─────────────────────────────────────────────────────────────────────────────────
// BUILD FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Build constraints from failure semantics and provider result.
 */
export function buildConstraints(
  semantics: FailureSemantics,
  providerResult: ProviderOkResult | null,
  category: LiveCategory,
  options: ConstraintBuildOptions = {}
): ConstraintBuildResult {
  const warnings: string[] = [];
  let tokenSet: NumericTokenSet | null = null;
  
  // Determine level (allow override)
  const level = options.overrideLevel ?? semantics.constraintLevel;
  
  // Build constraints based on level
  let constraints: ResponseConstraints;
  
  switch (level) {
    case 'quote_evidence_only':
      tokenSet = providerResult ? extractTokenSet(providerResult) : createEmptyTokenSet();
      constraints = createStrictConstraints(tokenSet, [category], semantics.reason);
      break;
      
    case 'forbid_numeric_claims':
      constraints = createDegradedConstraints(semantics.reason);
      break;
      
    case 'qualitative_only':
      constraints = createQualitativeConstraints(semantics.reason);
      break;
      
    case 'insufficient':
      constraints = createInsufficientConstraints(semantics.reason);
      break;
      
    case 'permissive':
    default:
      constraints = createDefaultConstraints(semantics.reason);
      break;
  }
  
  // Add custom banned phrases
  if (options.customBannedPhrases?.length) {
    constraints = {
      ...constraints,
      bannedPhrases: [...(constraints.bannedPhrases ?? []), ...options.customBannedPhrases],
    };
  }
  
  // Add must-include phrases
  if (options.customMustInclude?.length) {
    constraints = {
      ...constraints,
      mustInclude: [...(constraints.mustInclude ?? []), ...options.customMustInclude],
    };
  }
  
  // Add warnings for stale data
  if (options.includeStaleWarnings && semantics.systemMessage) {
    warnings.push(semantics.systemMessage);
  }
  
  return {
    constraints,
    tokenSet,
    warnings,
    complete: level !== 'insufficient',
  };
}

/**
 * Build constraints for insufficient data.
 */
export function buildInsufficientConstraints(
  reason: string,
  category?: LiveCategory
): ConstraintBuildResult {
  return {
    constraints: createInsufficientConstraints(reason),
    tokenSet: null,
    warnings: [reason],
    complete: false,
  };
}

/**
 * Build constraints for qualitative-only mode.
 */
export function buildQualitativeConstraints(
  reason: string,
  category?: LiveCategory
): ConstraintBuildResult {
  return {
    constraints: createQualitativeConstraints(reason),
    tokenSet: null,
    warnings: [],
    complete: true,
  };
}

/**
 * Build constraints for forbid-numeric mode.
 */
export function buildForbidNumericConstraints(
  reason: string,
  category?: LiveCategory
): ConstraintBuildResult {
  return {
    constraints: createDegradedConstraints(reason),
    tokenSet: null,
    warnings: [],
    complete: true,
  };
}

/**
 * Build constraints for live data with token allowlist.
 */
export function buildLiveDataConstraints(
  tokenSet: NumericTokenSet,
  categories: readonly LiveCategory[],
  reason: string
): ConstraintBuildResult {
  return {
    constraints: createStrictConstraints(tokenSet, categories, reason),
    tokenSet,
    warnings: [],
    complete: true,
  };
}

/**
 * Build permissive constraints.
 */
export function buildPermissiveConstraints(
  reason: string = 'Permissive mode'
): ConstraintBuildResult {
  return {
    constraints: createDefaultConstraints(reason),
    tokenSet: null,
    warnings: [],
    complete: true,
  };
}

/**
 * Build constraints from multiple provider results.
 */
export function buildMultiProviderConstraints(
  results: ReadonlyMap<LiveCategory, ProviderOkResult>,
  reason: string
): ConstraintBuildResult {
  const allTokens: NumericToken[] = [];
  const categories: LiveCategory[] = [];
  
  for (const [category, result] of results) {
    categories.push(category);
    const tokens = extractTokensFromResult(result);
    allTokens.push(...tokens);
  }
  
  const tokenSet = buildTokenSetFromTokens(allTokens);
  
  return {
    constraints: createStrictConstraints(tokenSet, categories, reason),
    tokenSet,
    warnings: [],
    complete: true,
  };
}

/**
 * Validate constraints.
 */
export function validateConstraints(constraints: ResponseConstraints): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check for required fields
  if (!constraints.level) {
    errors.push('Missing constraint level');
  }
  
  if (!constraints.reason) {
    errors.push('Missing reason');
  }
  
  // If quote_evidence_only, should have token set
  if (constraints.level === 'quote_evidence_only' && !constraints.allowedTokens) {
    errors.push('quote_evidence_only requires allowedTokens');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract token set from provider result.
 */
function extractTokenSet(result: ProviderOkResult): NumericTokenSet {
  // Placeholder - actual implementation would extract tokens from result.data
  return createEmptyTokenSet();
}

/**
 * Extract tokens from provider result.
 */
function extractTokensFromResult(result: ProviderOkResult): NumericToken[] {
  // Placeholder - actual implementation would extract tokens
  return [];
}

/**
 * Build token set from array of tokens.
 */
function buildTokenSetFromTokens(tokens: NumericToken[]): NumericTokenSet {
  const tokenMap = new Map<string, NumericToken>();
  const byValue = new Map<number, NumericToken[]>();
  const byContext = new Map<string, NumericToken[]>();
  
  for (const token of tokens) {
    const key = `${token.sourceCategory}:${token.sourceEntity}:${token.contextKey}`;
    tokenMap.set(key, token);
    
    const valueList = byValue.get(token.value) ?? [];
    valueList.push(token);
    byValue.set(token.value, valueList);
    
    const contextList = byContext.get(token.contextKey) ?? [];
    contextList.push(token);
    byContext.set(token.contextKey, contextList);
  }
  
  return {
    tokens: tokenMap,
    byValue,
    byContext: byContext as Map<any, NumericToken[]>,
  };
}
