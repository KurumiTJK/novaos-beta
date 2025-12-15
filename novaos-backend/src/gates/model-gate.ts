// ═══════════════════════════════════════════════════════════════════════════════
// MODEL GATE — Generation with Constraints
// Builds structured constraints and invokes the model
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PipelineState,
  PipelineContext,
  GateResult,
  GateId,
  GenerationResult,
  GenerationConstraints,
  IMMEDIATE_DOMAINS,
} from '../helpers/types.js';

import { detectDomain, isImmediateDomain } from '../helpers/freshness-checker.js';
import { renderCrisisResourceBlock } from '../helpers/safety-renderer.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LINGUISTIC CONSTRAINTS
// ─────────────────────────────────────────────────────────────────────────────────

const LINGUISTIC_CONSTRAINTS = {
  praise: {
    banned: [
      "I'm so proud of you",
      "Great job",
      "You're amazing",
      "You're incredible",
      "You're wonderful",
      "Well done",
      "Excellent work",
    ],
  },
  dependencyLanguage: {
    banned: [
      "I'm always here for you",
      "You can always count on me",
      "I'll always be here",
      "I care about you",
      "You can rely on me",
      "I'm here for you",
    ],
  },
  firstPersonPlural: {
    maxPerResponse: 3,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// STYLE CONTRACT
// Base system prompt for model generation
// ─────────────────────────────────────────────────────────────────────────────────

const STYLE_CONTRACT = `You are Nova, a cognitive companion that serves as Shield, Lens, and Sword.

Core principles:
- Be direct and concise
- Distinguish facts from inference from speculation
- Never fabricate information
- Calibrate confidence to evidence
- Respect user autonomy
- Avoid fostering dependency

Communication style:
- Warm but not effusive
- Helpful but not sycophantic
- Honest about limitations
- Clear about uncertainty`;

// ─────────────────────────────────────────────────────────────────────────────────
// MODEL GATE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

export class ModelGate {
  readonly gateId: GateId = 'model';

  async execute(
    state: PipelineState,
    context: PipelineContext
  ): Promise<GateResult<GenerationResult>> {
    const start = Date.now();
    const { input, intent, risk, verification, stance, validated } = state;

    try {
      // ─────────────────────────────────────────────────────────────────────────
      // Step 1: Build generation constraints
      // ─────────────────────────────────────────────────────────────────────────
      const constraints = this.buildConstraints(state);

      // ─────────────────────────────────────────────────────────────────────────
      // Step 2: Select model based on stance and complexity
      // ─────────────────────────────────────────────────────────────────────────
      const model = this.selectModel(stance, intent?.complexity);

      // ─────────────────────────────────────────────────────────────────────────
      // Step 3: Build system prompt with constraints
      // ─────────────────────────────────────────────────────────────────────────
      const systemPrompt = this.buildSystemPrompt(constraints);

      // ─────────────────────────────────────────────────────────────────────────
      // Step 4: Invoke model
      // ─────────────────────────────────────────────────────────────────────────
      const response = await this.invokeModel(model, systemPrompt, input.message, stance);

      return {
        gateId: this.gateId,
        status: 'pass',
        output: {
          text: response.text,
          model,
          tokensUsed: response.tokensUsed,
          constraints,
        },
        action: 'continue',
        executionTimeMs: Date.now() - start,
      };

    } catch (error) {
      console.error('[MODEL] Generation error:', error);

      // Try fallback model
      try {
        const fallbackConstraints = this.buildConstraints(state);
        const fallbackResponse = await this.invokeFallbackModel(
          input.message,
          fallbackConstraints,
          stance
        );

        return {
          gateId: this.gateId,
          status: 'soft_fail',
          output: {
            ...fallbackResponse,
            fallbackUsed: true,
          },
          action: 'continue',
          failureReason: 'Primary model failed, used fallback',
          executionTimeMs: Date.now() - start,
        };

      } catch (fallbackError) {
        console.error('[MODEL] Fallback also failed:', fallbackError);

        return {
          gateId: this.gateId,
          status: 'hard_fail',
          output: null as any,
          action: 'stop',
          failureReason: 'All models unavailable',
          executionTimeMs: Date.now() - start,
        };
      }
    }
  }

  /**
   * Build structured generation constraints.
   */
  private buildConstraints(state: PipelineState): GenerationConstraints {
    const constraints: GenerationConstraints = {
      bannedPhrases: [
        ...LINGUISTIC_CONSTRAINTS.praise.banned,
        ...LINGUISTIC_CONSTRAINTS.dependencyLanguage.banned,
      ],
      maxWe: LINGUISTIC_CONSTRAINTS.firstPersonPlural.maxPerResponse,
      tone: 'neutral',
      numericPrecisionAllowed: true,
      actionRecommendationsAllowed: true,
    };

    // Apply verification degradation
    if (state.verification?.plan) {
      constraints.numericPrecisionAllowed = state.verification.plan.numericPrecisionAllowed;
      constraints.actionRecommendationsAllowed = state.verification.plan.actionRecommendationsAllowed;
    }

    // Apply freshness restrictions for immediate domains
    if (state.verification?.plan?.verificationStatus === 'skipped') {
      const domain = detectDomain(state.input.message);
      if (isImmediateDomain(domain)) {
        constraints.numericPrecisionAllowed = false;
        constraints.mustInclude = ['Please verify current data with your broker/source'];
        constraints.mustNotInclude = ['buy', 'sell', 'invest', 'recommend'];
      }
    }

    // Apply Shield-required resources
    if (state.risk?.requiredPrependResources) {
      constraints.mustPrepend = renderCrisisResourceBlock();
    }

    // Apply regeneration constraints from PersonalityGate
    if (state.validated?.regenerationConstraints) {
      constraints.bannedPhrases.push(...state.validated.regenerationConstraints.bannedPhrases);
      if (state.validated.regenerationConstraints.maxWe !== undefined) {
        constraints.maxWe = state.validated.regenerationConstraints.maxWe;
      }
    }

    return constraints;
  }

  /**
   * Build system prompt with constraints.
   */
  private buildSystemPrompt(constraints: GenerationConstraints): string {
    let prompt = STYLE_CONTRACT;

    if (constraints.bannedPhrases.length > 0) {
      prompt += `\n\nBANNED PHRASES (do not use):\n${constraints.bannedPhrases.map(p => `- "${p}"`).join('\n')}`;
    }

    if (constraints.maxWe !== undefined) {
      prompt += `\n\nMAX "WE" USAGE: ${constraints.maxWe} times per response`;
    }

    if (!constraints.numericPrecisionAllowed) {
      prompt += `\n\nNUMERIC PRECISION: Do NOT quote specific numbers, prices, percentages, or statistics. Use ranges or direct user to verify.`;
    }

    if (!constraints.actionRecommendationsAllowed) {
      prompt += `\n\nACTION RECOMMENDATIONS: Do NOT recommend specific actions like buy/sell/invest. Provide information only.`;
    }

    if (constraints.mustInclude?.length) {
      prompt += `\n\nMUST INCLUDE in response:\n${constraints.mustInclude.map(p => `- "${p}"`).join('\n')}`;
    }

    if (constraints.mustNotInclude?.length) {
      prompt += `\n\nMUST NOT INCLUDE:\n${constraints.mustNotInclude.map(p => `- "${p}"`).join('\n')}`;
    }

    return prompt;
  }

  /**
   * Select model based on stance and complexity.
   */
  private selectModel(stance: any, complexity: any): string {
    // In production, this would select from available models
    // For now, return a placeholder model name
    if (stance === 'control') {
      return 'nova-safety-v1';
    }
    if (complexity === 'high') {
      return 'nova-advanced-v1';
    }
    return 'nova-standard-v1';
  }

  /**
   * Invoke the model for generation.
   * In production, this would call the actual LLM API.
   */
  private async invokeModel(
    model: string,
    systemPrompt: string,
    userMessage: string,
    stance: any
  ): Promise<{ text: string; tokensUsed: number }> {
    // Simulated generation for Phase 1
    // In production, this would call the actual LLM API
    
    const stanceResponses: Record<string, string> = {
      control: "I notice you might be going through a difficult time. " +
               "Before we continue, I want to make sure you have access to support resources. " +
               "How can I help you today?",
      shield: "I want to help you think through this carefully. " +
              "Let me share some considerations that might be relevant.",
      lens: "Here's what I understand about your question. " +
            "Let me break this down clearly.",
      sword: "Let's focus on the next step you can take. " +
             "Here's a concrete action to move forward.",
    };

    const baseResponse = stanceResponses[stance as string] || stanceResponses.lens;
    
    return {
      text: baseResponse,
      tokensUsed: Math.floor(Math.random() * 500) + 100,
    };
  }

  /**
   * Invoke fallback model.
   */
  private async invokeFallbackModel(
    userMessage: string,
    constraints: GenerationConstraints,
    stance: any
  ): Promise<GenerationResult> {
    // Simulated fallback
    return {
      text: "I apologize, but I'm having some technical difficulties. " +
            "Please try again in a moment.",
      model: 'nova-fallback-v1',
      tokensUsed: 50,
      constraints,
      fallbackUsed: true,
    };
  }
}
