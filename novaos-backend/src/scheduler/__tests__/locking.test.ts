// ═══════════════════════════════════════════════════════════════════════════════
// JOB LOCKING TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobLockManager, createLockManager } from '../locking.js';
import type { KeyValueStore } from '../../storage/index.js';

// Mock logger
vi.mock('../../observability/logging/index.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock metrics
vi.mock('../../observability/metrics/index.js', () => ({
  incCounter: vi.fn(),
  observeHistogram: vi.fn(),
}));

describe('JobLockManager', () => {
  let store: KeyValueStore;
  let lockManager: JobLockManager;

  beforeEach(() => {
    // Create mock store
    const data = new Map<string, string>();
    store = {
      get: vi.fn(async (key: string) => data.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        data.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        const existed = data.has(key);
        data.delete(key);
        return existed;
      }),
      exists: vi.fn(async (key: string) => data.has(key)),
      keys: vi.fn(async () => Array.from(data.keys())),
      incr: vi.fn(),
      expire: vi.fn(),
      lpush: vi.fn(),
      lrange: vi.fn(),
      ltrim: vi.fn(),
      sadd: vi.fn(),
      smembers: vi.fn(async () => []),
      srem: vi.fn(),
      scard: vi.fn(async () => 0),
    } as unknown as KeyValueStore;

    lockManager = createLockManager(store, 'test-instance', {
      ttlMs: 5000,
      retries: 0,
      autoExtendMs: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('acquire', () => {
    it('should acquire a lock successfully', async () => {
      const handle = await lockManager.acquire('health_check');

      expect(handle).not.toBeNull();
      expect(handle?.isHeld).toBe(true);
      expect(handle?.jobId).toBe('health_check');
      expect(handle?.fencingToken).toBe(1);
    });

    it('should fail to acquire already held lock', async () => {
      // First acquisition
      const handle1 = await lockManager.acquire('health_check');
      expect(handle1).not.toBeNull();

      // Create second manager
      const lockManager2 = createLockManager(store, 'test-instance-2', {
        ttlMs: 5000,
        retries: 0,
        autoExtendMs: 0,
      });

      // Second acquisition should fail
      const handle2 = await lockManager2.acquire('health_check');
      expect(handle2).toBeNull();
    });

    it('should return existing handle if already held by same instance', async () => {
      const handle1 = await lockManager.acquire('health_check');
      const handle2 = await lockManager.acquire('health_check');

      expect(handle1).toBe(handle2);
    });
  });

  describe('release', () => {
    it('should release a held lock', async () => {
      const handle = await lockManager.acquire('health_check');
      expect(handle?.isHeld).toBe(true);

      const released = await handle!.release();
      expect(released).toBe(true);
      expect(handle?.isHeld).toBe(false);
    });

    it('should not release an already released lock', async () => {
      const handle = await lockManager.acquire('health_check');
      await handle!.release();

      const released = await handle!.release();
      expect(released).toBe(false);
    });
  });

  describe('withLock', () => {
    it('should execute function while holding lock', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const result = await lockManager.withLock('health_check', fn);

      expect(result.acquired).toBe(true);
      expect(result.result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should release lock after function completes', async () => {
      await lockManager.withLock('health_check', async () => 'done');

      // Lock should be released, allowing second acquisition
      const handle = await lockManager.acquire('health_check');
      expect(handle).not.toBeNull();
    });

    it('should release lock even if function throws', async () => {
      const result = await lockManager.withLock('health_check', async () => {
        throw new Error('test error');
      });

      expect(result.acquired).toBe(true);
      expect(result.error?.message).toBe('test error');

      // Lock should be released
      const handle = await lockManager.acquire('health_check');
      expect(handle).not.toBeNull();
    });

    it('should return acquired=false if lock cannot be acquired', async () => {
      // Hold lock with first manager
      await lockManager.acquire('health_check');

      // Try withLock on second manager
      const lockManager2 = createLockManager(store, 'test-instance-2', {
        ttlMs: 5000,
        retries: 0,
        autoExtendMs: 0,
      });

      const fn = vi.fn();
      const result = await lockManager2.withLock('health_check', fn);

      expect(result.acquired).toBe(false);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('isLocked', () => {
    it('should return true for locked jobs', async () => {
      await lockManager.acquire('health_check');

      const isLocked = await lockManager.isLocked('health_check');
      expect(isLocked).toBe(true);
    });

    it('should return false for unlocked jobs', async () => {
      const isLocked = await lockManager.isLocked('health_check');
      expect(isLocked).toBe(false);
    });
  });

  describe('forceRelease', () => {
    it('should force release a lock', async () => {
      await lockManager.acquire('health_check');

      const released = await lockManager.forceRelease('health_check');
      expect(released).toBe(true);

      const isLocked = await lockManager.isLocked('health_check');
      expect(isLocked).toBe(false);
    });
  });

  describe('releaseAll', () => {
    it('should release all held locks', async () => {
      await lockManager.acquire('health_check');
      await lockManager.acquire('memory_decay');

      await lockManager.releaseAll();

      expect(await lockManager.isLocked('health_check')).toBe(false);
      expect(await lockManager.isLocked('memory_decay')).toBe(false);
    });
  });
});
