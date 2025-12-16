// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER — Job Orchestration Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Manages scheduled background jobs with:
// - Cron-style scheduling
// - Interval-based scheduling
// - Job locking (prevents duplicate runs)
// - Retry logic with backoff
// - Execution history
// - Graceful shutdown
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  JobId,
  JobDefinition,
  JobState,
  JobContext,
  JobResult,
  JobExecution,
  JobHandler,
  SchedulerState,
  SchedulerEvent,
  SchedulerEventType,
} from './types.js';
import { JOB_DEFINITIONS, getJobDefinition, getEnabledJobs, getStartupJobs } from './jobs.js';
import { JOB_HANDLERS, getJobHandler } from './handlers.js';
import { parseCron, shouldRunNow, getNextRun } from './cron.js';
import { getStore, storeManager, type KeyValueStore } from '../storage/index.js';
import { getLogger } from '../logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const SCHEDULER_TICK_MS = 60000; // Check jobs every minute
const LOCK_TTL_SECONDS = 3600;   // Job lock expires after 1 hour
const MAX_EXECUTION_HISTORY = 100;

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'scheduler' });

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEDULER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class Scheduler {
  private instanceId: string;
  private running: boolean = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private jobStates: Map<JobId, JobState> = new Map();
  private executionHistory: JobExecution[] = [];
  private eventListeners: Array<(event: SchedulerEvent) => void> = [];
  private store: KeyValueStore;
  private startedAt?: Date;
  
  // Statistics
  private totalExecutions = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;
  
  constructor() {
    this.instanceId = `scheduler-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.store = getStore();
    this.initializeJobStates();
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  private initializeJobStates(): void {
    for (const job of Object.values(JOB_DEFINITIONS)) {
      this.jobStates.set(job.id, {
        jobId: job.id,
        status: job.enabled ? 'idle' : 'disabled',
        runCount: 0,
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        isLocked: false,
      });
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // START / STOP
  // ─────────────────────────────────────────────────────────────────────────────
  
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Scheduler already running');
      return;
    }
    
    logger.info('Starting scheduler', { instanceId: this.instanceId });
    this.running = true;
    this.startedAt = new Date();
    
    // Run startup jobs
    const startupJobs = getStartupJobs();
    for (const job of startupJobs) {
      logger.info(`Running startup job: ${job.id}`);
      await this.executeJob(job.id).catch(err => {
        logger.error(`Startup job ${job.id} failed`, err);
      });
    }
    
    // Start tick interval
    this.tickInterval = setInterval(() => this.tick(), SCHEDULER_TICK_MS);
    
    // Run first tick immediately
    await this.tick();
    
    this.emitEvent('scheduler_started', undefined);
    logger.info('Scheduler started', { 
      instanceId: this.instanceId,
      enabledJobs: getEnabledJobs().map(j => j.id),
    });
  }
  
  async stop(): Promise<void> {
    if (!this.running) {
      logger.warn('Scheduler not running');
      return;
    }
    
    logger.info('Stopping scheduler', { instanceId: this.instanceId });
    this.running = false;
    
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    
    // Release all locks held by this instance
    for (const [jobId, state] of this.jobStates) {
      if (state.isLocked && state.lockedBy === this.instanceId) {
        await this.releaseLock(jobId);
      }
    }
    
    this.emitEvent('scheduler_stopped', undefined);
    logger.info('Scheduler stopped');
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TICK (main loop)
  // ─────────────────────────────────────────────────────────────────────────────
  
  private async tick(): Promise<void> {
    if (!this.running) return;
    
    const now = new Date();
    const enabledJobs = getEnabledJobs();
    
    for (const job of enabledJobs) {
      try {
        const shouldRun = this.shouldJobRun(job, now);
        if (shouldRun) {
          // Run in background (don't await)
          this.executeJob(job.id).catch(err => {
            logger.error(`Job ${job.id} failed`, err);
          });
        }
      } catch (error) {
        logger.error(`Error checking job ${job.id}`, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
  
  private shouldJobRun(job: JobDefinition, now: Date): boolean {
    const state = this.jobStates.get(job.id);
    if (!state) return false;
    
    // Don't run if disabled
    if (state.status === 'disabled') return false;
    
    // Don't run if already running (for exclusive jobs)
    if (job.exclusive && state.status === 'running') return false;
    
    // Check schedule
    if (job.schedule.intervalMs) {
      // Interval-based
      if (!state.lastRun) return true;
      const elapsed = now.getTime() - new Date(state.lastRun).getTime();
      return elapsed >= job.schedule.intervalMs;
    } else if (job.schedule.cron) {
      // Cron-based
      return shouldRunNow(job.schedule.cron, now);
    }
    
    return false;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // JOB EXECUTION
  // ─────────────────────────────────────────────────────────────────────────────
  
  async executeJob(jobId: JobId, force: boolean = false): Promise<JobResult | null> {
    const job = getJobDefinition(jobId);
    if (!job) {
      logger.warn(`Unknown job: ${jobId}`);
      return null;
    }
    
    const handler = getJobHandler(jobId);
    if (!handler) {
      logger.warn(`No handler for job: ${jobId}`);
      return null;
    }
    
    const state = this.jobStates.get(jobId);
    if (!state) return null;
    
    // Check if job is enabled (unless forced)
    if (!force && !job.enabled) {
      logger.debug(`Job ${jobId} is disabled`);
      return null;
    }
    
    // Check Redis requirement
    if (job.requiresRedis && !storeManager.isUsingRedis()) {
      logger.debug(`Job ${jobId} requires Redis but it's not available`);
      return null;
    }
    
    // Try to acquire lock for exclusive jobs
    if (job.exclusive) {
      const locked = await this.acquireLock(jobId);
      if (!locked) {
        logger.debug(`Job ${jobId} is locked by another instance`);
        return null;
      }
    }
    
    // Execute with retries
    const executionId = `${jobId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    let result: JobResult | null = null;
    let attempt = 0;
    
    while (attempt <= job.retryAttempts) {
      attempt++;
      
      const context: JobContext = {
        jobId,
        executionId,
        startedAt: Date.now(),
        attempt,
        previousResult: result ?? undefined,
      };
      
      // Update state
      state.status = 'running';
      state.currentExecutionId = executionId;
      
      this.emitEvent('job_started', jobId, executionId);
      logger.info(`Job ${jobId} started`, { executionId, attempt });
      
      try {
        // Execute with timeout
        result = await this.executeWithTimeout(handler, context, job.timeout);
        
        if (result.success) {
          // Success
          state.status = 'completed';
          state.lastSuccess = new Date().toISOString();
          state.consecutiveFailures = 0;
          state.successCount++;
          this.totalSuccesses++;
          
          this.emitEvent('job_completed', jobId, executionId);
          logger.info(`Job ${jobId} completed`, { 
            executionId, 
            duration: result.duration,
            itemsProcessed: result.itemsProcessed,
          });
          
          break;
        } else {
          // Failure
          if (attempt <= job.retryAttempts) {
            this.emitEvent('job_retry', jobId, executionId);
            logger.warn(`Job ${jobId} failed, retrying`, { 
              executionId, 
              attempt, 
              maxAttempts: job.retryAttempts + 1,
              errors: result.errors,
            });
            
            // Wait before retry
            await this.sleep(job.retryDelayMs * attempt);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result = {
          success: false,
          duration: Date.now() - context.startedAt,
          errors: [errorMsg],
        };
        
        if (attempt <= job.retryAttempts) {
          this.emitEvent('job_retry', jobId, executionId);
          logger.warn(`Job ${jobId} threw error, retrying`, { 
            executionId, 
            attempt,
            error: errorMsg,
          });
          
          await this.sleep(job.retryDelayMs * attempt);
        }
      }
    }
    
    // Final state update
    if (!result?.success) {
      state.status = 'failed';
      state.lastFailure = new Date().toISOString();
      state.consecutiveFailures++;
      state.failureCount++;
      this.totalFailures++;
      
      this.emitEvent('job_failed', jobId, executionId);
      logger.error(`Job ${jobId} failed after ${attempt} attempts`, undefined, {
        executionId,
        errors: result?.errors,
      });
    }
    
    // Update common state
    state.lastRun = new Date().toISOString();
    state.lastDuration = result?.duration;
    state.runCount++;
    state.currentExecutionId = undefined;
    this.totalExecutions++;
    
    // Calculate next run
    if (job.schedule.cron) {
      const nextRun = getNextRun(job.schedule.cron);
      state.nextScheduledRun = nextRun?.toISOString();
    } else if (job.schedule.intervalMs) {
      state.nextScheduledRun = new Date(Date.now() + job.schedule.intervalMs).toISOString();
    }
    
    // Record execution
    const execution: JobExecution = {
      id: executionId,
      jobId,
      status: result?.success ? 'completed' : 'failed',
      startedAt: new Date(Date.now() - (result?.duration ?? 0)).toISOString(),
      completedAt: new Date().toISOString(),
      duration: result?.duration,
      attempt,
      result: result ?? undefined,
      error: result?.errors?.join('; '),
    };
    
    this.recordExecution(execution);
    
    // Release lock
    if (job.exclusive) {
      await this.releaseLock(jobId);
    }
    
    return result;
  }
  
  private async executeWithTimeout(
    handler: JobHandler,
    context: JobContext,
    timeoutMs: number
  ): Promise<JobResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Job ${context.jobId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      handler(context)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // LOCKING
  // ─────────────────────────────────────────────────────────────────────────────
  
  private async acquireLock(jobId: JobId): Promise<boolean> {
    const lockKey = `scheduler:lock:${jobId}`;
    const state = this.jobStates.get(jobId);
    
    try {
      // Try to set lock with NX (only if not exists)
      const existingLock = await this.store.get(lockKey);
      if (existingLock) {
        return false;
      }
      
      await this.store.set(lockKey, this.instanceId, LOCK_TTL_SECONDS);
      
      if (state) {
        state.isLocked = true;
        state.lockedBy = this.instanceId;
        state.lockedAt = new Date().toISOString();
      }
      
      return true;
    } catch {
      return false;
    }
  }
  
  private async releaseLock(jobId: JobId): Promise<void> {
    const lockKey = `scheduler:lock:${jobId}`;
    const state = this.jobStates.get(jobId);
    
    try {
      // Only release if we own the lock
      const lockOwner = await this.store.get(lockKey);
      if (lockOwner === this.instanceId) {
        await this.store.delete(lockKey);
      }
    } catch {
      // Ignore errors
    }
    
    if (state) {
      state.isLocked = false;
      state.lockedBy = undefined;
      state.lockedAt = undefined;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EXECUTION HISTORY
  // ─────────────────────────────────────────────────────────────────────────────
  
  private recordExecution(execution: JobExecution): void {
    this.executionHistory.unshift(execution);
    if (this.executionHistory.length > MAX_EXECUTION_HISTORY) {
      this.executionHistory.pop();
    }
    
    // Also persist to store
    this.store.lpush(`scheduler:history:${execution.jobId}`, JSON.stringify(execution))
      .then(() => this.store.ltrim(`scheduler:history:${execution.jobId}`, 0, 99))
      .catch(() => {/* ignore */});
  }
  
  getExecutionHistory(jobId?: JobId, limit: number = 20): JobExecution[] {
    const history = jobId 
      ? this.executionHistory.filter(e => e.jobId === jobId)
      : this.executionHistory;
    return history.slice(0, limit);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STATE QUERIES
  // ─────────────────────────────────────────────────────────────────────────────
  
  getState(): SchedulerState {
    return {
      running: this.running,
      startedAt: this.startedAt?.toISOString(),
      jobs: Object.fromEntries(this.jobStates) as Record<JobId, JobState>,
      instanceId: this.instanceId,
      totalExecutions: this.totalExecutions,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
    };
  }
  
  getJobState(jobId: JobId): JobState | undefined {
    return this.jobStates.get(jobId);
  }
  
  isRunning(): boolean {
    return this.running;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // JOB CONTROL
  // ─────────────────────────────────────────────────────────────────────────────
  
  enableJob(jobId: JobId): boolean {
    const state = this.jobStates.get(jobId);
    if (!state) return false;
    
    state.status = 'idle';
    logger.info(`Job ${jobId} enabled`);
    return true;
  }
  
  disableJob(jobId: JobId): boolean {
    const state = this.jobStates.get(jobId);
    if (!state) return false;
    
    state.status = 'disabled';
    logger.info(`Job ${jobId} disabled`);
    return true;
  }
  
  async triggerJob(jobId: JobId): Promise<JobResult | null> {
    logger.info(`Manually triggering job ${jobId}`);
    return this.executeJob(jobId, true);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────────────────────────────────────
  
  onEvent(listener: (event: SchedulerEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index >= 0) this.eventListeners.splice(index, 1);
    };
  }
  
  private emitEvent(type: SchedulerEventType, jobId?: JobId, executionId?: string): void {
    const event: SchedulerEvent = {
      type,
      timestamp: new Date().toISOString(),
      jobId,
      executionId,
    };
    
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let scheduler: Scheduler | null = null;

export function getScheduler(): Scheduler {
  if (!scheduler) {
    scheduler = new Scheduler();
  }
  return scheduler;
}

export function createScheduler(): Scheduler {
  return new Scheduler();
}
