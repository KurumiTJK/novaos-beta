// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING PLAN STORE — Encrypted LearningPlan Storage
// NovaOS Deliberate Practice Engine — Phase 18: Storage Layer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Persistent storage for LearningPlan entities with:
//   - Encryption at rest
//   - Goal-based primary key
//   - User-based indexing
//   - Recalculation tracking
//
// Note: LearningPlan is a singleton per Goal, keyed directly by GoalId.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../../../storage/index.js';
import type { EncryptionService } from '../../../../security/encryption/service.js';
import { ok, err, type AsyncAppResult } from '../../../../types/result.js';
import type { GoalId, UserId, Timestamp } from '../../../../types/branded.js';
import { createTimestamp } from '../../../../types/branded.js';
import { SwordKeys } from '../../../../infrastructure/redis/keys.js';
import type { LearningPlan } from '../types.js';
import { SecureStore, storeError } from '../../../spark-engine/store/secure-store.js';
import type { SecureStoreConfig, GetOptions } from '../../../spark-engine/store/types.js';
import { StoreErrorCode } from '../../../spark-engine/store/types.js';
import type { ILearningPlanStore } from '../interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING PLAN STORE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Encrypted storage for LearningPlan entities.
 *
 * Features:
 * - Goal-based primary key (one plan per goal)
 * - User-based indexing
 * - Recalculation timestamp tracking
 *
 * Unlike other stores, LearningPlan uses GoalId as its primary key
 * since there's exactly one learning plan per goal.
 */
export class LearningPlanStore extends SecureStore<LearningPlan, GoalId> implements ILearningPlanStore {
  constructor(
    store: KeyValueStore,
    config: Partial<SecureStoreConfig> = {},
    encryption?: EncryptionService
  ) {
    super(store, config, encryption);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  protected getKey(goalId: GoalId): string {
    return SwordKeys.learningPlan(goalId);
  }

  protected validate(plan: LearningPlan): string | undefined {
    if (!plan.goalId) {
      return 'Goal ID is required';
    }
    if (!plan.userId) {
      return 'User ID is required';
    }
    if (plan.totalWeeks < 1) {
      return 'Total weeks must be 1 or greater';
    }
    if (plan.totalSkills < 1) {
      return 'Total skills must be 1 or greater';
    }
    if (plan.totalDrills < 1) {
      return 'Total drills must be 1 or greater';
    }
    if (!plan.estimatedCompletionDate || !/^\d{4}-\d{2}-\d{2}$/.test(plan.estimatedCompletionDate)) {
      return 'Estimated completion date must be in YYYY-MM-DD format';
    }
    if (!plan.questSkillMapping || plan.questSkillMapping.length === 0) {
      return 'Quest skill mapping is required';
    }
    if (!plan.questWeekMapping || plan.questWeekMapping.length === 0) {
      return 'Quest week mapping is required';
    }
    return undefined;
  }

  protected getId(plan: LearningPlan): GoalId {
    return plan.goalId;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Save a learning plan.
   */
  async save(plan: LearningPlan): AsyncAppResult<LearningPlan> {
    // Validate plan
    const validationError = this.validate(plan);
    if (validationError) {
      return err(storeError(StoreErrorCode.INVALID_DATA, validationError));
    }

    // Save the learning plan entity
    const result = await this.saveEntity(plan);
    if (!result.ok) {
      return err(result.error);
    }

    // Update user's learning plans index
    const userIndexResult = await this.addToUserIndex(plan.userId, plan.goalId);
    if (!userIndexResult.ok) {
      await this.deleteEntity(plan.goalId);
      return err(userIndexResult.error);
    }

    return ok(plan);
  }

  /**
   * Get a learning plan by goal ID.
   */
  async get(goalId: GoalId): AsyncAppResult<LearningPlan | null> {
    return this.getEntity(goalId);
  }

  /**
   * Delete a learning plan.
   */
  async delete(goalId: GoalId): AsyncAppResult<boolean> {
    // Get the plan first to find user index to update
    const planResult = await this.getEntity(goalId);
    if (!planResult.ok) {
      return err(planResult.error);
    }

    if (planResult.value === null) {
      return ok(false);
    }

    const plan = planResult.value;

    // Remove from user index
    await this.removeFromUserIndex(plan.userId, goalId);

    // Delete the plan entity
    const deleteResult = await this.deleteEntity(goalId);
    if (!deleteResult.ok) {
      return err(deleteResult.error);
    }

    return ok(deleteResult.value);
  }

  /**
   * Update a learning plan with partial updates.
   */
  async update(goalId: GoalId, updates: Partial<LearningPlan>): AsyncAppResult<LearningPlan> {
    // Get current plan
    const result = await this.getEntity(goalId);
    if (!result.ok) {
      return result;
    }
    if (result.value === null) {
      return err(
        storeError(StoreErrorCode.NOT_FOUND, `Learning plan not found: ${goalId}`, { goalId })
      );
    }

    const plan = result.value;

    // Create updated plan
    const updatedPlan: LearningPlan = {
      ...plan,
      ...updates,
      goalId: plan.goalId, // Prevent changing the key
      userId: plan.userId, // Prevent changing the user
      recalculatedAt: createTimestamp(),
    };

    // Validate updated plan
    const validationError = this.validate(updatedPlan);
    if (validationError) {
      return err(storeError(StoreErrorCode.INVALID_DATA, validationError));
    }

    // Save updated plan
    const saveResult = await this.saveEntity(updatedPlan);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    return ok(updatedPlan);
  }

  /**
   * Get all learning plans for a user.
   */
  async getByUser(userId: UserId): AsyncAppResult<readonly LearningPlan[]> {
    try {
      const indexKey = SwordKeys.userLearningPlans(userId);
      const goalIds = await this.store.smembers(indexKey);

      if (goalIds.length === 0) {
        return ok([]);
      }

      // Fetch all plans
      const plans: LearningPlan[] = [];
      for (const goalId of goalIds) {
        const result = await this.getEntity(goalId as GoalId);
        if (result.ok && result.value !== null) {
          plans.push(result.value);
        }
      }

      // Sort by generatedAt
      plans.sort((a, b) => {
        const aTime = new Date(a.generatedAt).getTime();
        const bTime = new Date(b.generatedAt).getTime();
        return bTime - aTime; // Newest first
      });

      return ok(plans);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get learning plans for user: ${error instanceof Error ? error.message : String(error)}`,
          { userId }
        )
      );
    }
  }

  /**
   * Check if a learning plan exists for a goal.
   */
  async existsForGoal(goalId: GoalId): AsyncAppResult<boolean> {
    return this.exists(goalId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INDEX MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  private async addToUserIndex(userId: UserId, goalId: GoalId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.userLearningPlans(userId);
      await this.store.sadd(indexKey, goalId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to add learning plan to user index: ${error instanceof Error ? error.message : String(error)}`,
          { userId, goalId }
        )
      );
    }
  }

  private async removeFromUserIndex(userId: UserId, goalId: GoalId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.userLearningPlans(userId);
      await this.store.srem(indexKey, goalId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to remove learning plan from user index: ${error instanceof Error ? error.message : String(error)}`,
          { userId, goalId }
        )
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a LearningPlanStore instance.
 */
export function createLearningPlanStore(
  store: KeyValueStore,
  config?: Partial<SecureStoreConfig>,
  encryption?: EncryptionService
): LearningPlanStore {
  return new LearningPlanStore(store, config, encryption);
}
