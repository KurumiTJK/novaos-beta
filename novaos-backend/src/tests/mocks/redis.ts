// ═══════════════════════════════════════════════════════════════════════════════
// MOCK REDIS — In-Memory Redis Mock for Testing
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════
//
// Wraps the existing MemoryRedisClient for test isolation.
// Provides additional test utilities:
//   - State inspection
//   - Manual state manipulation
//   - Reset between tests
//
// ═══════════════════════════════════════════════════════════════════════════════

import { vi } from 'vitest';
import type { RedisStore, ConnectionState } from '../../infrastructure/redis/client.js';
import type { RateLimitResult, LockResult, ConditionalResult } from '../../infrastructure/redis/scripts.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK REDIS CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * In-memory Redis mock for testing.
 * Mirrors the MemoryRedisClient from Phase 4 with test utilities.
 */
export class MockRedisClient implements RedisStore {
  private data = new Map<string, { value: string; expiresAt?: number }>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private sets = new Map<string, Set<string>>();
  private zsets = new Map<string, Map<string, number>>();
  private locks = new Map<string, { owner: string; expiresAt: number }>();
  private state: ConnectionState = 'disconnected';
  private fencingToken = 0;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Connection
  // ─────────────────────────────────────────────────────────────────────────────
  
  async connect(): Promise<void> {
    this.state = 'connected';
  }
  
  async disconnect(): Promise<void> {
    this.state = 'disconnected';
  }
  
  getState(): ConnectionState {
    return this.state;
  }
  
  async ping(): Promise<boolean> {
    return this.state === 'connected';
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Basic Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  async get(key: string): Promise<string | null> {
    this.cleanExpired();
    const entry = this.data.get(key);
    return entry?.value ?? null;
  }
  
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.data.set(key, { value, expiresAt });
  }
  
  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }
  
  async exists(key: string): Promise<boolean> {
    this.cleanExpired();
    return this.data.has(key);
  }
  
  async incr(key: string): Promise<number> {
    const current = parseInt(await this.get(key) ?? '0', 10);
    const next = current + 1;
    await this.set(key, next.toString());
    return next;
  }
  
  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.data.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }
  
  async keys(pattern: string): Promise<string[]> {
    this.cleanExpired();
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.data.keys()).filter(k => regex.test(k));
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Hash Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    this.hashes.get(key)!.set(field, value);
  }
  
  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }
  
  async hgetall(key: string): Promise<Record<string, string> | null> {
    const hash = this.hashes.get(key);
    if (!hash || hash.size === 0) return null;
    return Object.fromEntries(hash);
  }
  
  async hmset(key: string, fields: Record<string, string>): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key)!;
    for (const [field, value] of Object.entries(fields)) {
      hash.set(field, value);
    }
  }
  
  async hdel(key: string, field: string): Promise<boolean> {
    return this.hashes.get(key)?.delete(field) ?? false;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // List Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    list.push(...values);
    return list.length;
  }
  
  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    list.unshift(...values);
    return list.length;
  }
  
  async lpop(key: string): Promise<string | null> {
    return this.lists.get(key)?.shift() ?? null;
  }
  
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) ?? [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }
  
  async llen(key: string): Promise<number> {
    return this.lists.get(key)?.length ?? 0;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Set Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key)!;
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }
  
  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed++;
      }
    }
    return removed;
  }
  
  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) ?? []);
  }
  
  async sismember(key: string, member: string): Promise<boolean> {
    return this.sets.get(key)?.has(member) ?? false;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Sorted Set Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.zsets.has(key)) {
      this.zsets.set(key, new Map());
    }
    const zset = this.zsets.get(key)!;
    const isNew = !zset.has(member);
    zset.set(member, score);
    return isNew ? 1 : 0;
  }
  
  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    const zset = this.zsets.get(key);
    if (!zset) return [];
    
    const minNum = min === '-inf' ? -Infinity : Number(min);
    const maxNum = max === '+inf' ? Infinity : Number(max);
    
    return Array.from(zset.entries())
      .filter(([_, score]) => score >= minNum && score <= maxNum)
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
  }
  
  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    const zset = this.zsets.get(key);
    if (!zset) return 0;
    
    const minNum = min === '-inf' ? -Infinity : Number(min);
    const maxNum = max === '+inf' ? Infinity : Number(max);
    
    let removed = 0;
    for (const [member, score] of zset.entries()) {
      if (score >= minNum && score <= maxNum) {
        zset.delete(member);
        removed++;
      }
    }
    return removed;
  }
  
  async zcard(key: string): Promise<number> {
    return this.zsets.get(key)?.size ?? 0;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Lua Script Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  async rateLimit(key: string, capacity: number, refillRate: number, tokens = 1): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.data.get(key);
    
    let currentTokens = capacity;
    let lastRefill = now;
    
    if (entry) {
      const [tokensStr, lastStr] = entry.value.split(':');
      currentTokens = parseFloat(tokensStr ?? '0');
      lastRefill = parseInt(lastStr ?? '0', 10);
      
      // Refill based on time elapsed
      const elapsed = (now - lastRefill) / 1000;
      currentTokens = Math.min(capacity, currentTokens + elapsed * refillRate);
    }
    
    const allowed = currentTokens >= tokens;
    
    if (allowed) {
      currentTokens -= tokens;
    }
    
    this.data.set(key, { value: `${currentTokens}:${now}` });
    
    return {
      allowed,
      remainingTokens: Math.floor(currentTokens),
      retryAfterMs: allowed ? 0 : Math.ceil((tokens - currentTokens) / refillRate * 1000),
      maxTokens: capacity,
    };
  }
  
  async acquireLock(lockKey: string, ownerId: string, ttlMs: number): Promise<LockResult> {
    const now = Date.now();
    const existing = this.locks.get(lockKey);
    
    // Check if lock exists and is not expired
    if (existing && existing.expiresAt > now) {
      return {
        acquired: false,
        fencingToken: 0,
        existingOwner: existing.owner,
        remainingTtlMs: existing.expiresAt - now,
      };
    }
    
    // Acquire lock
    this.fencingToken++;
    this.locks.set(lockKey, {
      owner: ownerId,
      expiresAt: now + ttlMs,
    });
    
    return {
      acquired: true,
      fencingToken: this.fencingToken,
    };
  }
  
  async releaseLock(lockKey: string, ownerId: string): Promise<boolean> {
    const lock = this.locks.get(lockKey);
    if (lock && lock.owner === ownerId) {
      this.locks.delete(lockKey);
      return true;
    }
    return false;
  }
  
  async createIfNotExists(key: string, data: string, ttlSeconds = 0): Promise<ConditionalResult> {
    if (this.data.has(key)) {
      return { success: false, version: 0, existingValue: await this.get(key) };
    }
    
    await this.set(key, data, ttlSeconds || undefined);
    return { success: true, version: 1 };
  }
  
  async conditionalUpdate(key: string, expectedVersion: number, data: string): Promise<ConditionalResult> {
    const existing = this.data.get(key);
    if (!existing) {
      return { success: false, version: 0, reason: 'NOT_FOUND' };
    }
    
    // For simplicity, we don't track versions in the mock
    // Just update if key exists
    await this.set(key, data);
    return { success: true, version: expectedVersion + 1 };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Test Utilities
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Reset all data (call between tests).
   */
  reset(): void {
    this.data.clear();
    this.hashes.clear();
    this.lists.clear();
    this.sets.clear();
    this.zsets.clear();
    this.locks.clear();
    this.fencingToken = 0;
  }
  
  /**
   * Get raw data for inspection.
   */
  inspectData(): Map<string, { value: string; expiresAt?: number }> {
    this.cleanExpired();
    return new Map(this.data);
  }
  
  /**
   * Get all keys.
   */
  getAllKeys(): string[] {
    this.cleanExpired();
    return Array.from(this.data.keys());
  }
  
  /**
   * Set raw data directly (for test setup).
   */
  seedData(key: string, value: string, ttlSeconds?: number): void {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.data.set(key, { value, expiresAt });
  }
  
  /**
   * Clean expired entries.
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.data.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.data.delete(key);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON & FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

let mockRedisInstance: MockRedisClient | null = null;

/**
 * Get or create the mock Redis client singleton.
 */
export function getMockRedis(): MockRedisClient {
  if (!mockRedisInstance) {
    mockRedisInstance = new MockRedisClient();
  }
  return mockRedisInstance;
}

/**
 * Reset the mock Redis (call between tests).
 */
export function resetMockRedis(): void {
  if (mockRedisInstance) {
    mockRedisInstance.reset();
  }
}

/**
 * Create a new isolated mock Redis instance.
 * Useful for tests that need independent state.
 */
export function createMockRedis(): MockRedisClient {
  return new MockRedisClient();
}

/**
 * Create a spy-wrapped mock Redis for call tracking.
 */
export function createSpyRedis(): MockRedisClient & { _spies: Record<string, ReturnType<typeof vi.fn>> } {
  const mock = new MockRedisClient();
  const spies: Record<string, ReturnType<typeof vi.fn>> = {};
  
  // Wrap key methods with spies
  const methodsToSpy = [
    'get', 'set', 'delete', 'exists',
    'hset', 'hget', 'hgetall',
    'rpush', 'lpush', 'lrange',
    'sadd', 'smembers',
    'zadd', 'zrangebyscore',
    'rateLimit', 'acquireLock', 'releaseLock',
  ] as const;
  
  for (const method of methodsToSpy) {
    const original = (mock as Record<string, unknown>)[method] as (...args: unknown[]) => unknown;
    const spy = vi.fn(original.bind(mock));
    spies[method] = spy;
    (mock as Record<string, unknown>)[method] = spy;
  }
  
  return Object.assign(mock, { _spies: spies });
}
