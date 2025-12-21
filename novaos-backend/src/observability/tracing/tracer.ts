// ═══════════════════════════════════════════════════════════════════════════════
// TRACING — OpenTelemetry Tracer Stub
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// Placeholder for OpenTelemetry integration.
// Provides a minimal tracing API that can be enhanced with full OTel support.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { getContext, generateSpanId, runWithChildContext } from '../logging/context.js';
import { getLogger } from '../logging/logger.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Span status.
 */
export type SpanStatus = 'ok' | 'error' | 'unset';

/**
 * Span kind.
 */
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

/**
 * Span attributes.
 */
export type SpanAttributes = Record<string, string | number | boolean>;

/**
 * Span interface.
 */
export interface Span {
  /** Span ID */
  readonly spanId: string;
  
  /** Span name */
  readonly name: string;
  
  /** Set an attribute */
  setAttribute(key: string, value: string | number | boolean): void;
  
  /** Set multiple attributes */
  setAttributes(attributes: SpanAttributes): void;
  
  /** Add an event to the span */
  addEvent(name: string, attributes?: SpanAttributes): void;
  
  /** Set the span status */
  setStatus(status: SpanStatus, message?: string): void;
  
  /** Record an exception */
  recordException(error: Error): void;
  
  /** End the span */
  end(): void;
  
  /** Check if span is recording */
  isRecording(): boolean;
}

/**
 * Tracer configuration.
 */
export interface TracerConfig {
  /** Service name */
  serviceName?: string;
  
  /** Enable tracing */
  enabled?: boolean;
  
  /** Sample rate (0-1) */
  sampleRate?: number;
  
  /** Export endpoint (for future OTel export) */
  exporterEndpoint?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

let tracerConfig: TracerConfig = {
  serviceName: 'novaos',
  enabled: false,
  sampleRate: 1.0,
};

/**
 * Configure the tracer.
 */
export function configureTracer(config: TracerConfig): void {
  tracerConfig = { ...tracerConfig, ...config };
}

/**
 * Check if tracing is enabled.
 */
export function isTracingEnabled(): boolean {
  return tracerConfig.enabled ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPAN IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Internal span implementation.
 */
class SpanImpl implements Span {
  readonly spanId: string;
  readonly name: string;
  private readonly startTime: number;
  private readonly attributes: SpanAttributes = {};
  private readonly events: Array<{ name: string; timestamp: number; attributes?: SpanAttributes }> = [];
  private status: SpanStatus = 'unset';
  private statusMessage?: string;
  private ended = false;
  private readonly logger = getLogger({ component: 'tracing' });
  
  constructor(name: string, spanId?: string) {
    this.name = name;
    this.spanId = spanId ?? generateSpanId();
    this.startTime = performance.now();
  }
  
  setAttribute(key: string, value: string | number | boolean): void {
    if (!this.ended) {
      this.attributes[key] = value;
    }
  }
  
  setAttributes(attributes: SpanAttributes): void {
    if (!this.ended) {
      Object.assign(this.attributes, attributes);
    }
  }
  
  addEvent(name: string, attributes?: SpanAttributes): void {
    if (!this.ended) {
      this.events.push({
        name,
        timestamp: performance.now(),
        attributes,
      });
    }
  }
  
  setStatus(status: SpanStatus, message?: string): void {
    if (!this.ended) {
      this.status = status;
      this.statusMessage = message;
    }
  }
  
  recordException(error: Error): void {
    if (!this.ended) {
      this.addEvent('exception', {
        'exception.type': error.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack ?? '',
      });
      this.setStatus('error', error.message);
    }
  }
  
  end(): void {
    if (this.ended) return;
    
    this.ended = true;
    const durationMs = performance.now() - this.startTime;
    
    if (tracerConfig.enabled) {
      this.logger.debug('Span ended', {
        spanId: this.spanId,
        name: this.name,
        durationMs: durationMs.toFixed(2),
        status: this.status,
        attributeCount: Object.keys(this.attributes).length,
        eventCount: this.events.length,
      });
    }
  }
  
  isRecording(): boolean {
    return !this.ended;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// NO-OP SPAN
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * No-op span when tracing is disabled.
 */
const noopSpan: Span = {
  spanId: 'noop',
  name: 'noop',
  setAttribute: () => {},
  setAttributes: () => {},
  addEvent: () => {},
  setStatus: () => {},
  recordException: () => {},
  end: () => {},
  isRecording: () => false,
};

// ─────────────────────────────────────────────────────────────────────────────────
// TRACER API
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Start a new span.
 */
export function startSpan(
  name: string,
  options?: {
    kind?: SpanKind;
    attributes?: SpanAttributes;
  }
): Span {
  if (!tracerConfig.enabled) {
    return noopSpan;
  }
  
  // Sample based on rate
  if (Math.random() > (tracerConfig.sampleRate ?? 1.0)) {
    return noopSpan;
  }
  
  const span = new SpanImpl(name);
  
  if (options?.attributes) {
    span.setAttributes(options.attributes);
  }
  
  if (options?.kind) {
    span.setAttribute('span.kind', options.kind);
  }
  
  return span;
}

/**
 * Run a function within a span.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: SpanAttributes;
  }
): Promise<T> {
  const span = startSpan(name, options);
  
  try {
    const result = await runWithChildContext({ spanId: span.spanId }, () => fn(span));
    span.setStatus('ok');
    return result;
  } catch (error) {
    if (error instanceof Error) {
      span.recordException(error);
    }
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Run a synchronous function within a span.
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  options?: {
    kind?: SpanKind;
    attributes?: SpanAttributes;
  }
): T {
  const span = startSpan(name, options);
  
  try {
    const result = fn(span);
    span.setStatus('ok');
    return result;
  } catch (error) {
    if (error instanceof Error) {
      span.recordException(error);
    }
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Get the current span from context.
 */
export function getCurrentSpan(): Span | undefined {
  const ctx = getContext();
  if (!ctx?.spanId || !tracerConfig.enabled) {
    return undefined;
  }
  // Note: This is a simplified implementation.
  // A full implementation would maintain a span registry.
  return undefined;
}

/**
 * Create a span decorator for methods.
 */
export function traced(name?: string) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
      return withSpan(name ?? propertyKey, async () => {
        return originalMethod.apply(this, args);
      });
    };
    
    return descriptor;
  };
}
