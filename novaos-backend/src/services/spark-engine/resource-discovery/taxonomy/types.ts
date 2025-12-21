// ═══════════════════════════════════════════════════════════════════════════════
// TAXONOMY TYPES — Topic Definitions and Matching Patterns
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// Topics are organized hierarchically:
//   - language:rust
//   - language:rust:ownership
//   - language:rust:ownership:borrowing
//
// Matching uses token-based patterns to avoid regex DoS vulnerabilities.
// All string matching is done with normalized tokens, not regex.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { TopicId } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TOPIC HIERARCHY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Topic category (top-level classification).
 */
export type TopicCategory =
  | 'language'      // Programming languages
  | 'framework'     // Frameworks and libraries
  | 'tool'          // Development tools
  | 'concept'       // CS concepts
  | 'platform'      // Platforms (web, mobile, cloud)
  | 'practice'      // Best practices
  | 'domain';       // Application domains

/**
 * Difficulty level for topic content.
 */
export type TopicDifficulty =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

/**
 * Topic status in the registry.
 */
export type TopicStatus =
  | 'active'        // Available for matching
  | 'deprecated'    // Being phased out
  | 'draft';        // Not yet ready

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN MATCHING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Token match mode.
 * - exact: Token must match exactly
 * - prefix: Token must start with pattern
 * - contains: Token must contain pattern
 */
export type TokenMatchMode = 'exact' | 'prefix' | 'contains';

/**
 * A single token match pattern.
 * 
 * Uses normalized lowercase tokens, not regex.
 * This prevents ReDoS attacks.
 */
export interface TokenPattern {
  /** The token to match (lowercase, normalized) */
  readonly token: string;
  
  /** How to match the token */
  readonly mode: TokenMatchMode;
  
  /** Weight for scoring (default: 1.0) */
  readonly weight?: number;
  
  /** Whether this is a required token (all required must match) */
  readonly required?: boolean;
}

/**
 * A set of token patterns for matching.
 * 
 * Match logic:
 * - All required tokens must match
 * - Score is sum of matched token weights
 * - Minimum score threshold for positive match
 */
export interface TokenMatchPattern {
  /** Patterns that indicate this topic */
  readonly include: readonly TokenPattern[];
  
  /** Patterns that indicate NOT this topic (negative signal) */
  readonly exclude?: readonly TokenPattern[];
  
  /** Minimum score for a positive match (default: 1.0) */
  readonly minScore?: number;
  
  /** All required patterns must match */
  readonly requireAll?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOPIC DEFINITION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Complete topic definition.
 */
export interface TopicDefinition {
  /** Unique topic ID (hierarchical, e.g., "language:rust:ownership") */
  readonly id: TopicId;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Brief description */
  readonly description: string;
  
  /** Top-level category */
  readonly category: TopicCategory;
  
  /** Parent topic ID (null for root topics) */
  readonly parentId: TopicId | null;
  
  /** Typical difficulty level */
  readonly difficulty: TopicDifficulty;
  
  /** Status */
  readonly status: TopicStatus;
  
  /** Token patterns for matching */
  readonly patterns: TokenMatchPattern;
  
  /** Alternative names/aliases (normalized) */
  readonly aliases: readonly string[];
  
  /** Related topics (for recommendations) */
  readonly relatedTopics: readonly TopicId[];
  
  /** Prerequisite topics (for ordering) */
  readonly prerequisites: readonly TopicId[];
  
  /** Child topic IDs */
  readonly childIds: readonly TopicId[];
  
  /** Search keywords (additional tokens for matching) */
  readonly keywords: readonly string[];
  
  /** Metadata */
  readonly metadata: TopicMetadata;
}

/**
 * Topic metadata.
 */
export interface TopicMetadata {
  /** When this topic was created */
  readonly createdAt: Date;
  
  /** When this topic was last updated */
  readonly updatedAt: Date;
  
  /** Version number */
  readonly version: number;
  
  /** Author/maintainer */
  readonly author?: string;
  
  /** External references */
  readonly references?: readonly string[];
  
  /** Tags for filtering */
  readonly tags?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOPIC MATCH RESULT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Result of matching text against topics.
 */
export interface TopicMatchResult {
  /** The matched topic ID */
  readonly topicId: TopicId;
  
  /** Match score (higher is better) */
  readonly score: number;
  
  /** Confidence level */
  readonly confidence: 'high' | 'medium' | 'low';
  
  /** Tokens that matched */
  readonly matchedTokens: readonly string[];
  
  /** Tokens that were excluded (negative matches) */
  readonly excludedTokens: readonly string[];
  
  /** Whether all required tokens matched */
  readonly allRequiredMatched: boolean;
}

/**
 * Options for topic matching.
 */
export interface TopicMatchOptions {
  /** Maximum number of results */
  readonly maxResults?: number;
  
  /** Minimum score threshold */
  readonly minScore?: number;
  
  /** Minimum confidence level */
  readonly minConfidence?: 'high' | 'medium' | 'low';
  
  /** Only match topics in these categories */
  readonly categories?: readonly TopicCategory[];
  
  /** Only match topics with these difficulty levels */
  readonly difficulties?: readonly TopicDifficulty[];
  
  /** Include child topics in results */
  readonly includeChildren?: boolean;
  
  /** Only match active topics */
  readonly activeOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOPIC TREE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Topic tree node for hierarchical display.
 */
export interface TopicTreeNode {
  /** The topic definition */
  readonly topic: TopicDefinition;
  
  /** Child nodes */
  readonly children: readonly TopicTreeNode[];
  
  /** Depth in tree (0 = root) */
  readonly depth: number;
  
  /** Path from root (array of topic IDs) */
  readonly path: readonly TopicId[];
}

/**
 * Flattened topic for list display.
 */
export interface FlattenedTopic {
  /** The topic definition */
  readonly topic: TopicDefinition;
  
  /** Depth in tree */
  readonly depth: number;
  
  /** Full path string */
  readonly pathString: string;
  
  /** Has children */
  readonly hasChildren: boolean;
  
  /** Is last child of parent */
  readonly isLastChild: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOPIC CRUD
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Input for creating a topic.
 */
export interface CreateTopicInput {
  /** Unique topic ID */
  readonly id: TopicId;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Brief description */
  readonly description: string;
  
  /** Top-level category */
  readonly category: TopicCategory;
  
  /** Parent topic ID */
  readonly parentId?: TopicId;
  
  /** Typical difficulty level */
  readonly difficulty: TopicDifficulty;
  
  /** Token patterns for matching */
  readonly patterns: TokenMatchPattern;
  
  /** Alternative names/aliases */
  readonly aliases?: readonly string[];
  
  /** Related topics */
  readonly relatedTopics?: readonly TopicId[];
  
  /** Prerequisite topics */
  readonly prerequisites?: readonly TopicId[];
  
  /** Search keywords */
  readonly keywords?: readonly string[];
  
  /** Tags */
  readonly tags?: readonly string[];
}

/**
 * Input for updating a topic.
 */
export interface UpdateTopicInput {
  /** Human-readable name */
  readonly name?: string;
  
  /** Brief description */
  readonly description?: string;
  
  /** Typical difficulty level */
  readonly difficulty?: TopicDifficulty;
  
  /** Status */
  readonly status?: TopicStatus;
  
  /** Token patterns for matching */
  readonly patterns?: TokenMatchPattern;
  
  /** Alternative names/aliases */
  readonly aliases?: readonly string[];
  
  /** Related topics */
  readonly relatedTopics?: readonly TopicId[];
  
  /** Prerequisite topics */
  readonly prerequisites?: readonly TopicId[];
  
  /** Search keywords */
  readonly keywords?: readonly string[];
  
  /** Tags */
  readonly tags?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// PREREQUISITE GRAPH
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Edge in the prerequisite graph.
 */
export interface PrerequisiteEdge {
  /** The prerequisite topic */
  readonly from: TopicId;
  
  /** The topic that requires the prerequisite */
  readonly to: TopicId;
  
  /** How strongly required (1.0 = required, 0.5 = recommended) */
  readonly strength: number;
}

/**
 * Learning path through topics.
 */
export interface TopicLearningPath {
  /** Ordered list of topics to learn */
  readonly topics: readonly TopicId[];
  
  /** Total estimated learning time (minutes) */
  readonly estimatedMinutes: number;
  
  /** Difficulty progression */
  readonly difficultyProgression: readonly TopicDifficulty[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Topic ID format constraints.
 */
export const TOPIC_ID_CONSTRAINTS = {
  /** Minimum length */
  MIN_LENGTH: 2,
  
  /** Maximum length */
  MAX_LENGTH: 100,
  
  /** Maximum depth (number of colons) */
  MAX_DEPTH: 5,
  
  /** Valid characters in each segment */
  VALID_CHARS: /^[a-z][a-z0-9_]*$/,
  
  /** Segment separator */
  SEPARATOR: ':',
} as const;

/**
 * Default match options.
 */
export const DEFAULT_MATCH_OPTIONS: Required<TopicMatchOptions> = {
  maxResults: 10,
  minScore: 0.5,
  minConfidence: 'low',
  categories: [],
  difficulties: [],
  includeChildren: true,
  activeOnly: true,
};

/**
 * Score thresholds for confidence levels.
 */
export const CONFIDENCE_THRESHOLDS = {
  high: 2.0,
  medium: 1.0,
  low: 0.5,
} as const;
