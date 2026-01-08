// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION PIPELINE TESTS — Gate Orchestration
// NovaOS Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExecutionPipeline } from '../../pipeline/execution-pipeline.js';
import type { PipelineContext, PipelineResult, GateResult } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

// Mock all gate functions
const mockExecuteIntentGateAsync = vi.fn();
const mockExecuteShieldGateAsync = vi.fn(); // Changed to async
const mockExecuteToolsGate = vi.fn();
const mockExecuteStanceGateAsync = vi.fn();
const mockExecuteCapabilityGate = vi.fn();
const mockExecuteResponseGateAsync = vi.fn();
const mockExecuteConstitutionGateAsync = vi.fn();
const mockExecuteMemoryGateAsync = vi.fn();
const mockBuildRegenerationMessage = vi.fn();

vi.mock('../../gates/index.js', () => ({
  executeIntentGateAsync: (...args: unknown[]) => mockExecuteIntentGateAsync(...args),
  executeToolsGate: (...args: unknown[]) => mockExecuteToolsGate(...args),
  executeStanceGateAsync: (...args: unknown[]) => mockExecuteStanceGateAsync(...args),
  executeCapabilityGate: (...args: unknown[]) => mockExecuteCapabilityGate(...args),
  executeResponseGateAsync: (...args: unknown[]) => mockExecuteResponseGateAsync(...args),
  executeConstitutionGateAsync: (...args: unknown[]) => mockExecuteConstitutionGateAsync(...args),
  executeMemoryGateAsync: (...args: unknown[]) => mockExecuteMemoryGateAsync(...args),
  buildRegenerationMessage: (...args: unknown[]) => mockBuildRegenerationMessage(...args),
}));

// Mock shield gate separately (it's imported from a different path)
vi.mock('../../gates/shield_gate/index.js', () => ({
  executeShieldGateAsync: (...args: unknown[]) => mockExecuteShieldGateAsync(...args),
}));

// Mock llm_engine
vi.mock('../../pipeline/llm_engine.js', () => ({
  isOpenAIAvailable: () => true,
}));

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

function createMockIntentResult(): GateResult<any> {
  return {
    gateId: 'intent',
    status: 'pass',
    action: 'continue',
    executionTimeMs: 50,
    output: {
      primary_route: 'SAY',
      stance: 'LENS',
      safety_signal: 'none',
      urgency: 'low',
      live_data: false,
      external_tool: false,
      learning_intent: false,
      topic: 'general',
    },
  };
}

function createMockShieldResult(): GateResult<any> {
  return {
    gateId: 'shield',
    status: 'pass',
    action: 'continue',
    executionTimeMs: 5,
    output: {
      route: 'skip',
      shield_acceptance: false,
    },
  };
}

function createMockToolsResult(): GateResult<any> {
  return {
    gateId: 'tools',
    status: 'pass',
    action: 'continue',
    executionTimeMs: 5,
    output: {
      route: 'skip',
    },
  };
}

function createMockStanceResult(route: string = 'lens', redirect?: any): GateResult<any> {
  return {
    gateId: 'stance',
    status: 'pass',
    action: redirect ? 'redirect' : 'continue',
    executionTimeMs: 5,
    output: {
      route,
      redirect,
    },
  };
}

function createMockCapabilityResult(): GateResult<any> {
  return {
    gateId: 'capability',
    status: 'pass',
    action: 'continue',
    executionTimeMs: 10,
    output: {
      provider: 'openai',
      config: {
        provider: 'openai',
        model: 'gpt-5.2',
        temperature: 0.7,
        maxTokens: 2048,
      },
    },
  };
}

function createMockResponseResult(text: string = 'Hello! How can I help you?'): GateResult<any> {
  return {
    gateId: 'response',
    status: 'pass',
    action: 'continue',
    executionTimeMs: 200,
    output: {
      text,
      model: 'gpt-5.2',
      tokensUsed: 150,
    },
  };
}

function createMockConstitutionResult(violates: boolean = false, fixGuidance?: string): GateResult<any> {
  return {
    gateId: 'constitution',
    status: violates ? 'hard_fail' : 'pass',
    action: violates ? 'regenerate' : 'continue',
    executionTimeMs: 100,
    output: {
      text: 'Hello! How can I help you?',
      valid: !violates,
      edited: false,
      checkRun: true,
      constitutionalCheck: {
        violates,
        reason: violates ? 'Uses dependency language' : null,
        fix: fixGuidance ?? null,
      },
      fixGuidance,
      violations: violates ? ['Uses dependency language'] : [],
    },
  };
}

function createMockMemoryResult(): GateResult<any> {
  return {
    gateId: 'memory',
    status: 'pass',
    action: 'continue',
    executionTimeMs: 20,
    output: {
      text: 'Hello! How can I help you?',
      memoryDetected: false,
      memoryStored: false,
    },
  };
}

function setupDefaultMocks(): void {
  mockExecuteIntentGateAsync.mockResolvedValue(createMockIntentResult());
  mockExecuteShieldGateAsync.mockResolvedValue(createMockShieldResult()); // Changed to async
  mockExecuteToolsGate.mockReturnValue(createMockToolsResult());
  mockExecuteStanceGateAsync.mockResolvedValue(createMockStanceResult());
  mockExecuteCapabilityGate.mockReturnValue(createMockCapabilityResult());
  mockExecuteResponseGateAsync.mockResolvedValue(createMockResponseResult());
  mockExecuteConstitutionGateAsync.mockResolvedValue(createMockConstitutionResult());
  mockExecuteMemoryGateAsync.mockResolvedValue(createMockMemoryResult());
  mockBuildRegenerationMessage.mockImplementation((msg, fix) => `${msg}\n\nFIX: ${fix}`);
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ExecutionPipeline', () => {
  let pipeline: ExecutionPipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    pipeline = new ExecutionPipeline();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTRUCTOR
  // ─────────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create pipeline instance', () => {
      const p = new ExecutionPipeline();
      expect(p).toBeInstanceOf(ExecutionPipeline);
    });

    it('should accept empty config', () => {
      const p = new ExecutionPipeline({});
      expect(p).toBeInstanceOf(ExecutionPipeline);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PROCESS METHOD
  // ─────────────────────────────────────────────────────────────────────────────

  describe('process', () => {
    describe('successful processing', () => {
      it('should return success status for valid input', async () => {
        const result = await pipeline.process('Hello');

        expect(result.status).toBe('success');
      });

      it('should return response text', async () => {
        mockExecuteResponseGateAsync.mockResolvedValue(
          createMockResponseResult('This is my response.')
        );
        mockExecuteConstitutionGateAsync.mockResolvedValue({
          ...createMockConstitutionResult(),
          output: {
            ...createMockConstitutionResult().output,
            text: 'This is my response.',
          },
        });

        const result = await pipeline.process('Hello');

        expect(result.response).toBe('This is my response.');
      });

      it('should include all gate results', async () => {
        const result = await pipeline.process('Hello');

        expect(result.gateResults).toHaveProperty('intent');
        expect(result.gateResults).toHaveProperty('shield');
        expect(result.gateResults).toHaveProperty('tools');
        expect(result.gateResults).toHaveProperty('stance');
        expect(result.gateResults).toHaveProperty('capability');
        expect(result.gateResults).toHaveProperty('model');
        expect(result.gateResults).toHaveProperty('constitution');
        expect(result.gateResults).toHaveProperty('memory');
      });

      it('should include metadata', async () => {
        const result = await pipeline.process('Hello');

        expect(result.metadata).toBeDefined();
        expect(result.metadata?.requestId).toBeDefined();
        expect(result.metadata?.totalTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should include stance in result', async () => {
        mockExecuteStanceGateAsync.mockResolvedValue(createMockStanceResult('sword'));

        const result = await pipeline.process('I want to learn Python');

        expect(result.stance).toBe('sword');
      });
    });

    describe('context handling', () => {
      it('should use provided context values', async () => {
        const context: Partial<PipelineContext> = {
          userId: 'user_123',
          sessionId: 'session_456',
          requestId: 'req_789',
        };

        const result = await pipeline.process('Hello', context);

        expect(result.metadata?.requestId).toBe('req_789');
      });

      it('should generate requestId if not provided', async () => {
        const result = await pipeline.process('Hello', {});

        expect(result.metadata?.requestId).toMatch(/^req-\d+$/);
      });

      it('should pass conversation history to gates', async () => {
        const context: Partial<PipelineContext> = {
          conversationHistory: [
            { role: 'user', content: 'Previous message' },
            { role: 'assistant', content: 'Previous response' },
          ],
        };

        await pipeline.process('Hello', context);

        // Check that intent gate received context with history
        expect(mockExecuteIntentGateAsync).toHaveBeenCalled();
        const intentContext = mockExecuteIntentGateAsync.mock.calls[0][1];
        expect(intentContext.conversationHistory).toHaveLength(2);
      });
    });

    describe('gate execution order', () => {
      it('should execute gates in correct order', async () => {
        const callOrder: string[] = [];

        mockExecuteIntentGateAsync.mockImplementation(async () => {
          callOrder.push('intent');
          return createMockIntentResult();
        });
        mockExecuteShieldGateAsync.mockImplementation(async () => {
          callOrder.push('shield');
          return createMockShieldResult();
        });
        mockExecuteToolsGate.mockImplementation(() => {
          callOrder.push('tools');
          return createMockToolsResult();
        });
        mockExecuteStanceGateAsync.mockImplementation(async () => {
          callOrder.push('stance');
          return createMockStanceResult();
        });
        mockExecuteCapabilityGate.mockImplementation(() => {
          callOrder.push('capability');
          return createMockCapabilityResult();
        });
        mockExecuteResponseGateAsync.mockImplementation(async () => {
          callOrder.push('response');
          return createMockResponseResult();
        });
        mockExecuteConstitutionGateAsync.mockImplementation(async () => {
          callOrder.push('constitution');
          return createMockConstitutionResult();
        });
        mockExecuteMemoryGateAsync.mockImplementation(async () => {
          callOrder.push('memory');
          return createMockMemoryResult();
        });

        await pipeline.process('Hello');

        expect(callOrder).toEqual([
          'intent',
          'shield',
          'tools',
          'stance',
          'capability',
          'response',
          'constitution',
          'memory',
        ]);
      });
    });

    describe('state propagation', () => {
      it('should pass intent_summary to subsequent gates', async () => {
        const intentOutput = {
          primary_route: 'SAY',
          stance: 'LENS',
          safety_signal: 'medium',
          urgency: 'low',
          live_data: true,
          external_tool: false,
          learning_intent: false,
        };
        mockExecuteIntentGateAsync.mockResolvedValue({
          ...createMockIntentResult(),
          output: intentOutput,
        });

        await pipeline.process('What is the weather?');

        // Shield gate should receive state with intent_summary
        const shieldState = mockExecuteShieldGateAsync.mock.calls[0][0];
        expect(shieldState.intent_summary).toEqual(intentOutput);
      });

      it('should pass capability result to response gate', async () => {
        const capabilityOutput = {
          provider: 'gemini_grounded',
          config: {
            provider: 'gemini_grounded',
            model: 'gemini-2.5-pro',
            tools: [{ googleSearch: {} }],
          },
        };
        mockExecuteCapabilityGate.mockReturnValue({
          ...createMockCapabilityResult(),
          output: capabilityOutput,
        });

        await pipeline.process('What is NVDA stock price?');

        // Response gate should receive state with capabilityResult
        const responseState = mockExecuteResponseGateAsync.mock.calls[0][0];
        expect(responseState.capabilityResult).toEqual(capabilityOutput);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // REGENERATION LOOP
  // ─────────────────────────────────────────────────────────────────────────────

  describe('regeneration loop', () => {
    it('should regenerate when constitution gate returns regenerate action', async () => {
      // First call: violation detected
      // Second call: clean response
      mockExecuteConstitutionGateAsync
        .mockResolvedValueOnce(createMockConstitutionResult(true, 'Remove dependency language'))
        .mockResolvedValueOnce(createMockConstitutionResult(false));

      const result = await pipeline.process('Hello');

      expect(mockExecuteResponseGateAsync).toHaveBeenCalledTimes(2);
      expect(mockExecuteConstitutionGateAsync).toHaveBeenCalledTimes(2);
      expect(result.metadata?.regenerations).toBe(1);
    });

    it('should use fix guidance in regeneration message', async () => {
      const fixGuidance = 'Remove sycophantic praise';
      mockExecuteConstitutionGateAsync
        .mockResolvedValueOnce(createMockConstitutionResult(true, fixGuidance))
        .mockResolvedValueOnce(createMockConstitutionResult(false));

      await pipeline.process('Hello');

      expect(mockBuildRegenerationMessage).toHaveBeenCalledWith('Hello', fixGuidance);
    });

    it('should limit regenerations to MAX_REGENERATIONS (2)', async () => {
      // Always return violation
      mockExecuteConstitutionGateAsync.mockResolvedValue(
        createMockConstitutionResult(true, 'Fix needed')
      );

      const result = await pipeline.process('Hello');

      // Initial + 2 regenerations = 3 total
      expect(mockExecuteResponseGateAsync).toHaveBeenCalledTimes(3);
      expect(mockExecuteConstitutionGateAsync).toHaveBeenCalledTimes(3);
    });

    it('should stop regenerating on success', async () => {
      // First: violation, Second: success
      mockExecuteConstitutionGateAsync
        .mockResolvedValueOnce(createMockConstitutionResult(true, 'Fix'))
        .mockResolvedValueOnce(createMockConstitutionResult(false));

      await pipeline.process('Hello');

      expect(mockExecuteResponseGateAsync).toHaveBeenCalledTimes(2);
    });

    it('should handle regeneration without fix guidance', async () => {
      mockExecuteConstitutionGateAsync
        .mockResolvedValueOnce(createMockConstitutionResult(true, undefined))
        .mockResolvedValueOnce(createMockConstitutionResult(false));

      const result = await pipeline.process('Hello');

      expect(result.status).toBe('success');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should return error status on fatal error', async () => {
      mockExecuteIntentGateAsync.mockRejectedValue(new Error('API failure'));

      const result = await pipeline.process('Hello');

      expect(result.status).toBe('error');
      expect(result.response).toContain('encountered an error');
    });

    it('should include error message in metadata', async () => {
      mockExecuteIntentGateAsync.mockRejectedValue(new Error('Network timeout'));

      const result = await pipeline.process('Hello');

      expect(result.metadata?.error).toBe('Network timeout');
    });

    it('should include total time on error', async () => {
      mockExecuteIntentGateAsync.mockRejectedValue(new Error('Error'));

      const result = await pipeline.process('Hello');

      expect(result.metadata?.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-Error throws', async () => {
      mockExecuteIntentGateAsync.mockRejectedValue('String error');

      const result = await pipeline.process('Hello');

      expect(result.status).toBe('error');
      expect(result.metadata?.error).toBe('Unknown error');
    });

    it('should preserve gate results collected before error', async () => {
      mockExecuteShieldGateAsync.mockImplementation(async () => {
        throw new Error('Shield failed');
      });

      const result = await pipeline.process('Hello');

      expect(result.gateResults.intent).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET AVAILABLE PROVIDERS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getAvailableProviders', () => {
    it('should return openai when available', () => {
      const providers = pipeline.getAvailableProviders();

      expect(providers).toContain('openai');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty user message', async () => {
      const result = await pipeline.process('');

      expect(result.status).toBe('success');
    });

    it('should handle very long user message', async () => {
      const longMessage = 'Hello '.repeat(1000);

      const result = await pipeline.process(longMessage);

      expect(result.status).toBe('success');
    });

    it('should normalize input to lowercase', async () => {
      await pipeline.process('HELLO WORLD');

      const intentState = mockExecuteIntentGateAsync.mock.calls[0][0];
      expect(intentState.normalizedInput).toBe('hello world');
    });

    it('should trim whitespace from input', async () => {
      await pipeline.process('  hello  ');

      const intentState = mockExecuteIntentGateAsync.mock.calls[0][0];
      expect(intentState.normalizedInput).toBe('hello');
    });

    it('should handle missing generation text', async () => {
      mockExecuteConstitutionGateAsync.mockResolvedValue({
        ...createMockConstitutionResult(),
        output: {
          text: undefined,
          valid: true,
          edited: false,
          checkRun: false,
        },
      });
      mockExecuteResponseGateAsync.mockResolvedValue({
        ...createMockResponseResult(),
        output: {
          text: undefined,
          model: 'gpt-5.2',
          tokensUsed: 0,
        },
      });

      const result = await pipeline.process('Hello');

      expect(result.response).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FULL PIPELINE SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('full pipeline scenarios', () => {
    it('should handle live data query (LENS stance)', async () => {
      mockExecuteIntentGateAsync.mockResolvedValue({
        ...createMockIntentResult(),
        output: {
          primary_route: 'SAY',
          stance: 'LENS',
          safety_signal: 'none',
          live_data: true,
          external_tool: false,
          learning_intent: false,
        },
      });
      mockExecuteCapabilityGate.mockReturnValue({
        ...createMockCapabilityResult(),
        output: {
          provider: 'gemini_grounded',
          config: { provider: 'gemini_grounded', model: 'gemini-2.5-pro' },
        },
      });

      const result = await pipeline.process('What is the current price of Bitcoin?');

      expect(result.status).toBe('success');
      expect(result.gateResults.capability?.output.provider).toBe('gemini_grounded');
    });

    it('should handle learning request (SWORD stance)', async () => {
      mockExecuteIntentGateAsync.mockResolvedValue({
        ...createMockIntentResult(),
        output: {
          primary_route: 'MAKE',
          stance: 'SWORD',
          safety_signal: 'none',
          live_data: false,
          external_tool: false,
          learning_intent: true,
        },
      });
      // SWORD mode now returns redirect
      mockExecuteStanceGateAsync.mockResolvedValue(createMockStanceResult('sword', {
        target: 'swordgate',
        mode: 'designer',
        topic: 'Python',
      }));

      const result = await pipeline.process('I want to learn Python');

      expect(result.status).toBe('redirect');
      expect(result.stance).toBe('sword');
      expect(result.redirect).toBeDefined();
      expect(result.redirect?.mode).toBe('designer');
      expect(result.redirect?.topic).toBe('Python');
    });

    it('should handle safety concern (SHIELD stance)', async () => {
      mockExecuteIntentGateAsync.mockResolvedValue({
        ...createMockIntentResult(),
        output: {
          primary_route: 'SAY',
          stance: 'SHIELD',
          safety_signal: 'high',
          live_data: false,
          external_tool: false,
          learning_intent: false,
        },
      });
      mockExecuteShieldGateAsync.mockResolvedValue({
        ...createMockShieldResult(),
        status: 'pass',
        action: 'continue',
        output: { route: 'shield', shield_acceptance: true },
      });

      const result = await pipeline.process('I am feeling very stressed');

      expect(result.status).toBe('success');
      expect(result.gateResults.shield?.output.route).toBe('shield');
    });

    it('should handle memory storage request', async () => {
      mockExecuteMemoryGateAsync.mockResolvedValue({
        ...createMockMemoryResult(),
        output: {
          text: 'I will remember that.',
          memoryDetected: true,
          memoryStored: true,
          memoryRecord: {
            id: 'mem_123',
            userId: 'user_456',
            userMessage: 'Remember this: I like Python',
            generatedResponse: 'I will remember that.',
            source: 'regex',
            timestamp: Date.now(),
          },
        },
      });

      const result = await pipeline.process('Remember this: I like Python');

      expect(result.gateResults.memory?.output.memoryStored).toBe(true);
    });
  });
});
