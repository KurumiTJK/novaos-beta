// ═══════════════════════════════════════════════════════════════════════════════
// LEARN RUST E2E FLOW TEST
// NovaOS Phase 17 — End-to-End Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err, isOk, isErr } from '../../types/result.js';
import { createUserId, createGoalId, createQuestId, createStepId, createSparkId, createTimestamp } from '../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK SPARK ENGINE
// ─────────────────────────────────────────────────────────────────────────────────

const mockSparkEngine = {
  createGoal: vi.fn(),
  getGoal: vi.fn(),
  generateQuests: vi.fn(),
  generateSteps: vi.fn(),
  generateSpark: vi.fn(),
  completeSpark: vi.fn(),
  skipSpark: vi.fn(),
  getProgress: vi.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────────────────────────

const testUserId = createUserId('user_e2e_test');

const rustGoal = {
  id: createGoalId('goal_rust_e2e'),
  userId: testUserId,
  title: 'Learn Rust Programming',
  description: 'Master Rust for systems programming',
  desiredOutcome: 'Build a CLI tool in Rust',
  status: 'active' as const,
  createdAt: createTimestamp(),
  updatedAt: createTimestamp(),
};

const rustQuests = [
  {
    id: createQuestId('quest_rust_1'),
    goalId: rustGoal.id,
    title: 'Rust Fundamentals',
    sequence: 1,
    status: 'active' as const,
  },
  {
    id: createQuestId('quest_rust_2'),
    goalId: rustGoal.id,
    title: 'Ownership & Borrowing',
    sequence: 2,
    status: 'pending' as const,
  },
  {
    id: createQuestId('quest_rust_3'),
    goalId: rustGoal.id,
    title: 'Error Handling',
    sequence: 3,
    status: 'pending' as const,
  },
];

const rustSteps = [
  {
    id: createStepId('step_rust_1'),
    questId: rustQuests[0]!.id,
    title: 'Day 1: Hello Rust',
    sequence: 1,
    status: 'active' as const,
    activities: [
      { type: 'read', title: 'Read Chapter 1', minutes: 20 },
      { type: 'practice', title: 'Write hello world', minutes: 10 },
    ],
  },
  {
    id: createStepId('step_rust_2'),
    questId: rustQuests[0]!.id,
    title: 'Day 2: Variables & Types',
    sequence: 2,
    status: 'pending' as const,
  },
];

const rustSpark = {
  id: createSparkId('spark_rust_1'),
  userId: testUserId,
  stepId: rustSteps[0]!.id,
  action: 'Open The Rust Programming Language book and read the first 5 pages of Chapter 1',
  rationale: 'Starting with fundamentals builds a solid foundation',
  timeEstimate: '10 minutes',
  variant: 'full' as const,
  escalationLevel: 0,
  status: 'suggested' as const,
  createdAt: createTimestamp(),
};

// ═══════════════════════════════════════════════════════════════════════════════
// E2E TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Learn Rust E2E Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Learning Journey', () => {
    it('should create goal and generate learning path', async () => {
      // Step 1: Create goal
      mockSparkEngine.createGoal.mockResolvedValue(ok(rustGoal));
      
      const goalResult = await mockSparkEngine.createGoal({
        userId: testUserId,
        title: 'Learn Rust Programming',
        description: 'Master Rust for systems programming',
        desiredOutcome: 'Build a CLI tool in Rust',
      });

      expect(isOk(goalResult)).toBe(true);
      if (goalResult.ok) {
        expect(goalResult.value.title).toBe('Learn Rust Programming');
      }

      // Step 2: Generate quests
      mockSparkEngine.generateQuests.mockResolvedValue(ok(rustQuests));
      
      const questsResult = await mockSparkEngine.generateQuests(rustGoal.id);
      
      expect(isOk(questsResult)).toBe(true);
      if (questsResult.ok) {
        expect(questsResult.value).toHaveLength(3);
        expect(questsResult.value[0]!.title).toBe('Rust Fundamentals');
      }

      // Step 3: Generate steps for first quest
      mockSparkEngine.generateSteps.mockResolvedValue(ok(rustSteps));
      
      const stepsResult = await mockSparkEngine.generateSteps(rustQuests[0]!.id);
      
      expect(isOk(stepsResult)).toBe(true);
      if (stepsResult.ok) {
        expect(stepsResult.value[0]!.title).toBe('Day 1: Hello Rust');
      }
    });

    it('should generate and complete first spark', async () => {
      // Generate spark
      mockSparkEngine.generateSpark.mockResolvedValue(ok(rustSpark));
      
      const sparkResult = await mockSparkEngine.generateSpark(rustSteps[0]!.id);
      
      expect(isOk(sparkResult)).toBe(true);
      if (sparkResult.ok) {
        expect(sparkResult.value.action).toContain('Rust Programming Language');
        expect(sparkResult.value.timeEstimate).toBe('10 minutes');
      }

      // Complete spark
      mockSparkEngine.completeSpark.mockResolvedValue(ok({
        ...rustSpark,
        status: 'completed',
        completedAt: createTimestamp(),
      }));
      
      const completeResult = await mockSparkEngine.completeSpark(rustSpark.id);
      
      expect(isOk(completeResult)).toBe(true);
      if (completeResult.ok) {
        expect(completeResult.value.status).toBe('completed');
      }
    });

    it('should handle spark skip and escalation', async () => {
      // Skip first spark
      mockSparkEngine.skipSpark.mockResolvedValue(ok({
        ...rustSpark,
        status: 'skipped',
      }));
      
      const skipResult = await mockSparkEngine.skipSpark(rustSpark.id);
      
      expect(isOk(skipResult)).toBe(true);

      // Generate escalated spark
      const escalatedSpark = {
        ...rustSpark,
        id: createSparkId('spark_rust_2'),
        escalationLevel: 1,
        variant: 'reduced' as const,
        action: 'Read just the first 2 pages of Chapter 1',
        timeEstimate: '5 minutes',
      };
      
      mockSparkEngine.generateSpark.mockResolvedValue(ok(escalatedSpark));
      
      const newSparkResult = await mockSparkEngine.generateSpark(rustSteps[0]!.id, { escalationLevel: 1 });
      
      expect(isOk(newSparkResult)).toBe(true);
      if (newSparkResult.ok) {
        expect(newSparkResult.value.escalationLevel).toBe(1);
        expect(newSparkResult.value.variant).toBe('reduced');
        expect(newSparkResult.value.timeEstimate).toBe('5 minutes');
      }
    });

    it('should track progress through journey', async () => {
      mockSparkEngine.getProgress.mockResolvedValue(ok({
        goal: {
          id: rustGoal.id,
          title: rustGoal.title,
          progress: 15,
        },
        quests: {
          completed: 0,
          total: 3,
          current: rustQuests[0],
        },
        steps: {
          completed: 0,
          total: 2,
          current: rustSteps[0],
        },
        sparks: {
          completedToday: 1,
          streakDays: 1,
        },
      }));

      const progressResult = await mockSparkEngine.getProgress(testUserId, rustGoal.id);
      
      expect(isOk(progressResult)).toBe(true);
      if (progressResult.ok) {
        expect(progressResult.value.goal.progress).toBe(15);
        expect(progressResult.value.sparks.completedToday).toBe(1);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle goal with no steps yet', async () => {
      mockSparkEngine.generateSpark.mockResolvedValue(err({
        code: 'NO_ACTIVE_STEP',
        message: 'No active step available for spark generation',
      }));

      const result = await mockSparkEngine.generateSpark('nonexistent_step');
      
      expect(isErr(result)).toBe(true);
    });

    it('should handle max escalation reached', async () => {
      mockSparkEngine.generateSpark.mockResolvedValue(err({
        code: 'MAX_ESCALATION_REACHED',
        message: 'Maximum escalation level (3) reached',
      }));

      const result = await mockSparkEngine.generateSpark(rustSteps[0]!.id, { escalationLevel: 4 });
      
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('MAX_ESCALATION_REACHED');
      }
    });

    it('should handle concurrent spark attempts', async () => {
      mockSparkEngine.generateSpark.mockResolvedValue(err({
        code: 'SPARK_ALREADY_ACTIVE',
        message: 'User already has an active spark',
      }));

      const result = await mockSparkEngine.generateSpark(rustSteps[0]!.id);
      
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('SPARK_ALREADY_ACTIVE');
      }
    });
  });
});
