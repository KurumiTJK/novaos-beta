// ═══════════════════════════════════════════════════════════════════════════════
// LLM TYPES — Secure LLM Request/Response Types
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Types for the secure LLM layer:
//   - Request types with limits and auditing
//   - Response types with metrics
//   - Sanitization and injection detection types
//
// INVARIANT: LLM only organizes verified resources, never fabricates them.
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LLM PURPOSE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Purpose of the LLM request (for auditing and rate limiting).
 */
export type LLMPurpose =
  | 'curriculum_structuring'   // Organizing verified resources into curriculum
  | 'goal_refinement'          // Refining user goals into structured format
  | 'step_generation'          // Generating next steps for a quest
  | 'spark_creation'           // Creating spark reminders
  | 'content_summary'          // Summarizing verified content
  | 'difficulty_assessment'    // Assessing resource difficulty
  | 'test';                    // Testing/development

/**
 * Purpose metadata for rate limiting and auditing.
 */
export const PURPOSE_LIMITS: Record<LLMPurpose, {
  maxTokensOutput: number;
  maxTokensInput: number;
  timeoutMs: number;
  priority: number; // Lower = higher priority
}> = {
  curriculum_structuring: {
    maxTokensOutput: 4000,
    maxTokensInput: 8000,
    timeoutMs: 30000,
    priority: 2,
  },
  goal_refinement: {
    maxTokensOutput: 2000,
    maxTokensInput: 4000,
    timeoutMs: 20000,
    priority: 1,
  },
  step_generation: {
    maxTokensOutput: 2000,
    maxTokensInput: 4000,
    timeoutMs: 20000,
    priority: 1,
  },
  spark_creation: {
    maxTokensOutput: 500,
    maxTokensInput: 2000,
    timeoutMs: 10000,
    priority: 1,
  },
  content_summary: {
    maxTokensOutput: 1000,
    maxTokensInput: 6000,
    timeoutMs: 15000,
    priority: 3,
  },
  difficulty_assessment: {
    maxTokensOutput: 500,
    maxTokensInput: 2000,
    timeoutMs: 10000,
    priority: 3,
  },
  test: {
    maxTokensOutput: 1000,
    maxTokensInput: 2000,
    timeoutMs: 10000,
    priority: 10,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// SANITIZATION TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Severity of a suspicious pattern.
 */
export type PatternSeverity =
  | 'critical'   // Immediate block, likely attack
  | 'high'       // Block and log
  | 'medium'     // Sanitize and warn
  | 'low';       // Log only

/**
 * Category of suspicious pattern.
 */
export type PatternCategory =
  | 'role_manipulation'      // Attempting to change AI role
  | 'instruction_override'   // "Ignore previous instructions"
  | 'system_injection'       // "System:" prefix attempts
  | 'jailbreak'              // Known jailbreak patterns
  | 'data_exfiltration'      // Attempting to extract system info
  | 'unicode_abuse'          // Homoglyph/invisible character attacks
  | 'prompt_leaking'         // Attempting to reveal system prompt
  | 'resource_fabrication';  // Attempting to inject fake resources

/**
 * A detected suspicious pattern.
 */
export interface SuspiciousPattern {
  /** Pattern category */
  readonly category: PatternCategory;
  
  /** Severity level */
  readonly severity: PatternSeverity;
  
  /** Description of what was detected */
  readonly description: string;
  
  /** The matched text (redacted if sensitive) */
  readonly matchedText: string;
  
  /** Position in input */
  readonly position: {
    readonly start: number;
    readonly end: number;
  };
  
  /** Whether input should be blocked */
  readonly shouldBlock: boolean;
}

/**
 * Result of prompt sanitization.
 */
export interface SanitizationResult {
  /** Sanitized text (safe to use) */
  readonly sanitizedText: string;
  
  /** Whether the input was modified */
  readonly wasModified: boolean;
  
  /** Detected suspicious patterns */
  readonly patterns: readonly SuspiciousPattern[];
  
  /** Whether the input should be blocked entirely */
  readonly shouldBlock: boolean;
  
  /** Block reason if applicable */
  readonly blockReason?: string;
  
  /** Sanitization metadata */
  readonly metadata: {
    readonly originalLength: number;
    readonly sanitizedLength: number;
    readonly charactersRemoved: number;
    readonly unicodeNormalized: boolean;
    readonly controlCharsStripped: boolean;
  };
}

/**
 * Sanitized prompt input ready for LLM.
 */
export interface SanitizedPromptInput {
  /** The sanitized system prompt */
  readonly systemPrompt: string;
  
  /** The sanitized user prompt */
  readonly userPrompt: string;
  
  /** Combined sanitization result */
  readonly sanitization: SanitizationResult;
  
  /** Resource metadata (sanitized) */
  readonly resourceContext?: SanitizedResourceContext;
}

/**
 * Sanitized resource context for curriculum structuring.
 */
export interface SanitizedResourceContext {
  /** Sanitized resource summaries */
  readonly resources: readonly SanitizedResourceSummary[];
  
  /** Total resources provided */
  readonly totalCount: number;
  
  /** Resources that were filtered out */
  readonly filteredCount: number;
}

/**
 * Sanitized summary of a verified resource.
 */
export interface SanitizedResourceSummary {
  /** Resource index (1-based, used in LLM output) */
  readonly index: number;
  
  /** Sanitized title */
  readonly title: string;
  
  /** Sanitized description (truncated) */
  readonly description: string;
  
  /** Provider type */
  readonly provider: string;
  
  /** Estimated duration in minutes */
  readonly estimatedMinutes: number;
  
  /** Difficulty level */
  readonly difficulty: string;
  
  /** Topics covered */
  readonly topics: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Token limits for a request.
 */
export interface TokenLimits {
  /** Maximum input tokens */
  readonly maxInputTokens: number;
  
  /** Maximum output tokens */
  readonly maxOutputTokens: number;
  
  /** Reserved tokens for system prompt */
  readonly reservedSystemTokens: number;
}

/**
 * Secure LLM request.
 */
export interface SecureLLMRequest {
  /** Request purpose (for auditing) */
  readonly purpose: LLMPurpose;
  
  /** Sanitized prompt input */
  readonly prompt: SanitizedPromptInput;
  
  /** Token limits */
  readonly limits: TokenLimits;
  
  /** Timeout in milliseconds */
  readonly timeoutMs: number;
  
  /** Request metadata */
  readonly metadata: {
    /** Unique request ID */
    readonly requestId: string;
    /** User ID making the request */
    readonly userId?: string;
    /** Correlation ID for tracing */
    readonly correlationId?: string;
    /** Timestamp */
    readonly timestamp: Date;
  };
  
  /** Expected output schema (for validation) */
  readonly expectedSchema?: {
    readonly type: 'json' | 'text';
    readonly schemaName?: string;
  };
  
  /** Temperature override (optional) */
  readonly temperature?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * LLM response metrics.
 */
export interface LLMResponseMetrics {
  /** Time to first token (ms) */
  readonly timeToFirstTokenMs?: number;
  
  /** Total request duration (ms) */
  readonly totalDurationMs: number;
  
  /** Input tokens used */
  readonly inputTokens: number;
  
  /** Output tokens generated */
  readonly outputTokens: number;
  
  /** Total tokens */
  readonly totalTokens: number;
  
  /** Model used */
  readonly model: string;
  
  /** Whether response was from cache */
  readonly cached: boolean;
  
  /** Number of retries */
  readonly retries: number;
}

/**
 * LLM error codes.
 */
export type LLMErrorCode =
  | 'SANITIZATION_BLOCKED'     // Input blocked by sanitizer
  | 'TOKEN_LIMIT_EXCEEDED'     // Too many tokens
  | 'TIMEOUT'                  // Request timeout
  | 'CIRCUIT_OPEN'             // Circuit breaker open
  | 'RATE_LIMITED'             // Rate limit hit
  | 'PROVIDER_ERROR'           // LLM provider error
  | 'INVALID_RESPONSE'         // Response failed validation
  | 'HALLUCINATION_DETECTED'   // Fabricated content detected
  | 'SCHEMA_VALIDATION_FAILED' // Output schema validation failed
  | 'UNKNOWN';                 // Unknown error

/**
 * LLM error.
 */
export interface LLMError {
  readonly code: LLMErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly cause?: Error;
}

/**
 * Audit entry for LLM request.
 */
export interface LLMAudit {
  /** Request ID */
  readonly requestId: string;
  
  /** Request purpose */
  readonly purpose: LLMPurpose;
  
  /** User ID */
  readonly userId?: string;
  
  /** Timestamp */
  readonly timestamp: Date;
  
  /** Request succeeded */
  readonly success: boolean;
  
  /** Error code if failed */
  readonly errorCode?: LLMErrorCode;
  
  /** Metrics */
  readonly metrics: LLMResponseMetrics;
  
  /** Sanitization summary */
  readonly sanitization: {
    readonly patternsDetected: number;
    readonly wasModified: boolean;
    readonly wasBlocked: boolean;
  };
  
  /** Output validation summary */
  readonly validation?: {
    readonly schemaValid: boolean;
    readonly hallucinationCheck: boolean;
    readonly issuesFound: readonly string[];
  };
}

/**
 * Secure LLM response.
 */
export interface SecureLLMResponse<T = string> {
  /** Whether request succeeded */
  readonly ok: boolean;
  
  /** Response content (if successful) */
  readonly content?: T;
  
  /** Raw text response */
  readonly rawContent?: string;
  
  /** Error (if failed) */
  readonly error?: LLMError;
  
  /** Response metrics */
  readonly metrics: LLMResponseMetrics;
  
  /** Audit record */
  readonly audit: LLMAudit;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * LLM provider type.
 */
export type LLMProvider = 'openai' | 'gemini' | 'mock';

/**
 * Raw provider request (after security processing).
 */
export interface ProviderRequest {
  readonly model: string;
  readonly messages: readonly ProviderMessage[];
  readonly maxTokens: number;
  readonly temperature: number;
  readonly timeoutMs: number;
}

/**
 * Provider message format.
 */
export interface ProviderMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Raw provider response.
 */
export interface ProviderResponse {
  readonly content: string;
  readonly finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
  readonly model: string;
}

/**
 * Provider adapter interface.
 */
export interface LLMProviderAdapter {
  readonly provider: LLMProvider;
  execute(request: ProviderRequest): Promise<ProviderResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Secure LLM client configuration.
 */
export interface SecureLLMConfig {
  /** LLM provider */
  readonly provider: LLMProvider;
  
  /** Model name */
  readonly model: string;
  
  /** Default temperature */
  readonly temperature: number;
  
  /** Default timeout (ms) */
  readonly defaultTimeoutMs: number;
  
  /** Default max output tokens */
  readonly defaultMaxOutputTokens: number;
  
  /** Default max input tokens */
  readonly defaultMaxInputTokens: number;
  
  /** Circuit breaker name */
  readonly circuitBreakerName: string;
  
  /** Enable request auditing */
  readonly enableAuditing: boolean;
  
  /** Enable response caching */
  readonly enableCaching: boolean;
  
  /** Cache TTL (ms) */
  readonly cacheTtlMs: number;
}

/**
 * Default secure LLM configuration.
 */
export const DEFAULT_SECURE_LLM_CONFIG: SecureLLMConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  defaultTimeoutMs: 30000,
  defaultMaxOutputTokens: 4000,
  defaultMaxInputTokens: 8000,
  circuitBreakerName: 'llm-provider',
  enableAuditing: true,
  enableCaching: false,
  cacheTtlMs: 300000, // 5 minutes
};

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Token estimation constants.
 */
export const TOKEN_ESTIMATION = {
  /** Average characters per token (GPT-4) */
  CHARS_PER_TOKEN: 4,
  
  /** Safety margin for token counting */
  SAFETY_MARGIN: 1.1,
  
  /** Maximum tokens for a single message */
  MAX_MESSAGE_TOKENS: 32000,
  
  /** Minimum tokens to reserve for response */
  MIN_RESPONSE_TOKENS: 100,
} as const;

/**
 * Sanitization constants.
 */
export const SANITIZATION_LIMITS = {
  /** Maximum input length before truncation */
  MAX_INPUT_LENGTH: 100000,
  
  /** Maximum individual resource description length */
  MAX_RESOURCE_DESCRIPTION: 500,
  
  /** Maximum resource title length */
  MAX_RESOURCE_TITLE: 200,
  
  /** Maximum number of resources in context */
  MAX_RESOURCES_IN_CONTEXT: 50,
} as const;
