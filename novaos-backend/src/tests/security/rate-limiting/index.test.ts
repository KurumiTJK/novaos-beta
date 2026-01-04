// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING MODULE INDEX TESTS — Export Verification
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import * as rateLimitModule from '../../../security/rate-limiting/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE AND CONSTANT EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type and Constant Exports', () => {
  it('should export DEFAULT_TIER_LIMITS', () => {
    expect(rateLimitModule.DEFAULT_TIER_LIMITS).toBeDefined();
    expect(rateLimitModule.DEFAULT_TIER_LIMITS.free).toBeDefined();
    expect(rateLimitModule.DEFAULT_TIER_LIMITS.pro).toBeDefined();
    expect(rateLimitModule.DEFAULT_TIER_LIMITS.enterprise).toBeDefined();
  });

  it('should export ANONYMOUS_LIMIT', () => {
    expect(rateLimitModule.ANONYMOUS_LIMIT).toBeDefined();
    expect(rateLimitModule.ANONYMOUS_LIMIT.maxRequests).toBe(5);
  });

  it('should export ENDPOINT_LIMITS', () => {
    expect(rateLimitModule.ENDPOINT_LIMITS).toBeDefined();
    expect(rateLimitModule.ENDPOINT_LIMITS.chat).toBeDefined();
    expect(rateLimitModule.ENDPOINT_LIMITS.auth).toBeDefined();
    expect(rateLimitModule.ENDPOINT_LIMITS.admin).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// LIMITER EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Limiter Exports', () => {
  it('should export RateLimiter class', () => {
    expect(rateLimitModule.RateLimiter).toBeDefined();
    expect(typeof rateLimitModule.RateLimiter).toBe('function');
  });

  it('should export IpRateLimiter class', () => {
    expect(rateLimitModule.IpRateLimiter).toBeDefined();
    expect(typeof rateLimitModule.IpRateLimiter).toBe('function');
  });

  it('should export singleton functions', () => {
    expect(typeof rateLimitModule.initRateLimiter).toBe('function');
    expect(typeof rateLimitModule.getRateLimiter).toBe('function');
    expect(typeof rateLimitModule.initIpRateLimiter).toBe('function');
    expect(typeof rateLimitModule.getIpRateLimiter).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Middleware Exports', () => {
  it('should export main rateLimit middleware', () => {
    expect(typeof rateLimitModule.rateLimit).toBe('function');
  });

  it('should export specialized middleware', () => {
    expect(typeof rateLimitModule.chatRateLimit).toBe('function');
    expect(typeof rateLimitModule.authRateLimit).toBe('function');
    expect(typeof rateLimitModule.adminRateLimit).toBe('function');
    expect(typeof rateLimitModule.expensiveRateLimit).toBe('function');
    expect(typeof rateLimitModule.ipRateLimit).toBe('function');
  });

  it('should export event handlers', () => {
    expect(typeof rateLimitModule.onRateLimitEvent).toBe('function');
    expect(typeof rateLimitModule.clearRateLimitEventHandlers).toBe('function');
  });

  it('should export utility functions', () => {
    expect(typeof rateLimitModule.resetUserRateLimit).toBe('function');
    expect(typeof rateLimitModule.resetIpRateLimit).toBe('function');
    expect(typeof rateLimitModule.getRateLimitStatus).toBe('function');
  });

  it('should export RateLimitErrorCode', () => {
    expect(rateLimitModule.RateLimitErrorCode).toBeDefined();
    expect(rateLimitModule.RateLimitErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
    expect(rateLimitModule.RateLimitErrorCode.IP_RATE_LIMITED).toBe('IP_RATE_LIMITED');
  });
});
