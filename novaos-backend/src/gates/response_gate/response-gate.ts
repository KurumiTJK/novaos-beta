// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE GATE — Provider Router + Response Generator
// 
// Routes to the appropriate provider (Gemini, OpenAI, etc.) based on
// Capability Gate output, applies Nova personality, returns response.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  SwordContext,
} from '../../types/index.js';

import { PERSONALITY_DESCRIPTORS } from './personality_descriptor.js';
import type {
  ResponseGateOutput,
  ResponseGateConfig,
  Personality,
  StitchedPrompt,
  CapabilityGateOutput,
  ProviderExecutor,
} from './types.js';
import type { ProviderName } from '../capability_gate/types.js';

// Provider executors
import { callGeminiGrounded } from './executors/gemini-grounded.executor.js';
import { callOpenAI } from './executors/openai.executor.js';

// Formatter
import { formatOutput } from './formatters/markdown.formatter.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────────

const DEBUG = process.env.DEBUG_RESPONSE_GATE === 'true';

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER EXECUTORS REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

const executors: Record<ProviderName, ProviderExecutor> = {
  'gemini_grounded': callGeminiGrounded,
  'openai': callOpenAI,
};

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS — PERSONALITY
// ─────────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PERSONALITY: Personality = {
  role: 'Nova, personal assistant',
  
  tone: `Allow light conversational softeners to reduce rigid precision and improve natural flow.
For lists, use simple dashes on new lines.`,
  
  descriptors: PERSONALITY_DESCRIPTORS,
};

// ─────────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Build the system prompt with personality.
 */
function buildSystemPrompt(personality: Personality, swordContext?: SwordContext): string {
  const parts: string[] = [];

  parts.push('Given the following personality:');
  parts.push(`ROLE: ${personality.role}`);
  parts.push(`TONE: ${personality.tone}`);
  parts.push(`DESCRIPTORS: ${personality.descriptors}`);
  parts.push('');
  parts.push('CONVERSATION CONTINUITY:');
  parts.push('Your previous responses in this conversation that contain specific data (prices, statistics, facts, dates) were based on verified real-time sources at that moment.');
  parts.push('Do not contradict or disclaim your own previous statements with phrases like "I don\'t have access to real-time data."');
  parts.push('If asked follow-up questions, build on what you already provided. The data may be slightly stale, but it was accurate when you stated it.');

  // ═══════════════════════════════════════════════════════════════════════════════
  // SWORDGATE CONTEXT INJECTION (Entry A)
  // ═══════════════════════════════════════════════════════════════════════════════
  // When the user has an active learning plan and sends a learning-related message,
  // inject their current context so responses can be personalized.
  
  if (swordContext?.hasActivePlan && swordContext.currentNode) {
    parts.push('');
    parts.push('═══════════════════════════════════════════════════════════════════');
    parts.push('USER\'S LEARNING CONTEXT (SwordGate):');
    parts.push('═══════════════════════════════════════════════════════════════════');
    parts.push(`Current Lesson: "${swordContext.currentNode.title}"`);
    parts.push(`Session: ${swordContext.currentNode.sessionNumber} of ${swordContext.currentNode.totalSessions}`);
    parts.push(`Learning Route: ${swordContext.currentNode.route}`);
    
    if (swordContext.currentSpark) {
      parts.push('');
      parts.push('Today\'s Spark (micro-action):');
      parts.push(`  Task: "${swordContext.currentSpark.task}"`);
      parts.push(`  Estimated time: ~${swordContext.currentSpark.estimatedMinutes} minutes`);
    }
    
    if (swordContext.completedNodes !== undefined && swordContext.totalNodes !== undefined) {
      const progress = Math.round((swordContext.completedNodes / swordContext.totalNodes) * 100);
      parts.push('');
      parts.push(`Overall Progress: ${swordContext.completedNodes}/${swordContext.totalNodes} lessons complete (${progress}%)`);
    }
    
    parts.push('');
    parts.push('INSTRUCTIONS FOR LEARNING CONTEXT:');
    parts.push('- Reference the user\'s current lesson naturally when relevant');
    parts.push('- If they ask about their progress, use the concrete numbers above');
    parts.push('- Encourage completion of today\'s spark if appropriate');
    parts.push('- Keep responses focused on their learning journey');
    parts.push('═══════════════════════════════════════════════════════════════════');
  }

  return parts.join('\n');
}

/**
 * Build the user prompt with topic context.
 */
function buildUserPrompt(userMessage: string, topic?: string): string {
  if (topic) {
    return `TOPIC: ${topic}\nMESSAGE: ${userMessage}`;
  }
  return userMessage;
}

/**
 * Stitch all components into a single prompt for the LLM.
 */
export function stitchPrompt(
  state: PipelineState,
  config?: ResponseGateConfig
): StitchedPrompt {
  const personality = config?.personality ?? DEFAULT_PERSONALITY;
  const capOutput = state.capabilityResult as CapabilityGateOutput | undefined;
  const topic = capOutput?.config?.topic;
  
  // Get SwordContext from stance gate output (Entry A enrichment)
  const swordContext = state.stanceResult?.swordContext;

  const system = buildSystemPrompt(personality, swordContext);
  const user = buildUserPrompt(state.userMessage, topic);

  return { system, user };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE RESPONSE GATE
// ─────────────────────────────────────────────────────────────────────────────────

export async function executeResponseGateAsync(
  state: PipelineState,
  context: PipelineContext,
  config?: ResponseGateConfig
): Promise<GateResult<ResponseGateOutput>> {
  const start = Date.now();

  // Get provider config from Capability Gate
  const capOutput = state.capabilityResult as CapabilityGateOutput;
  
  if (!capOutput?.provider) {
    console.error('[RESPONSE] ERROR: no provider in capabilityResult');
    return {
      gateId: 'response',
      status: 'hard_fail',
      output: { text: 'Internal error: no provider configured', model: 'error', tokensUsed: 0 },
      action: 'stop',
      failureReason: 'No provider in capabilityResult',
      executionTimeMs: Date.now() - start,
    };
  }

  const { provider, config: providerConfig } = capOutput;

  // Get executor for provider
  const executor = executors[provider];
  
  if (!executor) {
    console.error(`[RESPONSE] ERROR: unknown provider "${provider}"`);
    return {
      gateId: 'response',
      status: 'hard_fail',
      output: { text: `Internal error: unknown provider "${provider}"`, model: 'error', tokensUsed: 0 },
      action: 'stop',
      failureReason: `Unknown provider: ${provider}`,
      executionTimeMs: Date.now() - start,
    };
  }

  // Build prompts (now includes SwordContext if present)
  const { system, user } = stitchPrompt(state, config);

  if (DEBUG) {
    console.log(`[RESPONSE] provider: ${provider}`);
    console.log(`[RESPONSE] SYSTEM PROMPT:\n${system}`);
    console.log(`[RESPONSE] USER PROMPT:\n${user}`);
  }

  // Log if SwordContext is being used
  if (state.stanceResult?.swordContext?.hasActivePlan) {
    console.log(`[RESPONSE] SwordContext injected: "${state.stanceResult.swordContext.currentNode?.title}" ` +
      `(session ${state.stanceResult.swordContext.currentNode?.sessionNumber})`);
  }

  console.log(`[RESPONSE] provider: ${provider}`);

  // Execute provider
  try {
    const result = await executor(
      system,
      user,
      providerConfig,
      context.conversationHistory
    );

    // Post-process ALL responses
    result.text = formatOutput(result.text);

    console.log(`[RESPONSE] ${result.text.length} chars, model: ${result.model}`);

    // Check if generation failed
    if (result.model === 'error' || result.model === 'unavailable') {
      return {
        gateId: 'response',
        status: 'hard_fail',
        output: result,
        action: 'stop',
        failureReason: 'Provider execution failed',
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      gateId: 'response',
      status: 'pass',
      output: result,
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[RESPONSE] ERROR: ${errorMsg}`);
    return {
      gateId: 'response',
      status: 'hard_fail',
      output: { text: `Error: ${errorMsg}`, model: 'error', tokensUsed: 0 },
      action: 'stop',
      failureReason: errorMsg,
      executionTimeMs: Date.now() - start,
    };
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
  CapabilityGateOutput,
};
