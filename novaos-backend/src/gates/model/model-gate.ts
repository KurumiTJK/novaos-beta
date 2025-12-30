// ═══════════════════════════════════════════════════════════════════════════════
// MODEL GATE — The Stitcher
// 
// Assembles personality + message + context + evidence into a single prompt,
// sends to LLM, returns response.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  Generation,
  GenerationConstraints,
} from '../../types/index.js';

import { PERSONALITY_DESCRIPTORS } from './personality_descriptor.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE TYPES (inlined to avoid circular dependency)
// These must match the types in ../capability/types.ts
// ─────────────────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  type: string;
  formatted: string;
  source: string;
  fetchedAt: number;
  raw?: unknown;
}

export interface CapabilityGateOutput {
  route: 'lens' | 'sword';
  capabilitiesUsed: string[];
  evidenceItems: EvidenceItem[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ModelGateOutput extends Generation {
  // Inherits: text, model, tokensUsed, constraints, fallbackUsed
}

export interface ModelGateConfig {
  /** Override default model */
  model?: string;
  /** Override personality */
  personality?: Personality;
}

export interface Personality {
  role: string;
  tone: string;
  descriptors: string;
}

export interface StitchedPrompt {
  system: string;
  user: string;
}

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
 * 
 * Structure:
 * 
 * SYSTEM:
 *   Given the following personality:
 *   ROLE: ...
 *   TONE: ...
 *   PERSONALITY: ...
 * 
 * USER:
 *   {message}
 *   
 *   CONTEXT:
 *   Intent: ...
 *   Shield: ...
 *   
 *   EVIDENCE:
 *   [STOCK]
 *   ...
 */
export function stitchPrompt(
  state: PipelineState,
  config?: ModelGateConfig
): StitchedPrompt {
  const personality = config?.personality ?? DEFAULT_PERSONALITY;

  // Build system prompt
  const system = buildSystemPrompt(personality, state);

  // Build user prompt
  const user = buildUserPrompt(state);

  return { system, user };
}

/**
 * Build the system prompt with personality and any stance-specific adjustments.
 */
function buildSystemPrompt(personality: Personality, state: PipelineState): string {
  const parts: string[] = [];

  parts.push('Given the following personality:');
  parts.push(`ROLE: ${personality.role}`);
  parts.push(`TONE: ${personality.tone}`);
  parts.push(`DESCRIPTORS: ${personality.descriptors}`);

  // Add control mode instructions if active
  if (state.shieldResult?.controlMode) {
    parts.push('');
    parts.push('CRITICAL: User may be in crisis. Respond with compassion. Include crisis resources.');
  }

  return parts.join('\n');
}

/**
 * Build the user prompt with message, context hints, and evidence.
 */
function buildUserPrompt(state: PipelineState): string {
  const parts: string[] = [];

  // Original message
  parts.push(state.userMessage);

  // Context hints (lightweight, not full context)
  const contextBlock = buildContextBlock(state);
  if (contextBlock) {
    parts.push('');
    parts.push(contextBlock);
  }

  // Evidence from capabilities
  const evidenceBlock = buildEvidenceBlock(state);
  if (evidenceBlock) {
    parts.push('');
    parts.push(evidenceBlock);
  }

  return parts.join('\n');
}

/**
 * Build lightweight context hints for the LLM.
 */
function buildContextBlock(state: PipelineState): string | null {
  const hints: string[] = [];

  // Intent hint
  if (state.intent) {
    const domain = state.intent.domains?.[0] ?? 'general';
    hints.push(`Intent: ${state.intent.type} / ${domain}`);
  }

  // Shield hint (only if noteworthy)
  if (state.shieldResult?.riskLevel && state.shieldResult.riskLevel !== 'safe') {
    hints.push(`Risk: ${state.shieldResult.riskLevel}`);
  }

  if (hints.length === 0) {
    return null;
  }

  return 'CONTEXT:\n' + hints.join('\n');
}

/**
 * Build evidence block from Capability Gate output.
 * Also indicates if capabilities were attempted but returned no evidence.
 */
function buildEvidenceBlock(state: PipelineState): string | null {
  const capOutput = state.capabilities as CapabilityGateOutput | undefined;
  
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
// MOCK RESPONSES
// ─────────────────────────────────────────────────────────────────────────────────

const MOCK_RESPONSES: Record<string, string> = {
  question: 'Based on my knowledge, here is the information you requested.',
  action: 'I can help you with that. Here are the steps to accomplish your goal.',
  planning: 'Let me help you create a plan for this.',
  rewrite: 'Here is the improved version of your text.',
  summarize: 'Here is a concise summary of the key points.',
  translate: 'Here is the translation.',
  conversation: 'I understand. How can I assist you further?',
  greeting: 'Hello! How can I help you today?',
  default: 'I understand your request. Here is my response.',
};

// ─────────────────────────────────────────────────────────────────────────────────
// SYNC GATE (mock mode)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Synchronous Model Gate for mock/testing.
 * Does NOT call LLM - returns canned responses.
 */
export function executeModelGate(
  state: PipelineState,
  _context: PipelineContext,
  config?: ModelGateConfig
): GateResult<ModelGateOutput> {
  const start = Date.now();

  // Log what we're doing
  logGateState(state, true);

  // Stitch prompt (even in mock mode, for consistency)
  const { system, user } = stitchPrompt(state, config);
  console.log(`[MODEL] Prompt stitched (system: ${system.length} chars, user: ${user.length} chars)`);
  console.log('[MODEL] Mode: mock');

  // Generate mock response based on intent
  const intentType = state.intent?.type ?? 'default';
  const text: string = MOCK_RESPONSES[intentType] ?? MOCK_RESPONSES.default ?? 'I understand. How can I help you?';

  console.log(`[MODEL] Response: ${text.length} chars, model: mock-v1`);

  return {
    gateId: 'model',
    status: 'pass',
    output: {
      text,
      model: 'mock-v1',
      tokensUsed: text.split(/\s+/).length,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC GATE (real LLM)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Asynchronous Model Gate for real LLM calls.
 * 
 * @param state - Pipeline state with intent, shield, capabilities, etc.
 * @param context - Pipeline context
 * @param generateFn - Function to call the LLM (injected from ProviderManager)
 * @param config - Optional configuration overrides
 */
export async function executeModelGateAsync(
  state: PipelineState,
  _context: PipelineContext,
  generateFn: (
    prompt: string,
    systemPrompt: string,
    constraints?: GenerationConstraints
  ) => Promise<Generation>,
  config?: ModelGateConfig
): Promise<GateResult<ModelGateOutput>> {
  const start = Date.now();

  // Log what we're working with
  logGateState(state, false);

  // Stitch the prompt
  const { system, user } = stitchPrompt(state, config);
  
  // Debug: show full assembled prompts
  console.log(`[MODEL] SYSTEM:\n${system}`);
  console.log(`[MODEL] USER:\n${user}`);

  try {
    // Call the LLM
    const generation = await generateFn(user, system);

    console.log(`[MODEL] Response: ${generation.text.length} chars, model: ${generation.model}`);

    return {
      gateId: 'model',
      status: 'pass',
      output: generation,
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    console.error('[MODEL] Generation failed:', error);

    // Fall back to mock
    const mockResult = executeModelGate(state, _context, config);
    return {
      ...mockResult,
      output: {
        ...mockResult.output,
        fallbackUsed: true,
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGING HELPER
// ─────────────────────────────────────────────────────────────────────────────────

function logGateState(state: PipelineState, isMock: boolean): void {
  // Intent
  if (state.intent) {
    const domain = state.intent.domains?.[0] ?? 'general';
    const confidence = Math.round((state.intent.confidence ?? 0) * 100);
    console.log(`[MODEL] Intent: ${state.intent.type} / ${domain} (${confidence}%)`);
  }

  // Shield
  if (state.shieldResult) {
    const risk = state.shieldResult.riskLevel ?? 'safe';
    const control = state.shieldResult.controlMode ? ' [CONTROL]' : '';
    console.log(`[MODEL] Shield: ${risk}${control}`);
  } else {
    console.log('[MODEL] Shield: safe');
  }

  // Evidence
  const capOutput = state.capabilities as CapabilityGateOutput | undefined;
  if (capOutput?.evidenceItems && capOutput.evidenceItems.length > 0) {
    console.log(`[MODEL] Evidence: ${capOutput.evidenceItems.length} item(s)`);
    for (const item of capOutput.evidenceItems) {
      const firstLine = item.formatted.split('\n')[0] ?? '';
      const preview = firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine;
      console.log(`[MODEL]   └─ [${item.type.toUpperCase()}] ${preview}`);
    }
  } else if (capOutput?.capabilitiesUsed && capOutput.capabilitiesUsed.length > 0) {
    console.log(`[MODEL] Evidence: FETCH FAILED (attempted: ${capOutput.capabilitiesUsed.join(', ')})`);
  } else {
    console.log('[MODEL] Evidence: none');
  }
}
