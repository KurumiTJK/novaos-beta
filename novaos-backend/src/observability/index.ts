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
  type ILogger,
  type LogLevel,
  type LoggerConfig,
  type LoggerOptions,
  type RequestLogData,
  Logger,
  getLogger,
  configureLogger,
  logRequest,
  resetLogger,
  
  // Specialized loggers
  loggers,
  getSecurityLogger,
  getPerformanceLogger,
  getLLMLogger,
  getDBLogger,
  withTiming,
  
  // Middleware
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
  type HealthCheckResponse,
  type ReadinessResponse,
  type LivenessResponse,
  type StatusResponse,
  HEALTH_THRESHOLDS,
  
  // Check helpers
  healthy,
  degraded,
  unhealthy,
  
  // Core checks
  checkMemory,
  checkEventLoop,
  checkSelf,
  
  // Check factories
  createRedisHealthCheck,
  createLLMHealthCheck,
  createExternalAPIHealthCheck,
  
  // Dependencies
  type DependencyHealthConfig,
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
