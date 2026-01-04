// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import {
  errorHandler,
  asyncHandler,
  ApiError,
  ClientError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  InternalError,
} from '../../../api/middleware/error-handler.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

vi.mock('../../../observability/index.js', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    path: '/api/v1/test',
    method: 'GET',
    headers: {},
    ...overrides,
  } as Request;
}

function createMockResponse(): Response & { _status: number; _json: unknown; _headers: Record<string, string> } {
  const res = {
    _status: 200,
    _json: null,
    _headers: {} as Record<string, string>,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(data: unknown) {
      this._json = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this._headers[name] = value;
      return this;
    },
  };
  return res as Response & { _status: number; _json: unknown; _headers: Record<string, string> };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR CLASSES
// ─────────────────────────────────────────────────────────────────────────────────

describe('Error Classes', () => {
  describe('ApiError', () => {
    it('should create error with defaults', () => {
      const error = new ApiError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('should create error with custom values', () => {
      const error = new ApiError('Custom error', 422, 'CUSTOM_CODE', { field: 'value' });
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.details).toEqual({ field: 'value' });
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error', () => {
      const error = new NotFoundError('User');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('ValidationError', () => {
    it('should create 400 error', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('should create 403 error', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error', () => {
      const error = new ConflictError('Resource exists');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('RateLimitError', () => {
    it('should create 429 error', () => {
      const error = new RateLimitError(120);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(120);
    });
  });

  describe('InternalError', () => {
    it('should create 500 error', () => {
      const error = new InternalError();
      expect(error.statusCode).toBe(500);
    });
  });

  describe('ClientError alias', () => {
    it('should be same as ApiError', () => {
      expect(ClientError).toBe(ApiError);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR HANDLER MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

describe('errorHandler middleware', () => {
  const mockNext = vi.fn() as NextFunction;

  it('should handle ApiError', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const error = new ApiError('Test error', 400, 'TEST_ERROR');

    errorHandler(error, req, res, mockNext);

    expect(res._status).toBe(400);
    expect((res._json as any).code).toBe('TEST_ERROR');
  });

  it('should handle ZodError', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    
    const schema = z.object({ email: z.string().email() });
    let zodError: ZodError;
    try {
      schema.parse({ email: 'invalid' });
    } catch (e) {
      zodError = e as ZodError;
    }

    errorHandler(zodError!, req, res, mockNext);

    expect(res._status).toBe(400);
    expect((res._json as any).code).toBe('VALIDATION_ERROR');
  });

  it('should handle RateLimitError with Retry-After header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const error = new RateLimitError(60);

    errorHandler(error, req, res, mockNext);

    expect(res._status).toBe(429);
    expect(res._headers['Retry-After']).toBe('60');
  });

  it('should handle generic Error', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const error = new Error('Something broke');

    errorHandler(error, req, res, mockNext);

    expect(res._status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

describe('asyncHandler', () => {
  it('should call handler and forward result', async () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    const handler = asyncHandler(async (_req, res) => {
      res.json({ success: true });
    });

    await handler(req, res as Response, next);

    expect(res._json).toEqual({ success: true });
  });

  it('should catch errors and forward to next', async () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    const handler = asyncHandler(async () => {
      throw new Error('Async error');
    });

    await handler(req, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
