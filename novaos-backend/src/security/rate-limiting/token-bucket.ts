// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN BUCKET RATE LIMITER — Redis-backed Distributed Rate Limiting
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import { getStore, type KeyValueStore } from '../../storage/index.js';
import { getLogger } from '../../logging/index.js';
import {
  type RateLimiter,
  type RateLimitConfig,
  type RateLimitResult,
  createAllowedResult,
  createDeniedResult,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'rate-limiter' });

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN BUCKET STATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Token bucket state stored in Redis/Memory.
 */
interface BucketState {
  tokens: number;
  lastRefill: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN BUCKET IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Token bucket rate limiter.
 * 
 * The token bucket algorithm:
 * - Bucket holds up to `maxTokens` tokens
 * - Tokens are refilled at `refillRate` per second
 * - Each request consumes 1 token
 * - If no tokens available, request is rejected
 * 
 * This implementation uses Redis for distributed rate limiting.
 */
export class TokenBucketLimiter implements RateLimiter {
  private readonly store: KeyValueStore;
  private readonly keyPrefix: string;

  constructor(store?: KeyValueStore, keyPrefix: string = 'ratelimit:tb:') {
    this.store = store ?? getStore();
    this.keyPrefix = keyPrefix;
  }

  /**
   * Check and consume a rate limit token.
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const fullKey = this.keyPrefix + key;
    const now = Date.now();
    
    const maxTokens = config.maxTokens ?? config.maxRequests;
    const refillRate = config.refillRate ?? (config.maxRequests / (config.windowMs / 1000));
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    try {
      // Get current bucket state
      const stateData = await this.store.get(fullKey);
      let state: BucketState;

      if (stateData) {
        state = JSON.parse(stateData);
      } else {
        // Initialize new bucket with full tokens
        state = {
          tokens: maxTokens,
          lastRefill: now,
        };
      }

      // Calculate tokens to refill based on elapsed time
      const elapsedSeconds = (now - state.lastRefill) / 1000;
      const tokensToAdd = elapsedSeconds * refillRate;
      
      // Refill tokens (capped at max)
      state.tokens = Math.min(maxTokens, state.tokens + tokensToAdd);
      state.lastRefill = now;

      // Check if we have tokens available
      if (state.tokens >= 1) {
        // Consume a token
        state.tokens -= 1;
        
        // Save state
        await this.store.set(fullKey, JSON.stringify(state), windowSeconds);

        const remaining = Math.floor(state.tokens);
        const resetMs = Math.ceil((maxTokens - state.tokens) / refillRate * 1000);

        return createAllowedResult(remaining, maxTokens, resetMs, key);
      } else {
        // No tokens available
        // Save state (to track time for refill)
        await this.store.set(fullKey, JSON.stringify(state), windowSeconds);

        const remaining = 0;
        const tokensNeeded = 1 - state.tokens;
        const retryAfterMs = Math.ceil(tokensNeeded / refillRate * 1000);
        const resetMs = Math.ceil(maxTokens / refillRate * 1000);

        return createDeniedResult(remaining, maxTokens, resetMs, retryAfterMs, key);
      }
    } catch (error) {
      logger.error('Token bucket check failed', error instanceof Error ? error : undefined, { key });
      
      // Fail open — allow request if rate limiter fails
      return createAllowedResult(config.maxRequests, config.maxRequests, config.windowMs, key);
    }
  }

  /**
   * Get current rate limit status without consuming.
   */
  async status(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const fullKey = this.keyPrefix + key;
    const now = Date.now();
    
    const maxTokens = config.maxTokens ?? config.maxRequests;
    const refillRate = config.refillRate ?? (config.maxRequests / (config.windowMs / 1000));

    try {
      const stateData = await this.store.get(fullKey);
      
      if (!stateData) {
        // No state = full bucket
        return createAllowedResult(maxTokens, maxTokens, 0, key);
      }

      const state: BucketState = JSON.parse(stateData);
      
      // Calculate current tokens with refill
      const elapsedSeconds = (now - state.lastRefill) / 1000;
      const tokensToAdd = elapsedSeconds * refillRate;
      const currentTokens = Math.min(maxTokens, state.tokens + tokensToAdd);

      const remaining = Math.floor(currentTokens);
      const resetMs = Math.ceil((maxTokens - currentTokens) / refillRate * 1000);

      if (currentTokens >= 1) {
        return createAllowedResult(remaining, maxTokens, resetMs, key);
      } else {
        const tokensNeeded = 1 - currentTokens;
        const retryAfterMs = Math.ceil(tokensNeeded / refillRate * 1000);
        return createDeniedResult(0, maxTokens, resetMs, retryAfterMs, key);
      }
    } catch (error) {
      logger.error('Token bucket status failed', error instanceof Error ? error : undefined, { key });
      return createAllowedResult(maxTokens, maxTokens, 0, key);
    }
  }

  /**
   * Reset rate limit for a key.
   */
  async reset(key: string): Promise<void> {
    const fullKey = this.keyPrefix + key;
    try {
      await this.store.delete(fullKey);
    } catch (error) {
      logger.error('Token bucket reset failed', error instanceof Error ? error : undefined, { key });
    }
  }

  /**
   * Check if the limiter is available.
   */
  isAvailable(): boolean {
    return this.store.isConnected();
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SLIDING WINDOW COUNTER (Alternative Implementation)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sliding window counter rate limiter.
 * 
 * Simpler than token bucket but less precise.
 * Uses Redis INCR with TTL for counting.
 */
export class SlidingWindowLimiter implements RateLimiter {
  private readonly store: KeyValueStore;
  private readonly keyPrefix: string;

  constructor(store?: KeyValueStore, keyPrefix: string = 'ratelimit:sw:') {
    this.store = store ?? getStore();
    this.keyPrefix = keyPrefix;
  }

  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const windowSeconds = Math.ceil(config.windowMs / 1000);
    const fullKey = `${this.keyPrefix}${key}:${Math.floor(Date.now() / config.windowMs)}`;

    try {
      // Increment counter
      const count = await this.store.incr(fullKey);
      
      // Set expiry on first request
      if (count === 1) {
        await this.store.expire(fullKey, windowSeconds);
      }

      const remaining = Math.max(0, config.maxRequests - count);
      const resetMs = config.windowMs - (Date.now() % config.windowMs);

      if (count <= config.maxRequests) {
        return createAllowedResult(remaining, config.maxRequests, resetMs, key);
      } else {
        return createDeniedResult(0, config.maxRequests, resetMs, resetMs, key);
      }
    } catch (error) {
      logger.error('Sliding window check failed', error instanceof Error ? error : undefined, { key });
      return createAllowedResult(config.maxRequests, config.maxRequests, config.windowMs, key);
    }
  }

  async status(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const fullKey = `${this.keyPrefix}${key}:${Math.floor(Date.now() / config.windowMs)}`;

    try {
      const countStr = await this.store.get(fullKey);
      const count = countStr ? parseInt(countStr, 10) : 0;
      
      const remaining = Math.max(0, config.maxRequests - count);
      const resetMs = config.windowMs - (Date.now() % config.windowMs);

      if (count < config.maxRequests) {
        return createAllowedResult(remaining, config.maxRequests, resetMs, key);
      } else {
        return createDeniedResult(0, config.maxRequests, resetMs, resetMs, key);
      }
    } catch (error) {
      logger.error('Sliding window status failed', error instanceof Error ? error : undefined, { key });
      return createAllowedResult(config.maxRequests, config.maxRequests, config.windowMs, key);
    }
  }

  async reset(key: string): Promise<void> {
    // Delete all window keys for this key
    try {
      const pattern = `${this.keyPrefix}${key}:*`;
      const keys = await this.store.keys(pattern);
      for (const k of keys) {
        await this.store.delete(k);
      }
    } catch (error) {
      logger.error('Sliding window reset failed', error instanceof Error ? error : undefined, { key });
    }
  }

  isAvailable(): boolean {
    return this.store.isConnected();
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCES
// ─────────────────────────────────────────────────────────────────────────────────

let tokenBucketInstance: TokenBucketLimiter | null = null;
let slidingWindowInstance: SlidingWindowLimiter | null = null;

/**
 * Get the token bucket limiter singleton.
 */
export function getTokenBucketLimiter(): TokenBucketLimiter {
  if (!tokenBucketInstance) {
    tokenBucketInstance = new TokenBucketLimiter();
  }
  return tokenBucketInstance;
}

/**
 * Get the sliding window limiter singleton.
 */
export function getSlidingWindowLimiter(): SlidingWindowLimiter {
  if (!slidingWindowInstance) {
    slidingWindowInstance = new SlidingWindowLimiter();
  }
  return slidingWindowInstance;
}

/**
 * Get the default rate limiter (token bucket).
 */
export function getRateLimiter(): RateLimiter {
  return getTokenBucketLimiter();
}

/**
 * Initialize rate limiter with custom store.
 */
export function initRateLimiter(store: KeyValueStore): TokenBucketLimiter {
  tokenBucketInstance = new TokenBucketLimiter(store);
  return tokenBucketInstance;
}

/**
 * Reset rate limiter instances (for testing).
 * @internal
 */
export function resetRateLimiter(): void {
  tokenBucketInstance = null;
  slidingWindowInstance = null;
}
