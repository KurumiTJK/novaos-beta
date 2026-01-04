// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER — Token Bucket Implementation
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../storage/index.js';
import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitContext,
  TierRateLimits,
} from './types.js';
import { DEFAULT_TIER_LIMITS, ANONYMOUS_LIMIT, ENDPOINT_LIMITS, type EndpointCategory } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMITER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class RateLimiter {
  private readonly prefix: string;
  private readonly tierLimits: TierRateLimits;
  
  constructor(
    private readonly store: KeyValueStore,
    options?: {
      prefix?: string;
      tierLimits?: Partial<TierRateLimits>;
    }
  ) {
    this.prefix = options?.prefix ?? 'ratelimit:';
    this.tierLimits = {
      ...DEFAULT_TIER_LIMITS,
      ...options?.tierLimits,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // KEY GENERATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  private getKey(identifier: string, category?: string): string {
    const parts = [this.prefix, identifier];
    if (category) {
      parts.push(category);
    }
    return parts.join(':');
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN CHECK METHOD
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Check and increment rate limit.
   */
  async check(
    ctx: RateLimitContext,
    category?: EndpointCategory
  ): Promise<RateLimitResult> {
    const config = this.getConfig(ctx.tier, category);
    const windowSeconds = Math.ceil(config.windowMs / 1000);
    const key = this.getKey(ctx.userId, category);
    
    // Increment counter
    const count = await this.store.incr(key);
    
    // Set expiry on first request
    if (count === 1) {
      await this.store.expire(key, windowSeconds);
    }
    
    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);
    const resetAt = Date.now() + windowSeconds * 1000;
    
    return {
      allowed,
      remaining,
      limit: config.maxRequests,
      resetMs: windowSeconds * 1000,
      resetAt,
      retryAfterMs: allowed ? undefined : windowSeconds * 1000,
    };
  }
  
  /**
   * Check rate limit without incrementing (peek).
   */
  async peek(
    ctx: RateLimitContext,
    category?: EndpointCategory
  ): Promise<RateLimitResult> {
    const config = this.getConfig(ctx.tier, category);
    const windowSeconds = Math.ceil(config.windowMs / 1000);
    const key = this.getKey(ctx.userId, category);
    
    const countStr = await this.store.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;
    
    const allowed = count < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);
    const resetAt = Date.now() + windowSeconds * 1000;
    
    return {
      allowed,
      remaining,
      limit: config.maxRequests,
      resetMs: windowSeconds * 1000,
      resetAt,
    };
  }
  
  /**
   * Reset rate limit for a user.
   */
  async reset(userId: string, category?: string): Promise<void> {
    const key = this.getKey(userId, category);
    await this.store.delete(key);
  }
  
  /**
   * Get current count for a user.
   */
  async getCount(userId: string, category?: string): Promise<number> {
    const key = this.getKey(userId, category);
    const countStr = await this.store.get(key);
    return countStr ? parseInt(countStr, 10) : 0;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIGURATION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  
  private getConfig(tier: string, category?: EndpointCategory): RateLimitConfig {
    // Check for endpoint-specific limits
    if (category && ENDPOINT_LIMITS[category]) {
      const categoryLimits = ENDPOINT_LIMITS[category];
      const categoryConfig = categoryLimits[tier as keyof typeof categoryLimits];
      if (categoryConfig) {
        return categoryConfig as RateLimitConfig;
      }
    }
    
    // Fall back to tier defaults
    if (tier === 'anonymous' || !this.tierLimits[tier as keyof TierRateLimits]) {
      return ANONYMOUS_LIMIT;
    }
    
    return this.tierLimits[tier as keyof TierRateLimits];
  }
  
  /**
   * Get limits for a specific tier.
   */
  getLimits(tier: string): RateLimitConfig {
    return this.getConfig(tier);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// IP-BASED RATE LIMITER
// ─────────────────────────────────────────────────────────────────────────────────

export class IpRateLimiter {
  private readonly prefix: string;
  private readonly config: RateLimitConfig;
  
  constructor(
    private readonly store: KeyValueStore,
    options?: {
      prefix?: string;
      windowMs?: number;
      maxRequests?: number;
    }
  ) {
    this.prefix = options?.prefix ?? 'ratelimit:ip:';
    this.config = {
      windowMs: options?.windowMs ?? 60 * 1000,
      maxRequests: options?.maxRequests ?? 100,
    };
  }
  
  private getKey(ip: string): string {
    // Normalize IP
    const normalizedIp = ip.replace(/[.:]/g, '_');
    return `${this.prefix}${normalizedIp}`;
  }
  
  async check(ip: string): Promise<RateLimitResult> {
    const windowSeconds = Math.ceil(this.config.windowMs / 1000);
    const key = this.getKey(ip);
    
    const count = await this.store.incr(key);
    
    if (count === 1) {
      await this.store.expire(key, windowSeconds);
    }
    
    const allowed = count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - count);
    const resetAt = Date.now() + windowSeconds * 1000;
    
    return {
      allowed,
      remaining,
      limit: this.config.maxRequests,
      resetMs: windowSeconds * 1000,
      resetAt,
      retryAfterMs: allowed ? undefined : windowSeconds * 1000,
    };
  }
  
  async reset(ip: string): Promise<void> {
    const key = this.getKey(ip);
    await this.store.delete(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCES
// ─────────────────────────────────────────────────────────────────────────────────

let rateLimiter: RateLimiter | null = null;
let ipRateLimiter: IpRateLimiter | null = null;

export function initRateLimiter(store: KeyValueStore): RateLimiter {
  rateLimiter = new RateLimiter(store);
  return rateLimiter;
}

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    throw new Error('RateLimiter not initialized. Call initRateLimiter() first.');
  }
  return rateLimiter;
}

export function initIpRateLimiter(store: KeyValueStore): IpRateLimiter {
  ipRateLimiter = new IpRateLimiter(store);
  return ipRateLimiter;
}

export function getIpRateLimiter(): IpRateLimiter {
  if (!ipRateLimiter) {
    throw new Error('IpRateLimiter not initialized. Call initIpRateLimiter() first.');
  }
  return ipRateLimiter;
}
