// ═══════════════════════════════════════════════════════════════════════════════
// MODEL GATE — Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeModelGate,
  executeModelGateAsync,
  stitchPrompt,
  DEFAULT_PERSONALITY,
} from './model-gate.js';
import type { PipelineState, PipelineContext } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function createMockState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    userMessage: 'What is the price of NVDA?',
    normalizedInput: 'what is the price of nvda',
    intent: {
      type: 'question',
      complexity: 'low',
      isHypothetical: false,
      domains: ['finance'],
      confidence: 0.9,
    },
    shieldResult: {
      safe: true,
      riskLevel: 'safe',
    },
    stance: 'lens',
    ...overrides,
  } as PipelineState;
}

function createMockContext(): PipelineContext {
  return {
    conversationId: 'test-conv',
    userId: 'test-user',
  } as PipelineContext;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STITCHPROMPT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('stitchPrompt', () => {
  it('should include personality in system prompt', () => {
    const state = createMockState();
    const { system } = stitchPrompt(state);

    expect(system).toContain('ROLE:');
    expect(system).toContain('TONE:');
    expect(system).toContain('PERSONALITY:');
    expect(system).toContain(DEFAULT_PERSONALITY.role);
  });

  it('should include user message in user prompt', () => {
    const state = createMockState({ userMessage: 'Hello there!' });
    const { user } = stitchPrompt(state);

    expect(user).toContain('Hello there!');
  });

  it('should include context hints when intent is present', () => {
    const state = createMockState({
      intent: {
        type: 'question',
        complexity: 'low',
        isHypothetical: false,
        domains: ['finance'],
        confidence: 0.9,
      },
    });

    const { user } = stitchPrompt(state);

    expect(user).toContain('CONTEXT:');
    expect(user).toContain('Intent: question / finance');
  });

  it('should include evidence when capabilities returned data', () => {
    const state = createMockState({
      capabilities: {
        route: 'lens',
        capabilitiesUsed: ['stock_fetcher'],
        evidenceItems: [
          {
            type: 'stock',
            formatted: 'NVDA (NASDAQ)\nPrice: $450.00\nChange: +2.5%',
            source: 'finnhub',
            fetchedAt: Date.now(),
          },
        ],
      } as any,
    });

    const { user } = stitchPrompt(state);

    expect(user).toContain('EVIDENCE:');
    expect(user).toContain('[STOCK]');
    expect(user).toContain('NVDA');
    expect(user).toContain('Use this data in your response');
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

  it('should add control mode instructions when shield is in control mode', () => {
    const state = createMockState({
      shieldResult: {
        safe: false,
        riskLevel: 'critical',
        controlMode: true,
      },
    });

    const { system } = stitchPrompt(state);

    expect(system).toContain('CRITICAL');
    expect(system).toContain('crisis');
  });

  it('should include risk hint when shield detected risk', () => {
    const state = createMockState({
      shieldResult: {
        safe: false,
        riskLevel: 'medium',
      },
    });

    const { user } = stitchPrompt(state);

    expect(user).toContain('Risk: medium');
  });

  it('should allow custom personality override', () => {
    const state = createMockState();
    const customPersonality = {
      role: 'Custom Bot',
      tone: 'Very formal',
      personality: 'Always serious',
    };

    const { system } = stitchPrompt(state, { personality: customPersonality });

    expect(system).toContain('Custom Bot');
    expect(system).toContain('Very formal');
    expect(system).toContain('Always serious');
    expect(system).not.toContain(DEFAULT_PERSONALITY.role);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SYNC GATE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('executeModelGate (sync/mock)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should return a mock response', () => {
    const state = createMockState();
    const context = createMockContext();

    const result = executeModelGate(state, context);

    expect(result.gateId).toBe('model');
    expect(result.status).toBe('pass');
    expect(result.output.text).toBeTruthy();
    expect(result.output.model).toBe('mock-v1');
  });

  it('should return question response for question intent', () => {
    const state = createMockState({
      intent: { type: 'question', complexity: 'low', isHypothetical: false, domains: [], confidence: 0.9 },
    });
    const context = createMockContext();

    const result = executeModelGate(state, context);

    expect(result.output.text).toContain('information');
  });

  it('should return greeting response for greeting intent', () => {
    const state = createMockState({
      intent: { type: 'greeting', complexity: 'low', isHypothetical: false, domains: [], confidence: 0.9 },
    });
    const context = createMockContext();

    const result = executeModelGate(state, context);

    expect(result.output.text).toContain('Hello');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC GATE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('executeModelGateAsync', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should call generateFn with stitched prompt', async () => {
    const state = createMockState();
    const context = createMockContext();
    const mockGenerate = vi.fn().mockResolvedValue({
      text: 'NVDA is trading at $450',
      model: 'gpt-4o-mini',
      tokensUsed: 10,
    });

    const result = await executeModelGateAsync(state, context, mockGenerate);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.stringContaining('What is the price of NVDA'),
      expect.stringContaining('ROLE:'),
    );
    expect(result.status).toBe('pass');
    expect(result.output.text).toBe('NVDA is trading at $450');
    expect(result.output.model).toBe('gpt-4o-mini');
  });

  it('should fall back to mock on error', async () => {
    const state = createMockState();
    const context = createMockContext();
    const mockGenerate = vi.fn().mockRejectedValue(new Error('API error'));

    const result = await executeModelGateAsync(state, context, mockGenerate);

    expect(result.status).toBe('pass');
    expect(result.output.model).toBe('mock-v1');
    expect(result.output.fallbackUsed).toBe(true);
  });

  it('should include evidence in prompt when available', async () => {
    const state = createMockState({
      capabilities: {
        route: 'lens',
        capabilitiesUsed: ['stock_fetcher'],
        evidenceItems: [
          {
            type: 'stock',
            formatted: 'NVDA: $450.00',
            source: 'finnhub',
            fetchedAt: Date.now(),
          },
        ],
      } as any,
    });
    const context = createMockContext();
    const mockGenerate = vi.fn().mockResolvedValue({
      text: 'Response',
      model: 'gpt-4o-mini',
      tokensUsed: 5,
    });

    await executeModelGateAsync(state, context, mockGenerate);

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.stringContaining('EVIDENCE:'),
      expect.any(String),
    );
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.stringContaining('NVDA: $450.00'),
      expect.any(String),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PERSONALITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_PERSONALITY', () => {
  it('should have role, tone, and personality', () => {
    expect(DEFAULT_PERSONALITY.role).toBeTruthy();
    expect(DEFAULT_PERSONALITY.tone).toBeTruthy();
    expect(DEFAULT_PERSONALITY.personality).toBeTruthy();
  });

  it('should include no-markdown instruction in tone', () => {
    expect(DEFAULT_PERSONALITY.tone).toContain('Never use markdown');
    expect(DEFAULT_PERSONALITY.tone).toContain('plain text');
  });

  it('should include key personality traits', () => {
    expect(DEFAULT_PERSONALITY.personality).toContain('concise');
    expect(DEFAULT_PERSONALITY.personality).toContain('fabricate');
    expect(DEFAULT_PERSONALITY.personality).toContain('autonomy');
  });
});
