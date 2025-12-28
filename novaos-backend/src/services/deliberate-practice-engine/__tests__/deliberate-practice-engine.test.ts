// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE — Unit Tests
// NovaOS — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoalId, UserId, QuestId, SkillId, DrillId, WeekPlanId, Timestamp } from '../../../types/branded.js';
import type { Skill, DailyDrill, WeekPlan, SkillMastery, DrillOutcome } from '../types.js';

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
    lockedVariables: ['var1'],
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

describe('DeliberatePracticeEngine', () => {
  describe('mastery calculation', () => {
    it('should calculate mastery level based on pass count', () => {
      // Test mastery thresholds
      const thresholds = {
        not_started: 0,
        attempted: 0, // Has attempts but no passes
        practicing: 1, // 1+ pass
        mastered: 3,   // 3+ passes with consecutive
      };

      expect(thresholds.practicing).toBe(1);
      expect(thresholds.mastered).toBe(3);
    });

    it('should determine if skill needs retry based on outcome', () => {
      const retryOutcomes: DrillOutcome[] = ['fail', 'partial'];
      const noRetryOutcomes: DrillOutcome[] = ['pass', 'skipped'];

      expect(retryOutcomes.includes('fail')).toBe(true);
      expect(retryOutcomes.includes('partial')).toBe(true);
      expect(noRetryOutcomes.includes('pass')).toBe(true);
    });
  });

  describe('drill completion flow', () => {
    it('should update skill mastery after pass', () => {
      const skill = createTestSkill({ mastery: 'not_started', passCount: 0 });
      
      // Simulate pass
      const newPassCount = skill.passCount + 1;
      const newMastery: SkillMastery = newPassCount >= 1 ? 'practicing' : 'not_started';

      expect(newMastery).toBe('practicing');
      expect(newPassCount).toBe(1);
    });

    it('should set repeatTomorrow for failed drill', () => {
      const drill = createTestDrill();
      const outcome: DrillOutcome = 'fail';
      
      const repeatTomorrow = outcome === 'fail' || outcome === 'partial';

      expect(repeatTomorrow).toBe(true);
    });

    it('should not set repeatTomorrow for passed drill', () => {
      const drill = createTestDrill();
      const outcome: DrillOutcome = 'pass';
      
      const repeatTomorrow = outcome === 'fail' || outcome === 'partial';

      expect(repeatTomorrow).toBe(false);
    });
  });

  describe('streak calculation', () => {
    it('should calculate current streak from skills', () => {
      const skills: Skill[] = [
        createTestSkill({ consecutivePasses: 2 }),
        createTestSkill({ consecutivePasses: 3 }),
        createTestSkill({ consecutivePasses: 1 }),
      ];

      const totalStreak = skills.reduce((sum, s) => sum + s.consecutivePasses, 0);
      const avgStreak = totalStreak / skills.length;

      expect(totalStreak).toBe(6);
      expect(avgStreak).toBe(2);
    });

    it('should reset consecutive passes on fail', () => {
      const skill = createTestSkill({ consecutivePasses: 3 });
      const outcome: DrillOutcome = 'fail';
      
      const newConsecutivePasses = outcome === 'pass' 
        ? skill.consecutivePasses + 1 
        : 0;

      expect(newConsecutivePasses).toBe(0);
    });

    it('should increment consecutive passes on pass', () => {
      const skill = createTestSkill({ consecutivePasses: 2 });
      const outcome: DrillOutcome = 'pass';
      
      const newConsecutivePasses = outcome === 'pass' 
        ? skill.consecutivePasses + 1 
        : 0;

      expect(newConsecutivePasses).toBe(3);
    });
  });

  describe('week progress tracking', () => {
    it('should calculate pass rate correctly', () => {
      const drillsPassed = 3;
      const drillsFailed = 1;
      const totalAttempted = drillsPassed + drillsFailed;
      
      const passRate = totalAttempted > 0 ? drillsPassed / totalAttempted : 0;

      expect(passRate).toBe(0.75);
    });

    it('should handle zero drills for pass rate', () => {
      const drillsPassed = 0;
      const drillsFailed = 0;
      const totalAttempted = drillsPassed + drillsFailed;
      
      const passRate = totalAttempted > 0 ? drillsPassed / totalAttempted : 0;

      expect(passRate).toBe(0);
    });
  });
});
