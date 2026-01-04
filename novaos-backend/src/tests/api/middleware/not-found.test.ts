// ═══════════════════════════════════════════════════════════════════════════════
// NOT FOUND MIDDLEWARE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { notFound, notFoundHandler } from '../../../api/middleware/not-found.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

vi.mock('../../../observability/index.js', () => ({
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/api/v1/unknown',
    headers: {},
    ...overrides,
  } as Request;
}

function createMockResponse(): Response & { 
  _status: number; 
  _json: unknown;
} {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(data: unknown) {
      this._json = data;
      return this;
    },
  };
  return res as Response & { _status: number; _json: unknown };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('notFound middleware', () => {
  it('should return 404 status', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    notFound()(req, res, next);

    expect(res._status).toBe(404);
  });

  it('should return NOT_FOUND code', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    notFound()(req, res, next);

    expect((res._json as any).code).toBe('NOT_FOUND');
  });

  it('should include path in response', () => {
    const req = createMockRequest({ path: '/api/v1/nonexistent' });
    const res = createMockResponse();
    const next = vi.fn();

    notFound()(req, res, next);

    expect((res._json as any).path).toBe('/api/v1/nonexistent');
  });

  it('should include method in response', () => {
    const req = createMockRequest({ method: 'POST' });
    const res = createMockResponse();
    const next = vi.fn();

    notFound()(req, res, next);

    expect((res._json as any).method).toBe('POST');
  });

  it('should include error message', () => {
    const req = createMockRequest({ method: 'GET', path: '/api/v1/test' });
    const res = createMockResponse();
    const next = vi.fn();

    notFound()(req, res, next);

    expect((res._json as any).error).toBe('Cannot GET /api/v1/test');
  });

  it('should include request ID if available', () => {
    const req = createMockRequest({ requestId: 'req-123' } as any);
    const res = createMockResponse();
    const next = vi.fn();

    notFound()(req, res, next);

    expect((res._json as any).requestId).toBe('req-123');
  });

  it('should include timestamp', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    notFound()(req, res, next);

    expect((res._json as any).timestamp).toBeDefined();
  });
});

describe('notFoundHandler alias', () => {
  it('should be same as notFound', () => {
    expect(notFoundHandler).toBe(notFound);
  });
});
