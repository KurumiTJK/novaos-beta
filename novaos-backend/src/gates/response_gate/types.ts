// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

import type { Generation, ConversationMessage } from '../../types/index.js';
import type { ProviderConfig, ProviderName } from '../capability_gate/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE OUTPUT (new format)
// ─────────────────────────────────────────────────────────────────────────────────

export interface CapabilityGateOutput {
  provider: ProviderName;
  config: ProviderConfig;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE GATE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ResponseGateOutput extends Generation {
  // Inherits: text, model, tokensUsed
  sources?: Array<{ uri: string; title: string }>; // Gemini grounding sources
}

export interface ResponseGateConfig {
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

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER EXECUTOR TYPE
// ─────────────────────────────────────────────────────────────────────────────────

export type ProviderExecutor = (
  systemPrompt: string,
  userPrompt: string,
  config: ProviderConfig,
  conversationHistory?: readonly ConversationMessage[]
) => Promise<ResponseGateOutput>;
