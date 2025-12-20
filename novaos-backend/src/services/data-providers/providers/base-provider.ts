// ═══════════════════════════════════════════════════════════════════════════════
// BASE PROVIDER — Abstract Base Class with Infrastructure Integration
// All data providers extend this to get circuit breaker, rate limiting, caching
// PATCHED VERSION - Compatible with existing NovaOS types
// ═══════════════════════════════════════════════════════════════════════════════

import {
  getExternalAPICircuit,
  CircuitBreaker,
  type CircuitState,
} from '../../circuit-breaker.js';

import {
  getRateLimiter,
  getProviderCache,
  withRetry,
  type RateLimitResult,
  type RetryPolicy,
  type CacheableCategory,
} from '../infrastructure/index.js';

import type {
  LiveCategory,
  ProviderResult,
  ProviderOkResult,
  ProviderErrResult,
  ProviderData,
  ProviderError,
  ProviderErrorCode,
  FreshnessPolicy,
} from '../../../types/index.js';

import {
  DEFAULT_FRESHNESS_POLICIES,
} from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORT CircuitState for convenience
// ─────────────────────────────────────────────────────────────────────────────────

export type { CircuitState };

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER HEALTH STATUS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Health status of a provider.
 */
export interface ProviderHealth {
  /** Provider name */
  readonly name: string;
  /** Whether the provider is available (has required config) */
  readonly available: boolean;
  /** Circuit breaker state */
  readonly circuitState: CircuitState;
  /** Number of consecutive failures */
  readonly consecutiveFailures: number;
  /** Remaining rate limit requests */
  readonly rateLimitRemaining: number;
  /** Rate limit window reset time */
  readonly rateLimitResetMs: number;
  /** Last successful fetch timestamp */
  readonly lastSuccessAt: number | null;
  /** Last error message (if any) */
  readonly lastError: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER FETCH PARAMETERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Parameters for a provider fetch request.
 */
export interface ProviderFetchParams {
  /** The specific query (e.g., stock symbol, city name) */
  readonly query: string;
  /** Optional user ID for per-user rate limiting */
  readonly userId?: string;
  /** Whether to bypass cache */
  readonly bypassCache?: boolean;
  /** Optional timeout override in milliseconds */
  readonly timeoutMs?: number;
}

/**
 * Result of a provider fetch operation.
 */
export interface ProviderFetchResult {
  /** The provider result */
  readonly result: ProviderResult;
  /** Whether the result came from cache */
  readonly fromCache: boolean;
  /** Whether this was deduplicated with an in-flight request */
  readonly deduplicated: boolean;
  /** Total duration including cache lookup */
  readonly durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// BASE PROVIDER CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for base provider.
 */
export interface BaseProviderConfig {
  /** Custom retry policy */
  readonly retryPolicy?: Partial<RetryPolicy>;
}

/**
 * Default retry policy for providers.
 */
const DEFAULT_PROVIDER_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryOnTimeout: true,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

// ─────────────────────────────────────────────────────────────────────────────────
// RELIABILITY TIERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Provider reliability tier.
 */
export type ReliabilityTier = 'official' | 'feed' | 'aggregator' | 'community';

// ─────────────────────────────────────────────────────────────────────────────────
// ABSTRACT BASE PROVIDER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Abstract base class for all data providers.
 * 
 * Provides integrated infrastructure:
 * - Circuit breaker (fail-fast when service is down)
 * - Rate limiting (respect API limits)
 * - Caching with deduplication (reduce redundant calls)
 * - Retry with jittered backoff (handle transient failures)
 * 
 * Subclasses implement:
 * - `name`: Unique provider identifier
 * - `categories`: Data categories this provider serves
 * - `reliabilityTier`: Data source reliability classification
 * - `fetchInternal()`: Actual data fetching logic
 * - `isAvailable()`: Whether provider has required configuration
 */
export abstract class BaseProvider {
  // ═══════════════════════════════════════════════════════════════════════════
  // ABSTRACT PROPERTIES (must be implemented by subclasses)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Unique provider name (e.g., "finnhub", "openweathermap") */
  abstract readonly name: string;
  
  /** Data categories this provider can serve */
  abstract readonly categories: readonly LiveCategory[];
  
  /** Reliability tier of this data source */
  abstract readonly reliabilityTier: ReliabilityTier;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INSTANCE STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Retry policy for this provider */
  protected readonly retryPolicy: RetryPolicy;
  
  /** Last error message */
  protected lastError: string | null = null;
  
  /** Last successful fetch timestamp */
  protected lastSuccessAt: number | null = null;
  
  /** Consecutive failure count */
  protected consecutiveFailures: number = 0;
  
  constructor(config?: BaseProviderConfig) {
    this.retryPolicy = {
      ...DEFAULT_PROVIDER_RETRY_POLICY,
      ...config?.retryPolicy,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ABSTRACT METHODS (must be implemented by subclasses)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Fetch data from the external API.
   * 
   * Subclasses implement this to perform the actual API call.
   * The base class handles circuit breaker, rate limiting, caching, and retry.
   * 
   * @param params - Fetch parameters
   * @returns Provider result (success or failure)
   */
  protected abstract fetchInternal(params: ProviderFetchParams): Promise<ProviderResult>;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VIRTUAL METHODS (can be overridden by subclasses)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Check if the provider is available (has required configuration).
   * 
   * Override this to check for API keys or other required config.
   * Default: always available.
   */
  isAvailable(): boolean {
    return true;
  }
  
  /**
   * Generate a cache key for the given parameters.
   * 
   * Override to customize cache key generation.
   * Default: `${providerName}:${query}`
   */
  protected getCacheKey(params: ProviderFetchParams): string {
    return `${this.name}:${params.query.toLowerCase().trim()}`;
  }
  
  /**
   * Get the cache category for this provider.
   * 
   * Override if the provider serves multiple categories.
   * Default: first category in the list.
   */
  protected getCacheCategory(): CacheableCategory {
    return this.categories[0] as CacheableCategory;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Fetch data with full infrastructure integration.
   * 
   * Execution order:
   * 1. Check availability
   * 2. Check circuit breaker (fail-fast if open)
   * 3. Check rate limit (acquire token atomically)
   * 4. Check cache (with in-flight deduplication)
   * 5. Execute fetch with retry
   * 6. Update health tracking
   * 
   * @param params - Fetch parameters
   * @returns Fetch result with metadata
   */
  async fetch(params: ProviderFetchParams): Promise<ProviderFetchResult> {
    const startTime = Date.now();
    
    // 1. Check availability
    if (!this.isAvailable()) {
      return {
        result: this.createFailResult(
          'PROVIDER_UNAVAILABLE',
          `Provider ${this.name} is not available (missing configuration)`,
          false
        ),
        fromCache: false,
        deduplicated: false,
        durationMs: Date.now() - startTime,
      };
    }
    
    // 2. Check circuit breaker FIRST (fail-fast)
    const circuit = this.getCircuit();
    const circuitState = circuit.getState();
    
    if (circuitState === 'open') {
      return {
        result: this.createFailResult(
          'CIRCUIT_OPEN',
          `Circuit breaker for ${this.name} is open`,
          true,
          30 // Suggest retry after 30 seconds
        ),
        fromCache: false,
        deduplicated: false,
        durationMs: Date.now() - startTime,
      };
    }
    
    // 3. Check rate limit (atomic acquire)
    const rateLimiter = getRateLimiter();
    const rateLimit = await rateLimiter.tryAcquire(this.name, params.userId);
    
    if (!rateLimit.allowed) {
      return {
        result: this.createFailResult(
          'RATE_LIMITED',
          `Rate limit exceeded for ${this.name}`,
          true,
          Math.ceil(rateLimit.retryAfterMs / 1000)
        ),
        fromCache: false,
        deduplicated: false,
        durationMs: Date.now() - startTime,
      };
    }
    
    // 4. Check cache (with deduplication)
    const cache = getProviderCache<ProviderResult>();
    const cacheKey = this.getCacheKey(params);
    const cacheCategory = this.getCacheCategory();
    
    if (!params.bypassCache) {
      const cacheResult = await cache.getOrFetch(
        cacheKey,
        cacheCategory,
        () => this.fetchWithRetry(params, circuit),
      );
      
      return {
        result: cacheResult.result,
        fromCache: cacheResult.cacheHit,
        deduplicated: cacheResult.deduplicated,
        durationMs: Date.now() - startTime,
      };
    }
    
    // 5. Bypass cache - fetch directly
    const result = await this.fetchWithRetry(params, circuit);
    
    return {
      result,
      fromCache: false,
      deduplicated: false,
      durationMs: Date.now() - startTime,
    };
  }
  
  /**
   * Get current health status of this provider.
   */
  async getHealthStatus(): Promise<ProviderHealth> {
    const circuit = this.getCircuit();
    const rateLimiter = getRateLimiter();
    const rateLimit = await rateLimiter.check(this.name);
    
    return {
      name: this.name,
      available: this.isAvailable(),
      circuitState: circuit.getState(),
      consecutiveFailures: this.consecutiveFailures,
      rateLimitRemaining: rateLimit.limit - rateLimit.current,
      rateLimitResetMs: rateLimit.resetInMs,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PROTECTED HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get or create the circuit breaker for this provider.
   */
  protected getCircuit(): CircuitBreaker {
    return getExternalAPICircuit(this.name);
  }
  
  /**
   * Fetch with retry logic.
   */
  private async fetchWithRetry(
    params: ProviderFetchParams,
    circuit: CircuitBreaker
  ): Promise<ProviderResult> {
    try {
      const result = await circuit.fire(async () => {
        return withRetry(
          () => this.fetchInternal(params),
          { policy: this.retryPolicy }
        );
      });
      
      // Record success
      this.recordSuccess();
      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error);
      
      // Return error result
      return this.createFailResult(
        'FETCH_ERROR',
        error instanceof Error ? error.message : String(error),
        true
      );
    }
  }
  
  /**
   * Record a successful fetch.
   */
  protected recordSuccess(): void {
    this.lastSuccessAt = Date.now();
    this.lastError = null;
    this.consecutiveFailures = 0;
  }
  
  /**
   * Record a failed fetch.
   */
  protected recordFailure(error: unknown): void {
    this.lastError = error instanceof Error ? error.message : String(error);
    this.consecutiveFailures++;
  }
  
  /**
   * Create a successful result.
   */
  protected createOkResult(data: ProviderData, latencyMs: number = 0): ProviderOkResult {
    const category = this.categories[0] as LiveCategory;
    const freshnessPolicy = DEFAULT_FRESHNESS_POLICIES.get(category) ?? {
      maxAgeMs: 60000,
      serveStaleOnError: true,
    };
    
    return {
      ok: true,
      data,
      provider: this.name,
      fetchedAt: Date.now(),
      freshnessPolicy,
      latencyMs,
    };
  }
  
  /**
   * Create a failed result.
   */
  protected createFailResult(
    code: string,
    message: string,
    retryable: boolean,
    retryAfterSec?: number
  ): ProviderErrResult {
    const error: ProviderError = {
      code: this.mapErrorCode(code),
      message,
      provider: this.name,
      retryable,
      retryAfterMs: retryAfterSec ? retryAfterSec * 1000 : undefined,
    };
    
    return {
      ok: false,
      error,
      provider: this.name,
      attemptedAt: Date.now(),
      latencyMs: 0,
      fallbackAvailable: false,
    };
  }
  
  /**
   * Map internal error codes to ProviderErrorCode.
   */
  private mapErrorCode(code: string): ProviderErrorCode {
    const mapping: Record<string, ProviderErrorCode> = {
      'TIMEOUT': 'timeout',
      'NETWORK_ERROR': 'network_error',
      'RATE_LIMITED': 'rate_limited',
      'CIRCUIT_OPEN': 'network_error',
      'UNAUTHORIZED': 'auth_error',
      'INVALID_SYMBOL': 'invalid_symbol',
      'INVALID_CURRENCY': 'invalid_symbol',
      'INVALID_CURRENCY_PAIR': 'invalid_symbol',
      'INVALID_COIN': 'invalid_symbol',
      'INVALID_CITY': 'invalid_symbol',
      'INVALID_TIMEZONE': 'invalid_symbol',
      'SYMBOL_NOT_FOUND': 'invalid_symbol',
      'COIN_NOT_FOUND': 'invalid_symbol',
      'CITY_NOT_FOUND': 'invalid_symbol',
      'RATE_NOT_FOUND': 'not_available',
      'API_KEY_MISSING': 'auth_error',
      'PROVIDER_UNAVAILABLE': 'not_available',
      'FETCH_ERROR': 'unknown',
    };
    
    if (code.startsWith('HTTP_5')) return 'provider_error';
    if (code.startsWith('HTTP_4')) return 'invalid_response';
    
    return mapping[code] ?? 'unknown';
  }
}
