// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY VALIDATOR — Validate Resolved Entities Against Providers
// Phase 4: Entity System
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ResolvedEntity,
  ResolvedEntities,
} from '../../types/entities.js';

import type { LiveCategory } from '../../types/categories.js';

import type { BaseProvider, ProviderFetchParams } from './providers/base-provider.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Status of entity validation.
 */
export type ValidationStatus =
  | 'valid'           // Entity confirmed to exist
  | 'invalid'         // Entity confirmed NOT to exist
  | 'unknown'         // Could not determine (provider error)
  | 'skipped';        // Validation not attempted

/**
 * Result of validating a single entity.
 */
export interface EntityValidationResult {
  /** The entity that was validated */
  readonly entity: ResolvedEntity;
  
  /** Validation status */
  readonly status: ValidationStatus;
  
  /** Provider used for validation */
  readonly provider: string | null;
  
  /** Time taken for validation (ms) */
  readonly validationTimeMs: number;
  
  /** Whether result came from cache */
  readonly fromCache: boolean;
  
  /** Error message if validation failed */
  readonly error?: string;
  
  /** Additional data returned from provider */
  readonly providerData?: Record<string, unknown>;
  
  /** Suggestions if entity was close but not exact */
  readonly suggestions?: readonly string[];
}

/**
 * Result of validating multiple entities.
 */
export interface EntitiesValidationResult {
  /** All validation results */
  readonly results: readonly EntityValidationResult[];
  
  /** Valid entities */
  readonly valid: readonly EntityValidationResult[];
  
  /** Invalid entities */
  readonly invalid: readonly EntityValidationResult[];
  
  /** Unknown (couldn't validate) */
  readonly unknown: readonly EntityValidationResult[];
  
  /** Skipped (not validated) */
  readonly skipped: readonly EntityValidationResult[];
  
  /** Total validation time (ms) */
  readonly totalTimeMs: number;
  
  /** Summary statistics */
  readonly stats: ValidationStats;
}

/**
 * Validation statistics.
 */
export interface ValidationStats {
  readonly total: number;
  readonly valid: number;
  readonly invalid: number;
  readonly unknown: number;
  readonly skipped: number;
  readonly cacheHits: number;
  readonly providerCalls: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION CACHE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Cached validation result.
 */
interface CachedValidation {
  readonly status: ValidationStatus;
  readonly providerData?: Record<string, unknown>;
  readonly suggestions?: readonly string[];
  readonly cachedAt: number;
  readonly expiresAt: number;
}

/**
 * In-memory validation cache.
 * Prevents redundant provider calls for recently validated entities.
 */
class ValidationCache {
  private readonly cache = new Map<string, CachedValidation>();
  private readonly defaultTtlMs: number;
  private readonly maxSize: number;
  
  constructor(options?: { defaultTtlMs?: number; maxSize?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 300_000; // 5 minutes
    this.maxSize = options?.maxSize ?? 1000;
  }
  
  /**
   * Generate cache key for an entity.
   */
  private getKey(entity: ResolvedEntity): string {
    const type = entity.raw?.type ?? 'unknown';
    const id = entity.canonicalId?.toLowerCase() ?? (entity.raw?.rawText ?? '').toLowerCase();
    return `${type}:${id}`;
  }
  
  /**
   * Get cached validation result.
   */
  get(entity: ResolvedEntity): CachedValidation | null {
    const key = this.getKey(entity);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check expiry
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached;
  }
  
  /**
   * Store validation result in cache.
   */
  set(
    entity: ResolvedEntity,
    status: ValidationStatus,
    data?: { providerData?: Record<string, unknown>; suggestions?: readonly string[] },
    ttlMs?: number
  ): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    const key = this.getKey(entity);
    const now = Date.now();
    
    this.cache.set(key, {
      status,
      providerData: data?.providerData,
      suggestions: data?.suggestions,
      cachedAt: now,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
    });
  }
  
  /**
   * Evict oldest entries.
   */
  private evictOldest(): void {
    const entriesToEvict = Math.ceil(this.maxSize * 0.1); // Evict 10%
    const entries = [...this.cache.entries()]
      .sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    
    for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
      this.cache.delete(entries[i]![0]);
    }
  }
  
  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics.
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Singleton cache instance
let validationCacheInstance: ValidationCache | null = null;

/**
 * Get the validation cache singleton.
 */
export function getValidationCache(): ValidationCache {
  if (!validationCacheInstance) {
    validationCacheInstance = new ValidationCache();
  }
  return validationCacheInstance;
}

/**
 * Reset the validation cache (for testing).
 */
export function resetValidationCache(): void {
  validationCacheInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for entity validation.
 */
export interface EntityValidationConfig {
  /** Whether to use cache */
  readonly useCache: boolean;
  
  /** Cache TTL in milliseconds */
  readonly cacheTtlMs: number;
  
  /** Whether to validate in parallel */
  readonly parallel: boolean;
  
  /** Maximum concurrent validations */
  readonly maxConcurrency: number;
  
  /** Timeout per validation (ms) */
  readonly timeoutMs: number;
  
  /** Whether to skip validation for high-confidence resolutions */
  readonly skipHighConfidence: boolean;
  
  /** Confidence threshold for skipping validation */
  readonly skipConfidenceThreshold: number;
}

/**
 * Default validation configuration.
 */
export const DEFAULT_VALIDATION_CONFIG: EntityValidationConfig = {
  useCache: true,
  cacheTtlMs: 300_000, // 5 minutes
  parallel: true,
  maxConcurrency: 5,
  timeoutMs: 5000,
  skipHighConfidence: false,
  skipConfidenceThreshold: 0.95,
};

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER REGISTRY FOR VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Registry of providers for entity validation.
 */
export interface ProviderRegistry {
  getProviderForCategory(category: LiveCategory): BaseProvider | null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY VALIDATOR CLASS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validates resolved entities against live data providers.
 */
export class EntityValidator {
  private readonly config: EntityValidationConfig;
  private readonly cache: ValidationCache;
  private readonly providerRegistry: ProviderRegistry | null;
  
  constructor(
    providerRegistry: ProviderRegistry | null = null,
    config: Partial<EntityValidationConfig> = {}
  ) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
    this.cache = getValidationCache();
    this.providerRegistry = providerRegistry;
  }
  
  /**
   * Validate a single entity.
   */
  async validateEntity(entity: ResolvedEntity): Promise<EntityValidationResult> {
    const startTime = Date.now();
    
    // Skip if entity wasn't resolved
    if (entity.status !== 'resolved' || !entity.canonicalId) {
      return {
        entity,
        status: 'skipped',
        provider: null,
        validationTimeMs: Date.now() - startTime,
        fromCache: false,
        error: `Entity not resolved: ${entity.status}`,
      };
    }
    
    // Skip if high confidence and configured to skip
    if (
      this.config.skipHighConfidence &&
      (entity.resolutionConfidence ?? 0) >= this.config.skipConfidenceThreshold
    ) {
      return {
        entity,
        status: 'valid', // Assume valid for high-confidence
        provider: null,
        validationTimeMs: Date.now() - startTime,
        fromCache: false,
      };
    }
    
    // Check cache
    if (this.config.useCache) {
      const cached = this.cache.get(entity);
      if (cached) {
        return {
          entity,
          status: cached.status,
          provider: null,
          validationTimeMs: Date.now() - startTime,
          fromCache: true,
          providerData: cached.providerData,
          suggestions: cached.suggestions,
        };
      }
    }
    
    // Get provider for category
    const category = entity.category;
    if (!category) {
      return {
        entity,
        status: 'skipped',
        provider: null,
        validationTimeMs: Date.now() - startTime,
        fromCache: false,
        error: 'No category for entity',
      };
    }
    
    const provider = this.providerRegistry?.getProviderForCategory(category);
    if (!provider) {
      return {
        entity,
        status: 'unknown',
        provider: null,
        validationTimeMs: Date.now() - startTime,
        fromCache: false,
        error: `No provider available for category: ${category}`,
      };
    }
    
    // Validate via provider
    try {
      const result = await this.validateWithProvider(entity, provider);
      
      // Cache result
      if (this.config.useCache) {
        this.cache.set(
          entity,
          result.status,
          { providerData: result.providerData, suggestions: result.suggestions },
          this.config.cacheTtlMs
        );
      }
      
      return {
        ...result,
        validationTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        entity,
        status: 'unknown',
        provider: provider.name,
        validationTimeMs: Date.now() - startTime,
        fromCache: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Validate entity with a specific provider.
   */
  private async validateWithProvider(
    entity: ResolvedEntity,
    provider: BaseProvider
  ): Promise<Omit<EntityValidationResult, 'validationTimeMs'>> {
    const params: ProviderFetchParams = {
      query: entity.canonicalId!,
      timeoutMs: this.config.timeoutMs,
    };
    
    const fetchResult = await provider.fetch(params);
    
    if (fetchResult.result.ok) {
      return {
        entity,
        status: 'valid',
        provider: provider.name,
        fromCache: fetchResult.fromCache,
        providerData: fetchResult.result.data as unknown as Record<string, unknown>,
      };
    }
    
    // Check error type
    const error = fetchResult.result.error;
    
    if (error.code === 'invalid_symbol' || error.code === 'not_available') {
      return {
        entity,
        status: 'invalid',
        provider: provider.name,
        fromCache: false,
        error: error.message,
      };
    }
    
    // Other errors (network, rate limit, etc.) - can't determine validity
    return {
      entity,
      status: 'unknown',
      provider: provider.name,
      fromCache: false,
      error: error.message,
    };
  }
  
  /**
   * Validate multiple entities.
   */
  async validateEntities(
    entities: ResolvedEntities | readonly ResolvedEntity[]
  ): Promise<EntitiesValidationResult> {
    const startTime = Date.now();
    
    // Normalize input
    const entityList = Array.isArray(entities) 
      ? entities 
      : 'resolved' in entities ? entities.resolved : entities;
    
    // Validate
    let results: EntityValidationResult[];
    
    if (this.config.parallel) {
      results = await this.validateParallel(entityList);
    } else {
      results = await this.validateSequential(entityList);
    }
    
    // Categorize results
    const valid: EntityValidationResult[] = [];
    const invalid: EntityValidationResult[] = [];
    const unknown: EntityValidationResult[] = [];
    const skipped: EntityValidationResult[] = [];
    let cacheHits = 0;
    let providerCalls = 0;
    
    for (const result of results) {
      if (result.fromCache) cacheHits++;
      if (result.provider) providerCalls++;
      
      switch (result.status) {
        case 'valid':
          valid.push(result);
          break;
        case 'invalid':
          invalid.push(result);
          break;
        case 'unknown':
          unknown.push(result);
          break;
        case 'skipped':
          skipped.push(result);
          break;
      }
    }
    
    return {
      results,
      valid,
      invalid,
      unknown,
      skipped,
      totalTimeMs: Date.now() - startTime,
      stats: {
        total: results.length,
        valid: valid.length,
        invalid: invalid.length,
        unknown: unknown.length,
        skipped: skipped.length,
        cacheHits,
        providerCalls,
      },
    };
  }
  
  /**
   * Validate entities sequentially.
   */
  private async validateSequential(
    entities: readonly ResolvedEntity[]
  ): Promise<EntityValidationResult[]> {
    const results: EntityValidationResult[] = [];
    
    for (const entity of entities) {
      const result = await this.validateEntity(entity);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Validate entities in parallel with concurrency limit.
   */
  private async validateParallel(
    entities: readonly ResolvedEntity[]
  ): Promise<EntityValidationResult[]> {
    const results: EntityValidationResult[] = new Array(entities.length);
    const pending: Promise<void>[] = [];
    let currentIndex = 0;
    
    const processNext = async (): Promise<void> => {
      while (currentIndex < entities.length) {
        const index = currentIndex++;
        const entity = entities[index]!;
        
        try {
          results[index] = await this.validateEntity(entity);
        } catch (error) {
          results[index] = {
            entity,
            status: 'unknown',
            provider: null,
            validationTimeMs: 0,
            fromCache: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    };
    
    // Start concurrent workers
    for (let i = 0; i < this.config.maxConcurrency; i++) {
      pending.push(processNext());
    }
    
    await Promise.all(pending);
    return results;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────────

let validatorInstance: EntityValidator | null = null;

/**
 * Get the entity validator singleton.
 */
export function getEntityValidator(
  providerRegistry?: ProviderRegistry,
  config?: Partial<EntityValidationConfig>
): EntityValidator {
  if (!validatorInstance) {
    validatorInstance = new EntityValidator(providerRegistry ?? null, config);
  }
  return validatorInstance;
}

/**
 * Reset the entity validator singleton (for testing).
 */
export function resetEntityValidator(): void {
  validatorInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate a single entity using the singleton validator.
 */
export async function validateEntity(
  entity: ResolvedEntity,
  providerRegistry?: ProviderRegistry
): Promise<EntityValidationResult> {
  const validator = getEntityValidator(providerRegistry);
  return validator.validateEntity(entity);
}

/**
 * Validate multiple entities using the singleton validator.
 */
export async function validateEntities(
  entities: ResolvedEntities | readonly ResolvedEntity[],
  providerRegistry?: ProviderRegistry
): Promise<EntitiesValidationResult> {
  const validator = getEntityValidator(providerRegistry);
  return validator.validateEntities(entities);
}

/**
 * Check if an entity is valid (convenience wrapper).
 */
export async function isEntityValid(
  entity: ResolvedEntity,
  providerRegistry?: ProviderRegistry
): Promise<boolean> {
  const result = await validateEntity(entity, providerRegistry);
  return result.status === 'valid';
}

/**
 * Filter to only valid entities.
 */
export async function filterValidEntities(
  entities: readonly ResolvedEntity[],
  providerRegistry?: ProviderRegistry
): Promise<ResolvedEntity[]> {
  const result = await validateEntities(entities, providerRegistry);
  return result.valid.map(r => r.entity);
}
