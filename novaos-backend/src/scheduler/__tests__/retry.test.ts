// ═══════════════════════════════════════════════════════════════════════════════
// RETRY UTILITIES TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exponentialBackoff,
  linearBackoff,
  fixedDelay,
  noDelay,
  getDelayFunction,
  withRetry,
  makeRetryable,
  retryUntilSuccess,
  retryConditions,
  createCircuitBreaker,
} from '../retry.js';
import { DEFAULT_RETRY_CONFIG } from '../types.js';

describe('Backoff Strategies', () => {
  const config = { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 };

  describe('exponentialBackoff', () => {
    it('should double delay with each attempt', () => {
      expect(exponentialBackoff(1, config)).toBe(1000);
      expect(exponentialBackoff(2, config)).toBe(2000);
      expect(exponentialBackoff(3, config)).toBe(4000);
      expect(exponentialBackoff(4, config)).toBe(8000);
    });

    it('should cap at maxDelayMs', () => {
      const capped = { ...config, maxDelayMs: 3000 };
      expect(exponentialBackoff(5, capped)).toBe(3000);
    });
  });

  describe('linearBackoff', () => {
    it('should increase linearly', () => {
      expect(linearBackoff(1, config)).toBe(1000);
      expect(linearBackoff(2, config)).toBe(2000);
      expect(linearBackoff(3, config)).toBe(3000);
    });

    it('should cap at maxDelayMs', () => {
      const capped = { ...config, maxDelayMs: 2500 };
      expect(linearBackoff(5, capped)).toBe(2500);
    });
  });

  describe('fixedDelay', () => {
    it('should return constant delay', () => {
      expect(fixedDelay(1, config)).toBe(1000);
      expect(fixedDelay(5, config)).toBe(1000);
      expect(fixedDelay(10, config)).toBe(1000);
    });
  });

  describe('noDelay', () => {
    it('should return zero', () => {
      expect(noDelay()).toBe(0);
    });
  });

  describe('getDelayFunction', () => {
    it('should return correct function for strategy', () => {
      expect(getDelayFunction('exponential')).toBe(exponentialBackoff);
      expect(getDelayFunction('linear')).toBe(linearBackoff);
      expect(getDelayFunction('fixed')).toBe(fixedDelay);
      expect(getDelayFunction('none')).toBe(noDelay);
    });
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return success on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = withRetry(fn, { maxAttempts: 3 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, {
      maxAttempts: 3,
      strategy: 'none',
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should return failure after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    const resultPromise = withRetry(fn, {
      maxAttempts: 3,
      strategy: 'none',
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('always fails');
    expect(result.attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should call onRetry callback', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    const resultPromise = withRetry(fn, {
      maxAttempts: 3,
      strategy: 'none',
      onRetry,
    });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 0);
  });

  it('should respect shouldRetry condition', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));

    const resultPromise = withRetry(fn, {
      maxAttempts: 3,
      strategy: 'none',
      shouldRetry: () => false,
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('retryConditions', () => {
  describe('always', () => {
    it('should always return true', () => {
      expect(retryConditions.always()).toBe(true);
    });
  });

  describe('never', () => {
    it('should always return false', () => {
      expect(retryConditions.never()).toBe(false);
    });
  });

  describe('transient', () => {
    it('should return true for transient errors', () => {
      expect(retryConditions.transient(new Error('Connection timeout'))).toBe(true);
      expect(retryConditions.transient(new Error('ECONNREFUSED'))).toBe(true);
      expect(retryConditions.transient(new Error('Network error'))).toBe(true);
      expect(retryConditions.transient(new Error('Service unavailable 503'))).toBe(true);
    });

    it('should return false for non-transient errors', () => {
      expect(retryConditions.transient(new Error('Invalid input'))).toBe(false);
      expect(retryConditions.transient(new Error('Not found'))).toBe(false);
    });
  });

  describe('onMessages', () => {
    it('should match error messages', () => {
      const condition = retryConditions.onMessages(['rate limit', 'quota']);

      expect(condition(new Error('Rate limit exceeded'))).toBe(true);
      expect(condition(new Error('Quota reached'))).toBe(true);
      expect(condition(new Error('Invalid request'))).toBe(false);
    });
  });

  describe('any', () => {
    it('should return true if any condition matches', () => {
      const condition = retryConditions.any(
        () => false,
        () => true,
        () => false
      );

      expect(condition(new Error('test'), 1)).toBe(true);
    });

    it('should return false if no conditions match', () => {
      const condition = retryConditions.any(
        () => false,
        () => false
      );

      expect(condition(new Error('test'), 1)).toBe(false);
    });
  });

  describe('all', () => {
    it('should return true only if all conditions match', () => {
      const allTrue = retryConditions.all(
        () => true,
        () => true
      );

      expect(allTrue(new Error('test'), 1)).toBe(true);

      const someFalse = retryConditions.all(
        () => true,
        () => false
      );

      expect(someFalse(new Error('test'), 1)).toBe(false);
    });
  });
});

describe('makeRetryable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a retryable version of a function', async () => {
    const original = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue(42);

    const retryable = makeRetryable(original, {
      maxAttempts: 2,
      strategy: 'none',
    });

    const resultPromise = retryable();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
    expect(original).toHaveBeenCalledTimes(2);
  });
});

describe('retryUntilSuccess', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue('result');

    const resultPromise = retryUntilSuccess(fn, { maxAttempts: 3 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('result');
  });

  it('should throw after all retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    const resultPromise = retryUntilSuccess(fn, {
      maxAttempts: 2,
      strategy: 'none',
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow('always fails');
  });
});

describe('createCircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should pass through successful calls', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const breaker = createCircuitBreaker(fn);

    const result = await breaker();

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should open circuit after threshold failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const breaker = createCircuitBreaker(fn, {
      failureThreshold: 3,
      resetTimeoutMs: 10000,
    });

    // Fail 3 times
    await expect(breaker()).rejects.toThrow('fail');
    await expect(breaker()).rejects.toThrow('fail');
    await expect(breaker()).rejects.toThrow('fail');

    // Circuit should be open now
    await expect(breaker()).rejects.toThrow('Circuit breaker is open');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should enter half-open after reset timeout', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const breaker = createCircuitBreaker(fn, {
      failureThreshold: 3,
      resetTimeoutMs: 10000,
      halfOpenMaxAttempts: 1,
    });

    // Open the circuit
    await expect(breaker()).rejects.toThrow();
    await expect(breaker()).rejects.toThrow();
    await expect(breaker()).rejects.toThrow();

    // Advance past reset timeout
    await vi.advanceTimersByTimeAsync(10001);

    // Should work now (half-open state allows one attempt)
    const result = await breaker();
    expect(result).toBe('success');
  });
});
