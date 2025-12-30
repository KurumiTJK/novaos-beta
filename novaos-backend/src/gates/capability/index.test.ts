// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PipelineState, PipelineContext, Intent, LensResult } from '../../types/index.js';
import type { CapabilityGateOutput, SelectorInput, Capability, EvidenceItem } from './types.js';
import { executeCapabilityGateAsync, initializeCapabilityGate } from './index.js';
import { createCapabilityRegistry, getCapabilityRegistry } from './registry.js';
import { selectCapabilities, setOpenAIClient, setSelectorConfig } from './selector.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function createMockState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    userMessage: 'test message',
    normalizedInput: 'test message',
    gateResults: {},
    flags: {},
    timestamps: { pipelineStart: Date.now() },
    intent: {
      type: 'question',
      domain: 'general',
      confidence: 0.9,
    },
    lensResult: {
      needsExternalData: false,
      dataType: 'none',
      reason: 'test',
      confidence: 0.9,
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
// REGISTRY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('CapabilityRegistry', () => {
  it('should register and retrieve capabilities', () => {
    const registry = createCapabilityRegistry();

    const mockCapability: Capability = {
      name: 'stock_fetcher',
      description: 'Test capability',
      execute: async () => null,
    };

    registry.register(mockCapability);

    expect(registry.get('stock_fetcher')).toBe(mockCapability);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('should unregister capabilities', () => {
    const registry = createCapabilityRegistry();

    const mockCapability: Capability = {
      name: 'stock_fetcher',
      description: 'Test capability',
      execute: async () => null,
    };

    registry.register(mockCapability);
    expect(registry.get('stock_fetcher')).toBeDefined();

    registry.unregister('stock_fetcher');
    expect(registry.get('stock_fetcher')).toBeUndefined();
  });

  it('should return capability menu', () => {
    const registry = createCapabilityRegistry();

    registry.register({
      name: 'stock_fetcher',
      description: 'Fetches stock prices',
      execute: async () => null,
    });

    registry.register({
      name: 'weather_fetcher',
      description: 'Fetches weather',
      execute: async () => null,
    });

    const menu = registry.getMenu();

    expect(menu).toHaveLength(2);
    expect(menu[0]).toEqual({ name: 'stock_fetcher', description: 'Fetches stock prices' });
    expect(menu[1]).toEqual({ name: 'weather_fetcher', description: 'Fetches weather' });
  });

  it('should execute capabilities in parallel', async () => {
    const registry = createCapabilityRegistry();

    const mockEvidence1: EvidenceItem = {
      type: 'stock',
      formatted: 'AAPL: $150',
      source: 'stock_fetcher',
      fetchedAt: Date.now(),
    };

    const mockEvidence2: EvidenceItem = {
      type: 'weather',
      formatted: 'Sunny 75°F',
      source: 'weather_fetcher',
      fetchedAt: Date.now(),
    };

    registry.register({
      name: 'stock_fetcher',
      description: 'Test',
      execute: async () => mockEvidence1,
    });

    registry.register({
      name: 'weather_fetcher',
      description: 'Test',
      execute: async () => mockEvidence2,
    });

    const input: SelectorInput = {
      userMessage: 'test',
      intent: { type: 'question', confidence: 0.9 },
      lensResult: { needsExternalData: true, dataType: 'realtime', reason: 'test', confidence: 0.9 },
    };

    const result = await registry.executeAll(['stock_fetcher', 'weather_fetcher'], input);

    expect(result.evidenceItems).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle capability execution errors', async () => {
    const registry = createCapabilityRegistry();

    registry.register({
      name: 'stock_fetcher',
      description: 'Test',
      execute: async () => {
        throw new Error('API Error');
      },
    });

    const input: SelectorInput = {
      userMessage: 'test',
      intent: { type: 'question', confidence: 0.9 },
      lensResult: { needsExternalData: true, dataType: 'realtime', reason: 'test', confidence: 0.9 },
    };

    const result = await registry.executeAll(['stock_fetcher'], input);

    expect(result.evidenceItems).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('API Error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTOR TESTS (fallback mode)
// ─────────────────────────────────────────────────────────────────────────────────

describe('selectCapabilities (fallback)', () => {
  beforeEach(() => {
    // Force fallback by not setting OpenAI client
    setOpenAIClient(null as any);
  });

  it('should return empty for no external data needed', async () => {
    const input: SelectorInput = {
      userMessage: 'Hello',
      intent: { type: 'conversation', confidence: 0.9 },
      lensResult: { needsExternalData: false, dataType: 'none', reason: 'greeting', confidence: 0.99 },
    };

    const result = await selectCapabilities(input);

    expect(result.capabilities).toHaveLength(0);
    expect(result.confidence).toBe(1.0);
  });

  it('should select stock_fetcher for stock queries (fallback)', async () => {
    const input: SelectorInput = {
      userMessage: "What's AAPL stock price?",
      intent: { type: 'question', domain: 'financial', confidence: 0.9 },
      lensResult: { needsExternalData: true, dataType: 'realtime', reason: 'stock price', confidence: 0.95 },
    };

    const result = await selectCapabilities(input);

    expect(result.capabilities).toContain('stock_fetcher');
  });

  it('should select weather_fetcher for weather queries (fallback)', async () => {
    const input: SelectorInput = {
      userMessage: "What's the weather in Tokyo?",
      intent: { type: 'question', confidence: 0.9 },
      lensResult: { needsExternalData: true, dataType: 'realtime', reason: 'weather', confidence: 0.95 },
    };

    const result = await selectCapabilities(input);

    expect(result.capabilities).toContain('weather_fetcher');
  });

  it('should select crypto_fetcher for crypto queries (fallback)', async () => {
    const input: SelectorInput = {
      userMessage: "What's Bitcoin price?",
      intent: { type: 'question', confidence: 0.9 },
      lensResult: { needsExternalData: true, dataType: 'realtime', reason: 'crypto', confidence: 0.95 },
    };

    const result = await selectCapabilities(input);

    expect(result.capabilities).toContain('crypto_fetcher');
  });

  it('should select web_searcher for web search data type (fallback)', async () => {
    const input: SelectorInput = {
      userMessage: 'What are the latest news about AI?',
      intent: { type: 'question', confidence: 0.9 },
      lensResult: { needsExternalData: true, dataType: 'web_search', reason: 'news', confidence: 0.9 },
    };

    const result = await selectCapabilities(input);

    expect(result.capabilities).toContain('web_searcher');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GATE EXECUTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('executeCapabilityGateAsync', () => {
  beforeEach(() => {
    initializeCapabilityGate();
  });

  it('should route sword stance to sword mode', async () => {
    const state = createMockState({ stance: 'sword' });
    const context = createMockContext();

    const result = await executeCapabilityGateAsync(state, context);

    expect(result.status).toBe('pass');
    expect(result.output.route).toBe('sword');
    expect(result.output.swordMode).toBe(true);
    expect(result.output.capabilitiesUsed).toHaveLength(0);
  });

  it('should route lens stance to capability selection', async () => {
    const state = createMockState({
      stance: 'lens',
      lensResult: {
        needsExternalData: false,
        dataType: 'none',
        reason: 'general question',
        confidence: 0.9,
      },
    });
    const context = createMockContext();

    const result = await executeCapabilityGateAsync(state, context);

    expect(result.status).toBe('pass');
    expect(result.output.route).toBe('lens');
    expect(result.output.swordMode).toBeUndefined();
  });

  it('should handle missing intent gracefully', async () => {
    const state = createMockState({ intent: undefined });
    const context = createMockContext();

    const result = await executeCapabilityGateAsync(state, context);

    expect(result.status).toBe('soft_fail');
    expect(result.failureReason).toContain('Missing intent');
  });

  it('should handle missing lensResult gracefully', async () => {
    const state = createMockState({ lensResult: undefined });
    const context = createMockContext();

    const result = await executeCapabilityGateAsync(state, context);

    expect(result.status).toBe('soft_fail');
    expect(result.failureReason).toContain('lensResult');
  });

  it('should return empty evidence when no capabilities selected', async () => {
    const state = createMockState({
      userMessage: 'Hello there!',
      lensResult: {
        needsExternalData: false,
        dataType: 'none',
        reason: 'greeting',
        confidence: 0.99,
      },
    });
    const context = createMockContext();

    const result = await executeCapabilityGateAsync(state, context);

    expect(result.status).toBe('pass');
    expect(result.output.capabilitiesUsed).toHaveLength(0);
    expect(result.output.evidenceItems).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Capability Gate Integration', () => {
  it('should flow from lens result to capability selection', async () => {
    // Simulate pipeline state after Lens Gate
    const state = createMockState({
      userMessage: "What's the time in Tokyo?",
      intent: {
        type: 'question',
        domain: 'general',
        confidence: 0.95,
      },
      lensResult: {
        needsExternalData: true,
        dataType: 'realtime',
        reason: 'Time query requires current data',
        confidence: 0.9,
      },
      stance: 'lens',
    });

    const context = createMockContext();
    const result = await executeCapabilityGateAsync(state, context);

    expect(result.status).toBe('pass');
    expect(result.output.route).toBe('lens');
    // Time fetcher should be selected (fallback pattern matching)
    // Note: actual provider may not be available in test
  });
});
