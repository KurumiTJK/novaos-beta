// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER RESULT TYPES — Live Data Router Provider Responses
// Discriminated unions for type-safe provider result handling
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory } from './categories.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER DATA TYPES — Category-specific data structures
// Each type corresponds to a LiveCategory and has a discriminator field
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Stock/market data from financial data providers.
 */
export interface StockData {
  readonly type: 'stock';
  readonly symbol: string;
  readonly exchange: string;
  readonly price: number;
  readonly currency: string;
  readonly change: number;
  readonly changePercent: number;
  readonly volume?: number;
  readonly marketCap?: number;
  readonly high52Week?: number;
  readonly low52Week?: number;
  readonly previousClose?: number;
  readonly open?: number;
  readonly dayHigh?: number;
  readonly dayLow?: number;
}

/**
 * Foreign exchange rate data.
 */
export interface FxData {
  readonly type: 'fx';
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly rate: number;
  readonly bid?: number;
  readonly ask?: number;
  readonly spread?: number;
  readonly change24h?: number;
  readonly changePercent24h?: number;
}

/**
 * Cryptocurrency price data.
 */
export interface CryptoData {
  readonly type: 'crypto';
  readonly symbol: string;
  readonly name: string;
  readonly priceUsd: number;
  readonly priceBtc?: number;
  readonly marketCapUsd?: number;
  readonly volume24hUsd?: number;
  readonly change1h?: number;
  readonly change24h?: number;
  readonly change7d?: number;
  readonly circulatingSupply?: number;
  readonly maxSupply?: number;
}

/**
 * Weather condition data.
 */
export interface WeatherData {
  readonly type: 'weather';
  readonly location: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly temperatureCelsius: number;
  readonly temperatureFahrenheit: number;
  readonly feelsLikeCelsius?: number;
  readonly feelsLikeFahrenheit?: number;
  readonly humidity?: number;
  readonly windSpeedKph?: number;
  readonly windSpeedMph?: number;
  readonly windDirection?: string;
  readonly condition: string;
  readonly conditionCode?: string;
  readonly uvIndex?: number;
  readonly visibility?: number;
  readonly pressure?: number;
  readonly isDay?: boolean;
}

/**
 * Time/timezone data.
 */
export interface TimeData {
  readonly type: 'time';
  readonly timezone: string;
  readonly utcOffset: string;
  readonly localTime: string;
  readonly utcTime: string;
  readonly unixTimestamp: number;
  readonly isDst?: boolean;
  readonly dstOffset?: number;
  readonly abbreviation?: string;
}

/**
 * Discriminated union of all provider data types.
 * Use the `type` field to narrow to specific data structure.
 */
export type ProviderData =
  | StockData
  | FxData
  | CryptoData
  | WeatherData
  | TimeData;

/**
 * Map from LiveCategory to corresponding ProviderData type.
 * Useful for generic type constraints.
 */
export interface CategoryDataMap {
  market: StockData;
  fx: FxData;
  crypto: CryptoData;
  weather: WeatherData;
  time: TimeData;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Error classification for provider failures.
 */
export type ProviderErrorCode =
  | 'network_error'       // Connection failed, timeout
  | 'rate_limited'        // Provider rate limit exceeded
  | 'invalid_symbol'      // Requested entity not found
  | 'invalid_response'    // Provider returned malformed data
  | 'auth_error'          // API key invalid or expired
  | 'provider_error'      // Provider-side error (5xx)
  | 'not_available'       // Data not available for this entity
  | 'timeout'             // Request exceeded timeout
  | 'unknown';            // Unclassified error

/**
 * All valid provider error codes as a Set for runtime validation.
 */
export const VALID_PROVIDER_ERROR_CODES: ReadonlySet<ProviderErrorCode> = new Set([
  'network_error',
  'rate_limited',
  'invalid_symbol',
  'invalid_response',
  'auth_error',
  'provider_error',
  'not_available',
  'timeout',
  'unknown',
]);

/**
 * Structured error from a provider.
 */
export interface ProviderError {
  readonly code: ProviderErrorCode;
  readonly message: string;
  readonly provider: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly details?: Record<string, unknown>;
}

/**
 * Errors that should trigger automatic retry.
 */
export const RETRYABLE_ERROR_CODES: ReadonlySet<ProviderErrorCode> = new Set([
  'network_error',
  'rate_limited',
  'timeout',
  'provider_error',
]);

/**
 * Check if an error code indicates a retryable failure.
 */
export function isRetryableError(code: ProviderErrorCode): boolean {
  return RETRYABLE_ERROR_CODES.has(code);
}

// ─────────────────────────────────────────────────────────────────────────────────
// FRESHNESS POLICY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Freshness policy for provider data.
 * Controls caching and staleness behavior.
 */
export interface FreshnessPolicy {
  /** Maximum age of cached data in milliseconds */
  readonly maxAgeMs: number;
  /** Whether to serve stale data if refresh fails */
  readonly serveStaleOnError: boolean;
  /** Maximum staleness before hard refresh required */
  readonly maxStaleMs?: number;
  /** Minimum time between refresh attempts */
  readonly minRefreshIntervalMs?: number;
}

/**
 * Default freshness policies per category.
 */
export const DEFAULT_FRESHNESS_POLICIES: ReadonlyMap<LiveCategory, FreshnessPolicy> = new Map([
  ['time', {
    maxAgeMs: 1_000,
    serveStaleOnError: false, // Time must be accurate
    maxStaleMs: 5_000,
    minRefreshIntervalMs: 500,
  }],
  ['market', {
    maxAgeMs: 60_000,
    serveStaleOnError: true,
    maxStaleMs: 300_000, // 5 minutes max stale
    minRefreshIntervalMs: 15_000,
  }],
  ['fx', {
    maxAgeMs: 300_000,
    serveStaleOnError: true,
    maxStaleMs: 900_000, // 15 minutes max stale
    minRefreshIntervalMs: 60_000,
  }],
  ['crypto', {
    maxAgeMs: 60_000,
    serveStaleOnError: true,
    maxStaleMs: 300_000,
    minRefreshIntervalMs: 15_000,
  }],
  ['weather', {
    maxAgeMs: 900_000, // 15 minutes
    serveStaleOnError: true,
    maxStaleMs: 3_600_000, // 1 hour max stale
    minRefreshIntervalMs: 300_000,
  }],
]);

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER RESULT — Discriminated Union (Ok/Err pattern)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Successful provider response.
 */
export interface ProviderOkResult {
  readonly ok: true;
  readonly data: ProviderData;
  readonly provider: string;
  readonly fetchedAt: number;
  readonly cachedAt?: number;
  readonly freshnessPolicy: FreshnessPolicy;
  readonly latencyMs: number;
}

/**
 * Failed provider response.
 */
export interface ProviderErrResult {
  readonly ok: false;
  readonly error: ProviderError;
  readonly provider: string;
  readonly attemptedAt: number;
  readonly latencyMs: number;
  readonly fallbackAvailable: boolean;
}

/**
 * Discriminated union of provider results.
 * Use the `ok` field to narrow to success or failure.
 * 
 * @example
 * function handleResult(result: ProviderResult) {
 *   if (result.ok) {
 *     // TypeScript knows result.data exists here
 *     console.log(result.data);
 *   } else {
 *     // TypeScript knows result.error exists here
 *     console.error(result.error.message);
 *   }
 * }
 */
export type ProviderResult = ProviderOkResult | ProviderErrResult;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Type guard for successful provider result.
 */
export function isProviderOk(result: ProviderResult): result is ProviderOkResult {
  return result.ok === true;
}

/**
 * Type guard for failed provider result.
 */
export function isProviderErr(result: ProviderResult): result is ProviderErrResult {
  return result.ok === false;
}

/**
 * Type guard for StockData.
 */
export function isStockData(data: ProviderData): data is StockData {
  return data.type === 'stock';
}

/**
 * Type guard for FxData.
 */
export function isFxData(data: ProviderData): data is FxData {
  return data.type === 'fx';
}

/**
 * Type guard for CryptoData.
 */
export function isCryptoData(data: ProviderData): data is CryptoData {
  return data.type === 'crypto';
}

/**
 * Type guard for WeatherData.
 */
export function isWeatherData(data: ProviderData): data is WeatherData {
  return data.type === 'weather';
}

/**
 * Type guard for TimeData.
 */
export function isTimeData(data: ProviderData): data is TimeData {
  return data.type === 'time';
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER METADATA
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Metadata about a data provider.
 */
export interface ProviderMetadata {
  readonly id: string;
  readonly name: string;
  readonly categories: readonly LiveCategory[];
  readonly rateLimit: {
    readonly requestsPerMinute: number;
    readonly requestsPerDay?: number;
  };
  readonly reliability: 'high' | 'medium' | 'low';
  readonly requiresAuth: boolean;
}

/**
 * Result with provider metadata attached.
 */
export interface ProviderResultWithMeta {
  readonly result: ProviderResult;
  readonly metadata: ProviderMetadata;
  readonly correlationId: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if provider data is stale based on freshness policy.
 */
export function isDataStale(
  result: ProviderOkResult,
  now: number = Date.now()
): boolean {
  const age = now - result.fetchedAt;
  return age > result.freshnessPolicy.maxAgeMs;
}

/**
 * Check if stale data can still be served (within maxStaleMs).
 */
export function canServeStale(
  result: ProviderOkResult,
  now: number = Date.now()
): boolean {
  if (!result.freshnessPolicy.serveStaleOnError) {
    return false;
  }
  const maxStale = result.freshnessPolicy.maxStaleMs;
  if (maxStale === undefined) {
    return true; // No max stale limit
  }
  const age = now - result.fetchedAt;
  return age <= maxStale;
}

/**
 * Get the data type from a LiveCategory.
 */
export function getDataTypeForCategory(category: LiveCategory): ProviderData['type'] {
  const mapping: Record<LiveCategory, ProviderData['type']> = {
    market: 'stock',
    fx: 'fx',
    crypto: 'crypto',
    weather: 'weather',
    time: 'time',
  };
  return mapping[category];
}
