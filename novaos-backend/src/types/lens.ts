// ═══════════════════════════════════════════════════════════════════════════════
// LENS TYPES — Live Data Router Lens Gate Results
// Complete output types for the enhanced Lens gate with live data routing
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory, DataCategory } from './categories.js';
import type { ProviderResult, ProviderData } from './provider-results.js';
import type { ResponseConstraints, NumericTokenSet } from './constraints.js';
import type { ResolvedEntities } from './entities.js';
import type { DataNeedClassification, TruthMode, FallbackMode } from './data-need.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT ITEM — Individual piece of retrieved context
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Source type for context items.
 */
export type ContextSource =
  | 'provider'      // Live data provider (market, weather, etc.)
  | 'web_search'    // Web search result
  | 'authoritative' // Verified authoritative source
  | 'cache'         // Cached data (with staleness info)
  | 'user'          // User-provided context
  | 'conversation'; // Previous conversation context

/**
 * Individual piece of context for the model.
 */
export interface ContextItem {
  /** Unique identifier for this context item */
  readonly id: string;
  
  /** Source of this context */
  readonly source: ContextSource;
  
  /** The actual content (text representation) */
  readonly content: string;
  
  /** Category this context relates to */
  readonly category: DataCategory;
  
  /** Relevance score (0-1) */
  readonly relevance: number;
  
  /** When this data was fetched/created */
  readonly fetchedAt: number;
  
  /** Whether this data is considered stale */
  readonly isStale: boolean;
  
  /** Staleness warning if applicable */
  readonly stalenessWarning?: string;
  
  /** Citation/attribution for this context */
  readonly citation?: string;
  
  /** URL source if applicable */
  readonly sourceUrl?: string;
  
  /** Associated entity (ticker, city, etc.) */
  readonly entity?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RETRIEVAL OUTCOME — Result of data retrieval attempt
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Status of retrieval attempt.
 */
export type RetrievalStatus =
  | 'success'           // All data retrieved successfully
  | 'partial'           // Some data retrieved, some failed
  | 'stale'             // Using stale cached data
  | 'degraded'          // Proceeding without live data
  | 'failed'            // Complete failure
  | 'skipped';          // Retrieval not needed (local mode)

/**
 * All valid retrieval statuses as a Set.
 */
export const VALID_RETRIEVAL_STATUSES: ReadonlySet<RetrievalStatus> = new Set([
  'success',
  'partial',
  'stale',
  'degraded',
  'failed',
  'skipped',
]);

/**
 * Result of attempting to retrieve data for a category.
 */
export interface CategoryRetrievalResult {
  /** The category this result is for */
  readonly category: LiveCategory;
  
  /** Provider result (success or error) */
  readonly providerResult: ProviderResult;
  
  /** Entity that was queried */
  readonly entity: string;
  
  /** Time taken for this retrieval */
  readonly latencyMs: number;
  
  /** Whether fallback was used */
  readonly usedFallback: boolean;
  
  /** Fallback provider if used */
  readonly fallbackProvider?: string;
}

/**
 * Complete outcome of all retrieval attempts.
 */
export interface RetrievalOutcome {
  /** Overall retrieval status */
  readonly status: RetrievalStatus;
  
  /** Results per category */
  readonly categoryResults: ReadonlyMap<LiveCategory, CategoryRetrievalResult>;
  
  /** Successfully retrieved data */
  readonly successfulData: readonly ProviderData[];
  
  /** Categories that failed retrieval */
  readonly failedCategories: readonly LiveCategory[];
  
  /** Total retrieval time */
  readonly totalLatencyMs: number;
  
  /** Whether any stale data was used */
  readonly usedStaleData: boolean;
  
  /** Degradation reason if status is 'degraded' */
  readonly degradationReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EVIDENCE PACK — Bundled data for model consumption
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Complete evidence package for the model.
 * Contains all retrieved data, context, and constraints.
 */
export interface EvidencePack {
  /** All context items for the model */
  readonly contextItems: readonly ContextItem[];
  
  /** Allowed numeric tokens for response */
  readonly numericTokens: NumericTokenSet;
  
  /** Response constraints derived from evidence */
  readonly constraints: ResponseConstraints;
  
  /** Formatted context string for model injection */
  readonly formattedContext: string;
  
  /** System prompt additions based on evidence */
  readonly systemPromptAdditions: readonly string[];
  
  /** Citations to include in response */
  readonly requiredCitations: readonly string[];
  
  /** Freshness warnings to include */
  readonly freshnessWarnings: readonly string[];
  
  /** Whether evidence is complete for the query */
  readonly isComplete: boolean;
  
  /** Reason if evidence is incomplete */
  readonly incompleteReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LENS GATE RESULT — Complete output of enhanced Lens gate
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Lens gate operating mode after classification.
 */
export type LensMode =
  | 'passthrough'   // No live data needed, pass through
  | 'live_fetch'    // Fetching from live providers
  | 'verification'  // Verifying against authoritative sources
  | 'degraded'      // Operating in degraded mode (no precise numbers)
  | 'blocked';      // Blocked pending user action

/**
 * All valid lens modes as a Set.
 */
export const VALID_LENS_MODES: ReadonlySet<LensMode> = new Set([
  'passthrough',
  'live_fetch',
  'verification',
  'degraded',
  'blocked',
]);

/**
 * User option for blocked/await states.
 */
export interface LensUserOption {
  /** Unique identifier for this option */
  readonly id: string;
  
  /** Display label for the option */
  readonly label: string;
  
  /** Whether this option requires explicit acknowledgment */
  readonly requiresAck: boolean;
  
  /** Action to take if selected */
  readonly action: 'retry' | 'proceed_degraded' | 'provide_source' | 'cancel';
}

/**
 * Complete result from the enhanced Lens gate.
 * This is the primary output type for the Live Data Router.
 */
export interface LensGateResult {
  // ─────────────────────────────────────────────────────────────────────────────
  // Classification
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Data need classification that drove routing */
  readonly classification: DataNeedClassification;
  
  /** Resolved entities from the query */
  readonly entities: ResolvedEntities;
  
  /** Operating mode */
  readonly mode: LensMode;
  
  /** Truth mode used */
  readonly truthMode: TruthMode;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Retrieval results
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Outcome of data retrieval */
  readonly retrieval: RetrievalOutcome | null;
  
  /** Evidence pack for the model (null if passthrough/blocked) */
  readonly evidence: EvidencePack | null;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Constraints for downstream gates
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Response constraints for Model gate */
  readonly responseConstraints: ResponseConstraints;
  
  /** Whether numeric precision is allowed */
  readonly numericPrecisionAllowed: boolean;
  
  /** Whether action recommendations are allowed */
  readonly actionRecommendationsAllowed: boolean;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // User interaction (for blocked/degraded states)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** User options if blocked */
  readonly userOptions: readonly LensUserOption[] | null;
  
  /** Message to show user if action needed */
  readonly userMessage: string | null;
  
  /** Fallback mode if primary fails */
  readonly fallbackMode: FallbackMode;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Warnings and metadata
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Freshness warning to include in response */
  readonly freshnessWarning: string | null;
  
  /** Whether response should include data freshness disclaimer */
  readonly requiresFreshnessDisclaimer: boolean;
  
  /** Verification status for authoritative queries */
  readonly verificationStatus: 'verified' | 'unverified' | 'partial' | 'not_applicable';
  
  /** Sources used (for citation) */
  readonly sources: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// LENS GATE RESULT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a passthrough result (no live data needed).
 */
export function createPassthroughResult(
  classification: DataNeedClassification,
  entities: ResolvedEntities,
  defaultConstraints: ResponseConstraints
): LensGateResult {
  return {
    classification,
    entities,
    mode: 'passthrough',
    truthMode: 'local',
    retrieval: null,
    evidence: null,
    responseConstraints: defaultConstraints,
    numericPrecisionAllowed: true,
    actionRecommendationsAllowed: true,
    userOptions: null,
    userMessage: null,
    fallbackMode: 'degrade',
    freshnessWarning: null,
    requiresFreshnessDisclaimer: false,
    verificationStatus: 'not_applicable',
    sources: [],
  };
}

/**
 * Create a degraded result (live data unavailable).
 */
export function createDegradedResult(
  classification: DataNeedClassification,
  entities: ResolvedEntities,
  degradedConstraints: ResponseConstraints,
  reason: string
): LensGateResult {
  return {
    classification,
    entities,
    mode: 'degraded',
    truthMode: classification.truthMode,
    retrieval: {
      status: 'degraded',
      categoryResults: new Map(),
      successfulData: [],
      failedCategories: [...classification.liveCategories],
      totalLatencyMs: 0,
      usedStaleData: false,
      degradationReason: reason,
    },
    evidence: null,
    responseConstraints: degradedConstraints,
    numericPrecisionAllowed: false,
    actionRecommendationsAllowed: false,
    userOptions: null,
    userMessage: null,
    fallbackMode: 'degrade',
    freshnessWarning: 'Unable to retrieve current data. Response will not include precise numbers.',
    requiresFreshnessDisclaimer: true,
    verificationStatus: 'unverified',
    sources: [],
  };
}

/**
 * Create a blocked result (user action required).
 */
export function createBlockedResult(
  classification: DataNeedClassification,
  entities: ResolvedEntities,
  userMessage: string,
  userOptions: readonly LensUserOption[]
): LensGateResult {
  return {
    classification,
    entities,
    mode: 'blocked',
    truthMode: classification.truthMode,
    retrieval: null,
    evidence: null,
    responseConstraints: {
      numericPrecisionAllowed: false,
      allowedTokens: null,
      numericExemptions: {
        allowYears: false,
        allowDates: false,
        allowSmallIntegers: false,
        smallIntegerMax: 0,
        allowExplanatoryPercentages: false,
        allowOrdinals: false,
        allowInCodeBlocks: false,
        allowInQuotes: false,
        customPatterns: [],
      },
      actionRecommendationsAllowed: false,
      bannedPhrases: [],
      requiredPhrases: [],
      freshnessWarningRequired: false,
      requiredCitations: [],
      level: 'strict',
      reason: 'Blocked pending user action',
      triggeredByCategories: [],
    },
    numericPrecisionAllowed: false,
    actionRecommendationsAllowed: false,
    userOptions,
    userMessage,
    fallbackMode: 'refuse',
    freshnessWarning: null,
    requiresFreshnessDisclaimer: false,
    verificationStatus: 'unverified',
    sources: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if Lens result allows proceeding with response generation.
 */
export function canProceed(result: LensGateResult): boolean {
  return result.mode !== 'blocked';
}

/**
 * Check if Lens result has evidence for the model.
 */
export function hasEvidence(result: LensGateResult): result is LensGateResult & { evidence: EvidencePack } {
  return result.evidence !== null;
}

/**
 * Check if Lens result requires user interaction.
 */
export function requiresUserAction(result: LensGateResult): boolean {
  return result.mode === 'blocked' && result.userOptions !== null && result.userOptions.length > 0;
}

/**
 * Check if Lens result is operating in degraded mode.
 */
export function isDegraded(result: LensGateResult): boolean {
  return result.mode === 'degraded' || !result.numericPrecisionAllowed;
}

/**
 * Get all successful provider data from a Lens result.
 */
export function getProviderData(result: LensGateResult): readonly ProviderData[] {
  return result.retrieval?.successfulData ?? [];
}

/**
 * Get freshness warnings from a Lens result.
 */
export function getFreshnessWarnings(result: LensGateResult): readonly string[] {
  const warnings: string[] = [];
  
  if (result.freshnessWarning) {
    warnings.push(result.freshnessWarning);
  }
  
  if (result.evidence?.freshnessWarnings) {
    warnings.push(...result.evidence.freshnessWarnings);
  }
  
  return warnings;
}
