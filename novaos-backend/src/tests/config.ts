// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION — Test Runner Setup and Scripts
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * NovaOS Test Suite Configuration
 * 
 * Test Types:
 * - Unit Tests: Fast, isolated, mock dependencies
 * - Integration Tests: Test modules together
 * - E2E Tests: Full user journey testing
 * - Load Tests: Performance and scalability
 * - Chaos Tests: Resilience and failure scenarios
 * - Benchmark Tests: Performance measurements
 * 
 * Running Tests:
 * 
 * # All unit tests
 * npm test
 * 
 * # Specific test file
 * npm test -- --run src/tests/sdk.test.ts
 * 
 * # E2E tests (requires running server)
 * E2E_BASE_URL=http://localhost:3000 npm test -- --run src/tests/e2e/
 * 
 * # Load tests with k6
 * k6 run src/tests/load/k6-load-test.js
 * 
 * # Benchmarks
 * BENCHMARK_BASE_URL=http://localhost:3000 npm test -- --run src/tests/load/benchmarks.test.ts
 * 
 * # Chaos tests
 * CHAOS_BASE_URL=http://localhost:3000 npm test -- --run src/tests/load/chaos.test.ts
 */

// ─────────────────────────────────────────────────────────────────────────────────
// TEST CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────────

export const TEST_CATEGORIES = {
  unit: {
    pattern: 'src/tests/*.test.ts',
    description: 'Unit tests for individual modules',
    requiresServer: false,
    timeout: 10000,
  },
  integration: {
    pattern: 'src/tests/integration/*.test.ts',
    description: 'Integration tests for module interactions',
    requiresServer: false,
    timeout: 30000,
  },
  e2e: {
    pattern: 'src/tests/e2e/*.test.ts',
    description: 'End-to-end user journey tests',
    requiresServer: true,
    timeout: 60000,
  },
  load: {
    pattern: 'src/tests/load/k6-load-test.js',
    description: 'k6 load testing scenarios',
    requiresServer: true,
    runner: 'k6',
  },
  benchmark: {
    pattern: 'src/tests/load/benchmarks.test.ts',
    description: 'Performance benchmark tests',
    requiresServer: true,
    timeout: 120000,
  },
  chaos: {
    pattern: 'src/tests/load/chaos.test.ts',
    description: 'Chaos and resilience tests',
    requiresServer: true,
    timeout: 60000,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES
// ─────────────────────────────────────────────────────────────────────────────────

export const TEST_ENV_VARS = {
  // Server URL for E2E tests
  E2E_BASE_URL: 'http://localhost:3000',
  
  // Server URL for benchmark tests
  BENCHMARK_BASE_URL: 'http://localhost:3000',
  
  // Server URL for chaos tests
  CHAOS_BASE_URL: 'http://localhost:3000',
  
  // k6 configuration
  K6_BASE_URL: 'http://localhost:3000',
  K6_API_KEY: '',
  
  // Test timeouts
  TEST_TIMEOUT_UNIT: '10000',
  TEST_TIMEOUT_E2E: '60000',
  TEST_TIMEOUT_LOAD: '300000',
};

// ─────────────────────────────────────────────────────────────────────────────────
// THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────────

export const PERFORMANCE_THRESHOLDS = {
  // Response time thresholds (ms)
  latency: {
    health: { p95: 50, p99: 100 },
    auth: { p95: 100, p99: 200 },
    chat: { p95: 3000, p99: 5000 },
    goals: { p95: 200, p99: 500 },
    memories: { p95: 150, p99: 300 },
    search: { p95: 500, p99: 1000 },
  },
  
  // Error rate thresholds
  errorRates: {
    unit: 0, // No failures allowed
    e2e: 0.01, // 1% allowed
    load: 0.05, // 5% allowed
    chaos: 0.20, // 20% allowed (chaos is expected to cause some failures)
  },
  
  // Throughput minimums (requests per second)
  throughput: {
    health: 1000,
    auth: 100,
    chat: 10,
    goals: 200,
    memories: 200,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// TEST DATA GENERATORS
// ─────────────────────────────────────────────────────────────────────────────────

export const TEST_DATA = {
  users: {
    free: { email: 'test-free@example.com', tier: 'free' as const },
    pro: { email: 'test-pro@example.com', tier: 'pro' as const },
    enterprise: { email: 'test-enterprise@example.com', tier: 'enterprise' as const },
  },
  
  messages: [
    'Hello, how can you help me today?',
    'I need to plan my week',
    'What are my current goals?',
    'Help me break down this task',
    'Remind me about my priorities',
  ],
  
  goals: [
    {
      title: 'Learn TypeScript',
      description: 'Master TypeScript for better code quality',
      desiredOutcome: 'Write type-safe code confidently',
      interestLevel: 'career_capital' as const,
    },
    {
      title: 'Exercise regularly',
      description: 'Build a consistent workout routine',
      desiredOutcome: 'Exercise 3x per week',
      interestLevel: 'physical_safety' as const,
    },
    {
      title: 'Save for retirement',
      description: 'Build long-term financial security',
      desiredOutcome: 'Max out 401k contributions',
      interestLevel: 'financial_stability' as const,
    },
  ],
  
  memories: [
    { category: 'fact' as const, key: 'name', value: 'Test User' },
    { category: 'preference' as const, key: 'language', value: 'TypeScript' },
    { category: 'interest' as const, key: 'hobby', value: 'Reading' },
    { category: 'skill' as const, key: 'expertise', value: 'Backend development' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export default {
  categories: TEST_CATEGORIES,
  envVars: TEST_ENV_VARS,
  thresholds: PERFORMANCE_THRESHOLDS,
  testData: TEST_DATA,
};
