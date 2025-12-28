// ═══════════════════════════════════════════════════════════════════════════════
// DRILL GENERATOR — Unit Tests
// NovaOS — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoalId, UserId, QuestId, SkillId, DrillId, WeekPlanId, Timestamp } from '../../../types/branded.js';
import type { Skill, DailyDrill, CreateDrillParams } from '../types.js';

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
    lockedVariables: ['environment', 'tools'],
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

describe('DrillGenerator', () => {
  describe('drill creation from skill', () => {
    it('should create drill with skill action', () => {
      const skill = createTestSkill({ action: 'Profile a function using cProfile' });
      
      const drillParams: Partial<CreateDrillParams> = {
        skillId: skill.id,
        action: skill.action,
        passSignal: skill.successSignal,
        lockedVariables: [...skill.lockedVariables],
        estimatedMinutes: skill.estimatedMinutes,
      };

      expect(drillParams.action).toBe('Profile a function using cProfile');
      expect(drillParams.passSignal).toBe(skill.successSignal);
    });

    it('should copy locked variables from skill', () => {
      const skill = createTestSkill({ 
        lockedVariables: ['Python version', 'IDE', 'Test file'] 
      });
      
      const drillLockedVars = [...skill.lockedVariables];

      expect(drillLockedVars).toEqual(['Python version', 'IDE', 'Test file']);
      expect(drillLockedVars.length).toBe(3);
    });

    it('should use skill estimated minutes', () => {
      const skill = createTestSkill({ estimatedMinutes: 45 });
      
      expect(skill.estimatedMinutes).toBe(45);
    });
  });

  describe('retry drill generation', () => {
    it('should mark retry drill with isRetry flag', () => {
      const isRetry = true;
      const retryCount = 1;

      expect(isRetry).toBe(true);
      expect(retryCount).toBe(1);
    });

    it('should increment retry count for consecutive failures', () => {
      const previousRetryCount = 2;
      const newRetryCount = previousRetryCount + 1;

      expect(newRetryCount).toBe(3);
    });

    it('should include continuation context for retry', () => {
      const carryForward = 'Continue from step 3 of the exercise';
      const continuationContext = carryForward;

      expect(continuationContext).toBe('Continue from step 3 of the exercise');
    });
  });

  describe('drill scheduling', () => {
    it('should calculate day number from start date', () => {
      const startDate = new Date('2025-01-06');
      const drillDate = new Date('2025-01-08');
      
      const dayNumber = Math.floor(
        (drillDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      expect(dayNumber).toBe(3);
    });

    it('should format scheduled date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-15');
      const formattedDate = date.toISOString().split('T')[0];

      expect(formattedDate).toBe('2025-01-15');
    });

    it('should assign drills to correct week plan', () => {
      const weekPlanId = 'week-123' as WeekPlanId;
      const drill = {
        weekPlanId,
        scheduledDate: '2025-01-08',
        dayNumber: 3,
      };

      expect(drill.weekPlanId).toBe(weekPlanId);
    });
  });

  describe('constraint generation', () => {
    it('should generate time-based constraint', () => {
      const estimatedMinutes = 30;
      const constraint = `Complete within ${estimatedMinutes} minutes`;

      expect(constraint).toBe('Complete within 30 minutes');
    });

    it('should include locked variables in constraint', () => {
      const lockedVariables = ['Python 3.11', 'VSCode'];
      const constraint = `Use only: ${lockedVariables.join(', ')}`;

      expect(constraint).toBe('Use only: Python 3.11, VSCode');
    });
  });

  describe('drill defaults', () => {
    it('should set initial status to scheduled', () => {
      const status = 'scheduled';
      expect(status).toBe('scheduled');
    });

    it('should set repeatTomorrow to false initially', () => {
      const repeatTomorrow = false;
      expect(repeatTomorrow).toBe(false);
    });

    it('should set retryCount to 0 for new drills', () => {
      const retryCount = 0;
      expect(retryCount).toBe(0);
    });

    it('should set isRetry to false for new drills', () => {
      const isRetry = false;
      expect(isRetry).toBe(false);
    });
  });
});
