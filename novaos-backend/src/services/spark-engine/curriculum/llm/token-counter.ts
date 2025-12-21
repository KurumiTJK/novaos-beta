// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN COUNTER — Token Estimation and Limit Enforcement
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides token counting and limit enforcement:
//   - Approximate token counting (chars/4 for GPT-4)
//   - Message truncation to fit limits
//   - Token budget allocation
//   - Request timeout with AbortController
//
// Token counting is approximate but conservative to prevent limit errors.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Result } from '../../../../types/result.js';
import { ok, err } from '../../../../types/result.js';
import { getLogger } from '../../../../observability/logging/index.js';
import type { TokenLimits, LLMPurpose, ProviderMessage } from './types.js';
import { TOKEN_ESTIMATION, PURPOSE_LIMITS } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'token-counter' });

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN ESTIMATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Estimate token count for a string.
 * Uses chars/4 approximation with safety margin.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  // Base estimation: ~4 characters per token for English
  const baseEstimate = Math.ceil(text.length / TOKEN_ESTIMATION.CHARS_PER_TOKEN);
  
  // Apply safety margin
  return Math.ceil(baseEstimate * TOKEN_ESTIMATION.SAFETY_MARGIN);
}

/**
 * Estimate tokens for a message array.
 */
export function estimateMessageTokens(messages: readonly ProviderMessage[]): number {
  let total = 0;
  
  for (const message of messages) {
    // Role overhead (~4 tokens per message for role/formatting)
    total += 4;
    
    // Content tokens
    total += estimateTokens(message.content);
  }
  
  // Overall message formatting overhead
  total += 3;
  
  return total;
}

/**
 * Token budget for a request.
 */
export interface TokenBudget {
  /** Total available tokens */
  readonly total: number;
  
  /** Reserved for system prompt */
  readonly system: number;
  
  /** Reserved for response */
  readonly response: number;
  
  /** Available for user content */
  readonly available: number;
  
  /** Whether budget is valid (available > 0) */
  readonly isValid: boolean;
}

/**
 * Calculate token budget based on limits and system prompt.
 */
export function calculateTokenBudget(
  limits: TokenLimits,
  systemPromptTokens: number
): TokenBudget {
  const total = limits.maxInputTokens;
  const system = Math.max(systemPromptTokens, limits.reservedSystemTokens);
  const response = Math.max(limits.maxOutputTokens, TOKEN_ESTIMATION.MIN_RESPONSE_TOKENS);
  
  // Available = total - system - minimum response buffer
  const available = total - system - TOKEN_ESTIMATION.MIN_RESPONSE_TOKENS;
  
  return {
    total,
    system,
    response,
    available,
    isValid: available > 0,
  };
}

/**
 * Get default token limits for a purpose.
 */
export function getDefaultLimits(purpose: LLMPurpose): TokenLimits {
  const purposeLimits = PURPOSE_LIMITS[purpose];
  
  return {
    maxInputTokens: purposeLimits.maxTokensInput,
    maxOutputTokens: purposeLimits.maxTokensOutput,
    reservedSystemTokens: 500, // Default reservation for system prompt
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TRUNCATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Truncation result.
 */
export interface TruncationResult {
  /** Truncated text */
  readonly text: string;
  
  /** Original token count */
  readonly originalTokens: number;
  
  /** Final token count */
  readonly finalTokens: number;
  
  /** Whether truncation occurred */
  readonly wasTruncated: boolean;
  
  /** Characters removed */
  readonly charsRemoved: number;
}

/**
 * Truncate text to fit within token limit.
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  options: {
    /** Truncation strategy */
    strategy?: 'end' | 'middle' | 'smart';
    /** Suffix to add when truncating */
    suffix?: string;
  } = {}
): TruncationResult {
  const { strategy = 'end', suffix = '...[truncated]' } = options;
  
  const originalTokens = estimateTokens(text);
  
  if (originalTokens <= maxTokens) {
    return {
      text,
      originalTokens,
      finalTokens: originalTokens,
      wasTruncated: false,
      charsRemoved: 0,
    };
  }
  
  // Calculate target character count
  // Reverse the estimation: tokens * CHARS_PER_TOKEN / SAFETY_MARGIN
  const suffixTokens = estimateTokens(suffix);
  const targetTokens = maxTokens - suffixTokens;
  const targetChars = Math.floor(
    (targetTokens * TOKEN_ESTIMATION.CHARS_PER_TOKEN) / TOKEN_ESTIMATION.SAFETY_MARGIN
  );
  
  let truncated: string;
  
  switch (strategy) {
    case 'middle':
      truncated = truncateMiddle(text, targetChars, suffix);
      break;
    case 'smart':
      truncated = truncateSmart(text, targetChars, suffix);
      break;
    case 'end':
    default:
      truncated = text.slice(0, targetChars) + suffix;
      break;
  }
  
  const finalTokens = estimateTokens(truncated);
  
  logger.debug('Text truncated', {
    originalTokens,
    finalTokens,
    maxTokens,
    strategy,
  });
  
  return {
    text: truncated,
    originalTokens,
    finalTokens,
    wasTruncated: true,
    charsRemoved: text.length - truncated.length + suffix.length,
  };
}

/**
 * Truncate from the middle, keeping start and end.
 */
function truncateMiddle(text: string, targetChars: number, suffix: string): string {
  const halfLength = Math.floor((targetChars - suffix.length) / 2);
  
  if (halfLength <= 0) {
    return text.slice(0, targetChars);
  }
  
  return text.slice(0, halfLength) + suffix + text.slice(-halfLength);
}

/**
 * Smart truncation: try to break at sentence or paragraph boundaries.
 */
function truncateSmart(text: string, targetChars: number, suffix: string): string {
  const suffixLen = suffix.length;
  const maxLen = targetChars - suffixLen;
  
  if (maxLen <= 0) {
    return text.slice(0, targetChars);
  }
  
  // Try to find a good break point
  const segment = text.slice(0, maxLen + 100); // Look a bit ahead
  
  // Priority: paragraph > sentence > word
  const paragraphBreak = segment.lastIndexOf('\n\n', maxLen);
  if (paragraphBreak > maxLen * 0.7) {
    return text.slice(0, paragraphBreak) + suffix;
  }
  
  const sentenceBreak = findSentenceBreak(segment, maxLen);
  if (sentenceBreak > maxLen * 0.7) {
    return text.slice(0, sentenceBreak) + suffix;
  }
  
  const wordBreak = segment.lastIndexOf(' ', maxLen);
  if (wordBreak > maxLen * 0.8) {
    return text.slice(0, wordBreak) + suffix;
  }
  
  // Fall back to hard cut
  return text.slice(0, maxLen) + suffix;
}

/**
 * Find the last sentence break before maxLen.
 */
function findSentenceBreak(text: string, maxLen: number): number {
  // Look for sentence-ending punctuation followed by space or newline
  const patterns = ['. ', '.\n', '! ', '!\n', '? ', '?\n'];
  
  let lastBreak = -1;
  for (const pattern of patterns) {
    const idx = text.lastIndexOf(pattern, maxLen);
    if (idx > lastBreak) {
      lastBreak = idx + pattern.length - 1; // Include the punctuation
    }
  }
  
  return lastBreak;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MESSAGE TRUNCATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Truncate messages to fit within token budget.
 * Prioritizes system message and most recent messages.
 */
export function truncateMessages(
  messages: readonly ProviderMessage[],
  maxTokens: number
): ProviderMessage[] {
  const result: ProviderMessage[] = [];
  let currentTokens = 0;
  
  // Always include system message first
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  
  // Add system messages (should be first)
  for (const msg of systemMessages) {
    const tokens = estimateTokens(msg.content) + 4; // +4 for message overhead
    if (currentTokens + tokens <= maxTokens) {
      result.push(msg);
      currentTokens += tokens;
    } else {
      // Truncate system message if needed
      const available = maxTokens - currentTokens - 4;
      if (available > 100) { // Need at least 100 tokens for meaningful content
        const truncated = truncateToTokenLimit(msg.content, available);
        result.push({ ...msg, content: truncated.text });
        currentTokens += truncated.finalTokens + 4;
      }
    }
  }
  
  // Add other messages from most recent backwards
  const reversedOthers = [...otherMessages].reverse();
  const pendingMessages: ProviderMessage[] = [];
  
  for (const msg of reversedOthers) {
    const tokens = estimateTokens(msg.content) + 4;
    if (currentTokens + tokens <= maxTokens) {
      pendingMessages.unshift(msg); // Add to front to maintain order
      currentTokens += tokens;
    } else {
      // Try truncating if it's the last message we can add
      const available = maxTokens - currentTokens - 4;
      if (available > 50 && pendingMessages.length === 0) {
        const truncated = truncateToTokenLimit(msg.content, available, { strategy: 'smart' });
        pendingMessages.unshift({ ...msg, content: truncated.text });
        currentTokens += truncated.finalTokens + 4;
      }
      break; // Can't fit more messages
    }
  }
  
  result.push(...pendingMessages);
  
  logger.debug('Messages truncated', {
    originalCount: messages.length,
    finalCount: result.length,
    totalTokens: currentTokens,
    maxTokens,
  });
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TIMEOUT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Timeout error.
 */
export class TimeoutError extends Error {
  readonly name = 'TimeoutError';
  readonly timeoutMs: number;
  
  constructor(timeoutMs: number, operation?: string) {
    super(`Operation${operation ? ` '${operation}'` : ''} timed out after ${timeoutMs}ms`);
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Create an AbortController with timeout.
 */
export function createTimeoutController(
  timeoutMs: number
): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  
  const timeoutId = setTimeout(() => {
    controller.abort(new TimeoutError(timeoutMs));
  }, timeoutMs);
  
  const cleanup = () => {
    clearTimeout(timeoutId);
  };
  
  return { controller, cleanup };
}

/**
 * Execute a function with timeout.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  operation?: string
): Promise<Result<T, TimeoutError>> {
  const { controller, cleanup } = createTimeoutController(timeoutMs);
  
  try {
    const result = await fn(controller.signal);
    cleanup();
    return ok(result);
  } catch (error) {
    cleanup();
    
    if (error instanceof TimeoutError) {
      return err(error);
    }
    
    if (controller.signal.aborted) {
      return err(new TimeoutError(timeoutMs, operation));
    }
    
    throw error; // Re-throw non-timeout errors
  }
}

/**
 * Execute a function with timeout, throwing on timeout.
 */
export async function withTimeoutThrow<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  operation?: string
): Promise<T> {
  const result = await withTimeout(fn, timeoutMs, operation);
  
  if (!result.ok) {
    throw result.error;
  }
  
  return result.value;
}

/**
 * Race a promise against a timeout.
 */
export async function raceTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation?: string
): Promise<Result<T, TimeoutError>> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(err(new TimeoutError(timeoutMs, operation)));
    }, timeoutMs);
    
    promise
      .then(value => {
        clearTimeout(timeoutId);
        resolve(ok(value));
      })
      .catch(error => {
        clearTimeout(timeoutId);
        throw error; // Re-throw non-timeout errors
      });
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Token limit validation result.
 */
export interface TokenValidation {
  /** Whether tokens are within limits */
  readonly valid: boolean;
  
  /** Input tokens used */
  readonly inputTokens: number;
  
  /** Output tokens reserved */
  readonly outputTokens: number;
  
  /** Total tokens */
  readonly totalTokens: number;
  
  /** Maximum allowed input tokens */
  readonly maxInputTokens: number;
  
  /** Tokens over limit (if invalid) */
  readonly overLimit?: number;
  
  /** Error message (if invalid) */
  readonly error?: string;
}

/**
 * Validate that a request is within token limits.
 */
export function validateTokenLimits(
  systemPrompt: string,
  userPrompt: string,
  limits: TokenLimits
): TokenValidation {
  const systemTokens = estimateTokens(systemPrompt);
  const userTokens = estimateTokens(userPrompt);
  const inputTokens = systemTokens + userTokens;
  
  const maxInput = limits.maxInputTokens;
  const outputTokens = limits.maxOutputTokens;
  const totalTokens = inputTokens + outputTokens;
  
  if (inputTokens > maxInput) {
    return {
      valid: false,
      inputTokens,
      outputTokens,
      totalTokens,
      maxInputTokens: maxInput,
      overLimit: inputTokens - maxInput,
      error: `Input tokens (${inputTokens}) exceed limit (${maxInput})`,
    };
  }
  
  return {
    valid: true,
    inputTokens,
    outputTokens,
    totalTokens,
    maxInputTokens: maxInput,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  TOKEN_ESTIMATION,
};
