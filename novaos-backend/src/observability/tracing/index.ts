// ═══════════════════════════════════════════════════════════════════════════════
// TRACING MODULE INDEX — Distributed Tracing Exports
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TRACER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type SpanStatus,
  type SpanKind,
  type SpanAttributes,
  type Span,
  type TracerConfig,
  
  // Configuration
  configureTracer,
  isTracingEnabled,
  
  // Span API
  startSpan,
  withSpan,
  withSpanSync,
  getCurrentSpan,
  
  // Decorator
  traced,
} from './tracer.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

export {
  type TracingMiddlewareOptions,
  tracingMiddleware,
  createChildSpan,
} from './middleware.js';
