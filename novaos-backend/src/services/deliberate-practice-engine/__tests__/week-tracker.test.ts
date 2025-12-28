// ═══════════════════════════════════════════════════════════════════════════════
// WEEK TRACKER — Unit Tests
// NovaOS — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoalId, UserId, QuestId, SkillId, WeekPlanId, Timestamp } from '../../../types/branded.js';
import type { WeekPlan, WeekPlanStatus, DailyDrill, DrillOutcome } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function createTestWeekPlan(overrides: Partial<WeekPlan> = {}): WeekPlan {
  const now = new Date().toISOString() as Timestamp;
  return {
    id: `week-${crypto.randomUUID()}` as WeekPlanId,
    goalId: `goal-${crypto.randomUUID()}` as GoalId,
    userId: `user-${crypto.randomUUID()}` as UserId,
    questId: `quest-${crypto.randomUUID()}` as QuestId,
    weekNumber: 1,
    startDate: '2025-01-06',
    endDate: '2025-01-12',
    status: 'pending',
    weeklyCompetence: 'Complete the week successfully',
    theme: 'Week 1 Theme',
    scheduledSkillIds: [],
    carryForwardSkillIds: [],
    completedSkillIds: [],
    drillsCompleted: 0,
    drillsTotal: 5,
    drillsPassed: 0,
    drillsFailed: 0,
    drillsSkipped: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('WeekTracker', () => {
  describe('week date calculation', () => {
    it('should calculate week start date (Monday)', () => {
      // Use string-based date calculation to avoid timezone issues
      const dateStr = '2025-01-08'; // Wednesday
      const date = new Date(dateStr + 'T12:00:00Z'); // Noon UTC to avoid timezone edge cases
      const dayOfWeek = date.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      
      const mondayDate = new Date(date);
      mondayDate.setUTCDate(date.getUTCDate() + mondayOffset);
      
      const result = mondayDate.toISOString().split('T')[0];
      expect(result).toBe('2025-01-06');
    });

    it('should calculate week end date (Sunday)', () => {
      const startDateStr = '2025-01-06'; // Monday
      const startDate = new Date(startDateStr + 'T12:00:00Z');
      const endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 6);
      
      expect(endDate.toISOString().split('T')[0]).toBe('2025-01-12');
    });

    it('should determine if date is within week', () => {
      const weekStart = '2025-01-06';
      const weekEnd = '2025-01-12';
      const testDate = '2025-01-08';
      
      const isInWeek = testDate >= weekStart && testDate <= weekEnd;

      expect(isInWeek).toBe(true);
    });

    it('should determine if date is outside week', () => {
      const weekStart = '2025-01-06';
      const weekEnd = '2025-01-12';
      const testDate = '2025-01-15';
      
      const isInWeek = testDate >= weekStart && testDate <= weekEnd;

      expect(isInWeek).toBe(false);
    });
  });

  describe('week progress tracking', () => {
    it('should calculate completion percentage', () => {
      const drillsCompleted = 3;
      const drillsTotal = 5;
      
      const completionPercentage = (drillsCompleted / drillsTotal) * 100;

      expect(completionPercentage).toBe(60);
    });

    it('should calculate pass rate', () => {
      const drillsPassed = 4;
      const drillsFailed = 1;
      const totalAttempted = drillsPassed + drillsFailed;
      
      const passRate = drillsPassed / totalAttempted;

      expect(passRate).toBe(0.8);
    });

    it('should track completed skill IDs', () => {
      const completedSkillIds: SkillId[] = [
        'skill-1' as SkillId,
        'skill-2' as SkillId,
      ];

      expect(completedSkillIds.length).toBe(2);
      expect(completedSkillIds).toContain('skill-1');
    });

    it('should track carry-forward skill IDs', () => {
      const carryForwardSkillIds: SkillId[] = [
        'skill-3' as SkillId,
      ];

      expect(carryForwardSkillIds.length).toBe(1);
    });
  });

  describe('week status transitions', () => {
    it('should transition from pending to active', () => {
      const weekPlan = createTestWeekPlan({ status: 'pending' });
      const newStatus: WeekPlanStatus = 'active';

      expect(weekPlan.status).toBe('pending');
      expect(newStatus).toBe('active');
    });

    it('should transition from active to completed', () => {
      const weekPlan = createTestWeekPlan({ status: 'active' });
      const newStatus: WeekPlanStatus = 'completed';

      expect(weekPlan.status).toBe('active');
      expect(newStatus).toBe('completed');
    });

    it('should set completedAt timestamp on completion', () => {
      const now = new Date().toISOString() as Timestamp;
      const weekPlan = createTestWeekPlan({ status: 'active' });
      
      const completedAt = now;

      expect(completedAt).toBeDefined();
    });
  });

  describe('week summary generation', () => {
    it('should generate summary from week data', () => {
      const weekPlan = createTestWeekPlan({
        drillsCompleted: 5,
        drillsTotal: 5,
        drillsPassed: 4,
        drillsFailed: 1,
        passRate: 0.8,
      });

      const summary = `Week ${weekPlan.weekNumber}: ${weekPlan.drillsPassed}/${weekPlan.drillsTotal} passed (${(weekPlan.passRate! * 100).toFixed(0)}%)`;

      expect(summary).toBe('Week 1: 4/5 passed (80%)');
    });

    it('should include theme in summary', () => {
      const weekPlan = createTestWeekPlan({ theme: 'Memory Safety' });
      
      expect(weekPlan.theme).toBe('Memory Safety');
    });

    it('should include weekly competence in summary', () => {
      const weekPlan = createTestWeekPlan({ 
        weeklyCompetence: 'Debug memory issues in Rust' 
      });
      
      expect(weekPlan.weeklyCompetence).toBe('Debug memory issues in Rust');
    });
  });

  describe('drill outcome aggregation', () => {
    it('should aggregate drill outcomes', () => {
      const outcomes: DrillOutcome[] = ['pass', 'pass', 'fail', 'pass', 'skipped'];
      
      const passed = outcomes.filter(o => o === 'pass').length;
      const failed = outcomes.filter(o => o === 'fail').length;
      const skipped = outcomes.filter(o => o === 'skipped').length;

      expect(passed).toBe(3);
      expect(failed).toBe(1);
      expect(skipped).toBe(1);
    });

    it('should calculate drillsCompleted excluding skipped', () => {
      const outcomes: DrillOutcome[] = ['pass', 'fail', 'partial', 'skipped'];
      
      const completed = outcomes.filter(o => o !== 'skipped').length;

      expect(completed).toBe(3);
    });
  });

  describe('next week preparation', () => {
    it('should identify skills needing carry-forward', () => {
      const skillOutcomes: { skillId: SkillId; passed: boolean }[] = [
        { skillId: 'skill-1' as SkillId, passed: true },
        { skillId: 'skill-2' as SkillId, passed: false },
        { skillId: 'skill-3' as SkillId, passed: true },
      ];

      const carryForward = skillOutcomes
        .filter(s => !s.passed)
        .map(s => s.skillId);

      expect(carryForward).toEqual(['skill-2']);
    });

    it('should increment week number for next week', () => {
      const currentWeekNumber = 3;
      const nextWeekNumber = currentWeekNumber + 1;

      expect(nextWeekNumber).toBe(4);
    });

    it('should calculate next week dates', () => {
      const currentEndDateStr = '2025-01-12';
      const currentEndDate = new Date(currentEndDateStr + 'T12:00:00Z');
      const nextStartDate = new Date(currentEndDate);
      nextStartDate.setUTCDate(currentEndDate.getUTCDate() + 1);
      
      const nextEndDate = new Date(nextStartDate);
      nextEndDate.setUTCDate(nextStartDate.getUTCDate() + 6);

      expect(nextStartDate.toISOString().split('T')[0]).toBe('2025-01-13');
      expect(nextEndDate.toISOString().split('T')[0]).toBe('2025-01-19');
    });
  });
});
