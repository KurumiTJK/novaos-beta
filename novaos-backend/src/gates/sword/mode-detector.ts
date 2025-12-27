// ═══════════════════════════════════════════════════════════════════════════════
// MODE DETECTOR — SwordGate Mode Classification
// NovaOS Gates — Phase 14A: SwordGate Explore Module
// ═══════════════════════════════════════════════════════════════════════════════
//
// Detects the appropriate SwordGate mode based on:
//   1. ★ ACTIVE SESSION — If sword session active, route ALL messages to sword
//   2. Exit/Cancel commands — End sword session
//   3. Skip commands — Skip current step
//   4. Active explore state (continue explore flow)
//   5. Active refinement state (continue refine/suggest flow)
//   6. Confirmation patterns (proceed to create)
//   7. Modification requests (modify existing goal)
//   8. Clear goal statement (skip explore → refine)
//   9. Goal creation intent (start explore for vague goals)
//   10. LLM classification for ambiguous cases
//
// Implements fail-open: defaults to 'capture' when uncertain.
//
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';

import type { UserId, GoalId } from '../../types/branded.js';
import type { Intent } from '../../helpers/types.js';
import type {
  SwordGateMode,
  SwordGateInput,
  SwordRefinementState,
  SwordGateConfig,
} from './types.js';

// Phase 14A: Import ExploreState
import type { ExploreState } from './explore/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mode detection result.
 */
export interface ModeDetectionResult {
  /** Detected mode */
  readonly mode: SwordGateMode;

  /** Confidence in detection (0-1) */
  readonly confidence: number;

  /** How the mode was detected */
  readonly detectionMethod: 'active_session' | 'exit_command' | 'skip_command' | 'explore_state' | 'refinement_state' | 'confirmation' | 'modification' | 'keyword' | 'llm' | 'default';

  /** Reasoning for the detection */
  readonly reasoning: string;

  /** Existing goal ID if modify mode */
  readonly targetGoalId?: GoalId;

  /** Whether this is a continuation of existing flow */
  readonly isContinuation: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Session control flags
  // ─────────────────────────────────────────────────────────────────────────────

  /** Whether to bypass explore phase */
  readonly bypassExplore?: boolean;

  /** Reason for bypassing explore */
  readonly bypassReason?: 'clear_goal' | 'user_skip' | 'disabled';

  /** ★ NEW: Whether user wants to exit sword mode entirely */
  readonly exitSession?: boolean;

  /** ★ NEW: Whether user wants to skip current step */
  readonly skipStep?: boolean;
}

/**
 * LLM classification output.
 */
interface LlmModeClassification {
  mode: SwordGateMode;
  confidence: number;
  reasoning: string;
  isConfirmation: boolean;
  isModification: boolean;
  targetGoalReference?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ★ NEW: Exit/cancel patterns — user wants to leave sword mode entirely.
 */
const EXIT_PATTERNS: RegExp[] = [
  /^(exit|quit|cancel|stop|nevermind|never mind|forget it|abort)\.?$/i,
  /\b(exit|quit|cancel|stop|abort)\s+(this|the|goal|plan|learning|sword)\b/i,
  /\b(don'?t|do not)\s+(want|need)\s+(this|to learn|a plan)\b/i,
  /\b(i changed my mind|forget about it|let'?s stop)\b/i,
];

/**
 * ★ NEW: Skip patterns — user wants to skip current step.
 */
const SKIP_PATTERNS: RegExp[] = [
  /^(skip|next|continue|proceed)\.?$/i,
  /\b(skip)\s+(this|the|these|exploration|questions?|step)\b/i,
  /\b(just|let'?s)\s+(start|begin|create|make|go|proceed)\b/i,
  /\b(skip to|jump to|go to)\s+(the\s+)?(plan|creation|next|end)\b/i,
  /\b(i'?m ready|ready to start|ready to go)\b/i,
  /\b(don'?t need|skip)\s+(to\s+)?(ask|explore|talk|discuss)\b/i,
  /\b(get straight to|get right to)\s+(it|the point|the plan)\b/i,
];

/**
 * Confirmation patterns — user wants to proceed with the plan.
 * 
 * ✅ FIX: Added compound patterns to match "yes, create it", "yes, do it", etc.
 */
const CONFIRMATION_PATTERNS: RegExp[] = [
  // Exact single-word confirmations
  /^(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|let'?s do it|sounds good|looks good|perfect|great|confirm|proceed|create it|start|begin)\.?$/i,
  // ✅ Compound patterns: "yes, create it", "ok, do it", etc.
  /^(yes|yeah|yep|sure|ok|okay),?\s+(create|do|go|make|start|proceed|let'?s)/i,
  // Phrase-based confirmations (anywhere in string)
  // ✅ FIX: Removed "make it" - too ambiguous, conflicts with "make it shorter" modification
  /\b(looks good|sounds good|sounds great|that works|i'?m ready|let'?s go|create the plan|create my plan|set it up)\b/i,
  // Emoji confirmations
  /^(👍|✅|✓|yep!|yes!|sure!|ok!|okay!)$/i,
];

/**
 * Rejection/modification patterns — user wants changes.
 */
const MODIFICATION_PATTERNS: RegExp[] = [
  /\b(change|modify|update|edit|adjust|tweak|different|instead|rather|actually|wait|hold on|no|nope)\b/i,
  /\b(too (long|short|much|little|many|few))\b/i,
  /\b(more|less|fewer) (time|days|hours|weeks)\b/i,
  /\b(can you|could you|please) (change|modify|update|make it)\b/i,
  /\b(i want|i'?d like|prefer) (to change|something different|a different)\b/i,
  // ✅ FIX: Added pattern for "make it shorter/longer/easier/harder"
  /\b(make it|shorten|lengthen)\s*(shorter|longer|easier|harder|faster|slower|simpler|less|more)?\b/i,
  /\b(shorter|longer|easier|harder)\b/i,
];

/**
 * Goal creation intent patterns.
 */
const GOAL_CREATION_PATTERNS: RegExp[] = [
  /\b(i want to learn|teach me|help me learn|i'?d like to learn|learn how to|learning)\b/i,
  /\b(create a (learning )?plan|make a (learning )?plan|set up a plan|build a plan)\b/i,
  /\b(new goal|start learning|begin learning|get started with)\b/i,
  /\b(master|become proficient|get better at|improve my)\b/i,
  /\b(study|practice|train|develop skills in)\b/i,
];

/**
 * Existing goal modification patterns.
 */
const EXISTING_GOAL_PATTERNS: RegExp[] = [
  /\b(my (goal|plan|learning plan)|the (goal|plan))\b/i,
  /\b(pause|resume|abandon|delete|cancel) (my|the) (goal|plan)\b/i,
  /\b(update|change|modify) (my|the) (existing|current) (goal|plan)\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// NEW: EXPLORE-RELATED PATTERNS (Phase 14A)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Patterns indicating user wants to skip exploration.
 */
const SKIP_EXPLORE_PATTERNS: RegExp[] = [
  /\b(just (build|create|make|start)|skip|i know what i want)\b/i,
  /\b(let'?s just (start|begin|go))\b/i,
  /\b(don'?t need to (talk|discuss|explore))\b/i,
  /\b(get (straight|right) to (it|the plan))\b/i,
];

/**
 * Patterns indicating a clear, specific goal statement.
 * These goals don't need exploration - they're ready for refinement.
 */
const CLEAR_GOAL_PATTERNS: RegExp[] = [
  // Specific technology + purpose
  /\b(learn|master|study)\s+(python|javascript|typescript|rust|go|java|c\+\+|ruby|swift|kotlin)\s+(for|to)\s+\w+/i,
  // Specific outcome stated
  /\b(build|create|make)\s+(a|an|my)\s+\w+\s+(app|website|api|project|portfolio)/i,
  // Level + topic specified
  /\b(beginner|intermediate|advanced)\s+\w+\s+(course|tutorial|learning)/i,
  // Timeline specified
  /\b(in\s+\d+\s+(weeks?|months?|days?))\b/i,
  // Certification goal
  /\b(prepare for|pass|get)\s+(the\s+)?\w+\s+(certification|exam|test)\b/i,
];

/**
 * Patterns for confirming during exploration.
 */
const EXPLORE_CONFIRMATION_PATTERNS: RegExp[] = [
  /^(yes|yeah|yep|that'?s it|exactly|perfect|that'?s right|correct)\.?$/i,
  /\b(sounds (good|right|perfect)|that'?s (it|what i want|exactly))\b/i,
  /\b(let'?s (go with that|do that|proceed))\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// LLM CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

const MODE_DETECTION_SYSTEM_PROMPT = `You are a goal creation flow classifier. Analyze the user message and determine the appropriate mode.

Return JSON only, no markdown, no code blocks.

Output format:
{"mode":"...","confidence":0.0-1.0,"reasoning":"...","isConfirmation":true/false,"isModification":true/false,"targetGoalReference":"..."}

MODES:
- capture: User wants to create a new learning goal (extract their goal statement)
- explore: User has a vague idea and needs help crystallizing it into a concrete goal
- refine: User is answering questions about their learning preferences
- suggest: System should generate/show a lesson plan (internal - don't return this)
- create: User confirmed the proposed plan, ready to create
- modify: User wants to change an existing goal or the current proposal

CLASSIFICATION RULES:

1. If user is clearly confirming/approving something → "create" with isConfirmation=true
   Examples: "yes", "looks good", "let's do it", "create it", "perfect"

2. If user is requesting changes to a proposal → "modify" with isModification=true
   Examples: "make it shorter", "change the duration", "too many days"

3. If user is answering a question about preferences → "refine"
   Examples: "30 minutes", "beginner", "I prefer videos", "weekdays only"

4. If user has a clear, specific learning goal → "capture"
   Examples: "I want to learn Rust for systems programming", "teach me Python to build web apps"

5. If user has a vague or exploratory idea → "explore"
   Examples: "I want to get into coding", "something with AI maybe", "not sure where to start"

6. If user wants to modify an existing goal → "modify" with targetGoalReference
   Examples: "pause my Rust goal", "update my learning plan"

Context will be provided about whether there's an active refinement or exploration session.

═══════════════════════════════════════════════════════════════════════════════
EXAMPLES:
═══════════════════════════════════════════════════════════════════════════════

User: "Yes, create it"
{"mode":"create","confidence":0.95,"reasoning":"Clear confirmation to create","isConfirmation":true,"isModification":false}

User: "make it shorter"
{"mode":"modify","confidence":0.9,"reasoning":"Request to modify duration","isConfirmation":false,"isModification":true}

User: "30 minutes a day"
{"mode":"refine","confidence":0.85,"reasoning":"Answering time commitment question","isConfirmation":false,"isModification":false}

User: "I want to learn React to build a dashboard"
{"mode":"capture","confidence":0.9,"reasoning":"Clear goal with technology and purpose","isConfirmation":false,"isModification":false}

User: "something with programming maybe"
{"mode":"explore","confidence":0.85,"reasoning":"Vague interest needing exploration","isConfirmation":false,"isModification":false}`;

// ═══════════════════════════════════════════════════════════════════════════════
// MODE DETECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detects the appropriate SwordGate mode.
 */
export class ModeDetector {
  private readonly config: SwordGateConfig;
  private readonly openai?: OpenAI;

  constructor(config: SwordGateConfig, openaiApiKey?: string) {
    this.config = config;
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  /**
   * Detect the appropriate mode for the input.
   */
  async detect(
    input: SwordGateInput,
    refinementState: SwordRefinementState | null,
    exploreState: ExploreState | null
  ): Promise<ModeDetectionResult> {
    const message = input.message.trim();
    const hasActiveSession = this.hasActiveSession(exploreState, refinementState);

    // ═══════════════════════════════════════════════════════════════════════════
    // ★ PRIORITY 0: Exit commands — always check first
    // ═══════════════════════════════════════════════════════════════════════════
    if (this.isExitCommand(message)) {
      console.log('[MODE_DETECTOR] Exit command detected');
      return {
        mode: 'capture', // Return to initial state
        confidence: 1.0,
        detectionMethod: 'exit_command',
        reasoning: 'User requested to exit sword mode',
        isContinuation: false,
        exitSession: true,
      };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ★ PRIORITY 1: Skip commands — check before other processing
    // ═══════════════════════════════════════════════════════════════════════════
    if (this.isSkipCommand(message)) {
      console.log('[MODE_DETECTOR] Skip command detected');
      
      // Determine what to skip to based on current state
      if (exploreState && !this.isExploreTerminal(exploreState)) {
        // Skip explore → go to refine
        return {
          mode: 'refine',
          confidence: 1.0,
          detectionMethod: 'skip_command',
          reasoning: 'User skipped exploration phase',
          isContinuation: true,
          skipStep: true,
          bypassExplore: true,
          bypassReason: 'user_skip',
        };
      } else if (refinementState && refinementState.stage !== 'complete') {
        // Skip refinement → go to suggest/create with defaults
        return {
          mode: 'suggest',
          confidence: 1.0,
          detectionMethod: 'skip_command',
          reasoning: 'User skipped refinement - proceeding with defaults',
          isContinuation: true,
          skipStep: true,
        };
      }
      
      // No active step to skip, treat as normal
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ★ PRIORITY 2: Active session routing — ALL messages go to sword
    // ═══════════════════════════════════════════════════════════════════════════
    if (hasActiveSession) {
      console.log('[MODE_DETECTOR] Active sword session detected, routing to sword');
      
      // Check what state we're in and route appropriately
      if (exploreState && !this.isExploreTerminal(exploreState)) {
        return this.detectWithinExplore(message, exploreState);
      }
      
      if (refinementState) {
        return this.detectWithinRefinement(message, refinementState);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIORITY 3: Pattern-based detection for new sessions
    // ═══════════════════════════════════════════════════════════════════════════

    // Check for existing goal modification patterns (no active session needed)
    if (this.isExistingGoalModification(message)) {
      return {
        mode: 'modify',
        confidence: 0.85,
        detectionMethod: 'keyword',
        reasoning: 'Existing goal modification pattern detected',
        isContinuation: false,
      };
    }

    // Check for goal creation intent
    if (this.hasGoalCreationIntent(message)) {
      // Check if it's a clear goal or needs exploration
      if (this.isClearGoalStatement(message)) {
        return {
          mode: 'capture',
          confidence: 0.85,
          detectionMethod: 'keyword',
          reasoning: 'Clear goal statement detected - bypassing explore',
          isContinuation: false,
          bypassExplore: true,
          bypassReason: 'clear_goal',
        };
      }

      // Vague goal - needs exploration
      if (this.config.enableExplore) {
        return {
          mode: 'explore',
          confidence: 0.8,
          detectionMethod: 'keyword',
          reasoning: 'Goal creation intent detected - starting exploration',
          isContinuation: false,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIORITY 4: LLM fallback for ambiguous cases
    // ═══════════════════════════════════════════════════════════════════════════
    const llmResult = await this.classifyWithLlm(message, refinementState, exploreState);
    if (llmResult && llmResult.confidence > 0.6) {
      return llmResult;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEFAULT: Fall back to keyword classification
    // ═══════════════════════════════════════════════════════════════════════════
    return this.classifyWithKeywords(message, refinementState);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ★ NEW: Session and command detection
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if there's an active sword session.
   */
  private hasActiveSession(
    exploreState: ExploreState | null,
    refinementState: SwordRefinementState | null
  ): boolean {
    // Check for active explore session
    if (exploreState && !this.isExploreTerminal(exploreState)) {
      return true;
    }

    // Check for active refinement session
    if (refinementState && refinementState.stage !== 'complete') {
      return true;
    }

    return false;
  }

  /**
   * Check if message is an exit command.
   */
  private isExitCommand(message: string): boolean {
    return EXIT_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if message is a skip command.
   */
  private isSkipCommand(message: string): boolean {
    return SKIP_PATTERNS.some((pattern) => pattern.test(message));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPLORE STATE DETECTION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Detect mode when in active explore session.
   */
  private detectWithinExplore(
    message: string,
    exploreState: ExploreState
  ): ModeDetectionResult {
    // Check for confirmation of crystallized goal
    if (exploreState.crystallizedGoal && this.isExploreConfirmation(message)) {
      return {
        mode: 'refine',
        confidence: 0.95,
        detectionMethod: 'explore_state',
        reasoning: 'User confirmed crystallized goal - transitioning to refine',
        isContinuation: true,
      };
    }

    // Continue exploration
    return {
      mode: 'explore',
      confidence: 0.9,
      detectionMethod: 'active_session',
      reasoning: 'Active explore session - continuing dialogue',
      isContinuation: true,
    };
  }

  /**
   * Detect mode when in active refinement session.
   */
  private detectWithinRefinement(
    message: string,
    refinementState: SwordRefinementState
  ): ModeDetectionResult {
    // Check if we're in a stage where confirmation/modification is expected
    const isConfirmingStage = refinementState.stage === 'confirming' || 
                              refinementState.lastProposedPlan !== undefined;

    // Check for confirmation of proposal
    if (isConfirmingStage && this.isConfirmation(message)) {
      return {
        mode: 'create',
        confidence: 0.95,
        detectionMethod: 'confirmation',
        reasoning: 'User confirmed proposed plan',
        isContinuation: true,
      };
    }

    // Check for modification request
    if (isConfirmingStage && this.isModificationRequest(message)) {
      return {
        mode: 'modify',
        confidence: 0.9,
        detectionMethod: 'modification',
        reasoning: 'User wants to modify the proposal',
        isContinuation: true,
      };
    }

    // Continue refinement
    return {
      mode: 'refine',
      confidence: 0.85,
      detectionMethod: 'active_session',
      reasoning: 'Active refinement session - processing answer',
      isContinuation: true,
    };
  }

  /**
   * Check if explore state is terminal.
   */
  private isExploreTerminal(state: ExploreState): boolean {
    return state.stage === 'confirmed' || state.stage === 'skipped';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATTERN MATCHING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check for goal creation intent.
   */
  private hasGoalCreationIntent(message: string): boolean {
    return GOAL_CREATION_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if this is a clear, specific goal statement.
   */
  private isClearGoalStatement(message: string): boolean {
    return CLEAR_GOAL_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if user is confirming.
   */
  private isConfirmation(message: string): boolean {
    return CONFIRMATION_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if user wants modifications.
   */
  private isModificationRequest(message: string): boolean {
    return MODIFICATION_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if user is confirming during exploration.
   */
  private isExploreConfirmation(message: string): boolean {
    return EXPLORE_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if user wants to skip exploration.
   */
  private isSkipExploreRequest(message: string): boolean {
    return SKIP_EXPLORE_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if user wants to modify an existing goal.
   */
  private isExistingGoalModification(message: string): boolean {
    return EXISTING_GOAL_PATTERNS.some((pattern) => pattern.test(message));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // KEYWORD-BASED CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Classify using keyword heuristics.
   */
  private classifyWithKeywords(
    message: string,
    refinementState: SwordRefinementState | null
  ): ModeDetectionResult {
    const lower = message.toLowerCase();

    // Short affirmative responses during active refinement
    if (refinementState && message.length < 50) {
      // Check for time expressions (answering dailyTimeCommitment)
      if (/^\d+\s*(min|minute|hour|hr|m|h)/i.test(message)) {
        return {
          mode: 'refine',
          confidence: 0.85,
          detectionMethod: 'keyword',
          reasoning: 'Time expression detected - answering refinement question',
          isContinuation: true,
        };
      }

      // Check for duration expressions (answering totalDuration)
      if (/^\d+\s*(day|week|month)/i.test(message)) {
        return {
          mode: 'refine',
          confidence: 0.85,
          detectionMethod: 'keyword',
          reasoning: 'Duration expression detected - answering refinement question',
          isContinuation: true,
        };
      }

      // Check for level keywords
      if (/^(beginner|intermediate|advanced|novice|expert)/i.test(message)) {
        return {
          mode: 'refine',
          confidence: 0.88,
          detectionMethod: 'keyword',
          reasoning: 'Skill level detected - answering refinement question',
          isContinuation: true,
        };
      }

      // Check for learning style keywords
      if (/^(video|reading|hands[- ]?on|mixed|practical)/i.test(message)) {
        return {
          mode: 'refine',
          confidence: 0.85,
          detectionMethod: 'keyword',
          reasoning: 'Learning style detected - answering refinement question',
          isContinuation: true,
        };
      }
    }

    // Learning goal patterns
    if (
      lower.includes('learn') ||
      lower.includes('teach me') ||
      lower.includes('study') ||
      lower.includes('master')
    ) {
      return {
        mode: 'capture',
        confidence: 0.75,
        detectionMethod: 'keyword',
        reasoning: 'Learning-related keywords detected',
        isContinuation: false,
      };
    }

    // Default low confidence
    return {
      mode: 'capture',
      confidence: 0.4,
      detectionMethod: 'keyword',
      reasoning: 'No strong keyword signals',
      isContinuation: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LLM CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Classify using LLM.
   */
  private async classifyWithLlm(
    message: string,
    refinementState: SwordRefinementState | null,
    exploreState?: ExploreState | null
  ): Promise<ModeDetectionResult | null> {
    if (!this.openai) {
      return null;
    }

    try {
      // Build context about current state
      const contextParts: string[] = [];

      // Explore state context (Phase 14A)
      if (exploreState && !this.isExploreTerminal(exploreState)) {
        contextParts.push(`Active exploration session: stage=${exploreState.stage}, turns=${exploreState.turnCount}`);
        if (exploreState.crystallizedGoal) {
          contextParts.push(`Proposed goal: "${exploreState.crystallizedGoal}"`);
        }
      } else if (refinementState) {
        contextParts.push(`Active refinement session: stage=${refinementState.stage}`);
        if (refinementState.currentQuestion) {
          contextParts.push(`Current question: ${refinementState.currentQuestion}`);
        }
        if (refinementState.lastProposedPlan) {
          contextParts.push('A lesson plan proposal has been shown to the user');
        }
      } else {
        contextParts.push('No active session');
      }

      const context = contextParts.join('\n');
      const userPrompt = `Context:\n${context}\n\nUser message: "${message}"`;

      const response = await this.openai.chat.completions.create({
        model: this.config.llmModel,
        messages: [
          { role: 'system', content: MODE_DETECTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content?.trim() ?? '';
      const classification = this.parseLlmClassification(content);

      if (!classification) {
        return null;
      }

      // Map LLM result to detection result
      return {
        mode: classification.mode,
        confidence: classification.confidence,
        detectionMethod: 'llm',
        reasoning: classification.reasoning,
        isContinuation: !!(refinementState || exploreState),
      };
    } catch (error) {
      console.error('[MODE_DETECTOR] LLM classification error:', error);
      return null;
    }
  }

  /**
   * Parse LLM classification response.
   */
  private parseLlmClassification(content: string): LlmModeClassification | null {
    try {
      // Handle potential markdown code blocks
      let jsonStr = content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        jsonStr = match?.[1]?.trim() ?? content;
      }

      const parsed = JSON.parse(jsonStr.trim());

      // Validate mode (updated for Phase 14A)
      const validModes: SwordGateMode[] = ['capture', 'explore', 'refine', 'suggest', 'create', 'modify'];
      const mode = validModes.includes(parsed.mode) ? parsed.mode : 'capture';

      return {
        mode,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        isConfirmation: Boolean(parsed.isConfirmation),
        isModification: Boolean(parsed.isModification),
        targetGoalReference: parsed.targetGoalReference,
      };
    } catch {
      console.warn('[MODE_DETECTOR] Failed to parse LLM response:', content);
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a ModeDetector instance.
 */
export function createModeDetector(
  config: SwordGateConfig,
  openaiApiKey?: string
): ModeDetector {
  return new ModeDetector(config, openaiApiKey);
}
