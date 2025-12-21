// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION TESTS — Bounded Escalation & Variant Selection Tests
// NovaOS Spark Engine — Phase 10: Spark Generation
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  clampEscalationLevel,
  isValidEscalationLevel,
  getVariantForLevel,
  shouldShowSkipOption,
  selectActivity,
  getPrimaryActivity,
  estimateMinutes,
  estimateMinutesForStep,
  getEscalationMetadata,
} from '../escalation.js';
import { ESCALATION_BOUNDS, DEFAULT_SPARK_GENERATION_CONFIG } from '../types.js';
import type { Activity } from '../../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

function createActivity(minutes: number, type: Activity['type'] = 'read'): Activity {
  return {
    type,
    resourceId: 'resource-test-123' as any,
    minutes,
  };
}

function createActivities(): readonly Activity[] {
  return [
    createActivity(30, 'read'),    // Primary, 30 min
    createActivity(15, 'watch'),   // Secondary, 15 min
    createActivity(10, 'exercise'), // Shortest, 10 min
  ];
}

// ─────────────────────────────────────────────────────────────────────────────────
// CLAMP ESCALATION LEVEL TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('clampEscalationLevel', () => {
  it('should return level unchanged when within bounds', () => {
    const result = clampEscalationLevel(1);
    expect(result.level).toBe(1);
    expect(result.clamped).toBe(false);
  });

  it('should clamp negative levels to 0', () => {
    const result = clampEscalationLevel(-1);
    expect(result.level).toBe(0);
    expect(result.clamped).toBe(true);
  });

  it('should clamp levels above max to max', () => {
    const result = clampEscalationLevel(10);
    expect(result.level).toBe(ESCALATION_BOUNDS.MAX);
    expect(result.clamped).toBe(true);
  });

  it('should respect custom max level', () => {
    const result = clampEscalationLevel(3, 2);
    expect(result.level).toBe(2);
    expect(result.clamped).toBe(true);
  });

  it('should floor non-integer levels', () => {
    const result = clampEscalationLevel(1.7);
    expect(result.level).toBe(1);
    expect(result.clamped).toBe(true);
  });

  it('should handle edge case of exactly max level', () => {
    const result = clampEscalationLevel(3, 3);
    expect(result.level).toBe(3);
    expect(result.clamped).toBe(false);
  });

  it('should handle edge case of exactly 0', () => {
    const result = clampEscalationLevel(0);
    expect(result.level).toBe(0);
    expect(result.clamped).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// VALID ESCALATION LEVEL TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('isValidEscalationLevel', () => {
  it('should return true for valid levels 0-3', () => {
    expect(isValidEscalationLevel(0)).toBe(true);
    expect(isValidEscalationLevel(1)).toBe(true);
    expect(isValidEscalationLevel(2)).toBe(true);
    expect(isValidEscalationLevel(3)).toBe(true);
  });

  it('should return false for negative levels', () => {
    expect(isValidEscalationLevel(-1)).toBe(false);
  });

  it('should return false for levels above max', () => {
    expect(isValidEscalationLevel(4)).toBe(false);
    expect(isValidEscalationLevel(100)).toBe(false);
  });

  it('should return false for non-integers', () => {
    expect(isValidEscalationLevel(1.5)).toBe(false);
    expect(isValidEscalationLevel(0.1)).toBe(false);
  });

  it('should respect custom max level', () => {
    expect(isValidEscalationLevel(2, 2)).toBe(true);
    expect(isValidEscalationLevel(3, 2)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GET VARIANT FOR LEVEL TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getVariantForLevel', () => {
  it('should return full for level 0', () => {
    expect(getVariantForLevel(0)).toBe('full');
  });

  it('should return reduced for level 1', () => {
    expect(getVariantForLevel(1)).toBe('reduced');
  });

  it('should return minimal for level 2', () => {
    expect(getVariantForLevel(2)).toBe('minimal');
  });

  it('should return minimal for level 3', () => {
    expect(getVariantForLevel(3)).toBe('minimal');
  });

  it('should return minimal for levels above 3', () => {
    expect(getVariantForLevel(4)).toBe('minimal');
    expect(getVariantForLevel(10)).toBe('minimal');
  });

  it('should return full for negative levels (edge case)', () => {
    expect(getVariantForLevel(-1)).toBe('full');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SHOULD SHOW SKIP OPTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('shouldShowSkipOption', () => {
  it('should return true at max escalation level with default config', () => {
    expect(shouldShowSkipOption(3)).toBe(true);
  });

  it('should return false below max level', () => {
    expect(shouldShowSkipOption(0)).toBe(false);
    expect(shouldShowSkipOption(1)).toBe(false);
    expect(shouldShowSkipOption(2)).toBe(false);
  });

  it('should return false when disabled in config', () => {
    const config = { ...DEFAULT_SPARK_GENERATION_CONFIG, enableSkipAtMaxEscalation: false };
    expect(shouldShowSkipOption(3, config)).toBe(false);
  });

  it('should respect custom max level', () => {
    const config = { ...DEFAULT_SPARK_GENERATION_CONFIG, maxEscalationLevel: 2 };
    expect(shouldShowSkipOption(2, config)).toBe(true);
    expect(shouldShowSkipOption(1, config)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SELECT ACTIVITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('selectActivity', () => {
  it('should return null for undefined activities', () => {
    expect(selectActivity(undefined, 'full')).toBeNull();
  });

  it('should return null for empty activities', () => {
    expect(selectActivity([], 'full')).toBeNull();
  });

  it('should return first activity for full variant', () => {
    const activities = createActivities();
    const result = selectActivity(activities, 'full');
    
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
    expect(result!.activity.minutes).toBe(30);
  });

  it('should return shortest activity for reduced variant', () => {
    const activities = createActivities();
    const result = selectActivity(activities, 'reduced');
    
    expect(result).not.toBeNull();
    expect(result!.index).toBe(2); // exercise with 10 min
    expect(result!.activity.minutes).toBe(10);
  });

  it('should return shortest activity for minimal variant', () => {
    const activities = createActivities();
    const result = selectActivity(activities, 'minimal');
    
    expect(result).not.toBeNull();
    expect(result!.index).toBe(2);
    expect(result!.activity.minutes).toBe(10);
  });

  it('should handle single activity', () => {
    const activities = [createActivity(20)];
    
    expect(selectActivity(activities, 'full')!.index).toBe(0);
    expect(selectActivity(activities, 'reduced')!.index).toBe(0);
    expect(selectActivity(activities, 'minimal')!.index).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GET PRIMARY ACTIVITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getPrimaryActivity', () => {
  it('should return null for undefined activities', () => {
    expect(getPrimaryActivity(undefined)).toBeNull();
  });

  it('should return null for empty activities', () => {
    expect(getPrimaryActivity([])).toBeNull();
  });

  it('should return first activity', () => {
    const activities = createActivities();
    const result = getPrimaryActivity(activities);
    
    expect(result).not.toBeNull();
    expect(result!.minutes).toBe(30);
    expect(result!.type).toBe('read');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ESTIMATE MINUTES TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('estimateMinutes', () => {
  it('should return activity minutes for full variant (capped)', () => {
    const activity = createActivity(20);
    expect(estimateMinutes(activity, 'full')).toBe(20);
  });

  it('should cap full variant at maxSparkMinutes', () => {
    const activity = createActivity(60);
    expect(estimateMinutes(activity, 'full')).toBe(30); // default max
  });

  it('should return half minutes for reduced variant', () => {
    const activity = createActivity(20);
    expect(estimateMinutes(activity, 'reduced')).toBe(10);
  });

  it('should ensure reduced variant meets minimum', () => {
    const activity = createActivity(6);
    expect(estimateMinutes(activity, 'reduced')).toBe(5); // min is 5
  });

  it('should return fixed minutes for minimal variant', () => {
    const activity = createActivity(60);
    expect(estimateMinutes(activity, 'minimal')).toBe(5);
  });

  it('should respect custom config bounds', () => {
    const activity = createActivity(100);
    const config = { ...DEFAULT_SPARK_GENERATION_CONFIG, maxSparkMinutes: 15 };
    
    expect(estimateMinutes(activity, 'full', config)).toBe(15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ESTIMATE MINUTES FOR STEP TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('estimateMinutesForStep', () => {
  it('should return null for no activities', () => {
    expect(estimateMinutesForStep(undefined, 0)).toBeNull();
    expect(estimateMinutesForStep([], 0)).toBeNull();
  });

  it('should estimate based on selected activity and level', () => {
    const activities = createActivities();
    
    // Level 0 (full) -> first activity (30 min, capped to 30)
    expect(estimateMinutesForStep(activities, 0)).toBe(30);
    
    // Level 1 (reduced) -> shortest (10 min), halved = 5
    expect(estimateMinutesForStep(activities, 1)).toBe(5);
    
    // Level 2 (minimal) -> fixed 5
    expect(estimateMinutesForStep(activities, 2)).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GET ESCALATION METADATA TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getEscalationMetadata', () => {
  it('should return correct metadata for level 0', () => {
    const meta = getEscalationMetadata(0);
    
    expect(meta.level).toBe(0);
    expect(meta.variant).toBe('full');
    expect(meta.isMaxLevel).toBe(false);
    expect(meta.showSkipOption).toBe(false);
    expect(meta.label).toBe('Complete activity');
  });

  it('should return correct metadata for level 1', () => {
    const meta = getEscalationMetadata(1);
    
    expect(meta.level).toBe(1);
    expect(meta.variant).toBe('reduced');
    expect(meta.isMaxLevel).toBe(false);
    expect(meta.showSkipOption).toBe(false);
    expect(meta.label).toBe('Partial activity');
  });

  it('should return correct metadata for level 3 (max)', () => {
    const meta = getEscalationMetadata(3);
    
    expect(meta.level).toBe(3);
    expect(meta.variant).toBe('minimal');
    expect(meta.isMaxLevel).toBe(true);
    expect(meta.showSkipOption).toBe(true);
    expect(meta.label).toBe('Just start (skip available)');
  });

  it('should clamp out-of-bounds levels', () => {
    const meta = getEscalationMetadata(10);
    
    expect(meta.level).toBe(3);
    expect(meta.isMaxLevel).toBe(true);
  });
});
