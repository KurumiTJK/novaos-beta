// ═══════════════════════════════════════════════════════════════════════════════
// OBSERVABILITY MODULE — Unified Observability Exports
// NovaOS Observability
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides core observability for NovaOS:
// - Structured logging with correlation IDs
// - Health checks (Kubernetes-compatible)
//
// Quick Start:
//   import { 
//     getLogger,
//     createHealthRouter,
//   } from './observability/index.js';
//
//   app.use(createHealthRouter());
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Context
  type RequestContext,
  type PartialContext,
  generateRequestId,
  generateCorrelationId,
  createContext,
  runWithContext,
  runWithNewContext,
  getContext,
  requireContext,
  getContextValue,
  getRequestId,
  getCorrelationId,
  getUserId,
  extendContext,
  runWithChildContext,
  CONTEXT_HEADERS,
  extractContextFromHeaders,
  createContextHeaders,
  getLoggingContext,
  getMinimalLoggingContext,
  
  // Redaction
  redact,
  redactEmail,
  redactPhone,
  redactCreditCard,
  redactSSN,
  REDACTED,
  FULL_REDACT_FIELDS,
  PARTIAL_REDACT_FIELDS,
  type RedactionOptions,
  getPinoRedactPaths,
  getPinoRedactConfig,
  shouldRedact,
  createRedactor,
  
  // Logger
  type ILogger,
  type LogLevel,
  type LoggerConfig,
  type LoggerOptions,
  type RequestLogData,
  Logger,
  LOG_LEVELS,
  getLogger,
  configureLogger,
  getLoggerConfig,
  resetLogger,
  logRequest,
  logRequestStart,
  logRequestEnd,
  
  // Specialized loggers
  loggers,
  getSecurityLogger,
  getPerformanceLogger,
  getLLMLogger,
  getDBLogger,
  withTiming,
  logAndThrow,
  createScopedLogger,
  
  // Middleware
  type RequestContextMiddlewareOptions,
  type RequestLoggingMiddlewareOptions,
  requestMiddleware,
  requestContextMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  slowRequestMiddleware,
} from './logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type ComponentHealth,
  type ComponentStatus,
  type SystemStatus,
  type HealthCheckResponse,
  type ReadinessResponse,
  type LivenessResponse,
  type StatusResponse,
  type HealthCheckFn,
  type HealthCheckRegistration,
  type HealthCheckOptions,
  type DependencyType,
  type DependencyConfig,
  HEALTH_THRESHOLDS,
  
  // Check helpers
  healthy,
  degraded,
  unhealthy,
  withTimeout,
  
  // Core checks
  checkMemory,
  checkEventLoop,
  checkDiskSpace,
  checkSelf,
  
  // Check factories
  createRedisHealthCheck,
  createLLMHealthCheck,
  createExternalAPIHealthCheck,
  type RedisHealthCheckOptions,
  type LLMHealthCheckOptions,
  type ExternalAPIHealthCheckOptions,
  
  // Utilities
  runChecks,
  determineOverallStatus,
  
  // Dependencies
  type RedisStoreInterface,
  type LLMProviderConfig,
  type ExternalAPIConfig,
  type DependencyHealthConfig,
  registerDependency,
  unregisterDependency,
  getDependencyChecks,
  clearDependencyChecks,
  configureRedisHealth,
  getRedisHealthCheck,
  registerLLMProvider,
  configureOpenAIHealth,
  configureGeminiHealth,
  checkLLMProviders,
  registerExternalAPI,
  configureFinnhubHealth,
  configureWeatherHealth,
  configureCoinGeckoHealth,
  checkExternalAPIs,
  initializeDependencyHealth,
  checkAllDependencies,
  
  // Endpoints
  type HealthEndpointConfig,
  configureHealthEndpoints,
  createHealthRouter,
  healthHandlers,
  checkHealth,
  isReady,
  isHealthy,
} from './health/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION HELPER
// ─────────────────────────────────────────────────────────────────────────────────

import { configureLogger, type LoggerConfig } from './logging/index.js';
import { initializeDependencyHealth, type DependencyHealthConfig } from './health/index.js';

/**
 * Observability configuration.
 */
export interface ObservabilityConfig {
  /** Logging configuration */
  logging?: Partial<LoggerConfig>;
  
  /** Health check dependencies */
  health?: DependencyHealthConfig;
}

/**
 * Initialize observability components.
 */
export function initializeObservability(config: ObservabilityConfig = {}): void {
  // Configure logging
  if (config.logging) {
    configureLogger(config.logging);
  }
  
  // Initialize health dependencies
  if (config.health) {
    initializeDependencyHealth(config.health);
  }
}
