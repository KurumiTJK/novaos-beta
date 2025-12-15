"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE UTILITIES — Fixes E-3, F-1, F-2
// State isolation, timeout handling, and error sanitization
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.GATE_TIMEOUTS = exports.TIMEOUTS = exports.PipelineTimeoutError = void 0;
exports.cloneState = cloneState;
exports.cloneStateCompat = cloneStateCompat;
exports.updateState = updateState;
exports.incrementRegeneration = incrementRegeneration;
exports.withTimeout = withTimeout;
exports.sanitizeError = sanitizeError;
exports.logInternalError = logInternalError;
exports.executeWithSafety = executeWithSafety;
// ─────────────────────────────────────────────────────────────────────────────────
// FIX E-3: STATE ISOLATION
// Ensures regeneration doesn't corrupt state
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * Deep clone a pipeline state for isolated mutation.
 * Uses structuredClone for proper deep copy.
 *
 * @param state - State to clone
 * @returns Deep cloned state
 */
function cloneState(state) {
    // structuredClone handles Date objects, nested objects, etc.
    // It's available in Node 17+ and modern browsers
    return structuredClone(state);
}
/**
 * Fallback deep clone for environments without structuredClone.
 */
function cloneStateCompat(state) {
    // Handle Date objects specially
    const replacer = (key, value) => {
        if (value instanceof Date) {
            return { __type: 'Date', value: value.toISOString() };
        }
        return value;
    };
    const reviver = (key, value) => {
        if (value && typeof value === 'object' && value.__type === 'Date') {
            return new Date(value.value);
        }
        return value;
    };
    return JSON.parse(JSON.stringify(state, replacer), reviver);
}
/**
 * Create an immutable state update.
 * Returns new state without mutating original.
 */
function updateState(state, key, value) {
    return {
        ...state,
        [key]: value,
    };
}
/**
 * Increment regeneration count immutably.
 */
function incrementRegeneration(state) {
    return {
        ...state,
        regenerationCount: state.regenerationCount + 1,
    };
}
// ─────────────────────────────────────────────────────────────────────────────────
// FIX F-1: TIMEOUT HANDLING
// Prevents hanging requests from blocking workers
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * Custom error for pipeline timeouts.
 */
class PipelineTimeoutError extends Error {
    code = 'PIPELINE_TIMEOUT';
    requestId;
    gateId;
    constructor(message, requestId, gateId) {
        super(message);
        this.name = 'PipelineTimeoutError';
        this.requestId = requestId;
        this.gateId = gateId;
    }
}
exports.PipelineTimeoutError = PipelineTimeoutError;
/**
 * Wrap a promise with a timeout.
 *
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param context - Context for error message
 * @returns Promise that rejects on timeout
 */
function withTimeout(promise, timeoutMs, context) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new PipelineTimeoutError(`Operation timed out after ${timeoutMs}ms`, context?.requestId, context?.gateId));
        }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}
/**
 * Default timeouts for different operations.
 */
exports.TIMEOUTS = {
    PIPELINE_TOTAL: 30000, // 30 seconds total
    GATE_DEFAULT: 5000, // 5 seconds per gate
    MODEL_GENERATION: 15000, // 15 seconds for model
    VERIFICATION: 10000, // 10 seconds for web verification
    NONCE_CHECK: 1000, // 1 second for nonce store
};
/**
 * Gate-specific timeouts.
 */
exports.GATE_TIMEOUTS = {
    intent: 2000,
    shield: 3000,
    lens: exports.TIMEOUTS.VERIFICATION,
    stance: 1000,
    capability: 1000,
    model: exports.TIMEOUTS.MODEL_GENERATION,
    personality: 3000,
    spark: 2000,
    invariant: 2000,
};
/**
 * Map internal error codes to client-safe messages.
 */
const ERROR_MESSAGES = {
    // Validation errors
    INVALID_TYPE: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request format',
        retryable: false,
    },
    INVALID_PARAMS: {
        code: 'INVALID_REQUEST',
        message: 'Invalid parameters provided',
        retryable: false,
    },
    INVALID_STATE: {
        code: 'INVALID_REQUEST',
        message: 'Action not valid in current state',
        retryable: false,
    },
    // Auth errors
    UNAUTHORIZED: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        retryable: false,
    },
    // Veto errors
    HARD_VETO: {
        code: 'CONTENT_BLOCKED',
        message: 'This request cannot be processed due to content policies',
        retryable: false,
    },
    SOFT_VETO: {
        code: 'ACKNOWLEDGMENT_REQUIRED',
        message: 'This request requires acknowledgment to proceed',
        retryable: true,
    },
    // Verification errors
    VERIFICATION_UNAVAILABLE: {
        code: 'VERIFICATION_REQUIRED',
        message: 'Unable to verify information. Please try again or provide a source.',
        retryable: true,
    },
    // System errors
    PIPELINE_TIMEOUT: {
        code: 'TIMEOUT',
        message: 'Request timed out. Please try again.',
        retryable: true,
    },
    MODEL_UNAVAILABLE: {
        code: 'SERVICE_ERROR',
        message: 'Service temporarily unavailable. Please try again.',
        retryable: true,
    },
    INVARIANT_VIOLATION: {
        code: 'SERVICE_ERROR',
        message: 'Unable to process request safely. Please try again.',
        retryable: true,
    },
    // Default
    UNKNOWN: {
        code: 'SERVICE_ERROR',
        message: 'An unexpected error occurred',
        retryable: true,
    },
};
/**
 * Sanitize an internal error for client response.
 * NEVER expose internal details like gate names, policy versions, stack traces.
 *
 * @param error - Internal error
 * @param requestId - Request ID for client reference
 * @returns Client-safe error
 */
function sanitizeError(error, requestId) {
    // Handle known error types
    if (error instanceof PipelineTimeoutError) {
        return {
            code: 'TIMEOUT',
            message: 'Request timed out. Please try again.',
            requestId,
            retryable: true,
            retryAfterMs: 1000,
        };
    }
    // Handle errors with codes
    if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = String(error.code);
        const mapping = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN;
        return {
            code: mapping.code,
            message: mapping.message,
            requestId,
            retryable: mapping.retryable,
        };
    }
    // Handle generic errors
    if (error instanceof Error) {
        // Check message for known patterns (but don't expose the actual message)
        const msg = error.message.toLowerCase();
        if (msg.includes('timeout')) {
            return { ...ERROR_MESSAGES.PIPELINE_TIMEOUT, requestId };
        }
        if (msg.includes('unauthorized') || msg.includes('authentication')) {
            return { ...ERROR_MESSAGES.UNAUTHORIZED, requestId };
        }
        if (msg.includes('veto')) {
            return { ...ERROR_MESSAGES.HARD_VETO, requestId };
        }
    }
    // Default fallback — never expose internal details
    return {
        code: 'SERVICE_ERROR',
        message: 'An unexpected error occurred',
        requestId,
        retryable: true,
    };
}
/**
 * Log error with full details for debugging.
 * Call this BEFORE sanitizing for client response.
 */
function logInternalError(error, context) {
    const errorDetails = {
        timestamp: new Date().toISOString(),
        ...context,
        error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
        } : String(error),
    };
    // In production, send to logging service
    console.error('[PIPELINE_ERROR]', JSON.stringify(errorDetails));
}
// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE WRAPPER
// Combines timeout + error handling
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * Wrap pipeline execution with timeout and error handling.
 */
async function executeWithSafety(operation, context) {
    const timeoutMs = context.timeoutMs ?? exports.TIMEOUTS.PIPELINE_TOTAL;
    try {
        const result = await withTimeout(operation(), timeoutMs, context);
        return { success: true, result };
    }
    catch (error) {
        // Log full error internally
        logInternalError(error, context);
        // Return sanitized error to client
        const clientError = sanitizeError(error, context.requestId);
        return { success: false, error: clientError };
    }
}
//# sourceMappingURL=pipeline-utilities.js.map