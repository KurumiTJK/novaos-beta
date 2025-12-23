// ═══════════════════════════════════════════════════════════════════════════════
// MOCK REDIS — In-Memory Redis Mock for Testing
// NovaOS Phase 17 — Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK REDIS CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * In-memory Redis mock for testing.
 * Self-contained - no external dependencies.
 */
export class MockRedisClient {
  private data = new Map<string, { value: string; expiresAt?: number }>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private sets = new Map<string, Set<string>>();
  private sortedSets = new Map<string, Map<string, number>>();

  // ─────────────────────────────────────────────────────────────────────────────
  // STRING OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.data.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.data.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return false;
    }
    return true;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const newValue = (parseInt(current || '0', 10) + 1).toString();
    await this.set(key, newValue);
    return parseInt(newValue, 10);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const entry = this.data.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + seconds * 1000;
    return true;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.data.get(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.data.keys()).filter((k) => regex.test(k));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HASH OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    this.hashes.get(key)!.set(field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash);
  }

  async hdel(key: string, field: string): Promise<boolean> {
    return this.hashes.get(key)?.delete(field) ?? false;
  }

  async hmset(key: string, data: Record<string, string>): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key)!;
    for (const [field, value] of Object.entries(data)) {
      hash.set(field, value);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    list.unshift(...values);
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    list.push(...values);
    return list.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) || [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const list = this.lists.get(key);
    if (!list) return;
    const end = stop === -1 ? list.length : stop + 1;
    this.lists.set(key, list.slice(start, end));
  }

  async llen(key: string): Promise<number> {
    return this.lists.get(key)?.length ?? 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SET OPERATIONS
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
      if (set.delete(member)) removed++;
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) || []);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return this.sets.get(key)?.has(member) ?? false;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SORTED SET OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }
    const zset = this.sortedSets.get(key)!;
    const isNew = !zset.has(member);
    zset.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.sortedSets.get(key)?.delete(member) ? 1 : 0;
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const zset = this.sortedSets.get(key);
    if (!zset) return [];
    const sorted = Array.from(zset.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
    const end = stop === -1 ? sorted.length : stop + 1;
    return sorted.slice(start, end);
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    const zset = this.sortedSets.get(key);
    if (!zset) return [];
    return Array.from(zset.entries())
      .filter(([, score]) => score >= min && score <= max)
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
  }

  async zscore(key: string, member: string): Promise<number | null> {
    return this.sortedSets.get(key)?.get(member) ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONNECTION
  // ─────────────────────────────────────────────────────────────────────────────

  isConnected(): boolean {
    return true;
  }

  async disconnect(): Promise<void> {
    // No-op for mock
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  reset(): void {
    this.data.clear();
    this.hashes.clear();
    this.lists.clear();
    this.sets.clear();
    this.sortedSets.clear();
  }

  getState() {
    return {
      data: Object.fromEntries(this.data),
      hashes: Object.fromEntries(
        Array.from(this.hashes.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
      ),
      lists: Object.fromEntries(this.lists),
      sets: Object.fromEntries(
        Array.from(this.sets.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      sortedSets: Object.fromEntries(
        Array.from(this.sortedSets.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
      ),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

export function createMockRedisClient(): MockRedisClient {
  return new MockRedisClient();
}

export const mockRedis = createMockRedisClient();
