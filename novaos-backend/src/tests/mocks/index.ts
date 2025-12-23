// ═══════════════════════════════════════════════════════════════════════════════
// MOCK EXPORTS — Central Export for All Test Mocks
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// REDIS MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  MockRedisClient,
  getMockRedis,
  resetMockRedis,
  createMockRedis,
  createSpyRedis,
} from './redis.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  MockLLMProvider,
  getMockLLM,
  resetMockLLM,
  createMockLLM,
  createSpyLLM,
  type LLMMessage,
  type ProviderRequest,
  type ProviderResponse,
  type LLMProviderAdapter,
  type MockResponseConfig,
} from './llm.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

import { createMockRedis, type MockRedisClient } from './redis.js';
import { createMockLLM, type MockLLMProvider } from './llm.js';

/**
 * Complete mock context for tests.
 */
export interface MockContext {
  readonly redis: MockRedisClient;
  readonly llm: MockLLMProvider;
}

/**
 * Create a complete mock context for a test.
 * Provides isolated instances of all mocks.
 */
export function createMockContext(): MockContext {
  return {
    redis: createMockRedis(),
    llm: createMockLLM(),
  };
}

/**
 * Reset a mock context between tests.
 */
export function resetMockContext(context: MockContext): void {
  context.redis.reset();
  context.llm.reset();
}
