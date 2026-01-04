// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI GROUNDED PROVIDER
// Used when live_data=true — web search with grounding
// ═══════════════════════════════════════════════════════════════════════════════

import type { IntentSummary } from '../../intent_gate/types.js';
import type { Provider, ProviderConfig } from '../types.js';

export const name = 'gemini_grounded';
export const priority = 10; // Higher than openai

export function match(intent: IntentSummary): boolean {
  return intent.live_data === true;
}

export function getConfig(intent: IntentSummary, userMessage: string): ProviderConfig {
  return {
    provider: 'gemini_grounded',
    model: 'gemini-2.5-pro',
    tools: [{ googleSearch: {} }],
    temperature: 0.7,
    maxTokens: 2048,
    topic: intent.topic,
  };
}

const provider: Provider = { name, priority, match, getConfig };
export default provider;
