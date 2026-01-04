// ═══════════════════════════════════════════════════════════════════════════════
// PII REDACTION TESTS — Sensitive Data Protection
// NovaOS Observability Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  FULL_REDACT_FIELDS,
  PARTIAL_REDACT_FIELDS,
  REDACTED,
  redact,
  redactEmail,
  redactPhone,
  redactCreditCard,
  redactSSN,
  getPinoRedactPaths,
  getPinoRedactConfig,
  shouldRedact,
  redactString$,
  createRedactor,
  type RedactionOptions,
} from '../../../observability/logging/redaction.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Redaction Constants', () => {
  describe('FULL_REDACT_FIELDS', () => {
    it('should include authentication fields', () => {
      expect(FULL_REDACT_FIELDS.has('password')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('secret')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('token')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('apikey')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('authorization')).toBe(true);
    });

    it('should include encryption fields', () => {
      expect(FULL_REDACT_FIELDS.has('encryptionkey')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('salt')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('iv')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('nonce')).toBe(true);
    });

    it('should include session fields', () => {
      expect(FULL_REDACT_FIELDS.has('sessionid')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('cookie')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('jwt')).toBe(true);
    });

    it('should include financial fields', () => {
      expect(FULL_REDACT_FIELDS.has('cvv')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('pin')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('accountnumber')).toBe(true);
    });

    it('should include personal identity fields', () => {
      expect(FULL_REDACT_FIELDS.has('ssn')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('passport')).toBe(true);
      expect(FULL_REDACT_FIELDS.has('driverslicense')).toBe(true);
    });
  });

  describe('PARTIAL_REDACT_FIELDS', () => {
    it('should include email fields', () => {
      expect(PARTIAL_REDACT_FIELDS.has('email')).toBe(true);
      expect(PARTIAL_REDACT_FIELDS.has('emailaddress')).toBe(true);
    });

    it('should include phone fields', () => {
      expect(PARTIAL_REDACT_FIELDS.has('phone')).toBe(true);
      expect(PARTIAL_REDACT_FIELDS.has('phonenumber')).toBe(true);
      expect(PARTIAL_REDACT_FIELDS.has('mobile')).toBe(true);
    });
  });

  describe('REDACTED', () => {
    it('should be [REDACTED]', () => {
      expect(REDACTED).toBe('[REDACTED]');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PARTIAL REDACTION HELPERS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Partial Redaction Helpers', () => {
  describe('redactEmail()', () => {
    it('should redact email preserving first char and domain', () => {
      expect(redactEmail('john@example.com')).toBe('j***@example.com');
      expect(redactEmail('alice@test.org')).toBe('a***@test.org');
    });

    it('should handle single character local part', () => {
      expect(redactEmail('a@example.com')).toBe('*@example.com');
    });

    it('should return REDACTED for invalid email', () => {
      expect(redactEmail('notanemail')).toBe(REDACTED);
    });

    it('should handle long local parts', () => {
      expect(redactEmail('verylongemail@domain.com')).toBe('v***@domain.com');
    });
  });

  describe('redactPhone()', () => {
    it('should show only last 4 digits', () => {
      expect(redactPhone('555-123-4567')).toBe('***-***-4567');
      expect(redactPhone('+1-555-123-4567')).toBe('***-***-4567');
    });

    it('should handle various formats', () => {
      expect(redactPhone('(555) 123-4567')).toBe('***-***-4567');
      expect(redactPhone('5551234567')).toBe('***-***-4567');
    });

    it('should return REDACTED for short numbers', () => {
      expect(redactPhone('123')).toBe(REDACTED);
    });
  });

  describe('redactCreditCard()', () => {
    it('should show only last 4 digits', () => {
      expect(redactCreditCard('4111111111111111')).toBe('****-****-****-1111');
      expect(redactCreditCard('4111-1111-1111-1111')).toBe('****-****-****-1111');
    });

    it('should handle spaces', () => {
      expect(redactCreditCard('4111 1111 1111 1111')).toBe('****-****-****-1111');
    });

    it('should return REDACTED for short numbers', () => {
      expect(redactCreditCard('123')).toBe(REDACTED);
    });
  });

  describe('redactSSN()', () => {
    it('should show only last 4 digits', () => {
      expect(redactSSN('123-45-6789')).toBe('***-**-6789');
      expect(redactSSN('123456789')).toBe('***-**-6789');
    });

    it('should return REDACTED for short numbers', () => {
      expect(redactSSN('123')).toBe(REDACTED);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN REDACTION FUNCTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('redact()', () => {
  describe('Full Redaction by Field Name', () => {
    it('should fully redact password fields', () => {
      const data = { password: 'secret123', user: 'john' };
      const result = redact(data);
      
      expect(result.password).toBe(REDACTED);
      expect(result.user).toBe('john');
    });

    it('should fully redact token fields', () => {
      const data = { token: 'abc123', access_token: 'xyz789' };
      const result = redact(data);
      
      expect(result.token).toBe(REDACTED);
      expect(result.access_token).toBe(REDACTED);
    });

    it('should fully redact API keys', () => {
      const data = { apiKey: 'sk-1234', api_key: 'pk-5678' };
      const result = redact(data);
      
      expect(result.apiKey).toBe(REDACTED);
      expect(result.api_key).toBe(REDACTED);
    });

    it('should handle case insensitivity', () => {
      const data = { PASSWORD: 'secret', Token: 'abc' };
      const result = redact(data);
      
      expect(result.PASSWORD).toBe(REDACTED);
      expect(result.Token).toBe(REDACTED);
    });

    it('should handle underscores and hyphens', () => {
      const data = { api_key: 'key1', 'api-key': 'key2' };
      const result = redact(data);
      
      expect(result.api_key).toBe(REDACTED);
      // Note: api-key becomes apikey when normalized
    });
  });

  describe('Partial Redaction by Field Name', () => {
    it('should partially redact email fields', () => {
      const data = { email: 'john@example.com', name: 'John' };
      const result = redact(data);
      
      expect(result.email).toBe('j***@example.com');
      expect(result.name).toBe('John');
    });

    it('should partially redact phone fields', () => {
      const data = { phone: '555-123-4567', phoneNumber: '555-987-6543' };
      const result = redact(data);
      
      expect(result.phone).toBe('***-***-4567');
      expect(result.phoneNumber).toBe('***-***-6543');
    });
  });

  describe('Pattern Detection', () => {
    it('should detect and redact JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const data = { someField: jwt };
      const result = redact(data);
      
      expect(result.someField).toBe(REDACTED);
    });

    it('should detect and redact API key patterns', () => {
      const data = { key: 'sk-1234567890abcdefghijklmnop' };
      const result = redact(data);
      
      expect(result.key).toBe(REDACTED);
    });

    it('should detect and partially redact credit cards', () => {
      const data = { payment: '4111111111111111' };
      const result = redact(data);
      
      expect(result.payment).toBe('****-****-****-1111');
    });

    it('should detect and partially redact emails in values', () => {
      const data = { contact: 'user@domain.com' };
      const result = redact(data);
      
      expect(result.contact).toBe('u***@domain.com');
    });

    it('should detect and partially redact phone numbers', () => {
      const data = { contact: '555-123-4567' };
      const result = redact(data);
      
      expect(result.contact).toBe('***-***-4567');
    });

    it('should detect and partially redact SSNs', () => {
      const data = { id: '123-45-6789' };
      const result = redact(data);
      
      expect(result.id).toBe('***-**-6789');
    });
  });

  describe('Nested Objects', () => {
    it('should redact nested objects', () => {
      const data = {
        user: {
          name: 'John',
          password: 'secret',
          profile: {
            email: 'john@test.com',
          },
        },
      };
      const result = redact(data);
      
      expect(result.user.name).toBe('John');
      expect(result.user.password).toBe(REDACTED);
      expect(result.user.profile.email).toBe('j***@test.com');
    });

    it('should respect maxDepth option', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              password: 'secret',
            },
          },
        },
      };
      
      const result = redact(data, { maxDepth: 2 });
      
      // Should not redact beyond depth 2
      expect(result.level1.level2.level3.password).toBe('secret');
    });
  });

  describe('Arrays', () => {
    it('should redact values in arrays', () => {
      const data = {
        emails: ['alice@test.com', 'bob@test.com'],
      };
      const result = redact(data);
      
      // Pattern detection should find emails and partially redact them
      // Email format: first char + *** + domain
      expect(result.emails[0]).toBe('a***@test.com');
      expect(result.emails[1]).toBe('b***@test.com');
    });

    it('should redact objects in arrays', () => {
      const data = {
        users: [
          { name: 'Alice', password: 'pass1' },
          { name: 'Bob', password: 'pass2' },
        ],
      };
      const result = redact(data);
      
      expect(result.users[0].name).toBe('Alice');
      expect(result.users[0].password).toBe(REDACTED);
      expect(result.users[1].password).toBe(REDACTED);
    });
  });

  describe('Options', () => {
    it('should disable redaction when enabled=false', () => {
      const data = { password: 'secret' };
      const result = redact(data, { enabled: false });
      
      expect(result.password).toBe('secret');
    });

    it('should use custom placeholder', () => {
      const data = { password: 'secret' };
      const result = redact(data, { placeholder: '***' });
      
      expect(result.password).toBe('***');
    });

    it('should add additional full redact fields', () => {
      const data = { customSecret: 'value', other: 'safe' };
      const result = redact(data, { additionalFullRedactFields: ['customSecret'] });
      
      expect(result.customSecret).toBe(REDACTED);
      expect(result.other).toBe('safe');
    });

    it('should add additional partial redact fields', () => {
      // For custom fields not containing 'email' in name, 
      // default partial redaction shows: first char + *** + last char
      const data = { customField: 'john@test.com' };
      const result = redact(data, { additionalPartialRedactFields: ['customField'] });
      
      // Default partial redaction: first + *** + last = 'j***m'
      expect(result.customField).toBe('j***m');
    });

    it('should disable pattern detection', () => {
      const data = { someField: '4111111111111111' };
      const result = redact(data, { detectPatterns: false });
      
      expect(result.someField).toBe('4111111111111111');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const data = { password: null, name: 'John' };
      const result = redact(data);
      
      expect(result.password).toBeNull();
      expect(result.name).toBe('John');
    });

    it('should handle undefined values', () => {
      const data = { password: undefined, name: 'John' };
      const result = redact(data);
      
      expect(result.password).toBeUndefined();
    });

    it('should handle primitive inputs', () => {
      expect(redact('string')).toBe('string');
      expect(redact(123)).toBe(123);
      expect(redact(true)).toBe(true);
      expect(redact(null)).toBeNull();
    });

    it('should handle empty objects', () => {
      expect(redact({})).toEqual({});
    });

    it('should handle empty arrays', () => {
      expect(redact([])).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PINO INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Pino Integration', () => {
  describe('getPinoRedactPaths()', () => {
    it('should return array of paths', () => {
      const paths = getPinoRedactPaths();
      
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should include common sensitive paths', () => {
      const paths = getPinoRedactPaths();
      
      expect(paths).toContain('password');
      expect(paths).toContain('token');
      expect(paths).toContain('req.headers.authorization');
      expect(paths).toContain('req.body.password');
    });

    it('should include wildcard paths', () => {
      const paths = getPinoRedactPaths();
      
      expect(paths).toContain('*.password');
      expect(paths).toContain('*.secret');
    });
  });

  describe('getPinoRedactConfig()', () => {
    it('should return config object with paths and censor', () => {
      const config = getPinoRedactConfig();
      
      expect(config.paths).toBeDefined();
      expect(Array.isArray(config.paths)).toBe(true);
      expect(config.censor).toBe(REDACTED);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Utility Functions', () => {
  describe('shouldRedact()', () => {
    it('should return true for sensitive patterns', () => {
      expect(shouldRedact('john@example.com')).toBe(true);
      expect(shouldRedact('555-123-4567')).toBe(true);
      expect(shouldRedact('4111111111111111')).toBe(true);
      expect(shouldRedact('123-45-6789')).toBe(true);
    });

    it('should return false for non-sensitive values', () => {
      expect(shouldRedact('hello world')).toBe(false);
      expect(shouldRedact('12345')).toBe(false);
      expect(shouldRedact('normal text')).toBe(false);
    });

    it('should detect JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature123456';
      expect(shouldRedact(jwt)).toBe(true);
    });
  });

  describe('redactString$()', () => {
    it('should redact sensitive strings', () => {
      expect(redactString$('john@example.com')).toBe('j***@example.com');
      expect(redactString$('555-123-4567')).toBe('***-***-4567');
    });

    it('should return non-sensitive strings unchanged', () => {
      expect(redactString$('hello')).toBe('hello');
      expect(redactString$('normal text')).toBe('normal text');
    });

    it('should respect enabled option', () => {
      expect(redactString$('john@example.com', { enabled: false })).toBe('john@example.com');
    });
  });

  describe('createRedactor()', () => {
    it('should create a configured redaction function', () => {
      const customRedactor = createRedactor({ placeholder: '***HIDDEN***' });
      
      const result = customRedactor({ password: 'secret' });
      
      expect(result.password).toBe('***HIDDEN***');
    });

    it('should preserve options across calls', () => {
      const redactor = createRedactor({ additionalFullRedactFields: ['custom'] });
      
      const result1 = redactor({ custom: 'value1' });
      const result2 = redactor({ custom: 'value2' });
      
      expect(result1.custom).toBe(REDACTED);
      expect(result2.custom).toBe(REDACTED);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// LUHN VALIDATION TESTS (Credit Card Detection)
// ─────────────────────────────────────────────────────────────────────────────────

describe('Credit Card Detection (Luhn)', () => {
  it('should detect valid credit card numbers', () => {
    // Valid test card numbers
    const validCards = [
      '4111111111111111', // Visa
      '5500000000000004', // Mastercard
      '340000000000009',  // Amex (15 digits)
    ];
    
    for (const card of validCards) {
      const result = redact({ num: card });
      expect(result.num).toMatch(/^\*{4}-\*{4}-\*{4}-\d{4}$/);
    }
  });

  it('should not redact invalid credit card numbers', () => {
    // Numbers that look like credit cards but fail Luhn
    const invalidCards = [
      '4111111111111112', // Invalid checksum
      '1234567890123456', // Random digits
    ];
    
    for (const card of invalidCards) {
      const result = redact({ num: card });
      // Should not be redacted as credit card
      expect(result.num).toBe(card);
    }
  });
});
