// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE TESTS — Router to Sword or Lens Engine
// NovaOS Pipeline — Gate 4 of 8
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeStanceGate,
  executeStanceGateAsync,
} from '../../../gates/stance_gate/stance-gate.js';
import type { StanceGateOutput, SwordRedirect } from '../../../gates/stance_gate/types.js';
import type { PipelineState, PipelineContext, IntentSummary, PrimaryRoute } from '../../../types/index.js';

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

describe('Stance Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SYNC GATE TESTS (executeStanceGate)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeStanceGate (sync)', () => {
    describe('basic functionality', () => {
      it('should return correct gate metadata', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.gateId).toBe('stance');
        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should include execution time', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(typeof result.executionTimeMs).toBe('number');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ROUTING LOGIC — The Core of Stance Gate
    // ─────────────────────────────────────────────────────────────────────────────

    describe('routing logic', () => {
      it('should route to sword when learning_intent=true AND stance=SWORD', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SWORD',
            learning_intent: true,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('sword');
      });

      it('should route to lens when learning_intent=true but stance=LENS', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'LENS',
            learning_intent: true,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('lens');
      });

      it('should route to lens when learning_intent=true but stance=SHIELD', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            learning_intent: true,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('lens');
      });

      it('should route to lens when stance=SWORD but learning_intent=false', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SWORD',
            learning_intent: false,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('lens');
      });

      it('should route to lens when both conditions are false', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'LENS',
            learning_intent: false,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('lens');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // PRIMARY_ROUTE HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('primary_route handling', () => {
      it('should preserve SAY primary_route in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            primary_route: 'SAY',
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.primary_route).toBe('SAY');
      });

      it('should preserve MAKE primary_route in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            primary_route: 'MAKE',
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.primary_route).toBe('MAKE');
      });

      it('should preserve FIX primary_route in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            primary_route: 'FIX',
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.primary_route).toBe('FIX');
      });

      it('should preserve DO primary_route in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            primary_route: 'DO',
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.primary_route).toBe('DO');
      });

      it('should preserve all primary_route values', () => {
        for (const primary_route of ['SAY', 'MAKE', 'FIX', 'DO'] as PrimaryRoute[]) {
          const state = createMockState({
            intent_summary: createIntentSummary({ primary_route }),
          });
          const context = createMockContext();

          const result = executeStanceGate(state, context);

          expect(result.output.primary_route).toBe(primary_route);
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // LEARNING_INTENT HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('learning_intent handling', () => {
      it('should preserve learning_intent=true in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            learning_intent: true,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.learning_intent).toBe(true);
      });

      it('should preserve learning_intent=false in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            learning_intent: false,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.learning_intent).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // DEFAULT VALUE HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('default value handling', () => {
      it('should use default primary_route (SAY) when intent_summary is undefined', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.primary_route).toBe('SAY');
      });

      it('should use default stance (LENS) when intent_summary is undefined', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('lens');
      });

      it('should use default learning_intent (false) when intent_summary is undefined', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.learning_intent).toBe(false);
      });

      it('should route to lens with all defaults', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('lens');
        expect(result.output.primary_route).toBe('SAY');
        expect(result.output.learning_intent).toBe(false);
      });

      it('should handle partial intent_summary gracefully', () => {
        const state = createMockState({
          intent_summary: {
            primary_route: 'MAKE',
            // Missing stance and learning_intent
          } as IntentSummary,
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.primary_route).toBe('MAKE');
        expect(result.output.route).toBe('lens'); // Default stance is LENS
        expect(result.output.learning_intent).toBe(false);
      });

      it('should handle null intent_summary gracefully', () => {
        const state = createMockState({
          intent_summary: null as unknown as IntentSummary,
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('lens');
        expect(result.output.primary_route).toBe('SAY');
        expect(result.output.learning_intent).toBe(false);
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

        const result = executeStanceGate(state, context);

        expect(result.output).toHaveProperty('route');
        expect(result.output).toHaveProperty('primary_route');
        expect(result.output).toHaveProperty('learning_intent');
      });

      it('should return correct types for all output fields', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(typeof result.output.route).toBe('string');
        expect(typeof result.output.primary_route).toBe('string');
        expect(typeof result.output.learning_intent).toBe('boolean');
      });

      it('should only have route values of "sword" or "lens"', () => {
        // Test sword route
        const stateSword = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SWORD',
            learning_intent: true,
          }),
        });
        const resultSword = executeStanceGate(stateSword, createMockContext());
        expect(['sword', 'lens']).toContain(resultSword.output.route);

        // Test lens route
        const stateLens = createMockState({
          intent_summary: createIntentSummary({
            stance: 'LENS',
            learning_intent: false,
          }),
        });
        const resultLens = executeStanceGate(stateLens, createMockContext());
        expect(['sword', 'lens']).toContain(resultLens.output.route);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // GATE BEHAVIOR
    // ─────────────────────────────────────────────────────────────────────────────

    describe('gate behavior', () => {
      it('should always pass (router only, no blocking)', () => {
        const scenarios = [
          { stance: 'SWORD' as const, learning_intent: true },
          { stance: 'SWORD' as const, learning_intent: false },
          { stance: 'LENS' as const, learning_intent: true },
          { stance: 'LENS' as const, learning_intent: false },
          { stance: 'SHIELD' as const, learning_intent: true },
          { stance: 'SHIELD' as const, learning_intent: false },
        ];

        for (const scenario of scenarios) {
          const state = createMockState({
            intent_summary: createIntentSummary(scenario),
          });
          const context = createMockContext();

          const result = executeStanceGate(state, context);

          expect(result.status).toBe('pass');
          expect(result.action).toBe('continue');
        }
      });

      it('should not modify state', () => {
        const originalIntent = createIntentSummary({
          stance: 'SWORD',
          learning_intent: true,
        });
        const state = createMockState({ intent_summary: originalIntent });
        const context = createMockContext();

        executeStanceGate(state, context);

        expect(state.intent_summary).toBe(originalIntent);
        expect(state.intent_summary?.stance).toBe('SWORD');
        expect(state.intent_summary?.learning_intent).toBe(true);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASYNC GATE TESTS (executeStanceGateAsync)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeStanceGateAsync', () => {
    // NOTE: Async and sync now behave differently for SWORD mode
    // - Sync: Always returns action='continue' (backwards compatibility)
    // - Async: Returns action='redirect' for SWORD mode with LLM classification

    it('should return same result as sync version for LENS mode', async () => {
      // LENS mode behaves identically in sync and async
      const state = createMockState({
        intent_summary: createIntentSummary({
          stance: 'LENS',
          learning_intent: false,
          primary_route: 'SAY',
        }),
      });
      const context = createMockContext();

      const syncResult = executeStanceGate(state, context);
      const asyncResult = await executeStanceGateAsync(state, context);

      expect(asyncResult.gateId).toBe(syncResult.gateId);
      expect(asyncResult.status).toBe(syncResult.status);
      expect(asyncResult.action).toBe(syncResult.action); // Both 'continue'
      expect(asyncResult.output.route).toBe(syncResult.output.route);
      expect(asyncResult.output.primary_route).toBe(syncResult.output.primary_route);
      expect(asyncResult.output.learning_intent).toBe(syncResult.output.learning_intent);
    });

    it('should return redirect for SWORD mode (async behavior differs from sync)', async () => {
      // SWORD async mode returns redirect instead of continue
      const state = createMockState({
        intent_summary: createIntentSummary({
          stance: 'SWORD',
          learning_intent: true,
          primary_route: 'MAKE',
        }),
      });
      const context = createMockContext();

      const syncResult = executeStanceGate(state, context);
      const asyncResult = await executeStanceGateAsync(state, context);

      // Sync still returns continue (backwards compatibility)
      expect(syncResult.action).toBe('continue');
      expect(syncResult.output.route).toBe('sword');

      // Async now returns redirect with classification
      expect(asyncResult.action).toBe('redirect');
      expect(asyncResult.output.route).toBe('sword');
      expect(asyncResult.output.redirect).toBeDefined();
      expect(asyncResult.output.redirect?.target).toBe('swordgate');
      expect(asyncResult.output.redirect?.mode).toMatch(/^(designer|runner)$/);
    });

    it('should return a Promise', () => {
      const state = createMockState({ intent_summary: createIntentSummary() });
      const context = createMockContext();

      const result = executeStanceGateAsync(state, context);

      expect(result).toBeInstanceOf(Promise);
    });

    it('should route to sword with redirect when conditions are met', async () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      const context = createMockContext();

      const result = await executeStanceGateAsync(state, context);

      expect(result.output.route).toBe('sword');
      expect(result.action).toBe('redirect');
      expect(result.output.redirect).toBeDefined();
    });

    it('should route to lens with continue when conditions are not met', async () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          stance: 'LENS',
          learning_intent: false,
        }),
      });
      const context = createMockContext();

      const result = await executeStanceGateAsync(state, context);

      expect(result.output.route).toBe('lens');
      expect(result.action).toBe('continue');
      expect(result.output.redirect).toBeUndefined();
    });

    it('should include topic in redirect for designer mode', async () => {
      const state = createMockState({
        userMessage: 'I want to learn guitar',
        intent_summary: createIntentSummary({
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      // No userId = defaults to designer mode with topic extraction
      const context = createMockContext({ userId: undefined });

      const result = await executeStanceGateAsync(state, context);

      expect(result.action).toBe('redirect');
      expect(result.output.redirect?.mode).toBe('designer');
      // Topic may be extracted from message
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SWORD SCENARIOS (Learning Intent)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('sword scenarios (learning intent)', () => {
    it('should route "I want to learn Python" to sword', () => {
      const state = createMockState({
        userMessage: 'I want to learn Python',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('sword');
      expect(result.output.primary_route).toBe('MAKE');
      expect(result.output.learning_intent).toBe(true);
    });

    it('should route "Help me learn guitar" to sword', () => {
      const state = createMockState({
        userMessage: 'Help me learn guitar',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('sword');
    });

    it('should route "Teach me about investing" to sword', () => {
      const state = createMockState({
        userMessage: 'Teach me about investing',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('sword');
    });

    it('should route "Make me a lesson plan for Spanish" to sword', () => {
      const state = createMockState({
        userMessage: 'Make me a lesson plan for Spanish',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('sword');
    });

    it('should route "Create a course for me on photography" to sword', () => {
      const state = createMockState({
        userMessage: 'Create a course for me on photography',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('sword');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // LENS SCENARIOS (Non-Learning)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('lens scenarios (non-learning)', () => {
    it('should route simple explanations to lens', () => {
      const state = createMockState({
        userMessage: 'Explain what a hash is',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          stance: 'LENS',
          learning_intent: false,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('lens');
    });

    it('should route math questions to lens', () => {
      const state = createMockState({
        userMessage: 'What is 17*23',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          stance: 'LENS',
          learning_intent: false,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('lens');
    });

    it('should route creative writing to lens', () => {
      const state = createMockState({
        userMessage: 'Write a poem about autumn',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          stance: 'LENS',
          learning_intent: false,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('lens');
    });

    it('should route code fixes to lens', () => {
      const state = createMockState({
        userMessage: 'Fix this code snippet',
        intent_summary: createIntentSummary({
          primary_route: 'FIX',
          stance: 'LENS',
          learning_intent: false,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('lens');
    });

    it('should route greetings to lens', () => {
      const state = createMockState({
        userMessage: 'Hi',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          stance: 'LENS',
          learning_intent: false,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('lens');
    });

    it('should route live data requests to lens', () => {
      const state = createMockState({
        userMessage: 'What is the current price of Bitcoin?',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          stance: 'LENS',
          live_data: true,
          learning_intent: false,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('lens');
    });

    it('should route external tool requests to lens', () => {
      const state = createMockState({
        userMessage: 'Check my Gmail for invoices',
        intent_summary: createIntentSummary({
          primary_route: 'DO',
          stance: 'LENS',
          external_tool: true,
          learning_intent: false,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('lens');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // INDEPENDENCE FROM OTHER INTENT FIELDS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('independence from other intent fields', () => {
    it('should route based only on stance and learning_intent, ignoring safety_signal', () => {
      const signals = ['none', 'low', 'medium', 'high'] as const;

      for (const safety_signal of signals) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SWORD',
            learning_intent: true,
            safety_signal,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('sword');
      }
    });

    it('should route based only on stance and learning_intent, ignoring live_data', () => {
      for (const live_data of [true, false]) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SWORD',
            learning_intent: true,
            live_data,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('sword');
      }
    });

    it('should route based only on stance and learning_intent, ignoring external_tool', () => {
      for (const external_tool of [true, false]) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SWORD',
            learning_intent: true,
            external_tool,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('sword');
      }
    });

    it('should route based only on stance and learning_intent, ignoring urgency', () => {
      const urgencies = ['low', 'medium', 'high'] as const;

      for (const urgency of urgencies) {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SWORD',
            learning_intent: true,
            urgency,
          }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe('sword');
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
        intent_summary: createIntentSummary({
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.route).toBe('sword');
    });

    it('should handle very long userMessage', () => {
      const longMessage = 'I want to learn '.repeat(500) + 'Python';
      const state = createMockState({
        userMessage: longMessage,
        intent_summary: createIntentSummary({
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.route).toBe('sword');
    });

    it('should handle missing context fields gracefully', () => {
      const state = createMockState({ intent_summary: createIntentSummary() });
      const context: PipelineContext = {};

      const result = executeStanceGate(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle context parameter being ignored', () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      // Context with various fields should not affect routing
      const context = createMockContext({
        requestId: 'different_request',
        userId: 'different_user',
        conversationHistory: [
          { role: 'user', content: 'previous message' },
        ],
      });

      const result = executeStanceGate(state, context);

      expect(result.output.route).toBe('sword');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ROUTING DECISION MATRIX
  // ─────────────────────────────────────────────────────────────────────────────

  describe('routing decision matrix', () => {
    const testCases: Array<{
      stance: 'LENS' | 'SWORD' | 'SHIELD';
      learning_intent: boolean;
      expectedRoute: 'sword' | 'lens';
    }> = [
      // SWORD stance
      { stance: 'SWORD', learning_intent: true, expectedRoute: 'sword' },
      { stance: 'SWORD', learning_intent: false, expectedRoute: 'lens' },
      // LENS stance
      { stance: 'LENS', learning_intent: true, expectedRoute: 'lens' },
      { stance: 'LENS', learning_intent: false, expectedRoute: 'lens' },
      // SHIELD stance
      { stance: 'SHIELD', learning_intent: true, expectedRoute: 'lens' },
      { stance: 'SHIELD', learning_intent: false, expectedRoute: 'lens' },
    ];

    for (const { stance, learning_intent, expectedRoute } of testCases) {
      it(`should route to '${expectedRoute}' when stance=${stance} and learning_intent=${learning_intent}`, () => {
        const state = createMockState({
          intent_summary: createIntentSummary({ stance, learning_intent }),
        });
        const context = createMockContext();

        const result = executeStanceGate(state, context);

        expect(result.output.route).toBe(expectedRoute);
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTITUTIONAL ALIGNMENT (Sword = Forward Motion)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('constitutional alignment', () => {
    it('should enable SWORD path for structured learning (Path + Spark components)', () => {
      const state = createMockState({
        userMessage: 'I want to study machine learning over the next 3 months',
        intent_summary: createIntentSummary({
          primary_route: 'MAKE',
          stance: 'SWORD',
          learning_intent: true,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      // Per Constitution Section 2.3: Sword enables progress through Path + Spark
      expect(result.output.route).toBe('sword');
      expect(result.output.learning_intent).toBe(true);
    });

    it('should default to LENS for one-off questions (Clarity mode)', () => {
      const state = createMockState({
        userMessage: 'What are the benefits of meditation?',
        intent_summary: createIntentSummary({
          primary_route: 'SAY',
          stance: 'LENS',
          learning_intent: false,
        }),
      });
      const context = createMockContext();

      const result = executeStanceGate(state, context);

      // Per Constitution Section 2.2: Lens enables accurate understanding
      expect(result.output.route).toBe('lens');
    });
  });
});
