// ═══════════════════════════════════════════════════════════════════════════════
// DRILL STORE — Encrypted DailyDrill Storage
// NovaOS Deliberate Practice Engine — Phase 18: Storage Layer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Persistent storage for DailyDrill entities with:
//   - Encryption at rest
//   - Week-based indexing (drills per week)
//   - Date-based lookup (drill by date)
//   - User active drill tracking
//   - Outcome updates
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../../storage/index.js';
import type { EncryptionService } from '../../../security/encryption/service.js';
import { ok, err, type AsyncAppResult } from '../../../types/result.js';
import type { DrillId, WeekPlanId, GoalId, UserId, Timestamp } from '../../../types/branded.js';
import { createTimestamp } from '../../../types/branded.js';
import { SwordKeys } from '../../../infrastructure/redis/keys.js';
import type { DailyDrill, DrillOutcome, DrillStatus, SkillType } from '../types.js';
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
import type { IDrillStore } from '../interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DRILL STORE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Encrypted storage for DailyDrill entities.
 *
 * Features:
 * - Week-based indexing via Redis sets
 * - Date-based lookup (goal + date → drillId)
 * - User active drill tracking
 * - Outcome updates with timestamps
 */
export class DrillStore extends SecureStore<DailyDrill, DrillId> implements IDrillStore {
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

  protected getKey(id: DrillId): string {
    return SwordKeys.drill(id);
  }

  protected validate(drill: DailyDrill): string | undefined {
    if (!drill.id) {
      return 'Drill ID is required';
    }
    if (!drill.weekPlanId) {
      return 'Week Plan ID is required';
    }
    if (!drill.skillId) {
      return 'Skill ID is required';
    }
    if (!drill.userId) {
      return 'User ID is required';
    }
    if (!drill.goalId) {
      return 'Goal ID is required';
    }
    if (!drill.scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(drill.scheduledDate)) {
      return 'Scheduled date must be in YYYY-MM-DD format';
    }
    if (drill.dayNumber < 1) {
      return 'Day number must be 1 or greater';
    }
    if (!drill.action || drill.action.trim().length === 0) {
      return 'Drill action is required';
    }
    if (drill.action.length > 1000) {
      return 'Drill action must be 1000 characters or less';
    }
    if (!drill.passSignal || drill.passSignal.trim().length === 0) {
      return 'Drill pass signal is required';
    }
    if (drill.passSignal.length > 1000) {
      return 'Drill pass signal must be 1000 characters or less';
    }
    if (!drill.constraint || drill.constraint.trim().length === 0) {
      return 'Drill constraint is required';
    }
    if (drill.estimatedMinutes <= 0) {
      return 'Estimated minutes must be positive';
    }
    return undefined;
  }

  protected getId(drill: DailyDrill): DrillId {
    return drill.id;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Save a drill (create or update).
   */
  async save(drill: DailyDrill, options: SaveOptions = {}): AsyncAppResult<SaveResult<DailyDrill>> {
    // Save the drill entity
    const result = await this.saveEntity(drill, options);
    if (!result.ok) {
      return result;
    }

    // Update week's drill index
    const weekIndexResult = await this.addToWeekIndex(drill.weekPlanId, drill.id);
    if (!weekIndexResult.ok) {
      await this.deleteEntity(drill.id);
      return weekIndexResult;
    }

    // Update date lookup
    const dateLookupResult = await this.setDateLookup(drill.goalId, drill.scheduledDate, drill.id);
    if (!dateLookupResult.ok) {
      await this.removeFromWeekIndex(drill.weekPlanId, drill.id);
      await this.deleteEntity(drill.id);
      return dateLookupResult;
    }

    // Update user's drill history
    const historyResult = await this.addToUserHistory(drill.userId, drill.id);
    if (!historyResult.ok) {
      await this.removeDateLookup(drill.goalId, drill.scheduledDate);
      await this.removeFromWeekIndex(drill.weekPlanId, drill.id);
      await this.deleteEntity(drill.id);
      return historyResult;
    }

    // Set as active if status is 'active' or 'scheduled'
    if (drill.status === 'active' || drill.status === 'scheduled') {
      await this.setUserActiveDrill(drill.userId, drill.id);
    }

    return ok({
      entity: drill,
      version: result.value.version,
      created: result.value.created,
    });
  }

  /**
   * Get a drill by ID.
   */
  async get(drillId: DrillId, options: GetOptions = {}): AsyncAppResult<DailyDrill | null> {
    return this.getEntity(drillId, options);
  }

  /**
   * Delete a drill.
   */
  async delete(drillId: DrillId): AsyncAppResult<DeleteResult> {
    // Get the drill first to find indexes to update
    const drillResult = await this.getEntity(drillId);
    if (!drillResult.ok) {
      return err(drillResult.error);
    }

    if (drillResult.value === null) {
      return ok({ deleted: false });
    }

    const drill = drillResult.value;

    // Remove from indexes
    await this.removeFromWeekIndex(drill.weekPlanId, drillId);
    await this.removeDateLookup(drill.goalId, drill.scheduledDate);
    await this.removeFromUserHistory(drill.userId, drillId);

    // Clear active drill if this was it
    const activeDrillId = await this.getUserActiveDrillId(drill.userId);
    if (activeDrillId === drillId) {
      await this.clearUserActiveDrill(drill.userId);
    }

    // Delete the drill entity
    const deleteResult = await this.deleteEntity(drillId);
    if (!deleteResult.ok) {
      return err(deleteResult.error);
    }

    return ok({ deleted: deleteResult.value });
  }

  /**
   * Get drills by week.
   */
  async getByWeek(
    weekPlanId: WeekPlanId,
    options: ListOptions = {}
  ): AsyncAppResult<ListResult<DailyDrill>> {
    const { limit = 100, offset = 0, sortOrder = 'asc' } = options;

    try {
      const indexKey = SwordKeys.weekDrills(weekPlanId);
      const drillIds = await this.store.smembers(indexKey);

      if (drillIds.length === 0) {
        return ok({ items: [], total: 0, hasMore: false });
      }

      // Fetch all drills
      const drills: DailyDrill[] = [];
      for (const id of drillIds) {
        const result = await this.getEntity(id as DrillId);
        if (result.ok && result.value !== null) {
          drills.push(result.value);
        }
      }

      // Sort by dayNumber
      drills.sort((a, b) => {
        return sortOrder === 'asc' ? a.dayNumber - b.dayNumber : b.dayNumber - a.dayNumber;
      });

      // Apply pagination
      const total = drills.length;
      const paged = drills.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return ok({ items: paged, total, hasMore });
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get drills for week: ${error instanceof Error ? error.message : String(error)}`,
          { weekPlanId }
        )
      );
    }
  }

  /**
   * Get drill by date.
   */
  async getByDate(
    userId: UserId,
    goalId: GoalId,
    date: string
  ): AsyncAppResult<DailyDrill | null> {
    try {
      const lookupKey = SwordKeys.drillByDate(goalId, date);
      const drillId = await this.store.get(lookupKey);

      if (!drillId) {
        return ok(null);
      }

      return this.getEntity(drillId as DrillId);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get drill by date: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, date }
        )
      );
    }
  }

  /**
   * Get drills by date range.
   */
  async getByDateRange(
    userId: UserId,
    goalId: GoalId,
    startDate: string,
    endDate: string
  ): AsyncAppResult<readonly DailyDrill[]> {
    try {
      const drills: DailyDrill[] = [];
      
      // Generate dates in range
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]!;
        const result = await this.getByDate(userId, goalId, dateStr);
        if (result.ok && result.value !== null) {
          drills.push(result.value);
        }
      }

      // Sort by date
      drills.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

      return ok(drills);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get drills by date range: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, startDate, endDate }
        )
      );
    }
  }

  /**
   * Get active drill for user.
   */
  async getActiveForUser(userId: UserId): AsyncAppResult<DailyDrill | null> {
    try {
      const drillId = await this.getUserActiveDrillId(userId);
      if (!drillId) {
        return ok(null);
      }

      const result = await this.getEntity(drillId as DrillId);
      if (!result.ok) {
        return result;
      }

      // Verify still active
      if (result.value && result.value.status !== 'active' && result.value.status !== 'scheduled') {
        // Clear stale active drill
        await this.clearUserActiveDrill(userId);
        return ok(null);
      }

      return result;
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get active drill: ${error instanceof Error ? error.message : String(error)}`,
          { userId }
        )
      );
    }
  }

  /**
   * Update drill outcome.
   */
  async updateOutcome(
    drillId: DrillId,
    outcome: DrillOutcome,
    observation?: string,
    carryForward?: string
  ): AsyncAppResult<DailyDrill> {
    // Get current drill
    const result = await this.getEntity(drillId);
    if (!result.ok) {
      return result;
    }
    if (result.value === null) {
      return err(
        storeError(StoreErrorCode.NOT_FOUND, `Drill not found: ${drillId}`, { drillId })
      );
    }

    const drill = result.value;
    const now = createTimestamp();

    // Create updated drill
    const updatedDrill: DailyDrill = {
      ...drill,
      outcome,
      observation: observation ?? drill.observation,
      carryForward: carryForward ?? drill.carryForward,
      status: 'completed' as DrillStatus,
      repeatTomorrow: outcome === 'fail' || outcome === 'partial',
      completedAt: now,
      updatedAt: now,
    };

    // Save updated drill
    const saveResult = await this.saveEntity(updatedDrill);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    // Clear active drill if this was it
    const activeDrillId = await this.getUserActiveDrillId(drill.userId);
    if (activeDrillId === drillId) {
      await this.clearUserActiveDrill(drill.userId);
    }

    return ok(updatedDrill);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ENHANCED QUERY METHODS (Phase 19)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get drills by skill type for a goal.
   */
  async getBySkillType(
    goalId: GoalId,
    skillType: SkillType
  ): AsyncAppResult<readonly DailyDrill[]> {
    // Get drills by iterating through goal's week plans
    // This requires getting drills via week plan index
    try {
      // Get week plans for goal first
      const weekPlanKey = SwordKeys.goalWeeks(goalId);
      const weekPlanIds = await this.store.smembers(weekPlanKey);
      
      const drills: DailyDrill[] = [];
      for (const weekPlanId of weekPlanIds) {
        const weekDrillsKey = SwordKeys.weekDrills(weekPlanId as WeekPlanId);
        const drillIds = await this.store.smembers(weekDrillsKey);
        
        for (const drillId of drillIds) {
          const result = await this.getEntity(drillId as DrillId);
          if (result.ok && result.value && result.value.skillType === skillType) {
            drills.push(result.value);
          }
        }
      }
      
      return ok(drills);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get drills by skill type: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, skillType }
        )
      );
    }
  }

  /**
   * Get compound drills for a goal.
   */
  async getCompoundDrills(goalId: GoalId): AsyncAppResult<readonly DailyDrill[]> {
    return this.getBySkillType(goalId, 'compound');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INDEX MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  private async addToWeekIndex(weekPlanId: WeekPlanId, drillId: DrillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.weekDrills(weekPlanId);
      await this.store.sadd(indexKey, drillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to add drill to week index: ${error instanceof Error ? error.message : String(error)}`,
          { weekPlanId, drillId }
        )
      );
    }
  }

  private async removeFromWeekIndex(weekPlanId: WeekPlanId, drillId: DrillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.weekDrills(weekPlanId);
      await this.store.srem(indexKey, drillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to remove drill from week index: ${error instanceof Error ? error.message : String(error)}`,
          { weekPlanId, drillId }
        )
      );
    }
  }

  private async setDateLookup(goalId: GoalId, date: string, drillId: DrillId): AsyncAppResult<void> {
    try {
      const lookupKey = SwordKeys.drillByDate(goalId, date);
      await this.store.set(lookupKey, drillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to set drill date lookup: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, date, drillId }
        )
      );
    }
  }

  private async removeDateLookup(goalId: GoalId, date: string): AsyncAppResult<void> {
    try {
      const lookupKey = SwordKeys.drillByDate(goalId, date);
      await this.store.delete(lookupKey);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to remove drill date lookup: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, date }
        )
      );
    }
  }

  private async addToUserHistory(userId: UserId, drillId: DrillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.userDrillHistory(userId);
      await this.store.sadd(indexKey, drillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to add drill to user history: ${error instanceof Error ? error.message : String(error)}`,
          { userId, drillId }
        )
      );
    }
  }

  private async removeFromUserHistory(userId: UserId, drillId: DrillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.userDrillHistory(userId);
      await this.store.srem(indexKey, drillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to remove drill from user history: ${error instanceof Error ? error.message : String(error)}`,
          { userId, drillId }
        )
      );
    }
  }

  private async setUserActiveDrill(userId: UserId, drillId: DrillId): AsyncAppResult<void> {
    try {
      const key = SwordKeys.userActiveDrill(userId);
      await this.store.set(key, drillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to set user active drill: ${error instanceof Error ? error.message : String(error)}`,
          { userId, drillId }
        )
      );
    }
  }

  private async getUserActiveDrillId(userId: UserId): Promise<string | null> {
    try {
      const key = SwordKeys.userActiveDrill(userId);
      return await this.store.get(key);
    } catch {
      return null;
    }
  }

  private async clearUserActiveDrill(userId: UserId): AsyncAppResult<void> {
    try {
      const key = SwordKeys.userActiveDrill(userId);
      await this.store.delete(key);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to clear user active drill: ${error instanceof Error ? error.message : String(error)}`,
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
 * Create a DrillStore instance.
 */
export function createDrillStore(
  store: KeyValueStore,
  config?: Partial<SecureStoreConfig>,
  encryption?: EncryptionService
): DrillStore {
  return new DrillStore(store, config, encryption);
}
