// ═══════════════════════════════════════════════════════════════════════════════
// WEB SEARCH CAPABILITY
// Fetches up-to-date information from the public web when `live_data=true`. 
// Extracts search intent from the user message, performs a targeted web query, 
// and returns summarized, LLM-friendly evidence with sources and timestamps.
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import type { EvidenceItem } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('[WEB_SEARCH] No OPENAI_API_KEY');
      return null;
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE
// ─────────────────────────────────────────────────────────────────────────────────

export async function execute(userMessage: string): Promise<EvidenceItem | null> {
  const openai = getClient();
  
  if (!openai) {
    console.log('[WEB_SEARCH] Client not available');
    return null;
  }

  try {
    console.log('[WEB_SEARCH] Searching with gpt-5-search-api...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-search-api',
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const outputText = completion.choices[0]?.message?.content;

    if (!outputText) {
      console.log('[WEB_SEARCH] No output returned');
      return null;
    }

    console.log(`[WEB_SEARCH] Got response: ${outputText.length} chars`);

    return {
      type: 'web_result',
      formatted: outputText,
      source: 'web_search',
      raw: completion,
      fetchedAt: Date.now(),
    };

  } catch (error) {
    console.error('[WEB_SEARCH] Error:', error);
    return null;
  }
}
