// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Web Search Execution
// Executes web search when live_data=true
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';
import type { CapabilityGateOutput } from './types.js';
import { execute as executeWebSearch } from './capabilities/web-search.capability.js';
import { extractTopicFromConversation } from '../../pipeline/llm_engine.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE CAPABILITY GATE
// ─────────────────────────────────────────────────────────────────────────────────

export async function executeCapabilityGate(
  state: PipelineState,
  context: PipelineContext
): Promise<GateResult<CapabilityGateOutput>> {
  const start = Date.now();

  // Read from Intent Gate output
  const intent = state.intent_summary;

  if (!intent) {
    console.log('[CAPABILITY] skip (no intent_summary)');
    return {
      gateId: 'capability',
      status: 'soft_fail',
      output: { capabilitiesUsed: [], evidenceItems: [] },
      action: 'continue',
      failureReason: 'Missing intent_summary',
      executionTimeMs: Date.now() - start,
    };
  }

  // ─── CHECK LIVE_DATA ───
  if (!intent.live_data) {
    console.log('[CAPABILITY] skip (live_data: false)');
    return {
      gateId: 'capability',
      status: 'pass',
      output: { capabilitiesUsed: [], evidenceItems: [] },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  // ─── BUILD CONTEXTUAL SEARCH QUERY ───
  let searchQuery = state.userMessage;

  if (context.conversationHistory?.length) {
    const topic = await extractTopicFromConversation(context.conversationHistory);
    if (topic) {
      searchQuery = `${topic}: ${state.userMessage}`;
      console.log(`[CAPABILITY] topic: "${topic}"`);
    }
  }

  // ─── EXECUTE WEB SEARCH ───
  console.log('[CAPABILITY] executing web_search');

  try {
    const evidence = await executeWebSearch(searchQuery);

    if (evidence) {
      console.log('[CAPABILITY] evidence: 1 item');
      return {
        gateId: 'capability',
        status: 'pass',
        output: {
          capabilitiesUsed: ['web_search'],
          evidenceItems: [evidence],
        },
        action: 'continue',
        executionTimeMs: Date.now() - start,
      };
    }

    // Web search returned null (no results or error)
    console.log('[CAPABILITY] evidence: 0 items (web search returned null)');
    return {
      gateId: 'capability',
      status: 'soft_fail',
      output: { capabilitiesUsed: ['web_search'], evidenceItems: [] },
      action: 'continue',
      failureReason: 'Web search returned no results',
      executionTimeMs: Date.now() - start,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[CAPABILITY] web_search error:', errorMsg);
    return {
      gateId: 'capability',
      status: 'soft_fail',
      output: { capabilitiesUsed: [], evidenceItems: [] },
      action: 'continue',
      failureReason: `Web search failed: ${errorMsg}`,
      executionTimeMs: Date.now() - start,
    };
  }
}

export const executeCapabilityGateAsync = executeCapabilityGate;
