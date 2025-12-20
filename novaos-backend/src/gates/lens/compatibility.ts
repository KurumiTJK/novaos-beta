// ═══════════════════════════════════════════════════════════════════════════════
// LENS GATE COMPATIBILITY — Legacy Format Conversion
// PATCHED: Fixed type imports from types/index.js
// ═══════════════════════════════════════════════════════════════════════════════

import type { StakesLevel } from '../../types/index.js';
import type { LensGateResult, LensMode, LensConstraints, RiskAssessment } from '../../types/lens.js';
import type { DataNeedClassification } from '../../types/data-need.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LEGACY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Legacy evidence item format.
 */
export interface LegacyEvidenceItem {
  readonly title: string;
  readonly url?: string;
  readonly excerpt?: string;
  readonly snippet?: string;
  readonly source?: string;
  readonly confidence?: number;
}

/**
 * Legacy evidence pack format.
 */
export interface LegacyEvidencePack {
  readonly items: readonly LegacyEvidenceItem[];
  readonly sources: readonly string[];
  readonly freshness: 'fresh' | 'stale' | 'unknown';
}

/**
 * Legacy lens result format expected by the execution pipeline.
 */
export interface LegacyLensResult {
  readonly classification: {
    readonly truthMode: string;
    readonly categories: readonly string[];
    readonly confidence: string;
  };
  readonly evidence?: LegacyEvidencePack;
  readonly stakes: StakesLevel;
  readonly mode: string;
}

/**
 * Extended lens result that includes both legacy and new fields.
 */
export interface ExtendedLensResult extends LegacyLensResult {
  /** Full classification data */
  readonly fullClassification: DataNeedClassification;
  
  /** Response constraints */
  readonly constraints: LensConstraints;
  
  /** Risk assessment if available */
  readonly riskAssessment?: RiskAssessment | null;
  
  /** Force high invariant */
  readonly forceHigh: boolean;
  
  /** Operating mode */
  readonly lensMode: LensMode;
  
  /** Degradation reason if applicable */
  readonly degradationReason?: string;
  
  /** Block reason if applicable */
  readonly blockReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Convert a LensGateResult to the legacy LensResult format.
 */
export function toLegacyLensResult(result: LensGateResult): ExtendedLensResult {
  // Convert classification to legacy format
  const legacyClassification = {
    truthMode: result.classification.truthMode,
    categories: result.classification.categories,
    confidence: result.classification.confidence,
  };
  
  // Convert evidence to legacy format
  let legacyEvidence: LegacyEvidencePack | undefined;
  if (result.evidence) {
    const items: LegacyEvidenceItem[] = [];
    
    // Convert numeric tokens to evidence items
    if (result.evidence.numericTokens) {
      for (const [, token] of result.evidence.numericTokens.tokens) {
        items.push({
          title: `${token.type}: ${token.value}${token.unit ? ' ' + token.unit : ''}`,
          source: token.source,
          confidence: 1.0,
        });
      }
    }
    
    // Add system prompt additions as evidence
    for (const addition of result.evidence.systemPromptAdditions) {
      items.push({
        title: 'Context',
        excerpt: addition,
        confidence: 0.9,
      });
    }
    
    legacyEvidence = {
      items,
      sources: result.evidence.sources ?? [],
      freshness: result.evidence.freshnessInfo?.allFresh ? 'fresh' : 'stale',
    };
  }
  
  // Determine stakes from risk assessment
  const stakes: StakesLevel = result.riskAssessment?.stakes ?? 
    (result.forceHigh ? 'high' : 'low');
  
  return {
    // Legacy fields
    classification: legacyClassification,
    evidence: legacyEvidence,
    stakes,
    mode: result.mode,
    
    // Extended fields
    fullClassification: result.classification,
    constraints: result.responseConstraints ?? {
      level: 'standard',
      requireEvidence: false,
      allowSpeculation: true,
    },
    riskAssessment: result.riskAssessment,
    forceHigh: result.forceHigh ?? false,
    lensMode: result.mode,
    degradationReason: result.degradationReason,
    blockReason: result.blockReason,
  };
}

/**
 * Get the full LensGateResult from an ExtendedLensResult if available.
 * Note: This only works for results that were converted from LensGateResult.
 */
export function getFullLensResult(result: ExtendedLensResult): Partial<LensGateResult> {
  return {
    mode: result.lensMode,
    classification: result.fullClassification,
    constraints: result.constraints,
    forceHigh: result.forceHigh,
    riskAssessment: result.riskAssessment,
  };
}

/**
 * Check if a result has extended data.
 */
export function hasExtendedData(result: LegacyLensResult): result is ExtendedLensResult {
  return 'fullClassification' in result && 'lensMode' in result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract stakes level from any lens result format.
 */
export function getStakes(result: LegacyLensResult | ExtendedLensResult): StakesLevel {
  if (hasExtendedData(result) && result.riskAssessment) {
    return result.riskAssessment.stakes;
  }
  return result.stakes;
}

/**
 * Check if result requires verification.
 */
export function requiresVerification(result: LegacyLensResult | ExtendedLensResult): boolean {
  if (hasExtendedData(result)) {
    return result.fullClassification.truthMode !== 'local';
  }
  return result.classification.truthMode !== 'local';
}

/**
 * Get effective constraints from result.
 */
export function getConstraints(result: LegacyLensResult | ExtendedLensResult): LensConstraints {
  if (hasExtendedData(result)) {
    return result.constraints;
  }
  
  // Create default constraints based on legacy data
  const isHighStakes = result.stakes === 'high';
  return {
    level: isHighStakes ? 'strict' : 'standard',
    requireEvidence: isHighStakes,
    allowSpeculation: !isHighStakes,
  };
}
