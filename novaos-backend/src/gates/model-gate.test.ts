// ═══════════════════════════════════════════════════════════════════════════════
// MODEL GATE — Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  stitchPrompt,
  executeModelGate,
  executeModelGateAsync,
  DEFAULT_PERSONALITY,
} from './model-gate.js';

import type { PipelineState, PipelineContext } from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function createMockState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    userMessage: 'What is AAPL trading at?',
    normalizedInput: 'What is AAPL trading at?',
    gateResults: {},
    flags: {},
    timestamps: { pipelineStart: Date.now() },
    intent: {
      type: 'question',
      domain: 'finance',
      confidence: 0.95,
    },
    shieldResult: {
      riskLevel: 'safe',
    },
    stance: 'lens',
    ...overrides,
  };
}

function createMockContext(): PipelineContext {
  return {
    requestId: 'test-123',
    userId: 'user-456',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STITCH PROMPT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('stitchPrompt', () => {
  it('should build system prompt with personality', () => {
    const state = createMockState();
    const { system } = stitchPrompt(state);

    expect(system).toContain('Given the following personality:');
    expect(system).toContain('ROLE: Nova, personal assistant');
    expect(system).toContain('TONE: Allow light conversational softeners');
    expect(system).toContain('PERSONALITY: Be concise and direct');
  });

  it('should build user prompt with message', () => {
    const state = createMockState();
    const { user } = stitchPrompt(state);

    expect(user).toContain('What is AAPL trading at?');
  });

  it('should include context block with intent and shield', () => {
    const state = createMockState();
    const { user } = stitchPrompt(state);

    expect(user).toContain('CONTEXT:');
    expect(user).toContain('Intent: question / finance');
    expect(user).toContain('Shield: safe');
  });

  it('should include evidence block when capabilities have evidence', () => {
    const state = createMockState({
      capabilities: {
        route: 'lens',
        capabilitiesUsed: ['stock_fetcher'],
        evidenceItems: [
          {
            type: 'stock',
            formatted: 'AAPL (NASDAQ)\nPrice: $150.25 USD\nChange: +$2.15 (+1.45%)',
            source: 'stock_fetcher',
            fetchedAt: Date.now(),
          },
        ],
      } as any,
    });

    const { user } = stitchPrompt(state);

    expect(user).toContain('EVIDENCE:');
    expect(user).toContain('[STOCK]');
    expect(user).toContain('AAPL (NASDAQ)');
    expect(user).toContain('$150.25');
    expect(user).toContain('Use this data in your response.');
  });

  it('should omit evidence block when no evidence', () => {
    const state = createMockState({
      capabilities: {
        route: 'lens',
        capabilitiesUsed: [],
        evidenceItems: [],
      } as any,
    });

    const { user } = stitchPrompt(state);

    expect(user).not.toContain('EVIDENCE:');
  });

  it('should show fetch failure when capabilities used but no evidence', () => {
    const state = createMockState({
      capabilities: {
        route: 'lens',
        capabilitiesUsed: ['weather_fetcher'],
        evidenceItems: [],
      } as any,
    });

    const { user } = stitchPrompt(state);

    expect(user).toContain('EVIDENCE:');
    expect(user).toContain('FETCH FAILED');
    expect(user).toContain('weather_fetcher');
    expect(user).toContain('offer alternatives');
  });

  it('should allow custom personality override', () => {
    const state = createMockState();
    const { system } = stitchPrompt(state, {
      personality: {
        role: 'Custom Assistant',
        tone: 'Be very formal.',
        personality: 'Always use proper grammar.',
      },
    });

    expect(system).toContain('ROLE: Custom Assistant');
    expect(system).toContain('TONE: Be very formal.');
    expect(system).toContain('PERSONALITY: Always use proper grammar.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE MODEL GATE (SYNC) TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('executeModelGate (sync/mock)', () => {
  it('should return mock response based on stance', () => {
    const state = createMockState({ stance: 'lens' });
    const context = createMockContext();

    const result = executeModelGate(state, context);

    expect(result.status).toBe('pass');
    expect(result.output.text).toContain("Here's what I understand");
    expect(result.output.model).toBe('mock');
  });

  it('should return control response for control stance', () => {
    const state = createMockState({ stance: 'control' });
    const context = createMockContext();

    const result = executeModelGate(state, context);

    expect(result.output.text).toContain('difficult time');
  });

  it('should return sword response for sword stance', () => {
    const state = createMockState({ stance: 'sword' });
    const context = createMockContext();

    const result = executeModelGate(state, context);

    expect(result.output.text).toContain('next step');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE MODEL GATE (ASYNC) TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('executeModelGateAsync', () => {
  it('should call generateFn with stitched prompt', async () => {
    const state = createMockState();
    const context = createMockContext();

    const mockGenerateFn = vi.fn().mockResolvedValue({
      text: 'AAPL is currently at $150.25, up 1.45% today.',
      model: 'gpt-4o',
      tokensUsed: 50,
    });

    const result = await executeModelGateAsync(state, context, mockGenerateFn);

    expect(mockGenerateFn).toHaveBeenCalledTimes(1);
    
    // Check user prompt (first arg)
    const userPrompt = mockGenerateFn.mock.calls[0][0];
    expect(userPrompt).toContain('What is AAPL trading at?');
    expect(userPrompt).toContain('CONTEXT:');

    // Check system prompt (second arg)
    const systemPrompt = mockGenerateFn.mock.calls[0][1];
    expect(systemPrompt).toContain('ROLE: Nova, personal assistant');

    expect(result.status).toBe('pass');
    expect(result.output.text).toBe('AAPL is currently at $150.25, up 1.45% today.');
    expect(result.output.model).toBe('gpt-4o');
  });

  it('should include evidence in user prompt', async () => {
    const state = createMockState({
      capabilities: {
        route: 'lens',
        capabilitiesUsed: ['stock_fetcher'],
        evidenceItems: [
          {
            type: 'stock',
            formatted: 'AAPL: $150.25',
            source: 'stock_fetcher',
            fetchedAt: Date.now(),
          },
        ],
      } as any,
    });
    const context = createMockContext();

    const mockGenerateFn = vi.fn().mockResolvedValue({
      text: 'Response with evidence',
      model: 'gpt-4o',
      tokensUsed: 30,
    });

    await executeModelGateAsync(state, context, mockGenerateFn);

    const userPrompt = mockGenerateFn.mock.calls[0][0];
    expect(userPrompt).toContain('EVIDENCE:');
    expect(userPrompt).toContain('AAPL: $150.25');
  });

  it('should handle errors gracefully', async () => {
    const state = createMockState();
    const context = createMockContext();

    const mockGenerateFn = vi.fn().mockRejectedValue(new Error('API Error'));

    const result = await executeModelGateAsync(state, context, mockGenerateFn);

    expect(result.status).toBe('soft_fail');
    expect(result.output.fallbackUsed).toBe(true);
    expect(result.output.text).toContain('technical difficulties');
    expect(result.failureReason).toBe('API Error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT PERSONALITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_PERSONALITY', () => {
  it('should have required fields', () => {
    expect(DEFAULT_PERSONALITY.role).toBe('Nova, personal assistant');
    expect(DEFAULT_PERSONALITY.tone).toContain('conversational softeners');
    expect(DEFAULT_PERSONALITY.personality).toContain('concise');
    expect(DEFAULT_PERSONALITY.personality).toContain('Never fabricate');
  });
});
