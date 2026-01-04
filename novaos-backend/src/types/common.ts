// ═══════════════════════════════════════════════════════════════════════════════
// COMMON UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export type Nullable<T> = T | null;
export type Maybe<T> = T | null | undefined;

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message ?? 'Expected value to be defined');
  }
}

export function exhaustive(value: never, message?: string): never {
  throw new Error(message ?? `Unhandled case: ${JSON.stringify(value)}`);
}
