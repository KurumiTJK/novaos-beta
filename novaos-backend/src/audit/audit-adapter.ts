// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT ADAPTER — Storage Adapter for Audit Logs
// Phase 0 explicitly excludes hash chaining — that's Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import { randomBytes } from 'crypto';
import {
  AuditLogger,
  AuditStorage,
  hashContent,
  encryptSnapshot,
} from '../helpers/audit-logger.js';
import { ResponseAudit } from '../helpers/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// IN-MEMORY STORAGE (Development Only)
// ─────────────────────────────────────────────────────────────────────────────────

export class InMemoryAuditStorage implements AuditStorage {
  private audits: Map<string, ResponseAudit> = new Map();
  private snapshots: Map<string, any> = new Map();

  async store(audit: ResponseAudit): Promise<void> {
    this.audits.set(audit.requestId, audit);
    console.log(`[AUDIT] Stored audit for request ${audit.requestId}`);
  }

  async storeSnapshot(ref: string, data: any): Promise<void> {
    this.snapshots.set(ref, data);
    console.log(`[AUDIT] Stored snapshot ${ref}`);
  }

  // Query methods for development
  getAudit(requestId: string): ResponseAudit | undefined {
    return this.audits.get(requestId);
  }

  getAllAudits(): ResponseAudit[] {
    return Array.from(this.audits.values());
  }

  getSnapshot(ref: string): any {
    return this.snapshots.get(ref);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FILE-BASED STORAGE (Simple Persistence)
// ─────────────────────────────────────────────────────────────────────────────────

import { promises as fs } from 'fs';
import { join } from 'path';

export class FileAuditStorage implements AuditStorage {
  private basePath: string;

  constructor(basePath: string = './audit-logs') {
    this.basePath = basePath;
  }

  async store(audit: ResponseAudit): Promise<void> {
    const dir = join(this.basePath, 'audits');
    await fs.mkdir(dir, { recursive: true });

    const filename = `${audit.requestId}.json`;
    const filepath = join(dir, filename);

    await fs.writeFile(filepath, JSON.stringify(audit, null, 2));
    console.log(`[AUDIT] Written to ${filepath}`);
  }

  async storeSnapshot(ref: string, data: any): Promise<void> {
    const dir = join(this.basePath, 'snapshots');
    await fs.mkdir(dir, { recursive: true });

    const filename = `${ref}.json`;
    const filepath = join(dir, filename);

    await fs.writeFile(filepath, JSON.stringify(data));
    console.log(`[AUDIT] Snapshot written to ${filepath}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// DATABASE STORAGE (Production Placeholder)
// ─────────────────────────────────────────────────────────────────────────────────

export interface DatabaseConfig {
  connectionString: string;
  tableName?: string;
  snapshotTableName?: string;
}

export class DatabaseAuditStorage implements AuditStorage {
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    console.log('[AUDIT] Database storage configured (placeholder)');
  }

  async store(audit: ResponseAudit): Promise<void> {
    // In production, this would insert into the database
    // For Phase 1, log the intent
    console.log(`[AUDIT] Would store audit ${audit.requestId} to database`);
    console.log(`[AUDIT] Policy versions: ${audit.policyVersion}, ${audit.capabilityMatrixVersion}`);
    console.log(`[AUDIT] Gates executed: ${audit.gatesExecuted.map(g => g.gateId).join(' → ')}`);
  }

  async storeSnapshot(ref: string, data: any): Promise<void> {
    // In production, this would insert into the snapshots table
    console.log(`[AUDIT] Would store snapshot ${ref} to database`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

export interface AuditAdapterConfig {
  type: 'memory' | 'file' | 'database';
  filePath?: string;
  database?: DatabaseConfig;
  encryptionKey?: Buffer;
}

/**
 * Create an audit logger with the specified storage adapter.
 */
export function createAuditLogger(config: AuditAdapterConfig): AuditLogger {
  let storage: AuditStorage;

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
  const encryptionKey = config.encryptionKey || randomBytes(32);

  return new AuditLogger(storage, encryptionKey, 1);
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

let defaultLogger: AuditLogger | null = null;

/**
 * Get the default audit logger.
 */
export function getDefaultAuditLogger(): AuditLogger {
  if (!defaultLogger) {
    const storageType = process.env.AUDIT_STORAGE_TYPE || 'memory';
    
    defaultLogger = createAuditLogger({
      type: storageType as any,
      filePath: process.env.AUDIT_FILE_PATH || './audit-logs',
    });
  }
  return defaultLogger;
}

/**
 * Set the default audit logger.
 */
export function setDefaultAuditLogger(logger: AuditLogger): void {
  defaultLogger = logger;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export { AuditLogger, AuditStorage, hashContent };
