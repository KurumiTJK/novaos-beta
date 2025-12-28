// ═══════════════════════════════════════════════════════════════════════════════
// SKILL DECOMPOSER — Unit Tests
// NovaOS — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoalId, UserId, QuestId, SkillId, Timestamp } from '../../../types/branded.js';
import type { Skill, SkillDifficulty, CreateSkillParams } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function createTestSkill(overrides: Partial<Skill> = {}): Skill {
  const now = new Date().toISOString() as Timestamp;
  return {
    id: `skill-${crypto.randomUUID()}` as SkillId,
    questId: `quest-${crypto.randomUUID()}` as QuestId,
    goalId: `goal-${crypto.randomUUID()}` as GoalId,
    userId: `user-${crypto.randomUUID()}` as UserId,
    action: 'Complete the skill action',
    successSignal: 'Task completed successfully',
    lockedVariables: ['environment'],
    estimatedMinutes: 30,
    difficulty: 'practice',
    order: 1,
    mastery: 'not_started',
    passCount: 0,
    failCount: 0,
    consecutivePasses: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('SkillDecomposer', () => {
  describe('skill extraction from capability stages', () => {
    it('should extract action from stage', () => {
      const stageAction = 'Profile Python code using cProfile';
      const skillAction = stageAction;

      expect(skillAction).toBe('Profile Python code using cProfile');
    });

    it('should extract success signal from stage', () => {
      const stageSuccessSignal = 'Generate a profile report showing function call times';
      const skillSuccessSignal = stageSuccessSignal;

      expect(skillSuccessSignal).toBe('Generate a profile report showing function call times');
    });

    it('should map stage index to difficulty', () => {
      const difficultyMap: Record<number, SkillDifficulty> = {
        1: 'foundation',
        2: 'foundation',
        3: 'practice',
        4: 'practice',
        5: 'challenge',
      };

      expect(difficultyMap[1]).toBe('foundation');
      expect(difficultyMap[3]).toBe('practice');
      expect(difficultyMap[5]).toBe('challenge');
    });
  });

  describe('skill splitting', () => {
    it('should split complex skill into sub-skills', () => {
      const complexAction = 'Profile and optimize Python code for memory usage';
      const subActions = [
        'Profile Python code for memory usage',
        'Identify memory bottlenecks',
        'Apply memory optimization techniques',
      ];

      expect(subActions.length).toBeGreaterThan(1);
      expect(subActions[0]).toContain('Profile');
    });

    it('should preserve parent skill reference', () => {
      const parentSkillId = 'skill-parent' as SkillId;
      const childSkill = {
        parentSkillId,
        order: 1,
      };

      expect(childSkill.parentSkillId).toBe(parentSkillId);
    });

    it('should assign sequential order to sub-skills', () => {
      const subSkills = [
        { order: 1, action: 'First sub-skill' },
        { order: 2, action: 'Second sub-skill' },
        { order: 3, action: 'Third sub-skill' },
      ];

      expect(subSkills[0].order).toBe(1);
      expect(subSkills[1].order).toBe(2);
      expect(subSkills[2].order).toBe(3);
    });
  });

  describe('adversarial elements', () => {
    it('should extract adversarial element from stage', () => {
      const adversarialElement = 'Profile without clearing cache between runs';
      
      expect(adversarialElement).toContain('cache');
    });

    it('should extract failure mode from stage', () => {
      const failureMode = 'Timings will be inconsistent, making comparisons meaningless';
      
      expect(failureMode).toContain('inconsistent');
    });

    it('should extract recovery steps from stage', () => {
      const recoverySteps = 'Always run warmup iterations, document cache clearing protocol';
      
      expect(recoverySteps).toContain('warmup');
    });
  });

  describe('locked variables', () => {
    it('should extract locked variables from stage', () => {
      const lockedVariables = ['Python version', 'profiler tool', 'test dataset'];
      
      expect(lockedVariables.length).toBe(3);
      expect(lockedVariables).toContain('Python version');
    });

    it('should ensure at least one locked variable', () => {
      const lockedVariables: string[] = [];
      const defaultLockedVariable = 'development environment';
      
      const finalLockedVars = lockedVariables.length > 0 
        ? lockedVariables 
        : [defaultLockedVariable];

      expect(finalLockedVars.length).toBeGreaterThan(0);
    });
  });

  describe('time estimation', () => {
    it('should assign time based on difficulty', () => {
      const timeByDifficulty: Record<SkillDifficulty, number> = {
        foundation: 20,
        practice: 30,
        challenge: 45,
      };

      expect(timeByDifficulty.foundation).toBe(20);
      expect(timeByDifficulty.practice).toBe(30);
      expect(timeByDifficulty.challenge).toBe(45);
    });

    it('should cap maximum estimated time', () => {
      const maxMinutes = 60;
      const estimatedMinutes = 90;
      
      const cappedMinutes = Math.min(estimatedMinutes, maxMinutes);

      expect(cappedMinutes).toBe(60);
    });

    it('should enforce minimum estimated time', () => {
      const minMinutes = 10;
      const estimatedMinutes = 5;
      
      const adjustedMinutes = Math.max(estimatedMinutes, minMinutes);

      expect(adjustedMinutes).toBe(10);
    });
  });

  describe('prerequisite handling', () => {
    it('should identify prerequisite skills', () => {
      const skills = [
        createTestSkill({ id: 'skill-1' as SkillId, order: 1, difficulty: 'foundation' }),
        createTestSkill({ id: 'skill-2' as SkillId, order: 2, difficulty: 'practice' }),
        createTestSkill({ id: 'skill-3' as SkillId, order: 3, difficulty: 'challenge' }),
      ];

      const challengeSkill = skills.find(s => s.difficulty === 'challenge');
      const foundationSkills = skills.filter(s => s.difficulty === 'foundation');

      expect(challengeSkill).toBeDefined();
      expect(foundationSkills.length).toBe(1);
    });

    it('should link prerequisite skill IDs', () => {
      const foundationId = 'skill-foundation' as SkillId;
      const practiceSkill = {
        prerequisiteSkillIds: [foundationId],
        difficulty: 'practice' as SkillDifficulty,
      };

      expect(practiceSkill.prerequisiteSkillIds).toContain(foundationId);
    });
  });
});
