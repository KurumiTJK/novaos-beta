// ═══════════════════════════════════════════════════════════════════════════════
// INTENT GATE — LLM-Powered Intent Classification
// Uses GPT-4o-mini for semantic intent classification with validation & fail-open
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  Intent,
} from '../types/index.js';

import {
  type IntentClassification,
  type IntentTelemetry,
  type IntentType,
  type Domain,
  type Complexity,
  type Urgency,
  type SafetySignal,
  type ReasoningCode,
  DOMAIN_PRIORITY,
  VALID_INTENT_TYPES,
  VALID_DOMAINS,
  VALID_COMPLEXITIES,
  VALID_URGENCIES,
  VALID_SAFETY_SIGNALS,
  VALID_REASONING_CODES,
  HIGH_STAKES_DOMAINS,
} from '../types/intent-types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// OPENAI CLIENT SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LLM SYSTEM PROMPT WITH FEW-SHOT EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────────

const INTENT_SYSTEM_PROMPT = `You are an intent classifier. Return JSON only, no markdown, no code blocks.

Output format:
{"type":"...","primaryDomain":"...","domains":["..."],"complexity":"...","urgency":"...","safetySignal":"...","confidence":0.0-1.0,"reasoningCode":"...","secondaryType":"..."}

═══════════════════════════════════════════════════════════════
CLASSIFICATION RULES
═══════════════════════════════════════════════════════════════

TYPE (what the user is trying to do):
- question: Seeking information ("What is X?", "How does Y work?")
- decision: Needs help choosing ("Should I X?", "Which is better?")
- action: Intent to do something ("I'm going to X", "Help me do X")
- planning: Wants structured help ("Help me create a plan", "I need a strategy")
- venting: Expressing emotions ("I'm so frustrated", "I can't believe...")
- greeting: Social/conversational ("Hey", "How are you?", "Thanks")
- followup: Continues previous topic ("What about option 2?", "And then?")
- clarification: Asks for re-explanation ("Explain that again", "I don't understand")

DOMAINS (topics involved, can be multiple):
- general: No specific domain
- health: Physical health, medical
- mental_health: Emotional wellbeing, stress, anxiety, depression
- finance: Money, investments, budgets
- legal: Laws, contracts, rights
- career: Jobs, work, professional
- education: Learning, school, skills
- relationships: Personal connections
- technical: Programming, technology
- creative: Art, writing, design

COMPLEXITY:
- simple: Quick answer, single concept
- medium: Moderate depth, some nuance
- complex: Multi-faceted, requires detailed response

URGENCY:
- low: No time pressure
- medium: Soon but not immediate
- high: Immediate action needed

SAFETY SIGNAL (early signal for Shield gate):
- none: Normal conversation
- watch: Elevated concern (stress, emotional distress)
- high: Crisis indicators (self-harm, suicidal ideation)

REASONING CODE:
- INFO_SEEKING: Looking for information
- DECISION_SUPPORT: Needs help deciding
- ACTION_INTENT: Plans to take action
- PLANNING_REQUEST: Wants structured planning
- EMOTIONAL_EXPRESSION: Expressing feelings
- SOCIAL_GREETING: Social interaction
- CONTEXT_CONTINUATION: Continuing previous thread
- REPAIR_REQUEST: Asking for clarification
- MULTI_INTENT: Multiple intents detected

MULTI-INTENT:
If message contains multiple intents, set secondaryType and reasoningCode='MULTI_INTENT'.
Primary type is what needs response first.

FOLLOWUP vs CLARIFICATION:
- followup: Advances the thread ("What about option 2?", "And then?")
- clarification: Repair/re-explain ("Explain that again", "I don't understand")

═══════════════════════════════════════════════════════════════
EXAMPLES - Follow these patterns exactly:
═══════════════════════════════════════════════════════════════

User: "What is a 401k?"
{"type":"question","primaryDomain":"finance","domains":["finance"],"complexity":"simple","urgency":"low","safetySignal":"none","confidence":0.95,"reasoningCode":"INFO_SEEKING"}

User: "Should I quit my job?"
{"type":"decision","primaryDomain":"career","domains":["career"],"complexity":"medium","urgency":"medium","safetySignal":"none","confidence":0.92,"reasoningCode":"DECISION_SUPPORT"}

User: "I'm quitting tomorrow"
{"type":"action","primaryDomain":"career","domains":["career"],"complexity":"medium","urgency":"high","safetySignal":"watch","confidence":0.90,"reasoningCode":"ACTION_INTENT"}

User: "Help me plan my wedding budget"
{"type":"planning","primaryDomain":"finance","domains":["finance","relationships"],"complexity":"complex","urgency":"low","safetySignal":"none","confidence":0.94,"reasoningCode":"PLANNING_REQUEST"}

User: "I'm so stressed"
{"type":"venting","primaryDomain":"mental_health","domains":["mental_health"],"complexity":"simple","urgency":"medium","safetySignal":"watch","confidence":0.88,"reasoningCode":"EMOTIONAL_EXPRESSION"}

User: "Hey what's up"
{"type":"greeting","primaryDomain":"general","domains":["general"],"complexity":"simple","urgency":"low","safetySignal":"none","confidence":0.99,"reasoningCode":"SOCIAL_GREETING"}

User: "What about option 2?"
{"type":"followup","primaryDomain":"general","domains":["general"],"complexity":"simple","urgency":"low","safetySignal":"none","confidence":0.85,"reasoningCode":"CONTEXT_CONTINUATION"}

User: "Explain that again"
{"type":"clarification","primaryDomain":"general","domains":["general"],"complexity":"simple","urgency":"low","safetySignal":"none","confidence":0.90,"reasoningCode":"REPAIR_REQUEST"}

User: "Explain option Greeks again"
{"type":"clarification","primaryDomain":"finance","domains":["finance"],"complexity":"medium","urgency":"low","safetySignal":"none","confidence":0.88,"reasoningCode":"REPAIR_REQUEST"}

User: "Should I break up with them?"
{"type":"decision","primaryDomain":"relationships","domains":["relationships"],"complexity":"medium","urgency":"medium","safetySignal":"none","confidence":0.91,"reasoningCode":"DECISION_SUPPORT"}

User: "myself hurt"
{"type":"action","primaryDomain":"mental_health","domains":["mental_health"],"complexity":"medium","urgency":"high","safetySignal":"high","confidence":0.95,"reasoningCode":"ACTION_INTENT"}

User: "I want to kill myself"
{"type":"action","primaryDomain":"mental_health","domains":["mental_health"],"complexity":"medium","urgency":"high","safetySignal":"high","confidence":0.99,"reasoningCode":"ACTION_INTENT"}

User: "I'm stressed. Help me plan my budget"
{"type":"planning","primaryDomain":"finance","domains":["finance","mental_health"],"complexity":"medium","urgency":"medium","safetySignal":"watch","confidence":0.87,"reasoningCode":"MULTI_INTENT","secondaryType":"venting"}

User: "Text my boss that I'm sick"
{"type":"action","primaryDomain":"career","domains":["career"],"complexity":"simple","urgency":"medium","safetySignal":"none","confidence":0.92,"reasoningCode":"ACTION_INTENT"}

User: "I'm scared and need legal options today"
{"type":"decision","primaryDomain":"legal","domains":["legal","mental_health"],"complexity":"complex","urgency":"high","safetySignal":"watch","confidence":0.89,"reasoningCode":"MULTI_INTENT","secondaryType":"venting"}

═══════════════════════════════════════════════════════════════
Now classify the following message. Return only valid JSON:
═══════════════════════════════════════════════════════════════`;

// ─────────────────────────────────────────────────────────────────────────────────
// LLM CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────────

interface RawLLMOutput {
  type?: unknown;
  primaryDomain?: unknown;
  domains?: unknown;
  complexity?: unknown;
  urgency?: unknown;
  safetySignal?: unknown;
  confidence?: unknown;
  reasoningCode?: unknown;
  secondaryType?: unknown;
}

async function classifyWithLLM(message: string): Promise<{
  classification: IntentClassification;
  telemetry: IntentTelemetry;
}> {
  const startTime = Date.now();
  const telemetry: IntentTelemetry = {
    schemaVersion: '1.0',
    latencyMs: 0,
    validationRepairs: [],
    failedOpen: false,
  };

  const client = getOpenAIClient();

  if (!client) {
    console.warn('[INTENT] OpenAI client not available - using fail-open defaults');
    telemetry.failedOpen = true;
    telemetry.latencyMs = Date.now() - startTime;
    return {
      classification: getFailOpenDefault(message),
      telemetry,
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      max_tokens: 200,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    telemetry.latencyMs = Date.now() - startTime;

    // Parse and validate
    const { classification, repairs, rawOutput } = parseAndValidate(content, message);
    telemetry.validationRepairs = repairs;
    telemetry.rawModelOutput = rawOutput;

    // Log telemetry warnings
    if (repairs.length > 0) {
      console.warn(`[INTENT] Validation repairs applied: ${repairs.join(', ')}`);
    }

    return { classification, telemetry };
  } catch (error) {
    console.error('[INTENT] LLM classification error:', error);
    telemetry.failedOpen = true;
    telemetry.latencyMs = Date.now() - startTime;

    return {
      classification: getFailOpenDefault(message),
      telemetry,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// PARSING & VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

function parseAndValidate(
  content: string,
  originalMessage: string
): {
  classification: IntentClassification;
  repairs: string[];
  rawOutput: unknown;
} {
  const repairs: string[] = [];
  let rawOutput: unknown = null;

  try {
    // Handle potential markdown code blocks
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = match?.[1]?.trim() ?? content;
    }

    rawOutput = JSON.parse(jsonStr.trim());
    const raw = rawOutput as RawLLMOutput;

    // Build classification with validation
    const classification: IntentClassification = {
      type: validateIntentType(raw.type, repairs),
      primaryDomain: validateDomain(raw.primaryDomain, repairs, 'primaryDomain'),
      domains: validateDomains(raw.domains, repairs),
      complexity: validateComplexity(raw.complexity, repairs),
      urgency: validateUrgency(raw.urgency, repairs),
      safetySignal: validateSafetySignal(raw.safetySignal, repairs),
      confidence: validateConfidence(raw.confidence, repairs),
      reasoningCode: validateReasoningCode(raw.reasoningCode, repairs),
      secondaryType: raw.secondaryType
        ? validateIntentType(raw.secondaryType, repairs, true)
        : undefined,
    };

    // Apply invariants
    applyInvariants(classification, repairs);

    return { classification, repairs, rawOutput };
  } catch {
    console.warn('[INTENT] Failed to parse classification:', content);
    repairs.push('parse_error_fallback');

    return {
      classification: getFailOpenDefault(originalMessage),
      repairs,
      rawOutput: content,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FIELD VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────────

function validateIntentType(
  value: unknown,
  repairs: string[],
  isSecondary = false
): IntentType {
  const str = String(value ?? '').toLowerCase();
  if (VALID_INTENT_TYPES.has(str as IntentType)) {
    return str as IntentType;
  }
  if (!isSecondary) {
    repairs.push(`invalid_type_${str}_defaulted_question`);
  }
  return 'question';
}

function validateDomain(
  value: unknown,
  repairs: string[],
  field: string
): Domain {
  const str = String(value ?? '').toLowerCase();
  if (VALID_DOMAINS.has(str as Domain)) {
    return str as Domain;
  }
  repairs.push(`invalid_${field}_${str}_defaulted_general`);
  return 'general';
}

function validateDomains(value: unknown, repairs: string[]): Domain[] {
  if (!Array.isArray(value)) {
    repairs.push('domains_not_array_defaulted');
    return ['general'];
  }

  const validDomains: Domain[] = [];
  const seen = new Set<Domain>();

  for (const item of value) {
    const str = String(item ?? '').toLowerCase();
    if (VALID_DOMAINS.has(str as Domain) && !seen.has(str as Domain)) {
      validDomains.push(str as Domain);
      seen.add(str as Domain);
    }
  }

  if (validDomains.length === 0) {
    repairs.push('no_valid_domains_defaulted_general');
    return ['general'];
  }

  return validDomains;
}

function validateComplexity(value: unknown, repairs: string[]): Complexity {
  const str = String(value ?? '').toLowerCase();
  if (VALID_COMPLEXITIES.has(str as Complexity)) {
    return str as Complexity;
  }
  repairs.push(`invalid_complexity_${str}_defaulted_medium`);
  return 'medium';
}

function validateUrgency(value: unknown, repairs: string[]): Urgency {
  const str = String(value ?? '').toLowerCase();
  if (VALID_URGENCIES.has(str as Urgency)) {
    return str as Urgency;
  }
  repairs.push(`invalid_urgency_${str}_defaulted_low`);
  return 'low';
}

function validateSafetySignal(value: unknown, repairs: string[]): SafetySignal {
  const str = String(value ?? '').toLowerCase();
  if (VALID_SAFETY_SIGNALS.has(str as SafetySignal)) {
    return str as SafetySignal;
  }
  repairs.push(`invalid_safetySignal_${str}_defaulted_none`);
  return 'none';
}

function validateConfidence(value: unknown, repairs: string[]): number {
  const num = Number(value);
  if (Number.isNaN(num)) {
    repairs.push('confidence_nan_defaulted_0.5');
    return 0.5;
  }
  if (num < 0) {
    repairs.push('confidence_below_0_clamped');
    return 0;
  }
  if (num > 1) {
    repairs.push('confidence_above_1_clamped');
    return 1;
  }
  return num;
}

function validateReasoningCode(value: unknown, repairs: string[]): ReasoningCode {
  const str = String(value ?? '').toUpperCase();
  if (VALID_REASONING_CODES.has(str as ReasoningCode)) {
    return str as ReasoningCode;
  }
  repairs.push(`invalid_reasoningCode_${str}_defaulted_INFO_SEEKING`);
  return 'INFO_SEEKING';
}

// ─────────────────────────────────────────────────────────────────────────────────
// INVARIANT ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────────

function applyInvariants(
  c: IntentClassification,
  repairs: string[]
): void {
  // ─── GREETING OVERRIDE ───
  if (c.type === 'greeting') {
    if (c.complexity !== 'simple') {
      repairs.push('greeting_complexity_forced_simple');
      c.complexity = 'simple';
    }
    if (c.urgency !== 'low') {
      repairs.push('greeting_urgency_forced_low');
      c.urgency = 'low';
    }
    if (c.primaryDomain !== 'general') {
      repairs.push('greeting_domain_forced_general');
      c.primaryDomain = 'general';
      c.domains = ['general'];
    }
    if (c.safetySignal !== 'none') {
      repairs.push('greeting_safety_forced_none');
      c.safetySignal = 'none';
    }
    if (c.secondaryType !== undefined) {
      repairs.push('greeting_secondaryType_cleared');
      c.secondaryType = undefined;
    }
    c.reasoningCode = 'SOCIAL_GREETING';
  }

  // ─── SAFETY SIGNAL FLOORS ───
  if (c.safetySignal === 'high') {
    if (c.urgency !== 'high') {
      repairs.push('safety_high_urgency_forced_high');
      c.urgency = 'high';
    }
    if (c.complexity === 'simple') {
      repairs.push('safety_high_complexity_floor_medium');
      c.complexity = 'medium';
    }
  }

  if (
    c.safetySignal === 'watch' &&
    c.domains.includes('mental_health') &&
    ['action', 'venting', 'decision', 'question'].includes(c.type)
  ) {
    if (c.urgency === 'low') {
      repairs.push('watch_mental_health_urgency_floor_medium');
      c.urgency = 'medium';
    }
  }

  // ─── TYPE-BASED COMPLEXITY FLOORS ───
  if (c.type === 'planning' && c.complexity === 'simple') {
    repairs.push('planning_complexity_floor_medium');
    c.complexity = 'medium';
  }

  if (
    c.type === 'decision' &&
    c.complexity === 'simple' &&
    c.domains.some((d) => HIGH_STAKES_DOMAINS.has(d))
  ) {
    repairs.push('decision_high_stakes_complexity_floor_medium');
    c.complexity = 'medium';
  }

  if (c.type === 'action' && c.domains.length > 1 && c.complexity === 'simple') {
    repairs.push('action_multi_domain_complexity_floor_medium');
    c.complexity = 'medium';
  }

  // ─── CLARIFICATION COMPLEXITY CAP ───
  if (c.type === 'clarification' && c.complexity === 'complex') {
    repairs.push('clarification_complexity_capped_medium');
    c.complexity = 'medium';
  }

  // ─── DOMAIN NORMALIZATION ───
  // Ensure primaryDomain is in domains
  if (!c.domains.includes(c.primaryDomain)) {
    repairs.push('primaryDomain_added_to_domains');
    c.domains = [c.primaryDomain, ...c.domains];
  }

  // Stable sort: primary first, then by DOMAIN_PRIORITY
  c.domains = sortDomains(c.domains, c.primaryDomain);

  // ─── MULTI-INTENT REASONING CODE ───
  if (c.secondaryType && c.reasoningCode !== 'MULTI_INTENT') {
    repairs.push('multi_intent_reasoningCode_forced');
    c.reasoningCode = 'MULTI_INTENT';
  }
}

function sortDomains(domains: Domain[], primaryDomain: Domain): Domain[] {
  const unique = [...new Set(domains)];
  return unique.sort((a, b) => {
    // Primary domain always first
    if (a === primaryDomain) return -1;
    if (b === primaryDomain) return 1;
    // Then by priority order
    return DOMAIN_PRIORITY.indexOf(a) - DOMAIN_PRIORITY.indexOf(b);
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// FAIL-OPEN KEYWORD HEURISTICS
// ─────────────────────────────────────────────────────────────────────────────────

// Crisis patterns → safetySignal: high
const CRISIS_PATTERNS = [
  /\bkill\s*my\s*self\b/i,
  /\bsuicid/i,
  /\bwant\s+to\s+die\b/i,
  /\bend\s+(my\s+)?life\b/i,
  /\bmyself\s+(hurt|kill)\b/i,
  /\b(hurt|harm)\s+myself\b/i,
];

// Mental health patterns → safetySignal: watch
const MENTAL_HEALTH_PATTERNS = [
  /\bstress(ed)?\b/i,
  /\banxi(ety|ous)\b/i,
  /\bdepress(ed|ion)?\b/i,
  /\boverwhelm(ed)?\b/i,
  /\bpanic\b/i,
  /\bscared\b/i,
  /\bworried\b/i,
  /\bfrustrat(ed|ion)\b/i,
];

// Domain patterns
const DOMAIN_KEYWORD_PATTERNS: Array<{ pattern: RegExp; domain: Domain }> = [
  { pattern: /\b(stock|invest|trading|portfolio|market|finance|budget|money|401k|ira|savings)\b/i, domain: 'finance' },
  { pattern: /\b(health|medical|doctor|symptoms?|disease|treatment|medication)\b/i, domain: 'health' },
  { pattern: /\b(legal|law|court|attorney|rights|contract|sue|lawsuit)\b/i, domain: 'legal' },
  { pattern: /\b(job|career|resume|interview|salary|promotion|work|boss|coworker|quit|quitting)\b/i, domain: 'career' },
  { pattern: /\b(code|programming|software|bug|function|api|developer)\b/i, domain: 'technical' },
  { pattern: /\b(relationship|dating|marriage|divorce|partner|spouse|boyfriend|girlfriend)\b/i, domain: 'relationships' },
  { pattern: /\b(school|college|university|class|degree|study|learn)\b/i, domain: 'education' },
  { pattern: /\b(art|design|write|writing|creative|music|paint)\b/i, domain: 'creative' },
];

// Action verb patterns → type: action
const ACTION_PATTERNS = [
  /^i('m| am) (going to|gonna)\b/i,
  /^i('ll| will)\b/i,
  /\b(help me|please|can you)\b/i,
  /\b(create|make|build|generate|write|draft|send|email)\b/i,
];

// Question patterns → type: question
const QUESTION_PATTERNS = [
  /^(what|who|where|when|why|how|which|whose|whom)\b/i,
  /\?$/,
  /^(is|are|was|were|do|does|did|can|could|will|would|should)\s+/i,
];

// Immediacy patterns → urgency: medium+
const IMMEDIACY_PATTERNS = [
  /\b(today|now|immediately|urgent|asap|right now)\b/i,
  /\btomorrow\b/i,
];

// Greeting patterns
const GREETING_PATTERNS = [
  /^(hey|hi|hello|what'?s up|howdy|yo|hiya)\b/i,
  /^good (morning|afternoon|evening)\b/i,
  /^thanks?\b/i,
];

export function getFailOpenDefault(message: string): IntentClassification {
  const repairs: string[] = [];

  // Default classification
  const classification: IntentClassification = {
    type: 'question',
    primaryDomain: 'general',
    domains: ['general'],
    complexity: 'medium',
    urgency: 'low',
    safetySignal: 'none',
    confidence: 0.5,
    reasoningCode: 'INFO_SEEKING',
  };

  // ─── GREETING DETECTION ───
  if (GREETING_PATTERNS.some((p) => p.test(message))) {
    classification.type = 'greeting';
    classification.complexity = 'simple';
    classification.reasoningCode = 'SOCIAL_GREETING';
    classification.confidence = 0.7;
    return classification;
  }

  // ─── CRISIS DETECTION (highest priority) ───
  if (CRISIS_PATTERNS.some((p) => p.test(message))) {
    classification.primaryDomain = 'mental_health';
    classification.domains = ['mental_health'];
    classification.safetySignal = 'high';
    classification.urgency = 'high';
    classification.complexity = 'medium';
    classification.type = 'action';
    classification.reasoningCode = 'ACTION_INTENT';
    classification.confidence = 0.8;
    return classification;
  }

  // ─── MENTAL HEALTH DETECTION ───
  if (MENTAL_HEALTH_PATTERNS.some((p) => p.test(message))) {
    classification.primaryDomain = 'mental_health';
    classification.domains = ['mental_health'];
    classification.safetySignal = 'watch';
    classification.urgency = 'medium';
    classification.type = 'venting';
    classification.reasoningCode = 'EMOTIONAL_EXPRESSION';
    classification.confidence = 0.6;
  }

  // ─── DOMAIN DETECTION ───
  const detectedDomains: Domain[] = [];
  for (const { pattern, domain } of DOMAIN_KEYWORD_PATTERNS) {
    if (pattern.test(message) && !detectedDomains.includes(domain)) {
      detectedDomains.push(domain);
    }
  }

  if (detectedDomains.length > 0) {
    // If mental_health already set, merge
    if (classification.primaryDomain === 'mental_health') {
      classification.domains = sortDomains(
        ['mental_health', ...detectedDomains],
        'mental_health'
      );
    } else {
      classification.primaryDomain = detectedDomains[0]!;
      classification.domains = sortDomains(detectedDomains, detectedDomains[0]!);
    }
  }

  // ─── TYPE DETECTION ───
  if (classification.type !== 'venting') {
    if (ACTION_PATTERNS.some((p) => p.test(message))) {
      classification.type = 'action';
      classification.reasoningCode = 'ACTION_INTENT';
    } else if (QUESTION_PATTERNS.some((p) => p.test(message))) {
      classification.type = 'question';
      classification.reasoningCode = 'INFO_SEEKING';
    }
  }

  // ─── URGENCY DETECTION ───
  if (IMMEDIACY_PATTERNS.some((p) => p.test(message))) {
    if (classification.urgency === 'low') {
      classification.urgency = 'medium';
    }
  }

  // Apply invariants to the fail-open result
  applyInvariants(classification, repairs);

  return classification;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LEGACY INTENT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Convert new IntentClassification to legacy Intent format for backward compatibility.
 */
function toLegacyIntent(classification: IntentClassification): Intent {
  // Map new IntentType to legacy IntentType
  const typeMap: Record<IntentType, Intent['type']> = {
    question: 'question',
    decision: 'question', // decision maps to question in legacy
    action: 'action',
    planning: 'planning',
    venting: 'conversation', // venting maps to conversation
    greeting: 'conversation',
    followup: 'conversation',
    clarification: 'conversation',
  };

  // Map new Complexity to legacy complexity
  const complexityMap: Record<Complexity, Intent['complexity']> = {
    simple: 'low',
    medium: 'medium',
    complex: 'high',
  };

  return {
    type: typeMap[classification.type] ?? 'conversation',
    complexity: complexityMap[classification.complexity] ?? 'medium',
    isHypothetical: false, // New system doesn't track this, default false
    domains: classification.domains,
    confidence: classification.confidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC INTENT GATE (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

export interface IntentGateResult extends Intent {
  // Extended fields from IntentClassification
  primaryDomain: Domain;
  urgency: Urgency;
  safetySignal: SafetySignal;
  reasoningCode: ReasoningCode;
  secondaryType?: IntentType;
}

export async function executeIntentGateAsync(
  state: PipelineState,
  _context: PipelineContext
): Promise<GateResult<IntentGateResult>> {
  const start = Date.now();
  const text = state.normalizedInput;

  try {
    const { classification, telemetry } = await classifyWithLLM(text);

    // Log telemetry
    console.log(
      `[INTENT] Classification: ${classification.type} / ${classification.primaryDomain} ` +
        `(${classification.confidence.toFixed(2)}) - ${classification.reasoningCode}` +
        (telemetry.failedOpen ? ' [FAIL-OPEN]' : '') +
        (telemetry.validationRepairs.length > 0
          ? ` [REPAIRS: ${telemetry.validationRepairs.length}]`
          : '')
    );

    // Build combined result (legacy + extended)
    const legacyIntent = toLegacyIntent(classification);
    const result: IntentGateResult = {
      ...legacyIntent,
      primaryDomain: classification.primaryDomain,
      urgency: classification.urgency,
      safetySignal: classification.safetySignal,
      reasoningCode: classification.reasoningCode,
      secondaryType: classification.secondaryType,
    };

    return {
      gateId: 'intent',
      status: telemetry.failedOpen ? 'soft_fail' : 'pass',
      output: result,
      action: 'continue',
      failureReason: telemetry.failedOpen
        ? 'LLM classification failed - using keyword fallback'
        : undefined,
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    console.error('[INTENT] Unexpected error:', error);

    // Absolute fallback
    const fallback = getFailOpenDefault(text);
    const legacyIntent = toLegacyIntent(fallback);

    return {
      gateId: 'intent',
      status: 'soft_fail',
      output: {
        ...legacyIntent,
        primaryDomain: fallback.primaryDomain,
        urgency: fallback.urgency,
        safetySignal: fallback.safetySignal,
        reasoningCode: fallback.reasoningCode,
        secondaryType: fallback.secondaryType,
      },
      action: 'continue',
      failureReason: 'Intent classification failed - using defaults',
      executionTimeMs: Date.now() - start,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// INTERNAL EXPORTS (for testing)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  parseAndValidate,
  applyInvariants,
  sortDomains,
  toLegacyIntent,
};
