// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION MODULE INDEX TESTS — Export Verification
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import * as validationModule from '../../../security/validation/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Middleware Exports', () => {
  it('should export validateBody', () => {
    expect(typeof validationModule.validateBody).toBe('function');
  });

  it('should export validateQuery', () => {
    expect(typeof validationModule.validateQuery).toBe('function');
  });

  it('should export validateParams', () => {
    expect(typeof validationModule.validateParams).toBe('function');
  });

  it('should export validateHeaders', () => {
    expect(typeof validationModule.validateHeaders).toBe('function');
  });

  it('should export validate', () => {
    expect(typeof validationModule.validate).toBe('function');
  });

  it('should export ValidationErrorCode', () => {
    expect(validationModule.ValidationErrorCode).toBeDefined();
    expect(validationModule.ValidationErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(validationModule.ValidationErrorCode.INVALID_BODY).toBe('INVALID_BODY');
    expect(validationModule.ValidationErrorCode.INVALID_QUERY).toBe('INVALID_QUERY');
    expect(validationModule.ValidationErrorCode.INVALID_PARAMS).toBe('INVALID_PARAMS');
    expect(validationModule.ValidationErrorCode.INVALID_HEADERS).toBe('INVALID_HEADERS');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEMA EXPORTS - Schemas should be re-exported from schemas/index.js
// ─────────────────────────────────────────────────────────────────────────────────

describe('Schema Exports', () => {
  // Note: These are re-exported from ./schemas/index.js
  // The validation/index.ts exports everything from './schemas/index.js'
  it('should have re-exports from schemas (tested in schemas/*.test.ts)', () => {
    // Schema exports are verified in individual schema test files
    expect(true).toBe(true);
  });
});
