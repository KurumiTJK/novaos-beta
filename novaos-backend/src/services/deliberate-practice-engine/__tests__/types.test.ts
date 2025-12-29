// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE TYPES — Unit Tests
// NovaOS — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  // Constants
  SKILL_DIFFICULTIES,
  SKILL_MASTERY_LEVELS,
  DRILL_OUTCOMES,
  DRILL_STATUSES,
  WEEK_PLAN_STATUSES,
  MASTERY_THRESHOLDS,
  ATTEMPTED_OUTCOMES,
  RETRY_OUTCOMES,
  // Type guards
  isSkillDifficulty,
  isSkillMastery,
  isDrillOutcome,
  isDrillStatus,
  isWeekPlanStatus,
  requiresRetry,
  countsAsAttempt,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Deliberate Practice Types - Constants', () => {
  describe('SKILL_DIFFICULTIES', () => {
    it('should contain all skill difficulty levels', () => {
      expect(SKILL_DIFFICULTIES).toContain('intro');
      expect(SKILL_DIFFICULTIES).toContain('practice');
      expect(SKILL_DIFFICULTIES).toContain('challenge');
      expect(SKILL_DIFFICULTIES).toContain('synthesis');
    });

    it('should have exactly 4 difficulty levels', () => {
      expect(SKILL_DIFFICULTIES).toHaveLength(4);
    });

    it('should be ordered from easiest to hardest', () => {
      expect(SKILL_DIFFICULTIES[0]).toBe('intro');
      expect(SKILL_DIFFICULTIES[1]).toBe('practice');
      expect(SKILL_DIFFICULTIES[2]).toBe('challenge');
      expect(SKILL_DIFFICULTIES[3]).toBe('synthesis');
    });
  });

  describe('SKILL_MASTERY_LEVELS', () => {
    it('should contain all mastery levels', () => {
      expect(SKILL_MASTERY_LEVELS).toContain('not_started');
      expect(SKILL_MASTERY_LEVELS).toContain('attempting');
      expect(SKILL_MASTERY_LEVELS).toContain('practicing');
      expect(SKILL_MASTERY_LEVELS).toContain('mastered');
    });

    it('should have exactly 4 mastery levels', () => {
      expect(SKILL_MASTERY_LEVELS).toHaveLength(4);
    });
  });

  describe('DRILL_OUTCOMES', () => {
    it('should contain all drill outcomes', () => {
      expect(DRILL_OUTCOMES).toContain('pass');
      expect(DRILL_OUTCOMES).toContain('fail');
      expect(DRILL_OUTCOMES).toContain('partial');
      expect(DRILL_OUTCOMES).toContain('skipped');
    });

    it('should have exactly 4 outcomes', () => {
      expect(DRILL_OUTCOMES).toHaveLength(4);
    });
  });

  describe('DRILL_STATUSES', () => {
    it('should contain all drill statuses', () => {
      expect(DRILL_STATUSES).toContain('scheduled');
      expect(DRILL_STATUSES).toContain('active');
      expect(DRILL_STATUSES).toContain('completed');
      expect(DRILL_STATUSES).toContain('missed');
    });

    it('should have exactly 4 statuses', () => {
      expect(DRILL_STATUSES).toHaveLength(4);
    });
  });

  describe('WEEK_PLAN_STATUSES', () => {
    it('should contain all week plan statuses', () => {
      expect(WEEK_PLAN_STATUSES).toContain('pending');
      expect(WEEK_PLAN_STATUSES).toContain('active');
      expect(WEEK_PLAN_STATUSES).toContain('completed');
    });

    it('should have exactly 3 statuses', () => {
      expect(WEEK_PLAN_STATUSES).toHaveLength(3);
    });
  });

  describe('MASTERY_THRESHOLDS', () => {
    it('should define practicing threshold', () => {
      expect(MASTERY_THRESHOLDS.PRACTICING).toBe(1);
    });

    it('should define mastered threshold', () => {
      expect(MASTERY_THRESHOLDS.MASTERED).toBe(3);
    });

    it('should define consecutive passes for mastery', () => {
      expect(MASTERY_THRESHOLDS.CONSECUTIVE_FOR_MASTERY).toBe(2);
    });
  });

  describe('ATTEMPTED_OUTCOMES', () => {
    it('should include pass, fail, and partial', () => {
      expect(ATTEMPTED_OUTCOMES).toContain('pass');
      expect(ATTEMPTED_OUTCOMES).toContain('fail');
      expect(ATTEMPTED_OUTCOMES).toContain('partial');
    });

    it('should not include skipped', () => {
      expect(ATTEMPTED_OUTCOMES).not.toContain('skipped');
    });
  });

  describe('RETRY_OUTCOMES', () => {
    it('should include fail and partial', () => {
      expect(RETRY_OUTCOMES).toContain('fail');
      expect(RETRY_OUTCOMES).toContain('partial');
    });

    it('should not include pass or skipped', () => {
      expect(RETRY_OUTCOMES).not.toContain('pass');
      expect(RETRY_OUTCOMES).not.toContain('skipped');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARD TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Deliberate Practice Types - Type Guards', () => {
  describe('isSkillDifficulty', () => {
    it('should return true for valid difficulties', () => {
      expect(isSkillDifficulty('intro')).toBe(true);
      expect(isSkillDifficulty('practice')).toBe(true);
      expect(isSkillDifficulty('challenge')).toBe(true);
      expect(isSkillDifficulty('synthesis')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isSkillDifficulty('easy')).toBe(false);
      expect(isSkillDifficulty('hard')).toBe(false);
      expect(isSkillDifficulty('foundation')).toBe(false); // Old value, no longer valid
      expect(isSkillDifficulty('')).toBe(false);
      expect(isSkillDifficulty(null)).toBe(false);
      expect(isSkillDifficulty(undefined)).toBe(false);
      expect(isSkillDifficulty(123)).toBe(false);
    });
  });

  describe('isSkillMastery', () => {
    it('should return true for valid mastery levels', () => {
      expect(isSkillMastery('not_started')).toBe(true);
      expect(isSkillMastery('attempting')).toBe(true);
      expect(isSkillMastery('practicing')).toBe(true);
      expect(isSkillMastery('mastered')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isSkillMastery('beginner')).toBe(false);
      expect(isSkillMastery('expert')).toBe(false);
      expect(isSkillMastery('attempted')).toBe(false); // Old value, no longer valid
      expect(isSkillMastery('')).toBe(false);
      expect(isSkillMastery(null)).toBe(false);
    });
  });

  describe('isDrillOutcome', () => {
    it('should return true for valid outcomes', () => {
      expect(isDrillOutcome('pass')).toBe(true);
      expect(isDrillOutcome('fail')).toBe(true);
      expect(isDrillOutcome('partial')).toBe(true);
      expect(isDrillOutcome('skipped')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isDrillOutcome('success')).toBe(false);
      expect(isDrillOutcome('failure')).toBe(false);
      expect(isDrillOutcome('')).toBe(false);
    });
  });

  describe('isDrillStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isDrillStatus('scheduled')).toBe(true);
      expect(isDrillStatus('active')).toBe(true);
      expect(isDrillStatus('completed')).toBe(true);
      expect(isDrillStatus('missed')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isDrillStatus('pending')).toBe(false);
      expect(isDrillStatus('done')).toBe(false);
    });
  });

  describe('isWeekPlanStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isWeekPlanStatus('pending')).toBe(true);
      expect(isWeekPlanStatus('active')).toBe(true);
      expect(isWeekPlanStatus('completed')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isWeekPlanStatus('scheduled')).toBe(false);
      expect(isWeekPlanStatus('done')).toBe(false);
    });
  });

  describe('requiresRetry', () => {
    it('should return true for fail and partial', () => {
      expect(requiresRetry('fail')).toBe(true);
      expect(requiresRetry('partial')).toBe(true);
    });

    it('should return false for pass and skipped', () => {
      expect(requiresRetry('pass')).toBe(false);
      expect(requiresRetry('skipped')).toBe(false);
    });
  });

  describe('countsAsAttempt', () => {
    it('should return true for pass, fail, and partial', () => {
      expect(countsAsAttempt('pass')).toBe(true);
      expect(countsAsAttempt('fail')).toBe(true);
      expect(countsAsAttempt('partial')).toBe(true);
    });

    it('should return false for skipped', () => {
      expect(countsAsAttempt('skipped')).toBe(false);
    });
  });
});
