// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES — Goal, Quest, Step, Spark Fixtures
// NovaOS Phase 17 — Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createGoalId,
  createQuestId,
  createStepId,
  createSparkId,
  createReminderId,
  createUserId,
  createTimestamp,
} from '../../types/branded.js';
import { TEST_USER_IDS } from './users.js';

// ─────────────────────────────────────────────────────────────────────────────────
// GOAL FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TestGoal {
  id: ReturnType<typeof createGoalId>;
  userId: ReturnType<typeof createUserId>;
  title: string;
  description: string;
  desiredOutcome: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  createdAt: ReturnType<typeof createTimestamp>;
  updatedAt: ReturnType<typeof createTimestamp>;
}

export function createTestGoal(overrides: Partial<TestGoal> = {}): TestGoal {
  const now = createTimestamp();
  return {
    id: createGoalId(`goal_${Date.now()}`),
    userId: TEST_USER_IDS.FREE_USER,
    title: 'Learn Rust Programming',
    description: 'Master Rust for systems programming',
    desiredOutcome: 'Build production-ready CLI tools in Rust',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// QUEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TestQuest {
  id: ReturnType<typeof createQuestId>;
  goalId: ReturnType<typeof createGoalId>;
  title: string;
  description: string;
  sequence: number;
  status: 'pending' | 'active' | 'completed';
  createdAt: ReturnType<typeof createTimestamp>;
}

export function createTestQuest(
  goalId: ReturnType<typeof createGoalId>,
  overrides: Partial<TestQuest> = {}
): TestQuest {
  return {
    id: createQuestId(`quest_${Date.now()}`),
    goalId,
    title: 'Rust Fundamentals',
    description: 'Learn the core concepts of Rust',
    sequence: 1,
    status: 'active',
    createdAt: createTimestamp(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STEP FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TestActivity {
  type: 'read' | 'watch' | 'practice' | 'quiz';
  title: string;
  minutes: number;
  url?: string;
}

export interface TestStep {
  id: ReturnType<typeof createStepId>;
  questId: ReturnType<typeof createQuestId>;
  title: string;
  description: string;
  sequence: number;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  activities: TestActivity[];
  createdAt: ReturnType<typeof createTimestamp>;
}

export function createTestStep(
  questId: ReturnType<typeof createQuestId>,
  overrides: Partial<TestStep> = {}
): TestStep {
  return {
    id: createStepId(`step_${Date.now()}`),
    questId,
    title: 'Day 1: Hello Rust',
    description: 'Get started with Rust installation and first program',
    sequence: 1,
    status: 'active',
    activities: [
      { type: 'read', title: 'Read Chapter 1', minutes: 20, url: 'https://doc.rust-lang.org/book/ch01-00-getting-started.html' },
      { type: 'practice', title: 'Write hello world', minutes: 10 },
    ],
    createdAt: createTimestamp(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TestSpark {
  id: ReturnType<typeof createSparkId>;
  userId: ReturnType<typeof createUserId>;
  stepId: ReturnType<typeof createStepId>;
  action: string;
  rationale: string;
  timeEstimate: string;
  variant: 'full' | 'reduced' | 'minimal';
  escalationLevel: number;
  status: 'suggested' | 'accepted' | 'completed' | 'skipped' | 'expired';
  createdAt: ReturnType<typeof createTimestamp>;
  completedAt?: ReturnType<typeof createTimestamp>;
}

export function createTestSpark(
  stepId: ReturnType<typeof createStepId>,
  overrides: Partial<TestSpark> = {}
): TestSpark {
  return {
    id: createSparkId(`spark_${Date.now()}`),
    userId: TEST_USER_IDS.FREE_USER,
    stepId,
    action: 'Open The Rust Programming Language book and read the first 5 pages of Chapter 1',
    rationale: 'Starting with the official book provides a solid foundation',
    timeEstimate: '10 minutes',
    variant: 'full',
    escalationLevel: 0,
    status: 'suggested',
    createdAt: createTimestamp(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REMINDER FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TestReminder {
  id: ReturnType<typeof createReminderId>;
  userId: ReturnType<typeof createUserId>;
  sparkId: ReturnType<typeof createSparkId>;
  scheduledTime: string;
  status: 'pending' | 'sent' | 'cancelled' | 'expired';
  escalationLevel: number;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
}

export function createTestReminder(
  sparkId: ReturnType<typeof createSparkId>,
  overrides: Partial<TestReminder> = {}
): TestReminder {
  return {
    id: createReminderId(`rem_${Date.now()}`),
    userId: TEST_USER_IDS.FREE_USER,
    sparkId,
    scheduledTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    status: 'pending',
    escalationLevel: 0,
    channels: { push: true, email: false, sms: false },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPLETE JOURNEY FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

export function createTestJourney() {
  const goal = createTestGoal();
  
  const quests = [
    createTestQuest(goal.id, { title: 'Rust Fundamentals', sequence: 1, status: 'active' }),
    createTestQuest(goal.id, { title: 'Ownership & Borrowing', sequence: 2, status: 'pending' }),
    createTestQuest(goal.id, { title: 'Error Handling', sequence: 3, status: 'pending' }),
  ];
  
  const steps = [
    createTestStep(quests[0].id, { title: 'Day 1: Hello Rust', sequence: 1, status: 'active' }),
    createTestStep(quests[0].id, { title: 'Day 2: Variables', sequence: 2, status: 'pending' }),
    createTestStep(quests[0].id, { title: 'Day 3: Functions', sequence: 3, status: 'pending' }),
  ];
  
  const spark = createTestSpark(steps[0].id);
  
  return { goal, quests, steps, spark };
}
