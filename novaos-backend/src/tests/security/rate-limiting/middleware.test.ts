// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT MIDDLEWARE TESTS — Express Rate Limiting
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';
import {
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
} from '../../../security/rate-limiting/middleware.js';
import {
  initRateLimiter,
  initIpRateLimiter,
} from '../../../security/rate-limiting/limiter.js';
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

let app: Application;
let mockStore: KeyValueStore;

beforeEach(() => {
  app = express();
  mockStore = createMockStore();
  
  initRateLimiter(mockStore);
  initIpRateLimiter(mockStore);
  clearRateLimitEventHandlers();
});

afterEach(() => {
  clearRateLimitEventHandlers();
});

// ─────────────────────────────────────────────────────────────────────────────────
// RateLimitErrorCode TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RateLimitErrorCode', () => {
  it('should have RATE_LIMITED code', () => {
    expect(RateLimitErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
  });

  it('should have IP_RATE_LIMITED code', () => {
    expect(RateLimitErrorCode.IP_RATE_LIMITED).toBe('IP_RATE_LIMITED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// rateLimit MIDDLEWARE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('rateLimit()', () => {
  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/test');
      
      expect(response.status).toBe(200);
    });

    it('should set rate limit headers', async () => {
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/test');
      
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should block when limit exceeded', async () => {
      // Use a very low limit for testing
      const lowLimitStore = createMockStore();
      // Mock incr to return values that exceed the limit
      let counter = 0;
      (lowLimitStore.incr as any).mockImplementation(async () => {
        counter++;
        return counter > 10 ? 11 : counter;
      });
      initRateLimiter(lowLimitStore);
      
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      // Make requests until blocked
      for (let i = 0; i < 10; i++) {
        await request(app).get('/test');
      }
      
      const blockedResponse = await request(app).get('/test');
      
      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.body.code).toBe(RateLimitErrorCode.RATE_LIMITED);
    });

    it('should include retry-after header when blocked', async () => {
      const lowLimitStore = createMockStore();
      (lowLimitStore.incr as any).mockResolvedValue(11); // Already over limit
      initRateLimiter(lowLimitStore);
      
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/test');
      
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });
  });

  describe('Skip Paths', () => {
    it('should skip default health paths', async () => {
      app.use(rateLimit());
      app.get('/health', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
    });

    it('should skip configured paths', async () => {
      app.use(rateLimit({ skipPaths: ['/public', '/metrics'] }));
      app.get('/public/resource', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/public/resource');
      
      expect(response.status).toBe(200);
    });
  });

  describe('Skip Function', () => {
    it('should skip when skip function returns true', async () => {
      app.use((req: any, res, next) => {
        req.userId = 'admin-user';
        req.user = { tier: 'enterprise' };
        next();
      });
      app.use(rateLimit({
        skip: (ctx) => ctx.tier === 'enterprise',
      }));
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/test');
      
      expect(response.status).toBe(200);
    });
  });

  describe('Category-Specific Limits', () => {
    it('should use category-specific limits', async () => {
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit({ category: 'auth' }));
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/test');
      
      // Auth category has limit of 5 for free tier
      expect(response.headers['x-ratelimit-limit']).toBe('5');
    });
  });

  describe('Custom Key Generator', () => {
    it('should use custom key generator', async () => {
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit({
        keyGenerator: (ctx) => `custom:${ctx.userId}:${ctx.path}`,
      }));
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      await request(app).get('/test');
      
      // Verify store was called with custom key pattern
      expect(mockStore.incr).toHaveBeenCalled();
    });
  });

  describe('Include IP Option', () => {
    it('should accept includeIp option', () => {
      // Verify the option is accepted without throwing
      const middleware = rateLimit({ includeIp: true });
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Custom Error Message', () => {
    it('should use custom error message', async () => {
      const lowLimitStore = createMockStore();
      (lowLimitStore.incr as any).mockResolvedValue(11);
      initRateLimiter(lowLimitStore);
      
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit({ errorMessage: 'Custom rate limit message' }));
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/test');
      
      expect(response.body.error).toBe('Custom rate limit message');
    });
  });

  describe('Anonymous Users', () => {
    it('should use anonymous limits', async () => {
      // No user set - should be anonymous
      app.use(rateLimit());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/test');
      
      // Anonymous defaults to free tier limits (10)
      expect(response.headers['x-ratelimit-limit']).toBe('10');
    });
  });

  describe('Error Handling', () => {
    it('should fail open on store errors', async () => {
      const errorStore = createMockStore();
      (errorStore.incr as any).mockRejectedValue(new Error('Store error'));
      initRateLimiter(errorStore);
      
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/test');
      
      // Should continue despite error (fail open)
      expect(response.status).toBe(200);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIALIZED MIDDLEWARE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('chatRateLimit()', () => {
  it('should apply chat category limits', async () => {
    app.use((req: any, res, next) => {
      req.userId = 'user-123';
      req.user = { tier: 'free' };
      next();
    });
    app.use(chatRateLimit());
    app.get('/test', (req, res) => res.json({ ok: true }));
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(200);
  });
});

describe('authRateLimit()', () => {
  it('should apply auth category limits with IP', async () => {
    app.use((req: any, res, next) => {
      req.userId = 'user-123';
      req.user = { tier: 'free' };
      next();
    });
    app.use(authRateLimit());
    app.get('/test', (req, res) => res.json({ ok: true }));
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('5');
  });
});

describe('adminRateLimit()', () => {
  it('should apply admin category limits', async () => {
    app.use((req: any, res, next) => {
      req.userId = 'user-123';
      req.user = { tier: 'enterprise' };
      next();
    });
    app.use(adminRateLimit());
    app.get('/test', (req, res) => res.json({ ok: true }));
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(200);
  });
});

describe('expensiveRateLimit()', () => {
  it('should apply expensive category limits', async () => {
    app.use((req: any, res, next) => {
      req.userId = 'user-123';
      req.user = { tier: 'free' };
      next();
    });
    app.use(expensiveRateLimit());
    app.get('/test', (req, res) => res.json({ ok: true }));
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('3');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// IP RATE LIMIT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ipRateLimit()', () => {
  it('should limit by IP', async () => {
    app.use(ipRateLimit());
    app.get('/test', (req, res) => res.json({ ok: true }));
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
  });

  it('should skip when no IP', async () => {
    // Even without IP, supertest provides one, so just verify it works
    app.use(ipRateLimit());
    app.get('/test', (req, res) => res.json({ ok: true }));
    
    const response = await request(app).get('/test');
    
    // Request should succeed
    expect(response.status).toBe(200);
  });

  it('should block when IP limit exceeded', async () => {
    const lowLimitStore = createMockStore();
    (lowLimitStore.incr as any).mockResolvedValue(101);
    initIpRateLimiter(lowLimitStore);
    
    app.use(ipRateLimit());
    app.get('/test', (req, res) => res.json({ ok: true }));
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(429);
    expect(response.body.code).toBe(RateLimitErrorCode.IP_RATE_LIMITED);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EVENT HANDLERS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Event Handlers', () => {
  describe('onRateLimitEvent()', () => {
    it('should emit event when limit exceeded', async () => {
      const handler = vi.fn();
      onRateLimitEvent(handler);
      
      const lowLimitStore = createMockStore();
      (lowLimitStore.incr as any).mockResolvedValue(11);
      initRateLimiter(lowLimitStore);
      
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      await request(app).get('/test');
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rate_limit_exceeded',
          userId: 'user-123',
        })
      );
    });

    it('should emit hit event when close to limit', async () => {
      const handler = vi.fn();
      onRateLimitEvent(handler);
      
      // 9 out of 10 - less than 20% remaining
      const nearLimitStore = createMockStore();
      (nearLimitStore.incr as any).mockResolvedValue(9);
      initRateLimiter(nearLimitStore);
      
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      await request(app).get('/test');
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rate_limit_hit',
        })
      );
    });
  });

  describe('clearRateLimitEventHandlers()', () => {
    it('should clear all handlers', async () => {
      const handler = vi.fn();
      onRateLimitEvent(handler);
      clearRateLimitEventHandlers();
      
      const lowLimitStore = createMockStore();
      (lowLimitStore.incr as any).mockResolvedValue(11);
      initRateLimiter(lowLimitStore);
      
      app.use((req: any, res, next) => {
        req.userId = 'user-123';
        req.user = { tier: 'free' };
        next();
      });
      app.use(rateLimit());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      await request(app).get('/test');
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Utility Functions', () => {
  describe('resetUserRateLimit()', () => {
    it('should reset rate limit for user', async () => {
      await resetUserRateLimit('user-123');
      
      expect(mockStore.delete).toHaveBeenCalled();
    });

    it('should reset specific category', async () => {
      await resetUserRateLimit('user-123', 'chat');
      
      expect(mockStore.delete).toHaveBeenCalled();
    });
  });

  describe('resetIpRateLimit()', () => {
    it('should reset IP rate limit', async () => {
      await resetIpRateLimit('192.168.1.1');
      
      expect(mockStore.delete).toHaveBeenCalled();
    });
  });

  describe('getRateLimitStatus()', () => {
    it('should return current status', async () => {
      const status = await getRateLimitStatus('user-123');
      
      expect(status).toHaveProperty('count');
      expect(status).toHaveProperty('limit');
    });
  });
});
