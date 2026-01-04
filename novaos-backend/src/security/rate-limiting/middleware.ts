// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT MIDDLEWARE — Express Rate Limiting
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/types.js';
import type {
  RateLimitMiddlewareOptions,
  RateLimitContext,
  RateLimitEvent,
  RateLimitEventType,
  EndpointCategory,
} from './types.js';
import { getRateLimiter, getIpRateLimiter } from './limiter.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────────

type RateLimitEventHandler = (event: RateLimitEvent) => void;
const eventHandlers: RateLimitEventHandler[] = [];

export function onRateLimitEvent(handler: RateLimitEventHandler): void {
  eventHandlers.push(handler);
}

export function clearRateLimitEventHandlers(): void {
  eventHandlers.length = 0;
}

function emitEvent(
  type: RateLimitEventType,
  ctx: RateLimitContext,
  remaining: number,
  limit: number
): void {
  const event: RateLimitEvent = {
    type,
    userId: ctx.userId,
    tier: ctx.tier,
    ip: ctx.ip,
    path: ctx.path,
    timestamp: Date.now(),
    remaining,
    limit,
  };
  
  for (const handler of eventHandlers) {
    try {
      handler(event);
    } catch (error) {
      console.error('[RATE_LIMIT] Event handler error:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────────

export const RateLimitErrorCode = {
  RATE_LIMITED: 'RATE_LIMITED',
  IP_RATE_LIMITED: 'IP_RATE_LIMITED',
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limiting middleware.
 * 
 * @example
 * // Default rate limiting
 * router.use(rateLimit());
 * 
 * // Category-specific limits
 * router.post('/chat', rateLimit({ category: 'chat' }), handler);
 * 
 * // Skip certain paths
 * app.use(rateLimit({ skipPaths: ['/health', '/metrics'] }));
 */
export function rateLimit(options: RateLimitMiddlewareOptions = {}) {
  const {
    category,
    keyGenerator,
    skip,
    skipPaths = ['/health', '/ready', '/metrics'],
    includeIp = false,
    errorMessage = 'Rate limit exceeded',
  } = options;
  
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Check skip paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // Build context
    const ctx: RateLimitContext = {
      userId: req.userId ?? req.user?.userId ?? 'anonymous',
      tier: req.user?.tier ?? 'free',
      ip: req.ip ?? req.socket?.remoteAddress,
      path: req.path,
      method: req.method,
    };
    
    // Check skip function
    if (skip && skip(ctx)) {
      return next();
    }
    
    try {
      const limiter = getRateLimiter();
      
      // Generate key
      let key = ctx.userId;
      if (keyGenerator) {
        key = keyGenerator(ctx);
      } else if (includeIp && ctx.ip) {
        key = `${ctx.userId}:${ctx.ip}`;
      }
      
      // Check rate limit
      const result = await limiter.check({ ...ctx, userId: key }, category);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
      
      if (!result.allowed) {
        emitEvent('rate_limit_exceeded', ctx, result.remaining, result.limit);
        
        res.setHeader('Retry-After', Math.ceil((result.retryAfterMs ?? 60000) / 1000));
        
        res.status(429).json({
          error: errorMessage,
          code: RateLimitErrorCode.RATE_LIMITED,
          retryAfter: Math.ceil((result.retryAfterMs ?? 60000) / 1000),
          limit: result.limit,
          resetAt: result.resetAt,
        });
        return;
      }
      
      // Emit hit event when getting close to limit
      if (result.remaining < result.limit * 0.2) {
        emitEvent('rate_limit_hit', ctx, result.remaining, result.limit);
      }
      
      next();
    } catch (error) {
      // Fail open - don't block on rate limit errors
      console.error('[RATE_LIMIT] Error:', error);
      next();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIALIZED MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit for chat endpoint.
 */
export function chatRateLimit() {
  return rateLimit({ category: 'chat' });
}

/**
 * Rate limit for auth endpoints.
 */
export function authRateLimit() {
  return rateLimit({
    category: 'auth',
    includeIp: true,
    errorMessage: 'Too many authentication attempts',
  });
}

/**
 * Rate limit for admin endpoints.
 */
export function adminRateLimit() {
  return rateLimit({ category: 'admin' });
}

/**
 * Rate limit for expensive operations.
 */
export function expensiveRateLimit() {
  return rateLimit({
    category: 'expensive',
    errorMessage: 'Too many expensive operations',
  });
}

/**
 * IP-based rate limiting (global).
 */
export function ipRateLimit() {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const ip = req.ip ?? req.socket?.remoteAddress;
    
    if (!ip) {
      return next();
    }
    
    try {
      const limiter = getIpRateLimiter();
      const result = await limiter.check(ip);
      
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      
      if (!result.allowed) {
        res.status(429).json({
          error: 'IP rate limit exceeded',
          code: RateLimitErrorCode.IP_RATE_LIMITED,
          retryAfter: Math.ceil((result.retryAfterMs ?? 60000) / 1000),
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('[IP_RATE_LIMIT] Error:', error);
      next();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Reset rate limit for a user.
 */
export async function resetUserRateLimit(
  userId: string,
  category?: EndpointCategory
): Promise<void> {
  const limiter = getRateLimiter();
  await limiter.reset(userId, category);
}

/**
 * Reset IP rate limit.
 */
export async function resetIpRateLimit(ip: string): Promise<void> {
  const limiter = getIpRateLimiter();
  await limiter.reset(ip);
}

/**
 * Get current rate limit status.
 */
export async function getRateLimitStatus(
  userId: string,
  category?: EndpointCategory
): Promise<{ count: number; limit: number }> {
  const limiter = getRateLimiter();
  const count = await limiter.getCount(userId, category);
  const limits = limiter.getLimits('free'); // Default to free tier
  
  return { count, limit: limits.maxRequests };
}
