// ═══════════════════════════════════════════════════════════════════════════════
// RETENTION MODULE — Barrel Exports
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Branded types
  RetentionJobId,
  
  // Categories
  RetentionCategory,
  RetentionAction,
  RetentionJobStatus,
  
  // Policy types
  RetentionPolicy,
  
  // Job types
  RetentionJob,
  RetentionJobResults,
  CategoryJobResult,
  
  // Enforcement types
  RetentionCandidate,
  RetentionEnforcerConfig,
  
  // Service interface
  IRetentionEnforcer,
} from './types.js';

export {
  // Constants
  ALL_RETENTION_CATEGORIES,
  DEFAULT_RETENTION_POLICIES,
  DEFAULT_ENFORCER_CONFIG,
  
  // Error codes (exported as value, not type - it's an enum)
  RetentionErrorCode,
  
  // Factory functions
  createRetentionJobId,
  getDefaultPolicy,
  calculateExpirationDate,
  isPastRetention,
  daysPastRetention,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// POLICY MANAGER
// ─────────────────────────────────────────────────────────────────────────────────

export type { RetentionPolicySummary } from './policy-manager.js';

export { RetentionPolicyManager, createRetentionPolicyManager } from './policy-manager.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENFORCER
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  CandidateFinder,
  RetentionCandidateInfo,
  CategoryProcessor,
  CategoryRegistry,
} from './enforcer.js';

export { RetentionEnforcer, createRetentionEnforcer } from './enforcer.js';
