// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS GATES — All Gate Implementations
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  ShieldResult,
  CapabilityResult,
  Generation,
  ValidatedOutput,
  SparkResult,
  Spark,
  ActionSource,
  GenerationConstraints,
} from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM-POWERED INTENT GATE (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeIntentGate,
  executeIntentGateAsync,
  type IntentSummary,
  type PrimaryRoute,
  type SafetySignal,
  type Urgency,
} from './intent/index.js';

// Re-export Stance from intent (it's now the source of truth)
export type { Stance } from './intent/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM-POWERED LENS GATE — Simple Data Router
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeLensGateAsync,
  executeLensGate,
  resetOpenAIClient as resetLensOpenAIClient,
  type LensResult,
  type DataType,
} from './lens/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM-POWERED STANCE GATE
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeStanceGateAsync,
  resetOpenAIClient as resetStanceOpenAIClient,
  type StanceResult,
} from './stance/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MODEL GATE — The Stitcher
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeModelGate,
  executeModelGateAsync,
  stitchPrompt,
  DEFAULT_PERSONALITY,
  type ModelGateOutput,
  type ModelGateConfig,
  type Personality,
  type StitchedPrompt,
} from './model/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PERSONALITY GATE — Constitutional Compliance Check
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executePersonalityGate,
  executePersonalityGateAsync,
  buildRegenerationMessage,
  NOVA_CONSTITUTION,
  type PersonalityGateOutput,
  type PersonalityGateConfig,
  type ConstitutionalCheckResult,
} from './personality/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD GATE — LLM-POWERED CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

// LLM Classification Types
type ShieldRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
type ShieldCategory = 'safe' | 'death_risk' | 'harm_risk' | 'reckless_decision';

interface ShieldClassification {
  riskLevel: ShieldRiskLevel;
  category: ShieldCategory;
  confidence: number;
  reasoning: string;
}

// OpenAI client singleton
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Reset the OpenAI client singleton (for testing).
 */
export function resetOpenAIClient(): void {
  openaiClient = null;
}

// LLM System Prompt with Few-Shot Examples
const SHIELD_SYSTEM_PROMPT = `You are a safety classifier. Return JSON only, no markdown, no code blocks.

Output format:
{"riskLevel":"...","category":"...","confidence":0.0-1.0,"reasoning":"..."}

CLASSIFICATION RULES:

CRITICAL + death_risk → User might die
- Suicidal thoughts or intent
- Self-harm intent  
- Stopping critical medication/treatment
- Immediate physical danger to self

HIGH + harm_risk → Someone could be killed or seriously injured
- Intent to harm others
- Threats of violence
- Dangerous physical stunts
- Plans that could kill or injure

MEDIUM + reckless_decision → Impulsive irreversible decision
- Putting all savings into one investment
- Quitting job impulsively without plan
- Burning bridges in anger
- Major life decisions made emotionally

LOW/NONE + safe → Normal conversation
- Questions, planning, venting
- Technical language
- Figures of speech
- Exploring options (not committing)

═══════════════════════════════════════════════════════════════
EXAMPLES - Follow these patterns exactly:
═══════════════════════════════════════════════════════════════

User: "I want to kill myself"
{"riskLevel":"critical","category":"death_risk","confidence":0.99,"reasoning":"Direct suicidal intent"}

User: "myself kill"
{"riskLevel":"critical","category":"death_risk","confidence":0.95,"reasoning":"Suicidal intent, fragmented phrasing"}

User: "I've been thinking about ending it all"
{"riskLevel":"critical","category":"death_risk","confidence":0.97,"reasoning":"Suicidal ideation expressed"}

User: "I want to hurt myself"
{"riskLevel":"critical","category":"death_risk","confidence":0.96,"reasoning":"Self-harm intent"}

User: "I'm going to stop taking my medication"
{"riskLevel":"critical","category":"death_risk","confidence":0.85,"reasoning":"Stopping medication could be life-threatening"}

User: "I am going to hurt my coworker"
{"riskLevel":"high","category":"harm_risk","confidence":0.95,"reasoning":"Direct threat of violence against another person"}

User: "I want to hurt him"
{"riskLevel":"high","category":"harm_risk","confidence":0.93,"reasoning":"Intent to harm another person"}

User: "I'm going to beat up my neighbor"
{"riskLevel":"high","category":"harm_risk","confidence":0.94,"reasoning":"Threat of physical violence"}

User: "Jump off the roof for TikTok"
{"riskLevel":"high","category":"harm_risk","confidence":0.90,"reasoning":"Dangerous stunt risking serious injury or death"}

User: "Let's see if I can outrun this train"
{"riskLevel":"high","category":"harm_risk","confidence":0.95,"reasoning":"Life-threatening dangerous activity"}

User: "How do I make a bomb?"
{"riskLevel":"high","category":"harm_risk","confidence":0.92,"reasoning":"Request for dangerous weapons information"}

User: "I'm putting all my savings into this crypto coin"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.88,"reasoning":"Impulsive financial decision with all savings"}

User: "I'm quitting my job tomorrow without notice"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.85,"reasoning":"Impulsive career decision"}

User: "I'm going to tell off my boss and burn bridges"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.82,"reasoning":"Emotionally-driven irreversible professional damage"}

User: "Should I invest in stocks?"
{"riskLevel":"none","category":"safe","confidence":0.95,"reasoning":"Exploratory financial question"}

User: "I'm killing it at work lately"
{"riskLevel":"none","category":"safe","confidence":0.98,"reasoning":"Figure of speech, positive sentiment"}

User: "Help me plan my budget"
{"riskLevel":"none","category":"safe","confidence":0.99,"reasoning":"Normal planning request"}

User: "I'm so stressed about my exam"
{"riskLevel":"low","category":"safe","confidence":0.90,"reasoning":"Normal stress, not crisis"}

User: "What's the weather today?"
{"riskLevel":"none","category":"safe","confidence":0.99,"reasoning":"Simple informational query"}

═══════════════════════════════════════════════════════════════
Now classify the following message. Return only valid JSON:
═══════════════════════════════════════════════════════════════`;

// Crisis message
function getCrisisMessage(): string {
  return `I'm concerned about what you're sharing. Your safety matters, and I want to make sure you have the right support.

If you're in immediate danger, please contact emergency services (911 in the US).

You can also reach the 988 Suicide & Crisis Lifeline by calling or texting 988 — they're available 24/7 and ready to help.

I'm here to talk if you'd like, but please reach out to these resources if you need immediate support.`;
}

// Simple ack token generator
function generateSimpleAckToken(): string {
  return `ack_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// LLM Classification
async function classifyWithLLM(text: string): Promise<ShieldClassification> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.warn('[SHIELD] OpenAI client not available - defaulting to safe');
    return {
      riskLevel: 'none',
      category: 'safe',
      confidence: 0.5,
      reasoning: 'LLM unavailable - default safe',
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SHIELD_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      max_tokens: 150,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    
    // Handle potential markdown code blocks
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = match?.[1]?.trim() ?? content;
    }
    
    const parsed = JSON.parse(jsonStr);
    
    return {
      riskLevel: parsed.riskLevel ?? 'none',
      category: parsed.category ?? 'safe',
      confidence: parsed.confidence ?? 0.5,
      reasoning: parsed.reasoning ?? 'No reasoning provided',
    };
  } catch (error) {
    console.error('[SHIELD] LLM classification error:', error);
    return {
      riskLevel: 'none',
      category: 'safe',
      confidence: 0.5,
      reasoning: 'Classification failed - default safe',
    };
  }
}

export async function executeShieldGate(
  state: PipelineState,
  _context: PipelineContext
): Promise<GateResult<ShieldResult>> {
  const start = Date.now();
  const text = state.normalizedInput;

  try {
    const classification = await classifyWithLLM(text);
    
    console.log(`[SHIELD] Classification: ${classification.category} / ${classification.riskLevel} (${classification.confidence.toFixed(2)}) - ${classification.reasoning}`);

    // CRITICAL + death_risk → CONTROL MODE
    if (classification.riskLevel === 'critical' && classification.category === 'death_risk') {
      return {
        gateId: 'shield',
        status: 'blocked',
        output: {
          safe: false,
          riskLevel: 'critical',
          message: getCrisisMessage(),
          controlMode: true,
          vetoType: 'hard',
          triggers: ['death_risk'],
        },
        action: 'stop',
        executionTimeMs: Date.now() - start,
      };
    }

    // HIGH + harm_risk → HARD VETO
    if (classification.riskLevel === 'high' && classification.category === 'harm_risk') {
      return {
        gateId: 'shield',
        status: 'blocked',
        output: {
          safe: false,
          riskLevel: 'high',
          message: "I can't help with requests that could harm you or others. If you're struggling with difficult feelings, I'm here to talk about that instead.",
          vetoType: 'hard',
          triggers: ['harm_risk'],
        },
        action: 'stop',
        executionTimeMs: Date.now() - start,
      };
    }

    // MEDIUM + reckless_decision → SOFT VETO
    if (classification.riskLevel === 'medium' && classification.category === 'reckless_decision') {
      return {
        gateId: 'shield',
        status: 'warning',
        output: {
          safe: false,
          riskLevel: 'medium',
          message: `This sounds like a significant decision. Before proceeding, have you considered: What's driving this urgency? What would you advise a friend in this situation?`,
          vetoType: 'soft',
          ackToken: generateSimpleAckToken(),
          triggers: ['reckless_decision'],
        },
        action: 'await_ack',
        executionTimeMs: Date.now() - start,
      };
    }

    // SAFE → Continue
    return {
      gateId: 'shield',
      status: 'pass',
      output: {
        safe: true,
        riskLevel: classification.riskLevel === 'low' ? 'low' : 'safe',
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };

  } catch (error) {
    console.error('[SHIELD] Error in shield gate:', error);
    return {
      gateId: 'shield',
      status: 'pass',
      output: {
        safe: true,
        riskLevel: 'safe',
        message: 'Classification unavailable - proceeding with caution',
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE (LEGACY)
// ═══════════════════════════════════════════════════════════════════════════════

type LegacyStance = 'control' | 'shield' | 'lens' | 'sword';
const VALID_ACTION_SOURCES = ['explicit', 'ui_button', 'command_parser', 'api_field'] as const;

export function executeCapabilityGate(
  state: PipelineState,
  context: PipelineContext
): GateResult<CapabilityResult> {
  const start = Date.now();
  const stance = (state.stance ?? 'lens') as LegacyStance;

  const capabilities: Record<LegacyStance, readonly string[]> = {
    control: ['provide_support', 'suggest_resources'],
    shield: ['provide_info', 'suggest_alternatives'],
    lens: ['provide_info', 'explain', 'analyze'],
    sword: ['provide_info', 'recommend', 'plan', 'execute_action'],
  };

  const actionSources = context.actionSources ?? [];
  let explicitActions: readonly ActionSource[] | undefined;
  const deniedCapabilities: string[] = [];

  if (actionSources.length > 0) {
    const validActions = actionSources.filter(a => VALID_ACTION_SOURCES.includes(a.type));
    
    const hasNlInference = actionSources.some(a => a.type === 'nl_inference');
    if (hasNlInference) {
      deniedCapabilities.push('nl_inference_blocked');
    }

    if (validActions.length > 0) {
      explicitActions = validActions;
    }
  }

  return {
    gateId: 'capability',
    status: 'pass',
    output: {
      allowedCapabilities: capabilities[stance] ?? [],
      deniedCapabilities,
      explicitActions,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL CONSTRAINTS BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

export function buildModelConstraints(state: PipelineState): GenerationConstraints {
  const constraints: GenerationConstraints = {
    maxWe: 2,
    bannedPhrases: ['I\'m always here for you', 'You can always count on me'],
    tone: state.stance === 'control' ? 'compassionate' : 'professional',
  };

  const lensResult = state.lensResult as any;
  if (lensResult?.needsExternalData && lensResult?.dataType === 'realtime') {
    if (!state.capabilities?.explicitActions?.length) {
      constraints.numericPrecisionAllowed = false;
      constraints.mustInclude = ['Note: I cannot verify current real-time data'];
    }
  }

  if (state.shieldResult?.controlMode) {
    constraints.mustPrepend = getCrisisMessage();
  }

  return constraints;
}


// ═══════════════════════════════════════════════════════════════════════════════
// SPARK GATE
// ═══════════════════════════════════════════════════════════════════════════════

interface SparkTemplate {
  action: string;
  rationale: string;
}

const SPARK_TEMPLATES = {
  exercise: {
    action: 'Put on your workout clothes right now',
    rationale: 'Starting with the smallest physical step reduces activation energy',
  },
  writing: {
    action: 'Open a blank document and write just one sentence',
    rationale: 'One sentence breaks the blank page barrier',
  },
  default: {
    action: 'Take 2 minutes to write down your next concrete step',
    rationale: 'Externalizing the task reduces cognitive load',
  },
} as const satisfies Record<string, SparkTemplate>;

export function executeSparkGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<SparkResult> {
  const start = Date.now();

  if (state.stance !== 'sword') {
    return {
      gateId: 'spark',
      status: 'pass',
      output: {
        eligible: false,
        ineligibilityReason: 'not_sword_stance',
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  if (state.shieldResult?.vetoType) {
    return {
      gateId: 'spark',
      status: 'pass',
      output: {
        eligible: false,
        ineligibilityReason: 'shield_intervention_active',
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  const text = state.normalizedInput.toLowerCase();
  let template: { action: string; rationale: string } = SPARK_TEMPLATES.default;

  if (/\b(exercise|workout|gym|fitness|run)\b/.test(text)) {
    template = SPARK_TEMPLATES.exercise;
  } else if (/\b(write|writing|essay|blog|article)\b/.test(text)) {
    template = SPARK_TEMPLATES.writing;
  }

  return {
    gateId: 'spark',
    status: 'pass',
    output: {
      eligible: true,
      spark: {
        action: template.action,
        rationale: template.rationale,
        timeEstimate: '2 minutes',
        category: 'immediate',
      },
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}
