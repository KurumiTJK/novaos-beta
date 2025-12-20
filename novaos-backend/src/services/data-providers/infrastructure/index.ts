// ═══════════════════════════════════════════════════════════════════════════════
// DATA PROVIDERS INFRASTRUCTURE INDEX — Barrel Export
// Provides resilient infrastructure for external API calls
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMITER — Atomic Rate Limiting
// ─────────────────────────────────────────────────────────────────────────────────

export {
  RateLimiter,
  getRateLimiter,
  createRateLimiter,
  rateLimiter,
  DEFAULT_PROVIDER_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limiter.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CACHE — Bounded LRU with O(1) Eviction
// ─────────────────────────────────────────────────────────────────────────────────

export {
  ProviderCache,
  getProviderCache,
  createProviderCache,
  providerCache,
  DEFAULT_TTL_BY_CATEGORY,
  DEFAULT_CACHE_CONFIG,
  type CacheableCategory,
  type CacheConfig,
  type CacheEntryMeta,
  type CacheGetResult,
  type CacheFetchResult,
} from './cache.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RETRY — Jittered Exponential Backoff
// ─────────────────────────────────────────────────────────────────────────────────

export {
  withRetry,
  makeRetryable,
  withRetryAll,
  withRetryTimeout,
  calculateBackoffDelay,
  isRetryableError,
  DEFAULT_RETRY_POLICY,
  AGGRESSIVE_RETRY_POLICY,
  CONSERVATIVE_RETRY_POLICY,
  NO_RETRY_POLICY,
  type RetryPolicy,
  type RetryContext,
  type RetryOptions,
  type RetryableResult,
} from './retry.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS FROM EXISTING SERVICES
// These already exist in your codebase - import from their locations
// ─────────────────────────────────────────────────────────────────────────────────

// Circuit Breaker: import from '../../circuit-breaker.js'
// Fetch Client: import from '../../web/fetch-client.js'

/**
 * Example usage combining all infrastructure components:
 * 
 * ```typescript
 * import {
 *   rateLimiter,
 *   providerCache,
 *   withRetry,
 *   DEFAULT_RETRY_POLICY,
 * } from './infrastructure/index.js';
 * import { getExternalAPICircuit } from '../../circuit-breaker.js';
 * import { getFetchClient } from '../../web/fetch-client.js';
 * 
 * async function fetchWithResilience(url: string, provider: string, userId?: string) {
 *   // 1. Check rate limit
 *   const rateLimit = await rateLimiter.tryAcquire(provider, userId);
 *   if (!rateLimit.allowed) {
 *     throw new Error(`Rate limited. Retry after ${rateLimit.retryAfterMs}ms`);
 *   }
 * 
 *   // 2. Check cache
 *   const cacheResult = await providerCache.getOrFetch(
 *     url,
 *     'market',
 *     async () => {
 *       // 3. Use circuit breaker
 *       const circuit = getExternalAPICircuit(provider);
 *       
 *       return circuit.fire(async () => {
 *         // 4. Retry with backoff
 *         return withRetry(
 *           async () => {
 *             const client = getFetchClient();
 *             const result = await client.fetch(url);
 *             if (!result.success) throw new Error(result.error);
 *             return JSON.parse(result.content ?? '{}');
 *           },
 *           { policy: DEFAULT_RETRY_POLICY }
 *         );
 *       });
 *     }
 *   );
 * 
 *   return cacheResult;
 * }
 * ```
 */
