// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

import type { Generation } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EVIDENCE (from Capability Gate)
// ─────────────────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  type: string;
  formatted: string;
  source: string;
  fetchedAt: number;
  raw?: unknown;
}

export interface CapabilityGateOutput {
  capabilitiesUsed: string[];
  evidenceItems: EvidenceItem[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE GATE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ResponseGateOutput extends Generation {
  // Inherits: text, model, tokensUsed, constraints, fallbackUsed
}

export interface ResponseGateConfig {
  /** Override default model */
  model?: string;
  /** Override personality */
  personality?: Personality;
}

export interface Personality {
  role: string;
  tone: string;
  descriptors: string;
}

export interface StitchedPrompt {
  system: string;
  user: string;
}
