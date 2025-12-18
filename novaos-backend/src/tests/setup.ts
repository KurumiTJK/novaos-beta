// ═══════════════════════════════════════════════════════════════════════════════
// TEST SETUP — Mock LLM Classification for Deterministic Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK INTENT CLASSIFICATION (for executeIntentGateAsync)
// ─────────────────────────────────────────────────────────────────────────────────

function getMockIntentClassification(message: string) {
  const text = message.toLowerCase();

  // Default values
  let type = 'question';
  let primaryDomain = 'general';
  let domains = ['general'];
  let complexity = 'medium';
  let urgency = 'low';
  let safetySignal = 'none';
  let reasoningCode = 'INFO_SEEKING';

  // Detect intent type
  if (/^(hey|hi|hello|what'?s up|howdy)/i.test(text)) {
    type = 'greeting';
    complexity = 'simple';
    reasoningCode = 'SOCIAL_GREETING';
  } else if (/\b(help me|can you|please|create|make|generate|write|build)\b/i.test(text)) {
    type = 'action';
    reasoningCode = 'ACTION_INTENT';
  } else if (/\b(plan|schedule|organize|prepare|strategy)\b/i.test(text)) {
    type = 'planning';
    complexity = 'medium';
    reasoningCode = 'PLANNING_REQUEST';
  } else if (/^(what|who|where|when|why|how|is|are|do|does|can|could|would|will)\b/i.test(text)) {
    type = 'question';
    reasoningCode = 'INFO_SEEKING';
  }

  // Detect domains
  if (/\b(stock|invest|trading|portfolio|market|finance|budget|money|401k|savings)\b/i.test(text)) {
    primaryDomain = 'finance';
    domains = ['finance'];
  } else if (/\b(health|medical|doctor|symptoms?|disease|treatment)\b/i.test(text)) {
    primaryDomain = 'health';
    domains = ['health'];
  } else if (/\b(legal|law|court|attorney|rights|contract)\b/i.test(text)) {
    primaryDomain = 'legal';
    domains = ['legal'];
  } else if (/\b(job|career|resume|interview|salary|promotion|work|boss|quit|quitting)\b/i.test(text)) {
    primaryDomain = 'career';
    domains = ['career'];
  } else if (/\b(code|programming|software|bug|function|api)\b/i.test(text)) {
    primaryDomain = 'technical';
    domains = ['technical'];
  }

  // Crisis detection (highest priority)
  if (
    text.includes('kill myself') ||
    text.includes('end my life') ||
    text.includes('want to die') ||
    text.includes('hurt myself') ||
    /myself\s+(hurt|kill)/i.test(text) ||
    /(hurt|harm)\s+myself/i.test(text)
  ) {
    primaryDomain = 'mental_health';
    domains = ['mental_health'];
    safetySignal = 'high';
    urgency = 'high';
    type = 'action';
    reasoningCode = 'ACTION_INTENT';
  }

  // Mental health watch signals
  if (/\b(stress(ed)?|anxi(ety|ous)|depress(ed|ion)?|overwhelm(ed)?|panic)\b/i.test(text)) {
    if (safetySignal !== 'high') {
      primaryDomain = 'mental_health';
      domains = ['mental_health'];
      safetySignal = 'watch';
      urgency = 'medium';
      type = 'venting';
      reasoningCode = 'EMOTIONAL_EXPRESSION';
    }
  }

  return {
    type,
    primaryDomain,
    domains,
    complexity,
    urgency,
    safetySignal,
    confidence: 0.85,
    reasoningCode,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK SHIELD CLASSIFICATION (for executeShieldGate)
// ─────────────────────────────────────────────────────────────────────────────────

function getMockClassification(message: string) {
  const text = message.toLowerCase();

  // CRITICAL + death_risk → CONTROL MODE
  if (
    text.includes('kill myself') ||
    text.includes('end my life') ||
    text.includes('want to die') ||
    text.includes('suicide') ||
    text.includes('hurt myself') ||
    text.includes('self-harm') ||
    text.includes('self harm')
  ) {
    return {
      riskLevel: 'critical',
      category: 'death_risk',
      confidence: 0.98,
      reasoning: 'Crisis/self-harm detected',
    };
  }

  // HIGH + harm_risk → HARD VETO
  if (
    text.includes('make a bomb') ||
    text.includes('build explosive') ||
    text.includes('create weapon') ||
    text.includes('build a weapon') ||
    text.includes('build weapon') ||
    text.includes('hack into') ||
    text.includes('steal password') ||
    text.includes('groom a child') ||
    text.includes('child porn') ||
    text.includes('hurt my coworker') ||
    text.includes('hurt him') ||
    text.includes('beat up')
  ) {
    return {
      riskLevel: 'high',
      category: 'harm_risk',
      confidence: 0.95,
      reasoning: 'Harmful content detected',
    };
  }

  // MEDIUM + reckless_decision → SOFT VETO
  if (
    text.includes('all my savings') ||
    text.includes('life savings') ||
    text.includes('everything i have') ||
    text.includes('entire life savings') ||
    text.includes('skip the doctor') ||
    text.includes('self-diagnos') ||
    text.includes("don't need professional")
  ) {
    return {
      riskLevel: 'medium',
      category: 'reckless_decision',
      confidence: 0.85,
      reasoning: 'High-stakes financial/health decision',
    };
  }

  // Default: SAFE
  return {
    riskLevel: 'none',
    category: 'safe',
    confidence: 0.95,
    reasoning: 'Normal conversation',
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

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK THE GATES MODULE
// ─────────────────────────────────────────────────────────────────────────────────

vi.mock('../gates/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../gates/index.js')>();
  
  return {
    ...original,

    // ─── MOCK: executeIntentGateAsync ───
    executeIntentGateAsync: async (state: any, _context: any) => {
      const start = Date.now();
      const text = state.normalizedInput;
      const classification = getMockIntentClassification(text);

      // Map to legacy Intent format
      const typeMap: Record<string, string> = {
        question: 'question',
        decision: 'question',
        action: 'action',
        planning: 'planning',
        venting: 'conversation',
        greeting: 'conversation',
        followup: 'conversation',
        clarification: 'conversation',
      };

      const complexityMap: Record<string, string> = {
        simple: 'low',
        medium: 'medium',
        complex: 'high',
      };

      return {
        gateId: 'intent',
        status: 'pass',
        output: {
          // Legacy fields
          type: typeMap[classification.type] ?? 'conversation',
          complexity: complexityMap[classification.complexity] ?? 'medium',
          isHypothetical: false,
          domains: classification.domains,
          confidence: classification.confidence,
          // Extended fields
          primaryDomain: classification.primaryDomain,
          urgency: classification.urgency,
          safetySignal: classification.safetySignal,
          reasoningCode: classification.reasoningCode,
        },
        action: 'continue',
        executionTimeMs: Date.now() - start,
      };
    },

    // ─── MOCK: executeShieldGate ───
    executeShieldGate: async (state: any, _context: any) => {
      const start = Date.now();
      const text = state.normalizedInput;
      const classification = getMockClassification(text);

      // CRITICAL + death_risk → CONTROL MODE
      if (classification.riskLevel === 'critical' && classification.category === 'death_risk') {
        return {
          gateId: 'shield',
          status: 'hard_fail',
          output: {
            riskLevel: 'critical',
            controlMode: 'crisis_detected',
            message: getCrisisMessage(),
          },
          action: 'stop',
          executionTimeMs: Date.now() - start,
        };
      }

      // HIGH + harm_risk → HARD VETO
      if (classification.riskLevel === 'high' && classification.category === 'harm_risk') {
        return {
          gateId: 'shield',
          status: 'hard_fail',
          output: {
            riskLevel: 'critical',
            vetoType: 'hard',
            triggers: ['harm_risk'],
            message: classification.reasoning,
          },
          action: 'stop',
          executionTimeMs: Date.now() - start,
        };
      }

      // MEDIUM + reckless_decision → SOFT VETO
      if (classification.riskLevel === 'medium' && classification.category === 'reckless_decision') {
        const ackToken = generateSimpleAckToken();
        return {
          gateId: 'shield',
          status: 'soft_fail',
          output: {
            riskLevel: 'elevated',
            vetoType: 'soft',
            triggers: ['reckless_decision'],
            ackToken,
            message: `This appears to be a high-stakes decision. Please acknowledge to proceed.`,
          },
          action: 'await_ack',
          executionTimeMs: Date.now() - start,
        };
      }

      // PASS
      return {
        gateId: 'shield',
        status: 'pass',
        output: { riskLevel: 'safe' },
        action: 'continue',
        executionTimeMs: Date.now() - start,
      };
    },
  };
});

console.log('[TEST SETUP] LLM classification mocked for deterministic tests');
