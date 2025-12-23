// ═══════════════════════════════════════════════════════════════════════════════
// DATA SUBJECT MODULE — Barrel Exports
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Branded types
  ExportRequestId,
  DeletionRequestId,
  ArchiveId,
  
  // Status
  DataSubjectRequestStatus,
  
  // Export types
  ExportCategory,
  ExportFormat,
  DataExportRequest,
  ExportedCategory,
  DataExport,
  ExportSummary,
  
  // Deletion types
  DataDeletionRequest,
  DeletionSummary,
  DeletionFailure,
  
  // Archive types
  UserDataArchive,
  
  // Helper types
  UserProfile,
  UserPreferences,
  AuditLogEntry,
  
  // Service interfaces
  IDataExportService,
  IDataDeletionService,
  
  // Error codes
  DataSubjectErrorCode,
} from './types.js';

export {
  // Constants
  ALL_EXPORT_CATEGORIES,
  DataSubjectErrorCode,
  
  // Factory functions
  createExportRequestId,
  createDeletionRequestId,
  createArchiveId,
  createVerificationToken,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT STORE & HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export { ExportRequestStore, createExportRequestStore } from './export-store.js';

export type { DataCollectors, DataExportHandlerConfig } from './export-handler.js';

export { DataExportHandler, createDataExportHandler } from './export-handler.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DELETION STORE & HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export { DeletionRequestStore, createDeletionRequestStore } from './deletion-store.js';

export type {
  DataDeleters,
  IArchiveStorage,
  DataDeletionHandlerConfig,
} from './deletion-handler.js';

export { DataDeletionHandler, createDataDeletionHandler } from './deletion-handler.js';
