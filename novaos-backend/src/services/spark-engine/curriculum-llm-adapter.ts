// ═══════════════════════════════════════════════════════════════════════════════
// CURRICULUM LLM ADAPTER — Bridge ProviderManager to SecureLLMClient
// NovaOS Spark Engine — Phase 17: Full StepGenerator Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides a bridge between the ExecutionPipeline's ProviderManager
// and the Curriculum module's SecureLLMClient interface.
//
// The curriculum module expects a SecureLLMClient with:
//   - execute(request) → SecureLLMResponse
//
// The ProviderManager provides:
//   - generate(prompt, systemPrompt, constraints) → GenerationResult
//
// This adapter bridges the two interfaces, enabling curriculum generation
// to use the same LLM providers as the rest of the pipeline.
//
// Usage:
//   import { initCurriculumLLMFromProvider } from './curriculum-llm-adapter.js';
//   initCurriculumLLMFromProvider(providerManager);
//
// ═══════════════════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';

import type { ProviderManager } from '../../providers/index.js';
import { getLogger } from '../../observability/logging/index.js';
import { incCounter, observeHistogram } from '../../observability/metrics/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'curriculum-llm-adapter' });

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES (Matching curriculum/llm types)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Purpose of the LLM request (for auditing).
 */
export type LLMPurpose = 
  | 'curriculum_structuring'
  | 'resource_classification'
  | 'topic_matching'
  | 'content_summarization';

/**
 * Resource input for sanitization.
 */
export interface ResourceInput {
  readonly title: string;
  readonly description: string;
  readonly provider: string;
  readonly estimatedMinutes: number;
  readonly difficulty: string;
  readonly topics: readonly string[];
}

/**
 * Secure LLM request.
 */
export interface SecureLLMRequest {
  readonly purpose: LLMPurpose;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly resources: readonly ResourceInput[];
  readonly temperature: number;
  readonly maxTokens: number;
  readonly userId: string;
  readonly requestId: string;
}

/**
 * LLM error.
 */
export interface LLMError {
  readonly code: LLMErrorCode;
  readonly message: string;
  readonly cause?: Error;
}

export type LLMErrorCode =
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'TOKEN_LIMIT_EXCEEDED'
  | 'SANITIZATION_BLOCKED'
  | 'CIRCUIT_OPEN'
  | 'INTERNAL_ERROR';

/**
 * LLM audit record.
 */
export interface LLMAudit {
  readonly requestId: string;
  readonly purpose: LLMPurpose;
  readonly userId: string;
  readonly timestamp: Date;
  readonly durationMs: number;
  readonly tokensUsed: number;
  readonly model: string;
  readonly success: boolean;
  readonly errorCode?: LLMErrorCode;
}

/**
 * LLM response metrics.
 */
export interface LLMMetrics {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly durationMs: number;
  readonly model: string;
}

/**
 * Secure LLM response.
 */
export interface SecureLLMResponse<T = string> {
  readonly ok: boolean;
  readonly value?: T;
  readonly rawContent?: string;
  readonly error?: LLMError;
  readonly metrics: LLMMetrics;
  readonly audit: LLMAudit;
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST BUILDER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fluent builder for SecureLLMRequest.
 */
class LLMRequestBuilder {
  private purpose: LLMPurpose = 'curriculum_structuring';
  private systemPrompt: string = '';
  private userPrompt: string = '';
  private resources: ResourceInput[] = [];
  private temperature: number = 0.7;
  private maxTokens: number = 4096;
  private userId: string = '';

  setPurpose(purpose: LLMPurpose): this {
    this.purpose = purpose;
    return this;
  }

  setSystemPrompt(prompt: string): this {
    this.systemPrompt = prompt;
    return this;
  }

  setUserPrompt(prompt: string): this {
    this.userPrompt = prompt;
    return this;
  }

  setResources(resources: ResourceInput[]): this {
    this.resources = resources;
    return this;
  }

  setTemperature(temp: number): this {
    this.temperature = temp;
    return this;
  }

  setMaxTokens(tokens: number): this {
    this.maxTokens = tokens;
    return this;
  }

  setUserId(id: string): this {
    this.userId = id;
    return this;
  }

  build(): SecureLLMRequest {
    return {
      purpose: this.purpose,
      systemPrompt: this.systemPrompt,
      userPrompt: this.userPrompt,
      resources: this.resources,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      userId: this.userId,
      requestId: uuidv4(),
    };
  }
}

/**
 * Create a new LLM request builder.
 */
export function createLLMRequest(): LLMRequestBuilder {
  return new LLMRequestBuilder();
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECURE LLM CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * SecureLLMClient implementation using ProviderManager.
 */
export class SecureLLMClient {
  private readonly providerManager: ProviderManager;

  constructor(providerManager: ProviderManager) {
    this.providerManager = providerManager;
  }

  /**
   * Execute an LLM request.
   */
  async execute<T = string>(request: SecureLLMRequest): Promise<SecureLLMResponse<T>> {
    const startTime = Date.now();
    
    logger.info('Executing LLM request', {
      requestId: request.requestId,
      purpose: request.purpose,
      resourceCount: request.resources.length,
    });

    try {
      // Build the full prompt by combining system and user prompts
      // The ProviderManager handles system prompt separately
      // Note: ProviderManager.generate uses its own internal constraints
      const result = await this.providerManager.generate(
        request.userPrompt,
        request.systemPrompt,
        {} // Empty constraints - ProviderManager uses defaults
      );

      const durationMs = Date.now() - startTime;
      
      // Estimate tokens (ProviderManager may not expose exact token counts)
      const estimatedPromptTokens = Math.ceil((request.systemPrompt.length + request.userPrompt.length) / 4);
      const estimatedCompletionTokens = Math.ceil((result.text?.length ?? 0) / 4);

      const metrics: LLMMetrics = {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
        durationMs,
        model: 'provider-manager',
      };

      const audit: LLMAudit = {
        requestId: request.requestId,
        purpose: request.purpose,
        userId: request.userId,
        timestamp: new Date(),
        durationMs,
        tokensUsed: metrics.totalTokens,
        model: metrics.model,
        success: true,
      };

      incCounter('curriculum_llm_requests_total', { 
        purpose: request.purpose, 
        result: 'success' 
      });
      observeHistogram('curriculum_llm_duration_ms', durationMs);

      logger.info('LLM request completed', {
        requestId: request.requestId,
        durationMs,
        tokensUsed: metrics.totalTokens,
      });

      return {
        ok: true,
        value: result.text as T,
        rawContent: result.text,
        metrics,
        audit,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      const llmError: LLMError = {
        code: this.mapErrorCode(error),
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: error instanceof Error ? error : undefined,
      };

      const metrics: LLMMetrics = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs,
        model: 'unknown',
      };

      const audit: LLMAudit = {
        requestId: request.requestId,
        purpose: request.purpose,
        userId: request.userId,
        timestamp: new Date(),
        durationMs,
        tokensUsed: 0,
        model: 'unknown',
        success: false,
        errorCode: llmError.code,
      };

      incCounter('curriculum_llm_requests_total', { 
        purpose: request.purpose, 
        result: 'error' 
      });

      logger.error('LLM request failed', {
        requestId: request.requestId,
        error: llmError.message,
        errorCode: llmError.code,
        durationMs,
      });

      return {
        ok: false,
        error: llmError,
        metrics,
        audit,
      };
    }
  }

  /**
   * Map error to LLM error code.
   */
  private mapErrorCode(error: unknown): LLMErrorCode {
    if (!(error instanceof Error)) {
      return 'INTERNAL_ERROR';
    }

    const message = error.message.toLowerCase();

    if (message.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return 'RATE_LIMITED';
    }
    if (message.includes('token') && message.includes('limit')) {
      return 'TOKEN_LIMIT_EXCEEDED';
    }
    if (message.includes('circuit')) {
      return 'CIRCUIT_OPEN';
    }

    return 'PROVIDER_ERROR';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let clientInstance: SecureLLMClient | null = null;

/**
 * Get the SecureLLMClient singleton.
 * @throws Error if not initialized
 */
export function getSecureLLMClient(): SecureLLMClient {
  if (!clientInstance) {
    throw new Error(
      'SecureLLMClient not initialized. Call initSecureLLMClientFromManager() first.'
    );
  }
  return clientInstance;
}

/**
 * Initialize the SecureLLMClient from a ProviderManager.
 */
export function initSecureLLMClientFromManager(
  providerManager: ProviderManager
): SecureLLMClient {
  clientInstance = new SecureLLMClient(providerManager);
  logger.info('SecureLLMClient initialized from ProviderManager');
  return clientInstance;
}

/**
 * Reset the SecureLLMClient singleton (for testing).
 */
export function resetSecureLLMClient(): void {
  clientInstance = null;
}

/**
 * Check if the SecureLLMClient is initialized.
 */
export function isSecureLLMClientInitialized(): boolean {
  return clientInstance !== null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK PROVIDER (for testing)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a mock provider for testing.
 */
export function createMockProvider(): {
  execute: <T>(request: SecureLLMRequest) => Promise<SecureLLMResponse<T>>;
} {
  return {
    async execute<T>(request: SecureLLMRequest): Promise<SecureLLMResponse<T>> {
      const mockResponse = JSON.stringify({
        title: 'Mock Curriculum',
        description: 'Mock curriculum for testing',
        targetAudience: 'beginners',
        prerequisites: [],
        difficulty: 'beginner',
        progression: 'gradual',
        days: [
          {
            day: 1,
            theme: 'Introduction',
            objectives: [{ description: 'Learn the basics' }],
            resources: [{ index: 1, minutes: 30, optional: false }],
            exercises: [{ type: 'practice', description: 'Practice basics', minutes: 15, optional: false }],
            totalMinutes: 45,
            difficulty: 'beginner',
          },
        ],
      });

      return {
        ok: true,
        value: mockResponse as T,
        rawContent: mockResponse,
        metrics: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
          durationMs: 100,
          model: 'mock',
        },
        audit: {
          requestId: request.requestId,
          purpose: request.purpose,
          userId: request.userId,
          timestamp: new Date(),
          durationMs: 100,
          tokensUsed: 300,
          model: 'mock',
          success: true,
        },
      };
    },
  };
}
