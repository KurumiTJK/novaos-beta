// ═══════════════════════════════════════════════════════════════════════════════
// CONSTITUTION GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

import type { ValidatedOutput } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTITUTIONAL CHECK RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConstitutionalCheckResult {
  violates: boolean;
  reason: string | null;
  fix: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConstitutionGateOutput extends ValidatedOutput {
  /** Whether constitution check was run */
  checkRun: boolean;
  /** Reason for skipping (if skipped) */
  skipReason?: string;
  /** Result of constitutional check (if run) */
  constitutionalCheck?: ConstitutionalCheckResult;
  /** Fix guidance for regeneration (if violation) */
  fixGuidance?: string;
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
