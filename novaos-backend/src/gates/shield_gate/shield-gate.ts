// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD GATE — Router to Shield Engine
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ShieldGateOutput,
  SafetySignal,
  Urgency,
} from './types.js';
import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE SHIELD GATE
// ─────────────────────────────────────────────────────────────────────────────────

export function executeShieldGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<ShieldGateOutput> {
  const start = Date.now();

  // Read from Intent Gate output
  const intent = state.intent_summary;
  const stance = intent?.stance ?? 'LENS';
  const safety_signal: SafetySignal = intent?.safety_signal ?? 'none';
  const urgency: Urgency = intent?.urgency ?? 'low';

  // Route to shield if stance is SHIELD and safety_signal is not 'none'
  const shouldRoute = stance === 'SHIELD' && safety_signal !== 'none';
  const route = shouldRoute ? 'shield' : 'skip';

  console.log(`[SHIELD] ${route} (safety_signal: ${safety_signal}, urgency: ${urgency})`);

  return {
    gateId: 'shield',
    status: 'pass',
    output: {
      route,
      safety_signal,
      urgency,
      shield_acceptance: false,  // Default false, future: set by Shield Engine
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// Async version for consistency with other gates
export async function executeShieldGateAsync(
  state: PipelineState,
  context: PipelineContext
): Promise<GateResult<ShieldGateOutput>> {
  return executeShieldGate(state, context);
}
