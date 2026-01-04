// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

import type { 
  ProviderName, 
  ProviderConfig, 
  CapabilityGateOutput,
  EvidenceItem 
} from '../../types/index.js';

// Re-export from main types
export type { ProviderName, ProviderConfig, CapabilityGateOutput, EvidenceItem };

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER INTERFACE (for modular providers)
// ─────────────────────────────────────────────────────────────────────────────────

export interface Provider {
  name: ProviderName;
  priority: number;
  match: (intent: import('../intent_gate/types.js').IntentSummary) => boolean;
  getConfig: (intent: import('../intent_gate/types.js').IntentSummary, userMessage: string) => ProviderConfig;
}
