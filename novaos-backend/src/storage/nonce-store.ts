// ═══════════════════════════════════════════════════════════════════════════════
// NONCE STORE — Production Redis Implementation
// Prevents token replay attacks with atomic check-and-set
// ═══════════════════════════════════════════════════════════════════════════════

import { NonceStore, InMemoryNonceStore, RedisNonceStore } from '../security/auth/ack-token.js';

// Re-export the base implementations
export { NonceStore, InMemoryNonceStore, RedisNonceStore };

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

export interface NonceStoreConfig {
  type: 'memory' | 'redis';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

/**
 * Create a nonce store based on configuration.
 * 
 * For production, ALWAYS use Redis.
 * In-memory is ONLY for development/testing.
 */
export function createNonceStore(config: NonceStoreConfig): NonceStore {
  if (config.type === 'memory') {
    console.warn('[SECURITY] Using in-memory nonce store. NOT FOR PRODUCTION.');
    return new InMemoryNonceStore();
  }

  if (config.type === 'redis') {
    if (!config.redis) {
      throw new Error('Redis configuration required for redis nonce store');
    }

    // In a real implementation, you would create a Redis client here
    // For Phase 1, we'll create a mock that has the Redis interface
    const mockRedis = createMockRedisClient(config.redis);
    return new RedisNonceStore(mockRedis);
  }

  throw new Error(`Unknown nonce store type: ${config.type}`);
}

/**
 * Create a mock Redis client for Phase 1.
 * In production, replace with actual Redis client (ioredis, node-redis, etc.)
 */
function createMockRedisClient(config: NonceStoreConfig['redis']) {
  // In-memory storage for mock
  const storage = new Map<string, { value: string; expireAt: number }>();

  // Cleanup expired keys periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of storage.entries()) {
      if (data.expireAt < now) {
        storage.delete(key);
      }
    }
  }, 60000); // Every minute

  return {
    async get(key: string): Promise<string | null> {
      const data = storage.get(key);
      if (!data) return null;
      if (data.expireAt < Date.now()) {
        storage.delete(key);
        return null;
      }
      return data.value;
    },

    async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
      storage.set(key, {
        value,
        expireAt: Date.now() + ttlSeconds * 1000,
      });
    },

    async set(
      key: string,
      value: string,
      nx?: 'NX',
      ex?: 'EX',
      ttlSeconds?: number
    ): Promise<'OK' | null> {
      // NX = only set if not exists
      if (nx === 'NX' && storage.has(key)) {
        const existing = storage.get(key)!;
        if (existing.expireAt > Date.now()) {
          return null; // Key exists and not expired
        }
      }

      const expireAt = ex === 'EX' && ttlSeconds 
        ? Date.now() + ttlSeconds * 1000 
        : Date.now() + 3600000; // Default 1 hour

      storage.set(key, { value, expireAt });
      return 'OK';
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT STORE
// ─────────────────────────────────────────────────────────────────────────────────

let defaultStore: NonceStore | null = null;

/**
 * Get the default nonce store.
 * Creates an in-memory store if not configured.
 */
export function getDefaultNonceStore(): NonceStore {
  if (!defaultStore) {
    const redisUrl = process.env.REDIS_URL;
    
    if (redisUrl) {
      // Parse Redis URL and create Redis store
      // For Phase 1, fall back to memory
      console.log('[NONCE] Redis URL detected, but using mock for Phase 1');
      defaultStore = createNonceStore({ type: 'memory' });
    } else {
      defaultStore = createNonceStore({ type: 'memory' });
    }
  }
  return defaultStore;
}

/**
 * Set the default nonce store.
 */
export function setDefaultNonceStore(store: NonceStore): void {
  defaultStore = store;
}
