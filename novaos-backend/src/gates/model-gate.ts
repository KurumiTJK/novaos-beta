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
} from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE TYPES (inlined to avoid circular dependency)
// These must match the types in ./capability/types.ts
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
  personality: string;
}

export interface StitchedPrompt {
  system: string;
  user: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS — PERSONALITY (hardcoded)
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_PERSONALITY: Personality = {
  role: 'Nova, personal assistant',
  
  tone: `Allow light conversational softeners to reduce rigid precision and improve natural flow.
Never use markdown formatting (no **bold**, *italic*, ###headers, or \`code\`).
Use plain text only. For lists, use simple dashes on new lines.`,
  
  personality: `Be concise and direct.
Distinguish facts from inference from speculation.
Never fabricate information.
Calibrate confidence to evidence.
Respect user autonomy.
Do not foster dependency.`,
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
 *   ...
 */
export function stitchPrompt(
  state: PipelineState,
  config?: ModelGateConfig
): StitchedPrompt {
  const personality = config?.personality ?? DEFAULT_PERSONALITY;

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM PROMPT
  // ═══════════════════════════════════════════════════════════════════════════
  
  const system = `Given the following personality:

ROLE: ${personality.role}

TONE: ${personality.tone}

PERSONALITY: ${personality.personality}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // USER PROMPT
  // ═══════════════════════════════════════════════════════════════════════════
  
  const userParts: string[] = [];

  // 1. Original message
  userParts.push(state.userMessage);

  // 2. Context (intent + shield)
  const contextBlock = buildContextBlock(state);
  if (contextBlock) {
    userParts.push(contextBlock);
  }

  // 3. Evidence (from Capability Gate)
  const evidenceBlock = buildEvidenceBlock(state);
  if (evidenceBlock) {
    userParts.push(evidenceBlock);
  }

  return {
    system,
    user: userParts.join('\n\n'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// BLOCK BUILDERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Build context block from intent and shield results.
 */
function buildContextBlock(state: PipelineState): string | null {
  const parts: string[] = ['CONTEXT:'];

  // Intent
  if (state.intent) {
    const intentType = state.intent.type ?? 'unknown';
    const intentDomain = state.intent.domain ?? state.intent.primaryDomain ?? 'general';
    parts.push(`Intent: ${intentType} / ${intentDomain}`);
  }

  // Shield
  if (state.shieldResult) {
    const shieldStatus = state.shieldResult.riskLevel ?? 'safe';
    parts.push(`Shield: ${shieldStatus}`);
  }

  // Only return if we have content beyond the header
  if (parts.length <= 1) {
    return null;
  }

  return parts.join('\n');
}

/**
 * Build evidence block from Capability Gate output.
 * Also indicates if capabilities were attempted but returned no evidence.
 */
function buildEvidenceBlock(state: PipelineState): string | null {
  // Try to get evidence from capabilities
  // The new CapabilityGateOutput has evidenceItems[]
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
// GATE EXECUTION — SYNC (Mock Mode)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Execute Model Gate synchronously (mock mode).
 */
export function executeModelGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<ModelGateOutput> {
  const start = Date.now();

  // ─────────────────────────────────────────────────────────────────────────
  // LOG INPUTS (same as async version)
  // ─────────────────────────────────────────────────────────────────────────
  
  // Intent
  if (state.intent) {
    const intentType = state.intent.type ?? 'unknown';
    const intentDomain = state.intent.domain ?? state.intent.primaryDomain ?? 'general';
    const confidence = state.intent.confidence !== undefined 
      ? (state.intent.confidence * 100).toFixed(0) 
      : '?';
    console.log(`[MODEL] Intent: ${intentType} / ${intentDomain} (${confidence}%)`);
  } else {
    console.log('[MODEL] Intent: none');
  }

  // Shield
  if (state.shieldResult) {
    const riskLevel = state.shieldResult.riskLevel ?? 'unknown';
    const controlMode = state.shieldResult.controlMode ? ' [CONTROL]' : '';
    console.log(`[MODEL] Shield: ${riskLevel}${controlMode}`);
  } else {
    console.log('[MODEL] Shield: none');
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

  // Build stitched prompt
  const { system, user } = stitchPrompt(state);
  console.log(`[MODEL] Prompt stitched (system: ${system.length} chars, user: ${user.length} chars)`);
  console.log('[MODEL] Mode: mock');

  // Generate mock response based on stance
  const mockResponses: Record<string, string> = {
    control: "I notice you might be going through a difficult time. How can I help you today?",
    shield: "Let me help you think through this carefully.",
    lens: "Here's what I understand about your question.",
    sword: "Let's focus on your next step.",
  };

  const text = mockResponses[state.stance ?? 'lens'] ?? mockResponses.lens;

  return {
    gateId: 'model',
    status: 'pass',
    output: {
      text,
      model: 'mock',
      tokensUsed: 0,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE EXECUTION — ASYNC (Real LLM)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Execute Model Gate asynchronously with real LLM.
 * 
 * @param state - Pipeline state with all gate results
 * @param context - Pipeline context
 * @param generateFn - Function to call LLM (provided by ProviderManager)
 * @param config - Optional configuration overrides
 */
export async function executeModelGateAsync(
  state: PipelineState,
  context: PipelineContext,
  generateFn: (
    prompt: string,
    systemPrompt: string,
    constraints?: GenerationConstraints
  ) => Promise<Generation>,
  config?: ModelGateConfig
): Promise<GateResult<ModelGateOutput>> {
  const start = Date.now();

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // LOG INPUTS
    // ─────────────────────────────────────────────────────────────────────────
    
    // Intent
    if (state.intent) {
      const intentType = state.intent.type ?? 'unknown';
      const intentDomain = state.intent.domain ?? state.intent.primaryDomain ?? 'general';
      const confidence = state.intent.confidence !== undefined 
        ? (state.intent.confidence * 100).toFixed(0) 
        : '?';
      console.log(`[MODEL] Intent: ${intentType} / ${intentDomain} (${confidence}%)`);
    } else {
      console.log('[MODEL] Intent: none');
    }

    // Shield
    if (state.shieldResult) {
      const riskLevel = state.shieldResult.riskLevel ?? 'unknown';
      const controlMode = state.shieldResult.controlMode ? ' [CONTROL]' : '';
      console.log(`[MODEL] Shield: ${riskLevel}${controlMode}`);
    } else {
      console.log('[MODEL] Shield: none');
    }

    // Evidence
    const capOutput = state.capabilities as CapabilityGateOutput | undefined;
    if (capOutput?.evidenceItems && capOutput.evidenceItems.length > 0) {
      console.log(`[MODEL] Evidence: ${capOutput.evidenceItems.length} item(s)`);
      for (const item of capOutput.evidenceItems) {
        // Show first line of formatted evidence (truncated)
        const firstLine = item.formatted.split('\n')[0] ?? '';
        const preview = firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine;
        console.log(`[MODEL]   └─ [${item.type.toUpperCase()}] ${preview}`);
      }
    } else if (capOutput?.capabilitiesUsed && capOutput.capabilitiesUsed.length > 0) {
      // Capabilities were attempted but no evidence returned
      console.log(`[MODEL] Evidence: FETCH FAILED (attempted: ${capOutput.capabilitiesUsed.join(', ')})`);
    } else {
      console.log('[MODEL] Evidence: none');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STITCH PROMPT
    // ─────────────────────────────────────────────────────────────────────────
    const { system, user } = stitchPrompt(state, config);
    console.log(`[MODEL] Prompt stitched (system: ${system.length} chars, user: ${user.length} chars)`);

    // ─────────────────────────────────────────────────────────────────────────
    // CALL LLM
    // ─────────────────────────────────────────────────────────────────────────
    const response = await generateFn(user, system, undefined);
    console.log(`[MODEL] Response: ${response.text.length} chars, model: ${response.model}`);

    return {
      gateId: 'model',
      status: 'pass',
      output: {
        text: response.text,
        model: response.model,
        tokensUsed: response.tokensUsed,
        constraints: response.constraints,
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };

  } catch (error) {
    console.error('[MODEL] Generation error:', error);

    return {
      gateId: 'model',
      status: 'soft_fail',
      output: {
        text: "I apologize, but I'm having some technical difficulties. Please try again in a moment.",
        model: 'fallback',
        tokensUsed: 0,
        fallbackUsed: true,
      },
      action: 'continue',
      failureReason: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: Date.now() - start,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export { DEFAULT_PERSONALITY };
