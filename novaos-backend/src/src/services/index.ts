// ═══════════════════════════════════════════════════════════════════════════════
// SERVICES INDEX — All Service Exports
// Phase 20: Production Hardening
// ═══════════════════════════════════════════════════════════════════════════════

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitOpenError,
  CircuitTimeoutError,
  circuitRegistry,
  getLLMCircuit,
  getExternalAPICircuit,
  getDatabaseCircuit,
  getRedisCircuit,
  getWebFetchCircuit,
  withCircuitBreaker,
  executeWithFallback,
  executeWithRetry,
  circuitBreakerStatusMiddleware,
  circuitBreakerGuard,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
} from './circuit-breaker.js';
