// ═══════════════════════════════════════════════════════════════════════════════
// API KEY MANAGER — Key Rotation and Quota Tracking
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// Manages API keys for external services with:
//   - Multiple keys per service (rotation)
//   - Quota tracking and enforcement
//   - Usage logging and metrics
//   - Automatic key selection
//
// Supported services:
//   - YouTube Data API
//   - GitHub API
//   - (Extensible for more)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Result } from '../../../../types/result.js';
import { ok, err } from '../../../../types/result.js';
import { getLogger } from '../../../../observability/logging/index.js';
import { incCounter, setGauge } from '../../../../observability/metrics/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'api-key-manager' });

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Supported API services.
 */
export type ApiService =
  | 'youtube'
  | 'github'
  | 'stackoverflow';

/**
 * Key status.
 */
export type KeyStatus =
  | 'active'        // Key is available for use
  | 'exhausted'     // Quota exhausted for current period
  | 'rate_limited'  // Temporarily rate limited
  | 'invalid'       // Key is invalid or revoked
  | 'disabled';     // Manually disabled

/**
 * Quota reset period.
 */
export type QuotaPeriod =
  | 'hourly'
  | 'daily'
  | 'monthly';

/**
 * API key configuration.
 */
export interface ApiKeyConfig {
  /** Unique key identifier */
  readonly id: string;
  
  /** The actual API key value */
  readonly key: string;
  
  /** Service this key is for */
  readonly service: ApiService;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Current status */
  status: KeyStatus;
  
  /** Quota configuration */
  readonly quota: {
    /** Maximum requests per period */
    readonly limit: number;
    /** Reset period */
    readonly period: QuotaPeriod;
    /** Cost per request (some APIs have variable costs) */
    readonly costPerRequest?: number;
  };
  
  /** Usage tracking */
  usage: {
    /** Requests in current period */
    currentPeriodUsage: number;
    /** When current period started */
    periodStartedAt: Date;
    /** Total lifetime usage */
    totalUsage: number;
    /** Last used timestamp */
    lastUsedAt?: Date;
  };
  
  /** Rate limit tracking */
  rateLimit: {
    /** When rate limit expires */
    expiresAt?: Date;
    /** Retry-After header value */
    retryAfterSeconds?: number;
  };
  
  /** Priority for selection (lower = preferred) */
  readonly priority: number;
  
  /** Metadata */
  readonly metadata: {
    readonly createdAt: Date;
    readonly description?: string;
    readonly tags?: readonly string[];
  };
}

/**
 * Key selection result.
 */
export interface KeySelection {
  readonly keyId: string;
  readonly key: string;
  readonly service: ApiService;
  readonly remainingQuota: number;
  readonly quotaPercentUsed: number;
}

/**
 * API key manager error codes.
 */
export type ApiKeyErrorCode =
  | 'NO_KEYS_AVAILABLE'
  | 'SERVICE_NOT_CONFIGURED'
  | 'ALL_KEYS_EXHAUSTED'
  | 'KEY_NOT_FOUND'
  | 'KEY_INVALID'
  | 'RATE_LIMITED';

/**
 * API key manager error.
 */
export interface ApiKeyError {
  readonly code: ApiKeyErrorCode;
  readonly message: string;
  readonly service?: ApiService;
  readonly keyId?: string;
  readonly retryAfterSeconds?: number;
}

/**
 * Usage report for a key.
 */
export interface KeyUsageReport {
  readonly keyId: string;
  readonly service: ApiService;
  readonly name: string;
  readonly status: KeyStatus;
  readonly quotaLimit: number;
  readonly quotaPeriod: QuotaPeriod;
  readonly currentUsage: number;
  readonly remainingQuota: number;
  readonly percentUsed: number;
  readonly periodResetsAt: Date;
  readonly totalLifetimeUsage: number;
}

/**
 * Service usage summary.
 */
export interface ServiceUsageSummary {
  readonly service: ApiService;
  readonly totalKeys: number;
  readonly activeKeys: number;
  readonly exhaustedKeys: number;
  readonly totalQuota: number;
  readonly totalUsed: number;
  readonly totalRemaining: number;
  readonly percentUsed: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Environment variable prefixes for API keys.
 */
const ENV_PREFIXES: Record<ApiService, string> = {
  youtube: 'YOUTUBE_API_KEY',
  github: 'GITHUB_TOKEN',
  stackoverflow: 'STACKOVERFLOW_KEY',
};

/**
 * Default quotas per service.
 */
const DEFAULT_QUOTAS: Record<ApiService, { limit: number; period: QuotaPeriod }> = {
  youtube: { limit: 10000, period: 'daily' },      // YouTube: 10,000 units/day
  github: { limit: 5000, period: 'hourly' },       // GitHub: 5,000 requests/hour
  stackoverflow: { limit: 10000, period: 'daily' }, // Stack Exchange: 10,000/day
};

/**
 * Quota exhaustion threshold (percentage).
 * Below this, we try to rotate to another key.
 */
const ROTATION_THRESHOLD = 0.1; // 10% remaining

// ─────────────────────────────────────────────────────────────────────────────────
// QUOTA PERIOD HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get the start of the current quota period.
 */
function getPeriodStart(period: QuotaPeriod): Date {
  const now = new Date();
  
  switch (period) {
    case 'hourly':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
}

/**
 * Get the end of the current quota period.
 */
function getPeriodEnd(period: QuotaPeriod): Date {
  const start = getPeriodStart(period);
  
  switch (period) {
    case 'hourly':
      return new Date(start.getTime() + 60 * 60 * 1000);
    case 'daily':
      return new Date(start.getTime() + 24 * 60 * 60 * 1000);
    case 'monthly': {
      const nextMonth = new Date(start);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    }
  }
}

/**
 * Check if a period has reset since the given timestamp.
 */
function hasPeriodReset(period: QuotaPeriod, since: Date): boolean {
  const currentPeriodStart = getPeriodStart(period);
  return since < currentPeriodStart;
}

// ─────────────────────────────────────────────────────────────────────────────────
// API KEY MANAGER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Manages API keys with rotation and quota tracking.
 */
export class ApiKeyManager {
  private readonly keys: Map<string, ApiKeyConfig>;
  private readonly serviceIndex: Map<ApiService, string[]>;
  
  constructor() {
    this.keys = new Map();
    this.serviceIndex = new Map();
  }
  
  /**
   * Initialize from environment variables.
   */
  async initializeFromEnv(): Promise<void> {
    for (const [service, prefix] of Object.entries(ENV_PREFIXES)) {
      // Check for single key
      const singleKey = process.env[prefix];
      if (singleKey) {
        this.addKey({
          service: service as ApiService,
          key: singleKey,
          name: `${service}-primary`,
        });
      }
      
      // Check for numbered keys (KEY_1, KEY_2, etc.)
      for (let i = 1; i <= 10; i++) {
        const numberedKey = process.env[`${prefix}_${i}`];
        if (numberedKey) {
          this.addKey({
            service: service as ApiService,
            key: numberedKey,
            name: `${service}-${i}`,
            priority: i,
          });
        }
      }
    }
    
    logger.info('API key manager initialized', {
      services: Array.from(this.serviceIndex.keys()),
      totalKeys: this.keys.size,
    });
  }
  
  /**
   * Add a key to the manager.
   */
  addKey(config: {
    service: ApiService;
    key: string;
    name: string;
    priority?: number;
    quota?: { limit: number; period: QuotaPeriod };
    description?: string;
    tags?: string[];
  }): string {
    const id = `${config.service}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const defaultQuota = DEFAULT_QUOTAS[config.service];
    const now = new Date();
    
    const keyConfig: ApiKeyConfig = {
      id,
      key: config.key,
      service: config.service,
      name: config.name,
      status: 'active',
      quota: {
        limit: config.quota?.limit ?? defaultQuota.limit,
        period: config.quota?.period ?? defaultQuota.period,
      },
      usage: {
        currentPeriodUsage: 0,
        periodStartedAt: getPeriodStart(config.quota?.period ?? defaultQuota.period),
        totalUsage: 0,
      },
      rateLimit: {},
      priority: config.priority ?? 0,
      metadata: {
        createdAt: now,
        description: config.description,
        tags: config.tags,
      },
    };
    
    this.keys.set(id, keyConfig);
    
    // Update service index
    const serviceKeys = this.serviceIndex.get(config.service) ?? [];
    serviceKeys.push(id);
    this.serviceIndex.set(config.service, serviceKeys);
    
    logger.debug('Added API key', {
      keyId: id,
      service: config.service,
      name: config.name,
    });
    
    return id;
  }
  
  /**
   * Get an available key for a service.
   */
  getKey(service: ApiService): Result<KeySelection, ApiKeyError> {
    const keyIds = this.serviceIndex.get(service);
    
    if (!keyIds || keyIds.length === 0) {
      return err({
        code: 'SERVICE_NOT_CONFIGURED',
        message: `No API keys configured for service: ${service}`,
        service,
      });
    }
    
    // Get all keys for this service
    const keys = keyIds
      .map(id => this.keys.get(id))
      .filter((k): k is ApiKeyConfig => k !== undefined);
    
    // Reset quotas if periods have changed
    for (const key of keys) {
      this.maybeResetQuota(key);
    }
    
    // Clear expired rate limits
    const now = new Date();
    for (const key of keys) {
      if (key.status === 'rate_limited' && key.rateLimit.expiresAt && key.rateLimit.expiresAt <= now) {
        key.status = 'active';
        key.rateLimit = {};
      }
    }
    
    // Find available keys (active and not exhausted)
    const availableKeys = keys
      .filter(k => k.status === 'active')
      .filter(k => this.getRemainingQuota(k) > 0)
      .sort((a, b) => {
        // Sort by priority first, then by remaining quota
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return this.getRemainingQuota(b) - this.getRemainingQuota(a);
      });
    
    if (availableKeys.length === 0) {
      // Check if all keys are exhausted vs rate limited
      const exhausted = keys.filter(k => k.status === 'exhausted' || this.getRemainingQuota(k) <= 0);
      const rateLimited = keys.filter(k => k.status === 'rate_limited');
      
      if (rateLimited.length > 0) {
        const soonestRetry = rateLimited
          .map(k => k.rateLimit.expiresAt)
          .filter((d): d is Date => d !== undefined)
          .sort((a, b) => a.getTime() - b.getTime())[0];
        
        return err({
          code: 'RATE_LIMITED',
          message: `All keys for ${service} are rate limited`,
          service,
          retryAfterSeconds: soonestRetry 
            ? Math.ceil((soonestRetry.getTime() - now.getTime()) / 1000)
            : 60,
        });
      }
      
      return err({
        code: 'ALL_KEYS_EXHAUSTED',
        message: `All API keys for ${service} have exhausted their quota`,
        service,
      });
    }
    
    const selected = availableKeys[0]!;
    const remainingQuota = this.getRemainingQuota(selected);
    
    return ok({
      keyId: selected.id,
      key: selected.key,
      service: selected.service,
      remainingQuota,
      quotaPercentUsed: (selected.usage.currentPeriodUsage / selected.quota.limit) * 100,
    });
  }
  
  /**
   * Record usage of a key.
   */
  recordUsage(keyId: string, cost: number = 1): void {
    const key = this.keys.get(keyId);
    if (!key) {
      logger.warn('Attempted to record usage for unknown key', { keyId });
      return;
    }
    
    // Maybe reset quota first
    this.maybeResetQuota(key);
    
    // Update usage
    key.usage.currentPeriodUsage += cost;
    key.usage.totalUsage += cost;
    key.usage.lastUsedAt = new Date();
    
    // Check if quota exhausted
    if (key.usage.currentPeriodUsage >= key.quota.limit) {
      key.status = 'exhausted';
      logger.warn('API key quota exhausted', {
        keyId,
        service: key.service,
        usage: key.usage.currentPeriodUsage,
        limit: key.quota.limit,
      });
    }
    
    // Record metrics
    incCounter('api_key_usage_total', {
      service: key.service,
      key_id: keyId,
    });
    
    setGauge('api_key_quota_remaining', this.getRemainingQuota(key), {
      service: key.service,
      key_id: keyId,
    });
    
    logger.debug('Recorded API key usage', {
      keyId,
      cost,
      currentUsage: key.usage.currentPeriodUsage,
      remaining: this.getRemainingQuota(key),
    });
  }
  
  /**
   * Mark a key as rate limited.
   */
  markRateLimited(keyId: string, retryAfterSeconds?: number): void {
    const key = this.keys.get(keyId);
    if (!key) return;
    
    key.status = 'rate_limited';
    key.rateLimit = {
      expiresAt: new Date(Date.now() + (retryAfterSeconds ?? 60) * 1000),
      retryAfterSeconds,
    };
    
    incCounter('api_key_rate_limits_total', {
      service: key.service,
      key_id: keyId,
    });
    
    logger.warn('API key rate limited', {
      keyId,
      service: key.service,
      retryAfterSeconds,
    });
  }
  
  /**
   * Mark a key as invalid.
   */
  markInvalid(keyId: string, reason?: string): void {
    const key = this.keys.get(keyId);
    if (!key) return;
    
    key.status = 'invalid';
    
    logger.error('API key marked invalid', {
      keyId,
      service: key.service,
      reason,
    });
  }
  
  /**
   * Get remaining quota for a key.
   */
  private getRemainingQuota(key: ApiKeyConfig): number {
    return Math.max(0, key.quota.limit - key.usage.currentPeriodUsage);
  }
  
  /**
   * Reset quota if period has changed.
   */
  private maybeResetQuota(key: ApiKeyConfig): void {
    if (hasPeriodReset(key.quota.period, key.usage.periodStartedAt)) {
      key.usage.currentPeriodUsage = 0;
      key.usage.periodStartedAt = getPeriodStart(key.quota.period);
      
      // Reactivate exhausted keys
      if (key.status === 'exhausted') {
        key.status = 'active';
      }
      
      logger.debug('Reset API key quota', {
        keyId: key.id,
        service: key.service,
      });
    }
  }
  
  /**
   * Get usage report for a key.
   */
  getKeyUsage(keyId: string): KeyUsageReport | null {
    const key = this.keys.get(keyId);
    if (!key) return null;
    
    this.maybeResetQuota(key);
    
    const remaining = this.getRemainingQuota(key);
    
    return {
      keyId: key.id,
      service: key.service,
      name: key.name,
      status: key.status,
      quotaLimit: key.quota.limit,
      quotaPeriod: key.quota.period,
      currentUsage: key.usage.currentPeriodUsage,
      remainingQuota: remaining,
      percentUsed: (key.usage.currentPeriodUsage / key.quota.limit) * 100,
      periodResetsAt: getPeriodEnd(key.quota.period),
      totalLifetimeUsage: key.usage.totalUsage,
    };
  }
  
  /**
   * Get usage summary for a service.
   */
  getServiceUsage(service: ApiService): ServiceUsageSummary | null {
    const keyIds = this.serviceIndex.get(service);
    if (!keyIds || keyIds.length === 0) return null;
    
    let totalQuota = 0;
    let totalUsed = 0;
    let activeKeys = 0;
    let exhaustedKeys = 0;
    
    for (const keyId of keyIds) {
      const key = this.keys.get(keyId);
      if (!key) continue;
      
      this.maybeResetQuota(key);
      
      totalQuota += key.quota.limit;
      totalUsed += key.usage.currentPeriodUsage;
      
      if (key.status === 'active') activeKeys++;
      if (key.status === 'exhausted') exhaustedKeys++;
    }
    
    return {
      service,
      totalKeys: keyIds.length,
      activeKeys,
      exhaustedKeys,
      totalQuota,
      totalUsed,
      totalRemaining: totalQuota - totalUsed,
      percentUsed: totalQuota > 0 ? (totalUsed / totalQuota) * 100 : 0,
    };
  }
  
  /**
   * Get all usage reports.
   */
  getAllUsage(): {
    keys: KeyUsageReport[];
    services: ServiceUsageSummary[];
  } {
    const keys: KeyUsageReport[] = [];
    const services: ServiceUsageSummary[] = [];
    
    for (const keyId of this.keys.keys()) {
      const report = this.getKeyUsage(keyId);
      if (report) keys.push(report);
    }
    
    for (const service of this.serviceIndex.keys()) {
      const summary = this.getServiceUsage(service);
      if (summary) services.push(summary);
    }
    
    return { keys, services };
  }
  
  /**
   * Check if a service has available quota.
   */
  hasAvailableQuota(service: ApiService): boolean {
    return this.getKey(service).ok;
  }
  
  /**
   * Get the number of configured keys.
   */
  get keyCount(): number {
    return this.keys.size;
  }
  
  /**
   * Get configured services.
   */
  get configuredServices(): ApiService[] {
    return Array.from(this.serviceIndex.keys());
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let managerInstance: ApiKeyManager | null = null;

/**
 * Get the API key manager singleton.
 */
export function getApiKeyManager(): ApiKeyManager {
  if (!managerInstance) {
    managerInstance = new ApiKeyManager();
  }
  return managerInstance;
}

/**
 * Initialize the API key manager from environment.
 */
export async function initApiKeyManager(): Promise<ApiKeyManager> {
  const manager = getApiKeyManager();
  await manager.initializeFromEnv();
  return manager;
}

/**
 * Reset the API key manager (for testing).
 */
export function resetApiKeyManager(): void {
  managerInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get an API key for a service.
 */
export function getApiKey(service: ApiService): Result<KeySelection, ApiKeyError> {
  return getApiKeyManager().getKey(service);
}

/**
 * Record API key usage.
 */
export function recordApiKeyUsage(keyId: string, cost?: number): void {
  getApiKeyManager().recordUsage(keyId, cost);
}

/**
 * Mark an API key as rate limited.
 */
export function markApiKeyRateLimited(keyId: string, retryAfterSeconds?: number): void {
  getApiKeyManager().markRateLimited(keyId, retryAfterSeconds);
}
