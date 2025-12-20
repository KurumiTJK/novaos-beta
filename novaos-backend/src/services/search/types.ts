// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH SERVICE TYPES — Extended Types for Authoritative Search
// Phase 4: Entity System
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DataCategory,
  LiveCategory,
  AuthoritativeCategory,
  SearchResult,
  FullSearchResult,
} from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SOURCE TIER CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Tier classification for search result sources.
 * 
 * Used to prioritize and weight sources when resolving authoritative data.
 */
export type SourceTier =
  | 'official'     // Primary authoritative source (SEC, company website, gov)
  | 'verified'     // Verified secondary source (Reuters, Bloomberg)
  | 'context'      // Provides context but not authoritative (Wikipedia, news)
  | 'general'      // General web results (blogs, forums)
  | 'disallowed';  // Explicitly blocked sources (social media for certain queries)

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
 * Returns positive if a > b, negative if a < b, 0 if equal.
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
  
  /** Normalized domain (without www, subdomain handling) */
  readonly normalizedDomain: string;
  
  /** Root domain (e.g., amazon.com from status.aws.amazon.com) */
  readonly rootDomain: string;
  
  /** Whether the result should be included in response */
  readonly include: boolean;
  
  /** Reason if excluded */
  readonly excludeReason?: string;
  
  /** Detected data values (for conflict detection) */
  readonly extractedValues?: readonly ExtractedValue[];
  
  /** Timestamp of when this was processed */
  readonly processedAt: number;
}

/**
 * Extracted value from search result (for conflict detection).
 */
export interface ExtractedValue {
  /** Type of value */
  readonly type: 'name' | 'title' | 'date' | 'number' | 'status' | 'version';
  
  /** The extracted value */
  readonly value: string;
  
  /** Confidence in extraction (0-1) */
  readonly confidence: number;
  
  /** Source location (title, snippet, url) */
  readonly source: 'title' | 'snippet' | 'url';
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH QUERY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Structured search query.
 */
export interface SearchQuery {
  /** Raw query string */
  readonly query: string;
  
  /** Detected category for the query */
  readonly category: DataCategory;
  
  /** Whether this is a live data query */
  readonly isLiveCategory: boolean;
  
  /** Whether this requires authoritative sources */
  readonly requiresAuthoritative: boolean;
  
  /** Filters to apply */
  readonly filters?: SearchFilters;
  
  /** Maximum results to return */
  readonly maxResults?: number;
  
  /** Search context */
  readonly context?: SearchContext;
}

/**
 * Search filters.
 */
export interface SearchFilters {
  /** Only include results from these domains */
  readonly allowDomains?: readonly string[];
  
  /** Exclude results from these domains */
  readonly blockDomains?: readonly string[];
  
  /** Minimum source tier to include */
  readonly minTier?: SourceTier;
  
  /** Date range filter */
  readonly dateRange?: DateRange;
  
  /** Required keywords in result */
  readonly requiredKeywords?: readonly string[];
  
  /** Excluded keywords */
  readonly excludedKeywords?: readonly string[];
  
  /** Country/region filter */
  readonly region?: string;
  
  /** Language filter */
  readonly language?: string;
}

/**
 * Date range for filtering.
 */
export interface DateRange {
  /** Start date (inclusive) */
  readonly from?: Date;
  
  /** End date (inclusive) */
  readonly to?: Date;
  
  /** Relative range (e.g., "past_week", "past_month") */
  readonly relative?: 'past_day' | 'past_week' | 'past_month' | 'past_year';
}

/**
 * Search context for better results.
 */
export interface SearchContext {
  /** User's intent */
  readonly intent?: string;
  
  /** Related entities already extracted */
  readonly entities?: readonly string[];
  
  /** Previous search queries in session */
  readonly previousQueries?: readonly string[];
  
  /** User's timezone */
  readonly timezone?: string;
  
  /** User's locale */
  readonly locale?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFLICT DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Type of conflict between sources.
 */
export type ConflictType =
  | 'value_mismatch'    // Different values for same field
  | 'date_mismatch'     // Different dates reported
  | 'source_disagree'   // Sources explicitly contradict
  | 'stale_data'        // One source has outdated info
  | 'ambiguous';        // Can't determine which is correct

/**
 * Information about a detected conflict.
 */
export interface ConflictInfo {
  /** Type of conflict */
  readonly type: ConflictType;
  
  /** Sources involved in conflict */
  readonly sources: readonly ConflictSource[];
  
  /** Field or topic in conflict */
  readonly field: string;
  
  /** Description of the conflict */
  readonly description: string;
  
  /** Severity of conflict */
  readonly severity: 'low' | 'medium' | 'high';
  
  /** Suggested resolution */
  readonly suggestedResolution?: string;
  
  /** Which source to prefer (if determinable) */
  readonly preferredSource?: string;
}

/**
 * Source involved in a conflict.
 */
export interface ConflictSource {
  /** Domain of the source */
  readonly domain: string;
  
  /** URL of the source */
  readonly url: string;
  
  /** Tier of the source */
  readonly tier: SourceTier;
  
  /** The value this source reports */
  readonly value: string;
  
  /** Date of the source (if known) */
  readonly date?: Date;
}

/**
 * Result of conflict detection.
 */
export interface ConflictDetectionResult {
  /** Whether any conflicts were detected */
  readonly hasConflicts: boolean;
  
  /** List of detected conflicts */
  readonly conflicts: readonly ConflictInfo[];
  
  /** Overall confidence in data (0-1, lower if conflicts) */
  readonly confidence: number;
  
  /** Recommendation for handling */
  readonly recommendation: ConflictRecommendation;
}

/**
 * Recommendation for handling conflicts.
 */
export type ConflictRecommendation =
  | 'use_official'         // Use official source value
  | 'use_consensus'        // Use value that most sources agree on
  | 'use_most_recent'      // Use most recently dated value
  | 'flag_for_review'      // Human review needed
  | 'cannot_determine'     // Not enough info to resolve
  | 'no_conflicts';        // No conflicts detected

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE POLICY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Policy for authoritative data retrieval.
 */
export interface AuthoritativePolicy {
  /** Category this policy applies to */
  readonly category: AuthoritativeCategory;
  
  /** Human-readable description */
  readonly description: string;
  
  /** Official/primary domains for this category */
  readonly officialDomains: readonly string[];
  
  /** Verified secondary sources */
  readonly verifiedDomains: readonly string[];
  
  /** Context-providing domains */
  readonly contextDomains: readonly string[];
  
  /** Explicitly disallowed domains */
  readonly disallowedDomains: readonly string[];
  
  /** How to handle disagreement between sources */
  readonly disagreementHandling: DisagreementHandling;
  
  /** Minimum number of sources required for confidence */
  readonly minSources: number;
  
  /** Whether consensus is required */
  readonly requireConsensus: boolean;
  
  /** Maximum age of acceptable data */
  readonly maxDataAgeDays?: number;
  
  /** Custom validation rules */
  readonly validationRules?: readonly ValidationRule[];
}

/**
 * How to handle disagreement between sources.
 */
export type DisagreementHandling =
  | 'prefer_official'      // Always use official source if available
  | 'require_consensus'    // Need multiple sources to agree
  | 'flag_conflict'        // Flag for user review
  | 'use_most_recent'      // Use most recently dated
  | 'fail_safe';           // Refuse to provide if conflict

/**
 * Custom validation rule.
 */
export interface ValidationRule {
  /** Rule identifier */
  readonly id: string;
  
  /** Description of what this rule checks */
  readonly description: string;
  
  /** Field this rule applies to */
  readonly field: string;
  
  /** Regex pattern to validate */
  readonly pattern?: RegExp;
  
  /** Required format */
  readonly format?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// POLICY VALIDATION RESULT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Result of validating search results against an authoritative policy.
 */
export interface PolicyValidationResult {
  /** Whether the results pass the policy */
  readonly valid: boolean;
  
  /** Processed results with tier assignments */
  readonly results: readonly SearchResultWithMeta[];
  
  /** Official source results */
  readonly officialResults: readonly SearchResultWithMeta[];
  
  /** Verified source results */
  readonly verifiedResults: readonly SearchResultWithMeta[];
  
  /** Context source results */
  readonly contextResults: readonly SearchResultWithMeta[];
  
  /** Excluded results */
  readonly excludedResults: readonly SearchResultWithMeta[];
  
  /** Conflict detection result */
  readonly conflictDetection: ConflictDetectionResult;
  
  /** Overall confidence (0-1) */
  readonly confidence: number;
  
  /** Warnings about the results */
  readonly warnings: readonly string[];
  
  /** Errors that would prevent use */
  readonly errors: readonly string[];
  
  /** Recommended action */
  readonly recommendation: PolicyRecommendation;
}

/**
 * Recommended action based on policy validation.
 */
export interface PolicyRecommendation {
  /** Action to take */
  readonly action: 'proceed' | 'proceed_with_caution' | 'require_verification' | 'reject';
  
  /** Reason for recommendation */
  readonly reason: string;
  
  /** Suggested next steps */
  readonly nextSteps?: readonly string[];
  
  /** Sources to cite if proceeding */
  readonly sourcesToCite?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// FILTERED RESULTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Results after domain filtering.
 */
export interface FilteredResults {
  /** All processed results */
  readonly all: readonly SearchResultWithMeta[];
  
  /** Included results */
  readonly included: readonly SearchResultWithMeta[];
  
  /** Excluded results */
  readonly excluded: readonly SearchResultWithMeta[];
  
  /** Results by tier */
  readonly byTier: Readonly<Record<SourceTier, readonly SearchResultWithMeta[]>>;
  
  /** Filter statistics */
  readonly stats: FilterStats;
}

/**
 * Statistics about filtering.
 */
export interface FilterStats {
  /** Total results processed */
  readonly total: number;
  
  /** Results included */
  readonly included: number;
  
  /** Results excluded */
  readonly excluded: number;
  
  /** Breakdown by exclusion reason */
  readonly excludedByReason: Readonly<Record<string, number>>;
  
  /** Breakdown by tier */
  readonly byTier: Readonly<Record<SourceTier, number>>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DOMAIN INFO
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Information about a domain.
 */
export interface DomainInfo {
  /** Original domain from URL */
  readonly original: string;
  
  /** Normalized domain (lowercase, no www) */
  readonly normalized: string;
  
  /** Root domain (e.g., google.com from docs.google.com) */
  readonly root: string;
  
  /** Subdomain if any */
  readonly subdomain?: string;
  
  /** TLD (e.g., .com, .gov, .org) */
  readonly tld: string;
  
  /** Whether this is a government domain */
  readonly isGovernment: boolean;
  
  /** Whether this is an educational domain */
  readonly isEducational: boolean;
  
  /** Known organization (if recognized) */
  readonly organization?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a tier is authoritative (official or verified).
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
