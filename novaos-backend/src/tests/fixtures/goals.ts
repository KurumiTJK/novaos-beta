// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES — Goal, Quest, Step, Spark Fixtures
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides test fixtures for Sword entities:
//   - Goals with various configurations
//   - Quests with topic coverage
//   - Steps with activities and resources
//   - Sparks with escalation levels
//   - Reminders with scheduling
//
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createGoalId,
  createQuestId,
  createStepId,
  createSparkId,
  createReminderId,
  createResourceId,
  createUserId,
  createTimestamp,
  type GoalId,
  type QuestId,
  type StepId,
  type SparkId,
  type ReminderId,
  type ResourceId,
  type UserId,
  type Timestamp,
} from '../../types/branded.js';

import type {
  Goal,
  Quest,
  Step,
  Spark,
  Activity,
  StepResource,
  ReminderSchedule,
  ReminderConfig,
  LearningConfig,
  GoalStatus,
  QuestStatus,
  StepStatus,
  SparkStatus,
  SparkVariant,
  DifficultyRating,
  ActivityType,
  VerificationLevel,
  DayOfWeek,
  ReminderTone,
  ReminderStatus,
} from '../../services/spark-engine/types.js';

import { TEST_USER_IDS } from './users.js';

// ─────────────────────────────────────────────────────────────────────────────────
// GOAL FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test goal with defaults.
 */
export function createTestGoal(
  userId?: UserId,
  overrides?: Partial<Goal>
): Goal {
  const id = overrides?.id ?? createGoalId();
  
  return {
    id,
    userId: userId ?? overrides?.userId ?? createUserId(),
    title: overrides?.title ?? 'Learn Rust Programming',
    description: overrides?.description ?? 'Master the Rust programming language from basics to advanced concepts',
    status: overrides?.status ?? 'active',
    createdAt: overrides?.createdAt ?? createTimestamp(),
    updatedAt: overrides?.updatedAt ?? createTimestamp(),
    learningConfig: overrides?.learningConfig ?? createDefaultLearningConfig(),
    reminderConfig: overrides?.reminderConfig ?? createDefaultReminderConfig(),
    lessonPlan: overrides?.lessonPlan,
  };
}

/**
 * Create a goal in a specific status.
 */
export function createGoalWithStatus(
  status: GoalStatus,
  userId?: UserId,
  overrides?: Partial<Goal>
): Goal {
  return createTestGoal(userId, { ...overrides, status });
}

/**
 * Create an active goal.
 */
export function createActiveGoal(userId?: UserId, overrides?: Partial<Goal>): Goal {
  return createGoalWithStatus('active', userId, overrides);
}

/**
 * Create a completed goal.
 */
export function createCompletedGoal(userId?: UserId, overrides?: Partial<Goal>): Goal {
  return createGoalWithStatus('completed', userId, overrides);
}

/**
 * Create a paused goal.
 */
export function createPausedGoal(userId?: UserId, overrides?: Partial<Goal>): Goal {
  return createGoalWithStatus('paused', userId, overrides);
}

// ─────────────────────────────────────────────────────────────────────────────────
// LEARNING CONFIG FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create default learning configuration.
 */
export function createDefaultLearningConfig(): LearningConfig {
  return {
    userLevel: 'beginner',
    dailyTimeCommitment: 60,
    learningStyle: 'mixed',
    totalDuration: '6 weeks',
    startDate: getTodayString(),
    activeDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  };
}

/**
 * Create learning config for beginner.
 */
export function createBeginnerLearningConfig(): LearningConfig {
  return {
    userLevel: 'beginner',
    dailyTimeCommitment: 30,
    learningStyle: 'video',
    totalDuration: '8 weeks',
    activeDays: ['monday', 'wednesday', 'friday'],
  };
}

/**
 * Create learning config for advanced user.
 */
export function createAdvancedLearningConfig(): LearningConfig {
  return {
    userLevel: 'advanced',
    dailyTimeCommitment: 90,
    learningStyle: 'hands-on',
    totalDuration: '4 weeks',
    activeDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REMINDER CONFIG FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create default reminder configuration.
 */
export function createDefaultReminderConfig(): ReminderConfig {
  return {
    enabled: true,
    firstReminderHour: 9,
    lastReminderHour: 19,
    intervalHours: 3,
    channels: { push: true, email: false, sms: false },
    shrinkSparksOnEscalation: true,
    maxRemindersPerDay: 4,
    quietDays: [],
    timezone: 'America/New_York',
  };
}

/**
 * Create reminder config with all channels enabled.
 */
export function createAllChannelsReminderConfig(): ReminderConfig {
  return {
    ...createDefaultReminderConfig(),
    channels: { push: true, email: true, sms: true },
  };
}

/**
 * Create reminder config with weekends quiet.
 */
export function createWeekendQuietReminderConfig(): ReminderConfig {
  return {
    ...createDefaultReminderConfig(),
    quietDays: ['saturday', 'sunday'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// QUEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test quest with defaults.
 */
export function createTestQuest(
  goalId?: GoalId,
  overrides?: Partial<Quest>
): Quest {
  return {
    id: overrides?.id ?? createQuestId(),
    goalId: goalId ?? overrides?.goalId ?? createGoalId(),
    title: overrides?.title ?? 'Week 1: Rust Basics',
    description: overrides?.description ?? 'Learn the fundamentals of Rust programming',
    status: overrides?.status ?? 'pending',
    order: overrides?.order ?? 1,
    createdAt: overrides?.createdAt ?? createTimestamp(),
    updatedAt: overrides?.updatedAt ?? createTimestamp(),
    topicIds: overrides?.topicIds ?? ['rust:basics', 'rust:ownership'],
    estimatedDays: overrides?.estimatedDays ?? 7,
    verifiedResources: overrides?.verifiedResources,
  };
}

/**
 * Create a quest in a specific status.
 */
export function createQuestWithStatus(
  status: QuestStatus,
  goalId?: GoalId,
  overrides?: Partial<Quest>
): Quest {
  return createTestQuest(goalId, { ...overrides, status });
}

/**
 * Create multiple quests for a goal.
 */
export function createQuestSequence(goalId: GoalId, count: number = 3): Quest[] {
  return Array.from({ length: count }, (_, i) => 
    createTestQuest(goalId, {
      order: i + 1,
      title: `Week ${i + 1}: ${['Basics', 'Intermediate', 'Advanced', 'Practice', 'Project'][i] ?? `Part ${i + 1}`}`,
      status: i === 0 ? 'active' : 'pending',
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// STEP FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test step with defaults.
 */
export function createTestStep(
  questId?: QuestId,
  overrides?: Partial<Step>
): Step {
  return {
    id: overrides?.id ?? createStepId(),
    questId: questId ?? overrides?.questId ?? createQuestId(),
    title: overrides?.title ?? 'Day 1: Hello World',
    description: overrides?.description ?? 'Write your first Rust program',
    status: overrides?.status ?? 'pending',
    order: overrides?.order ?? 1,
    createdAt: overrides?.createdAt ?? createTimestamp(),
    updatedAt: overrides?.updatedAt ?? createTimestamp(),
    scheduledDate: overrides?.scheduledDate ?? getTodayString(),
    dayNumber: overrides?.dayNumber ?? 1,
    objective: overrides?.objective ?? 'Understand basic syntax and write a hello world program',
    theme: overrides?.theme ?? 'Introduction',
    activities: overrides?.activities ?? [createTestActivity()],
    resources: overrides?.resources ?? [createTestStepResource()],
    estimatedMinutes: overrides?.estimatedMinutes ?? 60,
    startedAt: overrides?.startedAt,
    completedAt: overrides?.completedAt,
    actualMinutes: overrides?.actualMinutes,
    difficultyRating: overrides?.difficultyRating,
    needsRepair: overrides?.needsRepair,
    repairIssues: overrides?.repairIssues,
  };
}

/**
 * Create a step scheduled for today.
 */
export function createTodayStep(questId?: QuestId, overrides?: Partial<Step>): Step {
  return createTestStep(questId, {
    ...overrides,
    scheduledDate: getTodayString(),
    status: 'active',
  });
}

/**
 * Create a completed step.
 */
export function createCompletedStep(questId?: QuestId, overrides?: Partial<Step>): Step {
  const now = createTimestamp();
  return createTestStep(questId, {
    ...overrides,
    status: 'completed',
    startedAt: createTimestamp(new Date(Date.now() - 60 * 60 * 1000)),
    completedAt: now,
    actualMinutes: 55,
    difficultyRating: 3,
  });
}

/**
 * Create a sequence of steps for a quest.
 */
export function createStepSequence(questId: QuestId, count: number = 5): Step[] {
  const today = new Date();
  
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    return createTestStep(questId, {
      order: i + 1,
      dayNumber: i + 1,
      title: `Day ${i + 1}: ${['Hello World', 'Variables', 'Functions', 'Control Flow', 'Ownership'][i] ?? `Lesson ${i + 1}`}`,
      scheduledDate: toDateString(date),
      status: i === 0 ? 'active' : 'pending',
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTIVITY FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test activity with defaults.
 */
export function createTestActivity(overrides?: Partial<Activity>): Activity {
  return {
    type: overrides?.type ?? 'read',
    resourceId: overrides?.resourceId ?? createResourceId(),
    section: overrides?.section ?? 'Chapter 1',
    task: overrides?.task ?? 'Read the introduction',
    minutes: overrides?.minutes ?? 30,
  };
}

/**
 * Create a reading activity.
 */
export function createReadActivity(minutes: number = 30, section?: string): Activity {
  return createTestActivity({ type: 'read', minutes, section });
}

/**
 * Create a video watching activity.
 */
export function createWatchActivity(minutes: number = 20, section?: string): Activity {
  return createTestActivity({ type: 'watch', minutes, section: section ?? '0:00:00-0:20:00' });
}

/**
 * Create a coding activity.
 */
export function createCodeActivity(minutes: number = 45, task?: string): Activity {
  return createTestActivity({ type: 'code', minutes, task: task ?? 'Implement the examples' });
}

/**
 * Create an exercise activity.
 */
export function createExerciseActivity(minutes: number = 30, task?: string): Activity {
  return createTestActivity({ type: 'exercise', minutes, task: task ?? 'Complete exercises 1-5' });
}

// ─────────────────────────────────────────────────────────────────────────────────
// STEP RESOURCE FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test step resource with defaults.
 */
export function createTestStepResource(overrides?: Partial<StepResource>): StepResource {
  return {
    id: overrides?.id ?? createResourceId(),
    providerId: overrides?.providerId ?? 'rust-book-ch1',
    title: overrides?.title ?? 'The Rust Programming Language - Chapter 1',
    type: overrides?.type ?? 'documentation',
    url: overrides?.url ?? 'https://doc.rust-lang.org/book/ch01-00-getting-started.html',
    verificationLevel: overrides?.verificationLevel ?? 'strong',
  };
}

/**
 * Create a YouTube video resource.
 */
export function createYouTubeResource(videoId: string = 'dQw4w9WgXcQ'): StepResource {
  return createTestStepResource({
    providerId: videoId,
    title: 'Rust Crash Course',
    type: 'video',
    url: `https://youtube.com/watch?v=${videoId}`,
    verificationLevel: 'standard',
  });
}

/**
 * Create a GitHub resource.
 */
export function createGitHubResource(repo: string = 'rust-lang/rustlings'): StepResource {
  return createTestStepResource({
    providerId: repo,
    title: 'Rustlings - Small exercises',
    type: 'repository',
    url: `https://github.com/${repo}`,
    verificationLevel: 'strong',
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test spark with defaults.
 */
export function createTestSpark(
  stepId?: StepId,
  overrides?: Partial<Spark>
): Spark {
  return {
    id: overrides?.id ?? createSparkId(),
    stepId: stepId ?? overrides?.stepId ?? createStepId(),
    action: overrides?.action ?? 'Open Chapter 1 of the Rust Book and read the first section',
    status: overrides?.status ?? 'pending',
    createdAt: overrides?.createdAt ?? createTimestamp(),
    updatedAt: overrides?.updatedAt ?? createTimestamp(),
    variant: overrides?.variant ?? 'full',
    escalationLevel: overrides?.escalationLevel ?? 0,
    estimatedMinutes: overrides?.estimatedMinutes ?? 15,
    resourceId: overrides?.resourceId,
    resourceUrl: overrides?.resourceUrl,
    resourceSection: overrides?.resourceSection,
    scheduledTime: overrides?.scheduledTime,
    reminderIds: overrides?.reminderIds,
  };
}

/**
 * Create a spark at a specific escalation level.
 */
export function createSparkAtLevel(
  escalationLevel: number,
  stepId?: StepId,
  overrides?: Partial<Spark>
): Spark {
  const variants: SparkVariant[] = ['full', 'full', 'reduced', 'minimal'];
  const variant = variants[Math.min(escalationLevel, 3)] ?? 'minimal';
  const minutes = Math.max(5, Math.floor(30 / (escalationLevel + 1)));
  
  return createTestSpark(stepId, {
    ...overrides,
    escalationLevel,
    variant,
    estimatedMinutes: minutes,
  });
}

/**
 * Create a completed spark.
 */
export function createCompletedSpark(stepId?: StepId, overrides?: Partial<Spark>): Spark {
  return createTestSpark(stepId, {
    ...overrides,
    status: 'completed',
  });
}

/**
 * Create a skipped spark.
 */
export function createSkippedSpark(stepId?: StepId, overrides?: Partial<Spark>): Spark {
  return createTestSpark(stepId, {
    ...overrides,
    status: 'skipped',
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// REMINDER FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test reminder schedule with defaults.
 */
export function createTestReminder(
  userId?: UserId,
  overrides?: Partial<ReminderSchedule>
): ReminderSchedule {
  return {
    id: overrides?.id ?? createReminderId(),
    userId: userId ?? overrides?.userId ?? createUserId(),
    stepId: overrides?.stepId ?? createStepId(),
    sparkId: overrides?.sparkId ?? createSparkId(),
    scheduledTime: overrides?.scheduledTime ?? getScheduledTimeToday(9),
    escalationLevel: overrides?.escalationLevel ?? 0,
    sparkVariant: overrides?.sparkVariant ?? 'full',
    tone: overrides?.tone ?? 'encouraging',
    status: overrides?.status ?? 'pending',
    sentAt: overrides?.sentAt,
    acknowledgedAt: overrides?.acknowledgedAt,
    channels: overrides?.channels ?? { push: true, email: false, sms: false },
  };
}

/**
 * Create a reminder sequence for a spark (escalating).
 */
export function createReminderSequence(
  userId: UserId,
  stepId: StepId,
  sparkId: SparkId,
  count: number = 4
): ReminderSchedule[] {
  const tones: ReminderTone[] = ['encouraging', 'encouraging', 'gentle', 'last_chance'];
  const variants: SparkVariant[] = ['full', 'full', 'reduced', 'minimal'];
  
  return Array.from({ length: count }, (_, i) =>
    createTestReminder(userId, {
      stepId,
      sparkId,
      escalationLevel: i,
      sparkVariant: variants[i] ?? 'minimal',
      tone: tones[i] ?? 'last_chance',
      scheduledTime: getScheduledTimeToday(9 + i * 3),
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPLETE SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a complete goal with quests, steps, and sparks.
 */
export interface CompleteGoalScenario {
  goal: Goal;
  quests: Quest[];
  steps: Step[];
  sparks: Spark[];
  reminders: ReminderSchedule[];
}

/**
 * Create a complete "Learn Rust" scenario for testing.
 */
export function createLearnRustScenario(userId: UserId = TEST_USER_IDS.alice): CompleteGoalScenario {
  // Create goal
  const goal = createTestGoal(userId, {
    title: 'Learn Rust Programming',
    description: 'Master Rust from basics to advanced concepts',
  });
  
  // Create quests
  const quests = createQuestSequence(goal.id, 3);
  
  // Create steps for first quest (active)
  const steps = createStepSequence(quests[0]!.id, 5);
  
  // Create spark for today's step
  const todayStep = steps.find(s => s.scheduledDate === getTodayString()) ?? steps[0]!;
  const sparks = [createTestSpark(todayStep.id)];
  
  // Create reminders for the spark
  const reminders = createReminderSequence(userId, todayStep.id, sparks[0]!.id);
  
  return { goal, quests, steps, sparks, reminders };
}

// ─────────────────────────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get today's date as YYYY-MM-DD string.
 */
function getTodayString(): string {
  return toDateString(new Date());
}

/**
 * Convert date to YYYY-MM-DD string.
 */
function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

/**
 * Get an ISO timestamp for today at a specific hour.
 */
function getScheduledTimeToday(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}
