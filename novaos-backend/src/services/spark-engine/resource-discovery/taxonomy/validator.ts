// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC VALIDATOR — Topic ID Validation with Injection Prevention
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// Validates topic IDs to prevent:
//   - Path traversal (../)
//   - SQL/NoSQL injection
//   - Command injection
//   - Regex injection
//   - Unicode normalization attacks
//
// Topic ID format: category:subcategory:specific
// Example: language:rust:ownership:borrowing
//
// ═══════════════════════════════════════════════════════════════════════════════

import { type Result, ok, err } from '../../../../types/result.js';
import { type TopicId, createTopicId } from '../types.js';
import { TOPIC_ID_CONSTRAINTS } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Topic ID validation error codes.
 */
export type TopicIdErrorCode =
  | 'EMPTY_ID'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'INVALID_CHARACTERS'
  | 'EMPTY_SEGMENT'
  | 'TOO_MANY_SEGMENTS'
  | 'INVALID_SEGMENT_START'
  | 'RESERVED_WORD'
  | 'PATH_TRAVERSAL'
  | 'INJECTION_ATTEMPT'
  | 'UNICODE_NORMALIZATION';

/**
 * Topic ID validation error.
 */
export interface TopicIdError {
  readonly code: TopicIdErrorCode;
  readonly message: string;
  readonly position?: number;
  readonly segment?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DANGEROUS PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Reserved words that cannot be used as topic segments.
 * These could be confused with system commands or have special meaning.
 */
const RESERVED_WORDS: ReadonlySet<string> = new Set([
  // System
  'null',
  'undefined',
  'true',
  'false',
  'nan',
  'infinity',
  
  // Database
  'select',
  'insert',
  'update',
  'delete',
  'drop',
  'truncate',
  'exec',
  'execute',
  
  // Shell
  'rm',
  'sudo',
  'chmod',
  'chown',
  'eval',
  
  // Special
  '__proto__',
  'constructor',
  'prototype',
  'hasownproperty',
  
  // Reserved for system use
  '_system',
  '_internal',
  '_admin',
  '_root',
]);

/**
 * Characters that indicate potential injection attempts.
 * These should NEVER appear in topic IDs.
 */
const INJECTION_CHARS: readonly string[] = [
  // SQL injection
  "'", '"', ';', '--', '/*', '*/', '\\',
  
  // Command injection  
  '|', '&', '$', '`', '(', ')', '{', '}', '[', ']',
  '<', '>', '!', '#', '%', '^', '*', '=', '+',
  
  // Path traversal
  '..', './', '/.', '//',
  
  // Special chars
  '\0', '\n', '\r', '\t', '\x00',
];

/**
 * Unicode categories that are not allowed (confusable characters).
 */
const DISALLOWED_UNICODE_CATEGORIES: readonly string[] = [
  'Cf', // Format characters
  'Cc', // Control characters
  'Cn', // Unassigned
  'Co', // Private use
  'Cs', // Surrogate
];

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a string contains any injection characters.
 */
function containsInjectionChars(str: string): { found: boolean; char?: string; position?: number } {
  for (const char of INJECTION_CHARS) {
    const pos = str.indexOf(char);
    if (pos !== -1) {
      return { found: true, char, position: pos };
    }
  }
  return { found: false };
}

/**
 * Check if a string contains potentially dangerous Unicode.
 */
function containsDangerousUnicode(str: string): boolean {
  // Check for non-ASCII characters that could be confusable
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    
    // Allow only basic ASCII lowercase letters, digits, underscore, colon
    if (code > 127) {
      return true;
    }
    
    // Check for control characters
    if (code < 32 || code === 127) {
      return true;
    }
  }
  
  return false;
}

/**
 * Normalize a string for comparison (lowercase, trim).
 */
function normalize(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Validate a single topic segment.
 */
function validateSegment(
  segment: string,
  index: number
): Result<string, TopicIdError> {
  // Check for empty segment
  if (!segment || segment.length === 0) {
    return err({
      code: 'EMPTY_SEGMENT',
      message: `Segment ${index + 1} is empty`,
      position: index,
    });
  }
  
  const normalized = normalize(segment);
  
  // Check length
  if (normalized.length < 1) {
    return err({
      code: 'EMPTY_SEGMENT',
      message: `Segment ${index + 1} is empty after normalization`,
      position: index,
      segment,
    });
  }
  
  // Check first character (must be lowercase letter)
  const firstChar = normalized.charCodeAt(0);
  if (firstChar < 97 || firstChar > 122) { // 'a' to 'z'
    return err({
      code: 'INVALID_SEGMENT_START',
      message: `Segment "${segment}" must start with a lowercase letter`,
      position: index,
      segment,
    });
  }
  
  // Check all characters (lowercase letters, digits, underscore only)
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const isLowerLetter = code >= 97 && code <= 122; // a-z
    const isDigit = code >= 48 && code <= 57; // 0-9
    const isUnderscore = code === 95; // _
    
    if (!isLowerLetter && !isDigit && !isUnderscore) {
      return err({
        code: 'INVALID_CHARACTERS',
        message: `Invalid character '${normalized[i]}' at position ${i} in segment "${segment}"`,
        position: i,
        segment,
      });
    }
  }
  
  // Check reserved words
  if (RESERVED_WORDS.has(normalized)) {
    return err({
      code: 'RESERVED_WORD',
      message: `"${segment}" is a reserved word and cannot be used as a topic segment`,
      segment,
    });
  }
  
  return ok(normalized);
}

/**
 * Validate a complete topic ID string.
 */
export function validateTopicId(input: string): Result<TopicId, TopicIdError> {
  // Check for null/undefined/empty
  if (!input || typeof input !== 'string') {
    return err({
      code: 'EMPTY_ID',
      message: 'Topic ID cannot be empty',
    });
  }
  
  const trimmed = input.trim();
  
  // Check minimum length
  if (trimmed.length < TOPIC_ID_CONSTRAINTS.MIN_LENGTH) {
    return err({
      code: 'TOO_SHORT',
      message: `Topic ID must be at least ${TOPIC_ID_CONSTRAINTS.MIN_LENGTH} characters`,
    });
  }
  
  // Check maximum length
  if (trimmed.length > TOPIC_ID_CONSTRAINTS.MAX_LENGTH) {
    return err({
      code: 'TOO_LONG',
      message: `Topic ID cannot exceed ${TOPIC_ID_CONSTRAINTS.MAX_LENGTH} characters`,
    });
  }
  
  // Check for injection characters BEFORE any other processing
  const injectionCheck = containsInjectionChars(trimmed);
  if (injectionCheck.found) {
    return err({
      code: 'INJECTION_ATTEMPT',
      message: `Dangerous character "${injectionCheck.char}" detected at position ${injectionCheck.position}`,
      position: injectionCheck.position,
    });
  }
  
  // Check for dangerous Unicode
  if (containsDangerousUnicode(trimmed)) {
    return err({
      code: 'UNICODE_NORMALIZATION',
      message: 'Topic ID contains non-ASCII characters which are not allowed',
    });
  }
  
  // Check for path traversal
  if (trimmed.includes('..') || trimmed.includes('./') || trimmed.includes('/.')) {
    return err({
      code: 'PATH_TRAVERSAL',
      message: 'Topic ID contains path traversal sequence',
    });
  }
  
  // Split into segments
  const segments = trimmed.split(TOPIC_ID_CONSTRAINTS.SEPARATOR);
  
  // Check segment count
  if (segments.length > TOPIC_ID_CONSTRAINTS.MAX_DEPTH) {
    return err({
      code: 'TOO_MANY_SEGMENTS',
      message: `Topic ID can have at most ${TOPIC_ID_CONSTRAINTS.MAX_DEPTH} segments (has ${segments.length})`,
    });
  }
  
  // Validate each segment
  const normalizedSegments: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const result = validateSegment(segments[i]!, i);
    if (!result.ok) {
      return result;
    }
    normalizedSegments.push(result.value);
  }
  
  // Reconstruct normalized topic ID
  const normalizedId = normalizedSegments.join(TOPIC_ID_CONSTRAINTS.SEPARATOR);
  
  return ok(createTopicId(normalizedId));
}

/**
 * Check if a topic ID is valid without returning error details.
 */
export function isValidTopicId(input: string): boolean {
  return validateTopicId(input).ok;
}

/**
 * Sanitize a string for use in a topic ID.
 * Returns null if the string cannot be sanitized.
 */
export function sanitizeForTopicId(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  // Convert to lowercase
  let sanitized = input.toLowerCase().trim();
  
  // Replace spaces and hyphens with underscores
  sanitized = sanitized.replace(/[\s-]+/g, '_');
  
  // Remove any characters that aren't letters, digits, underscores, or colons
  sanitized = sanitized.replace(/[^a-z0-9_:]/g, '');
  
  // Remove consecutive underscores or colons
  sanitized = sanitized.replace(/_+/g, '_').replace(/:+/g, ':');
  
  // Remove leading/trailing underscores from each segment
  sanitized = sanitized
    .split(':')
    .map(s => s.replace(/^_+|_+$/g, ''))
    .filter(s => s.length > 0)
    .join(':');
  
  // Ensure each segment starts with a letter
  const segments = sanitized.split(':');
  const fixedSegments: string[] = [];
  
  for (const segment of segments) {
    if (segment.length === 0) continue;
    
    // Skip if starts with non-letter
    const firstChar = segment.charCodeAt(0);
    if (firstChar < 97 || firstChar > 122) {
      // Try to find first letter
      let letterIndex = -1;
      for (let i = 0; i < segment.length; i++) {
        const code = segment.charCodeAt(i);
        if (code >= 97 && code <= 122) {
          letterIndex = i;
          break;
        }
      }
      
      if (letterIndex === -1) {
        continue; // Skip segment with no letters
      }
      
      fixedSegments.push(segment.slice(letterIndex));
    } else {
      fixedSegments.push(segment);
    }
  }
  
  if (fixedSegments.length === 0) {
    return null;
  }
  
  const result = fixedSegments.join(':');
  
  // Final validation
  if (isValidTopicId(result)) {
    return result;
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOPIC ID UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get the parent topic ID.
 * Returns null for root topics.
 */
export function getParentTopicId(topicId: TopicId): TopicId | null {
  const segments = topicId.split(TOPIC_ID_CONSTRAINTS.SEPARATOR);
  if (segments.length <= 1) {
    return null;
  }
  
  const parentSegments = segments.slice(0, -1);
  return createTopicId(parentSegments.join(TOPIC_ID_CONSTRAINTS.SEPARATOR));
}

/**
 * Get the root topic ID.
 */
export function getRootTopicId(topicId: TopicId): TopicId {
  const segments = topicId.split(TOPIC_ID_CONSTRAINTS.SEPARATOR);
  return createTopicId(segments[0]!);
}

/**
 * Get the depth of a topic ID (number of segments).
 */
export function getTopicDepth(topicId: TopicId): number {
  return topicId.split(TOPIC_ID_CONSTRAINTS.SEPARATOR).length;
}

/**
 * Check if one topic is an ancestor of another.
 */
export function isAncestorOf(ancestor: TopicId, descendant: TopicId): boolean {
  if (ancestor === descendant) {
    return false;
  }
  
  return descendant.startsWith(ancestor + TOPIC_ID_CONSTRAINTS.SEPARATOR);
}

/**
 * Check if one topic is a descendant of another.
 */
export function isDescendantOf(descendant: TopicId, ancestor: TopicId): boolean {
  return isAncestorOf(ancestor, descendant);
}

/**
 * Get all ancestor topic IDs (from immediate parent to root).
 */
export function getAncestors(topicId: TopicId): TopicId[] {
  const ancestors: TopicId[] = [];
  let current = getParentTopicId(topicId);
  
  while (current !== null) {
    ancestors.push(current);
    current = getParentTopicId(current);
  }
  
  return ancestors;
}

/**
 * Get the path from root to this topic (including the topic itself).
 */
export function getTopicPath(topicId: TopicId): TopicId[] {
  const path = getAncestors(topicId).reverse();
  path.push(topicId);
  return path;
}

/**
 * Find the common ancestor of two topics.
 * Returns null if they share no common ancestor.
 */
export function getCommonAncestor(topic1: TopicId, topic2: TopicId): TopicId | null {
  const segments1 = topic1.split(TOPIC_ID_CONSTRAINTS.SEPARATOR);
  const segments2 = topic2.split(TOPIC_ID_CONSTRAINTS.SEPARATOR);
  
  const commonSegments: string[] = [];
  const minLength = Math.min(segments1.length, segments2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (segments1[i] === segments2[i]) {
      commonSegments.push(segments1[i]!);
    } else {
      break;
    }
  }
  
  if (commonSegments.length === 0) {
    return null;
  }
  
  return createTopicId(commonSegments.join(TOPIC_ID_CONSTRAINTS.SEPARATOR));
}

/**
 * Create a child topic ID.
 */
export function createChildTopicId(parent: TopicId, childSegment: string): Result<TopicId, TopicIdError> {
  const segmentResult = validateSegment(childSegment, 0);
  if (!segmentResult.ok) {
    return segmentResult;
  }
  
  const childId = `${parent}${TOPIC_ID_CONSTRAINTS.SEPARATOR}${segmentResult.value}`;
  return validateTopicId(childId);
}
