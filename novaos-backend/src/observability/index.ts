// ═══════════════════════════════════════════════════════════════════════════════
// OBSERVABILITY MODULE — Unified Observability Exports
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides comprehensive observability for NovaOS:
// - Structured logging with correlation IDs
// - Prometheus-compatible metrics
// - Distributed tracing (OpenTelemetry-compatible)
// - Health checks (Kubernetes-compatible)
// - Alerting with Slack/PagerDuty integration
//
// Quick Start:
//   import { 
//     requestMiddleware, 
//     metricsMiddleware, 
//     createHealthRouter,
//     getLogger 
//   } from './observability/index.js';
//
//   app.use(requestMiddleware());
//   app.use(metricsMiddleware());
//   app.use(createHealthRouter());
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Context
  type RequestContext,
  createContext,
  runWithContext,
  getContext,
  getRequestId,
  getCorrelationId,
  CONTEXT_HEADERS,
  
  // Redaction
  redact,
  redactEmail,
  redactPhone,
  REDACTED,
  
  // Logger
  type Logger,
  type LogLevel,
  type LoggerConfig,
  getLogger,
  configureLogger,
  logRequest,
  getSecurityLogger,
  getLLMLogger,
  withTiming,
  
  // Middleware
  requestMiddleware,
  requestContextMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  slowRequestMiddleware,
} from './logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// METRICS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Definitions
  type MetricDefinition,
  HTTP_METRICS,
  AUTH_METRICS,
  LLM_METRICS,
  SWORD_METRICS,
  CACHE_METRICS,
  SECURITY_METRICS,
  SYSTEM_METRICS,
  
  // Collector
  type Labels,
  MetricsCollector,
  getMetricsCollector,
  incCounter,
  setGauge,
  observeHistogram,
  startTimer,
  
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
} from './metrics/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type ComponentHealth,
  type HealthCheckResponse,
  type ReadinessResponse,
  type LivenessResponse,
  type StatusResponse,
  HEALTH_THRESHOLDS,
  
  // Checks
  healthy,
  degraded,
  unhealthy,
  checkMemory,
  checkEventLoop,
  createRedisHealthCheck,
  createLLMHealthCheck,
  
  // Dependencies
  configureRedisHealth,
  configureOpenAIHealth,
  configureGeminiHealth,
  initializeDependencyHealth,
  checkAllDependencies,
  
  // Endpoints
  type HealthEndpointConfig,
  createHealthRouter,
  healthHandlers,
  checkHealth,
  isReady,
  isHealthy,
} from './health/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TRACING
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type Span,
  type SpanAttributes,
  type TracerConfig,
  
  // Tracer
  configureTracer,
  isTracingEnabled,
  startSpan,
  withSpan,
  withSpanSync,
  
  // Middleware
  tracingMiddleware,
  createChildSpan,
} from './tracing/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ALERTING
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type Alert,
  type AlertSeverity,
  type AlertInput,
  type AlertRule,
  type NotificationResult,
  
  // Channels
  type NotificationChannel,
  SlackChannel,
  PagerDutyChannel,
  ConsoleChannel,
  registerChannel,
  registerChannelConfig,
  
  // Rules
  ALL_ALERT_RULES,
  HEALTH_RULES,
  SECURITY_RULES,
  
  // Service
  configureAlertService,
  fireAlert,
  resolveAlert,
  fireCritical,
  fireWarning,
  fireInfo,
  getActiveAlerts,
  getAlertHistory,
  getAlertCounts,
} from './alerting/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION HELPER
// ─────────────────────────────────────────────────────────────────────────────────

import { configureLogger, type LoggerConfig } from './logging/index.js';
import { getMetricsCollector, type MetricsCollectorConfig } from './metrics/index.js';
import { configureTracer, type TracerConfig } from './tracing/index.js';
import { initializeDependencyHealth, type DependencyHealthConfig } from './health/index.js';
import { configureAlertService, registerChannelConfig, type AlertServiceConfig, type ConsoleChannelConfig } from './alerting/index.js';

/**
 * Observability configuration.
 */
export interface ObservabilityConfig {
  /** Logging configuration */
  logging?: Partial<LoggerConfig>;
  
  /** Metrics configuration */
  metrics?: MetricsCollectorConfig;
  
  /** Tracing configuration */
  tracing?: TracerConfig;
  
  /** Health check dependencies */
  health?: DependencyHealthConfig;
  
  /** Alert service configuration */
  alerting?: Partial<AlertServiceConfig>;
  
  /** Enable console alerts in development */
  enableConsoleAlerts?: boolean;
}

/**
 * Initialize all observability components.
 */
export function initializeObservability(config: ObservabilityConfig = {}): void {
  // Configure logging
  if (config.logging) {
    configureLogger(config.logging);
  }
  
  // Initialize metrics
  if (config.metrics) {
    getMetricsCollector(config.metrics);
  }
  
  // Configure tracing
  if (config.tracing) {
    configureTracer(config.tracing);
  }
  
  // Initialize health dependencies
  if (config.health) {
    initializeDependencyHealth(config.health);
  }
  
  // Configure alerting
  if (config.alerting) {
    configureAlertService(config.alerting);
  }
  
  // Add console alert channel in development
  if (config.enableConsoleAlerts ?? process.env.NODE_ENV !== 'production') {
    registerChannelConfig({
      id: 'console',
      type: 'console',
      name: 'Console Alerts',
      enabled: true,
    } as ConsoleChannelConfig);
  }
}
