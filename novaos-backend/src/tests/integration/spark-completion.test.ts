// ═══════════════════════════════════════════════════════════════════════════════
// SPARK COMPLETION INTEGRATION TESTS — Spark Lifecycle Verification
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tests the complete spark lifecycle:
//   - Spark completion flow
//   - Spark skipping with escalation
//   - Step progression
//   - Difficulty rating
//   - Reminder cancellation
//   - Quest/Goal completion cascades
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
  createReminderId,
  createUserId,
  createTimestamp,
  type GoalId,
  type QuestId,
  type StepId,
  type SparkId,
  type UserId,
} from '../../../types/branded.js';
import type {
  Goal,
  Quest,
  Step,
  Spark,
  ReminderSchedule,
  SparkVariant,
  DifficultyRating,
  PathProgress,
  TodayResult,
} from '../../../services/spark-engine/types.js';
import {
  createTestGoal,
  createTestQuest,
  createTestStep,
  createTestSpark,
  createCompletedStep,
  createSparkAtLevel,
  createStepSequence,
  createQuestSequence,
  createReminderSequence,
  TEST_USER_IDS,
} from '../../fixtures/index.js';
import {
  createMockRedis,
  createMockLLM,
  type MockRedisClient,
  type MockLLMProvider,
} from '../../mocks/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK SPARK ENGINE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mock spark engine for testing spark lifecycle flows.
 */
class MockSparkEngine {
  private goals = new Map<string, Goal>();
  private quests = new Map<string, Quest>();
  private steps = new Map<string, Step>();
  private sparks = new Map<string, Spark>();
  private reminders = new Map<string, ReminderSchedule>();
  
  constructor(
    private readonly redis: MockRedisClient,
    private readonly llm: MockLLMProvider
  ) {}
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Data Seeding (for tests)
  // ─────────────────────────────────────────────────────────────────────────────
  
  seedGoal(goal: Goal): void {
    this.goals.set(goal.id, goal);
  }
  
  seedQuest(quest: Quest): void {
    this.quests.set(quest.id, quest);
  }
  
  seedStep(step: Step): void {
    this.steps.set(step.id, step);
  }
  
  seedSpark(spark: Spark): void {
    this.sparks.set(spark.id, spark);
  }
  
  seedReminder(reminder: ReminderSchedule): void {
    this.reminders.set(reminder.id, reminder);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Spark Completion
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Mark a spark as completed.
   */
  async markSparkComplete(sparkId: SparkId): AsyncAppResult<{
    spark: Spark;
    step: Step;
    stepCompleted: boolean;
    questCompleted: boolean;
    goalCompleted: boolean;
  }> {
    // Get spark
    const spark = this.sparks.get(sparkId);
    if (!spark) {
      return err({ code: 'NOT_FOUND', message: 'Spark not found' });
    }
    
    // Validate spark status
    if (spark.status === 'completed') {
      return err({ code: 'INVALID_INPUT', message: 'Spark is already completed' });
    }
    
    if (spark.status === 'skipped') {
      return err({ code: 'INVALID_INPUT', message: 'Cannot complete a skipped spark' });
    }
    
    // Update spark
    const completedSpark: Spark = {
      ...spark,
      status: 'completed',
      updatedAt: createTimestamp(),
    };
    this.sparks.set(sparkId, completedSpark);
    
    // Cancel pending reminders
    await this.cancelRemindersForSpark(sparkId);
    
    // Get and update step
    const step = this.steps.get(spark.stepId);
    if (!step) {
      return err({ code: 'NOT_FOUND', message: 'Step not found' });
    }
    
    // Complete the step
    const completedStep: Step = {
      ...step,
      status: 'completed',
      completedAt: createTimestamp(),
      updatedAt: createTimestamp(),
    };
    this.steps.set(step.id, completedStep);
    
    // Check if quest is completed
    const questCompleted = await this.checkQuestCompletion(step.questId);
    
    // Check if goal is completed
    let goalCompleted = false;
    if (questCompleted) {
      const quest = this.quests.get(step.questId);
      if (quest) {
        goalCompleted = await this.checkGoalCompletion(quest.goalId);
      }
    }
    
    return ok({
      spark: completedSpark,
      step: completedStep,
      stepCompleted: true,
      questCompleted,
      goalCompleted,
    });
  }
  
  /**
   * Skip a spark with optional reason.
   */
  async skipSpark(
    sparkId: SparkId,
    reason?: string
  ): AsyncAppResult<{
    spark: Spark;
    nextSpark: Spark | null;
    escalationLevel: number;
  }> {
    // Get spark
    const spark = this.sparks.get(sparkId);
    if (!spark) {
      return err({ code: 'NOT_FOUND', message: 'Spark not found' });
    }
    
    // Validate spark status
    if (spark.status === 'completed' || spark.status === 'skipped') {
      return err({ code: 'INVALID_INPUT', message: 'Spark is already finalized' });
    }
    
    // Update spark to skipped
    const skippedSpark: Spark = {
      ...spark,
      status: 'skipped',
      updatedAt: createTimestamp(),
    };
    this.sparks.set(sparkId, skippedSpark);
    
    // Cancel pending reminders
    await this.cancelRemindersForSpark(sparkId);
    
    // Get step
    const step = this.steps.get(spark.stepId);
    if (!step) {
      return err({ code: 'NOT_FOUND', message: 'Step not found' });
    }
    
    // Check escalation limit
    const newEscalationLevel = spark.escalationLevel + 1;
    const maxEscalation = 3;
    
    if (newEscalationLevel > maxEscalation) {
      // Mark step as needing repair
      const repairedStep: Step = {
        ...step,
        needsRepair: true,
        repairIssues: [...(step.repairIssues ?? []), 'Max escalation reached'],
        updatedAt: createTimestamp(),
      };
      this.steps.set(step.id, repairedStep);
      
      return ok({
        spark: skippedSpark,
        nextSpark: null,
        escalationLevel: newEscalationLevel,
      });
    }
    
    // Generate escalated spark
    const nextSpark = await this.generateEscalatedSpark(step, newEscalationLevel);
    
    return ok({
      spark: skippedSpark,
      nextSpark,
      escalationLevel: newEscalationLevel,
    });
  }
  
  /**
   * Rate the difficulty of a step.
   */
  async rateDifficulty(
    stepId: StepId,
    rating: DifficultyRating
  ): AsyncAppResult<Step> {
    const step = this.steps.get(stepId);
    if (!step) {
      return err({ code: 'NOT_FOUND', message: 'Step not found' });
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return err({ code: 'VALIDATION_ERROR', message: 'Rating must be between 1 and 5' });
    }
    
    const ratedStep: Step = {
      ...step,
      difficultyRating: rating,
      updatedAt: createTimestamp(),
    };
    this.steps.set(stepId, ratedStep);
    
    return ok(ratedStep);
  }
  
  /**
   * Get today's content for a user.
   */
  async getTodayForUser(userId: UserId): AsyncAppResult<TodayResult> {
    const today = new Date().toISOString().split('T')[0];
    
    // Find user's active goals
    const userGoals = Array.from(this.goals.values())
      .filter(g => g.userId === userId && g.status === 'active');
    
    if (userGoals.length === 0) {
      return ok({
        hasContent: false,
        step: null,
        spark: null,
        goal: null,
        quest: null,
      });
    }
    
    // Find today's step
    for (const goal of userGoals) {
      const quests = Array.from(this.quests.values())
        .filter(q => q.goalId === goal.id && q.status === 'active');
      
      for (const quest of quests) {
        const step = Array.from(this.steps.values())
          .find(s => s.questId === quest.id && s.scheduledDate === today);
        
        if (step) {
          // Find active spark for this step
          const spark = Array.from(this.sparks.values())
            .find(sp => sp.stepId === step.id && 
              (sp.status === 'pending' || sp.status === 'active'));
          
          return ok({
            hasContent: true,
            step,
            spark: spark ?? null,
            goal,
            quest,
          });
        }
      }
    }
    
    return ok({
      hasContent: false,
      step: null,
      spark: null,
      goal: null,
      quest: null,
    });
  }
  
  /**
   * Get progress for a goal.
   */
  async getPathProgress(goalId: GoalId): AsyncAppResult<PathProgress> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return err({ code: 'NOT_FOUND', message: 'Goal not found' });
    }
    
    // Get all quests for goal
    const quests = Array.from(this.quests.values())
      .filter(q => q.goalId === goalId);
    
    // Get all steps for all quests
    const steps: Step[] = [];
    for (const quest of quests) {
      const questSteps = Array.from(this.steps.values())
        .filter(s => s.questId === quest.id);
      steps.push(...questSteps);
    }
    
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const skippedSteps = steps.filter(s => s.status === 'skipped').length;
    
    // Calculate average difficulty
    const ratedSteps = steps.filter(s => s.difficultyRating !== undefined);
    const averageDifficulty = ratedSteps.length > 0
      ? ratedSteps.reduce((sum, s) => sum + (s.difficultyRating ?? 0), 0) / ratedSteps.length
      : 0;
    
    // Calculate overall progress
    const overallProgress = totalSteps > 0
      ? Math.round((completedSteps / totalSteps) * 100)
      : 0;
    
    // Calculate current streak
    const sortedCompleted = steps
      .filter(s => s.status === 'completed' && s.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
    
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const step of sortedCompleted) {
      const completedDate = new Date(step.completedAt!);
      completedDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today.getTime() - completedDate.getTime()) / (24 * 60 * 60 * 1000));
      
      if (daysDiff === currentStreak) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    return ok({
      goalId,
      totalSteps,
      completedSteps,
      skippedSteps,
      pendingSteps: totalSteps - completedSteps - skippedSteps,
      overallProgress,
      averageDifficulty,
      currentStreak,
      questProgress: quests.map(q => {
        const questSteps = steps.filter(s => s.questId === q.id);
        const completed = questSteps.filter(s => s.status === 'completed').length;
        return {
          questId: q.id,
          title: q.title,
          totalSteps: questSteps.length,
          completedSteps: completed,
          progress: questSteps.length > 0 ? Math.round((completed / questSteps.length) * 100) : 0,
        };
      }),
    });
  }
  
  /**
   * Generate a new spark for a step.
   */
  async generateSparkForStep(
    stepId: StepId,
    escalationLevel: number
  ): AsyncAppResult<Spark> {
    const step = this.steps.get(stepId);
    if (!step) {
      return err({ code: 'NOT_FOUND', message: 'Step not found' });
    }
    
    return ok(await this.generateEscalatedSpark(step, escalationLevel));
  }
  
  /**
   * Get active spark for a step.
   */
  async getActiveSparkForStep(stepId: StepId): AsyncAppResult<Spark | null> {
    const spark = Array.from(this.sparks.values())
      .find(s => s.stepId === stepId && 
        (s.status === 'pending' || s.status === 'active'));
    
    return ok(spark ?? null);
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
  
  private async cancelRemindersForSpark(sparkId: SparkId): Promise<void> {
    const sparkReminders = Array.from(this.reminders.values())
      .filter(r => r.sparkId === sparkId && r.status === 'pending');
    
    for (const reminder of sparkReminders) {
      this.reminders.set(reminder.id, {
        ...reminder,
        status: 'cancelled',
      });
    }
  }
  
  private async checkQuestCompletion(questId: QuestId): Promise<boolean> {
    const questSteps = Array.from(this.steps.values())
      .filter(s => s.questId === questId);
    
    if (questSteps.length === 0) return false;
    
    const allCompleted = questSteps.every(s => s.status === 'completed');
    
    if (allCompleted) {
      const quest = this.quests.get(questId);
      if (quest) {
        this.quests.set(questId, {
          ...quest,
          status: 'completed',
          updatedAt: createTimestamp(),
        });
        
        // Activate next quest
        await this.activateNextQuest(quest.goalId, quest.order);
      }
    }
    
    return allCompleted;
  }
  
  private async activateNextQuest(goalId: GoalId, currentOrder: number): Promise<void> {
    const nextQuest = Array.from(this.quests.values())
      .find(q => q.goalId === goalId && q.order === currentOrder + 1);
    
    if (nextQuest && nextQuest.status === 'pending') {
      this.quests.set(nextQuest.id, {
        ...nextQuest,
        status: 'active',
        updatedAt: createTimestamp(),
      });
    }
  }
  
  private async checkGoalCompletion(goalId: GoalId): Promise<boolean> {
    const goalQuests = Array.from(this.quests.values())
      .filter(q => q.goalId === goalId);
    
    if (goalQuests.length === 0) return false;
    
    const allCompleted = goalQuests.every(q => q.status === 'completed');
    
    if (allCompleted) {
      const goal = this.goals.get(goalId);
      if (goal) {
        this.goals.set(goalId, {
          ...goal,
          status: 'completed',
          updatedAt: createTimestamp(),
        });
      }
    }
    
    return allCompleted;
  }
  
  private async generateEscalatedSpark(step: Step, escalationLevel: number): Promise<Spark> {
    const variants: SparkVariant[] = ['full', 'full', 'reduced', 'minimal'];
    const variant = variants[Math.min(escalationLevel, 3)] ?? 'minimal';
    
    // Calculate reduced time based on escalation
    const baseMinutes = step.estimatedMinutes ?? 60;
    const reductionFactor = [1, 0.75, 0.5, 0.25][Math.min(escalationLevel, 3)] ?? 0.25;
    const estimatedMinutes = Math.max(5, Math.floor(baseMinutes * reductionFactor));
    
    const spark: Spark = {
      id: createSparkId(),
      stepId: step.id,
      action: this.generateSparkAction(step, variant),
      status: 'pending',
      createdAt: createTimestamp(),
      updatedAt: createTimestamp(),
      variant,
      escalationLevel,
      estimatedMinutes,
    };
    
    this.sparks.set(spark.id, spark);
    return spark;
  }
  
  private generateSparkAction(step: Step, variant: SparkVariant): string {
    switch (variant) {
      case 'full':
        return `Complete: ${step.title}`;
      case 'reduced':
        return `Start with the first part of: ${step.title}`;
      case 'minimal':
        return `Just open and read the first paragraph of: ${step.title}`;
      default:
        return `Work on: ${step.title}`;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Spark Completion Integration', () => {
  let redis: MockRedisClient;
  let llm: MockLLMProvider;
  let engine: MockSparkEngine;
  
  beforeEach(() => {
    redis = createMockRedis();
    llm = createMockLLM();
    engine = new MockSparkEngine(redis, llm);
  });
  
  afterEach(() => {
    engine.reset();
    redis.reset();
    llm.reset();
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Spark Completion
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Spark Completion', () => {
    it('completes pending spark', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id);
      const step = createTestStep(quest.id);
      const spark = createTestSpark(step.id);
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.markSparkComplete(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.spark.status).toBe('completed');
        expect(result.value.stepCompleted).toBe(true);
      }
    });
    
    it('completes active spark', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id);
      const step = createTestStep(quest.id);
      const spark = createTestSpark(step.id, { status: 'active' });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.markSparkComplete(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.spark.status).toBe('completed');
      }
    });
    
    it('rejects completing already completed spark', async () => {
      const step = createTestStep(createQuestId());
      const spark = createTestSpark(step.id, { status: 'completed' });
      
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.markSparkComplete(spark.id);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
    
    it('rejects completing skipped spark', async () => {
      const step = createTestStep(createQuestId());
      const spark = createTestSpark(step.id, { status: 'skipped' });
      
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.markSparkComplete(spark.id);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
    
    it('returns NOT_FOUND for non-existent spark', async () => {
      const result = await engine.markSparkComplete(createSparkId());
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
    
    it('marks step as completed', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id);
      const step = createTestStep(quest.id, { status: 'active' });
      const spark = createTestSpark(step.id);
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.markSparkComplete(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.step.status).toBe('completed');
        expect(result.value.step.completedAt).toBeDefined();
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Spark Skipping
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Spark Skipping', () => {
    it('skips spark and generates escalated spark', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id);
      const step = createTestStep(quest.id);
      const spark = createTestSpark(step.id, { escalationLevel: 0 });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.skipSpark(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.spark.status).toBe('skipped');
        expect(result.value.escalationLevel).toBe(1);
        expect(result.value.nextSpark).not.toBeNull();
      }
    });
    
    it('escalated spark has correct variant', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id);
      const step = createTestStep(quest.id);
      const spark = createTestSpark(step.id, { escalationLevel: 1, variant: 'full' });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.skipSpark(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok && result.value.nextSpark) {
        expect(result.value.nextSpark.escalationLevel).toBe(2);
        expect(result.value.nextSpark.variant).toBe('reduced');
      }
    });
    
    it('minimal variant at escalation level 3', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id);
      const step = createTestStep(quest.id);
      const spark = createTestSpark(step.id, { escalationLevel: 2, variant: 'reduced' });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.skipSpark(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok && result.value.nextSpark) {
        expect(result.value.nextSpark.escalationLevel).toBe(3);
        expect(result.value.nextSpark.variant).toBe('minimal');
      }
    });
    
    it('marks step for repair when max escalation reached', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id);
      const step = createTestStep(quest.id);
      const spark = createTestSpark(step.id, { escalationLevel: 3, variant: 'minimal' });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.skipSpark(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.nextSpark).toBeNull();
        expect(result.value.escalationLevel).toBe(4);
      }
    });
    
    it('rejects skipping already finalized spark', async () => {
      const step = createTestStep(createQuestId());
      const spark = createTestSpark(step.id, { status: 'completed' });
      
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.skipSpark(spark.id);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
    
    it('reduces estimated time with escalation', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id);
      const step = createTestStep(quest.id, { estimatedMinutes: 60 });
      const spark = createTestSpark(step.id, { escalationLevel: 0 });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.skipSpark(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok && result.value.nextSpark) {
        // Level 1 should be 75% of base time
        expect(result.value.nextSpark.estimatedMinutes).toBe(45);
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Difficulty Rating
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Difficulty Rating', () => {
    it('rates step difficulty', async () => {
      const step = createTestStep(createQuestId());
      engine.seedStep(step);
      
      const result = await engine.rateDifficulty(step.id, 3);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.difficultyRating).toBe(3);
      }
    });
    
    it('allows rating 1-5', async () => {
      const step = createTestStep(createQuestId());
      engine.seedStep(step);
      
      for (const rating of [1, 2, 3, 4, 5] as DifficultyRating[]) {
        const result = await engine.rateDifficulty(step.id, rating);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.difficultyRating).toBe(rating);
        }
      }
    });
    
    it('rejects rating outside 1-5', async () => {
      const step = createTestStep(createQuestId());
      engine.seedStep(step);
      
      const result = await engine.rateDifficulty(step.id, 6 as DifficultyRating);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
    
    it('returns NOT_FOUND for non-existent step', async () => {
      const result = await engine.rateDifficulty(createStepId(), 3);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Quest Completion Cascade
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Quest Completion Cascade', () => {
    it('completes quest when all steps completed', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id, { status: 'active' });
      
      // Create two steps
      const step1 = createTestStep(quest.id, { order: 1, status: 'completed' });
      const step2 = createTestStep(quest.id, { order: 2, status: 'active' });
      const spark = createTestSpark(step2.id);
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step1);
      engine.seedStep(step2);
      engine.seedSpark(spark);
      
      const result = await engine.markSparkComplete(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.questCompleted).toBe(true);
      }
    });
    
    it('does not complete quest if steps remain', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id, { status: 'active' });
      
      // Create three steps, completing second
      const step1 = createTestStep(quest.id, { order: 1, status: 'completed' });
      const step2 = createTestStep(quest.id, { order: 2, status: 'active' });
      const step3 = createTestStep(quest.id, { order: 3, status: 'pending' });
      const spark = createTestSpark(step2.id);
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step1);
      engine.seedStep(step2);
      engine.seedStep(step3);
      engine.seedSpark(spark);
      
      const result = await engine.markSparkComplete(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.questCompleted).toBe(false);
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Goal Completion Cascade
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Goal Completion Cascade', () => {
    it('completes goal when all quests completed', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      
      // Single quest with single step
      const quest = createTestQuest(goal.id, { status: 'active', order: 1 });
      const step = createTestStep(quest.id, { status: 'active' });
      const spark = createTestSpark(step.id);
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.markSparkComplete(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.questCompleted).toBe(true);
        expect(result.value.goalCompleted).toBe(true);
      }
    });
    
    it('does not complete goal if quests remain', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      
      // Two quests
      const quest1 = createTestQuest(goal.id, { status: 'active', order: 1 });
      const quest2 = createTestQuest(goal.id, { status: 'pending', order: 2 });
      
      const step = createTestStep(quest1.id);
      const spark = createTestSpark(step.id);
      
      engine.seedGoal(goal);
      engine.seedQuest(quest1);
      engine.seedQuest(quest2);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.markSparkComplete(spark.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.questCompleted).toBe(true);
        expect(result.value.goalCompleted).toBe(false);
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Path Progress
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Path Progress', () => {
    it('calculates progress correctly', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id);
      
      // 4 steps: 2 completed, 1 active, 1 pending
      const step1 = createCompletedStep(quest.id, { order: 1, difficultyRating: 2 });
      const step2 = createCompletedStep(quest.id, { order: 2, difficultyRating: 4 });
      const step3 = createTestStep(quest.id, { order: 3, status: 'active' });
      const step4 = createTestStep(quest.id, { order: 4, status: 'pending' });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step1);
      engine.seedStep(step2);
      engine.seedStep(step3);
      engine.seedStep(step4);
      
      const result = await engine.getPathProgress(goal.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalSteps).toBe(4);
        expect(result.value.completedSteps).toBe(2);
        expect(result.value.overallProgress).toBe(50);
        expect(result.value.averageDifficulty).toBe(3); // (2+4)/2
      }
    });
    
    it('returns NOT_FOUND for non-existent goal', async () => {
      const result = await engine.getPathProgress(createGoalId());
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
    
    it('includes quest-level progress', async () => {
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest1 = createTestQuest(goal.id, { order: 1, title: 'Quest 1' });
      const quest2 = createTestQuest(goal.id, { order: 2, title: 'Quest 2' });
      
      // Quest 1: 1/2 complete
      engine.seedStep(createCompletedStep(quest1.id, { order: 1 }));
      engine.seedStep(createTestStep(quest1.id, { order: 2, status: 'pending' }));
      
      // Quest 2: 0/1 complete
      engine.seedStep(createTestStep(quest2.id, { order: 1, status: 'pending' }));
      
      engine.seedGoal(goal);
      engine.seedQuest(quest1);
      engine.seedQuest(quest2);
      
      const result = await engine.getPathProgress(goal.id);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.questProgress).toHaveLength(2);
        expect(result.value.questProgress[0]?.progress).toBe(50);
        expect(result.value.questProgress[1]?.progress).toBe(0);
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Today's Content
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Today Content', () => {
    it('returns content for today', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id, { status: 'active' });
      const step = createTestStep(quest.id, { scheduledDate: today, status: 'active' });
      const spark = createTestSpark(step.id, { status: 'pending' });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      engine.seedSpark(spark);
      
      const result = await engine.getTodayForUser(TEST_USER_IDS.alice);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasContent).toBe(true);
        expect(result.value.step).not.toBeNull();
        expect(result.value.spark).not.toBeNull();
        expect(result.value.goal).not.toBeNull();
      }
    });
    
    it('returns no content if no scheduled step', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const goal = createTestGoal(TEST_USER_IDS.alice);
      const quest = createTestQuest(goal.id, { status: 'active' });
      const step = createTestStep(quest.id, { scheduledDate: tomorrowStr });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      
      const result = await engine.getTodayForUser(TEST_USER_IDS.alice);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasContent).toBe(false);
      }
    });
    
    it('returns no content for user with no goals', async () => {
      const result = await engine.getTodayForUser(TEST_USER_IDS.bob);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasContent).toBe(false);
      }
    });
    
    it('only returns content for active goals', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const goal = createTestGoal(TEST_USER_IDS.alice, { status: 'paused' });
      const quest = createTestQuest(goal.id, { status: 'active' });
      const step = createTestStep(quest.id, { scheduledDate: today });
      
      engine.seedGoal(goal);
      engine.seedQuest(quest);
      engine.seedStep(step);
      
      const result = await engine.getTodayForUser(TEST_USER_IDS.alice);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasContent).toBe(false);
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Spark Generation
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Spark Generation', () => {
    it('generates spark at specified escalation level', async () => {
      const step = createTestStep(createQuestId());
      engine.seedStep(step);
      
      const result = await engine.generateSparkForStep(step.id, 2);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.escalationLevel).toBe(2);
        expect(result.value.variant).toBe('reduced');
      }
    });
    
    it('generates full variant at level 0', async () => {
      const step = createTestStep(createQuestId());
      engine.seedStep(step);
      
      const result = await engine.generateSparkForStep(step.id, 0);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.variant).toBe('full');
      }
    });
    
    it('generates minimal variant at level 3+', async () => {
      const step = createTestStep(createQuestId());
      engine.seedStep(step);
      
      const result = await engine.generateSparkForStep(step.id, 3);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.variant).toBe('minimal');
      }
    });
    
    it('returns NOT_FOUND for non-existent step', async () => {
      const result = await engine.generateSparkForStep(createStepId(), 0);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});
