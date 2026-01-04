// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG MODULE — Unified Configuration Exports
// NovaOS Configuration System
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CORE LOADER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Main loader
  loadConfig,
  getConfig,
  isConfigLoaded,
  resetConfig,
  loadTestConfig,
  
  // Environment helpers
  getEnvironment,
  isProduction,
  isStaging,
  isDevelopment,
  isProductionLike,
  isDebugMode,
  
  // Capability checks
  canVerify,
  canFetch,
  
  // Config accessors
  getLLMConfig,
  getSwordLimits,
  
  // Types & Schemas
  type AppConfig,
  type Environment,
  AppConfigSchema,
  ServerConfigSchema,
  RedisConfigSchema,
  LLMConfigSchema,
  SwordLimitsConfigSchema,
} from './loader.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEMA TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // All config section types
  type ServerConfig,
  type RedisConfig,
  type EncryptionConfig,
  type AuthConfig,
  type RateLimitsConfig,
  type SSRFConfig,
  type LLMConfig,
  type ExternalApisConfig,
  type SwordLimitsConfig,
  type RetentionConfig,
  type VerificationConfig,
  type WebFetchConfig,
  type ObservabilityConfig,
  type CorsConfig,
  type StagingOverrides,
  
  // Validation helpers
  validateConfig,
  safeValidateConfig,
  formatConfigErrors,
  getDefaultConfig,
} from './schema.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  getDefaults,
  getDevelopmentDefaults,
  getStagingDefaults,
  getProductionDefaults,
  getDefaultLLMModel,
  getDefaultRateLimitMultiplier,
} from './defaults.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SECRETS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type SecretKey,
  type Secret,
  type SecretResult,
  type SecretProvider,
  type SecretsManagerOptions,
  type EncryptionKey,
  
  // Providers
  EnvironmentSecretProvider,
  MockSecretProvider,
  AWSSecretsManagerProvider,
  VaultSecretProvider,
  
  // Manager
  SecretsManager,
  createSecretsManager,
  initSecrets,
  getSecrets,
  isSecretsInitialized,
  resetSecrets,
  
  // Convenience functions
  getSecretValue,
  requireSecretValue,
  hasSecretValue,
  
  // Encryption helpers
  getEncryptionKey,
  getEncryptionKeys,
} from './secrets.js';
