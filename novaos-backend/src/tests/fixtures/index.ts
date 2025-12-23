// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURE EXPORTS — Central Export for All Test Fixtures
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// USER FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  createTestUser,
  createFreeUser,
  createProUser,
  createEnterpriseUser,
  createAdminUser,
  createUserMetadata,
  createTestRequestContext,
  createAnonymousRequestContext,
  TEST_USER_IDS,
  TEST_USERS,
} from './users.js';

// ─────────────────────────────────────────────────────────────────────────────────
// GOAL FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Goals
  createTestGoal,
  createGoalWithStatus,
  createActiveGoal,
  createCompletedGoal,
  createPausedGoal,
  
  // Learning Config
  createDefaultLearningConfig,
  createBeginnerLearningConfig,
  createAdvancedLearningConfig,
  
  // Reminder Config
  createDefaultReminderConfig,
  createAllChannelsReminderConfig,
  createWeekendQuietReminderConfig,
  
  // Quests
  createTestQuest,
  createQuestWithStatus,
  createQuestSequence,
  
  // Steps
  createTestStep,
  createTodayStep,
  createCompletedStep,
  createStepSequence,
  
  // Activities
  createTestActivity,
  createReadActivity,
  createWatchActivity,
  createCodeActivity,
  createExerciseActivity,
  
  // Resources
  createTestStepResource,
  createYouTubeResource,
  createGitHubResource,
  
  // Sparks
  createTestSpark,
  createSparkAtLevel,
  createCompletedSpark,
  createSkippedSpark,
  
  // Reminders
  createTestReminder,
  createReminderSequence,
  
  // Scenarios
  createLearnRustScenario,
  type CompleteGoalScenario,
} from './goals.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORT BRANDED ID CREATORS FOR CONVENIENCE
// ─────────────────────────────────────────────────────────────────────────────────

export {
  createGoalId,
  createQuestId,
  createStepId,
  createSparkId,
  createReminderId,
  createResourceId,
  createUserId,
  createTimestamp,
  createRequestId,
  createCorrelationId,
  createSessionId,
} from '../../types/branded.js';
