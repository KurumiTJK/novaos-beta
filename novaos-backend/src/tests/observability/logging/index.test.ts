// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING MODULE INDEX TESTS — Export Verification
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import * as loggingModule from '../../../observability/logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Context Exports', () => {
  it('should export ID generation functions', () => {
    expect(typeof loggingModule.generateRequestId).toBe('function');
    expect(typeof loggingModule.generateCorrelationId).toBe('function');
    expect(typeof loggingModule.generateSpanId).toBe('function');
    expect(typeof loggingModule.parseOrGenerateRequestId).toBe('function');
    expect(typeof loggingModule.parseOrGenerateCorrelationId).toBe('function');
  });

  it('should export context management functions', () => {
    expect(typeof loggingModule.createContext).toBe('function');
    expect(typeof loggingModule.runWithContext).toBe('function');
    expect(typeof loggingModule.runWithNewContext).toBe('function');
    expect(typeof loggingModule.getContext).toBe('function');
    expect(typeof loggingModule.requireContext).toBe('function');
    expect(typeof loggingModule.getContextValue).toBe('function');
  });

  it('should export context accessors', () => {
    expect(typeof loggingModule.getRequestId).toBe('function');
    expect(typeof loggingModule.getCorrelationId).toBe('function');
    expect(typeof loggingModule.getUserId).toBe('function');
    expect(typeof loggingModule.getSpanId).toBe('function');
    expect(typeof loggingModule.getRequestDuration).toBe('function');
  });

  it('should export context modification functions', () => {
    expect(typeof loggingModule.extendContext).toBe('function');
    expect(typeof loggingModule.runWithChildContext).toBe('function');
  });

  it('should export header propagation', () => {
    expect(loggingModule.CONTEXT_HEADERS).toBeDefined();
    expect(typeof loggingModule.extractContextFromHeaders).toBe('function');
    expect(typeof loggingModule.createContextHeaders).toBe('function');
  });

  it('should export logging helpers', () => {
    expect(typeof loggingModule.getLoggingContext).toBe('function');
    expect(typeof loggingModule.getMinimalLoggingContext).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// REDACTION EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Redaction Exports', () => {
  it('should export constants', () => {
    expect(loggingModule.FULL_REDACT_FIELDS).toBeDefined();
    expect(loggingModule.PARTIAL_REDACT_FIELDS).toBeDefined();
    expect(loggingModule.REDACTED).toBe('[REDACTED]');
  });

  it('should export main redact function', () => {
    expect(typeof loggingModule.redact).toBe('function');
  });

  it('should export partial redactors', () => {
    expect(typeof loggingModule.redactEmail).toBe('function');
    expect(typeof loggingModule.redactPhone).toBe('function');
    expect(typeof loggingModule.redactCreditCard).toBe('function');
    expect(typeof loggingModule.redactSSN).toBe('function');
  });

  it('should export Pino integration', () => {
    expect(typeof loggingModule.getPinoRedactPaths).toBe('function');
    expect(typeof loggingModule.getPinoRedactConfig).toBe('function');
  });

  it('should export utilities', () => {
    expect(typeof loggingModule.shouldRedact).toBe('function');
    expect(typeof loggingModule.createRedactor).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Logger Exports', () => {
  it('should export Logger class', () => {
    expect(loggingModule.Logger).toBeDefined();
    expect(typeof loggingModule.Logger).toBe('function');
  });

  it('should export LOG_LEVELS', () => {
    expect(loggingModule.LOG_LEVELS).toBeDefined();
    expect(loggingModule.LOG_LEVELS.trace).toBe(10);
    expect(loggingModule.LOG_LEVELS.fatal).toBe(60);
  });

  it('should export configuration functions', () => {
    expect(typeof loggingModule.configureLogger).toBe('function');
    expect(typeof loggingModule.getLoggerConfig).toBe('function');
  });

  it('should export main logger API', () => {
    expect(typeof loggingModule.getLogger).toBe('function');
    expect(typeof loggingModule.resetLogger).toBe('function');
  });

  it('should export request logging functions', () => {
    expect(typeof loggingModule.logRequest).toBe('function');
    expect(typeof loggingModule.logRequestStart).toBe('function');
    expect(typeof loggingModule.logRequestEnd).toBe('function');
  });

  it('should export specialized loggers', () => {
    expect(typeof loggingModule.getSecurityLogger).toBe('function');
    expect(typeof loggingModule.getPerformanceLogger).toBe('function');
    expect(typeof loggingModule.getLLMLogger).toBe('function');
    expect(typeof loggingModule.getDBLogger).toBe('function');
  });

  it('should export utility functions', () => {
    expect(typeof loggingModule.withTiming).toBe('function');
    expect(typeof loggingModule.logAndThrow).toBe('function');
    expect(typeof loggingModule.createScopedLogger).toBe('function');
  });

  it('should export pre-configured loggers', () => {
    expect(loggingModule.loggers).toBeDefined();
    expect(loggingModule.loggers.http).toBeDefined();
    expect(loggingModule.loggers.auth).toBeDefined();
    expect(loggingModule.loggers.pipeline).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Middleware Exports', () => {
  it('should export middleware functions', () => {
    expect(typeof loggingModule.requestContextMiddleware).toBe('function');
    expect(typeof loggingModule.requestLoggingMiddleware).toBe('function');
    expect(typeof loggingModule.requestMiddleware).toBe('function');
    expect(typeof loggingModule.errorLoggingMiddleware).toBe('function');
    expect(typeof loggingModule.slowRequestMiddleware).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST
// ─────────────────────────────────────────────────────────────────────────────────

describe('Module Integration', () => {
  it('should allow complete logging workflow', () => {
    // Create context
    const ctx = loggingModule.createContext({ path: '/test' });
    
    // Run with context
    loggingModule.runWithContext(ctx, () => {
      // Get logger
      const logger = loggingModule.getLogger({ component: 'test' });
      
      // Verify context is available
      const currentCtx = loggingModule.getContext();
      expect(currentCtx?.path).toBe('/test');
      
      // Verify logger works
      expect(typeof logger.info).toBe('function');
    });
  });

  it('should redact sensitive data', () => {
    const data = {
      username: 'john',
      password: 'secret123',
      email: 'john@example.com',
    };
    
    const redacted = loggingModule.redact(data);
    
    expect(redacted.username).toBe('john');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.email).toBe('j***@example.com');
  });
});
