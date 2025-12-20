// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH SERVICE TYPES — Provider Interfaces and Extended Types
// Phase 4: Entity System
// PATCHED: Removed non-existent './search-types.js' import
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DataCategory,
  LiveCategory,
  AuthoritativeCategory,
} from '../../types/categories.js';

// REMOVED: export * from './search-types.js'; - this file doesn't exist

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH PROVIDER INTERFACE — Used by Tavily and Google CSE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Search options for provider calls.
 */
export interface SearchOptions {
  /** Maximum results to return */
  readonly maxResults?: number;
  
  /** Timeout in milliseconds */
  readonly timeoutMs?: number;
  
  /** Search depth (for Tavily) */
  readonly searchDepth?: 'basic' | 'advanced';
  
  /** Include synthesized answer */
  readonly includeAnswer?: boolean;
  
  /** Freshness filter */
  readonly freshness?: 'day' | 'week' | 'month' | 'year';
  
  /** Only include results from these domains */
  readonly includeDomains?: readonly string[];
  
  /** Exclude results from these domains */
  readonly excludeDomains?: readonly string[];
}

/**
 * A single search result from a provider.
 */
export interface SearchResult {
  /** Page title */
  readonly title: string;
  
  /** Full URL */
  readonly url: string;
  
  /** Text snippet from the page */
  readonly snippet: string;
  
  /** Source domain (optional) */
  readonly source?: string;
  
  /** Published date if known */
  readonly publishedAt?: string;
}

/**
 * Response from a search provider.
 */
export interface SearchResponse {
  /** Original query */
  readonly query: string;
  
  /** Search results */
  readonly results: readonly SearchResult[];
  
  /** Total results available (may be more than returned) */
  readonly totalResults?: number;
  
  /** When the search was performed */
  readonly retrievedAt: string;
  
  /** Provider name */
  readonly provider: string;
  
  /** Whether the search was successful */
  readonly success: boolean;
  
  /** Error message if unsuccessful */
  readonly error?: string;
  
  /** Synthesized answer (for providers that support it) */
  readonly answer?: string;
}

/**
 * Interface for search providers.
 */
export interface SearchProvider {
  /** Provider name */
  readonly name: string;
  
  /** Check if provider is available (has credentials) */
  isAvailable(): boolean;
  
  /** Execute a search */
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SOURCE TIER CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Tier classification for search result sources.
 */
export type SourceTier =
  | 'official'     // Primary authoritative source
  | 'verified'     // Verified secondary source
  | 'context'      // Provides context but not authoritative
  | 'general'      // General web results
  | 'disallowed';  // Explicitly blocked sources

/**
 * All valid source tiers.
 */
export const VALID_SOURCE_TIERS: ReadonlySet<SourceTier> = new Set([
  'official',
  'verified',
  'context',
  'general',
  'disallowed',
]);

/**
 * Tier priority (higher = more authoritative).
 */
export const TIER_PRIORITY: Readonly<Record<SourceTier, number>> = {
  official: 100,
  verified: 80,
  context: 50,
  general: 20,
  disallowed: 0,
};

/**
 * Get numeric priority for a tier.
 */
export function getTierPriority(tier: SourceTier): number {
  return TIER_PRIORITY[tier];
}

/**
 * Compare two tiers (for sorting).
 */
export function compareTiers(a: SourceTier, b: SourceTier): number {
  return TIER_PRIORITY[a] - TIER_PRIORITY[b];
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH RESULT WITH METADATA
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Search result with additional metadata for authoritative processing.
 */
export interface SearchResultWithMeta {
  /** Original search result */
  readonly result: SearchResult;
  
  /** Assigned source tier */
  readonly tier: SourceTier;
  
  /** Whether this is from an official/authoritative domain */
  readonly isAuthoritative: boolean;
  
  /** Normalized domain */
  readonly normalizedDomain: string;
  
  /** Root domain */
  readonly rootDomain: string;
  
  /** Whether to include in response */
  readonly include: boolean;
  
  /** Reason if excluded */
  readonly excludeReason?: string;
  
  /** Detected data values */
  readonly extractedValues?: readonly ExtractedValue[];
  
  /** Processing timestamp */
  readonly processedAt: number;
}

/**
 * Extracted value from search result.
 */
export interface ExtractedValue {
  readonly type: 'name' | 'title' | 'date' | 'number' | 'status' | 'version';
  readonly value: string;
  readonly confidence: number;
  readonly source: 'title' | 'snippet' | 'url';
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH QUERY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Structured search query.
 */
export interface SearchQuery {
  readonly query: string;
  readonly category: DataCategory;
  readonly isLiveCategory: boolean;
  readonly requiresAuthoritative: boolean;
  readonly filters?: SearchFilters;
  readonly maxResults?: number;
  readonly context?: SearchContext;
}

/**
 * Search filters.
 */
export interface SearchFilters {
  readonly allowDomains?: readonly string[];
  readonly blockDomains?: readonly string[];
  readonly minTier?: SourceTier;
  readonly dateRange?: DateRange;
  readonly requiredKeywords?: readonly string[];
  readonly excludedKeywords?: readonly string[];
  readonly region?: string;
  readonly language?: string;
}

/**
 * Date range for filtering.
 */
export interface DateRange {
  readonly from?: Date;
  readonly to?: Date;
  readonly relative?: 'past_day' | 'past_week' | 'past_month' | 'past_year';
}

/**
 * Search context.
 */
export interface SearchContext {
  readonly intent?: string;
  readonly entities?: readonly string[];
  readonly previousQueries?: readonly string[];
  readonly timezone?: string;
  readonly locale?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFLICT DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Type of conflict between sources.
 */
export type ConflictType =
  | 'value_mismatch'
  | 'date_mismatch'
  | 'source_disagree'
  | 'stale_data'
  | 'ambiguous';

/**
 * Information about a detected conflict.
 */
export interface ConflictInfo {
  readonly type: ConflictType;
  readonly sources: readonly ConflictSource[];
  readonly field: string;
  readonly description: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly suggestedResolution?: string;
  readonly preferredSource?: string;
}

/**
 * Source involved in a conflict.
 */
export interface ConflictSource {
  readonly domain: string;
  readonly url: string;
  readonly tier: SourceTier;
  readonly value: string;
  readonly date?: Date;
}

/**
 * Result of conflict detection.
 */
export interface ConflictDetectionResult {
  readonly hasConflicts: boolean;
  readonly conflicts: readonly ConflictInfo[];
  readonly confidence: number;
  readonly recommendation: ConflictRecommendation;
}

/**
 * Recommendation for handling conflicts.
 * PATCHED: Added 'no_conflicts' as valid value
 */
export type ConflictRecommendation =
  | 'use_official'
  | 'use_consensus'
  | 'use_most_recent'
  | 'flag_for_review'
  | 'cannot_determine'
  | 'no_conflicts';

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE POLICY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * How to handle disagreement between sources.
 */
export type DisagreementHandling =
  | 'prefer_official'
  | 'require_consensus'
  | 'flag_conflict'
  | 'use_most_recent'
  | 'fail_safe';

/**
 * Custom validation rule.
 */
export interface ValidationRule {
  readonly id: string;
  readonly description: string;
  readonly field: string;
  readonly pattern?: RegExp;
  readonly format?: string;
}

/**
 * Policy for authoritative data retrieval.
 */
export interface AuthoritativePolicy {
  readonly category: AuthoritativeCategory;
  readonly description: string;
  readonly officialDomains: readonly string[];
  readonly verifiedDomains: readonly string[];
  readonly contextDomains: readonly string[];
  readonly disallowedDomains: readonly string[];
  readonly disagreementHandling: DisagreementHandling;
  readonly minSources: number;
  readonly requireConsensus: boolean;
  readonly maxDataAgeDays?: number;
  readonly validationRules?: readonly ValidationRule[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// POLICY VALIDATION RESULT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Recommended action based on policy validation.
 */
export interface PolicyRecommendation {
  readonly action: 'proceed' | 'proceed_with_caution' | 'require_verification' | 'reject';
  readonly reason: string;
  readonly nextSteps?: readonly string[];
  readonly sourcesToCite?: readonly string[];
}

/**
 * Result of validating search results against an authoritative policy.
 */
export interface PolicyValidationResult {
  readonly valid: boolean;
  readonly results: readonly SearchResultWithMeta[];
  readonly officialResults: readonly SearchResultWithMeta[];
  readonly verifiedResults: readonly SearchResultWithMeta[];
  readonly contextResults: readonly SearchResultWithMeta[];
  readonly excludedResults: readonly SearchResultWithMeta[];
  readonly conflictDetection: ConflictDetectionResult;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly recommendation: PolicyRecommendation;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FILTERED RESULTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Statistics about filtering.
 */
export interface FilterStats {
  readonly total: number;
  readonly included: number;
  readonly excluded: number;
  readonly excludedByReason: Readonly<Record<string, number>>;
  readonly byTier: Readonly<Record<SourceTier, number>>;
}

/**
 * Results after domain filtering.
 */
export interface FilteredResults {
  readonly all: readonly SearchResultWithMeta[];
  readonly included: readonly SearchResultWithMeta[];
  readonly excluded: readonly SearchResultWithMeta[];
  readonly byTier: Readonly<Record<SourceTier, readonly SearchResultWithMeta[]>>;
  readonly stats: FilterStats;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DOMAIN INFO
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Information about a domain.
 */
export interface DomainInfo {
  readonly original: string;
  readonly normalized: string;
  readonly root: string;
  readonly subdomain?: string;
  readonly tld: string;
  readonly isGovernment: boolean;
  readonly isEducational: boolean;
  readonly organization?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a tier is authoritative.
 */
export function isAuthoritativeTier(tier: SourceTier): boolean {
  return tier === 'official' || tier === 'verified';
}

/**
 * Check if a tier should be included by default.
 */
export function isIncludedTier(tier: SourceTier): boolean {
  return tier !== 'disallowed';
}

/**
 * Check if a result has conflicts.
 */
export function hasConflicts(result: ConflictDetectionResult): boolean {
  return result.conflicts.length > 0;
}

/**
 * Check if a policy validation passed.
 */
export function isPolicyValid(result: PolicyValidationResult): boolean {
  return result.valid && result.errors.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get the highest tier from a list of results.
 */
export function getHighestTier(results: readonly SearchResultWithMeta[]): SourceTier | null {
  if (results.length === 0) return null;
  
  let highest: SourceTier = 'disallowed';
  
  for (const result of results) {
    if (compareTiers(result.tier, highest) > 0) {
      highest = result.tier;
    }
  }
  
  return highest;
}

/**
 * Filter results to only authoritative sources.
 */
export function filterAuthoritative(
  results: readonly SearchResultWithMeta[]
): readonly SearchResultWithMeta[] {
  return results.filter(r => isAuthoritativeTier(r.tier));
}

/**
 * Sort results by tier (highest first).
 */
export function sortByTier(
  results: readonly SearchResultWithMeta[]
): readonly SearchResultWithMeta[] {
  return [...results].sort((a, b) => compareTiers(b.tier, a.tier));
}

/**
 * Group results by tier.
 */
export function groupByTier(
  results: readonly SearchResultWithMeta[]
): Readonly<Record<SourceTier, readonly SearchResultWithMeta[]>> {
  const groups: Record<SourceTier, SearchResultWithMeta[]> = {
    official: [],
    verified: [],
    context: [],
    general: [],
    disallowed: [],
  };
  
  for (const result of results) {
    groups[result.tier].push(result);
  }
  
  return groups;
}
