// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE CACHE — Multi-Tier Caching for Resources
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides efficient caching for resources at different lifecycle stages:
//   - L1: In-memory cache (fast, limited size)
//   - L2: Redis/KeyValueStore (persistent, larger)
//
// Features:
//   - TTL-based expiration per resource stage
//   - HMAC integrity verification
//   - Bulk operations
//   - Cache statistics and monitoring
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Result } from '../../../../types/result.js';
import { ok, err } from '../../../../types/result.js';
import { getLogger } from '../../../../observability/logging/index.js';
import { incCounter, setGauge, observeHistogram } from '../../../../observability/metrics/index.js';
import type {
  CanonicalURL,
  ResourceId,
  RawResourceCandidate,
  EnrichedResource,
  VerifiedResource,
  HMACSignature,
} from '../types.js';
import { RESOURCE_TTL, createResourceError } from '../types.js';
import { computeSignature, verifySignature, type IntegrityConfig } from '../known-sources/integrity.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'resource-cache' });

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Cache tier.
 */
export type CacheTier = 'l1' | 'l2';

/**
 * Resource stage (determines TTL).
 */
export type ResourceStage = 'candidate' | 'enriched' | 'verified' | 'known_source';

/**
 * Cached resource wrapper.
 */
export interface CachedResource<T> {
  /** The cached data */
  readonly data: T;
  
  /** Resource stage */
  readonly stage: ResourceStage;
  
  /** When cached */
  readonly cachedAt: Date;
  
  /** When this entry expires */
  readonly expiresAt: Date;
  
  /** HMAC signature for integrity */
  readonly signature: HMACSignature;
  
  /** Cache metadata */
  readonly metadata: {
    /** Source tier */
    readonly tier: CacheTier;
    /** Hit count */
    readonly hits: number;
    /** Last accessed */
    readonly lastAccessedAt: Date;
  };
}

/**
 * Cache entry for internal storage.
 */
interface CacheEntry<T> {
  data: T;
  stage: ResourceStage;
  cachedAt: number;
  expiresAt: number;
  signature: string;
  hits: number;
  lastAccessedAt: number;
}

/**
 * Cache configuration.
 */
export interface ResourceCacheConfig {
  /** Maximum L1 (memory) cache entries */
  readonly maxL1Entries: number;
  
  /** L1 TTL override in milliseconds (optional) */
  readonly l1TtlMs?: number;
  
  /** Enable L2 (Redis) cache */
  readonly enableL2: boolean;
  
  /** Redis key prefix */
  readonly keyPrefix: string;
  
  /** Enable integrity verification */
  readonly verifyIntegrity: boolean;
  
  /** Integrity config for HMAC */
  readonly integrityConfig?: IntegrityConfig;
  
  /** Enable cache statistics */
  readonly enableStats: boolean;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: ResourceCacheConfig = {
  maxL1Entries: 1000,
  enableL2: false, // Requires Redis connection
  keyPrefix: 'nova:resource:',
  verifyIntegrity: true,
  enableStats: true,
};

/**
 * Cache error codes.
 */
export type CacheErrorCode =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'INTEGRITY_FAILED'
  | 'SERIALIZATION_ERROR'
  | 'STORAGE_ERROR';

/**
 * Cache error.
 */
export interface CacheError {
  readonly code: CacheErrorCode;
  readonly message: string;
  readonly key?: string;
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  readonly l1: {
    readonly entries: number;
    readonly hits: number;
    readonly misses: number;
    readonly hitRate: number;
    readonly evictions: number;
  };
  readonly l2: {
    readonly hits: number;
    readonly misses: number;
    readonly hitRate: number;
  };
  readonly total: {
    readonly hits: number;
    readonly misses: number;
    readonly hitRate: number;
  };
  readonly byStage: Record<ResourceStage, number>;
}

/**
 * Cache get result.
 */
export interface CacheGetResult<T> {
  readonly data: T;
  readonly tier: CacheTier;
  readonly age: number; // milliseconds
}

// ─────────────────────────────────────────────────────────────────────────────────
// TTL HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get TTL in milliseconds for a resource stage.
 */
function getTtlMs(stage: ResourceStage): number {
  switch (stage) {
    case 'candidate':
      return RESOURCE_TTL.CANDIDATE_MS;
    case 'enriched':
      return RESOURCE_TTL.ENRICHMENT_MS;
    case 'verified':
      return RESOURCE_TTL.VERIFICATION_MS;
    case 'known_source':
      return RESOURCE_TTL.KNOWN_SOURCE_MS;
  }
}

/**
 * Check if a cache entry is expired.
 */
function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() > entry.expiresAt;
}

// ─────────────────────────────────────────────────────────────────────────────────
// L1 MEMORY CACHE (LRU)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Simple LRU cache implementation for L1.
 */
class LRUCache<T> {
  private readonly cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private evictions: number = 0;
  
  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry;
  }
  
  set(key: string, entry: CacheEntry<T>): void {
    // Delete if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict oldest if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) {
        this.cache.delete(oldest);
        this.evictions++;
      }
    }
    
    this.cache.set(key, entry);
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  get size(): number {
    return this.cache.size;
  }
  
  get evictionCount(): number {
    return this.evictions;
  }
  
  keys(): IterableIterator<string> {
    return this.cache.keys();
  }
  
  values(): IterableIterator<CacheEntry<T>> {
    return this.cache.values();
  }
  
  entries(): IterableIterator<[string, CacheEntry<T>]> {
    return this.cache.entries();
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE CACHE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Multi-tier resource cache.
 */
export class ResourceCache {
  private readonly config: ResourceCacheConfig;
  private readonly l1: LRUCache<unknown>;
  private readonly integrityConfig: IntegrityConfig;
  
  // Statistics
  private l1Hits: number = 0;
  private l1Misses: number = 0;
  private l2Hits: number = 0;
  private l2Misses: number = 0;
  
  constructor(config?: Partial<ResourceCacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.l1 = new LRUCache(this.config.maxL1Entries);
    this.integrityConfig = this.config.integrityConfig ?? { allowDevKey: true };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Core Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get a resource from cache.
   */
  async get<T>(key: string): Promise<Result<CacheGetResult<T>, CacheError>> {
    const startTime = Date.now();
    
    // Try L1 first
    const l1Entry = this.l1.get(key);
    if (l1Entry) {
      if (isExpired(l1Entry)) {
        this.l1.delete(key);
        this.l1Misses++;
      } else {
        // Verify integrity if enabled
        if (this.config.verifyIntegrity) {
          const valid = await this.verifyEntry(l1Entry);
          if (!valid) {
            this.l1.delete(key);
            logger.warn('Cache integrity check failed', { key, tier: 'l1' });
            incCounter('cache_integrity_failures', { tier: 'l1' });
            return err({
              code: 'INTEGRITY_FAILED',
              message: 'Cache entry failed integrity check',
              key,
            });
          }
        }
        
        // Update hit count
        l1Entry.hits++;
        l1Entry.lastAccessedAt = Date.now();
        
        this.l1Hits++;
        this.recordMetrics('hit', 'l1', Date.now() - startTime);
        
        return ok({
          data: l1Entry.data as T,
          tier: 'l1',
          age: Date.now() - l1Entry.cachedAt,
        });
      }
    } else {
      this.l1Misses++;
    }
    
    // L2 lookup would go here (Redis)
    // For now, just record miss
    this.l2Misses++;
    this.recordMetrics('miss', 'l1', Date.now() - startTime);
    
    return err({
      code: 'NOT_FOUND',
      message: 'Resource not found in cache',
      key,
    });
  }
  
  /**
   * Store a resource in cache.
   */
  async set<T>(
    key: string,
    data: T,
    stage: ResourceStage
  ): Promise<Result<void, CacheError>> {
    const now = Date.now();
    const ttlMs = this.config.l1TtlMs ?? getTtlMs(stage);
    
    // Compute signature
    let signature: string;
    if (this.config.verifyIntegrity) {
      const sigResult = computeSignature(data, this.integrityConfig);
      if (!sigResult.ok) {
        return err({
          code: 'SERIALIZATION_ERROR',
          message: `Failed to compute signature: ${sigResult.error.message}`,
          key,
        });
      }
      signature = sigResult.value;
    } else {
      signature = '';
    }
    
    const entry: CacheEntry<T> = {
      data,
      stage,
      cachedAt: now,
      expiresAt: now + ttlMs,
      signature,
      hits: 0,
      lastAccessedAt: now,
    };
    
    // Store in L1
    this.l1.set(key, entry as CacheEntry<unknown>);
    
    // L2 storage would go here (Redis)
    
    this.recordMetrics('set', 'l1', 0);
    
    logger.debug('Cached resource', {
      key,
      stage,
      ttlMs,
      tier: 'l1',
    });
    
    return ok(undefined);
  }
  
  /**
   * Delete a resource from cache.
   */
  async delete(key: string): Promise<void> {
    this.l1.delete(key);
    // L2 delete would go here
    
    logger.debug('Deleted from cache', { key });
  }
  
  /**
   * Check if a resource exists in cache.
   */
  async has(key: string): Promise<boolean> {
    const entry = this.l1.get(key);
    if (entry && !isExpired(entry)) {
      return true;
    }
    // L2 check would go here
    return false;
  }
  
  /**
   * Clear all cache entries.
   */
  async clear(): Promise<void> {
    this.l1.clear();
    // L2 clear would go here
    
    this.l1Hits = 0;
    this.l1Misses = 0;
    this.l2Hits = 0;
    this.l2Misses = 0;
    
    logger.info('Cache cleared');
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Typed Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get a candidate resource.
   */
  async getCandidate(url: CanonicalURL): Promise<Result<CacheGetResult<RawResourceCandidate>, CacheError>> {
    return this.get<RawResourceCandidate>(`candidate:${url}`);
  }
  
  /**
   * Store a candidate resource.
   */
  async setCandidate(url: CanonicalURL, candidate: RawResourceCandidate): Promise<Result<void, CacheError>> {
    return this.set(`candidate:${url}`, candidate, 'candidate');
  }
  
  /**
   * Get an enriched resource.
   */
  async getEnriched(url: CanonicalURL): Promise<Result<CacheGetResult<EnrichedResource>, CacheError>> {
    return this.get<EnrichedResource>(`enriched:${url}`);
  }
  
  /**
   * Store an enriched resource.
   */
  async setEnriched(url: CanonicalURL, enriched: EnrichedResource): Promise<Result<void, CacheError>> {
    return this.set(`enriched:${url}`, enriched, 'enriched');
  }
  
  /**
   * Get a verified resource.
   */
  async getVerified(url: CanonicalURL): Promise<Result<CacheGetResult<VerifiedResource>, CacheError>> {
    return this.get<VerifiedResource>(`verified:${url}`);
  }
  
  /**
   * Store a verified resource.
   */
  async setVerified(url: CanonicalURL, verified: VerifiedResource): Promise<Result<void, CacheError>> {
    return this.set(`verified:${url}`, verified, 'verified');
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get multiple resources.
   */
  async getMany<T>(keys: string[]): Promise<Map<string, CacheGetResult<T>>> {
    const results = new Map<string, CacheGetResult<T>>();
    
    for (const key of keys) {
      const result = await this.get<T>(key);
      if (result.ok) {
        results.set(key, result.value);
      }
    }
    
    return results;
  }
  
  /**
   * Store multiple resources.
   */
  async setMany<T>(
    entries: Array<{ key: string; data: T; stage: ResourceStage }>
  ): Promise<Map<string, CacheError>> {
    const errors = new Map<string, CacheError>();
    
    for (const entry of entries) {
      const result = await this.set(entry.key, entry.data, entry.stage);
      if (!result.ok) {
        errors.set(entry.key, result.error);
      }
    }
    
    return errors;
  }
  
  /**
   * Delete multiple resources.
   */
  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Maintenance
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Remove expired entries.
   */
  async pruneExpired(): Promise<number> {
    let pruned = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.l1.entries()) {
      if (entry.expiresAt < now) {
        this.l1.delete(key);
        pruned++;
      }
    }
    
    if (pruned > 0) {
      logger.debug('Pruned expired cache entries', { count: pruned });
    }
    
    return pruned;
  }
  
  /**
   * Verify integrity of an entry.
   */
  private async verifyEntry(entry: CacheEntry<unknown>): Promise<boolean> {
    if (!this.config.verifyIntegrity || !entry.signature) {
      return true;
    }
    
    const result = verifySignature(entry.data, entry.signature as HMACSignature, this.integrityConfig);
    return result.ok && result.value;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const l1Total = this.l1Hits + this.l1Misses;
    const l2Total = this.l2Hits + this.l2Misses;
    const total = l1Total + l2Total;
    
    // Count entries by stage
    const byStage: Record<ResourceStage, number> = {
      candidate: 0,
      enriched: 0,
      verified: 0,
      known_source: 0,
    };
    
    for (const entry of this.l1.values()) {
      byStage[entry.stage]++;
    }
    
    return {
      l1: {
        entries: this.l1.size,
        hits: this.l1Hits,
        misses: this.l1Misses,
        hitRate: l1Total > 0 ? this.l1Hits / l1Total : 0,
        evictions: this.l1.evictionCount,
      },
      l2: {
        hits: this.l2Hits,
        misses: this.l2Misses,
        hitRate: l2Total > 0 ? this.l2Hits / l2Total : 0,
      },
      total: {
        hits: this.l1Hits + this.l2Hits,
        misses: this.l1Misses + this.l2Misses,
        hitRate: total > 0 ? (this.l1Hits + this.l2Hits) / total : 0,
      },
      byStage,
    };
  }
  
  /**
   * Record metrics.
   */
  private recordMetrics(operation: 'hit' | 'miss' | 'set', tier: CacheTier, durationMs: number): void {
    if (!this.config.enableStats) return;
    
    incCounter('cache_operations_total', { operation, tier });
    
    if (durationMs > 0) {
      observeHistogram('cache_operation_duration_ms', durationMs, { operation, tier });
    }
    
    setGauge('cache_entries', this.l1.size, { tier: 'l1' });
  }
  
  /**
   * Get current entry count.
   */
  get size(): number {
    return this.l1.size;
  }
  
  /**
   * Get maximum L1 capacity.
   */
  get capacity(): number {
    return this.config.maxL1Entries;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let cacheInstance: ResourceCache | null = null;

/**
 * Get the resource cache singleton.
 */
export function getResourceCache(): ResourceCache {
  if (!cacheInstance) {
    cacheInstance = new ResourceCache();
  }
  return cacheInstance;
}

/**
 * Initialize the resource cache with config.
 */
export function initResourceCache(config?: Partial<ResourceCacheConfig>): ResourceCache {
  cacheInstance = new ResourceCache(config);
  return cacheInstance;
}

/**
 * Reset the resource cache (for testing).
 */
export function resetResourceCache(): void {
  cacheInstance = null;
}
