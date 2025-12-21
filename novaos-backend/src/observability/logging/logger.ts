// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURED LOGGER — Pino-Based Logging with Context & Redaction
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// Production-grade structured logging with:
// - JSON output for production, pretty-print for development
// - Automatic correlation ID injection from AsyncLocalStorage
// - PII redaction
// - Component-based child loggers
// - Request logging helpers
//
// Usage:
//   import { getLogger, logRequest } from './logging/index.js';
//
//   const logger = getLogger({ component: 'auth' });
//   logger.info('User logged in', { userId: '123' });
//
// ═══════════════════════════════════════════════════════════════════════════════

import { getLoggingContext, getRequestId, getCorrelationId } from './context.js';
import { redact, getPinoRedactConfig, type RedactionOptions } from './redaction.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Log levels in order of severity.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Numeric log level values (Pino-compatible).
 */
export const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * Logger configuration options.
 */
export interface LoggerConfig {
  /** Minimum log level */
  level?: LogLevel;
  
  /** Enable pretty printing (development) */
  pretty?: boolean;
  
  /** Enable PII redaction */
  redactPII?: boolean;
  
  /** Additional redaction options */
  redactionOptions?: RedactionOptions;
  
  /** Service name for logs */
  serviceName?: string;
  
  /** Environment name */
  environment?: string;
  
  /** Enable timestamp */
  timestamp?: boolean;
  
  /** Custom base context added to all logs */
  base?: Record<string, unknown>;
}

/**
 * Options for creating a child logger.
 */
export interface LoggerOptions {
  /** Component name */
  component?: string;
  
  /** Request ID (auto-injected from context if not provided) */
  requestId?: string;
  
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Logger interface matching existing usage patterns.
 */
export interface Logger {
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void;
  fatal(message: string, error?: Error | unknown, context?: Record<string, unknown>): void;
  
  /** Create a child logger with additional context */
  child(options: LoggerOptions): Logger;
  
  /** Check if a level is enabled */
  isLevelEnabled(level: LogLevel): boolean;
}

/**
 * Request log data.
 */
export interface RequestLogData {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  contentLength?: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

let globalConfig: LoggerConfig = {
  level: 'info',
  pretty: process.env.NODE_ENV !== 'production',
  redactPII: true,
  serviceName: 'novaos',
  environment: process.env.NODE_ENV ?? 'development',
  timestamp: true,
};

/**
 * Configure the global logger settings.
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get the current logger configuration.
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...globalConfig };
}

/**
 * Get log level from environment or config.
 */
function getEffectiveLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel;
  }
  return globalConfig.level ?? 'info';
}

// ─────────────────────────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format timestamp for logs.
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format error for logging.
 */
function formatError(error: Error | unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.split('\n').slice(0, 10).join('\n'),
      ...(error.cause ? { errorCause: String(error.cause) } : {}),
    };
  }
  
  if (typeof error === 'string') {
    return { errorMessage: error };
  }
  
  return { errorMessage: String(error) };
}

/**
 * Format log entry for output.
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context: Record<string, unknown>,
  component?: string
): Record<string, unknown> {
  const requestContext = getLoggingContext();
  
  const entry: Record<string, unknown> = {
    level,
    levelNum: LOG_LEVELS[level],
    time: globalConfig.timestamp ? formatTimestamp() : undefined,
    msg: message,
    ...globalConfig.base,
    service: globalConfig.serviceName,
    env: globalConfig.environment,
    ...(component && { component }),
    ...requestContext,
    ...context,
  };
  
  // Apply redaction if enabled
  if (globalConfig.redactPII) {
    return redact(entry, globalConfig.redactionOptions);
  }
  
  return entry;
}

/**
 * Pretty print a log entry (for development).
 */
function prettyPrint(entry: Record<string, unknown>): string {
  const level = entry.level as LogLevel;
  const time = entry.time as string | undefined;
  const msg = entry.msg as string;
  const component = entry.component as string | undefined;
  
  // Color codes
  const colors: Record<LogLevel, string> = {
    trace: '\x1b[90m',  // Gray
    debug: '\x1b[36m',  // Cyan
    info: '\x1b[32m',   // Green
    warn: '\x1b[33m',   // Yellow
    error: '\x1b[31m',  // Red
    fatal: '\x1b[35m',  // Magenta
  };
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  
  const color = colors[level] ?? '';
  const levelStr = level.toUpperCase().padEnd(5);
  const timeStr = time ? time.split('T')[1]?.replace('Z', '') ?? '' : '';
  const componentStr = component ? `[${component}]` : '';
  
  // Build context string (excluding standard fields)
  const contextFields = { ...entry };
  delete contextFields.level;
  delete contextFields.levelNum;
  delete contextFields.time;
  delete contextFields.msg;
  delete contextFields.service;
  delete contextFields.env;
  delete contextFields.component;
  
  let contextStr = '';
  if (Object.keys(contextFields).length > 0) {
    contextStr = ` ${dim}${JSON.stringify(contextFields)}${reset}`;
  }
  
  return `${dim}${timeStr}${reset} ${color}${levelStr}${reset} ${componentStr} ${msg}${contextStr}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Write a log entry to output.
 */
function writeLog(entry: Record<string, unknown>): void {
  const level = entry.level as LogLevel;
  
  if (globalConfig.pretty) {
    const output = prettyPrint(entry);
    
    if (level === 'error' || level === 'fatal') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  } else {
    // JSON output for production
    const json = JSON.stringify(entry);
    
    if (level === 'error' || level === 'fatal') {
      console.error(json);
    } else if (level === 'warn') {
      console.warn(json);
    } else {
      console.log(json);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a logger instance.
 */
function createLogger(options: LoggerOptions = {}): Logger {
  const { component, context: baseContext = {} } = options;
  
  const effectiveLevel = getEffectiveLevel();
  const levelNum = LOG_LEVELS[effectiveLevel];
  
  const log = (level: LogLevel, message: string, context: Record<string, unknown> = {}): void => {
    if (LOG_LEVELS[level] < levelNum) {
      return;
    }
    
    const entry = formatLogEntry(level, message, { ...baseContext, ...context }, component);
    writeLog(entry);
  };
  
  const logWithError = (
    level: LogLevel,
    message: string,
    error?: Error | unknown,
    context: Record<string, unknown> = {}
  ): void => {
    if (LOG_LEVELS[level] < levelNum) {
      return;
    }
    
    const errorContext = error ? formatError(error) : {};
    const entry = formatLogEntry(level, message, { ...baseContext, ...context, ...errorContext }, component);
    writeLog(entry);
  };
  
  return {
    trace: (message, context) => log('trace', message, context),
    debug: (message, context) => log('debug', message, context),
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, error, context) => logWithError('error', message, error, context),
    fatal: (message, error, context) => logWithError('fatal', message, error, context),
    
    child: (childOptions: LoggerOptions): Logger => {
      return createLogger({
        component: childOptions.component ?? component,
        context: { ...baseContext, ...childOptions.context },
      });
    },
    
    isLevelEnabled: (level: LogLevel): boolean => {
      return LOG_LEVELS[level] >= levelNum;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Root logger instance.
 */
let rootLogger: Logger | null = null;

/**
 * Get the root logger or create a child logger.
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (!rootLogger) {
    rootLogger = createLogger();
  }
  
  if (options) {
    return rootLogger.child(options);
  }
  
  return rootLogger;
}

/**
 * Reset the root logger (for testing).
 */
export function resetLogger(): void {
  rootLogger = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST LOGGING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Log an HTTP request.
 */
export function logRequest(data: RequestLogData): void {
  const logger = getLogger({ component: 'http' });
  
  const context: Record<string, unknown> = {
    method: data.method,
    path: data.path,
    statusCode: data.statusCode,
    duration: data.duration,
    durationMs: `${data.duration}ms`,
  };
  
  if (data.requestId) context.requestId = data.requestId;
  if (data.correlationId) context.correlationId = data.correlationId;
  if (data.userId) context.userId = data.userId;
  if (data.userAgent) context.userAgent = data.userAgent;
  if (data.ip) context.ip = data.ip;
  if (data.contentLength) context.contentLength = data.contentLength;
  if (data.error) context.error = data.error;
  
  // Determine log level based on status code
  if (data.statusCode >= 500) {
    logger.error(`${data.method} ${data.path} ${data.statusCode}`, undefined, context);
  } else if (data.statusCode >= 400) {
    logger.warn(`${data.method} ${data.path} ${data.statusCode}`, context);
  } else {
    logger.info(`${data.method} ${data.path} ${data.statusCode}`, context);
  }
}

/**
 * Log request start (for debugging).
 */
export function logRequestStart(method: string, path: string): void {
  const logger = getLogger({ component: 'http' });
  
  if (!logger.isLevelEnabled('debug')) {
    return;
  }
  
  logger.debug(`→ ${method} ${path}`, {
    requestId: getRequestId(),
    correlationId: getCorrelationId(),
  });
}

/**
 * Log request end (for debugging).
 */
export function logRequestEnd(method: string, path: string, statusCode: number, durationMs: number): void {
  const logger = getLogger({ component: 'http' });
  
  if (!logger.isLevelEnabled('debug')) {
    return;
  }
  
  logger.debug(`← ${method} ${path} ${statusCode} (${durationMs}ms)`, {
    requestId: getRequestId(),
    statusCode,
    durationMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIALIZED LOGGERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a security audit logger.
 */
export function getSecurityLogger(): Logger {
  return getLogger({ component: 'security' });
}

/**
 * Create a performance logger.
 */
export function getPerformanceLogger(): Logger {
  return getLogger({ component: 'perf' });
}

/**
 * Create an LLM logger.
 */
export function getLLMLogger(): Logger {
  return getLogger({ component: 'llm' });
}

/**
 * Create a database logger.
 */
export function getDBLogger(): Logger {
  return getLogger({ component: 'db' });
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Measure and log execution time.
 */
export async function withTiming<T>(
  name: string,
  fn: () => Promise<T>,
  logger?: Logger
): Promise<T> {
  const log = logger ?? getLogger({ component: 'perf' });
  const start = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    log.debug(`${name} completed`, { durationMs: duration.toFixed(2) });
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    
    log.error(`${name} failed`, error, { durationMs: duration.toFixed(2) });
    
    throw error;
  }
}

/**
 * Log and rethrow an error.
 */
export function logAndThrow(message: string, error: Error, context?: Record<string, unknown>): never {
  const logger = getLogger();
  logger.error(message, error, context);
  throw error;
}

/**
 * Create a scoped logger that includes timing.
 */
export function createScopedLogger(scope: string): Logger & { elapsed: () => number } {
  const start = performance.now();
  const logger = getLogger({ component: scope });
  
  return {
    ...logger,
    elapsed: () => performance.now() - start,
  };
}
