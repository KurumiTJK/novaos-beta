// ═══════════════════════════════════════════════════════════════════════════════
// RETENTION TYPES — Data Retention Policy Types
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module defines types for GDPR-compliant data retention:
//   - RetentionPolicy: Rules for how long to keep data
//   - RetentionJob: Scheduled cleanup jobs
//   - ArchivePolicy: What to archive before deletion
//
// GDPR Article 5(1)(e): Storage Limitation Principle
// Data should not be kept longer than necessary.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { UserId, Timestamp } from '../../../types/branded.js';
import type { Brand } from '../../../types/branded.js';
import type { AsyncAppResult } from '../../../types/result.js';

// ═══════════════════════════════════════════════════════════════════════════════
// BRANDED TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retention job identifier.
 */
export type RetentionJobId = Brand<string, 'RetentionJobId'>;

// ═══════════════════════════════════════════════════════════════════════════════
// RETENTION CATEGORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Categories of data with retention policies.
 */
export type RetentionCategory =
  | 'completedGoals'    // Goals marked as completed
  | 'abandonedGoals'    // Goals marked as abandoned
  | 'expiredReminders'  // Reminders past their window
  | 'consentHistory'    // Consent change records
  | 'auditLogs'         // Audit trail entries
  | 'exportRequests'    // Data export requests
  | 'deletionRequests'  // Data deletion requests
  | 'archives'          // Archived user data
  | 'sessions'          // User sessions
  | 'refinementState';  // SwordGate refinement state

/**
 * All retention categories.
 */
export const ALL_RETENTION_CATEGORIES: readonly RetentionCategory[] = [
  'completedGoals',
  'abandonedGoals',
  'expiredReminders',
  'consentHistory',
  'auditLogs',
  'exportRequests',
  'deletionRequests',
  'archives',
  'sessions',
  'refinementState',
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// RETENTION POLICY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Action to take when retention period expires.
 */
export type RetentionAction =
  | 'delete'            // Delete permanently
  | 'archive'           // Move to cold storage
  | 'anonymize'         // Remove PII, keep aggregates
  | 'flag';             // Flag for manual review

/**
 * Retention policy for a category of data.
 */
export interface RetentionPolicy {
  /** Category this policy applies to */
  readonly category: RetentionCategory;

  /** Retention period in days (0 = indefinite) */
  readonly retentionDays: number;

  /** Action when retention expires */
  readonly action: RetentionAction;

  /** Whether to archive before deletion */
  readonly archiveBeforeDelete: boolean;

  /** Archive retention in days (if archived) */
  readonly archiveRetentionDays?: number;

  /** Whether policy is enabled */
  readonly enabled: boolean;

  /** Description of the policy */
  readonly description: string;

  /** Legal basis for retention */
  readonly legalBasis: string;
}

/**
 * Default retention policies.
 */
export const DEFAULT_RETENTION_POLICIES: readonly RetentionPolicy[] = [
  {
    category: 'completedGoals',
    retentionDays: 365, // 1 year
    action: 'archive',
    archiveBeforeDelete: true,
    archiveRetentionDays: 730, // 2 years in archive
    enabled: true,
    description: 'Completed goals are archived after 1 year, deleted after 3 years total',
    legalBasis: 'Legitimate interest in providing historical data access',
  },
  {
    category: 'abandonedGoals',
    retentionDays: 90, // 3 months
    action: 'delete',
    archiveBeforeDelete: false,
    enabled: true,
    description: 'Abandoned goals are deleted after 90 days',
    legalBasis: 'Data minimization - no longer needed for service',
  },
  {
    category: 'expiredReminders',
    retentionDays: 30, // 1 month
    action: 'delete',
    archiveBeforeDelete: false,
    enabled: true,
    description: 'Expired reminders are deleted after 30 days',
    legalBasis: 'Data minimization - no longer needed for service',
  },
  {
    category: 'consentHistory',
    retentionDays: 2555, // 7 years
    action: 'archive',
    archiveBeforeDelete: true,
    archiveRetentionDays: 365,
    enabled: true,
    description: 'Consent records kept for 7 years for compliance proof',
    legalBasis: 'Legal obligation - GDPR accountability requirement',
  },
  {
    category: 'auditLogs',
    retentionDays: 2555, // 7 years
    action: 'archive',
    archiveBeforeDelete: true,
    archiveRetentionDays: 365,
    enabled: true,
    description: 'Audit logs kept for 7 years for security and compliance',
    legalBasis: 'Legal obligation - security and fraud prevention',
  },
  {
    category: 'exportRequests',
    retentionDays: 30, // 1 month
    action: 'delete',
    archiveBeforeDelete: false,
    enabled: true,
    description: 'Export download links expire after 30 days',
    legalBasis: 'Data minimization - request fulfilled',
  },
  {
    category: 'deletionRequests',
    retentionDays: 365, // 1 year
    action: 'archive',
    archiveBeforeDelete: true,
    archiveRetentionDays: 2555,
    enabled: true,
    description: 'Deletion records kept for compliance proof',
    legalBasis: 'Legal obligation - GDPR accountability',
  },
  {
    category: 'archives',
    retentionDays: 730, // 2 years
    action: 'delete',
    archiveBeforeDelete: false,
    enabled: true,
    description: 'Archives are permanently deleted after 2 years',
    legalBasis: 'Legal obligation - right to erasure fulfilled',
  },
  {
    category: 'sessions',
    retentionDays: 30, // 1 month
    action: 'delete',
    archiveBeforeDelete: false,
    enabled: true,
    description: 'Inactive sessions deleted after 30 days',
    legalBasis: 'Data minimization - security hygiene',
  },
  {
    category: 'refinementState',
    retentionDays: 1, // 1 day
    action: 'delete',
    archiveBeforeDelete: false,
    enabled: true,
    description: 'Refinement state expires after 24 hours',
    legalBasis: 'Data minimization - temporary processing data',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// RETENTION JOB
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Status of a retention job.
 */
export type RetentionJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * A scheduled retention enforcement job.
 */
export interface RetentionJob {
  /** Unique job identifier */
  readonly id: RetentionJobId;

  /** Categories to process */
  readonly categories: readonly RetentionCategory[];

  /** Job status */
  readonly status: RetentionJobStatus;

  /** When job was scheduled */
  readonly scheduledAt: Timestamp;

  /** When job started */
  readonly startedAt?: Timestamp;

  /** When job completed */
  readonly completedAt?: Timestamp;

  /** Results per category */
  readonly results?: RetentionJobResults;

  /** Error message (if failed) */
  readonly errorMessage?: string;

  /** Whether this was a dry run */
  readonly dryRun: boolean;
}

/**
 * Results of a retention job.
 */
export interface RetentionJobResults {
  /** Total records processed */
  readonly totalProcessed: number;

  /** Records deleted */
  readonly deleted: number;

  /** Records archived */
  readonly archived: number;

  /** Records anonymized */
  readonly anonymized: number;

  /** Records flagged for review */
  readonly flagged: number;

  /** Errors encountered */
  readonly errors: number;

  /** Results per category */
  readonly perCategory: Readonly<Record<RetentionCategory, CategoryJobResult>>;

  /** Duration in milliseconds */
  readonly durationMs: number;
}

/**
 * Results for a single category.
 */
export interface CategoryJobResult {
  /** Records found past retention */
  readonly found: number;

  /** Records processed */
  readonly processed: number;

  /** Records that failed */
  readonly failed: number;

  /** Action taken */
  readonly action: RetentionAction;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETENTION ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Entity marked for retention processing.
 */
export interface RetentionCandidate {
  /** Category of the entity */
  readonly category: RetentionCategory;

  /** Entity ID */
  readonly entityId: string;

  /** User ID (if applicable) */
  readonly userId?: UserId;

  /** When entity was created/completed */
  readonly timestamp: Timestamp;

  /** Days past retention */
  readonly daysPastRetention: number;

  /** Policy that applies */
  readonly policy: RetentionPolicy;
}

/**
 * Configuration for retention enforcer.
 */
export interface RetentionEnforcerConfig {
  /** Maximum entities to process per run */
  readonly batchSize: number;

  /** Delay between batches in ms */
  readonly batchDelayMs: number;

  /** Whether to run as dry run by default */
  readonly dryRunByDefault: boolean;

  /** Policies to use (overrides defaults) */
  readonly policies?: readonly RetentionPolicy[];

  /** Categories to skip */
  readonly skipCategories?: readonly RetentionCategory[];
}

/**
 * Default enforcer configuration.
 */
export const DEFAULT_ENFORCER_CONFIG: RetentionEnforcerConfig = {
  batchSize: 100,
  batchDelayMs: 100,
  dryRunByDefault: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retention enforcement service interface.
 */
export interface IRetentionEnforcer {
  /**
   * Get current retention policies.
   */
  getPolicies(): readonly RetentionPolicy[];

  /**
   * Get policy for a category.
   */
  getPolicy(category: RetentionCategory): RetentionPolicy | undefined;

  /**
   * Find entities past retention for a category.
   */
  findCandidates(
    category: RetentionCategory,
    options?: { limit?: number }
  ): AsyncAppResult<readonly RetentionCandidate[]>;

  /**
   * Process a single candidate.
   */
  processCandidate(
    candidate: RetentionCandidate,
    dryRun?: boolean
  ): AsyncAppResult<{ action: RetentionAction; success: boolean }>;

  /**
   * Run retention enforcement for all categories.
   */
  runEnforcement(options?: {
    categories?: readonly RetentionCategory[];
    dryRun?: boolean;
    batchSize?: number;
  }): AsyncAppResult<RetentionJobResults>;

  /**
   * Schedule a retention job.
   */
  scheduleJob(
    categories: readonly RetentionCategory[],
    options?: { dryRun?: boolean; runAt?: Date }
  ): AsyncAppResult<RetentionJob>;

  /**
   * Get job status.
   */
  getJob(jobId: RetentionJobId): AsyncAppResult<RetentionJob | null>;

  /**
   * Get recent jobs.
   */
  getRecentJobs(limit?: number): AsyncAppResult<readonly RetentionJob[]>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retention-specific error codes.
 */
export const RetentionErrorCode = {
  /** Job not found */
  JOB_NOT_FOUND: 'RETENTION_JOB_NOT_FOUND',

  /** Job already running */
  JOB_ALREADY_RUNNING: 'RETENTION_JOB_ALREADY_RUNNING',

  /** Invalid category */
  INVALID_CATEGORY: 'RETENTION_INVALID_CATEGORY',

  /** Policy not found */
  POLICY_NOT_FOUND: 'RETENTION_POLICY_NOT_FOUND',

  /** Archive failed */
  ARCHIVE_FAILED: 'RETENTION_ARCHIVE_FAILED',

  /** Delete failed */
  DELETE_FAILED: 'RETENTION_DELETE_FAILED',

  /** Backend error */
  BACKEND_ERROR: 'RETENTION_BACKEND_ERROR',
} as const;

export type RetentionErrorCode = (typeof RetentionErrorCode)[keyof typeof RetentionErrorCode];

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new RetentionJobId.
 */
export function createRetentionJobId(value?: string): RetentionJobId {
  return (value ?? `retention-${uuidv4()}`) as RetentionJobId;
}

/**
 * Get default policy for a category.
 */
export function getDefaultPolicy(category: RetentionCategory): RetentionPolicy {
  const policy = DEFAULT_RETENTION_POLICIES.find(p => p.category === category);
  if (!policy) {
    throw new Error(`No default policy for category: ${category}`);
  }
  return policy;
}

/**
 * Calculate expiration date based on policy.
 */
export function calculateExpirationDate(
  createdAt: Date,
  retentionDays: number
): Date {
  const expiration = new Date(createdAt);
  expiration.setDate(expiration.getDate() + retentionDays);
  return expiration;
}

/**
 * Check if a timestamp is past retention.
 */
export function isPastRetention(
  timestamp: Timestamp,
  retentionDays: number
): boolean {
  const created = new Date(timestamp);
  const expiration = calculateExpirationDate(created, retentionDays);
  return new Date() > expiration;
}

/**
 * Calculate days past retention.
 */
export function daysPastRetention(
  timestamp: Timestamp,
  retentionDays: number
): number {
  const created = new Date(timestamp);
  const expiration = calculateExpirationDate(created, retentionDays);
  const now = new Date();
  
  if (now <= expiration) {
    return 0;
  }
  
  const msDiff = now.getTime() - expiration.getTime();
  return Math.floor(msDiff / (1000 * 60 * 60 * 24));
}
