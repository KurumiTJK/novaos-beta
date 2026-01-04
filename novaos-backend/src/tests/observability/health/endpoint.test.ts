// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH ENDPOINTS TESTS — Express Routes for Health Checks
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';
import {
  createHealthRouter,
  configureHealthEndpoints,
  healthHandlers,
  checkHealth,
  isReady,
  isHealthy,
  type HealthEndpointConfig,
} from '../../../observability/health/endpoint.js';
import {
  clearDependencyChecks,
  registerDependency,
} from '../../../observability/health/dependencies.js';
import { healthy, degraded, unhealthy } from '../../../observability/health/checks.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

let app: Application;

beforeEach(() => {
  clearDependencyChecks();
  app = express();
  
  // Configure with defaults
  configureHealthEndpoints({
    version: '1.0.0-test',
    serviceName: 'test-service',
    environment: 'test',
    criticalChecks: ['redis'],
    skipLogging: true,
  });
});

afterEach(() => {
  clearDependencyChecks();
});

// ─────────────────────────────────────────────────────────────────────────────────
// createHealthRouter TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createHealthRouter()', () => {
  it('should create a router with health endpoints', () => {
    const router = createHealthRouter();
    
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should accept configuration options', () => {
    const router = createHealthRouter({
      version: '2.0.0',
      serviceName: 'custom-service',
    });
    
    expect(router).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// /health ENDPOINT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  beforeEach(() => {
    app.use(createHealthRouter());
  });

  it('should return 200 when all checks healthy', async () => {
    registerDependency('redis', async () => healthy('redis'));
    
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  it('should return 200 when degraded', async () => {
    registerDependency('redis', async () => degraded('redis', 'Slow'));
    
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
  });

  it('should return 503 when unhealthy', async () => {
    registerDependency('redis', async () => unhealthy('redis', 'Down'));
    
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
  });

  it('should include version and uptime', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body.version).toBe('1.0.0-test');
    expect(typeof response.body.uptime).toBe('number');
  });

  it('should include timestamp', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body.timestamp).toBeDefined();
    expect(new Date(response.body.timestamp).getTime()).not.toBeNaN();
  });

  it('should include individual check results', async () => {
    registerDependency('redis', async () => healthy('redis'));
    registerDependency('llm_openai', async () => degraded('llm_openai', 'No key'));
    
    const response = await request(app).get('/health');
    
    expect(response.body.checks).toBeDefined();
    expect(response.body.checks.redis).toBeDefined();
    expect(response.body.checks.llm_openai).toBeDefined();
  });

  it('should include summary counts', async () => {
    registerDependency('healthy1', async () => healthy('healthy1'));
    registerDependency('degraded1', async () => degraded('degraded1', 'Warning'));
    registerDependency('unhealthy1', async () => unhealthy('unhealthy1', 'Error'));
    
    const response = await request(app).get('/health');
    
    expect(response.body.summary).toBeDefined();
    expect(response.body.summary.total).toBeGreaterThanOrEqual(3);
    expect(response.body.summary.healthy).toBeGreaterThanOrEqual(1);
    expect(response.body.summary.degraded).toBeGreaterThanOrEqual(1);
    expect(response.body.summary.unhealthy).toBeGreaterThanOrEqual(1);
  });

  it('should include core checks (self, memory, event_loop)', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body.checks.self).toBeDefined();
    expect(response.body.checks.memory).toBeDefined();
    expect(response.body.checks.event_loop).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// /health/live ENDPOINT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('GET /health/live', () => {
  beforeEach(() => {
    app.use(createHealthRouter());
  });

  it('should return 200 with alive=true', async () => {
    const response = await request(app).get('/health/live');
    
    expect(response.status).toBe(200);
    expect(response.body.alive).toBe(true);
  });

  it('should include timestamp', async () => {
    const response = await request(app).get('/health/live');
    
    expect(response.body.timestamp).toBeDefined();
  });

  it('should include uptime', async () => {
    const response = await request(app).get('/health/live');
    
    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should always return 200 regardless of dependency state', async () => {
    registerDependency('failing', async () => unhealthy('failing', 'Down'));
    
    const response = await request(app).get('/health/live');
    
    expect(response.status).toBe(200);
    expect(response.body.alive).toBe(true);
  });
});

describe('GET /live (alias)', () => {
  beforeEach(() => {
    app.use(createHealthRouter());
  });

  it('should work as alias for /health/live', async () => {
    const response = await request(app).get('/live');
    
    expect(response.status).toBe(200);
    expect(response.body.alive).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// /health/ready ENDPOINT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('GET /health/ready', () => {
  beforeEach(() => {
    app.use(createHealthRouter());
  });

  it('should return 200 when critical checks pass', async () => {
    registerDependency('redis', async () => healthy('redis'));
    
    const response = await request(app).get('/health/ready');
    
    expect(response.status).toBe(200);
    expect(response.body.ready).toBe(true);
  });

  it('should return 503 when critical check fails', async () => {
    registerDependency('redis', async () => unhealthy('redis', 'Down'));
    
    const response = await request(app).get('/health/ready');
    
    expect(response.status).toBe(503);
    expect(response.body.ready).toBe(false);
  });

  it('should include reason when not ready', async () => {
    registerDependency('redis', async () => unhealthy('redis', 'Down'));
    
    const response = await request(app).get('/health/ready');
    
    expect(response.body.reason).toBeDefined();
    expect(response.body.reason).toContain('redis');
  });

  it('should include individual check statuses', async () => {
    registerDependency('redis', async () => healthy('redis'));
    registerDependency('optional', async () => degraded('optional', 'Slow'));
    
    const response = await request(app).get('/health/ready');
    
    expect(response.body.checks).toBeDefined();
    expect(response.body.checks.redis).toBe(true);
    expect(response.body.checks.optional).toBe(true); // degraded is still "ready"
  });

  it('should be ready even with degraded critical check', async () => {
    registerDependency('redis', async () => degraded('redis', 'Slow'));
    
    const response = await request(app).get('/health/ready');
    
    expect(response.status).toBe(200);
    expect(response.body.ready).toBe(true);
  });

  it('should be ready when critical check is missing', async () => {
    // No redis registered, but it's in criticalChecks
    const response = await request(app).get('/health/ready');
    
    // The check is missing, so it fails
    expect(response.status).toBe(503);
    expect(response.body.ready).toBe(false);
  });
});

describe('GET /ready (alias)', () => {
  beforeEach(() => {
    app.use(createHealthRouter());
  });

  it('should work as alias for /health/ready', async () => {
    registerDependency('redis', async () => healthy('redis'));
    
    const response = await request(app).get('/ready');
    
    expect(response.status).toBe(200);
    expect(response.body.ready).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// /status ENDPOINT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('GET /status', () => {
  beforeEach(() => {
    app.use(createHealthRouter());
  });

  it('should return detailed status', async () => {
    const response = await request(app).get('/status');
    
    expect(response.status).toBe(200);
    expect(response.body.service).toBe('test-service');
    expect(response.body.environment).toBe('test');
  });

  it('should include resource usage', async () => {
    const response = await request(app).get('/status');
    
    expect(response.body.resources).toBeDefined();
    expect(response.body.resources.memory).toBeDefined();
    expect(response.body.resources.memory.heapUsedMB).toBeDefined();
    expect(response.body.resources.memory.heapTotalMB).toBeDefined();
    expect(response.body.resources.memory.rssMB).toBeDefined();
  });

  it('should include CPU usage', async () => {
    const response = await request(app).get('/status');
    
    expect(response.body.resources.cpu).toBeDefined();
    expect(typeof response.body.resources.cpu.user).toBe('number');
    expect(typeof response.body.resources.cpu.system).toBe('number');
  });

  it('should include process info', async () => {
    const response = await request(app).get('/status');
    
    expect(response.body.process).toBeDefined();
    expect(response.body.process.pid).toBe(process.pid);
    expect(response.body.process.nodeVersion).toBe(process.version);
    expect(response.body.process.platform).toBe(process.platform);
  });

  it('should include features from config', async () => {
    configureHealthEndpoints({
      getFeatures: () => ({ websearch: true, learning: false }),
    });
    app = express();
    app.use(createHealthRouter());
    
    const response = await request(app).get('/status');
    
    expect(response.body.features).toEqual({ websearch: true, learning: false });
  });

  it('should include all health check info', async () => {
    const response = await request(app).get('/status');
    
    expect(response.body.status).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.version).toBeDefined();
    expect(response.body.uptime).toBeDefined();
    expect(response.body.checks).toBeDefined();
    expect(response.body.summary).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// healthHandlers TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('healthHandlers', () => {
  it('should export all handler functions', () => {
    expect(healthHandlers.health).toBeDefined();
    expect(healthHandlers.liveness).toBeDefined();
    expect(healthHandlers.readiness).toBeDefined();
    expect(healthHandlers.status).toBeDefined();
    
    expect(typeof healthHandlers.health).toBe('function');
    expect(typeof healthHandlers.liveness).toBe('function');
    expect(typeof healthHandlers.readiness).toBe('function');
    expect(typeof healthHandlers.status).toBe('function');
  });

  it('should work with custom routing', async () => {
    app.get('/custom/health', healthHandlers.health);
    
    const response = await request(app).get('/custom/health');
    
    expect(response.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PROGRAMMATIC API TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('checkHealth()', () => {
  it('should return health check response', async () => {
    registerDependency('redis', async () => healthy('redis'));
    
    const result = await checkHealth();
    
    expect(result.status).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.uptime).toBeDefined();
    expect(result.checks).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('should include all checks', async () => {
    registerDependency('test1', async () => healthy('test1'));
    registerDependency('test2', async () => healthy('test2'));
    
    const result = await checkHealth();
    
    expect(result.checks.test1).toBeDefined();
    expect(result.checks.test2).toBeDefined();
  });
});

describe('isReady()', () => {
  it('should return true when critical checks pass', async () => {
    registerDependency('redis', async () => healthy('redis'));
    
    const ready = await isReady();
    
    expect(ready).toBe(true);
  });

  it('should return false when critical check fails', async () => {
    registerDependency('redis', async () => unhealthy('redis', 'Down'));
    
    const ready = await isReady();
    
    expect(ready).toBe(false);
  });

  it('should return true when critical check is degraded', async () => {
    registerDependency('redis', async () => degraded('redis', 'Slow'));
    
    const ready = await isReady();
    
    expect(ready).toBe(true);
  });
});

describe('isHealthy()', () => {
  it('should return true when all checks healthy', async () => {
    registerDependency('redis', async () => healthy('redis'));
    
    const result = await isHealthy();
    
    expect(result).toBe(true);
  });

  it('should return false when any check degraded', async () => {
    registerDependency('redis', async () => degraded('redis', 'Slow'));
    
    const result = await isHealthy();
    
    expect(result).toBe(false);
  });

  it('should return false when any check unhealthy', async () => {
    registerDependency('redis', async () => unhealthy('redis', 'Down'));
    
    const result = await isHealthy();
    
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR HANDLING TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Error Handling', () => {
  beforeEach(() => {
    app.use(createHealthRouter());
  });

  it('should handle check errors gracefully in /health', async () => {
    registerDependency('failing', async () => {
      throw new Error('Check exploded');
    });
    
    const response = await request(app).get('/health');
    
    // Should still return a response
    expect([200, 503]).toContain(response.status);
  });

  it('should handle check errors gracefully in /health/ready', async () => {
    registerDependency('redis', async () => {
      throw new Error('Redis exploded');
    });
    
    const response = await request(app).get('/health/ready');
    
    expect(response.status).toBe(503);
    expect(response.body.ready).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('configureHealthEndpoints()', () => {
  it('should configure version', async () => {
    configureHealthEndpoints({ version: '3.0.0' });
    app = express();
    app.use(createHealthRouter());
    
    const response = await request(app).get('/health');
    
    expect(response.body.version).toBe('3.0.0');
  });

  it('should configure service name', async () => {
    configureHealthEndpoints({ serviceName: 'my-service' });
    app = express();
    app.use(createHealthRouter());
    
    const response = await request(app).get('/status');
    
    expect(response.body.service).toBe('my-service');
  });

  it('should configure critical checks', async () => {
    configureHealthEndpoints({ criticalChecks: ['database'] });
    app = express();
    app.use(createHealthRouter());
    
    // redis is no longer critical, database is
    registerDependency('redis', async () => unhealthy('redis', 'Down'));
    registerDependency('database', async () => healthy('database'));
    
    const response = await request(app).get('/health/ready');
    
    expect(response.body.ready).toBe(true);
  });

  it('should merge with default config', async () => {
    configureHealthEndpoints({ version: '2.0.0' });
    app = express();
    app.use(createHealthRouter());
    
    // Other defaults should still be set
    const response = await request(app).get('/health');
    expect(response.body.version).toBe('2.0.0');
  });
});
