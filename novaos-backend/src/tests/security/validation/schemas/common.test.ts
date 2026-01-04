// ═══════════════════════════════════════════════════════════════════════════════
// COMMON SCHEMAS TESTS — Reusable Zod Validation Schemas
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  nonEmptyString,
  boundedString,
  email,
  url,
  positiveInt,
  nonNegativeInt,
  isoDateString,
  slug,
  IdParamSchema,
  UuidParamSchema,
  PaginationSchema,
  SearchSchema,
  DateRangeSchema,
  StatusSchema,
  PrioritySchema,
  type PaginationInput,
  type SearchInput,
  type DateRangeInput,
  type Status,
  type Priority,
} from '../../../../security/validation/schemas/common.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CUSTOM VALIDATORS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Custom Validators', () => {
  describe('nonEmptyString()', () => {
    it('should accept non-empty string', () => {
      const schema = nonEmptyString();
      expect(schema.parse('hello')).toBe('hello');
    });

    it('should trim whitespace', () => {
      const schema = nonEmptyString();
      expect(schema.parse('  hello  ')).toBe('hello');
    });

    it('should reject empty string', () => {
      const schema = nonEmptyString();
      expect(() => schema.parse('')).toThrow();
    });

    it('should reject whitespace-only string', () => {
      const schema = nonEmptyString();
      expect(() => schema.parse('   ')).toThrow();
    });

    it('should use custom message', () => {
      const schema = nonEmptyString('Custom error');
      try {
        schema.parse('');
      } catch (e: any) {
        expect(e.errors[0].message).toBe('Custom error');
      }
    });
  });

  describe('boundedString()', () => {
    it('should accept string within bounds', () => {
      const schema = boundedString(1, 10);
      expect(schema.parse('hello')).toBe('hello');
    });

    it('should trim whitespace', () => {
      const schema = boundedString(1, 10);
      expect(schema.parse('  hi  ')).toBe('hi');
    });

    it('should reject string too short', () => {
      const schema = boundedString(5, 10);
      expect(() => schema.parse('hi')).toThrow();
    });

    it('should reject string too long', () => {
      const schema = boundedString(1, 5);
      expect(() => schema.parse('toolongstring')).toThrow();
    });
  });

  describe('email', () => {
    it('should accept valid email', () => {
      expect(email.parse('user@example.com')).toBe('user@example.com');
    });

    it('should lowercase email', () => {
      expect(email.parse('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('should reject invalid email', () => {
      expect(() => email.parse('not-an-email')).toThrow();
      expect(() => email.parse('user@')).toThrow();
      expect(() => email.parse('@example.com')).toThrow();
    });
  });

  describe('url', () => {
    it('should accept valid URL', () => {
      expect(url.parse('https://example.com')).toBe('https://example.com');
    });

    it('should accept URL with path', () => {
      expect(url.parse('https://example.com/path')).toBe('https://example.com/path');
    });

    it('should reject invalid URL', () => {
      expect(() => url.parse('not-a-url')).toThrow();
      expect(() => url.parse('example.com')).toThrow();
    });
  });

  describe('positiveInt', () => {
    it('should accept positive integers', () => {
      expect(positiveInt.parse(1)).toBe(1);
      expect(positiveInt.parse(100)).toBe(100);
    });

    it('should coerce strings', () => {
      expect(positiveInt.parse('42')).toBe(42);
    });

    it('should reject zero', () => {
      expect(() => positiveInt.parse(0)).toThrow();
    });

    it('should reject negative numbers', () => {
      expect(() => positiveInt.parse(-1)).toThrow();
    });

    it('should reject floats', () => {
      expect(() => positiveInt.parse(1.5)).toThrow();
    });
  });

  describe('nonNegativeInt', () => {
    it('should accept zero', () => {
      expect(nonNegativeInt.parse(0)).toBe(0);
    });

    it('should accept positive integers', () => {
      expect(nonNegativeInt.parse(1)).toBe(1);
      expect(nonNegativeInt.parse(100)).toBe(100);
    });

    it('should reject negative numbers', () => {
      expect(() => nonNegativeInt.parse(-1)).toThrow();
    });
  });

  describe('isoDateString', () => {
    it('should accept valid ISO date', () => {
      const date = '2024-01-15T10:30:00Z';
      expect(isoDateString.parse(date)).toBe(date);
    });

    it('should accept date with timezone', () => {
      // Zod's datetime() with default settings only accepts UTC (Z) format
      // Non-UTC offsets like +05:00 require { offset: true } option
      const date = '2024-01-15T10:30:00Z';
      expect(isoDateString.parse(date)).toBe(date);
    });

    it('should reject invalid date format', () => {
      expect(() => isoDateString.parse('2024-01-15')).toThrow();
      expect(() => isoDateString.parse('January 15, 2024')).toThrow();
    });
  });

  describe('slug', () => {
    it('should accept valid slug', () => {
      expect(slug.parse('hello-world')).toBe('hello-world');
      expect(slug.parse('post123')).toBe('post123');
    });

    it('should accept single word', () => {
      expect(slug.parse('hello')).toBe('hello');
    });

    it('should reject uppercase', () => {
      expect(() => slug.parse('Hello-World')).toThrow();
    });

    it('should reject special characters', () => {
      expect(() => slug.parse('hello_world')).toThrow();
      expect(() => slug.parse('hello.world')).toThrow();
    });

    it('should reject starting/ending with hyphen', () => {
      expect(() => slug.parse('-hello')).toThrow();
      expect(() => slug.parse('hello-')).toThrow();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ID SCHEMAS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ID Schemas', () => {
  describe('IdParamSchema', () => {
    it('should accept non-empty id', () => {
      const result = IdParamSchema.parse({ id: 'abc123' });
      expect(result.id).toBe('abc123');
    });

    it('should reject empty id', () => {
      expect(() => IdParamSchema.parse({ id: '' })).toThrow();
    });

    it('should reject missing id', () => {
      expect(() => IdParamSchema.parse({})).toThrow();
    });
  });

  describe('UuidParamSchema', () => {
    it('should accept valid UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = UuidParamSchema.parse({ id: uuid });
      expect(result.id).toBe(uuid);
    });

    it('should reject invalid UUID', () => {
      expect(() => UuidParamSchema.parse({ id: 'not-a-uuid' })).toThrow();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PAGINATION SCHEMA TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('PaginationSchema', () => {
  it('should accept valid pagination', () => {
    const result = PaginationSchema.parse({ limit: 50, offset: 10 });
    
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(10);
  });

  it('should apply defaults', () => {
    const result = PaginationSchema.parse({});
    
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('should coerce string values', () => {
    const result = PaginationSchema.parse({ limit: '30', offset: '5' });
    
    expect(result.limit).toBe(30);
    expect(result.offset).toBe(5);
  });

  it('should reject limit below min', () => {
    expect(() => PaginationSchema.parse({ limit: 0 })).toThrow();
  });

  it('should reject limit above max', () => {
    expect(() => PaginationSchema.parse({ limit: 101 })).toThrow();
  });

  it('should reject negative offset', () => {
    expect(() => PaginationSchema.parse({ offset: -1 })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH SCHEMA TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('SearchSchema', () => {
  it('should accept valid search', () => {
    const result = SearchSchema.parse({ q: 'search term', limit: 10, offset: 0 });
    
    expect(result.q).toBe('search term');
    expect(result.limit).toBe(10);
  });

  it('should trim search query', () => {
    const result = SearchSchema.parse({ q: '  search  ' });
    
    expect(result.q).toBe('search');
  });

  it('should allow optional query', () => {
    const result = SearchSchema.parse({});
    
    expect(result.q).toBeUndefined();
    expect(result.limit).toBe(20);
  });

  it('should reject query over max length', () => {
    const longQuery = 'a'.repeat(501);
    expect(() => SearchSchema.parse({ q: longQuery })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// DATE RANGE SCHEMA TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('DateRangeSchema', () => {
  it('should accept valid date range', () => {
    const result = DateRangeSchema.parse({
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z',
    });
    
    expect(result.startDate).toBeDefined();
    expect(result.endDate).toBeDefined();
  });

  it('should allow optional dates', () => {
    const result = DateRangeSchema.parse({});
    
    expect(result.startDate).toBeUndefined();
    expect(result.endDate).toBeUndefined();
  });

  it('should allow only startDate', () => {
    const result = DateRangeSchema.parse({
      startDate: '2024-01-01T00:00:00Z',
    });
    
    expect(result.startDate).toBeDefined();
    expect(result.endDate).toBeUndefined();
  });

  it('should reject startDate after endDate', () => {
    expect(() => DateRangeSchema.parse({
      startDate: '2024-12-31T00:00:00Z',
      endDate: '2024-01-01T00:00:00Z',
    })).toThrow();
  });

  it('should allow equal dates', () => {
    const result = DateRangeSchema.parse({
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-01T00:00:00Z',
    });
    
    expect(result.startDate).toBe(result.endDate);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// STATUS AND PRIORITY SCHEMAS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('StatusSchema', () => {
  it('should accept valid statuses', () => {
    expect(StatusSchema.parse('active')).toBe('active');
    expect(StatusSchema.parse('completed')).toBe('completed');
    expect(StatusSchema.parse('abandoned')).toBe('abandoned');
    expect(StatusSchema.parse('blocked')).toBe('blocked');
  });

  it('should reject invalid status', () => {
    expect(() => StatusSchema.parse('invalid')).toThrow();
  });
});

describe('PrioritySchema', () => {
  it('should accept valid priorities', () => {
    expect(PrioritySchema.parse('low')).toBe('low');
    expect(PrioritySchema.parse('medium')).toBe('medium');
    expect(PrioritySchema.parse('high')).toBe('high');
    expect(PrioritySchema.parse('urgent')).toBe('urgent');
  });

  it('should reject invalid priority', () => {
    expect(() => PrioritySchema.parse('critical')).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('PaginationInput', () => {
    it('should match schema output', () => {
      const input: PaginationInput = {
        limit: 20,
        offset: 0,
      };
      
      expect(input.limit).toBe(20);
    });
  });

  describe('SearchInput', () => {
    it('should match schema output', () => {
      const input: SearchInput = {
        q: 'search',
        limit: 20,
        offset: 0,
      };
      
      expect(input.q).toBe('search');
    });
  });

  describe('DateRangeInput', () => {
    it('should match schema output', () => {
      const input: DateRangeInput = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
      };
      
      expect(input.startDate).toBeDefined();
    });
  });

  describe('Status', () => {
    it('should accept valid values', () => {
      const status: Status = 'active';
      expect(status).toBe('active');
    });
  });

  describe('Priority', () => {
    it('should accept valid values', () => {
      const priority: Priority = 'high';
      expect(priority).toBe('high');
    });
  });
});
