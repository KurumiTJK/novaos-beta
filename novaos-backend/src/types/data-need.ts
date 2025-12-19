// ═══════════════════════════════════════════════════════════════════════════════
// DATA NEED TYPES — Live Data Router Classification Results
// Determines how the Lens gate routes requests for data retrieval
// ═══════════════════════════════════════════════════════════════════════════════

import type { DataCategory, LiveCategory, AuthoritativeCategory } from './categories.js';
import type { ResolvedEntities } from './entities.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TRUTH MODE — How to source the answer
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Determines the data sourcing strategy for a query.
 */
export type TruthMode =
  | 'local'                 // Use model's training data (no external fetch)
  | 'live_feed'             // Fetch from real-time provider APIs
  | 'authoritative_verify'  // Verify against authoritative sources
  | 'web_research'          // General web search for current info
  | 'mixed';                // Combination of sources needed

/**
 * All valid truth modes as a Set for runtime validation.
 */
export const VALID_TRUTH_MODES: ReadonlySet<TruthMode> = new Set([
  'local',
  'live_feed',
  'authoritative_verify',
  'web_research',
  'mixed',
]);

/**
 * Type guard for TruthMode.
 */
export function isTruthMode(value: unknown): value is TruthMode {
  return typeof value === 'string' && VALID_TRUTH_MODES.has(value as TruthMode);
}

/**
 * Description of each truth mode for logging/debugging.
 */
export const TRUTH_MODE_DESCRIPTIONS: ReadonlyMap<TruthMode, string> = new Map([
  ['local', 'Answer from model knowledge - no external data needed'],
  ['live_feed', 'Fetch real-time data from provider APIs'],
  ['authoritative_verify', 'Verify against authoritative sources before responding'],
  ['web_research', 'Search web for current information'],
  ['mixed', 'Combine multiple data sources for complete answer'],
]);

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK MODE — What to do when primary source fails
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fallback strategy when primary data source is unavailable.
 */
export type FallbackMode =
  | 'degrade'           // Proceed with degraded response (no precise numbers)
  | 'stale'             // Use cached/stale data with warning
  | 'alternative'       // Try alternative provider
  | 'refuse'            // Refuse to answer without data
  | 'acknowledge';      // Acknowledge inability and offer options

/**
 * All valid fallback modes as a Set for runtime validation.
 */
export const VALID_FALLBACK_MODES: ReadonlySet<FallbackMode> = new Set([
  'degrade',
  'stale',
  'alternative',
  'refuse',
  'acknowledge',
]);

/**
 * Type guard for FallbackMode.
 */
export function isFallbackMode(value: unknown): value is FallbackMode {
  return typeof value === 'string' && VALID_FALLBACK_MODES.has(value as FallbackMode);
}

/**
 * Default fallback mode per truth mode.
 */
export const DEFAULT_FALLBACK_MODES: ReadonlyMap<TruthMode, FallbackMode> = new Map([
  ['local', 'degrade'],           // Local doesn't need fallback
  ['live_feed', 'degrade'],       // Degrade to no-numbers response
  ['authoritative_verify', 'acknowledge'], // Acknowledge we can't verify
  ['web_research', 'degrade'],    // Degrade if web unavailable
  ['mixed', 'degrade'],           // Partial answer better than none
]);

// ─────────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION CONFIDENCE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Confidence level in the data need classification.
 */
export type ClassificationConfidence = 'high' | 'medium' | 'low';

/**
 * Numeric thresholds for classification confidence.
 */
export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.65,
  low: 0.0,
} as const;

/**
 * Convert numeric confidence to categorical.
 */
export function toClassificationConfidence(score: number): ClassificationConfidence {
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────────────────────────────
// DATA NEED CLASSIFICATION — Core classification result
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Complete classification of a query's data needs.
 * This is the primary output of the Lens classifier.
 */
export interface DataNeedClassification {
  // ─────────────────────────────────────────────────────────────────────────────
  // Primary classification
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** How to source the answer */
  readonly truthMode: TruthMode;
  
  /** Primary data category detected */
  readonly primaryCategory: DataCategory;
  
  /** All data categories detected (may be multiple) */
  readonly categories: readonly DataCategory[];
  
  /** Live categories requiring provider fetches */
  readonly liveCategories: readonly LiveCategory[];
  
  /** Authoritative categories requiring verification */
  readonly authoritativeCategories: readonly AuthoritativeCategory[];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Entity information
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Resolved entities from the query */
  readonly entities: ResolvedEntities;
  
  /** Whether all required entities were resolved */
  readonly entitiesComplete: boolean;
  
  /** Entities that need user clarification */
  readonly entitiesNeedingClarification: readonly string[];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Confidence & reasoning
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Overall confidence in this classification */
  readonly confidence: ClassificationConfidence;
  
  /** Numeric confidence score (0-1) */
  readonly confidenceScore: number;
  
  /** Human-readable reasoning for the classification */
  readonly reasoning: string;
  
  /** Classification method used */
  readonly method: 'rule_based' | 'llm' | 'hybrid';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Fallback & constraints
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** What to do if primary source fails */
  readonly fallbackMode: FallbackMode;
  
  /** Whether freshness is critical (affects caching) */
  readonly freshnessCritical: boolean;
  
  /** Maximum acceptable data age in milliseconds */
  readonly maxDataAgeMs: number | null;
  
  /** Whether numeric precision is required in response */
  readonly requiresNumericPrecision: boolean;
  
  /** Whether action recommendations are appropriate */
  readonly allowsActionRecommendations: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION SIGNALS — Inputs to the classifier
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Signals extracted from the query that inform classification.
 */
export interface ClassificationSignals {
  /** Temporal indicators (now, current, today, latest) */
  readonly temporalSignals: readonly TemporalSignal[];
  
  /** Price/value indicators */
  readonly priceSignals: readonly string[];
  
  /** Verification indicators (is it true, confirm, verify) */
  readonly verificationSignals: readonly string[];
  
  /** Comparison indicators (vs, compare, difference) */
  readonly comparisonSignals: readonly string[];
  
  /** Historical indicators (was, used to be, in 2020) */
  readonly historicalSignals: readonly string[];
  
  /** Question type detected */
  readonly questionType: QuestionType;
}

/**
 * Temporal signal with specificity.
 */
export interface TemporalSignal {
  readonly text: string;
  readonly type: 'realtime' | 'recent' | 'specific_date' | 'historical';
  readonly weight: number;
}

/**
 * Type of question being asked.
 */
export type QuestionType =
  | 'factual'       // What is X?
  | 'current_state' // What is X now?
  | 'comparison'    // How does X compare to Y?
  | 'historical'    // What was X in 2020?
  | 'predictive'    // What will X be?
  | 'procedural'    // How do I do X?
  | 'explanatory';  // Why is X?

/**
 * All valid question types as a Set.
 */
export const VALID_QUESTION_TYPES: ReadonlySet<QuestionType> = new Set([
  'factual',
  'current_state',
  'comparison',
  'historical',
  'predictive',
  'procedural',
  'explanatory',
]);

// ─────────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if classification requires live data fetch.
 */
export function requiresLiveFetch(classification: DataNeedClassification): boolean {
  return classification.truthMode === 'live_feed' || 
         classification.truthMode === 'mixed' ||
         classification.liveCategories.length > 0;
}

/**
 * Check if classification requires authoritative verification.
 */
export function requiresAuthoritativeVerification(classification: DataNeedClassification): boolean {
  return classification.truthMode === 'authoritative_verify' ||
         classification.truthMode === 'mixed' ||
         classification.authoritativeCategories.length > 0;
}

/**
 * Check if classification can be answered from local knowledge.
 */
export function canAnswerLocally(classification: DataNeedClassification): boolean {
  return classification.truthMode === 'local';
}

/**
 * Check if classification has unresolved entities.
 */
export function hasUnresolvedEntities(classification: DataNeedClassification): boolean {
  return !classification.entitiesComplete || 
         classification.entitiesNeedingClarification.length > 0;
}

/**
 * Get the most restrictive fallback mode for multiple categories.
 */
export function getMostRestrictiveFallback(categories: readonly DataCategory[]): FallbackMode {
  // Priority: refuse > acknowledge > degrade > stale > alternative
  const priority: FallbackMode[] = ['refuse', 'acknowledge', 'degrade', 'stale', 'alternative'];
  
  let mostRestrictive: FallbackMode = 'alternative';
  
  for (const category of categories) {
    const mode = DEFAULT_FALLBACK_MODES.get(category as TruthMode) ?? 'degrade';
    const currentIndex = priority.indexOf(mostRestrictive);
    const newIndex = priority.indexOf(mode);
    if (newIndex < currentIndex) {
      mostRestrictive = mode;
    }
  }
  
  return mostRestrictive;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION RESULT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a local-only classification (no external data needed).
 */
export function createLocalClassification(
  reasoning: string,
  entities: ResolvedEntities
): DataNeedClassification {
  return {
    truthMode: 'local',
    primaryCategory: 'general',
    categories: ['general'],
    liveCategories: [],
    authoritativeCategories: [],
    entities,
    entitiesComplete: true,
    entitiesNeedingClarification: [],
    confidence: 'high',
    confidenceScore: 0.95,
    reasoning,
    method: 'rule_based',
    fallbackMode: 'degrade',
    freshnessCritical: false,
    maxDataAgeMs: null,
    requiresNumericPrecision: false,
    allowsActionRecommendations: true,
  };
}

/**
 * Create a live feed classification (requires provider APIs).
 */
export function createLiveFeedClassification(
  liveCategories: readonly LiveCategory[],
  entities: ResolvedEntities,
  reasoning: string,
  confidenceScore: number
): DataNeedClassification {
  const primaryCategory = liveCategories[0] ?? 'general';
  
  return {
    truthMode: 'live_feed',
    primaryCategory,
    categories: [...liveCategories],
    liveCategories,
    authoritativeCategories: [],
    entities,
    entitiesComplete: entities.failed.length === 0,
    entitiesNeedingClarification: entities.ambiguous.map(e => e.raw.rawText),
    confidence: toClassificationConfidence(confidenceScore),
    confidenceScore,
    reasoning,
    method: 'hybrid',
    fallbackMode: 'degrade',
    freshnessCritical: true,
    maxDataAgeMs: 60_000, // 1 minute default
    requiresNumericPrecision: true,
    allowsActionRecommendations: false, // No buy/sell recommendations with live data
  };
}

/**
 * Create an authoritative verification classification.
 */
export function createAuthoritativeClassification(
  authoritativeCategories: readonly AuthoritativeCategory[],
  entities: ResolvedEntities,
  reasoning: string,
  confidenceScore: number
): DataNeedClassification {
  const primaryCategory = authoritativeCategories[0] ?? 'general';
  
  return {
    truthMode: 'authoritative_verify',
    primaryCategory,
    categories: [...authoritativeCategories],
    liveCategories: [],
    authoritativeCategories,
    entities,
    entitiesComplete: entities.failed.length === 0,
    entitiesNeedingClarification: entities.ambiguous.map(e => e.raw.rawText),
    confidence: toClassificationConfidence(confidenceScore),
    confidenceScore,
    reasoning,
    method: 'hybrid',
    fallbackMode: 'acknowledge',
    freshnessCritical: false,
    maxDataAgeMs: 86_400_000, // 24 hours for authoritative
    requiresNumericPrecision: false,
    allowsActionRecommendations: true,
  };
}
