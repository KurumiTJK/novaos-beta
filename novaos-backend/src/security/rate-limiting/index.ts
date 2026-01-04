// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING MODULE — Barrel Exports
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export type {
  RateLimitConfig,
  TierRateLimits,
  RateLimitResult,
  RateLimitContext,
  RateLimitMiddlewareOptions,
  RateLimitEventType,
  RateLimitEvent,
  EndpointCategory,
} from './types.js';

export {
  DEFAULT_TIER_LIMITS,
  ANONYMOUS_LIMIT,
  ENDPOINT_LIMITS,
} from './types.js';

// Limiter
export {
  RateLimiter,
  IpRateLimiter,
  initRateLimiter,
  getRateLimiter,
  initIpRateLimiter,
  getIpRateLimiter,
} from './limiter.js';

// Middleware
export {
  rateLimit,
  chatRateLimit,
  authRateLimit,
  adminRateLimit,
  expensiveRateLimit,
  ipRateLimit,
  onRateLimitEvent,
  clearRateLimitEventHandlers,
  resetUserRateLimit,
  resetIpRateLimit,
  getRateLimitStatus,
  RateLimitErrorCode,
} from './middleware.js';
