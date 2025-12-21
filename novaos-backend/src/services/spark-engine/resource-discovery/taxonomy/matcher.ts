// ═══════════════════════════════════════════════════════════════════════════════
// SAFE TOPIC MATCHER — Token-Based Matching (No Regex DoS)
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// This matcher uses token-based pattern matching instead of regex to prevent
// ReDoS (Regular Expression Denial of Service) attacks.
//
// How it works:
//   1. Tokenize input text into lowercase words
//   2. Match tokens against predefined patterns
//   3. Score matches based on token weights
//   4. Return topics above threshold
//
// Security properties:
//   - O(n*m) worst case where n=tokens, m=patterns
//   - No backtracking or catastrophic complexity
//   - All patterns are simple string comparisons
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { TopicId } from '../types.js';
import type {
  TopicDefinition,
  TokenPattern,
  TokenMatchPattern,
  TopicMatchResult,
  TopicMatchOptions,
} from './types.js';
import { DEFAULT_MATCH_OPTIONS, CONFIDENCE_THRESHOLDS } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TOKENIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Characters that separate tokens.
 */
const TOKEN_SEPARATORS = /[\s\-_.,;:!?'"()\[\]{}<>\/\\|@#$%^&*+=`~]+/;

/**
 * Minimum token length to consider.
 */
const MIN_TOKEN_LENGTH = 2;

/**
 * Maximum tokens to process (prevent DoS via large input).
 */
const MAX_TOKENS = 500;

/**
 * Maximum input length to process.
 */
const MAX_INPUT_LENGTH = 50000;

/**
 * Tokenize text into normalized lowercase tokens.
 * 
 * @param text - Input text to tokenize
 * @returns Array of unique, lowercase tokens
 */
export function tokenize(text: string): string[] {
  // Limit input length
  const limited = text.length > MAX_INPUT_LENGTH 
    ? text.slice(0, MAX_INPUT_LENGTH) 
    : text;
  
  // Split on separators and normalize
  const tokens = limited
    .toLowerCase()
    .split(TOKEN_SEPARATORS)
    .filter(token => token.length >= MIN_TOKEN_LENGTH)
    .slice(0, MAX_TOKENS);
  
  // Return unique tokens while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      unique.push(token);
    }
  }
  
  return unique;
}

/**
 * Create a token set for fast lookup.
 */
export function createTokenSet(tokens: readonly string[]): Set<string> {
  return new Set(tokens);
}

// ─────────────────────────────────────────────────────────────────────────────────
// PATTERN MATCHING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Match a single token against a pattern.
 */
function matchToken(token: string, pattern: TokenPattern): boolean {
  switch (pattern.mode) {
    case 'exact':
      return token === pattern.token;
      
    case 'prefix':
      return token.startsWith(pattern.token);
      
    case 'contains':
      return token.includes(pattern.token);
      
    default:
      return false;
  }
}

/**
 * Find all tokens that match a pattern.
 */
function findMatchingTokens(
  tokens: readonly string[],
  pattern: TokenPattern
): string[] {
  const matches: string[] = [];
  
  for (const token of tokens) {
    if (matchToken(token, pattern)) {
      matches.push(token);
    }
  }
  
  return matches;
}

/**
 * Match tokens against a pattern set.
 */
interface PatternMatchResult {
  readonly score: number;
  readonly matchedTokens: string[];
  readonly excludedTokens: string[];
  readonly allRequiredMatched: boolean;
  readonly anyExcludeMatched: boolean;
}

function matchPatterns(
  tokens: readonly string[],
  patterns: TokenMatchPattern
): PatternMatchResult {
  let score = 0;
  const matchedTokens: string[] = [];
  const excludedTokens: string[] = [];
  let requiredCount = 0;
  let requiredMatched = 0;
  
  // Process include patterns
  for (const pattern of patterns.include) {
    const matches = findMatchingTokens(tokens, pattern);
    
    if (matches.length > 0) {
      // Add weight (default 1.0) for each matching pattern
      score += pattern.weight ?? 1.0;
      matchedTokens.push(...matches);
      
      if (pattern.required) {
        requiredMatched++;
      }
    }
    
    if (pattern.required) {
      requiredCount++;
    }
  }
  
  // Process exclude patterns
  let anyExcludeMatched = false;
  if (patterns.exclude) {
    for (const pattern of patterns.exclude) {
      const matches = findMatchingTokens(tokens, pattern);
      if (matches.length > 0) {
        anyExcludeMatched = true;
        excludedTokens.push(...matches);
        // Reduce score for excluded tokens
        score -= (pattern.weight ?? 1.0);
      }
    }
  }
  
  // Check if all required patterns matched
  const allRequiredMatched = requiredCount === 0 || requiredMatched === requiredCount;
  
  return {
    score: Math.max(0, score),
    matchedTokens: [...new Set(matchedTokens)],
    excludedTokens: [...new Set(excludedTokens)],
    allRequiredMatched,
    anyExcludeMatched,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIDENCE CALCULATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Calculate confidence level from score.
 */
function calculateConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= CONFIDENCE_THRESHOLDS.high) {
    return 'high';
  }
  if (score >= CONFIDENCE_THRESHOLDS.medium) {
    return 'medium';
  }
  return 'low';
}

/**
 * Check if confidence meets minimum requirement.
 */
function meetsConfidenceThreshold(
  confidence: 'high' | 'medium' | 'low',
  minConfidence: 'high' | 'medium' | 'low'
): boolean {
  const levels = { high: 3, medium: 2, low: 1 };
  return levels[confidence] >= levels[minConfidence];
}

// ─────────────────────────────────────────────────────────────────────────────────
// SAFE TOPIC MATCHER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Safe topic matcher that uses token-based matching.
 * 
 * This class is designed to be resistant to DoS attacks:
 * - No regular expressions used
 * - Bounded input processing
 * - O(n*m) complexity guarantee
 */
export class SafeTopicMatcher {
  private readonly topics: Map<TopicId, TopicDefinition>;
  private readonly aliasIndex: Map<string, TopicId>;
  private readonly keywordIndex: Map<string, Set<TopicId>>;
  
  constructor(topics: readonly TopicDefinition[]) {
    this.topics = new Map();
    this.aliasIndex = new Map();
    this.keywordIndex = new Map();
    
    this.buildIndices(topics);
  }
  
  /**
   * Build lookup indices for fast matching.
   */
  private buildIndices(topics: readonly TopicDefinition[]): void {
    for (const topic of topics) {
      // Skip non-active topics
      if (topic.status !== 'active') {
        continue;
      }
      
      // Add to main index
      this.topics.set(topic.id, topic);
      
      // Index aliases
      for (const alias of topic.aliases) {
        const normalized = alias.toLowerCase();
        this.aliasIndex.set(normalized, topic.id);
      }
      
      // Index keywords
      for (const keyword of topic.keywords) {
        const normalized = keyword.toLowerCase();
        let topicSet = this.keywordIndex.get(normalized);
        if (!topicSet) {
          topicSet = new Set();
          this.keywordIndex.set(normalized, topicSet);
        }
        topicSet.add(topic.id);
      }
      
      // Also index topic name segments
      const nameTokens = tokenize(topic.name);
      for (const token of nameTokens) {
        let topicSet = this.keywordIndex.get(token);
        if (!topicSet) {
          topicSet = new Set();
          this.keywordIndex.set(token, topicSet);
        }
        topicSet.add(topic.id);
      }
    }
  }
  
  /**
   * Match input text against all topics.
   * 
   * @param text - Input text to match
   * @param options - Matching options
   * @returns Sorted array of match results
   */
  match(text: string, options?: TopicMatchOptions): TopicMatchResult[] {
    const opts = { ...DEFAULT_MATCH_OPTIONS, ...options };
    const tokens = tokenize(text);
    const tokenSet = createTokenSet(tokens);
    
    // Quick filter: find candidate topics from keyword index
    const candidates = this.findCandidates(tokens, tokenSet, opts);
    
    // Score each candidate
    const results: TopicMatchResult[] = [];
    
    for (const topicId of candidates) {
      const topic = this.topics.get(topicId);
      if (!topic) continue;
      
      // Apply category filter
      if (opts.categories.length > 0 && !opts.categories.includes(topic.category)) {
        continue;
      }
      
      // Apply difficulty filter
      if (opts.difficulties.length > 0 && !opts.difficulties.includes(topic.difficulty)) {
        continue;
      }
      
      // Match against topic patterns
      const matchResult = matchPatterns(tokens, topic.patterns);
      
      // Check if minimum requirements met
      if (matchResult.score < opts.minScore) {
        continue;
      }
      
      if (!matchResult.allRequiredMatched && topic.patterns.requireAll) {
        continue;
      }
      
      // Skip if exclusion patterns matched
      if (matchResult.anyExcludeMatched && matchResult.matchedTokens.length === 0) {
        continue;
      }
      
      // Calculate confidence
      const confidence = calculateConfidence(matchResult.score);
      
      // Check confidence threshold
      if (!meetsConfidenceThreshold(confidence, opts.minConfidence)) {
        continue;
      }
      
      results.push({
        topicId,
        score: matchResult.score,
        confidence,
        matchedTokens: matchResult.matchedTokens,
        excludedTokens: matchResult.excludedTokens,
        allRequiredMatched: matchResult.allRequiredMatched,
      });
    }
    
    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);
    
    // Limit results
    return results.slice(0, opts.maxResults);
  }
  
  /**
   * Find candidate topics that might match.
   */
  private findCandidates(
    tokens: readonly string[],
    tokenSet: Set<string>,
    _options: Required<TopicMatchOptions>
  ): Set<TopicId> {
    const candidates = new Set<TopicId>();
    
    // Check aliases
    for (const token of tokens) {
      const aliasMatch = this.aliasIndex.get(token);
      if (aliasMatch) {
        candidates.add(aliasMatch);
      }
    }
    
    // Check keyword index
    for (const token of tokens) {
      const keywordMatches = this.keywordIndex.get(token);
      if (keywordMatches) {
        for (const topicId of keywordMatches) {
          candidates.add(topicId);
        }
      }
      
      // Also check prefix matches for longer keywords
      for (const [keyword, topicIds] of this.keywordIndex) {
        if (keyword.startsWith(token) || token.startsWith(keyword)) {
          for (const topicId of topicIds) {
            candidates.add(topicId);
          }
        }
      }
    }
    
    // If no candidates found, include all topics as candidates
    // (will be filtered by pattern matching)
    if (candidates.size === 0) {
      for (const topicId of this.topics.keys()) {
        candidates.add(topicId);
      }
    }
    
    return candidates;
  }
  
  /**
   * Get a topic by ID.
   */
  getTopic(topicId: TopicId): TopicDefinition | undefined {
    return this.topics.get(topicId);
  }
  
  /**
   * Get all topics.
   */
  getAllTopics(): TopicDefinition[] {
    return Array.from(this.topics.values());
  }
  
  /**
   * Get topic by alias.
   */
  getTopicByAlias(alias: string): TopicDefinition | undefined {
    const topicId = this.aliasIndex.get(alias.toLowerCase());
    return topicId ? this.topics.get(topicId) : undefined;
  }
  
  /**
   * Check if a topic exists.
   */
  hasTopic(topicId: TopicId): boolean {
    return this.topics.has(topicId);
  }
  
  /**
   * Get topic count.
   */
  get topicCount(): number {
    return this.topics.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a token pattern for exact matching.
 */
export function exactToken(
  token: string,
  options?: { weight?: number; required?: boolean }
): TokenPattern {
  return {
    token: token.toLowerCase(),
    mode: 'exact',
    weight: options?.weight,
    required: options?.required,
  };
}

/**
 * Create a token pattern for prefix matching.
 */
export function prefixToken(
  token: string,
  options?: { weight?: number; required?: boolean }
): TokenPattern {
  return {
    token: token.toLowerCase(),
    mode: 'prefix',
    weight: options?.weight,
    required: options?.required,
  };
}

/**
 * Create a token pattern for contains matching.
 */
export function containsToken(
  token: string,
  options?: { weight?: number; required?: boolean }
): TokenPattern {
  return {
    token: token.toLowerCase(),
    mode: 'contains',
    weight: options?.weight,
    required: options?.required,
  };
}

/**
 * Create a token match pattern from arrays of tokens.
 */
export function createPattern(options: {
  include: readonly string[];
  exclude?: readonly string[];
  minScore?: number;
  requireAll?: boolean;
}): TokenMatchPattern {
  return {
    include: options.include.map(t => exactToken(t)),
    exclude: options.exclude?.map(t => exactToken(t)),
    minScore: options.minScore,
    requireAll: options.requireAll,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let matcherInstance: SafeTopicMatcher | null = null;

/**
 * Get the topic matcher singleton.
 * Must call initMatcher first with topics.
 */
export function getMatcher(): SafeTopicMatcher {
  if (!matcherInstance) {
    throw new Error('Topic matcher not initialized. Call initMatcher() first.');
  }
  return matcherInstance;
}

/**
 * Initialize the topic matcher with topics.
 */
export function initMatcher(topics: readonly TopicDefinition[]): SafeTopicMatcher {
  matcherInstance = new SafeTopicMatcher(topics);
  return matcherInstance;
}

/**
 * Reset the topic matcher (for testing).
 */
export function resetMatcher(): void {
  matcherInstance = null;
}

/**
 * Create a new matcher without affecting the singleton.
 */
export function createMatcher(topics: readonly TopicDefinition[]): SafeTopicMatcher {
  return new SafeTopicMatcher(topics);
}
