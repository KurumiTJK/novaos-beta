// ═══════════════════════════════════════════════════════════════════════════════
// APP ERROR — Used by error-handler.ts
// ═══════════════════════════════════════════════════════════════════════════════

export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;
}

export function appError(
  code: string,
  message: string,
  options?: { cause?: Error; context?: Record<string, unknown> }
): AppError {
  return {
    code,
    message,
    cause: options?.cause,
    context: options?.context,
  };
}

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];
