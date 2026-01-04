// ═══════════════════════════════════════════════════════════════════════════════
// OPENAI PROVIDER
// Default provider — used when no other provider matches
// ═══════════════════════════════════════════════════════════════════════════════

import type { IntentSummary } from '../../intent_gate/types.js';
import type { Provider, ProviderConfig } from '../types.js';

export const name = 'openai';
export const priority = 0; // Lowest — default fallback

export function match(intent: IntentSummary): boolean {
  return true; // Always matches
}

export function getConfig(intent: IntentSummary, userMessage: string): ProviderConfig {
  return {
    provider: 'openai',
    model: 'gpt-5.2',
    temperature: 0.7,
    maxTokens: 2048,
    topic: intent.topic,
  };
}

const provider: Provider = { name, priority, match, getConfig };
export default provider;
