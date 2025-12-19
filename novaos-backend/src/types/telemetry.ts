// ═══════════════════════════════════════════════════════════════════════════════
// TELEMETRY TYPES — Live Data Router Observability
// Comprehensive tracing and logging types for debugging and monitoring
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory, DataCategory } from './categories.js';
import type { TruthMode, FallbackMode, ClassificationConfidence } from './data-need.js';
import type { LensMode, RetrievalStatus } from './lens.js';
import type { ProviderErrorCode } from './provider-results.js';
import type { NumericContextKey } from './constraints.js';
import type { EntityType, ResolutionStatus } from './entities.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CORRELATION CONTEXT — Request tracing
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Correlation context for distributed tracing.
 * Passed through all components for log correlation.
 */
export interface CorrelationContext {
  /** Unique request identifier */
  readonly requestId: string;
  
  /** Conversation identifier */
  readonly conversationId: string;
  
  /** User identifier (hashed for privacy) */
  readonly userIdHash: string;
  
  /** Trace ID for distributed tracing (e.g., OpenTelemetry) */
  readonly traceId: string;
  
  /** Span ID for current operation */
  readonly spanId: string;
  
  /** Parent span ID if nested */
  readonly parentSpanId?: string;
  
  /** Request timestamp */
  readonly timestamp: number;
  
  /** Environment (prod, staging, dev) */
  readonly environment: string;
  
  /** Service version */
  readonly serviceVersion: string;
}

/**
 * Create a new correlation context.
 */
export function createCorrelationContext(
  requestId: string,
  conversationId: string,
  userIdHash: string,
  environment: string = 'production',
  serviceVersion: string = '1.0.0'
): CorrelationContext {
  return {
    requestId,
    conversationId,
    userIdHash,
    traceId: requestId, // Use requestId as traceId for simplicity
    spanId: generateSpanId(),
    timestamp: Date.now(),
    environment,
    serviceVersion,
  };
}

/**
 * Generate a random span ID.
 */
function generateSpanId(): string {
  return Math.random().toString(36).substring(2, 18);
}

// ─────────────────────────────────────────────────────────────────────────────────
// LENS OUTCOME — High-level result classification
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * High-level outcome of Lens gate execution.
 */
export type LensOutcome =
  | 'success'              // All data retrieved, constraints applied
  | 'partial_success'      // Some data retrieved, proceeding with partial
  | 'degraded'             // No live data, proceeding without numbers
  | 'blocked'              // Blocked pending user action
  | 'passthrough'          // No live data needed
  | 'error';               // Unexpected error

/**
 * All valid lens outcomes as a Set.
 */
export const VALID_LENS_OUTCOMES: ReadonlySet<LensOutcome> = new Set([
  'success',
  'partial_success',
  'degraded',
  'blocked',
  'passthrough',
  'error',
]);

// ─────────────────────────────────────────────────────────────────────────────────
// TIMING BREAKDOWN — Detailed latency tracking
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Detailed timing breakdown for Lens gate execution.
 */
export interface LensTimingBreakdown {
  /** Total Lens gate execution time */
  readonly totalMs: number;
  
  /** Time spent on classification */
  readonly classificationMs: number;
  
  /** Time spent on entity extraction */
  readonly entityExtractionMs: number;
  
  /** Time spent on entity resolution */
  readonly entityResolutionMs: number;
  
  /** Time spent on provider fetches (parallel) */
  readonly providerFetchMs: number;
  
  /** Time spent on evidence pack assembly */
  readonly evidenceAssemblyMs: number;
  
  /** Time spent on constraint generation */
  readonly constraintGenerationMs: number;
  
  /** Individual provider timings */
  readonly providerTimings: ReadonlyMap<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LENS TRACE — Complete execution trace
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Complete trace of Lens gate execution.
 * Used for debugging, monitoring, and analytics.
 */
export interface LensTrace {
  // ─────────────────────────────────────────────────────────────────────────────
  // Context
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Correlation context for this trace */
  readonly correlation: CorrelationContext;
  
  /** Original user query (truncated for privacy) */
  readonly queryTruncated: string;
  
  /** Query length in characters */
  readonly queryLength: number;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Classification
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Truth mode determined */
  readonly truthMode: TruthMode;
  
  /** Primary category detected */
  readonly primaryCategory: DataCategory;
  
  /** All categories detected */
  readonly categories: readonly DataCategory[];
  
  /** Classification confidence */
  readonly classificationConfidence: ClassificationConfidence;
  
  /** Classification method used */
  readonly classificationMethod: 'rule_based' | 'llm' | 'hybrid';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Entities
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Number of entities extracted */
  readonly entitiesExtracted: number;
  
  /** Number of entities resolved */
  readonly entitiesResolved: number;
  
  /** Entity types found */
  readonly entityTypes: readonly EntityType[];
  
  /** Resolution statuses */
  readonly resolutionStatuses: readonly ResolutionStatus[];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Retrieval
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Retrieval status */
  readonly retrievalStatus: RetrievalStatus | null;
  
  /** Providers called */
  readonly providersCalled: readonly string[];
  
  /** Providers that succeeded */
  readonly providersSucceeded: readonly string[];
  
  /** Providers that failed */
  readonly providersFailed: readonly string[];
  
  /** Provider error codes (if any) */
  readonly providerErrors: readonly ProviderErrorCode[];
  
  /** Whether fallback providers were used */
  readonly usedFallback: boolean;
  
  /** Whether stale data was served */
  readonly usedStaleData: boolean;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Outcome
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** High-level outcome */
  readonly outcome: LensOutcome;
  
  /** Lens operating mode */
  readonly mode: LensMode;
  
  /** Fallback mode used */
  readonly fallbackMode: FallbackMode;
  
  /** Whether numeric precision is allowed */
  readonly numericPrecisionAllowed: boolean;
  
  /** Number of numeric tokens generated */
  readonly numericTokenCount: number;
  
  /** Whether action recommendations are allowed */
  readonly actionRecommendationsAllowed: boolean;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Timing
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Detailed timing breakdown */
  readonly timing: LensTimingBreakdown;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Errors
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Whether any errors occurred */
  readonly hasErrors: boolean;
  
  /** Error messages (if any) */
  readonly errors: readonly string[];
  
  /** Whether the gate failed open */
  readonly failedOpen: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LENS OPERATIONAL EVENT — Structured logging
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Event type for operational logging.
 */
export type LensEventType =
  | 'classification_complete'
  | 'entity_extraction_complete'
  | 'entity_resolution_complete'
  | 'provider_fetch_start'
  | 'provider_fetch_complete'
  | 'provider_fetch_error'
  | 'fallback_triggered'
  | 'stale_data_served'
  | 'evidence_assembled'
  | 'constraints_generated'
  | 'gate_complete'
  | 'gate_error'
  | 'leak_guard_violation';

/**
 * Severity level for operational events.
 */
export type EventSeverity = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured operational event for logging.
 */
export interface LensOperationalEvent {
  /** Event type */
  readonly eventType: LensEventType;
  
  /** Severity level */
  readonly severity: EventSeverity;
  
  /** Correlation context */
  readonly correlation: CorrelationContext;
  
  /** Timestamp */
  readonly timestamp: number;
  
  /** Human-readable message */
  readonly message: string;
  
  /** Event-specific data */
  readonly data: Record<string, unknown>;
  
  /** Duration if applicable (ms) */
  readonly durationMs?: number;
  
  /** Error details if applicable */
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly stack?: string;
  };
}

/**
 * Create an operational event.
 */
export function createOperationalEvent(
  eventType: LensEventType,
  severity: EventSeverity,
  correlation: CorrelationContext,
  message: string,
  data: Record<string, unknown> = {},
  durationMs?: number
): LensOperationalEvent {
  return {
    eventType,
    severity,
    correlation,
    timestamp: Date.now(),
    message,
    data,
    durationMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// LEAK GUARD TRACE — Numeric leak detection
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Result of leak guard check.
 */
export type LeakGuardVerdict =
  | 'pass'          // All numbers are allowed
  | 'violation'     // Unauthorized numbers detected
  | 'exempted'      // Numbers exempted by policy
  | 'skipped';      // Check skipped (not applicable)

/**
 * Individual number found in output.
 */
export interface DetectedNumber {
  /** The numeric value */
  readonly value: number;
  
  /** String representation as found */
  readonly asString: string;
  
  /** Character offset in output */
  readonly offset: number;
  
  /** Surrounding context (for debugging) */
  readonly context: string;
  
  /** Whether this number is allowed */
  readonly allowed: boolean;
  
  /** Reason allowed/disallowed */
  readonly reason: string;
  
  /** Matching token key if allowed */
  readonly tokenKey?: string;
  
  /** Exemption type if exempted */
  readonly exemptionType?: string;
}

/**
 * Complete trace of leak guard execution.
 */
export interface LeakGuardTrace {
  /** Correlation context */
  readonly correlation: CorrelationContext;
  
  /** Overall verdict */
  readonly verdict: LeakGuardVerdict;
  
  /** All numbers detected in output */
  readonly detectedNumbers: readonly DetectedNumber[];
  
  /** Count of allowed numbers */
  readonly allowedCount: number;
  
  /** Count of violations */
  readonly violationCount: number;
  
  /** Count of exempted numbers */
  readonly exemptedCount: number;
  
  /** Allowed token keys that were used */
  readonly usedTokenKeys: readonly string[];
  
  /** Token keys that were available but unused */
  readonly unusedTokenKeys: readonly string[];
  
  /** Context keys found in output */
  readonly contextKeysMatched: readonly NumericContextKey[];
  
  /** Execution time */
  readonly executionTimeMs: number;
  
  /** Output length checked */
  readonly outputLength: number;
  
  /** Whether output was modified (violations removed) */
  readonly outputModified: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AGGREGATED METRICS — For dashboards
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Aggregated metrics for a time window.
 */
export interface LensMetricsWindow {
  /** Window start timestamp */
  readonly windowStart: number;
  
  /** Window end timestamp */
  readonly windowEnd: number;
  
  /** Total requests processed */
  readonly totalRequests: number;
  
  /** Requests by outcome */
  readonly byOutcome: ReadonlyMap<LensOutcome, number>;
  
  /** Requests by truth mode */
  readonly byTruthMode: ReadonlyMap<TruthMode, number>;
  
  /** Requests by category */
  readonly byCategory: ReadonlyMap<DataCategory, number>;
  
  /** Provider call counts */
  readonly providerCalls: ReadonlyMap<string, number>;
  
  /** Provider success rates */
  readonly providerSuccessRates: ReadonlyMap<string, number>;
  
  /** Average latencies */
  readonly avgLatencies: {
    readonly total: number;
    readonly classification: number;
    readonly entityResolution: number;
    readonly providerFetch: number;
  };
  
  /** P95 latencies */
  readonly p95Latencies: {
    readonly total: number;
    readonly classification: number;
    readonly entityResolution: number;
    readonly providerFetch: number;
  };
  
  /** Leak guard statistics */
  readonly leakGuard: {
    readonly checksPerformed: number;
    readonly violations: number;
    readonly violationRate: number;
  };
  
  /** Error counts */
  readonly errors: {
    readonly total: number;
    readonly byType: ReadonlyMap<string, number>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TRACE BUILDERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create an empty timing breakdown (for initialization).
 */
export function createEmptyTimingBreakdown(): LensTimingBreakdown {
  return {
    totalMs: 0,
    classificationMs: 0,
    entityExtractionMs: 0,
    entityResolutionMs: 0,
    providerFetchMs: 0,
    evidenceAssemblyMs: 0,
    constraintGenerationMs: 0,
    providerTimings: new Map(),
  };
}

/**
 * Create an error trace when Lens gate fails.
 */
export function createErrorTrace(
  correlation: CorrelationContext,
  error: Error,
  partialTiming: Partial<LensTimingBreakdown> = {}
): LensTrace {
  return {
    correlation,
    queryTruncated: '[error - query not available]',
    queryLength: 0,
    truthMode: 'local',
    primaryCategory: 'general',
    categories: ['general'],
    classificationConfidence: 'low',
    classificationMethod: 'rule_based',
    entitiesExtracted: 0,
    entitiesResolved: 0,
    entityTypes: [],
    resolutionStatuses: [],
    retrievalStatus: null,
    providersCalled: [],
    providersSucceeded: [],
    providersFailed: [],
    providerErrors: [],
    usedFallback: false,
    usedStaleData: false,
    outcome: 'error',
    mode: 'degraded',
    fallbackMode: 'degrade',
    numericPrecisionAllowed: false,
    numericTokenCount: 0,
    actionRecommendationsAllowed: false,
    timing: {
      ...createEmptyTimingBreakdown(),
      ...partialTiming,
    },
    hasErrors: true,
    errors: [error.message],
    failedOpen: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a trace indicates successful execution.
 */
export function isSuccessfulTrace(trace: LensTrace): boolean {
  return trace.outcome === 'success' || trace.outcome === 'passthrough';
}

/**
 * Check if a trace has leak guard violations.
 */
export function hasLeakViolations(trace: LeakGuardTrace): boolean {
  return trace.verdict === 'violation' && trace.violationCount > 0;
}
