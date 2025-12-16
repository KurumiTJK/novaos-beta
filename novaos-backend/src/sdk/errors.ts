// ═══════════════════════════════════════════════════════════════════════════════
// SDK ERRORS — Custom Error Classes for NovaOS Client SDK
// ═══════════════════════════════════════════════════════════════════════════════

import type { ApiError } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// BASE ERROR
// ─────────────────────────────────────────────────────────────────────────────────

export class NovaError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'NOVA_ERROR',
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NovaError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NovaError);
    }
  }

  static fromApiError(error: ApiError, statusCode: number): NovaError {
    return new NovaError(error.error, error.code, statusCode, error.details);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIFIC ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when authentication fails or credentials are missing
 */
export class AuthenticationError extends NovaError {
  constructor(message: string = 'Authentication failed', details?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when the user doesn't have permission to perform an action
 */
export class AuthorizationError extends NovaError {
  constructor(message: string = 'Access denied', details?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Thrown when a requested resource is not found
 */
export class NotFoundError extends NovaError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when request validation fails
 */
export class ValidationError extends NovaError {
  public readonly fields?: Record<string, string[]>;

  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', 400, { fields });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/**
 * Thrown when rate limit is exceeded
 */
export class RateLimitError extends NovaError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    super(
      retryAfter
        ? `Rate limit exceeded. Retry after ${retryAfter} seconds`
        : 'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      429,
      { retryAfter }
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Thrown when the user is blocked
 */
export class BlockedError extends NovaError {
  public readonly blockedUntil?: string;
  public readonly reason?: string;

  constructor(reason?: string, blockedUntil?: string) {
    super(reason ?? 'User is blocked', 'USER_BLOCKED', 403, { reason, blockedUntil });
    this.name = 'BlockedError';
    this.blockedUntil = blockedUntil;
    this.reason = reason;
  }
}

/**
 * Thrown when a soft veto requires acknowledgment
 */
export class AckRequiredError extends NovaError {
  public readonly ackToken: string;
  public readonly requiredText: string;
  public readonly expiresAt: string;

  constructor(ackToken: string, requiredText: string, expiresAt: string, reason?: string) {
    super(
      reason ?? 'This action requires explicit acknowledgment',
      'ACK_REQUIRED',
      200,
      { ackToken, requiredText, expiresAt }
    );
    this.name = 'AckRequiredError';
    this.ackToken = ackToken;
    this.requiredText = requiredText;
    this.expiresAt = expiresAt;
  }
}

/**
 * Thrown when an action is stopped by a hard veto
 */
export class StoppedError extends NovaError {
  public readonly reason: string;

  constructor(reason: string) {
    super(`Action stopped: ${reason}`, 'ACTION_STOPPED', 200, { reason });
    this.name = 'StoppedError';
    this.reason = reason;
  }
}

/**
 * Thrown when a request times out
 */
export class TimeoutError extends NovaError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, 'TIMEOUT', undefined, { timeoutMs });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when a network error occurs
 */
export class NetworkError extends NovaError {
  public readonly originalError?: Error;

  constructor(message: string = 'Network error', originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, { 
      originalMessage: originalError?.message 
    });
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

/**
 * Thrown when the server returns an unexpected error
 */
export class ServerError extends NovaError {
  constructor(message: string = 'Internal server error', statusCode: number = 500) {
    super(message, 'SERVER_ERROR', statusCode);
    this.name = 'ServerError';
  }
}

/**
 * Thrown when streaming is interrupted
 */
export class StreamError extends NovaError {
  constructor(message: string = 'Stream error') {
    super(message, 'STREAM_ERROR');
    this.name = 'StreamError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if an error is a NovaError
 */
export function isNovaError(error: unknown): error is NovaError {
  return error instanceof NovaError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof NetworkError) return true;
  if (error instanceof RateLimitError) return true;
  if (error instanceof ServerError && error.statusCode && error.statusCode >= 500) return true;
  return false;
}

/**
 * Create appropriate error from HTTP response
 */
export async function createErrorFromResponse(response: Response): Promise<NovaError> {
  let body: ApiError | undefined;
  
  try {
    body = await response.json() as ApiError;
  } catch {
    // Response body isn't JSON
  }

  const message = body?.error ?? response.statusText ?? 'Unknown error';
  const code = body?.code ?? 'HTTP_ERROR';

  switch (response.status) {
    case 400:
      return new ValidationError(message, body?.details as Record<string, string[]> | undefined);
    case 401:
      return new AuthenticationError(message);
    case 403:
      if (code === 'USER_BLOCKED') {
        return new BlockedError(message);
      }
      return new AuthorizationError(message);
    case 404:
      return new NotFoundError('Resource', undefined);
    case 429:
      const retryAfter = response.headers.get('Retry-After');
      return new RateLimitError(retryAfter ? parseInt(retryAfter, 10) : undefined);
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, response.status);
    default:
      return new NovaError(message, code, response.status, body?.details);
  }
}
