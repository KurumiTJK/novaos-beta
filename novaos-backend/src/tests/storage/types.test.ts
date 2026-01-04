// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE TYPES TESTS — KeyValueStore Interface Verification
// NovaOS Storage Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import type { KeyValueStore } from '../../storage/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// KeyValueStore INTERFACE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('KeyValueStore Interface', () => {
  describe('String Operations', () => {
    it('should define get method', () => {
      const store: Partial<KeyValueStore> = {
        get: async (key: string) => null,
      };
      expect(typeof store.get).toBe('function');
    });

    it('should define set method with optional TTL', () => {
      const store: Partial<KeyValueStore> = {
        set: async (key: string, value: string, ttlSeconds?: number) => {},
      };
      expect(typeof store.set).toBe('function');
    });

    it('should define delete method', () => {
      const store: Partial<KeyValueStore> = {
        delete: async (key: string) => true,
      };
      expect(typeof store.delete).toBe('function');
    });

    it('should define exists method', () => {
      const store: Partial<KeyValueStore> = {
        exists: async (key: string) => false,
      };
      expect(typeof store.exists).toBe('function');
    });

    it('should define expire method', () => {
      const store: Partial<KeyValueStore> = {
        expire: async (key: string, ttlSeconds: number) => true,
      };
      expect(typeof store.expire).toBe('function');
    });

    it('should define ttl method', () => {
      const store: Partial<KeyValueStore> = {
        ttl: async (key: string) => -1,
      };
      expect(typeof store.ttl).toBe('function');
    });

    it('should define incr method', () => {
      const store: Partial<KeyValueStore> = {
        incr: async (key: string) => 1,
      };
      expect(typeof store.incr).toBe('function');
    });

    it('should define incrBy method', () => {
      const store: Partial<KeyValueStore> = {
        incrBy: async (key: string, increment: number) => 1,
      };
      expect(typeof store.incrBy).toBe('function');
    });
  });

  describe('List Operations', () => {
    it('should define lpush method', () => {
      const store: Partial<KeyValueStore> = {
        lpush: async (key: string, ...values: string[]) => 1,
      };
      expect(typeof store.lpush).toBe('function');
    });

    it('should define rpush method', () => {
      const store: Partial<KeyValueStore> = {
        rpush: async (key: string, ...values: string[]) => 1,
      };
      expect(typeof store.rpush).toBe('function');
    });

    it('should define lpop method', () => {
      const store: Partial<KeyValueStore> = {
        lpop: async (key: string) => null,
      };
      expect(typeof store.lpop).toBe('function');
    });

    it('should define rpop method', () => {
      const store: Partial<KeyValueStore> = {
        rpop: async (key: string) => null,
      };
      expect(typeof store.rpop).toBe('function');
    });

    it('should define lrange method', () => {
      const store: Partial<KeyValueStore> = {
        lrange: async (key: string, start: number, stop: number) => [],
      };
      expect(typeof store.lrange).toBe('function');
    });

    it('should define llen method', () => {
      const store: Partial<KeyValueStore> = {
        llen: async (key: string) => 0,
      };
      expect(typeof store.llen).toBe('function');
    });

    it('should define ltrim method', () => {
      const store: Partial<KeyValueStore> = {
        ltrim: async (key: string, start: number, stop: number) => {},
      };
      expect(typeof store.ltrim).toBe('function');
    });

    it('should define lrem method', () => {
      const store: Partial<KeyValueStore> = {
        lrem: async (key: string, count: number, value: string) => 0,
      };
      expect(typeof store.lrem).toBe('function');
    });
  });

  describe('Set Operations', () => {
    it('should define sadd method', () => {
      const store: Partial<KeyValueStore> = {
        sadd: async (key: string, ...members: string[]) => 1,
      };
      expect(typeof store.sadd).toBe('function');
    });

    it('should define srem method', () => {
      const store: Partial<KeyValueStore> = {
        srem: async (key: string, ...members: string[]) => 1,
      };
      expect(typeof store.srem).toBe('function');
    });

    it('should define smembers method', () => {
      const store: Partial<KeyValueStore> = {
        smembers: async (key: string) => [],
      };
      expect(typeof store.smembers).toBe('function');
    });

    it('should define sismember method', () => {
      const store: Partial<KeyValueStore> = {
        sismember: async (key: string, member: string) => false,
      };
      expect(typeof store.sismember).toBe('function');
    });

    it('should define scard method', () => {
      const store: Partial<KeyValueStore> = {
        scard: async (key: string) => 0,
      };
      expect(typeof store.scard).toBe('function');
    });
  });

  describe('Hash Operations', () => {
    it('should define hget method', () => {
      const store: Partial<KeyValueStore> = {
        hget: async (key: string, field: string) => null,
      };
      expect(typeof store.hget).toBe('function');
    });

    it('should define hset method', () => {
      const store: Partial<KeyValueStore> = {
        hset: async (key: string, field: string, value: string) => 1,
      };
      expect(typeof store.hset).toBe('function');
    });

    it('should define hdel method', () => {
      const store: Partial<KeyValueStore> = {
        hdel: async (key: string, ...fields: string[]) => 1,
      };
      expect(typeof store.hdel).toBe('function');
    });

    it('should define hgetall method', () => {
      const store: Partial<KeyValueStore> = {
        hgetall: async (key: string) => ({}),
      };
      expect(typeof store.hgetall).toBe('function');
    });
  });

  describe('Utility Operations', () => {
    it('should define keys method', () => {
      const store: Partial<KeyValueStore> = {
        keys: async (pattern: string) => [],
      };
      expect(typeof store.keys).toBe('function');
    });

    it('should define ping method', () => {
      const store: Partial<KeyValueStore> = {
        ping: async () => 'PONG',
      };
      expect(typeof store.ping).toBe('function');
    });

    it('should define flushall method', () => {
      const store: Partial<KeyValueStore> = {
        flushall: async () => {},
      };
      expect(typeof store.flushall).toBe('function');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  it('should allow implementation of full interface', () => {
    const mockStore: KeyValueStore = {
      // String operations
      get: async () => null,
      set: async () => {},
      delete: async () => true,
      exists: async () => false,
      expire: async () => true,
      ttl: async () => -1,
      incr: async () => 1,
      incrBy: async () => 1,
      
      // List operations
      lpush: async () => 1,
      rpush: async () => 1,
      lpop: async () => null,
      rpop: async () => null,
      lrange: async () => [],
      llen: async () => 0,
      ltrim: async () => {},
      lrem: async () => 0,
      
      // Set operations
      sadd: async () => 1,
      srem: async () => 1,
      smembers: async () => [],
      sismember: async () => false,
      scard: async () => 0,
      
      // Hash operations
      hget: async () => null,
      hset: async () => 1,
      hdel: async () => 1,
      hgetall: async () => ({}),
      
      // Utility
      keys: async () => [],
      ping: async () => 'PONG',
      flushall: async () => {},
    };
    
    expect(mockStore).toBeDefined();
  });

  it('should enforce Promise return types', async () => {
    const mockStore: KeyValueStore = {
      get: async () => 'value',
      set: async () => {},
      delete: async () => true,
      exists: async () => true,
      expire: async () => true,
      ttl: async () => 100,
      incr: async () => 1,
      incrBy: async () => 5,
      lpush: async () => 1,
      rpush: async () => 1,
      lpop: async () => 'item',
      rpop: async () => 'item',
      lrange: async () => ['a', 'b'],
      llen: async () => 2,
      ltrim: async () => {},
      lrem: async () => 1,
      sadd: async () => 1,
      srem: async () => 1,
      smembers: async () => ['member'],
      sismember: async () => true,
      scard: async () => 1,
      hget: async () => 'value',
      hset: async () => 1,
      hdel: async () => 1,
      hgetall: async () => ({ field: 'value' }),
      keys: async () => ['key1'],
      ping: async () => 'PONG',
      flushall: async () => {},
    };
    
    // All methods return promises
    expect(mockStore.get('key')).toBeInstanceOf(Promise);
    expect(mockStore.set('key', 'value')).toBeInstanceOf(Promise);
    expect(mockStore.delete('key')).toBeInstanceOf(Promise);
    expect(mockStore.incr('key')).toBeInstanceOf(Promise);
    expect(mockStore.lpush('key', 'value')).toBeInstanceOf(Promise);
    expect(mockStore.sadd('key', 'member')).toBeInstanceOf(Promise);
    expect(mockStore.hget('key', 'field')).toBeInstanceOf(Promise);
  });
});
