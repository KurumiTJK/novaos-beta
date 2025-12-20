// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS INDEX — Barrel Export for All Data Providers
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// BASE PROVIDER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  BaseProvider,
  type ProviderHealth,
  type ProviderFetchParams,
  type ProviderFetchResult,
  type BaseProviderConfig,
  type CircuitState,
} from './base-provider.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TIME PROVIDER — System Clock (Always Available)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  TimeProvider,
  isValidTimezone,
  normalizeTimezone,
  getSuggestedTimezones,
  TIMEZONE_ABBREVIATIONS,
} from './time-provider.js';

// ─────────────────────────────────────────────────────────────────────────────────
// FX PROVIDER — Frankfurter API (Free, No Key)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  FxProvider,
  type FxProviderConfig,
  parseCurrencyPair,
  validateCurrencyPair,
  SUPPORTED_CURRENCIES,
  CURRENCY_NAMES,
} from './fx-provider.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CRYPTO PROVIDER — CoinGecko API (Free Tier)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  CryptoProvider,
  type CryptoProviderConfig,
  resolveCoinId,
  getSuggestedCoins,
  COIN_ID_MAP,
  COIN_NAMES,
  COIN_SYMBOLS,
} from './crypto-provider.js';

// ─────────────────────────────────────────────────────────────────────────────────
// FINNHUB PROVIDER — Stock Quotes (Requires API Key)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  FinnhubProvider,
  type FinnhubProviderConfig,
  normalizeSymbol,
  getSuggestedSymbols,
  SYMBOL_ALIASES,
} from './finnhub-provider.js';

// ─────────────────────────────────────────────────────────────────────────────────
// WEATHER PROVIDER — OpenWeatherMap (Requires API Key)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  WeatherProvider,
  type WeatherProviderConfig,
  normalizeCity,
  getSuggestedCities,
  kelvinToCelsius,
  kelvinToFahrenheit,
  msToKmh,
  msToMph,
  CITY_ALIASES,
  WEATHER_CONDITIONS,
} from './weather-provider.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER INSTANCES (Singletons)
// ─────────────────────────────────────────────────────────────────────────────────

import { TimeProvider } from './time-provider.js';
import { FxProvider } from './fx-provider.js';
import { CryptoProvider } from './crypto-provider.js';
import { FinnhubProvider } from './finnhub-provider.js';
import { WeatherProvider } from './weather-provider.js';
import { BaseProvider } from './base-provider.js';

let timeProviderInstance: TimeProvider | null = null;
let fxProviderInstance: FxProvider | null = null;
let cryptoProviderInstance: CryptoProvider | null = null;
let finnhubProviderInstance: FinnhubProvider | null = null;
let weatherProviderInstance: WeatherProvider | null = null;

/**
 * Get singleton TimeProvider instance.
 */
export function getTimeProvider(): TimeProvider {
  if (!timeProviderInstance) {
    timeProviderInstance = new TimeProvider();
  }
  return timeProviderInstance;
}

/**
 * Get singleton FxProvider instance.
 */
export function getFxProvider(): FxProvider {
  if (!fxProviderInstance) {
    fxProviderInstance = new FxProvider();
  }
  return fxProviderInstance;
}

/**
 * Get singleton CryptoProvider instance.
 */
export function getCryptoProvider(): CryptoProvider {
  if (!cryptoProviderInstance) {
    cryptoProviderInstance = new CryptoProvider();
  }
  return cryptoProviderInstance;
}

/**
 * Get singleton FinnhubProvider instance.
 */
export function getFinnhubProvider(): FinnhubProvider {
  if (!finnhubProviderInstance) {
    finnhubProviderInstance = new FinnhubProvider();
  }
  return finnhubProviderInstance;
}

/**
 * Get singleton WeatherProvider instance.
 */
export function getWeatherProvider(): WeatherProvider {
  if (!weatherProviderInstance) {
    weatherProviderInstance = new WeatherProvider();
  }
  return weatherProviderInstance;
}

/**
 * Get all provider instances.
 */
export function getAllProviders(): readonly [
  TimeProvider,
  FxProvider,
  CryptoProvider,
  FinnhubProvider,
  WeatherProvider,
] {
  return [
    getTimeProvider(),
    getFxProvider(),
    getCryptoProvider(),
    getFinnhubProvider(),
    getWeatherProvider(),
  ];
}

/**
 * Get all available providers (those with required config).
 */
export function getAvailableProviders(): BaseProvider[] {
  return getAllProviders().filter(p => p.isAvailable());
}
