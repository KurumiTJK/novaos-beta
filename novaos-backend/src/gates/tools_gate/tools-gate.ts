// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS GATE — Router to External Tools Engine
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ToolsGateOutput,
} from './types.js';
import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE TOOLS GATE
// ─────────────────────────────────────────────────────────────────────────────────

export function executeToolsGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<ToolsGateOutput> {
  const start = Date.now();

  // Read from Intent Gate output
  const intent = state.intent_summary;
  const external_tool = intent?.external_tool ?? false;

  // Route to tools if external_tool is true
  const route = external_tool ? 'tools' : 'skip';

  console.log(`[TOOLS] ${route} (external_tool: ${external_tool})`);

  return {
    gateId: 'tools',
    status: 'pass',
    output: {
      route,
      external_tool,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// Async version for consistency with other gates
export async function executeToolsGateAsync(
  state: PipelineState,
  context: PipelineContext
): Promise<GateResult<ToolsGateOutput>> {
  return executeToolsGate(state, context);
}
