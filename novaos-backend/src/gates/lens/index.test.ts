// ═══════════════════════════════════════════════════════════════════════════════
// LENS GATE TESTS — Simple LLM Router
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeLensGateAsync,
  executeLensGate,
  resetOpenAIClient,
  type LensResult,
  type DataType,
} from './index.js';
import type { PipelineState, PipelineContext } from '../../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════════

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

function createMockState(message: string): PipelineState {
  return {
    userMessage: message,
    normalizedInput: message.trim(),
    gateResults: {} as any,
    flags: {},
    timestamps: { pipelineStart: Date.now() },
  };
}

function createMockContext(): PipelineContext {
  return {
    requestId: 'test-123',
    userId: 'user-123',
  };
}

function mockLLMResponse(response: {
  needsExternalData: boolean;
  dataType: DataType;
  confidence: number;
  reasoning: string;
}) {
  mockCreate.mockResolvedValueOnce({
    choices: [{
      message: {
        content: JSON.stringify(response),
      },
    }],
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('LensGate - Simple LLM Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOpenAIClient();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('executeLensGateAsync', () => {
    it('should return needsExternalData: false for greetings', async () => {
      mockLLMResponse({
        needsExternalData: false,
        dataType: 'none',
        confidence: 0.99,
        reasoning: 'Social greeting',
      });

      const state = createMockState('Hi there');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.needsExternalData).toBe(false);
      expect(result.output.dataType).toBe('none');
      expect(result.output.confidence).toBeGreaterThan(0.9);
    });

    it('should return realtime for stock price queries', async () => {
      mockLLMResponse({
        needsExternalData: true,
        dataType: 'realtime',
        confidence: 0.98,
        reasoning: 'Stock price requires live data',
      });

      const state = createMockState("What's AAPL trading at?");
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(true);
      expect(result.output.dataType).toBe('realtime');
    });

    it('should return realtime for weather queries', async () => {
      mockLLMResponse({
        needsExternalData: true,
        dataType: 'realtime',
        confidence: 0.97,
        reasoning: 'Weather requires live data',
      });

      const state = createMockState("What's the weather in Tokyo?");
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(true);
      expect(result.output.dataType).toBe('realtime');
    });

    it('should return realtime for time queries', async () => {
      mockLLMResponse({
        needsExternalData: true,
        dataType: 'realtime',
        confidence: 0.99,
        reasoning: 'Current time requires live data',
      });

      const state = createMockState('What time is it in London?');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(true);
      expect(result.output.dataType).toBe('realtime');
    });

    it('should return realtime for crypto queries', async () => {
      mockLLMResponse({
        needsExternalData: true,
        dataType: 'realtime',
        confidence: 0.98,
        reasoning: 'Crypto price requires live data',
      });

      const state = createMockState('Bitcoin price');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(true);
      expect(result.output.dataType).toBe('realtime');
    });

    it('should return realtime for FX queries', async () => {
      mockLLMResponse({
        needsExternalData: true,
        dataType: 'realtime',
        confidence: 0.97,
        reasoning: 'FX rate requires live data',
      });

      const state = createMockState('USD to EUR exchange rate');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(true);
      expect(result.output.dataType).toBe('realtime');
    });

    it('should return web_search for recent news', async () => {
      mockLLMResponse({
        needsExternalData: true,
        dataType: 'web_search',
        confidence: 0.95,
        reasoning: 'Current news requires search',
      });

      const state = createMockState('What happened in the news today?');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(true);
      expect(result.output.dataType).toBe('web_search');
    });

    it('should return web_search for "who is CEO" queries', async () => {
      mockLLMResponse({
        needsExternalData: true,
        dataType: 'web_search',
        confidence: 0.85,
        reasoning: 'CEO position could have changed',
      });

      const state = createMockState('Who is the CEO of Apple?');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(true);
      expect(result.output.dataType).toBe('web_search');
    });

    it('should return none for coding questions', async () => {
      mockLLMResponse({
        needsExternalData: false,
        dataType: 'none',
        confidence: 0.97,
        reasoning: 'Coding from knowledge',
      });

      const state = createMockState('Help me write a Python function');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(false);
      expect(result.output.dataType).toBe('none');
    });

    it('should return none for stable facts', async () => {
      mockLLMResponse({
        needsExternalData: false,
        dataType: 'none',
        confidence: 0.99,
        reasoning: 'Stable fact from knowledge',
      });

      const state = createMockState('What is the capital of France?');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(false);
      expect(result.output.dataType).toBe('none');
    });

    it('should return none for creative writing', async () => {
      mockLLMResponse({
        needsExternalData: false,
        dataType: 'none',
        confidence: 0.99,
        reasoning: 'Creative content from knowledge',
      });

      const state = createMockState('Tell me a joke');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(false);
      expect(result.output.dataType).toBe('none');
    });

    it('should return none for math questions', async () => {
      mockLLMResponse({
        needsExternalData: false,
        dataType: 'none',
        confidence: 0.99,
        reasoning: 'Math computation',
      });

      const state = createMockState('What is 15 * 23?');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.needsExternalData).toBe(false);
      expect(result.output.dataType).toBe('none');
    });

    it('should include intent info in prompt when available', async () => {
      mockLLMResponse({
        needsExternalData: false,
        dataType: 'none',
        confidence: 0.9,
        reasoning: 'Test',
      });

      const state = createMockState('Test message');
      state.intent = {
        type: 'question',
        primaryDomain: 'finance',
        confidence: 0.9,
        complexity: 'low',
        isHypothetical: false,
        domains: ['finance'],
      };
      const context = createMockContext();

      await executeLensGateAsync(state, context);

      // Verify the prompt included intent info
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;
      expect(userMessage).toContain('Intent:');
      expect(userMessage).toContain('question');
      expect(userMessage).toContain('finance');
    });

    it('should handle LLM errors gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState('Test message');
      const context = createMockContext();

      await expect(executeLensGateAsync(state, context)).rejects.toThrow();
    });

    it('should handle malformed JSON response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'not valid json',
          },
        }],
      });

      const state = createMockState('Test message');
      const context = createMockContext();

      await expect(executeLensGateAsync(state, context)).rejects.toThrow('Failed to parse');
    });

    it('should validate dataType and default to none', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              needsExternalData: true,
              dataType: 'invalid_type',
              confidence: 0.9,
              reasoning: 'Test',
            }),
          },
        }],
      });

      const state = createMockState('Test message');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.dataType).toBe('none');
    });

    it('should track execution time', async () => {
      mockLLMResponse({
        needsExternalData: false,
        dataType: 'none',
        confidence: 0.9,
        reasoning: 'Test',
      });

      const state = createMockState('Test');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeLensGate (sync fallback)', () => {
    it('should return safe defaults without LLM', () => {
      const state = createMockState('Test message');
      const context = createMockContext();

      const result = executeLensGate(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.needsExternalData).toBe(false);
      expect(result.output.dataType).toBe('none');
      expect(result.output.confidence).toBe(0.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', async () => {
      mockLLMResponse({
        needsExternalData: false,
        dataType: 'none',
        confidence: 0.5,
        reasoning: 'Empty message',
      });

      const state = createMockState('');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle very long message', async () => {
      mockLLMResponse({
        needsExternalData: false,
        dataType: 'none',
        confidence: 0.8,
        reasoning: 'Long message',
      });

      const longMessage = 'a'.repeat(10000);
      const state = createMockState(longMessage);
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle missing confidence in response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              needsExternalData: true,
              dataType: 'realtime',
              reasoning: 'Test',
              // confidence missing
            }),
          },
        }],
      });

      const state = createMockState('Stock price');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.confidence).toBe(0.8); // default
    });

    it('should handle missing reasoning in response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              needsExternalData: false,
              dataType: 'none',
              confidence: 0.9,
              // reasoning missing
            }),
          },
        }],
      });

      const state = createMockState('Test');
      const context = createMockContext();

      const result = await executeLensGateAsync(state, context);

      expect(result.output.reason).toBe('No reasoning provided');
    });
  });
});
