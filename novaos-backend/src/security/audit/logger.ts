// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY AUDIT LOGGER — Comprehensive Security Event Logging
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import { getStore, type KeyValueStore } from '../../storage/index.js';
import { getLogger } from '../../logging/index.js';
import type { UserId, RequestId, Timestamp } from '../../types/branded.js';
import type { AuthEvent } from '../auth/types.js';
import type { AuthorizationEvent } from '../authorization/types.js';
import type { RateLimitEvent } from '../rate-limiting/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'security-audit' });

// ─────────────────────────────────────────────────────────────────────────────────
// AUDIT EVENT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Security event severity levels.
 */
export type AuditSeverity = 'info' | 'warning' | 'critical';

/**
 * Security event categories.
 */
export type AuditCategory = 
  | 'authentication'
  | 'authorization'
  | 'rate_limiting'
  | 'data_access'
  | 'data_modification'
  | 'encryption'
  | 'admin_action'
  | 'security_violation';

/**
 * Base audit event structure.
 */
export interface AuditEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly category: AuditCategory;
  readonly severity: AuditSeverity;
  readonly action: string;
  readonly outcome: 'success' | 'failure' | 'blocked';
  readonly userId?: string;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly details?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Create audit event options.
 */
export interface CreateAuditEventOptions {
  readonly category: AuditCategory;
  readonly severity?: AuditSeverity;
  readonly action: string;
  readonly outcome: 'success' | 'failure' | 'blocked';
  readonly userId?: string;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly details?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUDIT LOG STORE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Security audit log store.
 */
export class SecurityAuditStore {
  private readonly store: KeyValueStore;
  private readonly keyPrefix: string;
  private readonly retentionDays: number;

  constructor(
    store?: KeyValueStore,
    keyPrefix: string = 'audit:security:',
    retentionDays: number = 90
  ) {
    this.store = store ?? getStore();
    this.keyPrefix = keyPrefix;
    this.retentionDays = retentionDays;
  }

  /**
   * Log an audit event.
   */
  async log(options: CreateAuditEventOptions): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      severity: options.severity ?? this.inferSeverity(options),
      ...options,
    };

    // Store by timestamp for chronological retrieval
    const timestampKey = `${this.keyPrefix}ts:${event.timestamp}:${event.id}`;
    await this.store.set(
      timestampKey,
      JSON.stringify(event),
      this.retentionDays * 24 * 60 * 60
    );

    // Index by user if present
    if (event.userId) {
      const userKey = `${this.keyPrefix}user:${event.userId}:${event.timestamp}:${event.id}`;
      await this.store.set(
        userKey,
        JSON.stringify(event),
        this.retentionDays * 24 * 60 * 60
      );
    }

    // Index by category
    const categoryKey = `${this.keyPrefix}cat:${event.category}:${event.timestamp}:${event.id}`;
    await this.store.set(
      categoryKey,
      JSON.stringify(event),
      this.retentionDays * 24 * 60 * 60
    );

    // Log critical events to application logger
    if (event.severity === 'critical') {
      logger.warn('Critical security event', {
        auditId: event.id,
        category: event.category,
        action: event.action,
        outcome: event.outcome,
        userId: event.userId,
        ip: event.ip,
      });
    }

    return event;
  }

  /**
   * Infer severity from event details.
   */
  private inferSeverity(options: CreateAuditEventOptions): AuditSeverity {
    // Critical: security violations, admin actions, blocked attacks
    if (options.category === 'security_violation') return 'critical';
    if (options.category === 'admin_action') return 'warning';
    if (options.outcome === 'blocked') return 'warning';
    
    // Warning: failures that might indicate attacks
    if (options.outcome === 'failure') {
      if (options.category === 'authentication') return 'warning';
      if (options.category === 'authorization') return 'warning';
    }

    return 'info';
  }

  /**
   * Get events for a user.
   */
  async getByUser(
    userId: string,
    options: { limit?: number; after?: Date; before?: Date } = {}
  ): Promise<AuditEvent[]> {
    const { limit = 100, after, before } = options;
    const pattern = `${this.keyPrefix}user:${userId}:*`;
    
    try {
      const keys = await this.store.keys(pattern);
      const events: AuditEvent[] = [];

      for (const key of keys.slice(0, limit * 2)) {
        const data = await this.store.get(key);
        if (data) {
          const event = JSON.parse(data) as AuditEvent;
          const eventDate = new Date(event.timestamp);
          
          if (after && eventDate < after) continue;
          if (before && eventDate > before) continue;
          
          events.push(event);
          if (events.length >= limit) break;
        }
      }

      return events.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      logger.error('Failed to get audit events by user', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Get events by category.
   */
  async getByCategory(
    category: AuditCategory,
    options: { limit?: number; after?: Date; before?: Date } = {}
  ): Promise<AuditEvent[]> {
    const { limit = 100, after, before } = options;
    const pattern = `${this.keyPrefix}cat:${category}:*`;
    
    try {
      const keys = await this.store.keys(pattern);
      const events: AuditEvent[] = [];

      for (const key of keys.slice(0, limit * 2)) {
        const data = await this.store.get(key);
        if (data) {
          const event = JSON.parse(data) as AuditEvent;
          const eventDate = new Date(event.timestamp);
          
          if (after && eventDate < after) continue;
          if (before && eventDate > before) continue;
          
          events.push(event);
          if (events.length >= limit) break;
        }
      }

      return events.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      logger.error('Failed to get audit events by category', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Get recent events.
   */
  async getRecent(limit: number = 100): Promise<AuditEvent[]> {
    const pattern = `${this.keyPrefix}ts:*`;
    
    try {
      const keys = await this.store.keys(pattern);
      // Sort keys descending (most recent first)
      const sortedKeys = keys.sort().reverse().slice(0, limit);
      
      const events: AuditEvent[] = [];
      for (const key of sortedKeys) {
        const data = await this.store.get(key);
        if (data) {
          events.push(JSON.parse(data) as AuditEvent);
        }
      }

      return events;
    } catch (error) {
      logger.error('Failed to get recent audit events', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Count events by category in a time range.
   */
  async countByCategory(
    category: AuditCategory,
    after: Date,
    before: Date = new Date()
  ): Promise<number> {
    const events = await this.getByCategory(category, { after, before, limit: 10000 });
    return events.length;
  }

  /**
   * Get failed authentication attempts for an IP.
   */
  async getFailedAuthAttempts(
    ip: string,
    windowMinutes: number = 15
  ): Promise<number> {
    const after = new Date(Date.now() - windowMinutes * 60 * 1000);
    const events = await this.getByCategory('authentication', { after, limit: 1000 });
    
    return events.filter(e => 
      e.ip === ip && 
      e.outcome === 'failure'
    ).length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY AUDIT LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Security audit logger with convenience methods.
 */
export class SecurityAuditLogger {
  private readonly store: SecurityAuditStore;

  constructor(store?: SecurityAuditStore) {
    this.store = store ?? new SecurityAuditStore();
  }

  /**
   * Get the underlying store.
   */
  getStore(): SecurityAuditStore {
    return this.store;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Log successful login.
   */
  async logLoginSuccess(
    userId: string,
    ip: string,
    userAgent?: string,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'authentication',
      action: 'login',
      outcome: 'success',
      userId,
      ip,
      userAgent,
      requestId,
    });
  }

  /**
   * Log failed login attempt.
   */
  async logLoginFailure(
    email: string,
    ip: string,
    reason: string,
    userAgent?: string,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'authentication',
      severity: 'warning',
      action: 'login',
      outcome: 'failure',
      ip,
      userAgent,
      requestId,
      details: { email: this.hashEmail(email), reason },
    });
  }

  /**
   * Log logout.
   */
  async logLogout(
    userId: string,
    ip: string,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'authentication',
      action: 'logout',
      outcome: 'success',
      userId,
      ip,
      requestId,
    });
  }

  /**
   * Log token issued.
   */
  async logTokenIssued(
    userId: string,
    tokenType: string,
    ip: string,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'authentication',
      action: 'token_issued',
      outcome: 'success',
      userId,
      ip,
      requestId,
      details: { tokenType },
    });
  }

  /**
   * Log token revoked.
   */
  async logTokenRevoked(
    userId: string,
    reason: string,
    revokedBy?: string,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'authentication',
      action: 'token_revoked',
      outcome: 'success',
      userId,
      requestId,
      details: { reason, revokedBy },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTHORIZATION EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Log authorization denied.
   */
  async logAuthorizationDenied(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    reason: string,
    ip?: string,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'authorization',
      severity: 'warning',
      action: `access_denied:${action}`,
      outcome: 'blocked',
      userId,
      resourceType,
      resourceId,
      ip,
      requestId,
      details: { reason },
    });
  }

  /**
   * Log permission check.
   */
  async logPermissionCheck(
    userId: string,
    permission: string,
    granted: boolean,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'authorization',
      action: 'permission_check',
      outcome: granted ? 'success' : 'failure',
      userId,
      requestId,
      details: { permission },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RATE LIMITING EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Log rate limit exceeded.
   */
  async logRateLimitExceeded(
    userId: string | undefined,
    ip: string,
    path: string,
    limit: number,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'rate_limiting',
      severity: 'warning',
      action: 'rate_limit_exceeded',
      outcome: 'blocked',
      userId,
      ip,
      requestId,
      details: { path, limit },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA ACCESS EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Log sensitive data access.
   */
  async logDataAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: 'read' | 'export',
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'data_access',
      action: `data_${action}`,
      outcome: 'success',
      userId,
      resourceType,
      resourceId,
      requestId,
    });
  }

  /**
   * Log data modification.
   */
  async logDataModification(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: 'create' | 'update' | 'delete',
    requestId?: string,
    changes?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'data_modification',
      action: `data_${action}`,
      outcome: 'success',
      userId,
      resourceType,
      resourceId,
      requestId,
      details: changes ? { changes } : undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Log admin action.
   */
  async logAdminAction(
    adminUserId: string,
    action: string,
    targetUserId?: string,
    details?: Record<string, unknown>,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'admin_action',
      severity: 'warning',
      action: `admin:${action}`,
      outcome: 'success',
      userId: adminUserId,
      requestId,
      details: { targetUserId, ...details },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SECURITY VIOLATION EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Log security violation.
   */
  async logSecurityViolation(
    type: string,
    ip: string,
    details: Record<string, unknown>,
    userId?: string,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'security_violation',
      severity: 'critical',
      action: `violation:${type}`,
      outcome: 'blocked',
      userId,
      ip,
      requestId,
      details,
    });
  }

  /**
   * Log potential attack.
   */
  async logPotentialAttack(
    type: string,
    ip: string,
    evidence: Record<string, unknown>,
    requestId?: string
  ): Promise<AuditEvent> {
    return this.store.log({
      category: 'security_violation',
      severity: 'critical',
      action: `attack:${type}`,
      outcome: 'blocked',
      ip,
      requestId,
      details: evidence,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENT ADAPTERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle auth event from auth middleware.
   */
  async handleAuthEvent(event: AuthEvent): Promise<void> {
    switch (event.type) {
      case 'login_success':
        await this.logLoginSuccess(
          event.userId as string,
          event.ip ?? 'unknown',
          event.userAgent,
          event.requestId as string
        );
        break;
      case 'login_failure':
        await this.logLoginFailure(
          event.details?.email as string ?? 'unknown',
          event.ip ?? 'unknown',
          event.details?.reason as string ?? 'unknown',
          event.userAgent,
          event.requestId as string
        );
        break;
      case 'logout':
        await this.logLogout(
          event.userId as string,
          event.ip ?? 'unknown',
          event.requestId as string
        );
        break;
      case 'token_issued':
        await this.logTokenIssued(
          event.userId as string,
          event.details?.tokenType as string ?? 'access',
          event.ip ?? 'unknown',
          event.requestId as string
        );
        break;
      case 'token_revoked':
        await this.logTokenRevoked(
          event.userId as string,
          event.details?.reason as string ?? 'unknown',
          event.details?.revokedBy as string,
          event.requestId as string
        );
        break;
    }
  }

  /**
   * Handle authorization event.
   */
  async handleAuthorizationEvent(event: AuthorizationEvent): Promise<void> {
    if (event.type === 'authorization_denied' && event.reason) {
      await this.logAuthorizationDenied(
        event.userId ?? 'anonymous',
        event.resourceType ?? 'unknown',
        event.resourceId ?? 'unknown',
        event.action ?? 'access',
        event.reason.code,
        undefined,
        event.requestId
      );
    }
  }

  /**
   * Handle rate limit event.
   */
  async handleRateLimitEvent(event: RateLimitEvent): Promise<void> {
    if (event.type === 'rate_limit_exceeded') {
      await this.logRateLimitExceeded(
        event.userId,
        event.ip,
        event.path,
        event.limit,
        event.requestId
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Hash email for logging (privacy).
   */
  private hashEmail(email: string): string {
    const parts = email.split('@');
    const local = parts[0];
    const domain = parts[1];
    if (!local || !domain) return '***';
    const maskedLocal = local.length > 2 
      ? `${local[0]}***${local[local.length - 1]}`
      : '***';
    return `${maskedLocal}@${domain}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

let securityAuditLoggerInstance: SecurityAuditLogger | null = null;

/**
 * Get the security audit logger singleton.
 */
export function getSecurityAuditLogger(): SecurityAuditLogger {
  if (!securityAuditLoggerInstance) {
    securityAuditLoggerInstance = new SecurityAuditLogger();
  }
  return securityAuditLoggerInstance;
}

/**
 * Initialize security audit logger with custom store.
 */
export function initSecurityAuditLogger(store: SecurityAuditStore): SecurityAuditLogger {
  securityAuditLoggerInstance = new SecurityAuditLogger(store);
  return securityAuditLoggerInstance;
}

/**
 * Reset security audit logger (for testing).
 * @internal
 */
export function resetSecurityAuditLogger(): void {
  securityAuditLoggerInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// WIRE UP EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Connect security audit logger to event emitters.
 */
export function wireSecurityAuditLogger(): void {
  const auditLogger = getSecurityAuditLogger();

  // These imports would create circular dependencies, so we use dynamic wiring
  // The actual wiring should be done in the application bootstrap
  logger.info('Security audit logger ready for event wiring');
}
