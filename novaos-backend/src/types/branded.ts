// ═══════════════════════════════════════════════════════════════════════════════
// BRANDED TYPES — Compile-Time Type Safety
// ═══════════════════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────────
// BRAND TYPE
// ─────────────────────────────────────────────────────────────────────────────────

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

// ─────────────────────────────────────────────────────────────────────────────────
// ID TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type UserId = Brand<string, 'UserId'>;
export type RequestId = Brand<string, 'RequestId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type Timestamp = Brand<string, 'Timestamp'>;

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTRUCTORS
// ─────────────────────────────────────────────────────────────────────────────────

export function createUserId(value?: string): UserId {
  return (value ?? `user-${uuidv4()}`) as UserId;
}

export function createRequestId(value?: string): RequestId {
  return (value ?? `req-${uuidv4()}`) as RequestId;
}

export function createCorrelationId(value?: string): CorrelationId {
  return (value ?? `corr-${uuidv4()}`) as CorrelationId;
}

export function createTimestamp(date?: Date): Timestamp {
  return (date ?? new Date()).toISOString() as Timestamp;
}
