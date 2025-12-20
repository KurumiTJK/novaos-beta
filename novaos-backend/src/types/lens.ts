// ═══════════════════════════════════════════════════════════════════════════════
// LENS — Lens Gate Types (CORRECTED to match actual code)
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory, DataCategory } from './categories.js';
import type { DataNeedClassification } from './data-need.js';
import type { NumericToken, NumericTokenSet, ResponseConstraints, ContentConstraints } from './constraints.js';
import type { ProviderResult, ProviderData, ProviderOkResult } from './provider-results.js';
import type { ResolvedEntities } from './entities.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LENS MODE
// ─────────────────────────────────────────────────────────────────────────────────

export type LensMode =
  | 'passthrough'
  | 'live_fetch'
  | 'degraded'
  | 'blocked'
  | 'verification';

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT SOURCE
// ─────────────────────────────────────────────────────────────────────────────────

export type ContextSource =
  | 'provider'
  | 'cache'
  | 'fallback'
  | 'user'
  | 'system';

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT ITEM
// ─────────────────────────────────────────────────────────────────────────────────

export interface ContextItem {
  readonly id?: string;
  readonly category: LiveCategory;
  readonly source: ContextSource;
  readonly content: string;
  readonly title?: string;
  readonly fetchedAt: number;
  readonly freshnessMs?: number;
  readonly confidence?: number;
  readonly relevance?: number;
  readonly tokens?: readonly NumericToken[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly isStale?: boolean;
  readonly stalenessWarning?: string;
  readonly entity?: string;
  readonly citation?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RETRIEVAL STATUS
// ─────────────────────────────────────────────────────────────────────────────────

export type RetrievalStatus =
  | 'success'
  | 'partial'
  | 'failed'
  | 'skipped'
  | 'cached';

// ─────────────────────────────────────────────────────────────────────────────────
// CATEGORY RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export interface CategoryResult {
  readonly category: LiveCategory;
  readonly type?: LiveCategory;
  readonly status: RetrievalStatus;
  readonly providerResult?: ProviderResult;
  readonly tokens?: readonly NumericToken[];
  readonly latencyMs: number;
  readonly error?: string;
  readonly cached?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RETRIEVAL OUTCOME
// ─────────────────────────────────────────────────────────────────────────────────

export interface RetrievalOutcome {
  readonly successfulData: readonly CategoryResult[];
  readonly failedCategories: readonly LiveCategory[];
  readonly totalLatencyMs: number;
  readonly allSucceeded?: boolean;
  readonly anySucceeded?: boolean;
  readonly status?: RetrievalStatus;
  readonly categoryResults?: ReadonlyMap<LiveCategory, CategoryResult>;
  readonly usedStaleData?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VERIFICATION STATUS
// ─────────────────────────────────────────────────────────────────────────────────

export type VerificationStatus =
  | 'verified'
  | 'unverified'
  | 'partial'
  | 'degraded'
  | 'failed';

// ─────────────────────────────────────────────────────────────────────────────────
// LENS USER OPTION
// ─────────────────────────────────────────────────────────────────────────────────

export interface LensUserOption {
  readonly id: string;
  readonly label: string;
  readonly action: 'retry' | 'continue' | 'cancel' | 'verify' | 'proceed_degraded';
  readonly requiresAck?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RISK FACTOR
// ─────────────────────────────────────────────────────────────────────────────────

export interface RiskFactor {
  readonly type: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly description: string;
  readonly weight: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RISK ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────────────

export interface RiskAssessment {
  readonly score: number;
  readonly stakes: 'low' | 'medium' | 'high';
  readonly factors: readonly RiskFactor[];
  readonly recommendation?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EVIDENCE PACK
// ─────────────────────────────────────────────────────────────────────────────────

export interface EvidencePack {
  readonly numericTokens: NumericTokenSet;
  readonly constraints: ResponseConstraints;
  readonly formattedContext: string;
  readonly systemPromptAdditions: readonly string[];
  readonly requiredCitations: readonly string[];
  readonly sources?: readonly string[];
  readonly freshnessInfo?: {
    readonly allFresh: boolean;
    readonly stalestAgeMs?: number;
  };
  readonly freshnessWarnings?: readonly string[];
  readonly mustIncludeWarnings?: readonly string[];
  readonly contextItems?: readonly ContextItem[];
  readonly isComplete?: boolean;
  readonly incompleteReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LENS GATE RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export interface LensGateResult {
  readonly mode: LensMode;
  readonly classification: DataNeedClassification;
  readonly retrieval?: RetrievalOutcome | null;
  readonly evidence?: EvidencePack | null;
  readonly userOptions?: readonly LensUserOption[] | null;
  readonly message?: string;
  readonly entities?: ResolvedEntities;
  
  // Constraints (both names for compatibility)
  readonly constraints?: ResponseConstraints;
  readonly responseConstraints?: ResponseConstraints;
  
  // Risk and verification
  readonly riskAssessment?: RiskAssessment | null;
  readonly forceHigh?: boolean;
  readonly degradationReason?: string;
  readonly blockReason?: string;
  readonly numericPrecisionAllowed?: boolean;
  readonly actionRecommendationsAllowed?: boolean;
  readonly userMessage?: string | null;
  readonly fallbackMode?: string;
  readonly freshnessWarning?: string;
  readonly requiresFreshnessDisclaimer?: boolean;
  readonly verificationStatus?: VerificationStatus;
  readonly sources?: readonly string[];
  readonly truthMode?: string;
  
  // Provider fetch results for pipeline evidence injection
  readonly fetchResults?: readonly LensFetchResult[];
}

/**
 * Result of a single category fetch (for pipeline evidence injection).
 */
export interface LensFetchResult {
  readonly category: LiveCategory;
  readonly result: ProviderResult | null;
  readonly latencyMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LENS CONSTRAINTS (alias for compatibility)
// ─────────────────────────────────────────────────────────────────────────────────

export type LensConstraints = ResponseConstraints;

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function createEmptyEvidencePack(): EvidencePack {
  return {
    numericTokens: {
      tokens: new Map(),
      byValue: new Map(),
      byContext: new Map(),
    },
    constraints: {
      level: 'standard',
      numericPrecisionAllowed: true,
      actionRecommendationsAllowed: true,
      bannedPhrases: [],
      mustIncludeWarnings: [],
    },
    formattedContext: '',
    systemPromptAdditions: [],
    requiredCitations: [],
    freshnessWarnings: [],
    contextItems: [],
    isComplete: true,
  };
}

export function createPassthroughResult(
  classification: DataNeedClassification,
  entitiesOrMessage?: ResolvedEntities | string,
  constraintsOrUndefined?: ResponseConstraints | string
): LensGateResult {
  // Handle both old (classification, message) and new (classification, entities, constraints) signatures
  let entities: ResolvedEntities | undefined;
  let message: string | undefined;
  
  if (typeof entitiesOrMessage === 'string') {
    message = entitiesOrMessage;
  } else if (entitiesOrMessage) {
    entities = entitiesOrMessage;
    message = typeof constraintsOrUndefined === 'string' ? constraintsOrUndefined : undefined;
  }
  
  return {
    mode: 'passthrough',
    classification,
    entities,
    retrieval: null,
    evidence: createEmptyEvidencePack(),
    userOptions: [],
    message: message ?? 'No live data needed',
  };
}

export function createBlockedResult(
  classification: DataNeedClassification,
  entitiesOrReason: ResolvedEntities | string,
  reasonOrOptions?: string | readonly LensUserOption[],
  userOptions?: readonly LensUserOption[]
): LensGateResult {
  // Handle both old (classification, reason, options) and new (classification, entities, reason, options) signatures
  let entities: ResolvedEntities | undefined;
  let reason: string;
  let options: readonly LensUserOption[];
  
  if (typeof entitiesOrReason === 'string') {
    // Old signature: (classification, reason, userOptions?)
    reason = entitiesOrReason;
    options = (reasonOrOptions as readonly LensUserOption[] | undefined) ?? [];
  } else {
    // New signature: (classification, entities, reason, userOptions?)
    entities = entitiesOrReason;
    reason = (reasonOrOptions as string) ?? 'Blocked';
    options = userOptions ?? [];
  }
  
  return {
    mode: 'blocked',
    classification,
    entities,
    retrieval: null,
    evidence: createEmptyEvidencePack(),
    userOptions: options,
    message: reason,
    blockReason: reason,
  };
}

export function createDegradedResult(
  classification: DataNeedClassification,
  reason: string,
  retrieval?: RetrievalOutcome,
  userOptions: readonly LensUserOption[] = []
): LensGateResult {
  const evidence = createEmptyEvidencePack();
  return {
    mode: 'degraded',
    classification,
    retrieval: retrieval ?? null,
    evidence: {
      ...evidence,
      constraints: {
        ...evidence.constraints,
        numericPrecisionAllowed: false,
      },
      mustIncludeWarnings: ['Information may not be current'],
    },
    userOptions,
    message: reason,
    degradationReason: reason,
    numericPrecisionAllowed: false,
  };
}

export function createLiveFetchResult(
  classification: DataNeedClassification,
  retrieval: RetrievalOutcome,
  evidence: EvidencePack,
  userOptions: readonly LensUserOption[] = []
): LensGateResult {
  return {
    mode: 'live_fetch',
    classification,
    retrieval,
    evidence,
    userOptions,
    message: 'Live data retrieved successfully',
    numericPrecisionAllowed: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

export function getConstraints(result: LensGateResult): ResponseConstraints | undefined {
  return result.constraints ?? result.evidence?.constraints ?? undefined;
}

export function isBlocked(result: LensGateResult): boolean {
  return result.mode === 'blocked';
}

export function isDegraded(result: LensGateResult): boolean {
  return result.mode === 'degraded';
}

export function isPassthrough(result: LensGateResult): boolean {
  return result.mode === 'passthrough';
}

export function isLiveFetch(result: LensGateResult): boolean {
  return result.mode === 'live_fetch';
}

export function hasEvidence(result: LensGateResult): boolean {
  if (!result.evidence) return false;
  return (result.evidence.numericTokens?.tokens?.size ?? 0) > 0;
}

export function getTokenCount(result: LensGateResult): number {
  if (!result.evidence) return 0;
  return result.evidence.numericTokens?.tokens?.size ?? 0;
}