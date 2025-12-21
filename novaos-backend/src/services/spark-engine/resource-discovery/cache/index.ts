// ═══════════════════════════════════════════════════════════════════════════════
// CACHE MODULE — Resource Caching Infrastructure
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Types
  type CacheTier,
  type ResourceStage,
  type CachedResource,
  type ResourceCacheConfig,
  DEFAULT_CACHE_CONFIG,
  type CacheErrorCode,
  type CacheError,
  type CacheStats,
  type CacheGetResult,
  
  // Cache class
  ResourceCache,
  
  // Singleton
  getResourceCache,
  initResourceCache,
  resetResourceCache,
} from './resource-cache.js';
