// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE GATE — The Stitcher
// 
// Assembles personality + message + evidence into a single prompt,
// sends to LLM, returns response.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';

import { generateForResponseGate, model_llm } from '../../pipeline/llm_engine.js';
import { PERSONALITY_DESCRIPTORS } from './personality_descriptor.js';
import type {
  ResponseGateOutput,
  ResponseGateConfig,
  Personality,
  StitchedPrompt,
  CapabilityGateOutput,
  EvidenceItem,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────────

const DEBUG = process.env.DEBUG_RESPONSE_GATE === 'true'; // Default OFF

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS — PERSONALITY
// ─────────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PERSONALITY: Personality = {
  role: 'Nova, personal assistant',
  
  tone: `Allow light conversational softeners to reduce rigid precision and improve natural flow.
Never use markdown formatting (no **bold**, *italic*, ###headers, or \`code\`).
Use plain text only. For lists, use simple dashes on new lines.`,
  
  descriptors: PERSONALITY_DESCRIPTORS,
};

// ─────────────────────────────────────────────────────────────────────────────────
// PROMPT STITCHER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Stitch all components into a single prompt for the LLM.
 */
export function stitchPrompt(
  state: PipelineState,
  config?: ResponseGateConfig
): StitchedPrompt {
  const personality = config?.personality ?? DEFAULT_PERSONALITY;

  // Build system prompt
  const system = buildSystemPrompt(personality);

  // Build user prompt
  const user = buildUserPrompt(state);

  return { system, user };
}

/**
 * Build the system prompt with personality.
 */
function buildSystemPrompt(personality: Personality): string {
  const parts: string[] = [];

  parts.push('Given the following personality:');
  parts.push(`ROLE: ${personality.role}`);
  parts.push(`TONE: ${personality.tone}`);
  parts.push(`DESCRIPTORS: ${personality.descriptors}`);
  parts.push('');
  parts.push('EVIDENCE HANDLING:');
  parts.push('When EVIDENCE is provided, treat it as verified and authoritative.');
  parts.push('Base your response on the evidence. Do not contradict, dismiss, or second-guess evidence.');
  parts.push('If evidence conflicts with your training data, trust the evidence — it is more current.');
  parts.push('Present information naturally as facts. Do not reference "evidence," "sources," or "what you provided" — just state the information directly.');

  return parts.join('\n');
}

/**
 * Build the user prompt with message and evidence.
 */
function buildUserPrompt(state: PipelineState): string {
  const parts: string[] = [];

  // Original message
  parts.push(state.userMessage);

  // Evidence from capabilities
  const evidenceBlock = buildEvidenceBlock(state);
  if (evidenceBlock) {
    parts.push('');
    parts.push(evidenceBlock);
  }

  return parts.join('\n');
}

/**
 * Build evidence block from Capability Gate output.
 */
function buildEvidenceBlock(state: PipelineState): string | null {
  const capOutput = state.capabilityResult as CapabilityGateOutput | undefined;
  
  // Case 1: Has evidence items
  if (capOutput?.evidenceItems && capOutput.evidenceItems.length > 0) {
    const parts: string[] = ['EVIDENCE:'];

    for (const item of capOutput.evidenceItems) {
      parts.push(`[${item.type.toUpperCase()}]`);
      parts.push(item.formatted);
      parts.push(''); // blank line between items
    }

    parts.push('Use this data in your response.');
    return parts.join('\n');
  }
  
  // Case 2: Capabilities were selected but no evidence returned (fetch failed)
  if (capOutput?.capabilitiesUsed && capOutput.capabilitiesUsed.length > 0) {
    const attempted = capOutput.capabilitiesUsed.join(', ');
    return `EVIDENCE:
[FETCH FAILED]
Attempted to fetch: ${attempted}
No data was returned. Acknowledge this to the user and offer alternatives.`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC GATE (real LLM)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Asynchronous Response Gate for real LLM calls.
 * Calls llm_engine directly — no callback injection.
 */
export async function executeResponseGateAsync(
  state: PipelineState,
  context: PipelineContext,
  config?: ResponseGateConfig
): Promise<GateResult<ResponseGateOutput>> {
  const start = Date.now();

  // Stitch the prompt
  const { system, user } = stitchPrompt(state, config);
  
  if (DEBUG) {
    logGateState(state);
    console.log(`[RESPONSE] SYSTEM PROMPT:\n${system}`);
    console.log(`[RESPONSE] USER PROMPT:\n${user}`);
  }

  // Call LLM directly via llm_engine
  const generation = await generateForResponseGate(
    system,
    user,
    context.conversationHistory
  );

  console.log(`[RESPONSE] Response: ${generation.text.length} chars, model: ${model_llm}`);

  // Check if generation failed
  if (generation.model === 'error' || generation.model === 'unavailable') {
    return {
      gateId: 'response',
      status: 'hard_fail',
      output: {
        text: generation.text,
        model: generation.model,
        tokensUsed: generation.tokensUsed,
      },
      action: 'stop',
      failureReason: 'LLM generation failed',
      executionTimeMs: Date.now() - start,
    };
  }

  return {
    gateId: 'response',
    status: 'pass',
    output: generation,
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGING HELPER
// ─────────────────────────────────────────────────────────────────────────────────

function logGateState(state: PipelineState): void {
  const capOutput = state.capabilityResult as CapabilityGateOutput | undefined;
  if (capOutput?.evidenceItems && capOutput.evidenceItems.length > 0) {
    console.log(`[RESPONSE] Evidence: ${capOutput.evidenceItems.length} item(s)`);
    for (const item of capOutput.evidenceItems) {
      console.log(`[RESPONSE]   └─ [${item.type.toUpperCase()}]`);
    }
  } else if (capOutput?.capabilitiesUsed && capOutput.capabilitiesUsed.length > 0) {
    console.log(`[RESPONSE] Evidence: FETCH FAILED (attempted: ${capOutput.capabilitiesUsed.join(', ')})`);
  } else {
    console.log('[RESPONSE] Evidence: none');
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  ResponseGateOutput,
  ResponseGateConfig,
  Personality,
  StitchedPrompt,
  EvidenceItem,
  CapabilityGateOutput,
};
