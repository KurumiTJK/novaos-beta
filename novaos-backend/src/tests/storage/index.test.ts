// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE MODULE INDEX TESTS — Redis + In-Memory Abstractions
// NovaOS Storage Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  // Classes
  MemoryStore,
  RedisStore,
  StoreManager,
  RateLimitStore,
  SessionStore,
  AckTokenStore,
  BlockStore,
  VetoHistoryStore,
  AuditLogStore,
  
  // Functions
  getStore,
  storeManager,
  
  // Types
  type KeyValueStore,
  type AuditLogEntry,
} from '../../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function createMockStore(): MemoryStore {
  return new MemoryStore();
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Module Exports', () => {
  it('should export MemoryStore class', () => {
    expect(MemoryStore).toBeDefined();
    expect(typeof MemoryStore).toBe('function');
  });

  it('should export RedisStore class', () => {
    expect(RedisStore).toBeDefined();
    expect(typeof RedisStore).toBe('function');
  });

  it('should export StoreManager class', () => {
    expect(StoreManager).toBeDefined();
    expect(typeof StoreManager).toBe('function');
  });

  it('should export specialized store classes', () => {
    expect(RateLimitStore).toBeDefined();
    expect(SessionStore).toBeDefined();
    expect(AckTokenStore).toBeDefined();
    expect(BlockStore).toBeDefined();
    expect(VetoHistoryStore).toBeDefined();
    expect(AuditLogStore).toBeDefined();
  });

  it('should export storeManager singleton', () => {
    expect(storeManager).toBeDefined();
    expect(storeManager).toBeInstanceOf(StoreManager);
  });

  it('should export getStore function', () => {
    expect(typeof getStore).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MemoryStore TESTS (Full KeyValueStore Implementation)
// ─────────────────────────────────────────────────────────────────────────────────

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it('should be connected', () => {
    expect(store.isConnected()).toBe(true);
  });

  it('should implement all KeyValueStore methods', () => {
    // String operations
    expect(typeof store.get).toBe('function');
    expect(typeof store.set).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.exists).toBe('function');
    expect(typeof store.incr).toBe('function');
    expect(typeof store.expire).toBe('function');
    expect(typeof store.keys).toBe('function');
    
    // Hash operations
    expect(typeof store.hget).toBe('function');
    expect(typeof store.hset).toBe('function');
    expect(typeof store.hgetall).toBe('function');
    expect(typeof store.hdel).toBe('function');
    
    // List operations
    expect(typeof store.lpush).toBe('function');
    expect(typeof store.lrange).toBe('function');
    expect(typeof store.ltrim).toBe('function');
    
    // Set operations
    expect(typeof store.sadd).toBe('function');
    expect(typeof store.srem).toBe('function');
    expect(typeof store.smembers).toBe('function');
    expect(typeof store.sismember).toBe('function');
    expect(typeof store.scard).toBe('function');
    
    // Sorted set operations
    expect(typeof store.zadd).toBe('function');
    expect(typeof store.zrange).toBe('function');
    expect(typeof store.zrevrange).toBe('function');
    expect(typeof store.zrangebyscore).toBe('function');
    expect(typeof store.zrevrangebyscore).toBe('function');
    expect(typeof store.zremrangebyrank).toBe('function');
    expect(typeof store.zremrangebyscore).toBe('function');
    expect(typeof store.zcard).toBe('function');
    expect(typeof store.zrem).toBe('function');
    expect(typeof store.zscore).toBe('function');
    
    // Connection
    expect(typeof store.disconnect).toBe('function');
  });

  describe('Sorted Set Operations', () => {
    it('should add members with scores', async () => {
      const result = await store.zadd('zset', 100, 'member1');
      expect(result).toBe(1);
    });

    it('should get range by rank', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 3, 'c');
      await store.zadd('zset', 2, 'b');
      
      const result = await store.zrange('zset', 0, -1);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should get reverse range by rank', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 3, 'c');
      await store.zadd('zset', 2, 'b');
      
      const result = await store.zrevrange('zset', 0, -1);
      expect(result).toEqual(['c', 'b', 'a']);
    });

    it('should get range by score', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 5, 'e');
      await store.zadd('zset', 3, 'c');
      
      const result = await store.zrangebyscore('zset', 1, 3);
      expect(result).toEqual(['a', 'c']);
    });

    it('should get reverse range by score', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 5, 'e');
      await store.zadd('zset', 3, 'c');
      
      const result = await store.zrevrangebyscore('zset', 5, 1);
      expect(result).toEqual(['e', 'c', 'a']);
    });

    it('should get cardinality', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 2, 'b');
      
      const result = await store.zcard('zset');
      expect(result).toBe(2);
    });

    it('should remove member', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 2, 'b');
      
      const result = await store.zrem('zset', 'a');
      expect(result).toBe(1);
      expect(await store.zcard('zset')).toBe(1);
    });

    it('should get score', async () => {
      await store.zadd('zset', 42, 'member');
      
      const result = await store.zscore('zset', 'member');
      expect(result).toBe(42);
    });

    it('should return null for non-existent score', async () => {
      const result = await store.zscore('zset', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should remove by rank range', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 2, 'b');
      await store.zadd('zset', 3, 'c');
      
      const removed = await store.zremrangebyrank('zset', 0, 1);
      expect(removed).toBe(2);
      expect(await store.zcard('zset')).toBe(1);
    });

    it('should remove by score range', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 5, 'e');
      await store.zadd('zset', 10, 'j');
      
      const removed = await store.zremrangebyscore('zset', 1, 5);
      expect(removed).toBe(2);
      expect(await store.zcard('zset')).toBe(1);
    });

    it('should handle -inf and +inf in score ranges', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 100, 'b');
      
      const result = await store.zrangebyscore('zset', '-inf', '+inf');
      expect(result).toEqual(['a', 'b']);
    });

    it('should handle limit option', async () => {
      await store.zadd('zset', 1, 'a');
      await store.zadd('zset', 2, 'b');
      await store.zadd('zset', 3, 'c');
      await store.zadd('zset', 4, 'd');
      
      const result = await store.zrangebyscore('zset', '-inf', '+inf', {
        limit: { offset: 1, count: 2 },
      });
      expect(result).toEqual(['b', 'c']);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// RateLimitStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RateLimitStore', () => {
  let kvStore: MemoryStore;
  let rateLimitStore: RateLimitStore;

  beforeEach(() => {
    kvStore = new MemoryStore();
    rateLimitStore = new RateLimitStore(kvStore);
  });

  describe('increment()', () => {
    it('should increment counter', async () => {
      const result = await rateLimitStore.increment('user-123', 60);
      
      expect(result.count).toBe(1);
      expect(result.ttl).toBe(60);
    });

    it('should increment on subsequent calls', async () => {
      await rateLimitStore.increment('user-123', 60);
      await rateLimitStore.increment('user-123', 60);
      const result = await rateLimitStore.increment('user-123', 60);
      
      expect(result.count).toBe(3);
    });

    it('should track different users separately', async () => {
      await rateLimitStore.increment('user-1', 60);
      await rateLimitStore.increment('user-1', 60);
      await rateLimitStore.increment('user-2', 60);
      
      expect(await rateLimitStore.getCount('user-1')).toBe(2);
      expect(await rateLimitStore.getCount('user-2')).toBe(1);
    });
  });

  describe('getCount()', () => {
    it('should return 0 for unknown user', async () => {
      const result = await rateLimitStore.getCount('unknown');
      expect(result).toBe(0);
    });

    it('should return current count', async () => {
      await rateLimitStore.increment('user-123', 60);
      await rateLimitStore.increment('user-123', 60);
      
      const result = await rateLimitStore.getCount('user-123');
      expect(result).toBe(2);
    });
  });

  describe('reset()', () => {
    it('should reset counter', async () => {
      await rateLimitStore.increment('user-123', 60);
      await rateLimitStore.increment('user-123', 60);
      
      await rateLimitStore.reset('user-123');
      
      expect(await rateLimitStore.getCount('user-123')).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SessionStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('SessionStore', () => {
  let kvStore: MemoryStore;
  let sessionStore: SessionStore;

  beforeEach(() => {
    kvStore = new MemoryStore();
    sessionStore = new SessionStore(kvStore);
  });

  describe('create()', () => {
    it('should create session', async () => {
      await sessionStore.create('user-123', 'conv-456');
      
      const session = await sessionStore.get('conv-456');
      expect(session).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.conversationId).toBe('conv-456');
      expect(session.messageCount).toBe(0);
      expect(session.tokenCount).toBe(0);
    });
  });

  describe('get()', () => {
    it('should return null for non-existent session', async () => {
      const result = await sessionStore.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should return session data', async () => {
      await sessionStore.create('user-123', 'conv-456');
      
      const session = await sessionStore.get('conv-456');
      expect(session).toBeDefined();
      expect(session.createdAt).toBeDefined();
      expect(session.lastActivity).toBeDefined();
    });
  });

  describe('update()', () => {
    it('should update message count', async () => {
      await sessionStore.create('user-123', 'conv-456');
      
      await sessionStore.update('conv-456', { messageCount: 5 });
      
      const session = await sessionStore.get('conv-456');
      expect(session.messageCount).toBe(5);
    });

    it('should update token count', async () => {
      await sessionStore.create('user-123', 'conv-456');
      
      await sessionStore.update('conv-456', { tokenCount: 1000 });
      
      const session = await sessionStore.get('conv-456');
      expect(session.tokenCount).toBe(1000);
    });

    it('should accumulate updates', async () => {
      await sessionStore.create('user-123', 'conv-456');
      
      await sessionStore.update('conv-456', { messageCount: 1 });
      await sessionStore.update('conv-456', { messageCount: 1 });
      
      const session = await sessionStore.get('conv-456');
      expect(session.messageCount).toBe(2);
    });

    it('should do nothing for non-existent session', async () => {
      await sessionStore.update('nonexistent', { messageCount: 5 });
      // Should not throw
    });
  });

  describe('delete()', () => {
    it('should delete session', async () => {
      await sessionStore.create('user-123', 'conv-456');
      
      await sessionStore.delete('conv-456');
      
      const session = await sessionStore.get('conv-456');
      expect(session).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// AckTokenStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AckTokenStore', () => {
  let kvStore: MemoryStore;
  let ackTokenStore: AckTokenStore;

  beforeEach(() => {
    kvStore = new MemoryStore();
    ackTokenStore = new AckTokenStore(kvStore);
  });

  describe('save() and validate()', () => {
    it('should save and validate token', async () => {
      await ackTokenStore.save('token-123', 'user-456', 300);
      
      const result = await ackTokenStore.validate('token-123', 'user-456');
      expect(result).toBe(true);
    });

    it('should reject wrong user', async () => {
      await ackTokenStore.save('token-123', 'user-456', 300);
      
      const result = await ackTokenStore.validate('token-123', 'wrong-user');
      expect(result).toBe(false);
    });

    it('should be single-use (second validate fails)', async () => {
      await ackTokenStore.save('token-123', 'user-456', 300);
      
      await ackTokenStore.validate('token-123', 'user-456');
      const result = await ackTokenStore.validate('token-123', 'user-456');
      
      expect(result).toBe(false);
    });

    it('should reject non-existent token', async () => {
      const result = await ackTokenStore.validate('nonexistent', 'user-456');
      expect(result).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// BlockStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('BlockStore', () => {
  let kvStore: MemoryStore;
  let blockStore: BlockStore;

  beforeEach(() => {
    kvStore = new MemoryStore();
    blockStore = new BlockStore(kvStore);
  });

  describe('block()', () => {
    it('should block user', async () => {
      await blockStore.block('user-123', 'spam', 3600);
      
      const result = await blockStore.isBlocked('user-123');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('spam');
    });
  });

  describe('isBlocked()', () => {
    it('should return not blocked for unknown user', async () => {
      const result = await blockStore.isBlocked('unknown');
      
      expect(result.blocked).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('should return block info for blocked user', async () => {
      await blockStore.block('user-123', 'abuse', 3600);
      
      const result = await blockStore.isBlocked('user-123');
      
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('abuse');
      expect(result.until).toBeDefined();
    });
  });

  describe('unblock()', () => {
    it('should unblock user', async () => {
      await blockStore.block('user-123', 'spam', 3600);
      
      const unblocked = await blockStore.unblock('user-123');
      
      expect(unblocked).toBe(true);
      expect((await blockStore.isBlocked('user-123')).blocked).toBe(false);
    });

    it('should return false for non-blocked user', async () => {
      const result = await blockStore.unblock('nonexistent');
      expect(result).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// VetoHistoryStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('VetoHistoryStore', () => {
  let kvStore: MemoryStore;
  let vetoStore: VetoHistoryStore;

  beforeEach(() => {
    kvStore = new MemoryStore();
    vetoStore = new VetoHistoryStore(kvStore);
  });

  describe('track()', () => {
    it('should track veto and return count', async () => {
      const count = await vetoStore.track('user-123', 300);
      expect(count).toBe(1);
    });

    it('should accumulate vetoes', async () => {
      await vetoStore.track('user-123', 300);
      await vetoStore.track('user-123', 300);
      const count = await vetoStore.track('user-123', 300);
      
      expect(count).toBe(3);
    });

    it('should track different users separately', async () => {
      await vetoStore.track('user-1', 300);
      await vetoStore.track('user-1', 300);
      await vetoStore.track('user-2', 300);
      
      expect(await vetoStore.getCount('user-1', 300)).toBe(2);
      expect(await vetoStore.getCount('user-2', 300)).toBe(1);
    });
  });

  describe('getCount()', () => {
    it('should return 0 for unknown user', async () => {
      const count = await vetoStore.getCount('unknown', 300);
      expect(count).toBe(0);
    });

    it('should return current count', async () => {
      await vetoStore.track('user-123', 300);
      await vetoStore.track('user-123', 300);
      
      const count = await vetoStore.getCount('user-123', 300);
      expect(count).toBe(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// AuditLogStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AuditLogStore', () => {
  let kvStore: MemoryStore;
  let auditStore: AuditLogStore;

  beforeEach(() => {
    kvStore = new MemoryStore();
    auditStore = new AuditLogStore(kvStore);
  });

  describe('log()', () => {
    it('should log audit entry and return ID', async () => {
      const id = await auditStore.log({
        userId: 'user-123',
        action: 'login',
        details: { ip: '192.168.1.1' },
      });
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });
  });

  describe('getUserLogs()', () => {
    it('should return user logs', async () => {
      await auditStore.log({
        userId: 'user-123',
        action: 'login',
        details: {},
      });
      await auditStore.log({
        userId: 'user-123',
        action: 'logout',
        details: {},
      });
      
      const logs = await auditStore.getUserLogs('user-123');
      
      expect(logs).toHaveLength(2);
      expect(logs[0].action).toBe('logout'); // Most recent first
      expect(logs[1].action).toBe('login');
    });

    it('should return empty array for unknown user', async () => {
      const logs = await auditStore.getUserLogs('unknown');
      expect(logs).toEqual([]);
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 10; i++) {
        await auditStore.log({
          userId: 'user-123',
          action: `action-${i}`,
          details: {},
        });
      }
      
      const logs = await auditStore.getUserLogs('user-123', 5);
      expect(logs).toHaveLength(5);
    });
  });

  describe('getGlobalLogs()', () => {
    it('should return all logs across users', async () => {
      await auditStore.log({ userId: 'user-1', action: 'a', details: {} });
      await auditStore.log({ userId: 'user-2', action: 'b', details: {} });
      await auditStore.log({ userId: 'user-3', action: 'c', details: {} });
      
      const logs = await auditStore.getGlobalLogs();
      expect(logs).toHaveLength(3);
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 10; i++) {
        await auditStore.log({
          userId: `user-${i}`,
          action: `action-${i}`,
          details: {},
        });
      }
      
      const logs = await auditStore.getGlobalLogs(5);
      expect(logs).toHaveLength(5);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// StoreManager TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('StoreManager', () => {
  it('should return a store', () => {
    const manager = new StoreManager();
    const store = manager.getStore();
    
    expect(store).toBeDefined();
    expect(typeof store.get).toBe('function');
  });

  it('should return MemoryStore when no Redis URL', () => {
    const manager = new StoreManager();
    const store = manager.getStore();
    
    // Without Redis, should use memory store
    expect(store).toBeInstanceOf(MemoryStore);
  });

  it('should report if using Redis', () => {
    const manager = new StoreManager();
    
    // Without Redis URL, should not be using Redis
    expect(manager.isUsingRedis()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('AuditLogEntry', () => {
    it('should match expected structure', () => {
      const entry: AuditLogEntry = {
        id: 'audit-123',
        timestamp: Date.now(),
        userId: 'user-456',
        action: 'login',
        details: { ip: '127.0.0.1' },
        requestId: 'req-789',
        stance: 'lens',
        status: 'success',
      };
      
      expect(entry.id).toBe('audit-123');
      expect(entry.userId).toBe('user-456');
    });

    it('should allow optional fields', () => {
      const entry: AuditLogEntry = {
        id: 'audit-123',
        timestamp: Date.now(),
        userId: 'user-456',
        action: 'login',
        details: {},
      };
      
      expect(entry.requestId).toBeUndefined();
      expect(entry.stance).toBeUndefined();
      expect(entry.status).toBeUndefined();
    });
  });
});
