// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// Protects against cascading LLM failures
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type { CircuitBreakerState, CircuitBreakerStateRow, CircuitState } from '../types.js';
import { mapCircuitBreakerState } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  failureThreshold: 5,        // Failures before opening
  cooldownSeconds: 60,        // Seconds before half-open
  halfOpenMaxAttempts: 1,     // Attempts in half-open before closing
};

// In-memory fallback when DB unavailable
const memoryState: Map<string, CircuitBreakerState> = new Map();

// ─────────────────────────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get circuit breaker state for a service
 */
export async function getCircuitState(serviceName: string): Promise<CircuitBreakerState> {
  // Try database first
  if (isSupabaseInitialized()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('circuit_breaker_state')
        .select('*')
        .eq('service_name', serviceName)
        .single();

      if (!error && data) {
        const state = mapCircuitBreakerState(data as CircuitBreakerStateRow);
        memoryState.set(serviceName, state);
        return state;
      }
    } catch {
      // Fall through to memory
    }
  }

  // Memory fallback
  if (memoryState.has(serviceName)) {
    return memoryState.get(serviceName)!;
  }

  // Create default
  const defaultState: CircuitBreakerState = {
    id: serviceName,
    serviceName,
    state: 'closed',
    failureCount: 0,
    updatedAt: new Date(),
  };

  memoryState.set(serviceName, defaultState);
  return defaultState;
}

/**
 * Update circuit breaker state
 */
async function updateCircuitState(
  serviceName: string,
  updates: Partial<CircuitBreakerState>
): Promise<CircuitBreakerState> {
  const current = await getCircuitState(serviceName);
  const updated: CircuitBreakerState = {
    ...current,
    ...updates,
    updatedAt: new Date(),
  };

  memoryState.set(serviceName, updated);

  // Persist to database
  if (isSupabaseInitialized()) {
    try {
      const supabase = getSupabase();
      await supabase
        .from('circuit_breaker_state')
        .upsert({
          service_name: serviceName,
          state: updated.state,
          failure_count: updated.failureCount,
          last_failure_at: updated.lastFailureAt?.toISOString(),
          last_success_at: updated.lastSuccessAt?.toISOString(),
          opened_at: updated.openedAt?.toISOString(),
          half_open_at: updated.halfOpenAt?.toISOString(),
          updated_at: updated.updatedAt.toISOString(),
        } as any, { onConflict: 'service_name' });
    } catch (err) {
      console.error('[CircuitBreaker] Failed to persist state:', err);
    }
  }

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CIRCUIT OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if circuit allows requests
 */
export async function isCircuitOpen(serviceName: string): Promise<boolean> {
  const state = await getCircuitState(serviceName);

  if (state.state === 'closed') {
    return false;
  }

  if (state.state === 'open') {
    // Check if cooldown has elapsed
    if (state.openedAt) {
      const elapsed = (Date.now() - state.openedAt.getTime()) / 1000;
      if (elapsed >= CONFIG.cooldownSeconds) {
        // Transition to half-open
        await updateCircuitState(serviceName, {
          state: 'half_open',
          halfOpenAt: new Date(),
        });
        console.log(`[CircuitBreaker] ${serviceName} transitioned to half-open`);
        return false; // Allow test request
      }
    }
    return true; // Still open
  }

  // half_open - allow limited requests
  return false;
}

/**
 * Record a successful call
 */
export async function recordSuccess(serviceName: string): Promise<void> {
  const state = await getCircuitState(serviceName);

  if (state.state === 'half_open') {
    // Success in half-open → close circuit
    await updateCircuitState(serviceName, {
      state: 'closed',
      failureCount: 0,
      lastSuccessAt: new Date(),
      openedAt: undefined,
      halfOpenAt: undefined,
    });
    console.log(`[CircuitBreaker] ${serviceName} closed after successful test`);
  } else {
    // Just update last success
    await updateCircuitState(serviceName, {
      lastSuccessAt: new Date(),
    });
  }
}

/**
 * Record a failed call
 */
export async function recordFailure(serviceName: string): Promise<void> {
  const state = await getCircuitState(serviceName);
  const newFailureCount = state.failureCount + 1;

  if (state.state === 'half_open') {
    // Failure in half-open → reopen circuit
    await updateCircuitState(serviceName, {
      state: 'open',
      failureCount: newFailureCount,
      lastFailureAt: new Date(),
      openedAt: new Date(),
      halfOpenAt: undefined,
    });
    console.log(`[CircuitBreaker] ${serviceName} reopened after failed test`);
  } else if (newFailureCount >= CONFIG.failureThreshold) {
    // Threshold reached → open circuit
    await updateCircuitState(serviceName, {
      state: 'open',
      failureCount: newFailureCount,
      lastFailureAt: new Date(),
      openedAt: new Date(),
    });
    console.log(`[CircuitBreaker] ${serviceName} opened after ${newFailureCount} failures`);
  } else {
    // Below threshold
    await updateCircuitState(serviceName, {
      failureCount: newFailureCount,
      lastFailureAt: new Date(),
    });
  }
}

/**
 * Reset circuit to closed state
 */
export async function resetCircuit(serviceName: string): Promise<void> {
  await updateCircuitState(serviceName, {
    state: 'closed',
    failureCount: 0,
    openedAt: undefined,
    halfOpenAt: undefined,
  });
  console.log(`[CircuitBreaker] ${serviceName} reset to closed`);
}

// ─────────────────────────────────────────────────────────────────────────────────
// WRAPPER HELPER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Execute function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<{ result: T; usedFallback: boolean }> {
  // Check if circuit is open
  if (await isCircuitOpen(serviceName)) {
    console.log(`[CircuitBreaker] ${serviceName} is open, using fallback`);
    return { result: await fallback(), usedFallback: true };
  }

  try {
    const result = await fn();
    await recordSuccess(serviceName);
    return { result, usedFallback: false };
  } catch (error) {
    await recordFailure(serviceName);
    console.log(`[CircuitBreaker] ${serviceName} call failed, using fallback`);
    return { result: await fallback(), usedFallback: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const CircuitBreaker = {
  getState: getCircuitState,
  isOpen: isCircuitOpen,
  recordSuccess,
  recordFailure,
  reset: resetCircuit,
  withProtection: withCircuitBreaker,
  config: CONFIG,
};

export default CircuitBreaker;
