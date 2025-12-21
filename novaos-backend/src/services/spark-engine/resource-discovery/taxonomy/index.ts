// ═══════════════════════════════════════════════════════════════════════════════
// TAXONOMY MODULE — Topic Classification System
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Core types
  type TopicCategory,
  type TopicDifficulty,
  type TopicStatus,
  
  // Token matching
  type TokenMatchMode,
  type TokenPattern,
  type TokenMatchPattern,
  
  // Topic definition
  type TopicDefinition,
  type TopicMetadata,
  
  // Match results
  type TopicMatchResult,
  type TopicMatchOptions,
  
  // Tree structures
  type TopicTreeNode,
  type FlattenedTopic,
  
  // CRUD
  type CreateTopicInput,
  type UpdateTopicInput,
  
  // Prerequisites
  type PrerequisiteEdge,
  type TopicLearningPath,
  
  // Constants
  TOPIC_ID_CONSTRAINTS,
  DEFAULT_MATCH_OPTIONS,
  CONFIDENCE_THRESHOLDS,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type TopicIdErrorCode,
  type TopicIdError,
  
  // Validation
  validateTopicId,
  isValidTopicId,
  sanitizeForTopicId,
  
  // Topic ID utilities
  getParentTopicId,
  getRootTopicId,
  getTopicDepth,
  isAncestorOf,
  isDescendantOf,
  getAncestors,
  getTopicPath,
  getCommonAncestor,
  createChildTopicId,
} from './validator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MATCHER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Tokenization
  tokenize,
  createTokenSet,
  
  // Matcher class
  SafeTopicMatcher,
  
  // Pattern factories
  exactToken,
  prefixToken,
  containsToken,
  createPattern,
  
  // Singleton
  getMatcher,
  initMatcher,
  resetMatcher,
  createMatcher,
} from './matcher.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type TopicRegistryErrorCode,
  type TopicRegistryError,
  type TopicRegistryResult,
  
  // Registry class
  TopicRegistry,
  
  // Singleton
  getTopicRegistry,
  initTopicRegistry,
  resetTopicRegistry,
} from './registry.js';
