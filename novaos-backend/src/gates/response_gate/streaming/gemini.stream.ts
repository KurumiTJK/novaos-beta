// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI STREAMING EXECUTOR
// Calls Gemini API with Google Search grounding
// 
// NOTE: Gemini grounded search doesn't stream well - it returns the full response
// after the search completes. We call non-streaming and emit the text in chunks
// to simulate streaming behavior.
// ═══════════════════════════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import type { ConversationMessage, ProviderConfig } from '../../../types/index.js';

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
// HELPER: Emit text in chunks
// ─────────────────────────────────────────────────────────────────────────────────

async function emitInChunks(
  text: string,
  onToken: (text: string) => void,
  chunkSize: number = 20,
  delayMs: number = 10
): Promise<void> {
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    onToken(chunk);
    
    // Small delay between chunks (skip for last)
    if (i + chunkSize < text.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// STREAMING EXECUTOR (uses non-streaming API + chunked emit)
// ─────────────────────────────────────────────────────────────────────────────────

export async function streamGemini(
  systemPrompt: string,
  userPrompt: string,
  config: ProviderConfig,
  onToken: (text: string) => void,
  conversationHistory?: readonly ConversationMessage[]
): Promise<{ tokensUsed: number; model: string }> {
  const ai = getClient();

  if (!ai) {
    throw new Error('Gemini API key not configured');
  }

  // Build messages array (same as non-streaming executor)
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

  console.log(`[GEMINI STREAM] Calling non-streaming API (grounded search doesn't stream well)`);

  // Call Gemini WITHOUT streaming (grounded search returns all at once anyway)
  const response = await ai.models.generateContent({
    model: config.model,
    contents,
    config: {
      tools: config.tools as any,
    },
  } as any);

  const text = response.text ?? '';
  
  console.log(`[GEMINI STREAM] Got response: ${text.length} chars`);

  // Emit text in chunks to simulate streaming
  if (text) {
    await emitInChunks(text, onToken, 20, 10);
  }

  console.log(`[GEMINI STREAM] Chunked emit complete`);

  return {
    tokensUsed: 0, // Gemini doesn't return token count the same way
    model: config.model,
  };
}
