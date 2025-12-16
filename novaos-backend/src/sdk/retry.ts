// ═══════════════════════════════════════════════════════════════════════════════
// SDK RETRY — Automatic Retry with Exponential Backoff
// ═══════════════════════════════════════════════════════════════════════════════

import { isRetryableError, RateLimitError } from './errors.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Add random jitter to delay (default: true) */
  jitter: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void;
}

export interface RetryState {
  attempt: number;
  totalAttempts: number;
  lastError?: unknown;
  totalDelayMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

// ─────────────────────────────────────────────────────────────────────────────────
// DELAY CALCULATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Calculate delay for a given attempt with exponential backoff
 */
export function calculateDelay(
  attempt: number,
  options: Pick<RetryOptions, 'initialDelayMs' | 'maxDelayMs' | 'backoffMultiplier' | 'jitter'>
): number {
  // Exponential backoff: initial * multiplier^attempt
  let delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  
  // Cap at max delay
  delay = Math.min(delay, options.maxDelayMs);
  
  // Add jitter (random 0-25% reduction to avoid thundering herd)
  if (options.jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.25;
    delay = Math.floor(delay * jitterFactor);
  }
  
  return delay;
}

/**
 * Get delay from RateLimitError if available
 */
export function getRetryAfterDelay(error: unknown): number | undefined {
  if (error instanceof RateLimitError && error.retryAfter) {
    return error.retryAfter * 1000; // Convert seconds to ms
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SLEEP UTILITY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Promise-based sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep with abort signal support
 */
export function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeout = setTimeout(resolve, ms);
    
    if (signal) {
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// RETRY WRAPPER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Execute a function with automatic retry on failure
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const shouldRetry = opts.isRetryable ?? isRetryableError;
  
  let lastError: unknown;
  let totalDelayMs = 0;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt >= opts.maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate delay
      let delayMs = getRetryAfterDelay(error) ?? calculateDelay(attempt, opts);
      delayMs = Math.min(delayMs, opts.maxDelayMs);
      totalDelayMs += delayMs;
      
      // Notify about retry
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, error, delayMs);
      }
      
      // Wait before retry
      await sleep(delayMs);
    }
  }
  
  // Should not reach here, but just in case
  throw lastError;
}

/**
 * Execute a function with automatic retry and abort signal support
 */
export async function withRetryAndSignal<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const shouldRetry = opts.isRetryable ?? isRetryableError;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // Check if aborted
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    
    try {
      return await fn(signal);
    } catch (error) {
      lastError = error;
      
      // Check if aborted
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      
      // Don't retry abort errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      
      // Check if we should retry
      if (attempt >= opts.maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate delay
      let delayMs = getRetryAfterDelay(error) ?? calculateDelay(attempt, opts);
      delayMs = Math.min(delayMs, opts.maxDelayMs);
      
      // Notify about retry
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, error, delayMs);
      }
      
      // Wait before retry (with abort support)
      try {
        await sleepWithSignal(delayMs, signal);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          throw e;
        }
        throw lastError; // Throw original error if sleep fails
      }
    }
  }
  
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RETRY DECORATOR
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a retryable version of an async function
 */
export function retryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: Partial<RetryOptions> = {}
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}
