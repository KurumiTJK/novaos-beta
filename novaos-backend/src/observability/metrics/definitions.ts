// ═══════════════════════════════════════════════════════════════════════════════
// METRICS DEFINITIONS — Prometheus Metric Types & Definitions
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// Defines all metrics collected by NovaOS:
// - HTTP request metrics
// - Authentication & authorization metrics
// - Rate limiting metrics
// - LLM/AI metrics
// - Sword system metrics (goals, quests, steps, sparks)
// - Cache metrics
// - System metrics
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// METRIC TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Metric type enumeration.
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Base metric definition.
 */
export interface MetricDefinition {
  /** Metric name (Prometheus naming convention: snake_case) */
  readonly name: string;
  
  /** Human-readable description */
  readonly help: string;
  
  /** Metric type */
  readonly type: MetricType;
  
  /** Label names for this metric */
  readonly labelNames?: readonly string[];
  
  /** Histogram buckets (for histogram type) */
  readonly buckets?: readonly number[];
  
  /** Summary percentiles (for summary type) */
  readonly percentiles?: readonly number[];
  
  /** Unit suffix (e.g., '_seconds', '_bytes') */
  readonly unit?: string;
}

/**
 * Metric category for organization.
 */
export type MetricCategory =
  | 'http'
  | 'auth'
  | 'rate_limit'
  | 'llm'
  | 'sword'
  | 'cache'
  | 'system'
  | 'security';

// ─────────────────────────────────────────────────────────────────────────────────
// STANDARD BUCKETS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Standard duration buckets for HTTP requests (in seconds).
 */
export const HTTP_DURATION_BUCKETS = [
  0.005,  // 5ms
  0.01,   // 10ms
  0.025,  // 25ms
  0.05,   // 50ms
  0.1,    // 100ms
  0.25,   // 250ms
  0.5,    // 500ms
  1,      // 1s
  2.5,    // 2.5s
  5,      // 5s
  10,     // 10s
] as const;

/**
 * Duration buckets for LLM requests (typically slower).
 */
export const LLM_DURATION_BUCKETS = [
  0.1,    // 100ms
  0.25,   // 250ms
  0.5,    // 500ms
  1,      // 1s
  2.5,    // 2.5s
  5,      // 5s
  10,     // 10s
  15,     // 15s
  30,     // 30s
  60,     // 60s
] as const;

/**
 * Size buckets for response/payload sizes (in bytes).
 */
export const SIZE_BUCKETS = [
  100,
  1000,      // 1KB
  10000,     // 10KB
  100000,    // 100KB
  1000000,   // 1MB
  10000000,  // 10MB
] as const;

/**
 * Token count buckets for LLM operations.
 */
export const TOKEN_BUCKETS = [
  10,
  50,
  100,
  250,
  500,
  1000,
  2000,
  4000,
  8000,
] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// HTTP METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export const HTTP_METRICS = {
  /**
   * HTTP request duration histogram.
   */
  requestDuration: {
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    type: 'histogram',
    labelNames: ['method', 'path', 'status_code'],
    buckets: HTTP_DURATION_BUCKETS,
    unit: 'seconds',
  },
  
  /**
   * Total HTTP requests counter.
   */
  requestsTotal: {
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    type: 'counter',
    labelNames: ['method', 'path', 'status_code'],
  },
  
  /**
   * Current in-flight requests.
   */
  requestsInFlight: {
    name: 'http_requests_in_flight',
    help: 'Number of HTTP requests currently being processed',
    type: 'gauge',
    labelNames: ['method'],
  },
  
  /**
   * Response size histogram.
   */
  responseSize: {
    name: 'http_response_size_bytes',
    help: 'Size of HTTP responses in bytes',
    type: 'histogram',
    labelNames: ['method', 'path'],
    buckets: SIZE_BUCKETS,
    unit: 'bytes',
  },
  
  /**
   * Request size histogram.
   */
  requestSize: {
    name: 'http_request_size_bytes',
    help: 'Size of HTTP request bodies in bytes',
    type: 'histogram',
    labelNames: ['method', 'path'],
    buckets: SIZE_BUCKETS,
    unit: 'bytes',
  },
} as const satisfies Record<string, MetricDefinition>;

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export const AUTH_METRICS = {
  /**
   * Successful authentication attempts.
   */
  authSuccess: {
    name: 'auth_success_total',
    help: 'Total number of successful authentication attempts',
    type: 'counter',
    labelNames: ['method', 'tier'],
  },
  
  /**
   * Failed authentication attempts.
   */
  authFailure: {
    name: 'auth_failure_total',
    help: 'Total number of failed authentication attempts',
    type: 'counter',
    labelNames: ['method', 'reason'],
  },
  
  /**
   * Token operations.
   */
  tokenOperations: {
    name: 'auth_token_operations_total',
    help: 'Total number of token operations',
    type: 'counter',
    labelNames: ['operation', 'token_type'],
  },
  
  /**
   * Active sessions gauge.
   */
  activeSessions: {
    name: 'auth_active_sessions',
    help: 'Number of active user sessions',
    type: 'gauge',
    labelNames: ['tier'],
  },
  
  /**
   * Token verification duration.
   */
  tokenVerificationDuration: {
    name: 'auth_token_verification_duration_seconds',
    help: 'Duration of token verification in seconds',
    type: 'histogram',
    labelNames: ['result'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
    unit: 'seconds',
  },
} as const satisfies Record<string, MetricDefinition>;

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORIZATION METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export const AUTHZ_METRICS = {
  /**
   * Authorization decisions.
   */
  authzDecisions: {
    name: 'authz_decisions_total',
    help: 'Total number of authorization decisions',
    type: 'counter',
    labelNames: ['decision', 'resource_type', 'action'],
  },
  
  /**
   * Permission checks.
   */
  permissionChecks: {
    name: 'authz_permission_checks_total',
    help: 'Total number of permission checks',
    type: 'counter',
    labelNames: ['permission', 'result'],
  },
  
  /**
   * Ownership checks.
   */
  ownershipChecks: {
    name: 'authz_ownership_checks_total',
    help: 'Total number of ownership checks',
    type: 'counter',
    labelNames: ['resource_type', 'result'],
  },
} as const satisfies Record<string, MetricDefinition>;

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMITING METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export const RATE_LIMIT_METRICS = {
  /**
   * Rate limit hits (requests that were limited).
   */
  rateLimitHits: {
    name: 'rate_limit_hits_total',
    help: 'Total number of requests that hit rate limits',
    type: 'counter',
    labelNames: ['path', 'tier', 'limit_type'],
  },
  
  /**
   * Rate limit checks.
   */
  rateLimitChecks: {
    name: 'rate_limit_checks_total',
    help: 'Total number of rate limit checks',
    type: 'counter',
    labelNames: ['result', 'tier'],
  },
  
  /**
   * Current rate limit bucket usage.
   */
  rateLimitUsage: {
    name: 'rate_limit_bucket_usage',
    help: 'Current usage of rate limit buckets (0-1)',
    type: 'gauge',
    labelNames: ['bucket_key', 'tier'],
  },
} as const satisfies Record<string, MetricDefinition>;

// ─────────────────────────────────────────────────────────────────────────────────
// LLM METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export const LLM_METRICS = {
  /**
   * LLM request duration.
   */
  llmRequestDuration: {
    name: 'llm_request_duration_seconds',
    help: 'Duration of LLM API requests in seconds',
    type: 'histogram',
    labelNames: ['provider', 'model', 'operation'],
    buckets: LLM_DURATION_BUCKETS,
    unit: 'seconds',
  },
  
  /**
   * LLM requests total.
   */
  llmRequestsTotal: {
    name: 'llm_requests_total',
    help: 'Total number of LLM API requests',
    type: 'counter',
    labelNames: ['provider', 'model', 'operation', 'status'],
  },
  
  /**
   * LLM token usage.
   */
  llmTokensUsed: {
    name: 'llm_tokens_used_total',
    help: 'Total number of tokens used in LLM requests',
    type: 'counter',
    labelNames: ['provider', 'model', 'token_type'],
  },
  
  /**
   * LLM token histogram for request sizes.
   */
  llmTokensPerRequest: {
    name: 'llm_tokens_per_request',
    help: 'Distribution of tokens per LLM request',
    type: 'histogram',
    labelNames: ['provider', 'model', 'token_type'],
    buckets: TOKEN_BUCKETS,
  },
  
  /**
   * LLM errors.
   */
  llmErrors: {
    name: 'llm_errors_total',
    help: 'Total number of LLM API errors',
    type: 'counter',
    labelNames: ['provider', 'model', 'error_type'],
  },
  
  /**
   * LLM cost tracking (estimated).
   */
  llmCostEstimate: {
    name: 'llm_cost_estimate_dollars',
    help: 'Estimated cost of LLM usage in dollars',
    type: 'counter',
    labelNames: ['provider', 'model'],
  },
  
  /**
   * LLM streaming chunks.
   */
  llmStreamingChunks: {
    name: 'llm_streaming_chunks_total',
    help: 'Total number of streaming chunks received',
    type: 'counter',
    labelNames: ['provider', 'model'],
  },
} as const satisfies Record<string, MetricDefinition>;

// ─────────────────────────────────────────────────────────────────────────────────
// SWORD SYSTEM METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export const SWORD_METRICS = {
  /**
   * Goal operations.
   */
  goalOperations: {
    name: 'sword_goal_operations_total',
    help: 'Total number of goal operations',
    type: 'counter',
    labelNames: ['operation', 'status'],
  },
  
  /**
   * Active goals gauge.
   */
  activeGoals: {
    name: 'sword_active_goals',
    help: 'Number of active goals',
    type: 'gauge',
    labelNames: ['user_tier'],
  },
  
  /**
   * Quest operations.
   */
  questOperations: {
    name: 'sword_quest_operations_total',
    help: 'Total number of quest operations',
    type: 'counter',
    labelNames: ['operation', 'status'],
  },
  
  /**
   * Step operations.
   */
  stepOperations: {
    name: 'sword_step_operations_total',
    help: 'Total number of step operations',
    type: 'counter',
    labelNames: ['operation', 'status'],
  },
  
  /**
   * Step generations (LLM-generated steps).
   */
  stepGenerations: {
    name: 'sword_step_generations_total',
    help: 'Total number of step generation requests',
    type: 'counter',
    labelNames: ['status', 'quest_type'],
  },
  
  /**
   * Spark operations.
   */
  sparkOperations: {
    name: 'sword_spark_operations_total',
    help: 'Total number of spark operations',
    type: 'counter',
    labelNames: ['operation', 'spark_type'],
  },
  
  /**
   * Spark completions.
   */
  sparkCompletions: {
    name: 'sword_spark_completions_total',
    help: 'Total number of spark completions',
    type: 'counter',
    labelNames: ['completion_type', 'spark_type'],
  },
  
  /**
   * Spark generation duration.
   */
  sparkGenerationDuration: {
    name: 'sword_spark_generation_duration_seconds',
    help: 'Duration of spark generation in seconds',
    type: 'histogram',
    labelNames: ['spark_type'],
    buckets: LLM_DURATION_BUCKETS,
    unit: 'seconds',
  },
  
  /**
   * Reminder operations.
   */
  reminderOperations: {
    name: 'sword_reminder_operations_total',
    help: 'Total number of reminder operations',
    type: 'counter',
    labelNames: ['operation', 'status'],
  },
  
  /**
   * Reminder sends.
   */
  reminderSends: {
    name: 'sword_reminder_sends_total',
    help: 'Total number of reminders sent',
    type: 'counter',
    labelNames: ['channel', 'escalation_level'],
  },
  
  /**
   * Goal completion time (from creation to completion).
   */
  goalCompletionTime: {
    name: 'sword_goal_completion_time_seconds',
    help: 'Time to complete goals in seconds',
    type: 'histogram',
    labelNames: ['goal_type'],
    buckets: [
      3600,       // 1 hour
      86400,      // 1 day
      604800,     // 1 week
      2592000,    // 30 days
      7776000,    // 90 days
      31536000,   // 1 year
    ],
    unit: 'seconds',
  },
} as const satisfies Record<string, MetricDefinition>;

// ─────────────────────────────────────────────────────────────────────────────────
// CACHE METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export const CACHE_METRICS = {
  /**
   * Cache hits.
   */
  cacheHits: {
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    type: 'counter',
    labelNames: ['cache_name', 'operation'],
  },
  
  /**
   * Cache misses.
   */
  cacheMisses: {
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    type: 'counter',
    labelNames: ['cache_name', 'operation'],
  },
  
  /**
   * Cache hit ratio (computed gauge).
   */
  cacheHitRatio: {
    name: 'cache_hit_ratio',
    help: 'Cache hit ratio (hits / total)',
    type: 'gauge',
    labelNames: ['cache_name'],
  },
  
  /**
   * Cache size.
   */
  cacheSize: {
    name: 'cache_size_entries',
    help: 'Number of entries in cache',
    type: 'gauge',
    labelNames: ['cache_name'],
  },
  
  /**
   * Cache memory usage.
   */
  cacheMemory: {
    name: 'cache_memory_bytes',
    help: 'Memory used by cache in bytes',
    type: 'gauge',
    labelNames: ['cache_name'],
    unit: 'bytes',
  },
  
  /**
   * Cache evictions.
   */
  cacheEvictions: {
    name: 'cache_evictions_total',
    help: 'Total number of cache evictions',
    type: 'counter',
    labelNames: ['cache_name', 'reason'],
  },
} as const satisfies Record<string, MetricDefinition>;

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export const SECURITY_METRICS = {
  /**
   * SSRF protection decisions.
   */
  ssrfDecisions: {
    name: 'security_ssrf_decisions_total',
    help: 'Total number of SSRF protection decisions',
    type: 'counter',
    labelNames: ['decision', 'reason'],
  },
  
  /**
   * Security violations detected.
   */
  securityViolations: {
    name: 'security_violations_total',
    help: 'Total number of security violations detected',
    type: 'counter',
    labelNames: ['violation_type', 'severity'],
  },
  
  /**
   * Blocked requests.
   */
  blockedRequests: {
    name: 'security_blocked_requests_total',
    help: 'Total number of blocked requests',
    type: 'counter',
    labelNames: ['reason', 'source'],
  },
  
  /**
   * Encryption operations.
   */
  encryptionOperations: {
    name: 'security_encryption_operations_total',
    help: 'Total number of encryption/decryption operations',
    type: 'counter',
    labelNames: ['operation', 'status'],
  },
  
  /**
   * Input validation failures.
   */
  validationFailures: {
    name: 'security_validation_failures_total',
    help: 'Total number of input validation failures',
    type: 'counter',
    labelNames: ['validation_type', 'field'],
  },
} as const satisfies Record<string, MetricDefinition>;

// ─────────────────────────────────────────────────────────────────────────────────
// SYSTEM METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export const SYSTEM_METRICS = {
  /**
   * Process CPU usage.
   */
  processCpuUsage: {
    name: 'process_cpu_usage_percent',
    help: 'Process CPU usage percentage',
    type: 'gauge',
  },
  
  /**
   * Process memory usage.
   */
  processMemoryUsage: {
    name: 'process_memory_bytes',
    help: 'Process memory usage in bytes',
    type: 'gauge',
    labelNames: ['type'],
    unit: 'bytes',
  },
  
  /**
   * Event loop lag.
   */
  eventLoopLag: {
    name: 'nodejs_eventloop_lag_seconds',
    help: 'Event loop lag in seconds',
    type: 'gauge',
    unit: 'seconds',
  },
  
  /**
   * Active handles.
   */
  activeHandles: {
    name: 'nodejs_active_handles',
    help: 'Number of active handles',
    type: 'gauge',
  },
  
  /**
   * Active requests.
   */
  activeRequests: {
    name: 'nodejs_active_requests',
    help: 'Number of active requests',
    type: 'gauge',
  },
  
  /**
   * Redis connection status.
   */
  redisConnected: {
    name: 'redis_connected',
    help: 'Redis connection status (1 = connected, 0 = disconnected)',
    type: 'gauge',
  },
  
  /**
   * Redis operation duration.
   */
  redisOperationDuration: {
    name: 'redis_operation_duration_seconds',
    help: 'Duration of Redis operations in seconds',
    type: 'histogram',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    unit: 'seconds',
  },
  
  /**
   * Application info (constant labels).
   */
  appInfo: {
    name: 'app_info',
    help: 'Application information',
    type: 'gauge',
    labelNames: ['version', 'environment', 'node_version'],
  },
  
  /**
   * Application uptime.
   */
  appUptime: {
    name: 'app_uptime_seconds',
    help: 'Application uptime in seconds',
    type: 'gauge',
    unit: 'seconds',
  },
} as const satisfies Record<string, MetricDefinition>;

// ─────────────────────────────────────────────────────────────────────────────────
// ALL METRICS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * All metric definitions grouped by category.
 */
export const ALL_METRICS = {
  http: HTTP_METRICS,
  auth: AUTH_METRICS,
  authz: AUTHZ_METRICS,
  rateLimit: RATE_LIMIT_METRICS,
  llm: LLM_METRICS,
  sword: SWORD_METRICS,
  cache: CACHE_METRICS,
  security: SECURITY_METRICS,
  system: SYSTEM_METRICS,
} as const;

/**
 * Get all metric definitions as a flat array.
 */
export function getAllMetricDefinitions(): MetricDefinition[] {
  const definitions: MetricDefinition[] = [];
  
  for (const category of Object.values(ALL_METRICS)) {
    for (const metric of Object.values(category)) {
      definitions.push(metric as MetricDefinition);
    }
  }
  
  return definitions;
}

/**
 * Get metric definition by name.
 */
export function getMetricDefinition(name: string): MetricDefinition | undefined {
  for (const category of Object.values(ALL_METRICS)) {
    for (const metric of Object.values(category)) {
      if ((metric as MetricDefinition).name === name) {
        return metric as MetricDefinition;
      }
    }
  }
  return undefined;
}
