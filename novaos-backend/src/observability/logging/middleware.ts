// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING MIDDLEWARE — Express Request Logging with Context
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides Express middleware for:
// - Request context initialization (AsyncLocalStorage)
// - Correlation ID propagation
// - Request/response logging
// - Duration tracking
//
// Usage:
//   import { requestContextMiddleware, requestLoggingMiddleware } from './middleware.js';
//
//   app.use(requestContextMiddleware());
//   app.use(requestLoggingMiddleware());
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';
import {
  createContext,
  runWithContext,
  extractContextFromHeaders,
  CONTEXT_HEADERS,
  type RequestContext,
} from './context.js';
import { getLogger, logRequest, type RequestLogData } from './logger.js';
import type { RequestId, CorrelationId, Timestamp, UserId } from '../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXTEND EXPRESS TYPES
// ─────────────────────────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Unique request ID */
      requestId: string;
      
      /** Correlation ID for distributed tracing */
      correlationId: string;
      
      /** Request start time (high-resolution) */
      startTime: number;
      
      /** Request-scoped logger */
      logger: ReturnType<typeof getLogger>;
      
      /** Full request context */
      requestContext?: RequestContext;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for request context middleware.
 */
export interface RequestContextMiddlewareOptions {
  /** Trust X-Request-Id header from clients */
  trustRequestIdHeader?: boolean;
  
  /** Trust X-Correlation-Id header from upstream services */
  trustCorrelationIdHeader?: boolean;
  
  /** Add context headers to response */
  addResponseHeaders?: boolean;
  
  /** Custom request ID generator */
  generateRequestId?: () => string;
  
  /** Custom correlation ID generator */
  generateCorrelationId?: () => string;
}

/**
 * Options for request logging middleware.
 */
export interface RequestLoggingMiddlewareOptions {
  /** Skip logging for these paths */
  skipPaths?: string[];
  
  /** Skip logging for health checks in production */
  skipHealthChecks?: boolean;
  
  /** Log request body (careful with PII) */
  logBody?: boolean;
  
  /** Maximum body length to log */
  maxBodyLength?: number;
  
  /** Log request headers */
  logHeaders?: boolean;
  
  /** Include user ID from request */
  includeUserId?: boolean | ((req: Request) => string | undefined);
  
  /** Custom skip function */
  skip?: (req: Request, res: Response) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONTEXT_OPTIONS: Required<RequestContextMiddlewareOptions> = {
  trustRequestIdHeader: true,
  trustCorrelationIdHeader: true,
  addResponseHeaders: true,
  generateRequestId: () => `req_${crypto.randomUUID()}`,
  generateCorrelationId: () => `cor_${crypto.randomUUID()}`,
};

const DEFAULT_LOGGING_OPTIONS: Required<RequestLoggingMiddlewareOptions> = {
  skipPaths: [],
  skipHealthChecks: true,
  logBody: false,
  maxBodyLength: 1000,
  logHeaders: false,
  includeUserId: true,
  skip: () => false,
};

const HEALTH_CHECK_PATHS = new Set(['/', '/health', '/ready', '/status', '/metrics']);

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST CONTEXT MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Middleware to initialize request context with AsyncLocalStorage.
 */
export function requestContextMiddleware(
  options: RequestContextMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const opts = { ...DEFAULT_CONTEXT_OPTIONS, ...options };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // Extract or generate IDs
    const incomingContext = extractContextFromHeaders(req.headers);
    
    const requestId = opts.trustRequestIdHeader && incomingContext.requestId
      ? incomingContext.requestId
      : opts.generateRequestId() as RequestId;
    
    const correlationId = opts.trustCorrelationIdHeader && incomingContext.correlationId
      ? incomingContext.correlationId
      : opts.generateCorrelationId() as CorrelationId;
    
    // Create full context
    const context = createContext({
      requestId,
      correlationId,
      parentSpanId: incomingContext.parentSpanId,
      path: req.path,
      method: req.method,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      startTime: performance.now(),
      timestamp: new Date().toISOString() as Timestamp,
    });
    
    // Attach to request object for backward compatibility
    req.requestId = requestId;
    req.correlationId = correlationId;
    req.startTime = Date.now();
    req.requestContext = context;
    req.logger = getLogger({ 
      component: 'request',
      context: { requestId, correlationId },
    });
    
    // Add headers to response
    if (opts.addResponseHeaders) {
      res.setHeader(CONTEXT_HEADERS.REQUEST_ID, requestId);
      res.setHeader(CONTEXT_HEADERS.CORRELATION_ID, correlationId);
    }
    
    // Run the rest of the request within the context
    runWithContext(context, () => {
      next();
    });
  };
}

/**
 * Get client IP from request, handling proxies.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0];
    return first?.trim() ?? 'unknown';
  }
  
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(',')[0];
    return first?.trim() ?? 'unknown';
  }
  
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST LOGGING MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Middleware to log HTTP requests on completion.
 */
export function requestLoggingMiddleware(
  options: RequestLoggingMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const opts = { ...DEFAULT_LOGGING_OPTIONS, ...options };
  const skipPathSet = new Set(opts.skipPaths);
  const isProduction = process.env.NODE_ENV === 'production';
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = req.startTime ?? Date.now();
    
    // Log on response finish
    res.on('finish', () => {
      // Check skip conditions
      if (opts.skip(req, res)) {
        return;
      }
      
      if (skipPathSet.has(req.path)) {
        return;
      }
      
      if (opts.skipHealthChecks && isProduction && HEALTH_CHECK_PATHS.has(req.path)) {
        return;
      }
      
      const duration = Date.now() - startTime;
      
      // Get user ID
      let userId: string | undefined;
      if (typeof opts.includeUserId === 'function') {
        userId = opts.includeUserId(req);
      } else if (opts.includeUserId) {
        userId = (req as Request & { userId?: string }).userId;
      }
      
      const logData: RequestLogData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        requestId: req.requestId,
        correlationId: req.correlationId,
        userId,
        userAgent: req.headers['user-agent'],
        ip: isProduction ? undefined : getClientIp(req), // Redact IP in production
        contentLength: getContentLength(res),
      };
      
      logRequest(logData);
    });
    
    next();
  };
}

/**
 * Get content-length from response.
 */
function getContentLength(res: Response): number | undefined {
  const contentLength = res.getHeader('content-length');
  if (typeof contentLength === 'string') {
    return parseInt(contentLength, 10);
  }
  if (typeof contentLength === 'number') {
    return contentLength;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Combined request middleware (context + logging).
 * Drop-in replacement for existing requestMiddleware.
 */
export function requestMiddleware(
  contextOptions?: RequestContextMiddlewareOptions,
  loggingOptions?: RequestLoggingMiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => void {
  const contextMw = requestContextMiddleware(contextOptions);
  const loggingMw = requestLoggingMiddleware(loggingOptions);
  
  return (req: Request, res: Response, next: NextFunction): void => {
    contextMw(req, res, (err) => {
      if (err) return next(err);
      loggingMw(req, res, next);
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR LOGGING MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Error logging middleware.
 * Should be used after routes but before error handlers.
 */
export function errorLoggingMiddleware(): (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (err: Error, req: Request, res: Response, next: NextFunction): void => {
    const logger = req.logger ?? getLogger({ component: 'error' });
    
    // Determine if this is a client error (4xx) or server error (5xx)
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
    const isClientError = statusCode >= 400 && statusCode < 500;
    
    if (isClientError) {
      logger.warn('Client error', {
        error: err.message,
        statusCode,
        path: req.path,
        method: req.method,
      });
    } else {
      logger.error('Server error', err, {
        statusCode,
        path: req.path,
        method: req.method,
      });
    }
    
    next(err);
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SLOW REQUEST LOGGING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Middleware to warn about slow requests.
 */
export function slowRequestMiddleware(
  thresholdMs: number = 1000
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = req.startTime ?? Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      if (duration > thresholdMs) {
        const logger = req.logger ?? getLogger({ component: 'perf' });
        logger.warn('Slow request detected', {
          path: req.path,
          method: req.method,
          durationMs: duration,
          thresholdMs,
          statusCode: res.statusCode,
        });
      }
    });
    
    next();
  };
}
