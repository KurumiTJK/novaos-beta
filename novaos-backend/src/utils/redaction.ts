// ═══════════════════════════════════════════════════════════════════════════════
// REDACTION UTILITIES — Sensitive Data Protection for Logging
// Ensures no secrets, PII, or sensitive data leak into logs
// ═══════════════════════════════════════════════════════════════════════════════

import { URL } from 'url';

// ─────────────────────────────────────────────────────────────────────────────────
// REDACTION PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Pattern definitions for sensitive data detection.
 * Each pattern has a regex and a replacement string.
 */
interface RedactionPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Patterns for detecting and redacting sensitive data.
 * Order matters - more specific patterns should come before general ones.
 */
const REDACTION_PATTERNS: readonly RedactionPattern[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // API Keys & Tokens
  // ─────────────────────────────────────────────────────────────────────────────
  
  // OpenAI API keys: sk-...
  {
    name: 'openai_key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    replacement: '[OPENAI_KEY_REDACTED]',
  },
  
  // Anthropic API keys: sk-ant-...
  {
    name: 'anthropic_key',
    pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g,
    replacement: '[ANTHROPIC_KEY_REDACTED]',
  },
  
  // AWS Access Keys: AKIA...
  {
    name: 'aws_access_key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: '[AWS_KEY_REDACTED]',
  },
  
  // AWS Secret Keys (40 chars base64-ish)
  {
    name: 'aws_secret_key',
    pattern: /(?<=['"=:\s])[A-Za-z0-9/+=]{40}(?=['";\s,}]|$)/g,
    replacement: '[AWS_SECRET_REDACTED]',
  },
  
  // Generic API keys in common formats
  {
    name: 'generic_api_key',
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret|secret[_-]?key)['":\s=]+['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    replacement: '[API_KEY_REDACTED]',
  },
  
  // Bearer tokens
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi,
    replacement: 'Bearer [TOKEN_REDACTED]',
  },
  
  // JWT tokens (three base64 segments)
  {
    name: 'jwt_token',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: '[JWT_REDACTED]',
  },
  
  // GitHub tokens
  {
    name: 'github_token',
    pattern: /gh[pousr]_[a-zA-Z0-9]{36,}/g,
    replacement: '[GITHUB_TOKEN_REDACTED]',
  },
  
  // Stripe keys
  {
    name: 'stripe_key',
    pattern: /(?:sk|pk|rk)_(?:live|test)_[a-zA-Z0-9]{20,}/g,
    replacement: '[STRIPE_KEY_REDACTED]',
  },
  
  // Generic long hex strings that look like secrets (32+ chars)
  {
    name: 'hex_secret',
    pattern: /(?<=['"=:\s])[a-fA-F0-9]{32,}(?=['";\s,}]|$)/g,
    replacement: '[HEX_SECRET_REDACTED]',
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Financial Data
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Credit card numbers (with or without separators)
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
    replacement: '[CARD_REDACTED]',
  },
  
  // Credit card with explicit prefix
  {
    name: 'credit_card_prefixed',
    pattern: /(?:card|cc|credit)[_\s-]*(?:number|num|no)?['":\s=]*\d{13,19}/gi,
    replacement: '[CARD_REDACTED]',
  },
  
  // CVV/CVC codes
  {
    name: 'cvv',
    pattern: /(?:cvv|cvc|cvv2|cvc2|security[_\s-]?code)['":\s=]*\d{3,4}/gi,
    replacement: '[CVV_REDACTED]',
  },
  
  // Bank account numbers (generic)
  {
    name: 'bank_account',
    pattern: /(?:account|acct)[_\s-]*(?:number|num|no)?['":\s=]*\d{8,17}/gi,
    replacement: '[ACCOUNT_REDACTED]',
  },
  
  // Routing numbers (US)
  {
    name: 'routing_number',
    pattern: /(?:routing|aba)[_\s-]*(?:number|num|no)?['":\s=]*\d{9}/gi,
    replacement: '[ROUTING_REDACTED]',
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Personal Identifiable Information (PII)
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Social Security Numbers (US)
  {
    name: 'ssn',
    pattern: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
  },
  
  // SSN with explicit prefix
  {
    name: 'ssn_prefixed',
    pattern: /(?:ssn|social[_\s-]*security)['":\s=]*\d{3}[- ]?\d{2}[- ]?\d{4}/gi,
    replacement: '[SSN_REDACTED]',
  },
  
  // Email addresses
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL_REDACTED]',
  },
  
  // Phone numbers (various formats)
  {
    name: 'phone',
    pattern: /(?:\+?1[- ]?)?\(?[0-9]{3}\)?[- ]?[0-9]{3}[- ]?[0-9]{4}\b/g,
    replacement: '[PHONE_REDACTED]',
  },
  
  // IP addresses (IPv4)
  {
    name: 'ipv4',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP_REDACTED]',
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Credentials
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Password fields
  {
    name: 'password',
    pattern: /(?:password|passwd|pwd|pass)['":\s=]+['"]?[^'"\s,}{]+['"]?/gi,
    replacement: '[PASSWORD_REDACTED]',
  },
  
  // Secret fields
  {
    name: 'secret',
    pattern: /(?:secret|private[_-]?key)['":\s=]+['"]?[^'"\s,}{]+['"]?/gi,
    replacement: '[SECRET_REDACTED]',
  },
  
  // Authorization headers
  {
    name: 'auth_header',
    pattern: /(?:authorization|x-api-key|x-auth-token)['":\s=]+['"]?[^'"\s,}{]+['"]?/gi,
    replacement: '[AUTH_REDACTED]',
  },
  
  // Connection strings
  {
    name: 'connection_string',
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s'"]+/gi,
    replacement: '[CONNECTION_STRING_REDACTED]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// SENSITIVE FIELD NAMES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Field names that should always have their values redacted.
 */
const SENSITIVE_FIELD_NAMES: ReadonlySet<string> = new Set([
  // Credentials
  'password',
  'passwd',
  'pwd',
  'pass',
  'secret',
  'apikey',
  'api_key',
  'apiKey',
  'api-key',
  'token',
  'accesstoken',
  'access_token',
  'accessToken',
  'access-token',
  'refreshtoken',
  'refresh_token',
  'refreshToken',
  'refresh-token',
  'authorization',
  'auth',
  'bearer',
  'credential',
  'credentials',
  'privatekey',
  'private_key',
  'privateKey',
  'private-key',
  
  // Financial
  'ssn',
  'socialsecurity',
  'social_security',
  'socialSecurity',
  'creditcard',
  'credit_card',
  'creditCard',
  'cardnumber',
  'card_number',
  'cardNumber',
  'cvv',
  'cvc',
  'cvv2',
  'cvc2',
  'accountnumber',
  'account_number',
  'accountNumber',
  'routingnumber',
  'routing_number',
  'routingNumber',
  
  // Personal
  'email',
  'phone',
  'phonenumber',
  'phone_number',
  'phoneNumber',
  'address',
  'dob',
  'dateofbirth',
  'date_of_birth',
  'dateOfBirth',
]);

/**
 * Check if a field name indicates sensitive data.
 */
function isSensitiveFieldName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_FIELD_NAMES.has(name.toLowerCase()) ||
         SENSITIVE_FIELD_NAMES.has(normalized);
}

// ─────────────────────────────────────────────────────────────────────────────────
// STRING REDACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Redact sensitive data from a string.
 * 
 * Applies all redaction patterns to remove sensitive information
 * like API keys, credit cards, SSNs, emails, etc.
 * 
 * @param input - The string to redact
 * @returns String with sensitive data replaced with redaction markers
 * 
 * @example
 * redact('API key is sk-abc123xyz789...');
 * // 'API key is [OPENAI_KEY_REDACTED]'
 * 
 * redact('Email: user@example.com');
 * // 'Email: [EMAIL_REDACTED]'
 */
export function redact(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }
  
  let result = input;
  
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    // Reset lastIndex to avoid stateful regex issues
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

/**
 * Redact a string with custom patterns only.
 * 
 * @param input - The string to redact
 * @param patterns - Pattern names to apply (from REDACTION_PATTERNS)
 * @returns String with matching patterns redacted
 */
export function redactWithPatterns(input: string, patterns: string[]): string {
  if (!input || typeof input !== 'string') {
    return input;
  }
  
  let result = input;
  const patternSet = new Set(patterns);
  
  for (const { name, pattern, replacement } of REDACTION_PATTERNS) {
    if (patternSet.has(name)) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
    }
  }
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// OBJECT REDACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Recursively redact sensitive data from an object.
 * 
 * - String values are redacted using pattern matching
 * - Fields with sensitive names have their values fully redacted
 * - Arrays are recursively processed
 * - Nested objects are recursively processed
 * - Circular references are handled safely
 * 
 * @param obj - The object to redact
 * @param maxDepth - Maximum recursion depth (default: 10)
 * @returns A new object with sensitive data redacted
 * 
 * @example
 * redactObject({
 *   name: 'John',
 *   email: 'john@example.com',
 *   password: 'secret123',
 *   data: { apiKey: 'sk-abc123' }
 * });
 * // {
 * //   name: 'John',
 * //   email: '[EMAIL_REDACTED]',
 * //   password: '[REDACTED]',
 * //   data: { apiKey: '[REDACTED]' }
 * // }
 */
export function redactObject<T>(obj: T, maxDepth: number = 10): T {
  return redactObjectInternal(obj, new WeakSet(), 0, maxDepth);
}

function redactObjectInternal<T>(
  obj: T,
  seen: WeakSet<object>,
  depth: number,
  maxDepth: number
): T {
  // Handle primitives and null
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle strings
  if (typeof obj === 'string') {
    return redact(obj) as T;
  }
  
  // Handle non-objects
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Check depth limit
  if (depth >= maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]' as T;
  }
  
  // Check for circular reference
  if (seen.has(obj as object)) {
    return '[CIRCULAR_REFERENCE]' as T;
  }
  
  // Track this object
  seen.add(obj as object);
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => 
      redactObjectInternal(item, seen, depth + 1, maxDepth)
    ) as T;
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj as T;
  }
  
  // Handle regular objects
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveFieldName(key)) {
      // Fully redact sensitive field values
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      // Apply pattern redaction to string values
      result[key] = redact(value);
    } else if (typeof value === 'object' && value !== null) {
      // Recurse into nested objects
      result[key] = redactObjectInternal(value, seen, depth + 1, maxDepth);
    } else {
      // Keep other primitives as-is
      result[key] = value;
    }
  }
  
  return result as T;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Truncate a string for logging, adding ellipsis if truncated.
 * 
 * @param input - The string to truncate
 * @param maxLength - Maximum length (default: 1000)
 * @returns Truncated string
 * 
 * @example
 * truncateForLog('very long string...', 20);
 * // 'very long string...[TRUNCATED]'
 */
export function truncateForLog(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return String(input);
  }
  
  if (input.length <= maxLength) {
    return input;
  }
  
  return input.slice(0, maxLength) + '[TRUNCATED]';
}

/**
 * Prepare a value for safe logging.
 * 
 * Combines redaction and truncation for safe log output.
 * 
 * @param value - The value to prepare
 * @param maxLength - Maximum string length (default: 1000)
 * @returns Safe string representation
 */
export function safeLogValue(value: unknown, maxLength: number = 1000): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  
  if (typeof value === 'string') {
    return truncateForLog(redact(value), maxLength);
  }
  
  if (typeof value === 'object') {
    try {
      const redacted = redactObject(value);
      const json = JSON.stringify(redacted);
      return truncateForLog(json, maxLength);
    } catch {
      return '[UNSERIALIZABLE_OBJECT]';
    }
  }
  
  return String(value);
}

/**
 * Create a redacted copy of headers for logging.
 * 
 * @param headers - Headers object or record
 * @returns Redacted headers safe for logging
 */
export function redactHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};
  
  const sensitiveHeaders = new Set([
    'authorization',
    'x-api-key',
    'x-auth-token',
    'cookie',
    'set-cookie',
    'x-access-token',
    'x-refresh-token',
    'proxy-authorization',
  ]);
  
  const entries = Object.entries(headers);
  
  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveHeaders.has(lowerKey)) {
      result[key] = '[REDACTED]';
    } else if (value === undefined) {
      result[key] = '[undefined]';
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => redact(v)).join(', ');
    } else {
      result[key] = redact(value);
    }
  }
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR REDACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Redact sensitive data from an error for safe logging.
 * 
 * @param error - The error to redact
 * @returns Safe error representation
 */
export function redactError(error: unknown): {
  name: string;
  message: string;
  stack?: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redact(error.message),
      stack: error.stack ? redact(error.stack) : undefined,
      code: (error as Error & { code?: string }).code,
    };
  }
  
  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: redact(error),
    };
  }
  
  return {
    name: 'UnknownError',
    message: safeLogValue(error),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// URL REDACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Redact sensitive parts of a URL.
 * 
 * Removes passwords, API keys in query params, and sensitive query values.
 * 
 * @param url - The URL to redact
 * @returns Redacted URL string
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Redact password
    if (parsed.password) {
      parsed.password = '[REDACTED]';
    }
    
    // Redact sensitive query parameters
    const sensitiveParams = new Set([
      'apikey', 'api_key', 'apiKey',
      'token', 'access_token', 'accessToken',
      'secret', 'password', 'key',
      'auth', 'authorization',
    ]);
    
    for (const [key] of parsed.searchParams) {
      if (sensitiveParams.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    
    return parsed.toString();
  } catch {
    // If URL parsing fails, apply string redaction
    return redact(url);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get list of available redaction pattern names.
 */
export function getRedactionPatternNames(): string[] {
  return REDACTION_PATTERNS.map(p => p.name);
}

/**
 * Check if a string contains potentially sensitive data.
 * 
 * @param input - The string to check
 * @returns True if sensitive data patterns are detected
 */
export function containsSensitiveData(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }
  
  for (const { pattern } of REDACTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      return true;
    }
  }
  
  return false;
}
