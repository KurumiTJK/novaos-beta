// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESSION SERVICES TESTS — Phase 19E
// NovaOS Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  UnlockService,
  MasteryService,
  InMemorySkillStore,
  createUnlockService,
  createMasteryService,
  createProgressionServices,
  createInMemorySkillStore,
} from './progression-services.js';
import type { Skill, SkillMastery, SkillStatus } from './types.js';
import type { GoalId, QuestId, UserId, SkillId, Timestamp } from '../../types/branded.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

function createMockSkill(overrides?: Partial<Skill>): Skill {
  const id = overrides?.id ?? (`skill_${Math.random().toString(36).slice(2, 8)}` as SkillId);
  return {
    id,
    questId: 'quest_1' as QuestId,
    goalId: 'goal_1' as GoalId,
    userId: 'user_1' as UserId,
    title: 'Test Skill',
    topic: 'testing',
    action: 'Test action',
    successSignal: 'Test passes',
    lockedVariables: [],
    estimatedMinutes: 20,
    skillType: 'foundation',
    depth: 0,
    prerequisiteSkillIds: [],
    prerequisiteQuestIds: [],
    isCompound: false,
    weekNumber: 1,
    dayInWeek: 1,
    dayInQuest: 1,
    order: 1,
    difficulty: 'intro',
    mastery: 'not_started',
    status: 'available',
    passCount: 0,
    failCount: 0,
    consecutivePasses: 0,
    createdAt: '2025-01-01T00:00:00Z' as Timestamp,
    updatedAt: '2025-01-01T00:00:00Z' as Timestamp,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNLOCK SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('UnlockService', () => {
  let skillStore: InMemorySkillStore;
  let unlockService: UnlockService;

  beforeEach(() => {
    skillStore = createInMemorySkillStore();
    unlockService = createUnlockService(skillStore);
  });

  describe('checkPrerequisites', () => {
    it('should return allMet=true when no prerequisites', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        prerequisiteSkillIds: [],
      });

      await skillStore.save(skill);

      const result = await unlockService.checkPrerequisites(skill.id);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.allMet).toBe(true);
      expect(result.value.metPrerequisites).toHaveLength(0);
      expect(result.value.missingPrerequisites).toHaveLength(0);
    });

    it('should return allMet=true when all prerequisites mastered', async () => {
      const prereq1 = createMockSkill({
        id: 'prereq_1' as SkillId,
        mastery: 'mastered',
      });
      const prereq2 = createMockSkill({
        id: 'prereq_2' as SkillId,
        mastery: 'mastered',
      });
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        prerequisiteSkillIds: ['prereq_1' as SkillId, 'prereq_2' as SkillId],
      });

      await skillStore.save(prereq1);
      await skillStore.save(prereq2);
      await skillStore.save(skill);

      const result = await unlockService.checkPrerequisites(skill.id);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.allMet).toBe(true);
      expect(result.value.metPrerequisites).toHaveLength(2);
      expect(result.value.missingPrerequisites).toHaveLength(0);
    });

    it('should return allMet=false when prerequisites not mastered', async () => {
      const prereq = createMockSkill({
        id: 'prereq_1' as SkillId,
        mastery: 'practicing',
      });
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        prerequisiteSkillIds: ['prereq_1' as SkillId],
      });

      await skillStore.save(prereq);
      await skillStore.save(skill);

      const result = await unlockService.checkPrerequisites(skill.id);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.allMet).toBe(false);
      expect(result.value.metPrerequisites).toHaveLength(0);
      expect(result.value.missingPrerequisites).toContain('prereq_1');
    });

    it('should handle missing prerequisite skill', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        prerequisiteSkillIds: ['missing_prereq' as SkillId],
      });

      await skillStore.save(skill);

      const result = await unlockService.checkPrerequisites(skill.id);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.allMet).toBe(false);
      expect(result.value.missingPrerequisites).toContain('missing_prereq');
    });
  });

  describe('unlockEligibleSkills', () => {
    it('should unlock skills with all prerequisites met', async () => {
      const foundation = createMockSkill({
        id: 'foundation' as SkillId,
        mastery: 'mastered',
        status: 'mastered',
      });
      const building = createMockSkill({
        id: 'building' as SkillId,
        status: 'locked',
        prerequisiteSkillIds: ['foundation' as SkillId],
      });

      await skillStore.save(foundation);
      await skillStore.save(building);

      const result = await unlockService.unlockEligibleSkills(foundation.id);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.unlockedSkillIds).toHaveLength(1);
      expect(result.value.unlockedSkillIds).toContain('building');
    });

    it('should not unlock skills with unmet prerequisites', async () => {
      const prereq1 = createMockSkill({
        id: 'prereq_1' as SkillId,
        mastery: 'mastered',
      });
      const prereq2 = createMockSkill({
        id: 'prereq_2' as SkillId,
        mastery: 'practicing', // Not mastered
      });
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        status: 'locked',
        prerequisiteSkillIds: ['prereq_1' as SkillId, 'prereq_2' as SkillId],
      });

      await skillStore.save(prereq1);
      await skillStore.save(prereq2);
      await skillStore.save(skill);

      const result = await unlockService.unlockEligibleSkills(prereq1.id);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.unlockedSkillIds).toHaveLength(0);
      expect(result.value.stillLockedSkillIds).toContain('skill_1');
    });

    it('should cascade unlocks when multiple skills become available', async () => {
      const foundation = createMockSkill({
        id: 'foundation' as SkillId,
        mastery: 'mastered',
      });
      const level1 = createMockSkill({
        id: 'level1' as SkillId,
        status: 'locked',
        prerequisiteSkillIds: ['foundation' as SkillId],
      });
      const level2 = createMockSkill({
        id: 'level2' as SkillId,
        status: 'locked',
        prerequisiteSkillIds: ['foundation' as SkillId],
      });

      await skillStore.save(foundation);
      await skillStore.save(level1);
      await skillStore.save(level2);

      const result = await unlockService.unlockEligibleSkills(foundation.id);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.unlockedSkillIds).toHaveLength(2);
    });
  });

  describe('checkMilestoneAvailability', () => {
    it('should return true when mastery threshold met', async () => {
      const questId = 'quest_1' as QuestId;

      // 3 mastered, 1 not mastered (75%)
      await skillStore.save(createMockSkill({ id: 's1' as SkillId, questId, mastery: 'mastered' }));
      await skillStore.save(createMockSkill({ id: 's2' as SkillId, questId, mastery: 'mastered' }));
      await skillStore.save(createMockSkill({ id: 's3' as SkillId, questId, mastery: 'mastered' }));
      await skillStore.save(createMockSkill({ id: 's4' as SkillId, questId, mastery: 'practicing' }));

      const result = await unlockService.checkMilestoneAvailability(questId, 0.75);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value).toBe(true);
    });

    it('should return false when below threshold', async () => {
      const questId = 'quest_1' as QuestId;

      // 2 mastered, 2 not mastered (50%)
      await skillStore.save(createMockSkill({ id: 's1' as SkillId, questId, mastery: 'mastered' }));
      await skillStore.save(createMockSkill({ id: 's2' as SkillId, questId, mastery: 'mastered' }));
      await skillStore.save(createMockSkill({ id: 's3' as SkillId, questId, mastery: 'practicing' }));
      await skillStore.save(createMockSkill({ id: 's4' as SkillId, questId, mastery: 'not_started' }));

      const result = await unlockService.checkMilestoneAvailability(questId, 0.75);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value).toBe(false);
    });

    it('should exclude synthesis skills from calculation', async () => {
      const questId = 'quest_1' as QuestId;

      // 2 foundation mastered, 1 synthesis not mastered
      await skillStore.save(createMockSkill({ id: 's1' as SkillId, questId, mastery: 'mastered', skillType: 'foundation' }));
      await skillStore.save(createMockSkill({ id: 's2' as SkillId, questId, mastery: 'mastered', skillType: 'foundation' }));
      await skillStore.save(createMockSkill({ id: 'syn' as SkillId, questId, mastery: 'not_started', skillType: 'synthesis' }));

      const result = await unlockService.checkMilestoneAvailability(questId, 1.0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // 2/2 foundation mastered = 100%
      expect(result.value).toBe(true);
    });
  });

  describe('getLockedSkillsWithReasons', () => {
    it('should return locked skills with missing prerequisites', async () => {
      const goalId = 'goal_1' as GoalId;
      const prereq = createMockSkill({
        id: 'prereq' as SkillId,
        goalId,
        mastery: 'practicing',
      });
      const locked = createMockSkill({
        id: 'locked' as SkillId,
        goalId,
        status: 'locked',
        prerequisiteSkillIds: ['prereq' as SkillId],
      });

      await skillStore.save(prereq);
      await skillStore.save(locked);

      const result = await unlockService.getLockedSkillsWithReasons(goalId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.size).toBe(1);
      expect(result.value.has('locked' as SkillId)).toBe(true);
      expect(result.value.get('locked' as SkillId)).toContain('prereq');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MASTERY SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('MasteryService', () => {
  let skillStore: InMemorySkillStore;
  let unlockService: UnlockService;
  let masteryService: MasteryService;

  beforeEach(() => {
    skillStore = createInMemorySkillStore();
    unlockService = createUnlockService(skillStore);
    masteryService = createMasteryService(skillStore, unlockService);
  });

  describe('recordOutcome', () => {
    it('should increment pass count on pass', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        passCount: 0,
        consecutivePasses: 0,
      });

      await skillStore.save(skill);

      const result = await masteryService.recordOutcome(skill.id, 'pass');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.skill.passCount).toBe(1);
      expect(result.value.skill.consecutivePasses).toBe(1);
    });

    it('should increment fail count and reset consecutive on fail', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        passCount: 2,
        failCount: 0,
        consecutivePasses: 2,
      });

      await skillStore.save(skill);

      const result = await masteryService.recordOutcome(skill.id, 'fail');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.skill.failCount).toBe(1);
      expect(result.value.skill.consecutivePasses).toBe(0);
    });

    it('should progress to practicing after first pass (PRACTICING threshold = 1)', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        mastery: 'not_started',
        passCount: 0,
      });

      await skillStore.save(skill);

      const result = await masteryService.recordOutcome(skill.id, 'pass');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.previousMastery).toBe('not_started');
      // MASTERY_THRESHOLDS.PRACTICING = 1, so first pass reaches practicing
      expect(result.value.newMastery).toBe('practicing');
    });

    it('should stay at practicing while building consecutive passes', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        mastery: 'practicing',
        passCount: 1, // At PRACTICING threshold (1)
        consecutivePasses: 1,
      });

      await skillStore.save(skill);

      const result = await masteryService.recordOutcome(skill.id, 'pass');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Still practicing, building toward mastered
      expect(result.value.newMastery).toBe('practicing');
      expect(result.value.skill.passCount).toBe(2);
      expect(result.value.skill.consecutivePasses).toBe(2);
    });

    it('should progress to mastered after threshold passes', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        mastery: 'practicing',
        passCount: 2, // One more reaches MASTERED threshold (3)
        consecutivePasses: 1, // One more reaches CONSECUTIVE_FOR_MASTERY (2)
      });

      await skillStore.save(skill);

      const result = await masteryService.recordOutcome(skill.id, 'pass');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.newMastery).toBe('mastered');
      expect(result.value.skill.masteredAt).toBeDefined();
      expect(result.value.justMastered).toBe(true);
    });

    it('should trigger unlock cascade on mastery', async () => {
      const foundation = createMockSkill({
        id: 'foundation' as SkillId,
        mastery: 'practicing',
        passCount: 2, // One more reaches MASTERED (3)
        consecutivePasses: 1, // One more reaches CONSECUTIVE (2)
      });
      const building = createMockSkill({
        id: 'building' as SkillId,
        status: 'locked',
        prerequisiteSkillIds: ['foundation' as SkillId],
      });

      await skillStore.save(foundation);
      await skillStore.save(building);

      const result = await masteryService.recordOutcome(foundation.id, 'pass');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.newMastery).toBe('mastered');
      expect(result.value.unlockedSkills).toHaveLength(1);
      expect(result.value.unlockedSkills[0]?.id).toBe('building');
    });
  });

  describe('getMasterySummary', () => {
    it('should calculate correct summary', async () => {
      const goalId = 'goal_1' as GoalId;

      await skillStore.save(createMockSkill({ id: 's1' as SkillId, goalId, mastery: 'not_started' }));
      await skillStore.save(createMockSkill({ id: 's2' as SkillId, goalId, mastery: 'not_started' }));
      await skillStore.save(createMockSkill({ id: 's3' as SkillId, goalId, mastery: 'practicing' }));
      await skillStore.save(createMockSkill({ id: 's4' as SkillId, goalId, mastery: 'practicing' }));
      await skillStore.save(createMockSkill({ id: 's5' as SkillId, goalId, mastery: 'mastered' }));

      const result = await masteryService.getMasterySummary(goalId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.total).toBe(5);
      expect(result.value.notStarted).toBe(2);
      expect(result.value.practicing).toBe(2);
      expect(result.value.mastered).toBe(1);
    });

    it('should handle empty goal', async () => {
      const result = await masteryService.getMasterySummary('empty_goal' as GoalId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.total).toBe(0);
    });
  });

  describe('getQuestMasteryPercent', () => {
    it('should calculate percentage excluding synthesis', async () => {
      const questId = 'quest_1' as QuestId;

      await skillStore.save(createMockSkill({ id: 's1' as SkillId, questId, mastery: 'mastered', skillType: 'foundation' }));
      await skillStore.save(createMockSkill({ id: 's2' as SkillId, questId, mastery: 'mastered', skillType: 'building' }));
      await skillStore.save(createMockSkill({ id: 's3' as SkillId, questId, mastery: 'practicing', skillType: 'foundation' }));
      await skillStore.save(createMockSkill({ id: 'syn' as SkillId, questId, mastery: 'not_started', skillType: 'synthesis' }));

      const result = await masteryService.getQuestMasteryPercent(questId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // 2/3 non-synthesis mastered
      expect(result.value).toBeCloseTo(0.667, 2);
    });

    it('should return 0 for empty quest', async () => {
      const result = await masteryService.getQuestMasteryPercent('empty_quest' as QuestId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY SKILL STORE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('InMemorySkillStore', () => {
  let store: InMemorySkillStore;

  beforeEach(() => {
    store = createInMemorySkillStore();
  });

  it('should save and retrieve skill', async () => {
    const skill = createMockSkill({ id: 'skill_1' as SkillId });

    await store.save(skill);

    const result = await store.get('skill_1' as SkillId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.id).toBe('skill_1');
    }
  });

  it('should get skills by quest (returns ListResult)', async () => {
    const questId = 'quest_1' as QuestId;

    await store.save(createMockSkill({ id: 's1' as SkillId, questId }));
    await store.save(createMockSkill({ id: 's2' as SkillId, questId }));
    await store.save(createMockSkill({ id: 's3' as SkillId, questId: 'other' as QuestId }));

    const result = await store.getByQuest(questId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // getByQuest returns ListResult<Skill>
    expect(result.value.items).toHaveLength(2);
    expect(result.value.total).toBe(2);
  });

  it('should get skills by status', async () => {
    const goalId = 'goal_1' as GoalId;

    await store.save(createMockSkill({ id: 's1' as SkillId, goalId, status: 'available' }));
    await store.save(createMockSkill({ id: 's2' as SkillId, goalId, status: 'available' }));
    await store.save(createMockSkill({ id: 's3' as SkillId, goalId, status: 'locked' }));

    const result = await store.getByStatus(goalId, 'available');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // getByStatus returns readonly Skill[]
    expect(result.value).toHaveLength(2);
  });

  it('should update skill mastery', async () => {
    const skill = createMockSkill({ id: 'skill_1' as SkillId });
    await store.save(skill);

    const result = await store.updateMastery(
      'skill_1' as SkillId,
      'mastered',
      5,
      1,
      3
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.mastery).toBe('mastered');
    expect(result.value.passCount).toBe(5);
    expect(result.value.failCount).toBe(1);
    expect(result.value.consecutivePasses).toBe(3);
  });

  it('should update skill status', async () => {
    const skill = createMockSkill({ id: 'skill_1' as SkillId, status: 'locked' });
    await store.save(skill);

    const result = await store.updateStatus('skill_1' as SkillId, 'available');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe('available');
    expect(result.value.unlockedAt).toBeDefined();
  });

  it('should delete skill', async () => {
    const skill = createMockSkill({ id: 'skill_1' as SkillId });
    await store.save(skill);

    const deleteResult = await store.delete('skill_1' as SkillId);
    expect(deleteResult.ok).toBe(true);

    const getResult = await store.get('skill_1' as SkillId);
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).toBeNull();
    }
  });

  it('should save and update with save() (no update method)', async () => {
    const skill = createMockSkill({ id: 'skill_1' as SkillId, mastery: 'not_started' });
    await store.save(skill);

    // Use save() to update (no separate update method)
    const updated = { ...skill, mastery: 'mastered' as SkillMastery };
    await store.save(updated);

    const result = await store.get('skill_1' as SkillId);
    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.mastery).toBe('mastered');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Progression Services Integration', () => {
  it('should handle full mastery flow', async () => {
    const skillStore = createInMemorySkillStore();
    const { unlockService, masteryService } = createProgressionServices(skillStore);

    // Create skill chain: foundation → building → compound
    const foundation = createMockSkill({
      id: 'foundation' as SkillId,
      status: 'available',
      mastery: 'not_started',
    });
    const building = createMockSkill({
      id: 'building' as SkillId,
      status: 'locked',
      prerequisiteSkillIds: ['foundation' as SkillId],
    });
    const compound = createMockSkill({
      id: 'compound' as SkillId,
      status: 'locked',
      skillType: 'compound',
      prerequisiteSkillIds: ['building' as SkillId],
    });

    await skillStore.save(foundation);
    await skillStore.save(building);
    await skillStore.save(compound);

    // Practice foundation until mastery (5 passes, 3 consecutive)
    for (let i = 0; i < 5; i++) {
      await masteryService.recordOutcome(foundation.id, 'pass');
    }

    // Check foundation is mastered and building is unlocked
    const foundationCheck = await skillStore.get(foundation.id);
    expect(foundationCheck.ok && foundationCheck.value?.mastery).toBe('mastered');

    const buildingCheck = await skillStore.get(building.id);
    expect(buildingCheck.ok && buildingCheck.value?.status).toBe('available');

    // Compound should still be locked
    const compoundCheck = await skillStore.get(compound.id);
    expect(compoundCheck.ok && compoundCheck.value?.status).toBe('locked');
  });
});
