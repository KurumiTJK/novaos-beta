// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER TYPES — Job Definitions and Status Tracking
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// JOB IDENTIFIERS
// ─────────────────────────────────────────────────────────────────────────────────

export type JobId = 
  | 'memory_decay'
  | 'spark_reminders'
  | 'goal_deadline_checkins'
  | 'session_cleanup'
  | 'conversation_cleanup'
  | 'expired_tokens_cleanup'
  | 'metrics_aggregation'
  | 'health_check';

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
