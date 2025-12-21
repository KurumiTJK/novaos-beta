// ═══════════════════════════════════════════════════════════════════════════════
// TRACING MIDDLEWARE — Express Tracing Integration
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { startSpan, isTracingEnabled, type Span, type SpanAttributes } from './tracer.js';
import { getContext } from '../logging/context.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Tracing middleware options.
 */
export interface TracingMiddlewareOptions {
  /** Skip tracing for these paths */
  skipPaths?: string[];
  
  /** Custom span name generator */
  spanNameGenerator?: (req: Request) => string;
  
  /** Include request headers in span */
  includeHeaders?: boolean;
  
  /** Include request body in span */
  includeBody?: boolean;
  
  /** Headers to include (if includeHeaders is true) */
  allowedHeaders?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<TracingMiddlewareOptions> = {
  skipPaths: ['/health', '/ready', '/metrics', '/favicon.ico'],
  spanNameGenerator: (req) => `${req.method} ${req.route?.path ?? req.path}`,
  includeHeaders: false,
  includeBody: false,
  allowedHeaders: ['content-type', 'user-agent', 'accept'],
};

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Current tracing span */
      span?: Span;
    }
  }
}

/**
 * Express tracing middleware.
 */
export function tracingMiddleware(
  options: TracingMiddlewareOptions = {}
): RequestHandler {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const skipPathSet = new Set(opts.skipPaths);
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if tracing disabled or path excluded
    if (!isTracingEnabled() || skipPathSet.has(req.path)) {
      return next();
    }
    
    const spanName = opts.spanNameGenerator(req);
    const ctx = getContext();
    
    // Build initial attributes
    const attributes: SpanAttributes = {
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.target': req.path,
      'http.host': req.hostname,
      'http.scheme': req.protocol,
    };
    
    if (ctx?.correlationId) {
      attributes['correlation.id'] = ctx.correlationId;
    }
    
    if (ctx?.requestId) {
      attributes['request.id'] = ctx.requestId;
    }
    
    if (ctx?.userId) {
      attributes['user.id'] = ctx.userId;
    }
    
    // Include allowed headers
    if (opts.includeHeaders) {
      for (const header of opts.allowedHeaders) {
        const value = req.headers[header];
        if (typeof value === 'string') {
          attributes[`http.request.header.${header}`] = value;
        }
      }
    }
    
    // Start span
    const span = startSpan(spanName, {
      kind: 'server',
      attributes,
    });
    
    // Attach to request
    req.span = span;
    
    // Handle response
    res.on('finish', () => {
      span.setAttribute('http.status_code', res.statusCode);
      
      if (res.statusCode >= 400 && res.statusCode < 500) {
        span.setStatus('error', `Client error: ${res.statusCode}`);
      } else if (res.statusCode >= 500) {
        span.setStatus('error', `Server error: ${res.statusCode}`);
      } else {
        span.setStatus('ok');
      }
      
      const contentLength = res.getHeader('content-length');
      if (contentLength) {
        span.setAttribute('http.response_content_length', Number(contentLength));
      }
      
      span.end();
    });
    
    // Handle errors
    res.on('error', (error) => {
      span.recordException(error);
      span.end();
    });
    
    next();
  };
}

/**
 * Create a child span for a specific operation within a request.
 */
export function createChildSpan(req: Request, name: string): Span {
  return startSpan(name, {
    kind: 'internal',
    attributes: {
      'parent.request.id': req.requestId,
    },
  });
}
