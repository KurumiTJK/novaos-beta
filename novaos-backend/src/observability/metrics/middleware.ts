// ═══════════════════════════════════════════════════════════════════════════════
// METRICS MIDDLEWARE — Express Request Metrics & /metrics Endpoint
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides Express middleware for:
// - Recording HTTP request duration, status, size
// - Tracking in-flight requests
// - Exposing /metrics endpoint for Prometheus
//
// Usage:
//   import { metricsMiddleware, metricsEndpoint } from './middleware.js';
//
//   app.use(metricsMiddleware());
//   app.get('/metrics', metricsEndpoint());
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getMetricsCollector, type Labels } from './collector.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for metrics middleware.
 */
export interface MetricsMiddlewareOptions {
  /** Skip metrics for these paths */
  skipPaths?: string[];
  
  /** Skip metrics based on custom function */
  skip?: (req: Request) => boolean;
  
  /** Normalize path for metrics (reduce cardinality) */
  normalizePath?: (req: Request) => string;
  
  /** Track request body size */
  trackRequestSize?: boolean;
  
  /** Track response body size */
  trackResponseSize?: boolean;
  
  /** Track in-flight requests */
  trackInFlight?: boolean;
  
  /** Custom labels to add */
  customLabels?: (req: Request, res: Response) => Labels;
}

/**
 * Options for metrics endpoint.
 */
export interface MetricsEndpointOptions {
  /** Require authentication for metrics endpoint */
  requireAuth?: boolean;
  
  /** Custom authentication check */
  authCheck?: (req: Request) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PATH NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Default path normalizer to reduce metric cardinality.
 * Replaces dynamic segments like UUIDs and IDs with placeholders.
 */
function defaultNormalizePath(req: Request): string {
  let path = req.route?.path ?? req.path;
  
  // Use route path if available (from express router)
  if (req.route?.path) {
    return req.route.path;
  }
  
  // Normalize common patterns
  // UUID pattern
  path = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
  
  // Numeric IDs
  path = path.replace(/\/\d+/g, '/:id');
  
  // Prefixed IDs (goal_xxx, user_xxx, etc.)
  path = path.replace(/\/(goal|quest|step|spark|user|conv)_[a-zA-Z0-9]+/g, '/:id');
  
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────────
// METRICS MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Express middleware to record HTTP metrics.
 */
export function metricsMiddleware(
  options: MetricsMiddlewareOptions = {}
): RequestHandler {
  const {
    skipPaths = ['/metrics', '/health', '/ready', '/favicon.ico'],
    skip,
    normalizePath = defaultNormalizePath,
    trackRequestSize = false,
    trackResponseSize = true,
    trackInFlight = true,
    customLabels,
  } = options;
  
  const skipPathSet = new Set(skipPaths);
  const metrics = getMetricsCollector();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check skip conditions
    if (skipPathSet.has(req.path) || skip?.(req)) {
      return next();
    }
    
    const startTime = process.hrtime.bigint();
    const method = req.method;
    
    // Track in-flight requests
    if (trackInFlight) {
      metrics.incrementGauge('http_requests_in_flight', { method });
    }
    
    // Track request size
    if (trackRequestSize) {
      const contentLength = req.headers['content-length'];
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (!isNaN(size)) {
          const path = normalizePath(req);
          metrics.observeHistogram('http_request_size_bytes', size, { method, path });
        }
      }
    }
    
    // Capture response metrics on finish
    res.on('finish', () => {
      const path = normalizePath(req);
      const statusCode = String(res.statusCode);
      const durationNs = process.hrtime.bigint() - startTime;
      const durationSeconds = Number(durationNs) / 1e9;
      
      // Base labels
      const labels: Labels = {
        method,
        path,
        status_code: statusCode,
      };
      
      // Add custom labels
      if (customLabels) {
        Object.assign(labels, customLabels(req, res));
      }
      
      // Record duration
      metrics.observeHistogram('http_request_duration_seconds', durationSeconds, labels);
      
      // Record request count
      metrics.incrementCounter('http_requests_total', labels);
      
      // Track response size
      if (trackResponseSize) {
        const contentLength = res.getHeader('content-length');
        if (contentLength) {
          const size = typeof contentLength === 'string' 
            ? parseInt(contentLength, 10) 
            : contentLength;
          if (typeof size === 'number' && !isNaN(size)) {
            metrics.observeHistogram('http_response_size_bytes', size, { method, path });
          }
        }
      }
      
      // Decrement in-flight
      if (trackInFlight) {
        metrics.decrementGauge('http_requests_in_flight', { method });
      }
    });
    
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// METRICS ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create /metrics endpoint handler for Prometheus scraping.
 */
export function metricsEndpoint(
  options: MetricsEndpointOptions = {}
): RequestHandler {
  const { requireAuth = false, authCheck } = options;
  
  return async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    // Check authentication if required
    if (requireAuth) {
      const isAuthed = authCheck?.(req) ?? hasMetricsAuth(req);
      if (!isAuthed) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }
    
    try {
      const metrics = getMetricsCollector();
      const metricsText = await metrics.getMetrics();
      
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metricsText);
    } catch (error) {
      console.error('Error generating metrics:', error);
      res.status(500).json({ error: 'Failed to generate metrics' });
    }
  };
}

/**
 * Default auth check for metrics endpoint.
 */
function hasMetricsAuth(req: Request): boolean {
  // Check for bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const metricsToken = process.env.METRICS_AUTH_TOKEN;
    if (metricsToken && token === metricsToken) {
      return true;
    }
  }
  
  // Check for basic auth
  if (authHeader?.startsWith('Basic ')) {
    const encoded = authHeader.substring(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const [user, pass] = decoded.split(':');
    
    const expectedUser = process.env.METRICS_AUTH_USER ?? 'prometheus';
    const expectedPass = process.env.METRICS_AUTH_PASS;
    
    if (expectedPass && user === expectedUser && pass === expectedPass) {
      return true;
    }
  }
  
  // Allow localhost in development
  const isDev = process.env.NODE_ENV !== 'production';
  const clientIp = req.ip ?? req.socket.remoteAddress ?? '';
  const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
  
  return isDev && isLocalhost;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIALIZED RECORDING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Record authentication success.
 */
export function recordAuthSuccess(method: string, tier: string): void {
  getMetricsCollector().incrementCounter('auth_success_total', { method, tier });
}

/**
 * Record authentication failure.
 */
export function recordAuthFailure(method: string, reason: string): void {
  getMetricsCollector().incrementCounter('auth_failure_total', { method, reason });
}

/**
 * Record rate limit hit.
 */
export function recordRateLimitHit(path: string, tier: string, limitType: string): void {
  getMetricsCollector().incrementCounter('rate_limit_hits_total', {
    path,
    tier,
    limit_type: limitType,
  });
}

/**
 * Record LLM request.
 */
export function recordLLMRequest(
  provider: string,
  model: string,
  operation: string,
  durationSeconds: number,
  status: 'success' | 'error'
): void {
  const metrics = getMetricsCollector();
  
  metrics.observeHistogram('llm_request_duration_seconds', durationSeconds, {
    provider,
    model,
    operation,
  });
  
  metrics.incrementCounter('llm_requests_total', {
    provider,
    model,
    operation,
    status,
  });
}

/**
 * Record LLM token usage.
 */
export function recordLLMTokens(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): void {
  const metrics = getMetricsCollector();
  
  metrics.incrementCounter('llm_tokens_used_total', {
    provider,
    model,
    token_type: 'input',
  }, inputTokens);
  
  metrics.incrementCounter('llm_tokens_used_total', {
    provider,
    model,
    token_type: 'output',
  }, outputTokens);
  
  metrics.observeHistogram('llm_tokens_per_request', inputTokens, {
    provider,
    model,
    token_type: 'input',
  });
  
  metrics.observeHistogram('llm_tokens_per_request', outputTokens, {
    provider,
    model,
    token_type: 'output',
  });
}

/**
 * Record spark completion.
 */
export function recordSparkCompletion(completionType: string, sparkType: string): void {
  getMetricsCollector().incrementCounter('sword_spark_completions_total', {
    completion_type: completionType,
    spark_type: sparkType,
  });
}

/**
 * Record step generation.
 */
export function recordStepGeneration(status: 'success' | 'error', questType: string): void {
  getMetricsCollector().incrementCounter('sword_step_generations_total', {
    status,
    quest_type: questType,
  });
}

/**
 * Record reminder send.
 */
export function recordReminderSend(channel: string, escalationLevel: number): void {
  getMetricsCollector().incrementCounter('sword_reminder_sends_total', {
    channel,
    escalation_level: String(escalationLevel),
  });
}

/**
 * Record cache operation.
 */
export function recordCacheOperation(
  cacheName: string,
  operation: string,
  hit: boolean
): void {
  const metrics = getMetricsCollector();
  
  if (hit) {
    metrics.incrementCounter('cache_hits_total', { cache_name: cacheName, operation });
  } else {
    metrics.incrementCounter('cache_misses_total', { cache_name: cacheName, operation });
  }
}

/**
 * Record SSRF decision.
 */
export function recordSSRFDecision(decision: 'allow' | 'block', reason: string): void {
  getMetricsCollector().incrementCounter('security_ssrf_decisions_total', {
    decision,
    reason,
  });
}

/**
 * Record security violation.
 */
export function recordSecurityViolation(violationType: string, severity: string): void {
  getMetricsCollector().incrementCounter('security_violations_total', {
    violation_type: violationType,
    severity,
  });
}

/**
 * Update Redis connection status.
 */
export function updateRedisStatus(connected: boolean): void {
  getMetricsCollector().setGauge('redis_connected', connected ? 1 : 0);
}

/**
 * Record Redis operation duration.
 */
export function recordRedisOperation(operation: string, durationSeconds: number): void {
  getMetricsCollector().observeHistogram('redis_operation_duration_seconds', durationSeconds, {
    operation,
  });
}
