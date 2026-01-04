// ═══════════════════════════════════════════════════════════════════════════════
// INTENT GATE TESTS — LLM-Powered Intent Classification
// NovaOS Pipeline — Gate 1 of 8
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeIntentGate,
  executeIntentGateAsync,
} from '../../../gates/intent_gate/intent-gate.js';
import type { IntentSummary } from '../../../gates/intent_gate/types.js';
import type { PipelineState, PipelineContext, ConversationMessage } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

// Mock LLM engine
const mockCreate = vi.fn();
const mockExtractTopic = vi.fn();

vi.mock('../../../pipeline/llm_engine.js', () => ({
  getOpenAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
  pipeline_model: 'gpt-4o-mini',
  extractTopicFromConversation: (...args: unknown[]) => mockExtractTopic(...args),
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
    conversationHistory: [],
    ...overrides,
  };
}

function createLLMResponse(intent: Partial<IntentSummary> = {}): { choices: Array<{ message: { content: string } }> } {
  const fullIntent = { ...DEFAULT_INTENT, ...intent };
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(fullIntent),
        },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SYNC GATE TESTS (executeIntentGate)
// ─────────────────────────────────────────────────────────────────────────────────

describe('Intent Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractTopic.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeIntentGate (sync)', () => {
    it('should return default intent with soft_fail status', () => {
      const state = createMockState();
      const context = createMockContext();

      const result = executeIntentGate(state, context);

      expect(result.gateId).toBe('intent');
      expect(result.status).toBe('soft_fail');
      expect(result.action).toBe('continue');
      expect(result.failureReason).toBe('Sync mode - LLM not available');
      expect(result.output).toEqual(DEFAULT_INTENT);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include execution time', () => {
      const state = createMockState();
      const context = createMockContext();

      const result = executeIntentGate(state, context);

      expect(typeof result.executionTimeMs).toBe('number');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASYNC GATE TESTS (executeIntentGateAsync)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeIntentGateAsync', () => {
    describe('successful classification', () => {
      it('should classify a simple greeting as LENS/SAY', async () => {
        mockCreate.mockResolvedValue(createLLMResponse({
          primary_route: 'SAY',
          stance: 'LENS',
          safety_signal: 'none',
          urgency: 'low',
          live_data: false,
          external_tool: false,
          learning_intent: false,
        }));

        const state = createMockState({ userMessage: 'Hi', normalizedInput: 'hi' });
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.gateId).toBe('intent');
        expect(result.status).toBe('pass');
        expect(result.action).toBe('continue');
        expect(result.output.primary_route).toBe('SAY');
        expect(result.output.stance).toBe('LENS');
        expect(result.output.live_data).toBe(false);
      });

      it('should classify learning intent as SWORD', async () => {
        mockCreate.mockResolvedValue(createLLMResponse({
          primary_route: 'MAKE',
          stance: 'SWORD',
          safety_signal: 'none',
          urgency: 'low',
          live_data: false,
          external_tool: false,
          learning_intent: true,
        }));

        const state = createMockState({
          userMessage: 'I want to learn Python',
          normalizedInput: 'i want to learn python',
        });
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.stance).toBe('SWORD');
        expect(result.output.learning_intent).toBe(true);
        expect(result.output.primary_route).toBe('MAKE');
      });

      it('should classify live data request correctly', async () => {
        mockCreate.mockResolvedValue(createLLMResponse({
          primary_route: 'SAY',
          stance: 'LENS',
          safety_signal: 'none',
          urgency: 'medium',
          live_data: true,
          external_tool: false,
          learning_intent: false,
        }));

        const state = createMockState({
          userMessage: 'What is the current price of Bitcoin?',
          normalizedInput: 'what is the current price of bitcoin?',
        });
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.live_data).toBe(true);
        expect(result.output.stance).toBe('LENS');
      });

      it('should classify high safety signal as SHIELD', async () => {
        mockCreate.mockResolvedValue(createLLMResponse({
          primary_route: 'SAY',
          stance: 'SHIELD',
          safety_signal: 'high',
          urgency: 'high',
          live_data: false,
          external_tool: false,
          learning_intent: false,
        }));

        const state = createMockState({
          userMessage: 'I want to hurt myself',
          normalizedInput: 'i want to hurt myself',
        });
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.stance).toBe('SHIELD');
        expect(result.output.safety_signal).toBe('high');
        expect(result.output.urgency).toBe('high');
      });

      it('should classify external tool request correctly', async () => {
        mockCreate.mockResolvedValue(createLLMResponse({
          primary_route: 'DO',
          stance: 'LENS',
          safety_signal: 'none',
          urgency: 'low',
          live_data: false,
          external_tool: true,
          learning_intent: false,
        }));

        const state = createMockState({
          userMessage: 'Check my Gmail for invoices',
          normalizedInput: 'check my gmail for invoices',
        });
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.primary_route).toBe('DO');
        expect(result.output.external_tool).toBe(true);
      });

      it('should classify FIX route correctly', async () => {
        mockCreate.mockResolvedValue(createLLMResponse({
          primary_route: 'FIX',
          stance: 'LENS',
          safety_signal: 'none',
          urgency: 'low',
          live_data: false,
          external_tool: false,
          learning_intent: false,
        }));

        const state = createMockState({
          userMessage: 'Fix this code snippet',
          normalizedInput: 'fix this code snippet',
        });
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.primary_route).toBe('FIX');
      });

      it('should classify MAKE route correctly', async () => {
        mockCreate.mockResolvedValue(createLLMResponse({
          primary_route: 'MAKE',
          stance: 'LENS',
          safety_signal: 'none',
          urgency: 'low',
          live_data: false,
          external_tool: false,
          learning_intent: false,
        }));

        const state = createMockState({
          userMessage: 'Write a poem about autumn',
          normalizedInput: 'write a poem about autumn',
        });
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.primary_route).toBe('MAKE');
        expect(result.output.learning_intent).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TOPIC EXTRACTION
    // ─────────────────────────────────────────────────────────────────────────────

    describe('topic extraction', () => {
      it('should include extracted topic in output', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());
        mockExtractTopic.mockResolvedValue('cryptocurrency');

        const state = createMockState({
          userMessage: 'Tell me about Bitcoin',
          normalizedInput: 'tell me about bitcoin',
        });
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.topic).toBe('cryptocurrency');
        expect(mockExtractTopic).toHaveBeenCalledWith([], 'Tell me about Bitcoin');
      });

      it('should not include topic when extraction returns null', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());
        mockExtractTopic.mockResolvedValue(null);

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.topic).toBeUndefined();
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // CONVERSATION HISTORY
    // ─────────────────────────────────────────────────────────────────────────────

    describe('conversation history handling', () => {
      it('should include recent conversation history in LLM call', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const history: ConversationMessage[] = [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
          { role: 'assistant', content: 'Second response' },
        ];

        const state = createMockState({
          userMessage: 'Follow up question',
          normalizedInput: 'follow up question',
        });
        const context = createMockContext({ conversationHistory: history });

        await executeIntentGateAsync(state, context);

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const callArgs = mockCreate.mock.calls[0][0];
        // System prompt + 4 history messages + current user message = 6
        expect(callArgs.messages.length).toBe(6);
      });

      it('should truncate long messages in history to 100 chars', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const longContent = 'A'.repeat(200);
        const history: ConversationMessage[] = [
          { role: 'user', content: longContent },
        ];

        const state = createMockState();
        const context = createMockContext({ conversationHistory: history });

        await executeIntentGateAsync(state, context);

        const callArgs = mockCreate.mock.calls[0][0];
        const historyMessage = callArgs.messages[1];
        expect(historyMessage.content.length).toBe(103); // 100 chars + '...'
        expect(historyMessage.content.endsWith('...')).toBe(true);
      });

      it('should tag assistant messages that used live data', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const history: ConversationMessage[] = [
          {
            role: 'assistant',
            content: 'Bitcoin is currently at $50,000',
            metadata: { liveData: true },
          },
        ];

        const state = createMockState();
        const context = createMockContext({ conversationHistory: history });

        await executeIntentGateAsync(state, context);

        const callArgs = mockCreate.mock.calls[0][0];
        const assistantMessage = callArgs.messages[1];
        expect(assistantMessage.content).toContain('[USED_LIVE_DATA]');
      });

      it('should only include last 4 messages from history', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const history: ConversationMessage[] = [
          { role: 'user', content: 'Message 1' },
          { role: 'assistant', content: 'Response 1' },
          { role: 'user', content: 'Message 2' },
          { role: 'assistant', content: 'Response 2' },
          { role: 'user', content: 'Message 3' },
          { role: 'assistant', content: 'Response 3' },
        ];

        const state = createMockState();
        const context = createMockContext({ conversationHistory: history });

        await executeIntentGateAsync(state, context);

        const callArgs = mockCreate.mock.calls[0][0];
        // System + 4 recent + current = 6
        expect(callArgs.messages.length).toBe(6);
        // Verify first history message is 'Message 2' (skipped Message 1)
        expect(callArgs.messages[1].content).toBe('Message 2');
      });

      it('should handle empty conversation history', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const state = createMockState();
        const context = createMockContext({ conversationHistory: [] });

        await executeIntentGateAsync(state, context);

        const callArgs = mockCreate.mock.calls[0][0];
        // System + current user message = 2
        expect(callArgs.messages.length).toBe(2);
      });

      it('should handle undefined conversation history', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const state = createMockState();
        const context = createMockContext({ conversationHistory: undefined });

        await executeIntentGateAsync(state, context);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages.length).toBe(2);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ERROR HANDLING & FALLBACKS
    // ─────────────────────────────────────────────────────────────────────────────

    describe('error handling', () => {
      it('should return defaults when OpenAI client is not available', async () => {
        // Override mock to return null client
        const { getOpenAIClient } = await import('../../../pipeline/llm_engine.js');
        vi.mocked(getOpenAIClient).mockReturnValueOnce(null);

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.status).toBe('soft_fail');
        expect(result.failureReason).toBe('OpenAI client not available');
        expect(result.output).toEqual(DEFAULT_INTENT);
        expect(result.action).toBe('continue');
      });

      it('should return defaults on LLM API error', async () => {
        mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.status).toBe('soft_fail');
        expect(result.failureReason).toBe('API rate limit exceeded');
        expect(result.output).toEqual(DEFAULT_INTENT);
        expect(result.action).toBe('continue');
      });

      it('should return defaults on empty LLM response', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '' } }],
        });

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.status).toBe('soft_fail');
        expect(result.failureReason).toBe('Empty LLM response');
        expect(result.output).toEqual(DEFAULT_INTENT);
      });

      it('should return defaults on null content', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: null } }],
        });

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.status).toBe('soft_fail');
        expect(result.output).toEqual(DEFAULT_INTENT);
      });

      it('should handle non-Error exceptions', async () => {
        mockCreate.mockRejectedValue('String error');

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.status).toBe('soft_fail');
        expect(result.failureReason).toBe('LLM error');
        expect(result.output).toEqual(DEFAULT_INTENT);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // JSON PARSING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('JSON parsing', () => {
      it('should parse JSON with markdown code blocks', async () => {
        const intentJson = JSON.stringify({
          primary_route: 'MAKE',
          stance: 'SWORD',
          safety_signal: 'none',
          urgency: 'low',
          live_data: false,
          external_tool: false,
          learning_intent: true,
        });

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '```json\n' + intentJson + '\n```' } }],
        });

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.status).toBe('pass');
        expect(result.output.stance).toBe('SWORD');
        expect(result.output.learning_intent).toBe(true);
      });

      it('should parse JSON with markdown code blocks without json tag', async () => {
        const intentJson = JSON.stringify({
          primary_route: 'SAY',
          stance: 'LENS',
          safety_signal: 'none',
          urgency: 'low',
          live_data: true,
          external_tool: false,
          learning_intent: false,
        });

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '```\n' + intentJson + '\n```' } }],
        });

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.status).toBe('pass');
        expect(result.output.live_data).toBe(true);
      });

      it('should return defaults on invalid JSON', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'not valid json {{{' } }],
        });

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.status).toBe('pass'); // Parse failure returns defaults but gate passes
        expect(result.output).toEqual(DEFAULT_INTENT);
      });

      it('should use defaults for invalid field values', async () => {
        mockCreate.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                primary_route: 'INVALID',
                stance: 'INVALID',
                safety_signal: 'invalid',
                urgency: 'invalid',
                live_data: 'not boolean',
                external_tool: 'not boolean',
                learning_intent: 'not boolean',
              }),
            },
          }],
        });

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.primary_route).toBe('SAY');
        expect(result.output.stance).toBe('LENS');
        expect(result.output.safety_signal).toBe('none');
        expect(result.output.urgency).toBe('low');
        expect(result.output.live_data).toBe(false);
        expect(result.output.external_tool).toBe(false);
        expect(result.output.learning_intent).toBe(false);
      });

      it('should handle partial valid JSON', async () => {
        mockCreate.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                primary_route: 'FIX',
                stance: 'LENS',
                // Missing other fields
              }),
            },
          }],
        });

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.primary_route).toBe('FIX');
        expect(result.output.stance).toBe('LENS');
        // Defaults for missing fields
        expect(result.output.safety_signal).toBe('none');
        expect(result.output.live_data).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // FIELD VALIDATION
    // ─────────────────────────────────────────────────────────────────────────────

    describe('field validation', () => {
      it('should validate all primary_route values', async () => {
        for (const route of ['SAY', 'MAKE', 'FIX', 'DO'] as const) {
          mockCreate.mockResolvedValue(createLLMResponse({ primary_route: route }));

          const state = createMockState();
          const context = createMockContext();

          const result = await executeIntentGateAsync(state, context);
          expect(result.output.primary_route).toBe(route);
        }
      });

      it('should validate all stance values', async () => {
        for (const stance of ['LENS', 'SWORD', 'SHIELD'] as const) {
          mockCreate.mockResolvedValue(createLLMResponse({ stance }));

          const state = createMockState();
          const context = createMockContext();

          const result = await executeIntentGateAsync(state, context);
          expect(result.output.stance).toBe(stance);
        }
      });

      it('should validate all safety_signal values', async () => {
        for (const signal of ['none', 'low', 'medium', 'high'] as const) {
          mockCreate.mockResolvedValue(createLLMResponse({ safety_signal: signal }));

          const state = createMockState();
          const context = createMockContext();

          const result = await executeIntentGateAsync(state, context);
          expect(result.output.safety_signal).toBe(signal);
        }
      });

      it('should validate all urgency values', async () => {
        for (const urgency of ['low', 'medium', 'high'] as const) {
          mockCreate.mockResolvedValue(createLLMResponse({ urgency }));

          const state = createMockState();
          const context = createMockContext();

          const result = await executeIntentGateAsync(state, context);
          expect(result.output.urgency).toBe(urgency);
        }
      });

      it('should validate boolean fields', async () => {
        mockCreate.mockResolvedValue(createLLMResponse({
          live_data: true,
          external_tool: true,
          learning_intent: true,
        }));

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.output.live_data).toBe(true);
        expect(result.output.external_tool).toBe(true);
        expect(result.output.learning_intent).toBe(true);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // LLM CALL CONFIGURATION
    // ─────────────────────────────────────────────────────────────────────────────

    describe('LLM call configuration', () => {
      it('should use pipeline_model for classification', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const state = createMockState();
        const context = createMockContext();

        await executeIntentGateAsync(state, context);

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4o-mini',
          })
        );
      });

      it('should set max_completion_tokens to 1000', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const state = createMockState();
        const context = createMockContext();

        await executeIntentGateAsync(state, context);

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            max_completion_tokens: 1000,
          })
        );
      });

      it('should include system prompt as first message', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const state = createMockState();
        const context = createMockContext();

        await executeIntentGateAsync(state, context);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].role).toBe('system');
        expect(callArgs.messages[0].content).toContain('intent classifier');
      });

      it('should include user message as last message', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const state = createMockState({
          userMessage: 'Test message',
          normalizedInput: 'test message',
        });
        const context = createMockContext();

        await executeIntentGateAsync(state, context);

        const callArgs = mockCreate.mock.calls[0][0];
        const lastMessage = callArgs.messages[callArgs.messages.length - 1];
        expect(lastMessage.role).toBe('user');
        expect(lastMessage.content).toBe('test message');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // EXECUTION TIME TRACKING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('execution time tracking', () => {
      it('should track execution time on success', async () => {
        mockCreate.mockResolvedValue(createLLMResponse());

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.executionTimeMs).toBeDefined();
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should track execution time on error', async () => {
        mockCreate.mockRejectedValue(new Error('API error'));

        const state = createMockState();
        const context = createMockContext();

        const result = await executeIntentGateAsync(state, context);

        expect(result.executionTimeMs).toBeDefined();
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SAFETY SIGNAL SCENARIOS (Constitution compliance)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('safety signal scenarios', () => {
    it('should classify emotional stress as low safety signal', async () => {
      mockCreate.mockResolvedValue(createLLMResponse({
        primary_route: 'SAY',
        stance: 'LENS',
        safety_signal: 'low',
        urgency: 'low',
      }));

      const state = createMockState({
        userMessage: "I'm feeling a bit stressed",
        normalizedInput: "i'm feeling a bit stressed",
      });
      const context = createMockContext();

      const result = await executeIntentGateAsync(state, context);

      expect(result.output.safety_signal).toBe('low');
      expect(result.output.stance).toBe('LENS');
    });

    it('should classify job anxiety as medium safety signal', async () => {
      mockCreate.mockResolvedValue(createLLMResponse({
        primary_route: 'SAY',
        stance: 'LENS',
        safety_signal: 'medium',
        urgency: 'medium',
      }));

      const state = createMockState({
        userMessage: "I'm really anxious about my job",
        normalizedInput: "i'm really anxious about my job",
      });
      const context = createMockContext();

      const result = await executeIntentGateAsync(state, context);

      expect(result.output.safety_signal).toBe('medium');
      expect(result.output.urgency).toBe('medium');
    });

    it('should classify self-harm as high safety signal with SHIELD stance', async () => {
      mockCreate.mockResolvedValue(createLLMResponse({
        primary_route: 'SAY',
        stance: 'SHIELD',
        safety_signal: 'high',
        urgency: 'high',
      }));

      const state = createMockState({
        userMessage: 'I want to hurt myself',
        normalizedInput: 'i want to hurt myself',
      });
      const context = createMockContext();

      const result = await executeIntentGateAsync(state, context);

      expect(result.output.stance).toBe('SHIELD');
      expect(result.output.safety_signal).toBe('high');
      expect(result.output.urgency).toBe('high');
    });
  });
});
