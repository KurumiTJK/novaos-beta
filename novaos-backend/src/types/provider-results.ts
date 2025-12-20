// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER RESULTS — Data Provider Types (CORRECTED to match actual code)
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory } from './categories.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER ERROR CODES (includes all values used in code)
// ─────────────────────────────────────────────────────────────────────────────────

export type ProviderErrorCode =
  | 'network_error'
  | 'timeout'
  | 'rate_limited'
  | 'not_found'
  | 'invalid_request'
  | 'provider_unavailable'
  | 'parse_error'
  | 'unknown'
  | 'auth_error'
  | 'invalid_symbol'
  | 'not_available'
  | 'provider_error'
  | 'invalid_response';

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER ERROR
// ─────────────────────────────────────────────────────────────────────────────────

export interface ProviderError {
  readonly code: ProviderErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly provider?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FRESHNESS POLICY
// ─────────────────────────────────────────────────────────────────────────────────

export interface FreshnessPolicy {
  readonly maxAgeMs: number;
  readonly staleThresholdMs: number;
  readonly refreshIntervalMs: number;
}

export const DEFAULT_FRESHNESS_POLICIES: Readonly<Record<LiveCategory, FreshnessPolicy>> = {
  market: {
    maxAgeMs: 60000,
    staleThresholdMs: 30000,
    refreshIntervalMs: 15000,
  },
  crypto: {
    maxAgeMs: 60000,
    staleThresholdMs: 30000,
    refreshIntervalMs: 15000,
  },
  fx: {
    maxAgeMs: 300000,
    staleThresholdMs: 150000,
    refreshIntervalMs: 60000,
  },
  weather: {
    maxAgeMs: 900000,
    staleThresholdMs: 600000,
    refreshIntervalMs: 300000,
  },
  time: {
    maxAgeMs: 1000,
    staleThresholdMs: 500,
    refreshIntervalMs: 1000,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// STOCK DATA
// ─────────────────────────────────────────────────────────────────────────────────

export interface StockData {
  readonly type: 'stock';
  readonly symbol: string;
  readonly name?: string;
  readonly price: number;
  readonly change: number;
  readonly changePercent: number;
  readonly open?: number;
  readonly high?: number;
  readonly low?: number;
  readonly dayHigh?: number;
  readonly dayLow?: number;
  readonly previousClose?: number;
  readonly volume?: number;
  readonly marketCap?: number;
  readonly pe?: number;
  readonly eps?: number;
  readonly dividendYield?: number;
  readonly exchange?: string;
  readonly currency?: string;
  readonly timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FX DATA (corrected property names)
// ─────────────────────────────────────────────────────────────────────────────────

export interface FxData {
  readonly type: 'fx';
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly rate: number;
  readonly change?: number;
  readonly changePercent?: number;
  readonly changePercent24h?: number;
  readonly change24h?: number;
  readonly bid?: number;
  readonly ask?: number;
  readonly spread?: number;
  readonly timestamp?: number;
}

// Alias for backward compatibility
export type FXData = FxData;

// ─────────────────────────────────────────────────────────────────────────────────
// CRYPTO DATA (corrected property names)
// ─────────────────────────────────────────────────────────────────────────────────

export interface CryptoData {
  readonly type: 'crypto';
  readonly symbol: string;
  readonly name?: string;
  readonly price?: number;
  readonly priceUsd?: number;
  readonly priceBtc?: number;
  readonly change24h?: number;
  readonly change1h?: number;
  readonly change7d?: number;
  readonly changePercent24h?: number;
  readonly volume24h?: number;
  readonly volume24hUsd?: number;
  readonly marketCap?: number;
  readonly marketCapUsd?: number;
  readonly circulatingSupply?: number;
  readonly totalSupply?: number;
  readonly maxSupply?: number;
  readonly rank?: number;
  readonly timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// WEATHER DATA (corrected property names)
// ─────────────────────────────────────────────────────────────────────────────────

export interface WeatherData {
  readonly type: 'weather';
  readonly location: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly temperature?: number;
  readonly temperatureC?: number;
  readonly temperatureF?: number;
  readonly temperatureCelsius?: number;
  readonly temperatureFahrenheit?: number;
  readonly temperatureUnit?: 'C' | 'F';
  readonly feelsLike?: number;
  readonly feelsLikeC?: number;
  readonly feelsLikeF?: number;
  readonly feelsLikeCelsius?: number;
  readonly feelsLikeFahrenheit?: number;
  readonly condition?: string;
  readonly conditionCode?: string;
  readonly humidity?: number;
  readonly pressure?: number;
  readonly windSpeed?: number;
  readonly windSpeedMph?: number;
  readonly windSpeedKph?: number;
  readonly windSpeedUnit?: 'mph' | 'kph' | 'm/s';
  readonly windDirection?: string;
  readonly visibility?: number;
  readonly uvIndex?: number;
  readonly precipitation?: number;
  readonly cloudCover?: number;
  readonly sunrise?: string;
  readonly sunset?: string;
  readonly isDay?: boolean;
  readonly timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TIME DATA (corrected property names)
// ─────────────────────────────────────────────────────────────────────────────────

export interface TimeData {
  readonly type: 'time';
  readonly timezone: string;
  readonly abbreviation?: string;
  readonly datetime?: string;
  readonly date?: string;
  readonly time?: string;
  readonly time24?: string;
  readonly localTime?: string;
  readonly utcTime?: string;
  readonly timestamp?: number;
  readonly unixTimestamp?: number;
  readonly utcOffset?: string;
  readonly utcOffsetSeconds?: number;
  readonly isDST?: boolean;
  readonly isDst?: boolean;
  readonly dayOfWeek?: string;
  readonly weekNumber?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER DATA (discriminated union)
// ─────────────────────────────────────────────────────────────────────────────────

export type ProviderData = StockData | FxData | CryptoData | WeatherData | TimeData;

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER RESULTS
// ─────────────────────────────────────────────────────────────────────────────────

export interface ProviderOkResult<T extends ProviderData = ProviderData> {
  readonly ok: true;
  readonly data: T;
  readonly fetchedAt: number;
  readonly latencyMs: number;
  readonly provider: string;
  readonly cached?: boolean;
  readonly freshnessMs?: number;
  readonly freshnessPolicy?: FreshnessPolicy;
}

export interface ProviderErrResult {
  readonly ok: false;
  readonly error: ProviderError;
  readonly fetchedAt?: number;
  readonly attemptedAt?: number;
  readonly latencyMs?: number;
  readonly provider?: string;
  readonly fallbackAvailable?: boolean;
}

export type ProviderResult<T extends ProviderData = ProviderData> = 
  | ProviderOkResult<T>
  | ProviderErrResult;

// Alias for backward compatibility
export type ErrorProviderResult = ProviderErrResult;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

export function isProviderOk<T extends ProviderData>(
  result: ProviderResult<T>
): result is ProviderOkResult<T> {
  return result.ok === true;
}

export function isProviderErr(result: ProviderResult): result is ProviderErrResult {
  return result.ok === false;
}

export function isStockData(data: ProviderData): data is StockData {
  return data.type === 'stock';
}

export function isFxData(data: ProviderData): data is FxData {
  return data.type === 'fx';
}

export function isCryptoData(data: ProviderData): data is CryptoData {
  return data.type === 'crypto';
}

export function isWeatherData(data: ProviderData): data is WeatherData {
  return data.type === 'weather';
}

export function isTimeData(data: ProviderData): data is TimeData {
  return data.type === 'time';
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function createProviderError(
  code: ProviderErrorCode,
  message: string,
  retryable: boolean = false,
  retryAfterMs?: number
): ProviderError {
  return { code, message, retryable, retryAfterMs };
}

export function createOkResult<T extends ProviderData>(
  data: T,
  provider: string,
  latencyMs: number,
  cached: boolean = false
): ProviderOkResult<T> {
  return {
    ok: true,
    data,
    fetchedAt: Date.now(),
    latencyMs,
    provider,
    cached,
  };
}

export function createErrResult(
  error: ProviderError,
  provider?: string,
  latencyMs?: number
): ProviderErrResult {
  return {
    ok: false,
    error,
    fetchedAt: Date.now(),
    latencyMs,
    provider,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// FRESHNESS HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

export function getFreshnessPolicy(category: LiveCategory): FreshnessPolicy {
  return DEFAULT_FRESHNESS_POLICIES[category];
}

export function isDataFresh(result: ProviderOkResult, category: LiveCategory): boolean {
  const policy = getFreshnessPolicy(category);
  const age = Date.now() - result.fetchedAt;
  return age <= policy.maxAgeMs;
}

export function isDataStale(result: ProviderOkResult, category: LiveCategory): boolean {
  const policy = getFreshnessPolicy(category);
  const age = Date.now() - result.fetchedAt;
  return age > policy.staleThresholdMs;
}

export function getDataAgeMs(result: ProviderOkResult): number {
  return Date.now() - result.fetchedAt;
}
