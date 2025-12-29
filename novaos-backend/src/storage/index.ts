// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE MODULE — Redis + In-Memory Abstractions
// ═══════════════════════════════════════════════════════════════════════════════

import { Redis } from 'ioredis';

// ─────────────────────────────────────────────────────────────────────────────────
// STORE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  
  // Hash operations
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  hdel(key: string, field: string): Promise<boolean>;
  
  // List operations
  lpush(key: string, value: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  
  // Set operations
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;
  scard(key: string): Promise<number>;

  // Sorted set operations
  zadd(key: string, score: number, member: string): Promise<number>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  zrevrange(key: string, start: number, stop: number): Promise<string[]>;
  zrangebyscore(
    key: string, 
    min: number | string, 
    max: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]>;
  zrevrangebyscore(
    key: string, 
    max: number | string, 
    min: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]>;
  zremrangebyrank(key: string, start: number, stop: number): Promise<number>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zcard(key: string): Promise<number>;
  zrem(key: string, member: string): Promise<number>;
  zscore(key: string, member: string): Promise<number | null>;
  
  // Connection
  isConnected(): boolean;
  disconnect(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// REDIS STORE
// ─────────────────────────────────────────────────────────────────────────────────

export class RedisStore implements KeyValueStore {
  private client: Redis;
  private connected: boolean = false;

  constructor(url?: string) {
    const redisUrl = url ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FIX: Add TLS support for rediss:// URLs (required for Upstash, Railway, etc.)
    // ═══════════════════════════════════════════════════════════════════════════
    const useTls = redisUrl.startsWith('rediss://');
    
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('[REDIS] Max retries reached, giving up');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      // TLS configuration for secure Redis (Upstash, Railway, etc.)
      tls: useTls ? {} : undefined,
    });

    this.client.on('connect', () => {
      console.log('[REDIS] Connected');
      this.connected = true;
    });

    this.client.on('ready', () => {
      console.log('[REDIS] Ready');
      this.connected = true;
    });

    this.client.on('error', (err: Error) => {
      console.error('[REDIS] Error:', err.message);
      this.connected = false;
    });

    this.client.on('close', () => {
      console.log('[REDIS] Connection closed');
      this.connected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      // Wait for ready state
      if (this.client.status !== 'ready') {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Redis connection timeout'));
          }, 10000);
          
          this.client.once('ready', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          this.client.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }
      this.connected = true;
    } catch (error) {
      console.error('[REDIS] Failed to connect:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected && this.client.status === 'ready';
  }

  /**
   * Get the raw ioredis client for advanced operations.
   * Used by SparkEngine for distributed locking and pub/sub.
   */
  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(key);
    return result > 0;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result > 0;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.expire(key, ttlSeconds);
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const result = await this.client.hdel(key, field);
    return result > 0;
  }

  async lpush(key: string, value: string): Promise<number> {
    return this.client.lpush(key, value);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.client.ltrim(key, start, stop);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  async scard(key: string): Promise<number> {
    return this.client.scard(key);
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrange(key, start, stop);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrevrange(key, start, stop);
  }

  async zrangebyscore(
    key: string, 
    min: number | string, 
    max: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]> {
    if (options?.limit) {
      return this.client.zrangebyscore(key, min, max, 'LIMIT', options.limit.offset, options.limit.count);
    }
    return this.client.zrangebyscore(key, min, max);
  }

  async zrevrangebyscore(
    key: string, 
    max: number | string, 
    min: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]> {
    if (options?.limit) {
      return this.client.zrevrangebyscore(key, max, min, 'LIMIT', options.limit.offset, options.limit.count);
    }
    return this.client.zrevrangebyscore(key, max, min);
  }

  async zremrangebyrank(key: string, start: number, stop: number): Promise<number> {
    return this.client.zremrangebyrank(key, start, stop);
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    return this.client.zremrangebyscore(key, min, max);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.client.zrem(key, member);
  }

  async zscore(key: string, member: string): Promise<number | null> {
    const score = await this.client.zscore(key, member);
    return score !== null ? parseFloat(score) : null;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// IN-MEMORY STORE (Fallback when Redis unavailable)
// ─────────────────────────────────────────────────────────────────────────────────

interface MemoryEntry {
  value: string;
  expiresAt?: number;
}

export class MemoryStore implements KeyValueStore {
  private store = new Map<string, MemoryEntry>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private sets = new Map<string, Set<string>>();
  private sortedSets = new Map<string, Map<string, number>>();

  isConnected(): boolean {
    return true;
  }

  private isExpired(entry: MemoryEntry): boolean {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  }

  private cleanup(key: string): void {
    const entry = this.store.get(key);
    if (entry && this.isExpired(entry)) {
      this.store.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.cleanup(key);
    const entry = this.store.get(key);
    return entry ? entry.value : null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const entry: MemoryEntry = { value };
    if (ttlSeconds) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    this.cleanup(key);
    return this.store.has(key);
  }

  async incr(key: string): Promise<number> {
    const value = await this.get(key);
    const num = parseInt(value ?? '0', 10) + 1;
    await this.set(key, String(num));
    return num;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    return true;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const result: string[] = [];
    for (const key of this.store.keys()) {
      this.cleanup(key);
      if (this.store.has(key) && regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.hashes.get(key);
    return hash?.get(field) ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.hashes.set(key, hash);
    }
    hash.set(field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash);
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const hash = this.hashes.get(key);
    return hash?.delete(field) ?? false;
  }

  // List operations
  async lpush(key: string, value: string): Promise<number> {
    let list = this.lists.get(key);
    if (!list) {
      list = [];
      this.lists.set(key, list);
    }
    list.unshift(value);
    return list.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) ?? [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const list = this.lists.get(key);
    if (!list) return;
    const end = stop === -1 ? list.length : stop + 1;
    this.lists.set(key, list.slice(start, end));
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set();
      this.sets.set(key, set);
    }
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
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const set = this.sets.get(key);
    return set?.has(member) ?? false;
  }

  async scard(key: string): Promise<number> {
    const set = this.sets.get(key);
    return set?.size ?? 0;
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    let sortedSet = this.sortedSets.get(key);
    if (!sortedSet) {
      sortedSet = new Map();
      this.sortedSets.set(key, sortedSet);
    }
    const isNew = !sortedSet.has(member);
    sortedSet.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return [];
    
    const sorted = Array.from(sortedSet.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
    
    const end = stop === -1 ? sorted.length : stop + 1;
    return sorted.slice(start, end);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return [];
    
    const sorted = Array.from(sortedSet.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([member]) => member);
    
    const end = stop === -1 ? sorted.length : stop + 1;
    return sorted.slice(start, end);
  }

  async zrangebyscore(
    key: string, 
    min: number | string, 
    max: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]> {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return [];
    
    const minScore = this.parseScoreBound(min, -Infinity);
    const maxScore = this.parseScoreBound(max, Infinity);
    
    let results = Array.from(sortedSet.entries())
      .filter(([_, score]) => score >= minScore && score <= maxScore)
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
    
    if (options?.limit) {
      results = results.slice(options.limit.offset, options.limit.offset + options.limit.count);
    }
    
    return results;
  }

  async zrevrangebyscore(
    key: string, 
    max: number | string, 
    min: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]> {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return [];
    
    const minScore = this.parseScoreBound(min, -Infinity);
    const maxScore = this.parseScoreBound(max, Infinity);
    
    let results = Array.from(sortedSet.entries())
      .filter(([_, score]) => score >= minScore && score <= maxScore)
      .sort((a, b) => b[1] - a[1])
      .map(([member]) => member);
    
    if (options?.limit) {
      results = results.slice(options.limit.offset, options.limit.offset + options.limit.count);
    }
    
    return results;
  }

  async zremrangebyrank(key: string, start: number, stop: number): Promise<number> {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return 0;
    
    const sorted = Array.from(sortedSet.entries())
      .sort((a, b) => a[1] - b[1]);
    
    const end = stop === -1 ? sorted.length : stop + 1;
    const toRemove = sorted.slice(start, end);
    
    for (const [member] of toRemove) {
      sortedSet.delete(member);
    }
    
    return toRemove.length;
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return 0;
    
    const minScore = this.parseScoreBound(min, -Infinity);
    const maxScore = this.parseScoreBound(max, Infinity);
    
    let removed = 0;
    for (const [member, score] of sortedSet.entries()) {
      if (score >= minScore && score <= maxScore) {
        sortedSet.delete(member);
        removed++;
      }
    }
    
    return removed;
  }

  async zcard(key: string): Promise<number> {
    const sortedSet = this.sortedSets.get(key);
    return sortedSet?.size ?? 0;
  }

  async zrem(key: string, member: string): Promise<number> {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return 0;
    return sortedSet.delete(member) ? 1 : 0;
  }

  async zscore(key: string, member: string): Promise<number | null> {
    const sortedSet = this.sortedSets.get(key);
    const score = sortedSet?.get(member);
    return score !== undefined ? score : null;
  }

  /**
   * Parse score bound for zrangebyscore/zrevrangebyscore.
   * Handles '-inf', '+inf', 'inf', and exclusive bounds like '(123'.
   */
  private parseScoreBound(value: number | string, defaultValue: number): number {
    if (typeof value === 'number') return value;
    if (value === '-inf') return -Infinity;
    if (value === '+inf' || value === 'inf') return Infinity;
    if (value.startsWith('(')) {
      // Exclusive bound - for simplicity we treat as inclusive (Redis uses exclusive)
      // In production you'd want to handle this properly
      return parseFloat(value.slice(1));
    }
    return parseFloat(value) || defaultValue;
  }

  async disconnect(): Promise<void> {
    this.store.clear();
    this.hashes.clear();
    this.lists.clear();
    this.sets.clear();
    this.sortedSets.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE MANAGER
// ─────────────────────────────────────────────────────────────────────────────────

export class StoreManager {
  private redis: RedisStore | null = null;
  private memory: MemoryStore;
  private useRedis: boolean = false;

  constructor() {
    this.memory = new MemoryStore();
    
    // Try to initialize Redis if REDIS_URL is set
    if (process.env.REDIS_URL) {
      try {
        console.log('[STORAGE] REDIS_URL detected, creating RedisStore...');
        this.redis = new RedisStore(process.env.REDIS_URL);
        this.useRedis = true;
      } catch (error) {
        console.warn('[STORAGE] Redis initialization failed, using memory store:', error);
        this.useRedis = false;
      }
    } else {
      console.log('[STORAGE] No REDIS_URL set, using memory store');
    }
  }

  async initialize(): Promise<void> {
    if (this.redis && this.useRedis) {
      try {
        console.log('[STORAGE] Connecting to Redis...');
        await this.redis.connect();
        console.log('[STORAGE] Redis connected successfully!');
      } catch (error) {
        console.warn('[STORAGE] Redis connection failed, falling back to memory store:', error);
        this.useRedis = false;
      }
    }
  }

  getStore(): KeyValueStore {
    if (this.useRedis && this.redis?.isConnected()) {
      return this.redis!;
    }
    return this.memory;
  }

  /**
   * Get the raw ioredis client for advanced operations.
   * Returns null if Redis is not available.
   * Used by SparkEngine for distributed locking and pub/sub.
   */
  getRedisClient(): Redis | null {
    if (this.useRedis && this.redis?.isConnected()) {
      return this.redis.getClient();
    }
    return null;
  }

  isUsingRedis(): boolean {
    return this.useRedis && (this.redis?.isConnected() ?? false);
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
    }
    await this.memory.disconnect();
  }

  async disconnect(): Promise<void> {
    return this.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIALIZED STORES
// ─────────────────────────────────────────────────────────────────────────────────

// Rate Limit Store
export class RateLimitStore {
  constructor(private store: KeyValueStore) {}

  private getKey(userId: string): string {
    return `ratelimit:${userId}`;
  }

  async increment(userId: string, windowSeconds: number): Promise<{ count: number; ttl: number }> {
    const key = this.getKey(userId);
    const count = await this.store.incr(key);
    
    if (count === 1) {
      await this.store.expire(key, windowSeconds);
    }

    return { count, ttl: windowSeconds };
  }

  async getCount(userId: string): Promise<number> {
    const value = await this.store.get(this.getKey(userId));
    return parseInt(value ?? '0', 10);
  }

  async reset(userId: string): Promise<void> {
    await this.store.delete(this.getKey(userId));
  }
}

// Session Store
export class SessionStore {
  constructor(private store: KeyValueStore) {}

  private getKey(conversationId: string): string {
    return `session:${conversationId}`;
  }

  async create(userId: string, conversationId: string): Promise<void> {
    const session = {
      userId,
      conversationId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      tokenCount: 0,
    };
    await this.store.set(
      this.getKey(conversationId),
      JSON.stringify(session),
      24 * 60 * 60 // 24 hour TTL
    );
  }

  async get(conversationId: string): Promise<any | null> {
    const data = await this.store.get(this.getKey(conversationId));
    return data ? JSON.parse(data) : null;
  }

  async update(conversationId: string, updates: { messageCount?: number; tokenCount?: number }): Promise<void> {
    const session = await this.get(conversationId);
    if (!session) return;

    session.lastActivity = Date.now();
    if (updates.messageCount) session.messageCount += updates.messageCount;
    if (updates.tokenCount) session.tokenCount += updates.tokenCount;

    await this.store.set(
      this.getKey(conversationId),
      JSON.stringify(session),
      24 * 60 * 60
    );
  }

  async delete(conversationId: string): Promise<void> {
    await this.store.delete(this.getKey(conversationId));
  }
}

// Ack Token Store
export class AckTokenStore {
  constructor(private kvStore: KeyValueStore) {}

  private getKey(token: string): string {
    return `ack:${token}`;
  }

  async save(token: string, userId: string, ttlSeconds: number = 300): Promise<void> {
    await this.kvStore.set(
      this.getKey(token),
      JSON.stringify({ userId, createdAt: Date.now() }),
      ttlSeconds
    );
  }

  async validate(token: string, userId: string): Promise<boolean> {
    const data = await this.kvStore.get(this.getKey(token));
    if (!data) return false;

    const parsed = JSON.parse(data);
    if (parsed.userId !== userId) return false;

    // Delete after validation (single use)
    await this.kvStore.delete(this.getKey(token));
    return true;
  }
}

// Block Store
export class BlockStore {
  constructor(private store: KeyValueStore) {}

  private getKey(userId: string): string {
    return `block:${userId}`;
  }

  async block(userId: string, reason: string, durationSeconds: number): Promise<void> {
    await this.store.set(
      this.getKey(userId),
      JSON.stringify({ reason, until: Date.now() + durationSeconds * 1000 }),
      durationSeconds
    );
  }

  async isBlocked(userId: string): Promise<{ blocked: boolean; reason?: string; until?: number }> {
    const data = await this.store.get(this.getKey(userId));
    if (!data) return { blocked: false };

    const parsed = JSON.parse(data);
    return {
      blocked: true,
      reason: parsed.reason,
      until: parsed.until,
    };
  }

  async unblock(userId: string): Promise<boolean> {
    return this.store.delete(this.getKey(userId));
  }
}

// Veto History Store
export class VetoHistoryStore {
  constructor(private store: KeyValueStore) {}

  private getKey(userId: string): string {
    return `veto:${userId}`;
  }

  async track(userId: string, windowSeconds: number = 300): Promise<number> {
    const key = this.getKey(userId);
    const now = Date.now();

    // Add new timestamp
    await this.store.lpush(key, String(now));
    await this.store.expire(key, windowSeconds);

    // Get all timestamps
    const timestamps = await this.store.lrange(key, 0, -1);
    const cutoff = now - windowSeconds * 1000;

    // Count recent ones
    const recentCount = timestamps.filter(t => parseInt(t, 10) > cutoff).length;

    // Trim old entries (keep last 20)
    await this.store.ltrim(key, 0, 19);

    return recentCount;
  }

  async getCount(userId: string, windowSeconds: number = 300): Promise<number> {
    const key = this.getKey(userId);
    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;

    const timestamps = await this.store.lrange(key, 0, -1);
    return timestamps.filter(t => parseInt(t, 10) > cutoff).length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUDIT LOG STORE
// ─────────────────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  action: string;
  details: Record<string, any>;
  requestId?: string;
  stance?: string;
  status?: string;
}

export class AuditLogStore {
  constructor(private store: KeyValueStore) {}

  private getUserKey(userId: string): string {
    return `audit:user:${userId}`;
  }

  private getGlobalKey(): string {
    return 'audit:global';
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<string> {
    const id = crypto.randomUUID();
    const fullEntry: AuditLogEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
    };

    const json = JSON.stringify(fullEntry);

    // Store in user-specific list
    await this.store.lpush(this.getUserKey(entry.userId), json);
    await this.store.ltrim(this.getUserKey(entry.userId), 0, 999); // Keep last 1000

    // Store in global list
    await this.store.lpush(this.getGlobalKey(), json);
    await this.store.ltrim(this.getGlobalKey(), 0, 9999); // Keep last 10000

    return id;
  }

  async getUserLogs(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    const logs = await this.store.lrange(this.getUserKey(userId), 0, limit - 1);
    return logs.map(log => JSON.parse(log));
  }

  async getGlobalLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    const logs = await this.store.lrange(this.getGlobalKey(), 0, limit - 1);
    return logs.map(log => JSON.parse(log));
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

export const storeManager = new StoreManager();

export function getStore(): KeyValueStore {
  return storeManager.getStore();
}
