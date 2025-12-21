// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING TYPES — Token Bucket Rate Limiter
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import type { UserId } from '../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMIT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit configuration for an endpoint or category.
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window.
   */
  readonly maxRequests: number;

  /**
   * Time window in milliseconds.
   */
  readonly windowMs: number;

  /**
   * Maximum tokens in the bucket (for token bucket algorithm).
   * Defaults to maxRequests if not specified.
   */
  readonly maxTokens?: number;

  /**
   * Token refill rate per second.
   * Defaults to maxRequests / (windowMs / 1000).
   */
  readonly refillRate?: number;

  /**
   * Whether to skip rate limiting for certain conditions.
   */
  readonly skip?: (context: RateLimitContext) => boolean;

  /**
   * Custom key generator for rate limit buckets.
   */
  readonly keyGenerator?: (context: RateLimitContext) => string;
}

/**
 * Rate limit tier overrides.
 */
export interface TierRateLimits {
  readonly free: RateLimitConfig;
  readonly pro: RateLimitConfig;
  readonly enterprise: RateLimitConfig;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMIT CONTEXT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Context for rate limit decisions.
 */
export interface RateLimitContext {
  /**
   * User ID (or 'anonymous' for unauthenticated).
   */
  readonly userId: string;

  /**
   * User tier for tiered rate limits.
   */
  readonly tier: 'free' | 'pro' | 'enterprise';

  /**
   * Client IP address.
   */
  readonly ip: string;

  /**
   * Request path.
   */
  readonly path: string;

  /**
   * Request method.
   */
  readonly method: string;

  /**
   * Whether the request is authenticated.
   */
  readonly isAuthenticated: boolean;

  /**
   * Request ID for tracing.
   */
  readonly requestId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMIT RESULT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed.
   */
  readonly allowed: boolean;

  /**
   * Remaining requests/tokens in the current window.
   */
  readonly remaining: number;

  /**
   * Maximum requests/tokens allowed.
   */
  readonly limit: number;

  /**
   * Time in milliseconds until the limit resets.
   */
  readonly resetMs: number;

  /**
   * Unix timestamp when the limit resets.
   */
  readonly resetAt: number;

  /**
   * Time in milliseconds to wait before retrying (if not allowed).
   */
  readonly retryAfterMs?: number;

  /**
   * The rate limit key used.
   */
  readonly key: string;
}

/**
 * Create an allowed result.
 */
export function createAllowedResult(
  remaining: number,
  limit: number,
  resetMs: number,
  key: string
): RateLimitResult {
  return {
    allowed: true,
    remaining,
    limit,
    resetMs,
    resetAt: Date.now() + resetMs,
    key,
  };
}

/**
 * Create a denied result.
 */
export function createDeniedResult(
  remaining: number,
  limit: number,
  resetMs: number,
  retryAfterMs: number,
  key: string
): RateLimitResult {
  return {
    allowed: false,
    remaining,
    limit,
    resetMs,
    resetAt: Date.now() + resetMs,
    retryAfterMs,
    key,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMITER INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limiter interface.
 */
export interface RateLimiter {
  /**
   * Check and consume a rate limit token.
   */
  check(key: string, config: RateLimitConfig): Promise<RateLimitResult>;

  /**
   * Get current rate limit status without consuming.
   */
  status(key: string, config: RateLimitConfig): Promise<RateLimitResult>;

  /**
   * Reset rate limit for a key.
   */
  reset(key: string): Promise<void>;

  /**
   * Check if the limiter is available (Redis connected, etc.).
   */
  isAvailable(): boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMIT EVENTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit event for audit/metrics.
 */
export interface RateLimitEvent {
  readonly type: 'rate_limit_hit' | 'rate_limit_exceeded';
  readonly key: string;
  readonly userId?: string;
  readonly ip: string;
  readonly path: string;
  readonly remaining: number;
  readonly limit: number;
  readonly timestamp: string;
  readonly requestId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// KEY GENERATORS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate rate limit key by user ID.
 */
export function keyByUser(context: RateLimitContext): string {
  return `user:${context.userId}`;
}

/**
 * Generate rate limit key by IP address.
 */
export function keyByIp(context: RateLimitContext): string {
  return `ip:${context.ip}`;
}

/**
 * Generate rate limit key by user ID and path.
 */
export function keyByUserAndPath(context: RateLimitContext): string {
  return `user:${context.userId}:${context.path}`;
}

/**
 * Generate rate limit key by IP and path.
 */
export function keyByIpAndPath(context: RateLimitContext): string {
  return `ip:${context.ip}:${context.path}`;
}

/**
 * Generate rate limit key by user ID or IP (fallback for anonymous).
 */
export function keyByUserOrIp(context: RateLimitContext): string {
  if (context.isAuthenticated && context.userId !== 'anonymous') {
    return `user:${context.userId}`;
  }
  return `ip:${context.ip}`;
}
