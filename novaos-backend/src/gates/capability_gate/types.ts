// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type ProviderName = 'gemini_grounded' | 'openai';

export interface ProviderConfig {
  provider: ProviderName;
  model: string;
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
  topic?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface CapabilityGateOutput {
  provider: ProviderName;
  config: ProviderConfig;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER INTERFACE (for modular providers)
// ─────────────────────────────────────────────────────────────────────────────────

export interface Provider {
  name: ProviderName;
  priority: number;
  match: (intent: import('../intent_gate/types.js').IntentSummary) => boolean;
  getConfig: (intent: import('../intent_gate/types.js').IntentSummary, userMessage: string) => ProviderConfig;
}
