// ═══════════════════════════════════════════════════════════════════════════════
// LLM ENGINE — Centralized OpenAI Configuration
// Single source of truth for LLM model selection across all gates
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';

// ─────────────────────────────────────────────────────────────────────────────────
// MODEL CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Pipeline model — Used for lightweight classification tasks:
 * - Intent classification
 * - Shield classification  
 * - Stance detection
 * - Lens data routing
 * - Capability selection
 * 
 * Default: gpt-5-mini (fast, cost-effective for classification)
 */
export const pipeline_model: string = 'gpt-5-mini';

/**
 * Model LLM — Used for heavy generation tasks:
 * - Response generation (Model Gate)
 * - Constitutional compliance checking (Personality Gate)
 * - Curriculum generation (SwordGate)
 * - Complex reasoning tasks
 * 
 * Default: gpt-5.2 (highest quality for user-facing responses)
 */
export const model_llm: string = 'gpt-5.2';

// ─────────────────────────────────────────────────────────────────────────────────
// OPENAI CLIENT SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

/**
 * Get the shared OpenAI client instance.
 * Creates client lazily on first call if API key is available.
 * 
 * @returns OpenAI client or null if no API key configured
 */
export function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Reset the OpenAI client singleton.
 * Useful for testing or when API key changes.
 */
export function resetOpenAIClient(): void {
  openaiClient = null;
}

/**
 * Check if OpenAI is available.
 * 
 * @returns true if API key is configured
 */
export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a chat completion using the pipeline model (classification tasks).
 * 
 * @param systemPrompt - System prompt for the model
 * @param userMessage - User message to classify
 * @param options - Additional options (temperature, max_tokens, etc.)
 * @returns Chat completion response or null on failure
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
      max_tokens: options.max_tokens ?? 200,
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error('[LLM_ENGINE] Pipeline model error:', error);
    return null;
  }
}

/**
 * Create a chat completion using the model LLM (generation tasks).
 * 
 * @param systemPrompt - System prompt for the model
 * @param userMessage - User message to respond to
 * @param options - Additional options (temperature, max_tokens, etc.)
 * @returns Chat completion response or null on failure
 */
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

    // Add conversation history if provided
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
      max_tokens: options.max_tokens ?? 1000,
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error('[LLM_ENGINE] Model LLM error:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export type { OpenAI };
