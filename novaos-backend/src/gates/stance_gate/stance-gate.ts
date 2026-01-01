// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE — Router to Sword or Lens Engine
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  StanceGateOutput,
} from './types.js';
import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE STANCE GATE
// ─────────────────────────────────────────────────────────────────────────────────

export function executeStanceGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<StanceGateOutput> {
  const start = Date.now();

  // Read from Intent Gate output
  const intent = state.intent_summary;
  const primary_route = intent?.primary_route ?? 'SAY';
  const stance = intent?.stance ?? 'LENS';
  const learning_intent = intent?.learning_intent ?? false;

  // Route to sword if learning_intent is true AND stance is SWORD
  const route = (learning_intent === true && stance === 'SWORD') ? 'sword' : 'lens';

  console.log(`[STANCE] ${route} (learning_intent: ${learning_intent}, stance: ${stance})`);

  return {
    gateId: 'stance',
    status: 'pass',
    output: {
      route,
      primary_route,
      learning_intent,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// Async version for consistency with other gates
export async function executeStanceGateAsync(
  state: PipelineState,
  context: PipelineContext
): Promise<GateResult<StanceGateOutput>> {
  return executeStanceGate(state, context);
}
