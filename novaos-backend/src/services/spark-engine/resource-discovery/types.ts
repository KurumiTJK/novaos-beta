// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE DISCOVERY TYPES — Resource Lifecycle Definitions
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// Resources flow through three lifecycle stages:
//   1. RAW → Discovered URL (candidate)
//   2. ENRICHED → Metadata fetched (YouTube/GitHub API, scraping)
//   3. VERIFIED → Accessibility confirmed (HEAD/GET, content analysis)
//
// CRITICAL INVARIANT: The LLM NEVER fabricates URLs.
// All URLs must come from:
//   - Known sources registry (pre-verified)
//   - API search results (YouTube, GitHub)
//   - User-provided URLs
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Result } from '../../../types/result.js';

// ─────────────────────────────────────────────────────────────────────────────────
// BRANDED TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Branded type for canonical URLs (deduplicated, normalized).
 */
export type CanonicalURL = string & { readonly __brand: 'CanonicalURL' };

/**
 * Branded type for display URLs (user-facing, may include tracking params).
 */
export type DisplayURL = string & { readonly __brand: 'DisplayURL' };

/**
 * Branded type for resource IDs.
 */
export type ResourceId = string & { readonly __brand: 'ResourceId' };

/**
 * Branded type for topic IDs (hierarchical, e.g., "rust:ownership").
 */
export type TopicId = string & { readonly __brand: 'TopicId' };

/**
 * Branded type for HMAC signatures.
 */
export type HMACSignature = string & { readonly __brand: 'HMACSignature' };

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE SOURCE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Where the resource was discovered.
 */
export type ResourceSourceType =
  | 'known_source'      // Pre-verified official documentation
  | 'youtube_api'       // YouTube Data API search
  | 'github_api'        // GitHub API search
  | 'web_search'        // General web search
  | 'user_provided'     // User submitted URL
  | 'curated_list';     // Manually curated list

/**
 * Resource source with provenance tracking.
 */
export interface ResourceSource {
  /** How the resource was discovered */
  readonly type: ResourceSourceType;
  
  /** Source identifier (e.g., registry ID, search query) */
  readonly sourceId?: string;
  
  /** When discovered */
  readonly discoveredAt: Date;
  
  /** Search query that found this (if applicable) */
  readonly query?: string;
  
  /** Position in search results (if applicable) */
  readonly resultPosition?: number;
  
  /** API response ID for audit trail */
  readonly apiResponseId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE PROVIDER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Known resource providers with specific handling.
 */
export type ResourceProvider =
  | 'youtube'
  | 'github'
  | 'stackoverflow'
  | 'mdn'
  | 'rust_docs'
  | 'python_docs'
  | 'npm'
  | 'crates_io'
  | 'pypi'
  | 'medium'
  | 'dev_to'
  | 'official_docs'
  | 'unknown';

/**
 * Resource content type.
 */
export type ResourceContentType =
  | 'video'
  | 'tutorial'
  | 'documentation'
  | 'article'
  | 'repository'
  | 'package'
  | 'course'
  | 'book'
  | 'interactive'
  | 'reference'
  | 'unknown';

/**
 * Resource difficulty level.
 */
export type DifficultyLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert'
  | 'unknown';

/**
 * Resource format.
 */
export type ResourceFormat =
  | 'video'
  | 'text'
  | 'interactive'
  | 'audio'
  | 'mixed';

// ─────────────────────────────────────────────────────────────────────────────────
// RAW RESOURCE CANDIDATE (Stage 1: Discovery)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A discovered URL before enrichment.
 * 
 * This is the minimal representation of a potential resource.
 * No network requests have been made yet beyond the discovery API.
 */
export interface RawResourceCandidate {
  /** Unique identifier */
  readonly id: ResourceId;
  
  /** Canonical URL (normalized, deduplicated) */
  readonly canonicalUrl: CanonicalURL;
  
  /** Display URL (user-facing) */
  readonly displayUrl: DisplayURL;
  
  /** How this resource was discovered */
  readonly source: ResourceSource;
  
  /** Detected provider */
  readonly provider: ResourceProvider;
  
  /** Provider-specific ID (e.g., YouTube video ID, GitHub repo path) */
  readonly providerId?: string;
  
  /** Title from discovery (may be incomplete) */
  readonly title?: string;
  
  /** Brief description from discovery */
  readonly snippet?: string;
  
  /** Topics this resource relates to */
  readonly topicIds: readonly TopicId[];
  
  /** When this candidate was created */
  readonly createdAt: Date;
  
  /** Expiration time for this candidate */
  readonly expiresAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER METADATA (Provider-specific details)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * YouTube video metadata.
 */
export interface YouTubeMetadata {
  readonly provider: 'youtube';
  readonly videoId: string;
  readonly channelId: string;
  readonly channelTitle: string;
  readonly duration: number; // seconds
  readonly viewCount: number;
  readonly likeCount?: number;
  readonly commentCount?: number;
  readonly publishedAt: Date;
  readonly tags?: readonly string[];
  readonly categoryId?: string;
  readonly defaultLanguage?: string;
  readonly hasClosedCaptions: boolean;
  readonly isLiveBroadcast: boolean;
  readonly thumbnailUrl?: string;
}

/**
 * GitHub repository metadata.
 */
export interface GitHubMetadata {
  readonly provider: 'github';
  readonly owner: string;
  readonly repo: string;
  readonly branch?: string;
  readonly path?: string;
  readonly stars: number;
  readonly forks: number;
  readonly openIssues: number;
  readonly watchers: number;
  readonly language?: string;
  readonly topics?: readonly string[];
  readonly license?: string;
  readonly description?: string;
  readonly lastCommitAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isArchived: boolean;
  readonly isFork: boolean;
  readonly hasReadme: boolean;
  readonly readmePreview?: string;
}

/**
 * Generic web page metadata.
 */
export interface WebPageMetadata {
  readonly provider: 'unknown' | 'mdn' | 'stackoverflow' | 'medium' | 'dev_to' | 'official_docs';
  readonly title: string;
  readonly description?: string;
  readonly author?: string;
  readonly publishedAt?: Date;
  readonly modifiedAt?: Date;
  readonly language?: string;
  readonly wordCount?: number;
  readonly readingTimeMinutes?: number;
  readonly ogImage?: string;
  readonly canonicalUrl?: string;
}

/**
 * Union of all provider metadata types.
 */
export type ProviderMetadata = YouTubeMetadata | GitHubMetadata | WebPageMetadata;

// ─────────────────────────────────────────────────────────────────────────────────
// ENRICHED RESOURCE (Stage 2: Enrichment)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A resource with fetched metadata.
 * 
 * API calls have been made to get detailed information.
 * Accessibility has NOT been verified yet.
 */
export interface EnrichedResource {
  /** Unique identifier (same as candidate) */
  readonly id: ResourceId;
  
  /** Canonical URL */
  readonly canonicalUrl: CanonicalURL;
  
  /** Display URL */
  readonly displayUrl: DisplayURL;
  
  /** Discovery source */
  readonly source: ResourceSource;
  
  /** Provider */
  readonly provider: ResourceProvider;
  
  /** Provider-specific ID */
  readonly providerId?: string;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Enriched fields
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Full title (sanitized) */
  readonly title: string;
  
  /** Full description (sanitized, length-limited) */
  readonly description: string;
  
  /** Content type */
  readonly contentType: ResourceContentType;
  
  /** Format */
  readonly format: ResourceFormat;
  
  /** Difficulty level (inferred or explicit) */
  readonly difficulty: DifficultyLevel;
  
  /** Estimated duration in minutes */
  readonly estimatedMinutes?: number;
  
  /** Provider-specific metadata */
  readonly metadata: ProviderMetadata;
  
  /** Topics this resource covers */
  readonly topicIds: readonly TopicId[];
  
  /** Quality signals */
  readonly qualitySignals: QualitySignals;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** When the candidate was created */
  readonly candidateCreatedAt: Date;
  
  /** When enrichment was performed */
  readonly enrichedAt: Date;
  
  /** When this enrichment expires */
  readonly enrichmentExpiresAt: Date;
}

/**
 * Quality signals extracted during enrichment.
 */
export interface QualitySignals {
  /** Popularity score (normalized 0-1) */
  readonly popularity: number;
  
  /** Recency score (normalized 0-1, based on age) */
  readonly recency: number;
  
  /** Authority score (normalized 0-1, based on source reputation) */
  readonly authority: number;
  
  /** Completeness score (normalized 0-1, how much metadata available) */
  readonly completeness: number;
  
  /** Composite quality score */
  readonly composite: number;
  
  /** Individual signal details */
  readonly details: {
    readonly viewCount?: number;
    readonly starCount?: number;
    readonly upvotes?: number;
    readonly ageInDays: number;
    readonly lastUpdatedDays?: number;
    readonly authorReputation?: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// VERIFICATION EVIDENCE (Stage 3: Verification)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Verification level based on evidence strength.
 */
export type VerificationLevel =
  | 'high'      // Known source, recently verified, no issues
  | 'medium'    // API metadata valid, HEAD request successful
  | 'low'       // Only discovery data, not independently verified
  | 'failed';   // Verification failed

/**
 * Accessibility status.
 */
export type AccessibilityStatus =
  | 'accessible'     // Resource is accessible
  | 'requires_auth'  // Requires authentication
  | 'paywall'        // Behind paywall
  | 'geo_blocked'    // Geographic restriction
  | 'rate_limited'   // Temporarily rate limited
  | 'not_found'      // 404 or gone
  | 'error'          // Other error
  | 'unknown';       // Not yet checked

/**
 * Content wall types detected.
 */
export interface ContentWalls {
  /** Requires payment */
  readonly hasPaywall: boolean;
  
  /** Requires login */
  readonly hasLoginWall: boolean;
  
  /** Bot/CAPTCHA protection */
  readonly hasBotWall: boolean;
  
  /** Age verification required */
  readonly hasAgeGate: boolean;
  
  /** Cookie consent blocking content */
  readonly hasCookieWall: boolean;
  
  /** Geographic restriction */
  readonly hasGeoBlock: boolean;
}

/**
 * Evidence collected during verification.
 */
export interface VerificationEvidence {
  /** When verification was performed */
  readonly verifiedAt: Date;
  
  /** Verification level achieved */
  readonly level: VerificationLevel;
  
  /** HTTP status code from HEAD/GET */
  readonly httpStatus?: number;
  
  /** Response time in milliseconds */
  readonly responseTimeMs?: number;
  
  /** Content-Type header */
  readonly contentType?: string;
  
  /** Content-Length header */
  readonly contentLength?: number;
  
  /** Last-Modified header */
  readonly lastModified?: Date;
  
  /** ETag for caching */
  readonly etag?: string;
  
  /** Whether HTTPS is used */
  readonly usesHttps: boolean;
  
  /** Whether the certificate is valid */
  readonly validCertificate?: boolean;
  
  /** Detected content walls */
  readonly walls: ContentWalls;
  
  /** Whether this is a soft-404 (200 but "not found" content) */
  readonly isSoft404: boolean;
  
  /** Whether this is a JS app shell (content loaded via JS) */
  readonly isJsAppShell: boolean;
  
  /** Redirect chain (if any) */
  readonly redirectChain?: readonly string[];
  
  /** Final URL after redirects */
  readonly finalUrl?: CanonicalURL;
  
  /** Error message if verification failed */
  readonly errorMessage?: string;
  
  /** Error code if verification failed */
  readonly errorCode?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// USABILITY ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Assessment of resource usability for learning.
 */
export interface UsabilityAssessment {
  /** Overall usability score (0-1) */
  readonly score: number;
  
  /** Whether this resource is recommended */
  readonly recommended: boolean;
  
  /** Issues that affect usability */
  readonly issues: readonly UsabilityIssue[];
  
  /** Positive factors */
  readonly strengths: readonly string[];
  
  /** Target audience match (how well it matches user's level) */
  readonly audienceMatch: number;
  
  /** Prerequisite coverage (are prerequisites met?) */
  readonly prerequisitesCovered: boolean;
  
  /** Missing prerequisites (if any) */
  readonly missingPrerequisites: readonly TopicId[];
}

/**
 * Issues affecting resource usability.
 */
export interface UsabilityIssue {
  /** Issue type */
  readonly type: UsabilityIssueType;
  
  /** Severity */
  readonly severity: 'blocking' | 'major' | 'minor';
  
  /** Human-readable description */
  readonly description: string;
}

/**
 * Types of usability issues.
 */
export type UsabilityIssueType =
  | 'paywall'
  | 'login_required'
  | 'outdated'
  | 'low_quality'
  | 'wrong_level'
  | 'wrong_language'
  | 'incomplete'
  | 'broken_link'
  | 'slow_response'
  | 'bot_protection'
  | 'geo_blocked';

// ─────────────────────────────────────────────────────────────────────────────────
// VERIFIED RESOURCE (Stage 3: Complete)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A fully verified resource ready for use.
 * 
 * This is the final stage of the resource lifecycle.
 * The resource has been:
 *   1. Discovered (with provenance)
 *   2. Enriched (with metadata)
 *   3. Verified (accessibility confirmed)
 */
export interface VerifiedResource {
  /** Unique identifier */
  readonly id: ResourceId;
  
  /** Canonical URL */
  readonly canonicalUrl: CanonicalURL;
  
  /** Display URL */
  readonly displayUrl: DisplayURL;
  
  /** Discovery source */
  readonly source: ResourceSource;
  
  /** Provider */
  readonly provider: ResourceProvider;
  
  /** Provider-specific ID */
  readonly providerId?: string;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Content information
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Title */
  readonly title: string;
  
  /** Description */
  readonly description: string;
  
  /** Content type */
  readonly contentType: ResourceContentType;
  
  /** Format */
  readonly format: ResourceFormat;
  
  /** Difficulty */
  readonly difficulty: DifficultyLevel;
  
  /** Estimated duration in minutes */
  readonly estimatedMinutes?: number;
  
  /** Provider metadata */
  readonly metadata: ProviderMetadata;
  
  /** Topics covered */
  readonly topicIds: readonly TopicId[];
  
  /** Quality signals */
  readonly qualitySignals: QualitySignals;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Verification
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Accessibility status */
  readonly accessibility: AccessibilityStatus;
  
  /** Verification evidence */
  readonly evidence: VerificationEvidence;
  
  /** Usability assessment */
  readonly usability: UsabilityAssessment;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** When discovered */
  readonly discoveredAt: Date;
  
  /** When enriched */
  readonly enrichedAt: Date;
  
  /** When verified */
  readonly verifiedAt: Date;
  
  /** When this verification expires */
  readonly expiresAt: Date;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Integrity
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** HMAC signature for cache integrity */
  readonly signature?: HMACSignature;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE SELECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Selection criteria for choosing resources.
 */
export interface ResourceSelectionCriteria {
  /** Topics to cover */
  readonly topicIds: readonly TopicId[];
  
  /** Maximum number of resources */
  readonly maxResources: number;
  
  /** Preferred difficulty levels */
  readonly preferredDifficulties?: readonly DifficultyLevel[];
  
  /** Preferred formats */
  readonly preferredFormats?: readonly ResourceFormat[];
  
  /** Preferred content types */
  readonly preferredContentTypes?: readonly ResourceContentType[];
  
  /** Preferred providers to prioritize */
  readonly preferredProviders?: readonly ResourceProvider[];
  
  /** Maximum total duration in minutes */
  readonly maxTotalMinutes?: number;
  
  /** Minimum quality score */
  readonly minQualityScore?: number;
  
  /** Whether to prioritize variety */
  readonly prioritizeVariety?: boolean;
}

/**
 * Result of resource selection.
 */
export interface ResourceSelectionResult {
  /** Selected resources */
  readonly resources: readonly VerifiedResource[];
  
  /** Topics covered */
  readonly topicsCovered: readonly TopicId[];
  
  /** Topics not covered */
  readonly topicsUncovered: readonly TopicId[];
  
  /** Coverage percentage (0-1) */
  readonly coverage: number;
  
  /** Total estimated duration */
  readonly totalMinutes: number;
  
  /** Selection metadata */
  readonly metadata: {
    readonly candidatesConsidered: number;
    readonly rejectedCount: number;
    readonly selectionTimeMs: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Resource discovery error codes.
 */
export type ResourceErrorCode =
  // Discovery errors
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROVIDER'
  | 'DISCOVERY_FAILED'
  | 'NO_RESULTS'
  
  // Enrichment errors
  | 'ENRICHMENT_FAILED'
  | 'API_RATE_LIMITED'
  | 'API_QUOTA_EXCEEDED'
  | 'API_AUTH_FAILED'
  | 'METADATA_UNAVAILABLE'
  
  // Verification errors
  | 'VERIFICATION_FAILED'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_FORBIDDEN'
  | 'RESOURCE_TIMEOUT'
  | 'SSRF_BLOCKED'
  | 'TLS_ERROR'
  
  // Content errors
  | 'PAYWALL_DETECTED'
  | 'LOGIN_REQUIRED'
  | 'BOT_WALL_DETECTED'
  | 'CONTENT_UNAVAILABLE'
  
  // Cache errors
  | 'CACHE_MISS'
  | 'CACHE_EXPIRED'
  | 'CACHE_INTEGRITY_FAILED';

/**
 * Resource error with context.
 */
export interface ResourceError {
  readonly code: ResourceErrorCode;
  readonly message: string;
  readonly resourceId?: ResourceId;
  readonly url?: string;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Result type for resource operations.
 */
export type ResourceResult<T> = Result<T, ResourceError>;

/**
 * Result of discovering resources.
 */
export type DiscoveryResult = ResourceResult<readonly RawResourceCandidate[]>;

/**
 * Result of enriching a resource.
 */
export type EnrichmentResult = ResourceResult<EnrichedResource>;

/**
 * Result of verifying a resource.
 */
export type VerificationResult = ResourceResult<VerifiedResource>;

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a ResourceId.
 */
export function createResourceId(id: string): ResourceId {
  return id as ResourceId;
}

/**
 * Create a CanonicalURL.
 */
export function createCanonicalURL(url: string): CanonicalURL {
  return url as CanonicalURL;
}

/**
 * Create a DisplayURL.
 */
export function createDisplayURL(url: string): DisplayURL {
  return url as DisplayURL;
}

/**
 * Create a TopicId.
 */
export function createTopicId(id: string): TopicId {
  return id as TopicId;
}

/**
 * Create an HMACSignature.
 */
export function createHMACSignature(sig: string): HMACSignature {
  return sig as HMACSignature;
}

/**
 * Create a ResourceError.
 */
export function createResourceError(
  code: ResourceErrorCode,
  message: string,
  options?: {
    resourceId?: ResourceId;
    url?: string;
    cause?: Error;
    context?: Record<string, unknown>;
  }
): ResourceError {
  return {
    code,
    message,
    resourceId: options?.resourceId,
    url: options?.url,
    cause: options?.cause,
    context: options?.context,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if metadata is YouTube metadata.
 */
export function isYouTubeMetadata(meta: ProviderMetadata): meta is YouTubeMetadata {
  return meta.provider === 'youtube';
}

/**
 * Check if metadata is GitHub metadata.
 */
export function isGitHubMetadata(meta: ProviderMetadata): meta is GitHubMetadata {
  return meta.provider === 'github';
}

/**
 * Check if metadata is web page metadata.
 */
export function isWebPageMetadata(meta: ProviderMetadata): meta is WebPageMetadata {
  return !isYouTubeMetadata(meta) && !isGitHubMetadata(meta);
}

/**
 * Check if a resource is accessible.
 */
export function isAccessible(resource: VerifiedResource): boolean {
  return resource.accessibility === 'accessible';
}

/**
 * Check if a resource is recommended.
 */
export function isRecommended(resource: VerifiedResource): boolean {
  return resource.usability.recommended && isAccessible(resource);
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Default TTLs for resource lifecycle stages.
 */
export const RESOURCE_TTL = {
  /** Raw candidate TTL (1 hour) */
  CANDIDATE_SECONDS: 3600,
  
  /** Enriched resource TTL (24 hours) */
  ENRICHMENT_SECONDS: 86400,
  
  /** Verified resource TTL (7 days) */
  VERIFICATION_SECONDS: 604800,
  
  /** Known source TTL (30 days) */
  KNOWN_SOURCE_SECONDS: 2592000,
  
  /** Millisecond variants for cache operations */
  CANDIDATE_MS: 3600 * 1000,
  ENRICHMENT_MS: 86400 * 1000,
  VERIFICATION_MS: 604800 * 1000,
  KNOWN_SOURCE_MS: 2592000 * 1000,
} as const;

/**
 * Quality score thresholds.
 */
export const QUALITY_THRESHOLDS = {
  /** Minimum for consideration */
  MINIMUM: 0.3,
  
  /** Threshold for recommendation */
  RECOMMENDED: 0.6,
  
  /** High quality */
  HIGH: 0.8,
} as const;

/**
 * Maximum lengths for sanitized fields.
 */
export const MAX_LENGTHS = {
  TITLE: 200,
  DESCRIPTION: 1000,
  SNIPPET: 300,
} as const;
