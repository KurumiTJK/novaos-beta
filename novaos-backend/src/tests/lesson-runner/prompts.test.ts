// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS UTILITY TESTS
// Tests for prompt builders, JSON parsing, and route guidance
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  createTestLessonPlan,
  createTestPlanSubskill,
  createTestSessionSummary,
} from './setup';

// Import the module under test
import {
  buildFullContext,
  buildLessonPlanUserMessage,
  buildDailyLessonUserMessage,
  buildKnowledgeCheckUserMessage,
  buildRefreshUserMessage,
  buildDiagnosticUserMessage,
  parseLLMJson,
  parseLLMJsonSafe,
  getRouteGuidance,
  getComplexityGuidance,
  LESSON_PLAN_SYSTEM_PROMPT,
  DAILY_LESSON_SYSTEM_PROMPT,
  KNOWLEDGE_CHECK_SYSTEM_PROMPT,
  REFRESH_SYSTEM_PROMPT,
  DIAGNOSTIC_SYSTEM_PROMPT,
} from '@services/sword/lesson-runner/shared/prompts';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────────────────────────

const testPlan = {
  ...createTestLessonPlan({
    id: 'plan-123',
    userId: 'user-123',
    title: 'Learn TypeScript',
  }),
  capstoneStatement: 'Build a full-stack TypeScript application',
  successCriteria: ['Write type-safe code', 'Use generics effectively'],
  difficulty: 'intermediate',
  dailyMinutes: 30,
  progress: 0.3,
  totalSubskills: 10,
};

const testSubskill = {
  ...createTestPlanSubskill({
    id: 'subskill-123',
    planId: 'plan-123',
    title: 'TypeScript Generics',
    route: 'recall',
    status: 'active',
  }),
  description: 'Learn to use generic types for flexible code',
  subskillType: 'concept',
  complexity: 2,
  order: 3,
};

const testSummaries = [
  {
    ...createTestSessionSummary({
      id: 'sum-1',
      sessionNumber: 1,
      summary: 'Learned generic syntax',
      keyConcepts: ['<T> syntax', 'Type inference'],
    }),
  },
  {
    ...createTestSessionSummary({
      id: 'sum-2',
      sessionNumber: 2,
      summary: 'Practiced generic functions',
      keyConcepts: ['Generic functions', 'Multiple params'],
    }),
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// BUILD FULL CONTEXT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('buildFullContext', () => {
  it('should build complete context object', () => {
    const context = buildFullContext(
      testSubskill as any,
      testPlan as any,
      2, // sessionNumber
      4, // totalSessions
      testSummaries as any[],
      [80, 90], // previousScores
      ['Syntax', 'Edge cases'] // weakAreas
    );

    expect(context.planTitle).toBe('Learn TypeScript');
    expect(context.subskillTitle).toBe('TypeScript Generics');
    expect(context.sessionNumber).toBe(2);
    expect(context.totalSessions).toBe(4);
    expect(context.previousSummaries).toHaveLength(2);
    expect(context.previousScores).toEqual([80, 90]);
    expect(context.weakAreas).toEqual(['Syntax', 'Edge cases']);
  });

  it('should calculate learning velocity', () => {
    const context = buildFullContext(
      testSubskill as any,
      testPlan as any,
      1,
      3,
      [],
      [],
      []
    );

    expect(['slow', 'normal', 'fast']).toContain(context.learningVelocity);
  });

  it('should include capstone statement if present', () => {
    const context = buildFullContext(
      testSubskill as any,
      testPlan as any,
      1,
      3
    );

    expect(context.capstoneStatement).toBe('Build a full-stack TypeScript application');
  });

  it('should handle missing optional fields', () => {
    const minimalPlan = {
      ...testPlan,
      capstoneStatement: undefined,
      successCriteria: undefined,
    };

    const context = buildFullContext(
      testSubskill as any,
      minimalPlan as any,
      1,
      3
    );

    expect(context.capstoneStatement).toBeUndefined();
    expect(context.successCriteria).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MESSAGE BUILDER TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('buildLessonPlanUserMessage', () => {
  it('should include subskill details', () => {
    const context = buildFullContext(testSubskill as any, testPlan as any, 1, 3);
    const message = buildLessonPlanUserMessage(
      testSubskill as any,
      testPlan as any,
      context
    );

    expect(message).toContain('TypeScript Generics');
    expect(message).toContain('recall');
    expect(message).toContain('Complexity: 2/3');
  });

  it('should include plan context', () => {
    const context = buildFullContext(testSubskill as any, testPlan as any, 1, 3);
    const message = buildLessonPlanUserMessage(
      testSubskill as any,
      testPlan as any,
      context
    );

    expect(message).toContain('Learn TypeScript');
    expect(message).toContain('Build a full-stack TypeScript application');
  });

  it('should include route guidance', () => {
    const context = buildFullContext(testSubskill as any, testPlan as any, 1, 3);
    const message = buildLessonPlanUserMessage(
      testSubskill as any,
      testPlan as any,
      context
    );

    expect(message).toContain('RECALL ROUTE');
  });

  it('should include remediation info when provided', () => {
    const context = buildFullContext(testSubskill as any, testPlan as any, 1, 3);
    const gaps = [
      { area: 'Syntax', score: 30, status: 'gap' as const, priority: 'high' as const, suggestedFocus: 'Review syntax' },
    ];
    
    const message = buildLessonPlanUserMessage(
      testSubskill as any,
      testPlan as any,
      context,
      true, // isRemediation
      gaps
    );

    expect(message).toContain('REMEDIATION FOCUS');
    expect(message).toContain('Syntax');
  });
});

describe('buildDiagnosticUserMessage', () => {
  it('should include subskill info', () => {
    const message = buildDiagnosticUserMessage(
      testSubskill as any,
      testPlan as any
    );

    expect(message).toContain('TypeScript Generics');
    expect(message).toContain('recall');
  });

  it('should explain scoring thresholds', () => {
    const message = buildDiagnosticUserMessage(
      testSubskill as any,
      testPlan as any
    );

    expect(message).toContain('85%');
    expect(message).toContain('50-85%');
    expect(message).toContain('50%');
  });
});

describe('buildRefreshUserMessage', () => {
  it('should include gap days', () => {
    const message = buildRefreshUserMessage(
      testSubskill as any,
      testPlan as any,
      testSummaries as any[],
      10 // gapDays
    );

    expect(message).toContain('10 days');
  });

  it('should include previous learning summaries', () => {
    const message = buildRefreshUserMessage(
      testSubskill as any,
      testPlan as any,
      testSummaries as any[],
      7
    );

    expect(message).toContain('WHAT THEY PREVIOUSLY LEARNED');
    expect(message).toContain('generic syntax');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// JSON PARSING TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('parseLLMJson', () => {
  it('should parse clean JSON', () => {
    const json = '{"key": "value", "number": 42}';
    const result = parseLLMJson<{ key: string; number: number }>(json);

    expect(result.key).toBe('value');
    expect(result.number).toBe(42);
  });

  it('should parse JSON with markdown code blocks', () => {
    const json = '```json\n{"key": "value"}\n```';
    const result = parseLLMJson<{ key: string }>(json);

    expect(result.key).toBe('value');
  });

  it('should parse JSON with surrounding text', () => {
    const json = 'Here is the response:\n{"key": "value"}\nThat was the JSON.';
    const result = parseLLMJson<{ key: string }>(json);

    expect(result.key).toBe('value');
  });

  it('should throw for invalid JSON', () => {
    const invalid = 'not json at all';

    expect(() => parseLLMJson(invalid)).toThrow('No JSON found');
  });

  it('should throw for malformed JSON', () => {
    const malformed = '{"key": "value"'; // Missing closing brace

    expect(() => parseLLMJson(malformed)).toThrow();
  });

  it('should handle nested objects', () => {
    const json = '{"outer": {"inner": "value"}}';
    const result = parseLLMJson<{ outer: { inner: string } }>(json);

    expect(result.outer.inner).toBe('value');
  });

  it('should handle arrays', () => {
    const json = '{"items": [1, 2, 3]}';
    const result = parseLLMJson<{ items: number[] }>(json);

    expect(result.items).toEqual([1, 2, 3]);
  });
});

describe('parseLLMJsonSafe', () => {
  it('should return parsed JSON on success', () => {
    const json = '{"key": "value"}';
    const fallback = { key: 'fallback' };
    const result = parseLLMJsonSafe<{ key: string }>(json, fallback);

    expect(result.key).toBe('value');
  });

  it('should return fallback on invalid JSON', () => {
    const invalid = 'not json';
    const fallback = { key: 'fallback' };
    const result = parseLLMJsonSafe<{ key: string }>(invalid, fallback);

    expect(result.key).toBe('fallback');
  });

  it('should return fallback on parse error', () => {
    const malformed = '{"key": }';
    const fallback = { key: 'fallback' };
    const result = parseLLMJsonSafe<{ key: string }>(malformed, fallback);

    expect(result.key).toBe('fallback');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTE GUIDANCE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getRouteGuidance', () => {
  it('should return recall guidance', () => {
    const guidance = getRouteGuidance('recall');

    expect(guidance).toContain('RECALL ROUTE');
    expect(guidance).toContain('Memory');
    expect(guidance).toContain('spaced repetition');
  });

  it('should return practice guidance', () => {
    const guidance = getRouteGuidance('practice');

    expect(guidance).toContain('PRACTICE ROUTE');
    expect(guidance).toContain('Procedural');
    expect(guidance).toContain('worked examples');
  });

  it('should return diagnose guidance', () => {
    const guidance = getRouteGuidance('diagnose');

    expect(guidance).toContain('DIAGNOSE ROUTE');
    expect(guidance).toContain('Pattern Recognition');
  });

  it('should return apply guidance', () => {
    const guidance = getRouteGuidance('apply');

    expect(guidance).toContain('APPLY ROUTE');
    expect(guidance).toContain('Transfer');
  });

  it('should return build guidance', () => {
    const guidance = getRouteGuidance('build');

    expect(guidance).toContain('BUILD ROUTE');
    expect(guidance).toContain('Creation');
  });

  it('should return refine guidance', () => {
    const guidance = getRouteGuidance('refine');

    expect(guidance).toContain('REFINE ROUTE');
    expect(guidance).toContain('Quality');
  });

  it('should return plan guidance', () => {
    const guidance = getRouteGuidance('plan');

    expect(guidance).toContain('PLAN ROUTE');
    expect(guidance).toContain('Organization');
  });

  it('should return default for unknown route', () => {
    const guidance = getRouteGuidance('unknown' as any);

    expect(guidance).toBeDefined();
    expect(guidance.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// COMPLEXITY GUIDANCE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getComplexityGuidance', () => {
  it('should return guidance for complexity 1', () => {
    const guidance = getComplexityGuidance(1);

    expect(guidance).toContain('COMPLEXITY 1');
    expect(guidance).toContain('straightforward');
    expect(guidance).toContain('simple');
  });

  it('should return guidance for complexity 2', () => {
    const guidance = getComplexityGuidance(2);

    expect(guidance).toContain('COMPLEXITY 2');
    expect(guidance).toContain('moderate');
    expect(guidance).toContain('realistic');
  });

  it('should return guidance for complexity 3', () => {
    const guidance = getComplexityGuidance(3);

    expect(guidance).toContain('COMPLEXITY 3');
    expect(guidance).toContain('deep');
    expect(guidance).toContain('edge cases');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('System Prompts', () => {
  it('should have lesson plan system prompt', () => {
    expect(LESSON_PLAN_SYSTEM_PROMPT).toBeDefined();
    expect(LESSON_PLAN_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(LESSON_PLAN_SYSTEM_PROMPT).toContain('instructional designer');
    expect(LESSON_PLAN_SYSTEM_PROMPT).toContain('JSON');
  });

  it('should have daily lesson system prompt', () => {
    expect(DAILY_LESSON_SYSTEM_PROMPT).toBeDefined();
    expect(DAILY_LESSON_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(DAILY_LESSON_SYSTEM_PROMPT).toContain('tutor');
  });

  it('should have knowledge check system prompt', () => {
    expect(KNOWLEDGE_CHECK_SYSTEM_PROMPT).toBeDefined();
    expect(KNOWLEDGE_CHECK_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(KNOWLEDGE_CHECK_SYSTEM_PROMPT).toContain('assessment');
  });

  it('should have refresh system prompt', () => {
    expect(REFRESH_SYSTEM_PROMPT).toBeDefined();
    expect(REFRESH_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(REFRESH_SYSTEM_PROMPT).toContain('refresh');
  });

  it('should have diagnostic system prompt', () => {
    expect(DIAGNOSTIC_SYSTEM_PROMPT).toBeDefined();
    expect(DIAGNOSTIC_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(DIAGNOSTIC_SYSTEM_PROMPT).toContain('diagnostic');
    expect(DIAGNOSTIC_SYSTEM_PROMPT).toContain('85%');
  });

  it('all system prompts should specify JSON output', () => {
    expect(LESSON_PLAN_SYSTEM_PROMPT).toContain('JSON');
    expect(DAILY_LESSON_SYSTEM_PROMPT).toContain('JSON');
    expect(KNOWLEDGE_CHECK_SYSTEM_PROMPT).toContain('JSON');
    expect(REFRESH_SYSTEM_PROMPT).toContain('JSON');
    expect(DIAGNOSTIC_SYSTEM_PROMPT).toContain('JSON');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('should handle empty summaries array', () => {
    const context = buildFullContext(
      testSubskill as any,
      testPlan as any,
      1,
      3,
      [], // empty summaries
      [],
      []
    );

    expect(context.previousSummaries).toEqual([]);
  });

  it('should handle unicode in JSON', () => {
    const json = '{"text": "Hello 世界 🎉"}';
    const result = parseLLMJson<{ text: string }>(json);

    expect(result.text).toBe('Hello 世界 🎉');
  });

  it('should handle special characters in JSON strings', () => {
    const json = '{"text": "Line1\\nLine2\\tTab"}';
    const result = parseLLMJson<{ text: string }>(json);

    expect(result.text).toContain('Line1');
    expect(result.text).toContain('Line2');
  });

  it('should handle JSON with boolean and null values', () => {
    const json = '{"active": true, "deleted": false, "data": null}';
    const result = parseLLMJson<{ active: boolean; deleted: boolean; data: null }>(json);

    expect(result.active).toBe(true);
    expect(result.deleted).toBe(false);
    expect(result.data).toBeNull();
  });
});
