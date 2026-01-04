// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH MODULE INDEX TESTS — Export Verification
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import * as healthModule from '../../../observability/health/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Exports', () => {
  it('should export HEALTH_THRESHOLDS constant', () => {
    expect(healthModule.HEALTH_THRESHOLDS).toBeDefined();
    expect(healthModule.HEALTH_THRESHOLDS.REDIS_LATENCY_MS).toBeDefined();
    expect(healthModule.HEALTH_THRESHOLDS.MEMORY_WARNING_PERCENT).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CHECK IMPLEMENTATION EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Check Implementation Exports', () => {
  describe('Helper Functions', () => {
    it('should export healthy()', () => {
      expect(typeof healthModule.healthy).toBe('function');
      
      const result = healthModule.healthy('test');
      expect(result.name).toBe('test');
      expect(result.status).toBe('healthy');
    });

    it('should export degraded()', () => {
      expect(typeof healthModule.degraded).toBe('function');
      
      const result = healthModule.degraded('test', 'Warning');
      expect(result.status).toBe('degraded');
    });

    it('should export unhealthy()', () => {
      expect(typeof healthModule.unhealthy).toBe('function');
      
      const result = healthModule.unhealthy('test', 'Error');
      expect(result.status).toBe('unhealthy');
    });

    it('should export withTimeout()', () => {
      expect(typeof healthModule.withTimeout).toBe('function');
    });
  });

  describe('Core Checks', () => {
    it('should export checkMemory()', async () => {
      expect(typeof healthModule.checkMemory).toBe('function');
      
      const result = await healthModule.checkMemory();
      expect(result.name).toBe('memory');
    });

    it('should export checkEventLoop()', async () => {
      expect(typeof healthModule.checkEventLoop).toBe('function');
      
      const result = await healthModule.checkEventLoop();
      expect(result.name).toBe('event_loop');
    });

    it('should export checkDiskSpace()', async () => {
      expect(typeof healthModule.checkDiskSpace).toBe('function');
      
      const result = await healthModule.checkDiskSpace();
      expect(result.name).toBe('disk');
    });

    it('should export checkSelf()', async () => {
      expect(typeof healthModule.checkSelf).toBe('function');
      
      const result = await healthModule.checkSelf();
      expect(result.name).toBe('self');
    });
  });

  describe('Check Factories', () => {
    it('should export createRedisHealthCheck()', () => {
      expect(typeof healthModule.createRedisHealthCheck).toBe('function');
    });

    it('should export createLLMHealthCheck()', () => {
      expect(typeof healthModule.createLLMHealthCheck).toBe('function');
    });

    it('should export createExternalAPIHealthCheck()', () => {
      expect(typeof healthModule.createExternalAPIHealthCheck).toBe('function');
    });
  });

  describe('Utilities', () => {
    it('should export runChecks()', () => {
      expect(typeof healthModule.runChecks).toBe('function');
    });

    it('should export determineOverallStatus()', () => {
      expect(typeof healthModule.determineOverallStatus).toBe('function');
      
      const status = healthModule.determineOverallStatus([
        healthModule.healthy('test'),
      ]);
      expect(status).toBe('healthy');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// DEPENDENCY EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Dependency Exports', () => {
  describe('Registry', () => {
    it('should export registerDependency()', () => {
      expect(typeof healthModule.registerDependency).toBe('function');
    });

    it('should export unregisterDependency()', () => {
      expect(typeof healthModule.unregisterDependency).toBe('function');
    });

    it('should export getDependencyChecks()', () => {
      expect(typeof healthModule.getDependencyChecks).toBe('function');
    });

    it('should export clearDependencyChecks()', () => {
      expect(typeof healthModule.clearDependencyChecks).toBe('function');
    });
  });

  describe('Redis', () => {
    it('should export configureRedisHealth()', () => {
      expect(typeof healthModule.configureRedisHealth).toBe('function');
    });

    it('should export getRedisHealthCheck()', () => {
      expect(typeof healthModule.getRedisHealthCheck).toBe('function');
    });
  });

  describe('LLM', () => {
    it('should export registerLLMProvider()', () => {
      expect(typeof healthModule.registerLLMProvider).toBe('function');
    });

    it('should export configureOpenAIHealth()', () => {
      expect(typeof healthModule.configureOpenAIHealth).toBe('function');
    });

    it('should export configureGeminiHealth()', () => {
      expect(typeof healthModule.configureGeminiHealth).toBe('function');
    });

    it('should export checkLLMProviders()', () => {
      expect(typeof healthModule.checkLLMProviders).toBe('function');
    });
  });

  describe('External APIs', () => {
    it('should export registerExternalAPI()', () => {
      expect(typeof healthModule.registerExternalAPI).toBe('function');
    });

    it('should export configureFinnhubHealth()', () => {
      expect(typeof healthModule.configureFinnhubHealth).toBe('function');
    });

    it('should export configureWeatherHealth()', () => {
      expect(typeof healthModule.configureWeatherHealth).toBe('function');
    });

    it('should export configureCoinGeckoHealth()', () => {
      expect(typeof healthModule.configureCoinGeckoHealth).toBe('function');
    });

    it('should export checkExternalAPIs()', () => {
      expect(typeof healthModule.checkExternalAPIs).toBe('function');
    });
  });

  describe('Initialization', () => {
    it('should export initializeDependencyHealth()', () => {
      expect(typeof healthModule.initializeDependencyHealth).toBe('function');
    });

    it('should export checkAllDependencies()', () => {
      expect(typeof healthModule.checkAllDependencies).toBe('function');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ENDPOINT EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Endpoint Exports', () => {
  describe('Configuration', () => {
    it('should export configureHealthEndpoints()', () => {
      expect(typeof healthModule.configureHealthEndpoints).toBe('function');
    });
  });

  describe('Router', () => {
    it('should export createHealthRouter()', () => {
      expect(typeof healthModule.createHealthRouter).toBe('function');
    });

    it('should export healthHandlers', () => {
      expect(healthModule.healthHandlers).toBeDefined();
      expect(typeof healthModule.healthHandlers.health).toBe('function');
      expect(typeof healthModule.healthHandlers.liveness).toBe('function');
      expect(typeof healthModule.healthHandlers.readiness).toBe('function');
      expect(typeof healthModule.healthHandlers.status).toBe('function');
    });
  });

  describe('Programmatic API', () => {
    it('should export checkHealth()', () => {
      expect(typeof healthModule.checkHealth).toBe('function');
    });

    it('should export isReady()', () => {
      expect(typeof healthModule.isReady).toBe('function');
    });

    it('should export isHealthy()', () => {
      expect(typeof healthModule.isHealthy).toBe('function');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST
// ─────────────────────────────────────────────────────────────────────────────────

describe('Module Integration', () => {
  it('should allow full health check workflow', async () => {
    // Clear existing
    healthModule.clearDependencyChecks();
    
    // Register dependencies
    healthModule.registerDependency('test', async () => 
      healthModule.healthy('test', { message: 'All good' })
    );
    
    // Run checks
    const results = await healthModule.checkAllDependencies();
    expect(results.has('test')).toBe(true);
    
    // Determine status
    const status = healthModule.determineOverallStatus(
      Array.from(results.values())
    );
    expect(status).toBe('healthy');
    
    // Cleanup
    healthModule.clearDependencyChecks();
  });

  it('should allow creating and using health router', () => {
    const router = healthModule.createHealthRouter({
      version: '1.0.0',
      serviceName: 'test-service',
    });
    
    expect(router).toBeDefined();
  });
});
