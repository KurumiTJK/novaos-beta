// ═══════════════════════════════════════════════════════════════════════════════
// DATA SUBJECT TYPES — GDPR Data Subject Rights
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module defines types for GDPR data subject rights:
//   - Right to Access (Article 15): Data export
//   - Right to Erasure (Article 17): Data deletion
//   - Right to Portability (Article 20): Machine-readable export
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  UserId,
  GoalId,
  QuestId,
  StepId,
  SparkId,
  ReminderId,
  Timestamp,
} from '../../../types/branded.js';
import type { Brand } from '../../../types/branded.js';
import type { AsyncAppResult } from '../../../types/result.js';
import type {
  Goal,
  Quest,
  Step,
  Spark,
  ReminderSchedule,
} from '../../../services/spark-engine/types.js';
import type { UserConsent, ConsentRecord } from '../consent/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// BRANDED TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Data export request identifier.
 */
export type ExportRequestId = Brand<string, 'ExportRequestId'>;

/**
 * Data deletion request identifier.
 */
export type DeletionRequestId = Brand<string, 'DeletionRequestId'>;

/**
 * Archive identifier.
 */
export type ArchiveId = Brand<string, 'ArchiveId'>;

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Status of a data subject request.
 */
export type DataSubjectRequestStatus =
  | 'pending'       // Request received, not yet processed
  | 'processing'    // Currently being processed
  | 'completed'     // Successfully completed
  | 'failed'        // Processing failed
  | 'expired';      // Request expired (download link)

// ═══════════════════════════════════════════════════════════════════════════════
// DATA EXPORT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Categories of data that can be exported.
 */
export type ExportCategory =
  | 'goals'
  | 'quests'
  | 'steps'
  | 'sparks'
  | 'reminders'
  | 'consent'
  | 'auditLog'
  | 'profile'
  | 'preferences';

/**
 * All export categories.
 */
export const ALL_EXPORT_CATEGORIES: readonly ExportCategory[] = [
  'goals',
  'quests',
  'steps',
  'sparks',
  'reminders',
  'consent',
  'auditLog',
  'profile',
  'preferences',
] as const;

/**
 * Export format options.
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Request to export user data.
 */
export interface DataExportRequest {
  /** Unique request identifier */
  readonly id: ExportRequestId;

  /** User requesting export */
  readonly userId: UserId;

  /** Categories to export (empty = all) */
  readonly categories: readonly ExportCategory[];

  /** Export format */
  readonly format: ExportFormat;

  /** Request status */
  readonly status: DataSubjectRequestStatus;

  /** When request was created */
  readonly requestedAt: Timestamp;

  /** When processing started */
  readonly processingStartedAt?: Timestamp;

  /** When processing completed */
  readonly completedAt?: Timestamp;

  /** Download URL (if completed) */
  readonly downloadUrl?: string;

  /** URL expiration time */
  readonly downloadExpiresAt?: Timestamp;

  /** Error message (if failed) */
  readonly errorMessage?: string;

  /** IP address of requester */
  readonly ipAddress?: string;
}

/**
 * Exported data for a single category.
 */
export interface ExportedCategory<T> {
  /** Category name */
  readonly category: ExportCategory;

  /** Number of records */
  readonly count: number;

  /** The data */
  readonly data: readonly T[];

  /** When exported */
  readonly exportedAt: Timestamp;
}

/**
 * Complete data export package.
 */
export interface DataExport {
  /** Export request ID */
  readonly requestId: ExportRequestId;

  /** User whose data was exported */
  readonly userId: UserId;

  /** When export was generated */
  readonly generatedAt: Timestamp;

  /** Export format */
  readonly format: ExportFormat;

  /** NovaOS version */
  readonly version: string;

  /** Exported categories */
  readonly categories: {
    readonly goals?: ExportedCategory<Goal>;
    readonly quests?: ExportedCategory<Quest>;
    readonly steps?: ExportedCategory<Step>;
    readonly sparks?: ExportedCategory<Spark>;
    readonly reminders?: ExportedCategory<ReminderSchedule>;
    readonly consent?: ExportedCategory<ConsentRecord>;
    readonly auditLog?: ExportedCategory<AuditLogEntry>;
    readonly profile?: ExportedCategory<UserProfile>;
    readonly preferences?: ExportedCategory<UserPreferences>;
  };

  /** Summary statistics */
  readonly summary: ExportSummary;
}

/**
 * Export summary statistics.
 */
export interface ExportSummary {
  /** Total records exported */
  readonly totalRecords: number;

  /** Records per category */
  readonly recordsPerCategory: Readonly<Record<ExportCategory, number>>;

  /** Date range of data */
  readonly dataRange: {
    readonly earliest: Timestamp;
    readonly latest: Timestamp;
  };

  /** Export file size in bytes */
  readonly fileSizeBytes: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA DELETION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request to delete user data.
 */
export interface DataDeletionRequest {
  /** Unique request identifier */
  readonly id: DeletionRequestId;

  /** User requesting deletion */
  readonly userId: UserId;

  /** Whether to archive before deletion */
  readonly archiveFirst: boolean;

  /** Request status */
  readonly status: DataSubjectRequestStatus;

  /** When request was created */
  readonly requestedAt: Timestamp;

  /** Verification token (email confirmation) */
  readonly verificationToken?: string;

  /** Whether deletion was verified */
  readonly verified: boolean;

  /** When processing started */
  readonly processingStartedAt?: Timestamp;

  /** When processing completed */
  readonly completedAt?: Timestamp;

  /** Archive ID (if archived) */
  readonly archiveId?: ArchiveId;

  /** Deletion summary (if completed) */
  readonly summary?: DeletionSummary;

  /** Error message (if failed) */
  readonly errorMessage?: string;

  /** IP address of requester */
  readonly ipAddress?: string;

  /** Reason for deletion (optional) */
  readonly reason?: string;
}

/**
 * Summary of what was deleted.
 */
export interface DeletionSummary {
  /** Total records deleted */
  readonly totalDeleted: number;

  /** Records deleted per category */
  readonly deletedPerCategory: Readonly<Record<string, number>>;

  /** Whether data was archived first */
  readonly archived: boolean;

  /** Archive ID (if archived) */
  readonly archiveId?: ArchiveId;

  /** Any items that could not be deleted */
  readonly failures: readonly DeletionFailure[];

  /** Time taken in milliseconds */
  readonly durationMs: number;
}

/**
 * A deletion that failed.
 */
export interface DeletionFailure {
  /** Category that failed */
  readonly category: string;

  /** Entity ID that failed */
  readonly entityId: string;

  /** Error message */
  readonly error: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARCHIVE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Archived user data (before deletion).
 */
export interface UserDataArchive {
  /** Archive identifier */
  readonly id: ArchiveId;

  /** User whose data was archived */
  readonly userId: UserId;

  /** When archive was created */
  readonly createdAt: Timestamp;

  /** Deletion request that triggered archive */
  readonly deletionRequestId: DeletionRequestId;

  /** The archived data export */
  readonly data: DataExport;

  /** Retention period in days */
  readonly retentionDays: number;

  /** When archive expires */
  readonly expiresAt: Timestamp;

  /** Archive storage location */
  readonly storageLocation: string;

  /** Checksum for integrity */
  readonly checksum: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER TYPES (referenced in export)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * User profile data for export.
 */
export interface UserProfile {
  readonly userId: UserId;
  readonly email?: string;
  readonly displayName?: string;
  readonly timezone?: string;
  readonly locale?: string;
  readonly createdAt: Timestamp;
  readonly lastActiveAt?: Timestamp;
}

/**
 * User preferences for export.
 */
export interface UserPreferences {
  readonly userId: UserId;
  readonly theme?: string;
  readonly notifications?: {
    readonly email: boolean;
    readonly push: boolean;
    readonly sms: boolean;
  };
  readonly learningPreferences?: {
    readonly dailyTimeCommitment?: number;
    readonly preferredLearningStyle?: string;
    readonly activeDays?: readonly string[];
  };
}

/**
 * Audit log entry for export.
 */
export interface AuditLogEntry {
  readonly id: string;
  readonly userId: UserId;
  readonly action: string;
  readonly timestamp: Timestamp;
  readonly details?: Record<string, unknown>;
  readonly ipAddress?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Data export service interface.
 */
export interface IDataExportService {
  /**
   * Create an export request.
   */
  createExportRequest(
    userId: UserId,
    options?: {
      categories?: readonly ExportCategory[];
      format?: ExportFormat;
      ipAddress?: string;
    }
  ): AsyncAppResult<DataExportRequest>;

  /**
   * Get export request status.
   */
  getExportRequest(requestId: ExportRequestId): AsyncAppResult<DataExportRequest | null>;

  /**
   * Process an export request (generate the export).
   */
  processExportRequest(requestId: ExportRequestId): AsyncAppResult<DataExport>;

  /**
   * Get all export requests for a user.
   */
  getUserExportRequests(userId: UserId): AsyncAppResult<readonly DataExportRequest[]>;

  /**
   * Export user data immediately (synchronous).
   */
  exportUserData(
    userId: UserId,
    categories?: readonly ExportCategory[]
  ): AsyncAppResult<DataExport>;
}

/**
 * Data deletion service interface.
 */
export interface IDataDeletionService {
  /**
   * Create a deletion request.
   */
  createDeletionRequest(
    userId: UserId,
    options?: {
      archiveFirst?: boolean;
      reason?: string;
      ipAddress?: string;
    }
  ): AsyncAppResult<DataDeletionRequest>;

  /**
   * Get deletion request status.
   */
  getDeletionRequest(requestId: DeletionRequestId): AsyncAppResult<DataDeletionRequest | null>;

  /**
   * Verify deletion request (email confirmation).
   */
  verifyDeletionRequest(
    requestId: DeletionRequestId,
    token: string
  ): AsyncAppResult<DataDeletionRequest>;

  /**
   * Process a verified deletion request.
   */
  processDeletionRequest(requestId: DeletionRequestId): AsyncAppResult<DeletionSummary>;

  /**
   * Delete user data immediately (after verification).
   */
  deleteUserData(
    userId: UserId,
    options?: { archiveFirst?: boolean }
  ): AsyncAppResult<DeletionSummary>;

  /**
   * Get archive for a user (if exists).
   */
  getArchive(archiveId: ArchiveId): AsyncAppResult<UserDataArchive | null>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Data subject request error codes.
 */
export const DataSubjectErrorCode = {
  /** Request not found */
  REQUEST_NOT_FOUND: 'DATA_SUBJECT_REQUEST_NOT_FOUND',

  /** Request already processing */
  ALREADY_PROCESSING: 'DATA_SUBJECT_ALREADY_PROCESSING',

  /** Request already completed */
  ALREADY_COMPLETED: 'DATA_SUBJECT_ALREADY_COMPLETED',

  /** Export expired */
  EXPORT_EXPIRED: 'DATA_SUBJECT_EXPORT_EXPIRED',

  /** Deletion not verified */
  NOT_VERIFIED: 'DATA_SUBJECT_NOT_VERIFIED',

  /** Invalid verification token */
  INVALID_TOKEN: 'DATA_SUBJECT_INVALID_TOKEN',

  /** Archive not found */
  ARCHIVE_NOT_FOUND: 'DATA_SUBJECT_ARCHIVE_NOT_FOUND',

  /** Processing failed */
  PROCESSING_FAILED: 'DATA_SUBJECT_PROCESSING_FAILED',

  /** Rate limited (too many requests) */
  RATE_LIMITED: 'DATA_SUBJECT_RATE_LIMITED',

  /** Backend error */
  BACKEND_ERROR: 'DATA_SUBJECT_BACKEND_ERROR',
} as const;

export type DataSubjectErrorCode = (typeof DataSubjectErrorCode)[keyof typeof DataSubjectErrorCode];

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new ExportRequestId.
 */
export function createExportRequestId(value?: string): ExportRequestId {
  return (value ?? `export-${uuidv4()}`) as ExportRequestId;
}

/**
 * Create a new DeletionRequestId.
 */
export function createDeletionRequestId(value?: string): DeletionRequestId {
  return (value ?? `delete-${uuidv4()}`) as DeletionRequestId;
}

/**
 * Create a new ArchiveId.
 */
export function createArchiveId(value?: string): ArchiveId {
  return (value ?? `archive-${uuidv4()}`) as ArchiveId;
}

/**
 * Generate a verification token.
 */
export function createVerificationToken(): string {
  return uuidv4();
}
