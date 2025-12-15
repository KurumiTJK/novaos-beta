import { PipelineState } from './types';
/**
 * Deep clone a pipeline state for isolated mutation.
 * Uses structuredClone for proper deep copy.
 *
 * @param state - State to clone
 * @returns Deep cloned state
 */
export declare function cloneState(state: PipelineState): PipelineState;
/**
 * Fallback deep clone for environments without structuredClone.
 */
export declare function cloneStateCompat(state: PipelineState): PipelineState;
/**
 * Create an immutable state update.
 * Returns new state without mutating original.
 */
export declare function updateState<K extends keyof PipelineState>(state: PipelineState, key: K, value: PipelineState[K]): PipelineState;
/**
 * Increment regeneration count immutably.
 */
export declare function incrementRegeneration(state: PipelineState): PipelineState;
/**
 * Custom error for pipeline timeouts.
 */
export declare class PipelineTimeoutError extends Error {
    readonly code = "PIPELINE_TIMEOUT";
    readonly requestId?: string;
    readonly gateId?: string;
    constructor(message: string, requestId?: string, gateId?: string);
}
/**
 * Wrap a promise with a timeout.
 *
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param context - Context for error message
 * @returns Promise that rejects on timeout
 */
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, context?: {
    requestId?: string;
    gateId?: string;
}): Promise<T>;
/**
 * Default timeouts for different operations.
 */
export declare const TIMEOUTS: {
    readonly PIPELINE_TOTAL: 30000;
    readonly GATE_DEFAULT: 5000;
    readonly MODEL_GENERATION: 15000;
    readonly VERIFICATION: 10000;
    readonly NONCE_CHECK: 1000;
};
/**
 * Gate-specific timeouts.
 */
export declare const GATE_TIMEOUTS: Record<string, number>;
/**
 * Error types that can be safely shown to clients.
 */
export type ClientErrorCode = 'INVALID_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMITED' | 'SERVICE_ERROR' | 'TIMEOUT' | 'CONTENT_BLOCKED' | 'VERIFICATION_REQUIRED' | 'ACKNOWLEDGMENT_REQUIRED';
/**
 * Client-safe error structure.
 */
export interface ClientError {
    code: ClientErrorCode;
    message: string;
    requestId?: string;
    retryable: boolean;
    retryAfterMs?: number;
}
/**
 * Sanitize an internal error for client response.
 * NEVER expose internal details like gate names, policy versions, stack traces.
 *
 * @param error - Internal error
 * @param requestId - Request ID for client reference
 * @returns Client-safe error
 */
export declare function sanitizeError(error: unknown, requestId?: string): ClientError;
/**
 * Log error with full details for debugging.
 * Call this BEFORE sanitizing for client response.
 */
export declare function logInternalError(error: unknown, context: {
    requestId?: string;
    userId?: string;
    gateId?: string;
    operation?: string;
}): void;
/**
 * Wrap pipeline execution with timeout and error handling.
 */
export declare function executeWithSafety<T>(operation: () => Promise<T>, context: {
    requestId: string;
    userId?: string;
    gateId?: string;
    timeoutMs?: number;
}): Promise<{
    success: true;
    result: T;
} | {
    success: false;
    error: ClientError;
}>;
//# sourceMappingURL=pipeline-utilities.d.ts.map