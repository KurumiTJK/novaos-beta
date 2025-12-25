// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG MODULE — Barrel Exports
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Categories and actions
  AuditCategory,
  AuditAction,
  AuditSeverity,
  
  // Entry types
  AuditEntry,
  AuditDetails,
  AuditRequestMetadata,
  
  // Query types
  AuditQuery,
  AuditQueryResult,
  
  // Report types
  AuditReportType,
  AuditReportRequest,
  AuditReport,
  AuditReportSummary,
  
  // Store interface
  IAuditStore,
  IntegrityCheckResult,
  
  // Logger interface
  IAuditLogger,
} from './types.js';

export {
  // Error codes (exported as value, not type - it's an enum)
  AuditErrorCode,
  
  // Factory functions
  createAuditId,
  computeAuditEntryHash,
  verifyAuditEntryHash,
  getDefaultSeverity,
  getCategoryFromAction,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export { AuditStore, createAuditStore } from './audit-store.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  AuditLogger,
  createAuditLogger,
  extractRequestMetadata,
} from './audit-logger.js';
