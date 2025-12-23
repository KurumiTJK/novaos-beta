// ═══════════════════════════════════════════════════════════════════════════════
// MOCK LLM — Mock LLM Provider for Testing
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════
//
// Wraps the existing mock provider with test utilities:
//   - Configurable responses
//   - Call tracking
//   - Error simulation
//   - Response delays
//
// ═══════════════════════════════════════════════════════════════════════════════

import { vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * LLM request message format.
 */
export interface LLMMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * LLM provider request.
 */
export interface ProviderRequest {
  readonly messages: readonly LLMMessage[];
  readonly maxTokens: number;
  readonly temperature?: number;
}

/**
 * LLM provider response.
 */
export interface ProviderResponse {
  readonly content: string;
  readonly finishReason: 'stop' | 'length' | 'content_filter';
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
  readonly model: string;
}

/**
 * LLM provider adapter interface.
 */
export interface LLMProviderAdapter {
  readonly provider: string;
  execute(request: ProviderRequest): Promise<ProviderResponse>;
}

/**
 * Mock response configuration.
 */
export interface MockResponseConfig {
  /** Response content */
  content?: string;
  /** Response delay in ms */
  delayMs?: number;
  /** Error to throw */
  error?: Error;
  /** Custom response handler */
  handler?: (request: ProviderRequest) => ProviderResponse | Promise<ProviderResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK LLM PROVIDER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Configurable mock LLM provider for testing.
 */
export class MockLLMProvider implements LLMProviderAdapter {
  readonly provider = 'mock';
  
  private responseQueue: MockResponseConfig[] = [];
  private defaultResponse: MockResponseConfig = {};
  private callHistory: Array<{ request: ProviderRequest; response: ProviderResponse }> = [];
  
  /**
   * Execute a mock LLM request.
   */
  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    // Get response config from queue or use default
    const config = this.responseQueue.shift() ?? this.defaultResponse;
    
    // Handle delay
    if (config.delayMs) {
      await new Promise(resolve => setTimeout(resolve, config.delayMs));
    }
    
    // Handle error
    if (config.error) {
      throw config.error;
    }
    
    // Handle custom handler
    if (config.handler) {
      const response = await config.handler(request);
      this.callHistory.push({ request, response });
      return response;
    }
    
    // Generate default response
    const response = this.generateResponse(request, config.content);
    this.callHistory.push({ request, response });
    return response;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Configuration Methods
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Queue a specific response for the next call.
   */
  queueResponse(config: MockResponseConfig): this {
    this.responseQueue.push(config);
    return this;
  }
  
  /**
   * Queue a simple text response.
   */
  queueText(content: string): this {
    return this.queueResponse({ content });
  }
  
  /**
   * Queue a JSON response.
   */
  queueJSON<T>(data: T): this {
    return this.queueResponse({ content: JSON.stringify(data) });
  }
  
  /**
   * Queue an error for the next call.
   */
  queueError(error: Error): this {
    return this.queueResponse({ error });
  }
  
  /**
   * Set the default response for all calls.
   */
  setDefaultResponse(config: MockResponseConfig): this {
    this.defaultResponse = config;
    return this;
  }
  
  /**
   * Set default to return curriculum structure.
   */
  setDefaultCurriculum(): this {
    return this.setDefaultResponse({
      handler: (req) => this.generateCurriculumResponse(req),
    });
  }
  
  /**
   * Set default to return spark generation.
   */
  setDefaultSpark(): this {
    return this.setDefaultResponse({
      handler: (req) => this.generateSparkResponse(req),
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Inspection Methods
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get call history.
   */
  getCalls(): ReadonlyArray<{ request: ProviderRequest; response: ProviderResponse }> {
    return this.callHistory;
  }
  
  /**
   * Get number of calls made.
   */
  getCallCount(): number {
    return this.callHistory.length;
  }
  
  /**
   * Get the last call made.
   */
  getLastCall(): { request: ProviderRequest; response: ProviderResponse } | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }
  
  /**
   * Check if a specific prompt was sent.
   */
  wasCalledWith(substring: string): boolean {
    return this.callHistory.some(call => {
      const userMessage = call.request.messages.find(m => m.role === 'user');
      return userMessage?.content.includes(substring) ?? false;
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Reset
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Reset all state.
   */
  reset(): void {
    this.responseQueue = [];
    this.defaultResponse = {};
    this.callHistory = [];
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Response Generators
  // ─────────────────────────────────────────────────────────────────────────────
  
  private generateResponse(request: ProviderRequest, content?: string): ProviderResponse {
    const userMessage = request.messages.find(m => m.role === 'user');
    const prompt = userMessage?.content ?? '';
    
    // Use provided content or generate based on prompt
    const responseContent = content ?? this.generateContentFromPrompt(prompt);
    
    return {
      content: responseContent,
      finishReason: 'stop',
      usage: {
        promptTokens: this.estimateTokens(prompt),
        completionTokens: this.estimateTokens(responseContent),
        totalTokens: this.estimateTokens(prompt) + this.estimateTokens(responseContent),
      },
      model: 'mock-v1',
    };
  }
  
  private generateContentFromPrompt(prompt: string): string {
    // Generate appropriate mock responses based on prompt content
    if (prompt.includes('curriculum') || prompt.includes('structure')) {
      return JSON.stringify({
        days: [
          { day: 1, theme: 'Introduction', resources: [{ index: 1, minutes: 30 }], totalMinutes: 30 },
          { day: 2, theme: 'Fundamentals', resources: [{ index: 2, minutes: 45 }], totalMinutes: 45 },
        ],
      });
    }
    
    if (prompt.includes('spark') || prompt.includes('action')) {
      return JSON.stringify({
        action: 'Open the first chapter and read the introduction',
        estimatedMinutes: 15,
      });
    }
    
    if (prompt.includes('quest') || prompt.includes('week')) {
      return JSON.stringify({
        quests: [
          { title: 'Week 1: Basics', description: 'Learn the fundamentals', estimatedDays: 7 },
          { title: 'Week 2: Intermediate', description: 'Build on basics', estimatedDays: 7 },
        ],
      });
    }
    
    if (prompt.includes('classify') || prompt.includes('intent')) {
      return JSON.stringify({
        classification: 'learn',
        confidence: 0.95,
      });
    }
    
    return 'Mock response for testing.';
  }
  
  private generateCurriculumResponse(request: ProviderRequest): ProviderResponse {
    const content = JSON.stringify({
      days: [
        {
          day: 1,
          theme: 'Getting Started',
          objective: 'Set up environment and write first program',
          resources: [
            { index: 1, minutes: 20, section: 'Chapter 1' },
            { index: 2, minutes: 25, section: '0:00:00-0:25:00' },
          ],
          totalMinutes: 45,
        },
        {
          day: 2,
          theme: 'Core Concepts',
          objective: 'Learn fundamental concepts',
          resources: [
            { index: 1, minutes: 30, section: 'Chapter 2' },
          ],
          totalMinutes: 30,
        },
        {
          day: 3,
          theme: 'Practice',
          objective: 'Apply concepts through exercises',
          resources: [
            { index: 3, minutes: 45, task: 'Complete exercises 1-5' },
          ],
          totalMinutes: 45,
        },
      ],
    });
    
    return {
      content,
      finishReason: 'stop',
      usage: {
        promptTokens: 500,
        completionTokens: 300,
        totalTokens: 800,
      },
      model: 'mock-v1',
    };
  }
  
  private generateSparkResponse(request: ProviderRequest): ProviderResponse {
    const content = JSON.stringify({
      action: 'Open the Rust Book and read the first section of Chapter 1',
      estimatedMinutes: 10,
      resourceSection: 'Chapter 1.1',
    });
    
    return {
      content,
      finishReason: 'stop',
      usage: {
        promptTokens: 200,
        completionTokens: 50,
        totalTokens: 250,
      },
      model: 'mock-v1',
    };
  }
  
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON & FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

let mockLLMInstance: MockLLMProvider | null = null;

/**
 * Get or create the mock LLM provider singleton.
 */
export function getMockLLM(): MockLLMProvider {
  if (!mockLLMInstance) {
    mockLLMInstance = new MockLLMProvider();
  }
  return mockLLMInstance;
}

/**
 * Reset the mock LLM (call between tests).
 */
export function resetMockLLM(): void {
  if (mockLLMInstance) {
    mockLLMInstance.reset();
  }
}

/**
 * Create a new isolated mock LLM instance.
 */
export function createMockLLM(): MockLLMProvider {
  return new MockLLMProvider();
}

/**
 * Create a spy-wrapped mock LLM for call tracking with vitest.
 */
export function createSpyLLM(): MockLLMProvider & { executeSpy: ReturnType<typeof vi.fn> } {
  const mock = new MockLLMProvider();
  const executeSpy = vi.fn(mock.execute.bind(mock));
  mock.execute = executeSpy as typeof mock.execute;
  return Object.assign(mock, { executeSpy });
}
