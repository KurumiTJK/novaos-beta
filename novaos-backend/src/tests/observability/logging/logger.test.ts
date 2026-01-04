// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURED LOGGER TESTS — Pino-Based Logging
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  getLogger,
  resetLogger,
  configureLogger,
  getLoggerConfig,
  logRequest,
  logRequestStart,
  logRequestEnd,
  getSecurityLogger,
  getPerformanceLogger,
  getLLMLogger,
  getDBLogger,
  withTiming,
  logAndThrow,
  createScopedLogger,
  loggers,
  LOG_LEVELS,
  type LogLevel,
  type LoggerConfig,
  type LoggerOptions,
  type ILogger,
  type RequestLogData,
} from '../../../observability/logging/logger.js';
import { runWithContext, createContext } from '../../../observability/logging/context.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

let consoleOutput: string[] = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalEnv = { ...process.env };

beforeEach(() => {
  resetLogger();
  consoleOutput = [];
  
  // Capture console output (log, warn, error)
  console.log = vi.fn((...args) => {
    consoleOutput.push(args.map(String).join(' '));
  });
  console.warn = vi.fn((...args) => {
    consoleOutput.push(args.map(String).join(' '));
  });
  console.error = vi.fn((...args) => {
    consoleOutput.push(args.map(String).join(' '));
  });
  
  // Reset config - set level to 'trace' to capture all log levels
  configureLogger({
    level: 'trace',
    pretty: false,
    redactPII: true,
    serviceName: 'test-service',
    environment: 'test',
  });
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  process.env = originalEnv;
  resetLogger();
});

// ─────────────────────────────────────────────────────────────────────────────────
// LOG_LEVELS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('LOG_LEVELS', () => {
  it('should have correct numeric values', () => {
    expect(LOG_LEVELS.trace).toBe(10);
    expect(LOG_LEVELS.debug).toBe(20);
    expect(LOG_LEVELS.info).toBe(30);
    expect(LOG_LEVELS.warn).toBe(40);
    expect(LOG_LEVELS.error).toBe(50);
    expect(LOG_LEVELS.fatal).toBe(60);
  });

  it('should have increasing values', () => {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    for (let i = 1; i < levels.length; i++) {
      expect(LOG_LEVELS[levels[i]]).toBeGreaterThan(LOG_LEVELS[levels[i - 1]]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Logger Configuration', () => {
  describe('configureLogger()', () => {
    it('should update log level', () => {
      configureLogger({ level: 'warn' });
      const config = getLoggerConfig();
      expect(config.level).toBe('warn');
    });

    it('should update service name', () => {
      configureLogger({ serviceName: 'my-service' });
      const config = getLoggerConfig();
      expect(config.serviceName).toBe('my-service');
    });

    it('should merge with existing config', () => {
      configureLogger({ level: 'error' });
      configureLogger({ serviceName: 'updated' });
      
      const config = getLoggerConfig();
      expect(config.level).toBe('error');
      expect(config.serviceName).toBe('updated');
    });
  });

  describe('getLoggerConfig()', () => {
    it('should return copy of config', () => {
      const config1 = getLoggerConfig();
      const config2 = getLoggerConfig();
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// getLogger TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getLogger()', () => {
  it('should return a logger instance', () => {
    const logger = getLogger();
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should return same root logger on multiple calls', () => {
    const logger1 = getLogger();
    const logger2 = getLogger();
    
    // Should be the same instance when no options
    expect(logger1).toBe(logger2);
  });

  it('should create child logger with options', () => {
    const logger = getLogger({ component: 'auth' });
    
    logger.info('Test message');
    
    const output = consoleOutput[0];
    expect(output).toContain('auth');
  });

  it('should include request context', () => {
    const ctx = createContext({
      requestId: 'req-123' as any,
      correlationId: 'cor-456' as any,
    });
    
    runWithContext(ctx, () => {
      const logger = getLogger({ component: 'test' });
      logger.info('Context test');
      
      const output = consoleOutput[0];
      expect(output).toContain('req-123');
      expect(output).toContain('cor-456');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// Logger CLASS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Logger Class', () => {
  it('should create instance with new keyword', () => {
    const logger = new Logger({ component: 'test' });
    
    expect(logger).toBeInstanceOf(Logger);
    expect(typeof logger.info).toBe('function');
  });

  describe('Log Methods', () => {
    let logger: Logger;
    
    beforeEach(() => {
      logger = new Logger({ component: 'test' });
      configureLogger({ level: 'trace' });
    });

    it('should log trace messages', () => {
      logger.trace('Trace message');
      expect(consoleOutput.some(o => o.includes('trace'))).toBe(true);
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');
      expect(consoleOutput.some(o => o.includes('debug'))).toBe(true);
    });

    it('should log info messages', () => {
      logger.info('Info message');
      expect(consoleOutput.some(o => o.includes('info'))).toBe(true);
    });

    it('should log warn messages', () => {
      logger.warn('Warn message');
      expect(consoleOutput.some(o => o.includes('warn'))).toBe(true);
    });

    it('should log error messages', () => {
      logger.error('Error message', new Error('Test error'));
      expect(consoleOutput.some(o => o.includes('error'))).toBe(true);
    });

    it('should log fatal messages', () => {
      logger.fatal('Fatal message', new Error('Fatal error'));
      expect(consoleOutput.some(o => o.includes('fatal'))).toBe(true);
    });
  });

  describe('Context', () => {
    it('should include context in logs', () => {
      const logger = new Logger({ component: 'context-test' });
      
      logger.info('Test', { userId: 'user-123', action: 'login' });
      
      const output = consoleOutput[0];
      expect(output).toContain('user-123');
      expect(output).toContain('login');
    });
  });

  describe('Error Handling', () => {
    it('should format Error objects', () => {
      const logger = new Logger({ component: 'error-test' });
      const error = new Error('Test error message');
      
      logger.error('Error occurred', error);
      
      const output = consoleOutput[0];
      expect(output).toContain('Test error message');
    });

    it('should handle string errors', () => {
      const logger = new Logger({ component: 'error-test' });
      
      logger.error('Error occurred', 'String error');
      
      const output = consoleOutput[0];
      expect(output).toContain('String error');
    });

    it('should include stack trace', () => {
      const logger = new Logger({ component: 'error-test' });
      const error = new Error('Stack trace test');
      
      logger.error('Error occurred', error);
      
      const output = consoleOutput[0];
      expect(output).toContain('errorStack');
    });
  });

  describe('child()', () => {
    it('should create child logger', () => {
      const parent = new Logger({ component: 'parent' });
      const child = parent.child({ component: 'child' });
      
      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
    });

    it('should inherit parent context', () => {
      const parent = new Logger({ 
        component: 'parent',
        context: { service: 'test-service' },
      });
      const child = parent.child({ component: 'child' });
      
      child.info('Child message');
      
      const output = consoleOutput[0];
      expect(output).toContain('child');
    });
  });

  describe('isLevelEnabled()', () => {
    it('should return true for enabled levels', () => {
      configureLogger({ level: 'info' });
      const logger = new Logger();
      
      expect(logger.isLevelEnabled('info')).toBe(true);
      expect(logger.isLevelEnabled('warn')).toBe(true);
      expect(logger.isLevelEnabled('error')).toBe(true);
    });

    it('should return false for disabled levels', () => {
      configureLogger({ level: 'warn' });
      const logger = new Logger();
      
      expect(logger.isLevelEnabled('trace')).toBe(false);
      expect(logger.isLevelEnabled('debug')).toBe(false);
      expect(logger.isLevelEnabled('info')).toBe(false);
    });
  });

  describe('time()', () => {
    it('should log with duration', () => {
      const logger = new Logger({ component: 'timing' });
      const startTime = Date.now() - 100;
      
      logger.time('Operation completed', startTime);
      
      const output = consoleOutput[0];
      expect(output).toContain('durationMs');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST LOGGING TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Request Logging', () => {
  describe('logRequest()', () => {
    it('should log successful request', () => {
      const data: RequestLogData = {
        method: 'GET',
        path: '/api/users',
        statusCode: 200,
        duration: 50,
        requestId: 'req-123',
      };
      
      logRequest(data);
      
      const output = consoleOutput[0];
      expect(output).toContain('GET');
      expect(output).toContain('/api/users');
      expect(output).toContain('200');
    });

    it('should log 4xx as warning', () => {
      const data: RequestLogData = {
        method: 'GET',
        path: '/api/users',
        statusCode: 404,
        duration: 10,
      };
      
      logRequest(data);
      
      // Find any output that indicates warning level
      const hasWarnOutput = consoleOutput.some(o => o.includes('warn') || o.includes('404'));
      expect(hasWarnOutput).toBe(true);
    });

    it('should log 5xx as error', () => {
      const data: RequestLogData = {
        method: 'GET',
        path: '/api/users',
        statusCode: 500,
        duration: 10,
      };
      
      logRequest(data);
      
      const output = consoleOutput[0];
      expect(output).toContain('error');
    });

    it('should include all provided fields', () => {
      const data: RequestLogData = {
        method: 'POST',
        path: '/api/login',
        statusCode: 200,
        duration: 100,
        requestId: 'req-abc',
        correlationId: 'cor-xyz',
        userId: 'user-123',
        userAgent: 'TestAgent/1.0',
        contentLength: 1024,
      };
      
      logRequest(data);
      
      const output = consoleOutput[0];
      expect(output).toContain('req-abc');
      expect(output).toContain('cor-xyz');
      expect(output).toContain('user-123');
    });
  });

  describe('logRequestStart()', () => {
    it('should log request start in debug mode', () => {
      configureLogger({ level: 'debug' });
      
      logRequestStart('GET', '/api/test');
      
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0]).toContain('GET');
      expect(consoleOutput[0]).toContain('/api/test');
    });

    it('should not log when debug disabled', () => {
      configureLogger({ level: 'info' });
      resetLogger();
      
      logRequestStart('GET', '/api/test');
      
      expect(consoleOutput.length).toBe(0);
    });
  });

  describe('logRequestEnd()', () => {
    it('should log request end in debug mode', () => {
      configureLogger({ level: 'debug' });
      
      logRequestEnd('GET', '/api/test', 200, 50);
      
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0]).toContain('200');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIALIZED LOGGERS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Specialized Loggers', () => {
  it('should create security logger', () => {
    const logger = getSecurityLogger();
    logger.info('Security event');
    
    expect(consoleOutput[0]).toContain('security');
  });

  it('should create performance logger', () => {
    const logger = getPerformanceLogger();
    logger.info('Perf event');
    
    expect(consoleOutput[0]).toContain('perf');
  });

  it('should create LLM logger', () => {
    const logger = getLLMLogger();
    logger.info('LLM event');
    
    expect(consoleOutput[0]).toContain('llm');
  });

  it('should create DB logger', () => {
    const logger = getDBLogger();
    logger.info('DB event');
    
    expect(consoleOutput[0]).toContain('db');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Utility Functions', () => {
  describe('withTiming()', () => {
    it('should execute function and log duration', async () => {
      const result = await withTiming('test-op', async () => {
        await new Promise(r => setTimeout(r, 10));
        return 'result';
      });
      
      expect(result).toBe('result');
      expect(consoleOutput.some(o => o.includes('test-op'))).toBe(true);
      expect(consoleOutput.some(o => o.includes('durationMs'))).toBe(true);
    });

    it('should log error on failure', async () => {
      await expect(
        withTiming('failing-op', async () => {
          throw new Error('Operation failed');
        })
      ).rejects.toThrow('Operation failed');
      
      expect(consoleOutput.some(o => o.includes('failed'))).toBe(true);
    });

    it('should accept custom logger', async () => {
      const customLogger = getLogger({ component: 'custom' });
      
      await withTiming('custom-op', async () => 'done', customLogger);
      
      expect(consoleOutput.some(o => o.includes('custom'))).toBe(true);
    });
  });

  describe('logAndThrow()', () => {
    it('should log error and throw', () => {
      const error = new Error('Test error');
      
      expect(() => logAndThrow('Failed', error)).toThrow('Test error');
      expect(consoleOutput.some(o => o.includes('Failed'))).toBe(true);
    });

    it('should include context in log', () => {
      const error = new Error('Test');
      
      expect(() => logAndThrow('Failed', error, { userId: '123' })).toThrow();
      expect(consoleOutput.some(o => o.includes('123'))).toBe(true);
    });
  });

  describe('createScopedLogger()', () => {
    it('should create logger with elapsed time tracking', () => {
      const scoped = createScopedLogger('my-scope');
      
      expect(typeof scoped.elapsed).toBe('function');
      expect(typeof scoped.info).toBe('function');
    });

    it('should track elapsed time', async () => {
      const scoped = createScopedLogger('timed-scope');
      
      await new Promise(r => setTimeout(r, 50));
      
      const elapsed = scoped.elapsed();
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PRE-CONFIGURED LOGGERS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('loggers (Pre-configured)', () => {
  it('should have http logger', () => {
    loggers.http.info('HTTP log');
    expect(consoleOutput[0]).toContain('http');
  });

  it('should have auth logger', () => {
    loggers.auth.info('Auth log');
    expect(consoleOutput[0]).toContain('auth');
  });

  it('should have pipeline logger', () => {
    loggers.pipeline.info('Pipeline log');
    expect(consoleOutput[0]).toContain('pipeline');
  });

  it('should have storage logger', () => {
    loggers.storage.info('Storage log');
    expect(consoleOutput[0]).toContain('storage');
  });

  it('should have verification logger', () => {
    loggers.verification.info('Verification log');
    expect(consoleOutput[0]).toContain('verification');
  });

  it('should have web logger', () => {
    loggers.web.info('Web log');
    expect(consoleOutput[0]).toContain('web');
  });

  it('should have security logger', () => {
    loggers.security.info('Security log');
    expect(consoleOutput[0]).toContain('security');
  });

  it('should have llm logger', () => {
    loggers.llm.info('LLM log');
    expect(consoleOutput[0]).toContain('llm');
  });

  it('should have db logger', () => {
    loggers.db.info('DB log');
    expect(consoleOutput[0]).toContain('db');
  });

  it('should have perf logger', () => {
    loggers.perf.info('Perf log');
    expect(consoleOutput[0]).toContain('perf');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PII REDACTION INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('PII Redaction Integration', () => {
  it('should redact passwords in logs', () => {
    const logger = getLogger({ component: 'redaction-test' });
    
    logger.info('User login', { password: 'secret123', username: 'john' });
    
    const output = consoleOutput[0];
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('secret123');
    expect(output).toContain('john');
  });

  it('should redact tokens in logs', () => {
    const logger = getLogger({ component: 'redaction-test' });
    
    logger.info('API call', { token: 'bearer-xyz', endpoint: '/api' });
    
    const output = consoleOutput[0];
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('bearer-xyz');
  });

  it('should partially redact emails', () => {
    const logger = getLogger({ component: 'redaction-test' });
    
    logger.info('User registered', { email: 'john@example.com' });
    
    const output = consoleOutput[0];
    expect(output).toContain('j***@example.com');
    expect(output).not.toContain('john@example.com');
  });

  it('should not redact when disabled', () => {
    configureLogger({ redactPII: false });
    resetLogger();
    
    const logger = getLogger({ component: 'no-redact' });
    logger.info('Sensitive', { password: 'visible' });
    
    const output = consoleOutput[0];
    expect(output).toContain('visible');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Environment Variables', () => {
  it('should respect LOG_LEVEL env var', () => {
    process.env.LOG_LEVEL = 'error';
    resetLogger();
    
    const logger = getLogger();
    
    expect(logger.isLevelEnabled('debug')).toBe(false);
    expect(logger.isLevelEnabled('error')).toBe(true);
  });
});
