// ═══════════════════════════════════════════════════════════════════════════════
// WEEK PLAN STORE — Encrypted WeekPlan Storage
// NovaOS Deliberate Practice Engine — Phase 18: Storage Layer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Persistent storage for WeekPlan entities with:
//   - Encryption at rest
//   - Goal-based indexing (weeks per goal, sorted set)
//   - Active week tracking
//   - Status transitions
//   - Progress updates
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../../storage/index.js';
import type { EncryptionService } from '../../../security/encryption/service.js';
import { ok, err, type AsyncAppResult } from '../../../types/result.js';
import type { WeekPlanId, GoalId, UserId, Timestamp, QuestId } from '../../../types/branded.js';
import { createTimestamp } from '../../../types/branded.js';
import { SwordKeys } from '../../../infrastructure/redis/keys.js';
import type { WeekPlan, WeekPlanStatus } from '../types.js';
import { SecureStore, storeError } from '../../spark-engine/store/secure-store.js';
import type {
  SecureStoreConfig,
  SaveOptions,
  GetOptions,
  ListOptions,
  SaveResult,
  DeleteResult,
  ListResult,
} from '../../spark-engine/store/types.js';
import { StoreErrorCode } from '../../spark-engine/store/types.js';
import type { IWeekPlanStore } from '../interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK PLAN STORE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Encrypted storage for WeekPlan entities.
 *
 * Features:
 * - Goal-based indexing via Redis sorted sets (score = weekNumber)
 * - Active week tracking per goal
 * - Status transitions with timestamps
 * - Progress aggregation updates
 */
export class WeekPlanStore extends SecureStore<WeekPlan, WeekPlanId> implements IWeekPlanStore {
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

  protected getKey(id: WeekPlanId): string {
    return SwordKeys.weekPlan(id);
  }

  protected validate(weekPlan: WeekPlan): string | undefined {
    if (!weekPlan.id) {
      return 'Week Plan ID is required';
    }
    if (!weekPlan.goalId) {
      return 'Goal ID is required';
    }
    if (!weekPlan.userId) {
      return 'User ID is required';
    }
    if (!weekPlan.questId) {
      return 'Quest ID is required';
    }
    if (weekPlan.weekNumber < 1) {
      return 'Week number must be 1 or greater';
    }
    if (!weekPlan.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(weekPlan.startDate)) {
      return 'Start date must be in YYYY-MM-DD format';
    }
    if (!weekPlan.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(weekPlan.endDate)) {
      return 'End date must be in YYYY-MM-DD format';
    }
    if (weekPlan.startDate > weekPlan.endDate) {
      return 'Start date must be before end date';
    }
    if (!weekPlan.weeklyCompetence || weekPlan.weeklyCompetence.trim().length === 0) {
      return 'Weekly competence is required';
    }
    if (weekPlan.weeklyCompetence.length > 500) {
      return 'Weekly competence must be 500 characters or less';
    }
    if (!weekPlan.theme || weekPlan.theme.trim().length === 0) {
      return 'Theme is required';
    }
    if (weekPlan.theme.length > 200) {
      return 'Theme must be 200 characters or less';
    }
    const validStatuses: WeekPlanStatus[] = ['pending', 'active', 'completed'];
    if (!validStatuses.includes(weekPlan.status)) {
      return `Invalid week plan status: ${weekPlan.status}`;
    }
    return undefined;
  }

  protected getId(weekPlan: WeekPlan): WeekPlanId {
    return weekPlan.id;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Save a week plan (create or update).
   */
  async save(weekPlan: WeekPlan, options: SaveOptions = {}): AsyncAppResult<SaveResult<WeekPlan>> {
    // Save the week plan entity
    const result = await this.saveEntity(weekPlan, options);
    if (!result.ok) {
      return result;
    }

    // Update goal's week plan index (sorted set with weekNumber as score)
    const goalIndexResult = await this.addToGoalIndex(weekPlan.goalId, weekPlan.id, weekPlan.weekNumber);
    if (!goalIndexResult.ok) {
      await this.deleteEntity(weekPlan.id);
      return goalIndexResult;
    }

    // Set as active if status is 'active'
    if (weekPlan.status === 'active') {
      await this.setGoalActiveWeek(weekPlan.goalId, weekPlan.id);
      await this.setUserCurrentWeek(weekPlan.userId, weekPlan.id);
    }

    return ok({
      entity: weekPlan,
      version: result.value.version,
      created: result.value.created,
    });
  }

  /**
   * Get a week plan by ID.
   */
  async get(weekPlanId: WeekPlanId, options: GetOptions = {}): AsyncAppResult<WeekPlan | null> {
    return this.getEntity(weekPlanId, options);
  }

  /**
   * Delete a week plan.
   */
  async delete(weekPlanId: WeekPlanId): AsyncAppResult<DeleteResult> {
    // Get the week plan first to find indexes to update
    const weekPlanResult = await this.getEntity(weekPlanId);
    if (!weekPlanResult.ok) {
      return err(weekPlanResult.error);
    }

    if (weekPlanResult.value === null) {
      return ok({ deleted: false });
    }

    const weekPlan = weekPlanResult.value;

    // Remove from goal index
    await this.removeFromGoalIndex(weekPlan.goalId, weekPlanId);

    // Clear active week if this was it
    const activeWeekId = await this.getGoalActiveWeekId(weekPlan.goalId);
    if (activeWeekId === weekPlanId) {
      await this.clearGoalActiveWeek(weekPlan.goalId);
      await this.clearUserCurrentWeek(weekPlan.userId);
    }

    // Delete the week plan entity
    const deleteResult = await this.deleteEntity(weekPlanId);
    if (!deleteResult.ok) {
      return err(deleteResult.error);
    }

    return ok({ deleted: deleteResult.value });
  }

  /**
   * Get week plans by goal.
   */
  async getByGoal(
    goalId: GoalId,
    options: ListOptions = {}
  ): AsyncAppResult<ListResult<WeekPlan>> {
    const { limit = 100, offset = 0, sortOrder = 'asc' } = options;

    try {
      const indexKey = SwordKeys.goalWeeks(goalId);
      
      // Get from sorted set (sorted by week number)
      let weekPlanIds: string[];
      if (sortOrder === 'asc') {
        weekPlanIds = await this.store.zrange(indexKey, 0, -1);
      } else {
        weekPlanIds = await this.store.zrevrange(indexKey, 0, -1);
      }

      if (weekPlanIds.length === 0) {
        return ok({ items: [], total: 0, hasMore: false });
      }

      // Fetch all week plans
      const weekPlans: WeekPlan[] = [];
      for (const id of weekPlanIds) {
        const result = await this.getEntity(id as WeekPlanId);
        if (result.ok && result.value !== null) {
          weekPlans.push(result.value);
        }
      }

      // Apply pagination
      const total = weekPlans.length;
      const paged = weekPlans.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return ok({ items: paged, total, hasMore });
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get week plans for goal: ${error instanceof Error ? error.message : String(error)}`,
          { goalId }
        )
      );
    }
  }

  /**
   * Get active week plan for a goal.
   */
  async getActiveByGoal(goalId: GoalId): AsyncAppResult<WeekPlan | null> {
    try {
      const weekPlanId = await this.getGoalActiveWeekId(goalId);
      if (!weekPlanId) {
        return ok(null);
      }

      const result = await this.getEntity(weekPlanId as WeekPlanId);
      if (!result.ok) {
        return result;
      }

      // Verify still active
      if (result.value && result.value.status !== 'active') {
        // Clear stale active week
        await this.clearGoalActiveWeek(goalId);
        return ok(null);
      }

      return result;
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get active week plan: ${error instanceof Error ? error.message : String(error)}`,
          { goalId }
        )
      );
    }
  }

  /**
   * Get week plan by week number.
   */
  async getByWeekNumber(goalId: GoalId, weekNumber: number): AsyncAppResult<WeekPlan | null> {
    try {
      const indexKey = SwordKeys.goalWeeks(goalId);
      
      // Get week plans with this score (weekNumber)
      const weekPlanIds = await this.store.zrangebyscore(indexKey, weekNumber, weekNumber);
      
      if (weekPlanIds.length === 0) {
        return ok(null);
      }

      return this.getEntity(weekPlanIds[0] as WeekPlanId);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get week plan by number: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, weekNumber }
        )
      );
    }
  }

  /**
   * Update week plan status.
   */
  async updateStatus(
    weekPlanId: WeekPlanId,
    status: WeekPlanStatus
  ): AsyncAppResult<WeekPlan> {
    // Get current week plan
    const result = await this.getEntity(weekPlanId);
    if (!result.ok) {
      return result;
    }
    if (result.value === null) {
      return err(
        storeError(StoreErrorCode.NOT_FOUND, `Week plan not found: ${weekPlanId}`, { weekPlanId })
      );
    }

    const weekPlan = result.value;
    const previousStatus = weekPlan.status;
    const now = createTimestamp();

    // Create updated week plan
    const updatedWeekPlan: WeekPlan = {
      ...weekPlan,
      status,
      updatedAt: now,
      completedAt: status === 'completed' ? now : weekPlan.completedAt,
    };

    // Save updated week plan
    const saveResult = await this.saveEntity(updatedWeekPlan);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    // Update active week tracking if status changed
    if (previousStatus !== status) {
      if (status === 'active') {
        await this.setGoalActiveWeek(weekPlan.goalId, weekPlanId);
        await this.setUserCurrentWeek(weekPlan.userId, weekPlanId);
      } else if (previousStatus === 'active') {
        await this.clearGoalActiveWeek(weekPlan.goalId);
        await this.clearUserCurrentWeek(weekPlan.userId);
      }
    }

    return ok(updatedWeekPlan);
  }

  /**
   * Update week plan progress.
   */
  async updateProgress(
    weekPlanId: WeekPlanId,
    drillsCompleted: number,
    drillsPassed: number,
    drillsFailed: number,
    drillsSkipped: number,
    skillsMastered: number = 0
  ): AsyncAppResult<WeekPlan> {
    // Get current week plan
    const result = await this.getEntity(weekPlanId);
    if (!result.ok) {
      return result;
    }
    if (result.value === null) {
      return err(
        storeError(StoreErrorCode.NOT_FOUND, `Week plan not found: ${weekPlanId}`, { weekPlanId })
      );
    }

    const weekPlan = result.value;

    // Calculate pass rate
    const totalAttempted = drillsPassed + drillsFailed;
    const passRate = totalAttempted > 0 ? drillsPassed / totalAttempted : undefined;

    // Create updated week plan
    const updatedWeekPlan: WeekPlan = {
      ...weekPlan,
      drillsCompleted,
      drillsPassed,
      drillsFailed,
      drillsSkipped,
      skillsMastered: (weekPlan.skillsMastered ?? 0) + skillsMastered,
      passRate,
      updatedAt: createTimestamp(),
    };

    // Save updated week plan
    const saveResult = await this.saveEntity(updatedWeekPlan);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    return ok(updatedWeekPlan);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ENHANCED QUERY METHODS (Phase 19)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all week plans for a quest.
   * Note: Requires iterating through goal's week plans since there's no direct quest→weekplans index.
   * For efficiency, callers should provide goalId and use getByGoal() when possible.
   */
  async getByQuest(questId: QuestId): AsyncAppResult<readonly WeekPlan[]> {
    try {
      const weekPlans: WeekPlan[] = [];
      
      // Check if store supports keys() method for pattern scanning
      const keysMethod = (this.store as { keys?: (pattern: string) => Promise<string[]> }).keys;
      
      if (keysMethod) {
        // Use keys() to find goal week plan indexes
        const goalWeekPlanKeys = await keysMethod.call(this.store, 'sword:weekplan:goal:*');
        
        for (const indexKey of goalWeekPlanKeys) {
          const weekPlanIds = await this.store.zrange(indexKey, 0, -1);
          for (const weekPlanId of weekPlanIds) {
            const result = await this.getEntity(weekPlanId as WeekPlanId);
            if (result.ok && result.value && result.value.questId === questId) {
              weekPlans.push(result.value);
            }
          }
        }
      } else {
        // Fallback: Cannot efficiently get week plans without keys() method
        // Return empty - callers should use getByGoal() with a known goalId
        console.warn('[WeekPlanStore] getByQuest: store.keys() not available, returning empty result');
      }
      
      // Sort by week number
      weekPlans.sort((a, b) => a.weekNumber - b.weekNumber);
      
      return ok(weekPlans);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get week plans by quest: ${error instanceof Error ? error.message : String(error)}`,
          { questId }
        )
      );
    }
  }

  /**
   * Get the last week of a quest.
   */
  async getLastWeekOfQuest(questId: QuestId): AsyncAppResult<WeekPlan | null> {
    const result = await this.getByQuest(questId);
    if (!result.ok) {
      return err(result.error);
    }
    
    const weekPlans = result.value;
    if (weekPlans.length === 0) {
      return ok(null);
    }
    
    // Already sorted by weekNumber ascending, get the last one
    return ok(weekPlans[weekPlans.length - 1]!);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INDEX MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  private async addToGoalIndex(
    goalId: GoalId,
    weekPlanId: WeekPlanId,
    weekNumber: number
  ): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.goalWeeks(goalId);
      await this.store.zadd(indexKey, weekNumber, weekPlanId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to add week plan to goal index: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, weekPlanId, weekNumber }
        )
      );
    }
  }

  private async removeFromGoalIndex(goalId: GoalId, weekPlanId: WeekPlanId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.goalWeeks(goalId);
      await this.store.zrem(indexKey, weekPlanId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to remove week plan from goal index: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, weekPlanId }
        )
      );
    }
  }

  private async setGoalActiveWeek(goalId: GoalId, weekPlanId: WeekPlanId): AsyncAppResult<void> {
    try {
      const key = SwordKeys.goalActiveWeek(goalId);
      await this.store.set(key, weekPlanId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to set goal active week: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, weekPlanId }
        )
      );
    }
  }

  private async getGoalActiveWeekId(goalId: GoalId): Promise<string | null> {
    try {
      const key = SwordKeys.goalActiveWeek(goalId);
      return await this.store.get(key);
    } catch {
      return null;
    }
  }

  private async clearGoalActiveWeek(goalId: GoalId): AsyncAppResult<void> {
    try {
      const key = SwordKeys.goalActiveWeek(goalId);
      await this.store.delete(key);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to clear goal active week: ${error instanceof Error ? error.message : String(error)}`,
          { goalId }
        )
      );
    }
  }

  private async setUserCurrentWeek(userId: UserId, weekPlanId: WeekPlanId): AsyncAppResult<void> {
    try {
      const key = SwordKeys.userCurrentWeek(userId);
      await this.store.set(key, weekPlanId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to set user current week: ${error instanceof Error ? error.message : String(error)}`,
          { userId, weekPlanId }
        )
      );
    }
  }

  private async clearUserCurrentWeek(userId: UserId): AsyncAppResult<void> {
    try {
      const key = SwordKeys.userCurrentWeek(userId);
      await this.store.delete(key);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to clear user current week: ${error instanceof Error ? error.message : String(error)}`,
          { userId }
        )
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a WeekPlanStore instance.
 */
export function createWeekPlanStore(
  store: KeyValueStore,
  config?: Partial<SecureStoreConfig>,
  encryption?: EncryptionService
): WeekPlanStore {
  return new WeekPlanStore(store, config, encryption);
}
