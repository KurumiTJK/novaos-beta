// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import {
  securityHeaders,
  contentSecurityPolicy,
  corsMiddleware,
  httpsRedirect,
  requestLimits,
  ipFilter,
  applySecurity,
  getClientIP,
  loadSecurityConfig,
} from '../../../api/middleware/security.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/api/v1/test',
    url: '/api/v1/test',
    headers: {},
    query: {},
    secure: false,
    hostname: 'localhost',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as Request;
}

function createMockResponse(): Response & { 
  _headers: Record<string, string>; 
  _status: number;
  _redirect: { code: number; url: string } | null;
  _json: unknown;
} {
  const res = {
    _headers: {} as Record<string, string>,
    _status: 200,
    _redirect: null as { code: number; url: string } | null,
    _json: null as unknown,
    setHeader(name: string, value: string) {
      this._headers[name] = value;
      return this;
    },
    removeHeader(name: string) {
      delete this._headers[name];
      return this;
    },
    status(code: number) {
      this._status = code;
      return this;
    },
    json(data: unknown) {
      this._json = data;
      return this;
    },
    redirect(code: number, url: string) {
      this._redirect = { code, url };
      return this;
    },
  };
  return res as Response & { 
    _headers: Record<string, string>; 
    _status: number;
    _redirect: { code: number; url: string } | null;
    _json: unknown;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

describe('loadSecurityConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should detect development mode', () => {
    process.env.NODE_ENV = 'development';
    const config = loadSecurityConfig();
    expect(config.isDevelopment).toBe(true);
  });

  it('should detect production mode', () => {
    process.env.NODE_ENV = 'production';
    const config = loadSecurityConfig();
    expect(config.isProduction).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY HEADERS
// ─────────────────────────────────────────────────────────────────────────────────

describe('securityHeaders', () => {
  it('should set X-Content-Type-Options', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    securityHeaders()(req, res, next);

    expect(res._headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('should set X-Frame-Options', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    securityHeaders()(req, res, next);

    expect(res._headers['X-Frame-Options']).toBe('DENY');
  });

  it('should set Cache-Control for API routes', () => {
    const req = createMockRequest({ path: '/api/v1/users' });
    const res = createMockResponse();
    const next = vi.fn();

    securityHeaders()(req, res, next);

    expect(res._headers['Cache-Control']).toContain('no-store');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CSP
// ─────────────────────────────────────────────────────────────────────────────────

describe('contentSecurityPolicy', () => {
  it('should set CSP header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    contentSecurityPolicy()(req, res, next);

    expect(res._headers['Content-Security-Policy']).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────────

describe('corsMiddleware', () => {
  it('should set Access-Control-Allow-Origin for allowed origins', () => {
    const req = createMockRequest({ 
      headers: { origin: 'http://localhost:3000' } 
    });
    const res = createMockResponse();
    const next = vi.fn();

    // Use 'origins' not 'allowedOrigins'
    corsMiddleware({ origins: ['http://localhost:3000'] })(req, res, next);

    expect(res._headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// HTTPS REDIRECT
// ─────────────────────────────────────────────────────────────────────────────────

describe('httpsRedirect', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should skip in development', () => {
    process.env.NODE_ENV = 'development';
    const req = createMockRequest({ secure: false });
    const res = createMockResponse();
    const next = vi.fn();

    httpsRedirect()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._redirect).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST LIMITS
// ─────────────────────────────────────────────────────────────────────────────────

describe('requestLimits', () => {
  it('should allow valid requests', () => {
    const req = createMockRequest({ url: '/api/test' });
    const res = createMockResponse();
    const next = vi.fn();

    requestLimits()(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject long URLs', () => {
    const req = createMockRequest({ url: '/api/' + 'a'.repeat(3000) });
    const res = createMockResponse();
    const next = vi.fn();

    requestLimits({ maxUrlLength: 2048 })(req, res, next);

    expect(res._status).toBe(414);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// IP FILTERING
// ─────────────────────────────────────────────────────────────────────────────────

describe('ipFilter', () => {
  it('should block IPs on blocklist', () => {
    // getClientIP with trustProxy: false returns req.socket?.remoteAddress ?? req.ip
    const req = createMockRequest({ 
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' } as any,
    });
    const res = createMockResponse();
    const next = vi.fn();

    ipFilter({ blocklist: ['10.0.0.1'], trustProxy: false })(req, res, next);

    expect(res._status).toBe(403);
    expect((res._json as any).code).toBe('IP_BLOCKED');
  });

  it('should allow IPs on allowlist', () => {
    const req = createMockRequest({ 
      ip: '192.168.1.100',
      socket: { remoteAddress: '192.168.1.100' } as any,
    });
    const res = createMockResponse();
    const next = vi.fn();

    ipFilter({ allowlist: ['192.168.1.100'], trustProxy: false })(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject IPs not on allowlist', () => {
    const req = createMockRequest({ 
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' } as any,
    });
    const res = createMockResponse();
    const next = vi.fn();

    ipFilter({ allowlist: ['192.168.1.100'], trustProxy: false })(req, res, next);

    expect(res._status).toBe(403);
    expect((res._json as any).code).toBe('IP_NOT_ALLOWED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GET CLIENT IP
// ─────────────────────────────────────────────────────────────────────────────────

describe('getClientIP', () => {
  it('should return X-Forwarded-For IP when trusting proxy', () => {
    const req = createMockRequest({
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
      ip: '127.0.0.1'
    });

    expect(getClientIP(req, true)).toBe('203.0.113.195');
  });

  it('should return socket IP when not trusting proxy', () => {
    const req = createMockRequest({
      headers: { 'x-forwarded-for': '203.0.113.195' },
      ip: '127.0.0.1'
    });

    expect(getClientIP(req, false)).toBe('127.0.0.1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

describe('applySecurity', () => {
  it('should apply security headers', () => {
    const req = createMockRequest({ path: '/api/test' });
    const res = createMockResponse();
    const next = vi.fn();

    applySecurity()(req, res, next);

    expect(res._headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
