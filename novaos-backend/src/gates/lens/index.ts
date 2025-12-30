// ═══════════════════════════════════════════════════════════════════════════════
// LENS GATE — LLM-Powered Data Router
// ═══════════════════════════════════════════════════════════════════════════════
//
// Single job: Decide if external data is needed to answer accurately.
// Capability Gate handles actual data fetching.
//
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const LENS_CONFIG = {
  model: 'gpt-4o-mini',
  temperature: 0.1,
  maxTokens: 150,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type DataType = 'realtime' | 'web_search' | 'none';

export interface LensResult {
  needsExternalData: boolean;
  dataType: DataType;
  reason: string;
  confidence: number;
}

interface LensClassification {
  needsExternalData: boolean;
  dataType: DataType;
  confidence: number;
  reasoning: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const LENS_SYSTEM_PROMPT = `You are a data router. Decide if external data is needed to answer the user's question accurately.

Return JSON only, no markdown:
{"needsExternalData":true|false,"dataType":"realtime"|"web_search"|"none","confidence":0.0-1.0,"reasoning":"..."}

DATA TYPES:

realtime — Live API data required
- Stock prices, crypto prices, exchange rates
- Current weather conditions
- Current time in any timezone
- Any query asking "what is X trading at" or "current price of X"

web_search — Recent information needed
- Recent news, current events
- "Who is the CEO of X" (could have changed)
- Product releases, company updates
- Sports scores, election results
- Anything that changes but isn't real-time numeric data

none — Model knowledge sufficient
- General knowledge, facts, history
- Coding help, technical explanations
- Creative writing, brainstorming
- Math, logic, reasoning
- Personal advice, opinions
- Greetings, conversation

EXAMPLES:

User: "Hi there"
{"needsExternalData":false,"dataType":"none","confidence":0.99,"reasoning":"Social greeting"}

User: "What's AAPL trading at?"
{"needsExternalData":true,"dataType":"realtime","confidence":0.98,"reasoning":"Stock price requires live data"}

User: "Help me write a Python function"
{"needsExternalData":false,"dataType":"none","confidence":0.97,"reasoning":"Coding from knowledge"}

User: "Who won the Super Bowl this year?"
{"needsExternalData":true,"dataType":"web_search","confidence":0.94,"reasoning":"Recent event"}

User: "What's the weather in Tokyo?"
{"needsExternalData":true,"dataType":"realtime","confidence":0.97,"reasoning":"Weather requires live data"}

User: "What is the capital of France?"
{"needsExternalData":false,"dataType":"none","confidence":0.99,"reasoning":"Stable fact from knowledge"}

User: "Bitcoin price"
{"needsExternalData":true,"dataType":"realtime","confidence":0.98,"reasoning":"Crypto price requires live data"}

User: "Who is the president of the United States?"
{"needsExternalData":true,"dataType":"web_search","confidence":0.85,"reasoning":"Political position could change"}

User: "Explain quantum computing"
{"needsExternalData":false,"dataType":"none","confidence":0.96,"reasoning":"Concept explanation from knowledge"}

User: "What time is it in London?"
{"needsExternalData":true,"dataType":"realtime","confidence":0.99,"reasoning":"Current time requires live data"}

User: "Tell me a joke"
{"needsExternalData":false,"dataType":"none","confidence":0.99,"reasoning":"Creative content from knowledge"}

User: "USD to EUR exchange rate"
{"needsExternalData":true,"dataType":"realtime","confidence":0.97,"reasoning":"FX rate requires live data"}

User: "What happened in the news today?"
{"needsExternalData":true,"dataType":"web_search","confidence":0.95,"reasoning":"Current news"}

User: "How do I make pasta?"
{"needsExternalData":false,"dataType":"none","confidence":0.98,"reasoning":"Recipe from knowledge"}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// OPENAI CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('[LENS] OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export function resetOpenAIClient(): void {
  openaiClient = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LENS GATE
// ═══════════════════════════════════════════════════════════════════════════════

export async function executeLensGateAsync(
  state: PipelineState,
  context: PipelineContext
): Promise<GateResult<LensResult>> {
  const start = Date.now();
  
  const client = getOpenAIClient();
  const userPrompt = buildPrompt(state);
  
  const response = await client.chat.completions.create({
    model: LENS_CONFIG.model,
    messages: [
      { role: 'system', content: LENS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: LENS_CONFIG.temperature,
    max_tokens: LENS_CONFIG.maxTokens,
  });
  
  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('[LENS] Empty response from LLM');
  }
  
  const classification = parseResponse(content);
  
  console.log(`[LENS] ${classification.dataType.toUpperCase()} (${classification.confidence}) - ${classification.reasoning}`);
  
  return {
    gateId: 'lens',
    status: 'pass',
    output: {
      needsExternalData: classification.needsExternalData,
      dataType: classification.dataType,
      reason: classification.reasoning,
      confidence: classification.confidence,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildPrompt(state: PipelineState): string {
  const intent = state.intent;
  
  let prompt = `User: "${state.userMessage}"`;
  
  if (intent) {
    prompt += `\nIntent: { type: "${intent.type}", domain: "${intent.primaryDomain ?? intent.domain ?? 'general'}" }`;
  }
  
  return prompt;
}

function parseResponse(content: string): LensClassification {
  try {
    const parsed = JSON.parse(content);
    
    const dataType = validateDataType(parsed.dataType);
    
    return {
      needsExternalData: Boolean(parsed.needsExternalData),
      dataType,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      reasoning: parsed.reasoning ?? 'No reasoning provided',
    };
  } catch (error) {
    throw new Error(`[LENS] Failed to parse LLM response: ${content}`);
  }
}

function validateDataType(value: unknown): DataType {
  if (value === 'realtime' || value === 'web_search' || value === 'none') {
    return value;
  }
  return 'none';
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY - Sync version (no LLM, returns none)
// ═══════════════════════════════════════════════════════════════════════════════

export function executeLensGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<LensResult> {
  const start = Date.now();
  
  return {
    gateId: 'lens',
    status: 'pass',
    output: {
      needsExternalData: false,
      dataType: 'none',
      reason: 'Sync mode - defaulting to no external data',
      confidence: 0.5,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}
