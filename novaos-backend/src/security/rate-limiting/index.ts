// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING MODULE INDEX — Rate Limiting Exports
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export {
  type RateLimitConfig,
  type TierRateLimits,
  type RateLimitContext,
  type RateLimitResult,
  type RateLimiter,
  type RateLimitEvent,
  createAllowedResult,
  createDeniedResult,
  keyByUser,
  keyByIp,
  keyByUserAndPath,
  keyByIpAndPath,
  keyByUserOrIp,
} from './types.js';

// Token Bucket
export {
  TokenBucketLimiter,
  SlidingWindowLimiter,
  getTokenBucketLimiter,
  getSlidingWindowLimiter,
  getRateLimiter,
  initRateLimiter,
  resetRateLimiter,
} from './token-bucket.js';

// Config
export {
  DEFAULT_TIER_LIMITS,
  ANONYMOUS_LIMIT,
  EndpointLimits,
  PATH_PATTERNS,
  SKIP_PATHS,
  type EndpointCategory,
  getCategoryForPath,
  getLimitForPath,
  getAnonymousLimit,
  getRateLimitMultiplier,
  applyMultiplier,
  isRateLimitingEnabled,
  shouldSkipRateLimit,
} from './config.js';

// Middleware
export {
  rateLimit,
  chatRateLimit,
  goalCreationRateLimit,
  sparkGenerationRateLimit,
  webFetchRateLimit,
  authRateLimit,
  adminRateLimit,
  strictRateLimit,
  ipRateLimit,
  getRateLimitStatus,
  resetUserRateLimit,
  resetIpRateLimit,
  onRateLimitEvent,
  clearRateLimitEventHandlers,
  type RateLimitOptions,
} from './middleware.js';
