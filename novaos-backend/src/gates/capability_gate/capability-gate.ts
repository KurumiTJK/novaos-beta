// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Provider Router
// Decides which provider to use based on intent, returns config for Response Gate
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';
import type { CapabilityGateOutput, Provider } from './types.js';

// Import providers
import geminiGrounded from './providers/gemini-grounded.provider.js';
import openai from './providers/openai.provider.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

// Register all providers here (sorted by priority, highest first)
const providers: Provider[] = [
  geminiGrounded,
  openai,
].sort((a, b) => b.priority - a.priority);

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE CAPABILITY GATE
// ─────────────────────────────────────────────────────────────────────────────────

export function executeCapabilityGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<CapabilityGateOutput> {
  const start = Date.now();

  const intent = state.intent_summary;

  if (!intent) {
    console.error('[CAPABILITY] ERROR: no intent_summary');
    return {
      gateId: 'capability',
      status: 'hard_fail',
      output: null as any,
      action: 'stop',
      failureReason: 'Missing intent_summary',
      executionTimeMs: Date.now() - start,
    };
  }

  // Find first matching provider
  for (const provider of providers) {
    if (provider.match(intent)) {
      const config = provider.getConfig(intent, state.userMessage);
      console.log(`[CAPABILITY] provider: ${provider.name}`);
      return {
        gateId: 'capability',
        status: 'pass',
        output: { provider: provider.name, config },
        action: 'continue',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  // No provider matched — error
  console.error('[CAPABILITY] ERROR: no provider matched');
  return {
    gateId: 'capability',
    status: 'hard_fail',
    output: null as any,
    action: 'stop',
    failureReason: 'No provider matched intent',
    executionTimeMs: Date.now() - start,
  };
}

export const executeCapabilityGateAsync = executeCapabilityGate;
