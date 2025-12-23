// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG TYPES — Immutable Compliance Audit Trail
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module defines types for GDPR-compliant audit logging:
//   - AuditEntry: Immutable record of compliance-relevant action
//   - AuditQuery: Querying the audit log
//   - AuditReport: Compliance reporting
//
// GDPR Article 30: Records of Processing Activities
// Must maintain records to demonstrate compliance.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { UserId, Timestamp, AuditId } from '../../../types/branded.js';
import type { AsyncAppResult } from '../../../types/result.js';
import type { ConsentPurpose } from '../consent/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Categories of auditable actions.
 */
export type AuditCategory =
  | 'consent'           // Consent grants/revocations
  | 'dataAccess'        // Data access/export
  | 'dataDeletion'      // Data deletion
  | 'dataModification'  // Data changes
  | 'authentication'    // Login/logout events
  | 'authorization'     // Permission checks
  | 'retention'         // Retention enforcement
  | 'security'          // Security-relevant events
  | 'system';           // System operations

/**
 * Specific audit actions.
 */
export type AuditAction =
  // Consent actions
  | 'consent.granted'
  | 'consent.revoked'
  | 'consent.updated'
  // Data access
  | 'data.exported'
  | 'data.viewed'
  | 'data.downloaded'
  // Data deletion
  | 'data.deletion_requested'
  | 'data.deletion_verified'
  | 'data.deleted'
  | 'data.archived'
  // Data modification
  | 'data.created'
  | 'data.updated'
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed_login'
  | 'auth.token_refreshed'
  | 'auth.password_changed'
  // Authorization
  | 'authz.access_granted'
  | 'authz.access_denied'
  // Retention
  | 'retention.job_started'
  | 'retention.job_completed'
  | 'retention.data_expired'
  | 'retention.data_archived'
  // Security
  | 'security.blocked'
  | 'security.rate_limited'
  | 'security.suspicious_activity'
  // System
  | 'system.startup'
  | 'system.shutdown'
  | 'system.config_changed'
  | 'system.error';

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT SEVERITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Severity level for audit entries.
 */
export type AuditSeverity =
  | 'info'      // Informational
  | 'warning'   // Potential issue
  | 'error'     // Error occurred
  | 'critical'; // Critical security/compliance event

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT ENTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Immutable audit log entry.
 *
 * Once written, these entries cannot be modified or deleted
 * (except through retention policy enforcement).
 */
export interface AuditEntry {
  /** Unique audit entry ID */
  readonly id: AuditId;

  /** When the action occurred */
  readonly timestamp: Timestamp;

  /** Category of the action */
  readonly category: AuditCategory;

  /** Specific action */
  readonly action: AuditAction;

  /** Severity level */
  readonly severity: AuditSeverity;

  /** User who performed the action (if applicable) */
  readonly userId?: UserId;

  /** Target user (if different from actor) */
  readonly targetUserId?: UserId;

  /** Entity type affected (e.g., 'goal', 'consent') */
  readonly entityType?: string;

  /** Entity ID affected */
  readonly entityId?: string;

  /** Description of what happened */
  readonly description: string;

  /** Additional structured details */
  readonly details?: AuditDetails;

  /** Request metadata */
  readonly request?: AuditRequestMetadata;

  /** Whether action was successful */
  readonly success: boolean;

  /** Error message (if failed) */
  readonly errorMessage?: string;

  /** Hash of previous entry (for tamper detection) */
  readonly previousHash?: string;

  /** Hash of this entry */
  readonly entryHash: string;
}

/**
 * Structured details for audit entries.
 */
export interface AuditDetails {
  /** For consent actions */
  readonly consent?: {
    readonly purpose?: ConsentPurpose;
    readonly granted?: boolean;
    readonly method?: string;
    readonly policyVersion?: string;
  };

  /** For data actions */
  readonly data?: {
    readonly categories?: readonly string[];
    readonly recordCount?: number;
    readonly format?: string;
  };

  /** For retention actions */
  readonly retention?: {
    readonly category?: string;
    readonly processed?: number;
    readonly deleted?: number;
    readonly archived?: number;
  };

  /** For security actions */
  readonly security?: {
    readonly reason?: string;
    readonly rule?: string;
    readonly blocked?: boolean;
  };

  /** For system actions */
  readonly system?: {
    readonly component?: string;
    readonly version?: string;
    readonly config?: Record<string, unknown>;
  };

  /** Arbitrary additional data */
  readonly extra?: Record<string, unknown>;
}

/**
 * Request metadata for audit entries.
 */
export interface AuditRequestMetadata {
  /** Request ID / correlation ID */
  readonly requestId?: string;

  /** IP address */
  readonly ipAddress?: string;

  /** User agent */
  readonly userAgent?: string;

  /** Session ID */
  readonly sessionId?: string;

  /** API endpoint */
  readonly endpoint?: string;

  /** HTTP method */
  readonly method?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT QUERY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Query options for searching audit logs.
 */
export interface AuditQuery {
  /** Filter by user ID */
  readonly userId?: UserId;

  /** Filter by target user ID */
  readonly targetUserId?: UserId;

  /** Filter by category */
  readonly category?: AuditCategory;

  /** Filter by action */
  readonly action?: AuditAction;

  /** Filter by severity */
  readonly severity?: AuditSeverity;

  /** Filter by entity type */
  readonly entityType?: string;

  /** Filter by entity ID */
  readonly entityId?: string;

  /** Start timestamp (inclusive) */
  readonly fromTimestamp?: Timestamp;

  /** End timestamp (inclusive) */
  readonly toTimestamp?: Timestamp;

  /** Only successful actions */
  readonly successOnly?: boolean;

  /** Only failed actions */
  readonly failedOnly?: boolean;

  /** Search in description */
  readonly searchText?: string;

  /** Pagination: max results */
  readonly limit?: number;

  /** Pagination: offset */
  readonly offset?: number;

  /** Sort order */
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Result of an audit query.
 */
export interface AuditQueryResult {
  /** Matching entries */
  readonly entries: readonly AuditEntry[];

  /** Total count (for pagination) */
  readonly totalCount: number;

  /** Whether there are more results */
  readonly hasMore: boolean;

  /** Query that was executed */
  readonly query: AuditQuery;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT REPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compliance report types.
 */
export type AuditReportType =
  | 'consent_summary'     // Summary of consent states
  | 'data_access'         // Data access report
  | 'retention_summary'   // Retention enforcement summary
  | 'security_events'     // Security incidents
  | 'user_activity';      // User activity report

/**
 * Request for a compliance report.
 */
export interface AuditReportRequest {
  /** Type of report */
  readonly type: AuditReportType;

  /** Report period start */
  readonly fromDate: Timestamp;

  /** Report period end */
  readonly toDate: Timestamp;

  /** Filter by user (optional) */
  readonly userId?: UserId;

  /** Include raw entries */
  readonly includeEntries?: boolean;

  /** Export format */
  readonly format?: 'json' | 'csv' | 'pdf';
}

/**
 * Generated compliance report.
 */
export interface AuditReport {
  /** Report ID */
  readonly id: string;

  /** Report type */
  readonly type: AuditReportType;

  /** When generated */
  readonly generatedAt: Timestamp;

  /** Report period */
  readonly period: {
    readonly from: Timestamp;
    readonly to: Timestamp;
  };

  /** Summary statistics */
  readonly summary: AuditReportSummary;

  /** Raw entries (if requested) */
  readonly entries?: readonly AuditEntry[];
}

/**
 * Report summary statistics.
 */
export interface AuditReportSummary {
  /** Total entries in period */
  readonly totalEntries: number;

  /** Entries by category */
  readonly byCategory: Readonly<Record<string, number>>;

  /** Entries by action */
  readonly byAction: Readonly<Record<string, number>>;

  /** Entries by severity */
  readonly bySeverity: Readonly<Record<string, number>>;

  /** Unique users involved */
  readonly uniqueUsers: number;

  /** Success rate */
  readonly successRate: number;

  /** Additional type-specific stats */
  readonly typeSpecific?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT STORE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Audit log store interface.
 *
 * The store is append-only - entries cannot be modified or deleted
 * except through retention policy enforcement.
 */
export interface IAuditStore {
  /**
   * Append an audit entry.
   */
  append(entry: Omit<AuditEntry, 'id' | 'entryHash' | 'previousHash'>): AsyncAppResult<AuditEntry>;

  /**
   * Get an entry by ID.
   */
  get(auditId: AuditId): AsyncAppResult<AuditEntry | null>;

  /**
   * Query audit entries.
   */
  query(query: AuditQuery): AsyncAppResult<AuditQueryResult>;

  /**
   * Get entries for a user.
   */
  getByUser(
    userId: UserId,
    options?: { limit?: number; fromTimestamp?: Timestamp }
  ): AsyncAppResult<readonly AuditEntry[]>;

  /**
   * Get recent entries.
   */
  getRecent(limit?: number): AsyncAppResult<readonly AuditEntry[]>;

  /**
   * Count entries matching query.
   */
  count(query: Omit<AuditQuery, 'limit' | 'offset'>): AsyncAppResult<number>;

  /**
   * Verify integrity of audit chain.
   */
  verifyIntegrity(options?: { fromId?: AuditId; limit?: number }): AsyncAppResult<IntegrityCheckResult>;

  /**
   * Delete entries for retention (only method that can delete).
   */
  deleteForRetention(beforeTimestamp: Timestamp): AsyncAppResult<number>;
}

/**
 * Result of integrity verification.
 */
export interface IntegrityCheckResult {
  /** Whether chain is intact */
  readonly valid: boolean;

  /** Number of entries checked */
  readonly entriesChecked: number;

  /** First broken entry (if any) */
  readonly brokenAtId?: AuditId;

  /** Error message (if invalid) */
  readonly error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGGER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * High-level audit logger for application use.
 */
export interface IAuditLogger {
  /**
   * Log a consent action.
   */
  logConsent(
    userId: UserId,
    action: 'consent.granted' | 'consent.revoked' | 'consent.updated',
    details: {
      purpose: ConsentPurpose;
      granted: boolean;
      method?: string;
      policyVersion?: string;
    },
    request?: AuditRequestMetadata
  ): AsyncAppResult<AuditEntry>;

  /**
   * Log a data access action.
   */
  logDataAccess(
    userId: UserId,
    action: 'data.exported' | 'data.viewed' | 'data.downloaded',
    details: {
      categories?: readonly string[];
      recordCount?: number;
    },
    request?: AuditRequestMetadata
  ): AsyncAppResult<AuditEntry>;

  /**
   * Log a data deletion action.
   */
  logDataDeletion(
    userId: UserId,
    action: 'data.deletion_requested' | 'data.deletion_verified' | 'data.deleted' | 'data.archived',
    details: {
      categories?: readonly string[];
      recordCount?: number;
    },
    request?: AuditRequestMetadata
  ): AsyncAppResult<AuditEntry>;

  /**
   * Log a security event.
   */
  logSecurityEvent(
    action: 'security.blocked' | 'security.rate_limited' | 'security.suspicious_activity',
    details: {
      userId?: UserId;
      reason: string;
      rule?: string;
    },
    request?: AuditRequestMetadata
  ): AsyncAppResult<AuditEntry>;

  /**
   * Log a generic audit entry.
   */
  log(
    category: AuditCategory,
    action: AuditAction,
    options: {
      userId?: UserId;
      targetUserId?: UserId;
      entityType?: string;
      entityId?: string;
      description: string;
      details?: AuditDetails;
      severity?: AuditSeverity;
      success?: boolean;
      errorMessage?: string;
      request?: AuditRequestMetadata;
    }
  ): AsyncAppResult<AuditEntry>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Audit-specific error codes.
 */
export const AuditErrorCode = {
  /** Entry not found */
  NOT_FOUND: 'AUDIT_NOT_FOUND',

  /** Cannot modify entry */
  IMMUTABLE: 'AUDIT_IMMUTABLE',

  /** Integrity check failed */
  INTEGRITY_FAILURE: 'AUDIT_INTEGRITY_FAILURE',

  /** Invalid query */
  INVALID_QUERY: 'AUDIT_INVALID_QUERY',

  /** Backend error */
  BACKEND_ERROR: 'AUDIT_BACKEND_ERROR',
} as const;

export type AuditErrorCode = (typeof AuditErrorCode)[keyof typeof AuditErrorCode];

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { createAuditId } from '../../../types/branded.js';

export { createAuditId };

/**
 * Compute hash for an audit entry.
 */
export function computeAuditEntryHash(
  entry: Omit<AuditEntry, 'entryHash'>,
  previousHash?: string
): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    category: entry.category,
    action: entry.action,
    severity: entry.severity,
    userId: entry.userId,
    targetUserId: entry.targetUserId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    description: entry.description,
    details: entry.details,
    success: entry.success,
    previousHash: previousHash ?? entry.previousHash,
  });

  return createHash('sha256').update(data).digest('hex');
}

/**
 * Verify an audit entry's hash.
 */
export function verifyAuditEntryHash(entry: AuditEntry): boolean {
  const computed = computeAuditEntryHash(entry, entry.previousHash);
  return computed === entry.entryHash;
}

/**
 * Default severity for an action.
 */
export function getDefaultSeverity(action: AuditAction): AuditSeverity {
  if (action.startsWith('security.')) return 'warning';
  if (action.includes('failed') || action.includes('denied')) return 'warning';
  if (action.includes('deleted')) return 'warning';
  if (action.includes('error')) return 'error';
  return 'info';
}

/**
 * Get category from action.
 */
export function getCategoryFromAction(action: AuditAction): AuditCategory {
  const prefix = action.split('.')[0];
  const categoryMap: Record<string, AuditCategory> = {
    consent: 'consent',
    data: 'dataAccess',
    auth: 'authentication',
    authz: 'authorization',
    retention: 'retention',
    security: 'security',
    system: 'system',
  };
  return categoryMap[prefix] ?? 'system';
}
