// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE TESTS — Provider Router
// NovaOS Pipeline — Gate 5 of 8
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeCapabilityGate,
  executeCapabilityGateAsync,
} from '../../../gates/capability_gate/capability-gate.js';
import type { CapabilityGateOutput, ProviderName } from '../../../gates/capability_gate/types.js';
import type { PipelineState, PipelineContext, IntentSummary } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_INTENT: IntentSummary = {
  primary_route: 'SAY',
  stance: 'LENS',
  safety_signal: 'none',
  urgency: 'low',
  live_data: false,
  external_tool: false,
  learning_intent: false,
};

function createMockState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    userMessage: 'Hello, how are you?',
    normalizedInput: 'hello, how are you?',
    gateResults: {},
    flags: {},
    timestamps: {
      pipelineStart: Date.now(),
    },
    ...overrides,
  };
}

function createMockContext(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    requestId: 'req_test_123',
    userId: 'user_123',
    sessionId: 'session_123',
    conversationHistory: [],
    ...overrides,
  };
}

function createIntentSummary(overrides: Partial<IntentSummary> = {}): IntentSummary {
  return {
    ...DEFAULT_INTENT,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Capability Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SYNC GATE TESTS (executeCapabilityGate)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeCapabilityGate (sync)', () => {
    describe('basic functionality', () => {
      it('should return correct gate metadata on success', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.gateId).toBe('capability');
        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should include execution time', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(typeof result.executionTimeMs).toBe('number');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // PROVIDER ROUTING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('provider routing', () => {
      it('should route to gemini_grounded when live_data is true', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.status).toBe('pass');
        expect(result.output.provider).toBe('gemini_grounded');
      });

      it('should route to openai when live_data is false', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: false,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.status).toBe('pass');
        expect(result.output.provider).toBe('openai');
      });

      it('should prioritize gemini_grounded over openai when live_data is true', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        // Gemini has priority 10, OpenAI has priority 0
        expect(result.output.provider).toBe('gemini_grounded');
      });

      it('should use openai as fallback (always matches)', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: false,
            external_tool: false,
            learning_intent: false,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.provider).toBe('openai');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // GEMINI GROUNDED PROVIDER CONFIG
    // ─────────────────────────────────────────────────────────────────────────────

    describe('gemini_grounded provider config', () => {
      it('should return correct model for gemini_grounded', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.model).toBe('gemini-2.5-pro');
      });

      it('should include googleSearch tool for gemini_grounded', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.tools).toBeDefined();
        expect(result.output.config.tools).toContainEqual({ googleSearch: {} });
      });

      it('should set temperature to 0.7 for gemini_grounded', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.temperature).toBe(0.7);
      });

      it('should set maxTokens to 2048 for gemini_grounded', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.maxTokens).toBe(2048);
      });

      it('should include topic in config for gemini_grounded', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: true,
            topic: 'cryptocurrency',
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.topic).toBe('cryptocurrency');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OPENAI PROVIDER CONFIG
    // ─────────────────────────────────────────────────────────────────────────────

    describe('openai provider config', () => {
      it('should return correct model for openai', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: false,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.model).toBe('gpt-5.2');
      });

      it('should set temperature to 0.7 for openai', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: false,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.temperature).toBe(0.7);
      });

      it('should set maxTokens to 2048 for openai', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: false,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.maxTokens).toBe(2048);
      });

      it('should include topic in config for openai', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: false,
            topic: 'programming',
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.topic).toBe('programming');
      });

      it('should not include tools for openai', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data: false,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config.tools).toBeUndefined();
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ERROR HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('error handling', () => {
      it('should return hard_fail when intent_summary is undefined', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.action).toBe('stop');
        expect(result.failureReason).toBe('Missing intent_summary');
      });

      it('should return hard_fail when intent_summary is null', () => {
        const state = createMockState({
          intent_summary: null as unknown as IntentSummary,
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.action).toBe('stop');
      });

      it('should include execution time on error', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OUTPUT STRUCTURE
    // ─────────────────────────────────────────────────────────────────────────────

    describe('output structure', () => {
      it('should return all required output fields', () => {
        const state = createMockState({
          intent_summary: createIntentSummary(),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output).toHaveProperty('provider');
        expect(result.output).toHaveProperty('config');
      });

      it('should return config with required fields', () => {
        const state = createMockState({
          intent_summary: createIntentSummary(),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.config).toHaveProperty('provider');
        expect(result.output.config).toHaveProperty('model');
      });

      it('should return correct types for output fields', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(typeof result.output.provider).toBe('string');
        expect(typeof result.output.config).toBe('object');
        expect(typeof result.output.config.model).toBe('string');
      });

      it('should have matching provider in output and config', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({ live_data: true }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.provider).toBe(result.output.config.provider);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // GATE BEHAVIOR
    // ─────────────────────────────────────────────────────────────────────────────

    describe('gate behavior', () => {
      it('should not modify state', () => {
        const originalIntent = createIntentSummary({ live_data: true });
        const state = createMockState({ intent_summary: originalIntent });
        const context = createMockContext();

        executeCapabilityGate(state, context);

        expect(state.intent_summary).toBe(originalIntent);
        expect(state.intent_summary?.live_data).toBe(true);
      });

      it('should pass or fail based on intent availability', () => {
        // With intent - should pass
        const stateWithIntent = createMockState({
          intent_summary: createIntentSummary(),
        });
        const resultWithIntent = executeCapabilityGate(stateWithIntent, createMockContext());
        expect(resultWithIntent.status).toBe('pass');

        // Without intent - should fail
        const stateWithoutIntent = createMockState({ intent_summary: undefined });
        const resultWithoutIntent = executeCapabilityGate(stateWithoutIntent, createMockContext());
        expect(resultWithoutIntent.status).toBe('hard_fail');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASYNC GATE TESTS (executeCapabilityGateAsync)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeCapabilityGateAsync', () => {
    it('should return same result as sync version', () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          live_data: true,
        }),
      });
      const context = createMockContext();

      const syncResult = executeCapabilityGate(state, context);
      const asyncResult = executeCapabilityGateAsync(state, context);

      // Note: executeCapabilityGateAsync is actually sync (aliased to sync version)
      expect(asyncResult.gateId).toBe(syncResult.gateId);
      expect(asyncResult.status).toBe(syncResult.status);
      expect(asyncResult.output.provider).toBe(syncResult.output.provider);
    });

    it('should route to gemini_grounded when live_data is true', () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          live_data: true,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGateAsync(state, context);

      expect(result.output.provider).toBe('gemini_grounded');
    });

    it('should route to openai when live_data is false', () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          live_data: false,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGateAsync(state, context);

      expect(result.output.provider).toBe('openai');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // LIVE DATA SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('live data scenarios', () => {
    it('should route stock price queries to gemini_grounded', () => {
      const state = createMockState({
        userMessage: 'What is the current price of NVDA?',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          live_data: true,
          topic: 'stocks',
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('gemini_grounded');
      expect(result.output.config.topic).toBe('stocks');
    });

    it('should route weather queries to gemini_grounded', () => {
      const state = createMockState({
        userMessage: "What's the weather in SF right now?",
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          live_data: true,
          topic: 'weather',
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('gemini_grounded');
    });

    it('should route cryptocurrency queries to gemini_grounded', () => {
      const state = createMockState({
        userMessage: 'What is the current price of Bitcoin?',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          live_data: true,
          topic: 'cryptocurrency',
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('gemini_grounded');
    });

    it('should route current events queries to gemini_grounded', () => {
      const state = createMockState({
        userMessage: 'Who is the current CEO of OpenAI?',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          live_data: true,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('gemini_grounded');
    });

    it('should route currency conversion to gemini_grounded', () => {
      const state = createMockState({
        userMessage: 'Convert 100 USD to EUR',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          live_data: true,
          topic: 'forex',
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('gemini_grounded');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NON-LIVE DATA SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('non-live data scenarios', () => {
    it('should route general knowledge to openai', () => {
      const state = createMockState({
        userMessage: 'Explain what a hash is',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          live_data: false,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('openai');
    });

    it('should route math questions to openai', () => {
      const state = createMockState({
        userMessage: 'What is 17*23',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          live_data: false,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('openai');
    });

    it('should route creative writing to openai', () => {
      const state = createMockState({
        userMessage: 'Write a poem about autumn',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          live_data: false,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('openai');
    });

    it('should route code fixes to openai', () => {
      const state = createMockState({
        userMessage: 'Fix this code snippet',
        intent_summary: createIntentSummary({
          primary_route: 'FIX',
          live_data: false,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('openai');
    });

    it('should route greetings to openai', () => {
      const state = createMockState({
        userMessage: 'Hi',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          live_data: false,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('openai');
    });

    it('should route learning requests to openai', () => {
      const state = createMockState({
        userMessage: 'I want to learn Python',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          stance: 'SWORD',
          learning_intent: true,
          live_data: false,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('openai');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // INDEPENDENCE FROM OTHER INTENT FIELDS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('provider selection independence', () => {
    it('should select provider based only on live_data, ignoring stance', () => {
      const stances = ['LENS', 'SWORD', 'SHIELD'] as const;

      for (const stance of stances) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance,
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.provider).toBe('gemini_grounded');
      }
    });

    it('should select provider based only on live_data, ignoring primary_route', () => {
      const routes = ['SAY', 'MAKE', 'FIX', 'DO'] as const;

      for (const primary_route of routes) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            primary_route,
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.provider).toBe('gemini_grounded');
      }
    });

    it('should select provider based only on live_data, ignoring safety_signal', () => {
      const signals = ['none', 'low', 'medium', 'high'] as const;

      for (const safety_signal of signals) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal,
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.provider).toBe('gemini_grounded');
      }
    });

    it('should select provider based only on live_data, ignoring external_tool', () => {
      for (const external_tool of [true, false]) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            external_tool,
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.provider).toBe('gemini_grounded');
      }
    });

    it('should select provider based only on live_data, ignoring learning_intent', () => {
      for (const learning_intent of [true, false]) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            learning_intent,
            live_data: true,
          }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.provider).toBe('gemini_grounded');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty userMessage', () => {
      const state = createMockState({
        userMessage: '',
        intent_summary: createIntentSummary({ live_data: true }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.provider).toBe('gemini_grounded');
    });

    it('should handle very long userMessage', () => {
      const longMessage = 'What is the price of '.repeat(500) + 'Bitcoin?';
      const state = createMockState({
        userMessage: longMessage,
        intent_summary: createIntentSummary({ live_data: true }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle missing context fields gracefully', () => {
      const state = createMockState({ intent_summary: createIntentSummary() });
      const context: PipelineContext = {};

      const result = executeCapabilityGate(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle undefined topic', () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          live_data: true,
          topic: undefined,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.config.topic).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PROVIDER PRIORITY
  // ─────────────────────────────────────────────────────────────────────────────

  describe('provider priority', () => {
    it('should select gemini_grounded (priority 10) over openai (priority 0) when live_data is true', () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          live_data: true,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      // Gemini should win due to higher priority
      expect(result.output.provider).toBe('gemini_grounded');
    });

    it('should fall back to openai when no higher-priority provider matches', () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          live_data: false,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('openai');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ROUTING DECISION MATRIX
  // ─────────────────────────────────────────────────────────────────────────────

  describe('routing decision matrix', () => {
    const testCases: Array<{
      live_data: boolean;
      expectedProvider: ProviderName;
    }> = [
      { live_data: true, expectedProvider: 'gemini_grounded' },
      { live_data: false, expectedProvider: 'openai' },
    ];

    for (const { live_data, expectedProvider } of testCases) {
      it(`should route to '${expectedProvider}' when live_data=${live_data}`, () => {
        const state = createMockState({
          intent_summary: createIntentSummary({ live_data }),
        });
        const context = createMockContext();

        const result = executeCapabilityGate(state, context);

        expect(result.output.provider).toBe(expectedProvider);
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTITUTIONAL ALIGNMENT (LENS = Clarity)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('constitutional alignment', () => {
    it('should use grounded search for freshness-sensitive queries (Constitution 5.2)', () => {
      // Per Constitution Section 5.2: Freshness - verify or disclose uncertainty
      const state = createMockState({
        userMessage: 'What is the current stock price of AAPL?',
        intent_summary: createIntentSummary({
          live_data: true,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('gemini_grounded');
      expect(result.output.config.tools).toContainEqual({ googleSearch: {} });
    });

    it('should not require grounding for timeless knowledge (Constitution 5.1)', () => {
      // Per Constitution Section 5.1: Accuracy - don't fabricate
      const state = createMockState({
        userMessage: 'What are the benefits of meditation?',
        intent_summary: createIntentSummary({
          live_data: false,
        }),
      });
      const context = createMockContext();

      const result = executeCapabilityGate(state, context);

      expect(result.output.provider).toBe('openai');
    });
  });
});
