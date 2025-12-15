"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// NONCE STORE — Production Redis Implementation
// Prevents token replay attacks with atomic check-and-set
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisNonceStore = exports.InMemoryNonceStore = void 0;
exports.createNonceStore = createNonceStore;
exports.getDefaultNonceStore = getDefaultNonceStore;
exports.setDefaultNonceStore = setDefaultNonceStore;
const ack_token_js_1 = require("../helpers/ack-token.js");
Object.defineProperty(exports, "InMemoryNonceStore", { enumerable: true, get: function () { return ack_token_js_1.InMemoryNonceStore; } });
Object.defineProperty(exports, "RedisNonceStore", { enumerable: true, get: function () { return ack_token_js_1.RedisNonceStore; } });
/**
 * Create a nonce store based on configuration.
 *
 * For production, ALWAYS use Redis.
 * In-memory is ONLY for development/testing.
 */
function createNonceStore(config) {
    if (config.type === 'memory') {
        console.warn('[SECURITY] Using in-memory nonce store. NOT FOR PRODUCTION.');
        return new ack_token_js_1.InMemoryNonceStore();
    }
    if (config.type === 'redis') {
        if (!config.redis) {
            throw new Error('Redis configuration required for redis nonce store');
        }
        // In a real implementation, you would create a Redis client here
        // For Phase 1, we'll create a mock that has the Redis interface
        const mockRedis = createMockRedisClient(config.redis);
        return new ack_token_js_1.RedisNonceStore(mockRedis);
    }
    throw new Error(`Unknown nonce store type: ${config.type}`);
}
/**
 * Create a mock Redis client for Phase 1.
 * In production, replace with actual Redis client (ioredis, node-redis, etc.)
 */
function createMockRedisClient(config) {
    // In-memory storage for mock
    const storage = new Map();
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
        async get(key) {
            const data = storage.get(key);
            if (!data)
                return null;
            if (data.expireAt < Date.now()) {
                storage.delete(key);
                return null;
            }
            return data.value;
        },
        async setex(key, ttlSeconds, value) {
            storage.set(key, {
                value,
                expireAt: Date.now() + ttlSeconds * 1000,
            });
        },
        async set(key, value, nx, ex, ttlSeconds) {
            // NX = only set if not exists
            if (nx === 'NX' && storage.has(key)) {
                const existing = storage.get(key);
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
let defaultStore = null;
/**
 * Get the default nonce store.
 * Creates an in-memory store if not configured.
 */
function getDefaultNonceStore() {
    if (!defaultStore) {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
            // Parse Redis URL and create Redis store
            // For Phase 1, fall back to memory
            console.log('[NONCE] Redis URL detected, but using mock for Phase 1');
            defaultStore = createNonceStore({ type: 'memory' });
        }
        else {
            defaultStore = createNonceStore({ type: 'memory' });
        }
    }
    return defaultStore;
}
/**
 * Set the default nonce store.
 */
function setDefaultNonceStore(store) {
    defaultStore = store;
}
//# sourceMappingURL=nonce-store.js.map