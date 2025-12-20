// ═══════════════════════════════════════════════════════════════════════════════
// TELEMETRY — Telemetry and Tracing Types
// PATCHED: Stub file for type exports
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Telemetry event types.
 */
export type TelemetryEventType =
  | 'pipeline_start'
  | 'pipeline_end'
  | 'gate_start'
  | 'gate_end'
  | 'provider_call'
  | 'cache_hit'
  | 'cache_miss'
  | 'error'
  | 'warning';

/**
 * Base telemetry event.
 */
export interface TelemetryEvent {
  readonly type: TelemetryEventType;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Pipeline telemetry.
 */
export interface PipelineTelemetry {
  readonly requestId: string;
  readonly correlationId: string;
  readonly userId: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly totalLatencyMs?: number;
  readonly events: readonly TelemetryEvent[];
  readonly gates: Record<string, GateTelemetry>;
}

/**
 * Gate telemetry.
 */
export interface GateTelemetry {
  readonly gateId: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly latencyMs: number;
  readonly status: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Trace span.
 */
export interface TraceSpan {
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly operationName: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly tags?: Record<string, string | number | boolean>;
  readonly logs?: readonly TraceLog[];
}

/**
 * Trace log entry.
 */
export interface TraceLog {
  readonly timestamp: number;
  readonly message: string;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly fields?: Record<string, unknown>;
}

/**
 * Create a new trace span.
 */
export function createSpan(operationName: string, parentSpanId?: string): TraceSpan {
  return {
    spanId: generateSpanId(),
    parentSpanId,
    operationName,
    startTime: Date.now(),
  };
}

/**
 * Generate a span ID.
 */
export function generateSpanId(): string {
  return `span-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Generate a correlation ID.
 */
export function generateCorrelationId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
