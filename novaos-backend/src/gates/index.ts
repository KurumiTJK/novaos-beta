// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS GATES — All Gate Implementations
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  Intent,
  IntentType,
  ShieldResult,
  LensResult,
  StanceResult,
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

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT GATE
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
      domains,
      confidence: 0.8,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD GATE
// ═══════════════════════════════════════════════════════════════════════════════

const CONTROL_PATTERNS = [
  { pattern: /\b(kill myself|end my life|want to die|suicide)\b/i, mode: 'crisis_detected' as const },
  { pattern: /\b(hurt myself|self[- ]?harm|cut myself)\b/i, mode: 'self_harm_risk' as const },
];

const HARD_VETO_PATTERNS = [
  { pattern: /\b(make a bomb|build explosive|create weapon)\b/i, trigger: 'weapons_creation' },
  { pattern: /\b(hack into|steal password|break into account)\b/i, trigger: 'illegal_hacking' },
  { pattern: /\b(groom a child|child porn|underage)\b/i, trigger: 'child_safety' },
  { pattern: /\b(evade tax|money laundering|fraud scheme)\b/i, trigger: 'financial_crime' },
];

const SOFT_VETO_PATTERNS = [
  { pattern: /\b(all my savings|entire life savings|everything I have)\b/i, trigger: 'high_financial_risk' },
  { pattern: /\b(skip the doctor|self[- ]?diagnos|don't need professional)\b/i, trigger: 'health_without_professional' },
];

export function executeShieldGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<ShieldResult> {
  const start = Date.now();
  const text = state.normalizedInput;

  // Check control mode triggers (highest priority)
  for (const { pattern, mode } of CONTROL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        gateId: 'shield',
        status: 'hard_fail',
        output: {
          riskLevel: 'critical',
          controlMode: mode,
          message: getCrisisMessage(),
        },
        action: 'stop',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  // Check hard veto patterns
  for (const { pattern, trigger } of HARD_VETO_PATTERNS) {
    if (pattern.test(text)) {
      return {
        gateId: 'shield',
        status: 'hard_fail',
        output: {
          riskLevel: 'critical',
          vetoType: 'hard',
          triggers: [trigger],
          message: 'This request cannot be processed as it may cause harm.',
        },
        action: 'stop',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  // Check soft veto patterns
  for (const { pattern, trigger } of SOFT_VETO_PATTERNS) {
    if (pattern.test(text)) {
      const ackToken = generateSimpleAckToken();
      return {
        gateId: 'shield',
        status: 'soft_fail',
        output: {
          riskLevel: 'elevated',
          vetoType: 'soft',
          triggers: [trigger],
          ackToken,
          message: `This appears to be a high-stakes decision. Please acknowledge to proceed.`,
        },
        action: 'await_ack',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  return {
    gateId: 'shield',
    status: 'pass',
    output: { riskLevel: 'safe' },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
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

// ═══════════════════════════════════════════════════════════════════════════════
// LENS GATE
// ═══════════════════════════════════════════════════════════════════════════════

const FRESHNESS_DOMAINS = [
  { pattern: /\b(stock|share) price|market cap|trading at\b/i, domain: 'stock_prices', window: 'minutes' },
  { pattern: /\b(bitcoin|crypto|ethereum) (price|worth|value)\b/i, domain: 'crypto', window: 'minutes' },
  { pattern: /\b(weather|forecast|temperature)\b/i, domain: 'weather', window: 'hours' },
  { pattern: /\b(current law|regulation|policy)\b/i, domain: 'legal', window: 'weeks' },
  { pattern: /\b(latest|recent|today|now|current)\b/i, domain: 'temporal', window: 'varies' },
];

export function executeLensGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<LensResult> {
  const start = Date.now();
  const text = state.normalizedInput;

  // Check for freshness-sensitive content
  for (const { pattern, domain, window } of FRESHNESS_DOMAINS) {
    if (pattern.test(text)) {
      // For high-stakes domains without verification, stop
      const isHighStakes = ['stock_prices', 'crypto', 'legal'].includes(domain);
      
      return {
        gateId: 'lens',
        status: isHighStakes ? 'soft_fail' : 'pass',
        output: {
          needsVerification: true,
          verified: false,
          domain,
          stakes: isHighStakes ? 'high' : 'medium',
          status: 'degraded',
          freshnessWindow: window,
          message: isHighStakes 
            ? `This requires current ${domain} data which I cannot verify in real-time.`
            : undefined,
        },
        action: isHighStakes ? 'degrade' : 'continue',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  return {
    gateId: 'lens',
    status: 'pass',
    output: {
      needsVerification: false,
      verified: true,
      stakes: 'low',
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE
// ═══════════════════════════════════════════════════════════════════════════════

export function executeStanceGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<StanceResult> {
  const start = Date.now();

  // Priority: CONTROL > SHIELD > LENS > SWORD
  
  // Check for control mode
  if (state.shieldResult?.controlMode) {
    return {
      gateId: 'stance',
      status: 'pass',
      output: { stance: 'control', reason: 'Crisis or safety concern detected' },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  // Check for shield intervention
  if (state.shieldResult?.vetoType === 'hard') {
    return {
      gateId: 'stance',
      status: 'pass',
      output: { stance: 'shield', reason: 'Hard veto active' },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  // Check for lens requirements
  if (state.lensResult?.needsVerification && !state.lensResult?.verified) {
    return {
      gateId: 'stance',
      status: 'pass',
      output: { stance: 'lens', reason: 'Verification required' },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  // Determine based on intent
  const intentType = state.intent?.type;
  if (intentType === 'action' || intentType === 'planning') {
    return {
      gateId: 'stance',
      status: 'pass',
      output: { stance: 'sword', reason: 'Action-oriented request' },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  return {
    gateId: 'stance',
    status: 'pass',
    output: { stance: 'lens', reason: 'Information request' },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE
// ═══════════════════════════════════════════════════════════════════════════════

const CAPABILITY_MATRIX: Record<Stance, string[]> = {
  control: ['respond', 'provideResources'],
  shield: ['respond', 'warnUser', 'requestAck'],
  lens: ['respond', 'verifyInfo', 'provideSources'],
  sword: ['respond', 'verifyInfo', 'generateSpark', 'executeAction'],
};

export function executeCapabilityGate(
  state: PipelineState,
  context: PipelineContext
): GateResult<CapabilityResult> {
  const start = Date.now();
  const stance = state.stance ?? 'lens';

  const allowedCapabilities = CAPABILITY_MATRIX[stance] ?? ['respond'];
  const deniedCapabilities: string[] = [];

  // Only allow explicit actions from proper sources
  const explicitActions = context.actionSources.filter(
    (source) => ['ui_button', 'command_parser', 'api_field'].includes(source.type)
  );

  // Deny NL-inferred actions
  const nlActions = context.actionSources.filter((source) => source.type === 'nl_inference');
  if (nlActions.length > 0) {
    deniedCapabilities.push('nl_inference_blocked');
  }

  return {
    gateId: 'capability',
    status: 'pass',
    output: {
      allowedCapabilities,
      deniedCapabilities,
      explicitActions: explicitActions.length > 0 ? explicitActions : undefined,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL GATE — Supports both sync mock and async provider
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_RESPONSES: Record<string, string> = {
  question: 'Based on my understanding, here is the information you requested.',
  action: 'I can help you with that. Here are the steps to accomplish your goal.',
  planning: 'Let me help you create a plan. Here is a structured approach.',
  default: 'I understand your request. Here is my response.',
};

export function buildModelConstraints(state: PipelineState): GenerationConstraints {
  const constraints: GenerationConstraints = {
    bannedPhrases: [
      "I'm always here for you",
      "You can always count on me",
      "I'm so proud of you",
    ],
    maxWe: 2,
    tone: state.stance === 'control' ? 'compassionate' : 'professional',
  };

  // Add freshness restrictions if lens detected time-sensitive content
  if (state.lensResult?.needsVerification && !state.lensResult?.verified) {
    constraints.numericPrecisionAllowed = false;
    constraints.mustInclude = ['Note: I cannot verify current'];
  }

  // Add crisis resources if control mode
  if (state.shieldResult?.controlMode) {
    constraints.mustPrepend = getCrisisMessage();
  }

  return constraints;
}

export function executeModelGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<Generation> {
  const start = Date.now();
  const constraints = buildModelConstraints(state);

  // Generate mock response
  const intentType = state.intent?.type ?? 'default';
  let text: string = MOCK_RESPONSES[intentType as keyof typeof MOCK_RESPONSES] 
    ?? MOCK_RESPONSES.default 
    ?? 'I understand your request.';

  // Apply mustPrepend
  if (constraints.mustPrepend) {
    text = constraints.mustPrepend + '\n\n' + text;
  }

  // Apply mustInclude
  if (constraints.mustInclude) {
    text += '\n\n' + constraints.mustInclude.join(' ');
  }

  return {
    gateId: 'model',
    status: 'pass',
    output: {
      text,
      model: 'mock-v1',
      tokensUsed: text.split(/\s+/).length,
      constraints,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// Async version that uses real providers
export async function executeModelGateAsync(
  state: PipelineState,
  _context: PipelineContext,
  generate: (prompt: string, systemPrompt: string, constraints?: GenerationConstraints) => Promise<Generation>,
  systemPrompt: string
): Promise<GateResult<Generation>> {
  const start = Date.now();
  const constraints = buildModelConstraints(state);

  try {
    const generation = await generate(state.userMessage, systemPrompt, constraints);

    return {
      gateId: 'model',
      status: 'pass',
      output: generation,
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    console.error('[MODEL] Generation failed:', error);
    
    // Fall back to mock on error
    const mockResult = executeModelGate(state, _context);
    return {
      ...mockResult,
      output: {
        ...mockResult.output,
        fallbackUsed: true,
      },
    };
  }
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
