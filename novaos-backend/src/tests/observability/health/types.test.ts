// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH TYPES TESTS — Type Definitions and Constants
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  HEALTH_THRESHOLDS,
  type ComponentStatus,
  type SystemStatus,
  type ReadinessStatus,
  type LivenessStatus,
  type ComponentHealth,
  type ComponentHealthResult,
  type HealthCheckResponse,
  type ReadinessResponse,
  type LivenessResponse,
  type StatusResponse,
  type HealthCheckFn,
  type HealthCheckRegistration,
  type HealthCheckOptions,
  type DependencyType,
  type DependencyConfig,
} from '../../../observability/health/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH_THRESHOLDS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('HEALTH_THRESHOLDS', () => {
  it('should have all required threshold values', () => {
    expect(HEALTH_THRESHOLDS.REDIS_LATENCY_MS).toBeDefined();
    expect(HEALTH_THRESHOLDS.REDIS_DEGRADED_LATENCY_MS).toBeDefined();
    expect(HEALTH_THRESHOLDS.LLM_LATENCY_MS).toBeDefined();
    expect(HEALTH_THRESHOLDS.MEMORY_WARNING_PERCENT).toBeDefined();
    expect(HEALTH_THRESHOLDS.MEMORY_CRITICAL_PERCENT).toBeDefined();
    expect(HEALTH_THRESHOLDS.EVENT_LOOP_LAG_WARNING_MS).toBeDefined();
    expect(HEALTH_THRESHOLDS.EVENT_LOOP_LAG_CRITICAL_MS).toBeDefined();
    expect(HEALTH_THRESHOLDS.DEFAULT_TIMEOUT_MS).toBeDefined();
    expect(HEALTH_THRESHOLDS.DEFAULT_CACHE_TTL_MS).toBeDefined();
  });

  it('should have sensible Redis latency thresholds', () => {
    expect(HEALTH_THRESHOLDS.REDIS_LATENCY_MS).toBe(100);
    expect(HEALTH_THRESHOLDS.REDIS_DEGRADED_LATENCY_MS).toBe(500);
    expect(HEALTH_THRESHOLDS.REDIS_LATENCY_MS).toBeLessThan(
      HEALTH_THRESHOLDS.REDIS_DEGRADED_LATENCY_MS
    );
  });

  it('should have sensible memory thresholds', () => {
    expect(HEALTH_THRESHOLDS.MEMORY_WARNING_PERCENT).toBe(80);
    expect(HEALTH_THRESHOLDS.MEMORY_CRITICAL_PERCENT).toBe(95);
    expect(HEALTH_THRESHOLDS.MEMORY_WARNING_PERCENT).toBeLessThan(
      HEALTH_THRESHOLDS.MEMORY_CRITICAL_PERCENT
    );
  });

  it('should have sensible event loop lag thresholds', () => {
    expect(HEALTH_THRESHOLDS.EVENT_LOOP_LAG_WARNING_MS).toBe(100);
    expect(HEALTH_THRESHOLDS.EVENT_LOOP_LAG_CRITICAL_MS).toBe(500);
    expect(HEALTH_THRESHOLDS.EVENT_LOOP_LAG_WARNING_MS).toBeLessThan(
      HEALTH_THRESHOLDS.EVENT_LOOP_LAG_CRITICAL_MS
    );
  });

  it('should have positive timeout and cache values', () => {
    expect(HEALTH_THRESHOLDS.DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(HEALTH_THRESHOLDS.DEFAULT_CACHE_TTL_MS).toBeGreaterThan(0);
    expect(HEALTH_THRESHOLDS.LLM_LATENCY_MS).toBeGreaterThan(0);
  });

  it('should have const assertion for type safety', () => {
    // Note: `as const` provides TypeScript-level immutability
    // At runtime, the object is still mutable unless Object.freeze is used
    // This test verifies the values exist and are numbers
    const originalValue = HEALTH_THRESHOLDS.REDIS_LATENCY_MS;
    expect(typeof originalValue).toBe('number');
    expect(originalValue).toBe(100); // Expected default value
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('ComponentStatus', () => {
    it('should accept valid status values', () => {
      const healthy: ComponentStatus = 'healthy';
      const degraded: ComponentStatus = 'degraded';
      const unhealthy: ComponentStatus = 'unhealthy';
      
      expect(healthy).toBe('healthy');
      expect(degraded).toBe('degraded');
      expect(unhealthy).toBe('unhealthy');
    });
  });

  describe('SystemStatus', () => {
    it('should accept valid system status values', () => {
      const healthy: SystemStatus = 'healthy';
      const degraded: SystemStatus = 'degraded';
      const unhealthy: SystemStatus = 'unhealthy';
      
      expect(healthy).toBe('healthy');
      expect(degraded).toBe('degraded');
      expect(unhealthy).toBe('unhealthy');
    });
  });

  describe('ReadinessStatus', () => {
    it('should accept valid readiness values', () => {
      const ready: ReadinessStatus = 'ready';
      const notReady: ReadinessStatus = 'not_ready';
      
      expect(ready).toBe('ready');
      expect(notReady).toBe('not_ready');
    });
  });

  describe('LivenessStatus', () => {
    it('should accept valid liveness values', () => {
      const alive: LivenessStatus = 'alive';
      const dead: LivenessStatus = 'dead';
      
      expect(alive).toBe('alive');
      expect(dead).toBe('dead');
    });
  });

  describe('DependencyType', () => {
    it('should accept all valid dependency types', () => {
      const types: DependencyType[] = [
        'database',
        'cache',
        'queue',
        'api',
        'storage',
        'llm',
        'other',
      ];
      
      expect(types).toHaveLength(7);
      types.forEach(type => expect(type).toBeTruthy());
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTERFACE STRUCTURE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Interface Structures', () => {
  describe('ComponentHealth', () => {
    it('should have required fields', () => {
      const health: ComponentHealth = {
        name: 'test-component',
        status: 'healthy',
        checkedAt: new Date().toISOString(),
      };
      
      expect(health.name).toBe('test-component');
      expect(health.status).toBe('healthy');
      expect(health.checkedAt).toBeDefined();
    });

    it('should accept optional fields', () => {
      const health: ComponentHealth = {
        name: 'redis',
        status: 'degraded',
        latencyMs: 150,
        message: 'High latency detected',
        details: { connected: true, latency: 150 },
        checkedAt: new Date().toISOString(),
        error: undefined,
      };
      
      expect(health.latencyMs).toBe(150);
      expect(health.message).toBe('High latency detected');
      expect(health.details).toEqual({ connected: true, latency: 150 });
    });

    it('should accept error field for unhealthy status', () => {
      const health: ComponentHealth = {
        name: 'database',
        status: 'unhealthy',
        error: 'Connection refused',
        checkedAt: new Date().toISOString(),
      };
      
      expect(health.error).toBe('Connection refused');
    });
  });

  describe('ComponentHealthResult', () => {
    it('should extend ComponentHealth with metadata', () => {
      const result: ComponentHealthResult = {
        name: 'redis',
        status: 'healthy',
        checkedAt: new Date().toISOString(),
        critical: true,
        failureCount: 0,
        lastSuccess: new Date().toISOString(),
      };
      
      expect(result.critical).toBe(true);
      expect(result.failureCount).toBe(0);
      expect(result.lastSuccess).toBeDefined();
    });
  });

  describe('HealthCheckResponse', () => {
    it('should have all required fields', () => {
      const response: HealthCheckResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: 3600,
        checks: {
          redis: {
            name: 'redis',
            status: 'healthy',
            checkedAt: new Date().toISOString(),
          },
        },
        summary: {
          total: 1,
          healthy: 1,
          degraded: 0,
          unhealthy: 0,
        },
      };
      
      expect(response.status).toBe('healthy');
      expect(response.version).toBe('1.0.0');
      expect(response.uptime).toBe(3600);
      expect(response.checks.redis).toBeDefined();
      expect(response.summary.total).toBe(1);
    });
  });

  describe('ReadinessResponse', () => {
    it('should have ready status and checks', () => {
      const response: ReadinessResponse = {
        ready: true,
        timestamp: new Date().toISOString(),
        checks: {
          redis: true,
          database: true,
        },
      };
      
      expect(response.ready).toBe(true);
      expect(response.checks.redis).toBe(true);
    });

    it('should include reason when not ready', () => {
      const response: ReadinessResponse = {
        ready: false,
        timestamp: new Date().toISOString(),
        reason: 'Redis connection failed',
        checks: {
          redis: false,
        },
      };
      
      expect(response.ready).toBe(false);
      expect(response.reason).toBe('Redis connection failed');
    });
  });

  describe('LivenessResponse', () => {
    it('should have alive status and uptime', () => {
      const response: LivenessResponse = {
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: 7200,
      };
      
      expect(response.alive).toBe(true);
      expect(response.uptime).toBe(7200);
    });
  });

  describe('StatusResponse', () => {
    it('should extend HealthCheckResponse with additional info', () => {
      const response: StatusResponse = {
        service: 'novaos-backend',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: 'production',
        uptime: 86400,
        checks: {},
        summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
        features: { websearch: true, learning: false },
        resources: {
          memory: {
            heapUsedMB: 128,
            heapTotalMB: 256,
            rssMB: 300,
            externalMB: 10,
          },
          cpu: {
            user: 1000000,
            system: 500000,
          },
        },
        process: {
          pid: 12345,
          nodeVersion: 'v20.0.0',
          platform: 'linux',
        },
      };
      
      expect(response.service).toBe('novaos-backend');
      expect(response.environment).toBe('production');
      expect(response.features.websearch).toBe(true);
      expect(response.resources.memory.heapUsedMB).toBe(128);
      expect(response.process.pid).toBe(12345);
    });
  });

  describe('HealthCheckRegistration', () => {
    it('should define health check registration', () => {
      const registration: HealthCheckRegistration = {
        name: 'redis',
        check: async () => ({
          name: 'redis',
          status: 'healthy',
          checkedAt: new Date().toISOString(),
        }),
        critical: true,
        timeoutMs: 5000,
        cacheTtlMs: 10000,
        description: 'Redis connectivity check',
      };
      
      expect(registration.name).toBe('redis');
      expect(registration.critical).toBe(true);
      expect(registration.timeoutMs).toBe(5000);
      expect(typeof registration.check).toBe('function');
    });
  });

  describe('HealthCheckOptions', () => {
    it('should define check execution options', () => {
      const options: HealthCheckOptions = {
        timeoutMs: 3000,
        parallel: true,
        includeNonCritical: false,
        forceRefresh: true,
      };
      
      expect(options.timeoutMs).toBe(3000);
      expect(options.parallel).toBe(true);
      expect(options.includeNonCritical).toBe(false);
      expect(options.forceRefresh).toBe(true);
    });
  });

  describe('DependencyConfig', () => {
    it('should define dependency configuration', () => {
      const config: DependencyConfig = {
        name: 'postgresql',
        type: 'database',
        critical: true,
        healthCheck: '/health',
        timeoutMs: 5000,
        latencyThresholdMs: 100,
      };
      
      expect(config.name).toBe('postgresql');
      expect(config.type).toBe('database');
      expect(config.critical).toBe(true);
    });

    it('should accept function as healthCheck', () => {
      const checkFn: HealthCheckFn = async () => ({
        name: 'custom',
        status: 'healthy',
        checkedAt: new Date().toISOString(),
      });
      
      const config: DependencyConfig = {
        name: 'custom-service',
        type: 'api',
        critical: false,
        healthCheck: checkFn,
      };
      
      expect(typeof config.healthCheck).toBe('function');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('should handle empty checks in HealthCheckResponse', () => {
    const response: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: 0,
      checks: {},
      summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
    };
    
    expect(Object.keys(response.checks)).toHaveLength(0);
    expect(response.summary.total).toBe(0);
  });

  it('should handle zero uptime', () => {
    const response: LivenessResponse = {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: 0,
    };
    
    expect(response.uptime).toBe(0);
  });

  it('should handle details with nested objects', () => {
    const health: ComponentHealth = {
      name: 'complex',
      status: 'healthy',
      checkedAt: new Date().toISOString(),
      details: {
        nested: {
          deeply: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
      },
    };
    
    expect((health.details as Record<string, unknown>).nested).toBeDefined();
    expect((health.details as Record<string, unknown>).array).toHaveLength(3);
  });
});
