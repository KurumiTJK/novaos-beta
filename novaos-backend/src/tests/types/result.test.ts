// ═══════════════════════════════════════════════════════════════════════════════
// RESULT / APP ERROR TESTS
// NovaOS Types Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  type AppError,
  appError,
  ErrorCode,
  type ErrorCode as ErrorCodeType,
} from '../../types/result.js';

// ─────────────────────────────────────────────────────────────────────────────────
// appError TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('appError()', () => {
  it('should create an error with code and message', () => {
    const error = appError('TEST_ERROR', 'Something went wrong');
    
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Something went wrong');
    expect(error.cause).toBeUndefined();
    expect(error.context).toBeUndefined();
  });

  it('should create an error with cause', () => {
    const originalError = new Error('Original error');
    const error = appError('WRAPPED_ERROR', 'Wrapped message', {
      cause: originalError,
    });
    
    expect(error.code).toBe('WRAPPED_ERROR');
    expect(error.message).toBe('Wrapped message');
    expect(error.cause).toBe(originalError);
    expect(error.cause?.message).toBe('Original error');
  });

  it('should create an error with context', () => {
    const error = appError('CONTEXT_ERROR', 'Error with context', {
      context: {
        userId: 'user-123',
        requestId: 'req-456',
        attemptCount: 3,
      },
    });
    
    expect(error.code).toBe('CONTEXT_ERROR');
    expect(error.message).toBe('Error with context');
    expect(error.context).toEqual({
      userId: 'user-123',
      requestId: 'req-456',
      attemptCount: 3,
    });
  });

  it('should create an error with both cause and context', () => {
    const originalError = new Error('Database connection failed');
    const error = appError('DB_ERROR', 'Failed to fetch user', {
      cause: originalError,
      context: {
        userId: 'user-789',
        operation: 'findById',
      },
    });
    
    expect(error.code).toBe('DB_ERROR');
    expect(error.message).toBe('Failed to fetch user');
    expect(error.cause).toBe(originalError);
    expect(error.context).toEqual({
      userId: 'user-789',
      operation: 'findById',
    });
  });

  it('should handle empty options object', () => {
    const error = appError('EMPTY_OPTIONS', 'Test message', {});
    
    expect(error.code).toBe('EMPTY_OPTIONS');
    expect(error.message).toBe('Test message');
    expect(error.cause).toBeUndefined();
    expect(error.context).toBeUndefined();
  });

  it('should handle undefined options', () => {
    const error = appError('NO_OPTIONS', 'Test message', undefined);
    
    expect(error.code).toBe('NO_OPTIONS');
    expect(error.message).toBe('Test message');
    expect(error.cause).toBeUndefined();
    expect(error.context).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ErrorCode TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ErrorCode', () => {
  it('should have VALIDATION_ERROR', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
  });

  it('should have INVALID_INPUT', () => {
    expect(ErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
  });

  it('should have NOT_FOUND', () => {
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
  });

  it('should have USER_NOT_FOUND', () => {
    expect(ErrorCode.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
  });

  it('should have UNAUTHORIZED', () => {
    expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
  });

  it('should have FORBIDDEN', () => {
    expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
  });

  it('should have RATE_LIMITED', () => {
    expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
  });

  it('should have PROVIDER_ERROR', () => {
    expect(ErrorCode.PROVIDER_ERROR).toBe('PROVIDER_ERROR');
  });

  it('should have TIMEOUT', () => {
    expect(ErrorCode.TIMEOUT).toBe('TIMEOUT');
  });

  it('should have NETWORK_ERROR', () => {
    expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
  });

  it('should have INTERNAL_ERROR', () => {
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });

  it('should have CONFIGURATION_ERROR', () => {
    expect(ErrorCode.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
  });

  it('should contain all expected error codes', () => {
    const expectedCodes = [
      'VALIDATION_ERROR',
      'INVALID_INPUT',
      'NOT_FOUND',
      'USER_NOT_FOUND',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'RATE_LIMITED',
      'PROVIDER_ERROR',
      'TIMEOUT',
      'NETWORK_ERROR',
      'INTERNAL_ERROR',
      'CONFIGURATION_ERROR',
    ];
    
    const actualCodes = Object.values(ErrorCode);
    expect(actualCodes).toEqual(expect.arrayContaining(expectedCodes));
    expect(actualCodes.length).toBe(expectedCodes.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// AppError INTERFACE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AppError Interface', () => {
  it('should be readonly', () => {
    const error: AppError = appError('TEST', 'Test message');
    
    // These properties should be readonly (compile-time check)
    // At runtime, we verify the structure
    expect(Object.keys(error)).toContain('code');
    expect(Object.keys(error)).toContain('message');
  });

  it('should work with standard ErrorCode values', () => {
    const error = appError(ErrorCode.NOT_FOUND, 'Resource not found');
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should work with custom error codes', () => {
    const error = appError('CUSTOM_ERROR_CODE', 'Custom error');
    expect(error.code).toBe('CUSTOM_ERROR_CODE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Integration', () => {
  it('should work in error handling flow', () => {
    const processRequest = (userId: string | null): AppError | { success: true } => {
      if (!userId) {
        return appError(ErrorCode.VALIDATION_ERROR, 'User ID is required', {
          context: { field: 'userId' },
        });
      }
      
      if (userId === 'blocked-user') {
        return appError(ErrorCode.FORBIDDEN, 'User is blocked', {
          context: { userId },
        });
      }
      
      return { success: true };
    };

    const result1 = processRequest(null);
    expect('code' in result1).toBe(true);
    if ('code' in result1) {
      expect(result1.code).toBe('VALIDATION_ERROR');
    }

    const result2 = processRequest('blocked-user');
    expect('code' in result2).toBe(true);
    if ('code' in result2) {
      expect(result2.code).toBe('FORBIDDEN');
    }

    const result3 = processRequest('valid-user');
    expect('success' in result3).toBe(true);
  });

  it('should support error chaining', () => {
    const lowLevelError = new Error('Connection refused');
    
    const dbError = appError(ErrorCode.NETWORK_ERROR, 'Database connection failed', {
      cause: lowLevelError,
      context: { host: 'localhost', port: 5432 },
    });
    
    const apiError = appError(ErrorCode.INTERNAL_ERROR, 'Failed to process request', {
      cause: dbError.cause,
      context: {
        ...dbError.context,
        endpoint: '/api/users',
      },
    });
    
    expect(apiError.code).toBe('INTERNAL_ERROR');
    expect(apiError.context).toEqual({
      host: 'localhost',
      port: 5432,
      endpoint: '/api/users',
    });
  });

  it('should work with try-catch patterns', () => {
    const riskyOperation = (): void => {
      throw new Error('Something broke');
    };

    let capturedError: AppError | null = null;

    try {
      riskyOperation();
    } catch (e) {
      capturedError = appError(ErrorCode.INTERNAL_ERROR, 'Operation failed', {
        cause: e instanceof Error ? e : undefined,
        context: { operation: 'riskyOperation' },
      });
    }

    expect(capturedError).not.toBeNull();
    expect(capturedError?.code).toBe('INTERNAL_ERROR');
    expect(capturedError?.cause?.message).toBe('Something broke');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('should handle empty string code', () => {
    const error = appError('', 'Empty code error');
    expect(error.code).toBe('');
  });

  it('should handle empty string message', () => {
    const error = appError('ERROR', '');
    expect(error.message).toBe('');
  });

  it('should handle empty context object', () => {
    const error = appError('ERROR', 'Test', { context: {} });
    expect(error.context).toEqual({});
  });

  it('should handle nested context objects', () => {
    const error = appError('ERROR', 'Test', {
      context: {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      },
    });
    expect((error.context as any).level1.level2.level3).toBe('deep value');
  });

  it('should handle context with arrays', () => {
    const error = appError('ERROR', 'Test', {
      context: {
        ids: [1, 2, 3],
        messages: ['a', 'b', 'c'],
      },
    });
    expect((error.context as any).ids).toEqual([1, 2, 3]);
    expect((error.context as any).messages).toEqual(['a', 'b', 'c']);
  });

  it('should handle very long error messages', () => {
    const longMessage = 'x'.repeat(10000);
    const error = appError('ERROR', longMessage);
    expect(error.message.length).toBe(10000);
  });

  it('should handle special characters in code', () => {
    const error = appError('ERROR_WITH_SPECIAL_CHARS_!@#$%', 'Test');
    expect(error.code).toBe('ERROR_WITH_SPECIAL_CHARS_!@#$%');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE SAFETY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Safety', () => {
  it('ErrorCode type should be string literal union', () => {
    // This verifies the type works at runtime
    const code: ErrorCodeType = ErrorCode.NOT_FOUND;
    expect(typeof code).toBe('string');
  });

  it('should allow ErrorCode values as appError code parameter', () => {
    // All these should compile and work
    const errors: AppError[] = [
      appError(ErrorCode.VALIDATION_ERROR, 'Validation failed'),
      appError(ErrorCode.NOT_FOUND, 'Not found'),
      appError(ErrorCode.UNAUTHORIZED, 'Unauthorized'),
      appError(ErrorCode.INTERNAL_ERROR, 'Internal error'),
    ];

    expect(errors.length).toBe(4);
    expect(errors.every(e => typeof e.code === 'string')).toBe(true);
  });
});
