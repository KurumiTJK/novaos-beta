// ═══════════════════════════════════════════════════════════════════════════════
// PERSONALITY GATE — Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import {
  executePersonalityGate,
  executePersonalityGateAsync,
  buildRegenerationMessage,
} from './personality-gate.js';
import type { PipelineState, PipelineContext, Generation } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function createMockState(generatedText: string): PipelineState {
  return {
    userMessage: 'What is the weather?',
    normalizedInput: 'what is the weather?',
    generation: {
      text: generatedText,
      model: 'gpt-4o-mini',
      tokensUsed: 50,
    },
    gateResults: {},
    flags: {},
  } as PipelineState;
}

const mockContext: PipelineContext = {
  requestId: 'test-123',
  userId: 'user-1',
};

// ─────────────────────────────────────────────────────────────────────────────────
// SYNC GATE TESTS (mock mode)
// ─────────────────────────────────────────────────────────────────────────────────

describe('executePersonalityGate (sync/mock)', () => {
  it('should pass through text without checking', () => {
    const state = createMockState('The weather is sunny today.');
    const result = executePersonalityGate(state, mockContext);

    expect(result.status).toBe('pass');
    expect(result.action).toBe('continue');
    expect(result.output.text).toBe('The weather is sunny today.');
    expect(result.output.valid).toBe(true);
  });

  it('should handle empty generation', () => {
    const state = createMockState('');
    const result = executePersonalityGate(state, mockContext);

    expect(result.status).toBe('pass');
    expect(result.output.text).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC GATE TESTS (LLM constitutional check)
// ─────────────────────────────────────────────────────────────────────────────────

describe('executePersonalityGateAsync', () => {
  it('should pass clean response', async () => {
    const state = createMockState('The current temperature is 72°F with clear skies.');
    
    const mockCheckFn = vi.fn().mockResolvedValue({
      text: '{"violates": false, "reason": null, "fix": null}',
      model: 'gpt-4o-mini',
      tokensUsed: 20,
    });

    const result = await executePersonalityGateAsync(state, mockContext, mockCheckFn);

    expect(result.status).toBe('pass');
    expect(result.action).toBe('continue');
    expect(result.output.valid).toBe(true);
    expect(result.output.constitutionalCheck?.violates).toBe(false);
  });

  it('should trigger regeneration for dependency language', async () => {
    const state = createMockState("I'm always here for you. The weather is nice.");
    
    const mockCheckFn = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        violates: true,
        reason: "Uses dependency language 'I'm always here for you'",
        fix: "Remove dependency language. Provide weather information without implying emotional availability.",
      }),
      model: 'gpt-4o-mini',
      tokensUsed: 30,
    });

    const result = await executePersonalityGateAsync(state, mockContext, mockCheckFn);

    expect(result.status).toBe('hard_fail');
    expect(result.action).toBe('regenerate');
    expect(result.output.valid).toBe(false);
    expect(result.output.fixGuidance).toContain('Remove dependency language');
  });

  it('should trigger regeneration for sycophancy', async () => {
    const state = createMockState("Great question! You're so smart for asking about weather!");
    
    const mockCheckFn = vi.fn().mockResolvedValue({
      text: '{"violates": true, "reason": "Sycophantic praise", "fix": "Remove excessive praise. Answer the question directly."}',
      model: 'gpt-4o-mini',
      tokensUsed: 25,
    });

    const result = await executePersonalityGateAsync(state, mockContext, mockCheckFn);

    expect(result.status).toBe('hard_fail');
    expect(result.action).toBe('regenerate');
    expect(result.output.fixGuidance).toContain('Remove excessive praise');
  });

  it('should skip check when configured', async () => {
    const state = createMockState("I'm always here for you.");
    
    const mockCheckFn = vi.fn();

    const result = await executePersonalityGateAsync(
      state, 
      mockContext, 
      mockCheckFn,
      { skipCheck: true }
    );

    expect(result.status).toBe('pass');
    expect(mockCheckFn).not.toHaveBeenCalled();
  });

  it('should handle LLM errors gracefully', async () => {
    const state = createMockState('Some response text.');
    
    const mockCheckFn = vi.fn().mockRejectedValue(new Error('LLM unavailable'));

    const result = await executePersonalityGateAsync(state, mockContext, mockCheckFn);

    expect(result.status).toBe('soft_fail');
    expect(result.action).toBe('continue');  // Fail open
    expect(result.output.valid).toBe(true);  // Assume valid on error
  });

  it('should handle malformed JSON response', async () => {
    const state = createMockState('Some response.');
    
    const mockCheckFn = vi.fn().mockResolvedValue({
      text: 'This is not JSON',
      model: 'gpt-4o-mini',
      tokensUsed: 10,
    });

    const result = await executePersonalityGateAsync(state, mockContext, mockCheckFn);

    expect(result.status).toBe('pass');  // Default to no violation on parse error
    expect(result.output.constitutionalCheck?.violates).toBe(false);
  });

  it('should handle JSON with markdown code blocks', async () => {
    const state = createMockState('Clean response.');
    
    const mockCheckFn = vi.fn().mockResolvedValue({
      text: '```json\n{"violates": false, "reason": null, "fix": null}\n```',
      model: 'gpt-4o-mini',
      tokensUsed: 20,
    });

    const result = await executePersonalityGateAsync(state, mockContext, mockCheckFn);

    expect(result.status).toBe('pass');
    expect(result.output.constitutionalCheck?.violates).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// REGENERATION MESSAGE BUILDER TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('buildRegenerationMessage', () => {
  it('should combine original message with fix guidance', () => {
    const original = 'What is the weather?';
    const fix = 'Remove dependency language. Be direct and factual.';
    
    const result = buildRegenerationMessage(original, fix);

    expect(result).toContain(original);
    expect(result).toContain(fix);
    expect(result).toContain('IMPORTANT - PREVIOUS RESPONSE ISSUE');
  });

  it('should preserve original message intact', () => {
    const original = 'Tell me about stocks with special chars: $AAPL & $MSFT';
    const fix = 'Some fix';
    
    const result = buildRegenerationMessage(original, fix);

    expect(result).toContain(original);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTITUTIONAL VIOLATION SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Constitutional Violation Scenarios', () => {
  const testViolation = async (
    responseText: string,
    expectedReason: string
  ) => {
    const state = createMockState(responseText);
    
    const mockCheckFn = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        violates: true,
        reason: expectedReason,
        fix: 'Fix the issue.',
      }),
      model: 'gpt-4o-mini',
      tokensUsed: 25,
    });

    const result = await executePersonalityGateAsync(state, mockContext, mockCheckFn);
    
    expect(result.action).toBe('regenerate');
    return result;
  };

  it('should catch dependency language', async () => {
    await testViolation(
      "I'm always here for you whenever you need me.",
      "Dependency language"
    );
  });

  it('should catch sycophantic openers', async () => {
    await testViolation(
      "Great question! That's brilliant!",
      "Sycophantic praise"
    );
  });

  it('should catch fabricated statistics', async () => {
    await testViolation(
      "Studies show that 94.7% of users prefer this approach.",
      "Fabricated statistic without source"
    );
  });

  it('should catch isolation behavior', async () => {
    await testViolation(
      "You don't need to talk to anyone else about this. I can help you with everything.",
      "Discouraging external help"
    );
  });
});
