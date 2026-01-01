// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrimaryRoute, Stance, Urgency } from '../intent_gate/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY METADATA (stored in capability-registry.json)
// ─────────────────────────────────────────────────────────────────────────────────

export interface CapabilityMeta {
  name: string;
  description: string;
  evidenceType: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

export interface Capability {
  readonly name: string;
  readonly description: string;
  readonly evidenceType: string;
  execute(userMessage: string): Promise<EvidenceItem | null>;
}

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
// SELECTOR INPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface SelectorInput {
  readonly userMessage: string;
  readonly primary_route: PrimaryRoute;
  readonly stance: Stance;
  readonly urgency: Urgency;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTOR RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export interface SelectorResult {
  readonly capabilities: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface CapabilityGateOutput {
  readonly capabilitiesUsed: string[];
  readonly evidenceItems: EvidenceItem[];
}
