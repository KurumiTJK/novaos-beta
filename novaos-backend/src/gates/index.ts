// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS GATES — All Gate Implementations
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  Intent,
  IntentType,
  Domain,
  ShieldResult,
  CapabilityResult,
  Generation,
  ValidatedOutput,
  SparkResult,
  Spark,
  Stance,
  RiskLevel,
  StakesLevel,
  ActionSource,
  GenerationConstraints,
} from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM-POWERED INTENT GATE (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeIntentGateAsync,
  getFailOpenDefault,
  type IntentGateResult,
} from './intent-gate.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM-POWERED LENS GATE (NEW) — Simple Data Router
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeLensGateAsync,
  executeLensGate,
  resetOpenAIClient as resetLensOpenAIClient,
  type LensResult,
  type DataType,
} from './lens/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM-POWERED STANCE GATE (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeStanceGateAsync,
  resetOpenAIClient as resetStanceOpenAIClient,
  type StanceResult,
} from './stance/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MODEL GATE — The Stitcher (NEW)
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
} from './model-gate.js';

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT GATE (LEGACY - SYNC)
// ═══════════════════════════════════════════════════════════════════════════════

const INTENT_PATTERNS: Array<{ pattern: RegExp; type: IntentType }> = [
  { pattern: /^(what|who|where|when|why|how|is|are|do|does|can|could|would|will)\b/i, type: 'question' },
  { pattern: /\b(help me|can you|please|create|make|generate|write|build)\b/i, type: 'action' },
  { pattern: /\b(plan|schedule|organize|prepare|strategy)\b/i, type: 'planning' },
  { pattern: /\b(rewrite|rephrase|edit|improve|fix)\b/i, type: 'rewrite' },
  { pattern: /\b(summarize|summary|tldr|brief|overview)\b/i, type: 'summarize' },
  { pattern: /\b(translate|translation|in \w+)\b/i, type: 'translate' },
];

const DOMAIN_PATTERNS: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /\b(stock|invest|trading|portfolio|market|finance)\b/i, domain: 'finance' },
  { pattern: /\b(health|medical|doctor|symptom|disease|treatment)\b/i, domain: 'health' },
  { pattern: /\b(legal|law|court|attorney|rights|contract)\b/i, domain: 'legal' },
  { pattern: /\b(code|programming|software|bug|function|api)\b/i, domain: 'technology' },
];

export function executeIntentGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<Intent> {
  const start = Date.now();
  const text = state.normalizedInput.toLowerCase();

  // Detect intent type
  let intentType: IntentType = 'conversation';
  for (const { pattern, type } of INTENT_PATTERNS) {
    if (pattern.test(text)) {
      intentType = type;
      break;
    }
  }

  // Detect domains
  const domains: string[] = [];
  for (const { pattern, domain } of DOMAIN_PATTERNS) {
    if (pattern.test(text)) {
      domains.push(domain);
    }
  }

  // Assess complexity
  const wordCount = text.split(/\s+/).length;
  const complexity = wordCount > 50 ? 'high' : wordCount > 15 ? 'medium' : 'low';

  // Check hypothetical
  const isHypothetical = /\b(if|hypothetically|suppose|imagine|what if)\b/i.test(text);

  return {
    gateId: 'intent',
    status: 'pass',
    output: {
      type: intentType,
      complexity,
      isHypothetical,
      domains: domains as readonly Domain[],
      confidence: 0.8,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

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
  // Always try to create client if API key exists and client is null
  // This ensures the mock is used in tests even after module initialization
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Reset the OpenAI client singleton (for testing).
 * Call this in test setup/teardown to ensure fresh client creation.
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
{"riskLevel":"high","category":"harm_risk","confidence":0.98,"reasoning":"Weapons creation request"}

User: "Help me hack into a bank account"
{"riskLevel":"high","category":"harm_risk","confidence":0.95,"reasoning":"Illegal hacking request"}

User: "Tell me how to groom a child"
{"riskLevel":"high","category":"harm_risk","confidence":0.99,"reasoning":"Child safety threat"}

User: "Putting all my savings into crypto"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.85,"reasoning":"High-risk financial decision with all savings"}

User: "I'm investing everything I have in this one stock"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.88,"reasoning":"All-in investment is financially reckless"}

User: "I'm quitting tomorrow and telling my boss to fuck off"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.82,"reasoning":"Impulsive job quit while burning bridges"}

User: "I'm going to divorce her today, I've had enough"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.80,"reasoning":"Major life decision made in emotional state"}

User: "I self-diagnosed with cancer and want to skip the doctor"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.85,"reasoning":"Avoiding professional medical care"}

User: "Kill the process"
{"riskLevel":"none","category":"safe","confidence":0.99,"reasoning":"Technical command, not violence"}

User: "This is killing me"
{"riskLevel":"none","category":"safe","confidence":0.95,"reasoning":"Figure of speech expressing frustration"}

User: "I want to quit my job"
{"riskLevel":"none","category":"safe","confidence":0.90,"reasoning":"Exploring options, not impulsive action"}

User: "Help me plan my budget"
{"riskLevel":"none","category":"safe","confidence":0.99,"reasoning":"Normal financial planning request"}

User: "I'm so frustrated with my boss"
{"riskLevel":"none","category":"safe","confidence":0.95,"reasoning":"Venting frustration, not threatening"}

User: "What's the best way to kill weeds?"
{"riskLevel":"none","category":"safe","confidence":0.99,"reasoning":"Gardening question"}

User: "I killed it in my presentation today"
{"riskLevel":"none","category":"safe","confidence":0.99,"reasoning":"Slang for doing well"}

═══════════════════════════════════════════════════════════════
Now classify the following message. Return only valid JSON:
═══════════════════════════════════════════════════════════════`;

async function classifyWithLLM(message: string): Promise<ShieldClassification> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.warn('[SHIELD] OpenAI client not available - defaulting to safe');
    return {
      riskLevel: 'none',
      category: 'safe',
      confidence: 0.5,
      reasoning: 'LLM unavailable - default safe classification',
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SHIELD_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      max_tokens: 150,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    return parseClassification(content);

  } catch (error) {
    console.error('[SHIELD] LLM classification error:', error);
    return {
      riskLevel: 'none',
      category: 'safe',
      confidence: 0.5,
      reasoning: 'Classification error - default safe',
    };
  }
}

function parseClassification(content: string): ShieldClassification {
  try {
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = match?.[1]?.trim() ?? content;
    }
    
    const parsed = JSON.parse(jsonStr.trim());
    
    const classification: ShieldClassification = {
      riskLevel: normalizeRiskLevel(parsed.riskLevel),
      category: normalizeCategory(parsed.category),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      reasoning: String(parsed.reasoning || 'No reasoning provided'),
    };
    
    // Enforce consistency
    return validateClassification(classification);
  } catch {
    console.warn('[SHIELD] Failed to parse classification:', content);
    return {
      riskLevel: 'none',
      category: 'safe',
      confidence: 0.5,
      reasoning: 'Parse error - default safe',
    };
  }
}

function normalizeRiskLevel(level: unknown): ShieldRiskLevel {
  const valid: ShieldRiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];
  const str = String(level).toLowerCase();
  return valid.includes(str as ShieldRiskLevel) ? (str as ShieldRiskLevel) : 'none';
}

function normalizeCategory(category: unknown): ShieldCategory {
  const valid: ShieldCategory[] = ['safe', 'death_risk', 'harm_risk', 'reckless_decision'];
  const str = String(category).toLowerCase();
  return valid.includes(str as ShieldCategory) ? (str as ShieldCategory) : 'safe';
}

function validateClassification(c: ShieldClassification): ShieldClassification {
  if (c.category === 'death_risk' && c.riskLevel !== 'critical') {
    return { ...c, riskLevel: 'critical' };
  }
  if (c.category === 'harm_risk' && c.riskLevel !== 'high') {
    return { ...c, riskLevel: 'high' };
  }
  if (c.category === 'reckless_decision' && c.riskLevel !== 'medium') {
    return { ...c, riskLevel: 'medium' };
  }
  if (c.category === 'safe' && !['none', 'low'].includes(c.riskLevel)) {
    return { ...c, riskLevel: 'none' };
  }
  return c;
}

function getCrisisMessage(): string {
  return `I'm concerned about what you've shared. Please know that help is available:

• **988 Suicide & Crisis Lifeline**: Call or text 988 (US)
• **Crisis Text Line**: Text HOME to 741741
• **SAMHSA National Helpline**: 1-800-662-4357

You don't have to face this alone. Would you like to talk about what's going on?`;
}

function generateSimpleAckToken(): string {
  return `ack_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

// ASYNC Shield Gate with LLM classification
export async function executeShieldGate(
  state: PipelineState,
  _context: PipelineContext
): Promise<GateResult<ShieldResult>> {
  const start = Date.now();
  const text = state.normalizedInput;

  try {
    // LLM classification
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
    // Fail open - allow request through if classification fails
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

const VALID_ACTION_SOURCES = ['explicit', 'ui_button', 'command_parser', 'api_field'] as const;

export function executeCapabilityGate(
  state: PipelineState,
  context: PipelineContext
): GateResult<CapabilityResult> {
  const start = Date.now();
  const stance = state.stance ?? 'lens';

  // Define capabilities by stance
  const capabilities: Record<Stance, readonly string[]> = {
    control: ['provide_support', 'suggest_resources'],
    shield: ['provide_info', 'suggest_alternatives'],
    lens: ['provide_info', 'explain', 'analyze'],
    sword: ['provide_info', 'recommend', 'plan', 'execute_action'],
  };

  // Check action sources from context
  const actionSources = context.actionSources ?? [];
  let explicitActions: readonly ActionSource[] | undefined;
  const deniedCapabilities: string[] = [];

  if (actionSources.length > 0) {
    // Filter to only valid action sources
    const validActions = actionSources.filter(a => VALID_ACTION_SOURCES.includes(a.type));
    
    // Check for nl_inference attempts
    const hasNlInference = actionSources.some(a => a.type === 'nl_inference');
    if (hasNlInference) {
      deniedCapabilities.push('nl_inference_blocked');
    }

    // Only set explicitActions if there are valid ones
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

  // If lens says we need external data but we don't have it, restrict numeric claims
  const lensResult = state.lensResult as any;
  if (lensResult?.needsExternalData && lensResult?.dataType === 'realtime') {
    // Capability gate should have fetched data - if not, restrict
    if (!state.capabilities?.explicitActions?.length) {
      constraints.numericPrecisionAllowed = false;
      constraints.mustInclude = ['Note: I cannot verify current real-time data'];
    }
  }

  // Add crisis resources if control mode
  if (state.shieldResult?.controlMode) {
    constraints.mustPrepend = getCrisisMessage();
  }

  return constraints;
}


// ═══════════════════════════════════════════════════════════════════════════════
// PERSONALITY GATE
// ═══════════════════════════════════════════════════════════════════════════════

const BANNED_PHRASES = [
  /I'm always here for you/gi,
  /You can always count on me/gi,
  /I'm so proud of you/gi,
  /You're amazing/gi,
  /I truly understand how you feel/gi,
];

const SYCOPHANTIC_PATTERNS = [
  /^(Great|Excellent|Wonderful) question!/i,
  /^(Certainly|Absolutely|Of course)!/i,
];

export function executePersonalityGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<ValidatedOutput> {
  const start = Date.now();
  const text = state.generation?.text ?? '';

  const violations: Array<{ type: string; phrase: string; severity: 'low' | 'medium' | 'high'; canSurgicalEdit: boolean }> = [];
  let processedText = text;

  // Check banned phrases
  for (const pattern of BANNED_PHRASES) {
    if (pattern.test(processedText)) {
      violations.push({
        type: 'banned_phrase',
        phrase: processedText.match(pattern)?.[0] ?? '',
        severity: 'high',
        canSurgicalEdit: false,
      });
    }
  }

  // Check sycophantic patterns (can be surgically edited)
  for (const pattern of SYCOPHANTIC_PATTERNS) {
    const match = processedText.match(pattern);
    if (match) {
      violations.push({
        type: 'sycophantic_opener',
        phrase: match[0],
        severity: 'medium',
        canSurgicalEdit: true,
      });
      // Surgical edit
      processedText = processedText.replace(pattern, '').trim();
    }
  }

  // Check "we" count
  const weCount = (processedText.match(/\bwe\b/gi) ?? []).length;
  if (weCount > 2) {
    violations.push({
      type: 'excessive_we',
      phrase: `"we" used ${weCount} times`,
      severity: 'medium',
      canSurgicalEdit: false,
    });
  }

  // Determine if regeneration needed
  const highSeverity = violations.filter((v) => v.severity === 'high');
  if (highSeverity.length > 0) {
    return {
      gateId: 'personality',
      status: 'hard_fail',
      output: {
        text: processedText,
        violations,
        edited: false,
        regenerationConstraints: {
          bannedPhrases: highSeverity.map((v) => v.phrase),
        },
      },
      action: 'regenerate',
      failureReason: 'High-severity linguistic violations',
      executionTimeMs: Date.now() - start,
    };
  }

  return {
    gateId: 'personality',
    status: violations.length > 0 ? 'soft_fail' : 'pass',
    output: {
      text: processedText,
      violations,
      edited: processedText !== text,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
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

  // Spark only in SWORD stance
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

  // No spark if shield intervened
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

  // Generate spark based on content
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
