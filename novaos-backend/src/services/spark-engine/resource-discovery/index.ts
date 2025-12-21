// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE DISCOVERY MODULE — Learning Resource Discovery System
// NovaOS Spark Engine — Phase 6
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides comprehensive resource discovery for the Spark Engine:
//
// CAPABILITIES:
//   - URL canonicalization and deduplication
//   - Provider detection (YouTube, GitHub, npm, etc.)
//   - Topic taxonomy with token-based matching
//   - Known source registry with HMAC integrity
//   - API key management with rotation and quota tracking
//   - Multi-tier caching with TTL per resource stage
//   - Full discovery pipeline orchestration
//
// USAGE:
//   import { discoverResources, processResourceUrl } from './resource-discovery';
//
//   // Discover resources for topics
//   const result = await discoverResources({
//     topics: ['language:rust', 'language:rust:ownership'],
//     maxResults: 10,
//   });
//
//   // Process a single URL
//   const resource = await processResourceUrl('https://doc.rust-lang.org/book/');
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES (Core)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Branded types
  type CanonicalURL,
  type DisplayURL,
  type ResourceId,
  type TopicId,
  type HMACSignature,
  
  // Resource lifecycle types
  type RawResourceCandidate,
  type EnrichedResource,
  type VerifiedResource,
  
  // Metadata types
  type ResourceSource,
  type ResourceProvider,
  type YouTubeMetadata,
  type GitHubMetadata,
  type WebPageMetadata,
  type ProviderMetadata,
  
  // Quality and verification
  type QualitySignals,
  type VerificationEvidence,
  type ContentWalls,
  type UsabilityAssessment,
  type UsabilityIssue,
  
  // Selection
  type ResourceSelectionCriteria,
  
  // Errors
  type ResourceErrorCode,
  type ResourceError,
  
  // Constants
  RESOURCE_TTL,
  QUALITY_THRESHOLDS,
  MAX_LENGTHS,
  
  // Factory functions
  createResourceId,
  createCanonicalURL,
  createDisplayURL,
  createTopicId,
  createHMACSignature,
  createResourceError,
  
  // Type guards
  isYouTubeMetadata,
  isGitHubMetadata,
  isWebPageMetadata,
  isAccessible,
  isRecommended,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CANONICALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Main functions
  canonicalizeURL,
  getCanonicalURL,
  getDisplayURL,
  
  // Comparison
  urlsAreEquivalent,
  deduplicateURLs,
  groupByCanonical,
  
  // Utilities
  isValidURL,
  extractDomain,
  extractRegistrableDomain,
  
  // Types
  type CanonicalizationResult,
  type CanonicalizationOptions,
} from './canonicalize.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER ID EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Provider-specific extractors
  extractYouTubeId,
  extractGitHubId,
  extractStackOverflowId,
  extractNpmId,
  extractCratesId,
  extractPyPIId,
  extractMDNId,
  
  // Detection
  detectProvider,
  getProviderFromHostname,
  
  // Utilities
  providerIdToString,
  
  // Types
  type YouTubeId,
  type GitHubId,
  type StackOverflowId,
  type PackageId,
  type MDNId,
  type GenericId,
  type ProviderDetectionResult,
} from './provider-id.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TAXONOMY
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type TopicCategory,
  type TopicDifficulty,
  type TopicStatus,
  type TokenMatchMode,
  type TokenPattern,
  type TokenMatchPattern,
  type TopicDefinition,
  type TopicMetadata,
  type TopicMatchResult,
  type TopicMatchOptions,
  type TopicTreeNode,
  type FlattenedTopic,
  type CreateTopicInput,
  type UpdateTopicInput,
  type PrerequisiteEdge,
  type TopicLearningPath,
  
  // Validation
  type TopicIdErrorCode,
  type TopicIdError,
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
  
  // Matcher
  SafeTopicMatcher,
  tokenize,
  createTokenSet,
  exactToken,
  prefixToken,
  containsToken,
  createPattern,
  getMatcher,
  initMatcher,
  resetMatcher,
  createMatcher,
  
  // Registry
  type TopicRegistryErrorCode,
  type TopicRegistryError,
  type TopicRegistryResult,
  TopicRegistry,
  getTopicRegistry,
  initTopicRegistry,
  resetTopicRegistry,
  
  // Constants
  TOPIC_ID_CONSTRAINTS,
  DEFAULT_MATCH_OPTIONS,
  CONFIDENCE_THRESHOLDS,
} from './taxonomy/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// KNOWN SOURCES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Integrity
  type IntegrityErrorCode,
  type IntegrityError,
  type SignedEnvelope,
  type IntegrityConfig,
  generateKey,
  computeSignature,
  verifySignature,
  verifySignatureWithRotation,
  signData,
  verifyEnvelope,
  serializeEnvelope,
  deserializeEnvelope,
  quickSign,
  quickVerify,
  hashForLogging,
  
  // Registry
  type AuthorityLevel,
  type HealthStatus,
  type KnownSource,
  type SignedKnownSource,
  type KnownSourceMatch,
  type KnownSourceErrorCode,
  type KnownSourceError,
  KnownSourcesRegistry,
  getKnownSourcesRegistry,
  initKnownSourcesRegistry,
  resetKnownSourcesRegistry,
  
  // Health check
  type HealthCheckResult,
  type HealthCheckerConfig,
  DEFAULT_HEALTH_CHECKER_CONFIG,
  HealthChecker,
  getHealthChecker,
  createHealthChecker,
  resetHealthChecker,
  startHealthChecking,
  stopHealthChecking,
} from './known-sources/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// API KEYS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type ApiService,
  type KeyStatus,
  type QuotaPeriod,
  type ApiKeyConfig,
  type KeySelection,
  type ApiKeyErrorCode,
  type ApiKeyError,
  type KeyUsageReport,
  type ServiceUsageSummary,
  
  // Manager
  ApiKeyManager,
  getApiKeyManager,
  initApiKeyManager,
  resetApiKeyManager,
  
  // Convenience
  getApiKey,
  recordApiKeyUsage,
  markApiKeyRateLimited,
} from './api-keys/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type CacheTier,
  type ResourceStage,
  type CachedResource,
  type ResourceCacheConfig,
  DEFAULT_CACHE_CONFIG,
  type CacheErrorCode,
  type CacheError,
  type CacheStats,
  type CacheGetResult,
  
  // Cache
  ResourceCache,
  getResourceCache,
  initResourceCache,
  resetResourceCache,
} from './cache/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type DiscoverySource,
  type OrchestratorConfig,
  DEFAULT_ORCHESTRATOR_CONFIG,
  type DiscoveryRequest,
  type DiscoveryResult,
  type DiscoveryStats,
  type ClassificationResult,
  type OrchestratorErrorCode,
  type OrchestratorError,
  
  // Orchestrator
  ResourceDiscoveryOrchestrator,
  getResourceDiscoveryOrchestrator,
  initResourceDiscoveryOrchestrator,
  resetResourceDiscoveryOrchestrator,
  
  // Convenience functions
  discoverResources,
  processResourceUrl,
} from './orchestrator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

import { initTopicRegistry, resetTopicRegistry } from './taxonomy/index.js';
import { initKnownSourcesRegistry, resetKnownSourcesRegistry } from './known-sources/index.js';
import { initApiKeyManager, resetApiKeyManager } from './api-keys/index.js';
import { initResourceCache, resetResourceCache } from './cache/index.js';
import { initResourceDiscoveryOrchestrator, resetResourceDiscoveryOrchestrator } from './orchestrator.js';

/**
 * Initialize all resource discovery components.
 */
export async function initResourceDiscovery(): Promise<void> {
  await initTopicRegistry();
  await initKnownSourcesRegistry();
  await initApiKeyManager();
  initResourceCache();
  initResourceDiscoveryOrchestrator();
}

/**
 * Reset all resource discovery components (for testing).
 */
export function resetResourceDiscovery(): void {
  resetResourceDiscoveryOrchestrator();
  resetResourceCache();
  resetApiKeyManager();
  resetKnownSourcesRegistry();
  resetTopicRegistry();
}
