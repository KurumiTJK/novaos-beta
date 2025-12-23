// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER MODULE — Background Jobs and Scheduled Tasks
// NovaOS Scheduler — Phase 15: Enhanced Scheduler & Jobs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides cron-style scheduling for background jobs:
//
// Core Jobs:
// - Memory decay (reinforcement score decay)
// - Spark reminders (notification generation)
// - Goal deadline check-ins
// - Session cleanup
// - Conversation archival
// - Token cleanup
// - Metrics aggregation
// - Health monitoring
//
// Sword Jobs (Phase 15):
// - Generate daily steps (midnight)
// - Morning sparks (9 AM)
// - Reminder escalation (every 3 hours)
// - Day end reconciliation (11 PM)
// - Known sources health (weekly)
// - Retention enforcement (daily)
//
// Enhanced Features (Phase 15):
// - Distributed locking with fencing tokens
// - Dead letter queue for failed jobs
// - Retry with exponential backoff
// - Alerting on consecutive failures
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Job types
  JobId,
  SwordJobId,
  CoreJobId,
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
  // Notification types
  SparkReminder,
  GoalCheckin,
  // Lock types
  LockConfig,
  LockAcquisitionResult,
  // Dead letter types
  DeadLetterEntry,
  DeadLetterConfig,
  DeadLetterStats,
  DeadLetterQuery,
  // Retry types
  RetryConfig,
  // Runner types
  RunnerConfig,
  RunnerStats,
  // Job result types
  DailyStepsJobResult,
  MorningSparksJobResult,
  ReminderEscalationJobResult,
  DayEndReconciliationJobResult,
  KnownSourcesHealthJobResult,
  RetentionEnforcementJobResult,
} from './types.js';

export {
  // Default configs
  DEFAULT_LOCK_CONFIG,
  DEFAULT_DEAD_LETTER_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_RUNNER_CONFIG,
  // Utility functions
  calculateRetryDelay,
  shouldRetry,
  isSwordJobId,
  isJobId,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CRON
// ─────────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────────
// JOB DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  JOB_DEFINITIONS,
  CORE_JOB_DEFINITIONS,
  SWORD_JOB_DEFINITIONS,
  getJobDefinition,
  getEnabledJobs,
  getStartupJobs,
  getJobsByPriority,
  getSwordJobs,
  getCoreJobs,
  getAllJobDefinitions,
} from './jobs.js';

// ─────────────────────────────────────────────────────────────────────────────────
// JOB HANDLERS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  JOB_HANDLERS,
  getJobHandler,
  // Core handlers
  memoryDecayHandler,
  sparkRemindersHandler,
  goalDeadlineCheckinsHandler,
  sessionCleanupHandler,
  conversationCleanupHandler,
  expiredTokensCleanupHandler,
  metricsAggregationHandler,
  healthCheckHandler,
  // Sword handlers (Phase 15)
  generateDailyStepsHandler,
  morningSparksHandler,
  reminderEscalationHandler,
  dayEndReconciliationHandler,
  knownSourcesHealthHandler,
  retentionEnforcementHandler,
} from './handlers.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  Scheduler,
  getScheduler,
  createScheduler,
} from './scheduler.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOCKING (Phase 15)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  JobLockManager,
  createLockManager,
  type LockHandle,
  type WithLockResult,
} from './locking.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEAD LETTER QUEUE (Phase 15)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  DeadLetterQueue,
  createDeadLetterQueue,
} from './dead-letter.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RETRY UTILITIES (Phase 15)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Backoff strategies
  exponentialBackoff,
  linearBackoff,
  fixedDelay,
  noDelay,
  getDelayFunction,
  // Retry wrapper
  withRetry,
  makeRetryable,
  retryUntilSuccess,
  // Retry conditions
  retryConditions,
  // Circuit breaker
  createCircuitBreaker,
  // Types
  type BackoffStrategy,
  type RetryOptions,
  type RetryResult,
  type CircuitBreakerState,
  type CircuitBreakerOptions,
} from './retry.js';

// ─────────────────────────────────────────────────────────────────────────────────
// JOB RUNNER (Phase 15)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  JobRunner,
  createJobRunner,
  type JobRunnerEvent,
  type JobRunnerEventData,
} from './runner.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SWORD JOB HANDLERS (Direct exports from jobs/)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  SWORD_JOB_HANDLERS,
  swordJobHandlers,
  getSwordJobHandler,
  getSwordRegisteredJobIds,
  hasSwordJobHandler,
} from './jobs/index.js';
