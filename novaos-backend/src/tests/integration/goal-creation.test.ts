// ═══════════════════════════════════════════════════════════════════════════════
// GOAL CREATION INTEGRATION TESTS — Goal Lifecycle Verification
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tests the complete goal creation flow:
//   - Goal creation with validation
//   - Quest generation from goal
//   - Step generation from quests
//   - Initial spark creation
//   - Reminder scheduling
//   - Goal status transitions
//
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ok, err } from '../../../types/result.js';
import type { AppError, AsyncAppResult } from '../../../types/result.js';
import {
  createGoalId,
  createQuestId,
  createStepId,
  createSparkId,
  createUserId,
  createTimestamp,
  type GoalId,
  type QuestId,
  type StepId,
  type UserId,
} from '../../../types/branded.js';
import type {
  Goal,
  Quest,
  Step,
  Spark,
  ReminderSchedule,
  CreateGoalParams,
  LearningConfig,
  ReminderConfig,
} from '../../../services/spark-engine/types.js';
import {
  createTestGoal,
  createTestQuest,
  createTestStep,
  createTestSpark,
  createDefaultLearningConfig,
  createDefaultReminderConfig,
  createBeginnerLearningConfig,
  createQuestSequence,
  createStepSequence,
  TEST_USERS,
  TEST_USER_IDS,
} from '../../fixtures/index.js';
import {
  createMockRedis,
  createMockLLM,
  resetMockRedis,
  resetMockLLM,
  type MockRedisClient,
  type MockLLMProvider,
} from '../../mocks/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK GOAL SERVICE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mock goal service for testing goal creation flows.
 * Simulates the SparkEngine orchestration.
 */
class MockGoalService {
  private goals = new Map<string, Goal>();
  private quests = new Map<string, Quest>();
  private steps = new Map<string, Step>();
  private sparks = new Map<string, Spark>();
  private reminders = new Map<string, ReminderSchedule>();
  
  constructor(
    private readonly redis: MockRedisClient,
    private readonly llm: MockLLMProvider
  ) {}
  
  /**
   * Create a new goal with full initialization.
   */
  async createGoal(
    userId: UserId,
    params: CreateGoalParams
  ): AsyncAppResult<{
    goal: Goal;
    quests: readonly Quest[];
    steps: readonly Step[];
    spark: Spark | null;
  }> {
    // Validate input
    const validationResult = this.validateCreateGoalParams(params);
    if (!validationResult.ok) {
      return validationResult;
    }
    
    // Check user goal limit
    const userGoals = await this.getGoalsByUser(userId);
    if (userGoals.ok && userGoals.value.length >= 10) {
      return err({
        code: 'QUOTA_EXCEEDED',
        message: 'Maximum 10 active goals allowed',
      });
    }
    
    // Create goal
    const goal: Goal = {
      id: createGoalId(),
      userId,
      title: params.title,
      description: params.description ?? '',
      status: 'active',
      createdAt: createTimestamp(),
      updatedAt: createTimestamp(),
      learningConfig: params.learningConfig ?? createDefaultLearningConfig(),
      reminderConfig: params.reminderConfig ?? createDefaultReminderConfig(),
    };
    
    // Save goal
    this.goals.set(goal.id, goal);
    await this.redis.set(`goal:${goal.id}`, JSON.stringify(goal));
    
    // Generate quests using LLM
    const questsResult = await this.generateQuests(goal);
    if (!questsResult.ok) {
      return err(questsResult.error);
    }
    const quests = questsResult.value;
    
    // Save quests
    for (const quest of quests) {
      this.quests.set(quest.id, quest);
      await this.redis.set(`quest:${quest.id}`, JSON.stringify(quest));
    }
    
    // Generate steps for first quest
    const firstQuest = quests[0];
    let steps: Step[] = [];
    let spark: Spark | null = null;
    
    if (firstQuest) {
      const stepsResult = await this.generateSteps(firstQuest, goal);
      if (stepsResult.ok) {
        steps = [...stepsResult.value];
        
        // Save steps
        for (const step of steps) {
          this.steps.set(step.id, step);
          await this.redis.set(`step:${step.id}`, JSON.stringify(step));
        }
        
        // Create initial spark for first step
        const firstStep = steps[0];
        if (firstStep) {
          const sparkResult = await this.createSpark(firstStep, 0);
          if (sparkResult.ok) {
            spark = sparkResult.value;
            this.sparks.set(spark.id, spark);
            await this.redis.set(`spark:${spark.id}`, JSON.stringify(spark));
          }
        }
      }
    }
    
    return ok({ goal, quests, steps, spark });
  }
  
  /**
   * Get goal by ID.
   */
  async getGoal(goalId: GoalId): AsyncAppResult<Goal | null> {
    const goal = this.goals.get(goalId);
    return ok(goal ?? null);
  }
  
  /**
   * Get goals by user.
   */
  async getGoalsByUser(userId: UserId): AsyncAppResult<readonly Goal[]> {
    const userGoals = Array.from(this.goals.values()).filter(g => g.userId === userId);
    return ok(userGoals);
  }
  
  /**
   * Get quests by goal.
   */
  async getQuestsByGoal(goalId: GoalId): AsyncAppResult<readonly Quest[]> {
    const goalQuests = Array.from(this.quests.values()).filter(q => q.goalId === goalId);
    return ok(goalQuests.sort((a, b) => a.order - b.order));
  }
  
  /**
   * Get steps by quest.
   */
  async getStepsByQuest(questId: QuestId): AsyncAppResult<readonly Step[]> {
    const questSteps = Array.from(this.steps.values()).filter(s => s.questId === questId);
    return ok(questSteps.sort((a, b) => a.order - b.order));
  }
  
  /**
   * Update goal status.
   */
  async updateGoalStatus(
    goalId: GoalId,
    status: Goal['status']
  ): AsyncAppResult<Goal> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return err({ code: 'NOT_FOUND', message: 'Goal not found' });
    }
    
    // Validate transition
    if (!this.isValidStatusTransition(goal.status, status)) {
      return err({
        code: 'INVALID_INPUT',
        message: `Cannot transition from ${goal.status} to ${status}`,
      });
    }
    
    const updated: Goal = {
      ...goal,
      status,
      updatedAt: createTimestamp(),
    };
    
    this.goals.set(goalId, updated);
    await this.redis.set(`goal:${goalId}`, JSON.stringify(updated));
    
    return ok(updated);
  }
  
  /**
   * Delete goal and all related entities.
   */
  async deleteGoal(goalId: GoalId): AsyncAppResult<void> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return err({ code: 'NOT_FOUND', message: 'Goal not found' });
    }
    
    // Delete related quests
    const quests = Array.from(this.quests.values()).filter(q => q.goalId === goalId);
    for (const quest of quests) {
      // Delete related steps
      const steps = Array.from(this.steps.values()).filter(s => s.questId === quest.id);
      for (const step of steps) {
        // Delete related sparks
        const sparks = Array.from(this.sparks.values()).filter(sp => sp.stepId === step.id);
        for (const spark of sparks) {
          this.sparks.delete(spark.id);
          await this.redis.delete(`spark:${spark.id}`);
        }
        this.steps.delete(step.id);
        await this.redis.delete(`step:${step.id}`);
      }
      this.quests.delete(quest.id);
      await this.redis.delete(`quest:${quest.id}`);
    }
    
    // Delete goal
    this.goals.delete(goalId);
    await this.redis.delete(`goal:${goalId}`);
    
    return ok(undefined);
  }
  
  /**
   * Reset state (for tests).
   */
  reset(): void {
    this.goals.clear();
    this.quests.clear();
    this.steps.clear();
    this.sparks.clear();
    this.reminders.clear();
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────
  
  private validateCreateGoalParams(params: CreateGoalParams): AsyncAppResult<void> {
    if (!params.title || params.title.trim().length === 0) {
      return err({ code: 'VALIDATION_ERROR', message: 'Title is required' });
    }
    
    if (params.title.length > 200) {
      return err({ code: 'VALIDATION_ERROR', message: 'Title must be 200 characters or less' });
    }
    
    if (params.description && params.description.length > 2000) {
      return err({ code: 'VALIDATION_ERROR', message: 'Description must be 2000 characters or less' });
    }
    
    if (params.learningConfig) {
      const lc = params.learningConfig;
      if (lc.dailyTimeCommitment < 15 || lc.dailyTimeCommitment > 480) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'Daily time commitment must be between 15 and 480 minutes',
        });
      }
    }
    
    return ok(undefined);
  }
  
  private async generateQuests(goal: Goal): AsyncAppResult<Quest[]> {
    // Use LLM to generate quest structure
    const response = await this.llm.execute({
      messages: [
        { role: 'system', content: 'Generate a learning curriculum structure.' },
        { role: 'user', content: `Create quests for: ${goal.title}` },
      ],
      maxTokens: 1000,
    });
    
    // Parse LLM response (mock returns structured data)
    try {
      const data = JSON.parse(response.content);
      const questData = data.quests ?? [
        { title: 'Week 1: Fundamentals', description: 'Learn the basics', estimatedDays: 7 },
        { title: 'Week 2: Intermediate', description: 'Build on fundamentals', estimatedDays: 7 },
      ];
      
      const quests: Quest[] = questData.map((q: { title: string; description: string; estimatedDays?: number }, i: number) => ({
        id: createQuestId(),
        goalId: goal.id,
        title: q.title,
        description: q.description,
        status: i === 0 ? 'active' : 'pending',
        order: i + 1,
        createdAt: createTimestamp(),
        updatedAt: createTimestamp(),
        estimatedDays: q.estimatedDays ?? 7,
      }));
      
      return ok(quests);
    } catch {
      return err({ code: 'PROVIDER_ERROR', message: 'Failed to parse LLM response' });
    }
  }
  
  private async generateSteps(quest: Quest, goal: Goal): AsyncAppResult<Step[]> {
    // Use LLM to generate steps
    const response = await this.llm.execute({
      messages: [
        { role: 'system', content: 'Generate daily learning steps.' },
        { role: 'user', content: `Create steps for quest: ${quest.title}` },
      ],
      maxTokens: 1000,
    });
    
    try {
      const data = JSON.parse(response.content);
      const dayData = data.days ?? [
        { day: 1, theme: 'Introduction', totalMinutes: 60 },
        { day: 2, theme: 'Core Concepts', totalMinutes: 60 },
        { day: 3, theme: 'Practice', totalMinutes: 45 },
      ];
      
      const today = new Date();
      const steps: Step[] = dayData.map((d: { day: number; theme: string; totalMinutes?: number; objective?: string }, i: number) => {
        const stepDate = new Date(today);
        stepDate.setDate(stepDate.getDate() + i);
        
        return {
          id: createStepId(),
          questId: quest.id,
          title: `Day ${d.day}: ${d.theme}`,
          description: d.objective ?? `Learn about ${d.theme}`,
          status: i === 0 ? 'active' : 'pending',
          order: i + 1,
          dayNumber: d.day,
          scheduledDate: stepDate.toISOString().split('T')[0],
          createdAt: createTimestamp(),
          updatedAt: createTimestamp(),
          estimatedMinutes: d.totalMinutes ?? 60,
        };
      });
      
      return ok(steps);
    } catch {
      return err({ code: 'PROVIDER_ERROR', message: 'Failed to generate steps' });
    }
  }
  
  private async createSpark(step: Step, escalationLevel: number): AsyncAppResult<Spark> {
    const variants = ['full', 'full', 'reduced', 'minimal'] as const;
    const variant = variants[Math.min(escalationLevel, 3)];
    
    const spark: Spark = {
      id: createSparkId(),
      stepId: step.id,
      action: `Start working on: ${step.title}`,
      status: 'pending',
      createdAt: createTimestamp(),
      updatedAt: createTimestamp(),
      variant,
      escalationLevel,
      estimatedMinutes: Math.max(5, Math.floor((step.estimatedMinutes ?? 60) / 4)),
    };
    
    return ok(spark);
  }
  
  private isValidStatusTransition(from: Goal['status'], to: Goal['status']): boolean {
    const transitions: Record<Goal['status'], Goal['status'][]> = {
      active: ['paused', 'completed', 'abandoned'],
      paused: ['active', 'abandoned'],
      completed: [], // Terminal state
      abandoned: [], // Terminal state
    };
    
    return transitions[from]?.includes(to) ?? false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Goal Creation Integration', () => {
  let redis: MockRedisClient;
  let llm: MockLLMProvider;
  let goalService: MockGoalService;
  
  beforeEach(() => {
    redis = createMockRedis();
    llm = createMockLLM();
    goalService = new MockGoalService(redis, llm);
    
    // Set up default LLM responses
    llm.setDefaultResponse({
      handler: (req) => {
        const prompt = req.messages.find(m => m.role === 'user')?.content ?? '';
        
        if (prompt.includes('quest')) {
          return {
            content: JSON.stringify({
              quests: [
                { title: 'Week 1: Basics', description: 'Learn fundamentals', estimatedDays: 7 },
                { title: 'Week 2: Practice', description: 'Apply knowledge', estimatedDays: 7 },
              ],
            }),
            finishReason: 'stop',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            model: 'mock-v1',
          };
        }
        
        if (prompt.includes('step')) {
          return {
            content: JSON.stringify({
              days: [
                { day: 1, theme: 'Introduction', totalMinutes: 45 },
                { day: 2, theme: 'Core Concepts', totalMinutes: 60 },
                { day: 3, theme: 'Exercises', totalMinutes: 30 },
              ],
            }),
            finishReason: 'stop',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            model: 'mock-v1',
          };
        }
        
        return {
          content: '{}',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'mock-v1',
        };
      },
    });
  });
  
  afterEach(() => {
    goalService.reset();
    redis.reset();
    llm.reset();
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Basic Goal Creation
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Basic Goal Creation', () => {
    it('creates goal with title only', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Rust',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.goal.title).toBe('Learn Rust');
        expect(result.value.goal.status).toBe('active');
        expect(result.value.goal.userId).toBe(TEST_USER_IDS.alice);
      }
    });
    
    it('creates goal with full parameters', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Master TypeScript',
        description: 'Learn TypeScript from basics to advanced patterns',
        learningConfig: createBeginnerLearningConfig(),
        reminderConfig: createDefaultReminderConfig(),
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.goal.title).toBe('Master TypeScript');
        expect(result.value.goal.description).toBe('Learn TypeScript from basics to advanced patterns');
        expect(result.value.goal.learningConfig?.userLevel).toBe('beginner');
      }
    });
    
    it('generates unique goal ID', async () => {
      const result1 = await goalService.createGoal(TEST_USER_IDS.alice, { title: 'Goal 1' });
      const result2 = await goalService.createGoal(TEST_USER_IDS.alice, { title: 'Goal 2' });
      
      expect(result1.ok && result2.ok).toBe(true);
      if (result1.ok && result2.ok) {
        expect(result1.value.goal.id).not.toBe(result2.value.goal.id);
      }
    });
    
    it('sets timestamps on creation', async () => {
      const before = Date.now();
      const result = await goalService.createGoal(TEST_USER_IDS.alice, { title: 'Test' });
      const after = Date.now();
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        const createdAt = new Date(result.value.goal.createdAt).getTime();
        expect(createdAt).toBeGreaterThanOrEqual(before);
        expect(createdAt).toBeLessThanOrEqual(after);
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Quest Generation
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Quest Generation', () => {
    it('generates quests for new goal', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Python',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.quests.length).toBeGreaterThan(0);
      }
    });
    
    it('first quest is active, others pending', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Go',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.quests[0]?.status).toBe('active');
        if (result.value.quests.length > 1) {
          expect(result.value.quests[1]?.status).toBe('pending');
        }
      }
    });
    
    it('quests have correct order', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Java',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        const orders = result.value.quests.map(q => q.order);
        expect(orders).toEqual([1, 2]); // Based on mock response
      }
    });
    
    it('quests are linked to goal', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn C++',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        const goalId = result.value.goal.id;
        for (const quest of result.value.quests) {
          expect(quest.goalId).toBe(goalId);
        }
      }
    });
    
    it('uses LLM for quest generation', async () => {
      await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Haskell',
      });
      
      expect(llm.getCallCount()).toBeGreaterThan(0);
      expect(llm.wasCalledWith('quest')).toBe(true);
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Step Generation
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Step Generation', () => {
    it('generates steps for first quest', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Ruby',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.steps.length).toBeGreaterThan(0);
      }
    });
    
    it('steps have scheduled dates', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Elixir',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const step of result.value.steps) {
          expect(step.scheduledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    });
    
    it('first step is scheduled for today', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Scala',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok && result.value.steps.length > 0) {
        expect(result.value.steps[0]?.scheduledDate).toBe(today);
      }
    });
    
    it('steps are linked to quest', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Kotlin',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok && result.value.quests.length > 0) {
        const questId = result.value.quests[0]!.id;
        for (const step of result.value.steps) {
          expect(step.questId).toBe(questId);
        }
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Spark Creation
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Initial Spark Creation', () => {
    it('creates initial spark for first step', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Swift',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.spark).not.toBeNull();
      }
    });
    
    it('initial spark has escalation level 0', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Dart',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok && result.value.spark) {
        expect(result.value.spark.escalationLevel).toBe(0);
      }
    });
    
    it('initial spark has full variant', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn Clojure',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok && result.value.spark) {
        expect(result.value.spark.variant).toBe('full');
      }
    });
    
    it('spark is linked to first step', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Learn F#',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok && result.value.spark && result.value.steps.length > 0) {
        expect(result.value.spark.stepId).toBe(result.value.steps[0]!.id);
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Input Validation', () => {
    it('rejects empty title', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: '',
      });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
    
    it('rejects whitespace-only title', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: '   ',
      });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
    
    it('rejects title over 200 characters', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'A'.repeat(201),
      });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
    
    it('rejects description over 2000 characters', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Valid Title',
        description: 'A'.repeat(2001),
      });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
    
    it('rejects invalid daily time commitment', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Valid Title',
        learningConfig: {
          ...createDefaultLearningConfig(),
          dailyTimeCommitment: 10, // Too low
        },
      });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Goal Retrieval
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Goal Retrieval', () => {
    it('retrieves goal by ID', async () => {
      const createResult = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Retrievable Goal',
      });
      
      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const getResult = await goalService.getGoal(createResult.value.goal.id);
        
        expect(getResult.ok).toBe(true);
        if (getResult.ok) {
          expect(getResult.value).not.toBeNull();
          expect(getResult.value!.title).toBe('Retrievable Goal');
        }
      }
    });
    
    it('returns null for non-existent goal', async () => {
      const result = await goalService.getGoal(createGoalId());
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
    
    it('retrieves goals by user', async () => {
      await goalService.createGoal(TEST_USER_IDS.alice, { title: 'Goal 1' });
      await goalService.createGoal(TEST_USER_IDS.alice, { title: 'Goal 2' });
      await goalService.createGoal(TEST_USER_IDS.bob, { title: 'Bob Goal' });
      
      const result = await goalService.getGoalsByUser(TEST_USER_IDS.alice);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
        expect(result.value.every(g => g.userId === TEST_USER_IDS.alice)).toBe(true);
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Goal Status Transitions
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Goal Status Transitions', () => {
    it('pauses active goal', async () => {
      const createResult = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Pausable Goal',
      });
      
      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const pauseResult = await goalService.updateGoalStatus(
          createResult.value.goal.id,
          'paused'
        );
        
        expect(pauseResult.ok).toBe(true);
        if (pauseResult.ok) {
          expect(pauseResult.value.status).toBe('paused');
        }
      }
    });
    
    it('resumes paused goal', async () => {
      const createResult = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Resumable Goal',
      });
      
      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        await goalService.updateGoalStatus(createResult.value.goal.id, 'paused');
        const resumeResult = await goalService.updateGoalStatus(
          createResult.value.goal.id,
          'active'
        );
        
        expect(resumeResult.ok).toBe(true);
        if (resumeResult.ok) {
          expect(resumeResult.value.status).toBe('active');
        }
      }
    });
    
    it('completes active goal', async () => {
      const createResult = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Completable Goal',
      });
      
      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const completeResult = await goalService.updateGoalStatus(
          createResult.value.goal.id,
          'completed'
        );
        
        expect(completeResult.ok).toBe(true);
        if (completeResult.ok) {
          expect(completeResult.value.status).toBe('completed');
        }
      }
    });
    
    it('rejects invalid status transition', async () => {
      const createResult = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Completed Goal',
      });
      
      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        await goalService.updateGoalStatus(createResult.value.goal.id, 'completed');
        
        // Cannot transition from completed to active
        const invalidResult = await goalService.updateGoalStatus(
          createResult.value.goal.id,
          'active'
        );
        
        expect(invalidResult.ok).toBe(false);
        if (!invalidResult.ok) {
          expect(invalidResult.error.code).toBe('INVALID_INPUT');
        }
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Goal Deletion
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Goal Deletion', () => {
    it('deletes goal and related entities', async () => {
      const createResult = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Deletable Goal',
      });
      
      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const goalId = createResult.value.goal.id;
        
        const deleteResult = await goalService.deleteGoal(goalId);
        expect(deleteResult.ok).toBe(true);
        
        // Goal should be gone
        const getResult = await goalService.getGoal(goalId);
        expect(getResult.ok).toBe(true);
        if (getResult.ok) {
          expect(getResult.value).toBeNull();
        }
        
        // Quests should be gone
        const questsResult = await goalService.getQuestsByGoal(goalId);
        expect(questsResult.ok).toBe(true);
        if (questsResult.ok) {
          expect(questsResult.value.length).toBe(0);
        }
      }
    });
    
    it('returns error for non-existent goal', async () => {
      const result = await goalService.deleteGoal(createGoalId());
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Quota Enforcement
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Quota Enforcement', () => {
    it('enforces maximum goals per user', async () => {
      // Create 10 goals (the limit)
      for (let i = 0; i < 10; i++) {
        const result = await goalService.createGoal(TEST_USER_IDS.alice, {
          title: `Goal ${i + 1}`,
        });
        expect(result.ok).toBe(true);
      }
      
      // 11th goal should fail
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Goal 11',
      });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('QUOTA_EXCEEDED');
      }
    });
    
    it('quota is per-user', async () => {
      // Create 10 goals for Alice
      for (let i = 0; i < 10; i++) {
        await goalService.createGoal(TEST_USER_IDS.alice, { title: `Alice Goal ${i}` });
      }
      
      // Bob can still create goals
      const result = await goalService.createGoal(TEST_USER_IDS.bob, {
        title: 'Bob Goal',
      });
      
      expect(result.ok).toBe(true);
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Redis Persistence
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Redis Persistence', () => {
    it('persists goal to Redis', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Persisted Goal',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        const redisData = await redis.get(`goal:${result.value.goal.id}`);
        expect(redisData).not.toBeNull();
        
        const parsed = JSON.parse(redisData!);
        expect(parsed.title).toBe('Persisted Goal');
      }
    });
    
    it('persists quests to Redis', async () => {
      const result = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Goal with Quests',
      });
      
      expect(result.ok).toBe(true);
      if (result.ok && result.value.quests.length > 0) {
        const questId = result.value.quests[0]!.id;
        const redisData = await redis.get(`quest:${questId}`);
        expect(redisData).not.toBeNull();
      }
    });
    
    it('removes from Redis on delete', async () => {
      const createResult = await goalService.createGoal(TEST_USER_IDS.alice, {
        title: 'Deletable Goal',
      });
      
      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const goalId = createResult.value.goal.id;
        
        await goalService.deleteGoal(goalId);
        
        const redisData = await redis.get(`goal:${goalId}`);
        expect(redisData).toBeNull();
      }
    });
  });
});
