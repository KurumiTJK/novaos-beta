// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY GATE — Patterns
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LOOSE KEYWORD FILTER (Router)
// Fast pre-filter to skip 95% of messages
// ─────────────────────────────────────────────────────────────────────────────────

export const MEMORY_KEYWORDS = /\b(remember|memory|forget|note|save|store|keep track|don't forget|recall)\b/i;

/**
 * Check if message contains any memory-related keyword.
 * Used by router to quickly skip irrelevant messages.
 */
export function hasMemoryKeyword(message: string): boolean {
  return MEMORY_KEYWORDS.test(message);
}

// ─────────────────────────────────────────────────────────────────────────────────
// STRONG PATTERNS (Explicit Memory Requests)
// These patterns clearly indicate user wants Nova to remember something
// ─────────────────────────────────────────────────────────────────────────────────

export const STRONG_PATTERNS = [
  // "remember this/that" patterns
  /\bremember\s+this\b/i,
  /\bremember\s+that\b/i,
  /\bremember:?\s+(.+)/i,
  
  // "don't forget" patterns
  /\bdon'?t\s+forget\b/i,
  
  // "keep in mind" patterns
  /\bkeep\s+(this\s+)?in\s+mind\b/i,
  
  // "note this/that" patterns
  /\bnote\s+(this|that)\b/i,
  /\bnote:?\s+(.+)/i,
  
  // "save this" patterns
  /\bsave\s+this\b/i,
  
  // "store this" patterns
  /\bstore\s+this\b/i,
];

/**
 * Check if message matches any strong memory pattern.
 * Returns the matched pattern or null.
 */
export function matchStrongPattern(message: string): RegExpMatchArray | null {
  for (const pattern of STRONG_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return match;
    }
  }
  return null;
}
