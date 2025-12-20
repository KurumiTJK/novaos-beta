// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH SERVICE — Barrel Export
// Phase 4: Entity System
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Source tier classification
  SourceTier,
  
  // Search result with metadata
  SearchResultWithMeta,
  ExtractedValue,
  
  // Search query and filters
  SearchQuery,
  SearchFilters,
  DateRange,
  SearchContext,
  
  // Conflict detection
  ConflictType,
  ConflictInfo,
  ConflictSource,
  ConflictDetectionResult,
  ConflictRecommendation,
  
  // Authoritative policy
  AuthoritativePolicy,
  DisagreementHandling,
  ValidationRule,
  PolicyValidationResult,
  PolicyRecommendation,
  
  // Filtered results
  FilteredResults,
  FilterStats,
  
  // Domain info
  DomainInfo,
} from './types.js';

export {
  // Tier utilities
  VALID_SOURCE_TIERS,
  TIER_PRIORITY,
  getTierPriority,
  compareTiers,
  
  // Type guards
  isAuthoritativeTier,
  isIncludedTier,
  hasConflicts,
  isPolicyValid,
  
  // Helper functions
  getHighestTier,
  filterAuthoritative,
  sortByTier,
  groupByTier,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DOMAIN FILTER
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  TierAssignmentOptions,
} from './domain-filter.js';

export {
  // Domain classification lists
  OFFICIAL_DOMAINS,
  DISALLOWED_DOMAINS,
  CONTEXT_DOMAINS,
  
  // Domain parsing
  parseDomain,
  normalizeDomain,
  domainMatches,
  isInDomainList,
  
  // Tier assignment
  assignTier,
  
  // Value extraction
  extractValues,
  
  // Result processing
  processResult,
  processResults,
  
  // Filtering
  filterByDomains,
  filterToAuthoritative,
  filterToOfficial,
} from './domain-filter.js';

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE POLICY
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Policy definitions
  LEADERSHIP_POLICY,
  REGULATORY_POLICY,
  SOFTWARE_POLICY,
  SERVICE_STATUS_POLICY,
  POLICIES,
  
  // Policy access
  getPolicy,
  
  // Conflict detection
  detectConflicts,
  
  // Policy validation
  validateAgainstPolicy,
  validateForCategory,
  passesPolicy,
  getSourcesToCite,
  quickConflictCheck,
} from './authoritative-policy.js';
