// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK TYPES — Health Status Definitions
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// STATUS TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Health status for individual components.
 */
export type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Overall system health status.
 */
export type SystemStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Readiness status.
 */
export type ReadinessStatus = 'ready' | 'not_ready';

/**
 * Liveness status.
 */
export type LivenessStatus = 'alive' | 'dead';

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT HEALTH
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Health check result for a single component.
 */
export interface ComponentHealth {
  /** Component name */
  readonly name: string;
  
  /** Current status */
  readonly status: ComponentStatus;
  
  /** Response latency in milliseconds */
  readonly latencyMs?: number;
  
  /** Human-readable message */
  readonly message?: string;
  
  /** Additional details */
  readonly details?: Readonly<Record<string, unknown>>;
  
  /** Timestamp of check */
  readonly checkedAt: string;
  
  /** Error if unhealthy */
  readonly error?: string;
}

/**
 * Component health with metadata.
 */
export interface ComponentHealthResult extends ComponentHealth {
  /** Whether this component is critical for readiness */
  readonly critical: boolean;
  
  /** Last successful check timestamp */
  readonly lastSuccess?: string;
  
  /** Consecutive failure count */
  readonly failureCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK RESPONSES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Full health check response.
 */
export interface HealthCheckResponse {
  /** Overall status */
  readonly status: SystemStatus;
  
  /** ISO timestamp */
  readonly timestamp: string;
  
  /** Application version */
  readonly version: string;
  
  /** Uptime in seconds */
  readonly uptime: number;
  
  /** Individual component health */
  readonly checks: Readonly<Record<string, ComponentHealth>>;
  
  /** Summary counts */
  readonly summary: {
    readonly total: number;
    readonly healthy: number;
    readonly degraded: number;
    readonly unhealthy: number;
  };
}

/**
 * Readiness check response.
 */
export interface ReadinessResponse {
  /** Ready status */
  readonly ready: boolean;
  
  /** ISO timestamp */
  readonly timestamp: string;
  
  /** Reason if not ready */
  readonly reason?: string;
  
  /** Individual checks */
  readonly checks: Readonly<Record<string, boolean>>;
}

/**
 * Liveness check response.
 */
export interface LivenessResponse {
  /** Alive status */
  readonly alive: boolean;
  
  /** ISO timestamp */
  readonly timestamp: string;
  
  /** Uptime in seconds */
  readonly uptime: number;
}

/**
 * Detailed status response.
 */
export interface StatusResponse extends HealthCheckResponse {
  /** Service name */
  readonly service: string;
  
  /** Environment */
  readonly environment: string;
  
  /** Feature flags */
  readonly features: Readonly<Record<string, boolean>>;
  
  /** Resource usage */
  readonly resources: {
    readonly memory: {
      readonly heapUsedMB: number;
      readonly heapTotalMB: number;
      readonly rssMB: number;
      readonly externalMB: number;
    };
    readonly cpu?: {
      readonly user: number;
      readonly system: number;
    };
  };
  
  /** Process info */
  readonly process: {
    readonly pid: number;
    readonly nodeVersion: string;
    readonly platform: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Health check function type.
 */
export type HealthCheckFn = () => Promise<ComponentHealth>;

/**
 * Health check registration.
 */
export interface HealthCheckRegistration {
  /** Unique name for this check */
  readonly name: string;
  
  /** Health check function */
  readonly check: HealthCheckFn;
  
  /** Whether this check is critical for readiness */
  readonly critical: boolean;
  
  /** Timeout for this check in milliseconds */
  readonly timeoutMs: number;
  
  /** Cache TTL in milliseconds (0 = no cache) */
  readonly cacheTtlMs: number;
  
  /** Description of what this check verifies */
  readonly description?: string;
}

/**
 * Health check options.
 */
export interface HealthCheckOptions {
  /** Timeout for all checks */
  readonly timeoutMs?: number;
  
  /** Run checks in parallel */
  readonly parallel?: boolean;
  
  /** Include non-critical checks */
  readonly includeNonCritical?: boolean;
  
  /** Force refresh (ignore cache) */
  readonly forceRefresh?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEPENDENCY HEALTH
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * External dependency types.
 */
export type DependencyType = 
  | 'database'
  | 'cache'
  | 'queue'
  | 'api'
  | 'storage'
  | 'llm'
  | 'other';

/**
 * External dependency configuration.
 */
export interface DependencyConfig {
  /** Dependency name */
  readonly name: string;
  
  /** Type of dependency */
  readonly type: DependencyType;
  
  /** Whether critical for operation */
  readonly critical: boolean;
  
  /** Health check endpoint or method */
  readonly healthCheck?: string | HealthCheckFn;
  
  /** Timeout for health check */
  readonly timeoutMs?: number;
  
  /** Expected response time threshold (ms) */
  readonly latencyThresholdMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Default thresholds for health checks.
 */
export const HEALTH_THRESHOLDS = {
  /** Redis latency threshold (ms) */
  REDIS_LATENCY_MS: 100,
  
  /** Redis latency for degraded status (ms) */
  REDIS_DEGRADED_LATENCY_MS: 500,
  
  /** LLM latency threshold (ms) */
  LLM_LATENCY_MS: 5000,
  
  /** Memory usage warning threshold (percent) */
  MEMORY_WARNING_PERCENT: 80,
  
  /** Memory usage critical threshold (percent) */
  MEMORY_CRITICAL_PERCENT: 95,
  
  /** Event loop lag warning threshold (ms) */
  EVENT_LOOP_LAG_WARNING_MS: 100,
  
  /** Event loop lag critical threshold (ms) */
  EVENT_LOOP_LAG_CRITICAL_MS: 500,
  
  /** Default check timeout (ms) */
  DEFAULT_TIMEOUT_MS: 5000,
  
  /** Default cache TTL (ms) */
  DEFAULT_CACHE_TTL_MS: 10000,
} as const;
