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
  ShieldContext,
  ConversationMessage,
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
// VERIFIED FACTS EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract verified facts from conversation history.
 * These are assistant messages that were generated using grounded search (liveData: true).
 * Used to prevent subsequent responses from contradicting verified information.
 */
function extractVerifiedFacts(history?: readonly ConversationMessage[]): string[] {
  if (!history?.length) return [];
  
  const verified: string[] = [];
  for (const msg of history) {
    if (msg.role === 'assistant' && msg.metadata?.liveData === true) {
      verified.push(msg.content);
    }
  }
  return verified;
}

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
function buildSystemPrompt(
  personality: Personality, 
  swordContext?: SwordContext,
  shieldContext?: ShieldContext,
  conversationHistory?: readonly ConversationMessage[]
): string {
  const parts: string[] = [];

  parts.push('Given the following personality:');
  parts.push(`ROLE: ${personality.role}`);
  parts.push(`TONE: ${personality.tone}`);
  parts.push(`DESCRIPTORS: ${personality.descriptors}`);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // CONVERSATION CONTINUITY — Verified Facts Injection
  // ═══════════════════════════════════════════════════════════════════════════════
  // When prior messages used grounded search (liveData: true), inject those facts
  // explicitly to prevent the model from contradicting verified information.
  
  parts.push('');
  parts.push('CONVERSATION CONTINUITY:');
  parts.push('Your previous responses in this conversation that contain specific data (prices, statistics, facts, dates) were based on verified real-time sources at that moment.');
  parts.push('Do not contradict or disclaim your own previous statements with phrases like "I don\'t have access to real-time data."');
  parts.push('If asked follow-up questions, build on what you already provided.');

  const verifiedFacts = extractVerifiedFacts(conversationHistory);

  if (verifiedFacts.length > 0) {
    parts.push('');
    parts.push('═══════════════════════════════════════════════════════════════════');
    parts.push('VERIFIED FACTS FROM THIS CONVERSATION (from real-time search):');
    parts.push('═══════════════════════════════════════════════════════════════════');
    parts.push('The following previous responses were generated using live web search and contain verified information.');
    parts.push('DO NOT contradict, disclaim, or cast doubt on these facts.');
    parts.push('');
    verifiedFacts.forEach((fact, i) => {
      parts.push(`[Verified Response ${i + 1}]:`);
      parts.push(fact);
      parts.push('');
    });
    parts.push('═══════════════════════════════════════════════════════════════════');
  }

  parts.push('');
  parts.push('RULES:');
  parts.push('- Never say "I don\'t have access to real-time data" if you already provided that data in this conversation');
  parts.push('- Never contradict your own previous verified statements');
  parts.push('- If user thanks you or acknowledges info, accept gracefully without disclaimers');
  parts.push('- Build on established facts; do not walk them back');

  // ═══════════════════════════════════════════════════════════════════════════════
  // SHIELD CONTEXT INJECTION — User acknowledged risk warning
  // ═══════════════════════════════════════════════════════════════════════════════
  // When the user has been shown a risk warning and clicked "I Understand",
  // inject context so the LLM knows to be helpful rather than refusing.
  
  if (shieldContext?.acknowledged) {
    parts.push('');
    parts.push('═══════════════════════════════════════════════════════════════════');
    parts.push('RISK ACKNOWLEDGMENT:');
    parts.push('═══════════════════════════════════════════════════════════════════');
    parts.push('The user has been shown a risk warning and explicitly confirmed they want to proceed.');
    parts.push('');
    
    if (shieldContext.domain) {
      parts.push(`Domain: ${shieldContext.domain}`);
    }
    
    if (shieldContext.warningShown) {
      parts.push(`Warning shown: "${shieldContext.warningShown}"`);
    }
    
    parts.push('');
    parts.push('INSTRUCTIONS:');
    parts.push('- The user understands and accepts the risks involved');
    parts.push('- Respond to their actual request or statement with helpful guidance');
    parts.push('- If they stated an intention, engage with that intention directly');
    parts.push('- Do NOT interpret this as a request to help them "phrase" or "say" something');
    parts.push('- Do NOT offer to help them reword or communicate their message');
    parts.push('- Treat their message as the topic they want help WITH, not help phrasing');
    parts.push('- Brief relevant caveats are fine, but do not refuse or over-warn');
    parts.push('- Be genuinely helpful now that informed consent is established');
    parts.push('- Do not repeat the warning they already acknowledged');
    parts.push('═══════════════════════════════════════════════════════════════════');
  }

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
  contextOrConfig?: PipelineContext | ResponseGateConfig,
  config?: ResponseGateConfig
): StitchedPrompt {
  // Handle backward compatibility: stitchPrompt(state, config) vs stitchPrompt(state, context, config)
  let context: PipelineContext | undefined;
  let actualConfig: ResponseGateConfig | undefined;
  
  if (contextOrConfig && 'personality' in contextOrConfig) {
    // Old signature: stitchPrompt(state, config)
    actualConfig = contextOrConfig as ResponseGateConfig;
    context = undefined;
  } else {
    // New signature: stitchPrompt(state, context, config)
    context = contextOrConfig as PipelineContext | undefined;
    actualConfig = config;
  }
  
  const personality = actualConfig?.personality ?? DEFAULT_PERSONALITY;
  const capOutput = state.capabilityResult as CapabilityGateOutput | undefined;
  const topic = capOutput?.config?.topic;
  
  // Get SwordContext from stance gate output (Entry A enrichment)
  const swordContext = state.stanceResult?.swordContext;
  
  // Get ShieldContext from pipeline context (set by /shield/confirm)
  const shieldContext = context?.shieldContext;

  const system = buildSystemPrompt(
    personality, 
    swordContext, 
    shieldContext,
    context?.conversationHistory
  );
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

  // Build prompts (now includes SwordContext, ShieldContext, and verified facts if present)
  const { system, user } = stitchPrompt(state, context, config);

  if (DEBUG) {
    console.log(`[RESPONSE] provider: ${provider}`);
    console.log(`[RESPONSE] SYSTEM PROMPT:\n${system}`);
    console.log(`[RESPONSE] USER PROMPT:\n${user}`);
  }

  // Log if ShieldContext is being used
  if (context.shieldContext?.acknowledged) {
    console.log(`[RESPONSE] ShieldContext injected: domain="${context.shieldContext.domain}", acknowledged=true`);
  }

  // Log if SwordContext is being used
  if (state.stanceResult?.swordContext?.hasActivePlan) {
    console.log(`[RESPONSE] SwordContext injected: "${state.stanceResult.swordContext.currentNode?.title}" ` +
      `(session ${state.stanceResult.swordContext.currentNode?.sessionNumber})`);
  }

  // Log if verified facts are being injected
  const verifiedCount = extractVerifiedFacts(context.conversationHistory).length;
  if (verifiedCount > 0) {
    console.log(`[RESPONSE] Verified facts injected: ${verifiedCount} previous response(s)`);
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
