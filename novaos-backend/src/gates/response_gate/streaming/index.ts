// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING ORCHESTRATOR
// Routes to appropriate streaming provider (OpenAI or Gemini)
// Supports both real streaming and fake streaming (for validated responses)
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response } from 'express';
import type { 
  PipelineState, 
  PipelineContext, 
  ProviderName,
  CapabilityGateOutput,
  ConversationMessage,
  Stance,
} from '../../../types/index.js';

import { stitchPrompt } from '../response-gate.js';
import { formatOutput } from '../formatters/markdown.formatter.js';
import { streamOpenAI } from './openai.stream.js';
import { streamGemini } from './gemini.stream.js';
import type { StreamEvent, StreamExecutor } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTOR REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

const streamExecutors: Record<ProviderName, StreamExecutor> = {
  'openai': streamOpenAI,
  'gemini_grounded': streamGemini,
};

// ─────────────────────────────────────────────────────────────────────────────────
// SSE HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function sendSSE(res: Response, event: StreamEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function setupSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────────
// THINKING EVENT — Keeps connection alive during high-risk pipeline
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Send initial SSE headers and a "thinking" event.
 * Call this BEFORE running the full pipeline for high-risk requests.
 * This keeps nginx happy while the pipeline runs.
 */
export function sendThinkingEvent(
  res: Response,
  conversationId: string,
  isNewConversation: boolean
): void {
  setupSSE(res);
  
  // Send meta event first
  sendSSE(res, {
    type: 'meta',
    provider: 'openai',
    conversationId,
    isNewConversation,
  });
  
  // Send thinking event - frontend can show a spinner/indicator
  sendSSE(res, {
    type: 'thinking',
  });
  
  console.log('[STREAM] Sent thinking event, pipeline running...');
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN STREAMING FUNCTION (Real LLM streaming)
// ─────────────────────────────────────────────────────────────────────────────────

export interface StreamingResult {
  fullText: string;
  tokensUsed: number;
  model: string;
}

/**
 * Execute streaming response generation.
 * Sends SSE events to the response as tokens arrive.
 * Returns the full text for saving to conversation history.
 */
export async function executeStreamingResponse(
  res: Response,
  state: PipelineState,
  context: PipelineContext,
  conversationId: string,
  isNewConversation: boolean
): Promise<StreamingResult> {
  // Setup SSE
  setupSSE(res);

  // Get provider config from Capability Gate
  const capOutput = state.capabilityResult as CapabilityGateOutput;
  
  if (!capOutput?.provider) {
    sendSSE(res, { type: 'error', error: 'No provider configured', code: 'NO_PROVIDER' });
    res.end();
    throw new Error('No provider in capabilityResult');
  }

  const { provider, config: providerConfig } = capOutput;

  // Get executor
  const executor = streamExecutors[provider];
  
  if (!executor) {
    sendSSE(res, { type: 'error', error: `Unknown provider: ${provider}`, code: 'UNKNOWN_PROVIDER' });
    res.end();
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Build prompts
  const { system, user } = stitchPrompt(state, context);

  console.log(`[STREAM] Starting stream with provider: ${provider}`);

  // Send meta event
  sendSSE(res, {
    type: 'meta',
    provider,
    conversationId,
    isNewConversation,
  });

  // Collect full text for post-processing
  let fullText = '';

  try {
    // Stream tokens
    const result = await executor(
      system,
      user,
      providerConfig!,
      (token: string) => {
        fullText += token;
        sendSSE(res, { type: 'token', text: token });
      },
      context.conversationHistory
    );

    // Post-process full text (markdown formatting)
    const formattedText = formatOutput(fullText);

    // Send done event
    sendSSE(res, {
      type: 'done',
      conversationId,
      stance: state.stance,
      tokensUsed: result.tokensUsed,
      model: result.model,
      isNewConversation,
    });

    res.end();

    console.log(`[STREAM] Complete: ${formattedText.length} chars, ${result.tokensUsed} tokens`);

    return {
      fullText: formattedText,
      tokensUsed: result.tokensUsed,
      model: result.model,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[STREAM] Error: ${errorMsg}`);
    
    sendSSE(res, { type: 'error', error: errorMsg, code: 'STREAM_ERROR' });
    res.end();
    
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FAKE STREAMING FUNCTION (For pre-validated responses)
// ─────────────────────────────────────────────────────────────────────────────────

export interface FakeStreamOptions {
  /** Characters per chunk (default: 8) */
  chunkSize?: number;
  /** Delay between chunks in ms (default: 15) */
  delayMs?: number;
  /** Provider name for meta event (default: 'openai') */
  provider?: ProviderName;
  /** Model name for done event (default: 'gpt-4o') */
  model?: string;
  /** Estimated tokens used (default: text.length / 4) */
  tokensUsed?: number;
}

/**
 * Fake stream a pre-generated response.
 * Used when Constitution gate has already validated the response.
 * Sends tokens with small delays to simulate real streaming.
 * 
 * If headers are already sent (e.g., from sendThinkingEvent), skips SSE setup.
 */
export async function executeFakeStreamingResponse(
  res: Response,
  text: string,
  conversationId: string,
  isNewConversation: boolean,
  stance: Stance | undefined,
  options: FakeStreamOptions = {}
): Promise<StreamingResult> {
  const {
    chunkSize = 8,
    delayMs = 15,
    provider = 'openai' as ProviderName,
    model = 'gpt-4o',
    tokensUsed = Math.ceil(text.length / 4),
  } = options;

  // Only setup SSE if headers not already sent (e.g., by sendThinkingEvent)
  if (!res.headersSent) {
    setupSSE(res);

    // Send meta event
    sendSSE(res, {
      type: 'meta',
      provider,
      conversationId,
      isNewConversation,
    });
  }

  console.log(`[STREAM] Starting fake stream: ${text.length} chars`);

  try {
    // Stream text in chunks with delays
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      sendSSE(res, { type: 'token', text: chunk });
      
      // Small delay between chunks (skip for last chunk)
      if (i + chunkSize < text.length) {
        await sleep(delayMs);
      }
    }

    // Send done event
    sendSSE(res, {
      type: 'done',
      conversationId,
      stance,
      tokensUsed,
      model,
      isNewConversation,
    });

    res.end();

    console.log(`[STREAM] Fake stream complete: ${text.length} chars`);

    return {
      fullText: text,
      tokensUsed,
      model,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[STREAM] Fake stream error: ${errorMsg}`);
    
    sendSSE(res, { type: 'error', error: errorMsg, code: 'STREAM_ERROR' });
    res.end();
    
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// RISK LEVEL DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Determine if the request is high risk and needs Constitution validation BEFORE streaming.
 * High risk = safety_signal is 'low', 'medium', or 'high' OR shield_acceptance is true
 * 
 * Note: Constitution gate still runs for low risk (it just skips and logs).
 * This function determines whether we need to WAIT for Constitution before streaming.
 */
export function isHighRisk(state: PipelineState): boolean {
  const safetySignal = state.intent_summary?.safety_signal ?? 'none';
  const shieldAcceptance = (state.shieldResult as any)?.shield_acceptance ?? false;
  
  // Any non-safe/none safety signal triggers full pipeline first
  if (safetySignal === 'low' || safetySignal === 'medium' || safetySignal === 'high') {
    console.log(`[STREAM] High risk detected: safety_signal=${safetySignal}`);
    return true;
  }
  
  // Shield acceptance triggers full pipeline first
  if (shieldAcceptance) {
    console.log(`[STREAM] High risk detected: shield_acceptance=true`);
    return true;
  }
  
  console.log(`[STREAM] Low risk: safety_signal=${safetySignal}, shield_acceptance=${shieldAcceptance}`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export type { StreamEvent, StreamExecutor } from './types.js';
