// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING MIDDLEWARE — Express Rate Limit Enforcement
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response, NextFunction } from 'express';
import type { SecureRequest } from '../auth/types.js';
import { getLogger } from '../../logging/index.js';
import {
  type RateLimitConfig,
  type RateLimitContext,
  type RateLimitEvent,
  type RateLimitResult,
  keyByUserOrIp,
} from './types.js';
import { getRateLimiter } from './token-bucket.js';
import {
  getLimitForPath,
  getAnonymousLimit,
  applyMultiplier,
  shouldSkipRateLimit,
  isRateLimitingEnabled,
  getCategoryForPath,
  type EndpointCategory,
} from './config.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'rate-limit' });

// ─────────────────────────────────────────────────────────────────────────────────
// EVENT EMITTER
// ─────────────────────────────────────────────────────────────────────────────────

type RateLimitEventHandler = (event: RateLimitEvent) => void | Promise<void>;

const eventHandlers: RateLimitEventHandler[] = [];

/**
 * Register a rate limit event handler.
 */
export function onRateLimitEvent(handler: RateLimitEventHandler): void {
  eventHandlers.push(handler);
}

/**
 * Emit a rate limit event.
 */
async function emitEvent(event: RateLimitEvent): Promise<void> {
  for (const handler of eventHandlers) {
    try {
      await handler(event);
    } catch (error) {
      logger.error('Rate limit event handler error', error instanceof Error ? error : undefined);
    }
  }
}

/**
 * Clear event handlers (for testing).
 * @internal
 */
export function clearRateLimitEventHandlers(): void {
  eventHandlers.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE HEADERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Set rate limit headers on response.
 */
function setRateLimitHeaders(res: Response, result: RateLimitResult): void {
  res.setHeader('X-RateLimit-Limit', result.limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
}

/**
 * Set retry-after header.
 */
function setRetryAfterHeader(res: Response, retryAfterMs: number): void {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
  res.setHeader('Retry-After', retryAfterSeconds);
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR RESPONSE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Send 429 Too Many Requests response.
 */
function sendTooManyRequests(
  res: Response,
  result: RateLimitResult,
  message?: string
): void {
  setRateLimitHeaders(res, result);
  setRetryAfterHeader(res, result.retryAfterMs ?? result.resetMs);

  res.status(429).json({
    error: message ?? 'Too many requests',
    code: 'RATE_LIMITED',
    retryAfter: Math.ceil((result.retryAfterMs ?? result.resetMs) / 1000),
    limit: result.limit,
    window: Math.ceil(result.resetMs / 1000),
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// BUILD CONTEXT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Build rate limit context from request.
 */
function buildContext(req: SecureRequest): RateLimitContext {
  return {
    userId: req.userId ?? req.user?.id as string ?? 'anonymous',
    tier: req.user?.tier ?? 'free',
    ip: getClientIp(req),
    path: req.path,
    method: req.method,
    isAuthenticated: req.isAuthenticated ?? false,
    requestId: req.context?.requestId as string ?? req.requestId,
  };
}

/**
 * Extract client IP from request.
 */
function getClientIp(req: SecureRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0];
    return first?.trim() ?? 'unknown';
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(',')[0];
    return first?.trim() ?? 'unknown';
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for rate limit middleware.
 */
export interface RateLimitOptions {
  /**
   * Custom rate limit config (overrides path-based config).
   */
  readonly config?: RateLimitConfig;

  /**
   * Endpoint category for config lookup.
   */
  readonly category?: EndpointCategory;

  /**
   * Custom key generator.
   */
  readonly keyGenerator?: (context: RateLimitContext) => string;

  /**
   * Skip function.
   */
  readonly skip?: (context: RateLimitContext) => boolean;

  /**
   * Custom error message.
   */
  readonly errorMessage?: string;

  /**
   * Whether to apply rate limit multiplier.
   */
  readonly applyMultiplier?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMIT MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create rate limiting middleware.
 * 
 * @example
 * // Auto-detect limits from path
 * app.use('/api', rateLimit());
 * 
 * // Custom config
 * app.use('/api/chat', rateLimit({ category: 'CHAT' }));
 * 
 * // Fully custom
 * app.use(rateLimit({
 *   config: { maxRequests: 10, windowMs: 60000 },
 *   keyGenerator: (ctx) => `custom:${ctx.userId}`,
 * }));
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    config: customConfig,
    category,
    keyGenerator = keyByUserOrIp,
    skip,
    errorMessage,
    applyMultiplier: shouldApplyMultiplier = true,
  } = options;

  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    // Check if rate limiting is enabled
    if (!isRateLimitingEnabled()) {
      next();
      return;
    }

    // Check skip paths
    if (shouldSkipRateLimit(req.path)) {
      next();
      return;
    }

    const context = buildContext(req);

    // Check custom skip function
    if (skip?.(context)) {
      next();
      return;
    }

    // Determine rate limit config
    let config: RateLimitConfig;
    if (customConfig) {
      config = customConfig;
    } else if (category) {
      config = context.isAuthenticated
        ? getLimitForPath(`/api/v1/${category.toLowerCase()}`, 'GET', context.tier)
        : getAnonymousLimit(req.path, req.method);
    } else {
      config = context.isAuthenticated
        ? getLimitForPath(req.path, req.method, context.tier)
        : getAnonymousLimit(req.path, req.method);
    }

    // Apply multiplier
    if (shouldApplyMultiplier) {
      config = applyMultiplier(config);
    }

    // Generate key
    const key = keyGenerator(context);

    // Check rate limit
    const limiter = getRateLimiter();
    const result = await limiter.check(key, config);

    // Set headers
    setRateLimitHeaders(res, result);

    if (!result.allowed) {
      // Emit event
      await emitEvent({
        type: 'rate_limit_exceeded',
        key,
        userId: context.userId,
        ip: context.ip,
        path: context.path,
        remaining: result.remaining,
        limit: result.limit,
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
      });

      logger.warn('Rate limit exceeded', {
        userId: context.userId,
        ip: context.ip,
        path: context.path,
        key,
        limit: result.limit,
      });

      sendTooManyRequests(res, result, errorMessage);
      return;
    }

    // Log when nearing limit
    if (result.remaining <= Math.ceil(result.limit * 0.1)) {
      await emitEvent({
        type: 'rate_limit_hit',
        key,
        userId: context.userId,
        ip: context.ip,
        path: context.path,
        remaining: result.remaining,
        limit: result.limit,
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
      });
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIALIZED MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit for chat/LLM endpoints.
 */
export function chatRateLimit() {
  return rateLimit({ category: 'CHAT' });
}

/**
 * Rate limit for goal creation.
 */
export function goalCreationRateLimit() {
  return rateLimit({ category: 'GOAL_CREATION' });
}

/**
 * Rate limit for spark generation.
 */
export function sparkGenerationRateLimit() {
  return rateLimit({ category: 'SPARK_GENERATION' });
}

/**
 * Rate limit for web fetch/SSRF.
 */
export function webFetchRateLimit() {
  return rateLimit({ category: 'WEB_FETCH' });
}

/**
 * Rate limit for authentication endpoints.
 */
export function authRateLimit() {
  return rateLimit({ category: 'AUTH' });
}

/**
 * Rate limit for admin endpoints.
 */
export function adminRateLimit() {
  return rateLimit({ category: 'ADMIN' });
}

/**
 * Strict rate limit (for sensitive operations).
 */
export function strictRateLimit(maxRequests: number = 5, windowMs: number = 60000) {
  return rateLimit({
    config: { maxRequests, windowMs },
    applyMultiplier: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// IP-BASED RATE LIMIT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * IP-based rate limit (ignores user ID).
 */
export function ipRateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return rateLimit({
    config: { maxRequests, windowMs },
    keyGenerator: (ctx) => `ip:${ctx.ip}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get current rate limit status for a request.
 */
export async function getRateLimitStatus(
  req: SecureRequest
): Promise<RateLimitResult> {
  const context = buildContext(req);
  const config = context.isAuthenticated
    ? getLimitForPath(req.path, req.method, context.tier)
    : getAnonymousLimit(req.path, req.method);

  const key = keyByUserOrIp(context);
  const limiter = getRateLimiter();

  return limiter.status(key, config);
}

/**
 * Reset rate limit for a user.
 */
export async function resetUserRateLimit(userId: string): Promise<void> {
  const limiter = getRateLimiter();
  await limiter.reset(`user:${userId}`);
}

/**
 * Reset rate limit for an IP.
 */
export async function resetIpRateLimit(ip: string): Promise<void> {
  const limiter = getRateLimiter();
  await limiter.reset(`ip:${ip}`);
}
