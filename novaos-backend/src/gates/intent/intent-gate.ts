// ═══════════════════════════════════════════════════════════════════════════════
// INTENT GATE — LLM-Powered Intent Classification
// ═══════════════════════════════════════════════════════════════════════════════

import { getOpenAIClient, pipeline_model } from '../../pipeline/llm_engine.js';
import { INTENT_SYSTEM_PROMPT } from './prompts.js';
import type {
  IntentSummary,
  PrimaryRoute,
  Stance,
  SafetySignal,
  Urgency,
} from './types.js';
import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VALID VALUES
// ─────────────────────────────────────────────────────────────────────────────────

const VALID_PRIMARY_ROUTES = new Set<PrimaryRoute>(['SAY', 'MAKE', 'FIX', 'DO']);
const VALID_STANCES = new Set<Stance>(['LENS', 'SWORD', 'SHIELD']);
const VALID_SAFETY_SIGNALS = new Set<SafetySignal>(['none', 'low', 'medium', 'high']);
const VALID_URGENCIES = new Set<Urgency>(['low', 'medium', 'high']);

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT (fail-open)
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_INTENT_SUMMARY: IntentSummary = {
  primary_route: 'SAY',
  stance: 'LENS',
  safety_signal: 'none',
  urgency: 'low',
  live_data: false,
  external_tool: false,
  learning_intent: false,
};

// ─────────────────────────────────────────────────────────────────────────────────
// PARSE LLM OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

function parseIntentOutput(content: string): IntentSummary {
  try {
    // Debug: log raw output
    // console.log('[INTENT] Raw LLM output:', content);
    
    // Handle potential markdown code blocks
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = match?.[1]?.trim() ?? content;
    }

    const raw = JSON.parse(jsonStr.trim());

    // Validate and build intent_summary
    const intent_summary: IntentSummary = {
      primary_route: VALID_PRIMARY_ROUTES.has(raw.primary_route)
        ? raw.primary_route
        : DEFAULT_INTENT_SUMMARY.primary_route,

      stance: VALID_STANCES.has(raw.stance)
        ? raw.stance
        : DEFAULT_INTENT_SUMMARY.stance,

      safety_signal: VALID_SAFETY_SIGNALS.has(raw.safety_signal)
        ? raw.safety_signal
        : DEFAULT_INTENT_SUMMARY.safety_signal,

      urgency: VALID_URGENCIES.has(raw.urgency)
        ? raw.urgency
        : DEFAULT_INTENT_SUMMARY.urgency,

      live_data: typeof raw.live_data === 'boolean'
        ? raw.live_data
        : DEFAULT_INTENT_SUMMARY.live_data,

      external_tool: typeof raw.external_tool === 'boolean'
        ? raw.external_tool
        : DEFAULT_INTENT_SUMMARY.external_tool,

      learning_intent: typeof raw.learning_intent === 'boolean'
        ? raw.learning_intent
        : DEFAULT_INTENT_SUMMARY.learning_intent,
    };

    return intent_summary;
  } catch (error) {
    console.warn('[INTENT] Failed to parse LLM output, using defaults');
    console.warn('[INTENT] Parse error:', error);
    return DEFAULT_INTENT_SUMMARY;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE INTENT GATE (ASYNC)
// ─────────────────────────────────────────────────────────────────────────────────

export async function executeIntentGateAsync(
  state: PipelineState,
  _context: PipelineContext
): Promise<GateResult<IntentSummary>> {
  const start = Date.now();
  const userMessage = state.normalizedInput;
  const client = getOpenAIClient();

  if (!client) {
    console.warn('[INTENT] OpenAI client not available, using defaults');
    console.log('[INTENT]', DEFAULT_INTENT_SUMMARY);
    
    return {
      gateId: 'intent',
      status: 'soft_fail',
      output: DEFAULT_INTENT_SUMMARY,
      action: 'continue',
      failureReason: 'OpenAI client not available',
      executionTimeMs: Date.now() - start,
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: pipeline_model,
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_completion_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    
    // Handle empty response
    if (!content) {
      console.warn('[INTENT] Empty response from LLM, using defaults');
      console.log('[INTENT]', DEFAULT_INTENT_SUMMARY);
      return {
        gateId: 'intent',
        status: 'soft_fail',
        output: DEFAULT_INTENT_SUMMARY,
        action: 'continue',
        failureReason: 'Empty LLM response',
        executionTimeMs: Date.now() - start,
      };
    }
    
    const intent_summary = parseIntentOutput(content);

    // Log the output
    console.log('[INTENT]', intent_summary);

    return {
      gateId: 'intent',
      status: 'pass',
      output: intent_summary,
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    console.error('[INTENT] LLM error:', error);
    console.log('[INTENT]', DEFAULT_INTENT_SUMMARY);
    
    return {
      gateId: 'intent',
      status: 'soft_fail',
      output: DEFAULT_INTENT_SUMMARY,
      action: 'continue',
      failureReason: error instanceof Error ? error.message : 'LLM error',
      executionTimeMs: Date.now() - start,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE INTENT GATE (SYNC - for backwards compatibility)
// ─────────────────────────────────────────────────────────────────────────────────

export function executeIntentGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<IntentSummary> {
  const start = Date.now();
  
  console.warn('[INTENT] Sync mode - using defaults (use executeIntentGateAsync for LLM)');
  console.log('[INTENT]', DEFAULT_INTENT_SUMMARY);

  return {
    gateId: 'intent',
    status: 'soft_fail',
    output: DEFAULT_INTENT_SUMMARY,
    action: 'continue',
    failureReason: 'Sync mode - LLM not available',
    executionTimeMs: Date.now() - start,
  };
}
