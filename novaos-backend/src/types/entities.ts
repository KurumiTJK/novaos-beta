// ═══════════════════════════════════════════════════════════════════════════════
// ENTITIES — Resolved Entity Types
// FIXED: Added all types expected by entity-resolver.ts and entity-validator.ts
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory } from './categories.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Types of entities that can be extracted from queries.
 */
export type EntityType =
  | 'stock'          // Stock ticker (AAPL, GOOGL)
  | 'cryptocurrency' // Crypto (BTC, ETH)
  | 'currency'       // Fiat currency (USD, EUR)
  | 'location'       // City/location for weather
  | 'timezone'       // Timezone identifier
  | 'index'          // Market index (S&P 500, DJIA)
  | 'company'        // Company name
  | 'commodity'      // Commodities (gold, oil)
  | 'unknown';       // Unresolved entity type

/**
 * Resolution status for an entity.
 */
export type ResolutionStatus =
  | 'resolved'     // Successfully resolved to canonical form
  | 'ambiguous'    // Multiple possible matches
  | 'not_found'    // No match found
  | 'unsupported'  // Entity type not supported
  | 'invalid';     // Invalid entity

// ─────────────────────────────────────────────────────────────────────────────────
// RAW ENTITY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Raw entity mention extracted from query (basic).
 */
export interface RawEntityMention {
  readonly rawText: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly confidence: number;
}

/**
 * Raw entity with type information (used by entity resolver).
 */
export interface RawEntity {
  readonly rawText: string;
  readonly type: EntityType;
  readonly confidence: number;
  readonly span?: {
    readonly start: number;
    readonly end: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY METADATA
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Metadata about a resolved entity.
 */
export interface EntityMetadata {
  readonly exchange?: string;       // Stock exchange (NYSE, NASDAQ)
  readonly country?: string;        // Country code
  readonly fullName?: string;       // Full company/entity name
  readonly sector?: string;         // Industry sector
  readonly marketCap?: string;      // Market cap tier
  readonly aliases?: readonly string[]; // Alternative names
  readonly [key: string]: unknown;  // Allow additional fields
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLVED ENTITY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Resolved entity with canonical form.
 * FIXED: Added all fields expected by entity-resolver.ts
 */
export interface ResolvedEntity {
  /** Raw entity information */
  readonly raw: RawEntity;
  
  /** Resolution status */
  readonly status: ResolutionStatus;
  
  /** Canonical identifier (ticker, currency code, etc.) */
  readonly canonicalId: string | null;
  
  /** Display name for the entity */
  readonly displayName: string | null;
  
  /** Category this entity belongs to */
  readonly category: LiveCategory | null;
  
  /** Confidence in resolution (0-1) */
  readonly resolutionConfidence: number;
  
  /** Optional metadata */
  readonly metadata?: EntityMetadata;
  
  /** Alternative candidates if ambiguous */
  readonly alternatives?: readonly ResolvedEntityAlternative[];
  
  // Legacy compatibility fields
  /** @deprecated Use canonicalId instead */
  readonly canonicalForm?: string;
  
  /** Provider that resolved this entity */
  readonly provider?: string;
}

/**
 * Alternative candidate for ambiguous entity resolution.
 */
export interface ResolvedEntityAlternative {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly confidence: number;
  readonly metadata?: EntityMetadata;
}

/**
 * Ambiguous entity requiring clarification.
 */
export interface AmbiguousEntity {
  readonly raw: RawEntity;
  readonly candidates: readonly ResolvedEntity[];
  readonly clarificationPrompt: string;
}

/**
 * Failed entity resolution.
 */
export interface FailedEntity {
  readonly raw: RawEntity;
  readonly reason: string;
}

/**
 * Complete entity resolution result.
 */
export interface ResolvedEntities {
  /** All entities (resolved, failed, ambiguous) */
  readonly entities?: readonly ResolvedEntity[];
  
  /** Successfully resolved entities */
  readonly resolved: readonly ResolvedEntity[];
  
  /** Ambiguous entities needing clarification */
  readonly ambiguous: readonly AmbiguousEntity[];
  
  /** Failed entity resolutions */
  readonly failed: readonly FailedEntity[];
  
  /** Resolution trace for telemetry */
  readonly trace?: EntityResolutionTrace;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY RESOLUTION TRACE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Trace information for entity resolution (telemetry).
 */
export interface EntityResolutionTrace {
  readonly originalQuery?: string;
  readonly entityText?: string;
  readonly entityType?: EntityType;
  readonly status?: ResolutionStatus;
  readonly resolvedTo?: string;
  readonly candidates?: readonly string[];
  readonly confidence?: number;
  readonly latencyMs?: number;
  readonly source?: 'cache' | 'lookup' | 'inference';
  readonly extractionTimeMs?: number;
  readonly resolutionTimeMs?: number;
  readonly extractedCount?: number;
  readonly resolvedCount?: number;
  readonly method?: string;
  readonly resolverVersion?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CATEGORY MAPPING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mapping from entity types to their corresponding live categories.
 */
export const ENTITY_TO_CATEGORY: ReadonlyMap<EntityType, LiveCategory> = new Map([
  ['stock', 'market'],
  ['index', 'market'],
  ['company', 'market'],
  ['cryptocurrency', 'crypto'],
  ['currency', 'fx'],
  ['location', 'weather'],
  ['timezone', 'time'],
]);

/**
 * Get the live category for an entity type.
 */
export function getCategoryForEntityType(type: EntityType): LiveCategory | null {
  return ENTITY_TO_CATEGORY.get(type) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create empty resolved entities.
 */
export function createEmptyEntities(): ResolvedEntities {
  return {
    entities: [],
    resolved: [],
    ambiguous: [],
    failed: [],
  };
}

/**
 * Check if entity resolution has any successful results.
 */
export function hasResolvedEntities(entities: ResolvedEntities): boolean {
  return entities.resolved.length > 0;
}

/**
 * Check if entity resolution has any failures.
 */
export function hasFailedEntities(entities: ResolvedEntities): boolean {
  return entities.failed.length > 0 || entities.ambiguous.length > 0;
}

/**
 * Get all entity types present in resolved entities.
 */
export function getEntityTypes(entities: ResolvedEntities): Set<EntityType> {
  const types = new Set<EntityType>();
  for (const entity of entities.resolved) {
    if (entity.raw.type) {
      types.add(entity.raw.type);
    }
  }
  return types;
}

/**
 * Check if an entity is resolved.
 */
export function isResolved(entity: ResolvedEntity): boolean {
  return entity.status === 'resolved' && entity.canonicalId !== null;
}

/**
 * Convert ResolvedEntity to FailedEntity.
 */
export function toFailedEntity(entity: ResolvedEntity, reason: string): FailedEntity {
  return {
    raw: entity.raw,
    reason,
  };
}

/**
 * Convert ResolvedEntity to AmbiguousEntity.
 */
export function toAmbiguousEntity(
  entity: ResolvedEntity, 
  candidates: readonly ResolvedEntity[],
  clarificationPrompt: string
): AmbiguousEntity {
  return {
    raw: entity.raw,
    candidates,
    clarificationPrompt,
  };
}
