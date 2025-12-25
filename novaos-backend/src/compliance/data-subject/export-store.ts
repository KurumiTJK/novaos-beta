// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT REQUEST STORE — Track Data Export Requests
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// Persistent storage for data export requests with:
//   - Request lifecycle tracking
//   - User-based indexing
//   - Pending queue for async processing
//   - Download token management
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../storage/index.js';
import type { EncryptionService } from '../../security/encryption/service.js';
import { ok, err, type AsyncAppResult } from '../../types/result.js';
import type { UserId, Timestamp } from '../../types/branded.js';
import { createTimestamp } from '../../types/branded.js';
import { DataSubjectKeys } from '../keys.js';
import { SecureStore, storeError } from '../../services/spark-engine/store/secure-store.js';
import type { SecureStoreConfig } from '../../services/spark-engine/store/types.js';
import { StoreErrorCode as ErrorCodes } from '../../services/spark-engine/store/types.js';
import type {
  DataExportRequest,
  ExportRequestId,
  DataSubjectRequestStatus,
  ExportCategory,
  ExportFormat,
} from './types.js';
import {
  createExportRequestId,
  ALL_EXPORT_CATEGORIES,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT REQUEST STORE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Storage for data export requests.
 */
export class ExportRequestStore extends SecureStore<DataExportRequest, ExportRequestId> {
  constructor(
    store: KeyValueStore,
    config: Partial<SecureStoreConfig> = {},
    encryption?: EncryptionService
  ) {
    super(store, config, encryption);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  protected getKey(id: ExportRequestId): string {
    return DataSubjectKeys.exportRequest(id);
  }

  protected validate(request: DataExportRequest): string | undefined {
    if (!request.id) {
      return 'Request ID is required';
    }
    if (!request.userId) {
      return 'User ID is required';
    }
    if (!request.requestedAt) {
      return 'Request timestamp is required';
    }
    return undefined;
  }

  protected getId(request: DataExportRequest): ExportRequestId {
    return request.id;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new export request.
   */
  async create(
    userId: UserId,
    options?: {
      categories?: readonly ExportCategory[];
      format?: ExportFormat;
      ipAddress?: string;
    }
  ): AsyncAppResult<DataExportRequest> {
    const now = createTimestamp();
    const id = createExportRequestId();

    const request: DataExportRequest = {
      id,
      userId,
      categories: options?.categories ?? [...ALL_EXPORT_CATEGORIES],
      format: options?.format ?? 'json',
      status: 'pending',
      requestedAt: now,
      ipAddress: options?.ipAddress,
    };

    // Save request
    const saveResult = await this.saveEntity(request);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    // Add to user's requests index
    await this.addToUserIndex(userId, id, now);

    // Add to pending queue
    await this.addToPendingQueue(id, now);

    return ok(request);
  }

  /**
   * Get a request by ID.
   */
  async get(requestId: ExportRequestId): AsyncAppResult<DataExportRequest | null> {
    return this.getEntity(requestId);
  }

  /**
   * Update request status.
   */
  async updateStatus(
    requestId: ExportRequestId,
    status: DataSubjectRequestStatus,
    updates?: Partial<Pick<DataExportRequest, 
      'processingStartedAt' | 'completedAt' | 'downloadUrl' | 
      'downloadExpiresAt' | 'errorMessage'
    >>
  ): AsyncAppResult<DataExportRequest> {
    const result = await this.getEntity(requestId);
    if (!result.ok) {
      return err(result.error);
    }
    if (!result.value) {
      return err(storeError(ErrorCodes.NOT_FOUND, `Export request not found: ${requestId}`, { requestId }));
    }

    const updated: DataExportRequest = {
      ...result.value,
      status,
      ...updates,
    };

    const saveResult = await this.saveEntity(updated);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    // Remove from pending if completed or failed
    if (status === 'completed' || status === 'failed') {
      await this.removeFromPendingQueue(requestId);
    }

    return ok(updated);
  }

  /**
   * Get all requests for a user.
   */
  async getByUser(
    userId: UserId,
    options?: { limit?: number }
  ): AsyncAppResult<readonly DataExportRequest[]> {
    const { limit = 100 } = options ?? {};

    try {
      const indexKey = DataSubjectKeys.userExportRequests(userId);
      const requestIds = await this.store.zrevrange(indexKey, 0, limit - 1);

      if (requestIds.length === 0) {
        return ok([]);
      }

      const requests: DataExportRequest[] = [];
      for (const id of requestIds) {
        const result = await this.getEntity(id as ExportRequestId);
        if (result.ok && result.value) {
          requests.push(result.value);
        }
      }

      return ok(requests);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to get user export requests: ${error instanceof Error ? error.message : String(error)}`,
          { userId }
        )
      );
    }
  }

  /**
   * Get pending requests for processing.
   */
  async getPending(limit: number = 10): AsyncAppResult<readonly DataExportRequest[]> {
    try {
      const queueKey = DataSubjectKeys.pendingExports();
      const requestIds = await this.store.zrange(queueKey, 0, limit - 1);

      if (requestIds.length === 0) {
        return ok([]);
      }

      const requests: DataExportRequest[] = [];
      for (const id of requestIds) {
        const result = await this.getEntity(id as ExportRequestId);
        if (result.ok && result.value && result.value.status === 'pending') {
          requests.push(result.value);
        }
      }

      return ok(requests);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to get pending requests: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Create a download token for an export.
   */
  async createDownloadToken(
    requestId: ExportRequestId,
    token: string,
    expiresInSeconds: number = 86400 // 24 hours
  ): AsyncAppResult<void> {
    try {
      const tokenKey = DataSubjectKeys.exportToken(token);
      await this.store.set(tokenKey, requestId, { ttl: expiresInSeconds });
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to create download token: ${error instanceof Error ? error.message : String(error)}`,
          { requestId }
        )
      );
    }
  }

  /**
   * Validate a download token.
   */
  async validateDownloadToken(token: string): AsyncAppResult<ExportRequestId | null> {
    try {
      const tokenKey = DataSubjectKeys.exportToken(token);
      const requestId = await this.store.get(tokenKey);
      return ok(requestId as ExportRequestId | null);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to validate download token: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Delete all export data for a user.
   */
  async deleteByUser(userId: UserId): AsyncAppResult<number> {
    let deleted = 0;

    try {
      const indexKey = DataSubjectKeys.userExportRequests(userId);
      const requestIds = await this.store.zrange(indexKey, 0, -1);

      for (const id of requestIds) {
        const deleteResult = await this.deleteEntity(id as ExportRequestId);
        if (deleteResult.ok && deleteResult.value) {
          deleted++;
        }
        await this.removeFromPendingQueue(id as ExportRequestId);
      }

      // Delete the index
      await this.store.delete(indexKey);

      return ok(deleted);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to delete user export data: ${error instanceof Error ? error.message : String(error)}`,
          { userId }
        )
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INDEX MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  private async addToUserIndex(
    userId: UserId,
    requestId: ExportRequestId,
    timestamp: Timestamp
  ): AsyncAppResult<void> {
    try {
      const indexKey = DataSubjectKeys.userExportRequests(userId);
      const score = new Date(timestamp).getTime();
      await this.store.zadd(indexKey, score, requestId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to add to user index: ${error instanceof Error ? error.message : String(error)}`,
          { userId, requestId }
        )
      );
    }
  }

  private async addToPendingQueue(
    requestId: ExportRequestId,
    timestamp: Timestamp
  ): AsyncAppResult<void> {
    try {
      const queueKey = DataSubjectKeys.pendingExports();
      const score = new Date(timestamp).getTime();
      await this.store.zadd(queueKey, score, requestId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to add to pending queue: ${error instanceof Error ? error.message : String(error)}`,
          { requestId }
        )
      );
    }
  }

  private async removeFromPendingQueue(requestId: ExportRequestId): AsyncAppResult<void> {
    try {
      const queueKey = DataSubjectKeys.pendingExports();
      await this.store.zrem(queueKey, requestId);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to remove from pending queue: ${error instanceof Error ? error.message : String(error)}`,
          { requestId }
        )
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an ExportRequestStore instance.
 */
export function createExportRequestStore(
  store: KeyValueStore,
  config?: Partial<SecureStoreConfig>,
  encryption?: EncryptionService
): ExportRequestStore {
  return new ExportRequestStore(store, config, encryption);
}
