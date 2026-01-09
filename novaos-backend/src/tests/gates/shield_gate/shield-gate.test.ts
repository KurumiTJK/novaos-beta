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
// MOCK SHIELD SERVICE
// ─────────────────────────────────────────────────────────────────────────────────

const mockShieldService = {
  checkCrisisBlock: vi.fn(),
  evaluate: vi.fn(),
  confirmAcceptanceAndGetMessage: vi.fn(),
  confirmSafety: vi.fn(),
  getStatus: vi.fn(),
};

vi.mock('../../../services/shield/index.js', () => ({
  getShieldService: () => mockShieldService,
}));

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
    conversationId: 'conv_123',
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
    // Default: no crisis block
    mockShieldService.checkCrisisBlock.mockResolvedValue({ blocked: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ASYNC GATE TESTS (executeShieldGateAsync) — Main Production Path
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('executeShieldGateAsync', () => {
    
    // ─────────────────────────────────────────────────────────────────────────────
    // SHIELD BYPASS (user confirmed warning)
    // ─────────────────────────────────────────────────────────────────────────────
    
    describe('shield bypass', () => {
      it('should skip evaluation when shieldBypassed is true', async () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal: 'medium',
            urgency: 'medium',
          }),
        });
        const context = createMockContext({ shieldBypassed: true });

        const result = await executeShieldGateAsync(state, context);

        expect(result.gateId).toBe('shield');
        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.output.action).toBe('skip');
        expect(result.output.shield_acceptance).toBe(true);
        // Should NOT call shield service
        expect(mockShieldService.evaluate).not.toHaveBeenCalled();
      });

      it('should pass through safety_signal even when bypassed', async () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal: 'high',
            urgency: 'high',
          }),
        });
        const context = createMockContext({ shieldBypassed: true });

        const result = await executeShieldGateAsync(state, context);

        expect(result.output.safety_signal).toBe('high');
        expect(result.output.urgency).toBe('high');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ACTIVE CRISIS SESSION BLOCK
    // ─────────────────────────────────────────────────────────────────────────────
    
    describe('active crisis session', () => {
      it('should block ALL messages when user has active crisis session', async () => {
        mockShieldService.checkCrisisBlock.mockResolvedValue({
          blocked: true,
          sessionId: 'crisis_session_123',
        });

        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal: 'none', // Even safe messages blocked
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.status).toBe('blocked');
        expect(result.action).toBe('halt');
        expect(result.output.action).toBe('crisis');
        expect(result.output.sessionId).toBe('crisis_session_123');
        expect(result.output.crisisBlocked).toBe(true);
      });

      it('should not check crisis block for anonymous users', async () => {
        const state = createMockState({
          intent_summary: createIntentSummary(),
        });
        const context = createMockContext({ userId: undefined });

        await executeShieldGateAsync(state, context);

        expect(mockShieldService.checkCrisisBlock).not.toHaveBeenCalled();
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // NONE/LOW SAFETY SIGNAL — Skip Shield
    // ─────────────────────────────────────────────────────────────────────────────
    
    describe('none/low safety signal', () => {
      it('should skip shield for safety_signal: none', async () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal: 'none',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.output.route).toBe('skip');
        expect(result.output.action).toBe('skip');
        expect(mockShieldService.evaluate).not.toHaveBeenCalled();
      });

      it('should skip shield for safety_signal: low', async () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal: 'low',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.output.route).toBe('skip');
        expect(result.output.action).toBe('skip');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // MEDIUM SAFETY SIGNAL — Warning (Block Pipeline)
    // ─────────────────────────────────────────────────────────────────────────────
    
    describe('medium safety signal', () => {
      beforeEach(() => {
        mockShieldService.evaluate.mockResolvedValue({
          action: 'warn',
          safetySignal: 'medium',
          urgency: 'medium',
          riskAssessment: {
            domain: 'financial',
            riskExplanation: 'This involves financial risk',
            consequences: ['Loss of savings'],
            alternatives: ['Invest smaller amount'],
            question: 'Have you considered the downside?',
          },
          warningMessage: 'This involves significant financial risk. Are you sure?',
          activationId: 'activation_123',
        });
      });

      it('should block pipeline and return warning for medium signal', async () => {
        const state = createMockState({
          userMessage: 'I want to put my savings into crypto',
          intent_summary: createIntentSummary({
            safety_signal: 'medium',
            urgency: 'medium',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.status).toBe('blocked');
        expect(result.action).toBe('halt');
        expect(result.output.action).toBe('warn');
        expect(result.output.warningMessage).toBe('This involves significant financial risk. Are you sure?');
        expect(result.output.activationId).toBe('activation_123');
      });

      it('should call evaluate with correct parameters', async () => {
        const state = createMockState({
          userMessage: 'I want to quit my job today',
          intent_summary: createIntentSummary({
            safety_signal: 'medium',
            urgency: 'high',
          }),
        });
        const context = createMockContext({
          userId: 'user_abc',
          conversationId: 'conv_xyz',
        });

        await executeShieldGateAsync(state, context);

        expect(mockShieldService.evaluate).toHaveBeenCalledWith(
          'user_abc',
          'I want to quit my job today',
          'medium',
          'high',
          'conv_xyz',
          expect.objectContaining({ safety_signal: 'medium' }) // intent result
        );
      });

      it('should include risk assessment in output', async () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal: 'medium',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.output.riskAssessment).toBeDefined();
        expect(result.output.riskAssessment?.domain).toBe('financial');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // HIGH SAFETY SIGNAL — Crisis Mode
    // ─────────────────────────────────────────────────────────────────────────────
    
    describe('high safety signal', () => {
      beforeEach(() => {
        mockShieldService.evaluate.mockResolvedValue({
          action: 'crisis',
          safetySignal: 'high',
          urgency: 'high',
          riskAssessment: {
            domain: 'health',
            riskExplanation: 'I notice you might be going through something difficult',
            consequences: ['Reaching out for support can make a difference'],
            alternatives: ['988 Suicide & Crisis Lifeline', 'Crisis Text Line'],
            question: 'What might help you feel safer right now?',
          },
          sessionId: 'crisis_session_456',
          activationId: 'activation_456',
        });
      });

      it('should halt pipeline and create crisis session for high signal', async () => {
        const state = createMockState({
          userMessage: 'I feel like ending it all',
          intent_summary: createIntentSummary({
            safety_signal: 'high',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.status).toBe('blocked');
        expect(result.action).toBe('halt');
        expect(result.output.action).toBe('crisis');
        expect(result.output.sessionId).toBe('crisis_session_456');
        expect(result.output.activationId).toBe('activation_456');
      });

      it('should include crisis resources in risk assessment', async () => {
        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal: 'high',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.output.riskAssessment?.alternatives).toContain('988 Suicide & Crisis Lifeline');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // EDGE CASES
    // ─────────────────────────────────────────────────────────────────────────────
    
    describe('edge cases', () => {
      it('should handle missing intent_summary gracefully', async () => {
        const state = createMockState({ intent_summary: undefined });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.status).toBe('pass');
        expect(result.output.safety_signal).toBe('none');
        expect(result.output.urgency).toBe('low');
      });

      it('should handle anonymous user for medium signal', async () => {
        mockShieldService.evaluate.mockResolvedValue({
          action: 'warn',
          safetySignal: 'medium',
          urgency: 'medium',
        });

        const state = createMockState({
          intent_summary: createIntentSummary({
            safety_signal: 'medium',
          }),
        });
        const context = createMockContext({ userId: undefined });

        const result = await executeShieldGateAsync(state, context);

        expect(mockShieldService.evaluate).toHaveBeenCalledWith(
          'anonymous',
          expect.any(String),
          'medium',
          'low',
          expect.any(String),
          expect.any(Object)
        );
      });

      it('should track execution time', async () => {
        const state = createMockState({
          intent_summary: createIntentSummary(),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
        expect(typeof result.executionTimeMs).toBe('number');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SYNC GATE TESTS (executeShieldGate) — Backwards Compatibility
  // ═══════════════════════════════════════════════════════════════════════════════

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

      it('should always return shield_acceptance as false', () => {
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

    describe('safety signal and urgency handling', () => {
      it('should preserve safety_signal value in output', () => {
        for (const signal of ['none', 'low', 'medium', 'high'] as SafetySignal[]) {
          const state = createMockState({
            intent_summary: createIntentSummary({ safety_signal: signal }),
          });
          const context = createMockContext();

          const result = executeShieldGate(state, context);

          expect(result.output.safety_signal).toBe(signal);
        }
      });

      it('should preserve urgency value in output', () => {
        for (const urg of ['low', 'medium', 'high'] as Urgency[]) {
          const state = createMockState({
            intent_summary: createIntentSummary({ urgency: urg }),
          });
          const context = createMockContext();

          const result = executeShieldGate(state, context);

          expect(result.output.urgency).toBe(urg);
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONSTITUTIONAL COMPLIANCE SCENARIOS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('constitutional compliance scenarios', () => {
    beforeEach(() => {
      mockShieldService.evaluate.mockResolvedValue({
        action: 'crisis',
        safetySignal: 'high',
        urgency: 'high',
        sessionId: 'crisis_123',
      });
    });

    describe('physical safety scenarios (Interest Stack priority 1)', () => {
      it('should halt pipeline for self-harm messages', async () => {
        const state = createMockState({
          userMessage: 'I want to hurt myself',
          intent_summary: createIntentSummary({
            safety_signal: 'high',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.action).toBe('halt');
        expect(result.output.action).toBe('crisis');
      });

      it('should halt pipeline for suicide mentions', async () => {
        const state = createMockState({
          userMessage: 'I want to end it all',
          intent_summary: createIntentSummary({
            safety_signal: 'high',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.action).toBe('halt');
      });
    });

    describe('financial safety scenarios (Interest Stack priority 2)', () => {
      beforeEach(() => {
        mockShieldService.evaluate.mockResolvedValue({
          action: 'warn',
          safetySignal: 'medium',
          urgency: 'medium',
          warningMessage: 'This involves financial risk',
        });
      });

      it('should warn for risky financial decisions', async () => {
        const state = createMockState({
          userMessage: 'I want to put my entire savings into crypto options',
          intent_summary: createIntentSummary({
            safety_signal: 'medium',
            urgency: 'medium',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.output.action).toBe('warn');
        expect(result.action).toBe('halt');
      });
    });

    describe('career safety scenarios (Interest Stack priority 3)', () => {
      beforeEach(() => {
        mockShieldService.evaluate.mockResolvedValue({
          action: 'warn',
          safetySignal: 'medium',
          urgency: 'high',
          warningMessage: 'This could affect your career',
        });
      });

      it('should warn for impulsive career decisions', async () => {
        const state = createMockState({
          userMessage: "I'm going to quit my job right now and tell my boss off",
          intent_summary: createIntentSummary({
            safety_signal: 'medium',
            urgency: 'high',
          }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.output.action).toBe('warn');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ROUTING DECISION MATRIX
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('async routing decision matrix', () => {
    const testCases: Array<{
      safety_signal: SafetySignal;
      expectedAction: 'skip' | 'warn' | 'crisis';
      shouldCallEvaluate: boolean;
    }> = [
      { safety_signal: 'none', expectedAction: 'skip', shouldCallEvaluate: false },
      { safety_signal: 'low', expectedAction: 'skip', shouldCallEvaluate: false },
      { safety_signal: 'medium', expectedAction: 'warn', shouldCallEvaluate: true },
      { safety_signal: 'high', expectedAction: 'crisis', shouldCallEvaluate: true },
    ];

    for (const { safety_signal, expectedAction, shouldCallEvaluate } of testCases) {
      it(`should ${expectedAction} for safety_signal=${safety_signal}`, async () => {
        if (shouldCallEvaluate) {
          mockShieldService.evaluate.mockResolvedValue({
            action: expectedAction,
            safetySignal: safety_signal,
            urgency: 'medium',
            ...(expectedAction === 'crisis' ? { sessionId: 'session_123' } : {}),
          });
        }

        const state = createMockState({
          intent_summary: createIntentSummary({ safety_signal }),
        });
        const context = createMockContext();

        const result = await executeShieldGateAsync(state, context);

        expect(result.output.action).toBe(expectedAction);
        
        if (shouldCallEvaluate) {
          expect(mockShieldService.evaluate).toHaveBeenCalled();
        } else {
          expect(mockShieldService.evaluate).not.toHaveBeenCalled();
        }
      });
    }
  });

  describe('sync routing decision matrix', () => {
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
