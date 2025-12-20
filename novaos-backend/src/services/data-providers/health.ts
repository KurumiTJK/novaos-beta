// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH — Health Check Endpoint for Data Providers
// Aggregates health status across all providers and infrastructure
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory } from '../../types/index.js';

import {
  getProviderRegistry,
  type CategoryStatus,
} from './registry.js';

import {
  type ProviderHealth,
} from './providers/index.js';

import {
  FRESHNESS_POLICIES,
  type FreshnessPolicy,
} from './freshness.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Overall health status level.
 */
export type HealthLevel = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual provider health report.
 */
export interface ProviderHealthReport {
  /** Provider name */
  readonly name: string;
  /** Categories this provider serves */
  readonly categories: readonly string[];
  /** Whether provider is available (has required config) */
  readonly available: boolean;
  /** Circuit breaker state */
  readonly circuitState: 'closed' | 'open' | 'half-open';
  /** Number of consecutive failures */
  readonly consecutiveFailures: number;
  /** Remaining rate limit requests */
  readonly rateLimitRemaining: number;
  /** Rate limit window reset time */
  readonly rateLimitResetMs: number;
  /** Last successful fetch timestamp (ISO string) */
  readonly lastSuccessAt: string | null;
  /** Last error message (if any) */
  readonly lastError: string | null;
}

/**
 * Category health report.
 */
export interface CategoryHealthReport {
  /** The category */
  readonly category: LiveCategory;
  /** Whether category has available providers */
  readonly available: boolean;
  /** Primary provider name */
  readonly primaryProvider: string | null;
  /** Number of registered providers */
  readonly registeredCount: number;
  /** Number of available providers */
  readonly availableCount: number;
  /** Freshness policy for this category */
  readonly freshnessPolicy: FreshnessPolicy;
  /** Provider health reports for this category */
  readonly providers: readonly ProviderHealthReport[];
}

/**
 * Overall system health report.
 */
export interface SystemHealthReport {
  /** Overall health level */
  readonly status: HealthLevel;
  /** Timestamp of this report */
  readonly timestamp: string;
  /** Uptime information */
  readonly uptime: {
    readonly startedAt: string;
    readonly uptimeMs: number;
    readonly uptimeFormatted: string;
  };
  /** Summary statistics */
  readonly summary: {
    readonly totalProviders: number;
    readonly availableProviders: number;
    readonly healthyProviders: number;
    readonly degradedProviders: number;
    readonly unhealthyProviders: number;
    readonly totalCategories: number;
    readonly availableCategories: number;
  };
  /** Per-category health */
  readonly categories: readonly CategoryHealthReport[];
  /** Per-provider health */
  readonly providers: readonly ProviderHealthReport[];
  /** Any issues detected */
  readonly issues: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// UPTIME TRACKING
// ─────────────────────────────────────────────────────────────────────────────────

const SERVICE_START_TIME = Date.now();

/**
 * Get service uptime information.
 */
function getUptime(): { startedAt: string; uptimeMs: number; uptimeFormatted: string } {
  const uptimeMs = Date.now() - SERVICE_START_TIME;
  
  // Format uptime
  const seconds = Math.floor(uptimeMs / 1000) % 60;
  const minutes = Math.floor(uptimeMs / 60000) % 60;
  const hours = Math.floor(uptimeMs / 3600000) % 24;
  const days = Math.floor(uptimeMs / 86400000);
  
  let formatted = '';
  if (days > 0) formatted += `${days}d `;
  if (hours > 0 || days > 0) formatted += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m `;
  formatted += `${seconds}s`;
  
  return {
    startedAt: new Date(SERVICE_START_TIME).toISOString(),
    uptimeMs,
    uptimeFormatted: formatted.trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Convert ProviderHealth to ProviderHealthReport.
 */
function toProviderHealthReport(
  health: ProviderHealth,
  categories: readonly string[]
): ProviderHealthReport {
  return {
    name: health.name,
    categories,
    available: health.available,
    circuitState: health.circuitState,
    consecutiveFailures: health.consecutiveFailures,
    rateLimitRemaining: health.rateLimitRemaining,
    rateLimitResetMs: health.rateLimitResetMs,
    lastSuccessAt: health.lastSuccessAt 
      ? new Date(health.lastSuccessAt).toISOString() 
      : null,
    lastError: health.lastError,
  };
}

/**
 * Determine health level for a provider.
 */
function getProviderHealthLevel(report: ProviderHealthReport): HealthLevel {
  // Unavailable = unhealthy
  if (!report.available) {
    return 'unhealthy';
  }
  
  // Open circuit = unhealthy
  if (report.circuitState === 'open') {
    return 'unhealthy';
  }
  
  // Half-open circuit = degraded
  if (report.circuitState === 'half-open') {
    return 'degraded';
  }
  
  // Multiple consecutive failures = degraded
  if (report.consecutiveFailures >= 3) {
    return 'degraded';
  }
  
  // Any consecutive failures but less than threshold = still healthy
  // but worth noting
  
  return 'healthy';
}

/**
 * Get health report for a specific category.
 */
export async function getCategoryHealth(category: LiveCategory): Promise<CategoryHealthReport> {
  const registry = getProviderRegistry();
  const status = registry.getCategoryStatus(category);
  const providers = registry.getProvidersForCategory(category);
  const freshnessPolicy = FRESHNESS_POLICIES[category];
  
  // Get health for each provider
  const providerReports: ProviderHealthReport[] = [];
  
  for (const provider of providers) {
    const health = await provider.getHealthStatus();
    providerReports.push(toProviderHealthReport(health, provider.categories));
  }
  
  return {
    category,
    available: status.hasAvailableProvider,
    primaryProvider: status.primaryProvider,
    registeredCount: status.registeredProviders.length,
    availableCount: status.availableProviders.length,
    freshnessPolicy,
    providers: providerReports,
  };
}

/**
 * Get full system health report.
 */
export async function getSystemHealth(): Promise<SystemHealthReport> {
  const registry = getProviderRegistry();
  const allProviders = registry.getAllProviders();
  const categories: LiveCategory[] = ['time', 'weather', 'market', 'crypto', 'fx'];
  
  // Get all provider health statuses
  const healthMap = await registry.getAllHealthStatuses();
  
  // Build provider reports
  const providerReports: ProviderHealthReport[] = [];
  const providerCategories = new Map<string, string[]>();
  
  // Map providers to their categories
  for (const category of categories) {
    const providers = registry.getProvidersForCategory(category);
    for (const provider of providers) {
      const cats = providerCategories.get(provider.name) ?? [];
      if (!cats.includes(category)) {
        cats.push(category);
      }
      providerCategories.set(provider.name, cats);
    }
  }
  
  // Build reports
  for (const provider of allProviders) {
    const health = healthMap.get(provider.name);
    if (health) {
      const cats = providerCategories.get(provider.name) ?? [];
      providerReports.push(toProviderHealthReport(health, cats));
    }
  }
  
  // Build category reports
  const categoryReports: CategoryHealthReport[] = [];
  for (const category of categories) {
    const report = await getCategoryHealth(category);
    categoryReports.push(report);
  }
  
  // Calculate summary
  let healthyCount = 0;
  let degradedCount = 0;
  let unhealthyCount = 0;
  
  for (const report of providerReports) {
    const level = getProviderHealthLevel(report);
    if (level === 'healthy') healthyCount++;
    else if (level === 'degraded') degradedCount++;
    else unhealthyCount++;
  }
  
  const availableCategories = categoryReports.filter(c => c.available).length;
  const availableProviders = providerReports.filter(p => p.available).length;
  
  // Detect issues
  const issues: string[] = [];
  
  // Check for unavailable categories
  for (const cat of categoryReports) {
    if (!cat.available) {
      issues.push(`Category '${cat.category}' has no available providers`);
    }
  }
  
  // Check for unhealthy providers
  for (const provider of providerReports) {
    if (provider.circuitState === 'open') {
      issues.push(`Provider '${provider.name}' circuit breaker is open`);
    }
    if (provider.available && provider.consecutiveFailures >= 3) {
      issues.push(`Provider '${provider.name}' has ${provider.consecutiveFailures} consecutive failures`);
    }
  }
  
  // Determine overall status
  let status: HealthLevel = 'healthy';
  
  if (unhealthyCount > 0 || availableCategories < categories.length) {
    status = 'degraded';
  }
  
  // Critical: if core categories are unavailable
  const coreCategories: LiveCategory[] = ['time', 'fx'];
  const coreMissing = coreCategories.filter(c => !categoryReports.find(r => r.category === c)?.available);
  if (coreMissing.length > 0) {
    status = 'unhealthy';
    issues.push(`Core category missing: ${coreMissing.join(', ')}`);
  }
  
  // If all providers unhealthy
  if (availableProviders === 0) {
    status = 'unhealthy';
  }
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    summary: {
      totalProviders: providerReports.length,
      availableProviders,
      healthyProviders: healthyCount,
      degradedProviders: degradedCount,
      unhealthyProviders: unhealthyCount,
      totalCategories: categories.length,
      availableCategories,
    },
    categories: categoryReports,
    providers: providerReports,
    issues,
  };
}

/**
 * Quick health check (minimal overhead).
 * 
 * Returns just the overall status without detailed reports.
 */
export function getQuickHealth(): { status: HealthLevel; availableCategories: number; totalCategories: number } {
  const registry = getProviderRegistry();
  const categories: LiveCategory[] = ['time', 'weather', 'market', 'crypto', 'fx'];
  
  let availableCount = 0;
  for (const category of categories) {
    if (registry.hasAvailableProvider(category)) {
      availableCount++;
    }
  }
  
  let status: HealthLevel = 'healthy';
  
  if (availableCount < categories.length) {
    status = 'degraded';
  }
  
  // Check core categories
  if (!registry.hasAvailableProvider('time')) {
    status = 'unhealthy';
  }
  
  return {
    status,
    availableCategories: availableCount,
    totalCategories: categories.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HTTP HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Health check HTTP response.
 */
export interface HealthHttpResponse {
  readonly statusCode: number;
  readonly body: SystemHealthReport | { status: HealthLevel; error: string };
}

/**
 * Handle health check HTTP request.
 * 
 * @param detailed - Whether to include detailed reports (default: true)
 * @returns HTTP-style response with status code and body
 */
export async function handleHealthRequest(detailed: boolean = true): Promise<HealthHttpResponse> {
  try {
    if (detailed) {
      const report = await getSystemHealth();
      const statusCode = report.status === 'healthy' ? 200 
        : report.status === 'degraded' ? 200 
        : 503;
      
      return { statusCode, body: report };
    } else {
      const quick = getQuickHealth();
      const statusCode = quick.status === 'unhealthy' ? 503 : 200;
      
      return {
        statusCode,
        body: {
          status: quick.status,
          timestamp: new Date().toISOString(),
          uptime: getUptime(),
          summary: {
            totalProviders: 0,
            availableProviders: 0,
            healthyProviders: 0,
            degradedProviders: 0,
            unhealthyProviders: 0,
            totalCategories: quick.totalCategories,
            availableCategories: quick.availableCategories,
          },
          categories: [],
          providers: [],
          issues: [],
        } as SystemHealthReport,
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// READINESS & LIVENESS PROBES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Kubernetes-style readiness probe.
 * 
 * Returns true if the service is ready to accept traffic.
 * Requires at least one provider to be available.
 */
export function isReady(): boolean {
  const quick = getQuickHealth();
  return quick.availableCategories > 0;
}

/**
 * Kubernetes-style liveness probe.
 * 
 * Returns true if the service is alive and should not be restarted.
 * Always true unless service is in unrecoverable state.
 */
export function isAlive(): boolean {
  // The service is alive if it can execute this function
  // In the future, could check for deadlocks, memory leaks, etc.
  return true;
}

/**
 * Handle readiness probe HTTP request.
 */
export function handleReadinessRequest(): { statusCode: number; body: { ready: boolean } } {
  const ready = isReady();
  return {
    statusCode: ready ? 200 : 503,
    body: { ready },
  };
}

/**
 * Handle liveness probe HTTP request.
 */
export function handleLivenessRequest(): { statusCode: number; body: { alive: boolean } } {
  const alive = isAlive();
  return {
    statusCode: alive ? 200 : 503,
    body: { alive },
  };
}
