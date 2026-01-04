// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST CONTEXT TESTS — AsyncLocalStorage Context Management
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateRequestId,
  generateCorrelationId,
  generateSpanId,
  parseOrGenerateRequestId,
  parseOrGenerateCorrelationId,
  createContext,
  runWithContext,
  runWithNewContext,
  getContext,
  requireContext,
  getContextValue,
  getRequestId,
  getCorrelationId,
  getUserId,
  getSpanId,
  getRequestDuration,
  extendContext,
  runWithChildContext,
  CONTEXT_HEADERS,
  extractContextFromHeaders,
  createContextHeaders,
  getLoggingContext,
  getMinimalLoggingContext,
  type RequestContext,
  type PartialContext,
} from '../../../observability/logging/context.js';
import type { RequestId, CorrelationId, UserId, Timestamp } from '../../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ID GENERATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ID Generation', () => {
  describe('generateRequestId()', () => {
    it('should generate a request ID with req_ prefix', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req_[a-f0-9-]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('generateCorrelationId()', () => {
    it('should generate a correlation ID with cor_ prefix', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^cor_[a-f0-9-]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateCorrelationId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('generateSpanId()', () => {
    it('should generate a 16-character hex span ID', () => {
      const id = generateSpanId();
      expect(id).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateSpanId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('parseOrGenerateRequestId()', () => {
    it('should return existing ID if valid', () => {
      const existing = 'my-request-123';
      const result = parseOrGenerateRequestId(existing);
      expect(result).toBe(existing);
    });

    it('should generate new ID if undefined', () => {
      const result = parseOrGenerateRequestId(undefined);
      expect(result).toMatch(/^req_/);
    });

    it('should generate new ID if empty string', () => {
      const result = parseOrGenerateRequestId('');
      expect(result).toMatch(/^req_/);
    });

    it('should generate new ID if too long', () => {
      const tooLong = 'a'.repeat(200);
      const result = parseOrGenerateRequestId(tooLong);
      expect(result).toMatch(/^req_/);
    });
  });

  describe('parseOrGenerateCorrelationId()', () => {
    it('should return existing ID if valid', () => {
      const existing = 'cor-123-456';
      const result = parseOrGenerateCorrelationId(existing);
      expect(result).toBe(existing);
    });

    it('should generate new ID if undefined', () => {
      const result = parseOrGenerateCorrelationId(undefined);
      expect(result).toMatch(/^cor_/);
    });

    it('should generate new ID if empty string', () => {
      const result = parseOrGenerateCorrelationId('');
      expect(result).toMatch(/^cor_/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT MANAGEMENT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Context Management', () => {
  describe('createContext()', () => {
    it('should create context with generated IDs', () => {
      const ctx = createContext();
      
      expect(ctx.requestId).toMatch(/^req_/);
      expect(ctx.correlationId).toMatch(/^cor_/);
      expect(ctx.spanId).toBeDefined();
      expect(ctx.timestamp).toBeDefined();
      expect(ctx.startTime).toBeDefined();
    });

    it('should use provided partial values', () => {
      const ctx = createContext({
        requestId: 'custom-req' as RequestId,
        correlationId: 'custom-cor' as CorrelationId,
        userId: 'user-123' as UserId,
        path: '/api/test',
      });
      
      expect(ctx.requestId).toBe('custom-req');
      expect(ctx.correlationId).toBe('custom-cor');
      expect(ctx.userId).toBe('user-123');
      expect(ctx.path).toBe('/api/test');
    });

    it('should set timestamp close to current time', () => {
      const before = Date.now();
      const ctx = createContext();
      const after = Date.now();
      
      const timestamp = new Date(ctx.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('runWithContext()', () => {
    it('should make context available within callback', () => {
      const ctx = createContext({ path: '/test' });
      
      runWithContext(ctx, () => {
        const retrieved = getContext();
        expect(retrieved).toBe(ctx);
        expect(retrieved?.path).toBe('/test');
      });
    });

    it('should return callback result', () => {
      const ctx = createContext();
      
      const result = runWithContext(ctx, () => 'result');
      
      expect(result).toBe('result');
    });

    it('should work with async callbacks', async () => {
      const ctx = createContext({ userId: 'async-user' as UserId });
      
      const result = await runWithContext(ctx, async () => {
        await new Promise(r => setTimeout(r, 10));
        return getContext()?.userId;
      });
      
      expect(result).toBe('async-user');
    });

    it('should propagate context through async operations', async () => {
      const ctx = createContext({ path: '/async' });
      
      await runWithContext(ctx, async () => {
        await Promise.resolve();
        expect(getContext()?.path).toBe('/async');
        
        await new Promise(r => setTimeout(r, 10));
        expect(getContext()?.path).toBe('/async');
      });
    });

    it('should isolate contexts between runs', () => {
      const ctx1 = createContext({ path: '/first' });
      const ctx2 = createContext({ path: '/second' });
      
      runWithContext(ctx1, () => {
        expect(getContext()?.path).toBe('/first');
      });
      
      runWithContext(ctx2, () => {
        expect(getContext()?.path).toBe('/second');
      });
    });
  });

  describe('runWithNewContext()', () => {
    it('should create and run with new context', () => {
      runWithNewContext({ path: '/new' }, () => {
        const ctx = getContext();
        expect(ctx).toBeDefined();
        expect(ctx?.path).toBe('/new');
        expect(ctx?.requestId).toBeDefined();
      });
    });
  });

  describe('getContext()', () => {
    it('should return undefined outside of context', () => {
      const ctx = getContext();
      expect(ctx).toBeUndefined();
    });

    it('should return context inside runWithContext', () => {
      const ctx = createContext();
      
      runWithContext(ctx, () => {
        expect(getContext()).toBe(ctx);
      });
    });
  });

  describe('requireContext()', () => {
    it('should throw outside of context', () => {
      expect(() => requireContext()).toThrow('Request context not available');
    });

    it('should return context inside runWithContext', () => {
      const ctx = createContext();
      
      runWithContext(ctx, () => {
        expect(requireContext()).toBe(ctx);
      });
    });
  });

  describe('getContextValue()', () => {
    it('should return value if context exists', () => {
      const ctx = createContext({ path: '/value-test' });
      
      runWithContext(ctx, () => {
        const path = getContextValue('path', '/default');
        expect(path).toBe('/value-test');
      });
    });

    it('should return fallback if context missing', () => {
      const path = getContextValue('path', '/default');
      expect(path).toBe('/default');
    });

    it('should return fallback if value undefined', () => {
      const ctx = createContext();
      
      runWithContext(ctx, () => {
        const userId = getContextValue('userId', 'default-user' as UserId);
        expect(userId).toBe('default-user');
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT ACCESSOR TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Context Accessors', () => {
  describe('getRequestId()', () => {
    it('should return request ID from context', () => {
      const ctx = createContext({ requestId: 'req-123' as RequestId });
      
      runWithContext(ctx, () => {
        expect(getRequestId()).toBe('req-123');
      });
    });

    it('should return "unknown" outside context', () => {
      expect(getRequestId()).toBe('unknown');
    });
  });

  describe('getCorrelationId()', () => {
    it('should return correlation ID from context', () => {
      const ctx = createContext({ correlationId: 'cor-456' as CorrelationId });
      
      runWithContext(ctx, () => {
        expect(getCorrelationId()).toBe('cor-456');
      });
    });

    it('should return "unknown" outside context', () => {
      expect(getCorrelationId()).toBe('unknown');
    });
  });

  describe('getUserId()', () => {
    it('should return user ID from context', () => {
      const ctx = createContext({ userId: 'user-789' as UserId });
      
      runWithContext(ctx, () => {
        expect(getUserId()).toBe('user-789');
      });
    });

    it('should return undefined outside context', () => {
      expect(getUserId()).toBeUndefined();
    });

    it('should return undefined if not set', () => {
      const ctx = createContext();
      
      runWithContext(ctx, () => {
        expect(getUserId()).toBeUndefined();
      });
    });
  });

  describe('getSpanId()', () => {
    it('should return span ID from context', () => {
      const ctx = createContext({ spanId: 'span-abc' });
      
      runWithContext(ctx, () => {
        expect(getSpanId()).toBe('span-abc');
      });
    });

    it('should return undefined outside context', () => {
      expect(getSpanId()).toBeUndefined();
    });
  });

  describe('getRequestDuration()', () => {
    it('should return duration since start', async () => {
      const ctx = createContext();
      
      await runWithContext(ctx, async () => {
        await new Promise(r => setTimeout(r, 50));
        const duration = getRequestDuration();
        expect(duration).toBeGreaterThanOrEqual(40);
        expect(duration).toBeLessThan(200);
      });
    });

    it('should return 0 outside context', () => {
      expect(getRequestDuration()).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT MODIFICATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Context Modification', () => {
  describe('extendContext()', () => {
    it('should create new context with extensions', () => {
      const parent = createContext({ path: '/parent' });
      
      runWithContext(parent, () => {
        const child = extendContext({ userId: 'user-123' as UserId });
        
        expect(child.path).toBe('/parent');
        expect(child.userId).toBe('user-123');
        expect(child.requestId).toBe(parent.requestId);
      });
    });

    it('should set parent span ID', () => {
      const parent = createContext({ spanId: 'parent-span' });
      
      runWithContext(parent, () => {
        const child = extendContext({});
        
        expect(child.parentSpanId).toBe('parent-span');
        expect(child.spanId).not.toBe('parent-span');
      });
    });

    it('should create fresh context if none exists', () => {
      const extended = extendContext({ path: '/orphan' });
      
      expect(extended.requestId).toBeDefined();
      expect(extended.path).toBe('/orphan');
    });

    it('should allow overriding values', () => {
      const parent = createContext({ path: '/parent', method: 'GET' });
      
      runWithContext(parent, () => {
        const child = extendContext({ path: '/child' });
        
        expect(child.path).toBe('/child');
        expect(child.method).toBe('GET');
      });
    });
  });

  describe('runWithChildContext()', () => {
    it('should run with extended context', () => {
      const parent = createContext({ path: '/parent' });
      
      runWithContext(parent, () => {
        runWithChildContext({ userId: 'child-user' as UserId }, () => {
          const ctx = getContext();
          expect(ctx?.path).toBe('/parent');
          expect(ctx?.userId).toBe('child-user');
          expect(ctx?.parentSpanId).toBe(parent.spanId);
        });
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// HEADER PROPAGATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Header Propagation', () => {
  describe('CONTEXT_HEADERS', () => {
    it('should define all required headers', () => {
      expect(CONTEXT_HEADERS.REQUEST_ID).toBe('x-request-id');
      expect(CONTEXT_HEADERS.CORRELATION_ID).toBe('x-correlation-id');
      expect(CONTEXT_HEADERS.SPAN_ID).toBe('x-span-id');
      expect(CONTEXT_HEADERS.PARENT_SPAN_ID).toBe('x-parent-span-id');
      expect(CONTEXT_HEADERS.USER_ID).toBe('x-user-id');
    });
  });

  describe('extractContextFromHeaders()', () => {
    it('should extract context from headers', () => {
      const headers = {
        'x-request-id': 'req-from-header',
        'x-correlation-id': 'cor-from-header',
        'x-parent-span-id': 'parent-span',
        'x-user-id': 'user-from-header',
      };
      
      const ctx = extractContextFromHeaders(headers);
      
      expect(ctx.requestId).toBe('req-from-header');
      expect(ctx.correlationId).toBe('cor-from-header');
      expect(ctx.parentSpanId).toBe('parent-span');
      expect(ctx.userId).toBe('user-from-header');
    });

    it('should handle array headers', () => {
      const headers = {
        'x-request-id': ['first-req', 'second-req'],
      };
      
      const ctx = extractContextFromHeaders(headers);
      
      expect(ctx.requestId).toBe('first-req');
    });

    it('should generate IDs for missing headers', () => {
      const ctx = extractContextFromHeaders({});
      
      expect(ctx.requestId).toMatch(/^req_/);
      expect(ctx.correlationId).toMatch(/^cor_/);
    });
  });

  describe('createContextHeaders()', () => {
    it('should create headers from context', () => {
      const ctx = createContext({
        requestId: 'req-to-header' as RequestId,
        correlationId: 'cor-to-header' as CorrelationId,
        spanId: 'span-to-header',
        userId: 'user-to-header' as UserId,
      });
      
      runWithContext(ctx, () => {
        const headers = createContextHeaders();
        
        expect(headers['x-request-id']).toBe('req-to-header');
        expect(headers['x-correlation-id']).toBe('cor-to-header');
        expect(headers['x-parent-span-id']).toBe('span-to-header');
        expect(headers['x-user-id']).toBe('user-to-header');
      });
    });

    it('should return empty object outside context', () => {
      const headers = createContextHeaders();
      expect(headers).toEqual({});
    });

    it('should accept explicit context parameter', () => {
      const ctx = createContext({
        requestId: 'explicit-req' as RequestId,
        correlationId: 'explicit-cor' as CorrelationId,
      });
      
      const headers = createContextHeaders(ctx);
      
      expect(headers['x-request-id']).toBe('explicit-req');
    });

    it('should omit undefined optional fields', () => {
      const ctx = createContext();
      
      const headers = createContextHeaders(ctx);
      
      expect(headers['x-user-id']).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGING CONTEXT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Logging Context', () => {
  describe('getLoggingContext()', () => {
    it('should return context fields for logging', () => {
      const ctx = createContext({
        requestId: 'log-req' as RequestId,
        correlationId: 'log-cor' as CorrelationId,
        userId: 'log-user' as UserId,
        spanId: 'log-span',
        parentSpanId: 'log-parent',
        path: '/api/test',
        method: 'POST',
      });
      
      runWithContext(ctx, () => {
        const logCtx = getLoggingContext();
        
        expect(logCtx.requestId).toBe('log-req');
        expect(logCtx.correlationId).toBe('log-cor');
        expect(logCtx.userId).toBe('log-user');
        expect(logCtx.spanId).toBe('log-span');
        expect(logCtx.parentSpanId).toBe('log-parent');
        expect(logCtx.path).toBe('/api/test');
        expect(logCtx.method).toBe('POST');
      });
    });

    it('should return empty object outside context', () => {
      const logCtx = getLoggingContext();
      expect(logCtx).toEqual({});
    });

    it('should exclude undefined fields', () => {
      const ctx = createContext();
      
      runWithContext(ctx, () => {
        const logCtx = getLoggingContext();
        
        expect('userId' in logCtx).toBe(false);
        expect('path' in logCtx).toBe(false);
      });
    });
  });

  describe('getMinimalLoggingContext()', () => {
    it('should return compact context fields', () => {
      const ctx = createContext({
        requestId: 'min-req' as RequestId,
        correlationId: 'min-cor' as CorrelationId,
        userId: 'min-user' as UserId,
      });
      
      runWithContext(ctx, () => {
        const minCtx = getMinimalLoggingContext();
        
        expect(minCtx.reqId).toBe('min-req');
        expect(minCtx.corId).toBe('min-cor');
        expect(minCtx.uid).toBe('min-user');
      });
    });

    it('should return empty object outside context', () => {
      const minCtx = getMinimalLoggingContext();
      expect(minCtx).toEqual({});
    });

    it('should exclude undefined user ID', () => {
      const ctx = createContext();
      
      runWithContext(ctx, () => {
        const minCtx = getMinimalLoggingContext();
        
        expect('uid' in minCtx).toBe(false);
      });
    });
  });
});
