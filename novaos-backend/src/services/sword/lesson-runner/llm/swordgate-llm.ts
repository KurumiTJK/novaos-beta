// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE LLM — Gemini 3 Pro Integration
// Configurable LLM for SwordGate exploration and learning flows
// ═══════════════════════════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  thinkingLevel?: 'low' | 'high';
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  text: string;
  model: string;
  thinkingLevel: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('[SWORDGATE_LLM] GEMINI_API_KEY not set');
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Check if SwordGate LLM is available
 */
export function isAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Reset client (for testing)
 */
export function resetClient(): void {
  client = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

function getModel(): string {
  return process.env.SWORDGATE_LLM_MODEL || 'gemini-3-pro-preview';
}

function getDefaultThinkingLevel(): 'low' | 'high' {
  const level = process.env.SWORDGATE_LLM_THINKING_LEVEL;
  if (level === 'low' || level === 'high') {
    return level;
  }
  return 'high'; // Default to high for complex reasoning
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN CHAT FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Send a chat request to Gemini 3 Pro
 * 
 * @param messages - Array of messages (system, user, assistant)
 * @param options - Optional configuration
 * @returns Response text
 * @throws Error if API call fails
 */
export async function chat(
  messages: Message[],
  options: ChatOptions = {}
): Promise<ChatResponse> {
  const ai = getClient();
  const model = getModel();
  const thinkingLevel = options.thinkingLevel || getDefaultThinkingLevel();

  // Extract system message (Gemini doesn't have system role, prepend to first user message)
  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const conversationMessages = messages.filter(m => m.role !== 'system');

  if (conversationMessages.length === 0) {
    throw new Error('[SWORDGATE_LLM] No user/assistant messages provided');
  }

  // Convert to Gemini format
  // Gemini uses 'user' and 'model' roles
  const contents = conversationMessages.map((msg, index) => {
    let text = msg.content;
    
    // Prepend system message to first user message
    if (index === 0 && systemMessage && msg.role === 'user') {
      text = `${systemMessage}\n\n${text}`;
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    };
  });

  // If first message isn't from user (e.g., system-only), prepend system as user
  if (contents[0]?.role === 'model' && systemMessage) {
    contents.unshift({
      role: 'user',
      parts: [{ text: systemMessage }],
    });
  }

  console.log(`[SWORDGATE_LLM] Calling ${model} with thinkingLevel=${thinkingLevel}`);

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        thinkingConfig: {
          thinkingLevel,
        },
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      },
    });

    const text = response.text;
    
    if (!text) {
      throw new Error('[SWORDGATE_LLM] Empty response from Gemini');
    }

    console.log(`[SWORDGATE_LLM] Response received (${text.length} chars)`);

    return {
      text,
      model,
      thinkingLevel,
    };
  } catch (error) {
    console.error('[SWORDGATE_LLM] API error:', error);
    throw error; // Re-throw - no fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Simple single-turn chat with system prompt
 */
export async function generate(
  systemPrompt: string,
  userMessage: string,
  options: ChatOptions = {}
): Promise<string> {
  const response = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], options);
  
  return response.text;
}

/**
 * Multi-turn conversation
 */
export async function converse(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  newMessage: string,
  options: ChatOptions = {}
): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: newMessage },
  ];

  const response = await chat(messages, options);
  return response.text;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const SwordGateLLM = {
  chat,
  generate,
  converse,
  isAvailable,
  resetClient,
};

export default SwordGateLLM;
