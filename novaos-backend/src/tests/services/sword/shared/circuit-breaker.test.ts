// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER TESTS
// Tests for circuit breaker state transitions and behavior
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER IMPLEMENTATION (for testing)
// ─────────────────────────────────────────────────────────────────────────────────

type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  openDurationMs: number;
  halfOpenDurationMs: number;
}

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureAt?: Date;
  private openedAt?: Date;
  private halfOpenAt?: Date;
  
  constructor(
    private serviceName: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 2,
      openDurationMs: 60000,
      halfOpenDurationMs: 30000,
    }
  ) {}

  getState(): CircuitState {
    this.checkAutoTransition();
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  canExecute(): boolean {
    this.checkAutoTransition();
    
    if (this.state === 'closed') return true;
    if (this.state === 'half_open') return true;
    return false;
  }

  recordSuccess(): void {
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureAt = new Date();

    if (this.state === 'half_open') {
      this.transitionTo('open');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private checkAutoTransition(): void {
    const now = Date.now();

    if (this.state === 'open' && this.openedAt) {
      if (now - this.openedAt.getTime() >= this.config.openDurationMs) {
        this.transitionTo('half_open');
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    
    if (newState === 'open') {
      this.openedAt = new Date();
      this.successCount = 0;
    } else if (newState === 'half_open') {
      this.halfOpenAt = new Date();
      this.successCount = 0;
    } else if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
      this.openedAt = undefined;
      this.halfOpenAt = undefined;
    }
  }

  // For testing
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  reset(): void {
    this.transitionTo('closed');
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      successThreshold: 2,
      openDurationMs: 1000,
      halfOpenDurationMs: 500,
    });
  });

  describe('Initial State', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('should allow execution in closed state', () => {
      expect(breaker.canExecute()).toBe(true);
    });

    it('should have zero failure count initially', () => {
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('Closed → Open Transition', () => {
    it('should remain closed below failure threshold', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getFailureCount()).toBe(2);
    });

    it('should transition to open at failure threshold', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      
      expect(breaker.getState()).toBe('open');
    });

    it('should not allow execution in open state', () => {
      breaker.forceState('open');
      
      expect(breaker.canExecute()).toBe(false);
    });

    it('should reset failure count on success', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess();
      
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('Open → Half-Open Transition', () => {
    it('should transition to half-open after timeout', async () => {
      breaker.forceState('open');
      
      // Wait for open duration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(breaker.getState()).toBe('half_open');
    });

    it('should allow execution in half-open state', () => {
      breaker.forceState('half_open');
      
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('Half-Open → Closed Transition', () => {
    it('should transition to closed after success threshold', () => {
      breaker.forceState('half_open');
      
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('half_open');
      
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('closed');
    });

    it('should reset failure count on transition to closed', () => {
      breaker.forceState('half_open');
      breaker.recordSuccess();
      breaker.recordSuccess();
      
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('Half-Open → Open Transition', () => {
    it('should transition back to open on failure in half-open', () => {
      breaker.forceState('half_open');
      
      breaker.recordFailure();
      
      expect(breaker.getState()).toBe('open');
    });

    it('should require full success threshold after reopening', async () => {
      breaker.forceState('half_open');
      breaker.recordFailure();
      
      expect(breaker.getState()).toBe('open');
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(breaker.getState()).toBe('half_open');
      
      // Need 2 successes again
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('half_open');
      
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('Reset', () => {
    it('should reset to closed state', () => {
      breaker.forceState('open');
      
      breaker.reset();
      
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getFailureCount()).toBe(0);
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle intermittent failures correctly', () => {
      // Some failures, but not enough to trip
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('closed');
      
      // Success resets count
      breaker.recordSuccess();
      expect(breaker.getFailureCount()).toBe(0);
      
      // Now failures again
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');
    });

    it('should handle rapid failures', () => {
      for (let i = 0; i < 10; i++) {
        breaker.recordFailure();
      }
      
      expect(breaker.getState()).toBe('open');
      expect(breaker.getFailureCount()).toBe(10);
    });

    it('should handle full recovery cycle', async () => {
      // 1. Start closed
      expect(breaker.getState()).toBe('closed');
      
      // 2. Fail to open
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');
      
      // 3. Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(breaker.getState()).toBe('half_open');
      
      // 4. Recover to closed
      breaker.recordSuccess();
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('closed');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE WITH FALLBACK TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Execute with Fallback', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      successThreshold: 1,
      openDurationMs: 100,
      halfOpenDurationMs: 50,
    });
  });

  async function executeWithFallback<T>(
    cb: CircuitBreaker,
    primary: () => Promise<T>,
    fallback: () => T
  ): Promise<T> {
    if (!cb.canExecute()) {
      return fallback();
    }

    try {
      const result = await primary();
      cb.recordSuccess();
      return result;
    } catch (error) {
      cb.recordFailure();
      throw error;
    }
  }

  it('should execute primary when circuit is closed', async () => {
    const primary = vi.fn().mockResolvedValue('primary result');
    const fallback = vi.fn().mockReturnValue('fallback result');

    const result = await executeWithFallback(breaker, primary, fallback);

    expect(result).toBe('primary result');
    expect(primary).toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should use fallback when circuit is open', async () => {
    breaker.forceState('open');
    
    const primary = vi.fn().mockResolvedValue('primary result');
    const fallback = vi.fn().mockReturnValue('fallback result');

    const result = await executeWithFallback(breaker, primary, fallback);

    expect(result).toBe('fallback result');
    expect(primary).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalled();
  });

  it('should trip circuit after failures', async () => {
    const primary = vi.fn().mockRejectedValue(new Error('Service unavailable'));
    const fallback = vi.fn().mockReturnValue('fallback result');

    // First failure
    await expect(executeWithFallback(breaker, primary, fallback)).rejects.toThrow();
    expect(breaker.getState()).toBe('closed');
    
    // Second failure - trips circuit
    await expect(executeWithFallback(breaker, primary, fallback)).rejects.toThrow();
    expect(breaker.getState()).toBe('open');
    
    // Now should use fallback
    const result = await executeWithFallback(breaker, primary, fallback);
    expect(result).toBe('fallback result');
  });

  it('should recover after timeout', async () => {
    const primary = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('recovered');
    const fallback = vi.fn().mockReturnValue('fallback');

    // Trip the circuit
    await expect(executeWithFallback(breaker, primary, fallback)).rejects.toThrow();
    await expect(executeWithFallback(breaker, primary, fallback)).rejects.toThrow();
    expect(breaker.getState()).toBe('open');

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(breaker.getState()).toBe('half_open');

    // Should try primary again
    const result = await executeWithFallback(breaker, primary, fallback);
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe('closed');
  });
});
