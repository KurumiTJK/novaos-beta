// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST CONTEXT — AsyncLocalStorage for Correlation & Tracing
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides automatic propagation of request context (correlation ID, request ID,
// user ID, etc.) through async call chains without explicit parameter passing.
//
// Usage:
//   // In middleware
//   runWithContext({ correlationId, requestId }, async () => {
//     await handleRequest();
//   });
//
//   // Anywhere in the call chain
//   const ctx = getContext();
//   console.log(ctx.correlationId); // Available without passing through!
//
// ═══════════════════════════════════════════════════════════════════════════════

import { AsyncLocalStorage } from 'async_hooks';
import type { RequestId, CorrelationId, UserId, Timestamp } from '../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Request context available throughout async operations.
 */
export interface RequestContext {
  /** Unique ID for this specific request */
  readonly requestId: RequestId;
  
  /** Correlation ID for distributed tracing (propagated across services) */
  readonly correlationId: CorrelationId;
  
  /** User ID if authenticated */
  readonly userId?: UserId;
  
  /** Session ID if available */
  readonly sessionId?: string;
  
  /** Request start timestamp */
  readonly timestamp: Timestamp;
  
  /** High-resolution start time for duration calculation */
  readonly startTime: number;
  
  /** Request path */
  readonly path?: string;
  
  /** HTTP method */
  readonly method?: string;
  
  /** Client IP (may be redacted) */
  readonly ip?: string;
  
  /** User agent */
  readonly userAgent?: string;
  
  /** Service name (for service-to-service calls) */
  readonly serviceName?: string;
  
  /** Parent span ID for tracing */
  readonly parentSpanId?: string;
  
  /** Current span ID for tracing */
  readonly spanId?: string;
  
  /** Additional metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Partial context for creating new contexts.
 */
export type PartialContext = Partial<RequestContext> & {
  requestId?: RequestId;
  correlationId?: CorrelationId;
};

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC LOCAL STORAGE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * AsyncLocalStorage instance for request context.
 * This allows context to be available throughout async operations
 * without explicit parameter passing.
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// ─────────────────────────────────────────────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a unique request ID.
 * Format: req_<uuid>
 */
export function generateRequestId(): RequestId {
  return `req_${crypto.randomUUID()}` as RequestId;
}

/**
 * Generate a correlation ID.
 * Format: cor_<uuid>
 */
export function generateCorrelationId(): CorrelationId {
  return `cor_${crypto.randomUUID()}` as CorrelationId;
}

/**
 * Generate a span ID for tracing.
 * Format: 16 hex characters
 */
export function generateSpanId(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
}

/**
 * Parse incoming request/correlation ID from header.
 * Returns the value if valid, otherwise generates a new one.
 */
export function parseOrGenerateRequestId(header: string | undefined): RequestId {
  if (header && typeof header === 'string' && header.length > 0 && header.length < 128) {
    // Accept existing ID if it looks valid
    return header as RequestId;
  }
  return generateRequestId();
}

/**
 * Parse incoming correlation ID from header.
 * Returns the value if valid, otherwise generates a new one.
 */
export function parseOrGenerateCorrelationId(header: string | undefined): CorrelationId {
  if (header && typeof header === 'string' && header.length > 0 && header.length < 128) {
    return header as CorrelationId;
  }
  return generateCorrelationId();
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new request context.
 */
export function createContext(partial: PartialContext = {}): RequestContext {
  const now = Date.now();
  
  return {
    requestId: partial.requestId ?? generateRequestId(),
    correlationId: partial.correlationId ?? generateCorrelationId(),
    timestamp: (partial.timestamp ?? new Date(now).toISOString()) as Timestamp,
    startTime: partial.startTime ?? now,
    spanId: partial.spanId ?? generateSpanId(),
    ...partial,
  };
}

/**
 * Run a function within a request context.
 * The context will be available via getContext() throughout the async chain.
 */
export function runWithContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Run a function with a new context created from partial values.
 */
export function runWithNewContext<T>(
  partial: PartialContext,
  fn: () => T
): T {
  return runWithContext(createContext(partial), fn);
}

/**
 * Get the current request context.
 * Returns undefined if called outside of a context.
 */
export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current request context, throwing if not available.
 */
export function requireContext(): RequestContext {
  const ctx = getContext();
  if (!ctx) {
    throw new Error('Request context not available. Ensure code runs within runWithContext().');
  }
  return ctx;
}

/**
 * Get a specific value from the current context with a fallback.
 */
export function getContextValue<K extends keyof RequestContext>(
  key: K,
  fallback: RequestContext[K]
): RequestContext[K] {
  const ctx = getContext();
  return ctx?.[key] ?? fallback;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT ACCESSORS (Convenience)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get the current request ID or 'unknown'.
 */
export function getRequestId(): string {
  return getContext()?.requestId ?? 'unknown';
}

/**
 * Get the current correlation ID or 'unknown'.
 */
export function getCorrelationId(): string {
  return getContext()?.correlationId ?? 'unknown';
}

/**
 * Get the current user ID if available.
 */
export function getUserId(): string | undefined {
  return getContext()?.userId;
}

/**
 * Get the current span ID if available.
 */
export function getSpanId(): string | undefined {
  return getContext()?.spanId;
}

/**
 * Get the request duration in milliseconds.
 */
export function getRequestDuration(): number {
  const ctx = getContext();
  if (!ctx) return 0;
  return Date.now() - ctx.startTime;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT MODIFICATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a child context with additional/overridden values.
 * Useful for creating sub-spans or adding user context after authentication.
 */
export function extendContext(extensions: Partial<RequestContext>): RequestContext {
  const current = getContext();
  
  if (!current) {
    return createContext(extensions);
  }
  
  return {
    ...current,
    ...extensions,
    // Preserve parent span relationship
    parentSpanId: extensions.parentSpanId ?? current.spanId,
    spanId: extensions.spanId ?? generateSpanId(),
  };
}

/**
 * Run a function with an extended context (child span).
 */
export function runWithChildContext<T>(
  extensions: Partial<RequestContext>,
  fn: () => T
): T {
  return runWithContext(extendContext(extensions), fn);
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT SERIALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Headers used for context propagation between services.
 */
export const CONTEXT_HEADERS = {
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'x-correlation-id',
  SPAN_ID: 'x-span-id',
  PARENT_SPAN_ID: 'x-parent-span-id',
  USER_ID: 'x-user-id',
} as const;

/**
 * Extract context from incoming HTTP headers.
 */
export function extractContextFromHeaders(
  headers: Record<string, string | string[] | undefined>
): PartialContext {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name];
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value[0];
    return undefined;
  };
  
  return {
    requestId: parseOrGenerateRequestId(getHeader(CONTEXT_HEADERS.REQUEST_ID)),
    correlationId: parseOrGenerateCorrelationId(getHeader(CONTEXT_HEADERS.CORRELATION_ID)),
    parentSpanId: getHeader(CONTEXT_HEADERS.PARENT_SPAN_ID),
    userId: getHeader(CONTEXT_HEADERS.USER_ID) as UserId | undefined,
  };
}

/**
 * Create headers for propagating context to downstream services.
 */
export function createContextHeaders(ctx?: RequestContext): Record<string, string> {
  const context = ctx ?? getContext();
  
  if (!context) {
    return {};
  }
  
  const headers: Record<string, string> = {
    [CONTEXT_HEADERS.REQUEST_ID]: context.requestId,
    [CONTEXT_HEADERS.CORRELATION_ID]: context.correlationId,
  };
  
  if (context.spanId) {
    headers[CONTEXT_HEADERS.PARENT_SPAN_ID] = context.spanId;
  }
  
  if (context.userId) {
    headers[CONTEXT_HEADERS.USER_ID] = context.userId;
  }
  
  return headers;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGING CONTEXT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get context fields suitable for logging.
 * Excludes sensitive or verbose fields.
 */
export function getLoggingContext(): Record<string, unknown> {
  const ctx = getContext();
  
  if (!ctx) {
    return {};
  }
  
  return {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    ...(ctx.userId && { userId: ctx.userId }),
    ...(ctx.spanId && { spanId: ctx.spanId }),
    ...(ctx.parentSpanId && { parentSpanId: ctx.parentSpanId }),
    ...(ctx.path && { path: ctx.path }),
    ...(ctx.method && { method: ctx.method }),
  };
}

/**
 * Get minimal context fields for compact logging.
 */
export function getMinimalLoggingContext(): Record<string, unknown> {
  const ctx = getContext();
  
  if (!ctx) {
    return {};
  }
  
  return {
    reqId: ctx.requestId,
    corId: ctx.correlationId,
    ...(ctx.userId && { uid: ctx.userId }),
  };
}
