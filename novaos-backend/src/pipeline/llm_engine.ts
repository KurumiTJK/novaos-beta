// ═══════════════════════════════════════════════════════════════════════════════
// LLM ENGINE — Centralized OpenAI Configuration
// Single source of truth for LLM model selection across all gates
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import type { Generation, ConversationMessage } from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MODEL CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Pipeline model — Used for lightweight classification tasks:
 * - Intent classification
 * - Capability selection
 * - Memory detection
 * 
 * Default: gpt-5.2
 */
export const pipeline_model: string = 'gpt-5.2';

/**
 * Model LLM — Used for heavy generation tasks:
 * - Response generation (Response Gate)
 * - Constitutional compliance checking (Constitution Gate)
 * 
 * Default: gpt-5.2
 */
export const model_llm: string = 'gpt-5.2';

// ─────────────────────────────────────────────────────────────────────────────────
// OPENAI CLIENT SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

/**
 * Get the shared OpenAI client instance.
 * Creates client lazily on first call if API key is available.
 */
export function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Reset the OpenAI client singleton.
 */
export function resetOpenAIClient(): void {
  openaiClient = null;
}

/**
 * Check if OpenAI is available.
 */
export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION (pipeline_model) — Returns string
// Used by: Intent Gate, Capability Selector, Memory Gate
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Classify using pipeline model. Returns string or null.
 */
export async function classifyWithPipelineModel(
  systemPrompt: string,
  userMessage: string,
  options: {
    temperature?: number;
    max_tokens?: number;
  } = {}
): Promise<string | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: pipeline_model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: options.temperature ?? 0,
      max_completion_tokens: options.max_tokens ?? 200,
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error('[LLM_ENGINE] Pipeline model error:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATION (model_llm) — Returns Generation object
// Used by: Response Gate, Constitution Gate
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate response for Response Gate.
 * Supports conversation history for multi-turn context.
 */
export async function generateForResponseGate(
  systemPrompt: string,
  userPrompt: string,
  conversationHistory?: readonly ConversationMessage[]
): Promise<Generation> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.error('[LLM_ENGINE] OpenAI client not available');
    return {
      text: 'I apologize, but I am currently unavailable. Please try again later.',
      model: 'unavailable',
      tokensUsed: 0,
    };
  }

  try {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversationHistory?.length) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    // Add current user prompt
    messages.push({ role: 'user', content: userPrompt });

    const response = await client.chat.completions.create({
      model: model_llm,
      messages,
      temperature: 0.7,
      max_completion_tokens: 2048,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    const tokensUsed = response.usage?.total_tokens ?? 0;

    return {
      text,
      model: model_llm,
      tokensUsed,
    };
  } catch (error) {
    console.error('[LLM_ENGINE] Response generation error:', error);
    return {
      text: 'I apologize, but I encountered an error. Please try again.',
      model: 'error',
      tokensUsed: 0,
    };
  }
}

/**
 * Generate response for Constitution Gate.
 * No conversation history needed — just checks a single response.
 */
export async function generateForConstitutionGate(
  systemPrompt: string,
  userPrompt: string
): Promise<Generation> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.error('[LLM_ENGINE] OpenAI client not available');
    // Return "no violation" on client unavailable to not block pipeline
    return {
      text: '{"violates": false, "reason": null, "fix": null}',
      model: 'unavailable',
      tokensUsed: 0,
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: model_llm,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_completion_tokens: 500,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    const tokensUsed = response.usage?.total_tokens ?? 0;

    return {
      text,
      model: model_llm,
      tokensUsed,
    };
  } catch (error) {
    console.error('[LLM_ENGINE] Constitution check error:', error);
    // Return "no violation" on error to not block pipeline
    return {
      text: '{"violates": false, "reason": null, "fix": null}',
      model: 'error',
      tokensUsed: 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// LEGACY EXPORT (for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────────

export async function generateWithModelLLM(
  systemPrompt: string,
  userMessage: string,
  options: {
    temperature?: number;
    max_tokens?: number;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  } = {}
): Promise<string | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (options.conversationHistory) {
      for (const msg of options.conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await client.chat.completions.create({
      model: model_llm,
      messages,
      temperature: options.temperature ?? 0.7,
      max_completion_tokens: options.max_tokens ?? 2048,
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error('[LLM_ENGINE] Model LLM error:', error);
    return null;
  }
}

export type { OpenAI };
