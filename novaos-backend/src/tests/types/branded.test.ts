// ═══════════════════════════════════════════════════════════════════════════════
// BRANDED TYPES TESTS — Compile-Time Type Safety
// NovaOS Types Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import {
  type UserId,
  type RequestId,
  type CorrelationId,
  type Timestamp,
  createUserId,
  createRequestId,
  createCorrelationId,
  createTimestamp,
} from '../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// createUserId TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createUserId()', () => {
  it('should create a UserId with provided value', () => {
    const userId = createUserId('user-123');
    expect(userId).toBe('user-123');
  });

  it('should generate a UUID-based UserId when no value provided', () => {
    const userId = createUserId();
    expect(userId).toMatch(/^user-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should generate unique UserIds on each call', () => {
    const userId1 = createUserId();
    const userId2 = createUserId();
    expect(userId1).not.toBe(userId2);
  });

  it('should preserve custom user ID formats', () => {
    const customId = 'custom-format-id-456';
    const userId = createUserId(customId);
    expect(userId).toBe(customId);
  });

  it('should handle empty string as valid input', () => {
    const userId = createUserId('');
    // Empty string is NOT nullish, so ?? passes it through
    expect(userId).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// createRequestId TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createRequestId()', () => {
  it('should create a RequestId with provided value', () => {
    const requestId = createRequestId('req-abc-123');
    expect(requestId).toBe('req-abc-123');
  });

  it('should generate a UUID-based RequestId when no value provided', () => {
    const requestId = createRequestId();
    expect(requestId).toMatch(/^req-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should generate unique RequestIds on each call', () => {
    const requestId1 = createRequestId();
    const requestId2 = createRequestId();
    expect(requestId1).not.toBe(requestId2);
  });

  it('should preserve custom request ID formats', () => {
    const customId = 'my-custom-request-id';
    const requestId = createRequestId(customId);
    expect(requestId).toBe(customId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// createCorrelationId TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createCorrelationId()', () => {
  it('should create a CorrelationId with provided value', () => {
    const correlationId = createCorrelationId('corr-xyz-789');
    expect(correlationId).toBe('corr-xyz-789');
  });

  it('should generate a UUID-based CorrelationId when no value provided', () => {
    const correlationId = createCorrelationId();
    expect(correlationId).toMatch(/^corr-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should generate unique CorrelationIds on each call', () => {
    const correlationId1 = createCorrelationId();
    const correlationId2 = createCorrelationId();
    expect(correlationId1).not.toBe(correlationId2);
  });

  it('should preserve custom correlation ID formats', () => {
    const customId = 'trace-id-from-external-system';
    const correlationId = createCorrelationId(customId);
    expect(correlationId).toBe(customId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// createTimestamp TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('createTimestamp()', () => {
  it('should create a Timestamp from provided Date', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    const timestamp = createTimestamp(date);
    expect(timestamp).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should generate current timestamp when no date provided', () => {
    const before = new Date().toISOString();
    const timestamp = createTimestamp();
    const after = new Date().toISOString();
    
    // Timestamp should be between before and after
    expect(timestamp >= before).toBe(true);
    expect(timestamp <= after).toBe(true);
  });

  it('should return ISO 8601 format', () => {
    const timestamp = createTimestamp();
    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should handle different date inputs', () => {
    const date1 = new Date('2020-06-15T00:00:00.000Z');
    const date2 = new Date('1999-12-31T23:59:59.999Z');
    
    expect(createTimestamp(date1)).toBe('2020-06-15T00:00:00.000Z');
    expect(createTimestamp(date2)).toBe('1999-12-31T23:59:59.999Z');
  });

  it('should handle epoch date', () => {
    const epochDate = new Date(0);
    const timestamp = createTimestamp(epochDate);
    expect(timestamp).toBe('1970-01-01T00:00:00.000Z');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE SAFETY TESTS (Runtime behavior verification)
// ─────────────────────────────────────────────────────────────────────────────────

describe('Branded Type Runtime Behavior', () => {
  it('UserId should be usable as string', () => {
    const userId: UserId = createUserId('user-test');
    const str: string = userId; // Should work at runtime
    expect(str).toBe('user-test');
    expect(typeof userId).toBe('string');
  });

  it('RequestId should be usable as string', () => {
    const requestId: RequestId = createRequestId('req-test');
    const str: string = requestId;
    expect(str).toBe('req-test');
    expect(typeof requestId).toBe('string');
  });

  it('CorrelationId should be usable as string', () => {
    const correlationId: CorrelationId = createCorrelationId('corr-test');
    const str: string = correlationId;
    expect(str).toBe('corr-test');
    expect(typeof correlationId).toBe('string');
  });

  it('Timestamp should be usable as string', () => {
    const timestamp: Timestamp = createTimestamp(new Date('2024-01-01T00:00:00.000Z'));
    const str: string = timestamp;
    expect(str).toBe('2024-01-01T00:00:00.000Z');
    expect(typeof timestamp).toBe('string');
  });

  it('branded types should work with string methods', () => {
    const userId = createUserId('USER-123');
    expect(userId.toLowerCase()).toBe('user-123');
    expect(userId.includes('USER')).toBe(true);
    expect(userId.length).toBe(8);
  });

  it('branded types should be comparable', () => {
    const userId1 = createUserId('user-123');
    const userId2 = createUserId('user-123');
    const userId3 = createUserId('user-456');
    
    expect(userId1 === userId2).toBe(true);
    expect(userId1 === userId3).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('should handle undefined input for createUserId', () => {
    const userId = createUserId(undefined);
    expect(userId).toMatch(/^user-/);
  });

  it('should handle undefined input for createRequestId', () => {
    const requestId = createRequestId(undefined);
    expect(requestId).toMatch(/^req-/);
  });

  it('should handle undefined input for createCorrelationId', () => {
    const correlationId = createCorrelationId(undefined);
    expect(correlationId).toMatch(/^corr-/);
  });

  it('should handle undefined input for createTimestamp', () => {
    const timestamp = createTimestamp(undefined);
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should handle special characters in IDs', () => {
    const specialId = 'user-with-special!@#$%chars';
    const userId = createUserId(specialId);
    expect(userId).toBe(specialId);
  });

  it('should handle very long IDs', () => {
    const longId = 'user-' + 'a'.repeat(1000);
    const userId = createUserId(longId);
    expect(userId).toBe(longId);
    expect(userId.length).toBe(1005);
  });
});
