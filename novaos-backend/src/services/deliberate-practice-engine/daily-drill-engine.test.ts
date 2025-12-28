// ═══════════════════════════════════════════════════════════════════════════════
// DAILY DRILL ENGINE TESTS — Phase 19D
// NovaOS Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DailyDrillEngine,
  createDailyDrillEngine,
} from './daily-drill-engine.js';
import type { DailyDrillGenerationContext } from './interfaces.js';
import type { Skill, DayPlan } from './types.js';
import type { GoalId, QuestId, UserId, Timestamp, SkillId } from '../../types/branded.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

function createMockSkill(overrides?: Partial<Skill>): Skill {
  return {
    id: `skill_${Math.random().toString(36).slice(2, 8)}` as SkillId,
    questId: 'quest_week1' as QuestId,
    goalId: 'goal_test123' as GoalId,
    userId: 'user_abc' as UserId,
    title: 'Test Skill',
    topic: 'testing',
    action: 'Write unit tests for the module',
    successSignal: 'All tests pass with 80% coverage',
    lockedVariables: ['No mocking external services', 'Use real data fixtures'],
    estimatedMinutes: 25,
    skillType: 'foundation',
    depth: 0,
    prerequisiteSkillIds: [],
    prerequisiteQuestIds: [],
    isCompound: false,
    weekNumber: 1,
    dayInWeek: 1,
    dayInQuest: 1,
    order: 1,
    difficulty: 'intro',
    mastery: 'not_started',
    status: 'available',
    passCount: 0,
    failCount: 0,
    consecutivePasses: 0,
    adversarialElement: 'Forget to test edge cases',
    failureMode: 'Tests pass but miss critical bugs',
    recoverySteps: 'Add boundary tests, test error paths',
    transferScenario: 'Write tests for a different module',
    createdAt: '2025-01-01T00:00:00Z' as Timestamp,
    updatedAt: '2025-01-01T00:00:00Z' as Timestamp,
    ...overrides,
  };
}

function createMockDayPlan(overrides?: Partial<DayPlan>): DayPlan {
  return {
    dayNumber: 1,
    dayInQuest: 1,
    scheduledDate: '2025-01-06',
    skillId: 'skill_1' as SkillId,
    skillType: 'foundation',
    skillTitle: 'Test Skill',
    status: 'pending',
    ...overrides,
  };
}

function createMockContext(overrides?: Partial<DailyDrillGenerationContext>): DailyDrillGenerationContext {
  return {
    skill: createMockSkill(),
    dayPlan: createMockDayPlan(),
    dailyMinutes: 30,
    attemptNumber: 1,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('DailyDrillEngine', () => {
  let engine: DailyDrillEngine;

  beforeEach(() => {
    engine = createDailyDrillEngine();
  });

  describe('generate', () => {
    it('should generate a drill with main section', async () => {
      const context = createMockContext();
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill, sections } = result.value;

      expect(drill).toBeDefined();
      expect(drill.skillId).toBe(context.skill.id);
      expect(drill.main).toBeDefined();
      expect(drill.main?.type).toBe('main');
      expect(drill.main?.action).toBe(context.skill.action);
      expect(drill.status).toBe('pending');
    });

    it('should include warmup when review skill provided', async () => {
      const reviewSkill = createMockSkill({
        id: 'skill_review' as SkillId,
        questId: 'quest_week0' as QuestId,
        title: 'Prior Skill',
        topic: 'prior-topic',
      });

      const context = createMockContext({ reviewSkill });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill, hasWarmup } = result.value;

      expect(hasWarmup).toBe(true);
      expect(drill.warmup).toBeDefined();
      expect(drill.warmup?.type).toBe('warmup');
      expect(drill.warmup?.title).toContain('Review');
      expect(drill.warmup?.isFromPreviousQuest).toBe(true);
      expect(drill.warmup?.sourceSkillId).toBe('skill_review');
    });

    it('should include stretch section when time permits', async () => {
      const context = createMockContext({ dailyMinutes: 35 });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill, hasStretch } = result.value;

      expect(hasStretch).toBe(true);
      expect(drill.stretch).toBeDefined();
      expect(drill.stretch?.type).toBe('stretch');
      expect(drill.stretch?.isOptional).toBe(true);
    });

    it('should skip stretch when time is tight', async () => {
      const context = createMockContext({ dailyMinutes: 20 });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill, hasStretch } = result.value;

      expect(hasStretch).toBe(false);
      expect(drill.stretch).toBeUndefined();
    });

    it('should include skill type information', async () => {
      const compoundSkill = createMockSkill({
        skillType: 'compound',
        isCompound: true,
        componentSkillIds: ['skill_1' as SkillId, 'skill_2' as SkillId],
      });

      const context = createMockContext({ skill: compoundSkill });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill } = result.value;

      expect(drill.skillType).toBe('compound');
      expect(drill.isCompoundDrill).toBe(true);
      expect(drill.componentSkillIds).toContain('skill_1');
      expect(drill.componentSkillIds).toContain('skill_2');
    });

    it('should track cross-quest dependencies', async () => {
      const skill = createMockSkill({
        prerequisiteQuestIds: ['quest_week0' as QuestId],
        componentQuestIds: ['quest_week0' as QuestId],
        isCompound: true,
      });

      const reviewSkill = createMockSkill({
        id: 'skill_prior' as SkillId,
        questId: 'quest_week0' as QuestId,
      });

      const context = createMockContext({ skill, reviewSkill });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill } = result.value;

      expect(drill.buildsOnQuestIds).toContain('quest_week0');
      expect(drill.reviewSkillId).toBe('skill_prior');
      expect(drill.reviewQuestId).toBe('quest_week0');
    });

    it('should include resilience layer in main section', async () => {
      const context = createMockContext();
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill } = result.value;

      expect(drill.main?.adversarialElement).toBeDefined();
      expect(drill.main?.failureMode).toBeDefined();
      expect(drill.main?.recoverySteps).toBeDefined();
    });

    it('should calculate total time correctly', async () => {
      const reviewSkill = createMockSkill({
        questId: 'quest_week0' as QuestId,
      });

      const context = createMockContext({
        reviewSkill,
        dailyMinutes: 40,
      });

      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill, totalMinutes } = result.value;

      const warmupTime = drill.warmup?.estimatedMinutes ?? 0;
      const mainTime = drill.main?.estimatedMinutes ?? 0;
      const stretchTime = drill.stretch?.estimatedMinutes ?? 0;

      expect(totalMinutes).toBe(warmupTime + mainTime + stretchTime);
      expect(drill.totalMinutes).toBe(totalMinutes);
    });

    it('should use locked variables as constraint', async () => {
      const skill = createMockSkill({
        lockedVariables: ['No external APIs', 'Use TypeScript'],
      });

      const context = createMockContext({ skill });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill } = result.value;

      expect(drill.main?.constraint).toContain('No external APIs');
      expect(drill.main?.constraint).toContain('Use TypeScript');
    });
  });

  describe('generateWarmup', () => {
    it('should create warmup from review skill', async () => {
      const reviewSkill = createMockSkill({
        id: 'skill_review' as SkillId,
        questId: 'quest_week0' as QuestId,
        title: 'Variables',
        action: 'Declare and assign variables',
        successSignal: 'Variables work correctly',
      });

      const context = createMockContext();
      const warmup = await engine.generateWarmup(reviewSkill, context);

      expect(warmup.type).toBe('warmup');
      expect(warmup.title).toContain('Review');
      expect(warmup.title).toContain('Variables');
      expect(warmup.action).toContain('Quick review');
      expect(warmup.estimatedMinutes).toBe(5);
      expect(warmup.isFromPreviousQuest).toBe(true);
      expect(warmup.sourceQuestId).toBe('quest_week0');
    });

    it('should relate warmup to today skill when topics match', async () => {
      const reviewSkill = createMockSkill({
        id: 'skill_review' as SkillId,
        questId: 'quest_week0' as QuestId,
        topic: 'loops',
        topics: ['loops', 'iteration'],
      });

      const todaySkill = createMockSkill({
        id: 'skill_today' as SkillId,
        topic: 'loops',
        topics: ['loops', 'for-loops'],
        prerequisiteSkillIds: ['skill_review' as SkillId],
      });

      const context = createMockContext({ skill: todaySkill });
      const warmup = await engine.generateWarmup(reviewSkill, context);

      expect(warmup.action).toContain('prepares you');
    });
  });

  describe('generateMain', () => {
    it('should create main section from skill', async () => {
      const skill = createMockSkill({
        action: 'Implement the feature',
        successSignal: 'Feature works correctly',
        estimatedMinutes: 20,
      });

      const context = createMockContext({ skill });
      const main = await engine.generateMain(skill, context);

      expect(main.type).toBe('main');
      expect(main.action).toBe('Implement the feature');
      expect(main.passSignal).toBe('Feature works correctly');
      expect(main.isOptional).toBe(false);
    });

    it('should adapt action for retry', async () => {
      const skill = createMockSkill();
      const context = createMockContext({
        skill,
        attemptNumber: 2,
        previousFailureReason: 'Forgot edge cases',
      });

      const main = await engine.generateMain(skill, context);

      expect(main.action).toContain('Previous attempt failed');
      expect(main.action).toContain('smaller steps');
    });
  });

  describe('generateStretch', () => {
    it('should create stretch challenge', async () => {
      const skill = createMockSkill({
        transferScenario: 'Apply to a REST API',
      });

      const context = createMockContext({ skill });
      const stretch = await engine.generateStretch(skill, context);

      expect(stretch.type).toBe('stretch');
      expect(stretch.title).toContain('Challenge');
      expect(stretch.isOptional).toBe(true);
      expect(stretch.action).toContain('Apply to a REST API');
    });

    it('should generate stretch based on skill type', async () => {
      const foundation = createMockSkill({ skillType: 'foundation', transferScenario: undefined });
      const building = createMockSkill({ skillType: 'building', transferScenario: undefined });
      const compound = createMockSkill({ skillType: 'compound', transferScenario: undefined });

      const ctx1 = createMockContext({ skill: foundation });
      const ctx2 = createMockContext({ skill: building });
      const ctx3 = createMockContext({ skill: compound });

      const stretch1 = await engine.generateStretch(foundation, ctx1);
      const stretch2 = await engine.generateStretch(building, ctx2);
      const stretch3 = await engine.generateStretch(compound, ctx3);

      // Different skill types should get different stretch challenges
      expect(stretch1.action).toContain('different context');
      expect(stretch2.action).toContain('Combine');
      expect(stretch3.action).toContain('Teach');
    });
  });

  describe('adaptForRetry', () => {
    it('should adapt drill for second attempt', async () => {
      const context = createMockContext();
      const originalResult = await engine.generate(context);
      expect(originalResult.ok).toBe(true);
      if (!originalResult.ok) return;

      const adaptedResult = await engine.adaptForRetry(
        originalResult.value.drill,
        'Missed edge cases',
        2
      );

      expect(adaptedResult.ok).toBe(true);
      if (!adaptedResult.ok) return;

      const adapted = adaptedResult.value;

      expect(adapted.attemptNumber).toBe(2);
      expect(adapted.previousFailureReason).toBe('Missed edge cases');
      expect(adapted.main?.title).toContain('Retry 2');
      expect(adapted.stretch).toBeUndefined(); // No stretch on retry
      expect(adapted.recoveryGuidance).toBeDefined();
    });

    it('should increase time for retry', async () => {
      const context = createMockContext();
      const originalResult = await engine.generate(context);
      expect(originalResult.ok).toBe(true);
      if (!originalResult.ok) return;

      const adaptedResult = await engine.adaptForRetry(
        originalResult.value.drill,
        'Time ran out',
        2
      );

      expect(adaptedResult.ok).toBe(true);
      if (!adaptedResult.ok) return;

      const adapted = adaptedResult.value;

      // Should have more time (1.25x)
      expect(adapted.totalMinutes).toBeGreaterThan(originalResult.value.drill.totalMinutes);
    });

    it('should fail after max retries', async () => {
      const context = createMockContext();
      const originalResult = await engine.generate(context);
      expect(originalResult.ok).toBe(true);
      if (!originalResult.ok) return;

      const adaptedResult = await engine.adaptForRetry(
        originalResult.value.drill,
        'Still failing',
        4 // Exceeds default max of 3
      );

      expect(adaptedResult.ok).toBe(false);
      if (adaptedResult.ok) return;

      expect(adaptedResult.error.code).toBe('MAX_RETRIES_EXCEEDED');
    });

    it('should provide progressive recovery guidance', async () => {
      const context = createMockContext();
      const originalResult = await engine.generate(context);
      expect(originalResult.ok).toBe(true);
      if (!originalResult.ok) return;

      const attempt2 = await engine.adaptForRetry(
        originalResult.value.drill,
        'Failed',
        2
      );

      const attempt3 = await engine.adaptForRetry(
        originalResult.value.drill,
        'Failed again',
        3
      );

      expect(attempt2.ok).toBe(true);
      expect(attempt3.ok).toBe(true);

      if (!attempt2.ok || !attempt3.ok) return;

      // Different guidance for different attempts
      expect(attempt2.value.recoveryGuidance).toContain('Break the task');
      expect(attempt3.value.recoveryGuidance).toContain('prerequisite');
    });
  });

  describe('configuration', () => {
    it('should respect warmup time config', async () => {
      const engine = createDailyDrillEngine({ warmupMinutes: 10 });
      const reviewSkill = createMockSkill({ questId: 'quest_0' as QuestId });
      const context = createMockContext({ reviewSkill });

      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.drill.warmup?.estimatedMinutes).toBe(10);
    });

    it('should respect includeStretch config', async () => {
      const engine = createDailyDrillEngine({ includeStretch: false });
      const context = createMockContext({ dailyMinutes: 60 });

      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.hasStretch).toBe(false);
      expect(result.value.drill.stretch).toBeUndefined();
    });

    it('should respect maxRetryAttempts config', async () => {
      const engine = createDailyDrillEngine({ maxRetryAttempts: 5 });
      const context = createMockContext();

      const originalResult = await engine.generate(context);
      expect(originalResult.ok).toBe(true);
      if (!originalResult.ok) return;

      // Should allow attempt 5
      const attempt5 = await engine.adaptForRetry(
        originalResult.value.drill,
        'Fail',
        5
      );
      expect(attempt5.ok).toBe(true);

      // Should reject attempt 6
      const attempt6 = await engine.adaptForRetry(
        originalResult.value.drill,
        'Fail',
        6
      );
      expect(attempt6.ok).toBe(false);
    });
  });

  describe('legacy compatibility', () => {
    it('should include legacy fields', async () => {
      const context = createMockContext();
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill } = result.value;

      // Legacy fields for backward compatibility
      expect(drill.action).toBeDefined();
      expect(drill.passSignal).toBeDefined();
      expect(drill.constraint).toBeDefined();
    });
  });
});
