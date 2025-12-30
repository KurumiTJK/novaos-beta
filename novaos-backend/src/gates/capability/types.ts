// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

import type { Intent, LensResult } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Available capability types.
 */
export type CapabilityType =
  | 'stock_fetcher'
  | 'weather_fetcher'
  | 'crypto_fetcher'
  | 'fx_fetcher'
  | 'time_fetcher'
  | 'web_searcher';

/**
 * Evidence output types.
 */
export type EvidenceType = 'stock' | 'weather' | 'crypto' | 'fx' | 'time' | 'web_result';

// ─────────────────────────────────────────────────────────────────────────────────
// EVIDENCE ITEM
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Evidence item returned by capabilities.
 * Ready for injection into Model Gate prompt.
 */
export interface EvidenceItem {
  /** Type of evidence */
  readonly type: EvidenceType;
  /** Formatted string ready for prompt injection */
  readonly formatted: string;
  /** Source capability name */
  readonly source: string;
  /** Original raw data (for debugging/logging) */
  readonly raw?: unknown;
  /** Timestamp when fetched */
  readonly fetchedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTOR INPUT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Input to capability selector.
 */
export interface SelectorInput {
  /** Original user message */
  readonly userMessage: string;
  /** Intent from Intent Gate */
  readonly intent: Intent;
  /** Lens result from Lens Gate */
  readonly lensResult: LensResult;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Capability plugin interface.
 * Each capability has a name, description (for LLM), and execute function.
 */
export interface Capability {
  /** Unique capability identifier */
  readonly name: CapabilityType;
  /** Human-readable description for LLM selector */
  readonly description: string;
  /** Execute the capability and return evidence */
  execute(input: SelectorInput): Promise<EvidenceItem | null>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LLM SELECTOR RESULT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Result from LLM selector.
 */
export interface SelectorResult {
  /** Selected capability names */
  readonly capabilities: CapabilityType[];
  /** Reasoning from LLM */
  readonly reasoning: string;
  /** Confidence in selection */
  readonly confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE INPUT/OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Input to Capability Gate.
 */
export interface CapabilityGateInput {
  readonly userMessage: string;
  readonly intent: Intent;
  readonly lensResult: LensResult;
  readonly stance: 'lens' | 'sword';
}

/**
 * Output from Capability Gate.
 */
export interface CapabilityGateOutput {
  /** Route taken */
  readonly route: 'lens' | 'sword';
  /** Capabilities that were used */
  readonly capabilitiesUsed: CapabilityType[];
  /** Evidence items for Model Gate */
  readonly evidenceItems: EvidenceItem[];
  /** Any fetch errors */
  readonly fetchErrors?: string[];
  /** Sword mode flag (for sword route) */
  readonly swordMode?: boolean;
  /** LLM selector reasoning */
  readonly selectorReasoning?: string;
}
