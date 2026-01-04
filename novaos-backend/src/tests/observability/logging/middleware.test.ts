// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING MIDDLEWARE TESTS — Express Request Logging
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Application, type Request, type Response } from 'express';
import request from 'supertest';
import {
  requestContextMiddleware,
  requestLoggingMiddleware,
  requestMiddleware,
  errorLoggingMiddleware,
  slowRequestMiddleware,
  type RequestContextMiddlewareOptions,
  type RequestLoggingMiddlewareOptions,
} from '../../../observability/logging/middleware.js';
import { getContext, CONTEXT_HEADERS } from '../../../observability/logging/context.js';
import { resetLogger, configureLogger } from '../../../observability/logging/logger.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

let app: Application;
let consoleOutput: string[] = [];
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  app = express();
  consoleOutput = [];
  
  console.log = vi.fn((...args) => {
    consoleOutput.push(args.map(String).join(' '));
  });
  console.warn = vi.fn((...args) => {
    consoleOutput.push(args.map(String).join(' '));
  });
  console.error = vi.fn((...args) => {
    consoleOutput.push(args.map(String).join(' '));
  });
  
  configureLogger({
    level: 'trace',
    pretty: false,
  });
  resetLogger();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  resetLogger();
});

// ─────────────────────────────────────────────────────────────────────────────────
// requestContextMiddleware TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('requestContextMiddleware()', () => {
  it('should add requestId to request object', async () => {
    let capturedRequestId: string | undefined;
    
    app.use(requestContextMiddleware());
    app.get('/test', (req, res) => {
      capturedRequestId = req.requestId;
      res.send('OK');
    });
    
    await request(app).get('/test');
    
    expect(capturedRequestId).toBeDefined();
    expect(capturedRequestId).toMatch(/^req_/);
  });

  it('should add correlationId to request object', async () => {
    let capturedCorrelationId: string | undefined;
    
    app.use(requestContextMiddleware());
    app.get('/test', (req, res) => {
      capturedCorrelationId = req.correlationId;
      res.send('OK');
    });
    
    await request(app).get('/test');
    
    expect(capturedCorrelationId).toBeDefined();
    expect(capturedCorrelationId).toMatch(/^cor_/);
  });

  it('should add startTime to request object', async () => {
    let capturedStartTime: number | undefined;
    
    app.use(requestContextMiddleware());
    app.get('/test', (req, res) => {
      capturedStartTime = req.startTime;
      res.send('OK');
    });
    
    await request(app).get('/test');
    
    expect(capturedStartTime).toBeDefined();
    expect(typeof capturedStartTime).toBe('number');
  });

  it('should add logger to request object', async () => {
    let hasLogger = false;
    
    app.use(requestContextMiddleware());
    app.get('/test', (req, res) => {
      hasLogger = typeof req.logger?.info === 'function';
      res.send('OK');
    });
    
    await request(app).get('/test');
    
    expect(hasLogger).toBe(true);
  });

  it('should trust incoming x-request-id header by default', async () => {
    let capturedRequestId: string | undefined;
    
    app.use(requestContextMiddleware());
    app.get('/test', (req, res) => {
      capturedRequestId = req.requestId;
      res.send('OK');
    });
    
    await request(app)
      .get('/test')
      .set('x-request-id', 'custom-request-id');
    
    expect(capturedRequestId).toBe('custom-request-id');
  });

  it('should trust incoming x-correlation-id header by default', async () => {
    let capturedCorrelationId: string | undefined;
    
    app.use(requestContextMiddleware());
    app.get('/test', (req, res) => {
      capturedCorrelationId = req.correlationId;
      res.send('OK');
    });
    
    await request(app)
      .get('/test')
      .set('x-correlation-id', 'custom-correlation-id');
    
    expect(capturedCorrelationId).toBe('custom-correlation-id');
  });

  it('should not trust headers when configured', async () => {
    let capturedRequestId: string | undefined;
    
    app.use(requestContextMiddleware({ trustRequestIdHeader: false }));
    app.get('/test', (req, res) => {
      capturedRequestId = req.requestId;
      res.send('OK');
    });
    
    await request(app)
      .get('/test')
      .set('x-request-id', 'untrusted-id');
    
    expect(capturedRequestId).not.toBe('untrusted-id');
    expect(capturedRequestId).toMatch(/^req_/);
  });

  it('should add response headers by default', async () => {
    app.use(requestContextMiddleware());
    app.get('/test', (req, res) => res.send('OK'));
    
    const response = await request(app).get('/test');
    
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['x-correlation-id']).toBeDefined();
  });

  it('should not add response headers when disabled', async () => {
    app.use(requestContextMiddleware({ addResponseHeaders: false }));
    app.get('/test', (req, res) => res.send('OK'));
    
    const response = await request(app).get('/test');
    
    expect(response.headers['x-request-id']).toBeUndefined();
    expect(response.headers['x-correlation-id']).toBeUndefined();
  });

  it('should make context available via getContext()', async () => {
    let capturedContext: ReturnType<typeof getContext>;
    
    app.use(requestContextMiddleware());
    app.get('/test', (req, res) => {
      capturedContext = getContext();
      res.send('OK');
    });
    
    await request(app).get('/test');
    
    expect(capturedContext).toBeDefined();
    expect(capturedContext?.requestId).toBeDefined();
    expect(capturedContext?.path).toBe('/test');
    expect(capturedContext?.method).toBe('GET');
  });

  it('should use custom ID generators when trustRequestIdHeader is false', async () => {
    let capturedRequestId: string | undefined;
    
    // Explicitly disable trusting headers to ensure custom generator is used
    app.use(requestContextMiddleware({
      trustRequestIdHeader: false,
      generateRequestId: () => 'custom-generated-id',
    }));
    app.get('/test', (req, res) => {
      capturedRequestId = req.requestId;
      res.send('OK');
    });
    
    await request(app).get('/test');
    
    expect(capturedRequestId).toBe('custom-generated-id');
  });

  it('should add requestContext to request object', async () => {
    let hasRequestContext = false;
    
    app.use(requestContextMiddleware());
    app.get('/test', (req, res) => {
      hasRequestContext = req.requestContext !== undefined;
      res.send('OK');
    });
    
    await request(app).get('/test');
    
    expect(hasRequestContext).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// requestLoggingMiddleware TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('requestLoggingMiddleware()', () => {
  beforeEach(() => {
    app.use(requestContextMiddleware());
  });

  it('should log completed requests', async () => {
    app.use(requestLoggingMiddleware());
    app.get('/test', (req, res) => res.send('OK'));
    
    await request(app).get('/test');
    
    expect(consoleOutput.some(o => o.includes('GET'))).toBe(true);
    expect(consoleOutput.some(o => o.includes('/test'))).toBe(true);
    expect(consoleOutput.some(o => o.includes('200'))).toBe(true);
  });

  it('should skip configured paths', async () => {
    app.use(requestLoggingMiddleware({ skipPaths: ['/skip'] }));
    app.get('/skip', (req, res) => res.send('OK'));
    
    await request(app).get('/skip');
    
    expect(consoleOutput.some(o => o.includes('/skip'))).toBe(false);
  });

  it('should skip health checks in production by default', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    app.use(requestLoggingMiddleware({ skipHealthChecks: true }));
    app.get('/health', (req, res) => res.send('OK'));
    
    await request(app).get('/health');
    
    expect(consoleOutput.some(o => o.includes('/health'))).toBe(false);
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should use custom skip function', async () => {
    app.use(requestLoggingMiddleware({
      skip: (req) => req.path === '/custom-skip',
    }));
    app.get('/custom-skip', (req, res) => res.send('OK'));
    
    await request(app).get('/custom-skip');
    
    expect(consoleOutput.some(o => o.includes('/custom-skip'))).toBe(false);
  });

  it('should include user ID from function', async () => {
    app.use(requestLoggingMiddleware({
      includeUserId: (req) => 'user-from-function',
    }));
    app.get('/test', (req, res) => res.send('OK'));
    
    await request(app).get('/test');
    
    expect(consoleOutput.some(o => o.includes('user-from-function'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// requestMiddleware (Combined) TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('requestMiddleware()', () => {
  it('should combine context and logging middleware', async () => {
    let hasRequestId = false;
    
    app.use(requestMiddleware());
    app.get('/test', (req, res) => {
      hasRequestId = req.requestId !== undefined;
      res.send('OK');
    });
    
    await request(app).get('/test');
    
    expect(hasRequestId).toBe(true);
    expect(consoleOutput.some(o => o.includes('/test'))).toBe(true);
  });

  it('should accept context options', async () => {
    let capturedRequestId: string | undefined;
    
    app.use(requestMiddleware({ trustRequestIdHeader: false }));
    app.get('/test', (req, res) => {
      capturedRequestId = req.requestId;
      res.send('OK');
    });
    
    await request(app)
      .get('/test')
      .set('x-request-id', 'untrusted');
    
    expect(capturedRequestId).not.toBe('untrusted');
  });

  it('should accept logging options', async () => {
    app.use(requestMiddleware(undefined, { skipPaths: ['/skip'] }));
    app.get('/skip', (req, res) => res.send('OK'));
    
    await request(app).get('/skip');
    
    expect(consoleOutput.some(o => o.includes('/skip'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// errorLoggingMiddleware TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('errorLoggingMiddleware()', () => {
  it('should log server errors (5xx)', async () => {
    app.use(requestContextMiddleware());
    app.get('/error', (req, res, next) => {
      const error = new Error('Server error') as Error & { statusCode?: number };
      error.statusCode = 500;
      next(error);
    });
    app.use(errorLoggingMiddleware());
    app.use((err: Error, req: Request, res: Response, next: Function) => {
      res.status(500).send('Error');
    });
    
    await request(app).get('/error');
    
    expect(consoleOutput.some(o => o.includes('error'))).toBe(true);
    expect(consoleOutput.some(o => o.includes('Server error'))).toBe(true);
  });

  it('should log client errors (4xx) as warnings', async () => {
    app.use(requestContextMiddleware());
    app.get('/not-found', (req, res, next) => {
      const error = new Error('Not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      next(error);
    });
    app.use(errorLoggingMiddleware());
    app.use((err: Error, req: Request, res: Response, next: Function) => {
      res.status(404).send('Not found');
    });
    
    await request(app).get('/not-found');
    
    // Check for client error log or 404 status in output
    expect(consoleOutput.some(o => o.includes('Client error') || o.includes('404'))).toBe(true);
  });

  it('should pass error to next middleware', async () => {
    let errorHandlerCalled = false;
    
    app.use(requestContextMiddleware());
    app.get('/error', (req, res, next) => {
      next(new Error('Test'));
    });
    app.use(errorLoggingMiddleware());
    app.use((err: Error, req: Request, res: Response, next: Function) => {
      errorHandlerCalled = true;
      res.status(500).send('Handled');
    });
    
    await request(app).get('/error');
    
    expect(errorHandlerCalled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// slowRequestMiddleware TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('slowRequestMiddleware()', () => {
  it('should warn about slow requests', async () => {
    app.use(requestContextMiddleware());
    app.use(slowRequestMiddleware(50)); // 50ms threshold
    app.get('/slow', async (req, res) => {
      await new Promise(r => setTimeout(r, 100));
      res.send('OK');
    });
    
    await request(app).get('/slow');
    // Small delay to allow finish event to fire
    await new Promise(r => setTimeout(r, 50));
    
    expect(consoleOutput.some(o => o.includes('Slow request'))).toBe(true);
  });

  it('should not warn about fast requests', async () => {
    app.use(requestContextMiddleware());
    app.use(slowRequestMiddleware(1000)); // 1s threshold
    app.get('/fast', (req, res) => res.send('OK'));
    
    await request(app).get('/fast');
    await new Promise(r => setTimeout(r, 50));
    
    expect(consoleOutput.some(o => o.includes('Slow request'))).toBe(false);
  });

  it('should use default threshold of 1000ms', async () => {
    app.use(requestContextMiddleware());
    app.use(slowRequestMiddleware()); // Default 1000ms
    app.get('/medium', async (req, res) => {
      await new Promise(r => setTimeout(r, 500));
      res.send('OK');
    });
    
    await request(app).get('/medium');
    await new Promise(r => setTimeout(r, 50));
    
    // 500ms is less than 1000ms default threshold
    expect(consoleOutput.some(o => o.includes('Slow request'))).toBe(false);
  });

  it('should include request details in slow warning', async () => {
    app.use(requestContextMiddleware());
    app.use(slowRequestMiddleware(10));
    app.get('/details', async (req, res) => {
      await new Promise(r => setTimeout(r, 50));
      res.send('OK');
    });
    
    await request(app).get('/details');
    await new Promise(r => setTimeout(r, 50));
    
    const slowLog = consoleOutput.find(o => o.includes('Slow request'));
    expect(slowLog).toBeDefined();
    if (slowLog) {
      expect(slowLog).toContain('/details');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Middleware Integration', () => {
  it('should work with full middleware stack', async () => {
    let contextAvailable = false;
    
    app.use(requestContextMiddleware());
    app.use(requestLoggingMiddleware());
    app.use(slowRequestMiddleware(1000));
    
    app.get('/integration', (req, res) => {
      contextAvailable = getContext() !== undefined;
      res.send('OK');
    });
    
    app.use(errorLoggingMiddleware());
    
    const response = await request(app).get('/integration');
    
    expect(response.status).toBe(200);
    expect(contextAvailable).toBe(true);
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('should propagate context through async handlers', async () => {
    let contextInAsync: ReturnType<typeof getContext>;
    
    app.use(requestContextMiddleware());
    app.get('/async', async (req, res) => {
      await new Promise(r => setTimeout(r, 10));
      contextInAsync = getContext();
      res.send('OK');
    });
    
    await request(app).get('/async');
    
    expect(contextInAsync).toBeDefined();
    expect(contextInAsync?.path).toBe('/async');
  });

  it('should handle errors gracefully', async () => {
    app.use(requestContextMiddleware());
    app.use(requestLoggingMiddleware());
    
    app.get('/throw', () => {
      throw new Error('Unexpected error');
    });
    
    app.use(errorLoggingMiddleware());
    app.use((err: Error, req: Request, res: Response, next: Function) => {
      res.status(500).json({ error: err.message });
    });
    
    const response = await request(app).get('/throw');
    
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Unexpected error');
  });
});
