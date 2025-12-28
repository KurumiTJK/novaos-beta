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
import { MASTERY_THRESHOLDS } from './types.js';
import type { GoalId, QuestId, UserId, Timestamp, SkillId } from '../../types/branded.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

function createMockSkill(overrides?: Partial<Skill>): Skill {
  return {
    id: `skill_${Math.random().toString(36).slice(2, 8)}` as SkillId,
    questId: 'quest_week1' as QuestId,
    goalId: 'goal_test123' as GoalId,
    userId: 'user_abc' as UserId,
    title: 'Test Skill',
    topic: 'testing',
    action: 'Complete the test task',
    successSignal: 'Task completed successfully',
    lockedVariables: [],
    estimatedMinutes: 25,
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
  let store: InMemorySkillStore;
  let unlockService: UnlockService;

  beforeEach(() => {
    store = createInMemorySkillStore();
    unlockService = createUnlockService(store);
  });

  describe('checkPrerequisites', () => {
    it('should return allMet=true when no prerequisites', async () => {
      const skill = createMockSkill({ prerequisiteSkillIds: [] });
      const result = await unlockService.checkPrerequisites(skill, []);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.allMet).toBe(true);
      expect(result.value.unmetPrerequisites).toHaveLength(0);
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
        prerequisiteSkillIds: ['prereq_1' as SkillId, 'prereq_2' as SkillId],
      });

      const result = await unlockService.checkPrerequisites(skill, [prereq1, prereq2]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.allMet).toBe(true);
      expect(result.value.metPrerequisites).toContain('prereq_1');
      expect(result.value.metPrerequisites).toContain('prereq_2');
    });

    it('should return allMet=false when prerequisites not mastered', async () => {
      const prereq = createMockSkill({
        id: 'prereq_1' as SkillId,
        title: 'Foundation Skill',
        mastery: 'practicing',
      });
      const skill = createMockSkill({
        prerequisiteSkillIds: ['prereq_1' as SkillId],
      });

      const result = await unlockService.checkPrerequisites(skill, [prereq]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.allMet).toBe(false);
      expect(result.value.unmetPrerequisites).toContain('prereq_1');
      expect(result.value.reasons[0]).toContain('Foundation Skill');
      expect(result.value.reasons[0]).toContain('practicing');
    });

    it('should check store for prerequisites not in allSkills', async () => {
      const prereqInStore = createMockSkill({
        id: 'prereq_store' as SkillId,
        questId: 'quest_week0' as QuestId,
        mastery: 'mastered',
      });
      await store.save(prereqInStore);

      const skill = createMockSkill({
        prerequisiteSkillIds: ['prereq_store' as SkillId],
      });

      const result = await unlockService.checkPrerequisites(skill, []);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.allMet).toBe(true);
      expect(result.value.metPrerequisites).toContain('prereq_store');
    });
  });

  describe('unlockEligibleSkills', () => {
    it('should unlock skills with all prerequisites met', async () => {
      const foundation = createMockSkill({
        id: 'foundation' as SkillId,
        skillType: 'foundation',
        status: 'mastered',
        mastery: 'mastered',
      });
      const building = createMockSkill({
        id: 'building' as SkillId,
        skillType: 'building',
        status: 'locked',
        prerequisiteSkillIds: ['foundation' as SkillId],
      });

      await store.save(foundation);
      await store.save(building);

      const result = await unlockService.unlockEligibleSkills(
        'quest_week1' as QuestId,
        [foundation, building]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.unlockedCount).toBe(1);
      expect(result.value.unlockedSkills[0]?.id).toBe('building');
      expect(result.value.unlockedSkills[0]?.status).toBe('available');
    });

    it('should not unlock skills with unmet prerequisites', async () => {
      const foundation = createMockSkill({
        id: 'foundation' as SkillId,
        skillType: 'foundation',
        status: 'available',
        mastery: 'practicing', // Not yet mastered
      });
      const building = createMockSkill({
        id: 'building' as SkillId,
        skillType: 'building',
        status: 'locked',
        prerequisiteSkillIds: ['foundation' as SkillId],
      });

      await store.save(foundation);
      await store.save(building);

      const result = await unlockService.unlockEligibleSkills(
        'quest_week1' as QuestId,
        [foundation, building]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.unlockedCount).toBe(0);
      expect(result.value.stillLockedSkills).toHaveLength(1);
    });

    it('should cascade unlocks', async () => {
      const skill1 = createMockSkill({
        id: 'skill_1' as SkillId,
        status: 'mastered',
        mastery: 'mastered',
      });
      const skill2 = createMockSkill({
        id: 'skill_2' as SkillId,
        status: 'locked',
        prerequisiteSkillIds: ['skill_1' as SkillId],
      });
      const skill3 = createMockSkill({
        id: 'skill_3' as SkillId,
        status: 'locked',
        prerequisiteSkillIds: ['skill_1' as SkillId],
      });

      await store.save(skill1);
      await store.save(skill2);
      await store.save(skill3);

      const result = await unlockService.unlockEligibleSkills(
        'quest_week1' as QuestId,
        [skill1, skill2, skill3]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.unlockedCount).toBe(2);
    });
  });

  describe('checkMilestoneAvailability', () => {
    it('should return available when mastery threshold met', async () => {
      const skills = [
        createMockSkill({ id: 's1' as SkillId, mastery: 'mastered' }),
        createMockSkill({ id: 's2' as SkillId, mastery: 'mastered' }),
        createMockSkill({ id: 's3' as SkillId, mastery: 'mastered' }),
        createMockSkill({ id: 's4' as SkillId, mastery: 'practicing' }),
        createMockSkill({ id: 's5' as SkillId, skillType: 'synthesis' }), // Excluded
      ];

      const result = await unlockService.checkMilestoneAvailability(
        'quest_week1' as QuestId,
        skills,
        0.75
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.available).toBe(true);
      expect(result.value.masteryPercent).toBe(0.75); // 3/4 non-synthesis
    });

    it('should return unavailable when below threshold', async () => {
      const skills = [
        createMockSkill({ id: 's1' as SkillId, mastery: 'mastered' }),
        createMockSkill({ id: 's2' as SkillId, mastery: 'practicing' }),
        createMockSkill({ id: 's3' as SkillId, mastery: 'not_started' }),
        createMockSkill({ id: 's4' as SkillId, mastery: 'not_started' }),
      ];

      const result = await unlockService.checkMilestoneAvailability(
        'quest_week1' as QuestId,
        skills,
        0.75
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.available).toBe(false);
      expect(result.value.reason).toContain('more skill');
    });
  });

  describe('getLockedSkillsWithReasons', () => {
    it('should return locked skills with reasons', async () => {
      const prereq = createMockSkill({
        id: 'prereq' as SkillId,
        title: 'Prerequisite',
        mastery: 'practicing',
      });
      const locked = createMockSkill({
        id: 'locked' as SkillId,
        status: 'locked',
        prerequisiteSkillIds: ['prereq' as SkillId],
      });

      const result = await unlockService.getLockedSkillsWithReasons(
        'quest_week1' as QuestId,
        [prereq, locked]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.skill.id).toBe('locked');
      expect(result.value[0]?.missingPrerequisites).toContain('prereq');
      expect(result.value[0]?.reasons[0]).toContain('Prerequisite');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MASTERY SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('MasteryService', () => {
  let store: InMemorySkillStore;
  let unlockService: UnlockService;
  let masteryService: MasteryService;

  beforeEach(() => {
    store = createInMemorySkillStore();
    unlockService = createUnlockService(store);
    masteryService = createMasteryService(store, unlockService);
  });

  describe('recordOutcome', () => {
    it('should increment pass count on pass', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        passCount: 0,
        consecutivePasses: 0,
      });
      await store.save(skill);

      const result = await masteryService.recordOutcome(
        'skill_1' as SkillId,
        true,
        [skill]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.skill.passCount).toBe(1);
      expect(result.value.skill.consecutivePasses).toBe(1);
    });

    it('should increment fail count and reset consecutive on fail', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        passCount: 1,
        consecutivePasses: 1,
        failCount: 0,
      });
      await store.save(skill);

      const result = await masteryService.recordOutcome(
        'skill_1' as SkillId,
        false,
        [skill]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.skill.failCount).toBe(1);
      expect(result.value.skill.consecutivePasses).toBe(0);
    });

    it('should progress to practicing after first pass', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        mastery: 'not_started',
        passCount: 0,
        consecutivePasses: 0,
      });
      await store.save(skill);

      const result = await masteryService.recordOutcome(
        'skill_1' as SkillId,
        true,
        [skill]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.previousMastery).toBe('not_started');
      expect(result.value.newMastery).toBe('practicing');
      expect(result.value.masteryChanged).toBe(true);
    });

    it('should progress to mastered after threshold passes', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        mastery: 'practicing',
        passCount: MASTERY_THRESHOLDS.MASTERED - 1,
        consecutivePasses: MASTERY_THRESHOLDS.CONSECUTIVE_FOR_MASTERY - 1,
      });
      await store.save(skill);

      const result = await masteryService.recordOutcome(
        'skill_1' as SkillId,
        true,
        [skill]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.newMastery).toBe('mastered');
      expect(result.value.skill.status).toBe('mastered');
      expect(result.value.skill.masteredAt).toBeDefined();
    });

    it('should not progress if consecutive passes reset', async () => {
      const skill = createMockSkill({
        id: 'skill_1' as SkillId,
        mastery: 'practicing',
        passCount: MASTERY_THRESHOLDS.MASTERED,
        consecutivePasses: 0, // Reset due to failure
      });
      await store.save(skill);

      const result = await masteryService.recordOutcome(
        'skill_1' as SkillId,
        true,
        [skill]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Still need consecutive passes
      expect(result.value.newMastery).toBe('practicing');
    });

    it('should trigger unlock cascade on mastery', async () => {
      const foundation = createMockSkill({
        id: 'foundation' as SkillId,
        skillType: 'foundation',
        mastery: 'practicing',
        passCount: MASTERY_THRESHOLDS.MASTERED - 1,
        consecutivePasses: MASTERY_THRESHOLDS.CONSECUTIVE_FOR_MASTERY - 1,
      });
      const building = createMockSkill({
        id: 'building' as SkillId,
        skillType: 'building',
        status: 'locked',
        prerequisiteSkillIds: ['foundation' as SkillId],
      });

      await store.save(foundation);
      await store.save(building);

      const result = await masteryService.recordOutcome(
        'foundation' as SkillId,
        true,
        [foundation, building]
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.newMastery).toBe('mastered');
      expect(result.value.unlockedSkills).toHaveLength(1);
      expect(result.value.unlockedSkills[0]?.id).toBe('building');
    });

    it('should return error for non-existent skill', async () => {
      const result = await masteryService.recordOutcome(
        'nonexistent' as SkillId,
        true,
        []
      );

      expect(result.ok).toBe(false);
    });
  });

  describe('getMasterySummary', () => {
    it('should calculate correct summary', () => {
      const skills = [
        createMockSkill({ mastery: 'not_started' }),
        createMockSkill({ mastery: 'not_started' }),
        createMockSkill({ mastery: 'practicing' }),
        createMockSkill({ mastery: 'practicing' }),
        createMockSkill({ mastery: 'mastered' }),
      ];

      const summary = masteryService.getMasterySummary(skills);

      expect(summary.total).toBe(5);
      expect(summary.byMastery.not_started).toBe(2);
      expect(summary.byMastery.practicing).toBe(2);
      expect(summary.byMastery.mastered).toBe(1);
      expect(summary.masteredPercent).toBe(0.2);
      expect(summary.inProgressPercent).toBe(0.6); // practicing + mastered
    });

    it('should handle empty skills', () => {
      const summary = masteryService.getMasterySummary([]);

      expect(summary.total).toBe(0);
      expect(summary.masteredPercent).toBe(0);
    });
  });

  describe('getQuestMasteryPercent', () => {
    it('should calculate percentage excluding synthesis', async () => {
      const skills = [
        createMockSkill({ mastery: 'mastered', skillType: 'foundation' }),
        createMockSkill({ mastery: 'mastered', skillType: 'building' }),
        createMockSkill({ mastery: 'practicing', skillType: 'compound' }),
        createMockSkill({ mastery: 'not_started', skillType: 'synthesis' }), // Excluded
      ];

      const result = await masteryService.getQuestMasteryPercent(
        'quest_week1' as QuestId,
        skills
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // 2/3 non-synthesis mastered
      expect(result.value).toBeCloseTo(0.667, 2);
    });

    it('should return 0 for empty quest', async () => {
      const result = await masteryService.getQuestMasteryPercent(
        'quest_empty' as QuestId,
        []
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORE TESTS
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
    if (!result.ok) return;

    expect(result.value?.id).toBe('skill_1');
  });

  it('should get skills by quest', async () => {
    const skill1 = createMockSkill({ id: 's1' as SkillId, questId: 'q1' as QuestId });
    const skill2 = createMockSkill({ id: 's2' as SkillId, questId: 'q1' as QuestId });
    const skill3 = createMockSkill({ id: 's3' as SkillId, questId: 'q2' as QuestId });

    await store.save(skill1);
    await store.save(skill2);
    await store.save(skill3);

    const result = await store.getByQuest('q1' as QuestId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
  });

  it('should get skills by status', async () => {
    const skill1 = createMockSkill({ id: 's1' as SkillId, status: 'available' });
    const skill2 = createMockSkill({ id: 's2' as SkillId, status: 'locked' });
    const skill3 = createMockSkill({ id: 's3' as SkillId, status: 'available' });

    await store.save(skill1);
    await store.save(skill2);
    await store.save(skill3);

    const result = await store.getByStatus('quest_week1' as QuestId, 'available');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
  });

  it('should update skill', async () => {
    const skill = createMockSkill({ id: 'skill_1' as SkillId, mastery: 'not_started' });
    await store.save(skill);

    const updated = { ...skill, mastery: 'mastered' as SkillMastery };
    await store.update(updated);

    const result = await store.get('skill_1' as SkillId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value?.mastery).toBe('mastered');
  });

  it('should update status', async () => {
    const skill = createMockSkill({ id: 'skill_1' as SkillId, status: 'locked' });
    await store.save(skill);

    await store.updateStatus('skill_1' as SkillId, 'available');

    const result = await store.get('skill_1' as SkillId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value?.status).toBe('available');
  });

  it('should delete skill', async () => {
    const skill = createMockSkill({ id: 'skill_1' as SkillId });
    await store.save(skill);
    await store.delete('skill_1' as SkillId);

    const result = await store.get('skill_1' as SkillId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Progression Services Integration', () => {
  it('should handle full mastery flow', async () => {
    const store = createInMemorySkillStore();
    const { unlockService, masteryService } = createProgressionServices(store);

    // Create skill tree
    const foundation = createMockSkill({
      id: 'foundation' as SkillId,
      title: 'Foundation',
      skillType: 'foundation',
      status: 'available',
      mastery: 'not_started',
    });
    const building = createMockSkill({
      id: 'building' as SkillId,
      title: 'Building',
      skillType: 'building',
      status: 'locked',
      prerequisiteSkillIds: ['foundation' as SkillId],
    });
    const compound = createMockSkill({
      id: 'compound' as SkillId,
      title: 'Compound',
      skillType: 'compound',
      status: 'locked',
      isCompound: true,
      prerequisiteSkillIds: ['foundation' as SkillId, 'building' as SkillId],
    });

    await store.save(foundation);
    await store.save(building);
    await store.save(compound);

    // Pass foundation multiple times to master it
    let allSkills = store.getAll();

    // Pass 1
    let result = await masteryService.recordOutcome('foundation' as SkillId, true, allSkills);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newMastery).toBe('practicing');
    }

    // Pass 2
    allSkills = store.getAll();
    result = await masteryService.recordOutcome('foundation' as SkillId, true, allSkills);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newMastery).toBe('practicing');
    }

    // Pass 3 - should achieve mastery and unlock building
    allSkills = store.getAll();
    result = await masteryService.recordOutcome('foundation' as SkillId, true, allSkills);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newMastery).toBe('mastered');
      expect(result.value.unlockedSkills).toHaveLength(1);
      expect(result.value.unlockedSkills[0]?.id).toBe('building');
    }

    // Compound should still be locked
    const compoundResult = await store.get('compound' as SkillId);
    expect(compoundResult.ok).toBe(true);
    if (compoundResult.ok) {
      expect(compoundResult.value?.status).toBe('locked');
    }

    // Master building
    allSkills = store.getAll();
    for (let i = 0; i < MASTERY_THRESHOLDS.MASTERED; i++) {
      result = await masteryService.recordOutcome('building' as SkillId, true, allSkills);
      allSkills = store.getAll();
    }

    expect(result!.ok).toBe(true);
    if (result!.ok) {
      expect(result!.value.newMastery).toBe('mastered');
      // Compound should now be unlocked
      expect(result!.value.unlockedSkills).toHaveLength(1);
      expect(result!.value.unlockedSkills[0]?.id).toBe('compound');
    }

    // Verify final state
    const finalSkills = store.getAll();
    const summary = masteryService.getMasterySummary(finalSkills);

    expect(summary.byMastery.mastered).toBe(2);
    expect(summary.byMastery.not_started).toBe(1); // Compound not practiced yet
  });
});
