// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK IMPLEMENTATIONS — Individual Health Checks
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

import {
  type ComponentHealth,
  type ComponentStatus,
  HEALTH_THRESHOLDS,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a healthy component result.
 */
export function healthy(
  name: string,
  options?: {
    latencyMs?: number;
    message?: string;
    details?: Record<string, unknown>;
  }
): ComponentHealth {
  return {
    name,
    status: 'healthy',
    latencyMs: options?.latencyMs,
    message: options?.message ?? 'OK',
    details: options?.details,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Create a degraded component result.
 */
export function degraded(
  name: string,
  message: string,
  options?: {
    latencyMs?: number;
    details?: Record<string, unknown>;
  }
): ComponentHealth {
  return {
    name,
    status: 'degraded',
    latencyMs: options?.latencyMs,
    message,
    details: options?.details,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Create an unhealthy component result.
 */
export function unhealthy(
  name: string,
  error: string,
  options?: {
    latencyMs?: number;
    details?: Record<string, unknown>;
  }
): ComponentHealth {
  return {
    name,
    status: 'unhealthy',
    latencyMs: options?.latencyMs,
    message: 'Health check failed',
    error,
    details: options?.details,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Run a check with timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutError)), timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY CHECK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check memory usage.
 */
export async function checkMemory(): Promise<ComponentHealth> {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const usagePercent = (usage.heapUsed / usage.heapTotal) * 100;
  
  const details = {
    heapUsedMB,
    heapTotalMB,
    rssMB: Math.round(usage.rss / 1024 / 1024),
    externalMB: Math.round(usage.external / 1024 / 1024),
    usagePercent: Math.round(usagePercent * 10) / 10,
  };
  
  if (usagePercent >= HEALTH_THRESHOLDS.MEMORY_CRITICAL_PERCENT) {
    return unhealthy('memory', `Critical memory usage: ${usagePercent.toFixed(1)}%`, { details });
  }
  
  if (usagePercent >= HEALTH_THRESHOLDS.MEMORY_WARNING_PERCENT) {
    return degraded('memory', `High memory usage: ${usagePercent.toFixed(1)}%`, { details });
  }
  
  return healthy('memory', {
    message: `${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
    details,
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// EVENT LOOP CHECK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check event loop lag.
 */
export async function checkEventLoop(): Promise<ComponentHealth> {
  const start = process.hrtime.bigint();
  
  // Use setImmediate to measure event loop lag
  const lag = await new Promise<number>((resolve) => {
    setImmediate(() => {
      const end = process.hrtime.bigint();
      const lagMs = Number(end - start) / 1e6;
      resolve(lagMs);
    });
  });
  
  const details = { lagMs: Math.round(lag * 100) / 100 };
  
  if (lag >= HEALTH_THRESHOLDS.EVENT_LOOP_LAG_CRITICAL_MS) {
    return unhealthy('event_loop', `Critical event loop lag: ${lag.toFixed(2)}ms`, { details });
  }
  
  if (lag >= HEALTH_THRESHOLDS.EVENT_LOOP_LAG_WARNING_MS) {
    return degraded('event_loop', `High event loop lag: ${lag.toFixed(2)}ms`, { details });
  }
  
  return healthy('event_loop', {
    message: `Lag: ${lag.toFixed(2)}ms`,
    details,
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// REDIS CHECK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Redis health check options.
 */
export interface RedisHealthCheckOptions {
  /** Function to get the Redis store */
  getStore: () => { 
    isConnected: () => boolean;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttl?: number) => Promise<void>;
  } | null;
  
  /** Timeout for Redis operations */
  timeoutMs?: number;
}

/**
 * Create a Redis health check function.
 */
export function createRedisHealthCheck(options: RedisHealthCheckOptions): () => Promise<ComponentHealth> {
  const { getStore, timeoutMs = HEALTH_THRESHOLDS.DEFAULT_TIMEOUT_MS } = options;
  
  return async (): Promise<ComponentHealth> => {
    const start = Date.now();
    
    try {
      const store = getStore();
      
      if (!store) {
        return degraded('redis', 'Redis store not initialized', {
          details: { mode: 'memory_fallback' },
        });
      }
      
      if (!store.isConnected()) {
        return unhealthy('redis', 'Redis not connected');
      }
      
      // Ping test with timeout
      const testKey = 'health:ping';
      const testValue = Date.now().toString();
      
      await withTimeout(
        (async () => {
          await store.set(testKey, testValue, 10);
          const result = await store.get(testKey);
          
          if (result !== testValue) {
            throw new Error('Read verification failed');
          }
        })(),
        timeoutMs,
        `Redis operation timed out after ${timeoutMs}ms`
      );
      
      const latencyMs = Date.now() - start;
      const details = { latencyMs, connected: true };
      
      if (latencyMs > HEALTH_THRESHOLDS.REDIS_DEGRADED_LATENCY_MS) {
        return degraded('redis', `High latency: ${latencyMs}ms`, { latencyMs, details });
      }
      
      if (latencyMs > HEALTH_THRESHOLDS.REDIS_LATENCY_MS) {
        return degraded('redis', `Elevated latency: ${latencyMs}ms`, { latencyMs, details });
      }
      
      return healthy('redis', {
        latencyMs,
        message: `Connected (${latencyMs}ms)`,
        details,
      });
    } catch (error) {
      const latencyMs = Date.now() - start;
      return unhealthy('redis', error instanceof Error ? error.message : 'Unknown error', {
        latencyMs,
        details: { connected: false },
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// LLM PROVIDER CHECK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * LLM health check options.
 */
export interface LLMHealthCheckOptions {
  /** Provider name */
  provider: string;
  
  /** Function to check if provider is available */
  isAvailable: () => boolean;
  
  /** Optional ping function */
  ping?: () => Promise<boolean>;
  
  /** Timeout for ping */
  timeoutMs?: number;
}

/**
 * Create an LLM provider health check function.
 */
export function createLLMHealthCheck(options: LLMHealthCheckOptions): () => Promise<ComponentHealth> {
  const { provider, isAvailable, ping, timeoutMs = HEALTH_THRESHOLDS.LLM_LATENCY_MS } = options;
  
  return async (): Promise<ComponentHealth> => {
    const start = Date.now();
    const name = `llm_${provider}`;
    
    try {
      if (!isAvailable()) {
        return degraded(name, `${provider} provider not configured`, {
          details: { provider, configured: false },
        });
      }
      
      // If ping function provided, use it
      if (ping) {
        const pingResult = await withTimeout(
          ping(),
          timeoutMs,
          `LLM ping timed out after ${timeoutMs}ms`
        );
        
        const latencyMs = Date.now() - start;
        
        if (!pingResult) {
          return unhealthy(name, `${provider} ping failed`, {
            latencyMs,
            details: { provider, pingSuccess: false },
          });
        }
        
        return healthy(name, {
          latencyMs,
          message: `${provider} available (${latencyMs}ms)`,
          details: { provider, configured: true, pingSuccess: true },
        });
      }
      
      // Just check configuration
      return healthy(name, {
        message: `${provider} configured`,
        details: { provider, configured: true },
      });
    } catch (error) {
      const latencyMs = Date.now() - start;
      return unhealthy(name, error instanceof Error ? error.message : 'Unknown error', {
        latencyMs,
        details: { provider },
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXTERNAL API CHECK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * External API health check options.
 */
export interface ExternalAPIHealthCheckOptions {
  /** API name */
  name: string;
  
  /** Health check URL */
  url?: string;
  
  /** Function to check if API key is configured */
  isConfigured: () => boolean;
  
  /** Timeout for HTTP request */
  timeoutMs?: number;
  
  /** Expected status codes */
  expectedStatusCodes?: number[];
}

/**
 * Create an external API health check function.
 */
export function createExternalAPIHealthCheck(
  options: ExternalAPIHealthCheckOptions
): () => Promise<ComponentHealth> {
  const {
    name,
    url,
    isConfigured,
    timeoutMs = HEALTH_THRESHOLDS.DEFAULT_TIMEOUT_MS,
    expectedStatusCodes = [200, 201, 204],
  } = options;
  
  return async (): Promise<ComponentHealth> => {
    const start = Date.now();
    const checkName = `api_${name}`;
    
    try {
      if (!isConfigured()) {
        return degraded(checkName, `${name} API not configured`, {
          details: { api: name, configured: false },
        });
      }
      
      // If URL provided, do HTTP check
      if (url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
          });
          
          clearTimeout(timeout);
          const latencyMs = Date.now() - start;
          
          if (!expectedStatusCodes.includes(response.status)) {
            return degraded(checkName, `Unexpected status: ${response.status}`, {
              latencyMs,
              details: { api: name, status: response.status },
            });
          }
          
          return healthy(checkName, {
            latencyMs,
            message: `${name} reachable (${latencyMs}ms)`,
            details: { api: name, status: response.status },
          });
        } finally {
          clearTimeout(timeout);
        }
      }
      
      // Just check configuration
      return healthy(checkName, {
        message: `${name} configured`,
        details: { api: name, configured: true },
      });
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // AbortError means timeout
      if (error instanceof Error && error.name === 'AbortError') {
        return unhealthy(checkName, `Request timed out after ${timeoutMs}ms`, {
          latencyMs,
          details: { api: name },
        });
      }
      
      return unhealthy(checkName, errorMessage, {
        latencyMs,
        details: { api: name },
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// DISK SPACE CHECK (if applicable)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check available disk space (basic check).
 * Note: This is a simplified check. For production, use a proper disk check library.
 */
export async function checkDiskSpace(): Promise<ComponentHealth> {
  // In a container/serverless environment, disk checks may not be relevant
  // Return healthy by default, can be enhanced with actual checks if needed
  return healthy('disk', {
    message: 'Disk check not implemented (containerized environment)',
    details: { implemented: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// SELF CHECK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Basic self-check (always healthy if running).
 */
export async function checkSelf(): Promise<ComponentHealth> {
  return healthy('self', {
    message: 'Application running',
    details: {
      pid: process.pid,
      uptime: process.uptime(),
      nodeVersion: process.version,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPOSITE CHECK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Run multiple checks and return combined status.
 */
export async function runChecks(
  checks: Array<() => Promise<ComponentHealth>>,
  options?: { parallel?: boolean; timeoutMs?: number }
): Promise<ComponentHealth[]> {
  const { parallel = true, timeoutMs = HEALTH_THRESHOLDS.DEFAULT_TIMEOUT_MS } = options ?? {};
  
  const runWithTimeout = async (check: () => Promise<ComponentHealth>): Promise<ComponentHealth> => {
    try {
      return await withTimeout(check(), timeoutMs, 'Health check timed out');
    } catch (error) {
      return unhealthy('unknown', error instanceof Error ? error.message : 'Check failed');
    }
  };
  
  if (parallel) {
    return Promise.all(checks.map(runWithTimeout));
  }
  
  // Sequential execution
  const results: ComponentHealth[] = [];
  for (const check of checks) {
    results.push(await runWithTimeout(check));
  }
  return results;
}

/**
 * Determine overall status from component results.
 */
export function determineOverallStatus(results: ComponentHealth[]): ComponentStatus {
  const hasUnhealthy = results.some(r => r.status === 'unhealthy');
  const hasDegraded = results.some(r => r.status === 'degraded');
  
  if (hasUnhealthy) return 'unhealthy';
  if (hasDegraded) return 'degraded';
  return 'healthy';
}
