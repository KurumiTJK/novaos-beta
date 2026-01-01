// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Main Implementation
// Routes live_data requests to capability selector and execution
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';
import type { CapabilityGateOutput, SelectorInput } from './types.js';
import { selectCapabilities } from './selector.js';
import { getCapabilityRegistry } from './registry.js';
import { initializeCapabilities } from './discover.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await initializeCapabilities();
  initialized = true;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE CAPABILITY GATE
// ─────────────────────────────────────────────────────────────────────────────────

export async function executeCapabilityGate(
  state: PipelineState,
  _context: PipelineContext
): Promise<GateResult<CapabilityGateOutput>> {
  const start = Date.now();

  // Ensure capabilities are loaded
  await ensureInitialized();

  // Read from Intent Gate output
  const intent = state.intent_summary;

  if (!intent) {
    console.log('[CAPABILITY] skip (no intent_summary)');
    return {
      gateId: 'capability',
      status: 'soft_fail',
      output: {
        capabilitiesUsed: [],
        evidenceItems: [],
      },
      action: 'continue',
      failureReason: 'Missing intent_summary',
      executionTimeMs: Date.now() - start,
    };
  }

  const { primary_route, stance, urgency, live_data } = intent;

  // ─── CHECK LIVE_DATA ───
  if (!live_data) {
    console.log('[CAPABILITY] skip (live_data: false)');
    return {
      gateId: 'capability',
      status: 'pass',
      output: {
        capabilitiesUsed: [],
        evidenceItems: [],
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  // ─── LLM SELECTOR ───
  const selectorInput: SelectorInput = {
    userMessage: state.userMessage,
    primary_route,
    stance,
    urgency,
  };

  const selectorResult = await selectCapabilities(selectorInput);

  if (!selectorResult.ok) {
    console.log(`[CAPABILITY] selector error: ${selectorResult.error}`);
    console.log('[CAPABILITY] skip (selector failed)');
    return {
      gateId: 'capability',
      status: 'soft_fail',
      output: {
        capabilitiesUsed: [],
        evidenceItems: [],
      },
      action: 'continue',
      failureReason: `LLM selector failed: ${selectorResult.error}`,
      executionTimeMs: Date.now() - start,
    };
  }

  const selectedCapabilities = selectorResult.result.capabilities;

  // ─── NO CAPABILITIES SELECTED ───
  if (selectedCapabilities.length === 0) {
    console.log('[CAPABILITY] selected: (none)');
    return {
      gateId: 'capability',
      status: 'pass',
      output: {
        capabilitiesUsed: [],
        evidenceItems: [],
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  // ─── EXECUTE CAPABILITIES ───
  console.log(`[CAPABILITY] selected: ${selectedCapabilities.join(', ')}`);

  const registry = getCapabilityRegistry();
  const { evidenceItems, errors } = await registry.executeAll(
    selectedCapabilities,
    state.userMessage
  );

  // Log results
  console.log(`[CAPABILITY] evidence: ${evidenceItems.length} items`);

  // Errors are already logged in registry.executeAll

  return {
    gateId: 'capability',
    status: errors.length > 0 && evidenceItems.length === 0 ? 'soft_fail' : 'pass',
    output: {
      capabilitiesUsed: selectedCapabilities,
      evidenceItems,
    },
    action: 'continue',
    failureReason: errors.length > 0 && evidenceItems.length === 0 
      ? `All capabilities failed: ${errors.join(', ')}`
      : undefined,
    executionTimeMs: Date.now() - start,
  };
}

// Async alias for consistency
export const executeCapabilityGateAsync = executeCapabilityGate;
