// ═══════════════════════════════════════════════════════════════════════════════
// ENTITIES — Entity Types and Resolution Results (CORRECTED)
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory } from './categories.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type EntityType =
  | 'ticker'
  | 'crypto'
  | 'currency_pair'
  | 'currency'
  | 'city'
  | 'location'
  | 'timezone'
  | 'company'
  | 'index'
  | 'commodity'
  | 'unknown';

export const ENTITY_TYPES: ReadonlySet<EntityType> = new Set([
  'ticker',
  'crypto',
  'currency_pair',
  'currency',
  'city',
  'location',
  'timezone',
  'company',
  'index',
  'commodity',
  'unknown',
]);

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLUTION STATUS
// ─────────────────────────────────────────────────────────────────────────────────

export type ResolutionStatus =
  | 'resolved'
  | 'ambiguous'
  | 'failed'
  | 'pending'
  | 'not_found'
  | 'unsupported'
  | 'invalid';

// ─────────────────────────────────────────────────────────────────────────────────
// RAW ENTITY (original mention from text)
// ─────────────────────────────────────────────────────────────────────────────────

export interface RawEntity {
  readonly rawText?: string;
  readonly text?: string;
  readonly start?: number;
  readonly end?: number;
  readonly type?: EntityType;
  readonly confidence?: number;
}

// For backward compatibility
export interface RawEntityMention {
  readonly text?: string;
  readonly rawText?: string;
  readonly start?: number;
  readonly end?: number;
  readonly startIndex?: number;
  readonly endIndex?: number;
  readonly type?: EntityType;
  readonly confidence?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY METADATA
// ─────────────────────────────────────────────────────────────────────────────────

export interface EntityMetadata {
  readonly exchange?: string;
  readonly sector?: string;
  readonly industry?: string;
  readonly country?: string;
  readonly region?: string;
  readonly timezone?: string;
  readonly [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY RESOLUTION TRACE
// ─────────────────────────────────────────────────────────────────────────────────

export interface EntityResolutionTrace {
  readonly method: 'exact' | 'fuzzy' | 'alias' | 'llm' | 'fallback' | 'regex';
  readonly confidence?: number;
  readonly source?: string;
  readonly alternatives?: readonly string[];
  readonly latencyMs?: number;
  readonly originalQuery?: string;
  readonly extractionTimeMs?: number;
  readonly resolutionTimeMs?: number;
  readonly extractedCount?: number;
  readonly resolvedCount?: number;
  readonly resolverVersion?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLVED ENTITY ALTERNATIVE
// ─────────────────────────────────────────────────────────────────────────────────

export interface ResolvedEntityAlternative {
  readonly normalizedId: string;
  readonly displayName: string;
  readonly confidence: number;
  readonly type: EntityType;
  readonly category: LiveCategory;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLVED ENTITY
// ─────────────────────────────────────────────────────────────────────────────────

export interface ResolvedEntity {
  // Original interface properties - made optional to match actual code patterns
  readonly originalText?: string;
  readonly normalizedId?: string;
  readonly type?: EntityType;
  readonly category?: LiveCategory | null;
  readonly confidence?: number;
  readonly displayName?: string | null;
  readonly metadata?: EntityMetadata;
  readonly aliases?: readonly string[];
  
  // Additional properties used in code
  readonly raw?: RawEntity;
  readonly canonicalForm?: string;
  readonly canonicalId?: string | null;
  readonly status?: ResolutionStatus;
  readonly resolutionConfidence?: number;
  readonly trace?: EntityResolutionTrace;
  readonly alternatives?: readonly ResolvedEntityAlternative[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// AMBIGUOUS ENTITY
// ─────────────────────────────────────────────────────────────────────────────────

export interface AmbiguousEntity {
  readonly raw: RawEntity;
  readonly candidates: readonly ResolvedEntityAlternative[];
  readonly clarificationPrompt: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FAILED ENTITY
// ─────────────────────────────────────────────────────────────────────────────────

export interface FailedEntity {
  readonly raw: RawEntity;
  readonly reason: string;
  readonly errorCode?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLVED ENTITIES COLLECTION
// ─────────────────────────────────────────────────────────────────────────────────

export interface ResolvedEntities {
  readonly resolved: readonly ResolvedEntity[];
  readonly unresolved?: readonly RawEntityMention[];
  readonly ambiguous?: readonly AmbiguousEntity[];
  readonly failed?: readonly FailedEntity[];
  readonly entities?: readonly ResolvedEntity[];
  readonly byCategory?: ReadonlyMap<LiveCategory, readonly ResolvedEntity[]>;
  readonly byType?: ReadonlyMap<EntityType, readonly ResolvedEntity[]>;
  readonly complete?: boolean;
  readonly resolutionTimeMs?: number;
  readonly trace?: EntityResolutionTrace;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY TO CATEGORY MAPPING
// ─────────────────────────────────────────────────────────────────────────────────

export const ENTITY_TO_CATEGORY: Readonly<Record<EntityType, LiveCategory>> = {
  ticker: 'market',
  crypto: 'crypto',
  currency_pair: 'fx',
  currency: 'fx',
  city: 'weather',
  location: 'weather',
  timezone: 'time',
  company: 'market',
  index: 'market',
  commodity: 'market',
  unknown: 'market',
};

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function createEmptyEntities(): ResolvedEntities {
  return {
    resolved: [],
    unresolved: [],
    ambiguous: [],
    failed: [],
    complete: true,
  };
}

export function createResolvedEntities(
  entities: readonly ResolvedEntity[],
  unresolved: readonly RawEntityMention[] = [],
  resolutionTimeMs?: number
): ResolvedEntities {
  const byCategory = new Map<LiveCategory, ResolvedEntity[]>();
  const byType = new Map<EntityType, ResolvedEntity[]>();
  
  for (const entity of entities) {
    if (entity.category) {
      const cat = entity.category as LiveCategory;
      const catList = byCategory.get(cat) ?? [];
      catList.push(entity);
      byCategory.set(cat, catList);
    }
    
    if (entity.type) {
      const entityType = entity.type as EntityType;
      const typeList = byType.get(entityType) ?? [];
      typeList.push(entity);
      byType.set(entityType, typeList);
    }
  }
  
  return {
    resolved: entities,
    unresolved,
    ambiguous: [],
    failed: [],
    byCategory,
    byType,
    complete: unresolved.length === 0,
    resolutionTimeMs,
  };
}

export function createResolvedEntity(
  originalText: string,
  normalizedId: string,
  type: EntityType,
  confidence: number = 1.0,
  displayName?: string,
  metadata?: EntityMetadata
): ResolvedEntity {
  return {
    originalText,
    normalizedId,
    type,
    category: ENTITY_TO_CATEGORY[type],
    confidence,
    displayName: displayName ?? normalizedId,
    metadata,
    canonicalForm: normalizedId,
    canonicalId: normalizedId,
    status: 'resolved',
  };
}

export function createRawEntityMention(
  text: string,
  start: number,
  end: number,
  type?: EntityType,
  confidence?: number
): RawEntityMention {
  return {
    text,
    rawText: text,
    start,
    end,
    type,
    confidence,
  };
}

export function toRawEntity(mention: RawEntityMention, type: EntityType): RawEntityMention {
  return {
    ...mention,
    type,
  };
}

export function normalizeEntityType(typeStr: string): EntityType {
  const normalized = typeStr.toLowerCase().trim();
  if (ENTITY_TYPES.has(normalized as EntityType)) {
    return normalized as EntityType;
  }
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

export function isValidEntityType(value: string): value is EntityType {
  return ENTITY_TYPES.has(value as EntityType);
}

export function hasResolvedEntities(entities: ResolvedEntities): boolean {
  return entities.resolved.length > 0;
}

export function hasUnresolvedEntities(entities: ResolvedEntities): boolean {
  return (entities.unresolved?.length ?? 0) > 0;
}

export function hasEntitiesForCategory(entities: ResolvedEntities, category: LiveCategory): boolean {
  return (entities.byCategory?.get(category)?.length ?? 0) > 0;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function getEntitiesForCategory(
  entities: ResolvedEntities,
  category: LiveCategory
): readonly ResolvedEntity[] {
  return entities.byCategory?.get(category) ?? [];
}

export function getEntitiesOfType(
  entities: ResolvedEntities,
  type: EntityType
): readonly ResolvedEntity[] {
  return entities.byType?.get(type) ?? [];
}

export function getFirstEntityForCategory(
  entities: ResolvedEntities,
  category: LiveCategory
): ResolvedEntity | undefined {
  return entities.byCategory?.get(category)?.[0];
}

export function getCategories(entities: ResolvedEntities): readonly LiveCategory[] {
  return entities.byCategory ? Array.from(entities.byCategory.keys()) : [];
}

export function mergeEntities(...collections: ResolvedEntities[]): ResolvedEntities {
  const allResolved: ResolvedEntity[] = [];
  const allUnresolved: RawEntityMention[] = [];
  
  for (const collection of collections) {
    allResolved.push(...collection.resolved);
    if (collection.unresolved) {
      allUnresolved.push(...collection.unresolved);
    }
  }
  
  return createResolvedEntities(allResolved, allUnresolved);
}
