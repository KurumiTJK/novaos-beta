// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES — Live Data Category Types
// FIXED: Added missing AuthoritativeCategory values
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Categories of live data that require real-time verification.
 */
export type LiveCategory = 
  | 'market'   // Stock prices, indices
  | 'crypto'   // Cryptocurrency prices
  | 'fx'       // Foreign exchange rates
  | 'weather'  // Weather conditions
  | 'time';    // Current time/timezone

/**
 * Categories requiring authoritative source verification.
 * FIXED: Added leadership, regulatory, software, service_status
 */
export type AuthoritativeCategory =
  | 'legal'          // Laws, regulations
  | 'medical'        // Medical information
  | 'government'     // Government data
  | 'academic'       // Academic/scientific
  | 'leadership'     // Company/org leadership
  | 'regulatory'     // Regulatory filings (SEC, etc.)
  | 'software'       // Software versions, releases
  | 'service_status'; // Service status pages

/**
 * All data categories (union of live and authoritative).
 */
export type DataCategory = LiveCategory | AuthoritativeCategory | 'general';

/**
 * All valid live categories as a Set.
 */
export const VALID_LIVE_CATEGORIES: ReadonlySet<LiveCategory> = new Set([
  'market',
  'crypto',
  'fx',
  'weather',
  'time',
]);

/**
 * All valid authoritative categories as a Set.
 * FIXED: Added new categories
 */
export const VALID_AUTHORITATIVE_CATEGORIES: ReadonlySet<AuthoritativeCategory> = new Set([
  'legal',
  'medical',
  'government',
  'academic',
  'leadership',
  'regulatory',
  'software',
  'service_status',
]);

/**
 * Type guard for LiveCategory.
 */
export function isLiveCategory(value: unknown): value is LiveCategory {
  return typeof value === 'string' && VALID_LIVE_CATEGORIES.has(value as LiveCategory);
}

/**
 * Type guard for AuthoritativeCategory.
 */
export function isAuthoritativeCategory(value: unknown): value is AuthoritativeCategory {
  return typeof value === 'string' && VALID_AUTHORITATIVE_CATEGORIES.has(value as AuthoritativeCategory);
}

/**
 * Type guard for DataCategory.
 */
export function isDataCategory(value: unknown): value is DataCategory {
  if (typeof value !== 'string') return false;
  return value === 'general' || 
         isLiveCategory(value) || 
         isAuthoritativeCategory(value);
}
