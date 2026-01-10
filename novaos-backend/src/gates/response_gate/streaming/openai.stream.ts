// ═══════════════════════════════════════════════════════════════════════════════
// OPENAI STREAMING EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import type { ConversationMessage, ProviderConfig } from '../../../types/index.js';

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
// STREAMING EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────────

export async function streamOpenAI(
  systemPrompt: string,
  userPrompt: string,
  config: ProviderConfig,
  onToken: (text: string) => void,
  conversationHistory?: readonly ConversationMessage[]
): Promise<{ tokensUsed: number; model: string }> {
  const openai = getClient();

  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

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

  // Call OpenAI with streaming
  const stream = await openai.chat.completions.create({
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    max_completion_tokens: config.maxTokens ?? 2048,
    stream: true,
    stream_options: { include_usage: true },
  });

  let tokensUsed = 0;

  // Process stream
  for await (const chunk of stream) {
    // Extract token
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      onToken(content);
    }

    // Capture usage from final chunk
    if (chunk.usage) {
      tokensUsed = chunk.usage.total_tokens ?? 0;
    }
  }

  return {
    tokensUsed,
    model: config.model,
  };
}
