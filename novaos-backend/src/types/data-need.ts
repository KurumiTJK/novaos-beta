// ═══════════════════════════════════════════════════════════════════════════════
// DATA NEED — Classification Types for Data Requirements (CORRECTED)
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory, AuthoritativeCategory, DataCategory } from './categories.js';
import type { ResolvedEntities } from './entities.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TRUTH MODE (includes authoritative_verify and web_research)
// ─────────────────────────────────────────────────────────────────────────────────

export type TruthMode =
  | 'local'
  | 'live_feed'
  | 'authoritative_verify'
  | 'authoritative'
  | 'verify'
  | 'web_research'
  | 'web'
  | 'research'
  | 'mixed';

export function isTruthMode(value: string): value is TruthMode {
  return [
    'local', 'live_feed', 'authoritative_verify', 'authoritative', 'verify',
    'web_research', 'web', 'research', 'mixed'
  ].includes(value);
}

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK MODE (includes all values used in code)
// ─────────────────────────────────────────────────────────────────────────────────

export type FallbackMode =
  | 'degrade'
  | 'stale'
  | 'alternative'
  | 'refuse'
  | 'acknowledge'
  | 'qualitative';

export const DEFAULT_FALLBACK_MODES: Readonly<Record<LiveCategory, FallbackMode>> = {
  market: 'degrade',
  crypto: 'degrade',
  fx: 'degrade',
  weather: 'degrade',
  time: 'refuse',
};

// ─────────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION CONFIDENCE
// ─────────────────────────────────────────────────────────────────────────────────

export type ClassificationConfidence =
  | 'high'
  | 'medium'
  | 'low';

export function toClassificationConfidence(score: number): ClassificationConfidence {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION METHOD (includes all values used in code)
// ─────────────────────────────────────────────────────────────────────────────────

export type ClassificationMethod =
  | 'pattern'
  | 'rule_based'
  | 'llm'
  | 'hybrid'
  | 'llm_hybrid'
  | 'override';

// ─────────────────────────────────────────────────────────────────────────────────
// DATA NEED CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface DataNeedClassification {
  readonly truthMode: TruthMode;
  readonly liveCategories: readonly LiveCategory[];
  readonly authoritativeCategories: readonly AuthoritativeCategory[];
  readonly categories?: readonly DataCategory[];
  readonly primaryCategory?: DataCategory;
  readonly fallbackMode: FallbackMode;
  readonly confidence: ClassificationConfidence;
  readonly confidenceScore?: number;
  readonly method: ClassificationMethod;
  readonly entities?: ResolvedEntities;
  readonly reason?: string;
  readonly reasoning?: string;
  readonly explicitRealTimeRequest?: boolean;
  readonly timeSensitiveDecision?: boolean;
  readonly rawInput?: string;
  readonly freshnessCritical?: boolean;
  readonly requiresNumericPrecision?: boolean;
  readonly entitiesComplete?: boolean;
  readonly entitiesNeedingClarification?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function createLocalClassification(reason?: string): DataNeedClassification {
  return {
    truthMode: 'local',
    liveCategories: [],
    authoritativeCategories: [],
    fallbackMode: 'degrade',
    confidence: 'high',
    method: 'pattern',
    reason: reason ?? 'Query does not require external data',
  };
}

export function createLiveFeedClassification(
  categories: readonly LiveCategory[],
  entities?: ResolvedEntities,
  confidence: ClassificationConfidence = 'high',
  method: ClassificationMethod = 'pattern'
): DataNeedClassification {
  const hasTime = categories.includes('time');
  const fallbackMode: FallbackMode = hasTime ? 'refuse' : 'degrade';
  
  return {
    truthMode: 'live_feed',
    liveCategories: categories,
    authoritativeCategories: [],
    fallbackMode,
    confidence,
    method,
    entities,
    reason: `Live data needed for: ${categories.join(', ')}`,
  };
}

export function createAuthoritativeClassification(
  categories: readonly AuthoritativeCategory[],
  confidence: ClassificationConfidence = 'high',
  method: ClassificationMethod = 'pattern'
): DataNeedClassification {
  return {
    truthMode: 'authoritative_verify',
    liveCategories: [],
    authoritativeCategories: categories,
    fallbackMode: 'acknowledge',
    confidence,
    method,
    reason: `Authoritative verification needed for: ${categories.join(', ')}`,
  };
}

export function createMixedClassification(
  liveCategories: readonly LiveCategory[],
  authoritativeCategories: readonly AuthoritativeCategory[],
  entities?: ResolvedEntities,
  confidence: ClassificationConfidence = 'medium',
  method: ClassificationMethod = 'hybrid'
): DataNeedClassification {
  const hasTime = liveCategories.includes('time');
  const fallbackMode: FallbackMode = hasTime ? 'refuse' : 'degrade';
  
  return {
    truthMode: 'mixed',
    liveCategories,
    authoritativeCategories,
    fallbackMode,
    confidence,
    method,
    entities,
    reason: `Mixed data needs: live=[${liveCategories.join(', ')}], auth=[${authoritativeCategories.join(', ')}]`,
  };
}

export function createWebResearchClassification(
  reason?: string,
  confidence: ClassificationConfidence = 'medium'
): DataNeedClassification {
  return {
    truthMode: 'web_research',
    liveCategories: [],
    authoritativeCategories: [],
    fallbackMode: 'degrade',
    confidence,
    method: 'llm',
    reason: reason ?? 'General web research needed',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

export function requiresLiveData(classification: DataNeedClassification): boolean {
  return classification.truthMode === 'live_feed' || 
         (classification.truthMode === 'mixed' && classification.liveCategories.length > 0);
}

export function requiresAuthoritative(classification: DataNeedClassification): boolean {
  return classification.truthMode === 'authoritative_verify' ||
         classification.truthMode === 'authoritative' ||
         (classification.truthMode === 'mixed' && classification.authoritativeCategories.length > 0);
}

export function allowsFallback(classification: DataNeedClassification): boolean {
  return classification.fallbackMode !== 'refuse';
}

export function isLocalOnly(classification: DataNeedClassification): boolean {
  return classification.truthMode === 'local';
}

export function hasCompleteEntities(classification: DataNeedClassification): boolean {
  if (!classification.entities) return false;
  return classification.entities.resolved.length > 0;
}

export function hasTimeCategory(classification: DataNeedClassification): boolean {
  return classification.liveCategories.includes('time');
}

export function timeFailureShouldRefuse(_classification: DataNeedClassification): boolean {
  return true;
}
