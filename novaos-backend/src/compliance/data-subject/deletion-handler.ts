// ═══════════════════════════════════════════════════════════════════════════════
// DATA DELETION HANDLER — GDPR Data Deletion Service
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// GDPR Article 17 (Right to Erasure / Right to be Forgotten):
//   - Process verified deletion requests
//   - Archive data before deletion (optional)
//   - Cascade delete across all stores
//   - Track and audit deletions
//
// ═══════════════════════════════════════════════════════════════════════════════

import { ok, err, type AsyncAppResult } from '../../types/result.js';
import type { UserId, Timestamp } from '../../types/branded.js';
import { createTimestamp } from '../../types/branded.js';
import type {
  DataDeletionRequest,
  DeletionRequestId,
  DeletionSummary,
  DeletionFailure,
  UserDataArchive,
  ArchiveId,
  IDataDeletionService,
  DataExport,
} from './types.js';
import {
  DataSubjectErrorCode,
  createArchiveId,
} from './types.js';
import type { DeletionRequestStore } from './deletion-store.js';
import type { DataExportHandler } from './export-handler.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Data deleters for each category.
 * Each deleter returns the count of records deleted.
 */
export interface DataDeleters {
  goals?: (userId: UserId) => AsyncAppResult<number>;
  quests?: (userId: UserId) => AsyncAppResult<number>;
  steps?: (userId: UserId) => AsyncAppResult<number>;
  sparks?: (userId: UserId) => AsyncAppResult<number>;
  reminders?: (userId: UserId) => AsyncAppResult<number>;
  consent?: (userId: UserId) => AsyncAppResult<number>;
  auditLog?: (userId: UserId) => AsyncAppResult<number>;
  profile?: (userId: UserId) => AsyncAppResult<number>;
  preferences?: (userId: UserId) => AsyncAppResult<number>;
  sessions?: (userId: UserId) => AsyncAppResult<number>;
  exportRequests?: (userId: UserId) => AsyncAppResult<number>;
}

/**
 * Archive storage interface.
 */
export interface IArchiveStorage {
  /**
   * Store an archive.
   */
  store(archive: UserDataArchive): AsyncAppResult<void>;

  /**
   * Get an archive by ID.
   */
  get(archiveId: ArchiveId): AsyncAppResult<UserDataArchive | null>;

  /**
   * Delete an archive.
   */
  delete(archiveId: ArchiveId): AsyncAppResult<boolean>;

  /**
   * List archives for a user.
   */
  listByUser(userId: UserId): AsyncAppResult<readonly UserDataArchive[]>;
}

/**
 * Deletion handler configuration.
 */
export interface DataDeletionHandlerConfig {
  /** Days to retain archives before permanent deletion */
  archiveRetentionDays: number;

  /** Whether verification is required for deletions */
  requireVerification: boolean;

  /** Callback for sending verification emails */
  sendVerificationEmail?: (
    userId: UserId,
    requestId: DeletionRequestId,
    token: string
  ) => AsyncAppResult<void>;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: DataDeletionHandlerConfig = {
  archiveRetentionDays: 30,
  requireVerification: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function deletionError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): { code: string; message: string; context?: Record<string, unknown> } {
  return { code, message, context };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA DELETION HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Service for handling GDPR data deletion requests.
 */
export class DataDeletionHandler implements IDataDeletionService {
  private readonly requestStore: DeletionRequestStore;
  private readonly deleters: DataDeleters;
  private readonly exportHandler?: DataExportHandler;
  private readonly archiveStorage?: IArchiveStorage;
  private readonly config: DataDeletionHandlerConfig;

  constructor(
    requestStore: DeletionRequestStore,
    deleters: DataDeleters,
    options?: {
      exportHandler?: DataExportHandler;
      archiveStorage?: IArchiveStorage;
      config?: Partial<DataDeletionHandlerConfig>;
    }
  ) {
    this.requestStore = requestStore;
    this.deleters = deleters;
    this.exportHandler = options?.exportHandler;
    this.archiveStorage = options?.archiveStorage;
    this.config = { ...DEFAULT_CONFIG, ...options?.config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IDataDeletionService Implementation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a deletion request.
   */
  async createDeletionRequest(
    userId: UserId,
    options?: {
      archiveFirst?: boolean;
      reason?: string;
      ipAddress?: string;
    }
  ): AsyncAppResult<DataDeletionRequest> {
    // Check for existing pending requests
    const hasPendingResult = await this.requestStore.hasPendingDeletion(userId);
    if (hasPendingResult.ok && hasPendingResult.value) {
      return err(
        deletionError(
          DataSubjectErrorCode.ALREADY_PROCESSING,
          'A deletion request is already pending for this user',
          { userId }
        )
      );
    }

    // Create request
    const result = await this.requestStore.create(userId, {
      ...options,
      requireVerification: this.config.requireVerification,
    });

    if (!result.ok) {
      return err(result.error);
    }

    const request = result.value;

    // Send verification email if required
    if (this.config.requireVerification && request.verificationToken && this.config.sendVerificationEmail) {
      const emailResult = await this.config.sendVerificationEmail(
        userId,
        request.id,
        request.verificationToken
      );
      if (!emailResult.ok) {
        // Log but don't fail - user can request token resend
        console.error('Failed to send verification email:', emailResult.error);
      }
    }

    return ok(request);
  }

  /**
   * Get deletion request status.
   */
  async getDeletionRequest(requestId: DeletionRequestId): AsyncAppResult<DataDeletionRequest | null> {
    return this.requestStore.get(requestId);
  }

  /**
   * Verify deletion request (email confirmation).
   */
  async verifyDeletionRequest(
    requestId: DeletionRequestId,
    token: string
  ): AsyncAppResult<DataDeletionRequest> {
    return this.requestStore.verify(requestId, token);
  }

  /**
   * Process a verified deletion request.
   */
  async processDeletionRequest(requestId: DeletionRequestId): AsyncAppResult<DeletionSummary> {
    // Get request
    const requestResult = await this.requestStore.get(requestId);
    if (!requestResult.ok) {
      return err(requestResult.error);
    }
    if (!requestResult.value) {
      return err(
        deletionError(
          DataSubjectErrorCode.REQUEST_NOT_FOUND,
          `Deletion request not found: ${requestId}`,
          { requestId }
        )
      );
    }

    const request = requestResult.value;

    // Check verification
    if (!request.verified) {
      return err(
        deletionError(
          DataSubjectErrorCode.NOT_VERIFIED,
          'Deletion request not verified',
          { requestId }
        )
      );
    }

    // Check status
    if (request.status === 'completed') {
      return err(
        deletionError(
          DataSubjectErrorCode.ALREADY_COMPLETED,
          'Deletion request already completed',
          { requestId }
        )
      );
    }
    if (request.status === 'processing') {
      return err(
        deletionError(
          DataSubjectErrorCode.ALREADY_PROCESSING,
          'Deletion request already processing',
          { requestId }
        )
      );
    }

    // Mark as processing
    const processingNow = createTimestamp();
    await this.requestStore.updateStatus(requestId, 'processing', {
      processingStartedAt: processingNow,
    });

    const startTime = Date.now();

    try {
      // Archive first if requested
      let archiveId: ArchiveId | undefined;
      if (request.archiveFirst && this.exportHandler && this.archiveStorage) {
        const archiveResult = await this.archiveUserData(request.userId, requestId);
        if (archiveResult.ok) {
          archiveId = archiveResult.value;
        }
        // Continue with deletion even if archive fails
      }

      // Perform deletion
      const deletionResult = await this.deleteUserData(request.userId, { archiveFirst: false });
      if (!deletionResult.ok) {
        await this.requestStore.updateStatus(requestId, 'failed', {
          errorMessage: deletionResult.error.message,
        });
        return err(deletionResult.error);
      }

      const summary: DeletionSummary = {
        ...deletionResult.value,
        archived: request.archiveFirst && !!archiveId,
        archiveId,
        durationMs: Date.now() - startTime,
      };

      // Mark as completed
      await this.requestStore.updateStatus(requestId, 'completed', {
        completedAt: createTimestamp(),
        archiveId,
        summary,
      });

      return ok(summary);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.requestStore.updateStatus(requestId, 'failed', {
        errorMessage,
      });
      return err(
        deletionError(
          DataSubjectErrorCode.PROCESSING_FAILED,
          `Deletion processing failed: ${errorMessage}`,
          { requestId }
        )
      );
    }
  }

  /**
   * Delete user data immediately (after verification).
   */
  async deleteUserData(
    userId: UserId,
    options?: { archiveFirst?: boolean }
  ): AsyncAppResult<DeletionSummary> {
    const startTime = Date.now();
    const deletedPerCategory: Record<string, number> = {};
    const failures: DeletionFailure[] = [];
    let totalDeleted = 0;

    // Archive first if requested
    let archiveId: ArchiveId | undefined;
    if (options?.archiveFirst && this.exportHandler && this.archiveStorage) {
      // We don't have a request ID here, generate a temporary one
      const tempRequestId = `temp-${Date.now()}` as DeletionRequestId;
      const archiveResult = await this.archiveUserData(userId, tempRequestId);
      if (archiveResult.ok) {
        archiveId = archiveResult.value;
      }
    }

    // Delete in order: most dependent first, then core entities

    // 1. Delete reminders
    if (this.deleters.reminders) {
      const result = await this.deleters.reminders(userId);
      if (result.ok) {
        deletedPerCategory.reminders = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'reminders', entityId: userId, error: result.error.message });
      }
    }

    // 2. Delete sparks
    if (this.deleters.sparks) {
      const result = await this.deleters.sparks(userId);
      if (result.ok) {
        deletedPerCategory.sparks = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'sparks', entityId: userId, error: result.error.message });
      }
    }

    // 3. Delete steps
    if (this.deleters.steps) {
      const result = await this.deleters.steps(userId);
      if (result.ok) {
        deletedPerCategory.steps = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'steps', entityId: userId, error: result.error.message });
      }
    }

    // 4. Delete quests
    if (this.deleters.quests) {
      const result = await this.deleters.quests(userId);
      if (result.ok) {
        deletedPerCategory.quests = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'quests', entityId: userId, error: result.error.message });
      }
    }

    // 5. Delete goals
    if (this.deleters.goals) {
      const result = await this.deleters.goals(userId);
      if (result.ok) {
        deletedPerCategory.goals = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'goals', entityId: userId, error: result.error.message });
      }
    }

    // 6. Delete sessions
    if (this.deleters.sessions) {
      const result = await this.deleters.sessions(userId);
      if (result.ok) {
        deletedPerCategory.sessions = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'sessions', entityId: userId, error: result.error.message });
      }
    }

    // 7. Delete export requests
    if (this.deleters.exportRequests) {
      const result = await this.deleters.exportRequests(userId);
      if (result.ok) {
        deletedPerCategory.exportRequests = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'exportRequests', entityId: userId, error: result.error.message });
      }
    }

    // 8. Delete preferences
    if (this.deleters.preferences) {
      const result = await this.deleters.preferences(userId);
      if (result.ok) {
        deletedPerCategory.preferences = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'preferences', entityId: userId, error: result.error.message });
      }
    }

    // 9. Delete profile
    if (this.deleters.profile) {
      const result = await this.deleters.profile(userId);
      if (result.ok) {
        deletedPerCategory.profile = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'profile', entityId: userId, error: result.error.message });
      }
    }

    // 10. Delete consent (keep audit log last for compliance)
    if (this.deleters.consent) {
      const result = await this.deleters.consent(userId);
      if (result.ok) {
        deletedPerCategory.consent = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'consent', entityId: userId, error: result.error.message });
      }
    }

    // 11. Delete audit log (last, for compliance record)
    // Note: In practice, you might want to keep audit logs longer
    if (this.deleters.auditLog) {
      const result = await this.deleters.auditLog(userId);
      if (result.ok) {
        deletedPerCategory.auditLog = result.value;
        totalDeleted += result.value;
      } else {
        failures.push({ category: 'auditLog', entityId: userId, error: result.error.message });
      }
    }

    const summary: DeletionSummary = {
      totalDeleted,
      deletedPerCategory,
      archived: !!archiveId,
      archiveId,
      failures,
      durationMs: Date.now() - startTime,
    };

    return ok(summary);
  }

  /**
   * Get archive for a user (if exists).
   */
  async getArchive(archiveId: ArchiveId): AsyncAppResult<UserDataArchive | null> {
    if (!this.archiveStorage) {
      return ok(null);
    }
    return this.archiveStorage.get(archiveId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADDITIONAL METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get pending deletion requests for background processing.
   */
  async getPendingRequests(limit: number = 10): AsyncAppResult<readonly DataDeletionRequest[]> {
    return this.requestStore.getPending(limit);
  }

  /**
   * Get all deletion requests for a user.
   */
  async getUserDeletionRequests(userId: UserId): AsyncAppResult<readonly DataDeletionRequest[]> {
    return this.requestStore.getByUser(userId);
  }

  /**
   * Verify deletion request by token (without knowing request ID).
   */
  async verifyByToken(token: string): AsyncAppResult<DataDeletionRequest> {
    return this.requestStore.verifyByToken(token);
  }

  /**
   * Get user's archives.
   */
  async getUserArchives(userId: UserId): AsyncAppResult<readonly UserDataArchive[]> {
    if (!this.archiveStorage) {
      return ok([]);
    }
    return this.archiveStorage.listByUser(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Archive user data before deletion.
   */
  private async archiveUserData(
    userId: UserId,
    deletionRequestId: DeletionRequestId
  ): AsyncAppResult<ArchiveId> {
    if (!this.exportHandler || !this.archiveStorage) {
      return err(
        deletionError(
          DataSubjectErrorCode.BACKEND_ERROR,
          'Archive not configured'
        )
      );
    }

    // Export all data
    const exportResult = await this.exportHandler.exportUserData(userId);
    if (!exportResult.ok) {
      return err(exportResult.error);
    }

    const now = createTimestamp();
    const archiveId = createArchiveId();

    // Calculate expiration
    const expiresAt = new Date(
      Date.now() + this.config.archiveRetentionDays * 24 * 60 * 60 * 1000
    ).toISOString() as Timestamp;

    // Create archive
    const archive: UserDataArchive = {
      id: archiveId,
      userId,
      createdAt: now,
      deletionRequestId,
      data: exportResult.value,
      retentionDays: this.config.archiveRetentionDays,
      expiresAt,
      storageLocation: `archives/${userId}/${archiveId}`,
      checksum: this.computeChecksum(exportResult.value),
    };

    // Store archive
    const storeResult = await this.archiveStorage.store(archive);
    if (!storeResult.ok) {
      return err(storeResult.error);
    }

    return ok(archiveId);
  }

  /**
   * Compute checksum for data integrity.
   */
  private computeChecksum(data: DataExport): string {
    const { createHash } = require('crypto');
    const json = JSON.stringify(data);
    return createHash('sha256').update(json).digest('hex');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a DataDeletionHandler instance.
 */
export function createDataDeletionHandler(
  requestStore: DeletionRequestStore,
  deleters: DataDeleters,
  options?: {
    exportHandler?: DataExportHandler;
    archiveStorage?: IArchiveStorage;
    config?: Partial<DataDeletionHandlerConfig>;
  }
): DataDeletionHandler {
  return new DataDeletionHandler(requestStore, deleters, options);
}
