// ═══════════════════════════════════════════════════════════════════════════════
// TEST SETUP — Global Test Configuration
// NovaOS Phase 17 — Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// GLOBAL SETUP
// ─────────────────────────────────────────────────────────────────────────────────

beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Disable console logs during tests (optional)
  // vi.spyOn(console, 'log').mockImplementation(() => {});
  // vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
  // Cleanup
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────────
// PER-TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
  
  // Reset timers if using fake timers
  // vi.useRealTimers();
});

afterEach(() => {
  // Cleanup after each test
});

// ─────────────────────────────────────────────────────────────────────────────────
// GLOBAL TEST UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Create a deferred promise for testing async flows
 */
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock function that resolves after a delay
 */
export function createDelayedMock<T>(value: T, delayMs: number) {
  return vi.fn(async () => {
    await sleep(delayMs);
    return value;
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSERTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Assert that a promise rejects with a specific error code
 */
export async function expectError(
  promise: Promise<unknown>,
  expectedCode: string
): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected promise to reject with ${expectedCode}`);
  } catch (error: any) {
    if (error.code !== expectedCode) {
      throw new Error(`Expected error code ${expectedCode}, got ${error.code}`);
    }
  }
}

/**
 * Assert that a value is within a range
 */
export function expectInRange(value: number, min: number, max: number): void {
  if (value < min || value > max) {
    throw new Error(`Expected ${value} to be between ${min} and ${max}`);
  }
}
