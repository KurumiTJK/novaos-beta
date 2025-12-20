// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER CACHE — Bounded LRU Cache with O(1) Eviction
// Caches provider responses with TTL per category and in-flight deduplication
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Live data categories that can be cached.
 * Matches LiveCategory from Phase 1 types.
 */
export type CacheableCategory = 
  | 'time'
  | 'weather'
  | 'market'
  | 'crypto'
  | 'fx';

/**
 * Cache entry metadata.
 */
export interface CacheEntryMeta {
  /** When the entry was created */
  readonly createdAt: number;
  /** When the entry expires */
  readonly expiresAt: number;
  /** The category for TTL lookup */
  readonly category: CacheableCategory;
  /** Number of times this entry was accessed */
  accessCount: number;
  /** Last access time */
  lastAccessedAt: number;
}

/**
 * Result of a cache get operation.
 */
export interface CacheGetResult<T> {
  /** Whether the value was found in cache */
  readonly hit: boolean;
  /** The cached value (undefined if miss) */
  readonly value?: T;
  /** Entry metadata (undefined if miss) */
  readonly meta?: CacheEntryMeta;
  /** Whether the entry is stale but still usable */
  readonly stale: boolean;
}

/**
 * Result of a getOrFetch operation.
 */
export interface CacheFetchResult<T> {
  /** The result value */
  readonly result: T;
  /** Whether the result came from cache */
  readonly cacheHit: boolean;
  /** Whether the result was deduplicated from an in-flight request */
  readonly deduplicated: boolean;
  /** Entry metadata */
  readonly meta: CacheEntryMeta;
}

/**
 * Cache configuration.
 */
export interface CacheConfig {
  /** Maximum number of entries (default: 10000) */
  readonly maxEntries: number;
  /** TTL overrides by category in milliseconds */
  readonly ttlByCategory: Readonly<Record<CacheableCategory, number>>;
  /** How often to run cleanup in ms (default: 60000) */
  readonly cleanupIntervalMs: number;
  /** Whether to serve stale entries while revalidating (default: true) */
  readonly staleWhileRevalidate: boolean;
  /** Grace period for stale entries in ms (default: 30000) */
  readonly staleGraceMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Default TTL by category.
 * Based on data freshness requirements from Phase 1.
 */
export const DEFAULT_TTL_BY_CATEGORY: Readonly<Record<CacheableCategory, number>> = {
  time: 1_000,        // 1 second - time is highly volatile
  weather: 300_000,   // 5 minutes - weather updates infrequently
  market: 30_000,     // 30 seconds - stock prices during market hours
  crypto: 30_000,     // 30 seconds - crypto is 24/7 but not instant
  fx: 3_600_000,      // 1 hour - FX rates are relatively stable
};

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 10_000,
  ttlByCategory: DEFAULT_TTL_BY_CATEGORY,
  cleanupIntervalMs: 60_000,
  staleWhileRevalidate: true,
  staleGraceMs: 30_000,
};

// ─────────────────────────────────────────────────────────────────────────────────
// DOUBLY-LINKED LIST NODE
// For O(1) LRU eviction
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Node in the doubly-linked list for LRU ordering.
 */
class LRUNode<T> {
  key: string;
  value: T;
  meta: CacheEntryMeta;
  prev: LRUNode<T> | null = null;
  next: LRUNode<T> | null = null;
  
  constructor(key: string, value: T, meta: CacheEntryMeta) {
    this.key = key;
    this.value = value;
    this.meta = meta;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// LRU CACHE CLASS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Bounded LRU cache with O(1) operations.
 * 
 * Features:
 * - O(1) get, set, delete, eviction
 * - TTL per category
 * - In-flight request deduplication
 * - Automatic cleanup of expired entries
 * - Stale-while-revalidate support
 * 
 * @example
 * const cache = new ProviderCache();
 * 
 * // Simple get/set
 * cache.set('aapl-price', { price: 150.25 }, 'market');
 * const result = cache.get('aapl-price');
 * 
 * // Get or fetch with deduplication
 * const { result, cacheHit } = await cache.getOrFetch(
 *   'aapl-price',
 *   'market',
 *   async () => fetchStockPrice('AAPL')
 * );
 */
export class ProviderCache<T = unknown> {
  private readonly config: CacheConfig;
  
  /** Hash map for O(1) key lookup */
  private readonly map: Map<string, LRUNode<T>> = new Map();
  
  /** Doubly-linked list head (most recently used) */
  private head: LRUNode<T> | null = null;
  
  /** Doubly-linked list tail (least recently used) */
  private tail: LRUNode<T> | null = null;
  
  /** In-flight requests for deduplication */
  private readonly inFlight: Map<string, Promise<T>> = new Map();
  
  /** Cleanup interval handle */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  
  /** Statistics */
  private stats = {
    hits: 0,
    misses: 0,
    staleHits: 0,
    evictions: 0,
    deduplicatedRequests: 0,
  };
  
  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.startCleanupTimer();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get a value from the cache.
   * 
   * @param key - The cache key
   * @returns Cache result with hit/miss status
   */
  get(key: string): CacheGetResult<T> {
    const node = this.map.get(key);
    
    if (!node) {
      this.stats.misses++;
      return { hit: false, stale: false };
    }
    
    const now = Date.now();
    const isExpired = now > node.meta.expiresAt;
    const isStale = isExpired && now <= node.meta.expiresAt + this.config.staleGraceMs;
    
    if (isExpired && !isStale) {
      // Fully expired - remove and return miss
      this.delete(key);
      this.stats.misses++;
      return { hit: false, stale: false };
    }
    
    // Update access metadata
    node.meta.accessCount++;
    node.meta.lastAccessedAt = now;
    
    // Move to head (most recently used)
    this.moveToHead(node);
    
    if (isStale) {
      this.stats.staleHits++;
    } else {
      this.stats.hits++;
    }
    
    return {
      hit: true,
      value: node.value,
      meta: { ...node.meta },
      stale: isStale,
    };
  }
  
  /**
   * Set a value in the cache.
   * 
   * @param key - The cache key
   * @param value - The value to cache
   * @param category - The category for TTL lookup
   * @param ttlMs - Optional TTL override in milliseconds
   */
  set(key: string, value: T, category: CacheableCategory, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs ?? this.config.ttlByCategory[category];
    
    const meta: CacheEntryMeta = {
      createdAt: now,
      expiresAt: now + ttl,
      category,
      accessCount: 0,
      lastAccessedAt: now,
    };
    
    // Check if key already exists
    const existingNode = this.map.get(key);
    
    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      existingNode.meta = meta;
      this.moveToHead(existingNode);
      return;
    }
    
    // Create new node
    const node = new LRUNode(key, value, meta);
    this.map.set(key, node);
    this.addToHead(node);
    
    // Evict if over capacity
    while (this.map.size > this.config.maxEntries) {
      this.evictLRU();
    }
  }
  
  /**
   * Delete a key from the cache.
   * 
   * @param key - The cache key
   * @returns True if the key was deleted
   */
  delete(key: string): boolean {
    const node = this.map.get(key);
    
    if (!node) {
      return false;
    }
    
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }
  
  /**
   * Check if a key exists and is not expired.
   * 
   * @param key - The cache key
   * @returns True if key exists and is valid
   */
  has(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    
    const now = Date.now();
    if (now > node.meta.expiresAt) {
      // Expired - but might be stale-valid
      return this.config.staleWhileRevalidate && 
             now <= node.meta.expiresAt + this.config.staleGraceMs;
    }
    
    return true;
  }
  
  /**
   * Get or fetch a value with in-flight deduplication.
   * 
   * If the key is in cache and valid, returns immediately.
   * If another request for the same key is in-flight, waits for it.
   * Otherwise, calls the fetcher function.
   * 
   * @param key - The cache key
   * @param category - The category for TTL lookup
   * @param fetcher - Function to fetch the value if not cached
   * @param ttlMs - Optional TTL override
   * @returns Result with cacheHit and deduplicated flags
   */
  async getOrFetch(
    key: string,
    category: CacheableCategory,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<CacheFetchResult<T>> {
    // Check cache first
    const cached = this.get(key);
    
    if (cached.hit && !cached.stale) {
      return {
        result: cached.value!,
        cacheHit: true,
        deduplicated: false,
        meta: cached.meta!,
      };
    }
    
    // Check for in-flight request
    const inFlightPromise = this.inFlight.get(key);
    
    if (inFlightPromise) {
      this.stats.deduplicatedRequests++;
      
      // Wait for in-flight request
      const result = await inFlightPromise;
      const freshCached = this.get(key);
      
      return {
        result,
        cacheHit: false,
        deduplicated: true,
        meta: freshCached.meta ?? this.createMeta(category, ttlMs),
      };
    }
    
    // If stale, we can return stale data while revalidating
    if (cached.stale && this.config.staleWhileRevalidate) {
      // Start revalidation in background (don't await)
      this.revalidateInBackground(key, category, fetcher, ttlMs);
      
      return {
        result: cached.value!,
        cacheHit: true,
        deduplicated: false,
        meta: cached.meta!,
      };
    }
    
    // Fetch fresh data
    const fetchPromise = this.fetchAndCache(key, category, fetcher, ttlMs);
    
    try {
      const result = await fetchPromise;
      const freshMeta = this.get(key).meta ?? this.createMeta(category, ttlMs);
      
      return {
        result,
        cacheHit: false,
        deduplicated: false,
        meta: freshMeta,
      };
    } catch (error) {
      // If fetch fails and we have stale data, return it
      if (cached.stale) {
        return {
          result: cached.value!,
          cacheHit: true,
          deduplicated: false,
          meta: cached.meta!,
        };
      }
      throw error;
    }
  }
  
  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
    this.inFlight.clear();
  }
  
  /**
   * Get cache statistics.
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    staleHits: number;
    evictions: number;
    deduplicatedRequests: number;
    hitRate: number;
    inFlightCount: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    
    return {
      size: this.map.size,
      maxSize: this.config.maxEntries,
      hits: this.stats.hits,
      misses: this.stats.misses,
      staleHits: this.stats.staleHits,
      evictions: this.stats.evictions,
      deduplicatedRequests: this.stats.deduplicatedRequests,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      inFlightCount: this.inFlight.size,
    };
  }
  
  /**
   * Clean up expired entries.
   * Called automatically, but can be called manually.
   * 
   * @returns Number of entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    // Iterate from tail (LRU) for efficiency
    let current = this.tail;
    
    while (current) {
      const prev = current.prev;
      
      // Check if fully expired (past stale grace period)
      if (now > current.meta.expiresAt + this.config.staleGraceMs) {
        this.delete(current.key);
        removed++;
      }
      
      current = prev;
    }
    
    return removed;
  }
  
  /**
   * Stop the cleanup timer.
   * Call this when shutting down.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL METHODS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Add a node to the head of the list.
   */
  private addToHead(node: LRUNode<T>): void {
    node.prev = null;
    node.next = this.head;
    
    if (this.head) {
      this.head.prev = node;
    }
    
    this.head = node;
    
    if (!this.tail) {
      this.tail = node;
    }
  }
  
  /**
   * Remove a node from the list.
   */
  private removeNode(node: LRUNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    
    node.prev = null;
    node.next = null;
  }
  
  /**
   * Move a node to the head (most recently used).
   */
  private moveToHead(node: LRUNode<T>): void {
    if (node === this.head) return;
    
    this.removeNode(node);
    this.addToHead(node);
  }
  
  /**
   * Evict the least recently used entry.
   */
  private evictLRU(): void {
    if (!this.tail) return;
    
    const key = this.tail.key;
    this.removeNode(this.tail);
    this.map.delete(key);
    this.stats.evictions++;
  }
  
  /**
   * Fetch and cache a value, tracking in-flight state.
   */
  private async fetchAndCache(
    key: string,
    category: CacheableCategory,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    // Create the fetch promise
    const fetchPromise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, category, ttlMs);
        return result;
      } finally {
        // Remove from in-flight tracking
        this.inFlight.delete(key);
      }
    })();
    
    // Track as in-flight
    this.inFlight.set(key, fetchPromise);
    
    return fetchPromise;
  }
  
  /**
   * Revalidate a stale entry in the background.
   */
  private revalidateInBackground(
    key: string,
    category: CacheableCategory,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): void {
    // Only start revalidation if not already in-flight
    if (this.inFlight.has(key)) return;
    
    this.fetchAndCache(key, category, fetcher, ttlMs).catch(error => {
      // Log but don't throw - stale data was already returned
      console.warn(`[PROVIDER_CACHE] Background revalidation failed for ${key}:`, error);
    });
  }
  
  /**
   * Create metadata for a new entry.
   */
  private createMeta(category: CacheableCategory, ttlMs?: number): CacheEntryMeta {
    const now = Date.now();
    const ttl = ttlMs ?? this.config.ttlByCategory[category];
    
    return {
      createdAt: now,
      expiresAt: now + ttl,
      category,
      accessCount: 0,
      lastAccessedAt: now,
    };
  }
  
  /**
   * Start the automatic cleanup timer.
   */
  private startCleanupTimer(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
    
    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

let providerCacheInstance: ProviderCache | null = null;

/**
 * Get the singleton provider cache instance.
 */
export function getProviderCache<T = unknown>(): ProviderCache<T> {
  if (!providerCacheInstance) {
    providerCacheInstance = new ProviderCache();
  }
  return providerCacheInstance as ProviderCache<T>;
}

/**
 * Create a new provider cache instance (for testing or isolated use).
 */
export function createProviderCache<T = unknown>(
  config?: Partial<CacheConfig>
): ProviderCache<T> {
  return new ProviderCache<T>(config);
}

// Default export for convenience
export const providerCache = getProviderCache();
