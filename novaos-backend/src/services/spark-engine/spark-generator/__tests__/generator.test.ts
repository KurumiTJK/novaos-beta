// ═══════════════════════════════════════════════════════════════════════════════
// GENERATOR TESTS — SparkGenerator Class Tests
// NovaOS Spark Engine — Phase 10: Spark Generation
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SparkGenerator,
  createSparkGenerator,
  createSparkGeneratorFromLimits,
  generateSparkForStep,
  generateSparkVariants,
} from '../generator.js';
import { DEFAULT_SPARK_GENERATION_CONFIG } from '../types.js';
import type { Step, Activity, StepResource } from '../../types.js';
import type { StepId, ResourceId, QuestId, Timestamp } from '../../../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

function createTestResource(
  id: string = 'resource-test-123',
  title: string = 'The Rust Programming Language',
  url: string = 'https://doc.rust-lang.org/book/'
): StepResource {
  return {
    id: id as ResourceId,
    providerId: 'rust-book',
    title,
    type: 'documentation',
    url,
    verificationLevel: 'strong',
  };
}

function createTestActivity(
  resourceId: string = 'resource-test-123',
  minutes: number = 30,
  type: Activity['type'] = 'read',
  section?: string
): Activity {
  return {
    type,
    resourceId: resourceId as ResourceId,
    minutes,
    section,
  };
}

function createTestStep(options?: {
  activities?: readonly Activity[];
  resources?: readonly StepResource[];
  title?: string;
}): Step {
  const resource = createTestResource();
  const activity = createTestActivity(resource.id, 30, 'read', 'Chapter 4.1');

  return {
    id: 'step-test-123' as StepId,
    questId: 'quest-test-123' as QuestId,
    title: options?.title ?? 'Day 3: Ownership & Borrowing',
    description: 'Learn about Rust ownership model',
    status: 'active',
    order: 3,
    createdAt: new Date().toISOString() as Timestamp,
    updatedAt: new Date().toISOString() as Timestamp,
    activities: options?.activities ?? [activity],
    resources: options?.resources ?? [resource],
    scheduledDate: '2024-01-15',
    dayNumber: 3,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK GENERATOR CLASS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('SparkGenerator', () => {
  let generator: SparkGenerator;

  beforeEach(() => {
    generator = new SparkGenerator();
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const gen = new SparkGenerator();
      expect(gen.getConfig()).toEqual(DEFAULT_SPARK_GENERATION_CONFIG);
    });

    it('should merge custom config with defaults', () => {
      const gen = new SparkGenerator({ maxEscalationLevel: 2 });
      const config = gen.getConfig();
      expect(config.maxEscalationLevel).toBe(2);
      expect(config.minSparkMinutes).toBe(DEFAULT_SPARK_GENERATION_CONFIG.minSparkMinutes);
    });
  });

  describe('getMaxEscalationLevel', () => {
    it('should return configured max level', () => {
      expect(generator.getMaxEscalationLevel()).toBe(3);
    });

    it('should return custom max level', () => {
      const gen = new SparkGenerator({ maxEscalationLevel: 2 });
      expect(gen.getMaxEscalationLevel()).toBe(2);
    });
  });

  describe('generateSpark', () => {
    it('should generate spark at level 0 (full)', async () => {
      const step = createTestStep();
      const result = await generator.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const spark = result.value;
      expect(spark.id).toMatch(/^spark-/);
      expect(spark.stepId).toBe(step.id);
      expect(spark.variant).toBe('full');
      expect(spark.escalationLevel).toBe(0);
      expect(spark.status).toBe('pending');
      expect(spark.action).toContain('Read');
      expect(spark.action).toContain('Chapter 4.1');
      expect(spark.estimatedMinutes).toBe(30);
    });

    it('should generate spark at level 1 (reduced)', async () => {
      const step = createTestStep();
      const result = await generator.generateSpark(step, 1);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const spark = result.value;
      expect(spark.variant).toBe('reduced');
      expect(spark.escalationLevel).toBe(1);
      expect(spark.action).toContain('Skim');
    });

    it('should generate spark at level 2 (minimal)', async () => {
      const step = createTestStep();
      const result = await generator.generateSpark(step, 2);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const spark = result.value;
      expect(spark.variant).toBe('minimal');
      expect(spark.escalationLevel).toBe(2);
      expect(spark.action).toContain('Open');
      expect(spark.estimatedMinutes).toBe(5);
    });

    it('should generate spark at level 3 (minimal + skip)', async () => {
      const step = createTestStep();
      const result = await generator.generateSpark(step, 3);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const spark = result.value;
      expect(spark.variant).toBe('minimal');
      expect(spark.escalationLevel).toBe(3);
    });

    it('should clamp escalation level above max', async () => {
      const step = createTestStep();
      const result = await generator.generateSpark(step, 10);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.escalationLevel).toBe(3);
    });

    it('should clamp negative escalation level', async () => {
      const step = createTestStep();
      const result = await generator.generateSpark(step, -1);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.escalationLevel).toBe(0);
    });

    it('should include resource URL when configured', async () => {
      const gen = new SparkGenerator({ includeResourceUrls: true });
      const step = createTestStep();
      const result = await gen.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.resourceUrl).toBe('https://doc.rust-lang.org/book/');
    });

    it('should sanitize resource URL and include in spark', async () => {
      const resource = createTestResource('res-1', 'Test', 'https://safe.example.com/path');
      const activity = createTestActivity('res-1');
      const step = createTestStep({
        activities: [activity],
        resources: [resource],
      });

      const result = await generator.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.resourceUrl).toBe('https://safe.example.com/path');
    });

    it('should set resourceId and resourceSection from activity', async () => {
      const resource = createTestResource('res-123');
      const activity = createTestActivity('res-123', 20, 'read', 'Section 2.1');
      const step = createTestStep({
        activities: [activity],
        resources: [resource],
      });

      const result = await generator.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.resourceId).toBe('res-123');
      expect(result.value.resourceSection).toBe('Section 2.1');
    });

    it('should generate unique spark IDs', async () => {
      const step = createTestStep();
      const result1 = await generator.generateSpark(step, 0);
      const result2 = await generator.generateSpark(step, 0);

      expect(result1.ok && result2.ok).toBe(true);
      if (!result1.ok || !result2.ok) return;

      expect(result1.value.id).not.toBe(result2.value.id);
    });

    it('should set timestamps', async () => {
      const step = createTestStep();
      const before = new Date().toISOString();
      const result = await generator.generateSpark(step, 0);
      const after = new Date().toISOString();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.createdAt).toBeDefined();
      expect(result.value.updatedAt).toBeDefined();
      expect(result.value.createdAt >= before).toBe(true);
      expect(result.value.createdAt <= after).toBe(true);
    });
  });

  describe('generateSpark with fallback', () => {
    it('should use fallback action when no activities', async () => {
      const step = createTestStep({ activities: [] });
      const result = await generator.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.action).toContain("Complete today's lesson");
      expect(result.value.action).toContain(step.title);
    });

    it('should use fallback action when activities undefined', async () => {
      const step = createTestStep({ activities: undefined });
      const result = await generator.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.action).toContain(step.title);
    });

    it('should use first resource when activity has no matching resource', async () => {
      const resource = createTestResource('different-id');
      const activity = createTestActivity('missing-id');
      const step = createTestStep({
        activities: [activity],
        resources: [resource],
      });

      const result = await generator.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      // Should still generate, possibly without resource URL in action
    });
  });

  describe('generateSpark with different activity types', () => {
    it('should use correct verb for watch activity', async () => {
      const resource = createTestResource('res-1', 'Rust Tutorial Video');
      const activity = createTestActivity('res-1', 45, 'watch', '00:15:00-00:30:00');
      const step = createTestStep({
        activities: [activity],
        resources: [resource],
      });

      const result = await generator.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.action).toContain('Watch');
    });

    it('should use correct verb for code activity', async () => {
      const resource = createTestResource('res-1', 'Rustlings Exercises');
      const activity = createTestActivity('res-1', 30, 'code');
      const step = createTestStep({
        activities: [activity],
        resources: [resource],
      });

      const result = await generator.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.action).toContain('Complete');
    });

    it('should use correct verb for exercise activity', async () => {
      const resource = createTestResource('res-1', 'Practice Problems');
      const activity = createTestActivity('res-1', 20, 'exercise');
      const step = createTestStep({
        activities: [activity],
        resources: [resource],
      });

      const result = await generator.generateSpark(step, 0);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.action).toContain('Complete');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createSparkGenerator', () => {
  it('should create generator with default config', () => {
    const gen = createSparkGenerator();
    expect(gen).toBeInstanceOf(SparkGenerator);
    expect(gen.getMaxEscalationLevel()).toBe(3);
  });

  it('should create generator with custom config', () => {
    const gen = createSparkGenerator({ maxEscalationLevel: 2, maxSparkMinutes: 20 });
    expect(gen.getMaxEscalationLevel()).toBe(2);
    expect(gen.getConfig().maxSparkMinutes).toBe(20);
  });
});

describe('createSparkGeneratorFromLimits', () => {
  it('should create generator from SwordLimitsConfig', () => {
    const gen = createSparkGeneratorFromLimits({
      maxEscalationLevel: 2,
      minSparkMinutes: 3,
      maxSparkMinutes: 25,
    });

    const config = gen.getConfig();
    expect(config.maxEscalationLevel).toBe(2);
    expect(config.minSparkMinutes).toBe(3);
    expect(config.maxSparkMinutes).toBe(25);
  });

  it('should handle partial limits', () => {
    const gen = createSparkGeneratorFromLimits({ maxEscalationLevel: 4 });
    expect(gen.getMaxEscalationLevel()).toBe(4);
  });

  it('should handle empty limits', () => {
    const gen = createSparkGeneratorFromLimits({});
    expect(gen.getConfig()).toEqual(DEFAULT_SPARK_GENERATION_CONFIG);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// STANDALONE FUNCTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('generateSparkForStep', () => {
  it('should generate spark without instantiating class', async () => {
    const step = createTestStep();
    const result = await generateSparkForStep(step, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.variant).toBe('full');
  });

  it('should accept custom config', async () => {
    const step = createTestStep();
    const result = await generateSparkForStep(step, 0, { maxSparkMinutes: 15 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.estimatedMinutes).toBeLessThanOrEqual(15);
  });
});

describe('generateSparkVariants', () => {
  it('should generate all variant sparks', async () => {
    const step = createTestStep();
    const result = await generateSparkVariants(step);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sparks = result.value;
    expect(sparks).toHaveLength(4); // levels 0, 1, 2, 3

    expect(sparks[0]!.variant).toBe('full');
    expect(sparks[1]!.variant).toBe('reduced');
    expect(sparks[2]!.variant).toBe('minimal');
    expect(sparks[3]!.variant).toBe('minimal');

    expect(sparks[0]!.escalationLevel).toBe(0);
    expect(sparks[1]!.escalationLevel).toBe(1);
    expect(sparks[2]!.escalationLevel).toBe(2);
    expect(sparks[3]!.escalationLevel).toBe(3);
  });

  it('should respect custom max level', async () => {
    const step = createTestStep();
    const result = await generateSparkVariants(step, { maxEscalationLevel: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2); // levels 0, 1
  });

  it('should generate unique IDs for each variant', async () => {
    const step = createTestStep();
    const result = await generateSparkVariants(step);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.value.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// URL SANITIZATION IN GENERATOR TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('SparkGenerator URL handling', () => {
  it('should reject javascript: URLs and not include in spark', async () => {
    const resource = createTestResource('res-1', 'Malicious', 'javascript:alert(1)');
    const activity = createTestActivity('res-1');
    const step = createTestStep({
      activities: [activity],
      resources: [resource],
    });

    const gen = new SparkGenerator({ includeResourceUrls: true });
    const result = await gen.generateSpark(step, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // URL should not be included when unsafe
    expect(result.value.resourceUrl).toBeUndefined();
  });

  it('should not include URL when includeResourceUrls is false', async () => {
    const step = createTestStep();
    const gen = new SparkGenerator({ includeResourceUrls: false });
    const result = await gen.generateSpark(step, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Action should not contain URL in parentheses
    expect(result.value.action).not.toContain('(https://');
  });
});
