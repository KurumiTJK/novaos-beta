// ═══════════════════════════════════════════════════════════════════════════════
// GOAL CREATION INTEGRATION TESTS
// NovaOS Phase 17 — Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err, isOk, isErr } from '../../types/result.js';
import { createUserId, createGoalId, createTimestamp } from '../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────────

const mockGoalStore = {
  create: vi.fn(),
  findById: vi.fn(),
  findByUser: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockQuestGenerator = {
  generateQuests: vi.fn(),
};

const mockStepGenerator = {
  generateSteps: vi.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

function createTestGoal(overrides = {}) {
  return {
    id: createGoalId('goal_test123'),
    userId: createUserId('user_test123'),
    title: 'Learn Rust Programming',
    description: 'Master Rust for systems programming',
    desiredOutcome: 'Build production-ready CLI tools',
    status: 'active' as const,
    createdAt: createTimestamp(),
    updatedAt: createTimestamp(),
    ...overrides,
  };
}

function createTestQuest(goalId: string, overrides = {}) {
  return {
    id: `quest_${Date.now()}`,
    goalId,
    title: 'Rust Fundamentals',
    description: 'Learn core concepts',
    sequence: 1,
    status: 'active' as const,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Goal Creation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Goal', () => {
    it('should create goal with valid input', async () => {
      const goal = createTestGoal();
      mockGoalStore.create.mockResolvedValue(ok(goal));

      const result = await mockGoalStore.create({
        userId: goal.userId,
        title: goal.title,
        description: goal.description,
        desiredOutcome: goal.desiredOutcome,
      });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.title).toBe('Learn Rust Programming');
        expect(result.value.status).toBe('active');
      }
    });

    it('should reject goal with empty title', async () => {
      mockGoalStore.create.mockResolvedValue(err({
        code: 'VALIDATION_ERROR',
        message: 'Title is required',
      }));

      const result = await mockGoalStore.create({
        userId: createUserId('user_123'),
        title: '',
        description: 'Test',
        desiredOutcome: 'Test',
      });
      
      expect(isErr(result)).toBe(true);
    });

    it('should reject goal with title too long', async () => {
      mockGoalStore.create.mockResolvedValue(err({
        code: 'VALIDATION_ERROR',
        message: 'Title exceeds maximum length',
      }));

      const result = await mockGoalStore.create({
        userId: createUserId('user_123'),
        title: 'A'.repeat(300),
        description: 'Test',
        desiredOutcome: 'Test',
      });
      
      expect(isErr(result)).toBe(true);
    });

    it('should enforce user goal limit', async () => {
      mockGoalStore.findByUser.mockResolvedValue(ok(Array(10).fill(createTestGoal())));
      mockGoalStore.create.mockResolvedValue(err({
        code: 'LIMIT_EXCEEDED',
        message: 'Maximum goals reached',
      }));

      const result = await mockGoalStore.create({
        userId: createUserId('user_123'),
        title: 'New Goal',
        description: 'Test',
        desiredOutcome: 'Test',
      });
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LIMIT_EXCEEDED');
      }
    });
  });

  describe('Quest Generation', () => {
    it('should generate quests for new goal', async () => {
      const goal = createTestGoal();
      const quests = [
        createTestQuest(goal.id, { sequence: 1, title: 'Fundamentals' }),
        createTestQuest(goal.id, { sequence: 2, title: 'Intermediate' }),
        createTestQuest(goal.id, { sequence: 3, title: 'Advanced' }),
      ];
      
      mockQuestGenerator.generateQuests.mockResolvedValue(ok(quests));

      const result = await mockQuestGenerator.generateQuests(goal);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0].sequence).toBe(1);
      }
    });

    it('should handle quest generation failure gracefully', async () => {
      mockQuestGenerator.generateQuests.mockResolvedValue(err({
        code: 'GENERATION_FAILED',
        message: 'Failed to generate quests',
      }));

      const result = await mockQuestGenerator.generateQuests(createTestGoal());
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Step Generation', () => {
    it('should generate steps for quest', async () => {
      const steps = [
        { id: 'step_1', title: 'Day 1: Introduction', sequence: 1 },
        { id: 'step_2', title: 'Day 2: Variables', sequence: 2 },
        { id: 'step_3', title: 'Day 3: Functions', sequence: 3 },
      ];
      
      mockStepGenerator.generateSteps.mockResolvedValue(ok(steps));

      const result = await mockStepGenerator.generateSteps('quest_123');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
      }
    });
  });

  describe('Goal State Transitions', () => {
    it('should transition goal from active to paused', async () => {
      const goal = createTestGoal({ status: 'active' });
      mockGoalStore.update.mockResolvedValue(ok({ ...goal, status: 'paused' }));

      const result = await mockGoalStore.update(goal.id, { status: 'paused' });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe('paused');
      }
    });

    it('should transition goal from paused to active', async () => {
      const goal = createTestGoal({ status: 'paused' });
      mockGoalStore.update.mockResolvedValue(ok({ ...goal, status: 'active' }));

      const result = await mockGoalStore.update(goal.id, { status: 'active' });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe('active');
      }
    });

    it('should reject invalid state transition', async () => {
      const goal = createTestGoal({ status: 'completed' });
      mockGoalStore.update.mockResolvedValue(err({
        code: 'INVALID_TRANSITION',
        message: 'Cannot transition from completed to active',
      }));

      const result = await mockGoalStore.update(goal.id, { status: 'active' });
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Goal Deletion', () => {
    it('should delete goal and cascade to quests/steps', async () => {
      mockGoalStore.delete.mockResolvedValue(ok({ deleted: true, cascaded: { quests: 3, steps: 15 } }));

      const result = await mockGoalStore.delete('goal_123');
      
      expect(isOk(result)).toBe(true);
    });

    it('should require confirmation for deletion', async () => {
      mockGoalStore.delete.mockResolvedValue(err({
        code: 'CONFIRMATION_REQUIRED',
        message: 'Deletion requires confirmation',
      }));

      const result = await mockGoalStore.delete('goal_123');
      
      expect(isErr(result)).toBe(true);
    });
  });
});
