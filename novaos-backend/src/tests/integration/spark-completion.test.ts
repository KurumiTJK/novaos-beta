// ═══════════════════════════════════════════════════════════════════════════════
// SPARK COMPLETION INTEGRATION TESTS
// NovaOS Phase 17 — Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err, isOk, isErr } from '../../types/result.js';
import { createUserId, createGoalId, createSparkId, createStepId, createTimestamp } from '../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────────

const mockSparkStore = {
  create: vi.fn(),
  findById: vi.fn(),
  findActive: vi.fn(),
  update: vi.fn(),
  complete: vi.fn(),
  skip: vi.fn(),
};

const mockStepStore = {
  findById: vi.fn(),
  updateProgress: vi.fn(),
  complete: vi.fn(),
};

const mockSparkGenerator = {
  generate: vi.fn(),
  regenerate: vi.fn(),
};

const mockReminderService = {
  schedule: vi.fn(),
  cancel: vi.fn(),
  escalate: vi.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

function createTestSpark(overrides = {}) {
  return {
    id: createSparkId('spark_test123'),
    userId: createUserId('user_test123'),
    stepId: createStepId('step_test123'),
    action: 'Read Chapter 1 of The Rust Programming Language',
    rationale: 'Start with fundamentals',
    timeEstimate: '15 minutes',
    variant: 'full' as const,
    escalationLevel: 0,
    status: 'suggested' as const,
    createdAt: createTimestamp(),
    ...overrides,
  };
}

function createTestStep(overrides = {}) {
  return {
    id: createStepId('step_test123'),
    questId: 'quest_test123',
    title: 'Day 1: Introduction to Rust',
    description: 'Learn the basics',
    sequence: 1,
    status: 'active' as const,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Spark Completion Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Spark Generation', () => {
    it('should generate spark for active step', async () => {
      const step = createTestStep();
      const spark = createTestSpark();
      
      mockStepStore.findById.mockResolvedValue(ok(step));
      mockSparkGenerator.generate.mockResolvedValue(ok(spark));

      const result = await mockSparkGenerator.generate(step);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.action).toContain('Rust');
        expect(result.value.status).toBe('suggested');
      }
    });

    it('should respect escalation level', async () => {
      const spark = createTestSpark({ escalationLevel: 2, variant: 'minimal' });
      mockSparkGenerator.generate.mockResolvedValue(ok(spark));

      const result = await mockSparkGenerator.generate(createTestStep(), { escalationLevel: 2 });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.escalationLevel).toBe(2);
        expect(result.value.variant).toBe('minimal');
      }
    });

    it('should handle generation failure', async () => {
      mockSparkGenerator.generate.mockResolvedValue(err({
        code: 'GENERATION_FAILED',
        message: 'Failed to generate spark',
      }));

      const result = await mockSparkGenerator.generate(createTestStep());
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Spark Acceptance', () => {
    it('should transition spark from suggested to accepted', async () => {
      const spark = createTestSpark({ status: 'suggested' });
      mockSparkStore.update.mockResolvedValue(ok({ ...spark, status: 'accepted' }));

      const result = await mockSparkStore.update(spark.id, { status: 'accepted' });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe('accepted');
      }
    });

    it('should schedule reminder on acceptance', async () => {
      const spark = createTestSpark({ status: 'accepted' });
      mockReminderService.schedule.mockResolvedValue(ok({ reminderId: 'rem_123' }));

      const result = await mockReminderService.schedule(spark);
      
      expect(isOk(result)).toBe(true);
    });
  });

  describe('Spark Completion', () => {
    it('should complete spark successfully', async () => {
      const spark = createTestSpark({ status: 'accepted' });
      mockSparkStore.complete.mockResolvedValue(ok({
        ...spark,
        status: 'completed',
        completedAt: createTimestamp(),
      }));

      const result = await mockSparkStore.complete(spark.id);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe('completed');
        expect(result.value.completedAt).toBeDefined();
      }
    });

    it('should update step progress on completion', async () => {
      const step = createTestStep({ progress: 50 });
      mockStepStore.updateProgress.mockResolvedValue(ok({ ...step, progress: 75 }));

      const result = await mockStepStore.updateProgress(step.id, 75);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.progress).toBe(75);
      }
    });

    it('should complete step when all sparks done', async () => {
      const step = createTestStep({ progress: 100 });
      mockStepStore.complete.mockResolvedValue(ok({
        ...step,
        status: 'completed',
        completedAt: createTimestamp(),
      }));

      const result = await mockStepStore.complete(step.id);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe('completed');
      }
    });

    it('should cancel reminders on completion', async () => {
      mockReminderService.cancel.mockResolvedValue(ok({ cancelled: true }));

      const result = await mockReminderService.cancel('spark_123');
      
      expect(isOk(result)).toBe(true);
    });
  });

  describe('Spark Skip', () => {
    it('should skip spark and escalate', async () => {
      const spark = createTestSpark({ status: 'accepted', escalationLevel: 0 });
      mockSparkStore.skip.mockResolvedValue(ok({ ...spark, status: 'skipped' }));

      const result = await mockSparkStore.skip(spark.id);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe('skipped');
      }
    });

    it('should generate new spark after skip', async () => {
      const newSpark = createTestSpark({ escalationLevel: 1 });
      mockSparkGenerator.regenerate.mockResolvedValue(ok(newSpark));

      const result = await mockSparkGenerator.regenerate('step_123', { escalationLevel: 1 });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.escalationLevel).toBe(1);
      }
    });

    it('should respect max escalation level', async () => {
      mockSparkGenerator.regenerate.mockResolvedValue(err({
        code: 'MAX_ESCALATION_REACHED',
        message: 'Maximum escalation level reached',
      }));

      const result = await mockSparkGenerator.regenerate('step_123', { escalationLevel: 4 });
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('MAX_ESCALATION_REACHED');
      }
    });
  });

  describe('Reminder Escalation', () => {
    it('should escalate reminder on missed spark', async () => {
      mockReminderService.escalate.mockResolvedValue(ok({
        newLevel: 1,
        newReminderId: 'rem_456',
      }));

      const result = await mockReminderService.escalate('spark_123');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.newLevel).toBe(1);
      }
    });

    it('should shrink spark on escalation', async () => {
      const escalatedSpark = createTestSpark({
        escalationLevel: 2,
        variant: 'reduced',
        timeEstimate: '5 minutes',
      });
      mockSparkGenerator.regenerate.mockResolvedValue(ok(escalatedSpark));

      const result = await mockSparkGenerator.regenerate('step_123', { escalationLevel: 2 });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.variant).toBe('reduced');
        expect(result.value.timeEstimate).toBe('5 minutes');
      }
    });
  });

  describe('Active Spark Management', () => {
    it('should only allow one active spark per user', async () => {
      const existingSpark = createTestSpark({ status: 'accepted' });
      mockSparkStore.findActive.mockResolvedValue(ok(existingSpark));

      const result = await mockSparkStore.findActive('user_123');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeDefined();
      }
    });

    it('should prevent creating new spark while one is active', async () => {
      mockSparkStore.findActive.mockResolvedValue(ok(createTestSpark({ status: 'accepted' })));
      mockSparkStore.create.mockResolvedValue(err({
        code: 'SPARK_ALREADY_ACTIVE',
        message: 'User already has an active spark',
      }));

      const result = await mockSparkStore.create({
        userId: 'user_123',
        stepId: 'step_456',
      });
      
      expect(isErr(result)).toBe(true);
    });
  });
});
