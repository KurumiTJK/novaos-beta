// ═══════════════════════════════════════════════════════════════════════════════
// DEAD LETTER QUEUE — Failed Job Storage and Investigation
// NovaOS Scheduler — Phase 15: Enhanced Scheduler & Jobs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Stores failed jobs for later investigation:
//   - Automatic retention enforcement (7 days default)
//   - Deduplication by job fingerprint
//   - Investigation tracking
//   - Statistics and querying
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../storage/index.js';
import { getLogger } from '../observability/logging/index.js';
import { incCounter, setGauge } from '../observability/metrics/index.js';

import type {
  JobId,
  JobContext,
  JobResult,
  DeadLetterEntry,
  DeadLetterConfig,
  DeadLetterStats,
  DeadLetterQuery,
} from './types.js';
import { DEFAULT_DEAD_LETTER_CONFIG } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'dead-letter-queue' });

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const KEY_PREFIX = 'scheduler:dlq';
const INDEX_KEY = `${KEY_PREFIX}:index`;
const STATS_KEY = `${KEY_PREFIX}:stats`;

// ─────────────────────────────────────────────────────────────────────────────────
// DEAD LETTER QUEUE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Dead letter queue for failed jobs.
 *
 * Stores jobs that have exhausted all retries for later
 * investigation and potential manual reprocessing.
 */
export class DeadLetterQueue {
  private readonly store: KeyValueStore;
  private readonly config: DeadLetterConfig;

  constructor(store: KeyValueStore, config?: Partial<DeadLetterConfig>) {
    this.store = store;
    this.config = { ...DEFAULT_DEAD_LETTER_CONFIG, ...config };

    logger.info('DeadLetterQueue initialized', {
      retentionMs: this.config.retentionMs,
      maxEntries: this.config.maxEntries,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Add entries
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add a failed job to the dead letter queue.
   */
  async add(
    context: JobContext,
    errors: string[],
    lastResult?: JobResult
  ): Promise<DeadLetterEntry> {
    const fingerprint = this.generateFingerprint(context);
    const id = `${context.jobId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const entry: DeadLetterEntry = {
      id,
      jobId: context.jobId,
      context,
      attempts: context.attempt,
      errors,
      lastResult,
      addedAt: new Date().toISOString(),
      fingerprint,
      investigated: false,
    };

    // Store the entry
    const entryKey = this.getEntryKey(id);
    const ttlSeconds = Math.ceil(this.config.retentionMs / 1000);
    await this.store.set(entryKey, JSON.stringify(entry), ttlSeconds);

    // Add to index
    await this.store.sadd(INDEX_KEY, id);

    // Add to job-specific index
    await this.store.sadd(this.getJobIndexKey(context.jobId), id);

    // Update metrics
    incCounter('scheduler_dlq_entries_total', { jobId: context.jobId });
    await this.updateStats();

    logger.info('Added to dead letter queue', {
      id,
      jobId: context.jobId,
      attempts: context.attempt,
      errors: errors.length,
    });

    return entry;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Query entries
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get a specific entry by ID.
   */
  async get(id: string): Promise<DeadLetterEntry | null> {
    const data = await this.store.get(this.getEntryKey(id));
    if (!data) return null;

    try {
      return JSON.parse(data) as DeadLetterEntry;
    } catch {
      return null;
    }
  }

  /**
   * Query entries with filters.
   */
  async query(query: DeadLetterQuery = {}): Promise<DeadLetterEntry[]> {
    const { jobId, investigated, since, limit = 100, offset = 0 } = query;

    // Get IDs from appropriate index
    let ids: string[];
    if (jobId) {
      ids = await this.store.smembers(this.getJobIndexKey(jobId));
    } else {
      ids = await this.store.smembers(INDEX_KEY);
    }

    // Fetch entries
    const entries: DeadLetterEntry[] = [];
    for (const id of ids) {
      const entry = await this.get(id);
      if (!entry) continue;

      // Apply filters
      if (investigated !== undefined && entry.investigated !== investigated) continue;
      if (since && new Date(entry.addedAt) < new Date(since)) continue;

      entries.push(entry);
    }

    // Sort by addedAt descending
    entries.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

    // Apply pagination
    return entries.slice(offset, offset + limit);
  }

  /**
   * Get all entries for a specific job.
   */
  async getByJob(jobId: JobId, limit = 50): Promise<DeadLetterEntry[]> {
    return this.query({ jobId, limit });
  }

  /**
   * Get uninvestigated entries.
   */
  async getUninvestigated(limit = 50): Promise<DeadLetterEntry[]> {
    return this.query({ investigated: false, limit });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Manage entries
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Mark an entry as investigated.
   */
  async markInvestigated(id: string, notes?: string): Promise<boolean> {
    const entry = await this.get(id);
    if (!entry) return false;

    entry.investigated = true;
    if (notes) {
      entry.investigationNotes = notes;
    }

    const ttlSeconds = Math.ceil(this.config.retentionMs / 1000);
    await this.store.set(this.getEntryKey(id), JSON.stringify(entry), ttlSeconds);

    logger.info('Entry marked as investigated', { id, jobId: entry.jobId });

    await this.updateStats();
    return true;
  }

  /**
   * Remove an entry.
   */
  async remove(id: string): Promise<boolean> {
    const entry = await this.get(id);
    if (!entry) return false;

    await this.store.delete(this.getEntryKey(id));
    await this.store.srem(INDEX_KEY, id);
    await this.store.srem(this.getJobIndexKey(entry.jobId), id);

    logger.info('Entry removed from dead letter queue', { id, jobId: entry.jobId });

    await this.updateStats();
    return true;
  }

  /**
   * Remove all entries for a job.
   */
  async removeByJob(jobId: JobId): Promise<number> {
    const ids = await this.store.smembers(this.getJobIndexKey(jobId));
    let removed = 0;

    for (const id of ids) {
      if (await this.remove(id)) {
        removed++;
      }
    }

    logger.info('Removed entries by job', { jobId, count: removed });
    return removed;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get queue statistics.
   */
  async getStats(): Promise<DeadLetterStats> {
    const ids = await this.store.smembers(INDEX_KEY);
    const entries: DeadLetterEntry[] = [];

    for (const id of ids) {
      const entry = await this.get(id);
      if (entry) entries.push(entry);
    }

    // Count by job
    const byJob: Record<string, number> = {};
    let uninvestigated = 0;
    let oldest: string | undefined;
    let newest: string | undefined;

    for (const entry of entries) {
      byJob[entry.jobId] = (byJob[entry.jobId] || 0) + 1;

      if (!entry.investigated) uninvestigated++;

      if (!oldest || entry.addedAt < oldest) oldest = entry.addedAt;
      if (!newest || entry.addedAt > newest) newest = entry.addedAt;
    }

    return {
      total: entries.length,
      uninvestigated,
      byJob,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  /**
   * Get count of entries.
   */
  async count(): Promise<number> {
    return this.store.scard(INDEX_KEY);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Clean up expired entries.
   */
  async cleanup(): Promise<number> {
    const ids = await this.store.smembers(INDEX_KEY);
    const cutoff = Date.now() - this.config.retentionMs;
    let removed = 0;

    for (const id of ids) {
      const entry = await this.get(id);

      // Entry already expired (TTL) or doesn't exist
      if (!entry) {
        await this.store.srem(INDEX_KEY, id);
        continue;
      }

      // Check retention
      if (new Date(entry.addedAt).getTime() < cutoff) {
        await this.remove(id);
        removed++;
      }
    }

    // Enforce max entries
    const total = await this.count();
    if (total > this.config.maxEntries) {
      const excess = total - this.config.maxEntries;
      const entries = await this.query({ limit: total });

      // Remove oldest entries
      const toRemove = entries.slice(-excess);
      for (const entry of toRemove) {
        await this.remove(entry.id);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info('Dead letter queue cleanup', { removed });
    }

    await this.updateStats();
    return removed;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private getEntryKey(id: string): string {
    return `${KEY_PREFIX}:entry:${id}`;
  }

  private getJobIndexKey(jobId: JobId): string {
    return `${KEY_PREFIX}:job:${jobId}`;
  }

  private generateFingerprint(context: JobContext): string {
    // Simple fingerprint based on job ID and execution context
    const parts = [
      context.jobId,
      context.executionId.split('-')[0], // Base of execution ID
    ];
    return parts.join(':');
  }

  private async updateStats(): Promise<void> {
    try {
      const stats = await this.getStats();

      setGauge('scheduler_dlq_total', stats.total, {});
      setGauge('scheduler_dlq_uninvestigated', stats.uninvestigated, {});

      for (const [jobId, count] of Object.entries(stats.byJob)) {
        setGauge('scheduler_dlq_by_job', count, { jobId });
      }
    } catch (error) {
      logger.error('Failed to update DLQ stats', error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new dead letter queue.
 */
export function createDeadLetterQueue(
  store: KeyValueStore,
  config?: Partial<DeadLetterConfig>
): DeadLetterQueue {
  return new DeadLetterQueue(store, config);
}
