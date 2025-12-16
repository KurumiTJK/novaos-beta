// ═══════════════════════════════════════════════════════════════════════════════
// INPUT SANITIZATION — Request Validation & Sanitization
// Phase 20: Production Hardening
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface SanitizationConfig {
  // String limits
  maxStringLength: number;
  maxMessageLength: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  
  // Array limits
  maxArrayLength: number;
  maxObjectDepth: number;
  maxObjectKeys: number;
  
  // Content filtering
  stripHtml: boolean;
  stripScripts: boolean;
  normalizeWhitespace: boolean;
  
  // Encoding
  normalizeUnicode: boolean;
  stripNullBytes: boolean;
  
  // Logging
  logViolations: boolean;
}

export interface SanitizationResult {
  sanitized: boolean;
  violations: string[];
  original?: unknown;
  result: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export function loadSanitizationConfig(): SanitizationConfig {
  return {
    maxStringLength: parseInt(process.env.MAX_STRING_LENGTH ?? '10000', 10),
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH ?? '32000', 10),
    maxTitleLength: parseInt(process.env.MAX_TITLE_LENGTH ?? '200', 10),
    maxDescriptionLength: parseInt(process.env.MAX_DESCRIPTION_LENGTH ?? '2000', 10),
    maxArrayLength: parseInt(process.env.MAX_ARRAY_LENGTH ?? '100', 10),
    maxObjectDepth: parseInt(process.env.MAX_OBJECT_DEPTH ?? '10', 10),
    maxObjectKeys: parseInt(process.env.MAX_OBJECT_KEYS ?? '100', 10),
    stripHtml: process.env.STRIP_HTML !== 'false',
    stripScripts: true, // Always strip scripts
    normalizeWhitespace: process.env.NORMALIZE_WHITESPACE !== 'false',
    normalizeUnicode: process.env.NORMALIZE_UNICODE !== 'false',
    stripNullBytes: true, // Always strip null bytes
    logViolations: process.env.LOG_SANITIZATION_VIOLATIONS !== 'false',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// DANGEROUS PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

// Script injection patterns
const SCRIPT_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,  // onclick=, onerror=, etc.
  /data:\s*text\/html/gi,
  /vbscript:/gi,
];

// HTML tag patterns
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/gi;

// Null bytes and control characters
const NULL_BYTE_PATTERN = /\x00/g;
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/, 
  /%2e%2e%2f/gi,
  /%2e%2e\\/gi,
  /\.\.%2f/gi,
  /\.\.%5c/gi,
];

// SQL injection patterns (basic detection)
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|TRUNCATE)\b)/gi,
  /--/g,
  /;.*(\b(DROP|DELETE|TRUNCATE)\b)/gi,
  /'.*OR.*'/gi,
];

// NoSQL injection patterns
const NOSQL_INJECTION_PATTERNS = [
  /\$where/gi,
  /\$gt/gi,
  /\$lt/gi,
  /\$ne/gi,
  /\$regex/gi,
  /\$or/gi,
  /\$and/gi,
];

// Command injection patterns
const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$]/g,
  /\$\(/g,
  /`[^`]*`/g,
];

// ─────────────────────────────────────────────────────────────────────────────────
// SANITIZATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Strip HTML tags from string
 */
export function stripHtml(str: string): string {
  return str.replace(HTML_TAG_PATTERN, '');
}

/**
 * Strip script-related content
 */
export function stripScripts(str: string): string {
  let result = str;
  for (const pattern of SCRIPT_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result;
}

/**
 * Strip null bytes and dangerous control characters
 */
export function stripNullBytes(str: string): string {
  return str.replace(NULL_BYTE_PATTERN, '').replace(CONTROL_CHAR_PATTERN, '');
}

/**
 * Normalize whitespace (collapse multiple spaces, trim)
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize Unicode (NFC form)
 */
export function normalizeUnicode(str: string): string {
  return str.normalize('NFC');
}

/**
 * Truncate string to max length
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength);
}

/**
 * Check for path traversal attempts
 */
export function hasPathTraversal(str: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Check for SQL injection patterns
 */
export function hasSqlInjection(str: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Check for NoSQL injection patterns
 */
export function hasNoSqlInjection(value: unknown): boolean {
  if (typeof value === 'string') {
    return NOSQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).some(key => key.startsWith('$'));
  }
  return false;
}

/**
 * Check for command injection patterns
 */
export function hasCommandInjection(str: string): boolean {
  return COMMAND_INJECTION_PATTERNS.some(pattern => pattern.test(str));
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEEP SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Recursively sanitize an object
 */
export function sanitizeValue(
  value: unknown,
  config: SanitizationConfig,
  depth = 0,
  path = ''
): SanitizationResult {
  const violations: string[] = [];
  
  // Check depth limit
  if (depth > config.maxObjectDepth) {
    violations.push(`Object too deep at ${path}`);
    return { sanitized: true, violations, result: null };
  }
  
  // Handle null/undefined
  if (value === null || value === undefined) {
    return { sanitized: false, violations, result: value };
  }
  
  // Handle strings
  if (typeof value === 'string') {
    let result = value;
    
    // Check for dangerous patterns
    if (hasPathTraversal(result)) {
      violations.push(`Path traversal attempt at ${path}`);
    }
    
    if (hasSqlInjection(result)) {
      violations.push(`Potential SQL injection at ${path}`);
    }
    
    if (hasCommandInjection(result)) {
      violations.push(`Potential command injection at ${path}`);
    }
    
    // Strip null bytes (always)
    if (config.stripNullBytes) {
      const before = result;
      result = stripNullBytes(result);
      if (before !== result) {
        violations.push(`Stripped null bytes at ${path}`);
      }
    }
    
    // Strip scripts (always)
    if (config.stripScripts) {
      const before = result;
      result = stripScripts(result);
      if (before !== result) {
        violations.push(`Stripped scripts at ${path}`);
      }
    }
    
    // Strip HTML
    if (config.stripHtml) {
      const before = result;
      result = stripHtml(result);
      if (before !== result) {
        violations.push(`Stripped HTML at ${path}`);
      }
    }
    
    // Normalize Unicode
    if (config.normalizeUnicode) {
      result = normalizeUnicode(result);
    }
    
    // Normalize whitespace
    if (config.normalizeWhitespace) {
      result = normalizeWhitespace(result);
    }
    
    // Determine max length based on field name
    let maxLen = config.maxStringLength;
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('message')) {
      maxLen = config.maxMessageLength;
    } else if (lowerPath.includes('title') || lowerPath.includes('name')) {
      maxLen = config.maxTitleLength;
    } else if (lowerPath.includes('description') || lowerPath.includes('body')) {
      maxLen = config.maxDescriptionLength;
    }
    
    // Truncate if needed
    if (result.length > maxLen) {
      violations.push(`Truncated string at ${path} from ${result.length} to ${maxLen}`);
      result = truncateString(result, maxLen);
    }
    
    return {
      sanitized: violations.length > 0 || result !== value,
      violations,
      original: violations.length > 0 ? value : undefined,
      result,
    };
  }
  
  // Handle numbers
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      violations.push(`Invalid number at ${path}`);
      return { sanitized: true, violations, result: 0 };
    }
    return { sanitized: false, violations, result: value };
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return { sanitized: false, violations, result: value };
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length > config.maxArrayLength) {
      violations.push(`Array too long at ${path}: ${value.length} > ${config.maxArrayLength}`);
    }
    
    const sanitizedArray = value.slice(0, config.maxArrayLength).map((item, index) => {
      const itemResult = sanitizeValue(item, config, depth + 1, `${path}[${index}]`);
      violations.push(...itemResult.violations);
      return itemResult.result;
    });
    
    return {
      sanitized: violations.length > 0,
      violations,
      result: sanitizedArray,
    };
  }
  
  // Handle objects
  if (typeof value === 'object') {
    // Check for NoSQL injection
    if (hasNoSqlInjection(value)) {
      violations.push(`Potential NoSQL injection at ${path}`);
    }
    
    const keys = Object.keys(value);
    
    if (keys.length > config.maxObjectKeys) {
      violations.push(`Too many keys at ${path}: ${keys.length} > ${config.maxObjectKeys}`);
    }
    
    const sanitizedObject: Record<string, unknown> = {};
    const allowedKeys = keys.slice(0, config.maxObjectKeys);
    
    for (const key of allowedKeys) {
      // Sanitize the key itself
      const sanitizedKey = sanitizeValue(key, { ...config, stripHtml: false }, depth + 1, `${path}.key`);
      violations.push(...sanitizedKey.violations);
      
      // Sanitize the value
      const keyPath = path ? `${path}.${key}` : key;
      const itemResult = sanitizeValue((value as Record<string, unknown>)[key], config, depth + 1, keyPath);
      violations.push(...itemResult.violations);
      
      sanitizedObject[sanitizedKey.result as string] = itemResult.result;
    }
    
    return {
      sanitized: violations.length > 0,
      violations,
      result: sanitizedObject,
    };
  }
  
  // Unknown type - reject
  violations.push(`Unknown type at ${path}: ${typeof value}`);
  return { sanitized: true, violations, result: null };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPRESS MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize request body middleware
 */
export function sanitizeBody(config?: Partial<SanitizationConfig>) {
  const cfg = { ...loadSanitizationConfig(), ...config };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }
    
    const result = sanitizeValue(req.body, cfg, 0, 'body');
    
    if (result.violations.length > 0 && cfg.logViolations) {
      console.warn('[SANITIZATION] Violations detected:', {
        requestId: (req as any).requestId,
        path: req.path,
        violations: result.violations,
      });
    }
    
    // Replace body with sanitized version
    req.body = result.result;
    
    next();
  };
}

/**
 * Sanitize request query parameters middleware
 */
export function sanitizeQuery(config?: Partial<SanitizationConfig>) {
  const cfg = { ...loadSanitizationConfig(), ...config };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.query || typeof req.query !== 'object') {
      return next();
    }
    
    const result = sanitizeValue(req.query, cfg, 0, 'query');
    
    if (result.violations.length > 0 && cfg.logViolations) {
      console.warn('[SANITIZATION] Query violations:', {
        requestId: (req as any).requestId,
        path: req.path,
        violations: result.violations,
      });
    }
    
    // Replace query with sanitized version
    req.query = result.result as typeof req.query;
    
    next();
  };
}

/**
 * Sanitize request params middleware
 */
export function sanitizeParams(config?: Partial<SanitizationConfig>) {
  const cfg = { ...loadSanitizationConfig(), ...config };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.params || typeof req.params !== 'object') {
      return next();
    }
    
    const result = sanitizeValue(req.params, cfg, 0, 'params');
    
    if (result.violations.length > 0 && cfg.logViolations) {
      console.warn('[SANITIZATION] Params violations:', {
        requestId: (req as any).requestId,
        path: req.path,
        violations: result.violations,
      });
    }
    
    // Replace params with sanitized version
    req.params = result.result as typeof req.params;
    
    next();
  };
}

/**
 * Combined sanitization middleware
 */
export function sanitizeRequest(config?: Partial<SanitizationConfig>) {
  const bodyMiddleware = sanitizeBody(config);
  const queryMiddleware = sanitizeQuery(config);
  const paramsMiddleware = sanitizeParams(config);
  
  return (req: Request, res: Response, next: NextFunction): void => {
    bodyMiddleware(req, res, (err) => {
      if (err) return next(err);
      queryMiddleware(req, res, (err) => {
        if (err) return next(err);
        paramsMiddleware(req, res, next);
      });
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIFIC FIELD SANITIZERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  // Basic email sanitization
  return email
    .toLowerCase()
    .trim()
    .replace(/[<>'"]/g, '') // Remove potentially dangerous chars
    .slice(0, 254); // Max email length per RFC
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    
    // Reconstruct URL to remove any oddities
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe chars
    .replace(/\.{2,}/g, '.') // No double dots
    .replace(/^\./, '_') // No leading dots
    .slice(0, 255); // Max filename length
}

/**
 * Sanitize identifier (userId, goalId, etc.)
 */
export function sanitizeId(id: string): string {
  return id
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 100);
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate and sanitize a message field
 */
export function validateMessage(message: unknown): { valid: boolean; value: string; error?: string } {
  if (typeof message !== 'string') {
    return { valid: false, value: '', error: 'Message must be a string' };
  }
  
  const config = loadSanitizationConfig();
  const result = sanitizeValue(message, config, 0, 'message');
  const sanitized = result.result as string;
  
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, value: '', error: 'Message cannot be empty' };
  }
  
  return { valid: true, value: sanitized };
}

/**
 * Validate and sanitize a title field
 */
export function validateTitle(title: unknown): { valid: boolean; value: string; error?: string } {
  if (typeof title !== 'string') {
    return { valid: false, value: '', error: 'Title must be a string' };
  }
  
  const config = loadSanitizationConfig();
  const result = sanitizeValue(title, { ...config, maxStringLength: config.maxTitleLength }, 0, 'title');
  const sanitized = result.result as string;
  
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, value: '', error: 'Title cannot be empty' };
  }
  
  if (sanitized.length < 3) {
    return { valid: false, value: sanitized, error: 'Title must be at least 3 characters' };
  }
  
  return { valid: true, value: sanitized };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const sanitizers = {
  stripHtml,
  stripScripts,
  stripNullBytes,
  normalizeWhitespace,
  normalizeUnicode,
  truncateString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeId,
};

export const validators = {
  hasPathTraversal,
  hasSqlInjection,
  hasNoSqlInjection,
  hasCommandInjection,
  validateMessage,
  validateTitle,
};
