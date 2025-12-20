// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRAINTS — Response Constraints and Numeric Tokens (CORRECTED)
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory } from './categories.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTRAINT LEVEL
// ─────────────────────────────────────────────────────────────────────────────────

export type ConstraintLevel =
  | 'permissive'
  | 'standard'
  | 'strict'
  | 'forbid';

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC CONTEXT KEY (includes ALL values used in code)
// ─────────────────────────────────────────────────────────────────────────────────

export type NumericContextKey =
  // Stock market
  | 'price'
  | 'price_usd'
  | 'price_btc'
  | 'open'
  | 'close'
  | 'high'
  | 'low'
  | 'volume'
  | 'market_cap'
  | 'pe_ratio'
  | 'eps'
  | 'dividend_yield'
  | 'bid'
  | 'ask'
  | 'spread'
  | 'previous_close'
  // Change values
  | 'change'
  | 'change_percent'
  | 'change_absolute'
  | 'change_1h'
  | 'change_24h'
  | 'change_7d'
  // Currency
  | 'rate'
  | 'exchange_rate'
  // Crypto
  | 'circulating_supply'
  | 'total_supply'
  | 'max_supply'
  // Weather
  | 'temperature'
  | 'temperature_c'
  | 'temperature_f'
  | 'feels_like'
  | 'feels_like_c'
  | 'feels_like_f'
  | 'humidity'
  | 'pressure'
  | 'wind_speed'
  | 'wind_speed_mph'
  | 'wind_speed_kph'
  | 'visibility'
  | 'uv_index'
  | 'precipitation'
  // Time
  | 'hour'
  | 'minute'
  | 'second'
  | 'timestamp'
  | 'unix_timestamp'
  | 'utc_offset'
  | 'dst_offset'
  // General
  | 'count'
  | 'total'
  | 'quantity'
  | 'average'
  | 'percentage'
  | 'index_value'
  | 'index'
  | 'position'
  | 'score'
  | 'rank';

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC TOKEN
// ─────────────────────────────────────────────────────────────────────────────────

export interface NumericToken {
  readonly value: number;
  readonly formatted: string;
  readonly contextKey: NumericContextKey;
  readonly sourceCategory: LiveCategory;
  readonly sourceEntity: string;
  readonly fetchedAt: number;
  readonly unit?: string;
  readonly precision?: number;
  readonly source?: string;
  readonly type?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC TOKEN SET
// ─────────────────────────────────────────────────────────────────────────────────

export interface NumericTokenSet {
  readonly tokens: ReadonlyMap<string, NumericToken>;
  readonly byValue: ReadonlyMap<number, readonly NumericToken[]>;
  readonly byContext: ReadonlyMap<NumericContextKey, readonly NumericToken[]>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC EXEMPTIONS (includes all values used in code)
// ─────────────────────────────────────────────────────────────────────────────────

export interface NumericExemptions {
  readonly allowedContextKeys?: readonly NumericContextKey[];
  readonly allowedCategories?: readonly LiveCategory[];
  readonly allowedPatterns?: readonly RegExp[];
  readonly maxExemptValue?: number;
  readonly minExemptValue?: number;
  // Additional properties used in code
  readonly allowYears?: boolean;
  readonly allowDates?: boolean;
  readonly allowSmallIntegers?: boolean;
  readonly smallIntegerMax?: number;
  readonly allowOrdinals?: boolean;
  readonly allowInCodeBlocks?: boolean;
  readonly allowInQuotes?: boolean;
  readonly customPatterns?: readonly (string | RegExp)[];
  readonly alwaysExempt?: readonly (string | RegExp)[];
  readonly allowExplanatoryPercentages?: boolean;
  readonly contextExemptions?: ReadonlyMap<string, readonly string[]>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTENT CONSTRAINTS
// ─────────────────────────────────────────────────────────────────────────────────

export interface ContentConstraints {
  readonly level: ConstraintLevel;
  readonly numericPrecisionAllowed: boolean;
  readonly actionRecommendationsAllowed: boolean;
  readonly allowedTokens?: NumericTokenSet;
  readonly bannedPhrases: readonly string[];
  readonly mustIncludeWarnings: readonly string[];
  readonly reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE CONSTRAINTS (full constraint object)
// ─────────────────────────────────────────────────────────────────────────────────

export interface ResponseConstraints {
  readonly level: ConstraintLevel | 'quote_evidence_only';
  readonly numericPrecisionAllowed: boolean;
  readonly actionRecommendationsAllowed: boolean;
  readonly allowedTokens?: NumericTokenSet;
  readonly bannedPhrases: readonly string[];
  readonly mustIncludeWarnings: readonly string[];
  readonly mustInclude?: readonly string[];
  readonly requireEvidence?: boolean;
  readonly allowSpeculation?: boolean;
  readonly reason?: string;
  readonly numericExemptions?: NumericExemptions;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function createDefaultConstraints(
  reason?: string,
  _tokenSet?: NumericTokenSet,
  _categories?: readonly LiveCategory[]
): ContentConstraints {
  return {
    level: 'standard',
    numericPrecisionAllowed: true,
    actionRecommendationsAllowed: true,
    bannedPhrases: [],
    mustIncludeWarnings: [],
    reason,
  };
}

export function createStrictConstraints(
  tokenSet?: NumericTokenSet,
  categories?: readonly LiveCategory[],
  reason?: string
): ContentConstraints {
  return {
    level: 'strict',
    numericPrecisionAllowed: true,
    actionRecommendationsAllowed: false,
    allowedTokens: tokenSet,
    bannedPhrases: [],
    mustIncludeWarnings: [],
    reason: reason ?? 'Strict constraints - only evidence tokens allowed',
  };
}

export function createDegradedConstraints(reason?: string): ContentConstraints {
  return {
    level: 'standard',
    numericPrecisionAllowed: false,
    actionRecommendationsAllowed: false,
    bannedPhrases: [],
    mustIncludeWarnings: ['Information may not be current'],
    reason: reason ?? 'Degraded mode - live data unavailable',
  };
}

export function createForbidNumericConstraints(reason?: string): ContentConstraints {
  return {
    level: 'forbid',
    numericPrecisionAllowed: false,
    actionRecommendationsAllowed: false,
    bannedPhrases: [],
    mustIncludeWarnings: ['Cannot provide specific numeric values'],
    reason: reason ?? 'Numeric values forbidden',
  };
}

export function createQualitativeConstraints(reason?: string): ContentConstraints {
  return {
    level: 'standard',
    numericPrecisionAllowed: false,
    actionRecommendationsAllowed: true,
    bannedPhrases: [],
    mustIncludeWarnings: ['Specific numbers not available'],
    reason: reason ?? 'Qualitative mode - numbers unavailable',
  };
}

export function createInsufficientConstraints(reason?: string): ContentConstraints {
  return {
    level: 'standard',
    numericPrecisionAllowed: false,
    actionRecommendationsAllowed: false,
    bannedPhrases: [],
    mustIncludeWarnings: ['Unable to verify information'],
    reason: reason ?? 'Insufficient data for verification',
  };
}

export function createPermissiveConstraints(): ContentConstraints {
  return {
    level: 'permissive',
    numericPrecisionAllowed: true,
    actionRecommendationsAllowed: true,
    bannedPhrases: [],
    mustIncludeWarnings: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC TOKEN SET FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

export function createEmptyTokenSet(): NumericTokenSet {
  return {
    tokens: new Map(),
    byValue: new Map(),
    byContext: new Map(),
  };
}

export function createTokenSet(tokens: readonly NumericToken[]): NumericTokenSet {
  const tokenMap = new Map<string, NumericToken>();
  const byValue = new Map<number, NumericToken[]>();
  const byContext = new Map<NumericContextKey, NumericToken[]>();
  
  for (const token of tokens) {
    const key = `${token.sourceCategory}:${token.sourceEntity}:${token.contextKey}`;
    tokenMap.set(key, token);
    
    // By value
    const valueTokens = byValue.get(token.value) ?? [];
    valueTokens.push(token);
    byValue.set(token.value, valueTokens);
    
    // By context
    const contextTokens = byContext.get(token.contextKey) ?? [];
    contextTokens.push(token);
    byContext.set(token.contextKey, contextTokens);
  }
  
  return { tokens: tokenMap, byValue, byContext };
}

export function addToken(set: NumericTokenSet, token: NumericToken): NumericTokenSet {
  const key = `${token.sourceCategory}:${token.sourceEntity}:${token.contextKey}`;
  const newTokens = new Map(set.tokens);
  newTokens.set(key, token);
  
  const newByValue = new Map(set.byValue);
  const valueTokens = [...(newByValue.get(token.value) ?? []), token];
  newByValue.set(token.value, valueTokens);
  
  const newByContext = new Map(set.byContext);
  const contextTokens = [...(newByContext.get(token.contextKey) ?? []), token];
  newByContext.set(token.contextKey, contextTokens);
  
  return { tokens: newTokens, byValue: newByValue, byContext: newByContext };
}

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC TOKEN FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

export function createNumericToken(
  value: number,
  contextKey: NumericContextKey,
  sourceCategory: LiveCategory,
  sourceEntity: string,
  formatted: string,
  unit?: string,
  precision?: number
): NumericToken {
  return {
    value,
    formatted,
    contextKey,
    sourceCategory,
    sourceEntity,
    fetchedAt: Date.now(),
    unit,
    precision,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXEMPTION PRESETS
// ─────────────────────────────────────────────────────────────────────────────────

export const DEFAULT_ALWAYS_EXEMPT: readonly (string | RegExp)[] = Object.freeze([
  /^\d{4}$/, // Years
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // Dates
  /^#\d+$/, // Issue numbers
  /^v\d+\.\d+/, // Version numbers
]);

export function createEmptyExemptions(): NumericExemptions {
  return {
    allowYears: false,
    allowDates: false,
    allowSmallIntegers: false,
    allowOrdinals: false,
    allowInCodeBlocks: false,
    allowInQuotes: false,
    customPatterns: [],
    alwaysExempt: [],
    allowExplanatoryPercentages: false,
  };
}

export const NO_EXEMPTIONS: NumericExemptions = Object.freeze({
  allowYears: false,
  allowDates: false,
  allowSmallIntegers: false,
  allowOrdinals: false,
  allowInCodeBlocks: false,
  allowInQuotes: false,
  customPatterns: [],
  alwaysExempt: [],
  allowExplanatoryPercentages: false,
});

export const QUOTE_EVIDENCE_EXEMPTIONS: NumericExemptions = Object.freeze({
  allowYears: true,
  allowDates: true,
  allowSmallIntegers: true,
  smallIntegerMax: 10,
  allowOrdinals: true,
  allowInCodeBlocks: true,
  allowInQuotes: true,
  customPatterns: [],
  alwaysExempt: DEFAULT_ALWAYS_EXEMPT,
  allowExplanatoryPercentages: false,
});

export const QUALITATIVE_EXEMPTIONS: NumericExemptions = Object.freeze({
  allowYears: true,
  allowDates: true,
  allowSmallIntegers: true,
  smallIntegerMax: 100,
  allowOrdinals: true,
  allowInCodeBlocks: false,
  allowInQuotes: false,
  customPatterns: [],
  alwaysExempt: DEFAULT_ALWAYS_EXEMPT,
  allowExplanatoryPercentages: false,
});

export const PERMISSIVE_EXEMPTIONS: NumericExemptions = Object.freeze({
  allowYears: true,
  allowDates: true,
  allowSmallIntegers: true,
  smallIntegerMax: 1000,
  allowOrdinals: true,
  allowInCodeBlocks: true,
  allowInQuotes: true,
  customPatterns: [],
  alwaysExempt: DEFAULT_ALWAYS_EXEMPT,
  allowExplanatoryPercentages: true,
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

export function isConstraintLevel(value: string): value is ConstraintLevel {
  return ['permissive', 'standard', 'strict', 'forbid'].includes(value);
}

export function hasAllowedTokens(constraints: ResponseConstraints): boolean {
  return constraints.allowedTokens !== undefined &&
         constraints.allowedTokens.tokens.size > 0;
}

export function isNumericPrecisionAllowed(constraints: ResponseConstraints): boolean {
  return constraints.numericPrecisionAllowed;
}
