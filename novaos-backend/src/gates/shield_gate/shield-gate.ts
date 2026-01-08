// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD GATE — Router to Shield Service
// ═══════════════════════════════════════════════════════════════════════════════
//
// Shield Gate evaluates safety signals and routes to Shield Service:
// - NONE/LOW: Skip (no intervention)
// - MEDIUM: Warn (pipeline continues, warning attached to response)
// - HIGH: Crisis (pipeline blocks until user confirms safety)
//
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
import { getShieldService } from '../../services/shield/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE SHIELD GATE (ASYNC) — With Shield Service
// ─────────────────────────────────────────────────────────────────────────────────

export async function executeShieldGateAsync(
  state: PipelineState,
  context: PipelineContext
): Promise<GateResult<ShieldGateOutput>> {
  const start = Date.now();
  const shieldService = getShieldService();

  // Read from Intent Gate output
  const intent = state.intent_summary;
  const safety_signal: SafetySignal = intent?.safety_signal ?? 'none';
  const urgency: Urgency = intent?.urgency ?? 'low';

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHECK FOR ACTIVE CRISIS SESSION — Blocks ALL messages
  // ═══════════════════════════════════════════════════════════════════════════════
  
  if (context.userId) {
    const crisisCheck = await shieldService.checkCrisisBlock(context.userId);
    
    if (crisisCheck.blocked) {
      console.log(`[SHIELD] BLOCKED - Active crisis session: ${crisisCheck.sessionId}`);
      
      return {
        gateId: 'shield',
        status: 'blocked',
        output: {
          route: 'shield',
          safety_signal,
          urgency,
          shield_acceptance: false,
          action: 'crisis',
          sessionId: crisisCheck.sessionId,
          crisisBlocked: true,
        },
        action: 'halt', // Stop pipeline completely
        executionTimeMs: Date.now() - start,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // NONE/LOW — Skip Shield entirely
  // ═══════════════════════════════════════════════════════════════════════════════
  
  if (safety_signal === 'none' || safety_signal === 'low') {
    console.log(`[SHIELD] skip (safety_signal: ${safety_signal})`);
    
    return {
      gateId: 'shield',
      status: 'pass',
      output: {
        route: 'skip',
        safety_signal,
        urgency,
        shield_acceptance: false,
        action: 'skip',
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MEDIUM/HIGH — Evaluate with Shield Service
  // ═══════════════════════════════════════════════════════════════════════════════
  
  const evaluation = await shieldService.evaluate(
    context.userId ?? 'anonymous',
    state.userMessage,
    safety_signal,
    urgency
  );

  console.log(`[SHIELD] ${evaluation.action} (safety_signal: ${safety_signal}, urgency: ${urgency})`);

  // ─────────────────────────────────────────────────────────────────────────────────
  // HIGH — Block pipeline, create crisis session
  // ─────────────────────────────────────────────────────────────────────────────────
  
  if (safety_signal === 'high') {
    return {
      gateId: 'shield',
      status: 'blocked',
      output: {
        route: 'shield',
        safety_signal,
        urgency,
        shield_acceptance: false,
        action: 'crisis',
        riskAssessment: evaluation.riskAssessment,
        sessionId: evaluation.sessionId,
        activationId: evaluation.activationId,
      },
      action: 'halt', // Stop pipeline - no response generated
      executionTimeMs: Date.now() - start,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────────
  // MEDIUM — Continue pipeline, attach warning for frontend
  // ─────────────────────────────────────────────────────────────────────────────────
  
  return {
    gateId: 'shield',
    status: 'warning',
    output: {
      route: 'shield',
      safety_signal,
      urgency,
      shield_acceptance: false,
      action: 'warn',
      riskAssessment: evaluation.riskAssessment,
      activationId: evaluation.activationId,
    },
    action: 'continue', // Pipeline continues - response will be generated
    executionTimeMs: Date.now() - start,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE SHIELD GATE (SYNC) — Backwards compatibility, no service call
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

  // Determine route (legacy behavior)
  const shouldRoute = stance === 'SHIELD' && safety_signal !== 'none';
  const route = shouldRoute ? 'shield' : 'skip';

  console.log(`[SHIELD] ${route} (safety_signal: ${safety_signal}, urgency: ${urgency}) [sync]`);

  return {
    gateId: 'shield',
    status: 'pass',
    output: {
      route,
      safety_signal,
      urgency,
      shield_acceptance: false,
      action: 'skip', // Sync version doesn't evaluate
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}
