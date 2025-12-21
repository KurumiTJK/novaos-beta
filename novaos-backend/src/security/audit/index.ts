// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT MODULE INDEX — Security Audit Exports
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Types
  type AuditSeverity,
  type AuditCategory,
  type AuditEvent,
  type CreateAuditEventOptions,
  // Store
  SecurityAuditStore,
  // Logger
  SecurityAuditLogger,
  getSecurityAuditLogger,
  initSecurityAuditLogger,
  resetSecurityAuditLogger,
  wireSecurityAuditLogger,
} from './logger.js';
