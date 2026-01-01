// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION PIPELINE — Gate Orchestration
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  PipelineResult,
} from '../types/index.js';

import {
  executeIntentGateAsync,
  executeShieldGate,
  executeToolsGate,
  executeStanceGate,
  executeCapabilityGate,
  executeResponseGateAsync,
  executeConstitutionGateAsync,
  buildRegenerationMessage,
  type ConstitutionGateOutput,
} from '../gates/index.js';

import { 
  ProviderManager, 
  type ProviderManagerConfig 
} from '../providers/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const MAX_REGENERATIONS = 2;

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

export interface PipelineConfig extends ProviderManagerConfig {
  responseModel?: string;
  capabilitySelectorModel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class ExecutionPipeline {
  private providerManager: ProviderManager;

  constructor(config: PipelineConfig = {}) {
    this.providerManager = new ProviderManager({
      openaiApiKey: config.openaiApiKey,
      geminiApiKey: config.geminiApiKey,
      preferredProvider: config.preferredProvider,
      enableFallback: config.enableFallback ?? true,
      responseModel: config.responseModel,
    });
  }

  /**
   * Process a user message through the pipeline.
   */
  async process(
    userMessage: string,
    context: Partial<PipelineContext> = {}
  ): Promise<PipelineResult> {
    const pipelineStart = Date.now();
    
    // Build full context
    const fullContext: PipelineContext = {
      conversationId: context.conversationId ?? `conv-${Date.now()}`,
      requestId: context.requestId ?? `req-${Date.now()}`,
      userId: context.userId,
      sessionId: context.sessionId,
      conversationHistory: context.conversationHistory,
      actionSources: context.actionSources,
    };

    // Initialize state
    const state: PipelineState = {
      userMessage,
      normalizedInput: userMessage.toLowerCase().trim(),
      gateResults: {},
      flags: {},
      timestamps: {
        pipelineStart,
      },
    };

    try {
      return await this.executePipeline(state, fullContext);
    } catch (error) {
      console.error('[PIPELINE] Fatal error:', error);
      return {
        status: 'error',
        response: 'I apologize, but I encountered an error. Please try again.',
        gateResults: state.gateResults,
        metadata: {
          requestId: fullContext.requestId,
          totalTimeMs: Date.now() - pipelineStart,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async executePipeline(
    state: PipelineState,
    context: PipelineContext
  ): Promise<PipelineResult> {
    const pipelineStart = state.timestamps.pipelineStart;

    // ─── STAGE 1: INTENT (LLM-Powered Classification) ───
    state.gateResults.intent = await executeIntentGateAsync(state, context);
    state.intent_summary = state.gateResults.intent.output;

    // ─── STAGE 2: SHIELD (Router) ───
    state.gateResults.shield = executeShieldGate(state, context);
    state.shieldResult = state.gateResults.shield.output;

    // ─── STAGE 3: TOOLS (Router) ───
    state.gateResults.tools = executeToolsGate(state, context);
    state.toolsResult = state.gateResults.tools.output;

    // ─── STAGE 4: STANCE (Router) ───
    state.gateResults.stance = executeStanceGate(state, context);
    state.stanceResult = state.gateResults.stance.output;
    state.stance = state.stanceResult.route as any;

    // ─── STAGE 5: CAPABILITY (Live Data Fetching) ───
    state.gateResults.capability = await executeCapabilityGate(state, context);
    state.capabilityResult = state.gateResults.capability.output;

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 6-7: GENERATION LOOP WITH CONSTITUTIONAL CHECK
    // ═══════════════════════════════════════════════════════════════════════════
    let regenerationCount = 0;
    let currentUserMessage = state.userMessage;

    while (regenerationCount <= MAX_REGENERATIONS) {
      // ─── STAGE 6: RESPONSE (The Stitcher) ───
      state.gateResults.model = await executeResponseGateAsync(
        { ...state, userMessage: currentUserMessage },
        context,
        (prompt, systemPrompt, constraints) => 
          this.providerManager.generate(prompt, systemPrompt, constraints, {
            conversationHistory: context.conversationHistory ? [...context.conversationHistory] : undefined,
          })
      );
      state.generation = state.gateResults.model.output;

      // ─── STAGE 7: CONSTITUTION (Constitutional Check) ───
      state.gateResults.constitution = await executeConstitutionGateAsync(
        state,
        context,
        (prompt, systemPrompt) => 
          this.providerManager.generate(prompt, systemPrompt, {})
      );
      state.validatedOutput = state.gateResults.constitution.output;

      // Check if regeneration needed
      if (
        state.gateResults.constitution.action === 'regenerate' &&
        regenerationCount < MAX_REGENERATIONS
      ) {
        regenerationCount++;
        state.flags.regenerationAttempt = regenerationCount;
        
        const constitutionOutput = state.gateResults.constitution.output as ConstitutionGateOutput;
        const fixGuidance = constitutionOutput.fixGuidance;
        
        if (fixGuidance) {
          currentUserMessage = buildRegenerationMessage(state.userMessage, fixGuidance);
          console.log(`[PIPELINE] Regenerating (${regenerationCount}/${MAX_REGENERATIONS}) with fix: ${fixGuidance}`);
        } else {
          console.log(`[PIPELINE] Regenerating (${regenerationCount}/${MAX_REGENERATIONS}) - no specific fix guidance`);
        }
        
        continue;
      }

      break;
    }

    // ─── BUILD FINAL RESPONSE ───
    const finalText = state.validatedOutput?.text ?? state.generation?.text ?? '';

    return {
      status: 'success',
      response: finalText,
      stance: state.stance,
      gateResults: state.gateResults,
      metadata: {
        requestId: context.requestId,
        totalTimeMs: Date.now() - pipelineStart,
        regenerations: regenerationCount,
      },
    };
  }

  getAvailableProviders(): string[] {
    return this.providerManager.getAvailableProviders();
  }
}
