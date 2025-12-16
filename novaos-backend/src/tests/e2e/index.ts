// ═══════════════════════════════════════════════════════════════════════════════
// E2E MODULE INDEX — End-to-End Testing Exports
// ═══════════════════════════════════════════════════════════════════════════════

// Utilities
export {
  // Test context
  createTestContext,
  type TestContext,
  
  // HTTP client
  request,
  createAuthenticatedClient,
  type RequestOptions,
  type TestResponse,
  
  // User management
  createTestUser,
  createTestUsers,
  type TestUser,
  
  // Assertions
  assertStatus,
  assertLatency,
  assertProperty,
  
  // Timing
  wait,
  waitUntil,
  measure,
  
  // Data generators
  randomString,
  randomEmail,
  sampleGoal,
  sampleMemory,
  
  // Metrics
  createMetricsCollector,
  type TestMetrics,
  
  // Server management
  startTestServer,
  stopTestServer,
} from './utils.js';

// Re-export test configuration
export { TEST_CATEGORIES, TEST_ENV_VARS, PERFORMANCE_THRESHOLDS, TEST_DATA } from '../config.js';
