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
import type { Skill, DayPlan, WeekPlan } from './types.js';
import type { Goal, Quest } from '../spark-engine/types.js';
import type { GoalId, QuestId, UserId, Timestamp, SkillId, WeekPlanId } from '../../types/branded.js';

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
    action: 'Implement the feature',
    successSignal: 'Feature works correctly',
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

function createMockWeekPlan(overrides?: Partial<WeekPlan>): WeekPlan {
  return {
    id: 'weekplan_1' as WeekPlanId,
    goalId: 'goal_test123' as GoalId,
    questId: 'quest_week1' as QuestId,
    userId: 'user_abc' as UserId,
    weekNumber: 1,
    weekInQuest: 1,
    isFirstWeekOfQuest: true,
    isLastWeekOfQuest: false,
    theme: 'Foundation Week',
    status: 'active',
    scheduledSkillIds: ['skill_1' as SkillId],
    carryForwardSkillIds: [],
    days: [createMockDayPlan()],
    foundationCount: 3,
    buildingCount: 1,
    compoundCount: 0,
    hasSynthesis: false,
    reviewsFromQuestIds: [],
    buildsOnSkillIds: [],
    skillsMastered: 0,
    drillsCompleted: 0,
    drillsPassed: 0,
    drillsFailed: 0,
    drillsSkipped: 0,
    startDate: '2025-01-06',
    endDate: '2025-01-10',
    createdAt: '2025-01-01T00:00:00Z' as Timestamp,
    updatedAt: '2025-01-01T00:00:00Z' as Timestamp,
    ...overrides,
  } as WeekPlan;
}

function createMockGoal(): Goal {
  return {
    id: 'goal_test123' as GoalId,
    userId: 'user_abc' as UserId,
    title: 'Learn Testing',
    description: 'Master unit testing',
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z' as Timestamp,
    updatedAt: '2025-01-01T00:00:00Z' as Timestamp,
  } as Goal;
}

function createMockQuest(): Quest {
  return {
    id: 'quest_week1' as QuestId,
    goalId: 'goal_test123' as GoalId,
    title: 'Week 1: Foundations',
    description: 'Learn the basics',
    order: 1,
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z' as Timestamp,
    updatedAt: '2025-01-01T00:00:00Z' as Timestamp,
  } as Quest;
}

function createMockContext(overrides?: Partial<DailyDrillGenerationContext>): DailyDrillGenerationContext {
  const skill = createMockSkill();
  return {
    skill,
    dayPlan: createMockDayPlan({ skillId: skill.id }),
    weekPlan: createMockWeekPlan(),
    goal: createMockGoal(),
    quest: createMockQuest(),
    previousQuestSkills: [],
    dailyMinutes: 30,
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

      const { drill, main } = result.value;

      expect(drill).toBeDefined();
      expect(drill.skillId).toBe(context.skill.id);
      expect(main).toBeDefined();
      expect(main.type).toBe('main');
      expect(main.action).toBe(context.skill.action);
      expect(drill.status).toBe('scheduled');
    });

    it('should include warmup when review skill in dayPlan', async () => {
      const reviewSkill = createMockSkill({
        id: 'skill_review' as SkillId,
        questId: 'quest_week0' as QuestId,
        title: 'Variables',
        topic: 'prior-topic',
      });

      const dayPlan = createMockDayPlan({
        reviewSkillId: reviewSkill.id,
        reviewQuestId: reviewSkill.questId,
      });

      const context = createMockContext({
        dayPlan,
        previousQuestSkills: [reviewSkill],
      });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { warmup } = result.value;

      expect(warmup).toBeDefined();
      expect(warmup?.type).toBe('warmup');
      expect(warmup?.title).toContain('Review');
    });

    it('should include stretch section when time permits', async () => {
      const context = createMockContext({ dailyMinutes: 45 });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { stretch } = result.value;

      expect(stretch).toBeDefined();
      expect(stretch?.type).toBe('stretch');
      expect(stretch?.isOptional).toBe(true);
    });

    it('should skip stretch when time is tight', async () => {
      // With dailyMinutes: 10, main gets MIN_MAIN_MINUTES (10), stretchBudget = 0 < 5
      const context = createMockContext({ dailyMinutes: 10 });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { stretch } = result.value;

      expect(stretch).toBeNull();
    });

    it('should include skill type information in drill', async () => {
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
      expect(drill.componentSkillIds).toHaveLength(2);
    });

    it('should track cross-quest dependencies', async () => {
      const reviewSkill = createMockSkill({
        id: 'skill_review' as SkillId,
        questId: 'quest_week0' as QuestId,
      });

      const dayPlan = createMockDayPlan({
        reviewSkillId: reviewSkill.id,
        reviewQuestId: reviewSkill.questId,
      });

      const context = createMockContext({
        dayPlan,
        previousQuestSkills: [reviewSkill],
      });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill } = result.value;

      expect(drill.reviewSkillId).toBe('skill_review');
      expect(drill.reviewQuestId).toBe('quest_week0');
      expect(drill.buildsOnQuestIds).toContain('quest_week0');
    });

    it('should include main section with action and pass signal', async () => {
      const context = createMockContext();
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { main, drill } = result.value;

      // Main section should include core practice content
      expect(main.action).toBeDefined();
      expect(main.passSignal).toBeDefined();
      // Resilience info is in skill, carried to drill
      expect(drill.lockedVariables).toBeDefined();
    });

    it('should calculate total time correctly', async () => {
      const context = createMockContext({ dailyMinutes: 45 });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill, warmup, main, stretch } = result.value;

      const calculatedTotal =
        (warmup?.estimatedMinutes ?? 0) +
        main.estimatedMinutes +
        (stretch?.estimatedMinutes ?? 0);

      expect(drill.estimatedMinutes).toBe(calculatedTotal);
    });

    it('should use locked variables as constraint', async () => {
      const skill = createMockSkill({
        lockedVariables: ['Must use TypeScript', 'No external libraries'],
      });

      const context = createMockContext({ skill });
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill } = result.value;

      // lockedVariables is on drill, not main section
      expect(drill.lockedVariables).toContain('Must use TypeScript');
      expect(drill.lockedVariables).toContain('No external libraries');
    });
  });

  describe('generateWarmup', () => {
    it('should create warmup from review skill', async () => {
      const skill = createMockSkill();
      const reviewSkill = createMockSkill({
        id: 'skill_review' as SkillId,
        title: 'Variables',
        questId: 'quest_week0' as QuestId,
      });

      const dayPlan = createMockDayPlan({
        reviewSkillId: reviewSkill.id,
      });

      const result = await engine.generateWarmup(skill, dayPlan, [reviewSkill]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const warmup = result.value;

      expect(warmup).not.toBeNull();
      expect(warmup?.type).toBe('warmup');
      expect(warmup?.title).toContain('Review');
      expect(warmup?.title).toContain('Variables');
    });

    it('should return null when no review skill in dayPlan', async () => {
      const skill = createMockSkill();
      const dayPlan = createMockDayPlan(); // No reviewSkillId

      const result = await engine.generateWarmup(skill, dayPlan, []);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value).toBeNull();
    });
  });

  describe('generateMain', () => {
    it('should create main section from skill', async () => {
      const skill = createMockSkill({
        action: 'Implement the feature',
        successSignal: 'Feature works correctly',
      });

      const result = await engine.generateMain(skill);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const main = result.value;

      expect(main.type).toBe('main');
      expect(main.action).toBe('Implement the feature');
      expect(main.passSignal).toBe('Feature works correctly');
    });

    it('should adapt action for retry', async () => {
      const skill = createMockSkill();
      const previousDrill = {
        outcome: 'fail',
        retryCount: 1,
      };

      const result = await engine.generateMain(skill, previousDrill as any);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const main = result.value;

      // Retry should have adapted guidance
      expect(main.action).toBeDefined();
    });
  });

  describe('generateStretch', () => {
    it('should create stretch challenge', async () => {
      const skill = createMockSkill();

      const result = await engine.generateStretch(skill);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const stretch = result.value;

      expect(stretch.type).toBe('stretch');
      expect(stretch.title).toContain('Challenge');
      expect(stretch.isOptional).toBe(true);
    });

    it('should generate stretch based on skill type', async () => {
      const foundationSkill = createMockSkill({ skillType: 'foundation' });
      const compoundSkill = createMockSkill({ skillType: 'compound', isCompound: true });
      const synthesisSkill = createMockSkill({ skillType: 'synthesis' });

      const result1 = await engine.generateStretch(foundationSkill);
      const result2 = await engine.generateStretch(compoundSkill);
      const result3 = await engine.generateStretch(synthesisSkill);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      expect(result3.ok).toBe(true);

      // All should generate stretch sections
      if (result1.ok) expect(result1.value.type).toBe('stretch');
      if (result2.ok) expect(result2.value.type).toBe('stretch');
      if (result3.ok) expect(result3.value.type).toBe('stretch');
    });
  });

  describe('adaptForRetry', () => {
    it('should adapt drill for second attempt', async () => {
      const context = createMockContext();
      const previousDrill = {
        outcome: 'fail',
        retryCount: 1,
        carryForward: 'Focus on edge cases',
      };

      const contextWithPrevious = {
        ...context,
        previousDrill: previousDrill as any,
      };

      const result = await engine.generate(contextWithPrevious);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill } = result.value;

      expect(drill.isRetry).toBe(true);
      expect(drill.retryCount).toBe(2);
    });

    it('should detect retry from previous drill', async () => {
      const context = createMockContext();
      const previousDrill = {
        outcome: 'fail',
        retryCount: 1,
        carryForward: 'Focus on edge cases',
      };

      const contextWithPrevious = {
        ...context,
        previousDrill: previousDrill as any,
      };

      const result = await engine.generate(contextWithPrevious);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill, context: contextExplanation } = result.value;

      // Retry is detected from previous drill
      expect(drill.isRetry).toBe(true);
      expect(drill.retryCount).toBe(2);
      // Context explanation mentions retry
      expect(contextExplanation).toContain('Retry');
    });
  });

  describe('configuration', () => {
    it('should respect warmup time config', async () => {
      const customEngine = createDailyDrillEngine({
        warmupMinutes: 10,
      });

      const reviewSkill = createMockSkill({
        id: 'skill_review' as SkillId,
        questId: 'quest_week0' as QuestId,
      });

      const dayPlan = createMockDayPlan({
        reviewSkillId: reviewSkill.id,
      });

      const context = createMockContext({
        dayPlan,
        previousQuestSkills: [reviewSkill],
      });

      const result = await customEngine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { warmup } = result.value;

      expect(warmup?.estimatedMinutes).toBeLessThanOrEqual(10);
    });

    it('should respect includeStretch config', async () => {
      const noStretchEngine = createDailyDrillEngine({
        includeStretch: false,
      });

      const context = createMockContext({ dailyMinutes: 60 });
      const result = await noStretchEngine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { stretch } = result.value;

      expect(stretch).toBeNull();
    });

    it('should respect maxRetryAttempts config', async () => {
      const strictEngine = createDailyDrillEngine({
        maxRetryAttempts: 2,
      });

      const context = createMockContext();
      const previousDrill = {
        outcome: 'fail',
        retryCount: 2, // At max
      };

      const contextWithPrevious = {
        ...context,
        previousDrill: previousDrill as any,
      };

      const result = await strictEngine.generate(contextWithPrevious);

      // Should still generate but mark as final attempt
      expect(result.ok).toBe(true);
    });
  });

  describe('legacy compatibility', () => {
    it('should include all required drill fields', async () => {
      const context = createMockContext();
      const result = await engine.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { drill } = result.value;

      // Check all required fields exist
      expect(drill.id).toBeDefined();
      expect(drill.weekPlanId).toBeDefined();
      expect(drill.skillId).toBeDefined();
      expect(drill.questId).toBeDefined();
      expect(drill.goalId).toBeDefined();
      expect(drill.userId).toBeDefined();
      expect(drill.scheduledDate).toBeDefined();
      expect(drill.dayNumber).toBeDefined();
      expect(drill.weekNumber).toBeDefined();
      expect(drill.status).toBeDefined();
      expect(drill.skillType).toBeDefined();
      expect(drill.skillTitle).toBeDefined();
      expect(drill.createdAt).toBeDefined();
      expect(drill.updatedAt).toBeDefined();
    });
  });
});
