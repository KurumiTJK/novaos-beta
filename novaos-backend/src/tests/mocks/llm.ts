// ═══════════════════════════════════════════════════════════════════════════════
// MOCK LLM — Mock LLM Provider for Testing
// NovaOS Phase 17 — Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter';
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK LLM PROVIDER
// ─────────────────────────────────────────────────────────────────────────────────

export class MockLLMProvider {
  private responses: Map<string, string> = new Map();
  private defaultResponse = 'Mock LLM response';
  private callCount = 0;
  private lastRequest: LLMRequest | null = null;
  private shouldFail = false;
  private failureError: Error | null = null;
  private latencyMs = 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN API
  // ─────────────────────────────────────────────────────────────────────────────

  async complete(request: LLMRequest): Promise<LLMResponse> {
    this.callCount++;
    this.lastRequest = request;

    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    if (this.shouldFail) {
      throw this.failureError || new Error('Mock LLM failure');
    }

    const userMessage = request.messages.find((m) => m.role === 'user')?.content || '';
    const responseContent = this.findResponse(userMessage);

    return {
      content: responseContent,
      model: request.model || 'mock-model',
      usage: {
        promptTokens: this.estimateTokens(request.messages.map((m) => m.content).join(' ')),
        completionTokens: this.estimateTokens(responseContent),
        totalTokens: 0, // Will be calculated
      },
      finishReason: 'stop',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESPONSE CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set response for a specific pattern
   */
  setResponse(pattern: string, response: string): void {
    this.responses.set(pattern.toLowerCase(), response);
  }

  /**
   * Set default response for unmatched requests
   */
  setDefaultResponse(response: string): void {
    this.defaultResponse = response;
  }

  /**
   * Configure to fail on next call
   */
  setFailure(error?: Error): void {
    this.shouldFail = true;
    this.failureError = error || null;
  }

  /**
   * Configure latency for simulating slow responses
   */
  setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  getCallCount(): number {
    return this.callCount;
  }

  getLastRequest(): LLMRequest | null {
    return this.lastRequest;
  }

  reset(): void {
    this.responses.clear();
    this.defaultResponse = 'Mock LLM response';
    this.callCount = 0;
    this.lastRequest = null;
    this.shouldFail = false;
    this.failureError = null;
    this.latencyMs = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────────────────────────────────────

  private findResponse(input: string): string {
    const lowerInput = input.toLowerCase();
    
    for (const [pattern, response] of this.responses) {
      if (lowerInput.includes(pattern)) {
        return response;
      }
    }
    
    return this.defaultResponse;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// PRESET RESPONSES
// ─────────────────────────────────────────────────────────────────────────────────

export const PRESET_RESPONSES = {
  // Shield Gate - Threat Detection
  WEAPON_THREAT: JSON.stringify({
    classification: 'hard_veto',
    category: 'weapons',
    confidence: 0.95,
    reasoning: 'Request involves weapon creation',
  }),

  CHILD_SAFETY_THREAT: JSON.stringify({
    classification: 'hard_veto',
    category: 'child_safety',
    confidence: 0.99,
    reasoning: 'Request involves child exploitation',
  }),

  CRISIS_DETECTED: JSON.stringify({
    classification: 'control_mode',
    category: 'self_harm',
    confidence: 0.92,
    reasoning: 'User expressing suicidal ideation',
    resources: ['988 Suicide & Crisis Lifeline'],
  }),

  FINANCIAL_RISK: JSON.stringify({
    classification: 'soft_veto',
    category: 'financial_risk',
    confidence: 0.85,
    reasoning: 'High-risk financial decision',
  }),

  SAFE_REQUEST: JSON.stringify({
    classification: 'safe',
    category: 'general',
    confidence: 0.98,
    reasoning: 'Request is benign',
  }),

  // Intent Classification
  INTENT_LEARN: JSON.stringify({
    intent: 'sword',
    subIntent: 'goal_creation',
    confidence: 0.9,
    entities: { topic: 'rust', level: 'beginner' },
  }),

  INTENT_QUESTION: JSON.stringify({
    intent: 'lens',
    subIntent: 'factual_query',
    confidence: 0.88,
  }),

  // Curriculum Generation
  CURRICULUM_RUST: JSON.stringify({
    title: 'Learn Rust Programming',
    description: 'A comprehensive path to Rust mastery',
    days: [
      { day: 1, theme: 'Hello Rust', resources: [{ index: 1, minutes: 30 }], totalMinutes: 30 },
      { day: 2, theme: 'Variables', resources: [{ index: 2, minutes: 30 }], totalMinutes: 30 },
      { day: 3, theme: 'Functions', resources: [{ index: 3, minutes: 30 }], totalMinutes: 30 },
    ],
  }),
};

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

export function createMockLLMProvider(): MockLLMProvider {
  return new MockLLMProvider();
}

export function createPresetLLMProvider(): MockLLMProvider {
  const provider = new MockLLMProvider();
  
  // Shield Gate presets
  provider.setResponse('bomb', PRESET_RESPONSES.WEAPON_THREAT);
  provider.setResponse('weapon', PRESET_RESPONSES.WEAPON_THREAT);
  provider.setResponse('hack', PRESET_RESPONSES.WEAPON_THREAT);
  provider.setResponse('child', PRESET_RESPONSES.CHILD_SAFETY_THREAT);
  provider.setResponse('groom', PRESET_RESPONSES.CHILD_SAFETY_THREAT);
  provider.setResponse('kill myself', PRESET_RESPONSES.CRISIS_DETECTED);
  provider.setResponse('end my life', PRESET_RESPONSES.CRISIS_DETECTED);
  provider.setResponse('suicide', PRESET_RESPONSES.CRISIS_DETECTED);
  provider.setResponse('invest my savings', PRESET_RESPONSES.FINANCIAL_RISK);
  
  // Intent presets
  provider.setResponse('learn rust', PRESET_RESPONSES.INTENT_LEARN);
  provider.setResponse('what is', PRESET_RESPONSES.INTENT_QUESTION);
  
  // Default safe response
  provider.setDefaultResponse(PRESET_RESPONSES.SAFE_REQUEST);
  
  return provider;
}

export const mockLLM = createMockLLMProvider();
