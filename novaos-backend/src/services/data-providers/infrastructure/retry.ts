// ═══════════════════════════════════════════════════════════════════════════════
// RETRY LOGIC — Jittered Exponential Backoff for Provider Requests
// Handles transient failures with intelligent retry strategies
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Retry policy configuration.
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts (not including initial attempt) */
  readonly maxRetries: number;
  /** Initial delay in milliseconds before first retry */
  readonly initialDelayMs: number;
  /** Maximum delay in milliseconds between retries */
  readonly maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  readonly backoffMultiplier: number;
  /** Jitter factor (0-1) to randomize delay (default: 0.1) */
  readonly jitterFactor: number;
  /** Whether to retry on timeout errors (default: true) */
  readonly retryOnTimeout: boolean;
  /** HTTP status codes that should trigger a retry */
  readonly retryableStatusCodes: readonly number[];
  /** Custom function to determine if an error is retryable */
  readonly isRetryable?: (error: unknown) => boolean;
}

/**
 * Result of an operation that can be retried.
 * Compatible with ProviderResult from Phase 1 types.
 */
export interface RetryableResult<T> {
  /** Whether the operation succeeded */
  readonly ok: boolean;
  /** The result data (if ok is true) */
  readonly data?: T;
  /** Error information (if ok is false) */
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
    readonly retryAfterSec?: number;
  };
}

/**
 * Context passed to retry callbacks.
 */
export interface RetryContext {
  /** Current attempt number (1-based) */
  readonly attempt: number;
  /** Total attempts that will be made */
  readonly maxAttempts: number;
  /** Time until next retry in ms (0 if this is the last attempt) */
  readonly nextRetryInMs: number;
  /** Total elapsed time since first attempt */
  readonly elapsedMs: number;
  /** The error from the previous attempt (if any) */
  readonly lastError?: unknown;
}

/**
 * Options for the retry operation.
 */
export interface RetryOptions<T> {
  /** The retry policy to use */
  readonly policy?: Partial<RetryPolicy>;
  /** Callback called before each retry */
  readonly onRetry?: (context: RetryContext) => void | Promise<void>;
  /** Callback called on final failure */
  readonly onFailure?: (error: unknown, context: RetryContext) => void;
  /** Abort signal to cancel retries */
  readonly signal?: AbortSignal;
  /** Transform the result to check for logical errors */
  readonly validateResult?: (result: T) => RetryableResult<T>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Default retry policy.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryOnTimeout: true,
  retryableStatusCodes: [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
  ],
};

/**
 * Aggressive retry policy for critical operations.
 */
export const AGGRESSIVE_RETRY_POLICY: RetryPolicy = {
  maxRetries: 5,
  initialDelayMs: 500,
  maxDelayMs: 60_000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  retryOnTimeout: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Conservative retry policy for non-critical operations.
 */
export const CONSERVATIVE_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  initialDelayMs: 2000,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryOnTimeout: true,
  retryableStatusCodes: [429, 503],
};

/**
 * No retry policy - fail immediately.
 */
export const NO_RETRY_POLICY: RetryPolicy = {
  maxRetries: 0,
  initialDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 1,
  jitterFactor: 0,
  retryOnTimeout: false,
  retryableStatusCodes: [],
};

// ─────────────────────────────────────────────────────────────────────────────────
// DELAY CALCULATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Calculate delay with exponential backoff and jitter.
 * 
 * Jitter helps prevent thundering herd problem when multiple
 * clients retry at the same time.
 * 
 * @param attempt - The attempt number (1-based)
 * @param policy - The retry policy
 * @param retryAfterSec - Optional server-provided retry-after hint
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  policy: RetryPolicy,
  retryAfterSec?: number
): number {
  // If server provided retry-after, respect it
  if (retryAfterSec !== undefined && retryAfterSec > 0) {
    const serverDelay = retryAfterSec * 1000;
    // Add small jitter even to server-provided delay
    const jitter = serverDelay * policy.jitterFactor * Math.random();
    return Math.min(serverDelay + jitter, policy.maxDelayMs);
  }
  
  // Exponential backoff: initialDelay * (multiplier ^ (attempt - 1))
  const exponentialDelay = policy.initialDelayMs * 
    Math.pow(policy.backoffMultiplier, attempt - 1);
  
  // Apply jitter: delay ± (delay * jitterFactor)
  const jitterRange = exponentialDelay * policy.jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange; // Random between -jitterRange and +jitterRange
  
  const finalDelay = exponentialDelay + jitter;
  
  // Clamp to max delay
  return Math.min(Math.max(finalDelay, 0), policy.maxDelayMs);
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Determine if an error is retryable based on the policy.
 * 
 * @param error - The error to check
 * @param policy - The retry policy
 * @returns True if the error should trigger a retry
 */
export function isRetryableError(error: unknown, policy: RetryPolicy): boolean {
  // Custom retryable check takes precedence
  if (policy.isRetryable) {
    return policy.isRetryable(error);
  }
  
  // Check for abort/cancellation - never retry
  if (error instanceof Error) {
    if (error.name === 'AbortError') return false;
    if (error.message.includes('aborted')) return false;
    if (error.message.includes('cancelled')) return false;
    if (error.message.includes('canceled')) return false;
  }
  
  // Check for timeout errors
  if (error instanceof Error) {
    const isTimeout = error.name === 'TimeoutError' ||
                      error.message.toLowerCase().includes('timeout') ||
                      error.message.toLowerCase().includes('timed out');
    
    if (isTimeout) {
      return policy.retryOnTimeout;
    }
  }
  
  // Check for network errors (generally retryable)
  if (error instanceof Error) {
    const isNetworkError = 
      error.message.includes('ECONNRESET') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('network') ||
      error.message.includes('socket');
    
    if (isNetworkError) {
      return true;
    }
  }
  
  // Check for HTTP status codes
  const statusCode = extractStatusCode(error);
  if (statusCode !== null) {
    return policy.retryableStatusCodes.includes(statusCode);
  }
  
  // Check for RetryableResult-style errors
  if (isRetryableResult(error)) {
    return error.error?.retryable ?? false;
  }
  
  // Default: don't retry unknown errors
  return false;
}

/**
 * Extract HTTP status code from an error.
 */
function extractStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  
  // Check common patterns
  const errorObj = error as Record<string, unknown>;
  
  if (typeof errorObj['status'] === 'number') {
    return errorObj['status'];
  }
  
  if (typeof errorObj['statusCode'] === 'number') {
    return errorObj['statusCode'];
  }
  
  if (errorObj['response'] && typeof errorObj['response'] === 'object') {
    const response = errorObj['response'] as Record<string, unknown>;
    if (typeof response['status'] === 'number') {
      return response['status'];
    }
  }
  
  return null;
}

/**
 * Type guard for RetryableResult.
 */
function isRetryableResult(value: unknown): value is RetryableResult<unknown> {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['ok'] === 'boolean';
}

/**
 * Extract retry-after hint from an error or result.
 */
function extractRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  
  const errorObj = error as Record<string, unknown>;
  
  // Check for retryAfterSec in error object
  if (typeof errorObj['retryAfterSec'] === 'number') {
    return errorObj['retryAfterSec'];
  }
  
  // Check for error.retryAfterSec
  if (errorObj['error'] && typeof errorObj['error'] === 'object') {
    const inner = errorObj['error'] as Record<string, unknown>;
    if (typeof inner['retryAfterSec'] === 'number') {
      return inner['retryAfterSec'];
    }
  }
  
  // Check for Retry-After header value
  if (typeof errorObj['retryAfter'] === 'number') {
    return errorObj['retryAfter'];
  }
  
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SLEEP UTILITY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sleep for a specified duration with abort support.
 * 
 * @param ms - Duration in milliseconds
 * @param signal - Optional abort signal
 * @returns Promise that resolves after the delay
 */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);
    
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        reject(new Error('Retry aborted'));
        return;
      }
      
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error('Retry aborted'));
      };
      
      signal.addEventListener('abort', abortHandler, { once: true });
      
      // Clean up listener when timeout completes
      const originalResolve = resolve;
      resolve = () => {
        signal.removeEventListener('abort', abortHandler);
        originalResolve();
      };
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN RETRY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Execute an operation with retry logic.
 * 
 * Implements exponential backoff with jitter to handle transient failures
 * and avoid thundering herd problems.
 * 
 * @param operation - The async operation to execute
 * @param options - Retry options
 * @returns The operation result
 * @throws The last error if all retries are exhausted
 * 
 * @example
 * // Basic usage
 * const result = await withRetry(
 *   () => fetchStockPrice('AAPL'),
 *   { policy: { maxRetries: 3 } }
 * );
 * 
 * @example
 * // With callbacks
 * const result = await withRetry(
 *   () => fetchStockPrice('AAPL'),
 *   {
 *     onRetry: (ctx) => console.log(`Retry ${ctx.attempt}/${ctx.maxAttempts}`),
 *     onFailure: (err) => console.error('All retries failed:', err),
 *   }
 * );
 * 
 * @example
 * // With result validation
 * const result = await withRetry(
 *   () => callProviderAPI(),
 *   {
 *     validateResult: (result) => ({
 *       ok: result.status === 'success',
 *       data: result.data,
 *       error: result.status !== 'success' ? {
 *         code: result.errorCode,
 *         message: result.message,
 *         retryable: result.errorCode === 'RATE_LIMITED',
 *       } : undefined,
 *     }),
 *   }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions<T> = {}
): Promise<T> {
  const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...options.policy };
  const maxAttempts = policy.maxRetries + 1;
  const startTime = Date.now();
  
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isLastAttempt = attempt === maxAttempts;
    
    // Check for abort
    if (options.signal?.aborted) {
      throw new Error('Retry aborted');
    }
    
    try {
      // Execute the operation
      const result = await operation();
      
      // Validate result if validator provided
      if (options.validateResult) {
        const validation = options.validateResult(result);
        
        if (!validation.ok) {
          // Result indicates failure
          const retryable = validation.error?.retryable ?? false;
          
          if (retryable && !isLastAttempt) {
            // Retry with appropriate delay
            const retryAfterSec = validation.error?.retryAfterSec;
            const delay = calculateBackoffDelay(attempt, policy, retryAfterSec);
            
            const context: RetryContext = {
              attempt,
              maxAttempts,
              nextRetryInMs: delay,
              elapsedMs: Date.now() - startTime,
              lastError: validation.error,
            };
            
            await options.onRetry?.(context);
            await sleep(delay, options.signal);
            continue;
          }
          
          // Not retryable or last attempt - throw
          const error = new Error(validation.error?.message ?? 'Operation failed');
          (error as Error & { code?: string }).code = validation.error?.code;
          throw error;
        }
        
        // Validation passed
        return validation.data as T;
      }
      
      // No validation - return raw result
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (isLastAttempt || !isRetryableError(error, policy)) {
        // Final failure
        const context: RetryContext = {
          attempt,
          maxAttempts,
          nextRetryInMs: 0,
          elapsedMs: Date.now() - startTime,
          lastError: error,
        };
        
        options.onFailure?.(error, context);
        throw error;
      }
      
      // Calculate delay for next retry
      const retryAfterSec = extractRetryAfter(error);
      const delay = calculateBackoffDelay(attempt, policy, retryAfterSec);
      
      const context: RetryContext = {
        attempt,
        maxAttempts,
        nextRetryInMs: delay,
        elapsedMs: Date.now() - startTime,
        lastError: error,
      };
      
      await options.onRetry?.(context);
      await sleep(delay, options.signal);
    }
  }
  
  // Should never reach here, but TypeScript needs this
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a retryable version of an async function.
 * 
 * @param fn - The async function to wrap
 * @param options - Default retry options
 * @returns Wrapped function that automatically retries
 * 
 * @example
 * const retryableFetch = makeRetryable(
 *   (symbol: string) => fetchStockPrice(symbol),
 *   { policy: { maxRetries: 3 } }
 * );
 * 
 * const price = await retryableFetch('AAPL');
 */
export function makeRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions<TResult> = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Execute multiple operations with retry, returning all results.
 * 
 * Unlike Promise.all, this will retry individual failures.
 * 
 * @param operations - Array of operations to execute
 * @param options - Retry options
 * @returns Array of results
 */
export async function withRetryAll<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions<T> = {}
): Promise<T[]> {
  return Promise.all(
    operations.map(op => withRetry(op, options))
  );
}

/**
 * Execute an operation with retry, with a timeout.
 * 
 * @param operation - The operation to execute
 * @param timeoutMs - Maximum time for all attempts
 * @param options - Retry options
 * @returns The operation result
 */
export async function withRetryTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  options: RetryOptions<T> = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await withRetry(operation, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
