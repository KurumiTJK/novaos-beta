// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD GATE TESTS — Router to Shield Engine
// NovaOS Pipeline — Gate 2 of 8
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeShieldGate,
  executeShieldGateAsync,
} from '../../../gates/shield_gate/shield-gate.js';
import type { ShieldGateOutput, SafetySignal, Urgency } from '../../../gates/shield_gate/types.js';
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

describe('Shield Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SYNC GATE TESTS (executeShieldGate)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeShieldGate (sync)', () => {
    describe('basic functionality', () => {
      it('should return correct gate metadata', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.gateId).toBe('shield');
        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should always return shield_acceptance as false (placeholder)', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.shield_acceptance).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ROUTING LOGIC
    // ─────────────────────────────────────────────────────────────────────────────

    describe('routing logic', () => {
      it('should route to shield when stance is SHIELD and safety_signal is not none', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'high',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
        expect(result.output.safety_signal).toBe('high');
        expect(result.output.urgency).toBe('high');
      });

      it('should skip when stance is SHIELD but safety_signal is none', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'none',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('skip');
      });

      it('should skip when stance is LENS regardless of safety_signal', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'LENS',
            safety_signal: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('skip');
      });

      it('should skip when stance is SWORD regardless of safety_signal', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SWORD',
            safety_signal: 'medium',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('skip');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SAFETY SIGNAL HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('safety signal handling', () => {
      it('should route to shield for low safety_signal with SHIELD stance', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'low',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
        expect(result.output.safety_signal).toBe('low');
      });

      it('should route to shield for medium safety_signal with SHIELD stance', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'medium',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
        expect(result.output.safety_signal).toBe('medium');
      });

      it('should route to shield for high safety_signal with SHIELD stance', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
        expect(result.output.safety_signal).toBe('high');
      });

      it('should preserve safety_signal value in output', () => {
        for (const signal of ['none', 'low', 'medium', 'high'] as SafetySignal[]) {
          const state = createMockState({
            intent_summary: createIntentSummary({
              safety_signal: signal,
            }),
          });
          const context = createMockContext();

          const result = executeShieldGate(state, context);

          expect(result.output.safety_signal).toBe(signal);
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // URGENCY HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('urgency handling', () => {
      it('should preserve low urgency in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            urgency: 'low',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.urgency).toBe('low');
      });

      it('should preserve medium urgency in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            urgency: 'medium',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.urgency).toBe('medium');
      });

      it('should preserve high urgency in output', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.urgency).toBe('high');
      });

      it('should preserve urgency for all values', () => {
        for (const urgency of ['low', 'medium', 'high'] as Urgency[]) {
          const state = createMockState({
            intent_summary: createIntentSummary({ urgency }),
          });
          const context = createMockContext();

          const result = executeShieldGate(state, context);

          expect(result.output.urgency).toBe(urgency);
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // DEFAULT VALUE HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('default value handling', () => {
      it('should use default stance (LENS) when intent_summary is undefined', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('skip');
      });

      it('should use default safety_signal (none) when intent_summary is undefined', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.safety_signal).toBe('none');
      });

      it('should use default urgency (low) when intent_summary is undefined', () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.urgency).toBe('low');
      });

      it('should handle partial intent_summary gracefully', () => {
        const state = createMockState({
          intent_summary: {
            primary_route: 'SAY',
            stance: 'SHIELD',
            // Missing other fields - will use defaults
          } as IntentSummary,
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        // Should not throw, should use defaults for missing fields
        expect(result.output.route).toBe('skip'); // safety_signal defaults to 'none'
        expect(result.output.safety_signal).toBe('none');
        expect(result.output.urgency).toBe('low');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // EXECUTION TIME TRACKING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('execution time tracking', () => {
      it('should track execution time', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(typeof result.executionTimeMs).toBe('number');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OUTPUT STRUCTURE
    // ─────────────────────────────────────────────────────────────────────────────

    describe('output structure', () => {
      it('should return all required output fields', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'high',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output).toHaveProperty('route');
        expect(result.output).toHaveProperty('safety_signal');
        expect(result.output).toHaveProperty('urgency');
        expect(result.output).toHaveProperty('shield_acceptance');
      });

      it('should return correct types for all output fields', () => {
        const state = createMockState({ intent_summary: createIntentSummary() });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(typeof result.output.route).toBe('string');
        expect(typeof result.output.safety_signal).toBe('string');
        expect(typeof result.output.urgency).toBe('string');
        expect(typeof result.output.shield_acceptance).toBe('boolean');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASYNC GATE TESTS (executeShieldGateAsync)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeShieldGateAsync', () => {
    it('should return blocked status when shield route is activated', async () => {
      // Changed: Async version now blocks for confirmation when shield is needed
      const state = createMockState({
        intent_summary: createIntentSummary({
          stance: 'SHIELD',
          safety_signal: 'high',
        }),
      });
      const context = createMockContext();

      const asyncResult = await executeShieldGateAsync(state, context);

      expect(asyncResult.gateId).toBe('shield');
      expect(asyncResult.status).toBe('blocked');
      expect(asyncResult.output.route).toBe('shield');
    });

    it('should return a Promise', () => {
      const state = createMockState({ intent_summary: createIntentSummary() });
      const context = createMockContext();

      const result = executeShieldGateAsync(state, context);

      expect(result).toBeInstanceOf(Promise);
    });

    it('should route to shield when conditions are met', async () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          stance: 'SHIELD',
          safety_signal: 'medium',
          urgency: 'medium',
        }),
      });
      const context = createMockContext();

      const result = await executeShieldGateAsync(state, context);

      expect(result.output.route).toBe('shield');
      expect(result.output.safety_signal).toBe('medium');
      expect(result.output.urgency).toBe('medium');
    });

    it('should skip when conditions are not met', async () => {
      const state = createMockState({
        intent_summary: createIntentSummary({
          stance: 'LENS',
          safety_signal: 'none',
        }),
      });
      const context = createMockContext();

      const result = await executeShieldGateAsync(state, context);

      expect(result.output.route).toBe('skip');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTITUTIONAL COMPLIANCE SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('constitutional compliance scenarios', () => {
    describe('CONTROL stance (highest priority per Constitution)', () => {
      it('should handle high urgency crisis scenarios', () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'high',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
        expect(result.output.safety_signal).toBe('high');
        expect(result.output.urgency).toBe('high');
      });
    });

    describe('physical safety scenarios (Interest Stack priority 1)', () => {
      it('should route self-harm messages to shield', () => {
        const state = createMockState({
          userMessage: 'I want to hurt myself',
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'high',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
      });

      it('should route suicide mentions to shield', () => {
        const state = createMockState({
          userMessage: 'I want to end it all',
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'high',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
      });
    });

    describe('mental health scenarios (Interest Stack priority 1)', () => {
      it('should handle emotional distress with low signal', () => {
        const state = createMockState({
          userMessage: "I'm feeling stressed about work",
          intent_summary: createIntentSummary({
            stance: 'LENS', // Low signals typically stay in LENS
            safety_signal: 'low',
            urgency: 'low',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('skip');
        expect(result.output.safety_signal).toBe('low');
      });

      it('should route severe anxiety to shield', () => {
        const state = createMockState({
          userMessage: "I can't stop panicking, I think I'm having a breakdown",
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'medium',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
      });
    });

    describe('financial safety scenarios (Interest Stack priority 2)', () => {
      it('should handle risky financial decisions', () => {
        const state = createMockState({
          userMessage: 'I want to put my entire savings into crypto options',
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'medium',
            urgency: 'medium',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
        expect(result.output.safety_signal).toBe('medium');
      });
    });

    describe('career safety scenarios (Interest Stack priority 3)', () => {
      it('should handle impulsive career decisions', () => {
        const state = createMockState({
          userMessage: "I'm going to quit my job right now and tell my boss off",
          intent_summary: createIntentSummary({
            stance: 'SHIELD',
            safety_signal: 'medium',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe('shield');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty userMessage', () => {
      const state = createMockState({
        userMessage: '',
        intent_summary: createIntentSummary(),
      });
      const context = createMockContext();

      const result = executeShieldGate(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.route).toBe('skip');
    });

    it('should handle very long userMessage', () => {
      const longMessage = 'A'.repeat(10000);
      const state = createMockState({
        userMessage: longMessage,
        intent_summary: createIntentSummary({
          stance: 'SHIELD',
          safety_signal: 'low',
        }),
      });
      const context = createMockContext();

      const result = executeShieldGate(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.route).toBe('shield');
    });

    it('should handle missing context fields gracefully', () => {
      const state = createMockState({ intent_summary: createIntentSummary() });
      const context: PipelineContext = {};

      const result = executeShieldGate(state, context);

      expect(result.status).toBe('pass');
    });

    it('should always pass gate (router only, no blocking)', () => {
      // Shield gate is a router, not a blocker
      const scenarios = [
        { stance: 'SHIELD' as const, safety_signal: 'high' as const },
        { stance: 'SHIELD' as const, safety_signal: 'none' as const },
        { stance: 'LENS' as const, safety_signal: 'high' as const },
        { stance: 'LENS' as const, safety_signal: 'none' as const },
      ];

      for (const scenario of scenarios) {
        const state = createMockState({
          intent_summary: createIntentSummary(scenario),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ROUTING DECISION MATRIX
  // ─────────────────────────────────────────────────────────────────────────────

  describe('routing decision matrix', () => {
    const testCases: Array<{
      stance: 'LENS' | 'SWORD' | 'SHIELD';
      safety_signal: SafetySignal;
      expectedRoute: 'shield' | 'skip';
    }> = [
      // SHIELD stance
      { stance: 'SHIELD', safety_signal: 'none', expectedRoute: 'skip' },
      { stance: 'SHIELD', safety_signal: 'low', expectedRoute: 'shield' },
      { stance: 'SHIELD', safety_signal: 'medium', expectedRoute: 'shield' },
      { stance: 'SHIELD', safety_signal: 'high', expectedRoute: 'shield' },
      // LENS stance
      { stance: 'LENS', safety_signal: 'none', expectedRoute: 'skip' },
      { stance: 'LENS', safety_signal: 'low', expectedRoute: 'skip' },
      { stance: 'LENS', safety_signal: 'medium', expectedRoute: 'skip' },
      { stance: 'LENS', safety_signal: 'high', expectedRoute: 'skip' },
      // SWORD stance
      { stance: 'SWORD', safety_signal: 'none', expectedRoute: 'skip' },
      { stance: 'SWORD', safety_signal: 'low', expectedRoute: 'skip' },
      { stance: 'SWORD', safety_signal: 'medium', expectedRoute: 'skip' },
      { stance: 'SWORD', safety_signal: 'high', expectedRoute: 'skip' },
    ];

    for (const { stance, safety_signal, expectedRoute } of testCases) {
      it(`should route to '${expectedRoute}' when stance=${stance} and safety_signal=${safety_signal}`, () => {
        const state = createMockState({
          intent_summary: createIntentSummary({ stance, safety_signal }),
        });
        const context = createMockContext();

        const result = executeShieldGate(state, context);

        expect(result.output.route).toBe(expectedRoute);
      });
    }
  });
});
