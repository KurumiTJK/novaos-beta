// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY GATE TESTS — Memory Detection and Storage
// NovaOS Pipeline — Gate 8 of 8
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeMemoryGateAsync,
} from '../../../gates/memory_gate/memory-gate.js';
import {
  hasMemoryKeyword,
  matchStrongPattern,
  MEMORY_KEYWORDS,
  STRONG_PATTERNS,
} from '../../../gates/memory_gate/patterns.js';
import {
  MemoryStore,
  initializeMemoryStore,
  getMemoryStore,
  isMemoryStoreInitialized,
  generateMemoryId,
} from '../../../gates/memory_gate/store.js';
import type {
  MemoryGateOutput,
  MemoryGateConfig,
  MemoryRecord,
} from '../../../gates/memory_gate/types.js';
import type { PipelineState, PipelineContext, IntentSummary, Generation } from '../../../types/index.js';
import type { KeyValueStore } from '../../../storage/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

const mockClassifyWithPipelineModel = vi.fn();

vi.mock('../../../pipeline/llm_engine.js', () => ({
  classifyWithPipelineModel: (...args: unknown[]) => mockClassifyWithPipelineModel(...args),
  pipeline_model: 'gpt-4o-mini',
}));

// Mock store module for gate tests
let mockStoreInitialized = true;
const mockStore = vi.fn();

vi.mock('../../../gates/memory_gate/store.js', async (importOriginal) => {
  const original = await importOriginal() as Record<string, unknown>;
  return {
    ...original,
    isMemoryStoreInitialized: () => mockStoreInitialized,
    getMemoryStore: () => ({
      store: mockStore,
    }),
  };
});

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
  text: "I'll remember that for you.",
  model: 'gpt-5.2',
  tokensUsed: 50,
};

function createMockState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    userMessage: 'Remember that I prefer dark mode',
    normalizedInput: 'remember that i prefer dark mode',
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

function createLLMResponse(isMemoryRequest: boolean): string {
  return JSON.stringify({ isMemoryRequest });
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Memory Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreInitialized = true;
    mockStore.mockResolvedValue(undefined);
    mockClassifyWithPipelineModel.mockResolvedValue(createLLMResponse(false));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EXECUTE MEMORY GATE ASYNC
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeMemoryGateAsync', () => {
    describe('basic functionality', () => {
      it('should return correct gate metadata', async () => {
        const state = createMockState();
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.gateId).toBe('memory');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should always continue (never blocks)', async () => {
        const state = createMockState();
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.action).toBe('continue');
      });

      it('should pass through response text', async () => {
        const responseText = 'Custom response text';
        const state = createMockState({
          generation: { text: responseText, model: 'gpt-5.2', tokensUsed: 20 },
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.text).toBe(responseText);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ROUTER LOGIC
    // ─────────────────────────────────────────────────────────────────────────────

    describe('router logic', () => {
      it('should skip when stance is not LENS', async () => {
        const state = createMockState({
          userMessage: 'Remember that I like Python',
          intent_summary: { ...DEFAULT_INTENT, stance: 'SWORD' },
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(false);
        expect(result.output.skipReason).toContain('stance=SWORD');
        expect(mockClassifyWithPipelineModel).not.toHaveBeenCalled();
      });

      it('should skip when stance is SHIELD', async () => {
        const state = createMockState({
          userMessage: 'Remember that I like Python',
          intent_summary: { ...DEFAULT_INTENT, stance: 'SHIELD' },
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.skipReason).toContain('stance=SHIELD');
      });

      it('should skip when primary_route is not SAY', async () => {
        const state = createMockState({
          userMessage: 'Remember that I like Python',
          intent_summary: { ...DEFAULT_INTENT, primary_route: 'MAKE' },
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(false);
        expect(result.output.skipReason).toContain('primary_route=MAKE');
      });

      it('should skip when no memory keyword present', async () => {
        const state = createMockState({
          userMessage: 'What is the weather today?',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(false);
        expect(result.output.skipReason).toContain('no memory keyword');
      });

      it('should proceed when all router conditions are met', async () => {
        const state = createMockState({
          userMessage: 'Remember my favorite color is blue',
          intent_summary: { ...DEFAULT_INTENT, stance: 'LENS', primary_route: 'SAY' },
        });
        const context = createMockContext();

        await executeMemoryGateAsync(state, context);

        // Should reach regex or LLM check - not skip early
        expect(mockStore).toHaveBeenCalled(); // Regex match triggers store
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // CONFIG OPTIONS
    // ─────────────────────────────────────────────────────────────────────────────

    describe('config options', () => {
      it('should skip when forceSkip is true', async () => {
        const state = createMockState();
        const context = createMockContext();
        const config: MemoryGateConfig = { forceSkip: true };

        const result = await executeMemoryGateAsync(state, context, config);

        expect(result.output.memoryDetected).toBe(false);
        expect(result.output.skipReason).toBe('forceSkip=true');
        expect(mockClassifyWithPipelineModel).not.toHaveBeenCalled();
      });

      it('should bypass router when forceRun is true', async () => {
        mockClassifyWithPipelineModel.mockResolvedValue(createLLMResponse(true));
        const state = createMockState({
          userMessage: 'No memory keywords here',
          intent_summary: { ...DEFAULT_INTENT, stance: 'SWORD' },
        });
        const context = createMockContext();
        const config: MemoryGateConfig = { forceRun: true };

        const result = await executeMemoryGateAsync(state, context, config);

        // LLM should be called because of forceRun
        expect(mockClassifyWithPipelineModel).toHaveBeenCalled();
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // STORE INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────────

    describe('store initialization', () => {
      it('should skip when store is not initialized', async () => {
        mockStoreInitialized = false;
        const state = createMockState();
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(false);
        expect(result.output.skipReason).toBe('store not initialized');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // REGEX DETECTION
    // ─────────────────────────────────────────────────────────────────────────────

    describe('regex detection', () => {
      it('should detect "remember this" pattern', async () => {
        const state = createMockState({
          userMessage: 'Remember this: I work at Google',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(true);
        expect(result.output.memoryStored).toBe(true);
        expect(mockClassifyWithPipelineModel).not.toHaveBeenCalled(); // Regex matched, no LLM needed
      });

      it('should detect "don\'t forget" pattern', async () => {
        const state = createMockState({
          userMessage: "Don't forget my birthday is March 5th",
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(true);
        expect(result.output.memoryStored).toBe(true);
      });

      it('should detect "keep this in mind" pattern via LLM', async () => {
        // Note: "keep this in mind" doesn't contain MEMORY_KEYWORDS (which has "keep track", not "keep")
        // So this would be skipped by the router. Testing a message that does pass:
        mockClassifyWithPipelineModel.mockResolvedValue(createLLMResponse(true));
        const state = createMockState({
          userMessage: 'Note: keep this in mind for later', // "note" is a keyword
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(true);
      });

      it('should detect "note this" pattern', async () => {
        const state = createMockState({
          userMessage: 'Note this: I use vim',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(true);
      });

      it('should detect "save this" pattern', async () => {
        const state = createMockState({
          userMessage: 'Save this information',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(true);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // LLM FALLBACK
    // ─────────────────────────────────────────────────────────────────────────────

    describe('LLM fallback', () => {
      it('should use LLM when no regex match but has keyword', async () => {
        mockClassifyWithPipelineModel.mockResolvedValue(createLLMResponse(true));
        const state = createMockState({
          userMessage: 'I prefer morning meetings, remember', // Has keyword but no strong pattern
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(mockClassifyWithPipelineModel).toHaveBeenCalled();
        expect(result.output.memoryDetected).toBe(true);
      });

      it('should not store memory when LLM says no', async () => {
        mockClassifyWithPipelineModel.mockResolvedValue(createLLMResponse(false));
        const state = createMockState({
          userMessage: 'I need to recall something from our notes', // Has keyword but weak pattern
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(mockClassifyWithPipelineModel).toHaveBeenCalled();
        expect(result.output.memoryDetected).toBe(false);
        expect(result.output.memoryStored).toBe(false);
      });

      it('should handle null LLM response', async () => {
        mockClassifyWithPipelineModel.mockResolvedValue(null);
        const state = createMockState({
          userMessage: 'I prefer dark mode, remember',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(false);
        expect(result.output.memoryStored).toBe(false);
      });

      it('should handle malformed LLM JSON response', async () => {
        mockClassifyWithPipelineModel.mockResolvedValue('not valid json');
        const state = createMockState({
          userMessage: 'I prefer dark mode, remember',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        // Should default to no memory request on parse error
        expect(result.output.memoryDetected).toBe(false);
      });

      it('should handle JSON with markdown code blocks', async () => {
        mockClassifyWithPipelineModel.mockResolvedValue('```json\n{"isMemoryRequest": true}\n```');
        const state = createMockState({
          userMessage: 'I prefer morning meetings, remember',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryDetected).toBe(true);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ERROR HANDLING
    // ─────────────────────────────────────────────────────────────────────────────

    describe('error handling', () => {
      it('should soft_fail and pass through on LLM error', async () => {
        mockClassifyWithPipelineModel.mockRejectedValue(new Error('API timeout'));
        const state = createMockState({
          userMessage: 'My favorite color is blue, remember',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.status).toBe('soft_fail');
        expect(result.action).toBe('continue');
        expect(result.output.memoryDetected).toBe(false);
        expect(result.output.skipReason).toBe('LLM check failed');
      });

      it('should include execution time on error', async () => {
        mockClassifyWithPipelineModel.mockRejectedValue(new Error('Error'));
        const state = createMockState({
          userMessage: 'My favorite color is blue, remember',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // MEMORY RECORD
    // ─────────────────────────────────────────────────────────────────────────────

    describe('memory record', () => {
      it('should include memory record in output when stored', async () => {
        const state = createMockState({
          userMessage: 'Remember this: I am a developer',
        });
        const context = createMockContext({ userId: 'user_456' });

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryRecord).toBeDefined();
        expect(result.output.memoryRecord?.userId).toBe('user_456');
        expect(result.output.memoryRecord?.userMessage).toBe('Remember this: I am a developer');
        expect(result.output.memoryRecord?.source).toBe('regex');
      });

      it('should set source to "llm" when detected by LLM', async () => {
        mockClassifyWithPipelineModel.mockResolvedValue(createLLMResponse(true));
        const state = createMockState({
          userMessage: 'I prefer morning meetings, remember',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryRecord?.source).toBe('llm');
      });

      it('should use "anonymous" when userId is not provided', async () => {
        const state = createMockState({
          userMessage: 'Remember this: test',
        });
        const context = createMockContext({ userId: undefined });

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryRecord?.userId).toBe('anonymous');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OUTPUT STRUCTURE
    // ─────────────────────────────────────────────────────────────────────────────

    describe('output structure', () => {
      it('should return all required output fields', async () => {
        const state = createMockState();
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output).toHaveProperty('text');
        expect(result.output).toHaveProperty('memoryDetected');
        expect(result.output).toHaveProperty('memoryStored');
      });

      it('should include skipReason when skipped', async () => {
        const state = createMockState({
          userMessage: 'What is the weather today?', // No memory keywords
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.skipReason).toBeDefined();
        expect(result.output.skipReason).toContain('no memory keyword');
      });

      it('should not include memoryRecord when not stored', async () => {
        const state = createMockState({
          userMessage: 'What is the weather?',
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.memoryRecord).toBeUndefined();
      });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEXT SOURCE
    // ─────────────────────────────────────────────────────────────────────────────

    describe('text source', () => {
      it('should prefer validatedOutput text over generation text', async () => {
        const state = createMockState({
          userMessage: 'What is the weather?',
          generation: { text: 'Generation text', model: 'gpt-5.2', tokensUsed: 10 },
          validatedOutput: { text: 'Validated text', valid: true, edited: false, violations: [] },
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.text).toBe('Validated text');
      });

      it('should fall back to generation text when validatedOutput is undefined', async () => {
        const state = createMockState({
          userMessage: 'What is the weather?',
          generation: { text: 'Generation text', model: 'gpt-5.2', tokensUsed: 10 },
          validatedOutput: undefined,
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.text).toBe('Generation text');
      });

      it('should return empty string when both are undefined', async () => {
        const state = createMockState({
          userMessage: 'What is the weather?',
          generation: undefined,
          validatedOutput: undefined,
        });
        const context = createMockContext();

        const result = await executeMemoryGateAsync(state, context);

        expect(result.output.text).toBe('');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PATTERN MATCHING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Pattern Matching', () => {
    describe('hasMemoryKeyword', () => {
      it('should detect "remember"', () => {
        expect(hasMemoryKeyword('Remember my birthday')).toBe(true);
        expect(hasMemoryKeyword('Can you remember this?')).toBe(true);
      });

      it('should detect "memory"', () => {
        expect(hasMemoryKeyword('Save this to memory')).toBe(true);
      });

      it('should detect "forget"', () => {
        expect(hasMemoryKeyword("Don't forget this")).toBe(true);
        expect(hasMemoryKeyword('Forget what I said')).toBe(true);
      });

      it('should detect "note"', () => {
        expect(hasMemoryKeyword('Note this down')).toBe(true);
      });

      it('should detect "save"', () => {
        expect(hasMemoryKeyword('Save this information')).toBe(true);
      });

      it('should detect "store"', () => {
        expect(hasMemoryKeyword('Store this for later')).toBe(true);
      });

      it('should detect "keep track"', () => {
        expect(hasMemoryKeyword('Keep track of this')).toBe(true);
      });

      it('should detect "recall"', () => {
        expect(hasMemoryKeyword('Can you recall what I said?')).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(hasMemoryKeyword('REMEMBER this')).toBe(true);
        expect(hasMemoryKeyword('ReMeMbEr this')).toBe(true);
      });

      it('should return false for no keywords', () => {
        expect(hasMemoryKeyword('What is the weather?')).toBe(false);
        expect(hasMemoryKeyword('Help me with my code')).toBe(false);
      });
    });

    describe('matchStrongPattern', () => {
      it('should match "remember this"', () => {
        const match = matchStrongPattern('Remember this: I work at Google');
        expect(match).not.toBeNull();
      });

      it('should match "remember that"', () => {
        const match = matchStrongPattern('Remember that I prefer dark mode');
        expect(match).not.toBeNull();
      });

      it('should match "don\'t forget"', () => {
        const match = matchStrongPattern("Don't forget my birthday");
        expect(match).not.toBeNull();
      });

      it('should match "dont forget" (without apostrophe)', () => {
        const match = matchStrongPattern('Dont forget my birthday');
        expect(match).not.toBeNull();
      });

      it('should match "keep in mind"', () => {
        const match = matchStrongPattern('Keep in mind that I use vim');
        expect(match).not.toBeNull();
      });

      it('should match "keep this in mind"', () => {
        const match = matchStrongPattern('Keep this in mind');
        expect(match).not.toBeNull();
      });

      it('should match "note this"', () => {
        const match = matchStrongPattern('Note this: I am allergic to peanuts');
        expect(match).not.toBeNull();
      });

      it('should match "note that"', () => {
        const match = matchStrongPattern('Note that I work remotely');
        expect(match).not.toBeNull();
      });

      it('should match "save this"', () => {
        const match = matchStrongPattern('Save this information');
        expect(match).not.toBeNull();
      });

      it('should match "store this"', () => {
        const match = matchStrongPattern('Store this for later');
        expect(match).not.toBeNull();
      });

      it('should return null for weak patterns', () => {
        const match = matchStrongPattern('I prefer dark mode, remember');
        expect(match).toBeNull();
      });

      it('should return null for non-memory messages', () => {
        const match = matchStrongPattern('What is the weather today?');
        expect(match).toBeNull();
      });

      it('should match "remember" followed by content (even recall-style)', () => {
        // Note: The current regex /\bremember:?\s+(.+)/i matches this
        // even though semantically it's a recall request, not a store request.
        // The LLM fallback is responsible for distinguishing these cases.
        const match = matchStrongPattern('Remember when we talked about X?');
        expect(match).not.toBeNull();
      });
    });

    describe('MEMORY_KEYWORDS regex', () => {
      it('should be a valid regex', () => {
        expect(MEMORY_KEYWORDS).toBeInstanceOf(RegExp);
      });

      it('should have case insensitive flag', () => {
        expect(MEMORY_KEYWORDS.flags).toContain('i');
      });
    });

    describe('STRONG_PATTERNS', () => {
      it('should be an array of regexes', () => {
        expect(Array.isArray(STRONG_PATTERNS)).toBe(true);
        STRONG_PATTERNS.forEach(pattern => {
          expect(pattern).toBeInstanceOf(RegExp);
        });
      });

      it('should have case insensitive patterns', () => {
        STRONG_PATTERNS.forEach(pattern => {
          expect(pattern.flags).toContain('i');
        });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // MEMORY ID GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  describe('generateMemoryId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateMemoryId();
      const id2 = generateMemoryId();
      expect(id1).not.toBe(id2);
    });

    it('should start with "mem_" prefix', () => {
      const id = generateMemoryId();
      expect(id.startsWith('mem_')).toBe(true);
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const id = generateMemoryId();
      const after = Date.now();

      const parts = id.split('_');
      const timestamp = parseInt(parts[1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty user message', async () => {
      const state = createMockState({ userMessage: '' });
      const context = createMockContext();

      const result = await executeMemoryGateAsync(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.memoryDetected).toBe(false);
    });

    it('should handle very long user message', async () => {
      const longMessage = 'Remember this: ' + 'A'.repeat(5000);
      const state = createMockState({ userMessage: longMessage });
      const context = createMockContext();

      const result = await executeMemoryGateAsync(state, context);

      expect(result.status).toBe('pass');
      expect(result.output.memoryDetected).toBe(true);
    });

    it('should handle missing context fields gracefully', async () => {
      const state = createMockState();
      const context: PipelineContext = {};

      const result = await executeMemoryGateAsync(state, context);

      expect(result.status).toBe('pass');
    });

    it('should handle undefined intent_summary', async () => {
      const state = createMockState({
        userMessage: 'Remember this test',
        intent_summary: undefined,
      });
      const context = createMockContext();

      const result = await executeMemoryGateAsync(state, context);

      // Should use defaults (LENS/SAY) from nullish coalescing
      expect(result.status).toBe('pass');
    });

    it('should handle special characters in message', async () => {
      const state = createMockState({
        userMessage: 'Remember this: my email is test@example.com & password is "secret123!"',
      });
      const context = createMockContext();

      const result = await executeMemoryGateAsync(state, context);

      expect(result.output.memoryDetected).toBe(true);
      expect(result.output.memoryRecord?.userMessage).toContain('test@example.com');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NON-MEMORY SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('non-memory scenarios', () => {
    it('should not detect recall requests as memory storage when LLM says no', async () => {
      mockClassifyWithPipelineModel.mockResolvedValue(createLLMResponse(false));
      const state = createMockState({
        userMessage: 'Can you recall our last conversation?', // Has keyword, weak pattern
      });
      const context = createMockContext();

      const result = await executeMemoryGateAsync(state, context);

      expect(mockClassifyWithPipelineModel).toHaveBeenCalled();
      expect(result.output.memoryDetected).toBe(false);
    });

    it('should not detect knowledge questions as memory storage when LLM says no', async () => {
      mockClassifyWithPipelineModel.mockResolvedValue(createLLMResponse(false));
      const state = createMockState({
        userMessage: 'Help me recall Python syntax', // Has keyword, weak pattern
      });
      const context = createMockContext();

      const result = await executeMemoryGateAsync(state, context);

      expect(mockClassifyWithPipelineModel).toHaveBeenCalled();
      expect(result.output.memoryDetected).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY STORE UNIT TESTS (Separate describe block with unmocked store)
// ─────────────────────────────────────────────────────────────────────────────────

describe('MemoryStore', () => {
  let mockKVStore: KeyValueStore;
  let store: MemoryStore;
  let dataMap: Map<string, string>;
  let setMap: Map<string, Set<string>>;

  beforeEach(() => {
    dataMap = new Map();
    setMap = new Map();

    mockKVStore = {
      get: vi.fn(async (key: string) => dataMap.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        dataMap.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        const existed = dataMap.has(key);
        dataMap.delete(key);
        return existed;
      }),
      exists: vi.fn(async (key: string) => dataMap.has(key)),
      keys: vi.fn(async () => Array.from(dataMap.keys())),
      incr: vi.fn(),
      expire: vi.fn(),
      lpush: vi.fn(),
      lrange: vi.fn(),
      ltrim: vi.fn(),
      sadd: vi.fn(async (key: string, value: string) => {
        if (!setMap.has(key)) setMap.set(key, new Set());
        setMap.get(key)!.add(value);
        return 1;
      }),
      smembers: vi.fn(async (key: string) => Array.from(setMap.get(key) ?? [])),
      srem: vi.fn(async (key: string, value: string) => {
        const set = setMap.get(key);
        if (!set) return 0;
        const existed = set.has(value);
        set.delete(value);
        return existed ? 1 : 0;
      }),
      scard: vi.fn(async (key: string) => setMap.get(key)?.size ?? 0),
    } as unknown as KeyValueStore;

    // Create store directly (not via singleton)
    store = new MemoryStore(mockKVStore);
  });

  describe('store', () => {
    it('should store a memory record', async () => {
      const record: MemoryRecord = {
        id: 'mem_123',
        userId: 'user_456',
        userMessage: 'Remember this',
        generatedResponse: 'Okay, I will remember that.',
        source: 'regex',
        timestamp: Date.now(),
      };

      await store.store(record);

      expect(mockKVStore.set).toHaveBeenCalledWith(
        'memory:user_456:mem_123',
        expect.any(String)
      );
      expect(mockKVStore.sadd).toHaveBeenCalledWith(
        'memory:user_456:_index',
        'mem_123'
      );
    });
  });

  describe('getAll', () => {
    it('should return all memories for a user sorted by timestamp', async () => {
      const record1: MemoryRecord = {
        id: 'mem_1',
        userId: 'user_123',
        userMessage: 'First',
        generatedResponse: 'OK',
        source: 'regex',
        timestamp: 1000,
      };
      const record2: MemoryRecord = {
        id: 'mem_2',
        userId: 'user_123',
        userMessage: 'Second',
        generatedResponse: 'OK',
        source: 'llm',
        timestamp: 2000,
      };

      await store.store(record1);
      await store.store(record2);

      const results = await store.getAll('user_123');

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('mem_2'); // Newest first
      expect(results[1].id).toBe('mem_1');
    });

    it('should return empty array for user with no memories', async () => {
      const results = await store.getAll('nonexistent_user');
      expect(results).toEqual([]);
    });
  });

  describe('get', () => {
    it('should return a specific memory by ID', async () => {
      const record: MemoryRecord = {
        id: 'mem_specific',
        userId: 'user_123',
        userMessage: 'Test',
        generatedResponse: 'Response',
        source: 'regex',
        timestamp: Date.now(),
      };

      await store.store(record);
      const retrieved = await store.get('user_123', 'mem_specific');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('mem_specific');
    });

    it('should return null for non-existent memory', async () => {
      const result = await store.get('user_123', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a memory', async () => {
      const record: MemoryRecord = {
        id: 'mem_to_delete',
        userId: 'user_123',
        userMessage: 'Delete me',
        generatedResponse: 'OK',
        source: 'regex',
        timestamp: Date.now(),
      };

      await store.store(record);
      const deleted = await store.delete('user_123', 'mem_to_delete');

      expect(deleted).toBe(true);
      expect(mockKVStore.srem).toHaveBeenCalledWith(
        'memory:user_123:_index',
        'mem_to_delete'
      );
    });

    it('should return false for non-existent memory', async () => {
      const deleted = await store.delete('user_123', 'nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('count', () => {
    it('should return count of memories for a user', async () => {
      const record1: MemoryRecord = {
        id: 'mem_1',
        userId: 'user_count',
        userMessage: 'First',
        generatedResponse: 'OK',
        source: 'regex',
        timestamp: Date.now(),
      };
      const record2: MemoryRecord = {
        id: 'mem_2',
        userId: 'user_count',
        userMessage: 'Second',
        generatedResponse: 'OK',
        source: 'llm',
        timestamp: Date.now(),
      };

      await store.store(record1);
      await store.store(record2);

      const count = await store.count('user_count');
      expect(count).toBe(2);
    });

    it('should return 0 for user with no memories', async () => {
      const count = await store.count('no_memories');
      expect(count).toBe(0);
    });
  });
});
