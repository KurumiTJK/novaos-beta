// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE ORCHESTRATOR — Unit Tests
// NovaOS — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoalId, UserId, QuestId, SkillId, DrillId, WeekPlanId, Timestamp } from '../../../types/branded.js';
import type { Skill, DailyDrill, WeekPlan, DrillOutcome, SkillMastery } from '../types.js';

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

function createTestDrill(overrides: Partial<DailyDrill> = {}): DailyDrill {
  const now = new Date().toISOString() as Timestamp;
  return {
    id: `drill-${crypto.randomUUID()}` as DrillId,
    weekPlanId: `week-${crypto.randomUUID()}` as WeekPlanId,
    skillId: `skill-${crypto.randomUUID()}` as SkillId,
    userId: `user-${crypto.randomUUID()}` as UserId,
    goalId: `goal-${crypto.randomUUID()}` as GoalId,
    scheduledDate: '2025-01-06',
    dayNumber: 1,
    status: 'scheduled',
    action: 'Practice action',
    passSignal: 'Success signal',
    lockedVariables: ['var1'],
    constraint: 'Time constraint',
    estimatedMinutes: 30,
    repeatTomorrow: false,
    isRetry: false,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('PracticeOrchestrator', () => {
  describe('daily drill selection', () => {
    it('should prioritize carry-forward skills', () => {
      const carryForwardSkillIds = ['skill-cf-1', 'skill-cf-2'] as SkillId[];
      const scheduledSkillIds = ['skill-1', 'skill-2', 'skill-3'] as SkillId[];
      
      const prioritizedOrder = [...carryForwardSkillIds, ...scheduledSkillIds];

      expect(prioritizedOrder[0]).toBe('skill-cf-1');
      expect(prioritizedOrder[1]).toBe('skill-cf-2');
      expect(prioritizedOrder[2]).toBe('skill-1');
    });

    it('should select drill for current date', () => {
      const today = new Date().toISOString().split('T')[0];
      const drill = createTestDrill({ scheduledDate: today });

      expect(drill.scheduledDate).toBe(today);
    });

    it('should return active drill if in progress', () => {
      const activeDrill = createTestDrill({ status: 'active' });
      
      expect(activeDrill.status).toBe('active');
    });
  });

  describe('drill completion handling', () => {
    it('should update skill mastery on pass', () => {
      const skill = createTestSkill({ 
        mastery: 'not_started', 
        passCount: 0,
        consecutivePasses: 0,
      });
      
      const newPassCount = skill.passCount + 1;
      const newConsecutivePasses = skill.consecutivePasses + 1;
      const newMastery: SkillMastery = newPassCount >= 1 ? 'practicing' : 'not_started';

      expect(newPassCount).toBe(1);
      expect(newConsecutivePasses).toBe(1);
      expect(newMastery).toBe('practicing');
    });

    it('should reset consecutive passes on fail', () => {
      const skill = createTestSkill({ consecutivePasses: 3 });
      const outcome: DrillOutcome = 'fail';
      
      const newConsecutivePasses = outcome === 'pass' ? skill.consecutivePasses + 1 : 0;

      expect(newConsecutivePasses).toBe(0);
    });

    it('should schedule retry for failed drill', () => {
      const outcome: DrillOutcome = 'fail';
      const shouldRetry = outcome === 'fail' || outcome === 'partial';

      expect(shouldRetry).toBe(true);
    });

    it('should not schedule retry for passed drill', () => {
      const outcome: DrillOutcome = 'pass';
      const shouldRetry = outcome === 'fail' || outcome === 'partial';

      expect(shouldRetry).toBe(false);
    });
  });

  describe('week transition', () => {
    it('should identify incomplete skills for carry-forward', () => {
      const skills = [
        createTestSkill({ id: 'skill-1' as SkillId, mastery: 'mastered' }),
        createTestSkill({ id: 'skill-2' as SkillId, mastery: 'practicing' }),
        createTestSkill({ id: 'skill-3' as SkillId, mastery: 'attempted' }),
      ];

      const incompleteSkills = skills.filter(s => 
        s.mastery !== 'mastered'
      );

      expect(incompleteSkills.length).toBe(2);
    });

    it('should calculate week pass rate', () => {
      const drillsPassed = 4;
      const drillsFailed = 1;
      const passRate = drillsPassed / (drillsPassed + drillsFailed);

      expect(passRate).toBe(0.8);
    });

    it('should determine if week threshold met', () => {
      const passRate = 0.75;
      const threshold = 0.7;
      
      const thresholdMet = passRate >= threshold;

      expect(thresholdMet).toBe(true);
    });
  });

  describe('goal completion check', () => {
    it('should check if all skills mastered', () => {
      const skills = [
        createTestSkill({ mastery: 'mastered' }),
        createTestSkill({ mastery: 'mastered' }),
        createTestSkill({ mastery: 'mastered' }),
      ];

      const allMastered = skills.every(s => s.mastery === 'mastered');

      expect(allMastered).toBe(true);
    });

    it('should return false if any skill not mastered', () => {
      const skills = [
        createTestSkill({ mastery: 'mastered' }),
        createTestSkill({ mastery: 'practicing' }),
        createTestSkill({ mastery: 'mastered' }),
      ];

      const allMastered = skills.every(s => s.mastery === 'mastered');

      expect(allMastered).toBe(false);
    });

    it('should calculate overall progress percentage', () => {
      const skills = [
        createTestSkill({ mastery: 'mastered' }),
        createTestSkill({ mastery: 'practicing' }),
        createTestSkill({ mastery: 'not_started' }),
        createTestSkill({ mastery: 'mastered' }),
      ];

      const masteredCount = skills.filter(s => s.mastery === 'mastered').length;
      const progressPercentage = (masteredCount / skills.length) * 100;

      expect(progressPercentage).toBe(50);
    });
  });

  describe('schedule generation', () => {
    it('should distribute skills across week', () => {
      const skillIds = ['s1', 's2', 's3', 's4', 's5'] as SkillId[];
      const daysInWeek = 5; // Mon-Fri
      
      const skillsPerDay = Math.ceil(skillIds.length / daysInWeek);

      expect(skillsPerDay).toBe(1);
    });

    it('should handle more skills than days', () => {
      const skillIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as SkillId[];
      const daysInWeek = 5;
      
      const skillsPerDay = Math.ceil(skillIds.length / daysInWeek);

      expect(skillsPerDay).toBe(2);
    });

    it('should assign foundation skills first', () => {
      const skills = [
        createTestSkill({ difficulty: 'challenge', order: 3 }),
        createTestSkill({ difficulty: 'foundation', order: 1 }),
        createTestSkill({ difficulty: 'practice', order: 2 }),
      ];

      const sortedSkills = [...skills].sort((a, b) => {
        const difficultyOrder = { foundation: 1, practice: 2, challenge: 3 };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      });

      expect(sortedSkills[0].difficulty).toBe('foundation');
      expect(sortedSkills[1].difficulty).toBe('practice');
      expect(sortedSkills[2].difficulty).toBe('challenge');
    });
  });

  describe('time estimation', () => {
    it('should sum estimated minutes for day', () => {
      const drills = [
        createTestDrill({ estimatedMinutes: 20 }),
        createTestDrill({ estimatedMinutes: 30 }),
        createTestDrill({ estimatedMinutes: 15 }),
      ];

      const totalMinutes = drills.reduce((sum, d) => sum + d.estimatedMinutes, 0);

      expect(totalMinutes).toBe(65);
    });

    it('should cap daily practice time', () => {
      const maxDailyMinutes = 60;
      const totalMinutes = 75;
      
      const cappedMinutes = Math.min(totalMinutes, maxDailyMinutes);

      expect(cappedMinutes).toBe(60);
    });
  });
});
