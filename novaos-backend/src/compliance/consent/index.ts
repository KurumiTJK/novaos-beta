// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT MODULE — Barrel Exports
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Branded types
  ConsentId,
  ConsentHistoryId,
  
  // Purposes
  ConsentPurpose,
  ConsentMethod,
  RevocationReason,
  
  // Core types
  ConsentRecord,
  PurposeConsent,
  UserConsent,
  
  // Request/Response
  UpdateConsentRequest,
  BatchConsentRequest,
  ConsentUpdateResult,
  
  // Store interface
  IConsentStore,
  
  // Error codes
  ConsentErrorCode,
} from './types.js';

export {
  // Constants
  ALL_CONSENT_PURPOSES,
  REQUIRED_PURPOSES,
  OPTIONAL_PURPOSES,
  CURRENT_POLICY_VERSION,
  ConsentErrorCode,
  
  // Type guards
  isConsentPurpose,
  isRequiredPurpose,
  isUserConsent,
  
  // Factory functions
  createConsentId,
  createConsentHistoryId,
  createDefaultConsent,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export { ConsentStore, createConsentStore } from './consent-store.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  ConsentRequest,
  ConsentMiddlewareOptions,
  ConsentErrorResponse,
} from './middleware.js';

export {
  createConsentMiddleware,
  getMissingConsents,
  canPersonalize,
  canTrackAnalytics,
  canSendNotifications,
  canShareWithThirdParties,
  canSendMarketing,
} from './middleware.js';
