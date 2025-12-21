// ═══════════════════════════════════════════════════════════════════════════════
// SECURE LLM CLIENT — Protected LLM Access Layer
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Wraps the LLM provider with security controls:
//   1. Sanitize input (prompt injection protection)
//   2. Validate token limits
//   3. Circuit breaker (availability protection)
//   4. Execute with timeout
//   5. Validate output
//   6. Audit logging
//
// INVARIANT: All LLM requests MUST go through this client.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Result } from '../../../../types/result.js';
import { ok, err } from '../../../../types/result.js';
import { getLogger } from '../../../../observability/logging/index.js';
import { incCounter, observeHistogram } from '../../../../observability/metrics/index.js';
import { getCircuitBreaker } from '../../../../infrastructure/circuit-breaker/breaker.js';
import { CircuitOpenError } from '../../../../infrastructure/circuit-breaker/types.js';

import type {
  LLMPurpose,
  SecureLLMRequest,
  SecureLLMResponse,
  LLMError,
  LLMErrorCode,
  LLMAudit,
  LLMResponseMetrics,
  SecureLLMConfig,
  SanitizedPromptInput,
  TokenLimits,
  ProviderRequest,
  ProviderResponse,
  LLMProviderAdapter,
} from './types.js';
import { DEFAULT_SECURE_LLM_CONFIG, PURPOSE_LIMITS } from './types.js';
import { sanitizePromptInput, sanitizeResourceContext, type ResourceInput } from './sanitizer.js';
import {
  estimateTokens,
  validateTokenLimits,
  getDefaultLimits,
  withTimeout,
  TimeoutError,
} from './token-counter.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'secure-llm-client' });

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST ID GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

let requestCounter = 0;

function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (++requestCounter).toString(36).padStart(4, '0');
  const random = Math.random().toString(36).slice(2, 6);
  return `llm-${timestamp}-${counter}-${random}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER ADAPTERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Adapter for existing ProviderManager.
 * Bridges the new SecureLLMClient to the existing provider infrastructure.
 */
export interface ProviderManagerBridge {
  generate(
    prompt: string,
    systemPrompt: string,
    constraints?: { maxTokens?: number; temperature?: number },
  ): Promise<{
    text: string;
    model: string;
    tokensUsed: number;
  }>;
}

/**
 * Create an adapter from ProviderManager.
 */
export function createProviderAdapter(
  manager: ProviderManagerBridge,
  model: string
): LLMProviderAdapter {
  return {
    provider: 'openai', // Default, actual provider is managed by ProviderManager
    async execute(request: ProviderRequest): Promise<ProviderResponse> {
      const systemMessage = request.messages.find(m => m.role === 'system');
      const userMessage = request.messages.find(m => m.role === 'user');
      
      const result = await manager.generate(
        userMessage?.content ?? '',
        systemMessage?.content ?? '',
        {
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        }
      );
      
      return {
        content: result.text,
        finishReason: 'stop',
        usage: {
          promptTokens: estimateTokens(
            (systemMessage?.content ?? '') + (userMessage?.content ?? '')
          ),
          completionTokens: estimateTokens(result.text),
          totalTokens: result.tokensUsed,
        },
        model: result.model,
      };
    },
  };
}

/**
 * Mock provider for testing.
 */
export function createMockProvider(): LLMProviderAdapter {
  return {
    provider: 'mock',
    async execute(request: ProviderRequest): Promise<ProviderResponse> {
      const userMessage = request.messages.find(m => m.role === 'user');
      const prompt = userMessage?.content ?? '';
      
      // Generate mock response based on content
      let response = 'Mock response for testing.';
      
      if (prompt.includes('curriculum') || prompt.includes('resource')) {
        response = JSON.stringify({
          days: [
            {
              day: 1,
              theme: 'Introduction',
              resources: [{ index: 1, minutes: 30 }],
              totalMinutes: 30,
            },
          ],
        });
      }
      
      return {
        content: response,
        finishReason: 'stop',
        usage: {
          promptTokens: estimateTokens(prompt),
          completionTokens: estimateTokens(response),
          totalTokens: estimateTokens(prompt) + estimateTokens(response),
        },
        model: 'mock-v1',
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECURE LLM CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Secure LLM client with full security pipeline.
 */
export class SecureLLMClient {
  private readonly config: SecureLLMConfig;
  private readonly provider: LLMProviderAdapter;
  private readonly auditLog: LLMAudit[] = [];
  private readonly maxAuditEntries = 1000;
  
  constructor(
    provider: LLMProviderAdapter,
    config?: Partial<SecureLLMConfig>
  ) {
    this.config = { ...DEFAULT_SECURE_LLM_CONFIG, ...config };
    this.provider = provider;
    
    logger.info('SecureLLMClient initialized', {
      provider: this.provider.provider,
      model: this.config.model,
      circuitBreaker: this.config.circuitBreakerName,
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Main Entry Point
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Execute a secure LLM request.
   */
  async execute<T = string>(
    request: SecureLLMRequest,
    parser?: (text: string) => T
  ): Promise<SecureLLMResponse<T>> {
    const startTime = Date.now();
    const requestId = request.metadata.requestId;
    
    logger.debug('Processing LLM request', {
      requestId,
      purpose: request.purpose,
      userId: request.metadata.userId,
    });
    
    try {
      // Step 1: Check sanitization result
      if (request.prompt.sanitization.shouldBlock) {
        return this.createErrorResponse(
          request,
          'SANITIZATION_BLOCKED',
          request.prompt.sanitization.blockReason ?? 'Input blocked by sanitizer',
          startTime,
          false
        );
      }
      
      // Step 2: Validate token limits
      const tokenValidation = validateTokenLimits(
        request.prompt.systemPrompt,
        request.prompt.userPrompt,
        request.limits
      );
      
      if (!tokenValidation.valid) {
        return this.createErrorResponse(
          request,
          'TOKEN_LIMIT_EXCEEDED',
          tokenValidation.error ?? 'Token limit exceeded',
          startTime,
          false
        );
      }
      
      // Step 3: Execute with circuit breaker and timeout
      const result = await this.executeWithProtection(request, startTime);
      
      if (!result.ok) {
        return result.value as SecureLLMResponse<T>;
      }
      
      const providerResponse = result.value;
      
      // Step 4: Parse response if parser provided
      let parsedContent: T;
      if (parser) {
        try {
          parsedContent = parser(providerResponse.content);
        } catch (parseError) {
          logger.warn('Response parsing failed', {
            requestId,
            error: parseError instanceof Error ? parseError.message : 'Unknown',
          });
          
          return this.createErrorResponse(
            request,
            'SCHEMA_VALIDATION_FAILED',
            `Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
            startTime,
            false,
            providerResponse
          );
        }
      } else {
        parsedContent = providerResponse.content as T;
      }
      
      // Step 5: Create success response
      const metrics = this.createMetrics(providerResponse, startTime);
      const audit = this.createAudit(request, true, metrics);
      
      this.recordAudit(audit);
      this.recordMetrics(request.purpose, 'success', metrics);
      
      logger.info('LLM request completed', {
        requestId,
        purpose: request.purpose,
        durationMs: metrics.totalDurationMs,
        tokens: metrics.totalTokens,
      });
      
      return {
        ok: true,
        content: parsedContent,
        rawContent: providerResponse.content,
        metrics,
        audit,
      };
      
    } catch (error) {
      logger.error('LLM request failed with unexpected error', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      
      return this.createErrorResponse(
        request,
        'UNKNOWN',
        error instanceof Error ? error.message : 'Unknown error',
        startTime,
        false
      );
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Protected Execution
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Execute with circuit breaker and timeout protection.
   */
  private async executeWithProtection(
    request: SecureLLMRequest,
    startTime: number
  ): Promise<Result<ProviderResponse, SecureLLMResponse<unknown>>> {
    const breaker = getCircuitBreaker(this.config.circuitBreakerName);
    const requestId = request.metadata.requestId;
    
    try {
      // Wrap in circuit breaker
      const providerResponse = await breaker.execute(async () => {
        // Execute with timeout
        const result = await withTimeout(
          async (_signal) => {
            const providerRequest = this.buildProviderRequest(request);
            return this.provider.execute(providerRequest);
          },
          request.timeoutMs,
          'LLM request'
        );
        
        if (!result.ok) {
          throw result.error;
        }
        
        return result.value;
      });
      
      return ok(providerResponse);
      
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        logger.warn('Circuit breaker open', {
          requestId,
          circuit: error.circuitName,
          retryAfterMs: error.retryAfterMs,
        });
        
        return err(this.createErrorResponse(
          request,
          'CIRCUIT_OPEN',
          `Service temporarily unavailable. Retry after ${error.retryAfterMs}ms`,
          startTime,
          true
        ) as SecureLLMResponse<unknown>);
      }
      
      if (error instanceof TimeoutError) {
        logger.warn('Request timeout', {
          requestId,
          timeoutMs: error.timeoutMs,
        });
        
        return err(this.createErrorResponse(
          request,
          'TIMEOUT',
          `Request timed out after ${error.timeoutMs}ms`,
          startTime,
          true
        ) as SecureLLMResponse<unknown>);
      }
      
      // Provider error
      logger.error('Provider error', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      
      return err(this.createErrorResponse(
        request,
        'PROVIDER_ERROR',
        error instanceof Error ? error.message : 'Provider error',
        startTime,
        true
      ) as SecureLLMResponse<unknown>);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Request Building
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Build provider request from secure request.
   */
  private buildProviderRequest(request: SecureLLMRequest): ProviderRequest {
    return {
      model: this.config.model,
      messages: [
        { role: 'system', content: request.prompt.systemPrompt },
        { role: 'user', content: request.prompt.userPrompt },
      ],
      maxTokens: request.limits.maxOutputTokens,
      temperature: request.temperature ?? this.config.temperature,
      timeoutMs: request.timeoutMs,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Response Building
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Create an error response.
   */
  private createErrorResponse<T>(
    request: SecureLLMRequest,
    code: LLMErrorCode,
    message: string,
    startTime: number,
    retryable: boolean,
    providerResponse?: ProviderResponse
  ): SecureLLMResponse<T> {
    const durationMs = Date.now() - startTime;
    
    const error: LLMError = {
      code,
      message,
      retryable,
      retryAfterMs: retryable ? this.calculateRetryDelay(code) : undefined,
    };
    
    const metrics: LLMResponseMetrics = providerResponse
      ? this.createMetrics(providerResponse, startTime)
      : {
          totalDurationMs: durationMs,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          model: this.config.model,
          cached: false,
          retries: 0,
        };
    
    const audit = this.createAudit(request, false, metrics, code);
    
    this.recordAudit(audit);
    this.recordMetrics(request.purpose, 'error', metrics, code);
    
    return {
      ok: false,
      error,
      metrics,
      audit,
    };
  }
  
  /**
   * Create response metrics.
   */
  private createMetrics(
    response: ProviderResponse,
    startTime: number
  ): LLMResponseMetrics {
    return {
      totalDurationMs: Date.now() - startTime,
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      model: response.model,
      cached: false,
      retries: 0,
    };
  }
  
  /**
   * Create audit entry.
   */
  private createAudit(
    request: SecureLLMRequest,
    success: boolean,
    metrics: LLMResponseMetrics,
    errorCode?: LLMErrorCode
  ): LLMAudit {
    return {
      requestId: request.metadata.requestId,
      purpose: request.purpose,
      userId: request.metadata.userId,
      timestamp: new Date(),
      success,
      errorCode,
      metrics,
      sanitization: {
        patternsDetected: request.prompt.sanitization.patterns.length,
        wasModified: request.prompt.sanitization.wasModified,
        wasBlocked: request.prompt.sanitization.shouldBlock,
      },
    };
  }
  
  /**
   * Calculate retry delay based on error type.
   */
  private calculateRetryDelay(code: LLMErrorCode): number {
    switch (code) {
      case 'RATE_LIMITED':
        return 60000; // 1 minute
      case 'CIRCUIT_OPEN':
        return 30000; // 30 seconds
      case 'TIMEOUT':
      case 'PROVIDER_ERROR':
        return 5000; // 5 seconds
      default:
        return 1000; // 1 second
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Audit & Metrics
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Record audit entry.
   */
  private recordAudit(audit: LLMAudit): void {
    if (!this.config.enableAuditing) return;
    
    this.auditLog.push(audit);
    
    // Trim if over limit
    while (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.shift();
    }
  }
  
  /**
   * Record metrics.
   */
  private recordMetrics(
    purpose: LLMPurpose,
    result: 'success' | 'error',
    metrics: LLMResponseMetrics,
    errorCode?: LLMErrorCode
  ): void {
    incCounter('llm_requests_total', {
      purpose,
      result,
      error_code: errorCode ?? 'none',
    });
    
    observeHistogram('llm_request_duration_ms', metrics.totalDurationMs, {
      purpose,
    });
    
    if (metrics.totalTokens > 0) {
      observeHistogram('llm_tokens_used', metrics.totalTokens, {
        purpose,
        type: 'total',
      });
    }
  }
  
  /**
   * Get recent audit entries.
   */
  getAuditLog(limit: number = 100): readonly LLMAudit[] {
    return this.auditLog.slice(-limit);
  }
  
  /**
   * Clear audit log.
   */
  clearAuditLog(): void {
    this.auditLog.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST BUILDER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Builder for creating SecureLLMRequest.
 */
export class SecureLLMRequestBuilder {
  private purpose: LLMPurpose = 'test';
  private systemPrompt: string = '';
  private userPrompt: string = '';
  private resources: ResourceInput[] = [];
  private limits?: TokenLimits;
  private timeoutMs?: number;
  private temperature?: number;
  private userId?: string;
  private correlationId?: string;
  
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
  
  setLimits(limits: TokenLimits): this {
    this.limits = limits;
    return this;
  }
  
  setTimeoutMs(timeoutMs: number): this {
    this.timeoutMs = timeoutMs;
    return this;
  }
  
  setTemperature(temperature: number): this {
    this.temperature = temperature;
    return this;
  }
  
  setUserId(userId: string): this {
    this.userId = userId;
    return this;
  }
  
  setCorrelationId(correlationId: string): this {
    this.correlationId = correlationId;
    return this;
  }
  
  build(): SecureLLMRequest {
    // Sanitize resources if provided
    const resourceContext = this.resources.length > 0
      ? sanitizeResourceContext(this.resources)
      : undefined;
    
    // Sanitize prompts
    const sanitizedPrompt = sanitizePromptInput(
      this.systemPrompt,
      this.userPrompt,
      resourceContext
    );
    
    // Get default limits if not specified
    const limits = this.limits ?? getDefaultLimits(this.purpose);
    
    // Get timeout from purpose if not specified
    const timeoutMs = this.timeoutMs ?? PURPOSE_LIMITS[this.purpose].timeoutMs;
    
    return {
      purpose: this.purpose,
      prompt: sanitizedPrompt,
      limits,
      timeoutMs,
      temperature: this.temperature,
      metadata: {
        requestId: generateRequestId(),
        userId: this.userId,
        correlationId: this.correlationId,
        timestamp: new Date(),
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let clientInstance: SecureLLMClient | null = null;

/**
 * Get the secure LLM client singleton.
 */
export function getSecureLLMClient(): SecureLLMClient {
  if (!clientInstance) {
    throw new Error('SecureLLMClient not initialized. Call initSecureLLMClient first.');
  }
  return clientInstance;
}

/**
 * Initialize the secure LLM client.
 */
export function initSecureLLMClient(
  provider: LLMProviderAdapter,
  config?: Partial<SecureLLMConfig>
): SecureLLMClient {
  clientInstance = new SecureLLMClient(provider, config);
  return clientInstance;
}

/**
 * Initialize with ProviderManager bridge.
 */
export function initSecureLLMClientFromManager(
  manager: ProviderManagerBridge,
  config?: Partial<SecureLLMConfig>
): SecureLLMClient {
  const model = config?.model ?? DEFAULT_SECURE_LLM_CONFIG.model;
  const adapter = createProviderAdapter(manager, model);
  return initSecureLLMClient(adapter, config);
}

/**
 * Reset the client (for testing).
 */
export function resetSecureLLMClient(): void {
  clientInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new request builder.
 */
export function createLLMRequest(): SecureLLMRequestBuilder {
  return new SecureLLMRequestBuilder();
}
