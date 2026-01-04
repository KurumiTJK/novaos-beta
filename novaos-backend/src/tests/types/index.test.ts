// ═══════════════════════════════════════════════════════════════════════════════
// TYPES INDEX TESTS — NovaOS Pipeline Types
// NovaOS Types Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  // Re-exports from result.ts
  type AppError,
  appError,
  ErrorCode,
  
  // Re-exports from branded.ts
  type UserId,
  type RequestId,
  type CorrelationId,
  type Timestamp,
  createUserId,
  createRequestId,
  createCorrelationId,
  createTimestamp,
  
  // Re-exports from common.ts
  type Nullable,
  type Maybe,
  isDefined,
  isNullish,
  assertDefined,
  exhaustive,
  
  // Stance & Action
  type Stance,
  type ActionSource,
  
  // Intent Gate
  type PrimaryRoute,
  type IntentStance,
  type SafetySignal,
  type Urgency,
  type IntentSummary,
  
  // Conversation
  type ConversationMessage,
  
  // Gate Types
  type GateAction,
  type GateStatus,
  type GateResult,
  
  // Gate Outputs
  type ShieldRoute,
  type ShieldGateOutput,
  type ToolsRoute,
  type ToolsGateOutput,
  type StanceRoute,
  type StanceGateOutput,
  
  // Capability Gate
  type EvidenceItem,
  type ProviderName,
  type ProviderConfig,
  type CapabilityGateOutput,
  
  // Response Gate
  type Generation,
  
  // Constitution Gate
  type ValidatedOutput,
  type ConstitutionalCheckResult,
  type ConstitutionGateOutput,
  
  // Memory Gate
  type MemoryRecord,
  type MemoryGateOutput,
  
  // Gate Results
  type GateResults,
  
  // Pipeline
  type PipelineContext,
  type PipelineState,
  type PipelineStatus,
  type PipelineResult,
} from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORT VERIFICATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Re-exports', () => {
  describe('from result.ts', () => {
    it('should export appError function', () => {
      expect(typeof appError).toBe('function');
      const error = appError('TEST', 'message');
      expect(error.code).toBe('TEST');
    });

    it('should export ErrorCode', () => {
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    });
  });

  describe('from branded.ts', () => {
    it('should export createUserId', () => {
      expect(typeof createUserId).toBe('function');
      const id = createUserId('test');
      expect(id).toBe('test');
    });

    it('should export createRequestId', () => {
      expect(typeof createRequestId).toBe('function');
    });

    it('should export createCorrelationId', () => {
      expect(typeof createCorrelationId).toBe('function');
    });

    it('should export createTimestamp', () => {
      expect(typeof createTimestamp).toBe('function');
    });
  });

  describe('from common.ts', () => {
    it('should export isDefined', () => {
      expect(typeof isDefined).toBe('function');
      expect(isDefined('value')).toBe(true);
    });

    it('should export isNullish', () => {
      expect(typeof isNullish).toBe('function');
      expect(isNullish(null)).toBe(true);
    });

    it('should export assertDefined', () => {
      expect(typeof assertDefined).toBe('function');
    });

    it('should export exhaustive', () => {
      expect(typeof exhaustive).toBe('function');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE & ACTION TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Stance & Action Types', () => {
  describe('Stance', () => {
    it('should accept valid stance values', () => {
      const stances: Stance[] = ['control', 'shield', 'lens', 'sword'];
      expect(stances).toHaveLength(4);
    });

    it('should work in conditionals', () => {
      const stance: Stance = 'shield';
      expect(['control', 'shield', 'lens', 'sword']).toContain(stance);
    });
  });

  describe('ActionSource', () => {
    it('should accept valid action source values', () => {
      const sources: ActionSource[] = ['chat', 'command', 'api', 'system'];
      expect(sources).toHaveLength(4);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTENT GATE TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Intent Gate Types', () => {
  describe('PrimaryRoute', () => {
    it('should accept valid primary routes', () => {
      const routes: PrimaryRoute[] = ['SAY', 'MAKE', 'FIX', 'DO'];
      expect(routes).toHaveLength(4);
    });
  });

  describe('IntentStance', () => {
    it('should accept valid intent stances', () => {
      const stances: IntentStance[] = ['LENS', 'SWORD', 'SHIELD'];
      expect(stances).toHaveLength(3);
    });
  });

  describe('SafetySignal', () => {
    it('should accept valid safety signals', () => {
      const signals: SafetySignal[] = ['none', 'low', 'medium', 'high'];
      expect(signals).toHaveLength(4);
    });
  });

  describe('Urgency', () => {
    it('should accept valid urgency levels', () => {
      const levels: Urgency[] = ['low', 'medium', 'high'];
      expect(levels).toHaveLength(3);
    });
  });

  describe('IntentSummary', () => {
    it('should create valid intent summary', () => {
      const summary: IntentSummary = {
        primary_route: 'SAY',
        stance: 'LENS',
        safety_signal: 'none',
        urgency: 'low',
        live_data: false,
        external_tool: false,
        learning_intent: false,
      };

      expect(summary.primary_route).toBe('SAY');
      expect(summary.stance).toBe('LENS');
      expect(summary.live_data).toBe(false);
    });

    it('should allow all combinations', () => {
      const summary: IntentSummary = {
        primary_route: 'DO',
        stance: 'SWORD',
        safety_signal: 'high',
        urgency: 'high',
        live_data: true,
        external_tool: true,
        learning_intent: true,
      };

      expect(summary.learning_intent).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Conversation Types', () => {
  describe('ConversationMessage', () => {
    it('should create user message', () => {
      const message: ConversationMessage = {
        role: 'user',
        content: 'Hello, world!',
      };
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
    });

    it('should create assistant message', () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Hi there!',
        timestamp: Date.now(),
      };
      expect(message.role).toBe('assistant');
      expect(message.timestamp).toBeDefined();
    });

    it('should create system message with metadata', () => {
      const message: ConversationMessage = {
        role: 'system',
        content: 'System prompt',
        metadata: { liveData: true },
      };
      expect(message.role).toBe('system');
      expect(message.metadata?.liveData).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GATE TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Gate Types', () => {
  describe('GateAction', () => {
    it('should accept valid gate actions', () => {
      const actions: GateAction[] = ['continue', 'stop', 'halt', 'await_ack', 'regenerate', 'degrade'];
      expect(actions).toHaveLength(6);
    });
  });

  describe('GateStatus', () => {
    it('should accept valid gate statuses', () => {
      const statuses: GateStatus[] = ['pass', 'passed', 'blocked', 'awaiting', 'warning', 'soft_fail', 'hard_fail'];
      expect(statuses).toHaveLength(7);
    });
  });

  describe('GateResult', () => {
    it('should create basic gate result', () => {
      const result: GateResult = {
        action: 'continue',
        status: 'pass',
        output: { data: 'test' },
      };

      expect(result.action).toBe('continue');
      expect(result.status).toBe('pass');
    });

    it('should create gate result with all fields', () => {
      const result: GateResult<{ value: number }> = {
        gate: 'intent',
        gateId: 'gate-123',
        action: 'continue',
        status: 'passed',
        output: { value: 42 },
        message: 'Processing complete',
        timestamp: Date.now(),
        latencyMs: 150,
        executionTimeMs: 145,
        failureReason: undefined,
      };

      expect(result.gate).toBe('intent');
      expect(result.output.value).toBe(42);
      expect(result.latencyMs).toBe(150);
    });

    it('should handle blocked result', () => {
      const result: GateResult = {
        action: 'stop',
        status: 'blocked',
        output: null,
        failureReason: 'Safety violation detected',
      };

      expect(result.status).toBe('blocked');
      expect(result.failureReason).toBe('Safety violation detected');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GATE OUTPUT TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Gate Output Types', () => {
  describe('ShieldGateOutput', () => {
    it('should create shield gate output', () => {
      const output: ShieldGateOutput = {
        route: 'shield',
        safety_signal: 'medium',
        urgency: 'high',
      };
      expect(output.route).toBe('shield');
    });

    it('should allow skip route', () => {
      const output: ShieldGateOutput = {
        route: 'skip',
        safety_signal: 'none',
        urgency: 'low',
      };
      expect(output.route).toBe('skip');
    });
  });

  describe('ToolsGateOutput', () => {
    it('should create tools gate output', () => {
      const output: ToolsGateOutput = {
        route: 'tools',
        external_tool: true,
      };
      expect(output.external_tool).toBe(true);
    });
  });

  describe('StanceGateOutput', () => {
    it('should create stance gate output', () => {
      const output: StanceGateOutput = {
        route: 'sword',
        primary_route: 'DO',
        learning_intent: true,
      };
      expect(output.route).toBe('sword');
      expect(output.learning_intent).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Capability Gate Types', () => {
  describe('EvidenceItem', () => {
    it('should create evidence item', () => {
      const evidence: EvidenceItem = {
        type: 'web_search',
        formatted: 'Stock price: $150.00',
        source: 'finnhub',
        raw: { price: 150.00 },
        fetchedAt: Date.now(),
      };
      expect(evidence.type).toBe('web_search');
      expect(evidence.source).toBe('finnhub');
    });
  });

  describe('ProviderConfig', () => {
    it('should create provider config', () => {
      const config: ProviderConfig = {
        provider: 'gemini_grounded',
        model: 'gemini-pro',
        temperature: 0.7,
        maxTokens: 1000,
        topic: 'finance',
      };
      expect(config.provider).toBe('gemini_grounded');
    });
  });

  describe('CapabilityGateOutput', () => {
    it('should create capability gate output', () => {
      const output: CapabilityGateOutput = {
        provider: 'openai',
        config: {
          provider: 'openai',
          model: 'gpt-4',
        },
        capabilitiesUsed: ['web_search', 'calculator'],
        evidenceItems: [],
      };
      expect(output.capabilitiesUsed).toContain('web_search');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE & CONSTITUTION GATE TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Response & Constitution Gate Types', () => {
  describe('Generation', () => {
    it('should create generation', () => {
      const gen: Generation = {
        text: 'Hello, I can help you with that.',
        model: 'gpt-4',
        tokensUsed: 25,
      };
      expect(gen.text).toContain('Hello');
      expect(gen.tokensUsed).toBe(25);
    });
  });

  describe('ConstitutionalCheckResult', () => {
    it('should create passing check result', () => {
      const result: ConstitutionalCheckResult = {
        violates: false,
        reason: null,
        fix: null,
      };
      expect(result.violates).toBe(false);
    });

    it('should create failing check result', () => {
      const result: ConstitutionalCheckResult = {
        violates: true,
        reason: 'Contains harmful content',
        fix: 'Remove harmful content and rephrase',
      };
      expect(result.violates).toBe(true);
      expect(result.fix).toBeDefined();
    });
  });

  describe('ConstitutionGateOutput', () => {
    it('should create valid constitution output', () => {
      const output: ConstitutionGateOutput = {
        text: 'Safe response',
        model: 'gpt-4',
        tokensUsed: 10,
        valid: true,
        edited: false,
        checkRun: true,
      };
      expect(output.valid).toBe(true);
      expect(output.edited).toBe(false);
    });

    it('should create edited constitution output', () => {
      const output: ConstitutionGateOutput = {
        text: 'Edited safe response',
        valid: true,
        edited: true,
        checkRun: true,
        constitutionalCheck: {
          violates: true,
          reason: 'Minor violation',
          fix: 'Applied fix',
        },
        fixGuidance: 'Removed problematic content',
        violations: ['minor_violation'],
      };
      expect(output.edited).toBe(true);
      expect(output.violations).toContain('minor_violation');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY GATE TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Memory Gate Types', () => {
  describe('MemoryRecord', () => {
    it('should create memory record', () => {
      const record: MemoryRecord = {
        id: 'mem-123',
        userId: 'user-456',
        userMessage: 'Remember that I like pizza',
        generatedResponse: 'Got it, noted!',
        source: 'regex',
        timestamp: Date.now(),
      };
      expect(record.source).toBe('regex');
    });

    it('should support llm source', () => {
      const record: MemoryRecord = {
        id: 'mem-789',
        userId: 'user-456',
        userMessage: 'My favorite color is blue',
        generatedResponse: 'I\'ll remember that.',
        source: 'llm',
        timestamp: Date.now(),
      };
      expect(record.source).toBe('llm');
    });
  });

  describe('MemoryGateOutput', () => {
    it('should create memory gate output without memory', () => {
      const output: MemoryGateOutput = {
        text: 'Response text',
        memoryDetected: false,
        memoryStored: false,
      };
      expect(output.memoryDetected).toBe(false);
    });

    it('should create memory gate output with memory', () => {
      const output: MemoryGateOutput = {
        text: 'I noted that.',
        memoryDetected: true,
        memoryStored: true,
        memoryRecord: {
          id: 'mem-001',
          userId: 'user-001',
          userMessage: 'Remember X',
          generatedResponse: 'Noted',
          source: 'llm',
          timestamp: Date.now(),
        },
      };
      expect(output.memoryStored).toBe(true);
      expect(output.memoryRecord?.id).toBe('mem-001');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Pipeline Types', () => {
  describe('PipelineContext', () => {
    it('should create minimal pipeline context', () => {
      const context: PipelineContext = {};
      expect(context).toBeDefined();
    });

    it('should create full pipeline context', () => {
      const context: PipelineContext = {
        requestId: 'req-123',
        userId: 'user-456',
        sessionId: 'sess-789',
        conversationId: 'conv-000',
        message: 'Hello',
        conversationHistory: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
        ],
        userPreferences: { theme: 'dark' },
        ackTokenValid: true,
        ackToken: 'token-abc',
        metadata: { source: 'web' },
        timezone: 'America/New_York',
        locale: 'en-US',
        requestedStance: 'lens',
        actionSource: 'chat',
        actionSources: ['chat', 'command'],
        timestamp: Date.now(),
      };
      expect(context.requestId).toBe('req-123');
      expect(context.conversationHistory).toHaveLength(2);
    });
  });

  describe('PipelineState', () => {
    it('should create pipeline state', () => {
      const state: PipelineState = {
        userMessage: 'Hello',
        normalizedInput: 'hello',
        gateResults: {},
        flags: {},
        timestamps: { pipelineStart: Date.now() },
      };
      expect(state.userMessage).toBe('Hello');
    });
  });

  describe('PipelineStatus', () => {
    it('should accept valid pipeline statuses', () => {
      const statuses: PipelineStatus[] = ['success', 'stopped', 'await_ack', 'degraded', 'error'];
      expect(statuses).toHaveLength(5);
    });
  });

  describe('PipelineResult', () => {
    it('should create success pipeline result', () => {
      const result: PipelineResult = {
        status: 'success',
        response: 'Here is your answer.',
        stance: 'lens',
        gateResults: {},
        metadata: {
          requestId: 'req-123',
          totalTimeMs: 250,
        },
      };
      expect(result.status).toBe('success');
      expect(result.metadata.totalTimeMs).toBe(250);
    });

    it('should create error pipeline result', () => {
      const result: PipelineResult = {
        status: 'error',
        response: 'An error occurred.',
        gateResults: {},
        metadata: {
          totalTimeMs: 50,
          error: 'Internal server error',
        },
      };
      expect(result.status).toBe('error');
      expect(result.metadata.error).toBeDefined();
    });

    it('should create await_ack pipeline result', () => {
      const result: PipelineResult = {
        status: 'await_ack',
        response: 'Please confirm this action.',
        gateResults: {},
        ackToken: 'ack-token-123',
        ackMessage: 'This action requires confirmation.',
        metadata: {
          totalTimeMs: 100,
        },
      };
      expect(result.status).toBe('await_ack');
      expect(result.ackToken).toBe('ack-token-123');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GATE RESULTS TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('GateResults', () => {
  it('should create empty gate results', () => {
    const results: GateResults = {};
    expect(results).toBeDefined();
  });

  it('should create full gate results', () => {
    const results: GateResults = {
      intent: {
        action: 'continue',
        status: 'pass',
        output: {
          primary_route: 'SAY',
          stance: 'LENS',
          safety_signal: 'none',
          urgency: 'low',
          live_data: false,
          external_tool: false,
          learning_intent: false,
        },
      },
      shield: {
        action: 'continue',
        status: 'pass',
        output: {
          route: 'skip',
          safety_signal: 'none',
          urgency: 'low',
        },
      },
      tools: {
        action: 'continue',
        status: 'pass',
        output: {
          route: 'skip',
          external_tool: false,
        },
      },
      stance: {
        action: 'continue',
        status: 'pass',
        output: {
          route: 'lens',
          primary_route: 'SAY',
          learning_intent: false,
        },
      },
    };

    expect(results.intent?.output.primary_route).toBe('SAY');
    expect(results.shield?.output.route).toBe('skip');
  });
});
