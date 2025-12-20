// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER — Atomic Rate Limiting for Data Providers
// Prevents API abuse with per-provider and per-user limits
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit configuration for a provider.
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  readonly maxRequests: number;
  /** Window duration in milliseconds */
  readonly windowMs: number;
  /** Optional per-user limit (defaults to provider limit) */
  readonly perUserLimit?: number;
  /** Optional per-user window (defaults to provider window) */
  readonly perUserWindowMs?: number;
}

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  readonly allowed: boolean;
  /** Current request count in window */
  readonly current: number;
  /** Maximum allowed requests */
  readonly limit: number;
  /** Milliseconds until window resets */
  readonly resetInMs: number;
  /** Milliseconds until a slot is available (0 if allowed) */
  readonly retryAfterMs: number;
}

/**
 * Internal bucket for tracking request counts.
 */
interface TokenBucket {
  /** Request timestamps within the current window */
  timestamps: number[];
  /** Window start time */
  windowStart: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Default rate limits by provider.
 * These are conservative defaults - adjust based on your API quotas.
 */
export const DEFAULT_PROVIDER_LIMITS: Readonly<Record<string, RateLimitConfig>> = {
  // Stock/Market data
  'alpha-vantage': {
    maxRequests: 5,
    windowMs: 60_000,      // 5 per minute (free tier)
    perUserLimit: 2,
    perUserWindowMs: 60_000,
  },
  'finnhub': {
    maxRequests: 60,
    windowMs: 60_000,      // 60 per minute
    perUserLimit: 10,
    perUserWindowMs: 60_000,
  },
  'polygon': {
    maxRequests: 5,
    windowMs: 60_000,      // 5 per minute (free tier)
    perUserLimit: 2,
    perUserWindowMs: 60_000,
  },
  
  // Weather
  'openweathermap': {
    maxRequests: 60,
    windowMs: 60_000,      // 60 per minute
    perUserLimit: 10,
    perUserWindowMs: 60_000,
  },
  'weatherapi': {
    maxRequests: 100,
    windowMs: 60_000,      // Depends on plan
    perUserLimit: 20,
    perUserWindowMs: 60_000,
  },
  
  // Crypto
  'coingecko': {
    maxRequests: 10,
    windowMs: 60_000,      // 10-50 per minute (free tier)
    perUserLimit: 5,
    perUserWindowMs: 60_000,
  },
  'coinmarketcap': {
    maxRequests: 30,
    windowMs: 60_000,      // 30 per minute (basic)
    perUserLimit: 10,
    perUserWindowMs: 60_000,
  },
  
  // FX
  'exchangerate-api': {
    maxRequests: 100,
    windowMs: 60_000,      // Generous
    perUserLimit: 20,
    perUserWindowMs: 60_000,
  },
  'fixer': {
    maxRequests: 100,
    windowMs: 3600_000,    // 100 per hour (free tier)
    perUserLimit: 20,
    perUserWindowMs: 3600_000,
  },
  
  // Time
  'worldtimeapi': {
    maxRequests: 100,
    windowMs: 60_000,
    perUserLimit: 30,
    perUserWindowMs: 60_000,
  },
  
  // Default for unknown providers
  'default': {
    maxRequests: 30,
    windowMs: 60_000,
    perUserLimit: 10,
    perUserWindowMs: 60_000,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMITER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Atomic rate limiter for data providers.
 * 
 * Key features:
 * - Per-provider rate limits
 * - Per-user rate limits (optional)
 * - Atomic check-and-increment (no race conditions)
 * - Sliding window algorithm
 * - Automatic cleanup of expired buckets
 * 
 * @example
 * const limiter = new RateLimiter();
 * 
 * const result = await limiter.tryAcquire('alpha-vantage', 'user-123');
 * if (result.allowed) {
 *   // Make API request
 * } else {
 *   // Wait or return cached data
 *   console.log(`Retry after ${result.retryAfterMs}ms`);
 * }
 */
export class RateLimiter {
  /** Provider-level buckets: provider -> bucket */
  private readonly providerBuckets: Map<string, TokenBucket> = new Map();
  
  /** User-level buckets: `${provider}:${userId}` -> bucket */
  private readonly userBuckets: Map<string, TokenBucket> = new Map();
  
  /** Custom configurations per provider */
  private readonly configs: Map<string, RateLimitConfig> = new Map();
  
  /** Lock to ensure atomic operations */
  private lockPromise: Promise<void> | null = null;
  
  /** Cleanup interval handle */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  
  /** Cleanup interval in ms (default: 5 minutes) */
  private readonly cleanupIntervalMs: number;
  
  constructor(options?: { cleanupIntervalMs?: number }) {
    this.cleanupIntervalMs = options?.cleanupIntervalMs ?? 300_000;
    this.startCleanupTimer();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Attempt to acquire a rate limit slot.
   * 
   * This operation is ATOMIC - check and increment happen together
   * with no race condition window.
   * 
   * @param provider - The provider identifier
   * @param userId - Optional user identifier for per-user limits
   * @returns Rate limit result
   */
  async tryAcquire(provider: string, userId?: string): Promise<RateLimitResult> {
    // Acquire lock for atomic operation
    await this.acquireLock();
    
    try {
      const config = this.getConfig(provider);
      const now = Date.now();
      
      // Check provider-level limit
      const providerResult = this.checkAndIncrement(
        this.providerBuckets,
        provider,
        config.maxRequests,
        config.windowMs,
        now
      );
      
      if (!providerResult.allowed) {
        return providerResult;
      }
      
      // Check user-level limit if userId provided
      if (userId) {
        const userKey = `${provider}:${userId}`;
        const userLimit = config.perUserLimit ?? config.maxRequests;
        const userWindow = config.perUserWindowMs ?? config.windowMs;
        
        const userResult = this.checkAndIncrement(
          this.userBuckets,
          userKey,
          userLimit,
          userWindow,
          now
        );
        
        if (!userResult.allowed) {
          // Rollback provider increment since user is limited
          this.rollbackIncrement(this.providerBuckets, provider, now);
          return userResult;
        }
      }
      
      return providerResult;
    } finally {
      this.releaseLock();
    }
  }
  
  /**
   * Check rate limit status without consuming a slot.
   * 
   * @param provider - The provider identifier
   * @param userId - Optional user identifier
   * @returns Current rate limit status
   */
  async check(provider: string, userId?: string): Promise<RateLimitResult> {
    await this.acquireLock();
    
    try {
      const config = this.getConfig(provider);
      const now = Date.now();
      
      // Check provider-level
      const providerStatus = this.getStatus(
        this.providerBuckets,
        provider,
        config.maxRequests,
        config.windowMs,
        now
      );
      
      if (!providerStatus.allowed) {
        return providerStatus;
      }
      
      // Check user-level if userId provided
      if (userId) {
        const userKey = `${provider}:${userId}`;
        const userLimit = config.perUserLimit ?? config.maxRequests;
        const userWindow = config.perUserWindowMs ?? config.windowMs;
        
        const userStatus = this.getStatus(
          this.userBuckets,
          userKey,
          userLimit,
          userWindow,
          now
        );
        
        // Return the more restrictive result
        if (!userStatus.allowed || userStatus.retryAfterMs > providerStatus.retryAfterMs) {
          return userStatus;
        }
      }
      
      return providerStatus;
    } finally {
      this.releaseLock();
    }
  }
  
  /**
   * Set custom rate limit configuration for a provider.
   * 
   * @param provider - The provider identifier
   * @param config - The rate limit configuration
   */
  setConfig(provider: string, config: RateLimitConfig): void {
    this.configs.set(provider, config);
  }
  
  /**
   * Get rate limit configuration for a provider.
   * 
   * @param provider - The provider identifier
   * @returns The rate limit configuration
   */
  getConfig(provider: string): RateLimitConfig {
    return this.configs.get(provider) 
      ?? DEFAULT_PROVIDER_LIMITS[provider] 
      ?? DEFAULT_PROVIDER_LIMITS['default']!;
  }
  
  /**
   * Reset rate limits for a provider (and optionally a user).
   * 
   * @param provider - The provider identifier
   * @param userId - Optional user identifier
   */
  async reset(provider: string, userId?: string): Promise<void> {
    await this.acquireLock();
    
    try {
      if (userId) {
        this.userBuckets.delete(`${provider}:${userId}`);
      } else {
        this.providerBuckets.delete(provider);
        // Also clear all user buckets for this provider
        for (const key of this.userBuckets.keys()) {
          if (key.startsWith(`${provider}:`)) {
            this.userBuckets.delete(key);
          }
        }
      }
    } finally {
      this.releaseLock();
    }
  }
  
  /**
   * Clean up expired user buckets to free memory.
   * Called automatically on interval, but can be called manually.
   */
  async cleanupUserBuckets(): Promise<number> {
    await this.acquireLock();
    
    try {
      const now = Date.now();
      let cleaned = 0;
      
      // Clean user buckets
      for (const [key, bucket] of this.userBuckets.entries()) {
        const provider = key.split(':')[0] ?? 'default';
        const config = this.getConfig(provider);
        const windowMs = config.perUserWindowMs ?? config.windowMs;
        
        // Remove if bucket is older than 2x the window
        if (now - bucket.windowStart > windowMs * 2) {
          this.userBuckets.delete(key);
          cleaned++;
        }
      }
      
      // Clean provider buckets (less aggressive)
      for (const [provider, bucket] of this.providerBuckets.entries()) {
        const config = this.getConfig(provider);
        
        // Remove if bucket is older than 2x the window
        if (now - bucket.windowStart > config.windowMs * 2) {
          this.providerBuckets.delete(provider);
          cleaned++;
        }
      }
      
      return cleaned;
    } finally {
      this.releaseLock();
    }
  }
  
  /**
   * Get statistics about current rate limiter state.
   */
  getStats(): {
    providerBucketCount: number;
    userBucketCount: number;
    providers: Record<string, { current: number; limit: number }>;
  } {
    const now = Date.now();
    const providers: Record<string, { current: number; limit: number }> = {};
    
    for (const [provider, bucket] of this.providerBuckets.entries()) {
      const config = this.getConfig(provider);
      const validTimestamps = bucket.timestamps.filter(
        ts => now - ts < config.windowMs
      );
      providers[provider] = {
        current: validTimestamps.length,
        limit: config.maxRequests,
      };
    }
    
    return {
      providerBucketCount: this.providerBuckets.size,
      userBucketCount: this.userBuckets.size,
      providers,
    };
  }
  
  /**
   * Stop the cleanup timer.
   * Call this when shutting down.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL METHODS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Acquire the lock for atomic operations.
   */
  private async acquireLock(): Promise<void> {
    while (this.lockPromise) {
      await this.lockPromise;
    }
    
    let releaseLock: () => void;
    this.lockPromise = new Promise(resolve => {
      releaseLock = resolve;
    });
    
    // Store the release function
    (this.lockPromise as Promise<void> & { release?: () => void }).release = releaseLock!;
  }
  
  /**
   * Release the lock.
   */
  private releaseLock(): void {
    const promise = this.lockPromise as Promise<void> & { release?: () => void };
    this.lockPromise = null;
    promise?.release?.();
  }
  
  /**
   * Check and atomically increment the counter.
   */
  private checkAndIncrement(
    buckets: Map<string, TokenBucket>,
    key: string,
    limit: number,
    windowMs: number,
    now: number
  ): RateLimitResult {
    let bucket = buckets.get(key);
    
    if (!bucket) {
      bucket = { timestamps: [], windowStart: now };
      buckets.set(key, bucket);
    }
    
    // Remove expired timestamps (sliding window)
    const windowStart = now - windowMs;
    bucket.timestamps = bucket.timestamps.filter(ts => ts > windowStart);
    bucket.windowStart = Math.max(bucket.windowStart, windowStart);
    
    const current = bucket.timestamps.length;
    const resetInMs = bucket.timestamps.length > 0
      ? Math.max(0, (bucket.timestamps[0] ?? now) + windowMs - now)
      : windowMs;
    
    if (current >= limit) {
      // Rate limited
      const oldestTimestamp = bucket.timestamps[0] ?? now;
      const retryAfterMs = Math.max(0, oldestTimestamp + windowMs - now);
      
      return {
        allowed: false,
        current,
        limit,
        resetInMs,
        retryAfterMs,
      };
    }
    
    // Allowed - record the timestamp
    bucket.timestamps.push(now);
    
    return {
      allowed: true,
      current: current + 1,
      limit,
      resetInMs,
      retryAfterMs: 0,
    };
  }
  
  /**
   * Get status without incrementing.
   */
  private getStatus(
    buckets: Map<string, TokenBucket>,
    key: string,
    limit: number,
    windowMs: number,
    now: number
  ): RateLimitResult {
    const bucket = buckets.get(key);
    
    if (!bucket) {
      return {
        allowed: true,
        current: 0,
        limit,
        resetInMs: windowMs,
        retryAfterMs: 0,
      };
    }
    
    // Count valid timestamps
    const windowStart = now - windowMs;
    const validTimestamps = bucket.timestamps.filter(ts => ts > windowStart);
    const current = validTimestamps.length;
    
    const resetInMs = validTimestamps.length > 0
      ? Math.max(0, (validTimestamps[0] ?? now) + windowMs - now)
      : windowMs;
    
    if (current >= limit) {
      const oldestTimestamp = validTimestamps[0] ?? now;
      const retryAfterMs = Math.max(0, oldestTimestamp + windowMs - now);
      
      return {
        allowed: false,
        current,
        limit,
        resetInMs,
        retryAfterMs,
      };
    }
    
    return {
      allowed: true,
      current,
      limit,
      resetInMs,
      retryAfterMs: 0,
    };
  }
  
  /**
   * Rollback an increment (remove the most recent timestamp).
   */
  private rollbackIncrement(
    buckets: Map<string, TokenBucket>,
    key: string,
    timestamp: number
  ): void {
    const bucket = buckets.get(key);
    if (bucket) {
      const index = bucket.timestamps.lastIndexOf(timestamp);
      if (index !== -1) {
        bucket.timestamps.splice(index, 1);
      }
    }
  }
  
  /**
   * Start the automatic cleanup timer.
   */
  private startCleanupTimer(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupUserBuckets().catch(err => {
        console.error('[RATE_LIMITER] Cleanup error:', err);
      });
    }, this.cleanupIntervalMs);
    
    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get the singleton rate limiter instance.
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}

/**
 * Create a new rate limiter instance (for testing or isolated use).
 */
export function createRateLimiter(options?: { cleanupIntervalMs?: number }): RateLimiter {
  return new RateLimiter(options);
}

// Default export for convenience
export const rateLimiter = getRateLimiter();
