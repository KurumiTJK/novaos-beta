// ═══════════════════════════════════════════════════════════════════════════════
// URL SANITIZER TESTS — XSS Prevention Tests
// NovaOS Spark Engine — Phase 10: Spark Generation
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  isAllowedScheme,
  isBlockedScheme,
  extractScheme,
  isValidUrlStructure,
  sanitizeUrl,
  sanitizeDisplayUrl,
  formatDisplayUrl,
  sanitizeAndFormatUrl,
  sanitizeUrls,
  filterSafeUrls,
  hasSuspiciousEncoding,
  sanitizeUrlStrict,
} from '../url-sanitizer.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEME VALIDATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('isAllowedScheme', () => {
  it('should allow http:', () => {
    expect(isAllowedScheme('http:')).toBe(true);
  });

  it('should allow https:', () => {
    expect(isAllowedScheme('https:')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isAllowedScheme('HTTP:')).toBe(true);
    expect(isAllowedScheme('HTTPS:')).toBe(true);
    expect(isAllowedScheme('HtTpS:')).toBe(true);
  });

  it('should reject javascript:', () => {
    expect(isAllowedScheme('javascript:')).toBe(false);
  });

  it('should reject data:', () => {
    expect(isAllowedScheme('data:')).toBe(false);
  });

  it('should reject file:', () => {
    expect(isAllowedScheme('file:')).toBe(false);
  });

  it('should reject ftp:', () => {
    expect(isAllowedScheme('ftp:')).toBe(false);
  });
});

describe('isBlockedScheme', () => {
  it('should block javascript:', () => {
    expect(isBlockedScheme('javascript:')).toBe(true);
  });

  it('should block data:', () => {
    expect(isBlockedScheme('data:')).toBe(true);
  });

  it('should block vbscript:', () => {
    expect(isBlockedScheme('vbscript:')).toBe(true);
  });

  it('should block file:', () => {
    expect(isBlockedScheme('file:')).toBe(true);
  });

  it('should block about:', () => {
    expect(isBlockedScheme('about:')).toBe(true);
  });

  it('should block blob:', () => {
    expect(isBlockedScheme('blob:')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isBlockedScheme('JAVASCRIPT:')).toBe(true);
    expect(isBlockedScheme('JavaScript:')).toBe(true);
  });

  it('should not block http:', () => {
    expect(isBlockedScheme('http:')).toBe(false);
  });

  it('should not block https:', () => {
    expect(isBlockedScheme('https:')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXTRACT SCHEME TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('extractScheme', () => {
  it('should extract https:', () => {
    expect(extractScheme('https://example.com')).toBe('https:');
  });

  it('should extract http:', () => {
    expect(extractScheme('http://example.com')).toBe('http:');
  });

  it('should extract javascript:', () => {
    expect(extractScheme('javascript:alert(1)')).toBe('javascript:');
  });

  it('should return lowercase scheme', () => {
    expect(extractScheme('HTTPS://example.com')).toBe('https:');
  });

  it('should return null for no scheme', () => {
    expect(extractScheme('example.com')).toBeNull();
    expect(extractScheme('/path/to/file')).toBeNull();
  });

  it('should handle whitespace', () => {
    expect(extractScheme('  https://example.com  ')).toBe('https:');
  });

  it('should handle complex schemes', () => {
    expect(extractScheme('custom+scheme://test')).toBe('custom+scheme:');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// URL STRUCTURE VALIDATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('isValidUrlStructure', () => {
  it('should accept valid https URL', () => {
    expect(isValidUrlStructure('https://example.com')).toBe(true);
  });

  it('should accept valid http URL with path', () => {
    expect(isValidUrlStructure('http://example.com/path/to/resource')).toBe(true);
  });

  it('should accept URL with query params', () => {
    expect(isValidUrlStructure('https://example.com?foo=bar&baz=qux')).toBe(true);
  });

  it('should accept URL with fragment', () => {
    expect(isValidUrlStructure('https://example.com#section')).toBe(true);
  });

  it('should accept URL with port', () => {
    expect(isValidUrlStructure('https://example.com:8080/api')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidUrlStructure('not a url')).toBe(false);
    expect(isValidUrlStructure('://missing-scheme')).toBe(false);
  });

  it('should reject URLs without scheme', () => {
    expect(isValidUrlStructure('example.com')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SANITIZE URL TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('sanitizeUrl', () => {
  describe('valid URLs', () => {
    it('should accept https URL', () => {
      const result = sanitizeUrl('https://example.com');
      expect(result.safe).toBe(true);
      expect(result.sanitizedUrl).toBe('https://example.com');
    });

    it('should accept http URL', () => {
      const result = sanitizeUrl('http://example.com');
      expect(result.safe).toBe(true);
      expect(result.sanitizedUrl).toBe('http://example.com');
    });

    it('should trim whitespace', () => {
      const result = sanitizeUrl('  https://example.com  ');
      expect(result.safe).toBe(true);
      expect(result.sanitizedUrl).toBe('https://example.com');
    });

    it('should preserve path and query', () => {
      const url = 'https://example.com/path?query=value#hash';
      const result = sanitizeUrl(url);
      expect(result.safe).toBe(true);
      expect(result.sanitizedUrl).toBe(url);
    });
  });

  describe('blocked URLs', () => {
    it('should reject javascript: URLs', () => {
      const result = sanitizeUrl('javascript:alert(1)');
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('Blocked URL scheme');
    });

    it('should reject data: URLs', () => {
      const result = sanitizeUrl('data:text/html,<script>alert(1)</script>');
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('Blocked URL scheme');
    });

    it('should reject vbscript: URLs', () => {
      const result = sanitizeUrl('vbscript:msgbox("xss")');
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('Blocked URL scheme');
    });

    it('should reject file: URLs', () => {
      const result = sanitizeUrl('file:///etc/passwd');
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('Blocked URL scheme');
    });

    it('should reject about: URLs', () => {
      const result = sanitizeUrl('about:blank');
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('Blocked URL scheme');
    });
  });

  describe('invalid inputs', () => {
    it('should reject null', () => {
      const result = sanitizeUrl(null);
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('empty');
    });

    it('should reject undefined', () => {
      const result = sanitizeUrl(undefined);
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('empty');
    });

    it('should reject empty string', () => {
      const result = sanitizeUrl('');
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('empty');
    });

    it('should reject whitespace-only', () => {
      const result = sanitizeUrl('   ');
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('empty');
    });

    it('should reject URLs without scheme', () => {
      const result = sanitizeUrl('example.com');
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('no valid scheme');
    });

    it('should reject non-http/https schemes', () => {
      const result = sanitizeUrl('ftp://example.com');
      expect(result.safe).toBe(false);
      expect(result.rejectionReason).toContain('not allowed');
    });
  });

  describe('case sensitivity', () => {
    it('should handle uppercase schemes', () => {
      const result = sanitizeUrl('HTTPS://example.com');
      expect(result.safe).toBe(true);
    });

    it('should block uppercase javascript:', () => {
      const result = sanitizeUrl('JAVASCRIPT:alert(1)');
      expect(result.safe).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SANITIZE DISPLAY URL TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('sanitizeDisplayUrl', () => {
  it('should return sanitized URL for valid input', () => {
    expect(sanitizeDisplayUrl('https://example.com')).toBe('https://example.com');
  });

  it('should return undefined for invalid input', () => {
    expect(sanitizeDisplayUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('should return undefined for null', () => {
    expect(sanitizeDisplayUrl(null)).toBeUndefined();
  });

  it('should return undefined for undefined', () => {
    expect(sanitizeDisplayUrl(undefined)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// FORMAT DISPLAY URL TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('formatDisplayUrl', () => {
  it('should return URL unchanged if under max length', () => {
    const url = 'https://example.com';
    expect(formatDisplayUrl(url, 50)).toBe(url);
  });

  it('should truncate long URLs', () => {
    const url = 'https://example.com/very/long/path/to/some/resource/that/is/too/long';
    const result = formatDisplayUrl(url, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result).toContain('...');
  });

  it('should show domain for very long paths', () => {
    const url = 'https://example.com/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p';
    const result = formatDisplayUrl(url, 25);
    expect(result).toContain('example.com');
  });

  it('should handle URLs exactly at max length', () => {
    const url = 'https://ex.com';
    expect(formatDisplayUrl(url, 14)).toBe(url);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SANITIZE AND FORMAT URL TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('sanitizeAndFormatUrl', () => {
  it('should sanitize and format valid URL', () => {
    const result = sanitizeAndFormatUrl('https://example.com/path');
    expect(result).toBeDefined();
    expect(result).toContain('example.com');
  });

  it('should return undefined for invalid URL', () => {
    expect(sanitizeAndFormatUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('should truncate long URLs', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(100);
    const result = sanitizeAndFormatUrl(longUrl, 30);
    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// BATCH SANITIZATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('sanitizeUrls', () => {
  it('should sanitize multiple URLs', () => {
    const urls = [
      'https://example.com',
      'javascript:alert(1)',
      'http://safe.org',
    ];
    const results = sanitizeUrls(urls);
    
    expect(results).toHaveLength(3);
    expect(results[0]!.safe).toBe(true);
    expect(results[1]!.safe).toBe(false);
    expect(results[2]!.safe).toBe(true);
  });

  it('should handle empty array', () => {
    expect(sanitizeUrls([])).toEqual([]);
  });

  it('should handle null/undefined in array', () => {
    const results = sanitizeUrls([null, undefined, 'https://example.com']);
    expect(results[0]!.safe).toBe(false);
    expect(results[1]!.safe).toBe(false);
    expect(results[2]!.safe).toBe(true);
  });
});

describe('filterSafeUrls', () => {
  it('should filter to only safe URLs', () => {
    const urls = [
      'https://example.com',
      'javascript:alert(1)',
      'http://safe.org',
      'data:text/html,test',
    ];
    const safe = filterSafeUrls(urls);
    
    expect(safe).toEqual([
      'https://example.com',
      'http://safe.org',
    ]);
  });

  it('should handle empty array', () => {
    expect(filterSafeUrls([])).toEqual([]);
  });

  it('should filter out null/undefined', () => {
    const urls = [null, 'https://example.com', undefined];
    expect(filterSafeUrls(urls)).toEqual(['https://example.com']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SUSPICIOUS ENCODING TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('hasSuspiciousEncoding', () => {
  it('should detect encoded colon (%3A)', () => {
    expect(hasSuspiciousEncoding('javascript%3Aalert(1)')).toBe(true);
    expect(hasSuspiciousEncoding('javascript%3aalert(1)')).toBe(true);
  });

  it('should detect double encoding (%25)', () => {
    expect(hasSuspiciousEncoding('test%253Avalue')).toBe(true);
  });

  it('should detect null bytes (%00)', () => {
    expect(hasSuspiciousEncoding('test%00value')).toBe(true);
  });

  it('should detect unicode escapes', () => {
    expect(hasSuspiciousEncoding('test\\u0000value')).toBe(true);
  });

  it('should not flag normal URLs', () => {
    expect(hasSuspiciousEncoding('https://example.com/path?query=value')).toBe(false);
  });

  it('should not flag normal percent encoding', () => {
    expect(hasSuspiciousEncoding('https://example.com/path%20with%20spaces')).toBe(false);
  });
});

describe('sanitizeUrlStrict', () => {
  it('should accept normal URLs', () => {
    const result = sanitizeUrlStrict('https://example.com');
    expect(result.safe).toBe(true);
  });

  it('should reject URLs with encoded colons', () => {
    const result = sanitizeUrlStrict('https://example.com/javascript%3Aalert(1)');
    expect(result.safe).toBe(false);
    expect(result.rejectionReason).toContain('suspicious encoding');
  });

  it('should reject URLs with double encoding', () => {
    const result = sanitizeUrlStrict('https://example.com/%2525test');
    expect(result.safe).toBe(false);
  });

  it('should still block javascript: schemes', () => {
    const result = sanitizeUrlStrict('javascript:alert(1)');
    expect(result.safe).toBe(false);
  });
});
