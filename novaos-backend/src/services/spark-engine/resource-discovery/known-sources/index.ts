// ═══════════════════════════════════════════════════════════════════════════════
// KNOWN SOURCES MODULE — Pre-Verified Source Registry
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type IntegrityErrorCode,
  type IntegrityError,
  type SignedEnvelope,
  type IntegrityConfig,
  
  // Key management
  generateKey,
  
  // Signature operations
  computeSignature,
  verifySignature,
  verifySignatureWithRotation,
  
  // Envelope operations
  signData,
  verifyEnvelope,
  serializeEnvelope,
  deserializeEnvelope,
  
  // Convenience
  quickSign,
  quickVerify,
  hashForLogging,
} from './integrity.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type AuthorityLevel,
  type HealthStatus,
  type KnownSource,
  type SignedKnownSource,
  type KnownSourceMatch,
  type KnownSourceErrorCode,
  type KnownSourceError,
  
  // Registry class
  KnownSourcesRegistry,
  
  // Singleton
  getKnownSourcesRegistry,
  initKnownSourcesRegistry,
  resetKnownSourcesRegistry,
} from './registry.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type HealthCheckResult,
  type HealthCheckerConfig,
  DEFAULT_HEALTH_CHECKER_CONFIG,
  
  // Health checker class
  HealthChecker,
  
  // Singleton
  getHealthChecker,
  createHealthChecker,
  resetHealthChecker,
  
  // Convenience
  startHealthChecking,
  stopHealthChecking,
} from './health-check.js';
