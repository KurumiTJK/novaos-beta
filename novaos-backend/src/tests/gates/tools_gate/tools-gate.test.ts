// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS GATE TESTS — Router to External Tools Engine
// NovaOS Pipeline — Gate 3 of 8
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeToolsGate,
  executeToolsGateAsync,
} from '../../../gates/tools_gate/tools-gate.js';
import type { ToolsGateOutput } from '../../../gates/tools_gate/types.js';
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

describe('Tools Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SYNC GATE TESTS (executeToolsGate)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeToolsGate (sync)', () => {
    describe('basic functionality', () => {
      it('should return correct gate metadata', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.gateId).toBe('tools');
        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should include execution time', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(typeof result.executionTimeMs).toBe('number');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ROUTING LOGIC
    // ─────────────────────────────────────────────────────────────────────────────

    describe('routing logic', () => {
      it('should route to tools when external_tool is true', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
        expect(result.output.external_tool).toBe(true);
      });

      it('should skip when external_tool is false', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            external_tool: false,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('skip');
        expect(result.output.external_tool).toBe(false);
      });

      it('should route to tools for DO primary_route with external_tool', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            primary_route: 'DO',
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      });

      it('should skip for DO primary_route without external_tool', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            primary_route: 'DO',
            external_tool: false,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('skip');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // EXTERNAL TOOL FLAG HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('external_tool flag handling', () => {
      it('should preserve external_tool=true in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.external_tool).toBe(true);
      });

      it('should preserve external_tool=false in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            external_tool: false,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.external_tool).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // DEFAULT VALUE HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('default value handling', () => {
      it('should use default external_tool (false) when intent_summary is undefined', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.external_tool).toBe(false);
        expect(result.output.route).toBe('skip');
      });

      it('should handle partial intent_summary gracefully', () => {
        const state = createMockState({
          intent_summary: {
            primary_route: 'SAY',
            stance: 'LENS',
            // Missing external_tool and other fields
          } as IntentSummary,
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        // Should use default (false) for missing external_tool
        expect(result.output.external_tool).toBe(false);
        expect(result.output.route).toBe('skip');
      });

      it('should handle null intent_summary gracefully', () => {
        const state = createMockState({
          intent_summary: null as unknown as IntentSummary,
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.external_tool).toBe(false);
        expect(result.output.route).toBe('skip');
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

        const result = executeToolsGate(state, context);

        expect(result.output).toHaveProperty('route');
        expect(result.output).toHaveProperty('external_tool');
      });

      it('should return correct types for all output fields', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(typeof result.output.route).toBe('string');
        expect(typeof result.output.external_tool).toBe('boolean');
      });

      it('should only have route values of "tools" or "skip"', () => {
        // Test with external_tool=true
        const stateTrue = createMockState({
          intent_summary: createIntentSummary({ external_tool: true }),
        });
        const resultTrue = executeToolsGate(stateTrue, createMockContext());
        expect(['tools', 'skip']).toContain(resultTrue.output.route);

        // Test with external_tool=false
        const stateFalse = createMockState({
          intent_summary: createIntentSummary({ external_tool: false }),
        });
        const resultFalse = executeToolsGate(stateFalse, createMockContext());
        expect(['tools', 'skip']).toContain(resultFalse.output.route);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // GATE BEHAVIOR
    // ─────────────────────────────────────────────────────────────────────────────

    describe('gate behavior', () => {
      it('should always pass (router only, no blocking)', () => {
        const scenarios = [
          { external_tool: true },
          { external_tool: false },
        ];

        for (const scenario of scenarios) {
          const state = createMockState({
            intent_summary: createIntentSummary(scenario),
          });
          const context = createMockContext();

          const result = executeToolsGate(state, context);

          expect(result.status).toBe('pass');
          expect(result.action).toBe('continue');
        }
      });

      it('should not modify state', () => {
        const originalIntent = createIntentSummary({ external_tool: true });
        const state = createMockState({ intent_summary: originalIntent });
        const context = createMockContext();

        executeToolsGate(state, context);

        expect(state.intent_summary).toBe(originalIntent);
        expect(state.intent_summary?.external_tool).toBe(true);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASYNC GATE TESTS (executeToolsGateAsync)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeToolsGateAsync', () => {
    it('should return same result as sync version', async () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          external_tool: true,
        }),
      });
      const context = createMockContext();

      const syncResult = executeToolsGate(state, context);
      const asyncResult = await executeToolsGateAsync(state, context);

      expect(asyncResult.gateId).toBe(syncResult.gateId);
      expect(asyncResult.status).toBe(syncResult.status);
      expect(asyncResult.action).toBe(syncResult.action);
      expect(asyncResult.output.route).toBe(syncResult.output.route);
      expect(asyncResult.output.external_tool).toBe(syncResult.output.external_tool);
    });

    it('should return a Promise', () => {
      const state = createMockState({ intent_summary: createIntentSummary() });
      const context = createMockContext();

      const result = executeToolsGateAsync(state, context);

      expect(result).toBeInstanceOf(Promise);
    });

    it('should route to tools when external_tool is true', async () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          external_tool: true,
        }),
      });
      const context = createMockContext();

      const result = await executeToolsGateAsync(state, context);

      expect(result.output.route).toBe('tools');
      expect(result.output.external_tool).toBe(true);
    });

    it('should skip when external_tool is false', async () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          external_tool: false,
        }),
      });
      const context = createMockContext();

      const result = await executeToolsGateAsync(state, context);

      expect(result.output.route).toBe('skip');
      expect(result.output.external_tool).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EXTERNAL TOOL SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('external tool scenarios', () => {
    describe('calendar integration', () => {
      it('should route calendar check requests to tools', () => {
        const state = createMockState({
          userMessage: 'Check my calendar for tomorrow',
          intent_summary: createIntentSummary({
            primary_route: 'DO',
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      });

      it('should route calendar event creation to tools', () => {
        const state = createMockState({
          userMessage: 'Schedule a meeting for Friday at 2pm',
          intent_summary: createIntentSummary({
            primary_route: 'DO',
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      });
    });

    describe('email integration', () => {
      it('should route email search requests to tools', () => {
        const state = createMockState({
          userMessage: 'Check my Gmail for invoices',
          intent_summary: createIntentSummary({
            primary_route: 'DO',
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      });

      it('should route email sending requests to tools', () => {
        const state = createMockState({
          userMessage: 'Send an email to John',
          intent_summary: createIntentSummary({
            primary_route: 'DO',
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      });
    });

    describe('file search integration', () => {
      it('should route file search requests to tools', () => {
        const state = createMockState({
          userMessage: 'Find the quarterly report in my Drive',
          intent_summary: createIntentSummary({
            primary_route: 'DO',
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      });
    });

    describe('image generation integration', () => {
      it('should route image generation requests to tools', () => {
        const state = createMockState({
          userMessage: 'Generate an image of a sunset',
          intent_summary: createIntentSummary({
            primary_route: 'MAKE',
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NON-TOOL SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('non-tool scenarios', () => {
    it('should skip for simple questions', () => {
      const state = createMockState({
        userMessage: 'What is the capital of France?',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          external_tool: false,
        }),
      });
      const context = createMockContext();

      const result = executeToolsGate(state, context);

      expect(result.output.route).toBe('skip');
    });

    it('should skip for creative writing', () => {
      const state = createMockState({
        userMessage: 'Write a poem about autumn',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          external_tool: false,
        }),
      });
      const context = createMockContext();

      const result = executeToolsGate(state, context);

      expect(result.output.route).toBe('skip');
    });

    it('should skip for code fixes', () => {
      const state = createMockState({
        userMessage: 'Fix this code snippet',
        intent_summary: createIntentSummary({
          primary_route: 'FIX',
          external_tool: false,
        }),
      });
      const context = createMockContext();

      const result = executeToolsGate(state, context);

      expect(result.output.route).toBe('skip');
    });

    it('should skip for learning requests', () => {
      const state = createMockState({
        userMessage: 'I want to learn Python',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          stance: 'SWORD',
          learning_intent: true,
          external_tool: false,
        }),
      });
      const context = createMockContext();

      const result = executeToolsGate(state, context);

      expect(result.output.route).toBe('skip');
    });

    it('should skip for greetings', () => {
      const state = createMockState({
        userMessage: 'Hi',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          external_tool: false,
        }),
      });
      const context = createMockContext();

      const result = executeToolsGate(state, context);

      expect(result.output.route).toBe('skip');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // INDEPENDENCE FROM OTHER INTENT FIELDS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('independence from other intent fields', () => {
    it('should route based only on external_tool, ignoring stance', () => {
      const stances = ['LENS', 'SWORD', 'SHIELD'] as const;

      for (const stance of stances) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance,
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      }
    });

    it('should route based only on external_tool, ignoring primary_route', () => {
      const routes = ['SAY', 'MAKE', 'FIX', 'DO'] as const;

      for (const primary_route of routes) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            primary_route,
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      }
    });

    it('should route based only on external_tool, ignoring safety_signal', () => {
      const signals = ['none', 'low', 'medium', 'high'] as const;

      for (const safety_signal of signals) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal,
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      }
    });

    it('should route based only on external_tool, ignoring live_data', () => {
      for (const live_data of [true, false]) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            live_data,
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
      }
    });

    it('should route based only on external_tool, ignoring learning_intent', () => {
      for (const learning_intent of [true, false]) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            learning_intent,
            external_tool: true,
          }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe('tools');
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
        intent_summary: createIntentSummary({ external_tool: true }),
      });
      const context = createMockContext();

      const result = executeToolsGate(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.route).toBe('tools');
    });

    it('should handle very long userMessage', () => {
      const longMessage = 'Check my email for '.repeat(500);
      const state = createMockState({
        userMessage: longMessage,
        intent_summary: createIntentSummary({ external_tool: true }),
      });
      const context = createMockContext();

      const result = executeToolsGate(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.route).toBe('tools');
    });

    it('should handle missing context fields gracefully', () => {
      const state = createMockState({ intent_summary: createIntentSummary() });
      const context: PipelineContext = {};

      const result = executeToolsGate(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle context parameter being ignored', () => {
      const state = createMockState({
        intent_summary: createIntentSummary({ external_tool: true }),
      });
      // Context with various fields should not affect routing
      const context = createMockContext({
        requestId: 'different_request',
        userId: 'different_user',
        conversationHistory: [
          { role: 'user', content: 'previous message' },
        ],
      });

      const result = executeToolsGate(state, context);

      expect(result.output.route).toBe('tools');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ROUTING DECISION MATRIX
  // ─────────────────────────────────────────────────────────────────────────────

  describe('routing decision matrix', () => {
    const testCases: Array<{
      external_tool: boolean;
      expectedRoute: 'tools' | 'skip';
    }> = [
      { external_tool: true, expectedRoute: 'tools' },
      { external_tool: false, expectedRoute: 'skip' },
    ];

    for (const { external_tool, expectedRoute } of testCases) {
      it(`should route to '${expectedRoute}' when external_tool=${external_tool}`, () => {
        const state = createMockState({
          intent_summary: createIntentSummary({ external_tool }),
        });
        const context = createMockContext();

        const result = executeToolsGate(state, context);

        expect(result.output.route).toBe(expectedRoute);
        expect(result.output.external_tool).toBe(external_tool);
      });
    }
  });
});
