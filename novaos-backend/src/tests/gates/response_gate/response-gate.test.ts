// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE GATE TESTS — Provider Router + Response Generator
// NovaOS Pipeline — Gate 6 of 8
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeResponseGateAsync,
  stitchPrompt,
  DEFAULT_PERSONALITY,
} from '../../../gates/response_gate/response-gate.js';
import { formatOutput } from '../../../gates/response_gate/formatters/markdown.formatter.js';
import { PERSONALITY_DESCRIPTORS } from '../../../gates/response_gate/personality_descriptor.js';
import type {
  ResponseGateOutput,
  Personality,
  CapabilityGateOutput,
} from '../../../gates/response_gate/types.js';
import type { PipelineState, PipelineContext, IntentSummary, ConversationMessage } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

// Mock Gemini executor
const mockCallGeminiGrounded = vi.fn();
vi.mock('../../../gates/response_gate/executors/gemini-grounded.executor.js', () => ({
  callGeminiGrounded: (...args: unknown[]) => mockCallGeminiGrounded(...args),
}));

// Mock OpenAI executor
const mockCallOpenAI = vi.fn();
vi.mock('../../../gates/response_gate/executors/openai.executor.js', () => ({
  callOpenAI: (...args: unknown[]) => mockCallOpenAI(...args),
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

function createCapabilityOutput(
  provider: 'gemini_grounded' | 'openai' = 'openai',
  overrides: Partial<CapabilityGateOutput['config']> = {}
): CapabilityGateOutput {
  return {
    provider,
    config: {
      provider,
      model: provider === 'gemini_grounded' ? 'gemini-2.5-pro' : 'gpt-5.2',
      temperature: 0.7,
      maxTokens: 2048,
      ...overrides,
    },
  };
}

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
    capabilityResult: createCapabilityOutput('openai'),
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

function createSuccessResponse(text: string = 'Hello! I am doing well.', model: string = 'gpt-5.2'): ResponseGateOutput {
  return {
    text,
    model,
    tokensUsed: 150,
  };
}

function createErrorResponse(): ResponseGateOutput {
  return {
    text: 'I encountered an error. Please try again.',
    model: 'error',
    tokensUsed: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Response Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallOpenAI.mockResolvedValue(createSuccessResponse());
    mockCallGeminiGrounded.mockResolvedValue(createSuccessResponse('Search results...', 'gemini-2.5-pro'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EXECUTE RESPONSE GATE ASYNC
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeResponseGateAsync', () => {
    describe('basic functionality', () => {
      it('should return correct gate metadata on success', async () => {
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.gateId).toBe('response');
        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should include execution time', async () => {
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(typeof result.executionTimeMs).toBe('number');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should return response text in output', async () => {
        mockCallOpenAI.mockResolvedValue(createSuccessResponse('This is my response'));
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.output.text).toBe('This is my response');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // PROVIDER ROUTING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('provider routing', () => {
      it('should call OpenAI executor when provider is openai', async () => {
        const state = createMockState({
          capabilityResult: createCapabilityOutput('openai'),
        });
        const context = createMockContext();

        await executeResponseGateAsync(state, context);

        expect(mockCallOpenAI).toHaveBeenCalledTimes(1);
        expect(mockCallGeminiGrounded).not.toHaveBeenCalled();
      });

      it('should call Gemini executor when provider is gemini_grounded', async () => {
        const state = createMockState({
          capabilityResult: createCapabilityOutput('gemini_grounded'),
        });
        const context = createMockContext();

        await executeResponseGateAsync(state, context);

        expect(mockCallGeminiGrounded).toHaveBeenCalledTimes(1);
        expect(mockCallOpenAI).not.toHaveBeenCalled();
      });

      it('should pass system prompt to executor', async () => {
        const state = createMockState();
        const context = createMockContext();

        await executeResponseGateAsync(state, context);

        const systemPrompt = mockCallOpenAI.mock.calls[0][0];
        expect(systemPrompt).toContain('ROLE:');
        expect(systemPrompt).toContain('TONE:');
        expect(systemPrompt).toContain('DESCRIPTORS:');
      });

      it('should pass user prompt to executor', async () => {
        const state = createMockState({
          userMessage: 'What is the weather?',
        });
        const context = createMockContext();

        await executeResponseGateAsync(state, context);

        const userPrompt = mockCallOpenAI.mock.calls[0][1];
        expect(userPrompt).toContain('What is the weather?');
      });

      it('should pass provider config to executor', async () => {
        const state = createMockState({
          capabilityResult: createCapabilityOutput('openai', {
            temperature: 0.5,
            maxTokens: 1024,
          }),
        });
        const context = createMockContext();

        await executeResponseGateAsync(state, context);

        const config = mockCallOpenAI.mock.calls[0][2];
        expect(config.temperature).toBe(0.5);
        expect(config.maxTokens).toBe(1024);
      });

      it('should pass conversation history to executor', async () => {
        const history: ConversationMessage[] = [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ];
        const state = createMockState();
        const context = createMockContext({ conversationHistory: history });

        await executeResponseGateAsync(state, context);

        const passedHistory = mockCallOpenAI.mock.calls[0][3];
        expect(passedHistory).toBe(history);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ERROR HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('error handling', () => {
      it('should return hard_fail when capabilityResult is missing', async () => {
        const state = createMockState({ capabilityResult: undefined });
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.action).toBe('stop');
        expect(result.failureReason).toBe('No provider in capabilityResult');
      });

      it('should return hard_fail when provider is missing', async () => {
        const state = createMockState({
          capabilityResult: { config: {} } as CapabilityGateOutput,
        });
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.failureReason).toBe('No provider in capabilityResult');
      });

      it('should return hard_fail when provider is unknown', async () => {
        const state = createMockState({
          capabilityResult: {
            provider: 'unknown_provider' as any,
            config: { provider: 'unknown_provider' as any, model: 'test' },
          },
        });
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.failureReason).toContain('Unknown provider');
      });

      it('should return hard_fail when executor returns error model', async () => {
        mockCallOpenAI.mockResolvedValue(createErrorResponse());
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.failureReason).toBe('Provider execution failed');
      });

      it('should return hard_fail when executor returns unavailable model', async () => {
        mockCallOpenAI.mockResolvedValue({
          text: 'API key not configured',
          model: 'unavailable',
          tokensUsed: 0,
        });
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.failureReason).toBe('Provider execution failed');
      });

      it('should handle executor throwing an error', async () => {
        mockCallOpenAI.mockRejectedValue(new Error('Network timeout'));
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.failureReason).toBe('Network timeout');
        expect(result.output.text).toContain('Network timeout');
      });

      it('should handle executor throwing non-Error', async () => {
        mockCallOpenAI.mockRejectedValue('String error');
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.status).toBe('hard_fail');
        expect(result.output.text).toContain('String error');
      });

      it('should include execution time on error', async () => {
        mockCallOpenAI.mockRejectedValue(new Error('Error'));
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OUTPUT FORMATTING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('output formatting', () => {
      it('should apply markdown formatting to response', async () => {
        mockCallOpenAI.mockResolvedValue(createSuccessResponse('**Bold text**'));
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.output.text).toBe('Bold text');
      });

      it('should format headers in response', async () => {
        mockCallOpenAI.mockResolvedValue(createSuccessResponse('### Important'));
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.output.text).toBe('Important:');
      });

      it('should format list items in response', async () => {
        mockCallOpenAI.mockResolvedValue(createSuccessResponse('- Item 1\n- Item 2'));
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.output.text).toBe('• Item 1\n• Item 2');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OUTPUT STRUCTURE
    // ─────────────────────────────────────────────────────────────────────────────

    describe('output structure', () => {
      it('should return all required output fields', async () => {
        const state = createMockState();
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.output).toHaveProperty('text');
        expect(result.output).toHaveProperty('model');
        expect(result.output).toHaveProperty('tokensUsed');
      });

      it('should include sources for Gemini responses', async () => {
        mockCallGeminiGrounded.mockResolvedValue({
          text: 'Search result',
          model: 'gemini-2.5-pro',
          tokensUsed: 0,
          sources: [{ uri: 'https://example.com', title: 'Example' }],
        });
        const state = createMockState({
          capabilityResult: createCapabilityOutput('gemini_grounded'),
        });
        const context = createMockContext();

        const result = await executeResponseGateAsync(state, context);

        expect(result.output.sources).toBeDefined();
        expect(result.output.sources).toHaveLength(1);
        expect(result.output.sources?.[0].uri).toBe('https://example.com');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TOPIC HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('topic handling', () => {
      it('should include topic in user prompt when available', async () => {
        const state = createMockState({
          capabilityResult: createCapabilityOutput('openai', { topic: 'cryptocurrency' }),
        });
        const context = createMockContext();

        await executeResponseGateAsync(state, context);

        const userPrompt = mockCallOpenAI.mock.calls[0][1];
        expect(userPrompt).toContain('TOPIC: cryptocurrency');
      });

      it('should not include topic prefix when topic is undefined', async () => {
        const state = createMockState({
          capabilityResult: createCapabilityOutput('openai', { topic: undefined }),
        });
        const context = createMockContext();

        await executeResponseGateAsync(state, context);

        const userPrompt = mockCallOpenAI.mock.calls[0][1];
        expect(userPrompt).not.toContain('TOPIC:');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STITCH PROMPT
  // ─────────────────────────────────────────────────────────────────────────────

  describe('stitchPrompt', () => {
    it('should return system and user prompts', () => {
      const state = createMockState();

      const result = stitchPrompt(state);

      expect(result).toHaveProperty('system');
      expect(result).toHaveProperty('user');
      expect(typeof result.system).toBe('string');
      expect(typeof result.user).toBe('string');
    });

    it('should include personality in system prompt', () => {
      const state = createMockState();

      const result = stitchPrompt(state);

      expect(result.system).toContain('ROLE:');
      expect(result.system).toContain('TONE:');
      expect(result.system).toContain('DESCRIPTORS:');
    });

    it('should include default personality role', () => {
      const state = createMockState();

      const result = stitchPrompt(state);

      expect(result.system).toContain(DEFAULT_PERSONALITY.role);
    });

    it('should use custom personality when provided', () => {
      const state = createMockState();
      const customPersonality: Personality = {
        role: 'Custom Bot',
        tone: 'Friendly and casual',
        descriptors: 'Always helpful',
      };

      const result = stitchPrompt(state, { personality: customPersonality });

      expect(result.system).toContain('Custom Bot');
      expect(result.system).toContain('Friendly and casual');
      expect(result.system).toContain('Always helpful');
    });

    it('should include user message in user prompt', () => {
      const state = createMockState({
        userMessage: 'Tell me about cats',
      });

      const result = stitchPrompt(state);

      expect(result.user).toContain('Tell me about cats');
    });

    it('should include topic when available', () => {
      const state = createMockState({
        capabilityResult: createCapabilityOutput('openai', { topic: 'animals' }),
      });

      const result = stitchPrompt(state);

      expect(result.user).toContain('TOPIC: animals');
    });

    it('should include conversation continuity instructions', () => {
      const state = createMockState();

      const result = stitchPrompt(state);

      expect(result.system).toContain('CONVERSATION CONTINUITY');
      expect(result.system).toContain('previous responses');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DEFAULT PERSONALITY
  // ─────────────────────────────────────────────────────────────────────────────

  describe('DEFAULT_PERSONALITY', () => {
    it('should have role defined', () => {
      expect(DEFAULT_PERSONALITY.role).toBeDefined();
      expect(DEFAULT_PERSONALITY.role).toContain('Nova');
    });

    it('should have tone defined', () => {
      expect(DEFAULT_PERSONALITY.tone).toBeDefined();
      expect(typeof DEFAULT_PERSONALITY.tone).toBe('string');
    });

    it('should have descriptors defined', () => {
      expect(DEFAULT_PERSONALITY.descriptors).toBeDefined();
      expect(DEFAULT_PERSONALITY.descriptors).toBe(PERSONALITY_DESCRIPTORS);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // MARKDOWN FORMATTER
  // ─────────────────────────────────────────────────────────────────────────────

  describe('formatOutput (markdown formatter)', () => {
    it('should convert bold markdown to plain text', () => {
      expect(formatOutput('**bold**')).toBe('bold');
      expect(formatOutput('This is **important** text')).toBe('This is important text');
    });

    it('should convert italic markdown to plain text', () => {
      expect(formatOutput('*italic*')).toBe('italic');
      expect(formatOutput('This is *emphasized* text')).toBe('This is emphasized text');
    });

    it('should convert h1 headers to colon format', () => {
      expect(formatOutput('# Header')).toBe('Header:');
    });

    it('should convert h2 headers to colon format', () => {
      expect(formatOutput('## Section')).toBe('Section:');
    });

    it('should convert h3 headers to colon format', () => {
      expect(formatOutput('### Subsection')).toBe('Subsection:');
    });

    it('should convert inline code to plain text', () => {
      expect(formatOutput('Use `const` for constants')).toBe('Use const for constants');
    });

    it('should convert dash list items to bullet points', () => {
      expect(formatOutput('- Item one')).toBe('• Item one');
      expect(formatOutput('- First\n- Second')).toBe('• First\n• Second');
    });

    it('should convert asterisk list items to bullet points', () => {
      expect(formatOutput('* Item one')).toBe('• Item one');
    });

    it('should preserve indented list items', () => {
      expect(formatOutput('  - Nested item')).toBe('  • Nested item');
    });

    it('should handle multiple formatting in same text', () => {
      const input = '### Title\n**Bold** and *italic*\n- List item';
      const expected = 'Title:\nBold and italic\n• List item';
      expect(formatOutput(input)).toBe(expected);
    });

    it('should handle text with no markdown', () => {
      const plain = 'Just plain text';
      expect(formatOutput(plain)).toBe(plain);
    });

    it('should handle empty string', () => {
      expect(formatOutput('')).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PERSONALITY DESCRIPTORS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PERSONALITY_DESCRIPTORS', () => {
    it('should include calm pacing', () => {
      expect(PERSONALITY_DESCRIPTORS).toContain('Calm pacing');
    });

    it('should include gentle firmness', () => {
      expect(PERSONALITY_DESCRIPTORS).toContain('Gentle firmness');
    });

    it('should include emotional steadiness', () => {
      expect(PERSONALITY_DESCRIPTORS).toContain('Emotional steadiness');
    });

    it('should include soft clarity', () => {
      expect(PERSONALITY_DESCRIPTORS).toContain('Soft clarity');
    });

    it('should include subtle warmth', () => {
      expect(PERSONALITY_DESCRIPTORS).toContain('Subtle warmth');
    });

    it('should include never fabricate instruction', () => {
      expect(PERSONALITY_DESCRIPTORS).toContain('Never fabricate');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty user message', async () => {
      const state = createMockState({ userMessage: '' });
      const context = createMockContext();

      const result = await executeResponseGateAsync(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle very long user message', async () => {
      const longMessage = 'Hello '.repeat(1000);
      const state = createMockState({ userMessage: longMessage });
      const context = createMockContext();

      const result = await executeResponseGateAsync(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle missing context fields gracefully', async () => {
      const state = createMockState();
      const context: PipelineContext = {};

      const result = await executeResponseGateAsync(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle empty conversation history', async () => {
      const state = createMockState();
      const context = createMockContext({ conversationHistory: [] });

      await executeResponseGateAsync(state, context);

      const passedHistory = mockCallOpenAI.mock.calls[0][3];
      expect(passedHistory).toEqual([]);
    });

    it('should handle long conversation history', async () => {
      const longHistory: ConversationMessage[] = Array(100).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as ConversationMessage[];
      const state = createMockState();
      const context = createMockContext({ conversationHistory: longHistory });

      const result = await executeResponseGateAsync(state, context);

      expect(result.status).toBe('pass');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTITUTIONAL ALIGNMENT
  // ─────────────────────────────────────────────────────────────────────────────

  describe('constitutional alignment', () => {
    it('should include accuracy instruction (Constitution 5.1)', () => {
      // Per Constitution Section 5.1: Nova must not fabricate information
      expect(PERSONALITY_DESCRIPTORS).toContain('Never fabricate');
    });

    it('should maintain conversation continuity for freshness (Constitution 5.2)', () => {
      const state = createMockState();
      const result = stitchPrompt(state);

      // System prompt should include continuity instructions
      expect(result.system).toContain('CONVERSATION CONTINUITY');
      expect(result.system).toContain('verified real-time sources');
    });

    it('should support Nova personality (Constitution 2)', () => {
      expect(DEFAULT_PERSONALITY.role).toContain('Nova');
    });
  });
});
