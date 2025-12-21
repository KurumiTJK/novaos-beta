// ═══════════════════════════════════════════════════════════════════════════════
// URL SANITIZER — XSS Prevention for Resource URLs
// NovaOS Spark Engine — Phase 10: Spark Generation
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module sanitizes URLs for safe display in sparks:
//   - Only allows http:// and https:// schemes
//   - Blocks javascript:, data:, vbscript:, file:, about:, blob:
//   - Validates URL structure
//   - Provides safe display formatting
//
// Security Considerations:
//   - XSS via javascript: URLs
//   - Data exfiltration via data: URLs
//   - Local file access via file: URLs
//   - Browser exploits via about: URLs
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { UrlSanitizationResult } from './types.js';
import { ALLOWED_URL_SCHEMES, BLOCKED_URL_SCHEMES } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// URL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a URL scheme is allowed.
 *
 * Only http: and https: are permitted.
 *
 * @param scheme - URL scheme (e.g., 'https:')
 * @returns Whether the scheme is allowed
 */
export function isAllowedScheme(scheme: string): boolean {
  const normalizedScheme = scheme.toLowerCase();
  return ALLOWED_URL_SCHEMES.includes(normalizedScheme as typeof ALLOWED_URL_SCHEMES[number]);
}

/**
 * Check if a URL scheme is explicitly blocked.
 *
 * @param scheme - URL scheme to check
 * @returns Whether the scheme is blocked
 */
export function isBlockedScheme(scheme: string): boolean {
  const normalizedScheme = scheme.toLowerCase();
  return BLOCKED_URL_SCHEMES.some(blocked => normalizedScheme.startsWith(blocked));
}

/**
 * Extract the scheme from a URL string.
 *
 * Handles edge cases like missing schemes and malformed URLs.
 *
 * @param url - URL string to extract scheme from
 * @returns Scheme string or null if not found
 */
export function extractScheme(url: string): string | null {
  // Trim whitespace and normalize
  const trimmed = url.trim();

  // Check for scheme pattern (letters followed by colon)
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)/);
  if (schemeMatch) {
    return schemeMatch[1]!.toLowerCase();
  }

  return null;
}

/**
 * Validate a URL string structure.
 *
 * @param url - URL string to validate
 * @returns Whether the URL is structurally valid
 */
export function isValidUrlStructure(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sanitize a URL for safe display.
 *
 * Validation steps:
 * 1. Check for empty/null input
 * 2. Extract and validate scheme
 * 3. Ensure scheme is allowed (http/https only)
 * 4. Validate URL structure
 * 5. Return sanitized URL
 *
 * @param url - URL string to sanitize
 * @returns Sanitization result with safe URL or rejection reason
 */
export function sanitizeUrl(url: string | undefined | null): UrlSanitizationResult {
  // Handle empty input
  if (!url || typeof url !== 'string') {
    return {
      safe: false,
      rejectionReason: 'URL is empty or not a string',
      originalUrl: url ?? '',
    };
  }

  const trimmedUrl = url.trim();

  // Check for empty after trim
  if (trimmedUrl.length === 0) {
    return {
      safe: false,
      rejectionReason: 'URL is empty',
      originalUrl: url,
    };
  }

  // Extract scheme
  const scheme = extractScheme(trimmedUrl);

  // No scheme found
  if (!scheme) {
    return {
      safe: false,
      rejectionReason: 'URL has no valid scheme',
      originalUrl: url,
    };
  }

  // Check for blocked schemes first (more specific error)
  if (isBlockedScheme(scheme)) {
    return {
      safe: false,
      rejectionReason: `Blocked URL scheme: ${scheme}`,
      originalUrl: url,
    };
  }

  // Check for allowed schemes
  if (!isAllowedScheme(scheme)) {
    return {
      safe: false,
      rejectionReason: `URL scheme not allowed: ${scheme} (only http: and https: permitted)`,
      originalUrl: url,
    };
  }

  // Validate URL structure
  if (!isValidUrlStructure(trimmedUrl)) {
    return {
      safe: false,
      rejectionReason: 'URL structure is invalid',
      originalUrl: url,
    };
  }

  // URL is safe - return the trimmed version
  return {
    safe: true,
    sanitizedUrl: trimmedUrl,
    originalUrl: url,
  };
}

/**
 * Sanitize a URL and return only the safe URL or undefined.
 *
 * Convenience function for cases where rejection reason isn't needed.
 *
 * @param url - URL string to sanitize
 * @returns Sanitized URL or undefined if unsafe
 */
export function sanitizeDisplayUrl(url: string | undefined | null): string | undefined {
  const result = sanitizeUrl(url);
  return result.safe ? result.sanitizedUrl : undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPLAY FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format a URL for display (shortened if too long).
 *
 * @param url - Sanitized URL to format
 * @param maxLength - Maximum display length (default: 50)
 * @returns Formatted URL for display
 */
export function formatDisplayUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) {
    return url;
  }

  // Try to extract domain for short display
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;

    // If domain fits, show domain + ellipsis
    if (domain.length <= maxLength - 3) {
      const remaining = maxLength - domain.length - 3;
      const path = parsed.pathname + parsed.search;

      if (path.length > 0 && remaining > 5) {
        // Show domain + truncated path
        const truncatedPath = path.substring(0, remaining - 3) + '...';
        return `${domain}${truncatedPath}`;
      }

      return domain;
    }

    // Domain too long, just truncate
    return domain.substring(0, maxLength - 3) + '...';
  } catch {
    // Fallback: simple truncation
    return url.substring(0, maxLength - 3) + '...';
  }
}

/**
 * Sanitize and format a URL for display.
 *
 * Combines sanitization with display formatting.
 *
 * @param url - URL string to process
 * @param maxLength - Maximum display length
 * @returns Formatted safe URL or undefined if unsafe
 */
export function sanitizeAndFormatUrl(
  url: string | undefined | null,
  maxLength: number = 50
): string | undefined {
  const sanitized = sanitizeDisplayUrl(url);
  if (!sanitized) {
    return undefined;
  }
  return formatDisplayUrl(sanitized, maxLength);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sanitize multiple URLs.
 *
 * @param urls - Array of URLs to sanitize
 * @returns Array of sanitization results
 */
export function sanitizeUrls(urls: readonly (string | undefined | null)[]): UrlSanitizationResult[] {
  return urls.map(url => sanitizeUrl(url));
}

/**
 * Filter URLs to only safe ones.
 *
 * @param urls - Array of URLs to filter
 * @returns Array of sanitized safe URLs
 */
export function filterSafeUrls(urls: readonly (string | undefined | null)[]): string[] {
  return urls
    .map(url => sanitizeDisplayUrl(url))
    .filter((url): url is string => url !== undefined);
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL ENCODING SAFETY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a URL contains suspicious encoding patterns.
 *
 * Detects attempts to bypass scheme checks via encoding.
 *
 * @param url - URL to check
 * @returns Whether suspicious encoding was detected
 */
export function hasSuspiciousEncoding(url: string): boolean {
  // Check for encoded colons that might hide schemes
  // %3A is encoded colon
  const hasEncodedColon = /%3[aA]/.test(url);

  // Check for double encoding
  const hasDoubleEncoding = /%25/.test(url);

  // Check for null bytes
  const hasNullBytes = /%00/.test(url) || url.includes('\0');

  // Check for unicode escapes that might bypass checks
  const hasUnicodeEscape = /\\u[0-9a-fA-F]{4}/.test(url);

  return hasEncodedColon || hasDoubleEncoding || hasNullBytes || hasUnicodeEscape;
}

/**
 * Strict URL sanitization with encoding checks.
 *
 * More paranoid version that also rejects suspicious encoding.
 *
 * @param url - URL to sanitize
 * @returns Sanitization result
 */
export function sanitizeUrlStrict(url: string | undefined | null): UrlSanitizationResult {
  // First check for suspicious encoding
  if (url && hasSuspiciousEncoding(url)) {
    return {
      safe: false,
      rejectionReason: 'URL contains suspicious encoding patterns',
      originalUrl: url,
    };
  }

  // Then do normal sanitization
  return sanitizeUrl(url);
}
