// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE TYPES — Goal Creation Pipeline Gate
// NovaOS Gates — Phase 14B: SwordGate View Mode Extension
// Phase 18B: Practice Mode Extension
// ═══════════════════════════════════════════════════════════════════════════════
//
// Type definitions for SwordGate:
//   - SwordGateMode: Operating modes (capture, explore, refine, suggest, create, modify, view, practice)
//   - SwordGateInput: Pipeline input to the gate
//   - SwordGateOutput: Gate result with mode-specific data
//   - SwordRefinementState: Extended refinement state for goal creation
//   - LessonPlanProposal: Proposed plan shown before creation
//   - ViewTarget/ViewRequest: View mode types (Phase 14B)
//   - PracticeIntent: Practice mode types (Phase 18B)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  UserId,
  GoalId,
  QuestId,
  Timestamp,
} from '../../types/branded.js';
import type {
  Goal,
  Quest,
  LearningConfig,
  UserLevel,
  LearningStyle,
  DayOfWeek,
  ReminderConfig,
} from '../../services/spark-engine/types.js';
import type { Intent, RiskSummary, Stance } from '../../helpers/types.js';

// Phase 14A: Import ExploreContext
import type { ExploreContext } from './explore/types.js';

// Re-export for convenience
export type { ExploreContext };

// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE MODES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SwordGate operating modes.
 *
 * The gate transitions through these modes during goal creation:
 *
 * 1. capture  → Extract goal statement from user message
 * 2. explore  → NEW: Goal crystallization dialogue for vague goals
 * 3. refine   → Multi-turn clarification of learning preferences
 * 4. suggest  → Generate and display lesson plan proposal
 * 5. create   → Create goal and quests after user confirmation
 * 6. modify   → Update existing goals
 * 7. view     → View existing goals/lessons/progress (Phase 14B)
 * 8. practice → Interactive practice flow (Phase 18B)
 */
export type SwordGateMode =
  | 'capture'   // Initial goal statement extraction
  | 'explore'   // Goal crystallization dialogue
  | 'refine'    // Multi-turn clarification
  | 'suggest'   // Show proposed lesson plan
  | 'create'    // Create goal after confirmation
  | 'modify'    // Modify existing goal
  | 'view'      // View existing goals/lessons/progress (Phase 14B)
  | 'practice'; // Interactive practice flow (Phase 18B)

/**
 * All valid SwordGate modes.
 */
export const SWORD_GATE_MODES: readonly SwordGateMode[] = [
  'capture',
  'explore',
  'refine',
  'suggest',
  'create',
  'modify',
  'view',     // Phase 14B
  'practice', // Phase 18B
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW MODE TYPES (Phase 14B)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Specifies what content the user wants to view.
 */
export type ViewTarget =
  | 'today'       // Today's lesson and spark
  | 'goals'       // List all user goals
  | 'progress'    // Progress for specific goal
  | 'plan'        // Full learning plan/curriculum
  | 'upcoming';   // Next N days of lessons

/**
 * All valid view targets.
 */
export const VIEW_TARGETS: readonly ViewTarget[] = [
  'today',
  'goals',
  'progress',
  'plan',
  'upcoming',
] as const;

/**
 * Type guard for ViewTarget.
 */
export function isViewTarget(value: unknown): value is ViewTarget {
  return typeof value === 'string' && VIEW_TARGETS.includes(value as ViewTarget);
}

/**
 * Parsed view request with target and optional identifiers.
 */
export interface ViewRequest {
  /** What to view */
  readonly target: ViewTarget;

  /** Optional goal ID for goal-specific views */
  readonly goalId?: GoalId;

  /** Optional quest ID for quest-specific views */
  readonly questId?: QuestId;

  /** Number of items to return (for 'upcoming') */
  readonly count?: number;

  /** Whether to include detailed information */
  readonly detailed?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE MODE TYPES (Phase 18B)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Practice intent detected from user message.
 * Phase 18B: Practice mode for chat-based drill interaction.
 * Phase 19C: Multi-goal support intents.
 */
export type PracticeIntent =
  | 'view_today'      // "What's my lesson today?"
  | 'complete_pass'   // "I finished", "I did it", "Done"
  | 'complete_fail'   // "I couldn't do it", "I failed"
  | 'skip'            // "Skip today", "I'll do it tomorrow"
  | 'view_progress'   // "Show my progress", "How am I doing?"
  | 'view_week'       // "What's this week's plan?"
  | 'view_milestone'  // "Show milestone", "What's the milestone?" [Phase 19F]
  | 'view_goals'      // "Show my goals", "List goals"
  | 'delete_goal'     // "Delete goal 1", "Remove this goal"
  | 'delete_all'      // "Delete all goals", "Clear all"
  | 'start_now'       // "Start now", "Begin today"
  | 'switch_goal'     // "Switch to goal 2"
  // Phase 19C: Multi-goal intents
  | 'view_bundle'     // "What should I practice?", "Today's practice"
  | 'select_goal'     // "Practice goal 2", "Focus on Rust"
  | 'pause_goal'      // "Pause this goal", "Pause for a week"
  | 'resume_goal'     // "Resume goal", "Unpause"
  | 'set_priority'    // "Make this priority 1", "Set priority"
  // Phase 19D: Additional intents
  | 'cancel'          // "Cancel", "Nevermind", "Exit", "Go back"
  | 'unknown';

/**
 * All valid practice intents.
 */
export const PRACTICE_INTENTS: readonly PracticeIntent[] = [
  'view_today',
  'complete_pass',
  'complete_fail',
  'skip',
  'view_progress',
  'view_week',
  'view_milestone',
  'view_goals',
  'delete_goal',
  'delete_all',
  'start_now',
  'switch_goal',
  // Phase 19C
  'view_bundle',
  'select_goal',
  'pause_goal',
  'resume_goal',
  'set_priority',
  // Phase 19D
  'cancel',
  'unknown',
] as const;

/**
 * Type guard for PracticeIntent.
 */
export function isPracticeIntent(value: unknown): value is PracticeIntent {
  return typeof value === 'string' && PRACTICE_INTENTS.includes(value as PracticeIntent);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE INPUT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Conversation message for history context.
 */
export interface ConversationMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp?: Timestamp;
}

/**
 * User preferences relevant to goal creation.
 */
export interface SwordUserPreferences {
  /** Default timezone for reminders */
  readonly timezone?: string;

  /** Default learning style */
  readonly defaultLearningStyle?: LearningStyle;

  /** Preferred active days */
  readonly preferredDays?: readonly DayOfWeek[];

  /** Default daily time commitment (minutes) */
  readonly defaultDailyMinutes?: number;
}

/**
 * Input to SwordGate from the pipeline.
 */
export interface SwordGateInput {
  /** User ID */
  readonly userId: UserId;

  /** Current user message */
  readonly message: string;

  /** Conversation history for context */
  readonly conversationHistory?: readonly ConversationMessage[];

  /** Intent classification from IntentGate */
  readonly intent?: Intent;

  /** Risk assessment from ShieldGate */
  readonly shield?: RiskSummary;

  /** Current stance */
  readonly stance?: Stance;

  /** User preferences for goal creation */
  readonly userPreferences?: SwordUserPreferences;

  /** Existing goal ID (for modify mode) */
  readonly existingGoalId?: GoalId;

  /** Session ID for correlation */
  readonly sessionId?: string;

  /** Request ID for tracing */
  readonly requestId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON PLAN PROPOSAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A quest in the proposed lesson plan.
 */
export interface ProposedQuest {
  /** Quest title (e.g., "Week 1: Rust Fundamentals") */
  readonly title: string;

  /** Quest description */
  readonly description: string;

  /** Topics covered in this quest */
  readonly topics: readonly string[];

  /**
   * Estimated number of days.
   * Phase 19A: Optional for ongoing goals.
   */
  readonly estimatedDays?: number;

  /** Order in the plan (1-based) */
  readonly order: number;
}

/**
 * Lesson plan proposal shown to user before creation.
 *
 * This is a preview of what will be created, allowing the user
 * to confirm or request modifications.
 */
export interface LessonPlanProposal {
  /** Proposed goal title */
  readonly title: string;

  /** Proposed goal description */
  readonly description: string;

  /** Learning configuration derived from refinement */
  readonly learningConfig: LearningConfig;

  /** Proposed quests (weeks/sections) */
  readonly quests: readonly ProposedQuest[];

  /** Total estimated duration (e.g., "6 weeks") */
  readonly totalDuration: string;

  /**
   * Total number of learning days.
   * Phase 19A: Optional for ongoing goals.
   */
  readonly totalDays?: number;

  /** Topics that will be covered */
  readonly topicsCovered: readonly string[];

  /** Identified gaps or limitations */
  readonly gaps?: readonly string[];

  /** Resource count found */
  readonly resourcesFound: number;

  /** Confidence in the plan quality */
  readonly confidence: 'high' | 'medium' | 'low';

  /** Generation timestamp */
  readonly generatedAt: Timestamp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rate limit information when goal creation is blocked.
 */
export interface GoalRateLimitInfo {
  /** Whether rate limit was exceeded */
  readonly exceeded: boolean;

  /** Current number of goals */
  readonly currentCount: number;

  /** Maximum allowed goals */
  readonly maxAllowed: number;

  /** When the limit resets (if applicable) */
  readonly resetsAt?: Timestamp;

  /** Human-readable message */
  readonly message: string;
}

/**
 * Created goal result after successful creation.
 */
export interface CreatedGoalResult {
  /** The created goal */
  readonly goal: Goal;

  /** Created quests */
  readonly quests: readonly Quest[];

  /** Summary message for the user */
  readonly summary: string;

  /** When steps will be generated */
  readonly stepsGenerationScheduled: boolean;
}

/**
 * Output from SwordGate.
 *
 * The output varies based on the mode:
 * - capture: Extracted goal statement, transition to refine
 * - explore: Exploration dialogue response
 * - refine: Next question to ask, updated refinement state
 * - suggest: Proposed lesson plan for confirmation
 * - create: Created goal and quests
 * - modify: Updated goal
 * - view: View content (Phase 14B)
 * - practice: Practice interaction (Phase 18B)
 */
export interface SwordGateOutput {
  /** Detected/executed mode */
  readonly mode: SwordGateMode;

  // ─────────────────────────────────────────────────────────────────────────────
  // Exploration Flow (NEW - Phase 14A)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Whether exploration is in progress */
  readonly explorationInProgress?: boolean;

  /** Exploration context (when transitioning from explore to refine) */
  readonly exploreContext?: ExploreContext;

  /** Clarity score from exploration (0-1) */
  readonly clarityScore?: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Refinement Flow
  // ─────────────────────────────────────────────────────────────────────────────

  /** Next question to ask user (refine mode) */
  readonly nextQuestion?: string;

  /** Current refinement progress (0-1) */
  readonly refinementProgress?: number;

  /** Fields still missing */
  readonly missingFields?: readonly RefinementField[];

  /** Whether refinement is complete */
  readonly refinementComplete?: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Lesson Plan Proposal
  // ─────────────────────────────────────────────────────────────────────────────

  /** Proposed lesson plan (suggest mode) */
  readonly proposedPlan?: LessonPlanProposal;

  /** Whether user confirmation is required */
  readonly confirmationRequired?: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Goal Creation
  // ─────────────────────────────────────────────────────────────────────────────

  /** Created goal result (create mode) */
  readonly createdGoal?: CreatedGoalResult;

  /** Rate limit information */
  readonly rateLimit?: GoalRateLimitInfo;

  // ─────────────────────────────────────────────────────────────────────────────
  // Goal Modification
  // ─────────────────────────────────────────────────────────────────────────────

  /** Updated goal (modify mode) */
  readonly updatedGoal?: Goal;

  /** What was modified */
  readonly modifications?: readonly string[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Response Generation
  // ─────────────────────────────────────────────────────────────────────────────

  /** Response message for the user */
  readonly responseMessage?: string;

  /** Whether to suppress normal model generation */
  readonly suppressModelGeneration?: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // View Mode (Phase 14B)
  // ─────────────────────────────────────────────────────────────────────────────

  /** View target when in view mode */
  readonly viewTarget?: ViewTarget;

  /** Formatted view response message */
  readonly viewMessage?: string;

  /** Whether view found content */
  readonly viewHasContent?: boolean;

  /** Suggested actions after viewing */
  readonly viewSuggestedActions?: readonly string[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Practice Flow (Phase 18B)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Practice intent that was handled */
  readonly practiceIntent?: PracticeIntent;

  /** Today's drill info (for practice mode) */
  readonly todayDrill?: {
    readonly action: string;
    readonly passSignal: string;
    readonly constraint?: string;
    readonly skillName?: string;
  };

  /** Whether practice was completed */
  readonly practiceCompleted?: boolean;

  /** Whether practice was skipped */
  readonly practiceSkipped?: boolean;

  /** Practice progress summary */
  readonly practiceProgress?: {
    readonly totalSkills: number;
    readonly mastered: number;
    readonly practicing: number;
    readonly attempted: number;
    readonly notStarted: number;
    readonly streakDays?: number;
  };

  /** List of user's goals (for view_goals) */
  readonly practiceGoals?: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly createdAt: string;
  }[];

  /** Whether a goal was deleted */
  readonly practiceDeleted?: boolean;

  /** Count of deleted goals */
  readonly practiceDeletedCount?: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Multi-Goal Bundle (Phase 19C)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Multi-goal practice bundle.
   * Contains practices for ALL active goals, sorted by priority.
   * Phase 19C: Multi-goal support.
   */
  readonly practiceBundle?: {
    /** Today's date */
    readonly date: string;

    /** Total active goals */
    readonly totalActiveGoals: number;

    /** Goals with practice available */
    readonly entries: readonly {
      readonly goalId: string;
      readonly goalTitle: string;
      readonly priority: number;
      readonly isPrimary: boolean;
      readonly hasPractice: boolean;
      readonly priorityReason: string;
      /** Drill action if available */
      readonly action?: string;
      /** Skill being practiced */
      readonly skillName?: string;
    }[];

    /** Primary goal ID (if any) */
    readonly primaryGoalId?: string;

    /** Primary goal title (if any) */
    readonly primaryGoalTitle?: string;

    /** Goals paused count */
    readonly pausedCount: number;

    /** Goals completed for today */
    readonly completedTodayCount: number;

    /** Whether any practice is available */
    readonly hasPractice: boolean;

    /** Summary message */
    readonly summary: string;
  };

  /**
   * Selected goal for practice (when user chooses from bundle).
   * Phase 19C: Goal selection support.
   */
  readonly selectedGoalId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFINEMENT STATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fields that can be collected during refinement.
 */
export type RefinementField =
  | 'goalStatement'
  | 'userLevel'
  | 'dailyTimeCommitment'
  | 'totalDuration'
  | 'learningStyle'
  | 'startDate'
  | 'activeDays'
  | 'reminderPreferences';

/**
 * All refinement fields in collection order.
 */
export const REFINEMENT_FIELDS: readonly RefinementField[] = [
  'goalStatement',
  'userLevel',
  'dailyTimeCommitment',
  'totalDuration',
  'learningStyle',
  'startDate',
  'activeDays',
  'reminderPreferences',
] as const;

/**
 * Required fields that must be collected before plan generation.
 */
export const REQUIRED_REFINEMENT_FIELDS: readonly RefinementField[] = [
  'goalStatement',
  'userLevel',
  'dailyTimeCommitment',
  'totalDuration',
] as const;

/**
 * Optional fields that enhance the plan but aren't required.
 */
export const OPTIONAL_REFINEMENT_FIELDS: readonly RefinementField[] = [
  'learningStyle',
  'startDate',
  'activeDays',
  'reminderPreferences',
] as const;

/**
 * Clarified inputs collected during refinement.
 *
 * Extends the generic `inputs` from RefinementState with
 * strongly-typed fields specific to goal creation.
 */
export interface SwordRefinementInputs {
  /** Raw goal statement from user */
  readonly goalStatement?: string;

  /** Sanitized goal statement */
  readonly sanitizedGoalStatement?: string;

  /** Extracted topic from goal statement */
  readonly extractedTopic?: string;

  /** User's current skill level */
  readonly userLevel?: UserLevel;

  /** Daily time commitment in minutes */
  readonly dailyTimeCommitment?: number;

  /**
   * Total duration (e.g., "6 weeks", "30 days", "ongoing").
   * For ongoing goals, this will be "ongoing".
   */
  readonly totalDuration?: string;

  /**
   * Parsed total days.
   * Undefined for ongoing goals.
   */
  readonly totalDays?: number;

  /**
   * Explicit duration type.
   * Derived from totalDuration parsing.
   * Phase 19A addition.
   */
  readonly durationType?: 'fixed' | 'ongoing';

  /** Preferred learning style */
  readonly learningStyle?: LearningStyle;

  /** Desired start date (YYYY-MM-DD) */
  readonly startDate?: string;

  /** Active learning days */
  readonly activeDays?: readonly DayOfWeek[];

  /** Whether user wants reminders */
  readonly remindersEnabled?: boolean;

  /** First reminder hour (0-23) */
  readonly firstReminderHour?: number;

  /** Last reminder hour (0-23) */
  readonly lastReminderHour?: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW: Explore context (Phase 14A)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Context from exploration phase */
  readonly exploreContext?: ExploreContext;
}

/**
 * Extended refinement state for SwordGate.
 *
 * Builds on the base RefinementState from Phase 12 with
 * SwordGate-specific tracking.
 */
export interface SwordRefinementState {
  /** User ID */
  readonly userId: UserId;

  /** Associated goal ID (when modifying) */
  readonly goalId?: GoalId;

  /** Current refinement stage */
  readonly stage: 'initial' | 'clarifying' | 'confirming' | 'complete';

  /** Typed inputs collected during refinement */
  readonly inputs: SwordRefinementInputs;

  /** Current question being asked */
  readonly currentQuestion?: RefinementField;

  /** Questions already answered */
  readonly answeredQuestions: readonly RefinementField[];

  /** Number of conversation turns */
  readonly turnCount: number;

  /** Maximum allowed turns */
  readonly maxTurns: number;

  /** Created timestamp */
  readonly createdAt: Timestamp;

  /** Last updated timestamp */
  readonly updatedAt: Timestamp;

  /** Expiration timestamp */
  readonly expiresAt: Timestamp;

  /** Last proposed plan (for modification requests) */
  readonly lastProposedPlan?: LessonPlanProposal;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SwordGate configuration.
 */
export interface SwordGateConfig {
  /** Maximum goals per user */
  readonly maxGoalsPerUser: number;

  /** Maximum active goals per user */
  readonly maxActiveGoals: number;

  /** Maximum refinement turns before timeout */
  readonly maxRefinementTurns: number;

  /** Refinement state TTL in seconds */
  readonly refinementTtlSeconds: number;

  /** Minimum daily time commitment (minutes) */
  readonly minDailyMinutes: number;

  /** Maximum daily time commitment (minutes) */
  readonly maxDailyMinutes: number;

  /** Minimum total duration (days) */
  readonly minTotalDays: number;

  /** Maximum total duration (days) */
  readonly maxTotalDays: number;

  /** Allow ongoing goals with no fixed end date (Phase 19A) */
  readonly allowOngoingGoals: boolean;

  /** Maximum goal statement length */
  readonly maxGoalStatementLength: number;

  /** Enable LLM-powered mode detection */
  readonly useLlmModeDetection: boolean;

  /** OpenAI model for classification */
  readonly llmModel: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW: Explore configuration (Phase 14A)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable explore phase for vague goals (default: true) */
  readonly enableExplore: boolean;

  /** Maximum explore turns before forced transition (default: 12) */
  readonly maxExploreTurns: number;

  /** Clarity threshold to skip explore (default: 0.8) */
  readonly exploreClarityThreshold: number;

  /** Explore state TTL in seconds (default: 7200 = 2 hours) */
  readonly exploreTtlSeconds: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // View configuration (Phase 14B)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Default number of upcoming days to show (default: 7) */
  readonly viewDefaultUpcomingDays: number;

  /** Maximum goals to return in list (default: 20) */
  readonly viewMaxGoalsToList: number;

  /** Whether to include progress in goal list (default: true) */
  readonly viewIncludeProgressInList: boolean;
}

/**
 * Default SwordGate configuration.
 */
export const DEFAULT_SWORD_GATE_CONFIG: SwordGateConfig = {
  maxGoalsPerUser: 10,
  maxActiveGoals: 3,
  maxRefinementTurns: 10,
  refinementTtlSeconds: 60 * 60, // 1 hour
  minDailyMinutes: 5,
  maxDailyMinutes: 480, // 8 hours
  // Phase 19A: Allow 1-day minimum, no maximum
  minTotalDays: 1,
  maxTotalDays: Infinity,
  allowOngoingGoals: true,
  maxGoalStatementLength: 500,
  useLlmModeDetection: true,
  llmModel: 'gpt-4o-mini',
  // NEW: Explore config
  enableExplore: true,
  maxExploreTurns: 12,
  exploreClarityThreshold: 0.8,
  exploreTtlSeconds: 2 * 60 * 60, // 2 hours
  // Phase 14B: View config
  viewDefaultUpcomingDays: 7,
  viewMaxGoalsToList: 20,
  viewIncludeProgressInList: true,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a value is a valid SwordGateMode.
 */
export function isSwordGateMode(value: unknown): value is SwordGateMode {
  return typeof value === 'string' && SWORD_GATE_MODES.includes(value as SwordGateMode);
}

/**
 * Check if a value is a valid RefinementField.
 */
export function isRefinementField(value: unknown): value is RefinementField {
  return typeof value === 'string' && REFINEMENT_FIELDS.includes(value as RefinementField);
}

/**
 * Check if all required refinement fields are present.
 *
 * Phase 19A: Ongoing goals don't require totalDays.
 */
export function hasRequiredFields(inputs: SwordRefinementInputs): boolean {
  // Base requirements (always needed)
  const hasBase = (
    !!inputs.goalStatement &&
    !!inputs.userLevel &&
    typeof inputs.dailyTimeCommitment === 'number' &&
    inputs.dailyTimeCommitment > 0
  );

  if (!hasBase) {
    return false;
  }

  // Must have totalDuration
  if (!inputs.totalDuration) {
    return false;
  }

  // Ongoing goals: totalDuration is sufficient, no totalDays needed
  if (inputs.totalDuration === 'ongoing' || inputs.durationType === 'ongoing') {
    return true;
  }

  // Fixed goals: need totalDays as well
  return typeof inputs.totalDays === 'number' && inputs.totalDays > 0;
}

/**
 * Get missing required fields from inputs.
 */
export function getMissingRequiredFields(inputs: SwordRefinementInputs): RefinementField[] {
  const missing: RefinementField[] = [];

  if (!inputs.goalStatement) missing.push('goalStatement');
  if (!inputs.userLevel) missing.push('userLevel');
  if (typeof inputs.dailyTimeCommitment !== 'number') missing.push('dailyTimeCommitment');
  if (!inputs.totalDuration) missing.push('totalDuration');

  return missing;
}

/**
 * Calculate refinement progress (0-1).
 */
export function calculateRefinementProgress(inputs: SwordRefinementInputs): number {
  const required = REQUIRED_REFINEMENT_FIELDS.length;
  let filled = 0;

  if (inputs.goalStatement) filled++;
  if (inputs.userLevel) filled++;
  if (typeof inputs.dailyTimeCommitment === 'number') filled++;
  if (inputs.totalDuration) filled++;

  return filled / required;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DURATION HELPERS (Phase 19A)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate duration configuration.
 *
 * @param totalDuration - Duration string
 * @param totalDays - Parsed days (undefined for ongoing)
 * @param config - SwordGate config
 * @returns Error message or undefined if valid
 */
export function validateDuration(
  totalDuration: string | undefined,
  totalDays: number | undefined,
  config: SwordGateConfig
): string | undefined {
  if (!totalDuration) {
    return 'Total duration is required';
  }

  // Ongoing goals
  if (isOngoingDuration(totalDuration)) {
    if (!config.allowOngoingGoals) {
      return 'Ongoing goals are not enabled';
    }
    return undefined; // Valid ongoing goal
  }

  // Fixed goals need valid totalDays
  if (typeof totalDays !== 'number' || totalDays <= 0) {
    return 'Could not parse duration into days';
  }

  if (totalDays < config.minTotalDays) {
    return `Duration must be at least ${config.minTotalDays} day${config.minTotalDays > 1 ? 's' : ''}`;
  }

  if (isFinite(config.maxTotalDays) && totalDays > config.maxTotalDays) {
    return `Duration cannot exceed ${config.maxTotalDays} days`;
  }

  return undefined; // Valid
}

/**
 * Check if duration represents an ongoing goal.
 *
 * @param totalDuration - Duration string
 * @returns true if ongoing
 */
export function isOngoingDuration(totalDuration: string | undefined): boolean {
  if (!totalDuration) {
    return false;
  }
  const lower = totalDuration.toLowerCase().trim();
  return lower === 'ongoing' ||
         lower === 'indefinite' ||
         lower === 'forever' ||
         lower === 'continuous' ||
         lower === 'no end';
}
