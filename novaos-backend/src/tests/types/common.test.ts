// ═══════════════════════════════════════════════════════════════════════════════
// COMMON UTILITIES TESTS
// NovaOS Types Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  type Nullable,
  type Maybe,
  isDefined,
  isNullish,
  assertDefined,
  exhaustive,
} from '../../types/common.js';

// ─────────────────────────────────────────────────────────────────────────────────
// isDefined TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('isDefined()', () => {
  it('should return true for defined values', () => {
    expect(isDefined('hello')).toBe(true);
    expect(isDefined(0)).toBe(true);
    expect(isDefined(false)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined([])).toBe(true);
    expect(isDefined({})).toBe(true);
  });

  it('should return false for null', () => {
    expect(isDefined(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isDefined(undefined)).toBe(false);
  });

  it('should work as type guard', () => {
    const value: string | null | undefined = 'test';
    if (isDefined(value)) {
      // TypeScript should narrow type to string
      expect(value.toUpperCase()).toBe('TEST');
    }
  });

  it('should handle objects', () => {
    expect(isDefined({ key: 'value' })).toBe(true);
    expect(isDefined({ nested: { deep: true } })).toBe(true);
  });

  it('should handle arrays', () => {
    expect(isDefined([1, 2, 3])).toBe(true);
    expect(isDefined([])).toBe(true);
  });

  it('should handle NaN (NaN is defined)', () => {
    expect(isDefined(NaN)).toBe(true);
  });

  it('should handle Infinity', () => {
    expect(isDefined(Infinity)).toBe(true);
    expect(isDefined(-Infinity)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// isNullish TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('isNullish()', () => {
  it('should return true for null', () => {
    expect(isNullish(null)).toBe(true);
  });

  it('should return true for undefined', () => {
    expect(isNullish(undefined)).toBe(true);
  });

  it('should return false for defined values', () => {
    expect(isNullish('hello')).toBe(false);
    expect(isNullish(0)).toBe(false);
    expect(isNullish(false)).toBe(false);
    expect(isNullish('')).toBe(false);
    expect(isNullish([])).toBe(false);
    expect(isNullish({})).toBe(false);
  });

  it('should work as type guard', () => {
    const value: string | null | undefined = null;
    if (isNullish(value)) {
      // TypeScript should narrow type to null | undefined
      expect(value).toBeNull();
    }
  });

  it('should return false for falsy but defined values', () => {
    expect(isNullish(0)).toBe(false);
    expect(isNullish('')).toBe(false);
    expect(isNullish(false)).toBe(false);
    expect(isNullish(NaN)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// assertDefined TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('assertDefined()', () => {
  it('should not throw for defined values', () => {
    expect(() => assertDefined('hello')).not.toThrow();
    expect(() => assertDefined(0)).not.toThrow();
    expect(() => assertDefined(false)).not.toThrow();
    expect(() => assertDefined('')).not.toThrow();
    expect(() => assertDefined([])).not.toThrow();
    expect(() => assertDefined({})).not.toThrow();
  });

  it('should throw for null', () => {
    expect(() => assertDefined(null)).toThrow('Expected value to be defined');
  });

  it('should throw for undefined', () => {
    expect(() => assertDefined(undefined)).toThrow('Expected value to be defined');
  });

  it('should throw with custom message', () => {
    expect(() => assertDefined(null, 'User ID is required')).toThrow('User ID is required');
    expect(() => assertDefined(undefined, 'Config must be provided')).toThrow('Config must be provided');
  });

  it('should throw with empty string message when provided', () => {
    // Empty string is NOT nullish, so ?? passes it through
    expect(() => assertDefined(null, '')).toThrow('');
  });

  it('should work as assertion function', () => {
    const getValue = (): string | null => 'test';
    const value = getValue();
    assertDefined(value);
    // After assertion, TypeScript should know value is string
    expect(value.toUpperCase()).toBe('TEST');
  });

  it('should handle complex objects', () => {
    const obj = { nested: { value: 42 } };
    expect(() => assertDefined(obj)).not.toThrow();
    expect(() => assertDefined(obj.nested)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// exhaustive TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('exhaustive()', () => {
  it('should throw with default message', () => {
    // We need to cast to never to test this function
    const value = 'unexpected' as never;
    expect(() => exhaustive(value)).toThrow('Unhandled case: "unexpected"');
  });

  it('should throw with custom message', () => {
    const value = 'unknown' as never;
    expect(() => exhaustive(value, 'Invalid status type')).toThrow('Invalid status type');
  });

  it('should serialize object values in default message', () => {
    const value = { type: 'invalid' } as never;
    expect(() => exhaustive(value)).toThrow('Unhandled case: {"type":"invalid"}');
  });

  it('should handle number values', () => {
    const value = 999 as never;
    expect(() => exhaustive(value)).toThrow('Unhandled case: 999');
  });

  it('should handle boolean values', () => {
    const value = true as never;
    expect(() => exhaustive(value)).toThrow('Unhandled case: true');
  });

  it('should handle null value', () => {
    const value = null as never;
    expect(() => exhaustive(value)).toThrow('Unhandled case: null');
  });

  // Practical usage example with discriminated union
  it('should be used for exhaustive switch statements', () => {
    type Status = 'active' | 'inactive' | 'pending';
    
    const handleStatus = (status: Status): string => {
      switch (status) {
        case 'active':
          return 'Is active';
        case 'inactive':
          return 'Is inactive';
        case 'pending':
          return 'Is pending';
        default:
          // This ensures all cases are handled
          return exhaustive(status);
      }
    };

    expect(handleStatus('active')).toBe('Is active');
    expect(handleStatus('inactive')).toBe('Is inactive');
    expect(handleStatus('pending')).toBe('Is pending');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE TESTS (Compile-time verification at runtime)
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Definitions', () => {
  describe('Nullable<T>', () => {
    it('should allow T or null', () => {
      const value1: Nullable<string> = 'hello';
      const value2: Nullable<string> = null;
      
      expect(value1).toBe('hello');
      expect(value2).toBeNull();
    });

    it('should work with complex types', () => {
      interface User {
        id: number;
        name: string;
      }
      
      const user1: Nullable<User> = { id: 1, name: 'John' };
      const user2: Nullable<User> = null;
      
      expect(user1?.name).toBe('John');
      expect(user2).toBeNull();
    });
  });

  describe('Maybe<T>', () => {
    it('should allow T, null, or undefined', () => {
      const value1: Maybe<string> = 'hello';
      const value2: Maybe<string> = null;
      const value3: Maybe<string> = undefined;
      
      expect(value1).toBe('hello');
      expect(value2).toBeNull();
      expect(value3).toBeUndefined();
    });

    it('should work with complex types', () => {
      interface Config {
        timeout: number;
      }
      
      const config1: Maybe<Config> = { timeout: 5000 };
      const config2: Maybe<Config> = null;
      const config3: Maybe<Config> = undefined;
      
      expect(config1?.timeout).toBe(5000);
      expect(config2).toBeNull();
      expect(config3).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Integration', () => {
  it('should work together for value validation', () => {
    const processValue = (input: Maybe<string>): string => {
      if (isNullish(input)) {
        return 'default';
      }
      return input.toUpperCase();
    };

    expect(processValue('hello')).toBe('HELLO');
    expect(processValue(null)).toBe('default');
    expect(processValue(undefined)).toBe('default');
  });

  it('should work with assertDefined and isDefined', () => {
    const values: Maybe<number>[] = [1, null, 2, undefined, 3];
    
    const definedValues = values.filter(isDefined);
    expect(definedValues).toEqual([1, 2, 3]);
    
    // Each value is guaranteed to be defined
    definedValues.forEach(v => {
      expect(() => assertDefined(v)).not.toThrow();
    });
  });

  it('should handle real-world scenario', () => {
    interface ApiResponse {
      data: Maybe<{ id: number; name: string }>;
      error: Nullable<string>;
    }

    const handleResponse = (response: ApiResponse): string => {
      if (isDefined(response.error)) {
        return `Error: ${response.error}`;
      }
      
      if (isNullish(response.data)) {
        return 'No data';
      }
      
      assertDefined(response.data);
      return `User: ${response.data.name}`;
    };

    expect(handleResponse({ data: { id: 1, name: 'John' }, error: null })).toBe('User: John');
    expect(handleResponse({ data: null, error: 'Not found' })).toBe('Error: Not found');
    expect(handleResponse({ data: undefined, error: null })).toBe('No data');
  });
});
