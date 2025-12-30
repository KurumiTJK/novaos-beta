// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE — LLM-Powered Route Decision (LENS or SWORD)
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION — Change model here
// ═══════════════════════════════════════════════════════════════════════════════

const STANCE_CONFIG = {
  model: 'gpt-4o-mini',
  temperature: 0.1,
  maxTokens: 150,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface StanceResult {
  stance: 'lens' | 'sword';
  reason: string;
  confidence: number;
}

interface StanceClassification {
  stance: 'sword' | 'lens';
  confidence: number;
  reasoning: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const STANCE_SYSTEM_PROMPT = `You are a routing classifier. Decide if a user message should go to SWORD or LENS.

SWORD — The learning and goal achievement system
Route here when user wants to:
- Learn a new skill or topic
- Create learning goals or plans
- Track progress on a learning journey
- Get structured lessons or curriculum
- Build competence over time
- Practice or drill skills
- Continue an active learning session
- View, manage, or modify their goals
- Start, pause, resume, or complete practice sessions

LENS — The information and assistance system
Route here when user wants to:
- Get information or answers
- Ask questions (without committing to learning)
- Have general conversation
- Get help with one-off tasks
- Summarize, translate, or rewrite content
- General greetings or chitchat

KEY DISTINCTION:
- "What is Python?" → LENS (just wants info)
- "I want to learn Python" → SWORD (wants a learning journey)
- "Help me write an email" → LENS (one-off task)
- "Help me get better at writing emails" → SWORD (skill building)
- "Hi there" → LENS (greeting)
- "What's my lesson today?" → SWORD (active learning)
- "Show my goals" → SWORD (goal management)
- "I'm done" or "completed" → SWORD (practice tracking)

OUTPUT FORMAT (JSON only, no markdown):
{"stance":"sword"|"lens","confidence":0.0-1.0,"reasoning":"..."}

EXAMPLES:

User: "I want to learn TypeScript"
{"stance":"sword","confidence":0.95,"reasoning":"Clear learning intent - wants to build TypeScript competence"}

User: "What is TypeScript?"
{"stance":"lens","confidence":0.92,"reasoning":"Information request, not a learning journey"}

User: "Teach me how to cook"
{"stance":"sword","confidence":0.94,"reasoning":"Wants structured learning for cooking skill"}

User: "What's a good recipe for pasta?"
{"stance":"lens","confidence":0.90,"reasoning":"One-off request, not skill building"}

User: "Help me write a cover letter"
{"stance":"lens","confidence":0.85,"reasoning":"One-off task assistance, not learning to write cover letters"}

User: "I want to get better at writing cover letters"
{"stance":"sword","confidence":0.91,"reasoning":"Skill improvement intent - wants to build competence"}

User: "Hi there"
{"stance":"lens","confidence":0.98,"reasoning":"Social greeting, no learning intent"}

User: "Continue where we left off"
Active Session: true
{"stance":"sword","confidence":0.96,"reasoning":"User has active learning session, continuing"}

User: "What's the weather?"
{"stance":"lens","confidence":0.99,"reasoning":"Factual query, not learning related"}

User: "Help me master JavaScript in 30 days"
{"stance":"sword","confidence":0.97,"reasoning":"Clear goal-oriented learning with timeline"}

User: "What's my lesson today?"
{"stance":"sword","confidence":0.95,"reasoning":"Requesting current lesson from learning system"}

User: "Show my goals"
{"stance":"sword","confidence":0.94,"reasoning":"Goal management request"}

User: "I'm done"
Active Session: true
{"stance":"sword","confidence":0.93,"reasoning":"Marking practice as complete"}

User: "Start"
Active Session: true
{"stance":"sword","confidence":0.92,"reasoning":"Starting practice session"}

User: "1"
Active Session: true
{"stance":"sword","confidence":0.90,"reasoning":"Selecting option in active session"}

User: "skip today"
{"stance":"sword","confidence":0.88,"reasoning":"Skipping practice session"}

User: "delete goal"
{"stance":"sword","confidence":0.91,"reasoning":"Goal management - deletion"}

User: "practice"
{"stance":"sword","confidence":0.89,"reasoning":"Practice-related request"}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// OPENAI CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('[STANCE] OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export function resetOpenAIClient(): void {
  openaiClient = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE
// ═══════════════════════════════════════════════════════════════════════════════

export async function executeStanceGateAsync(
  state: PipelineState,
  context: PipelineContext,
  hasActiveSession: boolean = false
): Promise<GateResult<StanceResult>> {
  const start = Date.now();
  
  const client = getOpenAIClient();
  const userPrompt = buildPrompt(state, hasActiveSession);
  
  const response = await client.chat.completions.create({
    model: STANCE_CONFIG.model,
    messages: [
      { role: 'system', content: STANCE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: STANCE_CONFIG.temperature,
    max_tokens: STANCE_CONFIG.maxTokens,
  });
  
  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('[STANCE] Empty response from LLM');
  }
  
  const classification = parseResponse(content);
  
  console.log(`[STANCE] ${classification.stance.toUpperCase()} (${classification.confidence}) - ${classification.reasoning}`);
  
  return {
    gateId: 'stance',
    status: 'pass',
    output: {
      stance: classification.stance,
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

function buildPrompt(state: PipelineState, hasActiveSession: boolean): string {
  const intent = state.intent;
  
  let prompt = `User: "${state.userMessage}"`;
  
  if (intent) {
    prompt += `\nIntent: { type: "${intent.type}", primaryDomain: "${intent.primaryDomain}" }`;
  }
  
  if (hasActiveSession) {
    prompt += `\nActive Session: true`;
  }
  
  return prompt;
}

function parseResponse(content: string): StanceClassification {
  try {
    const parsed = JSON.parse(content);
    
    if (parsed.stance !== 'sword' && parsed.stance !== 'lens') {
      throw new Error(`Invalid stance: ${parsed.stance}`);
    }
    
    return {
      stance: parsed.stance,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      reasoning: parsed.reasoning ?? 'No reasoning provided',
    };
  } catch (error) {
    throw new Error(`[STANCE] Failed to parse LLM response: ${content}`);
  }
}
