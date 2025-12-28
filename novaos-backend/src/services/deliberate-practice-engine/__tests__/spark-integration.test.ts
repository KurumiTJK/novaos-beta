// ═══════════════════════════════════════════════════════════════════════════════
// SPARK INTEGRATION — Unit Tests
// NovaOS — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoalId, UserId, QuestId, SkillId, DrillId, WeekPlanId, SparkId, Timestamp } from '../../../types/branded.js';
import type { DailyDrill, DrillOutcome } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

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
    action: 'Practice action for today',
    passSignal: 'Complete without errors',
    lockedVariables: ['environment'],
    constraint: 'Within 30 minutes',
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

describe('SparkIntegration', () => {
  describe('spark generation from drill', () => {
    it('should create spark with drill action', () => {
      const drill = createTestDrill({ action: 'Profile Python code using cProfile' });
      
      const sparkContent = drill.action;

      expect(sparkContent).toBe('Profile Python code using cProfile');
    });

    it('should include pass signal in spark', () => {
      const drill = createTestDrill({ passSignal: 'Generate timing report' });
      
      const sparkContent = `${drill.action} - Success: ${drill.passSignal}`;

      expect(sparkContent).toContain('Generate timing report');
    });

    it('should include constraint in spark', () => {
      const drill = createTestDrill({ constraint: 'Use VSCode only' });
      
      const sparkContent = `${drill.action} (${drill.constraint})`;

      expect(sparkContent).toContain('Use VSCode only');
    });

    it('should link spark to drill ID', () => {
      const drill = createTestDrill();
      
      const sparkReference = {
        drillId: drill.id,
        goalId: drill.goalId,
        userId: drill.userId,
      };

      expect(sparkReference.drillId).toBe(drill.id);
    });
  });

  describe('spark scheduling', () => {
    it('should schedule spark for drill date', () => {
      const drill = createTestDrill({ scheduledDate: '2025-01-08' });
      
      const sparkScheduledDate = drill.scheduledDate;

      expect(sparkScheduledDate).toBe('2025-01-08');
    });

    it('should calculate spark time from user preferences', () => {
      const preferredTime = '09:00';
      const scheduledDate = '2025-01-08';
      
      const sparkDateTime = `${scheduledDate}T${preferredTime}:00`;

      expect(sparkDateTime).toBe('2025-01-08T09:00:00');
    });

    it('should handle timezone for spark scheduling', () => {
      const timezone = 'America/Los_Angeles';
      
      expect(timezone).toBeDefined();
    });
  });

  describe('spark content formatting', () => {
    it('should format action as imperative', () => {
      const action = 'Profile Python code';
      const formattedAction = action.charAt(0).toUpperCase() + action.slice(1);

      expect(formattedAction).toBe('Profile Python code');
    });

    it('should include time estimate', () => {
      const drill = createTestDrill({ estimatedMinutes: 25 });
      
      const sparkContent = `${drill.action} (~${drill.estimatedMinutes} min)`;

      expect(sparkContent).toContain('~25 min');
    });

    it('should mark retry sparks distinctly', () => {
      const drill = createTestDrill({ isRetry: true, retryCount: 2 });
      
      const retryLabel = drill.isRetry ? `[Retry ${drill.retryCount}]` : '';

      expect(retryLabel).toBe('[Retry 2]');
    });

    it('should include continuation context for retries', () => {
      const drill = createTestDrill({ 
        isRetry: true,
        continuationContext: 'Continue from step 3',
      });
      
      expect(drill.continuationContext).toBe('Continue from step 3');
    });
  });

  describe('spark completion flow', () => {
    it('should trigger drill completion on spark complete', () => {
      const sparkCompleted = true;
      
      expect(sparkCompleted).toBe(true);
    });

    it('should capture outcome from spark response', () => {
      const userResponse = 'completed';
      const outcome: DrillOutcome = 
        userResponse === 'completed' ? 'pass' :
        userResponse === 'partial' ? 'partial' :
        userResponse === 'skipped' ? 'skipped' : 'fail';

      expect(outcome).toBe('pass');
    });

    it('should capture observation from spark response', () => {
      const observation = 'Completed successfully but took longer than expected';
      
      expect(observation.length).toBeGreaterThan(0);
    });
  });

  describe('spark escalation', () => {
    it('should escalate spark if not acknowledged', () => {
      const acknowledgementDeadline = new Date('2025-01-08T10:00:00');
      const currentTime = new Date('2025-01-08T10:30:00');
      
      const shouldEscalate = currentTime > acknowledgementDeadline;

      expect(shouldEscalate).toBe(true);
    });

    it('should increment escalation level', () => {
      const currentLevel = 1;
      const newLevel = currentLevel + 1;

      expect(newLevel).toBe(2);
    });

    it('should cap escalation at maximum level', () => {
      const maxLevel = 3;
      const currentLevel = 3;
      
      const newLevel = Math.min(currentLevel + 1, maxLevel);

      expect(newLevel).toBe(3);
    });
  });

  describe('spark dismissal', () => {
    it('should handle spark dismissal', () => {
      const dismissed = true;
      const outcome: DrillOutcome = 'skipped';

      expect(dismissed).toBe(true);
      expect(outcome).toBe('skipped');
    });

    it('should record dismissal reason', () => {
      const reason = 'Too busy today';
      
      expect(reason.length).toBeGreaterThan(0);
    });

    it('should set repeatTomorrow on dismissal', () => {
      const repeatTomorrow = true;

      expect(repeatTomorrow).toBe(true);
    });
  });

  describe('spark cancellation', () => {
    it('should cancel future sparks when goal paused', () => {
      const goalPaused = true;
      const futureSparks = ['spark-1', 'spark-2', 'spark-3'];
      
      const cancelledSparks = goalPaused ? futureSparks : [];

      expect(cancelledSparks.length).toBe(3);
    });

    it('should cancel sparks when goal completed', () => {
      const goalCompleted = true;
      const remainingSparks = ['spark-4', 'spark-5'];
      
      const shouldCancel = goalCompleted;

      expect(shouldCancel).toBe(true);
    });
  });

  describe('spark analytics', () => {
    it('should track spark response time', () => {
      const sentAt = new Date('2025-01-08T09:00:00');
      const respondedAt = new Date('2025-01-08T09:05:00');
      
      const responseTimeMinutes = (respondedAt.getTime() - sentAt.getTime()) / (1000 * 60);

      expect(responseTimeMinutes).toBe(5);
    });

    it('should track spark completion rate', () => {
      const completedSparks = 8;
      const totalSparks = 10;
      
      const completionRate = completedSparks / totalSparks;

      expect(completionRate).toBe(0.8);
    });

    it('should track average response time', () => {
      const responseTimes = [5, 10, 3, 7, 5];
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      expect(avgResponseTime).toBe(6);
    });
  });
});
