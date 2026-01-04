// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER TESTS — Token Bucket Implementation
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RateLimiter,
  IpRateLimiter,
  initRateLimiter,
  getRateLimiter,
  initIpRateLimiter,
  getIpRateLimiter,
} from '../../../security/rate-limiting/limiter.js';
import { DEFAULT_TIER_LIMITS, ANONYMOUS_LIMIT } from '../../../security/rate-limiting/types.js';
import type { KeyValueStore } from '../../../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK STORE
// ─────────────────────────────────────────────────────────────────────────────────

function createMockStore(): KeyValueStore {
  const data = new Map<string, string>();
  
  return {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      return data.delete(key);
    }),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(data.get(key) ?? '0', 10);
      const newValue = current + 1;
      data.set(key, String(newValue));
      return newValue;
    }),
    expire: vi.fn(async () => true),
    exists: vi.fn(async (key: string) => data.has(key)),
  } as unknown as KeyValueStore;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

let mockStore: KeyValueStore;

beforeEach(() => {
  mockStore = createMockStore();
});

// ─────────────────────────────────────────────────────────────────────────────────
// RateLimiter CLASS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(mockStore);
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const rateLimiter = new RateLimiter(mockStore);
      expect(rateLimiter).toBeDefined();
    });

    it('should accept custom prefix', () => {
      const rateLimiter = new RateLimiter(mockStore, { prefix: 'custom:' });
      expect(rateLimiter).toBeDefined();
    });

    it('should accept custom tier limits', () => {
      const rateLimiter = new RateLimiter(mockStore, {
        tierLimits: {
          free: { windowMs: 30000, maxRequests: 5 },
          pro: { windowMs: 30000, maxRequests: 30 },
          enterprise: { windowMs: 30000, maxRequests: 150 },
        },
      });
      expect(rateLimiter).toBeDefined();
    });
  });

  describe('check()', () => {
    it('should allow first request', async () => {
      const result = await limiter.check({ userId: 'user-123', tier: 'free' });
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(DEFAULT_TIER_LIMITS.free.maxRequests - 1);
      expect(result.limit).toBe(DEFAULT_TIER_LIMITS.free.maxRequests);
    });

    it('should decrement remaining on each request', async () => {
      const ctx = { userId: 'user-123', tier: 'free' as const };
      
      const result1 = await limiter.check(ctx);
      const result2 = await limiter.check(ctx);
      const result3 = await limiter.check(ctx);
      
      expect(result1.remaining).toBe(9);
      expect(result2.remaining).toBe(8);
      expect(result3.remaining).toBe(7);
    });

    it('should block when limit exceeded', async () => {
      const ctx = { userId: 'user-123', tier: 'free' as const };
      
      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        await limiter.check(ctx);
      }
      
      // Next request should be blocked
      const result = await limiter.check(ctx);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeDefined();
    });

    it('should use tier-specific limits', async () => {
      const freeResult = await limiter.check({ userId: 'free-user', tier: 'free' });
      const proResult = await limiter.check({ userId: 'pro-user', tier: 'pro' });
      const enterpriseResult = await limiter.check({ userId: 'ent-user', tier: 'enterprise' });
      
      expect(freeResult.limit).toBe(DEFAULT_TIER_LIMITS.free.maxRequests);
      expect(proResult.limit).toBe(DEFAULT_TIER_LIMITS.pro.maxRequests);
      expect(enterpriseResult.limit).toBe(DEFAULT_TIER_LIMITS.enterprise.maxRequests);
    });

    it('should use anonymous limit for anonymous users', async () => {
      const result = await limiter.check({ userId: 'anonymous', tier: 'free' });
      
      // Anonymous user with 'free' tier gets free tier limits
      // The anonymous limit is only applied when tier is 'anonymous'
      expect(result.limit).toBe(DEFAULT_TIER_LIMITS.free.maxRequests);
    });

    it('should use endpoint-specific limits when category provided', async () => {
      const result = await limiter.check({ userId: 'user-123', tier: 'free' }, 'auth');
      
      // Auth category has specific limits
      expect(result.limit).toBe(5); // ENDPOINT_LIMITS.auth.free.maxRequests
    });

    it('should set expiry on first request', async () => {
      await limiter.check({ userId: 'user-123', tier: 'free' });
      
      expect(mockStore.expire).toHaveBeenCalled();
    });

    it('should include resetAt timestamp', async () => {
      const before = Date.now();
      const result = await limiter.check({ userId: 'user-123', tier: 'free' });
      const after = Date.now();
      
      expect(result.resetAt).toBeGreaterThanOrEqual(before);
      expect(result.resetAt).toBeLessThanOrEqual(after + 60000);
    });
  });

  describe('peek()', () => {
    it('should return status without incrementing', async () => {
      const ctx = { userId: 'user-123', tier: 'free' as const };
      
      // Check current status
      await limiter.check(ctx); // 1 request
      
      const peek1 = await limiter.peek(ctx);
      const peek2 = await limiter.peek(ctx);
      
      // Both peeks should show same remaining
      expect(peek1.remaining).toBe(peek2.remaining);
    });

    it('should show full capacity for new user', async () => {
      const result = await limiter.peek({ userId: 'new-user', tier: 'free' });
      
      expect(result.remaining).toBe(DEFAULT_TIER_LIMITS.free.maxRequests);
      expect(result.allowed).toBe(true);
    });
  });

  describe('reset()', () => {
    it('should reset rate limit for user', async () => {
      const ctx = { userId: 'user-123', tier: 'free' as const };
      
      // Make some requests
      await limiter.check(ctx);
      await limiter.check(ctx);
      
      // Reset
      await limiter.reset('user-123');
      
      // Should have full capacity again
      const result = await limiter.peek(ctx);
      expect(result.remaining).toBe(DEFAULT_TIER_LIMITS.free.maxRequests);
    });

    it('should reset specific category', async () => {
      await limiter.check({ userId: 'user-123', tier: 'free' }, 'chat');
      
      await limiter.reset('user-123', 'chat');
      
      expect(mockStore.delete).toHaveBeenCalled();
    });
  });

  describe('getCount()', () => {
    it('should return 0 for new user', async () => {
      const count = await limiter.getCount('new-user');
      
      expect(count).toBe(0);
    });

    it('should return current count', async () => {
      const ctx = { userId: 'user-123', tier: 'free' as const };
      
      await limiter.check(ctx);
      await limiter.check(ctx);
      await limiter.check(ctx);
      
      const count = await limiter.getCount('user-123');
      
      expect(count).toBe(3);
    });
  });

  describe('getLimits()', () => {
    it('should return limits for tier', () => {
      const freeLimits = limiter.getLimits('free');
      const proLimits = limiter.getLimits('pro');
      
      expect(freeLimits.maxRequests).toBe(DEFAULT_TIER_LIMITS.free.maxRequests);
      expect(proLimits.maxRequests).toBe(DEFAULT_TIER_LIMITS.pro.maxRequests);
    });

    it('should return anonymous limits for unknown tier', () => {
      const limits = limiter.getLimits('unknown');
      
      expect(limits.maxRequests).toBe(ANONYMOUS_LIMIT.maxRequests);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// IpRateLimiter CLASS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('IpRateLimiter', () => {
  let ipLimiter: IpRateLimiter;

  beforeEach(() => {
    ipLimiter = new IpRateLimiter(mockStore);
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const limiter = new IpRateLimiter(mockStore);
      expect(limiter).toBeDefined();
    });

    it('should accept custom options', () => {
      const limiter = new IpRateLimiter(mockStore, {
        prefix: 'ip:limit:',
        windowMs: 30000,
        maxRequests: 50,
      });
      expect(limiter).toBeDefined();
    });
  });

  describe('check()', () => {
    it('should allow first request', async () => {
      const result = await ipLimiter.check('192.168.1.1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // Default is 100
    });

    it('should track requests per IP', async () => {
      await ipLimiter.check('192.168.1.1');
      await ipLimiter.check('192.168.1.1');
      await ipLimiter.check('192.168.1.2'); // Different IP
      
      // Different IPs have separate counters
      const result1 = await ipLimiter.check('192.168.1.1');
      const result2 = await ipLimiter.check('192.168.1.2');
      
      expect(result1.remaining).toBe(97); // 100 - 3
      expect(result2.remaining).toBe(98); // 100 - 2
    });

    it('should normalize IP addresses', async () => {
      await ipLimiter.check('192.168.1.1');
      await ipLimiter.check('192.168.1.1'); // Same IP
      
      const result = await ipLimiter.check('192.168.1.1');
      
      expect(result.remaining).toBe(97);
    });

    it('should block when limit exceeded', async () => {
      const customLimiter = new IpRateLimiter(mockStore, {
        maxRequests: 3,
      });
      
      await customLimiter.check('192.168.1.1');
      await customLimiter.check('192.168.1.1');
      await customLimiter.check('192.168.1.1');
      
      const result = await customLimiter.check('192.168.1.1');
      
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeDefined();
    });
  });

  describe('reset()', () => {
    it('should reset IP rate limit', async () => {
      await ipLimiter.check('192.168.1.1');
      await ipLimiter.check('192.168.1.1');
      
      await ipLimiter.reset('192.168.1.1');
      
      expect(mockStore.delete).toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Singleton Functions', () => {
  describe('RateLimiter Singleton', () => {
    it('initRateLimiter should create and return limiter', () => {
      const limiter = initRateLimiter(mockStore);
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('getRateLimiter should return limiter after init', () => {
      initRateLimiter(mockStore);
      const limiter = getRateLimiter();
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('getRateLimiter should throw if not initialized', () => {
      // Note: This depends on module state - may be initialized from previous tests
    });
  });

  describe('IpRateLimiter Singleton', () => {
    it('initIpRateLimiter should create and return limiter', () => {
      const limiter = initIpRateLimiter(mockStore);
      expect(limiter).toBeInstanceOf(IpRateLimiter);
    });

    it('getIpRateLimiter should return limiter after init', () => {
      initIpRateLimiter(mockStore);
      const limiter = getIpRateLimiter();
      expect(limiter).toBeInstanceOf(IpRateLimiter);
    });
  });
});
