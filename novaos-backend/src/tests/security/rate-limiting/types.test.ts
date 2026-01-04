// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING TYPES TESTS — Configuration and Result Types
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIER_LIMITS,
  ANONYMOUS_LIMIT,
  ENDPOINT_LIMITS,
  type RateLimitConfig,
  type TierRateLimits,
  type RateLimitResult,
  type RateLimitContext,
  type RateLimitMiddlewareOptions,
  type RateLimitEventType,
  type RateLimitEvent,
  type EndpointCategory,
} from '../../../security/rate-limiting/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT_TIER_LIMITS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_TIER_LIMITS', () => {
  it('should have limits for all tiers', () => {
    expect(DEFAULT_TIER_LIMITS.free).toBeDefined();
    expect(DEFAULT_TIER_LIMITS.pro).toBeDefined();
    expect(DEFAULT_TIER_LIMITS.enterprise).toBeDefined();
  });

  describe('Free Tier', () => {
    it('should have configured window and limits', () => {
      expect(DEFAULT_TIER_LIMITS.free.windowMs).toBe(60 * 1000);
      expect(DEFAULT_TIER_LIMITS.free.maxRequests).toBe(10);
      expect(DEFAULT_TIER_LIMITS.free.maxTokens).toBe(10000);
    });
  });

  describe('Pro Tier', () => {
    it('should have higher limits than free', () => {
      expect(DEFAULT_TIER_LIMITS.pro.maxRequests).toBeGreaterThan(DEFAULT_TIER_LIMITS.free.maxRequests);
      expect(DEFAULT_TIER_LIMITS.pro.maxTokens!).toBeGreaterThan(DEFAULT_TIER_LIMITS.free.maxTokens!);
    });

    it('should have configured values', () => {
      expect(DEFAULT_TIER_LIMITS.pro.windowMs).toBe(60 * 1000);
      expect(DEFAULT_TIER_LIMITS.pro.maxRequests).toBe(60);
      expect(DEFAULT_TIER_LIMITS.pro.maxTokens).toBe(100000);
    });
  });

  describe('Enterprise Tier', () => {
    it('should have highest limits', () => {
      expect(DEFAULT_TIER_LIMITS.enterprise.maxRequests).toBeGreaterThan(DEFAULT_TIER_LIMITS.pro.maxRequests);
      expect(DEFAULT_TIER_LIMITS.enterprise.maxTokens!).toBeGreaterThan(DEFAULT_TIER_LIMITS.pro.maxTokens!);
    });

    it('should have configured values', () => {
      expect(DEFAULT_TIER_LIMITS.enterprise.windowMs).toBe(60 * 1000);
      expect(DEFAULT_TIER_LIMITS.enterprise.maxRequests).toBe(300);
      expect(DEFAULT_TIER_LIMITS.enterprise.maxTokens).toBe(500000);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ANONYMOUS_LIMIT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ANONYMOUS_LIMIT', () => {
  it('should have restrictive limits', () => {
    expect(ANONYMOUS_LIMIT.windowMs).toBe(60 * 1000);
    expect(ANONYMOUS_LIMIT.maxRequests).toBe(5);
    expect(ANONYMOUS_LIMIT.maxTokens).toBe(5000);
  });

  it('should be more restrictive than free tier', () => {
    expect(ANONYMOUS_LIMIT.maxRequests).toBeLessThan(DEFAULT_TIER_LIMITS.free.maxRequests);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ENDPOINT_LIMITS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ENDPOINT_LIMITS', () => {
  it('should have limits for all endpoint categories', () => {
    expect(ENDPOINT_LIMITS.chat).toBeDefined();
    expect(ENDPOINT_LIMITS.auth).toBeDefined();
    expect(ENDPOINT_LIMITS.admin).toBeDefined();
    expect(ENDPOINT_LIMITS.read).toBeDefined();
    expect(ENDPOINT_LIMITS.write).toBeDefined();
    expect(ENDPOINT_LIMITS.expensive).toBeDefined();
  });

  describe('Auth Limits', () => {
    it('should have restrictive limits for auth', () => {
      expect(ENDPOINT_LIMITS.auth.free?.maxRequests).toBe(5);
      expect(ENDPOINT_LIMITS.auth.pro?.maxRequests).toBe(10);
      expect(ENDPOINT_LIMITS.auth.enterprise?.maxRequests).toBe(20);
    });
  });

  describe('Admin Limits', () => {
    it('should restrict free and pro tiers', () => {
      expect(ENDPOINT_LIMITS.admin.free?.maxRequests).toBe(0);
      expect(ENDPOINT_LIMITS.admin.pro?.maxRequests).toBe(0);
    });

    it('should allow enterprise tier', () => {
      expect(ENDPOINT_LIMITS.admin.enterprise?.maxRequests).toBe(100);
    });
  });

  describe('Expensive Limits', () => {
    it('should have lower limits than default', () => {
      expect(ENDPOINT_LIMITS.expensive.free?.maxRequests).toBe(3);
      expect(ENDPOINT_LIMITS.expensive.pro?.maxRequests).toBe(15);
      expect(ENDPOINT_LIMITS.expensive.enterprise?.maxRequests).toBe(60);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('RateLimitConfig', () => {
    it('should accept valid config', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 100,
        maxTokens: 50000,
      };
      
      expect(config.windowMs).toBe(60000);
    });

    it('should allow optional maxTokens', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 100,
      };
      
      expect(config.maxTokens).toBeUndefined();
    });
  });

  describe('RateLimitResult', () => {
    it('should accept allowed result', () => {
      const result: RateLimitResult = {
        allowed: true,
        remaining: 9,
        limit: 10,
        resetMs: 60000,
        resetAt: Date.now() + 60000,
      };
      
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBeUndefined();
    });

    it('should accept blocked result', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        limit: 10,
        resetMs: 60000,
        resetAt: Date.now() + 60000,
        retryAfterMs: 30000,
      };
      
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBe(30000);
    });
  });

  describe('RateLimitContext', () => {
    it('should accept valid context', () => {
      const context: RateLimitContext = {
        userId: 'user-123',
        tier: 'pro',
        ip: '192.168.1.1',
        path: '/api/chat',
        method: 'POST',
      };
      
      expect(context.userId).toBe('user-123');
    });

    it('should allow optional fields', () => {
      const context: RateLimitContext = {
        userId: 'user-123',
        tier: 'free',
      };
      
      expect(context.ip).toBeUndefined();
      expect(context.path).toBeUndefined();
    });
  });

  describe('RateLimitMiddlewareOptions', () => {
    it('should accept valid options', () => {
      const options: RateLimitMiddlewareOptions = {
        category: 'chat',
        skipPaths: ['/health'],
        includeIp: true,
        errorMessage: 'Too many requests',
      };
      
      expect(options.category).toBe('chat');
    });

    it('should allow custom key generator', () => {
      const options: RateLimitMiddlewareOptions = {
        keyGenerator: (ctx) => `${ctx.userId}:${ctx.ip}`,
      };
      
      expect(typeof options.keyGenerator).toBe('function');
    });

    it('should allow skip function', () => {
      const options: RateLimitMiddlewareOptions = {
        skip: (ctx) => ctx.tier === 'enterprise',
      };
      
      expect(typeof options.skip).toBe('function');
    });
  });

  describe('EndpointCategory', () => {
    it('should accept valid categories', () => {
      const categories: EndpointCategory[] = [
        'chat',
        'auth',
        'admin',
        'read',
        'write',
        'expensive',
      ];
      
      expect(categories).toHaveLength(6);
    });
  });

  describe('RateLimitEventType', () => {
    it('should accept valid event types', () => {
      const types: RateLimitEventType[] = [
        'rate_limit_hit',
        'rate_limit_exceeded',
        'rate_limit_blocked',
      ];
      
      expect(types).toHaveLength(3);
    });
  });

  describe('RateLimitEvent', () => {
    it('should accept valid event', () => {
      const event: RateLimitEvent = {
        type: 'rate_limit_exceeded',
        userId: 'user-123',
        tier: 'free',
        ip: '192.168.1.1',
        path: '/api/chat',
        timestamp: Date.now(),
        remaining: 0,
        limit: 10,
      };
      
      expect(event.type).toBe('rate_limit_exceeded');
    });
  });
});
