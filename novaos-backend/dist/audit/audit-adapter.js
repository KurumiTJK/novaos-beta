"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT ADAPTER — Storage Adapter for Audit Logs
// Phase 0 explicitly excludes hash chaining — that's Phase 2
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashContent = exports.AuditLogger = exports.DatabaseAuditStorage = exports.FileAuditStorage = exports.InMemoryAuditStorage = void 0;
exports.createAuditLogger = createAuditLogger;
exports.getDefaultAuditLogger = getDefaultAuditLogger;
exports.setDefaultAuditLogger = setDefaultAuditLogger;
const crypto_1 = require("crypto");
const audit_logger_js_1 = require("../helpers/audit-logger.js");
Object.defineProperty(exports, "AuditLogger", { enumerable: true, get: function () { return audit_logger_js_1.AuditLogger; } });
Object.defineProperty(exports, "hashContent", { enumerable: true, get: function () { return audit_logger_js_1.hashContent; } });
// ─────────────────────────────────────────────────────────────────────────────────
// IN-MEMORY STORAGE (Development Only)
// ─────────────────────────────────────────────────────────────────────────────────
class InMemoryAuditStorage {
    audits = new Map();
    snapshots = new Map();
    async store(audit) {
        this.audits.set(audit.requestId, audit);
        console.log(`[AUDIT] Stored audit for request ${audit.requestId}`);
    }
    async storeSnapshot(ref, data) {
        this.snapshots.set(ref, data);
        console.log(`[AUDIT] Stored snapshot ${ref}`);
    }
    // Query methods for development
    getAudit(requestId) {
        return this.audits.get(requestId);
    }
    getAllAudits() {
        return Array.from(this.audits.values());
    }
    getSnapshot(ref) {
        return this.snapshots.get(ref);
    }
}
exports.InMemoryAuditStorage = InMemoryAuditStorage;
// ─────────────────────────────────────────────────────────────────────────────────
// FILE-BASED STORAGE (Simple Persistence)
// ─────────────────────────────────────────────────────────────────────────────────
const fs_1 = require("fs");
const path_1 = require("path");
class FileAuditStorage {
    basePath;
    constructor(basePath = './audit-logs') {
        this.basePath = basePath;
    }
    async store(audit) {
        const dir = (0, path_1.join)(this.basePath, 'audits');
        await fs_1.promises.mkdir(dir, { recursive: true });
        const filename = `${audit.requestId}.json`;
        const filepath = (0, path_1.join)(dir, filename);
        await fs_1.promises.writeFile(filepath, JSON.stringify(audit, null, 2));
        console.log(`[AUDIT] Written to ${filepath}`);
    }
    async storeSnapshot(ref, data) {
        const dir = (0, path_1.join)(this.basePath, 'snapshots');
        await fs_1.promises.mkdir(dir, { recursive: true });
        const filename = `${ref}.json`;
        const filepath = (0, path_1.join)(dir, filename);
        await fs_1.promises.writeFile(filepath, JSON.stringify(data));
        console.log(`[AUDIT] Snapshot written to ${filepath}`);
    }
}
exports.FileAuditStorage = FileAuditStorage;
class DatabaseAuditStorage {
    config;
    constructor(config) {
        this.config = config;
        console.log('[AUDIT] Database storage configured (placeholder)');
    }
    async store(audit) {
        // In production, this would insert into the database
        // For Phase 1, log the intent
        console.log(`[AUDIT] Would store audit ${audit.requestId} to database`);
        console.log(`[AUDIT] Policy versions: ${audit.policyVersion}, ${audit.capabilityMatrixVersion}`);
        console.log(`[AUDIT] Gates executed: ${audit.gatesExecuted.map(g => g.gateId).join(' → ')}`);
    }
    async storeSnapshot(ref, data) {
        // In production, this would insert into the snapshots table
        console.log(`[AUDIT] Would store snapshot ${ref} to database`);
    }
}
exports.DatabaseAuditStorage = DatabaseAuditStorage;
/**
 * Create an audit logger with the specified storage adapter.
 */
function createAuditLogger(config) {
    let storage;
    switch (config.type) {
        case 'memory':
            storage = new InMemoryAuditStorage();
            break;
        case 'file':
            storage = new FileAuditStorage(config.filePath);
            break;
        case 'database':
            if (!config.database) {
                throw new Error('Database config required for database audit storage');
            }
            storage = new DatabaseAuditStorage(config.database);
            break;
        default:
            throw new Error(`Unknown audit storage type: ${config.type}`);
    }
    // Generate encryption key if not provided
    const encryptionKey = config.encryptionKey || (0, crypto_1.randomBytes)(32);
    return new audit_logger_js_1.AuditLogger(storage, encryptionKey, 1);
}
// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT LOGGER
// ─────────────────────────────────────────────────────────────────────────────────
let defaultLogger = null;
/**
 * Get the default audit logger.
 */
function getDefaultAuditLogger() {
    if (!defaultLogger) {
        const storageType = process.env.AUDIT_STORAGE_TYPE || 'memory';
        defaultLogger = createAuditLogger({
            type: storageType,
            filePath: process.env.AUDIT_FILE_PATH || './audit-logs',
        });
    }
    return defaultLogger;
}
/**
 * Set the default audit logger.
 */
function setDefaultAuditLogger(logger) {
    defaultLogger = logger;
}
//# sourceMappingURL=audit-adapter.js.map