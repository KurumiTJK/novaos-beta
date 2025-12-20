// ═══════════════════════════════════════════════════════════════════════════════
// REGEX UTILITIES — Safe Regular Expression Handling
// Avoids common pitfalls with global regex state (lastIndex)
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// THE PROBLEM WITH GLOBAL REGEX
// ─────────────────────────────────────────────────────────────────────────────────
//
// JavaScript RegExp with 'g' flag maintains state via lastIndex:
//
//   const re = /a/g;
//   re.test('a');  // true, lastIndex = 1
//   re.test('a');  // false! lastIndex was 1, no 'a' at position 1
//   re.test('a');  // true, lastIndex reset to 0 after failure
//
// This causes subtle bugs when reusing regex patterns. These utilities
// ensure consistent behavior by always resetting lastIndex or creating
// fresh regex instances.
//
// ─────────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────────
// FRESH REGEX
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a fresh copy of a RegExp with lastIndex reset to 0.
 * 
 * Use this when you need to reuse a regex pattern but want to ensure
 * consistent behavior regardless of previous usage.
 * 
 * @param pattern - The regex pattern to copy
 * @returns A new RegExp instance with the same pattern and flags
 * 
 * @example
 * const pattern = /\d+/g;
 * pattern.test('123'); // true, lastIndex = 3
 * 
 * const fresh = freshRegex(pattern);
 * fresh.test('123'); // true, starts from 0
 */
export function freshRegex(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags);
}

/**
 * Reset the lastIndex of a RegExp to 0 (mutates the regex).
 * 
 * Use this when you want to reuse the same regex instance but
 * need to restart matching from the beginning.
 * 
 * @param pattern - The regex to reset
 * @returns The same regex instance with lastIndex = 0
 * 
 * @example
 * const re = /a/g;
 * re.exec('aaa'); // match at 0
 * re.exec('aaa'); // match at 1
 * resetRegex(re);
 * re.exec('aaa'); // match at 0 again
 */
export function resetRegex(pattern: RegExp): RegExp {
  pattern.lastIndex = 0;
  return pattern;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SAFE TEST
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Safely test a string against a regex pattern.
 * 
 * Always resets lastIndex before testing, ensuring consistent results
 * regardless of previous regex usage.
 * 
 * @param pattern - The regex pattern to test
 * @param str - The string to test against
 * @returns True if the pattern matches
 * 
 * @example
 * const pattern = /hello/gi;
 * safeTest(pattern, 'Hello World'); // true
 * safeTest(pattern, 'Hello World'); // true (always consistent)
 */
export function safeTest(pattern: RegExp, str: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(str);
}

/**
 * Test if a string matches a pattern, creating a fresh regex.
 * 
 * Use this when you cannot mutate the original regex.
 * 
 * @param pattern - The regex pattern to test
 * @param str - The string to test against
 * @returns True if the pattern matches
 */
export function safeTestImmutable(pattern: RegExp, str: string): boolean {
  const fresh = new RegExp(pattern.source, pattern.flags);
  return fresh.test(str);
}

// ─────────────────────────────────────────────────────────────────────────────────
// SAFE MATCH ALL
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Safely get all matches for a pattern in a string.
 * 
 * Works with both global and non-global patterns. For non-global patterns,
 * returns at most one match (like String.prototype.match).
 * 
 * Always returns an array (never null) and resets lastIndex.
 * 
 * @param pattern - The regex pattern (should have 'g' flag for multiple matches)
 * @param str - The string to search
 * @returns Array of match results (empty array if no matches)
 * 
 * @example
 * const pattern = /\d+/g;
 * safeMatchAll(pattern, 'a1b2c3'); // [['1'], ['2'], ['3']]
 * safeMatchAll(pattern, 'abc');    // []
 */
export function safeMatchAll(pattern: RegExp, str: string): RegExpMatchArray[] {
  // Ensure global flag for matchAll behavior
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const regex = new RegExp(pattern.source, flags);
  
  const results: RegExpMatchArray[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = regex.exec(str)) !== null) {
    results.push(match);
    
    // Prevent infinite loop on zero-length matches
    if (match[0].length === 0) {
      regex.lastIndex++;
    }
  }
  
  return results;
}

/**
 * Get all match strings (not full match objects) for a pattern.
 * 
 * Simpler version of safeMatchAll that returns just the matched strings.
 * 
 * @param pattern - The regex pattern
 * @param str - The string to search
 * @returns Array of matched strings
 * 
 * @example
 * safeMatchStrings(/\d+/g, 'a1b22c333'); // ['1', '22', '333']
 */
export function safeMatchStrings(pattern: RegExp, str: string): string[] {
  return safeMatchAll(pattern, str).map(match => match[0]);
}

// ─────────────────────────────────────────────────────────────────────────────────
// SAFE EXEC
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Safely execute a regex and return the first match.
 * 
 * Resets lastIndex before executing, ensuring consistent results.
 * 
 * @param pattern - The regex pattern
 * @param str - The string to search
 * @returns The match result or null if no match
 * 
 * @example
 * const pattern = /(\d+)/g;
 * safeExec(pattern, 'a123b'); // ['123', '123', index: 1, ...]
 */
export function safeExec(pattern: RegExp, str: string): RegExpExecArray | null {
  pattern.lastIndex = 0;
  return pattern.exec(str);
}

/**
 * Safely execute a regex without mutating the original.
 * 
 * @param pattern - The regex pattern
 * @param str - The string to search
 * @returns The match result or null if no match
 */
export function safeExecImmutable(pattern: RegExp, str: string): RegExpExecArray | null {
  const fresh = new RegExp(pattern.source, pattern.flags);
  return fresh.exec(str);
}

// ─────────────────────────────────────────────────────────────────────────────────
// SAFE REPLACE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Safely replace matches in a string.
 * 
 * Resets lastIndex before replacing.
 * 
 * @param pattern - The regex pattern
 * @param str - The string to search
 * @param replacement - The replacement string or function
 * @returns The string with replacements made
 */
export function safeReplace(
  pattern: RegExp,
  str: string,
  replacement: string | ((match: string, ...args: unknown[]) => string)
): string {
  pattern.lastIndex = 0;
  return str.replace(pattern, replacement as string);
}

/**
 * Safely replace all matches in a string.
 * 
 * Ensures global replacement even if the pattern doesn't have 'g' flag.
 * 
 * @param pattern - The regex pattern
 * @param str - The string to search
 * @param replacement - The replacement string or function
 * @returns The string with all replacements made
 */
export function safeReplaceAll(
  pattern: RegExp,
  str: string,
  replacement: string | ((match: string, ...args: unknown[]) => string)
): string {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const regex = new RegExp(pattern.source, flags);
  return str.replace(regex, replacement as string);
}

// ─────────────────────────────────────────────────────────────────────────────────
// SAFE SPLIT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Safely split a string by a regex pattern.
 * 
 * @param pattern - The regex pattern to split on
 * @param str - The string to split
 * @param limit - Maximum number of splits (optional)
 * @returns Array of split strings
 */
export function safeSplit(
  pattern: RegExp,
  str: string,
  limit?: number
): string[] {
  pattern.lastIndex = 0;
  return str.split(pattern, limit);
}

// ─────────────────────────────────────────────────────────────────────────────────
// PATTERN BUILDERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Escape special regex characters in a string.
 * 
 * Use this when you need to match a literal string that may contain
 * regex metacharacters.
 * 
 * @param str - The string to escape
 * @returns String with regex metacharacters escaped
 * 
 * @example
 * escapeRegex('$100.00'); // '\\$100\\.00'
 * new RegExp(escapeRegex('$100.00')).test('$100.00'); // true
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a regex that matches any of the given literal strings.
 * 
 * @param strings - Array of strings to match
 * @param flags - Regex flags (default: '')
 * @returns RegExp that matches any of the strings
 * 
 * @example
 * const re = createAlternation(['cat', 'dog', 'bird']);
 * re.test('I have a cat'); // true
 */
export function createAlternation(strings: string[], flags: string = ''): RegExp {
  if (strings.length === 0) {
    // Return a regex that never matches
    return new RegExp('(?!)', flags);
  }
  
  const escaped = strings.map(escapeRegex);
  // Sort by length descending to match longer strings first
  escaped.sort((a, b) => b.length - a.length);
  
  return new RegExp(`(?:${escaped.join('|')})`, flags);
}

/**
 * Create a word-boundary regex for matching whole words.
 * 
 * @param word - The word to match
 * @param flags - Regex flags (default: '')
 * @returns RegExp that matches the word with word boundaries
 * 
 * @example
 * const re = createWordBoundary('cat');
 * re.test('cat');      // true
 * re.test('category'); // false
 */
export function createWordBoundary(word: string, flags: string = ''): RegExp {
  return new RegExp(`\\b${escapeRegex(word)}\\b`, flags);
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a string is a valid regex pattern.
 * 
 * @param pattern - The pattern string to validate
 * @returns True if the pattern is valid
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt to create a RegExp, returning null on failure.
 * 
 * @param pattern - The pattern string
 * @param flags - The flags string
 * @returns RegExp or null if invalid
 */
export function tryCreateRegex(pattern: string, flags: string = ''): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// MATCH POSITION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Information about a match including position.
 */
export interface MatchInfo {
  /** The matched text */
  match: string;
  /** Start index in the original string */
  start: number;
  /** End index (exclusive) in the original string */
  end: number;
  /** Captured groups (if any) */
  groups: string[];
  /** Named groups (if any) */
  namedGroups: Record<string, string>;
}

/**
 * Get all matches with position information.
 * 
 * @param pattern - The regex pattern (should have 'g' flag)
 * @param str - The string to search
 * @returns Array of match info objects
 * 
 * @example
 * const matches = getMatchesWithPositions(/\d+/g, 'a1b22c333');
 * // [
 * //   { match: '1', start: 1, end: 2, groups: [], namedGroups: {} },
 * //   { match: '22', start: 3, end: 5, groups: [], namedGroups: {} },
 * //   { match: '333', start: 6, end: 9, groups: [], namedGroups: {} }
 * // ]
 */
export function getMatchesWithPositions(pattern: RegExp, str: string): MatchInfo[] {
  const matches = safeMatchAll(pattern, str);
  
  return matches.map(match => ({
    match: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    groups: match.slice(1).filter((g): g is string => g !== undefined),
    namedGroups: match.groups ?? {},
  }));
}

/**
 * Check if any match overlaps with a given range.
 * 
 * @param matches - Array of match info
 * @param start - Range start
 * @param end - Range end
 * @returns True if any match overlaps
 */
export function hasOverlappingMatch(
  matches: MatchInfo[],
  start: number,
  end: number
): boolean {
  return matches.some(m => m.start < end && m.end > start);
}
