// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER — Resilience Pattern Implementation
// Phase 20: Production Hardening
// ═══════════════════════════════════════════════════════════════════════════════

import { EventEmitter } from 'events';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  // Failure threshold to open circuit
  failureThreshold: number;
  
  // Success threshold to close circuit (in half-open state)
  successThreshold: number;
  
  // Time to wait before testing (ms)
  resetTimeout: number;
  
  // Time window for counting failures (ms)
  failureWindow: number;
  
  // Timeout for individual calls (ms)
  callTimeout: number;
  
  // Volume threshold before circuit can open
  volumeThreshold: number;
  
  // Custom error filter
  errorFilter?: (error: Error) => boolean;
  
  // Name for logging/metrics
  name: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  lastStateChange: Date;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
}

export interface CircuitBreakerEvents {
  stateChange: (state: CircuitState, previousState: CircuitState) => void;
  success: (duration: number) => void;
  failure: (error: Error, duration: number) => void;
  timeout: (duration: number) => void;
  rejected: () => void;
  halfOpen: () => void;
  open: () => void;
  close: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER ERRORS
// ─────────────────────────────────────────────────────────────────────────────────

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitOpenError extends CircuitBreakerError {
  constructor(circuitName: string) {
    super(`Circuit "${circuitName}" is open`, circuitName, 'open');
    this.name = 'CircuitOpenError';
  }
}

export class CircuitTimeoutError extends CircuitBreakerError {
  constructor(circuitName: string, timeout: number) {
    super(`Circuit "${circuitName}" call timed out after ${timeout}ms`, circuitName, 'closed');
    this.name = 'CircuitTimeoutError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeout: 30000,  // 30 seconds
  failureWindow: 60000,  // 1 minute
  callTimeout: 10000,   // 10 seconds
  volumeThreshold: 10,
};

// ─────────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class CircuitBreaker extends EventEmitter {
  private readonly config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failures: number[] = [];
  private successes: number = 0;
  private totalCalls: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private lastStateChange: Date = new Date();
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private resetTimer: NodeJS.Timeout | null = null;
  
  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Execute a function through the circuit breaker
   */
  async fire<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      this.emit('rejected');
      throw new CircuitOpenError(this.config.name);
    }
    
    this.totalCalls++;
    const startTime = Date.now();
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      const duration = Date.now() - startTime;
      
      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Check if this error should be counted
      if (this.config.errorFilter && !this.config.errorFilter(error as Error)) {
        // Error filtered out - don't count as failure
        throw error;
      }
      
      this.onFailure(error as Error, duration);
      throw error;
    }
  }
  
  /**
   * Manually trip the circuit open
   */
  tripOpen(): void {
    this.transitionTo('open');
  }
  
  /**
   * Manually reset the circuit to closed
   */
  reset(): void {
    this.clearResetTimer();
    this.failures = [];
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.transitionTo('closed');
  }
  
  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.getRecentFailureCount(),
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      lastStateChange: this.lastStateChange,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
  
  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Check if circuit is available for requests
   */
  isAvailable(): boolean {
    return this.state !== 'open';
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL METHODS
  // ═══════════════════════════════════════════════════════════════════════════
  
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new CircuitTimeoutError(this.config.name, this.config.callTimeout);
        this.emit('timeout', this.config.callTimeout);
        reject(error);
      }, this.config.callTimeout);
      
      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  private onSuccess(duration: number): void {
    this.lastSuccess = new Date();
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    
    this.emit('success', duration);
    
    if (this.state === 'half-open') {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }
  
  private onFailure(error: Error, duration: number): void {
    this.lastFailure = new Date();
    this.failures.push(Date.now());
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    
    this.emit('failure', error, duration);
    
    // Clean old failures outside the window
    this.pruneOldFailures();
    
    if (this.state === 'half-open') {
      // Any failure in half-open immediately opens
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      // Check if we should open
      const recentFailures = this.getRecentFailureCount();
      
      // Only consider opening if we've had enough volume
      if (this.totalCalls >= this.config.volumeThreshold &&
          recentFailures >= this.config.failureThreshold) {
        this.transitionTo('open');
      }
    }
  }
  
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    
    const previousState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();
    
    console.log(`[CIRCUIT_BREAKER] ${this.config.name}: ${previousState} -> ${newState}`);
    
    this.emit('stateChange', newState, previousState);
    this.emit(newState as 'open' | 'close' | 'halfOpen');
    
    if (newState === 'open') {
      this.scheduleReset();
    } else if (newState === 'closed') {
      this.clearResetTimer();
      this.failures = [];
    }
  }
  
  private scheduleReset(): void {
    this.clearResetTimer();
    
    this.resetTimer = setTimeout(() => {
      this.transitionTo('half-open');
    }, this.config.resetTimeout);
  }
  
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
  
  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.config.failureWindow;
    this.failures = this.failures.filter(time => time > cutoff);
  }
  
  private getRecentFailureCount(): number {
    this.pruneOldFailures();
    return this.failures.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

class CircuitBreakerRegistry {
  private circuits: Map<string, CircuitBreaker> = new Map();
  
  /**
   * Get or create a circuit breaker
   */
  getOrCreate(name: string, config?: Partial<Omit<CircuitBreakerConfig, 'name'>>): CircuitBreaker {
    let circuit = this.circuits.get(name);
    
    if (!circuit) {
      circuit = new CircuitBreaker({ name, ...config });
      this.circuits.set(name, circuit);
    }
    
    return circuit;
  }
  
  /**
   * Get a circuit breaker by name
   */
  get(name: string): CircuitBreaker | undefined {
    return this.circuits.get(name);
  }
  
  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.circuits);
  }
  
  /**
   * Get stats for all circuits
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, circuit] of this.circuits) {
      stats[name] = circuit.getStats();
    }
    return stats;
  }
  
  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }
  
  /**
   * Remove a circuit
   */
  remove(name: string): boolean {
    return this.circuits.delete(name);
  }
  
  /**
   * Clear all circuits
   */
  clear(): void {
    this.circuits.clear();
  }
}

// Singleton registry
export const circuitRegistry = new CircuitBreakerRegistry();

// ─────────────────────────────────────────────────────────────────────────────────
// PRE-CONFIGURED CIRCUIT BREAKERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get circuit breaker for LLM API calls
 */
export function getLLMCircuit(): CircuitBreaker {
  return circuitRegistry.getOrCreate('llm-api', {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeout: 60000,  // 1 minute
    callTimeout: 30000,   // 30 seconds (LLM calls can be slow)
    volumeThreshold: 5,
    errorFilter: (error) => {
      // Don't count rate limits as failures
      if (error.message.includes('rate limit')) return false;
      // Don't count validation errors as failures
      if (error.message.includes('invalid')) return false;
      return true;
    },
  });
}

/**
 * Get circuit breaker for external API calls
 */
export function getExternalAPICircuit(name: string): CircuitBreaker {
  return circuitRegistry.getOrCreate(`external-${name}`, {
    failureThreshold: 5,
    successThreshold: 3,
    resetTimeout: 30000,
    callTimeout: 10000,
    volumeThreshold: 10,
  });
}

/**
 * Get circuit breaker for database operations
 */
export function getDatabaseCircuit(): CircuitBreaker {
  return circuitRegistry.getOrCreate('database', {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeout: 10000,  // 10 seconds
    callTimeout: 5000,    // 5 seconds
    volumeThreshold: 5,
  });
}

/**
 * Get circuit breaker for Redis operations
 */
export function getRedisCircuit(): CircuitBreaker {
  return circuitRegistry.getOrCreate('redis', {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeout: 5000,   // 5 seconds
    callTimeout: 2000,    // 2 seconds
    volumeThreshold: 10,
  });
}

/**
 * Get circuit breaker for web fetch operations
 */
export function getWebFetchCircuit(): CircuitBreaker {
  return circuitRegistry.getOrCreate('web-fetch', {
    failureThreshold: 5,
    successThreshold: 3,
    resetTimeout: 30000,
    callTimeout: 15000,
    volumeThreshold: 10,
    errorFilter: (error) => {
      // Don't count 404s as failures
      if (error.message.includes('404')) return false;
      return true;
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Decorator-style wrapper for circuit breaker
 */
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  circuitName: string,
  fn: T,
  config?: Partial<Omit<CircuitBreakerConfig, 'name'>>
): T {
  const circuit = circuitRegistry.getOrCreate(circuitName, config);
  
  return ((...args: Parameters<T>) => {
    return circuit.fire(() => fn(...args));
  }) as T;
}

/**
 * Execute with fallback on circuit open
 */
export async function executeWithFallback<T>(
  circuit: CircuitBreaker,
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await circuit.fire(primary);
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      console.log(`[CIRCUIT_BREAKER] ${circuit.getStats().state} - using fallback`);
      return fallback();
    }
    throw error;
  }
}

/**
 * Execute with retry and circuit breaker
 */
export async function executeWithRetry<T>(
  circuit: CircuitBreaker,
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, backoffMultiplier = 2 } = options;
  let lastError: Error | null = null;
  let delay = retryDelay;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await circuit.fire(fn);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on circuit open
      if (error instanceof CircuitOpenError) {
        throw error;
      }
      
      // Wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }
  }
  
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPRESS MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to expose circuit breaker stats
 */
export function circuitBreakerStatusMiddleware() {
  return (_req: Request, res: Response): void => {
    const stats = circuitRegistry.getAllStats();
    
    // Check if any circuit is open
    const hasOpenCircuit = Object.values(stats).some(s => s.state === 'open');
    
    res.json({
      healthy: !hasOpenCircuit,
      circuits: stats,
    });
  };
}

/**
 * Middleware to reject requests when critical circuits are open
 */
export function circuitBreakerGuard(criticalCircuits: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const name of criticalCircuits) {
      const circuit = circuitRegistry.get(name);
      if (circuit && circuit.getState() === 'open') {
        res.status(503).json({
          error: 'Service Unavailable',
          code: 'CIRCUIT_OPEN',
          circuit: name,
          retryAfter: 30, // Suggest retry
        });
        return;
      }
    }
    
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export default CircuitBreaker;
