// ═══════════════════════════════════════════════════════════════════════════════
// CONSTITUTION GATE TESTS — Constitutional Compliance Check
// NovaOS Pipeline — Gate 7 of 8
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeConstitutionGateAsync,
  buildRegenerationMessage,
} from '../../../gates/constitution_gate/constitution-gate.js';
import {
  NOVA_CONSTITUTION,
  CONSTITUTIONAL_CHECK_PROMPT,
} from '../../../gates/constitution_gate/constitution.js';
import { CONSTITUTION_TEXT } from '../../../gates/constitution_gate/constitution_text.js';
import type {
  ConstitutionGateOutput,
  ConstitutionGateConfig,
  ConstitutionalCheckResult,
} from '../../../gates/constitution_gate/types.js';
import type { PipelineState, PipelineContext, IntentSummary, Generation } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

const mockGenerateForConstitutionGate = vi.fn();

vi.mock('../../../pipeline/llm_engine.js', () => ({
  generateForConstitutionGate: (...args: unknown[]) => mockGenerateForConstitutionGate(...args),
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

const DEFAULT_GENERATION: Generation = {
  text: 'This is a helpful response.',
  model: 'gpt-5.2',
  tokensUsed: 100,
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
    intent_summary: DEFAULT_INTENT,
    generation: DEFAULT_GENERATION,
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

function createCheckResponse(result: ConstitutionalCheckResult): { text: string } {
  return {
    text: JSON.stringify(result),
  };
}

function createCleanCheckResponse(): { text: string } {
  return createCheckResponse({
    violates: false,
    reason: null,
    fix: null,
  });
}

function createViolationCheckResponse(
  reason: string = 'Uses dependency language',
  fix: string = 'Remove dependency language'
): { text: string } {
  return createCheckResponse({
    violates: true,
    reason,
    fix,
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Constitution Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateForConstitutionGate.mockResolvedValue(createCleanCheckResponse());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EXECUTE CONSTITUTION GATE ASYNC
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeConstitutionGateAsync', () => {
    describe('basic functionality', () => {
      it('should return correct gate metadata on success', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.gateId).toBe('constitution');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should include execution time', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'medium' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(typeof result.executionTimeMs).toBe('number');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ROUTER LOGIC
    // ─────────────────────────────────────────────────────────────────────────────

    describe('router logic', () => {
      it('should skip check when safety_signal is none', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'none' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.status).toBe('pass');
        expect(result.output.checkRun).toBe(false);
        expect(result.output.skipReason).toContain('safety=none');
        expect(mockGenerateForConstitutionGate).not.toHaveBeenCalled();
      });

      it('should run check when safety_signal is low', async () => {
        // Changed: Now runs on low signal for Shield Amendment support
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'low' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.checkRun).toBe(true);
        expect(mockGenerateForConstitutionGate).toHaveBeenCalledTimes(1);
      });

      it('should run check when safety_signal is medium', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'medium' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.checkRun).toBe(true);
        expect(mockGenerateForConstitutionGate).toHaveBeenCalledTimes(1);
      });

      it('should run check when safety_signal is high', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.checkRun).toBe(true);
        expect(mockGenerateForConstitutionGate).toHaveBeenCalledTimes(1);
      });

      it('should run check when shield_acceptance is true', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'none' },
          shieldResult: { shield_acceptance: true },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.checkRun).toBe(true);
        expect(mockGenerateForConstitutionGate).toHaveBeenCalledTimes(1);
      });

      it('should run check when shield_acceptance is false and safety_signal is low', async () => {
        // Changed: Now runs on low signal for Shield Amendment support
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'low' },
          shieldResult: { shield_acceptance: false },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.checkRun).toBe(true);
        expect(mockGenerateForConstitutionGate).toHaveBeenCalledTimes(1);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // CONFIG OPTIONS
    // ─────────────────────────────────────────────────────────────────────────────

    describe('config options', () => {
      it('should skip check when forceSkip is true', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();
        const config: ConstitutionGateConfig = { forceSkip: true };

        const result = await executeConstitutionGateAsync(state, context, config);

        expect(result.output.checkRun).toBe(false);
        expect(result.output.skipReason).toBe('forceSkip=true');
        expect(mockGenerateForConstitutionGate).not.toHaveBeenCalled();
      });

      it('should run check when forceRun is true regardless of safety_signal', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'none' },
        });
        const context = createMockContext();
        const config: ConstitutionGateConfig = { forceRun: true };

        const result = await executeConstitutionGateAsync(state, context, config);

        expect(result.output.checkRun).toBe(true);
        expect(mockGenerateForConstitutionGate).toHaveBeenCalledTimes(1);
      });

      it('should prioritize forceSkip over forceRun', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();
        const config: ConstitutionGateConfig = { forceSkip: true, forceRun: true };

        const result = await executeConstitutionGateAsync(state, context, config);

        expect(result.output.checkRun).toBe(false);
        expect(mockGenerateForConstitutionGate).not.toHaveBeenCalled();
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // CLEAN RESPONSE HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('clean response handling', () => {
      it('should pass when no violation is found', async () => {
        mockGenerateForConstitutionGate.mockResolvedValue(createCleanCheckResponse());
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.output.valid).toBe(true);
        expect(result.output.checkRun).toBe(true);
        expect(result.output.constitutionalCheck?.violates).toBe(false);
      });

      it('should preserve original text when no violation', async () => {
        const generatedText = 'Original helpful response';
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
          generation: { text: generatedText, model: 'gpt-5.2', tokensUsed: 50 },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.text).toBe(generatedText);
        expect(result.output.edited).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // VIOLATION HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('violation handling', () => {
      it('should return hard_fail and regenerate when violation found', async () => {
        mockGenerateForConstitutionGate.mockResolvedValue(
          createViolationCheckResponse('Uses dependency language', 'Remove it')
        );
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.action).toBe('regenerate');
        expect(result.output.valid).toBe(false);
        expect(result.output.constitutionalCheck?.violates).toBe(true);
      });

      it('should include violation reason in output', async () => {
        const reason = 'Uses sycophantic language';
        mockGenerateForConstitutionGate.mockResolvedValue(
          createViolationCheckResponse(reason, 'Remove flattery')
        );
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.constitutionalCheck?.reason).toBe(reason);
        expect(result.output.violations).toContain(reason);
      });

      it('should include fix guidance in output', async () => {
        const fix = 'Remove the sycophantic praise';
        mockGenerateForConstitutionGate.mockResolvedValue(
          createViolationCheckResponse('Sycophancy', fix)
        );
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.fixGuidance).toBe(fix);
        expect(result.output.constitutionalCheck?.fix).toBe(fix);
      });

      it('should include violation in failureReason', async () => {
        mockGenerateForConstitutionGate.mockResolvedValue(
          createViolationCheckResponse('Fabricated information', 'Verify facts')
        );
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.failureReason).toContain('Constitutional violation');
        expect(result.failureReason).toContain('Fabricated information');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ERROR HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('error handling', () => {
      it('should soft_fail and pass through on LLM error (fail open)', async () => {
        mockGenerateForConstitutionGate.mockRejectedValue(new Error('API timeout'));
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.status).toBe('soft_fail');
        expect(result.action).toBe('continue');
        expect(result.output.valid).toBe(true);
        expect(result.output.skipReason).toBe('LLM check failed');
      });

      it('should skip when no generated text', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
          generation: undefined,
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.status).toBe('pass');
        expect(result.output.checkRun).toBe(false);
        expect(result.output.skipReason).toBe('no generated text');
        expect(mockGenerateForConstitutionGate).not.toHaveBeenCalled();
      });

      it('should skip when generated text is empty', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
          generation: { text: '', model: 'gpt-5.2', tokensUsed: 0 },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.checkRun).toBe(false);
        expect(result.output.skipReason).toBe('no generated text');
      });

      it('should handle malformed JSON response gracefully', async () => {
        mockGenerateForConstitutionGate.mockResolvedValue({
          text: 'not valid json {{{',
        });
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        // Should default to no violation on parse error
        expect(result.status).toBe('pass');
        expect(result.output.constitutionalCheck?.violates).toBe(false);
      });

      it('should handle JSON with markdown code blocks', async () => {
        const jsonResponse = {
          text: '```json\n{"violates": false, "reason": null, "fix": null}\n```',
        };
        mockGenerateForConstitutionGate.mockResolvedValue(jsonResponse);
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.status).toBe('pass');
        expect(result.output.constitutionalCheck?.violates).toBe(false);
      });

      it('should handle JSON with plain code blocks', async () => {
        const jsonResponse = {
          text: '```\n{"violates": true, "reason": "test", "fix": "fix it"}\n```',
        };
        mockGenerateForConstitutionGate.mockResolvedValue(jsonResponse);
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.constitutionalCheck?.violates).toBe(true);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // LLM CALL VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────────

    describe('LLM call verification', () => {
      it('should pass constitutional check prompt to LLM', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        await executeConstitutionGateAsync(state, context);

        const systemPrompt = mockGenerateForConstitutionGate.mock.calls[0][0];
        expect(systemPrompt).toBe(CONSTITUTIONAL_CHECK_PROMPT);
      });

      it('should include generated text in user prompt', async () => {
        const generatedText = 'My specific response text';
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
          generation: { text: generatedText, model: 'gpt-5.2', tokensUsed: 50 },
        });
        const context = createMockContext();

        await executeConstitutionGateAsync(state, context);

        const userPrompt = mockGenerateForConstitutionGate.mock.calls[0][1];
        expect(userPrompt).toContain(generatedText);
        expect(userPrompt).toContain('RESPONSE TO CHECK');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OUTPUT STRUCTURE
    // ─────────────────────────────────────────────────────────────────────────────

    describe('output structure', () => {
      it('should return all required output fields when check runs', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output).toHaveProperty('text');
        expect(result.output).toHaveProperty('valid');
        expect(result.output).toHaveProperty('edited');
        expect(result.output).toHaveProperty('checkRun');
        expect(result.output).toHaveProperty('constitutionalCheck');
      });

      it('should return skip fields when check skips', async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal: 'none' },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.checkRun).toBe(false);
        expect(result.output.skipReason).toBeDefined();
        expect(result.output.constitutionalCheck).toBeUndefined();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // BUILD REGENERATION MESSAGE
  // ─────────────────────────────────────────────────────────────────────────────

  describe('buildRegenerationMessage', () => {
    it('should combine original message with fix guidance', () => {
      const original = 'Tell me about anxiety management';
      const fix = 'Do not use dependency language like "I\'m always here for you"';

      const result = buildRegenerationMessage(original, fix);

      expect(result).toContain(original);
      expect(result).toContain(fix);
      expect(result).toContain('PREVIOUS RESPONSE ISSUE');
    });

    it('should include regeneration instruction', () => {
      const result = buildRegenerationMessage('Test', 'Fix guidance');

      expect(result).toContain('Please regenerate your response');
    });

    it('should handle empty fix guidance', () => {
      const result = buildRegenerationMessage('Original', '');

      expect(result).toContain('Original');
    });

    it('should handle multi-line fix guidance', () => {
      const fix = 'Line 1\nLine 2\nLine 3';
      const result = buildRegenerationMessage('Original', fix);

      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTITUTION TEXT
  // ─────────────────────────────────────────────────────────────────────────────

  describe('CONSTITUTION_TEXT', () => {
    it('should contain Purpose section', () => {
      expect(CONSTITUTION_TEXT).toContain('Purpose');
    });

    it('should contain Core Roles section', () => {
      expect(CONSTITUTION_TEXT).toContain('Core Roles');
    });

    it('should mention Shield, Lens, and Sword', () => {
      expect(CONSTITUTION_TEXT).toContain('Shield');
      expect(CONSTITUTION_TEXT).toContain('Lens');
      expect(CONSTITUTION_TEXT).toContain('Sword');
    });

    it('should contain Interest Stack', () => {
      expect(CONSTITUTION_TEXT).toContain('Interest Stack');
    });

    it('should contain Anti-Addiction Guardrails', () => {
      expect(CONSTITUTION_TEXT).toContain('Anti-Addiction Guardrails');
    });

    it('should contain Design Principle', () => {
      expect(CONSTITUTION_TEXT).toContain('Design Principle');
    });

    it('should contain Closing Clause', () => {
      expect(CONSTITUTION_TEXT).toContain('Closing Clause');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NOVA_CONSTITUTION
  // ─────────────────────────────────────────────────────────────────────────────

  describe('NOVA_CONSTITUTION', () => {
    it('should equal CONSTITUTION_TEXT', () => {
      expect(NOVA_CONSTITUTION).toBe(CONSTITUTION_TEXT);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTITUTIONAL_CHECK_PROMPT
  // ─────────────────────────────────────────────────────────────────────────────

  describe('CONSTITUTIONAL_CHECK_PROMPT', () => {
    it('should contain constitution text', () => {
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain(CONSTITUTION_TEXT);
    });

    it('should list key violations to check', () => {
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('DEPENDENCY LANGUAGE');
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('SYCOPHANCY');
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('FABRICATION');
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('CONFIDENCE MISCALIBRATION');
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('ANTI-REAL-WORLD');
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('ISOLATION');
    });

    it('should specify JSON response format', () => {
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('JSON');
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('violates');
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('reason');
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('fix');
    });

    it('should include example responses', () => {
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('Example violation response');
      expect(CONSTITUTIONAL_CHECK_PROMPT).toContain('Example clean response');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle undefined intent_summary', async () => {
      const state = createMockState({ intent_summary: undefined });
      const context = createMockContext();

      const result = await executeConstitutionGateAsync(state, context);

      // Should skip - no safety signal defaults to 'safe'
      expect(result.output.checkRun).toBe(false);
    });

    it('should handle very long generated text', async () => {
      const longText = 'A'.repeat(10000);
      const state = createMockState({
        intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        generation: { text: longText, model: 'gpt-5.2', tokensUsed: 5000 },
      });
      const context = createMockContext();

      const result = await executeConstitutionGateAsync(state, context);

      expect(result.output.checkRun).toBe(true);
      const userPrompt = mockGenerateForConstitutionGate.mock.calls[0][1];
      expect(userPrompt).toContain(longText);
    });

    it('should handle missing context fields gracefully', async () => {
      const state = createMockState({
        intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
      });
      const context: PipelineContext = {};

      const result = await executeConstitutionGateAsync(state, context);

      expect(result.output.checkRun).toBe(true);
    });

    it('should handle empty shieldResult', async () => {
      const state = createMockState({
        intent_summary: { ...DEFAULT_INTENT, safety_signal: 'none' },
        shieldResult: {},
      });
      const context = createMockContext();

      const result = await executeConstitutionGateAsync(state, context);

      expect(result.output.checkRun).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTITUTIONAL VIOLATION SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('constitutional violation scenarios', () => {
    it('should detect dependency language', async () => {
      mockGenerateForConstitutionGate.mockResolvedValue(
        createViolationCheckResponse(
          "Uses dependency language 'I'm always here for you'",
          'Remove dependency language'
        )
      );
      const state = createMockState({
        intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        generation: {
          text: "I'm always here for you, no matter what happens.",
          model: 'gpt-5.2',
          tokensUsed: 20,
        },
      });
      const context = createMockContext();

      const result = await executeConstitutionGateAsync(state, context);

      expect(result.status).toBe('hard_fail');
      expect(result.action).toBe('regenerate');
    });

    it('should detect sycophancy', async () => {
      mockGenerateForConstitutionGate.mockResolvedValue(
        createViolationCheckResponse(
          'Excessive praise without substance',
          'Remove flattery'
        )
      );
      const state = createMockState({
        intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        generation: {
          text: "Great question! You're so smart for asking that!",
          model: 'gpt-5.2',
          tokensUsed: 20,
        },
      });
      const context = createMockContext();

      const result = await executeConstitutionGateAsync(state, context);

      expect(result.status).toBe('hard_fail');
    });

    it('should detect fabrication', async () => {
      mockGenerateForConstitutionGate.mockResolvedValue(
        createViolationCheckResponse(
          'Made up statistics without basis',
          'Verify or remove statistics'
        )
      );
      const state = createMockState({
        intent_summary: { ...DEFAULT_INTENT, safety_signal: 'high' },
        generation: {
          text: '95% of experts agree that this is correct.',
          model: 'gpt-5.2',
          tokensUsed: 20,
        },
      });
      const context = createMockContext();

      const result = await executeConstitutionGateAsync(state, context);

      expect(result.status).toBe('hard_fail');
      expect(result.output.fixGuidance).toContain('Verify');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ROUTER DECISION MATRIX
  // ─────────────────────────────────────────────────────────────────────────────

  describe('router decision matrix', () => {
    // Updated: Now runs check on low signal for Shield Amendment support
    const testCases: Array<{
      safety_signal: 'none' | 'low' | 'medium' | 'high';
      shield_acceptance: boolean;
      expectedCheck: boolean;
    }> = [
      { safety_signal: 'none', shield_acceptance: false, expectedCheck: false },
      { safety_signal: 'none', shield_acceptance: true, expectedCheck: true },
      { safety_signal: 'low', shield_acceptance: false, expectedCheck: true },  // Changed: now runs
      { safety_signal: 'low', shield_acceptance: true, expectedCheck: true },
      { safety_signal: 'medium', shield_acceptance: false, expectedCheck: true },
      { safety_signal: 'medium', shield_acceptance: true, expectedCheck: true },
      { safety_signal: 'high', shield_acceptance: false, expectedCheck: true },
      { safety_signal: 'high', shield_acceptance: true, expectedCheck: true },
    ];

    for (const { safety_signal, shield_acceptance, expectedCheck } of testCases) {
      it(`should ${expectedCheck ? 'run' : 'skip'} check when safety_signal=${safety_signal} and shield_acceptance=${shield_acceptance}`, async () => {
        const state = createMockState({
          intent_summary: { ...DEFAULT_INTENT, safety_signal },
          shieldResult: { shield_acceptance },
        });
        const context = createMockContext();

        const result = await executeConstitutionGateAsync(state, context);

        expect(result.output.checkRun).toBe(expectedCheck);
      });
    }
  });
});
