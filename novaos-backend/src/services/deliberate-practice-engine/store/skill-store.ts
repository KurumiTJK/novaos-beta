// ═══════════════════════════════════════════════════════════════════════════════
// SKILL STORE — Encrypted Skill Storage
// NovaOS Deliberate Practice Engine — Phase 18: Storage Layer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Persistent storage for Skill entities with:
//   - Encryption at rest
//   - Quest-based indexing (skills per quest)
//   - Goal-based indexing (skills per goal)
//   - User-based indexing
//   - Mastery tracking updates
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../../storage/index.js';
import type { EncryptionService } from '../../../security/encryption/service.js';
import { ok, err, type AsyncAppResult } from '../../../types/result.js';
import type { SkillId, QuestId, GoalId, UserId, Timestamp } from '../../../types/branded.js';
import { createTimestamp } from '../../../types/branded.js';
import { SwordKeys } from '../../../infrastructure/redis/keys.js';
import type { Skill, SkillMastery } from '../types.js';
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
import type { ISkillStore } from '../interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL STORE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Encrypted storage for Skill entities.
 *
 * Features:
 * - Quest-based indexing via Redis sets
 * - Goal-based indexing (denormalized for queries)
 * - User-based indexing
 * - Mastery tracking updates
 */
export class SkillStore extends SecureStore<Skill, SkillId> implements ISkillStore {
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

  protected getKey(id: SkillId): string {
    return SwordKeys.skill(id);
  }

  protected validate(skill: Skill): string | undefined {
    if (!skill.id) {
      return 'Skill ID is required';
    }
    if (!skill.questId) {
      return 'Quest ID is required';
    }
    if (!skill.goalId) {
      return 'Goal ID is required';
    }
    if (!skill.userId) {
      return 'User ID is required';
    }
    if (!skill.action || skill.action.trim().length === 0) {
      return 'Skill action is required';
    }
    if (skill.action.length > 1000) {
      return 'Skill action must be 1000 characters or less';
    }
    if (!skill.successSignal || skill.successSignal.trim().length === 0) {
      return 'Skill success signal is required';
    }
    if (skill.successSignal.length > 1000) {
      return 'Skill success signal must be 1000 characters or less';
    }
    if (!skill.lockedVariables || skill.lockedVariables.length === 0) {
      return 'At least one locked variable is required';
    }
    if (skill.estimatedMinutes <= 0) {
      return 'Estimated minutes must be positive';
    }
    if (skill.order < 1) {
      return 'Order must be 1 or greater';
    }
    return undefined;
  }

  protected getId(skill: Skill): SkillId {
    return skill.id;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Save a skill (create or update).
   */
  async save(skill: Skill, options: SaveOptions = {}): AsyncAppResult<SaveResult<Skill>> {
    // Save the skill entity
    const result = await this.saveEntity(skill, options);
    if (!result.ok) {
      return result;
    }

    // Update quest's skill index
    const questIndexResult = await this.addToQuestIndex(skill.questId, skill.id);
    if (!questIndexResult.ok) {
      // Rollback: delete the saved skill
      await this.deleteEntity(skill.id);
      return questIndexResult;
    }

    // Update goal's skill index (denormalized)
    const goalIndexResult = await this.addToGoalIndex(skill.goalId, skill.id);
    if (!goalIndexResult.ok) {
      // Rollback
      await this.removeFromQuestIndex(skill.questId, skill.id);
      await this.deleteEntity(skill.id);
      return goalIndexResult;
    }

    // Update user's skill index
    const userIndexResult = await this.addToUserIndex(skill.userId, skill.id);
    if (!userIndexResult.ok) {
      // Rollback
      await this.removeFromGoalIndex(skill.goalId, skill.id);
      await this.removeFromQuestIndex(skill.questId, skill.id);
      await this.deleteEntity(skill.id);
      return userIndexResult;
    }

    return ok({
      entity: skill,
      version: result.value.version,
      created: result.value.created,
    });
  }

  /**
   * Get a skill by ID.
   */
  async get(skillId: SkillId, options: GetOptions = {}): AsyncAppResult<Skill | null> {
    return this.getEntity(skillId, options);
  }

  /**
   * Delete a skill.
   */
  async delete(skillId: SkillId): AsyncAppResult<DeleteResult> {
    // Get the skill first to find indexes to update
    const skillResult = await this.getEntity(skillId);
    if (!skillResult.ok) {
      return err(skillResult.error);
    }

    if (skillResult.value === null) {
      return ok({ deleted: false });
    }

    const skill = skillResult.value;

    // Remove from indexes
    await this.removeFromQuestIndex(skill.questId, skillId);
    await this.removeFromGoalIndex(skill.goalId, skillId);
    await this.removeFromUserIndex(skill.userId, skillId);

    // Delete the skill entity
    const deleteResult = await this.deleteEntity(skillId);
    if (!deleteResult.ok) {
      return err(deleteResult.error);
    }

    return ok({ deleted: deleteResult.value });
  }

  /**
   * Get skills by quest.
   */
  async getByQuest(
    questId: QuestId,
    options: ListOptions = {}
  ): AsyncAppResult<ListResult<Skill>> {
    const { limit = 100, offset = 0, sortOrder = 'asc' } = options;

    try {
      const indexKey = SwordKeys.questSkills(questId);
      const skillIds = await this.store.smembers(indexKey);

      if (skillIds.length === 0) {
        return ok({ items: [], total: 0, hasMore: false });
      }

      // Fetch all skills
      const skills: Skill[] = [];
      for (const id of skillIds) {
        const result = await this.getEntity(id as SkillId);
        if (result.ok && result.value !== null) {
          skills.push(result.value);
        }
      }

      // Sort by order
      skills.sort((a, b) => {
        return sortOrder === 'asc' ? a.order - b.order : b.order - a.order;
      });

      // Apply pagination
      const total = skills.length;
      const paged = skills.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return ok({ items: paged, total, hasMore });
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get skills for quest: ${error instanceof Error ? error.message : String(error)}`,
          { questId }
        )
      );
    }
  }

  /**
   * Get skills by goal.
   */
  async getByGoal(
    goalId: GoalId,
    options: ListOptions = {}
  ): AsyncAppResult<ListResult<Skill>> {
    const { limit = 100, offset = 0, sortOrder = 'asc' } = options;

    try {
      const indexKey = SwordKeys.goalSkills(goalId);
      const skillIds = await this.store.smembers(indexKey);

      if (skillIds.length === 0) {
        return ok({ items: [], total: 0, hasMore: false });
      }

      // Fetch all skills
      const skills: Skill[] = [];
      for (const id of skillIds) {
        const result = await this.getEntity(id as SkillId);
        if (result.ok && result.value !== null) {
          skills.push(result.value);
        }
      }

      // Sort by order
      skills.sort((a, b) => {
        return sortOrder === 'asc' ? a.order - b.order : b.order - a.order;
      });

      // Apply pagination
      const total = skills.length;
      const paged = skills.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return ok({ items: paged, total, hasMore });
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get skills for goal: ${error instanceof Error ? error.message : String(error)}`,
          { goalId }
        )
      );
    }
  }

  /**
   * Get skills by user.
   */
  async getByUser(
    userId: UserId,
    options: ListOptions = {}
  ): AsyncAppResult<ListResult<Skill>> {
    const { limit = 100, offset = 0, sortOrder = 'asc' } = options;

    try {
      const indexKey = SwordKeys.userSkills(userId);
      const skillIds = await this.store.smembers(indexKey);

      if (skillIds.length === 0) {
        return ok({ items: [], total: 0, hasMore: false });
      }

      // Fetch all skills
      const skills: Skill[] = [];
      for (const id of skillIds) {
        const result = await this.getEntity(id as SkillId);
        if (result.ok && result.value !== null) {
          skills.push(result.value);
        }
      }

      // Sort by createdAt
      skills.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
      });

      // Apply pagination
      const total = skills.length;
      const paged = skills.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return ok({ items: paged, total, hasMore });
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to get skills for user: ${error instanceof Error ? error.message : String(error)}`,
          { userId }
        )
      );
    }
  }

  /**
   * Update skill mastery tracking.
   */
  async updateMastery(
    skillId: SkillId,
    mastery: SkillMastery,
    passCount: number,
    failCount: number,
    consecutivePasses: number
  ): AsyncAppResult<Skill> {
    // Get current skill
    const result = await this.getEntity(skillId);
    if (!result.ok) {
      return result;
    }
    if (result.value === null) {
      return err(
        storeError(StoreErrorCode.NOT_FOUND, `Skill not found: ${skillId}`, { skillId })
      );
    }

    const skill = result.value;

    // Create updated skill
    const updatedSkill: Skill = {
      ...skill,
      mastery,
      passCount,
      failCount,
      consecutivePasses,
      lastPracticedAt: createTimestamp(),
      updatedAt: createTimestamp(),
    };

    // Save updated skill
    const saveResult = await this.saveEntity(updatedSkill);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    return ok(updatedSkill);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INDEX MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  private async addToQuestIndex(questId: QuestId, skillId: SkillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.questSkills(questId);
      await this.store.sadd(indexKey, skillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to add skill to quest index: ${error instanceof Error ? error.message : String(error)}`,
          { questId, skillId }
        )
      );
    }
  }

  private async removeFromQuestIndex(questId: QuestId, skillId: SkillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.questSkills(questId);
      await this.store.srem(indexKey, skillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to remove skill from quest index: ${error instanceof Error ? error.message : String(error)}`,
          { questId, skillId }
        )
      );
    }
  }

  private async addToGoalIndex(goalId: GoalId, skillId: SkillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.goalSkills(goalId);
      await this.store.sadd(indexKey, skillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to add skill to goal index: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, skillId }
        )
      );
    }
  }

  private async removeFromGoalIndex(goalId: GoalId, skillId: SkillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.goalSkills(goalId);
      await this.store.srem(indexKey, skillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to remove skill from goal index: ${error instanceof Error ? error.message : String(error)}`,
          { goalId, skillId }
        )
      );
    }
  }

  private async addToUserIndex(userId: UserId, skillId: SkillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.userSkills(userId);
      await this.store.sadd(indexKey, skillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to add skill to user index: ${error instanceof Error ? error.message : String(error)}`,
          { userId, skillId }
        )
      );
    }
  }

  private async removeFromUserIndex(userId: UserId, skillId: SkillId): AsyncAppResult<void> {
    try {
      const indexKey = SwordKeys.userSkills(userId);
      await this.store.srem(indexKey, skillId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          StoreErrorCode.BACKEND_ERROR,
          `Failed to remove skill from user index: ${error instanceof Error ? error.message : String(error)}`,
          { userId, skillId }
        )
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a SkillStore instance.
 */
export function createSkillStore(
  store: KeyValueStore,
  config?: Partial<SecureStoreConfig>,
  encryption?: EncryptionService
): SkillStore {
  return new SkillStore(store, config, encryption);
}
