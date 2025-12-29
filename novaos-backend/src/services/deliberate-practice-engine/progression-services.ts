// ═══════════════════════════════════════════════════════════════════════════════
// UNLOCK & MASTERY SERVICES — Phase 19E: Skill Progression Tracking
// NovaOS Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Two services that work together to manage skill progression:
//
// UnlockService:
//   - Checks if prerequisites are met for locked skills
//   - Unlocks skills when all prerequisites mastered
//   - Cascade unlocks when mastery achieved
//   - Checks milestone availability
//
// MasteryService:
//   - Records drill outcomes (pass/fail)
//   - Updates mastery level based on consecutive passes
//   - Triggers unlock checks after mastery changes
//   - Provides progress summaries
//
// KEY FLOW:
//   Drill Complete → MasteryService.recordOutcome()
//                  → Updates skill mastery
//                  → UnlockService.unlockEligibleSkills()
//                  → Cascade unlocks dependent skills
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';
import type {
  SkillId,
  QuestId,
  GoalId,
  UserId,
} from '../../types/branded.js';
import { createTimestamp } from '../../types/branded.js';
import type {
  Skill,
  SkillStatus,
  SkillMastery,
  SkillType,
  DrillOutcome,
} from './types.js';
import { MASTERY_THRESHOLDS } from './types.js';
import type {
  IUnlockService,
  IMasteryService,
  ISkillStore,
  PrerequisiteCheckResult,
  UnlockResult,
  MasteryUpdateResult,
  SaveOptions,
  GetOptions,
  ListOptions,
  SaveResult,
  DeleteResult,
  ListResult,
} from './interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// UNLOCK SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Service for managing skill unlocks based on prerequisites.
 */
export class UnlockService implements IUnlockService {
  constructor(private readonly skillStore: ISkillStore) {}

  /**
   * Check if all prerequisites are met for a skill.
   */
  async checkPrerequisites(skillId: SkillId): AsyncAppResult<PrerequisiteCheckResult> {
    // Get the skill
    const skillResult = await this.skillStore.get(skillId);
    if (!skillResult.ok) {
      return err(skillResult.error);
    }
    if (!skillResult.value) {
      return err(appError('NOT_FOUND', `Skill ${skillId} not found`));
    }

    const skill = skillResult.value;
    const metPrereqs: SkillId[] = [];
    const missingPrereqs: SkillId[] = [];
    const missingFromQuests: QuestId[] = [];

    for (const prereqId of skill.prerequisiteSkillIds) {
      const prereqResult = await this.skillStore.get(prereqId);
      
      if (prereqResult.ok && prereqResult.value) {
        const prereq = prereqResult.value;
        if (prereq.mastery === 'mastered') {
          metPrereqs.push(prereqId);
        } else {
          missingPrereqs.push(prereqId);
          if (!missingFromQuests.includes(prereq.questId)) {
            missingFromQuests.push(prereq.questId);
          }
        }
      } else {
        // Prerequisite not found
        missingPrereqs.push(prereqId);
      }
    }

    return ok({
      allMet: missingPrereqs.length === 0,
      metPrerequisites: metPrereqs,
      missingPrerequisites: missingPrereqs,
      missingFromQuests,
    });
  }

  /**
   * Unlock all eligible skills after a mastery change.
   */
  async unlockEligibleSkills(masteredSkillId: SkillId): AsyncAppResult<UnlockResult> {
    // Get the mastered skill to find its goal
    const masteredResult = await this.skillStore.get(masteredSkillId);
    if (!masteredResult.ok || !masteredResult.value) {
      return ok({
        unlockedSkillIds: [],
        stillLockedSkillIds: [],
        milestoneUnlocked: false,
      });
    }

    const masteredSkill = masteredResult.value;
    
    // Get all locked skills in the goal
    const lockedResult = await this.skillStore.getLocked(masteredSkill.goalId);
    if (!lockedResult.ok) {
      return err(lockedResult.error);
    }

    const unlockedSkillIds: SkillId[] = [];
    const stillLockedSkillIds: SkillId[] = [];

    for (const skill of lockedResult.value) {
      // Check if this skill depends on the mastered skill
      if (!skill.prerequisiteSkillIds.includes(masteredSkillId)) {
        stillLockedSkillIds.push(skill.id);
        continue;
      }

      // Check all prerequisites
      const prereqCheck = await this.checkPrerequisites(skill.id);
      if (!prereqCheck.ok) {
        stillLockedSkillIds.push(skill.id);
        continue;
      }

      if (prereqCheck.value.allMet) {
        // Unlock this skill
        const updateResult = await this.skillStore.updateStatus(skill.id, 'available');
        if (updateResult.ok) {
          unlockedSkillIds.push(skill.id);
        } else {
          stillLockedSkillIds.push(skill.id);
        }
      } else {
        stillLockedSkillIds.push(skill.id);
      }
    }

    // Check if milestone should be unlocked
    const milestoneCheck = await this.checkMilestoneAvailability(masteredSkill.questId, 0.75);
    const milestoneUnlocked = milestoneCheck.ok && milestoneCheck.value;

    return ok({
      unlockedSkillIds,
      stillLockedSkillIds,
      milestoneUnlocked,
    });
  }

  /**
   * Check if milestone is available based on mastery percentage.
   */
  async checkMilestoneAvailability(
    questId: QuestId,
    requiredMasteryPercent: number
  ): AsyncAppResult<boolean> {
    // Get all skills for the quest
    const skillsResult = await this.skillStore.getByQuest(questId);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }

    const skills = skillsResult.value.items;
    if (skills.length === 0) {
      return ok(false);
    }

    // Exclude synthesis skills from the calculation
    const nonSynthesisSkills = skills.filter((s: Skill) => s.skillType !== 'synthesis');
    if (nonSynthesisSkills.length === 0) {
      return ok(true);
    }

    const masteredCount = nonSynthesisSkills.filter((s: Skill) => s.mastery === 'mastered').length;
    const masteryPercent = masteredCount / nonSynthesisSkills.length;

    return ok(masteryPercent >= requiredMasteryPercent);
  }

  /**
   * Get all locked skills and their missing prerequisites.
   */
  async getLockedSkillsWithReasons(
    goalId: GoalId
  ): AsyncAppResult<ReadonlyMap<SkillId, readonly SkillId[]>> {
    const lockedResult = await this.skillStore.getLocked(goalId);
    if (!lockedResult.ok) {
      return err(lockedResult.error);
    }

    const result = new Map<SkillId, readonly SkillId[]>();

    for (const skill of lockedResult.value) {
      const prereqCheck = await this.checkPrerequisites(skill.id);
      if (prereqCheck.ok) {
        result.set(skill.id, prereqCheck.value.missingPrerequisites);
      } else {
        result.set(skill.id, skill.prerequisiteSkillIds);
      }
    }

    return ok(result);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTERY SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Service for tracking skill mastery based on drill outcomes.
 */
export class MasteryService implements IMasteryService {
  constructor(
    private readonly skillStore: ISkillStore,
    private readonly unlockService: IUnlockService
  ) {}

  /**
   * Record the outcome of a drill and update mastery.
   */
  async recordOutcome(
    skillId: SkillId,
    outcome: DrillOutcome
  ): AsyncAppResult<MasteryUpdateResult> {
    // Get current skill
    const skillResult = await this.skillStore.get(skillId);
    if (!skillResult.ok) {
      return err(skillResult.error);
    }

    const skill = skillResult.value;
    if (!skill) {
      return err(appError('NOT_FOUND', `Skill ${skillId} not found`));
    }

    const previousMastery = skill.mastery;
    const previousStatus = skill.status;

    // Update counts based on outcome
    let passCount = skill.passCount;
    let failCount = skill.failCount;
    let consecutivePasses = skill.consecutivePasses;

    if (outcome === 'pass') {
      passCount += 1;
      consecutivePasses += 1;
    } else if (outcome === 'fail') {
      failCount += 1;
      consecutivePasses = 0;
    }
    // 'partial' and 'skipped' don't change mastery counts

    // Calculate new mastery level
    const newMastery = this.calculateMastery(passCount, consecutivePasses);

    // Determine new status
    let newStatus: SkillStatus = skill.status;
    if (newMastery === 'mastered' && skill.status !== 'mastered') {
      newStatus = 'mastered';
    } else if (newMastery === 'practicing' && skill.status === 'available') {
      newStatus = 'in_progress';
    }

    // Update skill mastery in store
    const updateResult = await this.skillStore.updateMastery(
      skillId,
      newMastery,
      passCount,
      failCount,
      consecutivePasses
    );

    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    const updatedSkill = updateResult.value;
    const justMastered = newMastery === 'mastered' && previousMastery !== 'mastered';

    // If skill was just mastered, check for unlocks
    let unlockedSkills: readonly Skill[] = [];
    let milestoneUnlocked = false;

    if (justMastered) {
      const unlockResult = await this.unlockService.unlockEligibleSkills(skillId);
      if (unlockResult.ok) {
        milestoneUnlocked = unlockResult.value.milestoneUnlocked;
        
        // Fetch the actually unlocked skills
        const fetchedSkills: Skill[] = [];
        for (const unlockedId of unlockResult.value.unlockedSkillIds) {
          const fetchResult = await this.skillStore.get(unlockedId);
          if (fetchResult.ok && fetchResult.value) {
            fetchedSkills.push(fetchResult.value);
          }
        }
        unlockedSkills = fetchedSkills;
      }
    }

    return ok({
      skill: updatedSkill,
      previousMastery,
      newMastery,
      previousStatus,
      newStatus,
      justMastered,
      unlockedSkills,
      milestoneUnlocked,
    });
  }

  /**
   * Get mastery summary for a goal.
   */
  async getMasterySummary(goalId: GoalId): AsyncAppResult<{
    readonly notStarted: number;
    readonly attempting: number;
    readonly practicing: number;
    readonly mastered: number;
    readonly total: number;
  }> {
    const skillsResult = await this.skillStore.getByGoal(goalId);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }

    const skills = skillsResult.value.items;
    const total = skills.length;

    if (total === 0) {
      return ok({
        notStarted: 0,
        attempting: 0,
        practicing: 0,
        mastered: 0,
        total: 0,
      });
    }

    return ok({
      notStarted: skills.filter((s: Skill) => s.mastery === 'not_started').length,
      attempting: skills.filter((s: Skill) => s.mastery === 'attempting').length,
      practicing: skills.filter((s: Skill) => s.mastery === 'practicing').length,
      mastered: skills.filter((s: Skill) => s.mastery === 'mastered').length,
      total,
    });
  }

  /**
   * Get mastery percentage for a quest.
   */
  async getQuestMasteryPercent(questId: QuestId): AsyncAppResult<number> {
    const skillsResult = await this.skillStore.getByQuest(questId);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }

    const skills = skillsResult.value.items;
    if (skills.length === 0) {
      return ok(0);
    }

    // Exclude synthesis from percentage
    const nonSynthesis = skills.filter((s: Skill) => s.skillType !== 'synthesis');
    if (nonSynthesis.length === 0) {
      return ok(1);
    }

    const mastered = nonSynthesis.filter((s: Skill) => s.mastery === 'mastered').length;
    return ok(mastered / nonSynthesis.length);
  }

  /**
   * Calculate mastery level from pass count and consecutive passes.
   */
  private calculateMastery(passCount: number, consecutivePasses: number): SkillMastery {
    if (
      passCount >= MASTERY_THRESHOLDS.MASTERED &&
      consecutivePasses >= MASTERY_THRESHOLDS.CONSECUTIVE_FOR_MASTERY
    ) {
      return 'mastered';
    }

    if (passCount >= MASTERY_THRESHOLDS.PRACTICING) {
      return 'practicing';
    }

    if (passCount > 0) {
      return 'attempting';
    }

    return 'not_started';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY SKILL STORE (for testing/standalone use)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simple in-memory skill store implementation.
 * For production, use Redis-backed store.
 */
export class InMemorySkillStore implements ISkillStore {
  private skills: Map<SkillId, Skill> = new Map();
  private version = 0;

  async get(id: SkillId, _options?: GetOptions): AsyncAppResult<Skill | null> {
    return ok(this.skills.get(id) ?? null);
  }

  async save(skill: Skill, _options?: SaveOptions): AsyncAppResult<SaveResult<Skill>> {
    const created = !this.skills.has(skill.id);
    this.skills.set(skill.id, skill);
    this.version++;
    return ok({
      entity: skill,
      version: this.version,
      created,
    });
  }

  async delete(id: SkillId): AsyncAppResult<DeleteResult> {
    const existed = this.skills.has(id);
    this.skills.delete(id);
    return ok({
      deleted: existed,
      id: id as string,
    });
  }

  async getByQuest(questId: QuestId, _options?: ListOptions): AsyncAppResult<ListResult<Skill>> {
    const items = Array.from(this.skills.values()).filter((s: Skill) => s.questId === questId);
    return ok({
      items,
      total: items.length,
      hasMore: false,
    });
  }

  async getByGoal(goalId: GoalId, _options?: ListOptions): AsyncAppResult<ListResult<Skill>> {
    const items = Array.from(this.skills.values()).filter((s: Skill) => s.goalId === goalId);
    return ok({
      items,
      total: items.length,
      hasMore: false,
    });
  }

  async getByUser(userId: UserId, _options?: ListOptions): AsyncAppResult<ListResult<Skill>> {
    const items = Array.from(this.skills.values()).filter((s: Skill) => s.userId === userId);
    return ok({
      items,
      total: items.length,
      hasMore: false,
    });
  }

  async getByStatus(goalId: GoalId, status: SkillStatus): AsyncAppResult<readonly Skill[]> {
    const result = Array.from(this.skills.values())
      .filter((s: Skill) => s.goalId === goalId && s.status === status);
    return ok(result);
  }

  async getByType(questId: QuestId, skillType: SkillType): AsyncAppResult<readonly Skill[]> {
    const result = Array.from(this.skills.values())
      .filter((s: Skill) => s.questId === questId && s.skillType === skillType);
    return ok(result);
  }

  async getAvailable(goalId: GoalId): AsyncAppResult<readonly Skill[]> {
    return this.getByStatus(goalId, 'available');
  }

  async getLocked(goalId: GoalId): AsyncAppResult<readonly Skill[]> {
    return this.getByStatus(goalId, 'locked');
  }

  async updateMastery(
    skillId: SkillId,
    mastery: SkillMastery,
    passCount: number,
    failCount: number,
    consecutivePasses: number
  ): AsyncAppResult<Skill> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return err(appError('NOT_FOUND', `Skill ${skillId} not found`));
    }

    const now = createTimestamp();
    const updated: Skill = {
      ...skill,
      mastery,
      passCount,
      failCount,
      consecutivePasses,
      masteredAt: mastery === 'mastered' && skill.mastery !== 'mastered' ? now : skill.masteredAt,
      lastPracticedAt: now,
      updatedAt: now,
    };

    this.skills.set(skillId, updated);
    return ok(updated);
  }

  async updateStatus(skillId: SkillId, status: SkillStatus): AsyncAppResult<Skill> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return err(appError('NOT_FOUND', `Skill ${skillId} not found`));
    }

    const updated: Skill = {
      ...skill,
      status,
      unlockedAt: status === 'available' && skill.status === 'locked' ? createTimestamp() : skill.unlockedAt,
      updatedAt: createTimestamp(),
    };

    this.skills.set(skillId, updated);
    return ok(updated);
  }

  // Helper methods for tests
  clear(): void {
    this.skills.clear();
    this.version = 0;
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  async saveBatch(skills: readonly Skill[]): AsyncAppResult<readonly Skill[]> {
    for (const skill of skills) {
      this.skills.set(skill.id, skill);
    }
    return ok(skills);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an UnlockService instance.
 */
export function createUnlockService(skillStore: ISkillStore): UnlockService {
  return new UnlockService(skillStore);
}

/**
 * Create a MasteryService instance.
 */
export function createMasteryService(
  skillStore: ISkillStore,
  unlockService: IUnlockService
): MasteryService {
  return new MasteryService(skillStore, unlockService);
}

/**
 * Create both services with shared store.
 */
export function createProgressionServices(skillStore: ISkillStore): {
  unlockService: UnlockService;
  masteryService: MasteryService;
} {
  const unlockService = createUnlockService(skillStore);
  const masteryService = createMasteryService(skillStore, unlockService);
  return { unlockService, masteryService };
}

/**
 * Create in-memory skill store (for testing).
 */
export function createInMemorySkillStore(): InMemorySkillStore {
  return new InMemorySkillStore();
}
