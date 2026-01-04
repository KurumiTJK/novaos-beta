// ═══════════════════════════════════════════════════════════════════════════════
// TEST SETUP — Global Test Configuration
// NovaOS Pipeline Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// GLOBAL MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

// Mock console methods to reduce noise during tests
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Clear mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES
// ─────────────────────────────────────────────────────────────────────────────────

// Set test environment
process.env.NODE_ENV = 'test';

// ─────────────────────────────────────────────────────────────────────────────────
// GLOBAL TEST UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

// Extend expect with custom matchers if needed
// (Currently using default vitest matchers)
