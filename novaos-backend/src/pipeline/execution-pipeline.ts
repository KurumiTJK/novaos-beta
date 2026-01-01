// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION PIPELINE — Gate Orchestration
// PATCHED: Integrated new Capability Gate with LLM selector
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  PipelineResult,
  GateResults,
  Stance,
  GenerationConstraints,
  Generation,
  IntentSummary,
} from '../types/index.js';

import {
  executeIntentGate,
  executeIntentGateAsync,
  executeShieldGate,
  executeLensGate,
  executeLensGateAsync,
  executeStanceGateAsync,
  // REMOVED: executeCapabilityGate (old sync version)
  executeModelGate,
  executeModelGateAsync,
  executePersonalityGate,
  executePersonalityGateAsync,
  buildRegenerationMessage,
  executeSparkGate,
  buildModelConstraints,
  type PersonalityGateOutput,
  type IntentSummary,
} from '../gates/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// NEW: CAPABILITY GATE IMPORTS
// ─────────────────────────────────────────────────────────────────────────────────

import {
  executeCapabilityGateAsync,
  initializeCapabilityGate,
  setSelectorConfig,
  type CapabilityGateOutput,
} from '../gates/capability/index.js';

import { 
  ProviderManager, 
  type ProviderManagerConfig 
} from '../providers/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SWORDGATE IMPORTS — Phase 13 Integration
// ─────────────────────────────────────────────────────────────────────────────────

import { SwordGate, type SwordGateOutput } from '../gates/sword/index.js';
import type { IResourceDiscoveryService } from '../gates/sword/lesson-plan-generator.js';
import type { IRefinementStore, RefinementState } from '../services/spark-engine/store/types.js';
import type { TopicId } from '../services/spark-engine/resource-discovery/types.js';
import type { UserId, Timestamp } from '../types/branded.js';
import { createUserId, createTimestamp } from '../types/branded.js';
import { ok, err, type AsyncAppResult } from '../types/result.js';

// Phase 14A: Import ExploreStore for session checking
import { ExploreStore, createExploreStore } from '../gates/sword/explore/explore-store.js';
import type { ExploreState } from '../gates/sword/explore/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SPARKENGINE BOOTSTRAP — Complete Wiring
// ─────────────────────────────────────────────────────────────────────────────────

import { storeManager } from '../storage/index.js';
import type { ISparkEngine } from '../services/spark-engine/index.js';
import { 
  bootstrapSparkEngine,
  bootstrapSparkEngineAsync,
  type SparkEngineBootstrapResult,
  type SparkEngineConfig,
} from '../services/spark-engine/spark-engine-bootstrap.js';
import type { Redis } from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 18: DELIBERATE PRACTICE ENGINE IMPORTS
// ═══════════════════════════════════════════════════════════════════════════════

import type { IDeliberatePracticeEngine } from '../services/deliberate-practice-engine/interfaces.js';
import { createDeliberatePracticeStores } from '../services/deliberate-practice-engine/store/index.js';
import { createDeliberatePracticeEngine } from '../services/deliberate-practice-engine/deliberate-practice-engine.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const MAX_REGENERATIONS = 2;
const PIPELINE_TIMEOUT_MS = 30000;

// ─────────────────────────────────────────────────────────────────────────────────
// IN-MEMORY REFINEMENT STORE — Lightweight store for SwordGate
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Simple in-memory refinement store for SwordGate.
 * For production, replace with Redis-backed RefinementStore.
 */
class InMemoryRefinementStore implements IRefinementStore {
  private states = new Map<string, RefinementState>();

  async save(state: RefinementState): AsyncAppResult<RefinementState> {
    this.states.set(state.userId, state);
    return ok(state);
  }

  async get(userId: UserId): AsyncAppResult<RefinementState | null> {
    const state = this.states.get(userId) ?? null;
    
    // Check expiration
    if (state && new Date(state.expiresAt).getTime() < Date.now()) {
      this.states.delete(userId);
      return ok(null);
    }
    
    return ok(state);
  }

  async delete(userId: UserId): AsyncAppResult<boolean> {
    const existed = this.states.has(userId);
    this.states.delete(userId);
    return ok(existed);
  }

  async update(
    userId: UserId,
    updates: Partial<RefinementState>
  ): AsyncAppResult<RefinementState> {
    const existing = this.states.get(userId);
    if (!existing) {
      return err({
        code: 'NOT_FOUND',
        message: 'No refinement state found for user',
      });
    }
    
    const updated: RefinementState = {
      ...existing,
      ...updates,
      updatedAt: createTimestamp(),
    };
    this.states.set(userId, updated);
    return ok(updated);
  }

  async advanceStage(userId: UserId): AsyncAppResult<RefinementState> {
    const existing = this.states.get(userId);
    if (!existing) {
      return err({
        code: 'NOT_FOUND',
        message: 'No refinement state found for user',
      });
    }
    
    const stageOrder: RefinementState['stage'][] = ['initial', 'clarifying', 'confirming', 'complete'];
    const currentIndex = stageOrder.indexOf(existing.stage);
    const nextStage = stageOrder[currentIndex + 1] ?? 'complete';
    
    return this.update(userId, { stage: nextStage });
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

export interface PipelineConfig extends ProviderManagerConfig {
  useMockProvider?: boolean;
  enableSwordGate?: boolean;  // ← Option to enable/disable SwordGate
  
  // Full mode options (Phase 17)
  enableFullStepGenerator?: boolean;  // ← Enable LLM-based curriculum generation
  redis?: Redis;                       // ← Redis instance for full mode
  sparkEngineConfig?: Partial<SparkEngineConfig>;  // ← Additional SparkEngine config
  
  // Phase 18: Deliberate Practice Engine
  enableDeliberatePractice?: boolean;  // ← Enable Deliberate Practice Engine
  
  // Model configuration
  responseModel?: string;              // ← Model for response generation (default: gpt-4o-mini)
  capabilitySelectorModel?: string;    // ← Model for capability selector (default: gpt-4o-mini)
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class ExecutionPipeline {
  private providerManager: ProviderManager | null = null;
  private useMock: boolean;
  private enableSwordGate: boolean;
  
  // SwordGate components (lazy initialized)
  private swordGate: SwordGate | null = null;
  private refinementStore: IRefinementStore | null = null;
  private exploreStore: ExploreStore | null = null;
  
  // SparkEngine bootstrap result (lazy initialized)
  private sparkEngineBootstrap: SparkEngineBootstrapResult | null = null;
  
  // Full mode support (Phase 17)
  private enableFullStepGenerator: boolean;
  private fullModeInitialized: boolean = false;
  private redis?: Redis;
  private sparkEngineConfig?: Partial<SparkEngineConfig>;

  // Phase 18: Deliberate Practice Engine
  private enableDeliberatePractice: boolean;
  private practiceEngine: IDeliberatePracticeEngine | null = null;

  constructor(config: PipelineConfig = {}) {
    this.enableSwordGate = config.enableSwordGate ?? true;  // ← Enabled by default
    
    // Full mode config (Phase 17)
    this.enableFullStepGenerator = config.enableFullStepGenerator ?? false;
    this.redis = config.redis;
    this.sparkEngineConfig = config.sparkEngineConfig;
    
    // Phase 18: Deliberate Practice config
    this.enableDeliberatePractice = config.enableDeliberatePractice ?? true;
    
    // Determine mock mode
    const hasConfigKeys = !!(config.openaiApiKey || config.geminiApiKey);
    
    if (config.useMockProvider !== undefined) {
      this.useMock = config.useMockProvider;
    } else if (hasConfigKeys) {
      this.useMock = false;
    } else {
      this.useMock = true;
    }

    // Initialize provider manager if not using mock
    if (!this.useMock) {
      this.providerManager = new ProviderManager({
        openaiApiKey: config.openaiApiKey,
        geminiApiKey: config.geminiApiKey,
        preferredProvider: config.preferredProvider,
        enableFallback: config.enableFallback ?? true,
        responseModel: config.responseModel,  // ← Pass responseModel to provider
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initialize Capability Gate
    // ─────────────────────────────────────────────────────────────────────────────
    initializeCapabilityGate();
    
    // Configure selector model if specified
    if (config.capabilitySelectorModel) {
      setSelectorConfig({ model: config.capabilitySelectorModel });
    }
  }
  
  /**
   * Initialize full mode with LLM-based StepGenerator.
   * 
   * This enables:
   * - CurriculumLLMAdapter for dynamic curriculum generation
   * - ResourceDiscoveryOrchestrator for finding learning resources
   * - Full TopicTaxonomy with inference
   * - Phase 18: Deliberate Practice Engine
   * 
   * Requirements:
   * - ProviderManager must be configured (not mock mode)
   * - Redis must be provided for resource caching
   * 
   * Call this BEFORE execute() if you want full mode.
   */
  async initializeFullMode(): Promise<void> {
    if (!this.enableFullStepGenerator) {
      console.log('[PIPELINE] Full mode not enabled in config, skipping');
      return;
    }
    
    if (this.fullModeInitialized) {
      console.log('[PIPELINE] Full mode already initialized');
      return;
    }
    
    if (this.useMock || !this.providerManager) {
      console.warn('[PIPELINE] Full mode requires real LLM provider. Configure openaiApiKey or geminiApiKey.');
      return;
    }
    
    console.log('[PIPELINE] Initializing full StepGenerator mode...');
    
    const kvStore = storeManager.getStore();
    
    this.sparkEngineBootstrap = await bootstrapSparkEngineAsync(
      kvStore,
      this.redis ?? null,
      this.providerManager,
      {
        encryptionEnabled: true,
        useStubStepGenerator: false, // Full mode
        useStubReminderService: true, // Reminders still stubbed
        ...this.sparkEngineConfig,
      }
    );
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 18: INITIALIZE DELIBERATE PRACTICE ENGINE
    // ═══════════════════════════════════════════════════════════════════════════
    if (this.enableDeliberatePractice) {
      try {
        console.log('[PIPELINE] Initializing Deliberate Practice Engine...');
        
        // Create practice stores
        const practiceStores = createDeliberatePracticeStores(kvStore, {
          encryptionEnabled: true,
        });
        
        // Create practice engine
        this.practiceEngine = createDeliberatePracticeEngine({
          stores: practiceStores,
          config: {
            dailyMinutes: 30,
            userLevel: 'intermediate',
            timezone: 'UTC',
            openaiApiKey: process.env.OPENAI_API_KEY,
            useLLM: true,
          },
        });
        
        console.log('[PIPELINE] Deliberate Practice Engine initialized');
      } catch (practiceError) {
        console.error('[PIPELINE] Failed to initialize Deliberate Practice Engine:', practiceError);
        // Continue without practice engine - it's optional
      }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    
    this.fullModeInitialized = true;
    
    console.log('[PIPELINE] Full mode initialized:', this.sparkEngineBootstrap.status);
  }

  /**
   * Get the Deliberate Practice Engine instance.
   * Returns null if not initialized.
   */
  getPracticeEngine(): IDeliberatePracticeEngine | null {
    return this.practiceEngine;
  }

  /**
   * Lazy initialization of SparkEngine via bootstrap.
   * 
   * If enableFullStepGenerator is true and initializeFullMode() was called,
   * returns the full SparkEngine. Otherwise returns stub SparkEngine.
   */
  private getSparkEngine(): ISparkEngine {
    // Check if full mode was requested but not initialized
    if (this.enableFullStepGenerator && !this.fullModeInitialized) {
      console.warn(
        '[PIPELINE] Full StepGenerator mode requested but initializeFullMode() not called. ' +
        'Falling back to stub mode. Call await pipeline.initializeFullMode() first.'
      );
    }
    
    if (!this.sparkEngineBootstrap) {
      console.log('[PIPELINE] Bootstrapping SparkEngine (stub mode)...');
      
      // Get the underlying KeyValueStore from the global storeManager
      const kvStore = storeManager.getStore();
      
      // Bootstrap SparkEngine with all dependencies
      this.sparkEngineBootstrap = bootstrapSparkEngine(kvStore, {
        encryptionEnabled: true,
        useStubStepGenerator: true,
        useStubReminderService: true,
      });
      
      console.log('[PIPELINE] SparkEngine bootstrapped:', this.sparkEngineBootstrap.status);
    }
    return this.sparkEngineBootstrap.sparkEngine;
  }

  /**
   * Lazy initialization of SwordGate.
   * Creates the gate on first use with full SparkEngine wiring.
   */
  private getSwordGate(): SwordGate {
    if (!this.swordGate) {
      // Create in-memory refinement store if it doesn't exist
      // ★ FIX: Don't overwrite if already created by checkActive* methods
      if (!this.refinementStore) {
        this.refinementStore = new InMemoryRefinementStore();
      }
      
      // Get or create SparkEngine via bootstrap
      const sparkEngine = this.getSparkEngine();
      
      // Create resource service adapter if discovery is available
      const resourceService = this.createResourceServiceAdapter();
      
      if (resourceService) {
        console.log('[PIPELINE] Resource service adapter created for SwordGate');
      } else {
        console.warn('[PIPELINE] No resource discovery available - SwordGate will use fallback');
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 18: Initialize SwordGate with Deliberate Practice Engine
      // ═══════════════════════════════════════════════════════════════════════════
      this.swordGate = new SwordGate(
        this.refinementStore,
        {
          useLlmModeDetection: !this.useMock && !!process.env.OPENAI_API_KEY,
        },
        {
          sparkEngine,
          openaiApiKey: process.env.OPENAI_API_KEY,
          resourceService,  // ← Pass resource discovery!
          practiceEngine: this.practiceEngine ?? undefined,  // ← Phase 18: Pass practice engine!
        }
      );
      
      console.log('[PIPELINE] SwordGate initialized with SparkEngine' + 
        (this.practiceEngine ? ' and Deliberate Practice Engine' : ''));
    }
    return this.swordGate;
  }

  /**
   * Create adapter to bridge ResourceDiscoveryOrchestrator to IResourceDiscoveryService.
   * This allows SwordGate's LessonPlanGenerator to use the full resource discovery system.
   */
  private createResourceServiceAdapter(): IResourceDiscoveryService | undefined {
    if (!this.sparkEngineBootstrap?.resourceDiscovery) {
      console.log('[PIPELINE] No resourceDiscovery in bootstrap - adapter unavailable');
      return undefined;
    }

    const orchestrator = this.sparkEngineBootstrap.resourceDiscovery;
    console.log('[PIPELINE] Creating resource service adapter from orchestrator');

    return {
      async discover(request) {
        try {
          console.log('[RESOURCE_ADAPTER] Discovering resources for topics:', request.topics);
          if (request.keywords?.length) {
            console.log('[RESOURCE_ADAPTER] With keywords:', request.keywords);
          }
          
          const result = await orchestrator.discover({
            topics: request.topics as TopicId[],
            keywords: request.keywords as string[] | undefined,
            maxResults: request.maxResults ?? 50,
            includeTypes: request.contentTypes as any[],
          });

          if (!result.ok) {
            console.error('[RESOURCE_ADAPTER] Discovery failed:', result.error);
            return result as any;
          }

          const resources = result.value.resources;
          console.log(`[RESOURCE_ADAPTER] Found ${resources.length} resources`);

          return {
            ok: true,
            value: {
              resources: resources.map(r => ({
                id: r.id,
                title: r.title,
                url: r.displayUrl,
                canonicalUrl: r.canonicalUrl,
                provider: r.providerId ?? 'unknown',
                contentType: r.contentType,
                topics: Array.isArray(r.topicIds) ? [...r.topicIds] as string[] : [],
                estimatedMinutes: r.estimatedMinutes,
                difficulty: r.difficulty,
                quality: r.qualitySignals ? { score: r.qualitySignals.composite } : undefined,
              })),
              topicsCovered: resources
                .flatMap(r => Array.isArray(r.topicIds) ? [...r.topicIds] as string[] : [])
                .filter((v, i, a) => a.indexOf(v) === i),
              gaps: [],
            },
          };
        } catch (error) {
          console.error('[RESOURCE_ADAPTER] Discovery error:', error);
          return {
            ok: false,
            error: {
              code: 'DISCOVERY_FAILED',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },
    };
  }

  /**
   * Check if user has an active sword session (explore OR refinement).
   * This is used to route follow-up messages back to SwordGate
   * even if they don't match the initial learning intent pattern.
   */
  private async checkActiveSwordSession(userId: string): Promise<boolean> {
    // Check for active explore session first
    const hasExplore = await this.checkActiveExplore(userId);
    if (hasExplore) {
      return true;
    }
    
    // Then check for active refinement session
    return this.checkActiveRefinement(userId);
  }

  /**
   * Check if user has an active explore session.
   */
  private async checkActiveExplore(userId: string): Promise<boolean> {
    // Ensure stores are initialized
    if (!this.refinementStore) {
      this.refinementStore = new InMemoryRefinementStore();
    }
    
    // Lazily create explore store (same backing store as refinement)
    if (!this.exploreStore) {
      this.exploreStore = createExploreStore(this.refinementStore, {
        maxTurns: 10,
        exploreTtlSeconds: 3600,
      });
    }
    
    try {
      const result = await this.exploreStore.get(userId as UserId);
      
      if (result.ok && result.value !== null) {
        const exploreState = result.value;
        // Check if explore is not in terminal state
        const isTerminal = exploreState.stage === 'confirmed' || exploreState.stage === 'skipped';
        
        if (!isTerminal) {
          console.log(`[PIPELINE] Active explore session found for user ${userId}, stage: ${exploreState.stage}`);
          return true;
        } else {
          console.log(`[PIPELINE] Explore session is terminal for user ${userId}, stage: ${exploreState.stage}`);
        }
      } else {
        console.log(`[PIPELINE] No explore session found for user ${userId}`);
      }
      
      return false;
    } catch (error) {
      console.error(`[PIPELINE] Error checking explore state for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Check if user has an active refinement session.
   * This is used to route follow-up messages back to SwordGate
   * even if they don't match the initial learning intent pattern.
   */
  private async checkActiveRefinement(userId: string): Promise<boolean> {
    // Ensure refinement store is initialized
    if (!this.refinementStore) {
      // Initialize lazily if needed
      this.refinementStore = new InMemoryRefinementStore();
    }
    
    try {
      const result = await this.refinementStore.get(userId as UserId);
      const hasActive = result.ok && result.value !== null;
      
      if (hasActive) {
        console.log(`[PIPELINE] Active refinement found for user ${userId}, stage: ${result.value?.stage}`);
      }
      
      return hasActive;
    } catch (error) {
      console.error('[PIPELINE] Error checking refinement state:', error);
      return false;
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
    state.intent_summary = state.gateResults.intent.output;

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
      if (context.ackTokenValid) {
        state.flags.ackTokenValid = true;
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

    // ─── STAGE 3: LENS (ASYNC - LLM DATA ROUTER) ───
    const shouldUseAsyncLens = !this.useMock && 
                               this.providerManager !== null &&
                               !!process.env.OPENAI_API_KEY;
    
    if (shouldUseAsyncLens) {
      try {
        state.gateResults.lens = await executeLensGateAsync(state, context);
        state.lensResult = state.gateResults.lens.output;
      } catch (lensError) {
        console.error('[PIPELINE] Lens gate error, falling back to sync:', lensError);
        state.gateResults.lens = executeLensGate(state, context);
        state.lensResult = state.gateResults.lens.output;
      }
    } else {
      state.gateResults.lens = executeLensGate(state, context);
      state.lensResult = state.gateResults.lens.output;
    }

    // ─── STAGE 4: STANCE (LLM-POWERED) ───
    // Check for active sword session BEFORE stance classification
    const hasActiveSwordSession = context.userId 
      ? await this.checkActiveSwordSession(context.userId)
      : false;
    
    state.gateResults.stance = await executeStanceGateAsync(state, context, hasActiveSwordSession);
    state.stance = state.gateResults.stance.output.stance;

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 5: CAPABILITY (ASYNC - LLM Selector + Data Fetching) — NEW!
    // ═══════════════════════════════════════════════════════════════════════════
    const shouldUseAsyncCapability = !this.useMock && !!process.env.OPENAI_API_KEY;
    
    if (shouldUseAsyncCapability) {
      try {
        state.gateResults.capability = await executeCapabilityGateAsync(state, context);
        state.capabilities = state.gateResults.capability.output;
        
        const capOutput = state.capabilities as CapabilityGateOutput;
        console.log(`[CAPABILITY] Route: ${capOutput.route}, Used: ${capOutput.capabilitiesUsed.join(', ') || 'none'}`);
        
        if (capOutput.evidenceItems.length > 0) {
          console.log(`[CAPABILITY] Evidence items: ${capOutput.evidenceItems.length}`);
        }
      } catch (capError) {
        console.error('[PIPELINE] Capability gate error:', capError);
        // Fallback: empty capability result
        state.gateResults.capability = {
          gateId: 'capability',
          status: 'soft_fail',
          action: 'continue',
          output: {
            route: 'lens',
            capabilitiesUsed: [],
            evidenceItems: [],
          },
          failureReason: 'Capability gate error',
        };
        state.capabilities = state.gateResults.capability.output;
      }
    } else {
      // Mock mode: skip capability selection
      state.gateResults.capability = {
        gateId: 'capability',
        status: 'pass',
        action: 'continue',
        output: {
          route: state.stance === 'sword' ? 'sword' : 'lens',
          capabilitiesUsed: [],
          evidenceItems: [],
        },
      };
      state.capabilities = state.gateResults.capability.output;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 5.5: SWORDGATE — Route based on stance decision
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // If stance is SWORD, route to SwordGate.
    // The LLM-powered stance gate already considered:
    // - Active sessions (explore/refinement)
    // - Learning intent patterns
    // - Practice queries
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (state.stance === 'sword' && this.enableSwordGate && context.userId) {
      console.log('[PIPELINE] Routing to SwordGate (stance: SWORD)');
      
      try {
        // Build a compatible state object for SwordGate
        const swordCompatibleState = {
          ...state,
          input: {
            userId: context.userId,
            message: state.userMessage,
            sessionId: context.sessionId,
          },
          regenerationCount: 0,
          degraded: false,
        };
        
        const swordGate = this.getSwordGate();
        const swordResult = await swordGate.execute(swordCompatibleState as any, context as any);
        
        const swordOutput = swordResult.output as SwordGateOutput;
        
        // If SwordGate wants to handle the response directly, return early
        if (swordOutput.suppressModelGeneration && swordOutput.responseMessage) {
          console.log(`[PIPELINE] SwordGate mode: ${swordOutput.mode}, suppressing LLM`);
          
          state.gateResults.spark = {
            gateId: 'spark',
            status: swordResult.status,
            output: {
              eligible: true,
              spark: swordOutput.createdGoal ? {
                action: swordOutput.responseMessage,
                rationale: `Goal creation via SwordGate: ${swordOutput.mode}`,
                category: 'immediate' as const,
              } : undefined,
            },
            action: swordResult.action,
            executionTimeMs: swordResult.executionTimeMs,
          };
          
          return {
            status: 'success',
            response: swordOutput.responseMessage,
            stance: 'sword',
            gateResults: state.gateResults,
            metadata: {
              requestId: context.requestId,
              totalTimeMs: Date.now() - pipelineStart,
            },
          };
        }
        
        // Store a compatible spark result for passthrough case
        state.gateResults.spark = {
          gateId: 'spark',
          status: 'pass',
          output: {
            eligible: false,
            ineligibilityReason: 'sword_gate_passthrough',
          },
          action: 'continue',
          executionTimeMs: swordResult.executionTimeMs,
        };
        
        console.log(`[PIPELINE] SwordGate mode: ${swordOutput.mode}, continuing to LLM`);
        
      } catch (swordError) {
        console.error('[PIPELINE] SwordGate error, falling back to normal flow:', swordError);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 6-7: GENERATION LOOP WITH CONSTITUTIONAL CHECK
    // Model Gate (The Stitcher) handles personality, context, evidence.
    // Personality Gate (Constitutional Check) verifies compliance.
    // If violation detected, regenerates with fix guidance.
    // ═══════════════════════════════════════════════════════════════════════════
    let regenerationCount = 0;
    let currentUserMessage = state.userMessage;  // May include fix guidance on regeneration

    while (regenerationCount <= MAX_REGENERATIONS) {
      // ─── STAGE 6: MODEL (The Stitcher) ───
      if (this.useMock || !this.providerManager) {
        state.gateResults.model = executeModelGate(state, context);
      } else {
        // Use currentUserMessage which may include fix guidance
        state.gateResults.model = await executeModelGateAsync(
          { ...state, userMessage: currentUserMessage },
          context,
          (prompt, systemPrompt, constraints) => 
            this.providerManager!.generate(prompt, systemPrompt, constraints, {
              conversationHistory: context.conversationHistory ? [...context.conversationHistory] : undefined,
            })
        );
      }
      state.generation = state.gateResults.model.output;

      // ─── STAGE 7: PERSONALITY (Constitutional Check) ───
      if (this.useMock || !this.providerManager) {
        state.gateResults.personality = executePersonalityGate(state, context);
      } else {
        state.gateResults.personality = await executePersonalityGateAsync(
          state,
          context,
          (prompt, systemPrompt) => 
            this.providerManager!.generate(prompt, systemPrompt, {})
        );
      }
      state.validatedOutput = state.gateResults.personality.output;

      // Check if regeneration needed
      if (
        state.gateResults.personality.action === 'regenerate' &&
        regenerationCount < MAX_REGENERATIONS
      ) {
        regenerationCount++;
        state.flags.regenerationAttempt = regenerationCount;
        
        // Get fix guidance from personality gate output
        const personalityOutput = state.gateResults.personality.output as PersonalityGateOutput;
        const fixGuidance = personalityOutput.fixGuidance;
        
        if (fixGuidance) {
          // Build new message with fix guidance for next iteration
          currentUserMessage = buildRegenerationMessage(state.userMessage, fixGuidance);
          console.log(`[PIPELINE] Regenerating (${regenerationCount}/${MAX_REGENERATIONS}) with fix: ${fixGuidance}`);
        } else {
          console.log(`[PIPELINE] Regenerating (${regenerationCount}/${MAX_REGENERATIONS}) - no specific fix guidance`);
        }
        
        continue;
      }

      break;
    }

    // ─── STAGE 8: SPARK (only if not already handled by SwordGate) ───
    if (!state.gateResults.spark) {
      state.gateResults.spark = executeSparkGate(state, context);
      if (state.gateResults.spark.output.spark) {
        state.spark = state.gateResults.spark.output.spark;
      }
    }

    // ─── BUILD FINAL RESPONSE ───
    const finalText = state.validatedOutput?.text ?? state.generation?.text ?? '';

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
