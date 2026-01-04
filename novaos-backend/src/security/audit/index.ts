// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT MODULE — Security Event Logging
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type AuditCategory =
  | 'auth'
  | 'authorization'
  | 'rate_limit'
  | 'abuse'
  | 'ssrf'
  | 'validation'
  | 'system';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditEvent {
  id: string;
  timestamp: number;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  details: Record<string, unknown>;
}

export interface CreateAuditEventOptions {
  category: AuditCategory;
  severity?: AuditSeverity;
  action: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUDIT STORE
// ─────────────────────────────────────────────────────────────────────────────────

export class AuditStore {
  private readonly userPrefix: string;
  private readonly globalKey: string;
  private readonly maxUserLogs: number;
  private readonly maxGlobalLogs: number;
  
  constructor(
    private readonly store: KeyValueStore,
    options?: {
      userPrefix?: string;
      globalKey?: string;
      maxUserLogs?: number;
      maxGlobalLogs?: number;
    }
  ) {
    this.userPrefix = options?.userPrefix ?? 'audit:user:';
    this.globalKey = options?.globalKey ?? 'audit:global';
    this.maxUserLogs = options?.maxUserLogs ?? 1000;
    this.maxGlobalLogs = options?.maxGlobalLogs ?? 10000;
  }
  
  private getUserKey(userId: string): string {
    return `${this.userPrefix}${userId}`;
  }
  
  /**
   * Log an audit event.
   */
  async log(options: CreateAuditEventOptions): Promise<string> {
    const id = crypto.randomUUID();
    
    const event: AuditEvent = {
      id,
      timestamp: Date.now(),
      category: options.category,
      severity: options.severity ?? 'info',
      action: options.action,
      userId: options.userId,
      ip: options.ip,
      userAgent: options.userAgent,
      requestId: options.requestId,
      details: options.details ?? {},
    };
    
    const json = JSON.stringify(event);
    
    // Store in user-specific list
    if (options.userId) {
      await this.store.lpush(this.getUserKey(options.userId), json);
      await this.store.ltrim(this.getUserKey(options.userId), 0, this.maxUserLogs - 1);
    }
    
    // Store in global list
    await this.store.lpush(this.globalKey, json);
    await this.store.ltrim(this.globalKey, 0, this.maxGlobalLogs - 1);
    
    return id;
  }
  
  /**
   * Get audit logs for a user.
   */
  async getUserLogs(userId: string, limit: number = 100): Promise<AuditEvent[]> {
    const logs = await this.store.lrange(this.getUserKey(userId), 0, limit - 1);
    return logs.map(log => JSON.parse(log));
  }
  
  /**
   * Get global audit logs.
   */
  async getGlobalLogs(limit: number = 100): Promise<AuditEvent[]> {
    const logs = await this.store.lrange(this.globalKey, 0, limit - 1);
    return logs.map(log => JSON.parse(log));
  }
  
  /**
   * Get logs by category.
   */
  async getLogsByCategory(
    category: AuditCategory,
    limit: number = 100
  ): Promise<AuditEvent[]> {
    const logs = await this.getGlobalLogs(limit * 5); // Fetch more to filter
    return logs.filter(log => log.category === category).slice(0, limit);
  }
  
  /**
   * Get logs by severity.
   */
  async getLogsBySeverity(
    severity: AuditSeverity,
    limit: number = 100
  ): Promise<AuditEvent[]> {
    const logs = await this.getGlobalLogs(limit * 5);
    return logs.filter(log => log.severity === severity).slice(0, limit);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let auditStore: AuditStore | null = null;

export function initAuditStore(store: KeyValueStore): AuditStore {
  auditStore = new AuditStore(store);
  return auditStore;
}

export function getAuditStore(): AuditStore {
  if (!auditStore) {
    throw new Error('AuditStore not initialized. Call initAuditStore() first.');
  }
  return auditStore;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Log an audit event.
 */
export async function logAudit(options: CreateAuditEventOptions): Promise<string> {
  return getAuditStore().log(options);
}

/**
 * Log an auth event.
 */
export async function logAuthEvent(
  action: string,
  userId?: string,
  details?: Record<string, unknown>
): Promise<string> {
  return logAudit({
    category: 'auth',
    action,
    userId,
    details,
  });
}

/**
 * Log a security warning.
 */
export async function logSecurityWarning(
  action: string,
  userId?: string,
  details?: Record<string, unknown>
): Promise<string> {
  return logAudit({
    category: 'abuse',
    severity: 'warning',
    action,
    userId,
    details,
  });
}

/**
 * Log a security error.
 */
export async function logSecurityError(
  action: string,
  userId?: string,
  details?: Record<string, unknown>
): Promise<string> {
  return logAudit({
    category: 'abuse',
    severity: 'error',
    action,
    userId,
    details,
  });
}
