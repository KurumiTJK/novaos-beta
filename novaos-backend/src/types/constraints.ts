// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRAINT TYPES — Numeric Leak Prevention & Response Constraints
// Controls what numbers the model can output to prevent hallucinated data
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory } from './categories.js';

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC CONTEXT KEYS — Semantic binding for allowed numbers
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Context keys that describe the semantic meaning of a numeric value.
 * Used to bind numbers to their purpose and prevent misuse.
 */
export type NumericContextKey =
  // Price/value contexts
  | 'price'
  | 'price_usd'
  | 'price_btc'
  | 'market_cap'
  | 'volume'
  | 'open'
  | 'close'
  | 'high'
  | 'low'
  | 'previous_close'
  // Change contexts
  | 'change'
  | 'change_absolute'
  | 'change_percent'
  | 'change_1h'
  | 'change_24h'
  | 'change_7d'
  // Rate contexts
  | 'rate'
  | 'exchange_rate'
  | 'bid'
  | 'ask'
  | 'spread'
  // Weather contexts
  | 'temperature'
  | 'temperature_c'
  | 'temperature_f'
  | 'feels_like'
  | 'humidity'
  | 'wind_speed'
  | 'wind_speed_kph'
  | 'wind_speed_mph'
  | 'pressure'
  | 'uv_index'
  | 'visibility'
  // Time contexts
  | 'timestamp'
  | 'unix_timestamp'
  | 'utc_offset'
  | 'dst_offset'
  // Supply contexts
  | 'circulating_supply'
  | 'max_supply'
  | 'total_supply'
  // Generic contexts
  | 'count'
  | 'quantity'
  | 'index'
  | 'rank';

/**
 * All valid numeric context keys as a Set for runtime validation.
 */
export const VALID_NUMERIC_CONTEXT_KEYS: ReadonlySet<NumericContextKey> = new Set([
  'price', 'price_usd', 'price_btc', 'market_cap', 'volume',
  'open', 'close', 'high', 'low', 'previous_close',
  'change', 'change_absolute', 'change_percent', 'change_1h', 'change_24h', 'change_7d',
  'rate', 'exchange_rate', 'bid', 'ask', 'spread',
  'temperature', 'temperature_c', 'temperature_f', 'feels_like',
  'humidity', 'wind_speed', 'wind_speed_kph', 'wind_speed_mph',
  'pressure', 'uv_index', 'visibility',
  'timestamp', 'unix_timestamp', 'utc_offset', 'dst_offset',
  'circulating_supply', 'max_supply', 'total_supply',
  'count', 'quantity', 'index', 'rank',
]);

/**
 * Type guard for NumericContextKey.
 */
export function isNumericContextKey(value: unknown): value is NumericContextKey {
  return typeof value === 'string' && VALID_NUMERIC_CONTEXT_KEYS.has(value as NumericContextKey);
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT SYNONYMS — Maps natural language to context keys
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Maps natural language terms to their canonical NumericContextKey.
 * Used for fuzzy matching in output validation.
 * 
 * @example
 * "What's the current stock price?" → price
 * "How much did it go up?" → change, change_percent
 */
export const CONTEXT_SYNONYMS: ReadonlyMap<string, readonly NumericContextKey[]> = new Map([
  // Price synonyms
  ['price', ['price', 'price_usd']],
  ['cost', ['price', 'price_usd']],
  ['value', ['price', 'price_usd', 'market_cap']],
  ['worth', ['price', 'price_usd', 'market_cap']],
  ['trading at', ['price', 'price_usd']],
  ['quoted at', ['price', 'price_usd', 'rate']],
  ['market cap', ['market_cap']],
  ['capitalization', ['market_cap']],
  ['volume', ['volume']],
  ['traded', ['volume']],
  
  // Change synonyms
  ['change', ['change', 'change_absolute', 'change_percent']],
  ['up', ['change', 'change_absolute', 'change_percent']],
  ['down', ['change', 'change_absolute', 'change_percent']],
  ['gain', ['change', 'change_absolute', 'change_percent']],
  ['loss', ['change', 'change_absolute', 'change_percent']],
  ['increased', ['change', 'change_absolute', 'change_percent']],
  ['decreased', ['change', 'change_absolute', 'change_percent']],
  ['rose', ['change', 'change_absolute', 'change_percent']],
  ['fell', ['change', 'change_absolute', 'change_percent']],
  ['percent', ['change_percent']],
  ['%', ['change_percent']],
  
  // Rate synonyms
  ['rate', ['rate', 'exchange_rate']],
  ['exchange rate', ['rate', 'exchange_rate']],
  ['conversion', ['rate', 'exchange_rate']],
  ['bid', ['bid']],
  ['ask', ['ask']],
  ['spread', ['spread']],
  
  // Weather synonyms
  ['temperature', ['temperature', 'temperature_c', 'temperature_f']],
  ['temp', ['temperature', 'temperature_c', 'temperature_f']],
  ['degrees', ['temperature', 'temperature_c', 'temperature_f']],
  ['celsius', ['temperature_c']],
  ['fahrenheit', ['temperature_f']],
  ['feels like', ['feels_like']],
  ['humidity', ['humidity']],
  ['wind', ['wind_speed', 'wind_speed_kph', 'wind_speed_mph']],
  ['wind speed', ['wind_speed', 'wind_speed_kph', 'wind_speed_mph']],
  ['pressure', ['pressure']],
  ['uv', ['uv_index']],
  ['uv index', ['uv_index']],
  ['visibility', ['visibility']],
  
  // Time synonyms
  ['time', ['timestamp', 'unix_timestamp']],
  ['timestamp', ['timestamp', 'unix_timestamp']],
  ['offset', ['utc_offset', 'dst_offset']],
]);

/**
 * Get canonical context keys for a natural language term.
 */
export function getContextKeysForTerm(term: string): readonly NumericContextKey[] {
  const normalized = term.toLowerCase().trim();
  return CONTEXT_SYNONYMS.get(normalized) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC TOKEN — Bound numeric value with provenance
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A numeric value bound to its semantic context and source.
 * The model can ONLY output numbers that exist as NumericTokens.
 * 
 * @example
 * {
 *   value: 150.25,
 *   contextKey: 'price',
 *   sourceCategory: 'market',
 *   sourceEntity: 'AAPL',
 *   fetchedAt: 1703001234567,
 *   formatted: '$150.25'
 * }
 */
export interface NumericToken {
  /** The raw numeric value */
  readonly value: number;
  
  /** Semantic context describing what this number represents */
  readonly contextKey: NumericContextKey;
  
  /** The data category this number came from */
  readonly sourceCategory: LiveCategory;
  
  /** The entity this number is associated with (ticker, city, etc.) */
  readonly sourceEntity: string;
  
  /** When this value was fetched from the provider */
  readonly fetchedAt: number;
  
  /** Pre-formatted string representation (e.g., "$150.25", "72°F") */
  readonly formatted?: string;
  
  /** Unit of measurement if applicable */
  readonly unit?: string;
  
  /** Precision (decimal places) for this value */
  readonly precision?: number;
}

/**
 * Collection of allowed numeric tokens for a response.
 */
export interface NumericTokenSet {
  /** All allowed tokens indexed by a unique key */
  readonly tokens: ReadonlyMap<string, NumericToken>;
  
  /** Quick lookup: value → token(s) that have this value */
  readonly byValue: ReadonlyMap<number, readonly NumericToken[]>;
  
  /** Quick lookup: contextKey → token(s) with this context */
  readonly byContext: ReadonlyMap<NumericContextKey, readonly NumericToken[]>;
}

/**
 * Create a unique key for a NumericToken.
 */
export function createTokenKey(token: NumericToken): string {
  return `${token.sourceCategory}:${token.sourceEntity}:${token.contextKey}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC EXEMPTIONS — Numbers allowed without tokens
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Categories of numbers that don't require token validation.
 */
export interface NumericExemptions {
  /** Allow years (1900-2100) */
  readonly allowYears: boolean;
  
  /** Allow dates (day of month 1-31) */
  readonly allowDates: boolean;
  
  /** Allow small integers for counting (0-10 or custom range) */
  readonly allowSmallIntegers: boolean;
  readonly smallIntegerMax: number;
  
  /** Allow percentages in explanatory context (not live data) */
  readonly allowExplanatoryPercentages: boolean;
  
  /** Allow ordinals (1st, 2nd, 3rd, etc.) */
  readonly allowOrdinals: boolean;
  
  /** Allow numbers in code blocks */
  readonly allowInCodeBlocks: boolean;
  
  /** Allow numbers in quoted user text */
  readonly allowInQuotes: boolean;
  
  /** Custom exemption patterns (regex strings) */
  readonly customPatterns: readonly string[];
}

/**
 * Default exemptions for most responses.
 * Permissive for non-financial contexts.
 */
export const DEFAULT_EXEMPTIONS: NumericExemptions = {
  allowYears: true,
  allowDates: true,
  allowSmallIntegers: true,
  smallIntegerMax: 10,
  allowExplanatoryPercentages: false, // Still strict on percentages
  allowOrdinals: true,
  allowInCodeBlocks: true,
  allowInQuotes: true,
  customPatterns: [],
} as const;

/**
 * Strict exemptions for financial/market responses.
 * Only allows numbers that are explicitly tokenized.
 */
export const STRICT_EXEMPTIONS: NumericExemptions = {
  allowYears: true,
  allowDates: true,
  allowSmallIntegers: true,
  smallIntegerMax: 5,
  allowExplanatoryPercentages: false,
  allowOrdinals: true,
  allowInCodeBlocks: true,
  allowInQuotes: true,
  customPatterns: [],
} as const;

/**
 * No exemptions - every number must be tokenized.
 * Used for maximum safety in critical contexts.
 */
export const NO_EXEMPTIONS: NumericExemptions = {
  allowYears: false,
  allowDates: false,
  allowSmallIntegers: false,
  smallIntegerMax: 0,
  allowExplanatoryPercentages: false,
  allowOrdinals: false,
  allowInCodeBlocks: false,
  allowInQuotes: false,
  customPatterns: [],
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE CONSTRAINTS — Full constraint specification
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Constraint level for response generation.
 */
export type ConstraintLevel = 'strict' | 'standard' | 'permissive';

/**
 * Complete response constraints for the Model gate.
 * Controls what the model can and cannot output.
 */
export interface ResponseConstraints {
  // ─────────────────────────────────────────────────────────────────────────────
  // Numeric constraints
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Whether precise numeric output is allowed at all */
  readonly numericPrecisionAllowed: boolean;
  
  /** Allowed numeric tokens (if numericPrecisionAllowed is true) */
  readonly allowedTokens: NumericTokenSet | null;
  
  /** Exemptions from token validation */
  readonly numericExemptions: NumericExemptions;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Content constraints
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Whether action recommendations are allowed (buy/sell/do X) */
  readonly actionRecommendationsAllowed: boolean;
  
  /** Phrases that must not appear in output */
  readonly bannedPhrases: readonly string[];
  
  /** Phrases that must appear in output */
  readonly requiredPhrases: readonly string[];
  
  /** Text to prepend to response */
  readonly mustPrepend?: string;
  
  /** Text to append to response */
  readonly mustAppend?: string;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Style constraints
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Required tone for response */
  readonly tone?: 'neutral' | 'cautious' | 'confident' | 'empathetic';
  
  /** Maximum uses of "we" (Nova voice constraint) */
  readonly maxWeCount?: number;
  
  /** Maximum response length in tokens */
  readonly maxTokens?: number;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Source constraints
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Sources that must be cited */
  readonly requiredCitations: readonly string[];
  
  /** Whether freshness warning is required */
  readonly freshnessWarningRequired: boolean;
  
  /** Custom freshness warning text */
  readonly freshnessWarningText?: string;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Constraint level for logging/debugging */
  readonly level: ConstraintLevel;
  
  /** Reason constraints were applied */
  readonly reason: string;
  
  /** Categories that triggered these constraints */
  readonly triggeredByCategories: readonly LiveCategory[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTRAINT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create default (permissive) constraints.
 */
export function createDefaultConstraints(reason: string): ResponseConstraints {
  return {
    numericPrecisionAllowed: true,
    allowedTokens: null, // No token validation
    numericExemptions: DEFAULT_EXEMPTIONS,
    actionRecommendationsAllowed: true,
    bannedPhrases: [],
    requiredPhrases: [],
    freshnessWarningRequired: false,
    requiredCitations: [],
    level: 'permissive',
    reason,
    triggeredByCategories: [],
  };
}

/**
 * Create strict constraints for live data responses.
 */
export function createStrictConstraints(
  tokens: NumericTokenSet,
  categories: readonly LiveCategory[],
  reason: string
): ResponseConstraints {
  return {
    numericPrecisionAllowed: true,
    allowedTokens: tokens,
    numericExemptions: STRICT_EXEMPTIONS,
    actionRecommendationsAllowed: false,
    bannedPhrases: [],
    requiredPhrases: [],
    freshnessWarningRequired: true,
    requiredCitations: [],
    level: 'strict',
    reason,
    triggeredByCategories: categories,
  };
}

/**
 * Create degraded constraints when verification failed.
 */
export function createDegradedConstraints(reason: string): ResponseConstraints {
  return {
    numericPrecisionAllowed: false,
    allowedTokens: null,
    numericExemptions: NO_EXEMPTIONS,
    actionRecommendationsAllowed: false,
    bannedPhrases: [],
    requiredPhrases: [],
    freshnessWarningRequired: true,
    freshnessWarningText: 'Unable to verify current data. Information may be outdated.',
    requiredCitations: [],
    level: 'strict',
    reason,
    triggeredByCategories: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a number is exempt from token validation.
 */
export function isExemptNumber(
  value: number,
  context: string,
  exemptions: NumericExemptions
): boolean {
  // Year check (1900-2100)
  if (exemptions.allowYears && Number.isInteger(value) && value >= 1900 && value <= 2100) {
    return true;
  }
  
  // Date check (1-31)
  if (exemptions.allowDates && Number.isInteger(value) && value >= 1 && value <= 31) {
    return true;
  }
  
  // Small integer check
  if (exemptions.allowSmallIntegers && Number.isInteger(value) && value >= 0 && value <= exemptions.smallIntegerMax) {
    return true;
  }
  
  // Code block check
  if (exemptions.allowInCodeBlocks && /```[\s\S]*```|`[^`]+`/.test(context)) {
    return true;
  }
  
  // Quote check
  if (exemptions.allowInQuotes && /"[^"]*"|'[^']*'/.test(context)) {
    return true;
  }
  
  // Custom patterns
  for (const pattern of exemptions.customPatterns) {
    if (new RegExp(pattern).test(context)) {
      return true;
    }
  }
  
  return false;
}
