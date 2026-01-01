// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — LLM Selector
// Selects which capabilities to activate based on context
// ═══════════════════════════════════════════════════════════════════════════════

import { getOpenAIClient, pipeline_model } from '../../pipeline/llm_engine.js';
import type { SelectorInput, SelectorResult } from './types.js';
import { getCapabilityRegistry } from './registry.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────────

const DEBUG = process.env.DEBUG_CAPABILITY_SELECTOR === 'true'; // Default OFF

// ─────────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────────

const SELECTOR_SYSTEM_PROMPT = `You are a capability selector. Given user context, select which data-fetching capabilities to activate.

RULES:
1. Select ONLY capabilities directly relevant to the query
2. Select MINIMUM capabilities needed
3. Return empty array if no capabilities match
4. Consider the user's intent route and urgency
5. Use web_search for questions about people, characters, recent events, news, or anything the model might not know

OUTPUT FORMAT (JSON only, no markdown):
{"capabilities":["capability_name"]}

EXAMPLES:

User: "What's AAPL stock price?"
{"capabilities":["stock_fetcher"]}

User: "Weather in Tokyo and time there?"
{"capabilities":["weather_fetcher","time_fetcher"]}

User: "Hello there"
{"capabilities":[]}

User: "Bitcoin and Ethereum prices"
{"capabilities":["crypto_fetcher"]}`;

// ─────────────────────────────────────────────────────────────────────────────────
// SELECT CAPABILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Select capabilities using LLM.
 * Returns error if LLM fails (no regex fallback).
 */
export async function selectCapabilities(
  input: SelectorInput
): Promise<{ ok: true; result: SelectorResult } | { ok: false; error: string }> {
  const client = getOpenAIClient();

  if (!client) {
    return { ok: false, error: 'OpenAI client not available' };
  }

  // Build capability menu from registry
  const registry = getCapabilityRegistry();
  const menu = registry.getMenu();

  if (menu.length === 0) {
    return { ok: true, result: { capabilities: [] } };
  }

  // Build user prompt
  const menuText = menu
    .map(c => `- ${c.name}: ${c.description}`)
    .join('\n');

  const userPrompt = `User: "${input.userMessage}"
Route: ${input.primary_route}
Stance: ${input.stance}
Urgency: ${input.urgency}

AVAILABLE CAPABILITIES:
${menuText}

Which capabilities should be activated? Return JSON.`;

  if (DEBUG) {
    console.log('[CAPABILITY] Selector prompt:\n', userPrompt);
    console.log('[CAPABILITY] Valid names:', registry.getNames());
  }

  try {
    const response = await client.chat.completions.create({
      model: pipeline_model,
      messages: [
        { role: 'system', content: SELECTOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '';

    if (DEBUG) {
      console.log('[CAPABILITY] LLM returned:', content);
    }

    if (!content) {
      return { ok: false, error: 'Empty response from LLM' };
    }

    // Parse response
    const result = parseResponse(content, registry.getNames());
    return { ok: true, result };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: errorMsg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// PARSE RESPONSE
// ─────────────────────────────────────────────────────────────────────────────────

function parseResponse(content: string, validNames: string[]): SelectorResult {
  try {
    // Handle markdown code blocks
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = match?.[1]?.trim() ?? content;
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Validate capabilities
    const capabilities: string[] = [];
    if (Array.isArray(parsed.capabilities)) {
      for (const cap of parsed.capabilities) {
        if (typeof cap === 'string' && validNames.includes(cap)) {
          capabilities.push(cap);
        }
      }
    }

    return { capabilities };

  } catch {
    // JSON parse failed - return empty
    return { capabilities: [] };
  }
}
