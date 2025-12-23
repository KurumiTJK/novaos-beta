// ═══════════════════════════════════════════════════════════════════════════════
// RETRY UTILITIES — Backoff Strategies for Job Execution
// NovaOS Scheduler — Phase 15: Enhanced Scheduler & Jobs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides retry logic with multiple backoff strategies:
//   - Exponential backoff with jitter
//   - Linear backoff
//   - Fixed delay
//   - Custom strategies
//
// ═══════════════════════════════════════════════════════════════════════════════

import { getLogger } from '../observability/logging/index.js';
import { incCounter, observeHistogram } from '../observability/metrics/index.js';

import type { RetryConfig } from './types.js';
import { DEFAULT_RETRY_CONFIG } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'retry' });

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Backoff strategy type.
 */
export type BackoffStrategy = 'exponential' | 'linear' | 'fixed' | 'none';

/**
 * Extended retry options.
 */
export interface RetryOptions extends Partial<RetryConfig> {
  /** Backoff strategy */
  strategy?: BackoffStrategy;

  /** Custom delay function */
  customDelay?: (attempt: number, config: RetryConfig) => number;

  /** Condition to check if retry should be attempted */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /** Callback before each retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;

  /** Operation name for logging */
  operationName?: string;
}

/**
 * Result of a retry operation.
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// BACKOFF STRATEGIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Exponential backoff with optional jitter.
 */
export function exponentialBackoff(attempt: number, config: RetryConfig): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);

  // Add jitter
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Linear backoff.
 */
export function linearBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * attempt;
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Fixed delay (no backoff).
 */
export function fixedDelay(attempt: number, config: RetryConfig): number {
  return config.initialDelayMs;
}

/**
 * No delay.
 */
export function noDelay(): number {
  return 0;
}

/**
 * Get delay function for strategy.
 */
export function getDelayFunction(
  strategy: BackoffStrategy
): (attempt: number, config: RetryConfig) => number {
  switch (strategy) {
    case 'exponential':
      return exponentialBackoff;
    case 'linear':
      return linearBackoff;
    case 'fixed':
      return fixedDelay;
    case 'none':
      return noDelay;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// RETRY WRAPPER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Execute a function with retry logic.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: options.maxAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts,
    initialDelayMs: options.initialDelayMs ?? DEFAULT_RETRY_CONFIG.initialDelayMs,
    maxDelayMs: options.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
    backoffMultiplier: options.backoffMultiplier ?? DEFAULT_RETRY_CONFIG.backoffMultiplier,
    jitterFactor: options.jitterFactor ?? DEFAULT_RETRY_CONFIG.jitterFactor,
  };

  const strategy = options.strategy ?? 'exponential';
  const delayFn = options.customDelay ?? getDelayFunction(strategy);
  const shouldRetryFn = options.shouldRetry ?? (() => true);
  const operationName = options.operationName ?? 'operation';

  let attempt = 0;
  let lastError: Error | undefined;
  let totalDelayMs = 0;

  while (attempt < config.maxAttempts) {
    attempt++;

    try {
      const result = await fn();

      if (attempt > 1) {
        logger.debug('Retry succeeded', {
          operation: operationName,
          attempt,
          totalDelayMs,
        });
        incCounter('retry_success_total', { operation: operationName });
      }

      return {
        success: true,
        result,
        attempts: attempt,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      incCounter('retry_attempt_total', { operation: operationName });

      // Check if we should retry
      if (attempt >= config.maxAttempts) {
        break;
      }

      if (!shouldRetryFn(lastError, attempt)) {
        logger.debug('Retry condition not met, stopping', {
          operation: operationName,
          attempt,
          error: lastError.message,
        });
        break;
      }

      // Calculate delay
      const delay = delayFn(attempt, config);
      totalDelayMs += delay;

      // Notify callback
      if (options.onRetry) {
        options.onRetry(lastError, attempt, delay);
      }

      logger.debug('Retrying operation', {
        operation: operationName,
        attempt,
        nextAttempt: attempt + 1,
        delayMs: delay,
        error: lastError.message,
      });

      // Wait before retry
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }

  incCounter('retry_exhausted_total', { operation: operationName });
  observeHistogram('retry_attempts', attempt, { operation: operationName });

  logger.debug('All retries exhausted', {
    operation: operationName,
    attempts: attempt,
    totalDelayMs,
    error: lastError?.message,
  });

  return {
    success: false,
    error: lastError,
    attempts: attempt,
    totalDelayMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// RETRY DECORATORS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a retryable version of a function.
 */
export function makeRetryable<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options: RetryOptions = {}
): (...args: Args) => Promise<RetryResult<T>> {
  return async (...args: Args) => {
    return withRetry(() => fn(...args), options);
  };
}

/**
 * Retry a function until it succeeds or max attempts reached.
 * Throws if all retries exhausted.
 */
export async function retryUntilSuccess<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const result = await withRetry(fn, options);

  if (result.success && result.result !== undefined) {
    return result.result;
  }

  throw result.error ?? new Error('All retries exhausted');
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONDITIONAL RETRY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Common error conditions for retry decisions.
 */
export const retryConditions = {
  /**
   * Retry on any error.
   */
  always: () => true,

  /**
   * Never retry.
   */
  never: () => false,

  /**
   * Retry on transient errors (network, timeout, etc.).
   */
  transient: (error: Error) => {
    const message = error.message.toLowerCase();
    const transientPatterns = [
      'timeout',
      'econnrefused',
      'econnreset',
      'etimedout',
      'enotfound',
      'network',
      'socket',
      'temporary',
      'unavailable',
      '429',
      '503',
      '504',
    ];
    return transientPatterns.some(pattern => message.includes(pattern));
  },

  /**
   * Retry on specific error codes.
   */
  onCodes: (codes: number[]) => (error: Error & { code?: number }) => {
    return error.code !== undefined && codes.includes(error.code);
  },

  /**
   * Retry on specific error messages.
   */
  onMessages: (patterns: string[]) => (error: Error) => {
    const message = error.message.toLowerCase();
    return patterns.some(pattern => message.includes(pattern.toLowerCase()));
  },

  /**
   * Combine multiple conditions with OR.
   */
  any: (...conditions: Array<(error: Error, attempt: number) => boolean>) => {
    return (error: Error, attempt: number) => {
      return conditions.some(cond => cond(error, attempt));
    };
  },

  /**
   * Combine multiple conditions with AND.
   */
  all: (...conditions: Array<(error: Error, attempt: number) => boolean>) => {
    return (error: Error, attempt: number) => {
      return conditions.every(cond => cond(error, attempt));
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Simple circuit breaker state.
 */
export interface CircuitBreakerState {
  failures: number;
  lastFailure?: number;
  state: 'closed' | 'open' | 'half-open';
}

/**
 * Circuit breaker options.
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 1,
};

/**
 * Create a circuit breaker wrapper.
 */
export function createCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: Partial<CircuitBreakerOptions> = {}
): () => Promise<T> {
  const config = { ...DEFAULT_CIRCUIT_BREAKER, ...options };
  const state: CircuitBreakerState = {
    failures: 0,
    state: 'closed',
  };

  let halfOpenAttempts = 0;

  return async () => {
    // Check if circuit should reset
    if (state.state === 'open' && state.lastFailure) {
      const elapsed = Date.now() - state.lastFailure;
      if (elapsed >= config.resetTimeoutMs) {
        state.state = 'half-open';
        halfOpenAttempts = 0;
        logger.debug('Circuit breaker entering half-open state');
      }
    }

    // Reject if circuit is open
    if (state.state === 'open') {
      throw new Error('Circuit breaker is open');
    }

    // Limit half-open attempts
    if (state.state === 'half-open' && halfOpenAttempts >= config.halfOpenMaxAttempts) {
      throw new Error('Circuit breaker half-open limit reached');
    }

    try {
      if (state.state === 'half-open') {
        halfOpenAttempts++;
      }

      const result = await fn();

      // Success: reset circuit
      state.failures = 0;
      state.state = 'closed';

      return result;
    } catch (error) {
      state.failures++;
      state.lastFailure = Date.now();

      if (state.failures >= config.failureThreshold) {
        state.state = 'open';
        logger.warn('Circuit breaker opened', {
          failures: state.failures,
          threshold: config.failureThreshold,
        });
        incCounter('circuit_breaker_opened_total', {});
      }

      throw error;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
