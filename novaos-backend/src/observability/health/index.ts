// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH MODULE INDEX — Health Check Exports
// NovaOS Observability
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Status types
  type ComponentStatus,
  type SystemStatus,
  type ReadinessStatus,
  type LivenessStatus,
  
  // Health result types
  type ComponentHealth,
  type ComponentHealthResult,
  type HealthCheckResponse,
  type ReadinessResponse,
  type LivenessResponse,
  type StatusResponse,
  
  // Configuration types
  type HealthCheckFn,
  type HealthCheckRegistration,
  type HealthCheckOptions,
  type DependencyType,
  type DependencyConfig,
  
  // Constants
  HEALTH_THRESHOLDS,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CHECK IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Helper functions
  healthy,
  degraded,
  unhealthy,
  withTimeout,
  
  // Core checks
  checkMemory,
  checkEventLoop,
  checkDiskSpace,
  checkSelf,
  
  // Check factories
  createRedisHealthCheck,
  createLLMHealthCheck,
  createExternalAPIHealthCheck,
  type RedisHealthCheckOptions,
  type LLMHealthCheckOptions,
  type ExternalAPIHealthCheckOptions,
  
  // Utilities
  runChecks,
  determineOverallStatus,
} from './checks.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Registry
  registerDependency,
  unregisterDependency,
  getDependencyChecks,
  clearDependencyChecks,
  
  // Redis
  type RedisStoreInterface,
  configureRedisHealth,
  getRedisHealthCheck,
  
  // LLM
  type LLMProviderConfig,
  registerLLMProvider,
  configureOpenAIHealth,
  configureGeminiHealth,
  checkLLMProviders,
  
  // External APIs
  type ExternalAPIConfig,
  registerExternalAPI,
  configureFinnhubHealth,
  configureWeatherHealth,
  configureCoinGeckoHealth,
  checkExternalAPIs,
  
  // Initialize
  type DependencyHealthConfig,
  initializeDependencyHealth,
  checkAllDependencies,
} from './dependencies.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Configuration
  type HealthEndpointConfig,
  configureHealthEndpoints,
  
  // Router
  createHealthRouter,
  healthHandlers,
  
  // Programmatic
  checkHealth,
  isReady,
  isHealthy,
} from './endpoint.js';
