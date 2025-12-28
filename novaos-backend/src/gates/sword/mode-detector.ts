// ═══════════════════════════════════════════════════════════════════════════════
// MODE DETECTOR — SwordGate Mode Classification
// NovaOS Gates — Phase 14A: SwordGate Explore Module
// Phase 18B: Practice Mode Extension
// ═══════════════════════════════════════════════════════════════════════════════
//
// Detects the appropriate SwordGate mode based on:
//   0. Practice mode patterns (Phase 18B) - drill interaction
//   1. Active explore state (continue explore flow)
//   2. Active refinement state (continue refine/suggest flow)
//   3. Confirmation patterns (proceed to create)
//   4. Modification requests (modify existing goal)
//   5. Clear goal statement (skip explore → refine)
//   6. Goal creation intent (start explore for vague goals)
//   7. LLM classification for ambiguous cases
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
  ViewTarget,
  ViewRequest,
  PracticeIntent,
} from './types.js';
import { isViewTarget, isPracticeIntent } from './types.js';

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
  readonly detectionMethod: 'explore_state' | 'refinement_state' | 'confirmation' | 'modification' | 'keyword' | 'llm' | 'default';

  /** Reasoning for the detection */
  readonly reasoning: string;

  /** Existing goal ID if modify mode */
  readonly targetGoalId?: GoalId;

  /** Whether this is a continuation of existing flow */
  readonly isContinuation: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW: Explore bypass flags (Phase 14A)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Whether to bypass explore phase */
  readonly bypassExplore?: boolean;

  /** Reason for bypassing explore */
  readonly bypassReason?: 'clear_goal' | 'user_skip' | 'disabled';

  // ─────────────────────────────────────────────────────────────────────────────
  // View mode fields (Phase 14B)
  // ─────────────────────────────────────────────────────────────────────────────

  /** View target when mode is 'view' */
  readonly viewTarget?: ViewTarget;

  /** Parsed view request details */
  readonly viewRequest?: ViewRequest;

  // ─────────────────────────────────────────────────────────────────────────────
  // Practice mode fields (Phase 18B)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Practice intent when mode is 'practice' */
  readonly practiceIntent?: PracticeIntent;
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
// VIEW MODE PATTERNS (Phase 14B)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Patterns for viewing today's lesson.
 */
const VIEW_TODAY_PATTERNS: RegExp[] = [
  /\b(what'?s|show|get|see)\s+(my\s+)?(today'?s?\s*)?(lesson|task|spark|learning|step)\b/i,
  /\b(today'?s\s+lesson|what do i (learn|do|study) today)\b/i,
  /\b(continue|resume|start)\s+(my\s+)?(learning|lesson|study|studying)\b/i,
  /\bwhat'?s\s+(up\s+)?(for\s+)?today\b/i,
  /\bmy\s+lesson\s+today\b/i,
  /^today'?s?\s*(lesson|spark|step)?\.?$/i,
];

/**
 * Patterns for viewing all goals.
 * Must include explicit view verbs to avoid matching modify phrases like "pause my goal"
 */
const VIEW_GOALS_PATTERNS: RegExp[] = [
  /\b(show|list|see|view|what are)\s+(my\s+|all\s+)?(my\s+)?(goals?|plans?|learning\s+goals?)\b/i,
  /\bwhat\s+(goals?|plans?)\s+do\s+i\s+have\b/i,
  /^(goals?|my goals?)\.?$/i,
  /^(list|show)\s+goals?\.?$/i,
];

/**
 * Patterns for viewing progress.
 */
const VIEW_PROGRESS_PATTERNS: RegExp[] = [
  /\b(show|see|view|what'?s|check)\s+(my\s+)?(progress|status|stats)\b/i,
  /\bhow\s+(am\s+i\s+doing|far\s+along|much\s+progress)\b/i,
  /\bmy\s+progress\b/i,
  /^progress\.?$/i,
];

/**
 * Patterns for viewing full plan.
 * Must include explicit view verbs to avoid matching modify phrases like "update my learning plan"
 */
const VIEW_PLAN_PATTERNS: RegExp[] = [
  /\b(show|see|view)\s+(my\s+|the\s+)?(full\s+|complete\s+|entire\s+)?(plan|curriculum|schedule|syllabus)\b/i,
  /\bwhat'?s\s+(in|on)\s+(my\s+)?(plan|curriculum)\b/i,
  /^(plan|my plan|full plan|show plan|view plan)\.?$/i,
];

/**
 * Patterns for viewing upcoming lessons.
 */
const VIEW_UPCOMING_PATTERNS: RegExp[] = [
  /\b(show|see|view|what'?s)\s+(the\s+)?(upcoming|next|coming)\s*(lessons?|steps?|days?)?\b/i,
  /\bwhat'?s\s+(coming\s+)?next\b/i,
  /\bnext\s+(few\s+)?(lessons?|days?|steps?)\b/i,
  /\bupcoming\s+(lessons?|schedule)?\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE MODE PATTERNS (Phase 18B)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Patterns for viewing today's lesson (practice mode).
 * These take priority over view mode because they're more action-oriented.
 */
const PRACTICE_VIEW_TODAY_PATTERNS: RegExp[] = [
  /what('?s| is)?\s+(my\s+)?(lesson|practice|drill|task)\s*(today|for today)?/i,
  /today('?s)?\s+(lesson|practice|drill|task)/i,
  /what\s+(should|do)\s+i\s+(practice|learn|do)\s*(today)?/i,
  /show\s+(me\s+)?(my\s+)?(today'?s?\s+)?(lesson|practice|drill)/i,
  /^(lesson|practice|drill)\s*(today)?$/i,
  /what('?s| is)?\s+on\s+(the\s+)?agenda/i,
  /^today$/i,
];

/**
 * Patterns for completing practice (pass).
 */
const PRACTICE_COMPLETE_PASS_PATTERNS: RegExp[] = [
  /^(done|finished|completed|did it|i did it|got it|nailed it)\.?$/i,
  /i('?m| am)?\s*(done|finished|completed)/i,
  /i\s+(did|finished|completed)\s+(it|the\s+(lesson|practice|drill|task))/i,
  /^(yes|yep|yeah|yup)[\s,]+(i\s+)?(did|done|finished)/i,
  /mark\s+(it\s+)?(as\s+)?(done|complete|finished|passed)/i,
  /i\s+passed/i,
  /that\s+was\s+(easy|great|good)/i,
  /✅|👍|🎉/,
];

/**
 * Patterns for completing practice (fail).
 */
const PRACTICE_COMPLETE_FAIL_PATTERNS: RegExp[] = [
  /i\s+(couldn'?t|could not|failed|didn'?t|did not)\s+(do\s+it|finish|complete|pass)/i,
  /^(failed|couldn'?t do it|didn'?t pass)\.?$/i,
  /i\s+failed/i,
  /didn'?t\s+(work|go well)/i,
  /mark\s+(it\s+)?(as\s+)?(failed|incomplete)/i,
  /❌|👎/,
];

/**
 * Patterns for skipping practice.
 */
const PRACTICE_SKIP_PATTERNS: RegExp[] = [
  /skip\s+(today|this|it)/i,
  /i('?ll| will)?\s+(skip|pass on)\s+(today|this|it)/i,
  /not\s+today/i,
  /do\s+(it\s+)?tomorrow/i,
  /can'?t\s+(today|do it today)/i,
  /postpone/i,
];

/**
 * Patterns for viewing progress (practice mode).
 */
const PRACTICE_VIEW_PROGRESS_PATTERNS: RegExp[] = [
  /how('?s| is)?\s+(my\s+)?progress/i,
  /(show|what'?s)\s+(my\s+)?progress/i,
  /how\s+am\s+i\s+doing/i,
  /my\s+stats/i,
  /what\s+have\s+i\s+(learned|mastered|completed)/i,
];

/**
 * Patterns for viewing week plan (practice mode).
 */
const PRACTICE_VIEW_WEEK_PATTERNS: RegExp[] = [
  /this\s+week('?s)?\s+(plan|schedule|lessons)/i,
  /what('?s| is)?\s+(the\s+)?week('?s)?\s+(plan|schedule)/i,
  /weekly\s+(plan|schedule|overview)/i,
  /show\s+(me\s+)?(the\s+)?week/i,
];

/**
 * Patterns for viewing all goals (practice mode).
 */
const PRACTICE_VIEW_GOALS_PATTERNS: RegExp[] = [
  /(show|list|view|what('?s| is| are)?)\s+(my\s+)?goals/i,
  /my\s+goals/i,
  /all\s+(my\s+)?goals/i,
  /what\s+am\s+i\s+learning/i,
  /learning\s+goals/i,
];

/**
 * Patterns for deleting a specific goal (practice mode).
 */
const PRACTICE_DELETE_GOAL_PATTERNS: RegExp[] = [
  /delete\s+(goal\s*)?(#?\d+|this|current)/i,
  /remove\s+(goal\s*)?(#?\d+|this|current)/i,
  /cancel\s+(goal\s*)?(#?\d+|this|current)/i,
];

/**
 * Patterns for deleting all goals (practice mode).
 */
const PRACTICE_DELETE_ALL_PATTERNS: RegExp[] = [
  /delete\s+all(\s+(my\s+)?goals)?/i,
  /remove\s+all(\s+(my\s+)?goals)?/i,
  /clear\s+all(\s+goals)?/i,
  /reset\s+(all\s+)?goals/i,
  /start\s+fresh/i,
  /wipe\s+(all\s+)?goals/i,
];

/**
 * Patterns for starting practice early (practice mode).
 */
const PRACTICE_START_NOW_PATTERNS: RegExp[] = [
  /start\s+(now|today|early|my\s+lesson)/i,
  /begin\s+(now|today|early)/i,
  /practice\s+now/i,
  /let('?s| me)?\s+start/i,
  /i\s+want\s+to\s+(start|begin|practice)\s*(now)?$/i,
  /give\s+me\s+(my\s+)?(first\s+)?(lesson|drill)/i,
  /can\s+i\s+start/i,
];

/**
 * Patterns for switching between goals (practice mode).
 */
const PRACTICE_SWITCH_GOAL_PATTERNS: RegExp[] = [
  /switch\s+(to\s+)?goal\s*(#?\d+)/i,
  /use\s+goal\s*(#?\d+)/i,
  /change\s+(to\s+)?goal\s*(#?\d+)/i,
  /select\s+goal\s*(#?\d+)/i,
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
{"mode":"create","confidence":0.98,"reasoning":"Clear confirmation to proceed","isConfirmation":true,"isModification":false}

User: "I want to learn TypeScript for React development"
{"mode":"capture","confidence":0.95,"reasoning":"Clear, specific learning goal","isConfirmation":false,"isModification":false}

User: "I want to get into programming somehow"
{"mode":"explore","confidence":0.88,"reasoning":"Vague goal, needs crystallization","isConfirmation":false,"isModification":false}

User: "About 30 minutes a day"
{"mode":"refine","confidence":0.90,"reasoning":"Answering time commitment question","isConfirmation":false,"isModification":false}

User: "Make it 4 weeks instead"
{"mode":"modify","confidence":0.92,"reasoning":"Requesting change to duration","isConfirmation":false,"isModification":true}

User: "Pause my current goal"
{"mode":"modify","confidence":0.88,"reasoning":"Modifying existing goal","isConfirmation":false,"isModification":true,"targetGoalReference":"current goal"}

═══════════════════════════════════════════════════════════════════════════════
Now classify the following. Return only valid JSON:`;

// ═══════════════════════════════════════════════════════════════════════════════
// MODE DETECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detects the appropriate SwordGate mode for a given input.
 */
export class ModeDetector {
  private openai: OpenAI | null = null;
  private readonly config: SwordGateConfig;

  constructor(config: SwordGateConfig, openaiApiKey?: string) {
    this.config = config;
    const key = openaiApiKey ?? process.env.OPENAI_API_KEY;
    if (key && config.useLlmModeDetection) {
      this.openai = new OpenAI({ apiKey: key });
    }
  }

  /**
   * Detect the appropriate mode for the input.
   *
   * Priority order (Phase 14A updated):
   * 0. Check for view requests → view (Phase 14B)
   * 1. Check active explore state → continue or transition
   * 2. Check active refinement state → continue or transition
   * 3. Check for confirmation patterns → create
   * 4. Check for modification patterns → modify
   * 5. Check for clear goal statement → refine (skip explore)
   * 6. Check for goal creation intent → explore
   * 7. Use LLM classification
   * 8. Default to capture
   */
  async detect(
    input: SwordGateInput,
    refinementState: SwordRefinementState | null,
    exploreState?: ExploreState | null
  ): Promise<ModeDetectionResult> {
    const message = input.message.trim();

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 0: Practice mode requests (Phase 18B)
    // Practice mode takes highest priority for drill interaction.
    // ─────────────────────────────────────────────────────────────────────────
    const practiceResult = this.detectPracticeIntent(message);
    if (practiceResult) {
      return {
        mode: 'practice',
        confidence: practiceResult.confidence,
        detectionMethod: 'keyword',
        reasoning: practiceResult.reasoning,
        isContinuation: false,
        practiceIntent: practiceResult.intent,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 0.5: View requests (Phase 14B)
    // View mode takes precedence to allow users to check content anytime.
    // ─────────────────────────────────────────────────────────────────────────
    const viewResult = this.detectViewIntent(message);
    if (viewResult) {
      return {
        mode: 'view',
        confidence: viewResult.confidence,
        detectionMethod: 'keyword',
        reasoning: viewResult.reasoning,
        isContinuation: false,
        viewTarget: viewResult.target,
        viewRequest: {
          target: viewResult.target,
        },
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 1: Active explore state (Phase 14A)
    // ─────────────────────────────────────────────────────────────────────────
    if (exploreState && !this.isExploreTerminal(exploreState)) {
      // Check if user wants to skip exploration
      if (this.isSkipExploreRequest(message)) {
        return {
          mode: 'refine',
          confidence: 0.90,
          detectionMethod: 'explore_state',
          reasoning: 'User requested to skip exploration',
          isContinuation: false,
          bypassExplore: true,
          bypassReason: 'user_skip',
        };
      }

      // Check if user is confirming a proposed goal
      if (this.isExploreConfirmation(message) && exploreState.stage === 'proposing') {
        return {
          mode: 'refine',
          confidence: 0.92,
          detectionMethod: 'explore_state',
          reasoning: 'User confirmed crystallized goal, transitioning to refinement',
          isContinuation: false,
        };
      }

      // Continue exploration
      return {
        mode: 'explore',
        confidence: 0.95,
        detectionMethod: 'explore_state',
        reasoning: 'Active exploration session in progress',
        isContinuation: true,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 2: Active refinement in confirming stage
    // ─────────────────────────────────────────────────────────────────────────
    if (refinementState?.stage === 'confirming') {
      // Check if user is confirming the proposed plan
      if (this.isConfirmation(message)) {
        return {
          mode: 'create',
          confidence: 0.95,
          detectionMethod: 'confirmation',
          reasoning: 'User confirmed proposed plan',
          isContinuation: true,
        };
      }

      // Check if user wants modifications
      if (this.isModificationRequest(message)) {
        return {
          mode: 'modify',
          confidence: 0.88,
          detectionMethod: 'modification',
          reasoning: 'User requested modifications to proposed plan',
          isContinuation: true,
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 3: Existing goal modification
    // ─────────────────────────────────────────────────────────────────────────
    if (this.isExistingGoalModification(message)) {
      return {
        mode: 'modify',
        confidence: 0.85,
        detectionMethod: 'modification',
        reasoning: 'User wants to modify an existing goal',
        isContinuation: false,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 4: Active refinement (answering questions)
    // ─────────────────────────────────────────────────────────────────────────
    if (refinementState?.stage === 'clarifying') {
      // Use keyword heuristics for short responses
      if (message.length < 100) {
        const keywordResult = this.classifyWithKeywords(message, refinementState);
        if (keywordResult.confidence >= 0.7) {
          return keywordResult;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 5: Clear goal statement → skip explore (Phase 14A)
    // ─────────────────────────────────────────────────────────────────────────
    if (this.config.enableExplore && this.isClearGoalStatement(message)) {
      return {
        mode: 'capture',
        confidence: 0.88,
        detectionMethod: 'keyword',
        reasoning: 'Clear, specific goal detected - skipping exploration',
        isContinuation: false,
        bypassExplore: true,
        bypassReason: 'clear_goal',
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 6: Goal creation intent → explore (Phase 14A)
    // ─────────────────────────────────────────────────────────────────────────
    if (this.config.enableExplore && this.isGoalCreationIntent(message, input.intent)) {
      // Check if user wants to skip exploration
      if (this.isSkipExploreRequest(message)) {
        return {
          mode: 'capture',
          confidence: 0.85,
          detectionMethod: 'keyword',
          reasoning: 'Goal creation with skip exploration request',
          isContinuation: false,
          bypassExplore: true,
          bypassReason: 'user_skip',
        };
      }

      // Route to explore for vague goals
      return {
        mode: 'explore',
        confidence: 0.82,
        detectionMethod: 'keyword',
        reasoning: 'Goal creation intent - starting exploration',
        isContinuation: false,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 7: Goal creation intent (explore disabled)
    // ─────────────────────────────────────────────────────────────────────────
    if (!this.config.enableExplore && this.isGoalCreationIntent(message, input.intent)) {
      return {
        mode: 'capture',
        confidence: 0.85,
        detectionMethod: 'keyword',
        reasoning: 'Learning goal creation intent detected',
        isContinuation: false,
        bypassExplore: true,
        bypassReason: 'disabled',
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 8: LLM classification (if enabled)
    // ─────────────────────────────────────────────────────────────────────────
    if (this.config.useLlmModeDetection && this.openai) {
      const llmResult = await this.classifyWithLlm(message, refinementState, exploreState);
      if (llmResult && llmResult.confidence >= 0.7) {
        return llmResult;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 9: Keyword fallback
    // ─────────────────────────────────────────────────────────────────────────
    const keywordResult = this.classifyWithKeywords(message, refinementState);
    if (keywordResult.confidence >= 0.5) {
      return keywordResult;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Default: Capture mode
    // ─────────────────────────────────────────────────────────────────────────
    return {
      mode: 'capture',
      confidence: 0.4,
      detectionMethod: 'default',
      reasoning: 'No strong signals detected, defaulting to capture',
      isContinuation: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATTERN MATCHERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if message is a confirmation.
   */
  private isConfirmation(message: string): boolean {
    return CONFIRMATION_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if message is requesting modifications.
   */
  private isModificationRequest(message: string): boolean {
    return MODIFICATION_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if message is about modifying an existing goal.
   */
  private isExistingGoalModification(message: string): boolean {
    return EXISTING_GOAL_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if message indicates goal creation intent.
   */
  private isGoalCreationIntent(message: string, intent?: Intent): boolean {
    // Check intent type from IntentGate
    if (intent?.type === 'action' || intent?.type === 'planning') {
      if (GOAL_CREATION_PATTERNS.some((pattern) => pattern.test(message))) {
        return true;
      }
    }

    // Direct pattern match
    return GOAL_CREATION_PATTERNS.some((pattern) => pattern.test(message));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW: EXPLORE-RELATED HELPERS (Phase 14A)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if explore state is terminal (no longer active).
   */
  private isExploreTerminal(state: ExploreState): boolean {
    return ['confirmed', 'skipped', 'expired'].includes(state.stage);
  }

  /**
   * Check if user wants to skip exploration.
   */
  private isSkipExploreRequest(message: string): boolean {
    return SKIP_EXPLORE_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Check if user is confirming during exploration.
   */
  private isExploreConfirmation(message: string): boolean {
    return EXPLORE_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(message));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW MODE DETECTION (Phase 14B)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Detect if message is a view request and determine the target.
   * Returns null if not a view request.
   */
  private detectViewIntent(message: string): {
    target: ViewTarget;
    confidence: number;
    reasoning: string;
  } | null {
    // Check patterns in priority order (most specific first)

    // Progress (most specific)
    if (VIEW_PROGRESS_PATTERNS.some((p) => p.test(message))) {
      return {
        target: 'progress',
        confidence: 0.90,
        reasoning: 'Progress/status view request detected',
      };
    }

    // Plan (specific)
    if (VIEW_PLAN_PATTERNS.some((p) => p.test(message))) {
      return {
        target: 'plan',
        confidence: 0.88,
        reasoning: 'Full plan view request detected',
      };
    }

    // Upcoming (specific)
    if (VIEW_UPCOMING_PATTERNS.some((p) => p.test(message))) {
      return {
        target: 'upcoming',
        confidence: 0.85,
        reasoning: 'Upcoming lessons view request detected',
      };
    }

    // Goals (general list)
    if (VIEW_GOALS_PATTERNS.some((p) => p.test(message))) {
      return {
        target: 'goals',
        confidence: 0.88,
        reasoning: 'Goals list view request detected',
      };
    }

    // Today (default view, checked last)
    if (VIEW_TODAY_PATTERNS.some((p) => p.test(message))) {
      return {
        target: 'today',
        confidence: 0.92,
        reasoning: "Today's lesson view request detected",
      };
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRACTICE MODE DETECTION (Phase 18B)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if message is a practice-related query.
   * Public method for external use (e.g., by SwordGate).
   */
  isPracticeQuery(message: string): boolean {
    return this.detectPracticeIntent(message) !== null;
  }

  /**
   * Detect if message is a practice request and determine the intent.
   * Returns null if not a practice request.
   */
  private detectPracticeIntent(message: string): {
    intent: PracticeIntent;
    confidence: number;
    reasoning: string;
  } | null {
    const trimmed = message.trim();

    // Check patterns in order of specificity (most specific first)

    // Delete all (must check before delete_goal to avoid false matches)
    if (PRACTICE_DELETE_ALL_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'delete_all',
        confidence: 0.95,
        reasoning: 'Delete all goals request detected',
      };
    }

    // Delete specific goal
    if (PRACTICE_DELETE_GOAL_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'delete_goal',
        confidence: 0.92,
        reasoning: 'Delete specific goal request detected',
      };
    }

    // Switch goal
    if (PRACTICE_SWITCH_GOAL_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'switch_goal',
        confidence: 0.90,
        reasoning: 'Switch goal request detected',
      };
    }

    // Start now (practice early)
    if (PRACTICE_START_NOW_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'start_now',
        confidence: 0.92,
        reasoning: 'Start practice now request detected',
      };
    }

    // View goals
    if (PRACTICE_VIEW_GOALS_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'view_goals',
        confidence: 0.90,
        reasoning: 'View goals request detected',
      };
    }

    // Complete pass (most specific action)
    if (PRACTICE_COMPLETE_PASS_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'complete_pass',
        confidence: 0.95,
        reasoning: 'Practice completion (pass) detected',
      };
    }

    // Complete fail
    if (PRACTICE_COMPLETE_FAIL_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'complete_fail',
        confidence: 0.92,
        reasoning: 'Practice completion (fail) detected',
      };
    }

    // Skip
    if (PRACTICE_SKIP_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'skip',
        confidence: 0.90,
        reasoning: 'Practice skip request detected',
      };
    }

    // View progress
    if (PRACTICE_VIEW_PROGRESS_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'view_progress',
        confidence: 0.88,
        reasoning: 'Progress view request detected',
      };
    }

    // View week
    if (PRACTICE_VIEW_WEEK_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'view_week',
        confidence: 0.85,
        reasoning: 'Week plan view request detected',
      };
    }

    // View today (default practice action, checked last)
    if (PRACTICE_VIEW_TODAY_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        intent: 'view_today',
        confidence: 0.90,
        reasoning: "Today's practice view request detected",
      };
    }

    return null;
  }

  /**
   * Check if message contains a clear, specific goal statement.
   */
  private isClearGoalStatement(message: string): boolean {
    return CLEAR_GOAL_PATTERNS.some((pattern) => pattern.test(message));
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

      // Validate mode (updated for Phase 14A + 18B)
      const validModes: SwordGateMode[] = ['capture', 'explore', 'refine', 'suggest', 'create', 'modify', 'view', 'practice'];
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
