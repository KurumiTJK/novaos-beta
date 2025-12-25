// ═══════════════════════════════════════════════════════════════════════════════
// JOB RUNNER — Enhanced Job Execution Engine
// NovaOS Scheduler — Phase 15: Enhanced Scheduler & Jobs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Orchestrates job execution with:
//   - Distributed locking for exclusive jobs
//   - Retry logic with configurable backoff
//   - Dead letter queue for failed jobs
//   - Alerting on consecutive failures
//   - Comprehensive metrics and logging
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { RedisStore } from '../infrastructure/redis/client.js';
import type { KeyValueStore } from '../storage/index.js';
import { getLogger } from '../observability/logging/index.js';
import { incCounter, setGauge, observeHistogram } from '../observability/metrics/index.js';
import { fireWarning, fireCritical } from '../observability/alerting/service.js';

import type {
  JobId,
  JobDefinition,
  JobContext,
  JobResult,
  JobHandler,
  RunnerConfig,
  RunnerStats,
} from './types.js';
import { DEFAULT_RUNNER_CONFIG, calculateRetryDelay } from './types.js';
import { JobLockManager, type LockHandle } from './locking.js';
import { DeadLetterQueue } from './dead-letter.js';
import { withRetry, type RetryOptions } from './retry.js';
import { EventEmitter } from 'events';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'job-runner' });

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type JobRunnerEvent =
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_retry'
  | 'job_dead_lettered'
  | 'lock_acquired'
  | 'lock_released';

export interface JobRunnerEventData {
  jobId: JobId;
  executionId: string;
  timestamp: string;
  result?: JobResult;
  error?: string;
  attempt?: number;
  fencingToken?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// JOB RUNNER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Enhanced job runner with locking, retries, and dead letter support.
 */
export class JobRunner extends EventEmitter {
  private readonly store: RedisStore | KeyValueStore;
  private readonly config: Required<RunnerConfig>;
  private readonly lockManager: JobLockManager;
  private readonly deadLetterQueue: DeadLetterQueue;
  private readonly handlers: Map<JobId, JobHandler> = new Map();
  private readonly stats: RunnerStats;
  private readonly consecutiveFailures: Map<JobId, number> = new Map();
  private shutdownRequested: boolean = false;

  constructor(
    store: RedisStore | KeyValueStore,
    config?: Partial<RunnerConfig>
  ) {
    super();

    this.store = store;
    this.config = {
      ...DEFAULT_RUNNER_CONFIG,
      ...config,
      lock: { ...DEFAULT_RUNNER_CONFIG.lock, ...config?.lock },
      retry: { ...DEFAULT_RUNNER_CONFIG.retry, ...config?.retry },
      deadLetter: { ...DEFAULT_RUNNER_CONFIG.deadLetter, ...config?.deadLetter },
    } as Required<RunnerConfig>;

    this.lockManager = new JobLockManager(
      store,
      this.config.instanceId,
      this.config.lock
    );

    this.deadLetterQueue = new DeadLetterQueue(
      store as KeyValueStore,
      this.config.deadLetter
    );

    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      retriedRuns: 0,
      skippedRuns: 0,
      deadLetteredRuns: 0,
      averageDurationMs: 0,
    };

    logger.info('JobRunner initialized', {
      instanceId: this.config.instanceId,
      alertingEnabled: this.config.alertingEnabled,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Handler Registration
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register a job handler.
   */
  registerHandler(jobId: JobId, handler: JobHandler): void {
    this.handlers.set(jobId, handler);
    logger.debug('Handler registered', { jobId });
  }

  /**
   * Register multiple handlers.
   */
  registerHandlers(handlers: Map<JobId, JobHandler> | Record<JobId, JobHandler>): void {
    const entries = handlers instanceof Map
      ? handlers.entries()
      : Object.entries(handlers) as Iterable<[JobId, JobHandler]>;

    for (const [jobId, handler] of entries) {
      this.registerHandler(jobId, handler);
    }
  }

  /**
   * Get registered handler.
   */
  getHandler(jobId: JobId): JobHandler | undefined {
    return this.handlers.get(jobId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Job Execution
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Run a job with full orchestration.
   */
  async run(job: JobDefinition): Promise<JobResult | null> {
    if (this.shutdownRequested) {
      logger.warn('Run rejected: shutdown in progress', { jobId: job.id });
      return null;
    }

    // Check if job is enabled
    if (!job.enabled) {
      logger.debug('Job is disabled, skipping', { jobId: job.id });
      this.stats.skippedRuns++;
      return null;
    }

    // Get handler
    const handler = this.handlers.get(job.id);
    if (!handler) {
      logger.warn('No handler registered for job', { jobId: job.id });
      this.stats.skippedRuns++;
      return null;
    }

    const executionId = this.generateExecutionId(job.id);
    const startTime = Date.now();

    logger.info('Starting job execution', {
      jobId: job.id,
      executionId,
      exclusive: job.exclusive,
    });

    // Handle exclusive jobs with locking
    if (job.exclusive) {
      return this.runExclusive(job, handler, executionId, startTime);
    }

    // Run non-exclusive job directly
    return this.executeWithRetry(job, handler, executionId, startTime);
  }

  /**
   * Run an exclusive job with distributed locking.
   */
  private async runExclusive(
    job: JobDefinition,
    handler: JobHandler,
    executionId: string,
    startTime: number
  ): Promise<JobResult | null> {
    const lockResult = await this.lockManager.withLock(
      job.id,
      async (lock) => {
        this.emitEvent('lock_acquired', {
          jobId: job.id,
          executionId,
          fencingToken: lock.fencingToken,
        });

        return this.executeWithRetry(job, handler, executionId, startTime, lock.fencingToken);
      },
      { ttlMs: job.timeout + 30000 } // Lock TTL = timeout + buffer
    );

    if (!lockResult.acquired) {
      logger.debug('Could not acquire lock, job already running', { jobId: job.id });
      this.stats.skippedRuns++;
      incCounter('scheduler_job_skipped_total', { jobId: job.id, reason: 'locked' });
      return null;
    }

    this.emitEvent('lock_released', { jobId: job.id, executionId });

    if (lockResult.error) {
      throw lockResult.error;
    }

    return lockResult.result ?? null;
  }

  /**
   * Execute job with retry logic.
   */
  private async executeWithRetry(
    job: JobDefinition,
    handler: JobHandler,
    executionId: string,
    startTime: number,
    fencingToken?: number
  ): Promise<JobResult | null> {
    const maxAttempts = job.retryAttempts + 1;
    let lastResult: JobResult | null = null;
    let attempt = 0;

    this.stats.totalRuns++;
    this.emitEvent('job_started', { jobId: job.id, executionId });

    while (attempt < maxAttempts) {
      attempt++;

      const context: JobContext = {
        jobId: job.id,
        executionId,
        startedAt: startTime,
        attempt,
        previousResult: lastResult ?? undefined,
        lockedBy: this.config.instanceId,
        fencingToken,
      };

      try {
        // Execute with timeout
        lastResult = await this.executeWithTimeout(handler, context, job.timeout);

        if (lastResult.success) {
          // Success!
          this.handleSuccess(job, executionId, lastResult);
          return lastResult;
        }

        // Job returned failure
        logger.warn('Job returned failure result', {
          jobId: job.id,
          executionId,
          attempt,
          errors: lastResult.errors,
        });

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        lastResult = {
          success: false,
          duration: Date.now() - startTime,
          errors: [err.message],
        };

        logger.error('Job execution error', err, {
          jobId: job.id,
          executionId,
          attempt,
        });
      }

      // Check if retry is possible
      if (attempt < maxAttempts) {
        const delay = job.exponentialBackoff
          ? calculateRetryDelay(attempt, {
              maxAttempts,
              initialDelayMs: job.retryDelayMs,
              maxDelayMs: job.maxRetryDelayMs ?? job.retryDelayMs * 4,
              backoffMultiplier: 2,
              jitterFactor: 0.1,
            })
          : job.retryDelayMs;

        this.stats.retriedRuns++;
        this.emitEvent('job_retry', {
          jobId: job.id,
          executionId,
          attempt,
        });

        incCounter('scheduler_job_retry_total', { jobId: job.id });

        logger.info('Retrying job', {
          jobId: job.id,
          executionId,
          attempt,
          nextAttempt: attempt + 1,
          delayMs: delay,
        });

        await this.sleep(delay);
      }
    }

    // All retries exhausted
    await this.handleFailure(job, executionId, lastResult, attempt);
    return lastResult;
  }

  /**
   * Execute handler with timeout.
   */
  private async executeWithTimeout(
    handler: JobHandler,
    context: JobContext,
    timeoutMs: number
  ): Promise<JobResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Job ${context.jobId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      handler(context)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Result Handling
  // ─────────────────────────────────────────────────────────────────────────────

  private handleSuccess(
    job: JobDefinition,
    executionId: string,
    result: JobResult
  ): void {
    this.stats.successfulRuns++;
    this.consecutiveFailures.set(job.id, 0);

    // Update average duration
    this.updateAverageDuration(result.duration);

    this.emitEvent('job_completed', {
      jobId: job.id,
      executionId,
      result,
    });

    incCounter('scheduler_job_success_total', { jobId: job.id });
    observeHistogram('scheduler_job_duration_ms', result.duration, { jobId: job.id });

    logger.info('Job completed successfully', {
      jobId: job.id,
      executionId,
      durationMs: result.duration,
      itemsProcessed: result.itemsProcessed,
    });
  }

  private async handleFailure(
    job: JobDefinition,
    executionId: string,
    result: JobResult | null,
    attempts: number
  ): Promise<void> {
    this.stats.failedRuns++;

    // Track consecutive failures
    const consecutive = (this.consecutiveFailures.get(job.id) ?? 0) + 1;
    this.consecutiveFailures.set(job.id, consecutive);

    this.emitEvent('job_failed', {
      jobId: job.id,
      executionId,
      result: result ?? undefined,
      error: result?.errors?.join('; '),
    });

    incCounter('scheduler_job_failure_total', { jobId: job.id });
    setGauge('scheduler_job_consecutive_failures', consecutive, { jobId: job.id });

    logger.error('Job failed after all retries', undefined, {
      jobId: job.id,
      executionId,
      attempts,
      consecutiveFailures: consecutive,
      errors: result?.errors,
    });

    // Dead letter if configured
    if (job.deadLetterOnFailure) {
      await this.addToDeadLetter(job, executionId, result, attempts);
    }

    // Alert if configured
    if (job.alertOnFailure && this.config.alertingEnabled) {
      await this.sendAlert(job, executionId, result, consecutive);
    }
  }

  private async addToDeadLetter(
    job: JobDefinition,
    executionId: string,
    result: JobResult | null,
    attempts: number
  ): Promise<void> {
    try {
      const context: JobContext = {
        jobId: job.id,
        executionId,
        startedAt: Date.now(),
        attempt: attempts,
      };

      await this.deadLetterQueue.add(
        context,
        result?.errors ?? ['Unknown error'],
        result ?? undefined
      );

      this.stats.deadLetteredRuns++;
      this.emitEvent('job_dead_lettered', { jobId: job.id, executionId });

      logger.info('Job added to dead letter queue', {
        jobId: job.id,
        executionId,
      });
    } catch (error) {
      logger.error('Failed to add to dead letter queue',
        error instanceof Error ? error : new Error(String(error)), {
        jobId: job.id,
        executionId,
      });
    }
  }

  private async sendAlert(
    job: JobDefinition,
    executionId: string,
    result: JobResult | null,
    consecutiveFailures: number
  ): Promise<void> {
    try {
      const message = `Job ${job.id} failed: ${result?.errors?.join('; ') ?? 'Unknown error'}`;
      const details = {
        jobId: job.id,
        executionId,
        consecutiveFailures,
        errors: result?.errors,
      };

      if (consecutiveFailures >= this.config.maxConsecutiveFailures) {
        await fireCritical(`scheduler_job_${job.id}_critical`, message, {});
      } else {
        await fireWarning(`scheduler_job_${job.id}_failed`, message, {});
      }
    } catch (error) {
      logger.error('Failed to send alert',
        error instanceof Error ? error : new Error(String(error)), {
        jobId: job.id,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // State & Stats
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get runner statistics.
   */
  getStats(): RunnerStats {
    return { ...this.stats };
  }

  /**
   * Get dead letter queue instance.
   */
  getDeadLetterQueue(): DeadLetterQueue {
    return this.deadLetterQueue;
  }

  /**
   * Get lock manager instance.
   */
  getLockManager(): JobLockManager {
    return this.lockManager;
  }

  /**
   * Graceful shutdown.
   */
  async shutdown(): Promise<void> {
    logger.info('JobRunner shutting down');
    this.shutdownRequested = true;

    // Release all locks
    await this.lockManager.releaseAll();

    logger.info('JobRunner shutdown complete');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private generateExecutionId(jobId: JobId): string {
    return `${jobId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private emitEvent(event: JobRunnerEvent, data: Partial<JobRunnerEventData>): void {
    const eventData: JobRunnerEventData = {
      jobId: data.jobId!,
      executionId: data.executionId ?? '',
      timestamp: new Date().toISOString(),
      ...data,
    };

    this.emit(event, eventData);
  }

  private updateAverageDuration(duration: number): void {
    const n = this.stats.successfulRuns;
    this.stats.averageDurationMs =
      (this.stats.averageDurationMs * (n - 1) + duration) / n;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new job runner.
 */
export function createJobRunner(
  store: RedisStore | KeyValueStore,
  config?: Partial<RunnerConfig>
): JobRunner {
  return new JobRunner(store, config);
}
