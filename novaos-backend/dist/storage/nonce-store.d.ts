import { NonceStore, InMemoryNonceStore, RedisNonceStore } from '../helpers/ack-token.js';
export { NonceStore, InMemoryNonceStore, RedisNonceStore };
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
export declare function createNonceStore(config: NonceStoreConfig): NonceStore;
/**
 * Get the default nonce store.
 * Creates an in-memory store if not configured.
 */
export declare function getDefaultNonceStore(): NonceStore;
/**
 * Set the default nonce store.
 */
export declare function setDefaultNonceStore(store: NonceStore): void;
//# sourceMappingURL=nonce-store.d.ts.map