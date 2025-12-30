// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Main Entry Point
// Routes by stance, selects capabilities via LLM, executes and returns evidence
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  Stance,
} from '../../types/index.js';

import type {
  CapabilityGateOutput,
  SelectorInput,
} from './types.js';

import { selectCapabilities, type SelectorConfig } from './selector.js';
import { getCapabilityRegistry } from './registry.js';
import { registerAllCapabilities } from './capabilities/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

let initialized = false;

/**
 * Initialize capability gate (register capabilities).
 * Safe to call multiple times.
 */
export function initializeCapabilityGate(): void {
  if (initialized) return;
  registerAllCapabilities();
  initialized = true;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE EXECUTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Execute the Capability Gate.
 *
 * Routes by stance:
 * - SWORD → Hand off to SwordGate (stub for now)
 * - LENS → Select capabilities via LLM, execute, return evidence
 * 
 * @param state - Pipeline state
 * @param context - Pipeline context
 * @param selectorConfig - Optional LLM selector config
 */
export async function executeCapabilityGateAsync(
  state: PipelineState,
  _context: PipelineContext,
  selectorConfig?: SelectorConfig
): Promise<GateResult<CapabilityGateOutput>> {
  const startTime = Date.now();

  // Ensure initialized
  initializeCapabilityGate();

  // Get stance (default to lens if not set)
  const stance = (state.stance ?? 'lens') as Stance;

  // ─── SWORD ROUTE ───
  if (stance === 'sword') {
    return {
      gateId: 'capability',
      status: 'pass',
      action: 'continue',
      output: {
        route: 'sword',
        capabilitiesUsed: [],
        evidenceItems: [],
        swordMode: true,
        // TODO: Wire to persistent SwordGate
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  // ─── LENS ROUTE ───

  // Validate required state
  if (!state.intent || !state.lensResult) {
    return {
      gateId: 'capability',
      status: 'soft_fail',
      action: 'continue',
      output: {
        route: 'lens',
        capabilitiesUsed: [],
        evidenceItems: [],
      },
      failureReason: 'Missing intent or lensResult',
      executionTimeMs: Date.now() - startTime,
    };
  }

  // Build selector input
  const selectorInput: SelectorInput = {
    userMessage: state.userMessage,
    intent: state.intent,
    lensResult: state.lensResult,
  };

  // Select capabilities via LLM
  const selection = await selectCapabilities(selectorInput, selectorConfig);

  // If no capabilities selected, return empty
  if (selection.capabilities.length === 0) {
    return {
      gateId: 'capability',
      status: 'pass',
      action: 'continue',
      output: {
        route: 'lens',
        capabilitiesUsed: [],
        evidenceItems: [],
        selectorReasoning: selection.reasoning,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  // Execute selected capabilities
  const registry = getCapabilityRegistry();
  const { evidenceItems, errors } = await registry.executeAll(
    selection.capabilities,
    selectorInput
  );

  // Log results
  console.log(`[CAPABILITY] Selected: ${selection.capabilities.join(', ')}`);
  console.log(`[CAPABILITY] Evidence items: ${evidenceItems.length}`);
  if (errors.length > 0) {
    console.log(`[CAPABILITY] Errors: ${errors.join(', ')}`);
  }

  return {
    gateId: 'capability',
    status: errors.length > 0 && evidenceItems.length === 0 ? 'soft_fail' : 'pass',
    action: 'continue',
    output: {
      route: 'lens',
      capabilitiesUsed: selection.capabilities,
      evidenceItems,
      fetchErrors: errors.length > 0 ? errors : undefined,
      selectorReasoning: selection.reasoning,
    },
    executionTimeMs: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export * from './types.js';
export * from './registry.js';
export { 
  selectCapabilities, 
  setOpenAIClient,
  setSelectorConfig,
  getSelectorConfig,
  type SelectorConfig,
} from './selector.js';
export { registerAllCapabilities } from './capabilities/index.js';
