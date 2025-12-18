// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD GATE — LLM-Powered Risk Assessment & Veto Logic
// Implements soft/hard veto semantics with ack token handshake
// Uses GPT-4o-mini for semantic risk classification
// ═══════════════════════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import {
  PipelineState,
  PipelineContext,
  GateResult,
  GateId,
  RiskSummary,
  VetoType,
  InterventionLevel,
  StakesLevel,
  ControlTrigger,
  PendingAcknowledgment,
  CRISIS_RESOURCES,
} from '../helpers/types.js';

import {
  generateAckToken,
  validateAckToken,
  ACK_REQUIRED_TEXT,
  NonceStore,
} from '../helpers/ack-token.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM CLASSIFICATION TYPES
// ─────────────────────────────────────────────────────────────────────────────────

type ShieldRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

type ShieldCategory = 'safe' | 'death_risk' | 'harm_risk' | 'reckless_decision';

interface ShieldClassification {
  riskLevel: ShieldRiskLevel;
  category: ShieldCategory;
  confidence: number;
  reasoning: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LLM CLASSIFICATION SYSTEM PROMPT WITH FEW-SHOT EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────────

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

User: "Putting all my savings into crypto"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.85,"reasoning":"High-risk financial decision with all savings"}

User: "I'm investing everything I have in this one stock"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.88,"reasoning":"All-in investment is financially reckless"}

User: "I'm quitting tomorrow and telling my boss to fuck off"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.82,"reasoning":"Impulsive job quit while burning bridges"}

User: "I'm going to divorce her today, I've had enough"
{"riskLevel":"medium","category":"reckless_decision","confidence":0.80,"reasoning":"Major life decision made in emotional state"}

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

// ─────────────────────────────────────────────────────────────────────────────────
// SHIELD GATE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

export class ShieldGate {
  readonly gateId: GateId = 'shield';
  private openai: OpenAI | null = null;
  private model: string = 'gpt-4o-mini';

  constructor(
    private nonceStore: NonceStore,
    private ackTokenSecret: string,
    openaiApiKey?: string
  ) {
    const key = openaiApiKey ?? process.env.OPENAI_API_KEY;
    if (key) {
      this.openai = new OpenAI({ apiKey: key });
    }
  }

  async execute(
    state: PipelineState,
    context: PipelineContext
  ): Promise<GateResult<RiskSummary>> {
    const start = Date.now();
    const { input, intent } = state;
    const auditId = `audit_${randomUUID().slice(0, 8)}`;

    try {
      // ─────────────────────────────────────────────────────────────────────────
      // Step 1: Check for pending acknowledgment token
      // ─────────────────────────────────────────────────────────────────────────
      if (input.ackToken && input.ackText) {
        const validation = await validateAckToken(
          input.ackToken,
          input,
          input.ackText,
          ACK_REQUIRED_TEXT,
          this.ackTokenSecret,
          this.nonceStore
        );

        if (validation.valid) {
          console.log(`[SHIELD] Ack token validated for request ${context.requestId}`);
          
          return {
            gateId: this.gateId,
            status: 'pass',
            output: {
              interventionLevel: 'none',
              vetoType: undefined,
              stakesLevel: 'low',
              reason: 'User acknowledged and proceeded',
              auditId,
              overrideApplied: true,
            },
            action: 'continue',
            executionTimeMs: Date.now() - start,
          };
        } else {
          console.warn(`[SHIELD] Invalid ack token: ${validation.reason}`);
          // Fall through to normal risk assessment
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Step 2: LLM-powered risk classification
      // ─────────────────────────────────────────────────────────────────────────
      const classification = await this.classifyRisk(input.message);
      
      console.log(`[SHIELD] Classification: ${classification.category} / ${classification.riskLevel} (${classification.confidence.toFixed(2)}) - ${classification.reasoning}`);

      // ─────────────────────────────────────────────────────────────────────────
      // Step 3: Map classification to gate result
      // ─────────────────────────────────────────────────────────────────────────

      // CRITICAL + death_risk → CONTROL MODE
      if (classification.riskLevel === 'critical' && classification.category === 'death_risk') {
        const controlTrigger = this.inferControlTrigger(classification.reasoning);
        
        return {
          gateId: this.gateId,
          status: 'soft_fail',
          output: {
            interventionLevel: 'friction',
            vetoType: undefined,
            stakesLevel: 'critical',
            reason: `Control mode: ${controlTrigger}`,
            auditId,
            controlTrigger,
            requiredPrependResources: true,
            crisisResources: CRISIS_RESOURCES,
          },
          action: 'continue',
          failureReason: `Control mode triggered: ${controlTrigger}`,
          executionTimeMs: Date.now() - start,
        };
      }

      // HIGH + harm_risk → HARD VETO
      if (classification.riskLevel === 'high' && classification.category === 'harm_risk') {
        return {
          gateId: this.gateId,
          status: 'hard_fail',
          output: {
            interventionLevel: 'veto',
            vetoType: 'hard',
            stakesLevel: 'critical',
            reason: classification.reasoning,
            auditId,
          },
          action: 'stop',
          failureReason: `Hard veto: ${classification.reasoning}`,
          executionTimeMs: Date.now() - start,
        };
      }

      // MEDIUM + reckless_decision → SOFT VETO
      if (classification.riskLevel === 'medium' && classification.category === 'reckless_decision') {
        const stakes = this.inferStakes(classification.reasoning);
        
        const { token, payload } = generateAckToken(
          input,
          classification.reasoning,
          auditId,
          this.ackTokenSecret
        );

        const pendingAck: PendingAcknowledgment = {
          ackToken: token,
          requiredText: ACK_REQUIRED_TEXT,
          expiresAt: new Date(payload.expiresAt),
          auditId,
        };

        return {
          gateId: this.gateId,
          status: 'soft_fail',
          output: {
            interventionLevel: 'veto',
            vetoType: 'soft',
            stakesLevel: stakes,
            reason: classification.reasoning,
            auditId,
            pendingAck,
          },
          action: 'await_ack',
          failureReason: `Soft veto requires acknowledgment: ${classification.reasoning}`,
          executionTimeMs: Date.now() - start,
        };
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Step 4: Low/None risk — continue normally
      // ─────────────────────────────────────────────────────────────────────────
      const interventionLevel = this.determineIntervention(classification, intent);
      const stakesLevel = this.determineStakes(classification, intent);

      return {
        gateId: this.gateId,
        status: interventionLevel !== 'none' ? 'soft_fail' : 'pass',
        output: {
          interventionLevel,
          vetoType: undefined,
          stakesLevel,
          reason: classification.reasoning || 'No significant risk detected',
          auditId,
        },
        action: 'continue',
        executionTimeMs: Date.now() - start,
      };

    } catch (error) {
      console.error('[SHIELD] Error during risk assessment:', error);
      
      // FAIL OPEN — if LLM fails, pass through (don't block)
      return {
        gateId: this.gateId,
        status: 'pass',
        output: {
          interventionLevel: 'none',
          vetoType: undefined,
          stakesLevel: 'low',
          reason: 'Risk assessment unavailable - proceeding with caution',
          auditId,
        },
        action: 'continue',
        failureReason: 'LLM classification failed - failing open',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  /**
   * Classify message risk using LLM.
   * Falls back to safe classification if LLM unavailable.
   */
  private async classifyRisk(message: string): Promise<ShieldClassification> {
    if (!this.openai) {
      console.warn('[SHIELD] OpenAI client not available - defaulting to safe');
      return {
        riskLevel: 'none',
        category: 'safe',
        confidence: 0.5,
        reasoning: 'LLM unavailable - default safe classification',
      };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SHIELD_SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        max_tokens: 150,
        temperature: 0, // Zero temperature for deterministic classification
      });

      const content = response.choices[0]?.message?.content?.trim() ?? '';
      
      // Parse JSON response
      const parsed = this.parseClassification(content);
      
      // Validate classification consistency
      return this.validateClassification(parsed);

    } catch (error) {
      console.error('[SHIELD] LLM classification error:', error);
      
      // Return safe classification on error
      return {
        riskLevel: 'none',
        category: 'safe',
        confidence: 0.5,
        reasoning: 'Classification error - default safe',
      };
    }
  }

  /**
   * Parse LLM response into classification object.
   */
  private parseClassification(content: string): ShieldClassification {
    try {
      // Handle potential markdown code blocks
      let jsonStr = content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        jsonStr = match?.[1]?.trim() ?? content;
      }
      
      // Clean up any leading/trailing whitespace or quotes
      jsonStr = jsonStr.trim();
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        riskLevel: this.normalizeRiskLevel(parsed.riskLevel),
        category: this.normalizeCategory(parsed.category),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
      };
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

  /**
   * Normalize risk level to valid enum value.
   */
  private normalizeRiskLevel(level: unknown): ShieldRiskLevel {
    const valid: ShieldRiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];
    const str = String(level).toLowerCase();
    return valid.includes(str as ShieldRiskLevel) ? (str as ShieldRiskLevel) : 'none';
  }

  /**
   * Normalize category to valid enum value.
   */
  private normalizeCategory(category: unknown): ShieldCategory {
    const valid: ShieldCategory[] = ['safe', 'death_risk', 'harm_risk', 'reckless_decision'];
    const str = String(category).toLowerCase();
    return valid.includes(str as ShieldCategory) ? (str as ShieldCategory) : 'safe';
  }

  /**
   * Validate classification consistency and fix mismatches.
   */
  private validateClassification(classification: ShieldClassification): ShieldClassification {
    const { riskLevel, category } = classification;
    
    // Enforce consistent risk level ↔ category mapping
    if (category === 'death_risk' && riskLevel !== 'critical') {
      return { ...classification, riskLevel: 'critical' };
    }
    if (category === 'harm_risk' && riskLevel !== 'high') {
      return { ...classification, riskLevel: 'high' };
    }
    if (category === 'reckless_decision' && riskLevel !== 'medium') {
      return { ...classification, riskLevel: 'medium' };
    }
    if (category === 'safe' && !['none', 'low'].includes(riskLevel)) {
      return { ...classification, riskLevel: 'none' };
    }
    
    return classification;
  }

  /**
   * Infer control trigger type from reasoning.
   */
  private inferControlTrigger(reasoning: string): ControlTrigger {
    const lower = reasoning.toLowerCase();
    
    if (lower.includes('suicid') || lower.includes('kill myself') || lower.includes('end my life') || lower.includes('ending it')) {
      return 'crisis_detected';
    }
    if (lower.includes('self-harm') || lower.includes('hurt myself') || lower.includes('self harm')) {
      return 'self_harm_risk';
    }
    if (lower.includes('threat') || lower.includes('danger') || lower.includes('stalked') || lower.includes('abuse')) {
      return 'external_threat';
    }
    if (lower.includes('medication') || lower.includes('treatment')) {
      return 'self_harm_risk';
    }
    
    return 'crisis_detected'; // Default for death_risk
  }

  /**
   * Infer stakes level from reasoning.
   */
  private inferStakes(reasoning: string): StakesLevel {
    const lower = reasoning.toLowerCase();
    
    if (lower.includes('all savings') || lower.includes('life savings') || lower.includes('everything')) {
      return 'critical';
    }
    if (lower.includes('job') || lower.includes('career') || lower.includes('marriage') || lower.includes('divorce')) {
      return 'high';
    }
    if (lower.includes('invest') || lower.includes('purchase') || lower.includes('buy')) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Determine intervention level for low/none risk cases.
   */
  private determineIntervention(classification: ShieldClassification, intent: any): InterventionLevel {
    // Low risk with low confidence might warrant a nudge
    if (classification.riskLevel === 'low' && classification.confidence < 0.7) {
      return 'nudge';
    }
    
    // Domain-based assessment for pass-through cases
    const domains = intent?.domains ?? [];
    const highStakesDomains = ['health', 'legal', 'finance', 'mental_health'];
    
    if (domains.some((d: string) => highStakesDomains.includes(d))) {
      return 'nudge';
    }
    
    return 'none';
  }

  /**
   * Determine stakes level for low/none risk cases.
   */
  private determineStakes(classification: ShieldClassification, intent: any): StakesLevel {
    const domains = intent?.domains ?? [];
    const highStakesDomains = ['health', 'legal', 'finance', 'mental_health'];
    
    if (domains.some((d: string) => highStakesDomains.includes(d))) {
      if (intent?.type === 'action') {
        return 'high';
      }
      return 'medium';
    }
    
    return 'low';
  }
}
