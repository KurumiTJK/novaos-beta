// ═══════════════════════════════════════════════════════════════════════════════
// API KEYS MODULE — Key Management and Quota Tracking
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Types
  type ApiService,
  type KeyStatus,
  type QuotaPeriod,
  type ApiKeyConfig,
  type KeySelection,
  type ApiKeyErrorCode,
  type ApiKeyError,
  type KeyUsageReport,
  type ServiceUsageSummary,
  
  // Manager class
  ApiKeyManager,
  
  // Singleton
  getApiKeyManager,
  initApiKeyManager,
  resetApiKeyManager,
  
  // Convenience functions
  getApiKey,
  recordApiKeyUsage,
  markApiKeyRateLimited,
} from './manager.js';
