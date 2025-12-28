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

import type { AsyncAppResult, AppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';
import type {
  SkillId,
  QuestId,
  GoalId,
  UserId,
  Timestamp,
} from '../../types/branded.js';
import { createTimestamp } from '../../types/branded.js';
import type {
  Skill,
  SkillStatus,
  SkillMastery,
  QuestMilestone,
  MilestoneStatus,
} from './types.js';
import { MASTERY_THRESHOLDS } from './types.js';
import type {
  IUnlockService,
  IMasteryService,
  ISkillStore,
} from './interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of checking prerequisites.
 */
export interface PrerequisiteCheckResult {
  /** Whether all prerequisites are met */
  allMet: boolean;
  /** IDs of met prerequisites */
  metPrerequisites: readonly SkillId[];
  /** IDs of unmet prerequisites */
  unmetPrerequisites: readonly SkillId[];
  /** Human-readable reasons for unmet prerequisites */
  reasons: readonly string[];
}

/**
 * Result of unlocking skills.
 */
export interface UnlockResult {
  /** Skills that were unlocked */
  unlockedSkills: readonly Skill[];
  /** Skills that remain locked */
  stillLockedSkills: readonly Skill[];
  /** Number of skills unlocked */
  unlockedCount: number;
}

/**
 * Result of recording an outcome.
 */
export interface OutcomeResult {
  /** Updated skill */
  skill: Skill;
  /** Previous mastery level */
  previousMastery: SkillMastery;
  /** New mastery level */
  newMastery: SkillMastery;
  /** Whether mastery level changed */
  masteryChanged: boolean;
  /** Skills unlocked as a result (if any) */
  unlockedSkills: readonly Skill[];
}

/**
 * Mastery summary for a set of skills.
 */
export interface MasterySummary {
  /** Total skill count */
  total: number;
  /** Count by mastery level */
  byMastery: {
    not_started: number;
    practicing: number;
    mastered: number;
  };
  /** Percentage mastered */
  masteredPercent: number;
  /** Percentage in progress (practicing + mastered) */
  inProgressPercent: number;
}

/**
 * Locked skill with reason.
 */
export interface LockedSkillInfo {
  skill: Skill;
  missingPrerequisites: readonly SkillId[];
  reasons: readonly string[];
}

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
  async checkPrerequisites(
    skill: Skill,
    allSkills: readonly Skill[]
  ): AsyncAppResult<PrerequisiteCheckResult> {
    const skillMap = new Map(allSkills.map(s => [s.id, s]));
    const metPrereqs: SkillId[] = [];
    const unmetPrereqs: SkillId[] = [];
    const reasons: string[] = [];

    for (const prereqId of skill.prerequisiteSkillIds) {
      const prereq = skillMap.get(prereqId);

      if (!prereq) {
        // Prerequisite not found - might be from previous quest
        // Check if it's in the store
        const storeResult = await this.skillStore.get(prereqId);
        if (storeResult.ok && storeResult.value) {
          const storedPrereq = storeResult.value;
          if (storedPrereq.mastery === 'mastered') {
            metPrereqs.push(prereqId);
          } else {
            unmetPrereqs.push(prereqId);
            reasons.push(`"${storedPrereq.title}" not yet mastered (${storedPrereq.mastery})`);
          }
        } else {
          // Prerequisite truly not found
          unmetPrereqs.push(prereqId);
          reasons.push(`Prerequisite ${prereqId} not found`);
        }
      } else if (prereq.mastery === 'mastered') {
        metPrereqs.push(prereqId);
      } else {
        unmetPrereqs.push(prereqId);
        reasons.push(`"${prereq.title}" not yet mastered (${prereq.mastery})`);
      }
    }

    return ok({
      allMet: unmetPrereqs.length === 0,
      metPrerequisites: metPrereqs,
      unmetPrerequisites: unmetPrereqs,
      reasons,
    });
  }

  /**
   * Unlock all eligible skills after a mastery change.
   */
  async unlockEligibleSkills(
    questId: QuestId,
    allSkills: readonly Skill[]
  ): AsyncAppResult<UnlockResult> {
    const questSkills = allSkills.filter(s => s.questId === questId);
    const lockedSkills = questSkills.filter(s => s.status === 'locked');

    const unlockedSkills: Skill[] = [];
    const stillLockedSkills: Skill[] = [];

    for (const skill of lockedSkills) {
      const prereqCheck = await this.checkPrerequisites(skill, allSkills);

      if (!prereqCheck.ok) {
        stillLockedSkills.push(skill);
        continue;
      }

      if (prereqCheck.value.allMet) {
        // Unlock this skill
        const now = createTimestamp();
        const unlockedSkill: Skill = {
          ...skill,
          status: 'available',
          unlockedAt: now,
          updatedAt: now,
        };

        // Update in store
        const updateResult = await this.skillStore.update(unlockedSkill);
        if (updateResult.ok) {
          unlockedSkills.push(unlockedSkill);
          console.log(`[UNLOCK] Unlocked skill: "${skill.title}"`);
        } else {
          stillLockedSkills.push(skill);
        }
      } else {
        stillLockedSkills.push(skill);
      }
    }

    return ok({
      unlockedSkills,
      stillLockedSkills,
      unlockedCount: unlockedSkills.length,
    });
  }

  /**
   * Check if milestone is available (all skills mastered).
   */
  async checkMilestoneAvailability(
    questId: QuestId,
    allSkills: readonly Skill[],
    requiredMasteryPercent: number = 0.75
  ): AsyncAppResult<{ available: boolean; masteryPercent: number; reason?: string }> {
    const questSkills = allSkills.filter(s => s.questId === questId);

    if (questSkills.length === 0) {
      return ok({
        available: false,
        masteryPercent: 0,
        reason: 'No skills found for quest',
      });
    }

    // Exclude synthesis skill from count (it IS the milestone)
    const nonSynthesisSkills = questSkills.filter(s => s.skillType !== 'synthesis');
    const masteredCount = nonSynthesisSkills.filter(s => s.mastery === 'mastered').length;
    const masteryPercent = masteredCount / nonSynthesisSkills.length;

    if (masteryPercent >= requiredMasteryPercent) {
      return ok({
        available: true,
        masteryPercent,
      });
    }

    const neededCount = Math.ceil(nonSynthesisSkills.length * requiredMasteryPercent);
    const remaining = neededCount - masteredCount;

    return ok({
      available: false,
      masteryPercent,
      reason: `Need ${remaining} more skill${remaining === 1 ? '' : 's'} mastered (${Math.round(masteryPercent * 100)}% / ${Math.round(requiredMasteryPercent * 100)}% required)`,
    });
  }

  /**
   * Get all locked skills with reasons why they're locked.
   */
  async getLockedSkillsWithReasons(
    questId: QuestId,
    allSkills: readonly Skill[]
  ): AsyncAppResult<readonly LockedSkillInfo[]> {
    const questSkills = allSkills.filter(s => s.questId === questId);
    const lockedSkills = questSkills.filter(s => s.status === 'locked');

    const results: LockedSkillInfo[] = [];

    for (const skill of lockedSkills) {
      const prereqCheck = await this.checkPrerequisites(skill, allSkills);

      if (prereqCheck.ok) {
        results.push({
          skill,
          missingPrerequisites: prereqCheck.value.unmetPrerequisites,
          reasons: prereqCheck.value.reasons,
        });
      } else {
        results.push({
          skill,
          missingPrerequisites: skill.prerequisiteSkillIds,
          reasons: ['Unable to check prerequisites'],
        });
      }
    }

    return ok(results);
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
    passed: boolean,
    allSkills: readonly Skill[]
  ): AsyncAppResult<OutcomeResult> {
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
    const now = createTimestamp();

    // Update counts
    let passCount = skill.passCount;
    let failCount = skill.failCount;
    let consecutivePasses = skill.consecutivePasses;

    if (passed) {
      passCount += 1;
      consecutivePasses += 1;
    } else {
      failCount += 1;
      consecutivePasses = 0; // Reset on failure
    }

    // Calculate new mastery level
    const newMastery = this.calculateMastery(passCount, consecutivePasses);

    // Determine new status
    let newStatus: SkillStatus = skill.status;
    if (newMastery === 'mastered' && skill.status !== 'mastered') {
      newStatus = 'mastered';
    } else if (newMastery === 'practicing' && skill.status === 'available') {
      newStatus = 'in_progress';
    }

    // Build updated skill
    const updatedSkill: Skill = {
      ...skill,
      passCount,
      failCount,
      consecutivePasses,
      mastery: newMastery,
      status: newStatus,
      masteredAt: newMastery === 'mastered' && previousMastery !== 'mastered' ? now : skill.masteredAt,
      updatedAt: now,
    };

    // Persist update
    const updateResult = await this.skillStore.update(updatedSkill);
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    const masteryChanged = previousMastery !== newMastery;

    console.log(`[MASTERY] Skill "${skill.title}": ${previousMastery} → ${newMastery} (${passed ? 'pass' : 'fail'})`);

    // If mastery changed, check for unlocks
    let unlockedSkills: readonly Skill[] = [];
    if (masteryChanged && newMastery === 'mastered') {
      const unlockResult = await this.unlockService.unlockEligibleSkills(
        skill.questId,
        [...allSkills.filter(s => s.id !== skillId), updatedSkill]
      );

      if (unlockResult.ok) {
        unlockedSkills = unlockResult.value.unlockedSkills;
      }
    }

    return ok({
      skill: updatedSkill,
      previousMastery,
      newMastery,
      masteryChanged,
      unlockedSkills,
    });
  }

  /**
   * Get mastery summary for a set of skills.
   */
  getMasterySummary(skills: readonly Skill[]): MasterySummary {
    const total = skills.length;

    if (total === 0) {
      return {
        total: 0,
        byMastery: { not_started: 0, practicing: 0, mastered: 0 },
        masteredPercent: 0,
        inProgressPercent: 0,
      };
    }

    const byMastery = {
      not_started: skills.filter(s => s.mastery === 'not_started').length,
      practicing: skills.filter(s => s.mastery === 'practicing').length,
      mastered: skills.filter(s => s.mastery === 'mastered').length,
    };

    return {
      total,
      byMastery,
      masteredPercent: byMastery.mastered / total,
      inProgressPercent: (byMastery.practicing + byMastery.mastered) / total,
    };
  }

  /**
   * Get mastery percentage for a quest.
   */
  async getQuestMasteryPercent(
    questId: QuestId,
    allSkills: readonly Skill[]
  ): AsyncAppResult<number> {
    const questSkills = allSkills.filter(s => s.questId === questId);

    if (questSkills.length === 0) {
      return ok(0);
    }

    // Exclude synthesis from percentage (it's the milestone, not a prerequisite)
    const nonSynthesis = questSkills.filter(s => s.skillType !== 'synthesis');
    const mastered = nonSynthesis.filter(s => s.mastery === 'mastered').length;

    return ok(mastered / nonSynthesis.length);
  }

  /**
   * Calculate mastery level from pass count and consecutive passes.
   */
  private calculateMastery(passCount: number, consecutivePasses: number): SkillMastery {
    // Must have enough total passes AND consecutive passes
    if (
      passCount >= MASTERY_THRESHOLDS.MASTERED &&
      consecutivePasses >= MASTERY_THRESHOLDS.CONSECUTIVE_FOR_MASTERY
    ) {
      return 'mastered';
    }

    if (passCount >= MASTERY_THRESHOLDS.PRACTICING) {
      return 'practicing';
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

  async get(id: SkillId): AsyncAppResult<Skill | null> {
    return ok(this.skills.get(id) ?? null);
  }

  async getByQuest(questId: QuestId): AsyncAppResult<readonly Skill[]> {
    const result = Array.from(this.skills.values()).filter(s => s.questId === questId);
    return ok(result);
  }

  async getByGoal(goalId: GoalId): AsyncAppResult<readonly Skill[]> {
    const result = Array.from(this.skills.values()).filter(s => s.goalId === goalId);
    return ok(result);
  }

  async getByStatus(
    questId: QuestId,
    status: SkillStatus
  ): AsyncAppResult<readonly Skill[]> {
    const result = Array.from(this.skills.values())
      .filter(s => s.questId === questId && s.status === status);
    return ok(result);
  }

  async getByType(
    questId: QuestId,
    skillType: Skill['skillType']
  ): AsyncAppResult<readonly Skill[]> {
    const result = Array.from(this.skills.values())
      .filter(s => s.questId === questId && s.skillType === skillType);
    return ok(result);
  }

  async getAvailable(questId: QuestId): AsyncAppResult<readonly Skill[]> {
    return this.getByStatus(questId, 'available');
  }

  async getLocked(questId: QuestId): AsyncAppResult<readonly Skill[]> {
    return this.getByStatus(questId, 'locked');
  }

  async save(skill: Skill): AsyncAppResult<Skill> {
    this.skills.set(skill.id, skill);
    return ok(skill);
  }

  async saveBatch(skills: readonly Skill[]): AsyncAppResult<readonly Skill[]> {
    for (const skill of skills) {
      this.skills.set(skill.id, skill);
    }
    return ok(skills);
  }

  async update(skill: Skill): AsyncAppResult<Skill> {
    if (!this.skills.has(skill.id)) {
      return err(appError('NOT_FOUND', `Skill ${skill.id} not found`));
    }
    this.skills.set(skill.id, skill);
    return ok(skill);
  }

  async updateStatus(
    skillId: SkillId,
    status: SkillStatus
  ): AsyncAppResult<Skill> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return err(appError('NOT_FOUND', `Skill ${skillId} not found`));
    }

    const updated: Skill = {
      ...skill,
      status,
      updatedAt: createTimestamp(),
    };

    this.skills.set(skillId, updated);
    return ok(updated);
  }

  async delete(id: SkillId): AsyncAppResult<void> {
    this.skills.delete(id);
    return ok(undefined);
  }

  // Helper for tests
  clear(): void {
    this.skills.clear();
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
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
