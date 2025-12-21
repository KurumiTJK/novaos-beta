// ═══════════════════════════════════════════════════════════════════════════════
// ENCRYPTION MODULE INDEX — Encryption Exports
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Types
  type EncryptionKey,
  type EncryptedEnvelope,
  type SerializedEnvelope,
  type KeyDerivationOptions,
  type EncryptionOptions,
  type DecryptionOptions,
  // Key Manager
  KeyManager,
  // Encryption Service
  EncryptionService,
  getEncryptionService,
  initEncryptionService,
  resetEncryptionService,
  // Convenience functions
  encrypt,
  decrypt,
  generateKeyBase64,
  hashForLogging,
} from './service.js';
