// ═══════════════════════════════════════════════════════════════════════════════
// LESSON MODE TYPES — Simplified Practice System
// NovaOS Gates — Phase 20: Simplified Lesson Mode
// ═══════════════════════════════════════════════════════════════════════════════
//
// Simplified from 17 intents to 7:
//   - view: Show goals / goal details / current drill
//   - start: Start or resume lesson
//   - complete: Mark lesson done
//   - pause: Save progress, exit mode
//   - delete: Delete a goal
//   - cancel: Exit mode without saving
//   - select: User picked a goal (number or name)
//   - question: User asking about lesson content (stays in mode)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  UserId,
  GoalId,
  DrillId,
  Timestamp,
} from '../../../types/branded.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON INTENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simplified lesson intents (7 total).
 */
export type LessonIntent =
  | 'view'      // Show goals, goal details, or current drill
  | 'start'     // Start/resume lesson (enters lesson mode)
  | 'complete'  // Mark lesson done (exits lesson mode)
  | 'pause'     // Save progress, exit lesson mode
  | 'delete'    // Delete a goal
  | 'cancel'    // Exit lesson mode without saving
  | 'select'    // User selected a goal (by number or name)
  | 'question'; // User asking about lesson content (stays in mode)

/**
 * All valid lesson intents.
 */
export const LESSON_INTENTS: readonly LessonIntent[] = [
  'view',
  'start',
  'complete',
  'pause',
  'delete',
  'cancel',
  'select',
  'question',
] as const;

/**
 * Type guard for LessonIntent.
 */
export function isLessonIntent(value: unknown): value is LessonIntent {
  return typeof value === 'string' && LESSON_INTENTS.includes(value as LessonIntent);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON MODE STAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lesson mode stages.
 *
 * - idle: Not in lesson mode (normal chat)
 * - selecting: User needs to pick a goal
 * - active: In lesson mode, practicing
 * - confirming_review: Asking if user wants to review completed lesson
 */
export type LessonStage =
  | 'idle'              // Not in lesson mode
  | 'selecting'         // Picking a goal
  | 'active'            // In lesson mode
  | 'confirming_review'; // Asking about review

/**
 * All valid lesson stages.
 */
export const LESSON_STAGES: readonly LessonStage[] = [
  'idle',
  'selecting',
  'active',
  'confirming_review',
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON MODE STATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lesson mode session state.
 */
export interface LessonModeState {
  /** User ID */
  readonly userId: UserId;

  /** Current stage */
  readonly stage: LessonStage;

  /** Active goal ID (when in lesson mode) */
  readonly goalId: GoalId | null;

  /** Active drill ID (when practicing) */
  readonly drillId: DrillId | null;

  /** Goal title (for display) */
  readonly goalTitle: string | null;

  /** Is this a review session? (already completed today) */
  readonly isReview: boolean;

  /** Conversation context for questions */
  readonly lessonContext: string | null;

  /** When session was created */
  readonly createdAt: Timestamp;

  /** When session was last updated */
  readonly updatedAt: Timestamp;

  /** When session expires */
  readonly expiresAt: Timestamp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON MODE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for lesson mode.
 */
export interface LessonModeConfig {
  /** Session TTL in seconds (default: 2 hours) */
  readonly sessionTtlSeconds: number;

  /** OpenAI API key for intent classification */
  readonly openaiApiKey?: string;
}

/**
 * Default lesson mode configuration.
 */
export const DEFAULT_LESSON_MODE_CONFIG: LessonModeConfig = {
  sessionTtlSeconds: 7200, // 2 hours
};

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON MODE INPUT/OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input to lesson mode handler.
 */
export interface LessonModeInput {
  /** User ID */
  readonly userId: UserId;

  /** User message */
  readonly message: string;

  /** Existing goal ID (from context) */
  readonly existingGoalId?: GoalId;
}

/**
 * Goal summary for selection.
 */
export interface GoalSummary {
  readonly id: GoalId;
  readonly title: string;
  readonly priority: number | null;
  readonly progress: number; // 0-100
  readonly dayNumber: number;
  readonly completedToday: boolean;
  readonly paused: boolean;
}

/**
 * Output from lesson mode handler.
 */
export interface LessonModeOutput {
  /** Response message for the user */
  readonly response: string;

  /** Current stage after handling */
  readonly stage: LessonStage;

  /** Whether to suppress normal model generation */
  readonly suppressModelGeneration: boolean;

  /** The intent that was handled */
  readonly intent: LessonIntent;

  /** Goal ID if relevant */
  readonly goalId?: GoalId;

  /** Drill info for display */
  readonly drill?: {
    readonly action: string;
    readonly passSignal: string;
    readonly constraint?: string;
    readonly dayNumber: number;
    readonly estimatedMinutes: number;
  };

  /** Goals list (for view/select) */
  readonly goals?: readonly GoalSummary[];

  /** Whether lesson was completed */
  readonly completed?: boolean;

  /** Whether a goal was deleted */
  readonly deleted?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT CLASSIFICATION RESULT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result from intent classification.
 */
export interface LessonIntentResult {
  /** Classified intent */
  readonly intent: LessonIntent;

  /** Confidence score (0-1) */
  readonly confidence: number;

  /** Goal reference extracted (name, number, or null) */
  readonly goalReference: string | null;

  /** Brief explanation */
  readonly reasoning: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if stage is in lesson mode (not idle).
 */
export function isInLessonMode(stage: LessonStage): boolean {
  return stage !== 'idle';
}

/**
 * Check if stage allows questions about lesson content.
 */
export function allowsQuestions(stage: LessonStage): boolean {
  return stage === 'active';
}

/**
 * Create initial lesson mode state.
 */
export function createInitialLessonState(
  userId: UserId,
  now: Timestamp,
  expiresAt: Timestamp
): LessonModeState {
  return {
    userId,
    stage: 'idle',
    goalId: null,
    drillId: null,
    goalTitle: null,
    isReview: false,
    lessonContext: null,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };
}
