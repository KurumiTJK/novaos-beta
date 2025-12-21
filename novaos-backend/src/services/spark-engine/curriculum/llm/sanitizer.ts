// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT SANITIZER — Prompt Injection Protection
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Protects against prompt injection attacks:
//   - Role manipulation ("You are now...", "Ignore previous...")
//   - System prompt injection ("System:", "###")
//   - Unicode abuse (homoglyphs, invisible characters)
//   - Control character injection
//   - Known jailbreak patterns
//
// All external text (resource titles, descriptions) MUST be sanitized
// before inclusion in prompts.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { getLogger } from '../../../../observability/logging/index.js';
import { incCounter } from '../../../../observability/metrics/index.js';
import type {
  PatternSeverity,
  PatternCategory,
  SuspiciousPattern,
  SanitizationResult,
  SanitizedPromptInput,
  SanitizedResourceContext,
  SanitizedResourceSummary,
} from './types.js';
import { SANITIZATION_LIMITS } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'prompt-sanitizer' });

// ─────────────────────────────────────────────────────────────────────────────────
// PATTERN DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Pattern definition for detection.
 */
interface PatternDefinition {
  /** Pattern name */
  readonly name: string;
  
  /** Category */
  readonly category: PatternCategory;
  
  /** Severity */
  readonly severity: PatternSeverity;
  
  /** Detection function */
  readonly detect: (text: string) => PatternMatch[];
  
  /** Whether to block input */
  readonly shouldBlock: boolean;
  
  /** Description */
  readonly description: string;
}

/**
 * Match result from pattern detection.
 */
interface PatternMatch {
  readonly matchedText: string;
  readonly start: number;
  readonly end: number;
}

/**
 * All pattern definitions.
 */
const PATTERNS: readonly PatternDefinition[] = [
  // ───────────────────────────────────────────────────────────────────────────
  // CRITICAL: Block immediately
  // ───────────────────────────────────────────────────────────────────────────
  {
    name: 'ignore_previous_instructions',
    category: 'instruction_override',
    severity: 'critical',
    shouldBlock: true,
    description: 'Attempts to override previous instructions',
    detect: (text) => {
      const patterns = [
        /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|guidelines?|prompts?)/gi,
        /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|guidelines?)/gi,
        /forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|context)/gi,
        /override\s+(all\s+)?(previous|prior|system)\s+(instructions?|rules?|prompts?)/gi,
        /do\s+not\s+follow\s+(previous|prior|the)\s+(instructions?|rules?|guidelines?)/gi,
      ];
      return matchPatterns(text, patterns);
    },
  },
  {
    name: 'system_prompt_injection',
    category: 'system_injection',
    severity: 'critical',
    shouldBlock: true,
    description: 'Attempts to inject system-level prompts',
    detect: (text) => {
      const patterns = [
        /^system\s*:/gim,
        /\[system\]/gi,
        /\[INST\]/gi,
        /\[\/INST\]/gi,
        /<<\s*SYS\s*>>/gi,
        /<<\s*\/SYS\s*>>/gi,
        /<\|system\|>/gi,
        /<\|user\|>/gi,
        /<\|assistant\|>/gi,
        /###\s*(system|instruction|human|assistant)\s*:/gi,
      ];
      return matchPatterns(text, patterns);
    },
  },
  {
    name: 'role_hijacking',
    category: 'role_manipulation',
    severity: 'critical',
    shouldBlock: true,
    description: 'Attempts to change AI role or identity',
    detect: (text) => {
      const patterns = [
        /you\s+are\s+(now|actually|really)\s+(a|an|the)/gi,
        /from\s+now\s+on,?\s+you\s+(are|will\s+be|act\s+as)/gi,
        /pretend\s+(to\s+be|you\s+are|you're)\s+(a|an|the)/gi,
        /act\s+as\s+(if\s+you\s+are|though\s+you\s+are)\s+(a|an)/gi,
        /roleplay\s+as\s+(a|an|the)/gi,
        /your\s+new\s+(role|identity|persona)\s+is/gi,
        /switch\s+(to|into)\s+(a|an|the)\s+new\s+(role|mode|persona)/gi,
      ];
      return matchPatterns(text, patterns);
    },
  },
  {
    name: 'jailbreak_dan',
    category: 'jailbreak',
    severity: 'critical',
    shouldBlock: true,
    description: 'Known DAN jailbreak patterns',
    detect: (text) => {
      const patterns = [
        /\bDAN\b.*\bdo\s+anything\s+now\b/gi,
        /\bdo\s+anything\s+now\b.*\bDAN\b/gi,
        /jailbreak(ed|ing)?\s+(mode|prompt)/gi,
        /\bdeveloper\s+mode\b/gi,
        /\bunlock(ed)?\s+mode\b/gi,
        /\bno\s+restrictions?\s+mode\b/gi,
      ];
      return matchPatterns(text, patterns);
    },
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // HIGH: Block and log
  // ───────────────────────────────────────────────────────────────────────────
  {
    name: 'prompt_leaking',
    category: 'prompt_leaking',
    severity: 'high',
    shouldBlock: true,
    description: 'Attempts to extract system prompt',
    detect: (text) => {
      const patterns = [
        /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/gi,
        /reveal\s+(your|the)\s+(system\s+)?prompt/gi,
        /print\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
        /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions?|rules?)/gi,
        /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
        /display\s+(your|the)\s+(initial|system)\s+(prompt|instructions?)/gi,
        /output\s+(your|the)\s+(system\s+)?(prompt|instructions?)\s+verbatim/gi,
      ];
      return matchPatterns(text, patterns);
    },
  },
  {
    name: 'data_exfiltration',
    category: 'data_exfiltration',
    severity: 'high',
    shouldBlock: true,
    description: 'Attempts to extract sensitive data',
    detect: (text) => {
      const patterns = [
        /list\s+(all\s+)?(your|the)\s+(api\s+)?keys?/gi,
        /show\s+(me\s+)?(your|the)\s+(api\s+)?credentials?/gi,
        /what\s+(is|are)\s+(your|the)\s+(api\s+)?secrets?/gi,
        /reveal\s+(your|the)\s+training\s+data/gi,
        /export\s+(all\s+)?(user|customer)\s+data/gi,
      ];
      return matchPatterns(text, patterns);
    },
  },
  {
    name: 'resource_fabrication',
    category: 'resource_fabrication',
    severity: 'high',
    shouldBlock: true,
    description: 'Attempts to inject fake resources',
    detect: (text) => {
      const patterns = [
        /add\s+(this|the\s+following)\s+(resource|url|link)\s*:/gi,
        /include\s+(this|my)\s+(resource|url|link)\s+in\s+the\s+(list|output)/gi,
        /insert\s+(a\s+)?new\s+(resource|url|link)/gi,
        /pretend\s+(this|the\s+following)\s+(is|are)\s+(a\s+)?(verified|valid)\s+resource/gi,
      ];
      return matchPatterns(text, patterns);
    },
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // MEDIUM: Sanitize and warn
  // ───────────────────────────────────────────────────────────────────────────
  {
    name: 'markdown_injection',
    category: 'system_injection',
    severity: 'medium',
    shouldBlock: false,
    description: 'Markdown that could affect parsing',
    detect: (text) => {
      const patterns = [
        /```(system|assistant|user)/gi,
        /#{3,}\s*(system|instruction|prompt)/gi,
      ];
      return matchPatterns(text, patterns);
    },
  },
  {
    name: 'indirect_instruction',
    category: 'instruction_override',
    severity: 'medium',
    shouldBlock: false,
    description: 'Indirect instruction manipulation',
    detect: (text) => {
      const patterns = [
        /the\s+user\s+wants\s+you\s+to/gi,
        /the\s+instructions?\s+(say|tell|want)/gi,
        /according\s+to\s+(your|the)\s+instructions?/gi,
      ];
      return matchPatterns(text, patterns);
    },
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // LOW: Log only
  // ───────────────────────────────────────────────────────────────────────────
  {
    name: 'suspicious_formatting',
    category: 'system_injection',
    severity: 'low',
    shouldBlock: false,
    description: 'Unusual formatting that may indicate injection',
    detect: (text) => {
      const patterns = [
        /\n{5,}/g,  // Excessive newlines
        /\t{5,}/g,  // Excessive tabs
      ];
      return matchPatterns(text, patterns);
    },
  },
];

/**
 * Helper to match multiple regex patterns.
 */
function matchPatterns(text: string, patterns: RegExp[]): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const pattern of patterns) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        matchedText: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────────────
// UNICODE NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Homoglyph mappings (confusable characters → ASCII).
 */
const HOMOGLYPHS: ReadonlyMap<string, string> = new Map([
  // Cyrillic lookalikes
  ['а', 'a'], ['е', 'e'], ['о', 'o'], ['р', 'p'], ['с', 'c'], ['у', 'y'], ['х', 'x'],
  ['А', 'A'], ['В', 'B'], ['Е', 'E'], ['К', 'K'], ['М', 'M'], ['Н', 'H'], ['О', 'O'],
  ['Р', 'P'], ['С', 'C'], ['Т', 'T'], ['Х', 'X'],
  // Greek lookalikes
  ['α', 'a'], ['ο', 'o'], ['ν', 'v'], ['ρ', 'p'], ['τ', 't'],
  ['Α', 'A'], ['Β', 'B'], ['Ε', 'E'], ['Η', 'H'], ['Ι', 'I'], ['Κ', 'K'], ['Μ', 'M'],
  ['Ν', 'N'], ['Ο', 'O'], ['Ρ', 'P'], ['Τ', 'T'], ['Υ', 'Y'], ['Χ', 'X'], ['Ζ', 'Z'],
  // Special characters
  ['ı', 'i'], ['ȷ', 'j'], ['ⅰ', 'i'], ['ⅱ', 'ii'], ['ⅲ', 'iii'],
  // Fullwidth
  ['ａ', 'a'], ['ｂ', 'b'], ['ｃ', 'c'], ['ｄ', 'd'], ['ｅ', 'e'], ['ｆ', 'f'],
  ['０', '0'], ['１', '1'], ['２', '2'], ['３', '3'], ['４', '4'],
]);

/**
 * Normalize unicode homoglyphs to ASCII.
 */
function normalizeHomoglyphs(text: string): string {
  let result = '';
  for (const char of text) {
    result += HOMOGLYPHS.get(char) ?? char;
  }
  return result;
}

/**
 * Check if text contains homoglyphs.
 */
function containsHomoglyphs(text: string): boolean {
  for (const char of text) {
    if (HOMOGLYPHS.has(char)) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTROL CHARACTER HANDLING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Control characters to strip (except newline, tab, carriage return).
 */
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Zero-width and invisible characters.
 */
const INVISIBLE_CHAR_REGEX = /[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g;

/**
 * Strip control and invisible characters.
 */
function stripControlChars(text: string): string {
  return text
    .replace(CONTROL_CHAR_REGEX, '')
    .replace(INVISIBLE_CHAR_REGEX, '');
}

/**
 * Check if text contains control characters.
 */
function containsControlChars(text: string): boolean {
  return CONTROL_CHAR_REGEX.test(text) || INVISIBLE_CHAR_REGEX.test(text);
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize text for use in prompts.
 */
export function sanitizeText(text: string): SanitizationResult {
  const originalLength = text.length;
  const patterns: SuspiciousPattern[] = [];
  let sanitized = text;
  let shouldBlock = false;
  let blockReason: string | undefined;
  
  // Check length limit
  if (text.length > SANITIZATION_LIMITS.MAX_INPUT_LENGTH) {
    sanitized = text.slice(0, SANITIZATION_LIMITS.MAX_INPUT_LENGTH);
  }
  
  // Track modifications
  const hadHomoglyphs = containsHomoglyphs(sanitized);
  const hadControlChars = containsControlChars(sanitized);
  
  // Normalize homoglyphs
  if (hadHomoglyphs) {
    sanitized = normalizeHomoglyphs(sanitized);
    patterns.push({
      category: 'unicode_abuse',
      severity: 'medium',
      description: 'Unicode homoglyphs detected and normalized',
      matchedText: '[homoglyphs]',
      position: { start: 0, end: 0 },
      shouldBlock: false,
    });
  }
  
  // Strip control characters
  if (hadControlChars) {
    sanitized = stripControlChars(sanitized);
    patterns.push({
      category: 'unicode_abuse',
      severity: 'medium',
      description: 'Control/invisible characters detected and removed',
      matchedText: '[control chars]',
      position: { start: 0, end: 0 },
      shouldBlock: false,
    });
  }
  
  // Detect injection patterns
  for (const patternDef of PATTERNS) {
    const matches = patternDef.detect(sanitized);
    
    for (const match of matches) {
      const pattern: SuspiciousPattern = {
        category: patternDef.category,
        severity: patternDef.severity,
        description: patternDef.description,
        matchedText: redactMatch(match.matchedText),
        position: { start: match.start, end: match.end },
        shouldBlock: patternDef.shouldBlock,
      };
      
      patterns.push(pattern);
      
      if (patternDef.shouldBlock) {
        shouldBlock = true;
        blockReason = `${patternDef.category}: ${patternDef.description}`;
      }
      
      // Log detection
      logger.warn('Suspicious pattern detected', {
        category: patternDef.category,
        severity: patternDef.severity,
        pattern: patternDef.name,
      });
      
      incCounter('prompt_injection_detected', {
        category: patternDef.category,
        severity: patternDef.severity,
      });
    }
  }
  
  // If blocked, don't return the sanitized text
  if (shouldBlock) {
    sanitized = '';
  }
  
  return {
    sanitizedText: sanitized,
    wasModified: sanitized !== text,
    patterns,
    shouldBlock,
    blockReason,
    metadata: {
      originalLength,
      sanitizedLength: sanitized.length,
      charactersRemoved: originalLength - sanitized.length,
      unicodeNormalized: hadHomoglyphs,
      controlCharsStripped: hadControlChars,
    },
  };
}

/**
 * Redact matched text for logging (don't log full injection attempts).
 */
function redactMatch(text: string): string {
  if (text.length <= 20) {
    return text;
  }
  return text.slice(0, 10) + '...' + text.slice(-5);
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE TEXT SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize external resource text (titles, descriptions).
 * More aggressive than general sanitization.
 */
export function sanitizeResourceText(
  text: string,
  maxLength: number = SANITIZATION_LIMITS.MAX_RESOURCE_DESCRIPTION
): string {
  // First pass: general sanitization
  const result = sanitizeText(text);
  
  if (result.shouldBlock) {
    return '[Content removed for security]';
  }
  
  let sanitized = result.sanitizedText;
  
  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength - 3) + '...';
  }
  
  // Remove any remaining suspicious sequences
  sanitized = sanitized
    .replace(/\n{3,}/g, '\n\n')  // Collapse multiple newlines
    .replace(/\s{3,}/g, ' ')     // Collapse multiple spaces
    .trim();
  
  // Escape special characters that could affect prompt parsing
  sanitized = escapePromptChars(sanitized);
  
  return sanitized;
}

/**
 * Escape characters that could affect prompt parsing.
 */
function escapePromptChars(text: string): string {
  return text
    .replace(/\\/g, '\\\\')     // Escape backslashes
    .replace(/`/g, "'")         // Replace backticks with single quotes
    .replace(/\$/g, 'S')        // Replace dollar signs
    .replace(/{/g, '(')         // Replace curly braces
    .replace(/}/g, ')');
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROMPT INPUT SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize a complete prompt input.
 */
export function sanitizePromptInput(
  systemPrompt: string,
  userPrompt: string,
  resourceContext?: SanitizedResourceContext
): SanitizedPromptInput {
  // Sanitize system prompt (should be trusted, but verify)
  const systemResult = sanitizeText(systemPrompt);
  
  // Sanitize user prompt
  const userResult = sanitizeText(userPrompt);
  
  // Combine results
  const allPatterns = [...systemResult.patterns, ...userResult.patterns];
  const shouldBlock = systemResult.shouldBlock || userResult.shouldBlock;
  
  const combinedResult: SanitizationResult = {
    sanitizedText: userResult.sanitizedText,
    wasModified: systemResult.wasModified || userResult.wasModified,
    patterns: allPatterns,
    shouldBlock,
    blockReason: systemResult.blockReason ?? userResult.blockReason,
    metadata: {
      originalLength: systemPrompt.length + userPrompt.length,
      sanitizedLength: systemResult.sanitizedText.length + userResult.sanitizedText.length,
      charactersRemoved: (systemPrompt.length - systemResult.sanitizedText.length) +
                         (userPrompt.length - userResult.sanitizedText.length),
      unicodeNormalized: systemResult.metadata.unicodeNormalized || 
                         userResult.metadata.unicodeNormalized,
      controlCharsStripped: systemResult.metadata.controlCharsStripped ||
                            userResult.metadata.controlCharsStripped,
    },
  };
  
  return {
    systemPrompt: systemResult.sanitizedText,
    userPrompt: userResult.sanitizedText,
    sanitization: combinedResult,
    resourceContext,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE CONTEXT SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Resource input for sanitization.
 */
export interface ResourceInput {
  readonly title: string;
  readonly description?: string;
  readonly provider: string;
  readonly estimatedMinutes?: number;
  readonly difficulty?: string;
  readonly topics?: readonly string[];
}

/**
 * Sanitize a list of resources for inclusion in prompts.
 */
export function sanitizeResourceContext(
  resources: readonly ResourceInput[]
): SanitizedResourceContext {
  const sanitized: SanitizedResourceSummary[] = [];
  let filteredCount = 0;
  
  // Limit number of resources
  const maxResources = Math.min(resources.length, SANITIZATION_LIMITS.MAX_RESOURCES_IN_CONTEXT);
  
  for (let i = 0; i < maxResources; i++) {
    const resource = resources[i]!;
    
    // Sanitize title
    const title = sanitizeResourceText(
      resource.title,
      SANITIZATION_LIMITS.MAX_RESOURCE_TITLE
    );
    
    // Skip if title was completely sanitized away
    if (title === '[Content removed for security]' || title.length < 3) {
      filteredCount++;
      continue;
    }
    
    // Sanitize description
    const description = resource.description
      ? sanitizeResourceText(resource.description, SANITIZATION_LIMITS.MAX_RESOURCE_DESCRIPTION)
      : '';
    
    // Sanitize topics (just alphanumeric and basic punctuation)
    const topics = (resource.topics ?? [])
      .slice(0, 5)
      .map(t => t.replace(/[^a-zA-Z0-9\s\-:]/g, '').trim())
      .filter(t => t.length > 0);
    
    sanitized.push({
      index: sanitized.length + 1, // 1-based index
      title,
      description,
      provider: resource.provider.replace(/[^a-zA-Z0-9]/g, ''),
      estimatedMinutes: resource.estimatedMinutes ?? 0,
      difficulty: (resource.difficulty ?? 'intermediate').replace(/[^a-zA-Z]/g, ''),
      topics,
    });
  }
  
  // Track filtered resources
  filteredCount += resources.length - maxResources;
  
  return {
    resources: sanitized,
    totalCount: sanitized.length,
    filteredCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  normalizeHomoglyphs,
  stripControlChars,
  containsHomoglyphs,
  containsControlChars,
  escapePromptChars,
};
