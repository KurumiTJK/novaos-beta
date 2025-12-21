// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT CONFIGURATION — Per-Endpoint Limits
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import type { RateLimitConfig, TierRateLimits } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TIME CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT TIER LIMITS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Default rate limits by user tier.
 */
export const DEFAULT_TIER_LIMITS: TierRateLimits = {
  free: {
    maxRequests: 60,
    windowMs: MINUTE,
  },
  pro: {
    maxRequests: 300,
    windowMs: MINUTE,
  },
  enterprise: {
    maxRequests: 1000,
    windowMs: MINUTE,
  },
};

/**
 * Anonymous (unauthenticated) rate limits.
 */
export const ANONYMOUS_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: MINUTE,
};

// ─────────────────────────────────────────────────────────────────────────────────
// ENDPOINT-SPECIFIC LIMITS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit categories for different endpoint types.
 */
export const EndpointLimits = {
  /**
   * Default API limit.
   */
  DEFAULT: {
    free: { maxRequests: 60, windowMs: MINUTE },
    pro: { maxRequests: 300, windowMs: MINUTE },
    enterprise: { maxRequests: 1000, windowMs: MINUTE },
  } as TierRateLimits,

  /**
   * Chat/LLM endpoints (more expensive).
   */
  CHAT: {
    free: { maxRequests: 10, windowMs: MINUTE },
    pro: { maxRequests: 60, windowMs: MINUTE },
    enterprise: { maxRequests: 300, windowMs: MINUTE },
  } as TierRateLimits,

  /**
   * Goal creation (prevent spam).
   */
  GOAL_CREATION: {
    free: { maxRequests: 5, windowMs: HOUR },
    pro: { maxRequests: 20, windowMs: HOUR },
    enterprise: { maxRequests: 100, windowMs: HOUR },
  } as TierRateLimits,

  /**
   * Spark generation (LLM-intensive).
   */
  SPARK_GENERATION: {
    free: { maxRequests: 20, windowMs: HOUR },
    pro: { maxRequests: 100, windowMs: HOUR },
    enterprise: { maxRequests: 500, windowMs: HOUR },
  } as TierRateLimits,

  /**
   * Memory extraction (LLM-intensive).
   */
  MEMORY_EXTRACTION: {
    free: { maxRequests: 10, windowMs: HOUR },
    pro: { maxRequests: 50, windowMs: HOUR },
    enterprise: { maxRequests: 200, windowMs: HOUR },
  } as TierRateLimits,

  /**
   * Web fetch/SSRF proxy (external requests).
   */
  WEB_FETCH: {
    free: { maxRequests: 20, windowMs: MINUTE },
    pro: { maxRequests: 50, windowMs: MINUTE },
    enterprise: { maxRequests: 200, windowMs: MINUTE },
  } as TierRateLimits,

  /**
   * Authentication endpoints (prevent brute force).
   */
  AUTH: {
    free: { maxRequests: 10, windowMs: MINUTE },
    pro: { maxRequests: 10, windowMs: MINUTE },
    enterprise: { maxRequests: 10, windowMs: MINUTE },
  } as TierRateLimits,

  /**
   * Export endpoints (resource intensive).
   */
  EXPORT: {
    free: { maxRequests: 2, windowMs: HOUR },
    pro: { maxRequests: 10, windowMs: HOUR },
    enterprise: { maxRequests: 50, windowMs: HOUR },
  } as TierRateLimits,

  /**
   * Admin endpoints.
   */
  ADMIN: {
    free: { maxRequests: 0, windowMs: MINUTE }, // Blocked for free
    pro: { maxRequests: 0, windowMs: MINUTE },   // Blocked for pro
    enterprise: { maxRequests: 100, windowMs: MINUTE },
  } as TierRateLimits,

  /**
   * Bulk operations.
   */
  BULK: {
    free: { maxRequests: 5, windowMs: HOUR },
    pro: { maxRequests: 20, windowMs: HOUR },
    enterprise: { maxRequests: 100, windowMs: HOUR },
  } as TierRateLimits,
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// PATH MATCHERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Endpoint category type.
 */
export type EndpointCategory = keyof typeof EndpointLimits;

/**
 * Path patterns for each category.
 */
export const PATH_PATTERNS: Record<EndpointCategory, RegExp[]> = {
  DEFAULT: [], // Fallback for unmatched paths

  CHAT: [
    /^\/api\/v\d+\/chat/,
    /^\/api\/v\d+\/messages/,
  ],

  GOAL_CREATION: [
    /^\/api\/v\d+\/goals$/,
  ],

  SPARK_GENERATION: [
    /^\/api\/v\d+\/sparks\/generate/,
    /^\/api\/v\d+\/path\/[\w-]+\/next-spark/,
  ],

  MEMORY_EXTRACTION: [
    /^\/api\/v\d+\/memories\/extract/,
  ],

  WEB_FETCH: [
    /^\/api\/v\d+\/fetch/,
    /^\/api\/v\d+\/verify/,
    /^\/api\/v\d+\/web/,
  ],

  AUTH: [
    /^\/api\/v\d+\/auth/,
    /^\/api\/v\d+\/login/,
    /^\/api\/v\d+\/register/,
    /^\/api\/v\d+\/token/,
  ],

  EXPORT: [
    /^\/api\/v\d+\/export/,
    /^\/api\/v\d+\/backup/,
  ],

  ADMIN: [
    /^\/api\/v\d+\/admin/,
  ],

  BULK: [
    /^\/api\/v\d+\/bulk/,
    /^\/api\/v\d+\/batch/,
  ],
};

/**
 * Get the rate limit category for a path.
 */
export function getCategoryForPath(path: string, method: string): EndpointCategory {
  // Special case: POST to /goals is creation
  if (method === 'POST' && /^\/api\/v\d+\/goals$/.test(path)) {
    return 'GOAL_CREATION';
  }

  // Check each category's patterns
  for (const [category, patterns] of Object.entries(PATH_PATTERNS)) {
    if (category === 'DEFAULT') continue;
    
    for (const pattern of patterns) {
      if (pattern.test(path)) {
        return category as EndpointCategory;
      }
    }
  }

  return 'DEFAULT';
}

/**
 * Get rate limit config for a path and tier.
 */
export function getLimitForPath(
  path: string,
  method: string,
  tier: 'free' | 'pro' | 'enterprise'
): RateLimitConfig {
  const category = getCategoryForPath(path, method);
  return EndpointLimits[category][tier];
}

/**
 * Get rate limit config for anonymous users.
 */
export function getAnonymousLimit(path: string, method: string): RateLimitConfig {
  const category = getCategoryForPath(path, method);
  
  // For sensitive endpoints, use stricter anonymous limits
  if (category === 'AUTH' || category === 'ADMIN') {
    return { maxRequests: 5, windowMs: MINUTE };
  }
  if (category === 'CHAT' || category === 'SPARK_GENERATION') {
    return { maxRequests: 3, windowMs: MINUTE };
  }
  
  return ANONYMOUS_LIMIT;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit multiplier from environment.
 * Allows adjusting all limits without code changes.
 */
export function getRateLimitMultiplier(): number {
  const multiplier = parseFloat(process.env.RATE_LIMIT_MULTIPLIER ?? '1.0');
  return isNaN(multiplier) ? 1.0 : Math.max(0.1, Math.min(10.0, multiplier));
}

/**
 * Apply multiplier to a rate limit config.
 */
export function applyMultiplier(config: RateLimitConfig, multiplier?: number): RateLimitConfig {
  const mult = multiplier ?? getRateLimitMultiplier();
  return {
    ...config,
    maxRequests: Math.ceil(config.maxRequests * mult),
    maxTokens: config.maxTokens ? Math.ceil(config.maxTokens * mult) : undefined,
  };
}

/**
 * Check if rate limiting is enabled.
 */
export function isRateLimitingEnabled(): boolean {
  return process.env.DISABLE_RATE_LIMITING !== 'true';
}

// ─────────────────────────────────────────────────────────────────────────────────
// SKIP CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Paths that skip rate limiting.
 */
export const SKIP_PATHS = [
  '/health',
  '/ready',
  '/status',
  '/',
];

/**
 * Check if a path should skip rate limiting.
 */
export function shouldSkipRateLimit(path: string): boolean {
  return SKIP_PATHS.some(skip => path === skip || path.startsWith(skip + '/'));
}
