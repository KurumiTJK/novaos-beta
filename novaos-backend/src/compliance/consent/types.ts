// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT TYPES — GDPR Consent Tracking Types
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module defines types for GDPR-compliant consent management:
//   - ConsentPurpose: What the user is consenting to
//   - ConsentRecord: Individual consent grant/revoke event
//   - UserConsent: Aggregated consent state for a user
//   - ConsentAuditEntry: Immutable audit trail
//
// All types use branded IDs from Phase 1 for compile-time type safety.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { UserId, Timestamp } from '../../../types/branded.js';
import type { Brand } from '../../../types/branded.js';

// ═══════════════════════════════════════════════════════════════════════════════
// BRANDED TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Consent record identifier.
 */
export type ConsentId = Brand<string, 'ConsentId'>;

/**
 * Consent history entry identifier.
 */
export type ConsentHistoryId = Brand<string, 'ConsentHistoryId'>;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT PURPOSES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Categories of data processing that require consent.
 *
 * GDPR Article 6 requires lawful basis for processing.
 * These purposes map to specific processing activities.
 */
export type ConsentPurpose =
  | 'dataProcessing'      // Core service functionality (required)
  | 'notifications'       // Push, email, SMS notifications
  | 'analytics'           // Usage analytics and improvement
  | 'personalization'     // AI personalization and memory
  | 'thirdPartySharing'   // Sharing with external services
  | 'marketing';          // Marketing communications

/**
 * All available consent purposes.
 */
export const ALL_CONSENT_PURPOSES: readonly ConsentPurpose[] = [
  'dataProcessing',
  'notifications',
  'analytics',
  'personalization',
  'thirdPartySharing',
  'marketing',
] as const;

/**
 * Required purposes that cannot be revoked (service won't work without them).
 */
export const REQUIRED_PURPOSES: readonly ConsentPurpose[] = [
  'dataProcessing',
] as const;

/**
 * Optional purposes that can be freely toggled.
 */
export const OPTIONAL_PURPOSES: readonly ConsentPurpose[] = [
  'notifications',
  'analytics',
  'personalization',
  'thirdPartySharing',
  'marketing',
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT METHOD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * How consent was obtained.
 * GDPR requires clear affirmative action.
 */
export type ConsentMethod =
  | 'explicit_checkbox'   // User checked a box
  | 'banner_accept'       // Cookie/consent banner acceptance
  | 'settings_toggle'     // Settings page toggle
  | 'api_request'         // Programmatic via API
  | 'signup_flow'         // During registration
  | 'imported';           // Imported from external system

/**
 * Why consent was revoked.
 */
export type RevocationReason =
  | 'user_request'        // User explicitly revoked
  | 'account_deletion'    // Part of account deletion
  | 'data_breach'         // Revoked due to security incident
  | 'policy_change'       // Policy change requiring re-consent
  | 'expiration'          // Consent expired
  | 'admin_action';       // Admin revoked on behalf of user

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT RECORD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Individual consent grant or revocation event.
 *
 * This is an immutable record of a consent change.
 * Used for audit trail and proving consent was obtained.
 */
export interface ConsentRecord {
  /** Unique record identifier */
  readonly id: ConsentHistoryId;

  /** User who gave/revoked consent */
  readonly userId: UserId;

  /** What purpose this consent is for */
  readonly purpose: ConsentPurpose;

  /** Whether consent was granted (true) or revoked (false) */
  readonly granted: boolean;

  /** When consent was granted/revoked */
  readonly timestamp: Timestamp;

  /** How consent was obtained */
  readonly method: ConsentMethod;

  /** Why consent was revoked (if applicable) */
  readonly revocationReason?: RevocationReason;

  /** IP address at time of consent (for audit) */
  readonly ipAddress?: string;

  /** User agent at time of consent (for audit) */
  readonly userAgent?: string;

  /** Version of privacy policy accepted */
  readonly policyVersion?: string;

  /** Additional context (e.g., specific feature, campaign) */
  readonly context?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER CONSENT STATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Current consent state for a specific purpose.
 */
export interface PurposeConsent {
  /** Whether currently consented */
  readonly granted: boolean;

  /** When consent was last updated */
  readonly updatedAt: Timestamp;

  /** How consent was obtained (if granted) */
  readonly method?: ConsentMethod;

  /** ID of the consent record that set this state */
  readonly recordId: ConsentHistoryId;
}

/**
 * Aggregated consent state for a user.
 *
 * This is the current state derived from ConsentRecords.
 * Stored for quick access without scanning history.
 */
export interface UserConsent {
  /** User identifier */
  readonly userId: UserId;

  /** Consent state per purpose */
  readonly purposes: Readonly<Record<ConsentPurpose, PurposeConsent>>;

  /** When the user first gave any consent */
  readonly initialConsentAt: Timestamp;

  /** When consent state was last modified */
  readonly lastModifiedAt: Timestamp;

  /** Current privacy policy version accepted */
  readonly policyVersion: string;

  /** Whether all required consents are granted */
  readonly hasRequiredConsents: boolean;

  /** Number of consent changes (for detecting frequent changes) */
  readonly changeCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT REQUEST/RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request to update consent.
 */
export interface UpdateConsentRequest {
  /** Purpose to update */
  readonly purpose: ConsentPurpose;

  /** New consent state */
  readonly granted: boolean;

  /** How consent was obtained */
  readonly method: ConsentMethod;

  /** Why consent was revoked (if revoking) */
  readonly revocationReason?: RevocationReason;

  /** Privacy policy version (if granting) */
  readonly policyVersion?: string;

  /** Additional context */
  readonly context?: Record<string, unknown>;
}

/**
 * Batch consent update (e.g., from settings page).
 */
export interface BatchConsentRequest {
  /** Consents to update */
  readonly consents: readonly UpdateConsentRequest[];

  /** Common method for all updates */
  readonly method: ConsentMethod;

  /** Privacy policy version */
  readonly policyVersion: string;
}

/**
 * Result of a consent update.
 */
export interface ConsentUpdateResult {
  /** Whether update was successful */
  readonly success: boolean;

  /** Updated consent state */
  readonly consent: UserConsent;

  /** The record created for this change */
  readonly record: ConsentRecord;

  /** Warning if revoking required consent */
  readonly warning?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT STORE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../../types/result.js';

/**
 * Consent store interface.
 */
export interface IConsentStore {
  /**
   * Get current consent state for a user.
   */
  getConsent(userId: UserId): AsyncAppResult<UserConsent | null>;

  /**
   * Record a consent change.
   */
  recordConsent(
    userId: UserId,
    request: UpdateConsentRequest,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): AsyncAppResult<ConsentUpdateResult>;

  /**
   * Batch update consents.
   */
  batchUpdateConsent(
    userId: UserId,
    request: BatchConsentRequest,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): AsyncAppResult<UserConsent>;

  /**
   * Revoke all consents for a user (account deletion).
   */
  revokeAllConsents(
    userId: UserId,
    reason: RevocationReason
  ): AsyncAppResult<void>;

  /**
   * Get consent history for a user.
   */
  getConsentHistory(
    userId: UserId,
    options?: { limit?: number; purpose?: ConsentPurpose }
  ): AsyncAppResult<readonly ConsentRecord[]>;

  /**
   * Check if user has consented to a specific purpose.
   */
  hasConsent(userId: UserId, purpose: ConsentPurpose): AsyncAppResult<boolean>;

  /**
   * Check if user has all required consents.
   */
  hasRequiredConsents(userId: UserId): AsyncAppResult<boolean>;

  /**
   * Delete all consent data for a user (GDPR deletion).
   */
  deleteConsentData(userId: UserId): AsyncAppResult<number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Consent-specific error codes.
 */
export const ConsentErrorCode = {
  /** Consent not found for user */
  NOT_FOUND: 'CONSENT_NOT_FOUND',

  /** Required consent cannot be revoked */
  REQUIRED_CONSENT: 'CONSENT_REQUIRED_CANNOT_REVOKE',

  /** Invalid consent purpose */
  INVALID_PURPOSE: 'CONSENT_INVALID_PURPOSE',

  /** Consent already in requested state */
  NO_CHANGE: 'CONSENT_NO_CHANGE',

  /** Policy version mismatch */
  POLICY_VERSION_MISMATCH: 'CONSENT_POLICY_VERSION_MISMATCH',

  /** Backend error */
  BACKEND_ERROR: 'CONSENT_BACKEND_ERROR',
} as const;

export type ConsentErrorCode = (typeof ConsentErrorCode)[keyof typeof ConsentErrorCode];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a value is a valid ConsentPurpose.
 */
export function isConsentPurpose(value: unknown): value is ConsentPurpose {
  return (
    typeof value === 'string' &&
    ALL_CONSENT_PURPOSES.includes(value as ConsentPurpose)
  );
}

/**
 * Check if a purpose is required.
 */
export function isRequiredPurpose(purpose: ConsentPurpose): boolean {
  return REQUIRED_PURPOSES.includes(purpose);
}

/**
 * Check if a value is a valid UserConsent.
 */
export function isUserConsent(value: unknown): value is UserConsent {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.userId === 'string' &&
    typeof obj.purposes === 'object' &&
    obj.purposes !== null &&
    typeof obj.initialConsentAt === 'string' &&
    typeof obj.lastModifiedAt === 'string' &&
    typeof obj.policyVersion === 'string' &&
    typeof obj.hasRequiredConsents === 'boolean' &&
    typeof obj.changeCount === 'number'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new ConsentId.
 */
export function createConsentId(value?: string): ConsentId {
  return (value ?? `consent-${uuidv4()}`) as ConsentId;
}

/**
 * Create a new ConsentHistoryId.
 */
export function createConsentHistoryId(value?: string): ConsentHistoryId {
  return (value ?? `ch-${uuidv4()}`) as ConsentHistoryId;
}

/**
 * Create default consent state (no consents granted).
 */
export function createDefaultConsent(
  userId: UserId,
  timestamp: Timestamp,
  policyVersion: string
): UserConsent {
  const defaultPurposeConsent = (purpose: ConsentPurpose): PurposeConsent => ({
    granted: false,
    updatedAt: timestamp,
    recordId: createConsentHistoryId(),
  });

  const purposes = {} as Record<ConsentPurpose, PurposeConsent>;
  for (const purpose of ALL_CONSENT_PURPOSES) {
    purposes[purpose] = defaultPurposeConsent(purpose);
  }

  return {
    userId,
    purposes,
    initialConsentAt: timestamp,
    lastModifiedAt: timestamp,
    policyVersion,
    hasRequiredConsents: false,
    changeCount: 0,
  };
}

/**
 * Current privacy policy version.
 * Should be updated when policy changes.
 */
export const CURRENT_POLICY_VERSION = '1.0.0';
