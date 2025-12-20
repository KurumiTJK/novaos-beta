// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION PIPELINE — Gate Orchestration
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  PipelineResult,
  GateResults,
  Stance,
  GenerationConstraints,
  Generation,
} from '../types/index.js';

import {
  executeIntentGate,
  executeIntentGateAsync,
  executeShieldGate,
  executeLensGate,
  executeLensGateAsync,  // ← NEW: Import async Lens gate
  executeStanceGate,
  executeCapabilityGate,
  executeModelGate,
  executeModelGateAsync,
  executePersonalityGate,
  executeSparkGate,
  buildModelConstraints,
} from '../gates/index.js';

import { 
  ProviderManager, 
  NOVA_SYSTEM_PROMPT,
  type ProviderManagerConfig 
} from '../providers/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const MAX_REGENERATIONS = 2;
const PIPELINE_TIMEOUT_MS = 30000;

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

export interface PipelineConfig extends ProviderManagerConfig {
  useMockProvider?: boolean;
  systemPrompt?: string;
  enableLensSearch?: boolean;  // ← NEW: Option to enable/disable Lens search
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class ExecutionPipeline {
  private providerManager: ProviderManager | null = null;
  private useMock: boolean;
  private systemPrompt: string;
  private enableLensSearch: boolean;  // ← NEW

  constructor(config: PipelineConfig = {}) {
    this.systemPrompt = config.systemPrompt ?? NOVA_SYSTEM_PROMPT;
    this.enableLensSearch = config.enableLensSearch ?? true;
    
    // Determine mock mode:
    // - If explicitly set in config, use that
    // - If API keys provided in config, use real mode
    // - Otherwise default to mock (safe for tests)
    const hasConfigKeys = !!(config.openaiApiKey || config.geminiApiKey);
    
    if (config.useMockProvider !== undefined) {
      this.useMock = config.useMockProvider;
    } else if (hasConfigKeys) {
      this.useMock = false;  // Config provided keys → use real mode
    } else {
      this.useMock = true;   // No config keys → default to mock (safe for tests)
    }

    // Initialize provider manager if not using mock
    if (!this.useMock) {
      this.providerManager = new ProviderManager({
        openaiApiKey: config.openaiApiKey,
        geminiApiKey: config.geminiApiKey,
        preferredProvider: config.preferredProvider,
        enableFallback: config.enableFallback ?? true,
      });
    }
  }

  async execute(
    userMessage: string,
    context: PipelineContext
  ): Promise<PipelineResult> {
    const pipelineStart = Date.now();
    const requestId = context.requestId ?? crypto.randomUUID();

    // Initialize state
    const state: PipelineState = {
      userMessage,
      normalizedInput: userMessage.trim(),
      gateResults: {} as GateResults,
      flags: {},
      timestamps: {
        pipelineStart: Date.now(),
      },
    };

    try {
      return await this.executePipeline(state, { ...context, requestId });
    } catch (error) {
      console.error('[PIPELINE] Error:', error);
      return {
        status: 'error',
        response: 'An error occurred processing your request. Please try again.',
        stance: 'shield',
        gateResults: state.gateResults,
        metadata: {
          requestId,
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

    // ─── STAGE 1: INTENT (ASYNC - LLM POWERED) ───
    state.gateResults.intent = await executeIntentGateAsync(state, context);
    state.intent = state.gateResults.intent.output;

    // ─── STAGE 2: SHIELD (ASYNC - LLM POWERED) ───
    state.gateResults.shield = await executeShieldGate(state, context);
    state.shieldResult = state.gateResults.shield.output;

    // Check for hard veto (stop immediately)
    if (state.gateResults.shield.action === 'stop') {
      state.stance = state.shieldResult.controlMode ? 'control' : 'shield';
      return {
        status: 'stopped',
        response: state.shieldResult.message ?? 'Request cannot be processed.',
        stance: state.stance,
        gateResults: state.gateResults,
        metadata: {
          requestId: context.requestId,
          totalTimeMs: Date.now() - pipelineStart,
        },
      };
    }

    // Check for soft veto (await acknowledgment)
    if (state.gateResults.shield.action === 'await_ack') {
      // Check if ack token provided
      if (context.ackTokenValid) {
        state.flags.ackTokenValid = true;
        // Continue with pipeline
      } else {
        state.stance = 'shield';
        return {
          status: 'await_ack',
          response: state.shieldResult.message ?? 'Acknowledgment required.',
          stance: 'shield',
          gateResults: state.gateResults,
          ackToken: state.shieldResult.ackToken,
          ackMessage: 'Please acknowledge to proceed with this high-stakes request.',
          metadata: {
            requestId: context.requestId,
            totalTimeMs: Date.now() - pipelineStart,
          },
        };
      }
    }

    // ─── STAGE 3: LENS (ASYNC - LLM POWERED WITH TIERED VERIFICATION) ───
    // Use async LLM-powered Lens gate only when:
    // 1. Not in mock mode
    // 2. Provider manager is available (has API keys)
    // 3. OpenAI key is available (for LLM classification)
    // 4. Lens search is enabled
    const shouldUseAsyncLens = !this.useMock && 
                               this.providerManager !== null &&
                               !!process.env.OPENAI_API_KEY && 
                               this.enableLensSearch !== false;
    
    if (shouldUseAsyncLens) {
      try {
        state.gateResults.lens = await executeLensGateAsync(state, context, {
          enableSearch: this.enableLensSearch,
        });
        state.lensResult = state.gateResults.lens.output;
      } catch (lensError) {
        console.error('[PIPELINE] Lens gate error, falling back to sync:', lensError);
        state.gateResults.lens = executeLensGate(state, context);
        state.lensResult = state.gateResults.lens.output;
      }
    } else {
      // Use sync Lens gate (pattern-based detection)
      state.gateResults.lens = executeLensGate(state, context);
      state.lensResult = state.gateResults.lens.output;
    }

    // ─── STAGE 4: STANCE ───
    state.gateResults.stance = executeStanceGate(state, context);
    state.stance = state.gateResults.stance.output.stance;

    // ─── STAGE 5: CAPABILITY ───
    state.gateResults.capability = executeCapabilityGate(state, context);
    state.capabilities = state.gateResults.capability.output;

    // ─── STAGE 6-7: GENERATION LOOP ───
    let regenerationCount = 0;

    // ─── INJECT LENS EVIDENCE INTO PROMPT ───
    // If we have verified evidence from live data providers, inject it into the prompt
    let augmentedMessage = state.userMessage;
    const lensResult = state.lensResult as any;
    
    // DEBUG: Log what we have in lensResult
    console.log(`[PIPELINE] lensResult keys:`, lensResult ? Object.keys(lensResult) : 'null');
    console.log(`[PIPELINE] lensResult.fetchResults:`, lensResult?.fetchResults ? `${lensResult.fetchResults.length} items` : 'undefined');
    console.log(`[PIPELINE] lensResult.evidence:`, lensResult?.evidence ? 'present' : 'undefined');
    console.log(`[PIPELINE] lensResult.retrieval:`, lensResult?.retrieval ? JSON.stringify(lensResult.retrieval).slice(0, 200) : 'undefined');
    
    // Check multiple possible evidence structures from Lens gate
    let evidenceContext = '';
    
    // Structure 1: Direct fetchResults from orchestrator
    if (lensResult?.fetchResults?.length > 0) {
      const successfulFetches = lensResult.fetchResults.filter((f: any) => f.result?.ok);
      if (successfulFetches.length > 0) {
        const evidenceLines = successfulFetches.map((fetch: any) => {
          const data = fetch.result.data;
          if (!data) return null;
          
          // Format based on data type
          if (data.type === 'stock') {
            return `LIVE STOCK DATA for ${data.symbol}:\n` +
                   `• Current Price: $${data.price.toFixed(2)} ${data.currency}\n` +
                   `• Change: ${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)\n` +
                   `• Day Range: $${data.dayLow.toFixed(2)} - $${data.dayHigh.toFixed(2)}\n` +
                   `• Previous Close: $${data.previousClose.toFixed(2)}\n` +
                   `• Exchange: ${data.exchange}\n` +
                   `• Data Source: ${fetch.result.provider} (fetched just now)`;
          } else if (data.type === 'weather') {
            return `LIVE WEATHER DATA for ${data.location}:\n` +
                   `• Temperature: ${data.temperature}°${data.unit}\n` +
                   `• Conditions: ${data.conditions}\n` +
                   `• Humidity: ${data.humidity}%\n` +
                   `• Data Source: ${fetch.result.provider}`;
          } else if (data.type === 'crypto') {
            return `LIVE CRYPTO DATA for ${data.symbol}:\n` +
                   `• Current Price: $${data.price.toFixed(2)}\n` +
                   `• 24h Change: ${data.changePercent24h >= 0 ? '+' : ''}${data.changePercent24h.toFixed(2)}%\n` +
                   `• Market Cap: $${(data.marketCap / 1e9).toFixed(2)}B\n` +
                   `• Data Source: ${fetch.result.provider}`;
          } else if (data.type === 'fx') {
            return `LIVE EXCHANGE RATE:\n` +
                   `• ${data.from}/${data.to}: ${data.rate.toFixed(4)}\n` +
                   `• Data Source: ${fetch.result.provider}`;
          } else if (data.type === 'time') {
            return `CURRENT TIME in ${data.timezone}:\n` +
                   `• ${data.formatted}\n` +
                   `• Data Source: system clock`;
          }
          
          // Generic fallback
          return `LIVE DATA:\n${JSON.stringify(data, null, 2)}`;
        }).filter(Boolean);
        
        if (evidenceLines.length > 0) {
          evidenceContext = evidenceLines.join('\n\n');
        }
      }
    }
    
    // Structure 2: evidencePack.items (legacy format)
    else if (lensResult?.evidencePack?.items?.length > 0) {
      const evidenceItems = lensResult.evidencePack.items;
      const evidenceLines = evidenceItems
        .slice(0, 5)
        .map((item: any, i: number) => {
          const content = item.excerpt || item.snippet || '';
          if (!content || content.length < 10) return null;
          return `[Source ${i + 1}: ${item.title || item.url}]\n${content}`;
        })
        .filter(Boolean);
      
      if (evidenceLines.length > 0) {
        evidenceContext = evidenceLines.join('\n\n');
      }
    }
    
    // Structure 3: evidence.formattedContext (alternative format)
    else if (lensResult?.evidence?.formattedContext) {
      evidenceContext = lensResult.evidence.formattedContext;
    }
    
    // Inject evidence into the prompt if we have any
    if (evidenceContext) {
      augmentedMessage = `IMPORTANT INSTRUCTION: You have access to LIVE, REAL-TIME data that was just retrieved. You MUST use this data to answer the user's question. Do NOT say you cannot provide real-time information - the verified data is provided below.

===== VERIFIED LIVE DATA =====
${evidenceContext}
===== END LIVE DATA =====

USER QUESTION: ${state.userMessage}

Remember: Use the live data above to give a specific, accurate answer. Include the actual numbers from the data.`;
      
      console.log(`[PIPELINE] Injected live data evidence into prompt`);
    }

    while (regenerationCount <= MAX_REGENERATIONS) {
      // ─── STAGE 6: MODEL ───
      if (this.useMock || !this.providerManager) {
        state.gateResults.model = executeModelGate(state, context);
      } else {
        state.gateResults.model = await executeModelGateAsync(
          state,
          context,
          (prompt, systemPrompt, constraints) => 
            this.providerManager!.generate(augmentedMessage, systemPrompt, constraints, {
              conversationHistory: context.conversationHistory ? [...context.conversationHistory] : undefined,
            }),
          this.systemPrompt
        );
      }
      state.generation = state.gateResults.model.output;

      // ─── STAGE 7: PERSONALITY ───
      state.gateResults.personality = executePersonalityGate(state, context);
      state.validatedOutput = state.gateResults.personality.output;

      // Check if regeneration needed
      if (
        state.gateResults.personality.action === 'regenerate' &&
        regenerationCount < MAX_REGENERATIONS
      ) {
        regenerationCount++;
        state.flags.regenerationAttempt = regenerationCount;
        continue;
      }

      break;
    }

    // ─── STAGE 8: SPARK ───
    state.gateResults.spark = executeSparkGate(state, context);
    if (state.gateResults.spark.output.spark) {
      state.spark = state.gateResults.spark.output.spark;
    }

    // ─── BUILD FINAL RESPONSE ───
    const finalText = state.validatedOutput?.text ?? state.generation?.text ?? '';

    // Check degradation
    if (state.lensResult?.status === 'degraded') {
      return {
        status: 'degraded',
        response: finalText,
        stance: state.stance,
        gateResults: state.gateResults,
        spark: state.spark,
        metadata: {
          requestId: context.requestId,
          totalTimeMs: Date.now() - pipelineStart,
          regenerations: regenerationCount,
          degradationReason: state.lensResult.message 
            ?? `Unverified ${state.lensResult.domain ?? 'information'}`,
        },
      };
    }

    return {
      status: 'success',
      response: finalText,
      stance: state.stance,
      gateResults: state.gateResults,
      spark: state.spark,
      metadata: {
        requestId: context.requestId,
        totalTimeMs: Date.now() - pipelineStart,
        regenerations: regenerationCount,
      },
    };
  }

  getAvailableProviders(): string[] {
    return this.providerManager?.getAvailableProviders() ?? ['mock'];
  }
}
