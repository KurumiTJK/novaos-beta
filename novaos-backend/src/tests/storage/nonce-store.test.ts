// ═══════════════════════════════════════════════════════════════════════════════
// NONCE STORE TESTS — Token Replay Attack Prevention
// NovaOS Storage Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  NonceStore,
  InMemoryNonceStore,
  RedisNonceStore,
  createNonceStore,
  getDefaultNonceStore,
  setDefaultNonceStore,
  type NonceStoreConfig,
} from '../../storage/nonce-store.js';

// ─────────────────────────────────────────────────────────────────────────────────
// InMemoryNonceStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('InMemoryNonceStore', () => {
  let store: InMemoryNonceStore;

  beforeEach(() => {
    store = new InMemoryNonceStore();
  });

  describe('checkAndMark()', () => {
    it('should return true for first use of nonce', async () => {
      const result = await store.checkAndMark('nonce-123', 300);
      expect(result).toBe(true);
    });

    it('should return false for second use of same nonce', async () => {
      await store.checkAndMark('nonce-123', 300);
      const result = await store.checkAndMark('nonce-123', 300);
      expect(result).toBe(false);
    });

    it('should allow different nonces', async () => {
      expect(await store.checkAndMark('nonce-1', 300)).toBe(true);
      expect(await store.checkAndMark('nonce-2', 300)).toBe(true);
      expect(await store.checkAndMark('nonce-3', 300)).toBe(true);
    });
  });

  describe('isUsed()', () => {
    it('should return false for unused nonce', async () => {
      const result = await store.isUsed('nonce-123');
      expect(result).toBe(false);
    });

    it('should return true for used nonce', async () => {
      await store.checkAndMark('nonce-123', 300);
      const result = await store.isUsed('nonce-123');
      expect(result).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// RedisNonceStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RedisNonceStore', () => {
  let store: RedisNonceStore;
  let mockRedis: any;

  beforeEach(() => {
    // Create mock Redis client
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      set: vi.fn(),
    };
    store = new RedisNonceStore(mockRedis);
  });

  describe('checkAndMark()', () => {
    it('should return true when SET NX succeeds', async () => {
      mockRedis.set.mockResolvedValue('OK');
      
      const result = await store.checkAndMark('nonce-123', 300);
      
      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'nonce:nonce-123',
        '1',
        'NX',
        'EX',
        300
      );
    });

    it('should return false when SET NX fails (nonce exists)', async () => {
      mockRedis.set.mockResolvedValue(null);
      
      const result = await store.checkAndMark('nonce-123', 300);
      
      expect(result).toBe(false);
    });
  });

  describe('isUsed()', () => {
    it('should return false when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const result = await store.isUsed('nonce-123');
      
      expect(result).toBe(false);
      expect(mockRedis.get).toHaveBeenCalledWith('nonce:nonce-123');
    });

    it('should return true when key exists', async () => {
      mockRedis.get.mockResolvedValue('1');
      
      const result = await store.isUsed('nonce-123');
      
      expect(result).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// createNonceStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createNonceStore()', () => {
  it('should create InMemoryNonceStore for memory type', () => {
    const store = createNonceStore({ type: 'memory' });
    expect(store).toBeInstanceOf(InMemoryNonceStore);
  });

  it('should warn when using memory store', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    createNonceStore({ type: 'memory' });
    
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('NOT FOR PRODUCTION')
    );
    
    warnSpy.mockRestore();
  });

  it('should create RedisNonceStore for redis type', () => {
    const store = createNonceStore({
      type: 'redis',
      redis: {
        host: 'localhost',
        port: 6379,
      },
    });
    expect(store).toBeInstanceOf(RedisNonceStore);
  });

  it('should throw error for redis type without config', () => {
    expect(() => {
      createNonceStore({ type: 'redis' } as NonceStoreConfig);
    }).toThrow('Redis configuration required');
  });

  it('should throw error for unknown type', () => {
    expect(() => {
      createNonceStore({ type: 'unknown' } as any);
    }).toThrow('Unknown nonce store type');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT STORE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Default Store Functions', () => {
  beforeEach(() => {
    // Reset the default store
    setDefaultNonceStore(new InMemoryNonceStore());
  });

  describe('getDefaultNonceStore()', () => {
    it('should return a store instance', () => {
      const store = getDefaultNonceStore();
      expect(store).toBeDefined();
      expect(typeof store.checkAndMark).toBe('function');
      expect(typeof store.isUsed).toBe('function');
    });

    it('should return same instance on multiple calls', () => {
      const store1 = getDefaultNonceStore();
      const store2 = getDefaultNonceStore();
      expect(store1).toBe(store2);
    });
  });

  describe('setDefaultNonceStore()', () => {
    it('should set the default store', () => {
      const customStore = new InMemoryNonceStore();
      setDefaultNonceStore(customStore);
      
      const store = getDefaultNonceStore();
      expect(store).toBe(customStore);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// NonceStore INTERFACE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('NonceStore Interface', () => {
  it('should enforce checkAndMark method signature', () => {
    const store: NonceStore = {
      checkAndMark: async (nonce: string, ttlSeconds: number) => true,
      isUsed: async (nonce: string) => false,
    };
    
    expect(typeof store.checkAndMark).toBe('function');
  });

  it('should enforce isUsed method signature', () => {
    const store: NonceStore = {
      checkAndMark: async (nonce: string, ttlSeconds: number) => true,
      isUsed: async (nonce: string) => false,
    };
    
    expect(typeof store.isUsed).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK REDIS CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Mock Redis Client (createNonceStore)', () => {
  let store: NonceStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createNonceStore({
      type: 'redis',
      redis: {
        host: 'localhost',
        port: 6379,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should mark nonce successfully', async () => {
    const result = await store.checkAndMark('test-nonce', 300);
    expect(result).toBe(true);
  });

  it('should reject duplicate nonce', async () => {
    await store.checkAndMark('test-nonce', 300);
    const result = await store.checkAndMark('test-nonce', 300);
    expect(result).toBe(false);
  });

  it('should check if nonce is used', async () => {
    expect(await store.isUsed('test-nonce')).toBe(false);
    await store.checkAndMark('test-nonce', 300);
    expect(await store.isUsed('test-nonce')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('NonceStoreConfig', () => {
    it('should accept memory type config', () => {
      const config: NonceStoreConfig = {
        type: 'memory',
      };
      expect(config.type).toBe('memory');
    });

    it('should accept redis type config', () => {
      const config: NonceStoreConfig = {
        type: 'redis',
        redis: {
          host: 'localhost',
          port: 6379,
          password: 'secret',
          db: 0,
        },
      };
      expect(config.type).toBe('redis');
      expect(config.redis?.host).toBe('localhost');
    });
  });
});
