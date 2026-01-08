// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION PIPELINE — Gate Orchestration
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  PipelineResult,
  ShieldResult,
} from '../types/index.js';

import {
  executeIntentGateAsync,
  executeToolsGate,
  executeStanceGateAsync,
  executeCapabilityGate,
  executeResponseGateAsync,
  executeConstitutionGateAsync,
  executeMemoryGateAsync,
  buildRegenerationMessage,
  type ConstitutionGateOutput,
} from '../gates/index.js';

// Import async shield gate
import { executeShieldGateAsync } from '../gates/shield_gate/index.js';

import { isOpenAIAvailable } from './llm_engine.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const MAX_REGENERATIONS = 2;

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

export interface PipelineConfig {
  // Reserved for future configuration options
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class ExecutionPipeline {
  constructor(_config: PipelineConfig = {}) {
    // Gates now call llm_engine directly, no setup needed here
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
      shieldBypassed: context.shieldBypassed, // Pass through bypass flag
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

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 2: SHIELD (Protection Layer) — Now Async with Service
    // ═══════════════════════════════════════════════════════════════════════════
    // Shield evaluates safety signals:
    // - NONE/LOW: Skip (no intervention)
    // - MEDIUM: Block pipeline, return warning (user must confirm to continue)
    // - HIGH: Crisis (pipeline halts, no response generated)
    // 
    // If context.shieldBypassed=true, Shield Gate skips evaluation
    
    state.gateResults.shield = await executeShieldGateAsync(state, context);
    state.shieldResult = state.gateResults.shield.output;

    // ═══════════════════════════════════════════════════════════════════════════
    // CHECK FOR SHIELD BLOCK — High signal, active crisis, OR medium warning
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (state.gateResults.shield.action === 'halt') {
      const shieldOutput = state.shieldResult;
      
      // ─────────────────────────────────────────────────────────────────────────
      // MEDIUM BLOCK — Return warning message, user must confirm to continue
      // ─────────────────────────────────────────────────────────────────────────
      if (shieldOutput.action === 'warn') {
        console.log(`[PIPELINE] Shield BLOCK: warn (medium signal)`);
        
        const shieldData: ShieldResult = {
          action: 'warn',
          warningMessage: shieldOutput.warningMessage,
          riskAssessment: shieldOutput.riskAssessment,
          activationId: shieldOutput.activationId,
        };
        
        return {
          status: 'blocked',
          response: '', // No response for blocked - frontend shows warning
          stance: 'shield',
          shield: shieldData,
          gateResults: state.gateResults,
          metadata: {
            requestId: context.requestId,
            totalTimeMs: Date.now() - pipelineStart,
          },
        };
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // CRISIS BLOCK — High signal or active crisis session
      // ─────────────────────────────────────────────────────────────────────────
      console.log(`[PIPELINE] Shield BLOCK: ${shieldOutput.action} (crisis)`);
      
      const shieldData: ShieldResult = {
        action: 'crisis',
        riskAssessment: shieldOutput.riskAssessment,
        sessionId: shieldOutput.sessionId,
        activationId: shieldOutput.activationId,
        crisisBlocked: shieldOutput.crisisBlocked,
      };
      
      return {
        status: 'blocked',
        response: '', // No response for crisis - frontend shows crisis UI
        stance: 'shield',
        shield: shieldData,
        gateResults: state.gateResults,
        metadata: {
          requestId: context.requestId,
          totalTimeMs: Date.now() - pipelineStart,
        },
      };
    }

    // ─── STAGE 3: TOOLS (Router) ───
    state.gateResults.tools = executeToolsGate(state, context);
    state.toolsResult = state.gateResults.tools.output;

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 4: STANCE (Router) — LLM Classification + Redirect
    // ═══════════════════════════════════════════════════════════════════════════
    // When learning_intent=true AND stance=SWORD:
    // 1. Fetches user's lesson plans from Supabase
    // 2. Uses LLM to classify: designer (new plan) vs runner (existing plan)
    // 3. Returns action='redirect' to short-circuit the pipeline
    
    state.gateResults.stance = await executeStanceGateAsync(state, context);
    state.stanceResult = state.gateResults.stance.output;
    state.stance = state.stanceResult.route as any;

    // ═══════════════════════════════════════════════════════════════════════════
    // CHECK FOR REDIRECT — Skip remaining gates, return immediately
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (state.gateResults.stance.action === 'redirect') {
      console.log(`[PIPELINE] Redirect to SwordGate: ${state.stanceResult.redirect?.mode}`);
      
      return {
        status: 'redirect',
        response: '', // No response generated - frontend navigates to SwordGate
        stance: 'sword',
        redirect: state.stanceResult.redirect,
        gateResults: state.gateResults,
        metadata: {
          requestId: context.requestId,
          totalTimeMs: Date.now() - pipelineStart,
        },
      };
    }

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
        context
      );
      state.generation = state.gateResults.model.output;

      // ─── STAGE 7: CONSTITUTION (Constitutional Check) ───
      state.gateResults.constitution = await executeConstitutionGateAsync(
        state,
        context
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

    // ─── STAGE 8: MEMORY (Memory Detection and Storage) ───
    state.gateResults.memory = await executeMemoryGateAsync(
      state,
      context
    );

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

  /**
   * Get available LLM providers.
   */
  getAvailableProviders(): string[] {
    return isOpenAIAvailable() ? ['openai'] : [];
  }
}
