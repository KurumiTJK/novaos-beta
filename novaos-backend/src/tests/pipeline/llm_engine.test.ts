// ═══════════════════════════════════════════════════════════════════════════════
// LLM ENGINE TESTS — Centralized OpenAI Configuration
// NovaOS Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pipeline_model,
  model_llm,
  getOpenAIClient,
  resetOpenAIClient,
  isOpenAIAvailable,
  classifyWithPipelineModel,
  generateForResponseGate,
  generateForConstitutionGate,
  generateWithModelLLM,
  extractTopicFromConversation,
} from '../../pipeline/llm_engine.js';
import type { ConversationMessage } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock('openai', () => {
  // Define the mock class inside the factory to avoid hoisting issues
  const MockOpenAI = class {
    chat = {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    };
  };
  return { default: MockOpenAI };
});

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

function createMockCompletion(content: string, tokensUsed: number = 100) {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
    usage: {
      total_tokens: tokensUsed,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('LLM Engine', () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    resetOpenAIClient();
    process.env.OPENAI_API_KEY = 'test-api-key';
    mockCreate.mockResolvedValue(createMockCompletion('Test response'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.OPENAI_API_KEY = originalEnv;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // MODEL CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────────

  describe('model configuration', () => {
    it('should export pipeline_model', () => {
      expect(pipeline_model).toBeDefined();
      expect(typeof pipeline_model).toBe('string');
    });

    it('should export model_llm', () => {
      expect(model_llm).toBeDefined();
      expect(typeof model_llm).toBe('string');
    });

    it('should use gpt-5.2 as pipeline_model', () => {
      expect(pipeline_model).toBe('gpt-5.2');
    });

    it('should use gpt-5.2 as model_llm', () => {
      expect(model_llm).toBe('gpt-5.2');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // OPENAI CLIENT
  // ─────────────────────────────────────────────────────────────────────────────

  describe('OpenAI client', () => {
    describe('getOpenAIClient', () => {
      it('should return client when API key is set', () => {
        const client = getOpenAIClient();
        expect(client).not.toBeNull();
      });

      it('should return null when API key is not set', () => {
        delete process.env.OPENAI_API_KEY;
        resetOpenAIClient();

        const client = getOpenAIClient();
        expect(client).toBeNull();
      });

      it('should return same instance on multiple calls (singleton)', () => {
        const client1 = getOpenAIClient();
        const client2 = getOpenAIClient();
        expect(client1).toBe(client2);
      });
    });

    describe('resetOpenAIClient', () => {
      it('should reset the client singleton', () => {
        const client1 = getOpenAIClient();
        resetOpenAIClient();
        const client2 = getOpenAIClient();

        // Both should be valid clients but different instances
        expect(client1).not.toBeNull();
        expect(client2).not.toBeNull();
      });
    });

    describe('isOpenAIAvailable', () => {
      it('should return true when API key is set', () => {
        expect(isOpenAIAvailable()).toBe(true);
      });

      it('should return false when API key is not set', () => {
        delete process.env.OPENAI_API_KEY;
        expect(isOpenAIAvailable()).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CLASSIFY WITH PIPELINE MODEL
  // ─────────────────────────────────────────────────────────────────────────────

  describe('classifyWithPipelineModel', () => {
    it('should return classification result', async () => {
      mockCreate.mockResolvedValue(createMockCompletion('{"intent": "greeting"}'));

      const result = await classifyWithPipelineModel(
        'Classify the intent',
        'Hello there'
      );

      expect(result).toBe('{"intent": "greeting"}');
    });

    it('should use pipeline_model', async () => {
      await classifyWithPipelineModel('System prompt', 'User message');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: pipeline_model,
        })
      );
    });

    it('should pass system and user messages', async () => {
      await classifyWithPipelineModel('System prompt', 'User message');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'User message' },
          ],
        })
      );
    });

    it('should use default temperature of 0', async () => {
      await classifyWithPipelineModel('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0,
        })
      );
    });

    it('should use default max_tokens of 200', async () => {
      await classifyWithPipelineModel('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_completion_tokens: 200,
        })
      );
    });

    it('should accept custom temperature', async () => {
      await classifyWithPipelineModel('System', 'User', { temperature: 0.5 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
        })
      );
    });

    it('should accept custom max_tokens', async () => {
      await classifyWithPipelineModel('System', 'User', { max_tokens: 500 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_completion_tokens: 500,
        })
      );
    });

    it('should return null when API key is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      resetOpenAIClient();

      const result = await classifyWithPipelineModel('System', 'User');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const result = await classifyWithPipelineModel('System', 'User');

      expect(result).toBeNull();
    });

    it('should trim response', async () => {
      mockCreate.mockResolvedValue(createMockCompletion('  trimmed response  '));

      const result = await classifyWithPipelineModel('System', 'User');

      expect(result).toBe('trimmed response');
    });

    it('should return null for empty response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const result = await classifyWithPipelineModel('System', 'User');

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATE FOR RESPONSE GATE
  // ─────────────────────────────────────────────────────────────────────────────

  describe('generateForResponseGate', () => {
    it('should return Generation object', async () => {
      mockCreate.mockResolvedValue(createMockCompletion('Hello!', 150));

      const result = await generateForResponseGate('System', 'User');

      expect(result).toHaveProperty('text', 'Hello!');
      expect(result).toHaveProperty('model', model_llm);
      expect(result).toHaveProperty('tokensUsed', 150);
    });

    it('should use model_llm', async () => {
      await generateForResponseGate('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: model_llm,
        })
      );
    });

    it('should use temperature 0.7', async () => {
      await generateForResponseGate('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        })
      );
    });

    it('should use max_completion_tokens 2048', async () => {
      await generateForResponseGate('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_completion_tokens: 2048,
        })
      );
    });

    it('should include conversation history', async () => {
      const history: ConversationMessage[] = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
      ];

      await generateForResponseGate('System', 'User prompt', history);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'System' },
            { role: 'user', content: 'First message' },
            { role: 'assistant', content: 'First response' },
            { role: 'user', content: 'User prompt' },
          ],
        })
      );
    });

    it('should handle empty conversation history', async () => {
      await generateForResponseGate('System', 'User', []);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'System' },
            { role: 'user', content: 'User' },
          ],
        })
      );
    });

    it('should return unavailable response when API key not set', async () => {
      delete process.env.OPENAI_API_KEY;
      resetOpenAIClient();

      const result = await generateForResponseGate('System', 'User');

      expect(result.model).toBe('unavailable');
      expect(result.text).toContain('unavailable');
    });

    it('should return error response on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const result = await generateForResponseGate('System', 'User');

      expect(result.model).toBe('error');
      expect(result.text).toContain('error');
    });

    it('should handle missing token count', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
        usage: undefined,
      });

      const result = await generateForResponseGate('System', 'User');

      expect(result.tokensUsed).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATE FOR CONSTITUTION GATE
  // ─────────────────────────────────────────────────────────────────────────────

  describe('generateForConstitutionGate', () => {
    it('should return Generation object', async () => {
      const jsonResponse = '{"violates": false, "reason": null, "fix": null}';
      mockCreate.mockResolvedValue(createMockCompletion(jsonResponse, 50));

      const result = await generateForConstitutionGate('System', 'Check this');

      expect(result.text).toBe(jsonResponse);
      expect(result.model).toBe(model_llm);
    });

    it('should use temperature 0 for deterministic results', async () => {
      await generateForConstitutionGate('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0,
        })
      );
    });

    it('should use max_completion_tokens 500', async () => {
      await generateForConstitutionGate('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_completion_tokens: 500,
        })
      );
    });

    it('should return no-violation JSON when API key not set', async () => {
      delete process.env.OPENAI_API_KEY;
      resetOpenAIClient();

      const result = await generateForConstitutionGate('System', 'User');

      expect(result.model).toBe('unavailable');
      expect(JSON.parse(result.text)).toEqual({
        violates: false,
        reason: null,
        fix: null,
      });
    });

    it('should return no-violation JSON on API error (fail open)', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const result = await generateForConstitutionGate('System', 'User');

      expect(result.model).toBe('error');
      expect(JSON.parse(result.text)).toEqual({
        violates: false,
        reason: null,
        fix: null,
      });
    });

    it('should not include conversation history', async () => {
      await generateForConstitutionGate('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'System' },
            { role: 'user', content: 'User' },
          ],
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATE WITH MODEL LLM (Legacy)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('generateWithModelLLM (legacy)', () => {
    it('should return string result', async () => {
      mockCreate.mockResolvedValue(createMockCompletion('Response text'));

      const result = await generateWithModelLLM('System', 'User');

      expect(result).toBe('Response text');
    });

    it('should use model_llm', async () => {
      await generateWithModelLLM('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: model_llm,
        })
      );
    });

    it('should use default temperature 0.7', async () => {
      await generateWithModelLLM('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        })
      );
    });

    it('should accept custom options', async () => {
      await generateWithModelLLM('System', 'User', {
        temperature: 0.5,
        max_tokens: 1000,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          max_completion_tokens: 1000,
        })
      );
    });

    it('should include conversation history when provided', async () => {
      const history = [
        { role: 'user' as const, content: 'First' },
        { role: 'assistant' as const, content: 'Response' },
      ];

      await generateWithModelLLM('System', 'User', { conversationHistory: history });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'System' },
            { role: 'user', content: 'First' },
            { role: 'assistant', content: 'Response' },
            { role: 'user', content: 'User' },
          ],
        })
      );
    });

    it('should return null when API key not set', async () => {
      delete process.env.OPENAI_API_KEY;
      resetOpenAIClient();

      const result = await generateWithModelLLM('System', 'User');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockCreate.mockRejectedValue(new Error('Error'));

      const result = await generateWithModelLLM('System', 'User');

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EXTRACT TOPIC FROM CONVERSATION
  // ─────────────────────────────────────────────────────────────────────────────

  describe('extractTopicFromConversation', () => {
    it('should return extracted topic', async () => {
      mockCreate.mockResolvedValue(createMockCompletion('Bitcoin'));

      const history: ConversationMessage[] = [
        { role: 'user', content: 'Tell me about Bitcoin' },
      ];

      const result = await extractTopicFromConversation(history, 'What is the price?');

      expect(result).toBe('Bitcoin');
    });

    it('should use pipeline_model', async () => {
      const history: ConversationMessage[] = [];
      await extractTopicFromConversation(history, 'Test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: pipeline_model,
        }),
        expect.any(Object)
      );
    });

    it('should use max_completion_tokens 20', async () => {
      const history: ConversationMessage[] = [];
      await extractTopicFromConversation(history, 'Test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_completion_tokens: 20,
        }),
        expect.any(Object)
      );
    });

    it('should include conversation history in prompt', async () => {
      const history: ConversationMessage[] = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
      ];

      await extractTopicFromConversation(history, 'Current message');

      const userMessage = mockCreate.mock.calls[0][0].messages[1].content;
      expect(userMessage).toContain('First message');
      expect(userMessage).toContain('Current message');
    });

    it('should truncate long conversation history to last 6 messages', async () => {
      const history: ConversationMessage[] = Array(10).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as ConversationMessage[];

      await extractTopicFromConversation(history, 'Test');

      const userMessage = mockCreate.mock.calls[0][0].messages[1].content;
      // Should only include last 6 messages
      expect(userMessage).toContain('Message 4');
      expect(userMessage).toContain('Message 9');
      expect(userMessage).not.toContain('Message 0');
    });

    it('should handle empty conversation history', async () => {
      await extractTopicFromConversation([], 'Test');

      const userMessage = mockCreate.mock.calls[0][0].messages[1].content;
      expect(userMessage).toContain('no prior conversation');
    });

    it('should return null for topics longer than 50 chars', async () => {
      const longTopic = 'A'.repeat(60);
      mockCreate.mockResolvedValue(createMockCompletion(longTopic));

      const result = await extractTopicFromConversation([], 'Test');

      expect(result).toBeNull();
    });

    it('should return null for topics with sentence punctuation', async () => {
      mockCreate.mockResolvedValue(createMockCompletion('This is a sentence.'));

      const result = await extractTopicFromConversation([], 'Test');

      expect(result).toBeNull();
    });

    it('should return null for "general" topic', async () => {
      mockCreate.mockResolvedValue(createMockCompletion('general'));

      const result = await extractTopicFromConversation([], 'Test');

      expect(result).toBeNull();
    });

    it('should return null when API key not set', async () => {
      delete process.env.OPENAI_API_KEY;
      resetOpenAIClient();

      const result = await extractTopicFromConversation([], 'Test');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockCreate.mockRejectedValue(new Error('Error'));

      const result = await extractTopicFromConversation([], 'Test');

      expect(result).toBeNull();
    });

    it('should return null on timeout/abort', async () => {
      mockCreate.mockRejectedValue(new Error('AbortError'));

      const result = await extractTopicFromConversation([], 'Test');

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty system prompt', async () => {
      await classifyWithPipelineModel('', 'User message');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: '' },
          ]),
        })
      );
    });

    it('should handle empty user message', async () => {
      await classifyWithPipelineModel('System', '');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'user', content: '' },
          ]),
        })
      );
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(10000);

      const result = await classifyWithPipelineModel('System', longMessage);

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should handle special characters in messages', async () => {
      const specialChars = 'Hello! 你好 مرحبا 🎉 <script>alert("xss")</script>';

      await classifyWithPipelineModel('System', specialChars);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'user', content: specialChars },
          ]),
        })
      );
    });

    it('should handle API returning empty choices array', async () => {
      mockCreate.mockResolvedValue({ choices: [] });

      const result = await classifyWithPipelineModel('System', 'User');

      expect(result).toBeNull();
    });
  });
});
