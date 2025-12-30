// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — LLM Selector
// Selects which capabilities to activate based on context
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import type { SelectorInput, SelectorResult, CapabilityType } from './types.js';
import { getCapabilityRegistry } from './registry.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for the LLM selector.
 */
export interface SelectorConfig {
  /** OpenAI model to use (default: 'gpt-4o-mini') */
  model?: string;
  /** Temperature for LLM (default: 0.1) */
  temperature?: number;
  /** Max tokens for response (default: 256) */
  maxTokens?: number;
  /** Timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
}

const DEFAULT_CONFIG: Required<SelectorConfig> = {
  model: 'gpt-4o-mini',
  temperature: 0.1,
  maxTokens: 256,
  timeoutMs: 10000,
};

// Global config that can be set at startup
let globalConfig: SelectorConfig = {};

/**
 * Set global selector configuration.
 * Call this at application startup to change defaults.
 * 
 * @example
 * setSelectorConfig({ model: 'gpt-4o' });
 */
export function setSelectorConfig(config: SelectorConfig): void {
  globalConfig = { ...globalConfig, ...config };
  console.log('[CAPABILITY_SELECTOR] Config updated:', globalConfig);
}

/**
 * Get current selector configuration.
 */
export function getSelectorConfig(): Required<SelectorConfig> {
  return { ...DEFAULT_CONFIG, ...globalConfig };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const VALID_CAPABILITIES: readonly CapabilityType[] = [
  'stock_fetcher',
  'weather_fetcher',
  'crypto_fetcher',
  'fx_fetcher',
  'time_fetcher',
  'web_searcher',
];

// ─────────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────────

const SELECTOR_SYSTEM_PROMPT = `You are a capability selector for an AI assistant.

Your job is to analyze the user's message and context, then select which data-fetching capabilities should be activated.

RULES:
1. Only select capabilities that are DIRECTLY relevant to answering the query
2. If no external data is needed, return an EMPTY array - this is often the correct answer
3. Select the MINIMUM capabilities needed
4. Consider the dataType hint from lens analysis
5. Most conversational messages (greetings, opinions, general questions) need NO capabilities

WHEN TO RETURN EMPTY ARRAY []:
- Greetings: "Hello", "Hi there", "Good morning"
- General knowledge: "What is photosynthesis?", "Explain quantum physics"
- Opinions/advice: "Should I learn Python?", "What's a good book?"
- Creative requests: "Write a poem", "Help me brainstorm"
- Personal questions: "How are you?", "What can you do?"

WHEN TO SELECT CAPABILITIES:
- Real-time data: "What's AAPL stock price?" → stock_fetcher
- Current conditions: "Weather in Tokyo?" → weather_fetcher
- Live prices: "Bitcoin price?" → crypto_fetcher
- Exchange rates: "USD to EUR?" → fx_fetcher
- Current time: "Time in London?" → time_fetcher
- Recent news/facts: "Latest news on AI?" → web_searcher

OUTPUT FORMAT:
Return a JSON object with:
- capabilities: array of capability names to activate (CAN BE EMPTY - this is valid!)
- reasoning: brief explanation of your selection
- confidence: number 0-1

Example outputs:
{"capabilities": ["stock_fetcher"], "reasoning": "User asking for stock price", "confidence": 0.95}
{"capabilities": [], "reasoning": "General greeting, no live data needed", "confidence": 0.99}
{"capabilities": [], "reasoning": "Knowledge question answerable without external data", "confidence": 0.95}
{"capabilities": ["weather_fetcher", "time_fetcher"], "reasoning": "User needs weather and local time", "confidence": 0.85}`;

// ─────────────────────────────────────────────────────────────────────────────────
// LLM SELECTOR
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Select capabilities using LLM.
 * 
 * @param input - Selector input (message, intent, lensResult)
 * @param config - Optional config overrides
 * @param openaiClient - Optional OpenAI client (for testing)
 */
export async function selectCapabilities(
  input: SelectorInput,
  config?: SelectorConfig,
  openaiClient?: OpenAI
): Promise<SelectorResult> {
  const cfg = { ...DEFAULT_CONFIG, ...globalConfig, ...config };
  const client = openaiClient ?? getOpenAIClient();

  // If no external data needed, skip LLM call
  if (!input.lensResult.needsExternalData) {
    return {
      capabilities: [],
      reasoning: 'No external data needed (lens indicated none)',
      confidence: 1.0,
    };
  }

  // Build capability menu
  const registry = getCapabilityRegistry();
  const menu = registry.getMenu();

  // Build user prompt
  const userPrompt = buildUserPrompt(input, menu);

  try {
    const response = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: 'system', content: SELECTOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    return parseResponse(content);
  } catch (error) {
    console.error('[CAPABILITY_SELECTOR] LLM call failed:', error);
    // Fallback to deterministic selection
    return fallbackSelection(input);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDING
// ─────────────────────────────────────────────────────────────────────────────────

function buildUserPrompt(
  input: SelectorInput,
  menu: Array<{ name: string; description: string }>
): string {
  const capabilityList = menu
    .map(cap => `- ${cap.name}: ${cap.description}`)
    .join('\n');

  return `USER MESSAGE: "${input.userMessage}"

CONTEXT:
- Intent type: ${input.intent.type}
- Intent domain: ${input.intent.domain ?? 'general'}
- Data type needed: ${input.lensResult.dataType}
- Lens confidence: ${input.lensResult.confidence}

AVAILABLE CAPABILITIES:
${capabilityList}

Which capabilities should be activated? Return JSON.`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE PARSING
// ─────────────────────────────────────────────────────────────────────────────────

function parseResponse(content: string): SelectorResult {
  try {
    const parsed = JSON.parse(content) as {
      capabilities?: unknown[];
      reasoning?: string;
      confidence?: number;
    };

    // Validate capabilities
    const capabilities: CapabilityType[] = [];
    if (Array.isArray(parsed.capabilities)) {
      for (const cap of parsed.capabilities) {
        if (typeof cap === 'string' && isValidCapability(cap)) {
          capabilities.push(cap as CapabilityType);
        }
      }
    }

    return {
      capabilities,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'No reasoning provided',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch {
    return {
      capabilities: [],
      reasoning: 'Failed to parse LLM response',
      confidence: 0,
    };
  }
}

function isValidCapability(cap: string): cap is CapabilityType {
  return VALID_CAPABILITIES.includes(cap as CapabilityType);
}

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK SELECTION (deterministic)
// ─────────────────────────────────────────────────────────────────────────────────

function fallbackSelection(input: SelectorInput): SelectorResult {
  const { userMessage, lensResult } = input;
  const msg = userMessage.toLowerCase();
  const capabilities: CapabilityType[] = [];

  if (lensResult.dataType === 'realtime') {
    // Stock indicators
    if (/\b(stock|price|trading|shares?|ticker|market|nasdaq|nyse)\b/.test(msg) ||
        /\b[A-Z]{1,5}\b/.test(userMessage)) {
      capabilities.push('stock_fetcher');
    }

    // Weather indicators
    if (/\b(weather|temperature|forecast|rain|sunny|cloudy|hot|cold|humid)\b/.test(msg)) {
      capabilities.push('weather_fetcher');
    }

    // Crypto indicators
    if (/\b(bitcoin|btc|ethereum|eth|crypto|cryptocurrency|coin)\b/.test(msg)) {
      capabilities.push('crypto_fetcher');
    }

    // FX indicators
    if (/\b(exchange rate|currency|usd|eur|gbp|jpy|forex|fx)\b/.test(msg) ||
        /\b[A-Z]{3}\/[A-Z]{3}\b/.test(userMessage)) {
      capabilities.push('fx_fetcher');
    }

    // Time indicators
    if (/\b(time|clock|timezone|what time)\b/.test(msg)) {
      capabilities.push('time_fetcher');
    }
  }

  if (lensResult.dataType === 'web_search') {
    capabilities.push('web_searcher');
  }

  return {
    capabilities,
    reasoning: 'Fallback: pattern-based selection',
    confidence: 0.6,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// OPENAI CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

let openaiClientInstance: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClientInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set');
    }
    openaiClientInstance = new OpenAI({ apiKey });
  }
  return openaiClientInstance;
}

/**
 * Set OpenAI client (for testing).
 */
export function setOpenAIClient(client: OpenAI): void {
  openaiClientInstance = client;
}
