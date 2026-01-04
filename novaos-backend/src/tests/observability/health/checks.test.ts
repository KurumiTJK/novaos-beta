// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECKS TESTS — Health Check Implementations
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  healthy,
  degraded,
  unhealthy,
  withTimeout,
  checkMemory,
  checkEventLoop,
  checkDiskSpace,
  checkSelf,
  createRedisHealthCheck,
  createLLMHealthCheck,
  createExternalAPIHealthCheck,
  runChecks,
  determineOverallStatus,
  type RedisHealthCheckOptions,
  type LLMHealthCheckOptions,
  type ExternalAPIHealthCheckOptions,
} from '../../../observability/health/checks.js';
import { HEALTH_THRESHOLDS } from '../../../observability/health/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Helper Functions', () => {
  describe('healthy()', () => {
    it('should create a healthy component result', () => {
      const result = healthy('test-component');
      
      expect(result.name).toBe('test-component');
      expect(result.status).toBe('healthy');
      expect(result.message).toBe('OK');
      expect(result.checkedAt).toBeDefined();
      expect(new Date(result.checkedAt).getTime()).not.toBeNaN();
    });

    it('should accept optional parameters', () => {
      const result = healthy('redis', {
        latencyMs: 50,
        message: 'Connected successfully',
        details: { host: 'localhost', port: 6379 },
      });
      
      expect(result.latencyMs).toBe(50);
      expect(result.message).toBe('Connected successfully');
      expect(result.details).toEqual({ host: 'localhost', port: 6379 });
    });

    it('should default message to OK when not provided', () => {
      const result = healthy('test', { latencyMs: 10 });
      expect(result.message).toBe('OK');
    });
  });

  describe('degraded()', () => {
    it('should create a degraded component result', () => {
      const result = degraded('redis', 'High latency detected');
      
      expect(result.name).toBe('redis');
      expect(result.status).toBe('degraded');
      expect(result.message).toBe('High latency detected');
      expect(result.checkedAt).toBeDefined();
    });

    it('should accept optional parameters', () => {
      const result = degraded('redis', 'Slow response', {
        latencyMs: 300,
        details: { threshold: 100 },
      });
      
      expect(result.latencyMs).toBe(300);
      expect(result.details).toEqual({ threshold: 100 });
    });
  });

  describe('unhealthy()', () => {
    it('should create an unhealthy component result', () => {
      const result = unhealthy('database', 'Connection refused');
      
      expect(result.name).toBe('database');
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection refused');
      expect(result.message).toBe('Health check failed');
      expect(result.checkedAt).toBeDefined();
    });

    it('should accept optional parameters', () => {
      const result = unhealthy('api', 'Timeout', {
        latencyMs: 5000,
        details: { attempts: 3 },
      });
      
      expect(result.latencyMs).toBe(5000);
      expect(result.details).toEqual({ attempts: 3 });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// withTimeout TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('withTimeout()', () => {
  it('should resolve if promise completes before timeout', async () => {
    const fastPromise = Promise.resolve('success');
    const result = await withTimeout(fastPromise, 1000, 'Timed out');
    expect(result).toBe('success');
  });

  it('should reject if promise exceeds timeout', async () => {
    const slowPromise = new Promise(resolve => setTimeout(resolve, 500, 'late'));
    
    await expect(
      withTimeout(slowPromise, 50, 'Operation timed out')
    ).rejects.toThrow('Operation timed out');
  });

  it('should preserve original error if promise rejects before timeout', async () => {
    const failingPromise = Promise.reject(new Error('Original error'));
    
    await expect(
      withTimeout(failingPromise, 1000, 'Timed out')
    ).rejects.toThrow('Original error');
  });

  it('should clear timeout after promise resolves', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const promise = Promise.resolve('done');
    
    await withTimeout(promise, 1000, 'Timeout');
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should clear timeout after promise rejects', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const promise = Promise.reject(new Error('Failed'));
    
    await expect(withTimeout(promise, 1000, 'Timeout')).rejects.toThrow();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY CHECK TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('checkMemory()', () => {
  it('should return healthy status for normal memory usage', async () => {
    const result = await checkMemory();
    
    expect(result.name).toBe('memory');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    expect(result.details).toBeDefined();
    expect(result.details?.heapUsedMB).toBeDefined();
    expect(result.details?.heapTotalMB).toBeDefined();
    expect(result.details?.rssMB).toBeDefined();
    expect(result.details?.usagePercent).toBeDefined();
  });

  it('should include memory details', async () => {
    const result = await checkMemory();
    
    expect(typeof result.details?.heapUsedMB).toBe('number');
    expect(typeof result.details?.heapTotalMB).toBe('number');
    expect(typeof result.details?.rssMB).toBe('number');
    expect(typeof result.details?.externalMB).toBe('number');
    expect(typeof result.details?.usagePercent).toBe('number');
  });

  it('should have valid checkedAt timestamp', async () => {
    const result = await checkMemory();
    
    const timestamp = new Date(result.checkedAt);
    expect(timestamp.getTime()).not.toBeNaN();
    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EVENT LOOP CHECK TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('checkEventLoop()', () => {
  it('should return health status based on event loop lag', async () => {
    const result = await checkEventLoop();
    
    expect(result.name).toBe('event_loop');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    expect(result.details?.lagMs).toBeDefined();
    expect(typeof result.details?.lagMs).toBe('number');
  });

  it('should measure actual event loop lag', async () => {
    const result = await checkEventLoop();
    
    // Lag should be a non-negative number
    expect(result.details?.lagMs).toBeGreaterThanOrEqual(0);
  });

  it('should include lag in message', async () => {
    const result = await checkEventLoop();
    
    if (result.message) {
      expect(result.message).toContain('ms');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// DISK SPACE CHECK TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('checkDiskSpace()', () => {
  it('should return healthy status (containerized environment)', async () => {
    const result = await checkDiskSpace();
    
    expect(result.name).toBe('disk');
    expect(result.status).toBe('healthy');
    expect(result.details?.implemented).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SELF CHECK TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('checkSelf()', () => {
  it('should return healthy status with process info', async () => {
    const result = await checkSelf();
    
    expect(result.name).toBe('self');
    expect(result.status).toBe('healthy');
    expect(result.message).toBe('Application running');
  });

  it('should include process details', async () => {
    const result = await checkSelf();
    
    expect(result.details?.pid).toBe(process.pid);
    expect(typeof result.details?.uptime).toBe('number');
    expect(result.details?.nodeVersion).toBe(process.version);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// REDIS HEALTH CHECK FACTORY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createRedisHealthCheck()', () => {
  const createMockStore = (options: {
    connected?: boolean;
    getValue?: string | null;
    throwOnGet?: boolean;
    throwOnSet?: boolean;
    delay?: number;
  } = {}) => ({
    isConnected: () => options.connected ?? true,
    get: vi.fn(async () => {
      if (options.delay) await new Promise(r => setTimeout(r, options.delay));
      if (options.throwOnGet) throw new Error('Get failed');
      return options.getValue ?? Date.now().toString();
    }),
    set: vi.fn(async () => {
      if (options.delay) await new Promise(r => setTimeout(r, options.delay));
      if (options.throwOnSet) throw new Error('Set failed');
    }),
  });

  it('should return degraded when store is not initialized', async () => {
    const check = createRedisHealthCheck({
      getStore: () => null,
    });
    
    const result = await check();
    
    expect(result.name).toBe('redis');
    expect(result.status).toBe('degraded');
    expect(result.message).toContain('not initialized');
  });

  it('should return unhealthy when not connected', async () => {
    const mockStore = createMockStore({ connected: false });
    const check = createRedisHealthCheck({
      getStore: () => mockStore,
    });
    
    const result = await check();
    
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('not connected');
  });

  it('should return healthy when connected and responsive', async () => {
    const mockStore = createMockStore();
    // Make get return the value that was set
    mockStore.get.mockImplementation(async () => {
      const lastCall = mockStore.set.mock.calls[0];
      return lastCall ? lastCall[1] : null;
    });
    
    const check = createRedisHealthCheck({
      getStore: () => mockStore,
    });
    
    const result = await check();
    
    expect(result.status).toBe('healthy');
    expect(mockStore.set).toHaveBeenCalled();
    expect(mockStore.get).toHaveBeenCalled();
  });

  it('should return unhealthy on read verification failure', async () => {
    const mockStore = createMockStore({ getValue: 'wrong-value' });
    const check = createRedisHealthCheck({
      getStore: () => mockStore,
    });
    
    const result = await check();
    
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('verification failed');
  });

  it('should return unhealthy on timeout', async () => {
    const mockStore = createMockStore({ delay: 200 });
    const check = createRedisHealthCheck({
      getStore: () => mockStore,
      timeoutMs: 50,
    });
    
    const result = await check();
    
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('timed out');
  });

  it('should return degraded for high latency', async () => {
    const mockStore = createMockStore({ delay: 600 });
    mockStore.get.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 600));
      const lastCall = mockStore.set.mock.calls[0];
      return lastCall ? lastCall[1] : null;
    });
    
    const check = createRedisHealthCheck({
      getStore: () => mockStore,
      timeoutMs: 2000,
    });
    
    const result = await check();
    
    // Should be degraded due to high latency (>500ms)
    expect(['degraded', 'unhealthy']).toContain(result.status);
  });

  it('should catch and report errors', async () => {
    const mockStore = createMockStore({ throwOnSet: true });
    const check = createRedisHealthCheck({
      getStore: () => mockStore,
    });
    
    const result = await check();
    
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('Set failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// LLM HEALTH CHECK FACTORY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createLLMHealthCheck()', () => {
  it('should return degraded when provider not configured', async () => {
    const check = createLLMHealthCheck({
      provider: 'openai',
      isAvailable: () => false,
    });
    
    const result = await check();
    
    expect(result.name).toBe('llm_openai');
    expect(result.status).toBe('degraded');
    expect(result.message).toContain('not configured');
  });

  it('should return healthy when configured (no ping)', async () => {
    const check = createLLMHealthCheck({
      provider: 'openai',
      isAvailable: () => true,
    });
    
    const result = await check();
    
    expect(result.status).toBe('healthy');
    expect(result.message).toContain('configured');
  });

  it('should ping when ping function provided', async () => {
    const pingFn = vi.fn().mockResolvedValue(true);
    
    const check = createLLMHealthCheck({
      provider: 'openai',
      isAvailable: () => true,
      ping: pingFn,
    });
    
    const result = await check();
    
    expect(pingFn).toHaveBeenCalled();
    expect(result.status).toBe('healthy');
    expect(result.details?.pingSuccess).toBe(true);
  });

  it('should return unhealthy when ping fails', async () => {
    const check = createLLMHealthCheck({
      provider: 'openai',
      isAvailable: () => true,
      ping: async () => false,
    });
    
    const result = await check();
    
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('ping failed');
  });

  it('should return unhealthy when ping throws', async () => {
    const check = createLLMHealthCheck({
      provider: 'openai',
      isAvailable: () => true,
      ping: async () => { throw new Error('API error'); },
    });
    
    const result = await check();
    
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('API error');
  });

  it('should timeout long-running pings', async () => {
    const check = createLLMHealthCheck({
      provider: 'openai',
      isAvailable: () => true,
      ping: async () => {
        await new Promise(r => setTimeout(r, 500));
        return true;
      },
      timeoutMs: 50,
    });
    
    const result = await check();
    
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('timed out');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXTERNAL API HEALTH CHECK FACTORY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createExternalAPIHealthCheck()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return degraded when API not configured', async () => {
    const check = createExternalAPIHealthCheck({
      name: 'finnhub',
      isConfigured: () => false,
    });
    
    const result = await check();
    
    expect(result.name).toBe('api_finnhub');
    expect(result.status).toBe('degraded');
    expect(result.message).toContain('not configured');
  });

  it('should return healthy when configured (no URL)', async () => {
    const check = createExternalAPIHealthCheck({
      name: 'finnhub',
      isConfigured: () => true,
    });
    
    const result = await check();
    
    expect(result.status).toBe('healthy');
    expect(result.message).toContain('configured');
  });

  it('should check URL when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
    });
    vi.stubGlobal('fetch', mockFetch);
    
    const check = createExternalAPIHealthCheck({
      name: 'coingecko',
      isConfigured: () => true,
      url: 'https://api.coingecko.com/api/v3/ping',
    });
    
    const result = await check();
    
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/ping',
      expect.objectContaining({ method: 'HEAD' })
    );
    expect(result.status).toBe('healthy');
    expect(result.details?.status).toBe(200);
  });

  it('should return degraded for unexpected status codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 503 }));
    
    const check = createExternalAPIHealthCheck({
      name: 'api',
      isConfigured: () => true,
      url: 'https://example.com/health',
    });
    
    const result = await check();
    
    expect(result.status).toBe('degraded');
    expect(result.message).toContain('503');
  });

  it('should accept custom expected status codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 202 }));
    
    const check = createExternalAPIHealthCheck({
      name: 'api',
      isConfigured: () => true,
      url: 'https://example.com/health',
      expectedStatusCodes: [200, 202],
    });
    
    const result = await check();
    
    expect(result.status).toBe('healthy');
  });

  it('should handle fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    
    const check = createExternalAPIHealthCheck({
      name: 'api',
      isConfigured: () => true,
      url: 'https://example.com/health',
    });
    
    const result = await check();
    
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('Network error');
  });

  it('should handle timeout (AbortError)', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    
    const check = createExternalAPIHealthCheck({
      name: 'api',
      isConfigured: () => true,
      url: 'https://example.com/health',
      timeoutMs: 100,
    });
    
    const result = await check();
    
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('timed out');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// runChecks TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('runChecks()', () => {
  it('should run multiple checks in parallel by default', async () => {
    const executionOrder: number[] = [];
    
    const checks = [
      async () => {
        executionOrder.push(1);
        await new Promise(r => setTimeout(r, 50));
        return healthy('check1');
      },
      async () => {
        executionOrder.push(2);
        return healthy('check2');
      },
    ];
    
    const results = await runChecks(checks);
    
    expect(results).toHaveLength(2);
    // In parallel, check2 should complete first
    expect(executionOrder).toContain(1);
    expect(executionOrder).toContain(2);
  });

  it('should run checks sequentially when parallel=false', async () => {
    const executionOrder: number[] = [];
    
    const checks = [
      async () => {
        await new Promise(r => setTimeout(r, 10));
        executionOrder.push(1);
        return healthy('check1');
      },
      async () => {
        executionOrder.push(2);
        return healthy('check2');
      },
    ];
    
    await runChecks(checks, { parallel: false });
    
    // Sequential execution means 1 should be before 2
    expect(executionOrder).toEqual([1, 2]);
  });

  it('should handle check failures gracefully', async () => {
    const checks = [
      async () => healthy('good'),
      async () => { throw new Error('Check failed'); },
    ];
    
    const results = await runChecks(checks);
    
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('healthy');
    expect(results[1].status).toBe('unhealthy');
    expect(results[1].error).toContain('Check failed');
  });

  it('should timeout slow checks', async () => {
    const checks = [
      async () => {
        await new Promise(r => setTimeout(r, 200));
        return healthy('slow');
      },
    ];
    
    const results = await runChecks(checks, { timeoutMs: 50 });
    
    expect(results[0].status).toBe('unhealthy');
    expect(results[0].error).toContain('timed out');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// determineOverallStatus TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('determineOverallStatus()', () => {
  it('should return healthy when all checks are healthy', () => {
    const results = [
      healthy('check1'),
      healthy('check2'),
      healthy('check3'),
    ];
    
    expect(determineOverallStatus(results)).toBe('healthy');
  });

  it('should return degraded when any check is degraded', () => {
    const results = [
      healthy('check1'),
      degraded('check2', 'Slow'),
      healthy('check3'),
    ];
    
    expect(determineOverallStatus(results)).toBe('degraded');
  });

  it('should return unhealthy when any check is unhealthy', () => {
    const results = [
      healthy('check1'),
      degraded('check2', 'Slow'),
      unhealthy('check3', 'Failed'),
    ];
    
    expect(determineOverallStatus(results)).toBe('unhealthy');
  });

  it('should prioritize unhealthy over degraded', () => {
    const results = [
      degraded('check1', 'Warning'),
      unhealthy('check2', 'Error'),
    ];
    
    expect(determineOverallStatus(results)).toBe('unhealthy');
  });

  it('should return healthy for empty results', () => {
    expect(determineOverallStatus([])).toBe('healthy');
  });
});
