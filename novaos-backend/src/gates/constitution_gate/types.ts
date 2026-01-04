// ═══════════════════════════════════════════════════════════════════════════════
// CONSTITUTION GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

import type { ValidatedOutput, ConstitutionalCheckResult } from '../../types/index.js';

// Re-export for convenience
export type { ValidatedOutput, ConstitutionalCheckResult };

// ─────────────────────────────────────────────────────────────────────────────────
// GATE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConstitutionGateOutput extends ValidatedOutput {
  /** Whether the response passed validation */
  valid: boolean;
  /** Whether the response was edited */
  edited: boolean;
  /** Whether constitution check was run */
  checkRun: boolean;
  /** Reason for skipping (if skipped) */
  skipReason?: string;
  /** Result of constitutional check (if run) */
  constitutionalCheck?: ConstitutionalCheckResult;
  /** Fix guidance for regeneration (if violation) */
  fixGuidance?: string;
  /** List of violations found */
  violations?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConstitutionGateConfig {
  /** Force skip constitutional check */
  forceSkip?: boolean;
  /** Force run constitutional check (bypass router) */
  forceRun?: boolean;
}
