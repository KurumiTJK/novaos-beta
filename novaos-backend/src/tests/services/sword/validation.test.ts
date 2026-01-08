// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION TESTS
// Tests for Zod schemas and validation functions
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEMA DEFINITIONS (mirroring validation.ts)
// ─────────────────────────────────────────────────────────────────────────────────

const RouteSchema = z.enum([
  'recall',
  'practice',
  'diagnose',
  'apply',
  'build',
  'refine',
  'plan',
]);

const RouteStatusSchema = z.enum(['learn', 'skip', 'assess']);

const SubskillTypeSchema = z.enum([
  'concepts',
  'procedures',
  'judgments',
  'outputs',
  'tool_setup',
  'tool_management',
]);

const ComplexitySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const DifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);

const SubskillSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  subskillType: SubskillTypeSchema,
  estimatedComplexity: ComplexitySchema,
  order: z.number().int().positive(),
});

const RouteAssignmentSchema = z.object({
  subskillId: z.string(),
  route: RouteSchema,
  status: RouteStatusSchema,
  reason: z.string().optional(),
});

const CapstoneDataSchema = z.object({
  title: z.string().min(1),
  capstoneStatement: z.string().min(10),
  successCriteria: z.array(z.string()).min(1),
  estimatedTime: z.string().optional(),
});

const ExplorationDataSchema = z.object({
  learningGoal: z.string().min(1),
  priorKnowledge: z.string().optional(),
  context: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  readyForCapstone: z.boolean().optional(),
});

const CreatePlanInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  difficulty: DifficultySchema,
  dailyMinutes: z.number().int().min(15).max(120),
  weeklyCadence: z.number().int().min(1).max(7),
});

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RouteSchema', () => {
  it('should accept valid routes', () => {
    const validRoutes = ['recall', 'practice', 'diagnose', 'apply', 'build', 'refine', 'plan'];
    
    for (const route of validRoutes) {
      expect(() => RouteSchema.parse(route)).not.toThrow();
    }
  });

  it('should reject invalid routes', () => {
    const invalidRoutes = ['learn', 'skip', 'assess', 'study', 'test', ''];
    
    for (const route of invalidRoutes) {
      expect(() => RouteSchema.parse(route)).toThrow();
    }
  });
});

describe('RouteStatusSchema', () => {
  it('should accept valid statuses', () => {
    expect(() => RouteStatusSchema.parse('learn')).not.toThrow();
    expect(() => RouteStatusSchema.parse('skip')).not.toThrow();
    expect(() => RouteStatusSchema.parse('assess')).not.toThrow();
  });

  it('should reject invalid statuses', () => {
    expect(() => RouteStatusSchema.parse('completed')).toThrow();
    expect(() => RouteStatusSchema.parse('pending')).toThrow();
    expect(() => RouteStatusSchema.parse('')).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SUBSKILL TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('SubskillTypeSchema', () => {
  it('should accept valid subskill types', () => {
    const validTypes = [
      'concepts',
      'procedures',
      'judgments',
      'outputs',
      'tool_setup',
      'tool_management',
    ];
    
    for (const type of validTypes) {
      expect(() => SubskillTypeSchema.parse(type)).not.toThrow();
    }
  });

  it('should reject invalid types', () => {
    expect(() => SubskillTypeSchema.parse('skills')).toThrow();
    expect(() => SubskillTypeSchema.parse('knowledge')).toThrow();
  });
});

describe('ComplexitySchema', () => {
  it('should accept 1, 2, or 3', () => {
    expect(ComplexitySchema.parse(1)).toBe(1);
    expect(ComplexitySchema.parse(2)).toBe(2);
    expect(ComplexitySchema.parse(3)).toBe(3);
  });

  it('should reject 0, 4, or non-integers', () => {
    expect(() => ComplexitySchema.parse(0)).toThrow();
    expect(() => ComplexitySchema.parse(4)).toThrow();
    expect(() => ComplexitySchema.parse(1.5)).toThrow();
    expect(() => ComplexitySchema.parse('2')).toThrow();
  });
});

describe('SubskillSchema', () => {
  it('should accept valid subskill', () => {
    const validSubskill = {
      id: 'ss_123',
      title: 'Core Concepts',
      description: 'Learn the fundamental concepts',
      subskillType: 'concepts',
      estimatedComplexity: 2,
      order: 1,
    };
    
    expect(() => SubskillSchema.parse(validSubskill)).not.toThrow();
  });

  it('should reject empty title', () => {
    const invalidSubskill = {
      id: 'ss_123',
      title: '',
      description: 'Description',
      subskillType: 'concepts',
      estimatedComplexity: 2,
      order: 1,
    };
    
    expect(() => SubskillSchema.parse(invalidSubskill)).toThrow();
  });

  it('should reject invalid order', () => {
    const invalidSubskill = {
      id: 'ss_123',
      title: 'Valid Title',
      description: 'Description',
      subskillType: 'concepts',
      estimatedComplexity: 2,
      order: 0, // Must be positive
    };
    
    expect(() => SubskillSchema.parse(invalidSubskill)).toThrow();
  });

  it('should reject missing required fields', () => {
    const incompleteSubskill = {
      id: 'ss_123',
      title: 'Valid Title',
      // Missing description, subskillType, etc.
    };
    
    expect(() => SubskillSchema.parse(incompleteSubskill)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTE ASSIGNMENT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RouteAssignmentSchema', () => {
  it('should accept valid assignment', () => {
    const validAssignment = {
      subskillId: 'ss_123',
      route: 'practice',
      status: 'learn',
      reason: 'User needs to learn this',
    };
    
    expect(() => RouteAssignmentSchema.parse(validAssignment)).not.toThrow();
  });

  it('should accept assignment without reason', () => {
    const validAssignment = {
      subskillId: 'ss_123',
      route: 'recall',
      status: 'skip',
    };
    
    expect(() => RouteAssignmentSchema.parse(validAssignment)).not.toThrow();
  });

  it('should reject invalid route in assignment', () => {
    const invalidAssignment = {
      subskillId: 'ss_123',
      route: 'invalid',
      status: 'learn',
    };
    
    expect(() => RouteAssignmentSchema.parse(invalidAssignment)).toThrow();
  });

  it('should reject invalid status in assignment', () => {
    const invalidAssignment = {
      subskillId: 'ss_123',
      route: 'practice',
      status: 'completed',
    };
    
    expect(() => RouteAssignmentSchema.parse(invalidAssignment)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CAPSTONE DATA TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('CapstoneDataSchema', () => {
  it('should accept valid capstone data', () => {
    const validCapstone = {
      title: 'Learn Python Basics',
      capstoneStatement: 'Build a working web scraper that extracts data from 3 websites',
      successCriteria: [
        'Can scrape text from static HTML',
        'Handles errors gracefully',
        'Stores data in JSON format',
      ],
      estimatedTime: '4 weeks at 30 minutes per day',
    };
    
    expect(() => CapstoneDataSchema.parse(validCapstone)).not.toThrow();
  });

  it('should reject empty title', () => {
    const invalidCapstone = {
      title: '',
      capstoneStatement: 'Valid statement that is long enough',
      successCriteria: ['Criterion 1'],
    };
    
    expect(() => CapstoneDataSchema.parse(invalidCapstone)).toThrow();
  });

  it('should reject short capstone statement', () => {
    const invalidCapstone = {
      title: 'Valid Title',
      capstoneStatement: 'Too short',
      successCriteria: ['Criterion 1'],
    };
    
    expect(() => CapstoneDataSchema.parse(invalidCapstone)).toThrow();
  });

  it('should reject empty success criteria', () => {
    const invalidCapstone = {
      title: 'Valid Title',
      capstoneStatement: 'Valid statement that is long enough',
      successCriteria: [],
    };
    
    expect(() => CapstoneDataSchema.parse(invalidCapstone)).toThrow();
  });

  it('should accept capstone without estimatedTime', () => {
    const validCapstone = {
      title: 'Valid Title',
      capstoneStatement: 'Valid statement that is long enough',
      successCriteria: ['Criterion 1'],
    };
    
    expect(() => CapstoneDataSchema.parse(validCapstone)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXPLORATION DATA TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ExplorationDataSchema', () => {
  it('should accept valid exploration data', () => {
    const validData = {
      learningGoal: 'Learn to play guitar',
      priorKnowledge: 'Complete beginner',
      context: 'Want to play songs at parties',
      constraints: ['30 minutes per day', 'No teacher available'],
      readyForCapstone: true,
    };
    
    expect(() => ExplorationDataSchema.parse(validData)).not.toThrow();
  });

  it('should accept minimal exploration data', () => {
    const minimalData = {
      learningGoal: 'Learn Python',
    };
    
    expect(() => ExplorationDataSchema.parse(minimalData)).not.toThrow();
  });

  it('should reject empty learning goal', () => {
    const invalidData = {
      learningGoal: '',
    };
    
    expect(() => ExplorationDataSchema.parse(invalidData)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CREATE PLAN INPUT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('CreatePlanInputSchema', () => {
  it('should accept valid plan input', () => {
    const validInput = {
      title: 'Learn Python Programming',
      description: 'A comprehensive plan to learn Python',
      difficulty: 'intermediate',
      dailyMinutes: 45,
      weeklyCadence: 5,
    };
    
    expect(() => CreatePlanInputSchema.parse(validInput)).not.toThrow();
  });

  it('should accept plan without description', () => {
    const validInput = {
      title: 'Learn Python',
      difficulty: 'beginner',
      dailyMinutes: 30,
      weeklyCadence: 3,
    };
    
    expect(() => CreatePlanInputSchema.parse(validInput)).not.toThrow();
  });

  it('should reject title too long', () => {
    const invalidInput = {
      title: 'A'.repeat(201),
      difficulty: 'beginner',
      dailyMinutes: 30,
      weeklyCadence: 3,
    };
    
    expect(() => CreatePlanInputSchema.parse(invalidInput)).toThrow();
  });

  it('should reject dailyMinutes below 15', () => {
    const invalidInput = {
      title: 'Valid Title',
      difficulty: 'beginner',
      dailyMinutes: 10,
      weeklyCadence: 3,
    };
    
    expect(() => CreatePlanInputSchema.parse(invalidInput)).toThrow();
  });

  it('should reject dailyMinutes above 120', () => {
    const invalidInput = {
      title: 'Valid Title',
      difficulty: 'beginner',
      dailyMinutes: 180,
      weeklyCadence: 3,
    };
    
    expect(() => CreatePlanInputSchema.parse(invalidInput)).toThrow();
  });

  it('should reject weeklyCadence below 1', () => {
    const invalidInput = {
      title: 'Valid Title',
      difficulty: 'beginner',
      dailyMinutes: 30,
      weeklyCadence: 0,
    };
    
    expect(() => CreatePlanInputSchema.parse(invalidInput)).toThrow();
  });

  it('should reject weeklyCadence above 7', () => {
    const invalidInput = {
      title: 'Valid Title',
      difficulty: 'beginner',
      dailyMinutes: 30,
      weeklyCadence: 10,
    };
    
    expect(() => CreatePlanInputSchema.parse(invalidInput)).toThrow();
  });

  it('should reject invalid difficulty', () => {
    const invalidInput = {
      title: 'Valid Title',
      difficulty: 'expert',
      dailyMinutes: 30,
      weeklyCadence: 3,
    };
    
    expect(() => CreatePlanInputSchema.parse(invalidInput)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('should handle null values appropriately', () => {
    expect(() => RouteSchema.parse(null)).toThrow();
    expect(() => SubskillTypeSchema.parse(null)).toThrow();
    expect(() => ComplexitySchema.parse(null)).toThrow();
  });

  it('should handle undefined values appropriately', () => {
    expect(() => RouteSchema.parse(undefined)).toThrow();
    expect(() => SubskillTypeSchema.parse(undefined)).toThrow();
  });

  it('should handle extra properties on objects', () => {
    const withExtra = {
      subskillId: 'ss_123',
      route: 'practice',
      status: 'learn',
      extraField: 'should be stripped',
    };
    
    const result = RouteAssignmentSchema.parse(withExtra);
    expect(result).not.toHaveProperty('extraField');
  });

  it('should coerce string numbers where appropriate', () => {
    // Note: Zod doesn't coerce by default
    expect(() => ComplexitySchema.parse('2')).toThrow();
  });
});
