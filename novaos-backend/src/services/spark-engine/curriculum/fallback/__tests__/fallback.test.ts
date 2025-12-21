// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK PATTERNS TESTS — Pre-Written Curriculum Pattern Tests
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  EXERCISE_TEMPLATES,
  OBJECTIVE_TEMPLATES,
  DAY_STRUCTURE_TEMPLATES,
  selectExercises,
  selectObjectives,
  selectDayStructure,
  applyTemplate,
  generateSelfGuidedNotes,
  PATTERNS_VERSION,
  parseVersion,
  compareVersions,
  isCompatible,
  generateCacheKey,
  isCacheKeyCurrent,
} from '../index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEMPLATE COLLECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('EXERCISE_TEMPLATES', () => {
  it('should have templates for all exercise types', () => {
    const types = new Set(EXERCISE_TEMPLATES.map(t => t.type));
    
    expect(types.has('practice')).toBe(true);
    expect(types.has('quiz')).toBe(true);
    expect(types.has('project')).toBe(true);
    expect(types.has('reflection')).toBe(true);
    expect(types.has('discussion')).toBe(true);
  });

  it('should have valid minutes for all templates', () => {
    for (const template of EXERCISE_TEMPLATES) {
      expect(template.defaultMinutes).toBeGreaterThan(0);
      expect(template.defaultMinutes).toBeLessThanOrEqual(120);
    }
  });

  it('should have at least one difficulty for each template', () => {
    for (const template of EXERCISE_TEMPLATES) {
      expect(template.difficulties.length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty templates', () => {
    for (const template of EXERCISE_TEMPLATES) {
      expect(template.template.length).toBeGreaterThan(10);
    }
  });
});

describe('OBJECTIVE_TEMPLATES', () => {
  it('should have multiple templates', () => {
    expect(OBJECTIVE_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('should have valid difficulty levels', () => {
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    
    for (const template of OBJECTIVE_TEMPLATES) {
      for (const difficulty of template.difficulties) {
        expect(validDifficulties).toContain(difficulty);
      }
    }
  });
});

describe('DAY_STRUCTURE_TEMPLATES', () => {
  it('should have required structure types', () => {
    const ids = DAY_STRUCTURE_TEMPLATES.map(t => t.id);
    
    expect(ids).toContain('introduction');
    expect(ids).toContain('deep-dive');
    expect(ids).toContain('practice-day');
    expect(ids).toContain('project-day');
    expect(ids).toContain('review-day');
  });

  it('should have valid resource counts', () => {
    for (const template of DAY_STRUCTURE_TEMPLATES) {
      expect(template.resourceCount).toBeGreaterThan(0);
      expect(template.resourceCount).toBeLessThanOrEqual(5);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTION FUNCTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('selectExercises', () => {
  it('should return requested count', () => {
    const exercises = selectExercises({ count: 3 });
    expect(exercises).toHaveLength(3);
  });

  it('should filter by type', () => {
    const exercises = selectExercises({
      types: ['quiz'],
      count: 5,
    });
    
    for (const exercise of exercises) {
      expect(exercise.type).toBe('quiz');
    }
  });

  it('should filter by difficulty', () => {
    const exercises = selectExercises({
      difficulty: 'beginner',
      count: 10,
    });
    
    // All returned exercises should support beginner difficulty
    expect(exercises.length).toBeGreaterThan(0);
  });

  it('should filter optional exercises when requested', () => {
    const withOptional = selectExercises({ includeOptional: true, count: 20 });
    const withoutOptional = selectExercises({ includeOptional: false, count: 20 });
    
    const optionalInWith = withOptional.filter(e => e.optional).length;
    const optionalInWithout = withoutOptional.filter(e => e.optional).length;
    
    expect(optionalInWithout).toBe(0);
    expect(optionalInWith).toBeGreaterThanOrEqual(optionalInWithout);
  });

  it('should filter by topics', () => {
    const exercises = selectExercises({
      topics: ['programming'],
      count: 10,
    });
    
    // Should return exercises (wildcards or matching topics)
    expect(exercises.length).toBeGreaterThan(0);
  });
});

describe('selectObjectives', () => {
  it('should return requested count', () => {
    const objectives = selectObjectives({ count: 2 });
    expect(objectives).toHaveLength(2);
  });

  it('should filter by difficulty', () => {
    const objectives = selectObjectives({
      difficulty: 'advanced',
      count: 10,
    });
    
    expect(objectives.length).toBeGreaterThan(0);
  });

  it('should return objectives with descriptions', () => {
    const objectives = selectObjectives({ count: 3 });
    
    for (const obj of objectives) {
      expect(obj.description).toBeDefined();
      expect(obj.description.length).toBeGreaterThan(10);
    }
  });
});

describe('selectDayStructure', () => {
  it('should return introduction for day 1', () => {
    const structure = selectDayStructure(1, 7, 'beginner');
    expect(structure.id).toBe('introduction');
  });

  it('should return review for last day', () => {
    const structure = selectDayStructure(7, 7, 'intermediate');
    expect(structure.id).toBe('review-day');
  });

  it('should return project for second-to-last day', () => {
    const structure = selectDayStructure(6, 7, 'intermediate');
    expect(structure.id).toBe('project-day');
  });

  it('should return advanced structure for late advanced days', () => {
    const structure = selectDayStructure(5, 7, 'advanced');
    expect(structure.id).toBe('advanced-day');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('applyTemplate', () => {
  it('should replace topic placeholder', () => {
    const result = applyTemplate('Introduction to {topic}', 'TypeScript');
    expect(result).toBe('Introduction to TypeScript');
  });

  it('should replace multiple placeholders', () => {
    const result = applyTemplate('{topic} and {topic}', 'React');
    expect(result).toBe('React and React');
  });

  it('should handle no placeholders', () => {
    const result = applyTemplate('No placeholders here', 'TypeScript');
    expect(result).toBe('No placeholders here');
  });
});

describe('generateSelfGuidedNotes', () => {
  it('should include day number', () => {
    const notes = generateSelfGuidedNotes(3, 7, 2);
    expect(notes).toContain('Day 3');
  });

  it('should mention resource count', () => {
    const notes = generateSelfGuidedNotes(1, 7, 5);
    expect(notes).toContain('5 resources');
  });

  it('should have welcome message for first day', () => {
    const notes = generateSelfGuidedNotes(1, 7, 2);
    expect(notes).toContain('Welcome');
  });

  it('should have final day message for last day', () => {
    const notes = generateSelfGuidedNotes(7, 7, 2);
    expect(notes).toContain('Final day');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// VERSIONING TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('PATTERNS_VERSION', () => {
  it('should have valid version components', () => {
    expect(PATTERNS_VERSION.major).toBeGreaterThanOrEqual(1);
    expect(PATTERNS_VERSION.minor).toBeGreaterThanOrEqual(0);
    expect(PATTERNS_VERSION.patch).toBeGreaterThanOrEqual(0);
  });

  it('should have valid version string', () => {
    expect(PATTERNS_VERSION.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should have build date', () => {
    expect(PATTERNS_VERSION.buildDate).toBeDefined();
  });
});

describe('parseVersion', () => {
  it('should parse valid version', () => {
    const result = parseVersion('1.2.3');
    expect(result).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('should return null for invalid version', () => {
    expect(parseVersion('invalid')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('should detect newer version', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('should detect older version', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
  });

  it('should detect equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('isCompatible', () => {
  it('should be compatible with same major version', () => {
    expect(isCompatible('1.0.0', '1.5.0')).toBe(true);
    expect(isCompatible('1.9.9', '1.0.0')).toBe(true);
  });

  it('should not be compatible with different major version', () => {
    expect(isCompatible('1.0.0', '2.0.0')).toBe(false);
  });
});

describe('generateCacheKey', () => {
  it('should include version', () => {
    const key = generateCacheKey('prefix', 'part1', 'part2');
    expect(key).toContain(PATTERNS_VERSION.version);
  });

  it('should include all parts', () => {
    const key = generateCacheKey('curriculum', 'user-123');
    expect(key).toContain('curriculum');
    expect(key).toContain('user-123');
  });
});

describe('isCacheKeyCurrent', () => {
  it('should detect current version keys', () => {
    const key = generateCacheKey('test', 'data');
    expect(isCacheKeyCurrent(key)).toBe(true);
  });

  it('should reject old version keys', () => {
    const oldKey = 'test:v0.0.0:data';
    expect(isCacheKeyCurrent(oldKey)).toBe(false);
  });
});
