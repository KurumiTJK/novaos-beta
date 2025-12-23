// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE MODULE — Main Barrel Exports
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// GDPR compliance infrastructure:
//   - Consent tracking and management
//   - Data subject rights (export, deletion)
//   - Retention policy enforcement
//   - Immutable audit logging
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CONSENT
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  ConsentId,
  ConsentHistoryId,
  ConsentPurpose,
  ConsentMethod,
  RevocationReason,
  ConsentRecord,
  PurposeConsent,
  UserConsent,
  UpdateConsentRequest,
  BatchConsentRequest,
  ConsentUpdateResult,
  IConsentStore,
  ConsentRequest,
  ConsentMiddlewareOptions,
  ConsentErrorResponse,
} from './consent/index.js';

export {
  ALL_CONSENT_PURPOSES,
  REQUIRED_PURPOSES,
  OPTIONAL_PURPOSES,
  CURRENT_POLICY_VERSION,
  ConsentErrorCode,
  isConsentPurpose,
  isRequiredPurpose,
  isUserConsent,
  createConsentId,
  createConsentHistoryId,
  createDefaultConsent,
  ConsentStore,
  createConsentStore,
  createConsentMiddleware,
  getMissingConsents,
  canPersonalize,
  canTrackAnalytics,
  canSendNotifications,
  canShareWithThirdParties,
  canSendMarketing,
} from './consent/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DATA SUBJECT RIGHTS
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  ExportRequestId,
  DeletionRequestId,
  ArchiveId,
  DataSubjectRequestStatus,
  ExportCategory,
  ExportFormat,
  DataExportRequest,
  ExportedCategory,
  DataExport,
  ExportSummary,
  DataDeletionRequest,
  DeletionSummary,
  DeletionFailure,
  UserDataArchive,
  UserProfile,
  UserPreferences,
  AuditLogEntry,
  IDataExportService,
  IDataDeletionService,
  DataCollectors,
  DataExportHandlerConfig,
  DataDeleters,
  IArchiveStorage,
  DataDeletionHandlerConfig,
} from './data-subject/index.js';

export {
  ALL_EXPORT_CATEGORIES,
  DataSubjectErrorCode,
  createExportRequestId,
  createDeletionRequestId,
  createArchiveId,
  createVerificationToken,
  ExportRequestStore,
  createExportRequestStore,
  DataExportHandler,
  createDataExportHandler,
  DeletionRequestStore,
  createDeletionRequestStore,
  DataDeletionHandler,
  createDataDeletionHandler,
} from './data-subject/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RETENTION
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  RetentionJobId,
  RetentionCategory,
  RetentionAction,
  RetentionJobStatus,
  RetentionPolicy,
  RetentionJob,
  RetentionJobResults,
  CategoryJobResult,
  RetentionCandidate,
  RetentionEnforcerConfig,
  IRetentionEnforcer,
  RetentionPolicySummary,
  CandidateFinder,
  RetentionCandidateInfo,
  CategoryProcessor,
  CategoryRegistry,
} from './retention/index.js';

export {
  ALL_RETENTION_CATEGORIES,
  DEFAULT_RETENTION_POLICIES,
  DEFAULT_ENFORCER_CONFIG,
  RetentionErrorCode,
  createRetentionJobId,
  getDefaultPolicy,
  calculateExpirationDate,
  isPastRetention,
  daysPastRetention,
  RetentionPolicyManager,
  createRetentionPolicyManager,
  RetentionEnforcer,
  createRetentionEnforcer,
} from './retention/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  AuditCategory,
  AuditAction,
  AuditSeverity,
  AuditEntry,
  AuditDetails,
  AuditRequestMetadata,
  AuditQuery,
  AuditQueryResult,
  AuditReportType,
  AuditReportRequest,
  AuditReport,
  AuditReportSummary,
  IAuditStore,
  IntegrityCheckResult,
  IAuditLogger,
} from './audit-log/index.js';

export {
  AuditErrorCode,
  createAuditId,
  computeAuditEntryHash,
  verifyAuditEntryHash,
  getDefaultSeverity,
  getCategoryFromAction,
  AuditStore,
  createAuditStore,
  AuditLogger,
  createAuditLogger,
  extractRequestMetadata,
} from './audit-log/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// KEYS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  ComplianceNamespace,
  ConsentKeys,
  AuditKeys,
  DataSubjectKeys,
  RetentionKeys,
  ComplianceKeys,
  CompliancePatterns,
} from './keys.js';
