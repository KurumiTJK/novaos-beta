// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING MODULE — Re-export from Observability
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module re-exports the structured logging from observability.
// For the full API, import directly from './observability/logging/index.js'
//
// ═══════════════════════════════════════════════════════════════════════════════

// Re-export everything from observability logging
export {
  // Main API (backward compatible)
  getLogger,
  logRequest,
  type Logger,
  type LoggerOptions,
  type RequestLogData,
  
  // Configuration
  configureLogger,
  getLoggerConfig,
  type LoggerConfig,
  type LogLevel,
  
  // Context
  getContext,
  getRequestId,
  getCorrelationId,
  runWithContext,
  type RequestContext,
  
  // Middleware
  requestMiddleware,
  requestContextMiddleware,
  requestLoggingMiddleware,
  
  // Specialized loggers
  getSecurityLogger,
  getPerformanceLogger,
  getLLMLogger,
  getDBLogger,
  
  // Utilities
  withTiming,
  redact,
} from '../observability/logging/index.js';
