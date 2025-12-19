// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY TYPES — Live Data Router Entity Resolution
// Types for extracting and resolving entities from user queries
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory } from './categories.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Types of entities that can be extracted from user queries.
 */
export type EntityType =
  | 'ticker'        // Stock symbols: AAPL, GOOGL, MSFT
  | 'crypto'        // Cryptocurrency symbols: BTC, ETH, SOL
  | 'currency'      // Fiat currencies: USD, EUR, GBP
  | 'currency_pair' // FX pairs: USD/EUR, GBP/JPY
  | 'city'          // Cities for weather: "New York", "London"
  | 'location'      // Generic locations: coordinates, addresses
  | 'timezone'      // Timezone identifiers: "America/New_York", "UTC"
  | 'index'         // Market indices: S&P 500, NASDAQ, DOW
  | 'commodity';    // Commodities: gold, oil, silver

/**
 * All valid entity types as a Set for runtime validation.
 */
export const VALID_ENTITY_TYPES: ReadonlySet<EntityType> = new Set([
  'ticker',
  'crypto',
  'currency',
  'currency_pair',
  'city',
  'location',
  'timezone',
  'index',
  'commodity',
]);

/**
 * Type guard for EntityType.
 */
export function isEntityType(value: unknown): value is EntityType {
  return typeof value === 'string' && VALID_ENTITY_TYPES.has(value as EntityType);
}

/**
 * Map from EntityType to the LiveCategory it's used for.
 */
export const ENTITY_TO_CATEGORY: ReadonlyMap<EntityType, LiveCategory> = new Map([
  ['ticker', 'market'],
  ['index', 'market'],
  ['commodity', 'market'],
  ['crypto', 'crypto'],
  ['currency', 'fx'],
  ['currency_pair', 'fx'],
  ['city', 'weather'],
  ['location', 'weather'],
  ['timezone', 'time'],
]);

/**
 * Get the LiveCategory for an entity type.
 */
export function getCategoryForEntityType(entityType: EntityType): LiveCategory | undefined {
  return ENTITY_TO_CATEGORY.get(entityType);
}

// ─────────────────────────────────────────────────────────────────────────────────
// RAW ENTITY — Extracted from user query (unvalidated)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * An entity extracted from user input before resolution.
 * May be ambiguous or require normalization.
 */
export interface RawEntity {
  /** The raw text as it appeared in the query */
  readonly rawText: string;
  
  /** Detected entity type (may be uncertain) */
  readonly type: EntityType;
  
  /** Character offset in original query */
  readonly startOffset: number;
  
  /** Character end offset in original query */
  readonly endOffset: number;
  
  /** Confidence in the extraction (0-1) */
  readonly extractionConfidence: number;
  
  /** Alternative type interpretations if ambiguous */
  readonly alternativeTypes?: readonly EntityType[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLUTION STATUS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Status of entity resolution.
 */
export type ResolutionStatus =
  | 'resolved'      // Successfully resolved to canonical form
  | 'ambiguous'     // Multiple possible resolutions
  | 'not_found'     // Entity not recognized
  | 'invalid'       // Entity format invalid
  | 'unsupported';  // Entity type not supported by available providers

/**
 * All valid resolution statuses as a Set.
 */
export const VALID_RESOLUTION_STATUSES: ReadonlySet<ResolutionStatus> = new Set([
  'resolved',
  'ambiguous',
  'not_found',
  'invalid',
  'unsupported',
]);

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLVED ENTITY — Validated and normalized
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A fully resolved entity ready for provider lookup.
 */
export interface ResolvedEntity {
  /** The original raw entity */
  readonly raw: RawEntity;
  
  /** Resolution status */
  readonly status: ResolutionStatus;
  
  /** Canonical identifier for provider lookup (e.g., "AAPL", "BTC-USD") */
  readonly canonicalId: string | null;
  
  /** Human-readable display name */
  readonly displayName: string | null;
  
  /** The LiveCategory this entity maps to */
  readonly category: LiveCategory | null;
  
  /** Confidence in the resolution (0-1) */
  readonly resolutionConfidence: number;
  
  /** Alternative resolutions if ambiguous */
  readonly alternatives?: readonly ResolvedEntityAlternative[];
  
  /** Resolution metadata */
  readonly metadata?: EntityMetadata;
}

/**
 * Alternative resolution for ambiguous entities.
 */
export interface ResolvedEntityAlternative {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly confidence: number;
  readonly reason: string;
}

/**
 * Additional metadata about a resolved entity.
 */
export interface EntityMetadata {
  /** Exchange for stocks (NYSE, NASDAQ, etc.) */
  readonly exchange?: string;
  
  /** Country/region for locations */
  readonly country?: string;
  readonly region?: string;
  
  /** Coordinates for locations */
  readonly latitude?: number;
  readonly longitude?: number;
  
  /** IANA timezone identifier */
  readonly timezoneId?: string;
  
  /** ISO currency code */
  readonly currencyCode?: string;
  
  /** Additional provider-specific data */
  readonly providerData?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLVED ENTITIES COLLECTION — Complete extraction result
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Complete result of entity extraction and resolution.
 */
export interface ResolvedEntities {
  /** All resolved entities */
  readonly entities: readonly ResolvedEntity[];
  
  /** Successfully resolved entities only */
  readonly resolved: readonly ResolvedEntity[];
  
  /** Entities that failed resolution */
  readonly failed: readonly ResolvedEntity[];
  
  /** Ambiguous entities requiring clarification */
  readonly ambiguous: readonly ResolvedEntity[];
  
  /** Trace information for debugging */
  readonly trace: EntityResolutionTrace;
}

/**
 * Trace information for entity resolution.
 */
export interface EntityResolutionTrace {
  /** Original query text */
  readonly originalQuery: string;
  
  /** Time spent on extraction (ms) */
  readonly extractionTimeMs: number;
  
  /** Time spent on resolution (ms) */
  readonly resolutionTimeMs: number;
  
  /** Total entities extracted */
  readonly extractedCount: number;
  
  /** Successfully resolved count */
  readonly resolvedCount: number;
  
  /** Resolution method used */
  readonly method: 'regex' | 'llm' | 'hybrid';
  
  /** Resolver version for debugging */
  readonly resolverVersion: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENTITY EXTRACTION CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for entity extraction.
 */
export interface EntityExtractionConfig {
  /** Entity types to extract (empty = all) */
  readonly enabledTypes: readonly EntityType[];
  
  /** Minimum confidence threshold for extraction */
  readonly minExtractionConfidence: number;
  
  /** Minimum confidence threshold for resolution */
  readonly minResolutionConfidence: number;
  
  /** Maximum entities to extract per query */
  readonly maxEntities: number;
  
  /** Whether to use LLM for extraction (vs regex-only) */
  readonly useLlmExtraction: boolean;
  
  /** Whether to attempt resolution of ambiguous entities */
  readonly resolveAmbiguous: boolean;
}

/**
 * Default entity extraction configuration.
 */
export const DEFAULT_EXTRACTION_CONFIG: EntityExtractionConfig = {
  enabledTypes: [...VALID_ENTITY_TYPES],
  minExtractionConfidence: 0.7,
  minResolutionConfidence: 0.8,
  maxEntities: 10,
  useLlmExtraction: true,
  resolveAmbiguous: true,
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if an entity was successfully resolved.
 */
export function isResolved(entity: ResolvedEntity): boolean {
  return entity.status === 'resolved' && entity.canonicalId !== null;
}

/**
 * Check if an entity is ambiguous.
 */
export function isAmbiguous(entity: ResolvedEntity): boolean {
  return entity.status === 'ambiguous';
}

/**
 * Check if an entity failed resolution.
 */
export function isFailed(entity: ResolvedEntity): boolean {
  return entity.status === 'not_found' || 
         entity.status === 'invalid' || 
         entity.status === 'unsupported';
}

/**
 * Get all unique categories from resolved entities.
 */
export function getCategories(entities: ResolvedEntities): readonly LiveCategory[] {
  const categories = new Set<LiveCategory>();
  for (const entity of entities.resolved) {
    if (entity.category) {
      categories.add(entity.category);
    }
  }
  return [...categories];
}

/**
 * Filter entities by type.
 */
export function filterByType(
  entities: readonly ResolvedEntity[],
  type: EntityType
): readonly ResolvedEntity[] {
  return entities.filter(e => e.raw.type === type);
}

/**
 * Filter entities by category.
 */
export function filterByCategory(
  entities: readonly ResolvedEntity[],
  category: LiveCategory
): readonly ResolvedEntity[] {
  return entities.filter(e => e.category === category);
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMMON ENTITY PATTERNS (for regex extraction)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Common patterns for entity extraction.
 * These are hints for regex-based extraction, not validation.
 */
export const ENTITY_PATTERNS: ReadonlyMap<EntityType, RegExp> = new Map([
  // Stock tickers: 1-5 uppercase letters, optionally prefixed with $
  ['ticker', /\$?[A-Z]{1,5}\b/g],
  
  // Crypto: Common symbols or NAME-USD pattern
  ['crypto', /\b(BTC|ETH|SOL|ADA|DOT|DOGE|XRP|LTC|LINK|UNI|AVAX|MATIC|ATOM|ALGO|[A-Z]{2,5}-USD)\b/gi],
  
  // Currency: ISO 4217 codes
  ['currency', /\b[A-Z]{3}\b/g],
  
  // Currency pair: XXX/YYY or XXX-YYY
  ['currency_pair', /\b[A-Z]{3}[\/\-][A-Z]{3}\b/g],
  
  // Timezone: IANA format or common abbreviations
  ['timezone', /\b([A-Z][a-z]+\/[A-Z][a-z_]+|UTC|GMT|EST|PST|CST|MST|EDT|PDT|CDT|MDT)\b/g],
  
  // Index: Common market indices
  ['index', /\b(S&P\s*500|NASDAQ|DOW|FTSE|DAX|NIKKEI|HSI|CAC\s*40|SPX|NDX|DJI)\b/gi],
]);

/**
 * Get the regex pattern for an entity type.
 */
export function getPatternForType(type: EntityType): RegExp | undefined {
  return ENTITY_PATTERNS.get(type);
}
