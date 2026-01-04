// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI GROUNDED EXECUTOR
// Calls Gemini API with Google Search grounding
// ═══════════════════════════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import type { ConversationMessage } from '../../../types/index.js';
import type { ProviderConfig } from '../../capability_gate/types.js';
import type { ResponseGateOutput } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (!client && process.env.GEMINI_API_KEY) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────────

export async function callGeminiGrounded(
  systemPrompt: string,
  userPrompt: string,
  config: ProviderConfig,
  conversationHistory?: readonly ConversationMessage[]
): Promise<ResponseGateOutput> {
  const ai = getClient();

  if (!ai) {
    console.error('[GEMINI] No GEMINI_API_KEY');
    return {
      text: 'Gemini API key not configured.',
      model: 'unavailable',
      tokensUsed: 0,
    };
  }

  try {
    // Build messages array
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add system prompt as first user message (Gemini doesn't have system role in contents)
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `System: ${systemPrompt}` }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions.' }],
      });
    }

    // Add conversation history
    if (conversationHistory?.length) {
      for (const msg of conversationHistory) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    // Call Gemini with grounding (without systemInstruction which isn't in the type)
    const response = await ai.models.generateContent({
      model: config.model,
      contents,
      config: {
        tools: config.tools as any,
      },
    } as any);

    const text = response.text ?? '';
    const metadata = response.candidates?.[0]?.groundingMetadata;

    // Extract sources from grounding metadata
    const sources = metadata?.groundingChunks?.map((chunk: any) => ({
      uri: chunk.web?.uri ?? '',
      title: chunk.web?.title ?? '',
    })) ?? [];

    return {
      text,
      model: config.model,
      tokensUsed: 0, // Gemini doesn't return token count the same way
      sources,
    };

  } catch (error) {
    console.error('[GEMINI] Error:', error);
    return {
      text: 'I encountered an error while searching. Please try again.',
      model: 'error',
      tokensUsed: 0,
    };
  }
}
