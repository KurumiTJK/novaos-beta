// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER TYPES — Job Definitions and Status Tracking
// NovaOS Scheduler — Phase 15: Enhanced Scheduler & Jobs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Combined types for:
// - Core scheduler jobs (memory, sessions, cleanup, health)
// - Sword system jobs (daily steps, sparks, reminders, reconciliation)
// - Phase 15 enhancements (locking, dead letter, retry)
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// JOB IDENTIFIERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * All scheduled job identifiers.
 */
export type JobId = 
  // Core scheduler jobs
  | 'memory_decay'
  | 'spark_reminders'
  | 'goal_deadline_checkins'
  | 'session_cleanup'
  | 'conversation_cleanup'
  | 'expired_tokens_cleanup'
  | 'metrics_aggregation'
  | 'health_check'
  // Sword system jobs (Phase 15)
  | 'generate_daily_steps'
  | 'morning_sparks'
  | 'reminder_escalation'
  | 'day_end_reconciliation'
  | 'known_sources_health'
  | 'retention_enforcement';

/**
 * Sword-specific job identifiers.
 */
export type SwordJobId = 
  | 'generate_daily_steps'
  | 'morning_sparks'
  | 'reminder_escalation'
  | 'day_end_reconciliation'
  | 'known_sources_health'
  | 'retention_enforcement';

/**
 * Core scheduler job identifiers.
 */
export type CoreJobId = Exclude<JobId, SwordJobId>;

export type JobStatus = 
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'disabled';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

// ─────────────────────────────────────────────────────────────────────────────────
// CRON SCHEDULE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Simplified cron-like schedule.
 * 
 * intervalMs: Run every X milliseconds
 * OR
 * cron: Standard cron expression (minute hour dayOfMonth month dayOfWeek)
 * 
 * Examples:
 *   { intervalMs: 60000 }           - Every minute
 *   { intervalMs: 3600000 }         - Every hour
 *   { cron: '0 * * * *' }           - Top of every hour
 *   { cron: '0 0 * * *' }           - Midnight daily
 *   { cron: '0 3 * * 0' }           - 3 AM every Sunday
 */
export interface JobSchedule {
  intervalMs?: number;
  cron?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// JOB DEFINITION
// ─────────────────────────────────────────────────────────────────────────────────

export interface JobDefinition {
  id: JobId;
  name: string;
  description: string;
  schedule: JobSchedule;
  priority: JobPriority;
  timeout: number;           // Max execution time in ms
  retryAttempts: number;     // Number of retries on failure
  retryDelayMs: number;      // Delay between retries
  enabled: boolean;
  
  // Optional constraints
  requiresRedis?: boolean;   // Only run if Redis is available
  runOnStartup?: boolean;    // Run immediately on scheduler start
  exclusive?: boolean;       // Don't run if another instance is running
  
  // Enhanced options (Phase 15)
  handler?: string;                // Handler identifier
  maxRetryDelayMs?: number;        // Max delay for exponential backoff
  exponentialBackoff?: boolean;    // Use exponential backoff
  alertOnFailure?: boolean;        // Fire alert on failure
  deadLetterOnFailure?: boolean;   // Add to dead letter queue on failure
}

// ─────────────────────────────────────────────────────────────────────────────────
// JOB EXECUTION
// ─────────────────────────────────────────────────────────────────────────────────

export interface JobContext {
  jobId: JobId;
  executionId: string;
  startedAt: number;
  attempt: number;
  previousResult?: JobResult;
  lockedBy?: string;        // Instance ID holding lock (Phase 15)
  fencingToken?: number;    // Fencing token for distributed lock (Phase 15)
}

export interface JobResult {
  success: boolean;
  duration: number;
  itemsProcessed?: number;
  errors?: string[];
  metadata?: Record<string, unknown>;
}

export interface JobExecution {
  id: string;
  jobId: JobId;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  attempt: number;
  result?: JobResult;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// JOB STATE
// ─────────────────────────────────────────────────────────────────────────────────

export interface JobState {
  jobId: JobId;
  status: JobStatus;
  lastRun?: string;
  lastSuccess?: string;
  lastFailure?: string;
  lastDuration?: number;
  runCount: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  nextScheduledRun?: string;
  currentExecutionId?: string;
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEDULER STATE
// ─────────────────────────────────────────────────────────────────────────────────

export interface SchedulerState {
  running: boolean;
  startedAt?: string;
  jobs: Record<JobId, JobState>;
  instanceId: string;
  totalExecutions: number;
  totalSuccesses: number;
  totalFailures: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// JOB HANDLER TYPE
// ─────────────────────────────────────────────────────────────────────────────────

export type JobHandler = (context: JobContext) => Promise<JobResult>;

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEDULER EVENTS
// ─────────────────────────────────────────────────────────────────────────────────

export type SchedulerEventType =
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_retry'
  | 'job_timeout'
  | 'job_dead_lettered'   // Phase 15
  | 'scheduler_started'
  | 'scheduler_stopped';

export interface SchedulerEvent {
  type: SchedulerEventType;
  timestamp: string;
  jobId?: JobId;
  executionId?: string;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TYPES (for Spark reminders)
// ─────────────────────────────────────────────────────────────────────────────────

export interface SparkReminder {
  userId: string;
  sparkId: string;
  action: string;
  createdAt: string;
  reminderType: 'gentle' | 'deadline' | 'expiring';
  delivered: boolean;
  deliveredAt?: string;
}

export interface GoalCheckin {
  userId: string;
  goalId: string;
  goalTitle: string;
  progress: number;
  daysUntilDeadline?: number;
  blockers: string[];
  checkInType: 'progress' | 'deadline_approaching' | 'stalled' | 'milestone';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 15 TYPES — Enhanced Scheduler Components
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LOCK TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface LockConfig {
  /** Default lock TTL in milliseconds */
  ttlMs: number;
  /** Number of retries to acquire lock */
  retries: number;
  /** Delay between retries in milliseconds */
  retryDelayMs: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
  /** Auto-extend interval (0 to disable) */
  autoExtendMs: number;
}

export const DEFAULT_LOCK_CONFIG: LockConfig = {
  ttlMs: 60000,           // 1 minute
  retries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
  autoExtendMs: 30000,    // Extend every 30 seconds
};

export interface LockAcquisitionResult {
  acquired: boolean;
  fencingToken?: number;
  owner?: string;
  expiresAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEAD LETTER TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface DeadLetterEntry {
  id: string;
  jobId: JobId;
  context: JobContext;
  attempts: number;
  errors: string[];
  lastResult?: JobResult;
  addedAt: string;
  fingerprint: string;
  investigated: boolean;
  investigationNotes?: string;
}

export interface DeadLetterConfig {
  /** Retention period in milliseconds */
  retentionMs: number;
  /** Maximum entries to keep */
  maxEntries: number;
}

export const DEFAULT_DEAD_LETTER_CONFIG: DeadLetterConfig = {
  retentionMs: 7 * 24 * 60 * 60 * 1000,  // 7 days
  maxEntries: 1000,
};

export interface DeadLetterStats {
  total: number;
  uninvestigated: number;
  byJob: Record<string, number>;
  oldestEntry?: string;
  newestEntry?: string;
}

export interface DeadLetterQuery {
  jobId?: JobId;
  investigated?: boolean;
  since?: string;
  limit?: number;
  offset?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RETRY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Calculate retry delay with exponential backoff and jitter.
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);
  
  // Add jitter
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Check if retry should be attempted.
 */
export function shouldRetry(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  return attempt < config.maxAttempts;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RUNNER TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface RunnerConfig {
  /** Instance identifier for distributed locking */
  instanceId?: string;
  /** Lock configuration */
  lock?: Partial<LockConfig>;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Dead letter configuration */
  deadLetter?: Partial<DeadLetterConfig>;
  /** Enable alerting on failures */
  alertingEnabled?: boolean;
  /** Maximum consecutive failures before alerting */
  maxConsecutiveFailures?: number;
}

export const DEFAULT_RUNNER_CONFIG: Required<RunnerConfig> = {
  instanceId: `runner-${Date.now().toString(36)}`,
  lock: DEFAULT_LOCK_CONFIG,
  retry: DEFAULT_RETRY_CONFIG,
  deadLetter: DEFAULT_DEAD_LETTER_CONFIG,
  alertingEnabled: true,
  maxConsecutiveFailures: 3,
};

export interface RunnerStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  retriedRuns: number;
  skippedRuns: number;
  deadLetteredRuns: number;
  averageDurationMs: number;
  lastRunAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SWORD JOB RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface DailyStepsJobResult {
  usersProcessed: number;
  stepsGenerated: number;
  usersSkipped: number;
  errorsByUser?: Record<string, string>;
}

export interface MorningSparksJobResult {
  usersProcessed: number;
  sparksCreated: number;
  usersWithNoSteps: number;
  usersWithExistingSparks: number;
}

export interface ReminderEscalationJobResult {
  sparksProcessed: number;
  remindersEscalated: number;
  sparksExpired: number;
  remindersQueued: number;
}

export interface DayEndReconciliationJobResult {
  usersProcessed: number;
  stepsMarkedMissed: number;
  stepsCompleted: number;
  streaksBroken: number;
}

export interface KnownSourcesHealthJobResult {
  sourcesChecked: number;
  sourcesHealthy: number;
  sourcesDegraded: number;
  sourcesFailed: number;
  newlyDisabled: number;
}

export interface RetentionEnforcementJobResult {
  keysScanned: number;
  keysDeleted: number;
  keysArchived: number;
  bytesReclaimed: number;
  policiesApplied: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

const SWORD_JOB_IDS: Set<string> = new Set([
  'generate_daily_steps',
  'morning_sparks',
  'reminder_escalation',
  'day_end_reconciliation',
  'known_sources_health',
  'retention_enforcement',
]);

export function isSwordJobId(jobId: string): jobId is SwordJobId {
  return SWORD_JOB_IDS.has(jobId);
}

export function isJobId(value: string): value is JobId {
  return SWORD_JOB_IDS.has(value) || [
    'memory_decay',
    'spark_reminders',
    'goal_deadline_checkins',
    'session_cleanup',
    'conversation_cleanup',
    'expired_tokens_cleanup',
    'metrics_aggregation',
    'health_check',
  ].includes(value);
}
