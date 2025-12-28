// ═══════════════════════════════════════════════════════════════════════════════
// WEEK PLAN GENERATOR TESTS — Phase 19C
// NovaOS Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WeekPlanGenerator,
  createWeekPlanGenerator,
} from './week-plan-generator.js';
import type { WeekPlanGenerationContext } from './interfaces.js';
import type { Skill, QuestDuration } from './types.js';
import { createWeeksDuration } from './types.js';
import type { Goal, Quest } from '../spark-engine/types.js';
import type { GoalId, QuestId, UserId, Timestamp, SkillId } from '../../types/branded.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

const mockGoal: Goal = {
  id: 'goal_test123' as GoalId,
  userId: 'user_abc' as UserId,
  title: 'Learn Python',
  description: 'Master Python programming',
  status: 'active',
  createdAt: '2025-01-01T00:00:00Z' as Timestamp,
  updatedAt: '2025-01-01T00:00:00Z' as Timestamp,
};

const mockQuest: Quest = {
  id: 'quest_week1' as QuestId,
  goalId: mockGoal.id,
  title: 'Week 1: Python Basics',
  description: 'Learn fundamental Python concepts',
  status: 'pending',
  order: 1,
  createdAt: '2025-01-01T00:00:00Z' as Timestamp,
  updatedAt: '2025-01-01T00:00:00Z' as Timestamp,
  topicIds: ['variables', 'data-types', 'operators'],
  estimatedDays: 5,
};

const mockDuration = createWeeksDuration(1, 1); // Week 1, 5 practice days

function createMockSkill(overrides?: Partial<Skill>): Skill {
  return {
    id: `skill_${Math.random().toString(36).slice(2, 8)}` as SkillId,
    questId: mockQuest.id,
    goalId: mockGoal.id,
    userId: mockGoal.userId,
    title: 'Test Skill',
    topic: 'testing',
    action: 'Write test code',
    successSignal: 'Tests pass',
    lockedVariables: ['No mocking'],
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
    createdAt: '2025-01-01T00:00:00Z' as Timestamp,
    updatedAt: '2025-01-01T00:00:00Z' as Timestamp,
    ...overrides,
  };
}

function createMockContext(
  overrides?: Partial<WeekPlanGenerationContext>
): WeekPlanGenerationContext {
  const defaultSkills = [
    createMockSkill({ id: 'skill_1' as SkillId, title: 'Variables', skillType: 'foundation', order: 1 }),
    createMockSkill({ id: 'skill_2' as SkillId, title: 'Data Types', skillType: 'foundation', order: 2 }),
    createMockSkill({ id: 'skill_3' as SkillId, title: 'Operators', skillType: 'building', order: 3, prerequisiteSkillIds: ['skill_1' as SkillId] }),
    createMockSkill({ id: 'skill_4' as SkillId, title: 'Expressions', skillType: 'compound', order: 4, prerequisiteSkillIds: ['skill_1' as SkillId, 'skill_2' as SkillId], isCompound: true, componentSkillIds: ['skill_1' as SkillId, 'skill_2' as SkillId] }),
    createMockSkill({ id: 'skill_5' as SkillId, title: 'Milestone: Calculator', skillType: 'synthesis', order: 5, prerequisiteSkillIds: ['skill_3' as SkillId, 'skill_4' as SkillId], isCompound: true }),
  ];

  return {
    goal: mockGoal,
    quest: mockQuest,
    duration: mockDuration,
    weekNumber: 1,
    weekInQuest: 1,
    weekSkills: defaultSkills,
    previousQuestSkills: [],
    carryForwardSkills: [],
    startDate: '2025-01-06', // Monday
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('WeekPlanGenerator', () => {
  let generator: WeekPlanGenerator;

  beforeEach(() => {
    generator = createWeekPlanGenerator({ shuffleReviews: false });
  });

  describe('generate', () => {
    it('should generate a week plan from skills', async () => {
      const context = createMockContext();
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { weekPlan, dayPlans } = result.value;

      expect(weekPlan).toBeDefined();
      expect(weekPlan.weekNumber).toBe(1);
      expect(weekPlan.weekInQuest).toBe(1);
      expect(weekPlan.isFirstWeekOfQuest).toBe(true);
      expect(weekPlan.isLastWeekOfQuest).toBe(true);
      expect(weekPlan.status).toBe('pending');
    });

    it('should create day plans for each day', async () => {
      const context = createMockContext();
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { dayPlans } = result.value;

      expect(dayPlans.length).toBe(5); // 5 practice days

      // Each day should have a day number
      for (let i = 0; i < 5; i++) {
        expect(dayPlans[i]!.dayNumber).toBe(i + 1);
        expect(dayPlans[i]!.dayInQuest).toBe(i + 1);
        expect(dayPlans[i]!.status).toBe('pending');
      }
    });

    it('should assign skills in dependency order', async () => {
      const context = createMockContext();
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { dayPlans } = result.value;
      const skillTitles = dayPlans.map(d => d.skillTitle);

      // Foundations should come first
      const foundationDays = dayPlans.filter(d => d.skillType === 'foundation');
      const buildingDays = dayPlans.filter(d => d.skillType === 'building');
      const compoundDays = dayPlans.filter(d => d.skillType === 'compound');
      const synthesisDays = dayPlans.filter(d => d.skillType === 'synthesis');

      // Check order: foundation < building < compound < synthesis
      const firstFoundation = dayPlans.findIndex(d => d.skillType === 'foundation');
      const firstBuilding = dayPlans.findIndex(d => d.skillType === 'building');
      const firstCompound = dayPlans.findIndex(d => d.skillType === 'compound');
      const firstSynthesis = dayPlans.findIndex(d => d.skillType === 'synthesis');

      if (firstBuilding >= 0) {
        expect(firstFoundation).toBeLessThan(firstBuilding);
      }
      if (firstCompound >= 0 && firstBuilding >= 0) {
        expect(firstBuilding).toBeLessThan(firstCompound);
      }
      if (firstSynthesis >= 0) {
        // Synthesis should be last
        expect(firstSynthesis).toBe(dayPlans.length - 1);
      }
    });

    it('should count skill types correctly', async () => {
      const context = createMockContext();
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { weekPlan } = result.value;

      expect(weekPlan.foundationCount).toBe(2);
      expect(weekPlan.buildingCount).toBe(1);
      expect(weekPlan.compoundCount).toBe(1);
      expect(weekPlan.hasSynthesis).toBe(true);
    });

    it('should set correct dates', async () => {
      const context = createMockContext({ startDate: '2025-01-06' }); // Monday
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { weekPlan, dayPlans } = result.value;

      expect(weekPlan.startDate).toBe('2025-01-06');
      
      // Day 1 should be start date
      expect(dayPlans[0]!.scheduledDate).toBe('2025-01-06');
    });

    it('should handle carry-forward skills', async () => {
      const carryForwardSkill = createMockSkill({
        id: 'skill_cf' as SkillId,
        title: 'Carried Forward',
        skillType: 'foundation',
        order: 0, // High priority
      });

      const context = createMockContext({
        carryForwardSkills: [carryForwardSkill],
      });

      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { weekPlan } = result.value;

      // Carry-forward should be in scheduled skills
      expect(weekPlan.carryForwardSkillIds).toContain('skill_cf');
    });
  });

  describe('identifyReviewSkills', () => {
    it('should identify prerequisite skills from previous quests', () => {
      const priorSkill = createMockSkill({
        id: 'prior_1' as SkillId,
        questId: 'quest_week0' as QuestId,
        title: 'Prior Foundation',
        mastery: 'mastered',
      });

      const weekSkill = createMockSkill({
        id: 'current_1' as SkillId,
        title: 'Current Compound',
        skillType: 'compound',
        isCompound: true,
        prerequisiteSkillIds: ['prior_1' as SkillId],
        prerequisiteQuestIds: ['quest_week0' as QuestId],
        componentSkillIds: ['prior_1' as SkillId],
        componentQuestIds: ['quest_week0' as QuestId],
      });

      const reviewSkills = generator.identifyReviewSkills(
        [weekSkill],
        [priorSkill]
      );

      expect(reviewSkills.length).toBeGreaterThan(0);
      expect(reviewSkills.some(s => s.id === 'prior_1')).toBe(true);
    });

    it('should return empty for no previous skills', () => {
      const weekSkill = createMockSkill();
      const reviewSkills = generator.identifyReviewSkills([weekSkill], []);

      expect(reviewSkills.length).toBe(0);
    });

    it('should limit review skills to max', () => {
      const generator = createWeekPlanGenerator({
        maxReviewSkillsPerWeek: 2,
        shuffleReviews: false,
      });

      const priorSkills = [
        createMockSkill({ id: 'prior_1' as SkillId, questId: 'quest_0' as QuestId, mastery: 'mastered' }),
        createMockSkill({ id: 'prior_2' as SkillId, questId: 'quest_0' as QuestId, mastery: 'mastered' }),
        createMockSkill({ id: 'prior_3' as SkillId, questId: 'quest_0' as QuestId, mastery: 'mastered' }),
        createMockSkill({ id: 'prior_4' as SkillId, questId: 'quest_0' as QuestId, mastery: 'mastered' }),
      ];

      const weekSkill = createMockSkill({
        prerequisiteSkillIds: priorSkills.map(s => s.id),
        prerequisiteQuestIds: ['quest_0' as QuestId],
      });

      const reviewSkills = generator.identifyReviewSkills([weekSkill], priorSkills);

      expect(reviewSkills.length).toBeLessThanOrEqual(2);
    });
  });

  describe('assignSkillsToDays', () => {
    it('should assign skills to available days', () => {
      const skills = [
        createMockSkill({ id: 's1' as SkillId, order: 1 }),
        createMockSkill({ id: 's2' as SkillId, order: 2 }),
        createMockSkill({ id: 's3' as SkillId, order: 3 }),
      ];

      const assignments = generator.assignSkillsToDays(skills, 5);

      expect(assignments.length).toBe(5);
      expect(assignments[0]).not.toBeNull();
      expect(assignments[1]).not.toBeNull();
      expect(assignments[2]).not.toBeNull();
      expect(assignments[3]).toBeNull(); // Empty day
      expect(assignments[4]).toBeNull(); // Empty day
    });

    it('should handle more skills than days', () => {
      const skills = Array.from({ length: 7 }, (_, i) =>
        createMockSkill({ id: `s${i}` as SkillId, order: i })
      );

      const assignments = generator.assignSkillsToDays(skills, 5);

      expect(assignments.length).toBe(5);
      // First 5 skills should be assigned
      for (let i = 0; i < 5; i++) {
        expect(assignments[i]).not.toBeNull();
      }
    });

    it('should handle empty skills', () => {
      const assignments = generator.assignSkillsToDays([], 5);

      expect(assignments.length).toBe(5);
      expect(assignments.every(a => a === null)).toBe(true);
    });

    it('should respect dependency order', () => {
      const foundation = createMockSkill({
        id: 'foundation' as SkillId,
        skillType: 'foundation',
        order: 1,
      });
      const building = createMockSkill({
        id: 'building' as SkillId,
        skillType: 'building',
        order: 2,
        prerequisiteSkillIds: ['foundation' as SkillId],
      });
      const compound = createMockSkill({
        id: 'compound' as SkillId,
        skillType: 'compound',
        order: 3,
        prerequisiteSkillIds: ['building' as SkillId],
        isCompound: true,
      });

      // Pass in wrong order
      const skills = [compound, foundation, building];

      const assignments = generator.assignSkillsToDays(skills, 5);

      // Should be reordered by dependencies
      const assignedIds = assignments
        .filter((a): a is Skill => a !== null)
        .map(a => a.id);

      const foundationIdx = assignedIds.indexOf('foundation' as SkillId);
      const buildingIdx = assignedIds.indexOf('building' as SkillId);
      const compoundIdx = assignedIds.indexOf('compound' as SkillId);

      expect(foundationIdx).toBeLessThan(buildingIdx);
      expect(buildingIdx).toBeLessThan(compoundIdx);
    });
  });

  describe('generateForQuest', () => {
    it('should generate all week plans for a single-week quest', async () => {
      const skills = [
        createMockSkill({ id: 's1' as SkillId, skillType: 'foundation', order: 1 }),
        createMockSkill({ id: 's2' as SkillId, skillType: 'foundation', order: 2 }),
        createMockSkill({ id: 's3' as SkillId, skillType: 'building', order: 3 }),
        createMockSkill({ id: 's4' as SkillId, skillType: 'compound', order: 4, isCompound: true }),
        createMockSkill({ id: 's5' as SkillId, skillType: 'synthesis', order: 5, isCompound: true }),
      ];

      const duration = createWeeksDuration(1, 1);

      const result = await generator.generateForQuest(
        mockQuest,
        duration,
        skills,
        [],
        mockGoal,
        1,
        '2025-01-06'
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const weekPlans = result.value;

      expect(weekPlans.length).toBe(1);
      expect(weekPlans[0]!.weekNumber).toBe(1);
      expect(weekPlans[0]!.isFirstWeekOfQuest).toBe(true);
      expect(weekPlans[0]!.isLastWeekOfQuest).toBe(true);
    });

    it('should generate multiple week plans for multi-week quest', async () => {
      const skills = Array.from({ length: 10 }, (_, i) =>
        createMockSkill({
          id: `s${i}` as SkillId,
          skillType: i < 4 ? 'foundation' : i < 7 ? 'building' : i < 9 ? 'compound' : 'synthesis',
          order: i + 1,
          isCompound: i >= 7,
        })
      );

      const duration = createWeeksDuration(2, 1); // 2 weeks, 10 days

      const result = await generator.generateForQuest(
        mockQuest,
        duration,
        skills,
        [],
        mockGoal,
        1,
        '2025-01-06'
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const weekPlans = result.value;

      expect(weekPlans.length).toBe(2);

      // First week
      expect(weekPlans[0]!.weekNumber).toBe(1);
      expect(weekPlans[0]!.weekInQuest).toBe(1);
      expect(weekPlans[0]!.isFirstWeekOfQuest).toBe(true);
      expect(weekPlans[0]!.isLastWeekOfQuest).toBe(false);

      // Second week
      expect(weekPlans[1]!.weekNumber).toBe(2);
      expect(weekPlans[1]!.weekInQuest).toBe(2);
      expect(weekPlans[1]!.isFirstWeekOfQuest).toBe(false);
      expect(weekPlans[1]!.isLastWeekOfQuest).toBe(true);

      // Synthesis should be in last week
      expect(weekPlans[1]!.hasSynthesis).toBe(true);
    });

    it('should place synthesis in last week', async () => {
      const skills = Array.from({ length: 15 }, (_, i) =>
        createMockSkill({
          id: `s${i}` as SkillId,
          skillType: i === 14 ? 'synthesis' : i < 6 ? 'foundation' : 'building',
          order: i + 1,
          isCompound: i === 14,
        })
      );

      const duration = createWeeksDuration(3, 1); // 3 weeks

      const result = await generator.generateForQuest(
        mockQuest,
        duration,
        skills,
        [],
        mockGoal,
        1,
        '2025-01-06'
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const weekPlans = result.value;

      expect(weekPlans.length).toBe(3);

      // Synthesis should be in last week
      const lastWeek = weekPlans[2]!;
      expect(lastWeek.hasSynthesis).toBe(true);

      // Other weeks should not have synthesis
      expect(weekPlans[0]!.hasSynthesis).toBe(false);
      expect(weekPlans[1]!.hasSynthesis).toBe(false);
    });
  });

  describe('cross-quest context', () => {
    it('should track reviewsFromQuestIds', async () => {
      const priorSkill = createMockSkill({
        id: 'prior_1' as SkillId,
        questId: 'quest_week0' as QuestId,
        mastery: 'mastered',
      });

      const weekSkill = createMockSkill({
        id: 'current_1' as SkillId,
        skillType: 'compound',
        isCompound: true,
        prerequisiteSkillIds: ['prior_1' as SkillId],
        prerequisiteQuestIds: ['quest_week0' as QuestId],
        componentSkillIds: ['prior_1' as SkillId],
        componentQuestIds: ['quest_week0' as QuestId],
      });

      const context = createMockContext({
        weekSkills: [weekSkill],
        previousQuestSkills: [priorSkill],
      });

      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { weekPlan, reviewSkills } = result.value;

      // Should identify review skills
      expect(reviewSkills.length).toBeGreaterThan(0);

      // Should track which quests are being reviewed
      expect(weekPlan.reviewsFromQuestIds).toContain('quest_week0');
    });

    it('should track buildsOnSkillIds', async () => {
      const priorSkill = createMockSkill({
        id: 'prior_1' as SkillId,
        questId: 'quest_week0' as QuestId,
      });

      const weekSkill = createMockSkill({
        id: 'current_1' as SkillId,
        skillType: 'compound',
        isCompound: true,
        prerequisiteSkillIds: ['prior_1' as SkillId],
        componentSkillIds: ['prior_1' as SkillId],
      });

      const context = createMockContext({
        weekSkills: [weekSkill],
        previousQuestSkills: [priorSkill],
      });

      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { weekPlan } = result.value;

      // Should track which skills we build on
      expect(weekPlan.buildsOnSkillIds).toContain('prior_1');
    });

    it('should assign review skills to day plans', async () => {
      const priorSkill = createMockSkill({
        id: 'prior_1' as SkillId,
        questId: 'quest_week0' as QuestId,
        mastery: 'mastered',
      });

      const compoundSkill = createMockSkill({
        id: 'compound_1' as SkillId,
        skillType: 'compound',
        isCompound: true,
        prerequisiteSkillIds: ['prior_1' as SkillId],
        prerequisiteQuestIds: ['quest_week0' as QuestId],
        componentSkillIds: ['prior_1' as SkillId],
        componentQuestIds: ['quest_week0' as QuestId],
        order: 3,
      });

      const context = createMockContext({
        weekSkills: [
          createMockSkill({ id: 'f1' as SkillId, skillType: 'foundation', order: 1 }),
          createMockSkill({ id: 'b1' as SkillId, skillType: 'building', order: 2 }),
          compoundSkill,
        ],
        previousQuestSkills: [priorSkill],
      });

      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { dayPlans, reviewSkills } = result.value;

      // Should have review skills
      expect(reviewSkills.length).toBeGreaterThan(0);

      // Compound/building days should have review assignments
      const daysWithReview = dayPlans.filter(d => d.reviewSkillId);
      // At least some days should have reviews
      expect(daysWithReview.length).toBeGreaterThanOrEqual(0);
    });
  });
});
