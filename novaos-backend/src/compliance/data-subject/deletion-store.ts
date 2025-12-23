// ═══════════════════════════════════════════════════════════════════════════════
// DELETION REQUEST STORE — Track Data Deletion Requests
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// Persistent storage for data deletion requests with:
//   - Request lifecycle tracking
//   - Verification token management
//   - User-based indexing
//   - Pending queue for async processing
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../../storage/index.js';
import type { EncryptionService } from '../../../security/encryption/service.js';
import { ok, err, type AsyncAppResult } from '../../../types/result.js';
import type { UserId, Timestamp } from '../../../types/branded.js';
import { createTimestamp } from '../../../types/branded.js';
import { DataSubjectKeys } from '../keys.js';
import { SecureStore, storeError } from '../../../services/spark-engine/store/secure-store.js';
import type { SecureStoreConfig } from '../../../services/spark-engine/store/types.js';
import { StoreErrorCode as ErrorCodes } from '../../../services/spark-engine/store/types.js';
import type {
  DataDeletionRequest,
  DeletionRequestId,
  DeletionSummary,
  DataSubjectRequestStatus,
  ArchiveId,
} from './types.js';
import {
  createDeletionRequestId,
  createVerificationToken,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DELETION REQUEST STORE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Storage for data deletion requests.
 */
export class DeletionRequestStore extends SecureStore<DataDeletionRequest, DeletionRequestId> {
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

  protected getKey(id: DeletionRequestId): string {
    return DataSubjectKeys.deletionRequest(id);
  }

  protected validate(request: DataDeletionRequest): string | undefined {
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

  protected getId(request: DataDeletionRequest): DeletionRequestId {
    return request.id;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new deletion request.
   */
  async create(
    userId: UserId,
    options?: {
      archiveFirst?: boolean;
      reason?: string;
      ipAddress?: string;
      requireVerification?: boolean;
    }
  ): AsyncAppResult<DataDeletionRequest> {
    const now = createTimestamp();
    const id = createDeletionRequestId();
    const requireVerification = options?.requireVerification ?? true;

    const request: DataDeletionRequest = {
      id,
      userId,
      archiveFirst: options?.archiveFirst ?? true,
      status: 'pending',
      requestedAt: now,
      verificationToken: requireVerification ? createVerificationToken() : undefined,
      verified: !requireVerification, // Auto-verify if not required
      ipAddress: options?.ipAddress,
      reason: options?.reason,
    };

    // Save request
    const saveResult = await this.saveEntity(request);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    // Add to user's requests index
    await this.addToUserIndex(userId, id, now);

    // Add to pending queue if already verified
    if (request.verified) {
      await this.addToPendingQueue(id, now);
    }

    // Store verification token mapping
    if (request.verificationToken) {
      await this.storeVerificationToken(request.verificationToken, id);
    }

    return ok(request);
  }

  /**
   * Get a request by ID.
   */
  async get(requestId: DeletionRequestId): AsyncAppResult<DataDeletionRequest | null> {
    return this.getEntity(requestId);
  }

  /**
   * Verify a deletion request.
   */
  async verify(
    requestId: DeletionRequestId,
    token: string
  ): AsyncAppResult<DataDeletionRequest> {
    const result = await this.getEntity(requestId);
    if (!result.ok) {
      return err(result.error);
    }
    if (!result.value) {
      return err(storeError(ErrorCodes.NOT_FOUND, `Deletion request not found: ${requestId}`, { requestId }));
    }

    const request = result.value;

    // Check token
    if (request.verificationToken !== token) {
      return err(storeError(ErrorCodes.INVALID_DATA, 'Invalid verification token', { requestId }));
    }

    // Already verified?
    if (request.verified) {
      return ok(request);
    }

    // Mark as verified
    const now = createTimestamp();
    const updated: DataDeletionRequest = {
      ...request,
      verified: true,
    };

    const saveResult = await this.saveEntity(updated);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    // Add to pending queue
    await this.addToPendingQueue(requestId, now);

    // Remove verification token
    if (request.verificationToken) {
      await this.removeVerificationToken(request.verificationToken);
    }

    return ok(updated);
  }

  /**
   * Verify by token only (lookup request ID from token).
   */
  async verifyByToken(token: string): AsyncAppResult<DataDeletionRequest> {
    const requestIdResult = await this.getRequestIdByToken(token);
    if (!requestIdResult.ok) {
      return err(requestIdResult.error);
    }
    if (!requestIdResult.value) {
      return err(storeError(ErrorCodes.NOT_FOUND, 'Verification token not found or expired'));
    }

    return this.verify(requestIdResult.value, token);
  }

  /**
   * Update request status.
   */
  async updateStatus(
    requestId: DeletionRequestId,
    status: DataSubjectRequestStatus,
    updates?: Partial<Pick<DataDeletionRequest,
      'processingStartedAt' | 'completedAt' | 'archiveId' |
      'summary' | 'errorMessage'
    >>
  ): AsyncAppResult<DataDeletionRequest> {
    const result = await this.getEntity(requestId);
    if (!result.ok) {
      return err(result.error);
    }
    if (!result.value) {
      return err(storeError(ErrorCodes.NOT_FOUND, `Deletion request not found: ${requestId}`, { requestId }));
    }

    const updated: DataDeletionRequest = {
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
  ): AsyncAppResult<readonly DataDeletionRequest[]> {
    const { limit = 100 } = options ?? {};

    try {
      const indexKey = DataSubjectKeys.userDeletionRequests(userId);
      const requestIds = await this.store.zrevrange(indexKey, 0, limit - 1);

      if (requestIds.length === 0) {
        return ok([]);
      }

      const requests: DataDeletionRequest[] = [];
      for (const id of requestIds) {
        const result = await this.getEntity(id as DeletionRequestId);
        if (result.ok && result.value) {
          requests.push(result.value);
        }
      }

      return ok(requests);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to get user deletion requests: ${error instanceof Error ? error.message : String(error)}`,
          { userId }
        )
      );
    }
  }

  /**
   * Get pending verified requests for processing.
   */
  async getPending(limit: number = 10): AsyncAppResult<readonly DataDeletionRequest[]> {
    try {
      const queueKey = DataSubjectKeys.pendingDeletions();
      const requestIds = await this.store.zrange(queueKey, 0, limit - 1);

      if (requestIds.length === 0) {
        return ok([]);
      }

      const requests: DataDeletionRequest[] = [];
      for (const id of requestIds) {
        const result = await this.getEntity(id as DeletionRequestId);
        if (result.ok && result.value && result.value.verified && result.value.status === 'pending') {
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
   * Check if user has any pending deletion requests.
   */
  async hasPendingDeletion(userId: UserId): AsyncAppResult<boolean> {
    const result = await this.getByUser(userId, { limit: 10 });
    if (!result.ok) {
      return err(result.error);
    }

    const hasPending = result.value.some(
      r => r.status === 'pending' || r.status === 'processing'
    );
    return ok(hasPending);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INDEX MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  private async addToUserIndex(
    userId: UserId,
    requestId: DeletionRequestId,
    timestamp: Timestamp
  ): AsyncAppResult<void> {
    try {
      const indexKey = DataSubjectKeys.userDeletionRequests(userId);
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
    requestId: DeletionRequestId,
    timestamp: Timestamp
  ): AsyncAppResult<void> {
    try {
      const queueKey = DataSubjectKeys.pendingDeletions();
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

  private async removeFromPendingQueue(requestId: DeletionRequestId): AsyncAppResult<void> {
    try {
      const queueKey = DataSubjectKeys.pendingDeletions();
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

  private async storeVerificationToken(
    token: string,
    requestId: DeletionRequestId
  ): AsyncAppResult<void> {
    try {
      const tokenKey = DataSubjectKeys.verificationToken(token);
      // Token expires in 7 days
      await this.store.set(tokenKey, requestId, { ttl: 7 * 24 * 60 * 60 });
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to store verification token: ${error instanceof Error ? error.message : String(error)}`,
          { requestId }
        )
      );
    }
  }

  private async removeVerificationToken(token: string): AsyncAppResult<void> {
    try {
      const tokenKey = DataSubjectKeys.verificationToken(token);
      await this.store.delete(tokenKey);
      return ok(undefined);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to remove verification token: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private async getRequestIdByToken(token: string): AsyncAppResult<DeletionRequestId | null> {
    try {
      const tokenKey = DataSubjectKeys.verificationToken(token);
      const requestId = await this.store.get(tokenKey);
      return ok(requestId as DeletionRequestId | null);
    } catch (error) {
      return err(
        storeError(
          ErrorCodes.BACKEND_ERROR,
          `Failed to get request by token: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a DeletionRequestStore instance.
 */
export function createDeletionRequestStore(
  store: KeyValueStore,
  config?: Partial<SecureStoreConfig>,
  encryption?: EncryptionService
): DeletionRequestStore {
  return new DeletionRequestStore(store, config, encryption);
}
