// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST MIDDLEWARE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  requestIdMiddleware,
  requestLoggingMiddleware,
  requestMiddleware,
} from '../../../api/middleware/request.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

vi.mock('../../../observability/index.js', () => ({
  logRequest: vi.fn(),
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../../../config/index.js', () => ({
  loadConfig: vi.fn(() => ({
    observability: { redactPII: false },
  })),
  isProduction: vi.fn(() => false),
}));

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/api/v1/test',
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as Request;
}

function createMockResponse(): Response & { 
  _headers: Record<string, string>;
  _listeners: Record<string, Function[]>;
} {
  const res = {
    _headers: {} as Record<string, string>,
    _listeners: {} as Record<string, Function[]>,
    statusCode: 200,
    setHeader(name: string, value: string) {
      this._headers[name] = value;
      return this;
    },
    on(event: string, callback: Function) {
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(callback);
      return this;
    },
    emit(event: string) {
      const callbacks = this._listeners[event] || [];
      callbacks.forEach(cb => cb());
    },
  };
  return res as Response & { 
    _headers: Record<string, string>;
    _listeners: Record<string, Function[]>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST ID MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

describe('requestIdMiddleware', () => {
  it('should generate request ID if not provided', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalled();
  });

  it('should use existing request ID from header', () => {
    const req = createMockRequest({
      headers: { 'x-request-id': 'existing-id-123' },
    });
    const res = createMockResponse();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('existing-id-123');
  });

  it('should set X-Request-Id response header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res._headers['X-Request-Id']).toBe(req.requestId);
  });

  it('should set startTime', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();
    const before = Date.now();

    requestIdMiddleware(req, res, next);

    expect(req.startTime).toBeGreaterThanOrEqual(before);
    expect(req.startTime).toBeLessThanOrEqual(Date.now());
  });

  it('should create request-scoped logger', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.logger).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST LOGGING MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

describe('requestLoggingMiddleware', () => {
  it('should register finish listener', () => {
    const req = createMockRequest({ requestId: 'test-id', startTime: Date.now() } as any);
    const res = createMockResponse();
    const next = vi.fn();

    requestLoggingMiddleware(req, res, next);

    expect(res._listeners['finish']).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

describe('requestMiddleware', () => {
  it('should combine requestId and logging middleware', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    requestMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.startTime).toBeDefined();
    expect(res._listeners['finish']).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
