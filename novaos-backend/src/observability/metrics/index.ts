// ═══════════════════════════════════════════════════════════════════════════════
// METRICS MODULE INDEX — Prometheus Metrics Exports
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type MetricType,
  type MetricDefinition,
  type MetricCategory,
  
  // Bucket constants
  HTTP_DURATION_BUCKETS,
  LLM_DURATION_BUCKETS,
  SIZE_BUCKETS,
  TOKEN_BUCKETS,
  
  // Metric definitions by category
  HTTP_METRICS,
  AUTH_METRICS,
  AUTHZ_METRICS,
  RATE_LIMIT_METRICS,
  LLM_METRICS,
  SWORD_METRICS,
  CACHE_METRICS,
  SECURITY_METRICS,
  SYSTEM_METRICS,
  
  // All metrics
  ALL_METRICS,
  getAllMetricDefinitions,
  getMetricDefinition,
} from './definitions.js';

// ─────────────────────────────────────────────────────────────────────────────────
// COLLECTOR
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type Labels,
  type Counter,
  type Gauge,
  type Histogram,
  type HistogramValue,
  type MetricsCollectorConfig,
  
  // Class
  MetricsCollector,
  
  // Singleton
  getMetricsCollector,
  resetMetricsCollector,
  
  // Convenience functions
  incCounter,
  setGauge,
  observeHistogram,
  timeHistogram,
  startTimer,
} from './collector.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type MetricsMiddlewareOptions,
  type MetricsEndpointOptions,
  
  // Middleware
  metricsMiddleware,
  metricsEndpoint,
  
  // Recording functions
  recordAuthSuccess,
  recordAuthFailure,
  recordRateLimitHit,
  recordLLMRequest,
  recordLLMTokens,
  recordSparkCompletion,
  recordStepGeneration,
  recordReminderSend,
  recordCacheOperation,
  recordSSRFDecision,
  recordSecurityViolation,
  updateRedisStatus,
  recordRedisOperation,
} from './middleware.js';
