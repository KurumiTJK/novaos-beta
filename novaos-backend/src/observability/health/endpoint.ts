// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH ENDPOINTS — Express Routes for Health Checks
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides Kubernetes-compatible health endpoints:
// - /health       Full health check with all components
// - /health/live  Liveness probe (is the process alive?)
// - /health/ready Readiness probe (can it accept traffic?)
// - /status       Detailed status with features and resources
//
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from 'express';
import type {
  HealthCheckResponse,
  ReadinessResponse,
  LivenessResponse,
  StatusResponse,
  ComponentHealth,
  ComponentStatus,
} from './types.js';
import {
  checkMemory,
  checkEventLoop,
  checkSelf,
  determineOverallStatus,
} from './checks.js';
import { checkAllDependencies } from './dependencies.js';
import { getLogger } from '../logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Health endpoint configuration.
 */
export interface HealthEndpointConfig {
  /** Application version */
  version?: string;
  
  /** Service name */
  serviceName?: string;
  
  /** Environment name */
  environment?: string;
  
  /** Feature flags getter */
  getFeatures?: () => Record<string, boolean>;
  
  /** Critical checks that must pass for readiness */
  criticalChecks?: string[];
  
  /** Skip logging for health endpoints */
  skipLogging?: boolean;
}

const DEFAULT_CONFIG: Required<HealthEndpointConfig> = {
  version: process.env.APP_VERSION ?? '10.0.0',
  serviceName: 'novaos-backend',
  environment: process.env.NODE_ENV ?? 'development',
  getFeatures: () => ({}),
  criticalChecks: ['redis'],
  skipLogging: true,
};

let healthConfig: Required<HealthEndpointConfig> = { ...DEFAULT_CONFIG };

/**
 * Configure health endpoints.
 */
export function configureHealthEndpoints(config: HealthEndpointConfig): void {
  healthConfig = { ...DEFAULT_CONFIG, ...config };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Run all health checks and aggregate results.
 */
async function runAllHealthChecks(): Promise<Record<string, ComponentHealth>> {
  const results: Record<string, ComponentHealth> = {};
  
  // Core checks
  const [selfResult, memoryResult, eventLoopResult] = await Promise.all([
    checkSelf(),
    checkMemory(),
    checkEventLoop(),
  ]);
  
  results.self = selfResult;
  results.memory = memoryResult;
  results.event_loop = eventLoopResult;
  
  // Dependency checks
  const dependencyResults = await checkAllDependencies();
  for (const [name, result] of dependencyResults) {
    results[name] = result;
  }
  
  return results;
}

/**
 * Calculate summary from check results.
 */
function calculateSummary(checks: Record<string, ComponentHealth>): {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
} {
  const results = Object.values(checks);
  return {
    total: results.length,
    healthy: results.filter(r => r.status === 'healthy').length,
    degraded: results.filter(r => r.status === 'degraded').length,
    unhealthy: results.filter(r => r.status === 'unhealthy').length,
  };
}

/**
 * Check if all critical checks pass.
 */
function checkCriticalDependencies(
  checks: Record<string, ComponentHealth>,
  criticalNames: string[]
): { ready: boolean; failedChecks: string[] } {
  const failedChecks: string[] = [];
  
  for (const name of criticalNames) {
    const check = checks[name];
    if (!check || check.status === 'unhealthy') {
      failedChecks.push(name);
    }
  }
  
  return {
    ready: failedChecks.length === 0,
    failedChecks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENDPOINT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Full health check handler.
 */
async function healthHandler(_req: Request, res: Response): Promise<void> {
  const logger = getLogger({ component: 'health' });
  
  try {
    const checks = await runAllHealthChecks();
    const summary = calculateSummary(checks);
    const overallStatus = determineOverallStatus(Object.values(checks));
    
    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: healthConfig.version,
      uptime: process.uptime(),
      checks,
      summary,
    };
    
    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    
    if (overallStatus !== 'healthy' && !healthConfig.skipLogging) {
      logger.warn('Health check not healthy', {
        status: overallStatus,
        summary,
      });
    }
    
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
}

/**
 * Liveness probe handler.
 * Returns 200 if the process is alive.
 */
async function livenessHandler(_req: Request, res: Response): Promise<void> {
  const response: LivenessResponse = {
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
  
  res.status(200).json(response);
}

/**
 * Readiness probe handler.
 * Returns 200 if the service can accept traffic.
 */
async function readinessHandler(_req: Request, res: Response): Promise<void> {
  const logger = getLogger({ component: 'health' });
  
  try {
    const checks = await runAllHealthChecks();
    const { ready, failedChecks } = checkCriticalDependencies(
      checks,
      healthConfig.criticalChecks
    );
    
    const checksStatus: Record<string, boolean> = {};
    for (const [name, result] of Object.entries(checks)) {
      checksStatus[name] = result.status !== 'unhealthy';
    }
    
    const response: ReadinessResponse = {
      ready,
      timestamp: new Date().toISOString(),
      reason: ready ? undefined : `Failed checks: ${failedChecks.join(', ')}`,
      checks: checksStatus,
    };
    
    const statusCode = ready ? 200 : 503;
    
    if (!ready && !healthConfig.skipLogging) {
      logger.error('Readiness check failed', undefined, {
        failedChecks,
      });
    }
    
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Readiness check error', error);
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      reason: 'Readiness check failed',
      checks: {},
    });
  }
}

/**
 * Detailed status handler.
 */
async function statusHandler(_req: Request, res: Response): Promise<void> {
  const logger = getLogger({ component: 'health' });
  
  try {
    const checks = await runAllHealthChecks();
    const summary = calculateSummary(checks);
    const overallStatus = determineOverallStatus(Object.values(checks));
    
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const response: StatusResponse = {
      service: healthConfig.serviceName,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: healthConfig.version,
      environment: healthConfig.environment,
      uptime: process.uptime(),
      checks,
      summary,
      features: healthConfig.getFeatures(),
      resources: {
        memory: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
          externalMB: Math.round(memUsage.external / 1024 / 1024),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
      },
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Status check failed', error);
    res.status(500).json({
      error: 'Status check failed',
      timestamp: new Date().toISOString(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTER FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create health check router.
 */
export function createHealthRouter(config?: HealthEndpointConfig): Router {
  if (config) {
    configureHealthEndpoints(config);
  }
  
  const router = Router();
  
  // Full health check
  router.get('/health', healthHandler);
  
  // Liveness probe (Kubernetes)
  router.get('/health/live', livenessHandler);
  router.get('/live', livenessHandler);
  
  // Readiness probe (Kubernetes)
  router.get('/health/ready', readinessHandler);
  router.get('/ready', readinessHandler);
  
  // Detailed status
  router.get('/status', statusHandler);
  
  return router;
}

/**
 * Create standalone health check handlers (for custom routing).
 */
export const healthHandlers = {
  health: healthHandler,
  liveness: livenessHandler,
  readiness: readinessHandler,
  status: statusHandler,
};

// ─────────────────────────────────────────────────────────────────────────────────
// PROGRAMMATIC HEALTH CHECKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Run health check programmatically.
 */
export async function checkHealth(): Promise<HealthCheckResponse> {
  const checks = await runAllHealthChecks();
  const summary = calculateSummary(checks);
  const overallStatus = determineOverallStatus(Object.values(checks));
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: healthConfig.version,
    uptime: process.uptime(),
    checks,
    summary,
  };
}

/**
 * Check if service is ready.
 */
export async function isReady(): Promise<boolean> {
  const checks = await runAllHealthChecks();
  const { ready } = checkCriticalDependencies(checks, healthConfig.criticalChecks);
  return ready;
}

/**
 * Check if service is healthy.
 */
export async function isHealthy(): Promise<boolean> {
  const checks = await runAllHealthChecks();
  const status = determineOverallStatus(Object.values(checks));
  return status === 'healthy';
}
