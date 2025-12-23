// ═══════════════════════════════════════════════════════════════════════════════
// TEST SETUP — Global Test Configuration
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════
//
// This file runs before all tests and sets up:
//   - Environment variables for testing
//   - Global mocks (Redis, LLM)
//   - Test utilities
//   - Cleanup handlers
//
// ═══════════════════════════════════════════════════════════════════════════════

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { resetMockRedis } from './mocks/redis.js';
import { resetMockLLM } from './mocks/llm.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT SETUP
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Set up test environment variables.
 */
function setupTestEnvironment(): void {
  // Node environment
  process.env.NODE_ENV = 'test';
  
  // Disable Redis for tests (use in-memory mock)
  process.env.REDIS_DISABLED = 'true';
  
  // Use mock LLM provider
  process.env.USE_MOCK_PROVIDER = 'true';
  
  // Disable metrics collection in tests
  process.env.METRICS_DISABLED = 'true';
  
  // Disable audit logging in tests
  process.env.AUDIT_DISABLED = 'true';
  
  // Set test-specific timeouts
  process.env.LLM_TIMEOUT_MS = '5000';
  process.env.REDIS_COMMAND_TIMEOUT_MS = '1000';
  
  // JWT secret for test tokens
  process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
  process.env.JWT_ISSUER = 'novaos-test';
  process.env.JWT_AUDIENCE = 'novaos-test';
  
  // Encryption key for tests
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-xx';
  process.env.ENCRYPTION_KEY_ID = 'test-key-1';
}

// ─────────────────────────────────────────────────────────────────────────────────
// GLOBAL SETUP
// ─────────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Set up environment
  setupTestEnvironment();
  
  // Suppress console output during tests (optional)
  // Uncomment to reduce noise in test output
  // vi.spyOn(console, 'log').mockImplementation(() => {});
  // vi.spyOn(console, 'info').mockImplementation(() => {});
  // vi.spyOn(console, 'debug').mockImplementation(() => {});
  
  // Allow console.error and console.warn for debugging
});

// ─────────────────────────────────────────────────────────────────────────────────
// PER-TEST CLEANUP
// ─────────────────────────────────────────────────────────────────────────────────

afterEach(async () => {
  // Clear all mocks between tests
  vi.clearAllMocks();
  
  // Reset mock Redis state
  resetMockRedis();
  
  // Reset mock LLM state
  resetMockLLM();
});

// ─────────────────────────────────────────────────────────────────────────────────
// GLOBAL TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────────

afterAll(async () => {
  // Restore all mocks
  vi.restoreAllMocks();
  
  // Any global cleanup
});

// ─────────────────────────────────────────────────────────────────────────────────
// TEST UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Wait for a specified duration.
 * Useful for testing time-sensitive operations.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for next tick.
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create a deferred promise for testing async flows.
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve, reject };
}

/**
 * Generate a random string for unique test data.
 */
export function randomString(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Get a date string in YYYY-MM-DD format.
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

/**
 * Get today's date string in YYYY-MM-DD format.
 */
export function todayString(): string {
  return toDateString(new Date());
}

/**
 * Get a date offset from today.
 */
export function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateString(date);
}
