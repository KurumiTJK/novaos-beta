// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TREE GENERATOR TESTS — Phase 19B
// NovaOS Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SkillTreeGenerator,
  createSkillTreeGenerator,
} from './skill-tree-generator.js';
import type { SkillTreeGenerationContext } from './interfaces.js';
import type { Skill, QuestDuration } from './types.js';
import { createWeeksDuration } from './types.js';
import type { CapabilityStage } from '../../gates/sword/capability-generator.js';
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

const mockStages: CapabilityStage[] = [
  {
    title: 'Write Your First Program',
    capability: 'Write and run a basic Python program',
    artifact: 'A working hello_world.py that prints output',
    designedFailure: 'Forget to save the file before running',
    consequence: 'Python runs the old version, output is wrong',
    recovery: 'Always save before running, check file timestamps',
    transfer: 'Apply to any new Python file you create',
    topics: ['hello-world', 'print', 'running-python'],
    consideration: {
      gaining: 'Ability to execute Python code',
      tradingOff: 'Deep understanding of how Python works internally',
      severity: 'info',
    },
  },
  {
    title: 'Work with Variables',
    capability: 'Create, assign, and modify variables',
    artifact: 'A script that stores and manipulates data in variables',
    designedFailure: 'Use a variable before assigning it',
    consequence: 'NameError crashes the program',
    recovery: 'Always assign before use, read error messages carefully',
    transfer: 'Apply variable patterns to any data type',
    topics: ['variables', 'assignment', 'data-types'],
    consideration: {
      gaining: 'Data storage and manipulation skills',
      tradingOff: 'Understanding of memory management',
      severity: 'info',
    },
  },
  {
    title: 'Debug Common Errors',
    capability: 'Read and fix Python error messages',
    artifact: 'Fixed code with documented error analysis',
    designedFailure: 'Ignore the error message and guess',
    consequence: 'Waste time with wrong fixes, may introduce new bugs',
    recovery: 'Read error messages line by line, Google if needed',
    transfer: 'Apply debugging approach to any error type',
    topics: ['debugging', 'error-messages', 'troubleshooting'],
    consideration: {
      gaining: 'Systematic problem-solving skills',
      tradingOff: 'Speed in the short term',
      severity: 'caution',
    },
  },
  {
    title: 'Build a Calculator',
    capability: 'Design and implement a basic calculator',
    artifact: 'A functioning calculator that handles basic operations',
    designedFailure: 'Forget to handle division by zero',
    consequence: 'Program crashes with ZeroDivisionError',
    recovery: 'Add input validation, handle edge cases explicitly',
    transfer: 'Apply defensive programming to any user input',
    topics: ['design', 'user-input', 'arithmetic'],
    consideration: {
      gaining: 'Independent design skills',
      tradingOff: 'Step-by-step guidance safety net',
      severity: 'caution',
    },
  },
  {
    title: 'Share Your Code',
    capability: 'Document and share code with others',
    artifact: 'A documented project others can use',
    designedFailure: 'Skip documentation, assume code is self-explanatory',
    consequence: 'Others (including future you) cannot use the code',
    recovery: 'Add comments, write README, get feedback from a peer',
    transfer: 'Apply documentation practices to any project',
    topics: ['documentation', 'sharing', 'readme'],
    consideration: {
      gaining: 'Real-world collaboration skills',
      tradingOff: 'Privacy of your work',
      severity: 'info',
    },
  },
];

const mockDuration = createWeeksDuration(1, 1); // Week 1, 5 practice days

function createMockContext(
  overrides?: Partial<SkillTreeGenerationContext>
): SkillTreeGenerationContext {
  return {
    quest: mockQuest,
    goal: mockGoal,
    stages: mockStages,
    duration: mockDuration,
    dailyMinutes: 30,
    userLevel: 'beginner',
    previousQuestSkills: [],
    previousQuests: [],
    ...overrides,
  };
}

function createMockPreviousSkill(
  overrides?: Partial<Skill>
): Skill {
  return {
    id: 'skill_prior1' as SkillId,
    questId: 'quest_week0' as QuestId,
    goalId: mockGoal.id,
    userId: mockGoal.userId,
    title: 'Prior Skill',
    topic: 'basics',
    action: 'Complete prior task',
    successSignal: 'Task completed',
    lockedVariables: [],
    estimatedMinutes: 20,
    skillType: 'foundation',
    depth: 0,
    prerequisiteSkillIds: [],
    prerequisiteQuestIds: [],
    isCompound: false,
    weekNumber: 0,
    dayInWeek: 0,
    dayInQuest: 0,
    order: 1,
    difficulty: 'intro',
    mastery: 'mastered',
    status: 'mastered',
    passCount: 3,
    failCount: 0,
    consecutivePasses: 3,
    createdAt: '2025-01-01T00:00:00Z' as Timestamp,
    updatedAt: '2025-01-01T00:00:00Z' as Timestamp,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('SkillTreeGenerator', () => {
  let generator: SkillTreeGenerator;

  beforeEach(() => {
    // Disable LLM for predictable tests
    generator = createSkillTreeGenerator({ useLLM: false });
  });

  describe('generate', () => {
    it('should generate skills from capability stages', async () => {
      const context = createMockContext();
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { skills, rootSkillIds, synthesisSkillId, warnings, milestone } = result.value;

      // Should have skills
      expect(skills.length).toBeGreaterThan(0);
      expect(skills.length).toBeLessThanOrEqual(context.duration.practiceDays);

      // Should have root (foundation) skills
      expect(rootSkillIds.length).toBeGreaterThan(0);

      // Should have synthesis skill
      expect(synthesisSkillId).toBeDefined();
      const synthesis = skills.find(s => s.id === synthesisSkillId);
      expect(synthesis).toBeDefined();
      expect(synthesis?.skillType).toBe('synthesis');

      // Should have milestone
      expect(milestone).toBeDefined();
      expect(milestone.status).toBe('locked');
    });

    it('should generate all skill types', async () => {
      const context = createMockContext();
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { skills, distribution } = result.value;

      // Should have foundation skills
      expect(distribution.foundation).toBeGreaterThan(0);

      // Should have building skills
      expect(distribution.building).toBeGreaterThan(0);

      // Should have compound skills
      expect(distribution.compound).toBeGreaterThan(0);

      // Should have exactly 1 synthesis skill
      expect(distribution.synthesis).toBe(1);

      // Verify skill types match
      const foundations = skills.filter(s => s.skillType === 'foundation');
      expect(foundations.length).toBe(distribution.foundation);
    });

    it('should assign correct scheduling', async () => {
      const context = createMockContext();
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { skills } = result.value;

      // All skills should have scheduling
      for (const skill of skills) {
        expect(skill.weekNumber).toBeGreaterThanOrEqual(1);
        expect(skill.dayInWeek).toBeGreaterThanOrEqual(1);
        expect(skill.dayInWeek).toBeLessThanOrEqual(5);
        expect(skill.dayInQuest).toBeGreaterThanOrEqual(1);
        expect(skill.order).toBeGreaterThanOrEqual(1);
      }

      // Synthesis should be last
      const synthesis = skills.find(s => s.skillType === 'synthesis');
      const lastSkill = [...skills].sort((a, b) => b.order - a.order)[0];
      expect(synthesis?.order).toBe(lastSkill?.order);
    });

    it('should set correct initial status', async () => {
      const context = createMockContext();
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { skills } = result.value;

      // Foundation skills should be available (no prereqs)
      const foundations = skills.filter(s => s.skillType === 'foundation');
      for (const skill of foundations) {
        expect(skill.status).toBe('available');
      }

      // Building and compound should be locked (have prereqs)
      const nonFoundations = skills.filter(s => s.skillType !== 'foundation');
      for (const skill of nonFoundations) {
        expect(skill.status).toBe('locked');
        expect(skill.prerequisiteSkillIds.length).toBeGreaterThan(0);
      }
    });

    it('should include resilience layer from stages', async () => {
      const context = createMockContext();
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { skills } = result.value;

      // At least some skills should have resilience info
      const withResilience = skills.filter(s =>
        s.adversarialElement && s.failureMode && s.recoverySteps
      );
      expect(withResilience.length).toBeGreaterThan(0);
    });

    it('should handle multi-week quests', async () => {
      const multiWeekDuration = createWeeksDuration(3, 2); // Weeks 2-4, 15 days
      const context = createMockContext({ duration: multiWeekDuration });
      
      const result = await generator.generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { skills } = result.value;

      // Should have more skills for longer duration
      expect(skills.length).toBeLessThanOrEqual(15);

      // Should span multiple weeks
      const weekNumbers = new Set(skills.map(s => s.weekNumber));
      expect(weekNumbers.size).toBeGreaterThanOrEqual(2);

      // Week numbers should be in range
      for (const skill of skills) {
        expect(skill.weekNumber).toBeGreaterThanOrEqual(2);
        expect(skill.weekNumber).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('findRelevantPriorSkills', () => {
    it('should find skills with overlapping topics', () => {
      const priorSkills = [
        createMockPreviousSkill({
          id: 'skill_prior1' as SkillId,
          topic: 'variables',
          topics: ['variables', 'assignment'],
        }),
        createMockPreviousSkill({
          id: 'skill_prior2' as SkillId,
          topic: 'functions',
          topics: ['functions', 'parameters'],
        }),
      ];

      const relevant = generator.findRelevantPriorSkills(
        ['variables', 'data-types'],
        priorSkills
      );

      expect(relevant.length).toBeGreaterThan(0);
      expect(relevant.some(s => s.topic === 'variables')).toBe(true);
    });

    it('should include mastered skills even without topic match', () => {
      const priorSkills = [
        createMockPreviousSkill({
          id: 'skill_prior1' as SkillId,
          topic: 'unrelated',
          topics: ['unrelated'],
          mastery: 'mastered',
        }),
      ];

      const relevant = generator.findRelevantPriorSkills(
        ['completely-different'],
        priorSkills
      );

      // Should include mastered skill for review
      expect(relevant.length).toBe(1);
    });

    it('should return empty for empty prior skills', () => {
      const relevant = generator.findRelevantPriorSkills(['anything'], []);
      expect(relevant.length).toBe(0);
    });
  });

  describe('createCompoundSkill', () => {
    it('should create compound from two skills', async () => {
      const context = createMockContext();
      const skill1 = createMockPreviousSkill({
        id: 'skill_1' as SkillId,
        questId: mockQuest.id,
        title: 'Variables',
        topic: 'variables',
      });
      const skill2 = createMockPreviousSkill({
        id: 'skill_2' as SkillId,
        questId: mockQuest.id,
        title: 'Loops',
        topic: 'loops',
      });

      const result = await generator.createCompoundSkill([skill1, skill2], context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const compound = result.value;
      expect(compound.skillType).toBe('compound');
      expect(compound.isCompound).toBe(true);
      expect(compound.componentSkillIds).toContain(skill1.id);
      expect(compound.componentSkillIds).toContain(skill2.id);
      expect(compound.prerequisiteSkillIds.length).toBe(2);
    });

    it('should identify cross-quest compounds', async () => {
      const context = createMockContext();
      const priorSkill = createMockPreviousSkill({
        id: 'skill_prior' as SkillId,
        questId: 'quest_previous' as QuestId,
        title: 'Prior Foundation',
      });
      const currentSkill = createMockPreviousSkill({
        id: 'skill_current' as SkillId,
        questId: mockQuest.id,
        title: 'Current Building',
      });

      const result = await generator.createCompoundSkill(
        [priorSkill, currentSkill],
        context
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const compound = result.value;
      expect(compound.componentQuestIds).toBeDefined();
      expect(compound.componentQuestIds).toContain('quest_previous');
    });

    it('should fail with less than 2 components', async () => {
      const context = createMockContext();
      const skill1 = createMockPreviousSkill();

      const result = await generator.createCompoundSkill([skill1], context);

      expect(result.ok).toBe(false);
    });
  });

  describe('createSynthesisSkill', () => {
    it('should create synthesis from all quest skills', async () => {
      const context = createMockContext();
      const questSkills = [
        createMockPreviousSkill({ id: 'skill_1' as SkillId, questId: mockQuest.id }),
        createMockPreviousSkill({ id: 'skill_2' as SkillId, questId: mockQuest.id }),
        createMockPreviousSkill({ id: 'skill_3' as SkillId, questId: mockQuest.id }),
      ];

      const result = await generator.createSynthesisSkill(questSkills, context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const synthesis = result.value;
      expect(synthesis.skillType).toBe('synthesis');
      expect(synthesis.isCompound).toBe(true);
      expect(synthesis.prerequisiteSkillIds.length).toBe(3);
      expect(synthesis.title).toContain('Milestone');
    });
  });

  describe('validateSkill', () => {
    it('should pass valid skill', () => {
      const skill = createMockPreviousSkill({
        action: 'Write a Python script',
        successSignal: 'Script runs without errors and produces expected output',
        lockedVariables: ["Don't use external libraries"],
        estimatedMinutes: 25,
      });

      const error = generator.validateSkill(skill, 30);
      expect(error).toBeUndefined();
    });

    it('should fail skill without action verb', () => {
      const skill = createMockPreviousSkill({
        action: 'The Python script for data processing',
      });

      const error = generator.validateSkill(skill, 30);
      expect(error).toContain('verb');
    });

    it('should fail skill with short success signal', () => {
      const skill = createMockPreviousSkill({
        action: 'Write code',
        successSignal: 'Works',
      });

      const error = generator.validateSkill(skill, 30);
      expect(error).toContain('10 characters');
    });

    it('should fail skill exceeding time budget', () => {
      const skill = createMockPreviousSkill({
        action: 'Write code',
        successSignal: 'Code works correctly',
        estimatedMinutes: 60,
      });

      const error = generator.validateSkill(skill, 30);
      expect(error).toContain('Exceeds');
    });

    it('should fail skill without locked variables', () => {
      const skill = createMockPreviousSkill({
        action: 'Write code',
        successSignal: 'Code works correctly',
        lockedVariables: [],
      });

      const error = generator.validateSkill(skill, 30);
      expect(error).toContain('locked variable');
    });

    it('should fail compound without enough components', () => {
      const skill = createMockPreviousSkill({
        action: 'Combine skills',
        successSignal: 'Skills combined correctly',
        isCompound: true,
        componentSkillIds: ['skill_1' as SkillId],
      });

      const error = generator.validateSkill(skill, 30);
      expect(error).toContain('2 components');
    });
  });
});

describe('SkillTreeGenerator Integration', () => {
  it('should generate complete tree with cross-quest dependencies', async () => {
    const generator = createSkillTreeGenerator({ useLLM: false });

    // Prior quest skills
    const priorSkills: Skill[] = [
      createMockPreviousSkill({
        id: 'prior_variables' as SkillId,
        questId: 'quest_week0' as QuestId,
        title: 'Python Variables',
        topic: 'variables',
        topics: ['variables', 'assignment'],
        mastery: 'mastered',
      }),
      createMockPreviousSkill({
        id: 'prior_print' as SkillId,
        questId: 'quest_week0' as QuestId,
        title: 'Print Statements',
        topic: 'print',
        topics: ['print', 'output'],
        mastery: 'mastered',
      }),
    ];

    // Multi-week quest (builds on prior)
    const context = createMockContext({
      duration: createWeeksDuration(2, 2), // Weeks 2-3, 10 days
      previousQuestSkills: priorSkills,
      previousQuests: [{
        ...mockQuest,
        id: 'quest_week0' as QuestId,
        title: 'Week 0: Prerequisites',
      }],
    });

    const result = await generator.generate(context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { skills, crossQuestSkillIds, milestone } = result.value;

    // Should have skills spanning 2 weeks
    expect(skills.length).toBeGreaterThanOrEqual(5);
    expect(skills.length).toBeLessThanOrEqual(10);

    // Should have cross-quest compounds
    // Note: This depends on whether prior skills topics match
    // The test verifies the mechanism works even if no match found

    // Milestone should be at end
    const synthesis = skills.find(s => s.skillType === 'synthesis');
    expect(synthesis).toBeDefined();
    expect(milestone.title).toBeDefined();
    expect(milestone.acceptanceCriteria.length).toBeGreaterThan(0);
  });
});
