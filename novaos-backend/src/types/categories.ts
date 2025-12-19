// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY TYPES — Live Data Router Data Classification
// Defines live vs authoritative data categories for routing decisions
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LIVE CATEGORIES — Require real-time provider APIs
// These categories have data that changes frequently (seconds to hours)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Categories requiring live data feeds from provider APIs.
 * Data in these categories is stale within seconds to hours.
 */
export type LiveCategory =
  | 'time'      // Current time, timezone conversions
  | 'market'    // Stock prices, indices, market data
  | 'fx'        // Foreign exchange rates
  | 'crypto'    // Cryptocurrency prices
  | 'weather';  // Current conditions, forecasts

/**
 * All valid live category values as a Set for runtime validation.
 */
export const VALID_LIVE_CATEGORIES: ReadonlySet<LiveCategory> = new Set([
  'time',
  'market',
  'fx',
  'crypto',
  'weather',
]);

/**
 * Array of live categories for iteration (preserves order).
 */
export const LIVE_CATEGORY_LIST: readonly LiveCategory[] = [
  'time',
  'market',
  'fx',
  'crypto',
  'weather',
] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE CATEGORIES — Require verified sources
// These categories have data that changes less frequently but accuracy is critical
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Categories requiring authoritative source verification.
 * Data in these categories changes less frequently but must be accurate.
 */
export type AuthoritativeCategory =
  | 'leadership'      // CEO, executives, board members
  | 'regulatory'      // Laws, regulations, compliance requirements
  | 'software'        // Version numbers, release dates, deprecations
  | 'service_status'; // API status, outages, maintenance windows

/**
 * All valid authoritative category values as a Set for runtime validation.
 */
export const VALID_AUTHORITATIVE_CATEGORIES: ReadonlySet<AuthoritativeCategory> = new Set([
  'leadership',
  'regulatory',
  'software',
  'service_status',
]);

/**
 * Array of authoritative categories for iteration (preserves order).
 */
export const AUTHORITATIVE_CATEGORY_LIST: readonly AuthoritativeCategory[] = [
  'leadership',
  'regulatory',
  'software',
  'service_status',
] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// UNIFIED DATA CATEGORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * All data categories including general (no special handling needed).
 */
export type DataCategory = LiveCategory | AuthoritativeCategory | 'general';

/**
 * All valid data category values as a Set for runtime validation.
 */
export const VALID_DATA_CATEGORIES: ReadonlySet<DataCategory> = new Set([
  ...VALID_LIVE_CATEGORIES,
  ...VALID_AUTHORITATIVE_CATEGORIES,
  'general',
]);

// ─────────────────────────────────────────────────────────────────────────────────
// CATEGORY METADATA
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Freshness requirements for live categories.
 * Defines maximum age of data before it's considered stale.
 */
export interface CategoryFreshness {
  readonly category: LiveCategory;
  readonly maxAgeMs: number;
  readonly description: string;
}

/**
 * Default freshness windows for live categories.
 */
export const LIVE_CATEGORY_FRESHNESS: ReadonlyMap<LiveCategory, CategoryFreshness> = new Map([
  ['time', { category: 'time', maxAgeMs: 1000, description: 'Real-time (1 second)' }],
  ['market', { category: 'market', maxAgeMs: 60_000, description: 'Near real-time (1 minute)' }],
  ['fx', { category: 'fx', maxAgeMs: 300_000, description: 'Frequently updated (5 minutes)' }],
  ['crypto', { category: 'crypto', maxAgeMs: 60_000, description: 'Near real-time (1 minute)' }],
  ['weather', { category: 'weather', maxAgeMs: 900_000, description: 'Periodically updated (15 minutes)' }],
]);

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Type guard to check if a string is a valid LiveCategory.
 */
export function isLiveCategory(value: unknown): value is LiveCategory {
  return typeof value === 'string' && VALID_LIVE_CATEGORIES.has(value as LiveCategory);
}

/**
 * Type guard to check if a string is a valid AuthoritativeCategory.
 */
export function isAuthoritativeCategory(value: unknown): value is AuthoritativeCategory {
  return typeof value === 'string' && VALID_AUTHORITATIVE_CATEGORIES.has(value as AuthoritativeCategory);
}

/**
 * Type guard to check if a string is a valid DataCategory.
 */
export function isDataCategory(value: unknown): value is DataCategory {
  return typeof value === 'string' && VALID_DATA_CATEGORIES.has(value as DataCategory);
}

/**
 * Check if a category requires live provider data (vs authoritative sources or general).
 */
export function requiresLiveProvider(category: DataCategory): category is LiveCategory {
  return isLiveCategory(category);
}

/**
 * Check if a category requires authoritative source verification.
 */
export function requiresAuthoritativeSource(category: DataCategory): category is AuthoritativeCategory {
  return isAuthoritativeCategory(category);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXHAUSTIVENESS HELPER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Helper for exhaustiveness checking in switch statements.
 * TypeScript will error if a case is not handled.
 * 
 * @example
 * function handleCategory(cat: LiveCategory): string {
 *   switch (cat) {
 *     case 'time': return 'time data';
 *     case 'market': return 'market data';
 *     case 'fx': return 'forex data';
 *     case 'crypto': return 'crypto data';
 *     case 'weather': return 'weather data';
 *     default: return assertNever(cat);
 *   }
 * }
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`);
}

// ─────────────────────────────────────────────────────────────────────────────────
// CATEGORY PRIORITY (for routing decisions)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Priority order when multiple categories are detected.
 * Higher index = higher priority (processed first).
 */
export const CATEGORY_PRIORITY: readonly DataCategory[] = [
  'general',        // Lowest priority
  'software',
  'service_status',
  'leadership',
  'regulatory',
  'weather',
  'fx',
  'crypto',
  'market',
  'time',           // Highest priority (most time-sensitive)
] as const;

/**
 * Get the priority index for a category (higher = more urgent).
 */
export function getCategoryPriority(category: DataCategory): number {
  const index = CATEGORY_PRIORITY.indexOf(category);
  return index === -1 ? 0 : index;
}

/**
 * Sort categories by priority (highest first).
 */
export function sortByPriority(categories: DataCategory[]): DataCategory[] {
  return [...categories].sort((a, b) => getCategoryPriority(b) - getCategoryPriority(a));
}
