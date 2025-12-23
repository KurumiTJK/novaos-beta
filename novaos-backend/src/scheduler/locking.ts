// ═══════════════════════════════════════════════════════════════════════════════
// JOB LOCKING — Distributed Lock Manager for Scheduled Jobs
// NovaOS Scheduler — Phase 15: Enhanced Scheduler & Jobs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides distributed locking for exclusive job execution:
//   - Redis-based locks with Lua scripts for atomicity
//   - Fencing tokens to prevent stale lock holders
//   - Automatic lock extension for long-running jobs
//   - Retry logic with backoff for lock acquisition
//   - RAII-style withLock() for safe execution
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { RedisStore } from '../infrastructure/redis/client.js';
import type { KeyValueStore } from '../storage/index.js';
import { getLogger } from '../observability/logging/index.js';
import { incCounter, observeHistogram } from '../observability/metrics/index.js';

import type {
  JobId,
  LockConfig,
  LockAcquisitionResult,
} from './types.js';
import { DEFAULT_LOCK_CONFIG } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'job-locking' });

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Lock handle returned after successful acquisition.
 */
export interface LockHandle {
  /** Job ID this lock is for */
  readonly jobId: JobId;

  /** Lock key in Redis */
  readonly lockKey: string;

  /** Fencing token for this lock */
  readonly fencingToken: number;

  /** Whether lock is still held */
  readonly isHeld: boolean;

  /** Release the lock */
  release(): Promise<boolean>;

  /** Extend the lock TTL */
  extend(ttlMs?: number): Promise<boolean>;
}

/**
 * Result of withLock operation.
 */
export interface WithLockResult<T> {
  /** Whether lock was acquired */
  acquired: boolean;

  /** Result of the operation (if lock was acquired) */
  result?: T;

  /** Error that occurred (if any) */
  error?: Error;

  /** Fencing token used */
  fencingToken?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOCK HANDLE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

class LockHandleImpl implements LockHandle {
  private held: boolean = true;
  private extendInterval: NodeJS.Timeout | null = null;

  constructor(
    public readonly jobId: JobId,
    public readonly lockKey: string,
    public readonly fencingToken: number,
    private readonly manager: JobLockManager,
    private readonly config: LockConfig
  ) {
    // Start auto-extend if configured
    if (config.autoExtendMs > 0) {
      this.startAutoExtend();
    }
  }

  get isHeld(): boolean {
    return this.held;
  }

  async release(): Promise<boolean> {
    if (!this.held) {
      return false;
    }

    this.stopAutoExtend();

    try {
      const released = await this.releaseLock();
      this.held = false;
      this.manager.locks.delete(this.jobId);

      if (released) {
        incCounter('scheduler_lock_released_total', { jobId: this.jobId });
        logger.debug('Lock released', {
          jobId: this.jobId,
          fencingToken: this.fencingToken,
        });
      }

      return released;
    } catch (error) {
      logger.error('Lock release error', error instanceof Error ? error : new Error(String(error)), {
        jobId: this.jobId,
      });
      return false;
    }
  }

  async extend(ttlMs: number = this.config.ttlMs): Promise<boolean> {
    if (!this.held) {
      return false;
    }

    try {
      const extended = await this.extendLock(ttlMs);

      if (extended) {
        logger.debug('Lock extended', {
          jobId: this.jobId,
          newTtlMs: ttlMs,
          fencingToken: this.fencingToken,
        });
        incCounter('scheduler_lock_extended_total', { jobId: this.jobId });
      } else {
        logger.warn('Lock extension failed (expired or stolen?)', {
          jobId: this.jobId,
        });
      }

      return extended;
    } catch (error) {
      logger.error('Lock extension error', error instanceof Error ? error : new Error(String(error)), {
        jobId: this.jobId,
      });
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private async releaseLock(): Promise<boolean> {
    // Use Redis-native release if available
    if (this.isRedisStore(this.manager.store)) {
      return this.manager.store.releaseLock(this.lockKey, this.manager.instanceId);
    }

    // Fallback: check owner and delete
    const lockData = await this.manager.store.get(this.lockKey);
    if (lockData) {
      try {
        const parsed = JSON.parse(lockData);
        if (parsed.owner === this.manager.instanceId) {
          await this.manager.store.delete(this.lockKey);
          return true;
        }
      } catch {
        // Invalid data, try to delete anyway
        await this.manager.store.delete(this.lockKey);
        return true;
      }
    }
    return false;
  }

  private async extendLock(ttlMs: number): Promise<boolean> {
    // Use Redis-native extend if available (acquireLock extends if same owner)
    if (this.isRedisStore(this.manager.store)) {
      const result = await this.manager.store.acquireLock(this.lockKey, this.manager.instanceId, ttlMs);
      return result.acquired;
    }

    // Fallback: check owner and update TTL
    const lockData = await this.manager.store.get(this.lockKey);
    if (lockData) {
      try {
        const parsed = JSON.parse(lockData);
        if (parsed.owner === this.manager.instanceId) {
          const newExpiresAt = Date.now() + ttlMs;
          await this.manager.store.set(
            this.lockKey,
            JSON.stringify({ ...parsed, expiresAt: newExpiresAt }),
            Math.ceil(ttlMs / 1000)
          );
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
  }

  private isRedisStore(store: RedisStore | KeyValueStore): store is RedisStore {
    return 'acquireLock' in store && typeof store.acquireLock === 'function';
  }

  private startAutoExtend(): void {
    const extendInterval = this.config.autoExtendMs;
    const extendTtl = this.config.ttlMs;

    this.extendInterval = setInterval(async () => {
      if (!this.held) {
        this.stopAutoExtend();
        return;
      }

      const success = await this.extend(extendTtl);
      if (!success) {
        logger.warn('Auto-extend failed, lock may be lost', {
          jobId: this.jobId,
        });
        this.held = false;
        this.stopAutoExtend();
      }
    }, extendInterval);
  }

  private stopAutoExtend(): void {
    if (this.extendInterval) {
      clearInterval(this.extendInterval);
      this.extendInterval = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// JOB LOCK MANAGER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Distributed lock manager for scheduled jobs.
 *
 * Provides exclusive execution guarantees across multiple instances
 * using Redis-based locks with fencing tokens.
 */
export class JobLockManager {
  readonly instanceId: string;
  readonly config: LockConfig;
  readonly store: RedisStore | KeyValueStore;
  readonly locks: Map<JobId, LockHandle> = new Map();

  private fencingCounter: number = 0;

  constructor(
    store: RedisStore | KeyValueStore,
    instanceId?: string,
    config?: Partial<LockConfig>
  ) {
    this.store = store;
    this.instanceId = instanceId ?? `lock-manager-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.config = { ...DEFAULT_LOCK_CONFIG, ...config };

    logger.info('JobLockManager initialized', {
      instanceId: this.instanceId,
      config: this.config,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Acquire a lock for the given job.
   */
  async acquire(jobId: JobId, options?: Partial<LockConfig>): Promise<LockHandle | null> {
    const config = { ...this.config, ...options };
    const startTime = Date.now();

    // Check if we already hold this lock
    const existing = this.locks.get(jobId);
    if (existing?.isHeld) {
      logger.debug('Lock already held by this instance', { jobId });
      return existing;
    }

    const lockKey = this.getLockKey(jobId);
    let attempt = 0;
    let delay = config.retryDelayMs;

    while (attempt <= config.retries) {
      attempt++;

      try {
        const result = await this.tryAcquire(lockKey, config.ttlMs);

        if (result.acquired) {
          const handle = new LockHandleImpl(
            jobId,
            lockKey,
            result.fencingToken!,
            this,
            config
          );

          this.locks.set(jobId, handle);

          const duration = Date.now() - startTime;
          observeHistogram('scheduler_lock_acquire_duration_ms', duration, { jobId });
          incCounter('scheduler_lock_acquired_total', { jobId });

          logger.debug('Lock acquired', {
            jobId,
            fencingToken: result.fencingToken,
            attempt,
            durationMs: duration,
          });

          return handle;
        }

        // Lock not acquired, retry if attempts remaining
        if (attempt <= config.retries) {
          logger.debug('Lock acquisition retry', {
            jobId,
            attempt,
            nextDelayMs: delay,
          });

          await this.sleep(delay);

          // Exponential backoff
          if (config.exponentialBackoff) {
            delay = Math.min(delay * 2, 30000);
          }
        }
      } catch (error) {
        logger.error('Lock acquisition error', error instanceof Error ? error : new Error(String(error)), {
          jobId,
          attempt,
        });

        if (attempt <= config.retries) {
          await this.sleep(delay);
        }
      }
    }

    incCounter('scheduler_lock_failed_total', { jobId });
    logger.debug('Lock acquisition failed after all retries', {
      jobId,
      attempts: attempt,
    });

    return null;
  }

  /**
   * Execute a function while holding a lock.
   * RAII-style lock management.
   */
  async withLock<T>(
    jobId: JobId,
    fn: (handle: LockHandle) => Promise<T>,
    options?: Partial<LockConfig>
  ): Promise<WithLockResult<T>> {
    const handle = await this.acquire(jobId, options);

    if (!handle) {
      return { acquired: false };
    }

    try {
      const result = await fn(handle);
      return {
        acquired: true,
        result,
        fencingToken: handle.fencingToken,
      };
    } catch (error) {
      return {
        acquired: true,
        error: error instanceof Error ? error : new Error(String(error)),
        fencingToken: handle.fencingToken,
      };
    } finally {
      await handle.release();
    }
  }

  /**
   * Check if a lock is currently held for a job.
   */
  async isLocked(jobId: JobId): Promise<boolean> {
    const lockKey = this.getLockKey(jobId);

    try {
      const exists = await this.store.exists(lockKey);
      return exists;
    } catch {
      return false;
    }
  }

  /**
   * Get information about who holds a lock.
   */
  async getLockInfo(jobId: JobId): Promise<LockAcquisitionResult | null> {
    const lockKey = this.getLockKey(jobId);

    try {
      const data = await this.store.get(lockKey);
      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        acquired: false,
        owner: parsed.owner,
        fencingToken: parsed.fencingToken,
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Force release a lock (use with caution).
   */
  async forceRelease(jobId: JobId): Promise<boolean> {
    const lockKey = this.getLockKey(jobId);

    try {
      const deleted = await this.store.delete(lockKey);
      this.locks.delete(jobId);

      if (deleted) {
        logger.warn('Lock force released', { jobId });
        incCounter('scheduler_lock_force_released_total', { jobId });
      }

      return deleted;
    } catch {
      return false;
    }
  }

  /**
   * Release all locks held by this instance.
   */
  async releaseAll(): Promise<void> {
    const jobIds = Array.from(this.locks.keys());

    for (const jobId of jobIds) {
      const handle = this.locks.get(jobId);
      if (handle?.isHeld) {
        await handle.release();
      }
    }

    logger.info('All locks released', {
      instanceId: this.instanceId,
      count: jobIds.length,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal methods
  // ─────────────────────────────────────────────────────────────────────────────

  /** @internal */
  acquireInternal = this.acquire.bind(this);

  isRedisStore(store: RedisStore | KeyValueStore): store is RedisStore {
    return 'acquireLock' in store && typeof store.acquireLock === 'function';
  }

  private async tryAcquire(lockKey: string, ttlMs: number): Promise<LockAcquisitionResult> {
    const fencingToken = ++this.fencingCounter;

    // Use Redis-native lock if available
    if (this.isRedisStore(this.store)) {
      const result = await this.store.acquireLock(lockKey, this.instanceId, ttlMs);
      return {
        acquired: result.acquired,
        fencingToken: result.acquired ? fencingToken : undefined,
        owner: result.acquired ? this.instanceId : undefined,
        expiresAt: result.acquired ? Date.now() + ttlMs : undefined,
      };
    }

    // Fallback: manual lock implementation
    const now = Date.now();
    const expiresAt = now + ttlMs;

    // Check existing lock
    const existing = await this.store.get(lockKey);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed.expiresAt > now) {
          // Lock is still valid
          return { acquired: false, owner: parsed.owner };
        }
      } catch {
        // Invalid lock data, try to acquire
      }
    }

    // Try to acquire
    const lockData = JSON.stringify({
      owner: this.instanceId,
      fencingToken,
      acquiredAt: now,
      expiresAt,
    });

    await this.store.set(lockKey, lockData, Math.ceil(ttlMs / 1000));

    // Verify we got the lock
    const verify = await this.store.get(lockKey);
    if (verify) {
      try {
        const parsed = JSON.parse(verify);
        if (parsed.owner === this.instanceId && parsed.fencingToken === fencingToken) {
          return {
            acquired: true,
            fencingToken,
            owner: this.instanceId,
            expiresAt,
          };
        }
      } catch {
        // Verification failed
      }
    }

    return { acquired: false };
  }

  private getLockKey(jobId: JobId): string {
    return `scheduler:lock:${jobId}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new lock manager.
 */
export function createLockManager(
  store: RedisStore | KeyValueStore,
  instanceId?: string,
  config?: Partial<LockConfig>
): JobLockManager {
  return new JobLockManager(store, instanceId, config);
}
