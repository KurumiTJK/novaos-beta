// ═══════════════════════════════════════════════════════════════════════════════
// OBSERVABILITY MODULE INDEX TESTS — Unified Exports
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as observability from '../../observability/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGING EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Logging Exports', () => {
  describe('Context', () => {
    it('should export context types and functions', () => {
      expect(typeof observability.generateRequestId).toBe('function');
      expect(typeof observability.generateCorrelationId).toBe('function');
      expect(typeof observability.createContext).toBe('function');
      expect(typeof observability.runWithContext).toBe('function');
      expect(typeof observability.getContext).toBe('function');
      expect(typeof observability.requireContext).toBe('function');
    });

    it('should export context accessors', () => {
      expect(typeof observability.getRequestId).toBe('function');
      expect(typeof observability.getCorrelationId).toBe('function');
      expect(typeof observability.getUserId).toBe('function');
      expect(typeof observability.extendContext).toBe('function');
      expect(typeof observability.runWithChildContext).toBe('function');
    });

    it('should export header utilities', () => {
      expect(observability.CONTEXT_HEADERS).toBeDefined();
      expect(typeof observability.extractContextFromHeaders).toBe('function');
      expect(typeof observability.createContextHeaders).toBe('function');
      expect(typeof observability.getLoggingContext).toBe('function');
    });
  });

  describe('Redaction', () => {
    it('should export redaction functions', () => {
      expect(typeof observability.redact).toBe('function');
      expect(typeof observability.redactEmail).toBe('function');
      expect(typeof observability.redactPhone).toBe('function');
      expect(typeof observability.redactCreditCard).toBe('function');
      expect(typeof observability.redactSSN).toBe('function');
    });

    it('should export redaction constants', () => {
      expect(observability.REDACTED).toBe('[REDACTED]');
      expect(observability.FULL_REDACT_FIELDS).toBeDefined();
      expect(observability.PARTIAL_REDACT_FIELDS).toBeDefined();
    });

    it('should export Pino integration', () => {
      expect(typeof observability.getPinoRedactPaths).toBe('function');
      expect(typeof observability.getPinoRedactConfig).toBe('function');
      expect(typeof observability.shouldRedact).toBe('function');
      expect(typeof observability.createRedactor).toBe('function');
    });
  });

  describe('Logger', () => {
    it('should export Logger class', () => {
      expect(observability.Logger).toBeDefined();
    });

    it('should export LOG_LEVELS', () => {
      expect(observability.LOG_LEVELS).toBeDefined();
      expect(observability.LOG_LEVELS.info).toBe(30);
    });

    it('should export logger functions', () => {
      expect(typeof observability.getLogger).toBe('function');
      expect(typeof observability.configureLogger).toBe('function');
      expect(typeof observability.getLoggerConfig).toBe('function');
      expect(typeof observability.resetLogger).toBe('function');
    });

    it('should export request logging', () => {
      expect(typeof observability.logRequest).toBe('function');
      expect(typeof observability.logRequestStart).toBe('function');
      expect(typeof observability.logRequestEnd).toBe('function');
    });

    it('should export specialized loggers', () => {
      expect(observability.loggers).toBeDefined();
      expect(typeof observability.getSecurityLogger).toBe('function');
      expect(typeof observability.getPerformanceLogger).toBe('function');
      expect(typeof observability.getLLMLogger).toBe('function');
      expect(typeof observability.getDBLogger).toBe('function');
    });

    it('should export utility functions', () => {
      expect(typeof observability.withTiming).toBe('function');
      expect(typeof observability.logAndThrow).toBe('function');
      expect(typeof observability.createScopedLogger).toBe('function');
    });
  });

  describe('Middleware', () => {
    it('should export middleware functions', () => {
      expect(typeof observability.requestMiddleware).toBe('function');
      expect(typeof observability.requestContextMiddleware).toBe('function');
      expect(typeof observability.requestLoggingMiddleware).toBe('function');
      expect(typeof observability.errorLoggingMiddleware).toBe('function');
      expect(typeof observability.slowRequestMiddleware).toBe('function');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Health Exports', () => {
  describe('Types and Constants', () => {
    it('should export HEALTH_THRESHOLDS', () => {
      expect(observability.HEALTH_THRESHOLDS).toBeDefined();
      expect(observability.HEALTH_THRESHOLDS.REDIS_LATENCY_MS).toBe(100);
    });
  });

  describe('Check Helpers', () => {
    it('should export status helpers', () => {
      expect(typeof observability.healthy).toBe('function');
      expect(typeof observability.degraded).toBe('function');
      expect(typeof observability.unhealthy).toBe('function');
      expect(typeof observability.withTimeout).toBe('function');
    });
  });

  describe('Core Checks', () => {
    it('should export core check functions', () => {
      expect(typeof observability.checkMemory).toBe('function');
      expect(typeof observability.checkEventLoop).toBe('function');
      expect(typeof observability.checkDiskSpace).toBe('function');
      expect(typeof observability.checkSelf).toBe('function');
    });
  });

  describe('Check Factories', () => {
    it('should export factory functions', () => {
      expect(typeof observability.createRedisHealthCheck).toBe('function');
      expect(typeof observability.createLLMHealthCheck).toBe('function');
      expect(typeof observability.createExternalAPIHealthCheck).toBe('function');
    });
  });

  describe('Utilities', () => {
    it('should export utility functions', () => {
      expect(typeof observability.runChecks).toBe('function');
      expect(typeof observability.determineOverallStatus).toBe('function');
    });
  });

  describe('Dependencies', () => {
    it('should export registry functions', () => {
      expect(typeof observability.registerDependency).toBe('function');
      expect(typeof observability.unregisterDependency).toBe('function');
      expect(typeof observability.getDependencyChecks).toBe('function');
      expect(typeof observability.clearDependencyChecks).toBe('function');
    });

    it('should export Redis health', () => {
      expect(typeof observability.configureRedisHealth).toBe('function');
      expect(typeof observability.getRedisHealthCheck).toBe('function');
    });

    it('should export LLM health', () => {
      expect(typeof observability.registerLLMProvider).toBe('function');
      expect(typeof observability.configureOpenAIHealth).toBe('function');
      expect(typeof observability.configureGeminiHealth).toBe('function');
      expect(typeof observability.checkLLMProviders).toBe('function');
    });

    it('should export external API health', () => {
      expect(typeof observability.registerExternalAPI).toBe('function');
      expect(typeof observability.configureFinnhubHealth).toBe('function');
      expect(typeof observability.configureWeatherHealth).toBe('function');
      expect(typeof observability.configureCoinGeckoHealth).toBe('function');
      expect(typeof observability.checkExternalAPIs).toBe('function');
    });

    it('should export initialization', () => {
      expect(typeof observability.initializeDependencyHealth).toBe('function');
      expect(typeof observability.checkAllDependencies).toBe('function');
    });
  });

  describe('Endpoints', () => {
    it('should export endpoint configuration', () => {
      expect(typeof observability.configureHealthEndpoints).toBe('function');
    });

    it('should export router', () => {
      expect(typeof observability.createHealthRouter).toBe('function');
      expect(observability.healthHandlers).toBeDefined();
    });

    it('should export programmatic API', () => {
      expect(typeof observability.checkHealth).toBe('function');
      expect(typeof observability.isReady).toBe('function');
      expect(typeof observability.isHealthy).toBe('function');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION HELPER
// ─────────────────────────────────────────────────────────────────────────────────

describe('initializeObservability()', () => {
  beforeEach(() => {
    observability.clearDependencyChecks();
    observability.resetLogger();
  });

  afterEach(() => {
    observability.clearDependencyChecks();
    observability.resetLogger();
  });

  it('should be exported', () => {
    expect(typeof observability.initializeObservability).toBe('function');
  });

  it('should accept empty config', () => {
    expect(() => observability.initializeObservability({})).not.toThrow();
  });

  it('should configure logging', () => {
    observability.initializeObservability({
      logging: { level: 'debug' },
    });
    
    const config = observability.getLoggerConfig();
    expect(config.level).toBe('debug');
  });

  it('should initialize health dependencies', () => {
    observability.initializeObservability({
      health: {
        llm: { openai: true, gemini: false },
      },
    });
    
    const checks = observability.getDependencyChecks();
    expect(checks.has('llm_openai')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Module Integration', () => {
  beforeEach(() => {
    observability.clearDependencyChecks();
    observability.resetLogger();
  });

  afterEach(() => {
    observability.clearDependencyChecks();
  });

  it('should allow complete observability setup', () => {
    // Initialize everything
    observability.initializeObservability({
      logging: { level: 'info', serviceName: 'test' },
      health: {
        llm: { openai: true },
        externalAPIs: { finnhub: true },
      },
    });
    
    // Create health router
    const router = observability.createHealthRouter({
      version: '1.0.0',
      serviceName: 'test',
    });
    
    expect(router).toBeDefined();
  });

  it('should work with context and logging together', () => {
    const ctx = observability.createContext({ path: '/api/test' });
    
    observability.runWithContext(ctx, () => {
      const logger = observability.getLogger({ component: 'test' });
      
      // Context should be available
      expect(observability.getRequestId()).not.toBe('unknown');
      
      // Logger should work
      expect(typeof logger.info).toBe('function');
      
      // Logging context should include request info
      const logCtx = observability.getLoggingContext();
      expect(logCtx.path).toBe('/api/test');
    });
  });

  it('should allow health checks with logging', async () => {
    observability.registerDependency('test', async () => {
      return observability.healthy('test', { message: 'All good' });
    });
    
    const results = await observability.checkAllDependencies();
    const status = observability.determineOverallStatus(
      Array.from(results.values())
    );
    
    expect(status).toBe('healthy');
  });
});
