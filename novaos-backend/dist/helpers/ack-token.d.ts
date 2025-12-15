import { UserInput } from './types';
export interface AckTokenPayload {
    userId: string;
    sessionId: string;
    messageHash: string;
    actionsHash: string;
    reason: string;
    auditId: string;
    nonce: string;
    createdAt: number;
    expiresAt: number;
}
export interface AckTokenValidationResult {
    valid: boolean;
    reason?: string;
    payload?: AckTokenPayload;
}
export interface NonceStore {
    /**
     * Check if a nonce has been used.
     * @returns true if nonce exists (already used), false if available
     * @deprecated Use tryMarkUsed for atomic check-and-set
     */
    isUsed(nonce: string): Promise<boolean>;
    /**
     * Mark a nonce as used.
     * @param nonce - The nonce to mark
     * @param expiresAt - When the nonce record can be cleaned up
     * @deprecated Use tryMarkUsed for atomic check-and-set
     */
    markUsed(nonce: string, expiresAt: Date): Promise<void>;
    /**
     * Atomically check if nonce is unused AND mark it as used.
     * This prevents TOCTOU race conditions.
     * @param nonce - The nonce to check and mark
     * @param expiresAt - When the nonce record can be cleaned up
     * @returns true if nonce was unused and is now marked, false if already used
     */
    tryMarkUsed(nonce: string, expiresAt: Date): Promise<boolean>;
}
/**
 * In-memory nonce store for development/testing.
 * DO NOT USE IN PRODUCTION — use Redis or database.
 */
export declare class InMemoryNonceStore implements NonceStore {
    private used;
    private mutex;
    isUsed(nonce: string): Promise<boolean>;
    markUsed(nonce: string, expiresAt: Date): Promise<void>;
    /**
     * Atomic check-and-set for in-memory store.
     * Uses a mutex set to prevent concurrent access.
     */
    tryMarkUsed(nonce: string, expiresAt: Date): Promise<boolean>;
    private cleanup;
}
/**
 * Redis nonce store implementation.
 * Use this in production.
 */
export declare class RedisNonceStore implements NonceStore {
    private redis;
    constructor(redis: {
        get: Function;
        setex: Function;
        set: Function;
    });
    isUsed(nonce: string): Promise<boolean>;
    markUsed(nonce: string, expiresAt: Date): Promise<void>;
    /**
     * Atomic check-and-set using Redis SET NX EX.
     * SET key value NX EX ttl — only sets if key doesn't exist.
     * Returns OK if set, null if key already exists.
     */
    tryMarkUsed(nonce: string, expiresAt: Date): Promise<boolean>;
}
/**
 * Generate a secure, context-bound acknowledgment token.
 */
export declare function generateAckToken(input: UserInput, reason: string, auditId: string, secret: string): {
    token: string;
    payload: AckTokenPayload;
};
/**
 * Validate an acknowledgment token.
 *
 * Checks:
 * 1. Signature validity
 * 2. Token not expired (with clock skew tolerance)
 * 3. Nonce not previously used
 * 4. Context matches current request
 * 5. Acknowledgment text matches expected
 */
export declare function validateAckToken(token: string, input: UserInput, ackText: string, expectedText: string, secret: string, nonceStore: NonceStore): Promise<AckTokenValidationResult>;
export declare const ACK_REQUIRED_TEXT = "I understand the risks and want to proceed";
/**
 * Get the required acknowledgment text for a soft veto.
 * Could be customized based on veto type in the future.
 */
export declare function getRequiredAckText(vetoReason?: string): string;
//# sourceMappingURL=ack-token.d.ts.map