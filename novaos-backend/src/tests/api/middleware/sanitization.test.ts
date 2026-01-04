// ═══════════════════════════════════════════════════════════════════════════════
// SANITIZATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  sanitizeRequest,
  sanitizeValue,
  sanitizers,
  validators,
  loadSanitizationConfig,
} from '../../../api/middleware/sanitization.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function createMockRequest(body = {}, query = {}, params = {}): Request {
  return {
    body,
    query,
    params,
    path: '/test',
    headers: {},
  } as Request;
}

function createMockResponse(): Response {
  return {} as Response;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

describe('loadSanitizationConfig', () => {
  it('should return default config', () => {
    const config = loadSanitizationConfig();
    expect(config.maxStringLength).toBe(10000);
    expect(config.stripHtml).toBe(true);
    expect(config.stripScripts).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SANITIZERS
// ─────────────────────────────────────────────────────────────────────────────────

describe('sanitizers', () => {
  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(sanitizers.stripHtml('<p>Hello</p>')).toBe('Hello');
      expect(sanitizers.stripHtml('No tags here')).toBe('No tags here');
    });
  });

  describe('stripScripts', () => {
    it('should remove script tags', () => {
      expect(sanitizers.stripScripts('<script>alert(1)</script>')).toBe('');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizers.stripScripts('javascript:alert(1)')).toBe('alert(1)');
    });
  });

  describe('stripNullBytes', () => {
    it('should remove null bytes', () => {
      expect(sanitizers.stripNullBytes('hello\x00world')).toBe('helloworld');
    });
  });

  describe('normalizeWhitespace', () => {
    it('should collapse multiple spaces', () => {
      expect(sanitizers.normalizeWhitespace('hello   world')).toBe('hello world');
    });
  });

  describe('truncateString', () => {
    it('should truncate long strings', () => {
      expect(sanitizers.truncateString('hello world', 5)).toBe('hello');
    });
  });

  describe('sanitizeEmail', () => {
    it('should lowercase and trim', () => {
      expect(sanitizers.sanitizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
    });
  });

  describe('sanitizeUrl', () => {
    it('should return valid https URL', () => {
      expect(sanitizers.sanitizeUrl('https://example.com')).toBe('https://example.com/');
    });

    it('should return null for invalid URL', () => {
      expect(sanitizers.sanitizeUrl('not-a-url')).toBeNull();
    });

    it('should return null for non-http protocols', () => {
      expect(sanitizers.sanitizeUrl('javascript:alert(1)')).toBeNull();
    });
  });

  describe('sanitizeId', () => {
    it('should only allow safe characters', () => {
      expect(sanitizers.sanitizeId('user_123-abc')).toBe('user_123-abc');
      expect(sanitizers.sanitizeId('user@123!#$')).toBe('user123');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────────

describe('validators', () => {
  describe('hasPathTraversal', () => {
    it('should detect path traversal', () => {
      expect(validators.hasPathTraversal('../etc/passwd')).toBe(true);
    });

    it('should pass safe paths', () => {
      expect(validators.hasPathTraversal('/home/user')).toBe(false);
    });
  });

  describe('hasSqlInjection', () => {
    it('should detect SQL keywords', () => {
      expect(validators.hasSqlInjection('SELECT * FROM users')).toBe(true);
    });

    it('should pass normal text', () => {
      expect(validators.hasSqlInjection('Hello world')).toBe(false);
    });
  });

  describe('hasNoSqlInjection', () => {
    it('should detect NoSQL operators', () => {
      expect(validators.hasNoSqlInjection({ $gt: 0 })).toBe(true);
    });

    it('should pass normal values', () => {
      expect(validators.hasNoSqlInjection({ name: 'John' })).toBe(false);
    });
  });

  describe('hasCommandInjection', () => {
    it('should detect command injection', () => {
      expect(validators.hasCommandInjection('hello; rm -rf /')).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// DEEP SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────────

describe('sanitizeValue', () => {
  const config = loadSanitizationConfig();

  it('should handle null and undefined', () => {
    expect(sanitizeValue(null, config).result).toBeNull();
    expect(sanitizeValue(undefined, config).result).toBeUndefined();
  });

  it('should sanitize strings', () => {
    const result = sanitizeValue('<script>bad</script>Hello', config);
    expect(result.result).toBe('Hello');
  });

  it('should sanitize nested objects', () => {
    const input = { name: '<b>John</b>' };
    const result = sanitizeValue(input, config);
    expect((result.result as any).name).toBe('John');
  });

  it('should pass through numbers and booleans', () => {
    expect(sanitizeValue(42, config).result).toBe(42);
    expect(sanitizeValue(true, config).result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

describe('sanitizeBody middleware', () => {
  it('should sanitize request body', () => {
    const req = createMockRequest({ message: '<script>bad</script>Hello' });
    const res = createMockResponse();
    const next = vi.fn();

    sanitizeBody()(req, res, next);

    expect(req.body.message).toBe('Hello');
    expect(next).toHaveBeenCalled();
  });
});

describe('sanitizeQuery middleware', () => {
  it('should sanitize query parameters', () => {
    const req = createMockRequest({}, { search: '<script>bad</script>term' });
    const res = createMockResponse();
    const next = vi.fn();

    sanitizeQuery()(req, res, next);

    expect(req.query.search).toBe('term');
  });
});

describe('sanitizeParams middleware', () => {
  it('should sanitize route parameters', () => {
    const req = createMockRequest({}, {}, { id: '<script>bad</script>123' });
    const res = createMockResponse();
    const next = vi.fn();

    sanitizeParams()(req, res, next);

    expect(req.params.id).toBe('123');
  });
});

describe('sanitizeRequest middleware', () => {
  it('should sanitize body, query, and params', () => {
    const req = createMockRequest(
      { name: '<b>Test</b>' },
      { q: '<script>x</script>search' },
      { id: '<i>123</i>' }
    );
    const res = createMockResponse();
    const next = vi.fn();

    sanitizeRequest()(req, res, next);

    expect(req.body.name).toBe('Test');
    expect(req.query.q).toBe('search');
    expect(req.params.id).toBe('123');
  });
});
