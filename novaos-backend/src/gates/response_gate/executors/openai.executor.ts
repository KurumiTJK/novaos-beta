// ═══════════════════════════════════════════════════════════════════════════════
// OPENAI EXECUTOR
// Calls OpenAI API for generation
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import type { ConversationMessage } from '../../../types/index.js';
import type { ProviderConfig } from '../../capability_gate/types.js';
import type { ResponseGateOutput } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!client && process.env.OPENAI_API_KEY) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────────

export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  config: ProviderConfig,
  conversationHistory?: readonly ConversationMessage[]
): Promise<ResponseGateOutput> {
  const openai = getClient();

  if (!openai) {
    console.error('[OPENAI] No OPENAI_API_KEY');
    return {
      text: 'OpenAI API key not configured.',
      model: 'unavailable',
      tokensUsed: 0,
    };
  }

  try {
    // Build messages array
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    if (conversationHistory?.length) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userPrompt });

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_completion_tokens: config.maxTokens ?? 2048,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    const tokensUsed = response.usage?.total_tokens ?? 0;

    return {
      text,
      model: config.model,
      tokensUsed,
    };

  } catch (error) {
    console.error('[OPENAI] Error:', error);
    return {
      text: 'I encountered an error. Please try again.',
      model: 'error',
      tokensUsed: 0,
    };
  }
}
