// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE INDEX TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('../../../observability/index.js', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logRequest: vi.fn(),
}));

vi.mock('../../../config/index.js', () => ({
  loadConfig: vi.fn(() => ({
    observability: { redactPII: false },
  })),
  isProduction: vi.fn(() => false),
}));

import * as middleware from '../../../api/middleware/index.js';

describe('Middleware Index Exports', () => {
  describe('Request Handling', () => {
    it('should export requestMiddleware', () => {
      expect(middleware.requestMiddleware).toBeDefined();
      expect(typeof middleware.requestMiddleware).toBe('function');
    });

    it('should export requestIdMiddleware', () => {
      expect(middleware.requestIdMiddleware).toBeDefined();
    });

    it('should export requestLoggingMiddleware', () => {
      expect(middleware.requestLoggingMiddleware).toBeDefined();
    });
  });

  describe('Security', () => {
    it('should export securityHeaders', () => {
      expect(middleware.securityHeaders).toBeDefined();
    });

    it('should export contentSecurityPolicy', () => {
      expect(middleware.contentSecurityPolicy).toBeDefined();
    });

    it('should export corsMiddleware', () => {
      expect(middleware.corsMiddleware).toBeDefined();
    });

    it('should export httpsRedirect', () => {
      expect(middleware.httpsRedirect).toBeDefined();
    });

    it('should export requestLimits', () => {
      expect(middleware.requestLimits).toBeDefined();
    });

    it('should export ipFilter', () => {
      expect(middleware.ipFilter).toBeDefined();
    });

    it('should export applySecurity', () => {
      expect(middleware.applySecurity).toBeDefined();
    });

    it('should export helmet alias', () => {
      expect(middleware.helmet).toBe(middleware.securityHeaders);
    });

    it('should export getClientIP', () => {
      expect(middleware.getClientIP).toBeDefined();
    });
  });

  describe('Sanitization', () => {
    it('should export sanitizeBody', () => {
      expect(middleware.sanitizeBody).toBeDefined();
    });

    it('should export sanitizeQuery', () => {
      expect(middleware.sanitizeQuery).toBeDefined();
    });

    it('should export sanitizeParams', () => {
      expect(middleware.sanitizeParams).toBeDefined();
    });

    it('should export sanitizeRequest', () => {
      expect(middleware.sanitizeRequest).toBeDefined();
    });

    it('should export sanitizeValue', () => {
      expect(middleware.sanitizeValue).toBeDefined();
    });

    it('should export sanitizers object', () => {
      expect(middleware.sanitizers).toBeDefined();
    });

    it('should export validators object', () => {
      expect(middleware.validators).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should export errorHandler', () => {
      expect(middleware.errorHandler).toBeDefined();
    });

    it('should export asyncHandler', () => {
      expect(middleware.asyncHandler).toBeDefined();
    });

    it('should export ApiError class', () => {
      expect(middleware.ApiError).toBeDefined();
    });

    it('should export ClientError alias', () => {
      expect(middleware.ClientError).toBe(middleware.ApiError);
    });

    it('should export NotFoundError class', () => {
      expect(middleware.NotFoundError).toBeDefined();
    });

    it('should export ValidationError class', () => {
      expect(middleware.ValidationError).toBeDefined();
    });

    it('should export UnauthorizedError class', () => {
      expect(middleware.UnauthorizedError).toBeDefined();
    });

    it('should export ForbiddenError class', () => {
      expect(middleware.ForbiddenError).toBeDefined();
    });

    it('should export RateLimitError class', () => {
      expect(middleware.RateLimitError).toBeDefined();
    });

    it('should export InternalError class', () => {
      expect(middleware.InternalError).toBeDefined();
    });
  });

  describe('Not Found Handler', () => {
    it('should export notFound', () => {
      expect(middleware.notFound).toBeDefined();
    });

    it('should export notFoundHandler alias', () => {
      expect(middleware.notFoundHandler).toBe(middleware.notFound);
    });
  });
});
