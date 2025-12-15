import { PipelineState, GateResults, PipelineContext, ResponseAudit } from './types';
/**
 * Hash content using full SHA-256.
 * NEVER truncate — truncated hashes are vulnerable to collision attacks.
 *
 * @param content - Content to hash
 * @returns Full 64-character hex hash
 */
export declare function hashContent(content: string): string;
/**
 * Create a short prefix for indexing/display.
 * This is NOT for security — only for UI/query convenience.
 * The full hash must always be stored and used for verification.
 */
export declare function hashPrefix(fullHash: string, length?: number): string;
/**
 * Redact PII from text before storing in audit logs.
 *
 * Patterns covered:
 * - SSN (with/without dashes)
 * - Credit cards (various formats)
 * - Email addresses
 * - Phone numbers (US/international)
 * - IP addresses
 * - Passport numbers (common formats)
 * - Driver's license (common formats)
 */
export declare function redactPII(text: string): {
    redacted: string;
    patternsFound: string[];
};
interface EncryptedSnapshot {
    version: number;
    iv: string;
    authTag: string;
    ciphertext: string;
}
/**
 * Encrypt a snapshot for storage.
 * Uses AES-256-GCM for authenticated encryption.
 */
export declare function encryptSnapshot(data: string, key: Buffer, keyVersion?: number): EncryptedSnapshot;
/**
 * Decrypt a snapshot.
 * Requires the correct key version.
 */
export declare function decryptSnapshot(encrypted: EncryptedSnapshot, getKey: (version: number) => Buffer): string;
export interface AuditStorage {
    store(audit: ResponseAudit): Promise<void>;
    storeSnapshot(ref: string, data: EncryptedSnapshot): Promise<void>;
}
export declare class AuditLogger {
    private storage;
    private encryptionKey;
    private keyVersion;
    constructor(storage: AuditStorage, encryptionKey: Buffer, keyVersion?: number);
    logResponse(state: PipelineState, results: GateResults, context: PipelineContext, responseText: string): Promise<string>;
    private buildGateAuditEntries;
    private extractTrustViolations;
}
export {};
//# sourceMappingURL=audit-logger.d.ts.map