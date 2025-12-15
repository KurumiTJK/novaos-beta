import { AuditLogger, AuditStorage, hashContent } from '../helpers/audit-logger.js';
import { ResponseAudit } from '../helpers/types.js';
export declare class InMemoryAuditStorage implements AuditStorage {
    private audits;
    private snapshots;
    store(audit: ResponseAudit): Promise<void>;
    storeSnapshot(ref: string, data: any): Promise<void>;
    getAudit(requestId: string): ResponseAudit | undefined;
    getAllAudits(): ResponseAudit[];
    getSnapshot(ref: string): any;
}
export declare class FileAuditStorage implements AuditStorage {
    private basePath;
    constructor(basePath?: string);
    store(audit: ResponseAudit): Promise<void>;
    storeSnapshot(ref: string, data: any): Promise<void>;
}
export interface DatabaseConfig {
    connectionString: string;
    tableName?: string;
    snapshotTableName?: string;
}
export declare class DatabaseAuditStorage implements AuditStorage {
    private config;
    constructor(config: DatabaseConfig);
    store(audit: ResponseAudit): Promise<void>;
    storeSnapshot(ref: string, data: any): Promise<void>;
}
export interface AuditAdapterConfig {
    type: 'memory' | 'file' | 'database';
    filePath?: string;
    database?: DatabaseConfig;
    encryptionKey?: Buffer;
}
/**
 * Create an audit logger with the specified storage adapter.
 */
export declare function createAuditLogger(config: AuditAdapterConfig): AuditLogger;
/**
 * Get the default audit logger.
 */
export declare function getDefaultAuditLogger(): AuditLogger;
/**
 * Set the default audit logger.
 */
export declare function setDefaultAuditLogger(logger: AuditLogger): void;
export { AuditLogger, AuditStorage, hashContent };
//# sourceMappingURL=audit-adapter.d.ts.map