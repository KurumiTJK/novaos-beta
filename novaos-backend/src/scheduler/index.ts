// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER MODULE — Background Jobs and Scheduled Tasks
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides cron-style scheduling for background jobs:
// - Memory decay (reinforcement score decay)
// - Spark reminders (notification generation)
// - Goal deadline check-ins
// - Session cleanup
// - Conversation archival
// - Token cleanup
// - Metrics aggregation
// - Health monitoring
//
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export type {
  JobId,
  JobStatus,
  JobPriority,
  JobSchedule,
  JobDefinition,
  JobContext,
  JobResult,
  JobExecution,
  JobState,
  JobHandler,
  SchedulerState,
  SchedulerEventType,
  SchedulerEvent,
  SparkReminder,
  GoalCheckin,
} from './types.js';

// Cron
export {
  parseCron,
  matchesCron,
  shouldRunNow,
  getNextRun,
  getTimeUntilNextRun,
  describeCron,
  CRON_PRESETS,
  type CronFields,
  type ParsedCron,
} from './cron.js';

// Job Definitions
export {
  JOB_DEFINITIONS,
  getJobDefinition,
  getEnabledJobs,
  getStartupJobs,
  getJobsByPriority,
} from './jobs.js';

// Job Handlers
export {
  JOB_HANDLERS,
  getJobHandler,
  memoryDecayHandler,
  sparkRemindersHandler,
  goalDeadlineCheckinsHandler,
  sessionCleanupHandler,
  conversationCleanupHandler,
  expiredTokensCleanupHandler,
  metricsAggregationHandler,
  healthCheckHandler,
} from './handlers.js';

// Scheduler
export {
  Scheduler,
  getScheduler,
  createScheduler,
} from './scheduler.js';
