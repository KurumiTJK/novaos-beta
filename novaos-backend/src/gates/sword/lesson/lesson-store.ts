// ═══════════════════════════════════════════════════════════════════════════════
// LESSON STORE — Lesson Mode State Persistence
// NovaOS Gates — Phase 20: Simplified Lesson Mode
// ═══════════════════════════════════════════════════════════════════════════════
//
// Adapter layer for LessonModeState persistence using the base RefinementStore.
//
// Follows the same pattern as ExploreStore:
//   - Wraps IRefinementStore for actual Redis operations
//   - Converts LessonModeState ↔ RefinementState
//   - Uses meta keys (_lesson_ prefix) for typed fields
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { UserId, GoalId, DrillId, Timestamp } from '../../../types/branded.js';
import { createTimestamp } from '../../../types/branded.js';
import type { AsyncAppResult } from '../../../types/result.js';
import { ok, err, appError } from '../../../types/result.js';

import type { RefinementState, IRefinementStore } from '../../../services/spark-engine/store/types.js';

import type {
  LessonModeState,
  LessonStage,
  LessonModeConfig,
} from './types.js';
import { DEFAULT_LESSON_MODE_CONFIG, createInitialLessonState } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Keys used in the generic inputs record for Lesson-specific data.
 * Prefixed with _lesson_ to avoid collision with other stores.
 */
const LESSON_META_KEYS = {
  STAGE: '_lesson_stage',
  GOAL_ID: '_lesson_goalId',
  DRILL_ID: '_lesson_drillId',
  GOAL_TITLE: '_lesson_goalTitle',
  IS_REVIEW: '_lesson_isReview',
  LESSON_CONTEXT: '_lesson_context',
} as const;

/**
 * Stage mapping between LessonStage and RefinementState stage.
 */
function mapLessonStageToBase(stage: LessonStage): RefinementState['stage'] {
  switch (stage) {
    case 'idle':
      return 'complete';
    case 'selecting':
      return 'initial';
    case 'active':
      return 'clarifying';
    case 'confirming_review':
      return 'confirming';
    default:
      return 'initial';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert LessonModeState to base RefinementState for storage.
 */
function toBaseState(state: LessonModeState): RefinementState {
  const inputs: Record<string, unknown> = {
    [LESSON_META_KEYS.STAGE]: state.stage,
    [LESSON_META_KEYS.GOAL_ID]: state.goalId,
    [LESSON_META_KEYS.DRILL_ID]: state.drillId,
    [LESSON_META_KEYS.GOAL_TITLE]: state.goalTitle,
    [LESSON_META_KEYS.IS_REVIEW]: state.isReview,
    [LESSON_META_KEYS.LESSON_CONTEXT]: state.lessonContext,
  };

  return {
    userId: state.userId,
    goalId: state.goalId ?? undefined,
    stage: mapLessonStageToBase(state.stage),
    inputs,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    expiresAt: state.expiresAt,
  };
}

/**
 * Convert base RefinementState to LessonModeState.
 */
function fromBaseState(base: RefinementState): LessonModeState {
  const inputs = base.inputs;

  return {
    userId: base.userId,
    stage: (inputs[LESSON_META_KEYS.STAGE] as LessonStage) ?? 'idle',
    goalId: (inputs[LESSON_META_KEYS.GOAL_ID] as GoalId) ?? null,
    drillId: (inputs[LESSON_META_KEYS.DRILL_ID] as DrillId) ?? null,
    goalTitle: (inputs[LESSON_META_KEYS.GOAL_TITLE] as string) ?? null,
    isReview: (inputs[LESSON_META_KEYS.IS_REVIEW] as boolean) ?? false,
    lessonContext: (inputs[LESSON_META_KEYS.LESSON_CONTEXT] as string) ?? null,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    expiresAt: base.expiresAt,
  };
}

/**
 * Check if a RefinementState is a LessonModeState.
 */
function isLessonState(base: RefinementState): boolean {
  return LESSON_META_KEYS.STAGE in base.inputs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON STORE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lesson-specific state storage.
 *
 * Wraps the base RefinementStore with typed access to LessonModeState.
 * Uses a separate key namespace (_lesson_ prefix) to coexist with other states.
 */
export class LessonStore {
  private readonly baseStore: IRefinementStore;
  private readonly config: LessonModeConfig;

  constructor(baseStore: IRefinementStore, config: Partial<LessonModeConfig> = {}) {
    this.baseStore = baseStore;
    this.config = { ...DEFAULT_LESSON_MODE_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new lesson session (in idle state).
   */
  async create(userId: UserId): AsyncAppResult<LessonModeState> {
    const now = createTimestamp();
    const expiresAt = createTimestamp(
      new Date(Date.now() + this.config.sessionTtlSeconds * 1000)
    );

    const state = createInitialLessonState(userId, now, expiresAt);
    return this.save(state);
  }

  /**
   * Save a LessonModeState.
   */
  async save(state: LessonModeState): AsyncAppResult<LessonModeState> {
    const updatedState = {
      ...state,
      updatedAt: createTimestamp(),
    };

    const baseState = toBaseState(updatedState);
    const result = await this.baseStore.save(baseState);

    if (!result.ok) {
      return result;
    }

    return ok(fromBaseState(result.value));
  }

  /**
   * Get the current lesson state for a user.
   * Returns null if no lesson state exists or if it's a different state type.
   */
  async get(userId: UserId): AsyncAppResult<LessonModeState | null> {
    const result = await this.baseStore.get(userId);

    if (!result.ok) {
      return result;
    }

    if (result.value === null) {
      return ok(null);
    }

    // Check if this is actually a LessonModeState
    if (!isLessonState(result.value)) {
      return ok(null);
    }

    return ok(fromBaseState(result.value));
  }

  /**
   * Delete the lesson state for a user.
   */
  async delete(userId: UserId): AsyncAppResult<boolean> {
    // Only delete if it's a lesson state
    const current = await this.get(userId);
    if (!current.ok) return current;
    if (current.value === null) return ok(true);

    return this.baseStore.delete(userId);
  }

  /**
   * Update specific fields of the lesson state.
   */
  async update(
    userId: UserId,
    updates: Partial<Omit<LessonModeState, 'userId' | 'createdAt'>>
  ): AsyncAppResult<LessonModeState> {
    const currentResult = await this.get(userId);
    if (!currentResult.ok) {
      return currentResult;
    }

    if (currentResult.value === null) {
      return err(appError('NOT_FOUND', 'No active lesson session'));
    }

    const updatedState: LessonModeState = {
      ...currentResult.value,
      ...updates,
      updatedAt: createTimestamp(),
    };

    return this.save(updatedState);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Enter selecting stage (picking a goal).
   */
  async enterSelecting(userId: UserId): AsyncAppResult<LessonModeState> {
    const current = await this.getOrCreate(userId);
    if (!current.ok) return current;

    return this.update(userId, { stage: 'selecting' });
  }

  /**
   * Enter active stage (in lesson mode).
   */
  async enterActive(
    userId: UserId,
    goalId: GoalId,
    drillId: DrillId | null,
    goalTitle: string,
    isReview: boolean = false,
    lessonContext: string | null = null
  ): AsyncAppResult<LessonModeState> {
    const current = await this.getOrCreate(userId);
    if (!current.ok) return current;

    return this.update(userId, {
      stage: 'active',
      goalId,
      drillId,
      goalTitle,
      isReview,
      lessonContext,
    });
  }

  /**
   * Enter confirming review stage.
   */
  async enterConfirmingReview(
    userId: UserId,
    goalId: GoalId,
    goalTitle: string
  ): AsyncAppResult<LessonModeState> {
    const current = await this.getOrCreate(userId);
    if (!current.ok) return current;

    return this.update(userId, {
      stage: 'confirming_review',
      goalId,
      goalTitle,
      isReview: true,
    });
  }

  /**
   * Exit to idle stage.
   */
  async exitToIdle(userId: UserId): AsyncAppResult<LessonModeState> {
    const current = await this.get(userId);
    if (!current.ok) return current;

    if (current.value === null) {
      // Nothing to exit, return a new idle state
      return this.create(userId);
    }

    return this.update(userId, {
      stage: 'idle',
      goalId: null,
      drillId: null,
      goalTitle: null,
      isReview: false,
      lessonContext: null,
    });
  }

  /**
   * Update lesson context (for question answering).
   */
  async updateContext(userId: UserId, context: string): AsyncAppResult<LessonModeState> {
    return this.update(userId, { lessonContext: context });
  }

  /**
   * Update drill ID after generation.
   */
  async updateDrillId(userId: UserId, drillId: DrillId): AsyncAppResult<LessonModeState> {
    return this.update(userId, { drillId });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if user is in an active lesson session.
   */
  async isInLessonMode(userId: UserId): AsyncAppResult<boolean> {
    const result = await this.get(userId);
    if (!result.ok) return result;

    const state = result.value;
    if (state === null) return ok(false);

    return ok(state.stage !== 'idle' && !this.isExpired(state));
  }

  /**
   * Get or create a lesson state.
   */
  async getOrCreate(userId: UserId): AsyncAppResult<LessonModeState> {
    const existing = await this.get(userId);
    if (!existing.ok) return existing;

    if (existing.value !== null && !this.isExpired(existing.value)) {
      return ok(existing.value);
    }

    return this.create(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPIRATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a lesson state is expired.
   */
  isExpired(state: LessonModeState): boolean {
    return new Date(state.expiresAt).getTime() < Date.now();
  }

  /**
   * Extend the expiration time.
   */
  async extendExpiration(userId: UserId): AsyncAppResult<LessonModeState> {
    const newExpiresAt = createTimestamp(
      new Date(Date.now() + this.config.sessionTtlSeconds * 1000)
    );
    return this.update(userId, { expiresAt: newExpiresAt });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a LessonStore instance.
 */
export function createLessonStore(
  baseStore: IRefinementStore,
  config?: Partial<LessonModeConfig>
): LessonStore {
  return new LessonStore(baseStore, config);
}
