// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE — Goal Creation Pipeline Gate
// NovaOS Gates — Phase 14A: SwordGate Explore Module
// ═══════════════════════════════════════════════════════════════════════════════
//
// Constitution §2.3: Sword — Forward Motion
//
// SwordGate orchestrates goal creation through:
//   1. Mode Detection — Determine capture/explore/refine/suggest/create/modify
//   2. Goal Exploration — NEW: Dialogue for crystallizing vague goals
//   3. Goal Capture — Extract and sanitize goal statement
//   4. Refinement Flow — Multi-turn clarification conversation
//   5. Plan Generation — Create lesson plan proposal
//   6. Confirmation — User confirms before creation
//   7. Goal Creation — Create goal via SparkEngine
//
// Integration points:
//   - ModeDetector: Classify user intent
//   - ExploreFlow: Goal crystallization dialogue (NEW)
//   - RefinementFlow: Manage multi-turn conversation
//   - SwordRefinementStore: Persist refinement state
//   - ExploreStore: Persist exploration state (NEW)
//   - GoalStatementSanitizer: Validate and sanitize input
//   - LessonPlanGenerator: Generate curriculum proposals
//   - ISparkEngine: Create goals and quests
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { UserId, GoalId } from '../../types/branded.js';
import { createTimestamp, createGoalId } from '../../types/branded.js';
import type { AsyncAppResult, AppError } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  GateId,
  GateStatus,
  GateAction,
} from '../../helpers/types.js';

import type { Goal, Quest, CreateGoalParams } from '../../services/spark-engine/types.js';
import type { ISparkEngine } from '../../services/spark-engine/interfaces.js';
import type { IRefinementStore } from '../../services/spark-engine/store/types.js';

import type {
  SwordGateMode,
  SwordGateInput,
  SwordGateOutput,
  SwordGateConfig,
  SwordRefinementState,
  SwordRefinementInputs,
  LessonPlanProposal,
  GoalRateLimitInfo,
  CreatedGoalResult,
  ExploreContext,
} from './types.js';
import { DEFAULT_SWORD_GATE_CONFIG, hasRequiredFields, getMissingRequiredFields } from './types.js';

import { ModeDetector, createModeDetector } from './mode-detector.js';
import { RefinementFlow, createRefinementFlow } from './refinement-flow.js';
import { SwordRefinementStore, createSwordRefinementStore } from './sword-refinement-store.js';
import { GoalStatementSanitizer, createGoalStatementSanitizer } from './sanitizers.js';
import {
  LessonPlanGenerator,
  createLessonPlanGenerator,
  type IResourceDiscoveryService,
  type ICurriculumService,
} from './lesson-plan-generator.js';

// Phase 14A: Import explore components
import type { ExploreState } from './explore/types.js';
import { buildExploreContext } from './explore/types.js';
import { ExploreStore, createExploreStore } from './explore/explore-store.js';
import { ExploreFlow, createExploreFlow } from './explore/explore-flow.js';
import { ClarityDetector, createClarityDetector } from './explore/clarity-detector.js';

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Interface for goal creation rate limiting.
 */
export interface IGoalRateLimiter {
  /**
   * Check if user can create a new goal.
   */
  canCreateGoal(userId: UserId): AsyncAppResult<GoalRateLimitInfo>;

  /**
   * Record a goal creation.
   */
  recordGoalCreation(userId: UserId): AsyncAppResult<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SwordGate — Goal Creation Pipeline Gate
 *
 * Orchestrates the goal creation flow from initial capture through
 * exploration, refinement, plan generation, and final creation.
 */
export class SwordGate {
  readonly gateId: GateId = 'spark'; // Uses 'spark' gate ID for pipeline compatibility

  private readonly config: SwordGateConfig;
  private readonly modeDetector: ModeDetector;
  private readonly refinementFlow: RefinementFlow;
  private readonly refinementStore: SwordRefinementStore;
  private readonly sanitizer: GoalStatementSanitizer;
  private readonly planGenerator: LessonPlanGenerator;
  private readonly sparkEngine?: ISparkEngine;
  private readonly rateLimiter?: IGoalRateLimiter;

  // Phase 14A: Explore components
  private readonly exploreStore: ExploreStore;
  private readonly exploreFlow: ExploreFlow;
  private readonly clarityDetector: ClarityDetector;

  constructor(
    baseRefinementStore: IRefinementStore,
    config: Partial<SwordGateConfig> = {},
    options: {
      sparkEngine?: ISparkEngine;
      rateLimiter?: IGoalRateLimiter;
      resourceService?: IResourceDiscoveryService;
      curriculumService?: ICurriculumService;
      openaiApiKey?: string;
    } = {}
  ) {
    this.config = { ...DEFAULT_SWORD_GATE_CONFIG, ...config };

    // Initialize components
    this.modeDetector = createModeDetector(this.config, options.openaiApiKey);
    this.refinementFlow = createRefinementFlow(this.config);
    this.refinementStore = createSwordRefinementStore(baseRefinementStore, this.config);
    this.sanitizer = createGoalStatementSanitizer(this.config);
    this.planGenerator = createLessonPlanGenerator(
      this.config,
      options.resourceService,
      options.curriculumService
    );

    // Phase 14A: Initialize explore components
    this.exploreStore = createExploreStore(baseRefinementStore, {
      maxTurns: this.config.maxExploreTurns,
      exploreTtlSeconds: this.config.exploreTtlSeconds,
    });
    this.exploreFlow = createExploreFlow({
      maxTurns: this.config.maxExploreTurns,
      clarityThreshold: this.config.exploreClarityThreshold,
    }, options.openaiApiKey);
    this.clarityDetector = createClarityDetector({}, options.openaiApiKey);

    this.sparkEngine = options.sparkEngine;
    this.rateLimiter = options.rateLimiter;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN EXECUTE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute the SwordGate.
   */
  async execute(
    state: PipelineState,
    context: PipelineContext
  ): Promise<GateResult<SwordGateOutput>> {
    const startTime = Date.now();

    try {
      // Build input from pipeline state
      const input = this.buildInput(state, context);

      // Get existing refinement state
      const stateResult = await this.refinementStore.get(input.userId);
      if (!stateResult.ok) {
        return this.gateError('Failed to load refinement state', startTime, stateResult.error);
      }
      const refinementState = stateResult.value;

      // Phase 14A: Get existing explore state
      let exploreState: ExploreState | null = null;
      if (this.config.enableExplore) {
        const exploreResult = await this.exploreStore.get(input.userId);
        if (exploreResult.ok) {
          exploreState = exploreResult.value;
        }
      }

      // Detect mode (Phase 14A: pass explore state)
      const modeResult = await this.modeDetector.detect(input, refinementState, exploreState);
      console.log(`[SWORD_GATE] Mode detected: ${modeResult.mode} (${modeResult.detectionMethod})`);

      // ★ Handle exit command - clear all state and return to normal
      if (modeResult.exitSession) {
        return {
          gateId: this.gateId,
          status: 'pass',
          output: await this.handleExitSession(input),
          action: 'continue',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // ★ Handle skip command - advance to next step or create with defaults
      if (modeResult.skipStep) {
        const output = await this.handleSkipStep(input, refinementState, exploreState, modeResult);
        return {
          gateId: this.gateId,
          status: 'pass',
          output,
          action: this.determineAction(output),
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Execute mode-specific handler
      const output = await this.executeMode(input, refinementState, exploreState, modeResult);

      return {
        gateId: this.gateId,
        status: 'pass',
        output,
        action: this.determineAction(output),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[SWORD_GATE] Execution error:', error);
      return this.gateError(
        'SwordGate execution failed',
        startTime,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ★ SESSION CONTROL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle exit command - clear all sword session state.
   */
  private async handleExitSession(input: SwordGateInput): Promise<SwordGateOutput> {
    console.log(`[SWORD_GATE] Exiting session for user ${input.userId}`);

    // Clear explore state
    if (this.config.enableExplore) {
      await this.exploreStore.delete(input.userId);
    }

    // Clear refinement state
    await this.refinementStore.delete(input.userId);

    return {
      mode: 'capture',
      responseMessage: 'No problem! Let me know if you want to create a learning plan later.',
      suppressModelGeneration: false, // Allow normal conversation to continue
    };
  }

  /**
   * Handle skip command - advance to next step or create with defaults.
   */
  private async handleSkipStep(
    input: SwordGateInput,
    refinementState: SwordRefinementState | null,
    exploreState: ExploreState | null,
    modeResult: { mode: SwordGateMode; bypassExplore?: boolean }
  ): Promise<SwordGateOutput> {
    console.log(`[SWORD_GATE] Skipping step for user ${input.userId}`);

    // If in explore phase, skip to refine
    if (exploreState && !this.isExploreTerminal(exploreState)) {
      console.log('[SWORD_GATE] Skipping explore → refine');
      
      // Mark explore as skipped
      await this.exploreStore.skip(input.userId);
      
      // ★ SYNTHESIZE GOAL from explore context (not just initial statement)
      // Priority: crystallizedGoal > candidateGoals > interests > initialStatement
      const goalStatement = this.synthesizeGoalFromExplore(exploreState);
      console.log(`[SWORD_GATE] Synthesized goal: "${goalStatement}"`);
      
      // Sanitize and start refinement
      const sanitizeResult = this.sanitizer.sanitize(goalStatement);
      if (!sanitizeResult.valid) {
        return {
          mode: 'capture',
          responseMessage: 'I couldn\'t understand that goal. What would you like to learn?',
          suppressModelGeneration: true,
        };
      }
      
      // Initiate refinement flow
      const newState = this.refinementFlow.initiate(
        input.userId,
        sanitizeResult.sanitized!,
        input.userPreferences
      );
      
      // Save refinement state
      const saveResult = await this.refinementStore.save(newState);
      if (!saveResult.ok) {
        return {
          mode: 'capture',
          responseMessage: 'Failed to start refinement. Please try again.',
          suppressModelGeneration: true,
        };
      }
      
      // Get first question
      const nextQuestion = this.refinementFlow.getNextQuestion(newState);
      
      return {
        mode: 'refine',
        nextQuestion: nextQuestion ?? undefined,
        responseMessage: `Got it! Let me help you create a plan for "${sanitizeResult.topic}". ${nextQuestion || 'What is your current skill level?'}`,
        suppressModelGeneration: true,
      };
    }

    // If in refine phase, skip to suggest with defaults
    if (refinementState && refinementState.stage !== 'complete') {
      console.log('[SWORD_GATE] Skipping refine → suggest');
      
      // Fill in defaults for missing fields
      const filledInputs = this.fillDefaults(refinementState.inputs);
      
      // Generate proposal with defaults
      const proposalResult = await this.planGenerator.generate(filledInputs);
      
      if (!proposalResult.ok) {
        return {
          mode: 'capture',
          responseMessage: 'I had trouble generating a plan. Let me try a simpler approach.',
          suppressModelGeneration: true,
        };
      }
      
      const proposal = proposalResult.value;
      
      // Store proposal and update state to confirming
      await this.refinementStore.startConfirming(input.userId, proposal);
      
      return {
        mode: 'suggest',
        proposedPlan: proposal,
        confirmationRequired: true,
        responseMessage: this.buildProposalResponse(proposal),
        suppressModelGeneration: true,
      };
    }

    // No active step to skip
    return {
      mode: 'capture',
      responseMessage: 'What would you like to learn?',
      suppressModelGeneration: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute the appropriate handler for the detected mode.
   */
  private async executeMode(
    input: SwordGateInput,
    refinementState: SwordRefinementState | null,
    exploreState: ExploreState | null,
    modeResult: { 
      mode: SwordGateMode; 
      bypassExplore?: boolean; 
      bypassReason?: string;
      exitSession?: boolean;
      skipStep?: boolean;
    }
  ): Promise<SwordGateOutput> {
    const { mode, bypassExplore, bypassReason } = modeResult;

    switch (mode) {
      case 'capture':
        // Phase 14A: Check if we should route to explore or bypass
        if (this.config.enableExplore && !bypassExplore) {
          return this.handleCaptureWithExplore(input);
        }
        return this.handleCapture(input, bypassReason === 'clear_goal');

      case 'explore':
        return this.handleExplore(input, exploreState);

      case 'refine':
        // Phase 14A: Check for explore context transition
        if (exploreState && !this.isExploreTerminal(exploreState)) {
          return this.handleExploreToRefine(input, exploreState);
        }
        return this.handleRefine(input, refinementState!);

      case 'suggest':
        return this.handleSuggest(input, refinementState!);

      case 'create':
        return this.handleCreate(input, refinementState!);

      case 'modify':
        return this.handleModify(input, refinementState);

      default:
        return {
          mode: 'capture',
          responseMessage: 'What would you like to learn?',
          suppressModelGeneration: true,
        };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPLORE MODE (Phase 14A - NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle capture with explore check - determines if explore is needed.
   */
  private async handleCaptureWithExplore(input: SwordGateInput): Promise<SwordGateOutput> {
    // Check clarity of the goal statement
    const clarityResult = await this.clarityDetector.assess(input.message);

    // If goal is clear enough, skip explore
    if (clarityResult.isClear) {
      console.log(`[SWORD_GATE] Goal is clear (${clarityResult.score}), skipping explore`);
      return this.handleCapture(input, true);
    }

    // If user wants to skip exploration
    if (this.clarityDetector.isSkipRequest(input.message)) {
      console.log('[SWORD_GATE] User requested to skip exploration');
      return this.handleCapture(input, true);
    }

    // Start exploration for vague goal
    console.log(`[SWORD_GATE] Goal is vague (${clarityResult.score}), starting explore`);
    return this.handleExploreStart(input);
  }

  /**
   * Start a new exploration session.
   */
  private async handleExploreStart(input: SwordGateInput): Promise<SwordGateOutput> {
    // Start exploration flow
    const result = await this.exploreFlow.process({
      message: input.message,
      currentState: null,
    });

    if (!result.ok) {
      console.error('[SWORD_GATE] Failed to start exploration:', result.error);
      // Fall back to regular capture
      return this.handleCapture(input, false);
    }

    const { state, response } = result.value;

    // ★ FIX: Set userId before saving (exploreFlow returns empty userId)
    const stateWithUser: ExploreState = { 
      ...state, 
      userId: input.userId,
      initialStatement: input.message,  // Ensure initial statement is set
    };

    // Save explore state
    const saveResult = await this.exploreStore.save(stateWithUser);
    if (!saveResult.ok) {
      console.error('[SWORD_GATE] Failed to save explore state:', saveResult.error);
    } else {
      console.log(`[SWORD_GATE] Explore state saved for user ${input.userId}`);
    }

    return {
      mode: 'explore',
      explorationInProgress: true,
      clarityScore: state.clarityScore,
      responseMessage: response,
      suppressModelGeneration: true,
    };
  }

  /**
   * Continue an existing exploration session.
   */
  private async handleExplore(
    input: SwordGateInput,
    exploreState: ExploreState | null
  ): Promise<SwordGateOutput> {
    // If no explore state, start new exploration
    if (!exploreState) {
      return this.handleExploreStart(input);
    }

    // Check for expiration
    if (this.exploreStore.isExpired(exploreState)) {
      await this.exploreStore.delete(input.userId);
      return {
        mode: 'capture',
        responseMessage: 'Your exploration session has expired. What would you like to learn?',
        suppressModelGeneration: true,
      };
    }

    // Check for skip request
    if (this.clarityDetector.isSkipRequest(input.message)) {
      const skipResult = await this.exploreFlow.process({
        message: input.message,
        currentState: exploreState,
      });
      if (skipResult.ok) {
        await this.exploreStore.skip(input.userId);
        return this.handleExploreToRefine(input, skipResult.value.state);
      }
    }

    // Check for confirmation of proposed goal
    if (exploreState.stage === 'proposing' && this.clarityDetector.isConfirmation(input.message)) {
      const goalToConfirm = exploreState.crystallizedGoal ?? exploreState.candidateGoals[exploreState.candidateGoals.length - 1] ?? exploreState.initialStatement;
      await this.exploreStore.crystallizeGoal(input.userId, goalToConfirm);
      return this.handleExploreToRefine(input, exploreState);
    }

    // Continue exploration
    const result = await this.exploreFlow.process({
      message: input.message,
      currentState: exploreState,
    });

    if (!result.ok) {
      console.error('[SWORD_GATE] Exploration continue failed:', result.error);
      return {
        mode: 'explore',
        explorationInProgress: true,
        responseMessage: "I'm having trouble understanding. Could you tell me more about what you're hoping to achieve?",
        suppressModelGeneration: true,
      };
    }

    const { state: updatedState, response, shouldTransition, transitionReason } = result.value;

    // Save updated state
    await this.exploreStore.save(updatedState);

    // Check if we should transition to refine
    if (shouldTransition) {
      console.log(`[SWORD_GATE] Transitioning from explore to refine: ${transitionReason}`);
      return this.handleExploreToRefine(input, updatedState);
    }

    return {
      mode: 'explore',
      explorationInProgress: true,
      clarityScore: updatedState.clarityScore,
      responseMessage: response,
      suppressModelGeneration: true,
    };
  }

  /**
   * Transition from explore to refine with context.
   */
  private async handleExploreToRefine(
    input: SwordGateInput,
    exploreState: ExploreState
  ): Promise<SwordGateOutput> {
    // Build explore context for refinement
    const context = buildExploreContext(exploreState);

    // Get crystallized goal or synthesize one
    const goalStatement = exploreState.crystallizedGoal ?? exploreState.initialStatement;

    // Clean up explore state
    await this.exploreStore.delete(input.userId);

    // Sanitize the goal statement
    const sanitizeResult = this.sanitizer.sanitize(goalStatement);

    if (!sanitizeResult.valid) {
      return {
        mode: 'capture',
        responseMessage: sanitizeResult.errorMessage ?? 'Please provide a valid learning goal.',
        suppressModelGeneration: true,
      };
    }

    // Check rate limits
    if (this.rateLimiter) {
      const limitResult = await this.rateLimiter.canCreateGoal(input.userId);
      if (limitResult.ok && limitResult.value.exceeded) {
        return {
          mode: 'capture',
          rateLimit: limitResult.value,
          responseMessage: limitResult.value.message,
          suppressModelGeneration: true,
        };
      }
    }

    // Initiate refinement with explore context
    const newState = this.refinementFlow.initiate(
      input.userId,
      sanitizeResult.sanitized!,
      input.userPreferences
    );

    // Add explore context to inputs
    const stateWithContext: SwordRefinementState = {
      ...newState,
      inputs: {
        ...newState.inputs,
        exploreContext: context,
      },
    };

    // Save refinement state
    const saveResult = await this.refinementStore.save(stateWithContext);
    if (!saveResult.ok) {
      console.error('[SWORD_GATE] Failed to save refinement state:', saveResult.error);
    }

    // Get the first question
    const nextQuestion = this.refinementFlow.getNextQuestion(stateWithContext);

    // Build a response that acknowledges the exploration
    const response = context
      ? `Great! So you want to ${goalStatement}. ${nextQuestion ?? ''}`
      : `Got it! I'll help you ${goalStatement}. ${nextQuestion ?? ''}`;

    return {
      mode: 'refine',
      exploreContext: context,
      clarityScore: exploreState.clarityScore,
      nextQuestion: nextQuestion ?? undefined,
      refinementProgress: 0.25,
      missingFields: getMissingRequiredFields(stateWithContext.inputs),
      responseMessage: response,
      suppressModelGeneration: true,
    };
  }

  /**
   * Check if explore state is terminal.
   */
  private isExploreTerminal(state: ExploreState): boolean {
    return ['confirmed', 'skipped', 'expired'].includes(state.stage);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CAPTURE MODE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle capture mode — extract goal statement and start refinement.
   */
  private async handleCapture(
    input: SwordGateInput,
    skipExplore: boolean = false
  ): Promise<SwordGateOutput> {
    // Sanitize the goal statement
    const sanitizeResult = this.sanitizer.sanitize(input.message);

    if (!sanitizeResult.valid) {
      return {
        mode: 'capture',
        responseMessage: sanitizeResult.errorMessage ?? 'Please provide a valid learning goal.',
        suppressModelGeneration: true,
      };
    }

    // Check rate limits before proceeding
    if (this.rateLimiter) {
      const limitResult = await this.rateLimiter.canCreateGoal(input.userId);
      if (limitResult.ok && limitResult.value.exceeded) {
        return {
          mode: 'capture',
          rateLimit: limitResult.value,
          responseMessage: limitResult.value.message,
          suppressModelGeneration: true,
        };
      }
    }

    // Initiate refinement flow
    const newState = this.refinementFlow.initiate(
      input.userId,
      sanitizeResult.sanitized!,
      input.userPreferences
    );

    // Save refinement state
    const saveResult = await this.refinementStore.save(newState);
    if (!saveResult.ok) {
      console.error('[SWORD_GATE] Failed to save refinement state:', saveResult.error);
      return {
        mode: 'capture',
        responseMessage: 'Something went wrong. Please try again.',
        suppressModelGeneration: true,
      };
    }

    // Get the first question
    const nextQuestion = this.refinementFlow.getNextQuestion(newState);

    return {
      mode: 'capture',
      nextQuestion: nextQuestion ?? undefined,
      refinementProgress: 0.25, // goalStatement is filled
      missingFields: getMissingRequiredFields(newState.inputs),
      responseMessage: this.buildCaptureResponse(sanitizeResult.topic!, nextQuestion),
      suppressModelGeneration: true,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REFINE MODE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle refine mode — process user response and continue refinement.
   */
  private async handleRefine(
    input: SwordGateInput,
    currentState: SwordRefinementState
  ): Promise<SwordGateOutput> {
    try {
      console.log(`[SWORD_GATE] handleRefine called, stage: ${currentState.stage}, message: "${input.message.substring(0, 50)}"`);
      
      // Check for expiration
      if (this.refinementStore.isExpired(currentState)) {
        console.log('[SWORD_GATE] Session expired');
        await this.refinementStore.delete(input.userId);
        return {
          mode: 'capture',
          responseMessage: 'Your session has expired. What would you like to learn?',
          suppressModelGeneration: true,
        };
      }

      // Check max turns
      if (this.refinementStore.isMaxTurnsExceeded(currentState)) {
        console.log('[SWORD_GATE] Max turns exceeded, forcing suggest');
        // Force move to suggest with what we have
        return this.handleSuggest(input, currentState);
      }

      // Process the response
      console.log('[SWORD_GATE] Processing response...');
      const updatedState = this.refinementFlow.processResponse(currentState, input.message);
      console.log(`[SWORD_GATE] Updated inputs: userLevel=${updatedState.inputs.userLevel}, dailyTime=${updatedState.inputs.dailyTimeCommitment}, totalDuration=${updatedState.inputs.totalDuration}`);

      // Save updated state
      const saveResult = await this.refinementStore.save(updatedState);
      if (!saveResult.ok) {
        console.error('[SWORD_GATE] Failed to update refinement state:', saveResult.error);
      }

      // Check if refinement is complete
      const isComplete = this.refinementFlow.isComplete(updatedState);
      console.log(`[SWORD_GATE] isComplete: ${isComplete}`);
      
      if (isComplete) {
        console.log('[SWORD_GATE] Refinement complete, moving to suggest');
        // Move to suggest mode
        return this.handleSuggest(input, updatedState);
      }

      // Get next question
      const nextQuestion = this.refinementFlow.getNextQuestion(updatedState);
      console.log(`[SWORD_GATE] Next question: ${nextQuestion ?? 'none'}`);

      if (!nextQuestion) {
        console.log('[SWORD_GATE] No more questions, moving to suggest');
        // No more questions, move to suggest
        return this.handleSuggest(input, updatedState);
      }

      return {
        mode: 'refine',
        nextQuestion,
        refinementProgress: this.refinementFlow.getProgressPercent(updatedState) / 100,
        missingFields: this.refinementFlow.getMissingFields(updatedState),
        responseMessage: nextQuestion,
        suppressModelGeneration: true,
      };
    } catch (error) {
      console.error('[SWORD_GATE] handleRefine error:', error);
      throw error; // Re-throw to let pipeline handle it
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUGGEST MODE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle suggest mode — generate and present lesson plan proposal.
   */
  private async handleSuggest(
    input: SwordGateInput,
    currentState: SwordRefinementState
  ): Promise<SwordGateOutput> {
    try {
      console.log('[SWORD_GATE] handleSuggest called');
      console.log(`[SWORD_GATE] Inputs: goal="${currentState.inputs.goalStatement}", level=${currentState.inputs.userLevel}, daily=${currentState.inputs.dailyTimeCommitment}, duration=${currentState.inputs.totalDuration}, days=${currentState.inputs.totalDays}`);
      
      // ★ ALWAYS fill defaults to ensure totalDays is set
      // Bug: hasRequiredFields checks totalDuration but NOT totalDays
      // But generate() requires both. fillDefaults ensures both are set.
      const filledInputs = this.fillDefaults(currentState.inputs);
      const updatedState = { ...currentState, inputs: filledInputs };
      
      console.log(`[SWORD_GATE] After fillDefaults: duration=${filledInputs.totalDuration}, days=${filledInputs.totalDays}`);
      
      // Save the updated state
      await this.refinementStore.save(updatedState);

      // Generate lesson plan proposal
      console.log('[SWORD_GATE] Generating lesson plan...');
      const planResult = await this.planGenerator.generate(filledInputs);

      if (!planResult.ok) {
        console.error('[SWORD_GATE] Plan generation failed:', planResult.error);
        return {
          mode: 'suggest',
          responseMessage: 'I couldn\'t generate a learning plan. Please try again with different details.',
          suppressModelGeneration: true,
        };
      }

      const proposal = planResult.value;
      console.log(`[SWORD_GATE] Plan generated: "${proposal.title}" with ${proposal.quests.length} stages`);

      // Update state to confirming with the proposal
      await this.refinementStore.startConfirming(input.userId, proposal);

      return {
        mode: 'suggest',
        proposedPlan: proposal,
        confirmationRequired: true,
        responseMessage: this.buildProposalResponse(proposal),
        suppressModelGeneration: true,
      };
    } catch (error) {
      console.error('[SWORD_GATE] handleSuggest error:', error);
      throw error; // Re-throw to let pipeline handle it
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE MODE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle create mode — create goal after user confirmation.
   */
  private async handleCreate(
    input: SwordGateInput,
    currentState: SwordRefinementState
  ): Promise<SwordGateOutput> {
    // Verify we have a proposed plan
    if (!currentState.lastProposedPlan) {
      return {
        mode: 'create',
        responseMessage: 'No plan to create. Please start over.',
        suppressModelGeneration: true,
      };
    }

    // Check rate limits
    if (this.rateLimiter) {
      const limitResult = await this.rateLimiter.canCreateGoal(input.userId);
      if (limitResult.ok && limitResult.value.exceeded) {
        return {
          mode: 'create',
          rateLimit: limitResult.value,
          responseMessage: limitResult.value.message,
          suppressModelGeneration: true,
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GRACEFUL FALLBACK: If SparkEngine isn't available, show success with
    // plan details but note that persistence isn't available.
    // This allows the refinement flow to complete in dev/testing environments.
    // ─────────────────────────────────────────────────────────────────────────
    if (!this.sparkEngine) {
      console.warn('[SWORD_GATE] SparkEngine not available - using graceful fallback');
      
      // Clean up refinement state
      await this.refinementStore.delete(input.userId);
      
      const proposal = currentState.lastProposedPlan;
      const inputs = currentState.inputs;
      
      // Build a summary response
      const summary = this.buildFallbackSummary(inputs, proposal);
      
      return {
        mode: 'create',
        responseMessage: summary,
        suppressModelGeneration: true,
        // Note: createdGoal is undefined since we couldn't persist
      };
    }

    // Create the goal
    const createResult = await this.createGoalFromProposal(
      input.userId,
      currentState.inputs,
      currentState.lastProposedPlan
    );

    if (!createResult.ok) {
      console.error('[SWORD_GATE] Goal creation failed:', createResult.error);
      return {
        mode: 'create',
        responseMessage: `Failed to create goal: ${createResult.error.message}`,
        suppressModelGeneration: true,
      };
    }

    // Record rate limit
    if (this.rateLimiter) {
      await this.rateLimiter.recordGoalCreation(input.userId);
    }

    // Complete refinement and clean up
    await this.refinementStore.complete(input.userId, createResult.value.goal.id);
    await this.refinementStore.delete(input.userId);

    return {
      mode: 'create',
      createdGoal: createResult.value,
      responseMessage: createResult.value.summary,
      suppressModelGeneration: true,
    };
  }

  /**
   * Build a summary when SparkEngine isn't available.
   * Provides a positive completion message with plan details.
   */
  private buildFallbackSummary(
    inputs: SwordRefinementInputs,
    proposal: LessonPlanProposal
  ): string {
    const lines: string[] = [
      `✅ Your learning plan for "${inputs.goalStatement}" is ready!`,
      '',
      `📅 **Duration:** ${inputs.totalDuration} (${inputs.totalDays} days)`,
      `⏱️ **Daily commitment:** ${inputs.dailyTimeCommitment} minutes`,
      `📊 **Level:** ${inputs.userLevel}`,
      '',
      `**Your ${proposal.quests.length} section${proposal.quests.length > 1 ? 's' : ''}:**`,
    ];

    for (const quest of proposal.quests) {
      lines.push(`  ${quest.order}. ${quest.title} (${quest.estimatedDays} days)`);
    }

    lines.push('');
    lines.push('🚧 *Note: Goal persistence requires SparkEngine integration.*');
    lines.push('*Your plan details are shown above but not saved to the database.*');

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODIFY MODE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle modify mode — modify proposal or existing goal.
   */
  private async handleModify(
    input: SwordGateInput,
    currentState: SwordRefinementState | null
  ): Promise<SwordGateOutput> {
    // If modifying a proposal in progress
    if (currentState?.lastProposedPlan) {
      // Reset to clarifying stage to collect new preferences
      const resetState: SwordRefinementState = {
        ...currentState,
        stage: 'clarifying',
        turnCount: currentState.turnCount + 1,
      };

      await this.refinementStore.save(resetState);

      return {
        mode: 'modify',
        responseMessage: 'What would you like to change about the plan?',
        suppressModelGeneration: true,
      };
    }

    // If modifying an existing goal
    if (input.existingGoalId) {
      // TODO: Implement existing goal modification
      return {
        mode: 'modify',
        responseMessage: 'Goal modification is not yet implemented.',
        suppressModelGeneration: true,
      };
    }

    // No context for modification
    return {
      mode: 'capture',
      responseMessage: 'What would you like to learn?',
      suppressModelGeneration: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOAL CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a goal from the proposal.
   */
  private async createGoalFromProposal(
    userId: UserId,
    inputs: SwordRefinementInputs,
    proposal: LessonPlanProposal
  ): AsyncAppResult<CreatedGoalResult> {
    if (!this.sparkEngine) {
      return err(appError('SERVICE_UNAVAILABLE', 'SparkEngine not available'));
    }

    // Build goal params
    const goalParams: CreateGoalParams = {
      userId,
      title: proposal.title,
      description: proposal.description,
      learningConfig: proposal.learningConfig,
      reminderConfig: {
        enabled: inputs.remindersEnabled ?? true,
        firstReminderHour: inputs.firstReminderHour ?? 9,
        lastReminderHour: inputs.lastReminderHour ?? 21,
        intervalHours: 4,
        channels: { email: false, sms: false, push: true },
        shrinkSparksOnEscalation: true,
        maxRemindersPerDay: 3,
        quietDays: [],
        timezone: 'UTC',
      },
    };

    // Create goal via SparkEngine
    const goalResult = await this.sparkEngine.createGoal(goalParams);
    if (!goalResult.ok) {
      return goalResult;
    }

    const goal = goalResult.value;

    // Create quests
    const quests: Quest[] = [];
    for (const proposedQuest of proposal.quests) {
      const questResult = await this.sparkEngine.createQuest({
        goalId: goal.id,
        title: proposedQuest.title,
        description: proposedQuest.description,
        order: proposedQuest.order,
        estimatedDays: proposedQuest.estimatedDays,
      });

      if (questResult.ok) {
        quests.push(questResult.value);
      }
    }

    // Trigger onGoalCreated to generate steps and sparks
    await this.sparkEngine.onGoalCreated(goal, quests);

    return ok({
      goal,
      quests,
      summary: this.buildCreationSummary(goal, quests),
      stepsGenerationScheduled: true,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build SwordGateInput from pipeline state.
   */
  private buildInput(state: PipelineState, context: PipelineContext): SwordGateInput {
    return {
      userId: state.input.userId as UserId,
      message: state.input.message,
      conversationHistory: [], // Could be populated from context
      intent: state.intent,
      shield: state.risk,
      stance: state.stance,
      sessionId: state.input.sessionId,
      requestId: context.requestId,
    };
  }

  /**
   * Determine gate action from output.
   */
  private determineAction(output: SwordGateOutput): GateAction {
    if (output.confirmationRequired) {
      return 'await_ack';
    }
    if (output.createdGoal) {
      return 'continue';
    }
    if (output.suppressModelGeneration) {
      return 'continue'; // But with suppressed generation
    }
    return 'continue';
  }

  /**
   * Build error gate result.
   */
  private gateError(
    message: string,
    startTime: number,
    cause?: Error | AppError
  ): GateResult<SwordGateOutput> {
    return {
      gateId: this.gateId,
      status: 'soft_fail',
      output: {
        mode: 'capture',
        responseMessage: message,
        suppressModelGeneration: false,
      },
      action: 'continue',
      failureReason: message,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Fill default values for missing required fields.
   */
  private fillDefaults(inputs: SwordRefinementInputs): SwordRefinementInputs {
    return {
      ...inputs,
      userLevel: inputs.userLevel ?? 'beginner',
      dailyTimeCommitment: inputs.dailyTimeCommitment ?? 30,
      totalDuration: inputs.totalDuration ?? '4 weeks',
      totalDays: inputs.totalDays ?? 28,
      learningStyle: inputs.learningStyle ?? 'mixed',
      startDate: inputs.startDate ?? this.getTomorrowDate(),
      activeDays: inputs.activeDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    };
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format.
   */
  private getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0] ?? '';
  }

  /**
   * Build response for capture mode.
   */
  private buildCaptureResponse(topic: string, nextQuestion: string | null): string {
    let response = `Great! I'll help you learn ${topic}. `;

    if (nextQuestion) {
      response += nextQuestion;
    }

    return response;
  }

  /**
   * ★ SYNTHESIZE a goal statement from explore conversation context.
   * 
   * When user skips exploration early, we need to extract the most specific
   * topic/goal from what was discussed, not just fall back to the vague
   * initial statement like "i want to learn how to code".
   * 
   * Priority:
   *   1. crystallizedGoal (if explore reached that point)
   *   2. Last candidateGoal (specific goals mentioned)
   *   3. Most specific interest (e.g., "web development" > "coding")
   *   4. Initial statement (last resort)
   */
  private synthesizeGoalFromExplore(state: ExploreState): string {
    // 1. Already have a crystallized goal
    if (state.crystallizedGoal) {
      return state.crystallizedGoal;
    }

    // 2. Check candidate goals (specific goals mentioned during conversation)
    if (state.candidateGoals && state.candidateGoals.length > 0) {
      // Use the most recent candidate goal
      const lastGoal = state.candidateGoals[state.candidateGoals.length - 1];
      if (lastGoal) {
        return `learn ${lastGoal}`;
      }
    }

    // 3. Check interests for specific topics
    // These are more specific than the initial statement
    if (state.interests && state.interests.length > 0) {
      // Find the most specific interest (longer = more specific usually)
      const sortedInterests = [...state.interests].sort((a, b) => b.length - a.length);
      const mostSpecific = sortedInterests[0];
      if (mostSpecific && mostSpecific.length > 3) {
        return `learn ${mostSpecific}`;
      }
    }

    // 4. Try to extract topic from conversation history
    // Look for patterns like "I want to learn X" or "interested in X"
    if (state.conversationHistory && state.conversationHistory.length > 0) {
      const topicFromHistory = this.extractTopicFromHistory(state.conversationHistory);
      if (topicFromHistory) {
        return `learn ${topicFromHistory}`;
      }
    }

    // 5. Fall back to initial statement
    return state.initialStatement;
  }

  /**
   * Extract the most specific topic mentioned in conversation history.
   */
  private extractTopicFromHistory(
    history: readonly { role: string; content: string }[]
  ): string | null {
    // Common specific topics we should recognize
    const topicPatterns: Array<{ pattern: RegExp; topic: string }> = [
      // Web development
      { pattern: /\b(full[- ]?stack|fullstack)\b/i, topic: 'full-stack web development' },
      { pattern: /\b(front[- ]?end|frontend)\b/i, topic: 'front-end web development' },
      { pattern: /\b(back[- ]?end|backend)\b/i, topic: 'back-end web development' },
      { pattern: /\bweb\s*(development|dev)\b/i, topic: 'web development' },
      // Languages
      { pattern: /\b(javascript|js)\b/i, topic: 'JavaScript' },
      { pattern: /\btypescript\b/i, topic: 'TypeScript' },
      { pattern: /\bpython\b/i, topic: 'Python' },
      { pattern: /\brust\b/i, topic: 'Rust' },
      { pattern: /\bjava\b(?!script)/i, topic: 'Java' },
      { pattern: /\bgo(lang)?\b/i, topic: 'Go' },
      { pattern: /\bc\+\+\b/i, topic: 'C++' },
      { pattern: /\bc#\b/i, topic: 'C#' },
      // Frameworks
      { pattern: /\breact\b/i, topic: 'React' },
      { pattern: /\bvue\b/i, topic: 'Vue.js' },
      { pattern: /\bangular\b/i, topic: 'Angular' },
      { pattern: /\bnode\.?js\b/i, topic: 'Node.js' },
      { pattern: /\bexpress\b/i, topic: 'Express.js' },
      // Data & ML
      { pattern: /\bmachine\s*learning\b/i, topic: 'machine learning' },
      { pattern: /\bdata\s*science\b/i, topic: 'data science' },
      { pattern: /\bAI\b/i, topic: 'artificial intelligence' },
      // Mobile
      { pattern: /\bmobile\s*(app|development|dev)\b/i, topic: 'mobile development' },
      { pattern: /\bios\b/i, topic: 'iOS development' },
      { pattern: /\bandroid\b/i, topic: 'Android development' },
      { pattern: /\breact\s*native\b/i, topic: 'React Native' },
      { pattern: /\bflutter\b/i, topic: 'Flutter' },
      // Other
      { pattern: /\bsql\b/i, topic: 'SQL' },
      { pattern: /\bdatabase\b/i, topic: 'databases' },
      { pattern: /\bgit\b/i, topic: 'Git' },
      { pattern: /\bdocker\b/i, topic: 'Docker' },
      { pattern: /\bkubernetes\b/i, topic: 'Kubernetes' },
    ];

    // Search user messages for specific topics (most recent first)
    const userMessages = history
      .filter(h => h.role === 'user')
      .map(h => h.content)
      .reverse();

    for (const message of userMessages) {
      for (const { pattern, topic } of topicPatterns) {
        if (pattern.test(message)) {
          return topic;
        }
      }
    }

    return null;
  }

  /**
   * Build response for proposal.
   */
  private buildProposalResponse(proposal: LessonPlanProposal): string {
    // Detect if this is a capability-based plan (stages) vs content-based (weeks)
    const isCapabilityBased = proposal.quests.some(q => q.title.startsWith('Stage'));
    
    const lines: string[] = [
      `Here's your learning plan for "${proposal.title}":`,
      '',
      `📅 Duration: ${proposal.totalDuration} (${proposal.totalDays} days)`,
      `📚 ${proposal.quests.length} ${isCapabilityBased ? 'stages' : 'sections'}`,
      `🔍 Found ${proposal.resourcesFound} learning resources`,
      '',
    ];

    if (isCapabilityBased) {
      // ★ CAPABILITY-BASED: Show full competence model
      lines.push('**Your Competence Roadmap:**');
      lines.push('');
      
      for (const quest of proposal.quests) {
        lines.push(`**${quest.title}** (${quest.estimatedDays} days)`);
        // Description contains the capability model, show it
        lines.push(quest.description);
        lines.push('');
      }
    } else {
      // Standard topic-based format
      lines.push('**Sections:**');
      for (const quest of proposal.quests) {
        lines.push(`${quest.order}. ${quest.title} (${quest.estimatedDays} days)`);
      }
    }

    if (proposal.gaps && proposal.gaps.length > 0) {
      lines.push('');
      lines.push('⚠️ Note: Some topics may have limited resources.');
    }

    lines.push('');
    lines.push('Does this look good? Say "yes" to create this plan, or tell me what you\'d like to change.');

    return lines.join('\n');
  }

  /**
   * Build summary for created goal.
   */
  private buildCreationSummary(goal: Goal, quests: readonly Quest[]): string {
    return `✅ Created "${goal.title}" with ${quests.length} sections. ` +
      `Your first lesson will be ready ${goal.learningConfig?.startDate ?? 'tomorrow'}. ` +
      `I'll send you reminders to help you stay on track!`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a SwordGate instance.
 */
export function createSwordGate(
  baseRefinementStore: IRefinementStore,
  config?: Partial<SwordGateConfig>,
  options?: {
    sparkEngine?: ISparkEngine;
    rateLimiter?: IGoalRateLimiter;
    resourceService?: IResourceDiscoveryService;
    curriculumService?: ICurriculumService;
    openaiApiKey?: string;
  }
): SwordGate {
  return new SwordGate(baseRefinementStore, config, options);
}
