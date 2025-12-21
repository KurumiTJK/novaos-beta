// ═══════════════════════════════════════════════════════════════════════════════
// LLM MODULE — Secure LLM Access Layer
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Purpose
  type LLMPurpose,
  PURPOSE_LIMITS,
  
  // Sanitization
  type PatternSeverity,
  type PatternCategory,
  type SuspiciousPattern,
  type SanitizationResult,
  type SanitizedPromptInput,
  type SanitizedResourceContext,
  type SanitizedResourceSummary,
  
  // Request/Response
  type TokenLimits,
  type SecureLLMRequest,
  type SecureLLMResponse,
  type LLMResponseMetrics,
  type LLMErrorCode,
  type LLMError,
  type LLMAudit,
  
  // Provider
  type LLMProvider,
  type ProviderRequest,
  type ProviderMessage,
  type ProviderResponse,
  type LLMProviderAdapter,
  
  // Config
  type SecureLLMConfig,
  DEFAULT_SECURE_LLM_CONFIG,
  
  // Constants
  TOKEN_ESTIMATION,
  SANITIZATION_LIMITS,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SANITIZER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Main functions
  sanitizeText,
  sanitizeResourceText,
  sanitizePromptInput,
  sanitizeResourceContext,
  type ResourceInput,
  
  // Utilities
  normalizeHomoglyphs,
  stripControlChars,
  containsHomoglyphs,
  containsControlChars,
  escapePromptChars,
} from './sanitizer.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN COUNTER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Estimation
  estimateTokens,
  estimateMessageTokens,
  calculateTokenBudget,
  getDefaultLimits,
  type TokenBudget,
  
  // Truncation
  truncateToTokenLimit,
  truncateMessages,
  type TruncationResult,
  
  // Timeout
  TimeoutError,
  createTimeoutController,
  withTimeout,
  withTimeoutThrow,
  raceTimeout,
  
  // Validation
  validateTokenLimits,
  type TokenValidation,
} from './token-counter.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Client
  SecureLLMClient,
  getSecureLLMClient,
  initSecureLLMClient,
  initSecureLLMClientFromManager,
  resetSecureLLMClient,
  
  // Request builder
  SecureLLMRequestBuilder,
  createLLMRequest,
  
  // Provider adapters
  type ProviderManagerBridge,
  createProviderAdapter,
  createMockProvider,
} from './client.js';
