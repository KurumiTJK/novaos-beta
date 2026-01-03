// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// EVIDENCE ITEM
// ─────────────────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  readonly type: string;
  readonly formatted: string;
  readonly source: string;
  readonly raw?: unknown;
  readonly fetchedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface CapabilityGateOutput {
  readonly capabilitiesUsed: readonly string[];
  readonly evidenceItems: readonly EvidenceItem[];
}
