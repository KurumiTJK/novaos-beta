// ═══════════════════════════════════════════════════════════════════════════════
// DATA PROVIDERS — Live Data Router Subsystem
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides real-time data fetching from external APIs with:
// - Circuit breaker protection
// - Rate limiting
// - Caching with deduplication
// - Retry with jittered backoff
// - Freshness validation
// - Health monitoring
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Rate Limiter
  getRateLimiter,
  type RateLimiter,
  type RateLimitResult,
  
  // Cache
  getProviderCache,
  type ProviderCache,
  type CacheFetchResult,
  type CacheableCategory,
  
  // Retry
  withRetry,
  type RetryPolicy,
  type RetryOptions,
} from './infrastructure/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDERS (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Base Provider
  BaseProvider,
  type ProviderHealth,
  type ProviderFetchParams,
  type ProviderFetchResult,
  type BaseProviderConfig,
  type CircuitState,
  
  // Time Provider
  TimeProvider,
  isValidTimezone,
  normalizeTimezone,
  getSuggestedTimezones,
  TIMEZONE_ABBREVIATIONS,
  
  // FX Provider
  FxProvider,
  type FxProviderConfig,
  parseCurrencyPair,
  validateCurrencyPair,
  SUPPORTED_CURRENCIES,
  CURRENCY_NAMES,
  
  // Crypto Provider
  CryptoProvider,
  type CryptoProviderConfig,
  resolveCoinId,
  getSuggestedCoins,
  COIN_ID_MAP,
  COIN_NAMES,
  COIN_SYMBOLS,
  
  // Finnhub Provider
  FinnhubProvider,
  type FinnhubProviderConfig,
  normalizeSymbol,
  getSuggestedSymbols,
  SYMBOL_ALIASES,
  
  // Weather Provider
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
  
  // Singleton Getters
  getTimeProvider,
  getFxProvider,
  getCryptoProvider,
  getFinnhubProvider,
  getWeatherProvider,
  getAllProviders,
  getAvailableProviders,
} from './providers/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// FRESHNESS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Freshness Check Functions
  checkFreshness,
  isFreshEnough,
  isStrictlyFresh,
  getDataAgeSec,
  getTimeUntilExpirySec,
  
  // Policy Functions
  getFreshnessPolicy,
  getAllFreshnessPolicies,
  createFreshnessPolicy,
  checkFreshnessWithPolicy,
  getMarketAwarePolicy,
  
  // Utility Functions
  getFreshnessScore,
  compareFreshness,
  formatFreshness,
  
  // Policies
  FRESHNESS_POLICIES,
  
  // Types
  type FreshnessStatus,
  type FreshnessPolicy,
  type FreshnessCheckResult,
} from './freshness.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Registry Class
  ProviderRegistry,
  
  // Singleton & Factory
  getProviderRegistry,
  createProviderRegistry,
  
  // Convenience Functions
  getProviderForCategory,
  isCategoryAvailable,
  getAvailableCategories,
  
  // Types
  type ProviderRegistration,
  type CategoryStatus,
} from './registry.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Health Check Functions
  getSystemHealth,
  getCategoryHealth,
  getQuickHealth,
  
  // HTTP Handlers
  handleHealthRequest,
  handleReadinessRequest,
  handleLivenessRequest,
  
  // Probes
  isReady,
  isAlive,
  
  // Types
  type HealthLevel,
  type ProviderHealthReport,
  type CategoryHealthReport,
  type SystemHealthReport,
  type HealthHttpResponse,
} from './health.js';
