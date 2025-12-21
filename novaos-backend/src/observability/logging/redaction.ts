// ═══════════════════════════════════════════════════════════════════════════════
// PII REDACTION — Sensitive Data Protection for Logging
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides automatic redaction of sensitive data before logging:
// - Full redaction: password, secret, token, key, authorization
// - Partial redaction: email (j***@example.com), phone, credit card
// - Pattern detection: SSN, credit card numbers
//
// Usage:
//   const safe = redact({ password: 'secret123', email: 'john@example.com' });
//   // { password: '[REDACTED]', email: 'j***@example.com' }
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// REDACTION CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fields that should be completely redacted.
 */
export const FULL_REDACT_FIELDS = new Set([
  // Authentication
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'apikey',
  'api_key',
  'apiSecret',
  'api_secret',
  'bearer',
  'authorization',
  'auth',
  'credential',
  'credentials',
  'privatekey',
  'private_key',
  'privateKey',
  
  // Encryption
  'encryptionkey',
  'encryption_key',
  'encryptionKey',
  'salt',
  'iv',
  'nonce',
  
  // Session
  'sessionid',
  'session_id',
  'sessionId',
  'cookie',
  'cookies',
  'jwt',
  'jwttoken',
  'jwt_token',
  
  // Financial
  'cvv',
  'cvc',
  'pin',
  'cardnumber',
  'card_number',
  'cardNumber',
  'accountnumber',
  'account_number',
  'accountNumber',
  'routingnumber',
  'routing_number',
  'routingNumber',
  
  // Personal
  'ssn',
  'socialsecurity',
  'social_security',
  'socialSecurityNumber',
  'taxid',
  'tax_id',
  'taxId',
  'driverslicense',
  'drivers_license',
  'driversLicense',
  'passport',
  'passportNumber',
  'passport_number',
]);

/**
 * Fields that should be partially redacted (show some characters).
 */
export const PARTIAL_REDACT_FIELDS = new Set([
  'email',
  'emailaddress',
  'email_address',
  'emailAddress',
  'phone',
  'phonenumber',
  'phone_number',
  'phoneNumber',
  'mobile',
  'cell',
  'telephone',
]);

/**
 * Redaction placeholder for fully redacted values.
 */
export const REDACTED = '[REDACTED]';

/**
 * Redaction options.
 */
export interface RedactionOptions {
  /** Enable/disable redaction globally */
  enabled?: boolean;
  
  /** Additional fields to fully redact */
  additionalFullRedactFields?: string[];
  
  /** Additional fields to partially redact */
  additionalPartialRedactFields?: string[];
  
  /** Maximum depth for nested object redaction */
  maxDepth?: number;
  
  /** Redact values that look like sensitive data even if field name doesn't match */
  detectPatterns?: boolean;
  
  /** Custom redaction placeholder */
  placeholder?: string;
}

const DEFAULT_OPTIONS: Required<RedactionOptions> = {
  enabled: true,
  additionalFullRedactFields: [],
  additionalPartialRedactFields: [],
  maxDepth: 10,
  detectPatterns: true,
  placeholder: REDACTED,
};

// ─────────────────────────────────────────────────────────────────────────────────
// PATTERN DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Patterns for detecting sensitive data in values.
 */
const SENSITIVE_PATTERNS = {
  // Credit card: 13-19 digits, possibly with spaces or dashes
  creditCard: /\b(?:\d[ -]*?){13,19}\b/,
  
  // SSN: XXX-XX-XXXX or XXXXXXXXX
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
  
  // Phone: various formats
  phone: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  
  // Email
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  
  // JWT token
  jwt: /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  
  // API key patterns (common formats)
  apiKey: /^(?:sk|pk|api|key)[-_][A-Za-z0-9]{20,}$/i,
  
  // Bearer token
  bearer: /^Bearer\s+[A-Za-z0-9._-]+$/i,
  
  // UUID (might be a token)
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  
  // Base64 encoded data (long strings)
  base64Long: /^[A-Za-z0-9+/]{50,}={0,2}$/,
};

/**
 * Check if a value looks like sensitive data.
 */
function detectSensitivePattern(value: string): 'full' | 'partial' | null {
  // Check for JWT
  if (SENSITIVE_PATTERNS.jwt.test(value)) {
    return 'full';
  }
  
  // Check for API key
  if (SENSITIVE_PATTERNS.apiKey.test(value)) {
    return 'full';
  }
  
  // Check for Bearer token
  if (SENSITIVE_PATTERNS.bearer.test(value)) {
    return 'full';
  }
  
  // Check for long base64 (likely encrypted/encoded sensitive data)
  if (SENSITIVE_PATTERNS.base64Long.test(value)) {
    return 'full';
  }
  
  // Check for credit card
  if (SENSITIVE_PATTERNS.creditCard.test(value)) {
    // Validate with Luhn algorithm for fewer false positives
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && isValidLuhn(digits)) {
      return 'partial';
    }
  }
  
  // Check for SSN
  if (SENSITIVE_PATTERNS.ssn.test(value)) {
    return 'partial';
  }
  
  // Check for email
  if (SENSITIVE_PATTERNS.email.test(value)) {
    return 'partial';
  }
  
  // Check for phone
  if (SENSITIVE_PATTERNS.phone.test(value)) {
    return 'partial';
  }
  
  return null;
}

/**
 * Luhn algorithm for credit card validation.
 */
function isValidLuhn(digits: string): boolean {
  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]!, 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PARTIAL REDACTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Partially redact an email address.
 * john.doe@example.com → j***@example.com
 */
export function redactEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return REDACTED;
  
  const local = email.substring(0, atIndex);
  const domain = email.substring(atIndex);
  
  if (local.length <= 1) {
    return `*${domain}`;
  }
  
  return `${local[0]}***${domain}`;
}

/**
 * Partially redact a phone number.
 * +1-555-123-4567 → +1-555-***-4567
 */
export function redactPhone(phone: string): string {
  // Keep first few and last few characters
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length < 4) {
    return REDACTED;
  }
  
  // Show last 4 digits only
  return `***-***-${digits.slice(-4)}`;
}

/**
 * Partially redact a credit card number.
 * 4111111111111111 → ****-****-****-1111
 */
export function redactCreditCard(card: string): string {
  const digits = card.replace(/\D/g, '');
  
  if (digits.length < 4) {
    return REDACTED;
  }
  
  const last4 = digits.slice(-4);
  return `****-****-****-${last4}`;
}

/**
 * Partially redact an SSN.
 * 123-45-6789 → ***-**-6789
 */
export function redactSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  
  if (digits.length < 4) {
    return REDACTED;
  }
  
  const last4 = digits.slice(-4);
  return `***-**-${last4}`;
}

/**
 * Apply partial redaction based on detected pattern.
 */
function applyPartialRedaction(value: string, pattern: 'partial'): string {
  // Try to detect what type of data it is
  if (SENSITIVE_PATTERNS.email.test(value)) {
    return redactEmail(value);
  }
  
  if (SENSITIVE_PATTERNS.phone.test(value)) {
    return redactPhone(value);
  }
  
  if (SENSITIVE_PATTERNS.creditCard.test(value)) {
    return redactCreditCard(value);
  }
  
  if (SENSITIVE_PATTERNS.ssn.test(value)) {
    return redactSSN(value);
  }
  
  // Default: show first and last character
  if (value.length <= 4) {
    return REDACTED;
  }
  
  return `${value[0]}***${value[value.length - 1]}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN REDACTION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Redact sensitive data from an object.
 */
export function redact<T>(
  data: T,
  options: RedactionOptions = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (!opts.enabled) {
    return data;
  }
  
  // Build field sets with additional fields
  const fullRedactFields = new Set([
    ...FULL_REDACT_FIELDS,
    ...opts.additionalFullRedactFields.map(f => f.toLowerCase()),
  ]);
  
  const partialRedactFields = new Set([
    ...PARTIAL_REDACT_FIELDS,
    ...opts.additionalPartialRedactFields.map(f => f.toLowerCase()),
  ]);
  
  return redactValue(data, fullRedactFields, partialRedactFields, opts, 0) as T;
}

/**
 * Internal recursive redaction function.
 */
function redactValue(
  value: unknown,
  fullRedactFields: Set<string>,
  partialRedactFields: Set<string>,
  opts: Required<RedactionOptions>,
  depth: number,
  fieldName?: string
): unknown {
  // Prevent infinite recursion
  if (depth > opts.maxDepth) {
    return value;
  }
  
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }
  
  // Handle strings
  if (typeof value === 'string') {
    return redactString(value, fullRedactFields, partialRedactFields, opts, fieldName);
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      redactValue(item, fullRedactFields, partialRedactFields, opts, depth + 1, `[${index}]`)
    );
  }
  
  // Handle objects
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    
    for (const [key, val] of Object.entries(value)) {
      result[key] = redactValue(
        val,
        fullRedactFields,
        partialRedactFields,
        opts,
        depth + 1,
        key
      );
    }
    
    return result;
  }
  
  // Return primitives as-is
  return value;
}

/**
 * Redact a string value based on field name and pattern detection.
 */
function redactString(
  value: string,
  fullRedactFields: Set<string>,
  partialRedactFields: Set<string>,
  opts: Required<RedactionOptions>,
  fieldName?: string
): string {
  const normalizedFieldName = fieldName?.toLowerCase().replace(/[-_]/g, '');
  
  // Check if field name requires full redaction
  if (normalizedFieldName && fullRedactFields.has(normalizedFieldName)) {
    return opts.placeholder;
  }
  
  // Check if field name requires partial redaction
  if (normalizedFieldName && partialRedactFields.has(normalizedFieldName)) {
    return applyPartialRedactionForField(value, normalizedFieldName);
  }
  
  // Pattern detection if enabled
  if (opts.detectPatterns) {
    const patternType = detectSensitivePattern(value);
    
    if (patternType === 'full') {
      return opts.placeholder;
    }
    
    if (patternType === 'partial') {
      return applyPartialRedaction(value, patternType);
    }
  }
  
  return value;
}

/**
 * Apply partial redaction based on field name.
 */
function applyPartialRedactionForField(value: string, fieldName: string): string {
  if (fieldName.includes('email')) {
    return redactEmail(value);
  }
  
  if (fieldName.includes('phone') || fieldName.includes('mobile') || fieldName.includes('cell')) {
    return redactPhone(value);
  }
  
  // Default partial redaction
  if (value.length <= 4) {
    return REDACTED;
  }
  
  return `${value[0]}***${value[value.length - 1]}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PINO INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a Pino redaction paths array for common sensitive fields.
 * Used with Pino's built-in redaction feature.
 */
export function getPinoRedactPaths(): string[] {
  return [
    // Top-level fields
    'password',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'jwt',
    
    // Nested in common locations
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
    'req.body.password',
    'req.body.token',
    'req.body.secret',
    'res.headers["set-cookie"]',
    
    // User data
    'user.password',
    'user.token',
    'data.password',
    'data.secret',
    
    // Wildcards for nested objects
    '*.password',
    '*.secret',
    '*.token',
    '*.apiKey',
    '*.api_key',
  ];
}

/**
 * Create Pino redaction configuration.
 */
export function getPinoRedactConfig(): { paths: string[]; censor: string } {
  return {
    paths: getPinoRedactPaths(),
    censor: REDACTED,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a string value should be redacted based on its content.
 * Useful for custom logging scenarios.
 */
export function shouldRedact(value: string): boolean {
  return detectSensitivePattern(value) !== null;
}

/**
 * Redact a single string value with pattern detection.
 */
export function redactString$(value: string, options: RedactionOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (!opts.enabled) {
    return value;
  }
  
  const patternType = detectSensitivePattern(value);
  
  if (patternType === 'full') {
    return opts.placeholder;
  }
  
  if (patternType === 'partial') {
    return applyPartialRedaction(value, patternType);
  }
  
  return value;
}

/**
 * Create a redaction function with pre-configured options.
 */
export function createRedactor(options: RedactionOptions = {}): <T>(data: T) => T {
  return <T>(data: T) => redact(data, options);
}

// ─────────────────────────────────────────────────────────────────────────────────
// NOTE: All types are exported inline where defined
// ─────────────────────────────────────────────────────────────────────────────────
