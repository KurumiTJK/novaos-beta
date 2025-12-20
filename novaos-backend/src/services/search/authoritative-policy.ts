// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORITATIVE POLICY — Policies and Conflict Detection for Non-Live Categories
// Phase 4: Entity System
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AuthoritativeCategory,
  SearchResult,
} from '../../types/index.js';

import type {
  AuthoritativePolicy,
  PolicyValidationResult,
  PolicyRecommendation,
  ConflictInfo,
  ConflictType,
  ConflictSource,
  ConflictDetectionResult,
  ConflictRecommendation,
  SearchResultWithMeta,
  SourceTier,
  ExtractedValue,
  DisagreementHandling,
} from './types.js';

import {
  filterByDomains,
  processResults,
  assignTier,
  isInDomainList,
} from './domain-filter.js';

// ─────────────────────────────────────────────────────────────────────────────────
// POLICY DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Policy for leadership/executive information.
 */
export const LEADERSHIP_POLICY: AuthoritativePolicy = {
  category: 'leadership',
  description: 'Policy for corporate leadership and executive information',
  
  officialDomains: [
    'sec.gov',              // SEC filings (8-K, proxy statements)
    'investor.*.com',       // Investor relations sites
    'investors.*.com',
    'ir.*.com',
  ],
  
  verifiedDomains: [
    'linkedin.com',
    'bloomberg.com',
    'reuters.com',
    'wsj.com',
    'ft.com',
    'crunchbase.com',
    'pitchbook.com',
  ],
  
  contextDomains: [
    'wikipedia.org',
    'forbes.com',
    'businessinsider.com',
    'cnbc.com',
  ],
  
  disallowedDomains: [
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'reddit.com',
    'quora.com',
  ],
  
  disagreementHandling: 'prefer_official',
  minSources: 2,
  requireConsensus: false,
  maxDataAgeDays: 30,
  
  validationRules: [
    {
      id: 'name_format',
      description: 'Executive names should be properly capitalized',
      field: 'name',
      pattern: /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/,
    },
    {
      id: 'title_format',
      description: 'Titles should be standard executive titles',
      field: 'title',
      pattern: /^(?:CEO|CFO|COO|CTO|CIO|CISO|President|Chairman|Director|VP|Vice President|Chief\s+\w+\s+Officer)$/i,
    },
  ],
};

/**
 * Policy for regulatory information.
 */
export const REGULATORY_POLICY: AuthoritativePolicy = {
  category: 'regulatory',
  description: 'Policy for regulatory, legal, and compliance information',
  
  officialDomains: [
    'sec.gov',
    'ftc.gov',
    'fda.gov',
    'epa.gov',
    'fcc.gov',
    'cftc.gov',
    'federalreserve.gov',
    'fdic.gov',
    'occ.gov',
    'finra.org',
    'congress.gov',
    'regulations.gov',
    'govinfo.gov',
    'supremecourt.gov',
    'uscourts.gov',
    'justice.gov',
    'law.cornell.edu',
  ],
  
  verifiedDomains: [
    'reuters.com',
    'bloomberg.com',
    'wsj.com',
    'politico.com',
    'thehill.com',
  ],
  
  contextDomains: [
    'wikipedia.org',
    'investopedia.com',
    'nolo.com',
    'findlaw.com',
  ],
  
  disallowedDomains: [
    'facebook.com',
    'twitter.com',
    'x.com',
    'reddit.com',
    'quora.com',
    'answers.com',
  ],
  
  disagreementHandling: 'prefer_official',
  minSources: 1,
  requireConsensus: false,
  maxDataAgeDays: 7,
  
  validationRules: [
    {
      id: 'cfr_format',
      description: 'CFR citations should follow standard format',
      field: 'citation',
      pattern: /^\d+\s+C\.?F\.?R\.?\s+(?:§|Part)?\s*\d+/i,
    },
    {
      id: 'usc_format',
      description: 'USC citations should follow standard format',
      field: 'citation',
      pattern: /^\d+\s+U\.?S\.?C\.?\s+(?:§)?\s*\d+/i,
    },
  ],
};

/**
 * Policy for software/version information.
 */
export const SOFTWARE_POLICY: AuthoritativePolicy = {
  category: 'software',
  description: 'Policy for software versions, releases, and documentation',
  
  officialDomains: [
    'github.com',
    'gitlab.com',
    'npmjs.com',
    'pypi.org',
    'crates.io',
    'nuget.org',
    'maven.org',
    'rubygems.org',
    'packagist.org',
    'docs.microsoft.com',
    'learn.microsoft.com',
    'developer.apple.com',
    'developers.google.com',
    'docs.aws.amazon.com',
    'cloud.google.com',
    'docs.oracle.com',
    'nodejs.org',
    'python.org',
    'rust-lang.org',
    'golang.org',
    'go.dev',
  ],
  
  verifiedDomains: [
    'stackoverflow.com',
    'dev.to',
    'hackernews.com',
    'techcrunch.com',
    'arstechnica.com',
    'theverge.com',
    'wired.com',
  ],
  
  contextDomains: [
    'wikipedia.org',
    'medium.com',
    'towardsdatascience.com',
    'hackernoon.com',
  ],
  
  disallowedDomains: [
    'facebook.com',
    'twitter.com',
    'x.com',
    'reddit.com',
    'quora.com',
  ],
  
  disagreementHandling: 'prefer_official',
  minSources: 1,
  requireConsensus: false,
  maxDataAgeDays: 1, // Software versions change frequently
  
  validationRules: [
    {
      id: 'semver_format',
      description: 'Version should follow semantic versioning',
      field: 'version',
      pattern: /^v?\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?(?:\+[a-zA-Z0-9.]+)?$/,
    },
  ],
};

/**
 * Policy for service status information.
 */
export const SERVICE_STATUS_POLICY: AuthoritativePolicy = {
  category: 'service_status',
  description: 'Policy for service health and status information',
  
  officialDomains: [
    'status.aws.amazon.com',
    'health.aws.amazon.com',
    'status.cloud.google.com',
    'status.azure.com',
    'azure.status.microsoft',
    'githubstatus.com',
    'status.github.com',
    'status.stripe.com',
    'status.twilio.com',
    'status.slack.com',
    'status.atlassian.com',
    'status.digitalocean.com',
    'status.heroku.com',
    'status.cloudflare.com',
    'status.datadog.com',
    'status.pagerduty.com',
    'status.statuspage.io',
    'status.vercel.com',
    'status.netlify.com',
    'status.mongodb.com',
    'status.redis.com',
  ],
  
  verifiedDomains: [
    'downdetector.com',
    'isitdownrightnow.com',
    'outage.report',
  ],
  
  contextDomains: [
    'twitter.com', // Often used for status updates
    'x.com',
  ],
  
  disallowedDomains: [
    'facebook.com',
    'reddit.com',
    'quora.com',
  ],
  
  disagreementHandling: 'prefer_official',
  minSources: 1,
  requireConsensus: false,
  maxDataAgeDays: 0, // Status must be real-time
  
  validationRules: [
    {
      id: 'status_value',
      description: 'Status should be a known status value',
      field: 'status',
      pattern: /^(?:operational|degraded|partial[_ ]outage|major[_ ]outage|maintenance|investigating|identified|monitoring|resolved)$/i,
    },
  ],
};

/**
 * All policies by category.
 */
export const POLICIES: Readonly<Record<AuthoritativeCategory, AuthoritativePolicy>> = {
  leadership: LEADERSHIP_POLICY,
  regulatory: REGULATORY_POLICY,
  software: SOFTWARE_POLICY,
  service_status: SERVICE_STATUS_POLICY,
};

/**
 * Get policy for a category.
 */
export function getPolicy(category: AuthoritativeCategory): AuthoritativePolicy {
  return POLICIES[category];
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFLICT DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Detect conflicts between extracted values from different sources.
 */
export function detectConflicts(
  results: readonly SearchResultWithMeta[]
): ConflictDetectionResult {
  const conflicts: ConflictInfo[] = [];
  
  // Group values by type and normalize
  const valuesByType = new Map<string, Map<string, ConflictSource[]>>();
  
  for (const result of results) {
    if (!result.extractedValues || result.extractedValues.length === 0) {
      continue;
    }
    
    for (const value of result.extractedValues) {
      // Get or create type map
      let typeMap = valuesByType.get(value.type);
      if (!typeMap) {
        typeMap = new Map();
        valuesByType.set(value.type, typeMap);
      }
      
      // Normalize value for comparison
      const normalizedValue = normalizeValue(value.value, value.type);
      
      // Get or create sources list
      let sources = typeMap.get(normalizedValue);
      if (!sources) {
        sources = [];
        typeMap.set(normalizedValue, sources);
      }
      
      // Add source
      sources.push({
        domain: result.normalizedDomain,
        url: result.result.url,
        tier: result.tier,
        value: value.value,
        date: undefined, // Could extract from result if available
      });
    }
  }
  
  // Check for conflicts within each type
  for (const [type, valueMap] of valuesByType) {
    if (valueMap.size <= 1) {
      // No conflict if only one value
      continue;
    }
    
    // Multiple different values for same type - potential conflict
    const entries = [...valueMap.entries()];
    
    // Check if this is a meaningful conflict
    const conflict = analyzeConflict(type, entries);
    if (conflict) {
      conflicts.push(conflict);
    }
  }
  
  // Calculate confidence based on conflicts
  let confidence = 1.0;
  for (const conflict of conflicts) {
    switch (conflict.severity) {
      case 'high':
        confidence *= 0.5;
        break;
      case 'medium':
        confidence *= 0.75;
        break;
      case 'low':
        confidence *= 0.9;
        break;
    }
  }
  confidence = Math.max(0.1, confidence);
  
  // Determine recommendation
  const recommendation = determineRecommendation(conflicts, results);
  
  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    confidence,
    recommendation,
  };
}

/**
 * Normalize a value for comparison.
 */
function normalizeValue(value: string, type: string): string {
  const normalized = value.trim().toLowerCase();
  
  switch (type) {
    case 'name':
      // Normalize name spacing and capitalization
      return normalized.replace(/\s+/g, ' ');
    
    case 'title':
      // Normalize common title variations
      return normalized
        .replace(/chief executive officer/i, 'ceo')
        .replace(/chief financial officer/i, 'cfo')
        .replace(/chief operating officer/i, 'coo')
        .replace(/chief technology officer/i, 'cto')
        .replace(/vice president/i, 'vp');
    
    case 'date':
      // Try to normalize to YYYY-MM-DD
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]!;
        }
      } catch {
        // Keep original
      }
      return normalized;
    
    case 'version':
      // Remove 'v' prefix for comparison
      return normalized.replace(/^v/, '');
    
    case 'status':
      // Normalize status values
      return normalized
        .replace(/partial[_ ]outage/i, 'partial_outage')
        .replace(/major[_ ]outage/i, 'major_outage');
    
    default:
      return normalized;
  }
}

/**
 * Analyze if value differences constitute a meaningful conflict.
 */
function analyzeConflict(
  type: string,
  entries: [string, ConflictSource[]][]
): ConflictInfo | null {
  // Need at least 2 different values
  if (entries.length < 2) {
    return null;
  }
  
  // Collect all sources
  const allSources: ConflictSource[] = entries.flatMap(([, sources]) => sources);
  
  // Determine conflict type and severity
  let conflictType: ConflictType;
  let severity: 'low' | 'medium' | 'high';
  let description: string;
  
  switch (type) {
    case 'name':
      conflictType = 'value_mismatch';
      severity = 'high';
      description = `Different names reported: ${entries.map(([v]) => v).join(' vs ')}`;
      break;
    
    case 'title':
      conflictType = 'value_mismatch';
      severity = 'high';
      description = `Different titles reported: ${entries.map(([v]) => v).join(' vs ')}`;
      break;
    
    case 'date':
      conflictType = 'date_mismatch';
      severity = 'medium';
      description = `Different dates reported: ${entries.map(([v]) => v).join(' vs ')}`;
      break;
    
    case 'version':
      conflictType = 'value_mismatch';
      severity = 'medium';
      description = `Different versions reported: ${entries.map(([v]) => v).join(' vs ')}`;
      break;
    
    case 'status':
      conflictType = 'source_disagree';
      severity = 'high';
      description = `Different status reported: ${entries.map(([v]) => v).join(' vs ')}`;
      break;
    
    default:
      conflictType = 'ambiguous';
      severity = 'low';
      description = `Different values for ${type}: ${entries.map(([v]) => v).join(' vs ')}`;
  }
  
  // Find preferred source (highest tier)
  const officialSources = allSources.filter(s => s.tier === 'official');
  const preferredSource = officialSources.length > 0 
    ? officialSources[0]!.domain 
    : undefined;
  
  // Generate suggested resolution
  let suggestedResolution: string;
  if (preferredSource) {
    suggestedResolution = `Use value from official source: ${preferredSource}`;
  } else {
    suggestedResolution = 'Verify with authoritative source';
  }
  
  return {
    type: conflictType,
    sources: allSources,
    field: type,
    description,
    severity,
    suggestedResolution,
    preferredSource,
  };
}

/**
 * Determine recommendation based on conflicts.
 */
function determineRecommendation(
  conflicts: readonly ConflictInfo[],
  results: readonly SearchResultWithMeta[]
): ConflictRecommendation {
  if (conflicts.length === 0) {
    return 'no_conflicts';
  }
  
  // Check if we have official sources
  const hasOfficial = results.some(r => r.tier === 'official');
  
  // Check severity of conflicts
  const hasHighSeverity = conflicts.some(c => c.severity === 'high');
  const hasMediumSeverity = conflicts.some(c => c.severity === 'medium');
  
  if (hasOfficial) {
    // If we have official sources, prefer them
    return 'use_official';
  }
  
  if (hasHighSeverity) {
    // High severity conflicts need review
    return 'flag_for_review';
  }
  
  if (hasMediumSeverity) {
    // Medium severity - check consensus
    const consensusValue = findConsensus(conflicts);
    if (consensusValue) {
      return 'use_consensus';
    }
    return 'flag_for_review';
  }
  
  // Low severity - use most recent if available
  return 'use_most_recent';
}

/**
 * Find if there's consensus among sources.
 */
function findConsensus(conflicts: readonly ConflictInfo[]): string | null {
  for (const conflict of conflicts) {
    // Count occurrences of each value
    const valueCounts = new Map<string, number>();
    for (const source of conflict.sources) {
      const normalized = source.value.toLowerCase();
      valueCounts.set(normalized, (valueCounts.get(normalized) ?? 0) + 1);
    }
    
    // Find majority (> 50%)
    const total = conflict.sources.length;
    for (const [value, count] of valueCounts) {
      if (count > total / 2) {
        return value;
      }
    }
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// POLICY VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate search results against an authoritative policy.
 */
export function validateAgainstPolicy(
  results: readonly SearchResult[],
  policy: AuthoritativePolicy
): PolicyValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Process results with policy-specific domain classification
  const processed = processResults(results, {
    additionalOfficial: policy.officialDomains.filter(d => !d.includes('*')),
    additionalVerified: policy.verifiedDomains,
    additionalContext: policy.contextDomains,
    additionalDisallowed: policy.disallowedDomains,
    category: policy.category,
  });
  
  // Re-classify with wildcard matching for official domains
  const classified = processed.map(result => {
    const tier = classifyWithWildcards(result, policy);
    return {
      ...result,
      tier,
      isAuthoritative: tier === 'official' || tier === 'verified',
    };
  });
  
  // Separate by tier
  const officialResults = classified.filter(r => r.tier === 'official');
  const verifiedResults = classified.filter(r => r.tier === 'verified');
  const contextResults = classified.filter(r => r.tier === 'context');
  const excludedResults = classified.filter(r => !r.include || r.tier === 'disallowed');
  
  // Check minimum sources requirement
  const authoritativeCount = officialResults.length + verifiedResults.length;
  if (authoritativeCount < policy.minSources) {
    warnings.push(
      `Only ${authoritativeCount} authoritative source(s) found, ` +
      `policy requires ${policy.minSources}`
    );
  }
  
  // Detect conflicts
  const includedResults = classified.filter(r => r.include && r.tier !== 'disallowed');
  const conflictDetection = detectConflicts(includedResults);
  
  // Handle disagreements according to policy
  if (conflictDetection.hasConflicts) {
    handleDisagreement(policy.disagreementHandling, conflictDetection, warnings, errors);
  }
  
  // Check consensus requirement
  if (policy.requireConsensus && conflictDetection.hasConflicts) {
    const hasConsensus = conflictDetection.recommendation === 'use_consensus';
    if (!hasConsensus) {
      errors.push('Policy requires consensus but sources disagree');
    }
  }
  
  // Calculate overall confidence
  let confidence = conflictDetection.confidence;
  
  // Boost confidence if we have official sources
  if (officialResults.length > 0) {
    confidence = Math.min(1.0, confidence + 0.2);
  }
  
  // Reduce confidence if no authoritative sources
  if (authoritativeCount === 0) {
    confidence *= 0.5;
    warnings.push('No authoritative sources found');
  }
  
  // Determine if validation passed
  const valid = errors.length === 0 && 
    authoritativeCount >= policy.minSources &&
    (!policy.requireConsensus || !conflictDetection.hasConflicts);
  
  // Generate recommendation
  const recommendation = generateRecommendation(
    valid,
    officialResults,
    verifiedResults,
    conflictDetection,
    warnings,
    errors
  );
  
  return {
    valid,
    results: classified,
    officialResults,
    verifiedResults,
    contextResults,
    excludedResults,
    conflictDetection,
    confidence,
    warnings,
    errors,
    recommendation,
  };
}

/**
 * Classify result with wildcard domain matching.
 */
function classifyWithWildcards(
  result: SearchResultWithMeta,
  policy: AuthoritativePolicy
): SourceTier {
  const domain = result.normalizedDomain;
  
  // Check disallowed first
  if (isInDomainList(domain, policy.disallowedDomains)) {
    return 'disallowed';
  }
  
  // Check official with wildcards
  for (const pattern of policy.officialDomains) {
    if (domainMatchesWildcard(domain, pattern)) {
      return 'official';
    }
  }
  
  // Check verified
  if (isInDomainList(domain, policy.verifiedDomains)) {
    return 'verified';
  }
  
  // Check context
  if (isInDomainList(domain, policy.contextDomains)) {
    return 'context';
  }
  
  // Keep existing tier for general
  return result.tier;
}

/**
 * Match domain against wildcard pattern.
 */
function domainMatchesWildcard(domain: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    // No wildcard - use exact match
    return domain === pattern || domain.endsWith(`.${pattern}`);
  }
  
  // Convert wildcard to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '[^.]+');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(domain);
}

/**
 * Handle disagreement according to policy.
 */
function handleDisagreement(
  handling: DisagreementHandling,
  conflictDetection: ConflictDetectionResult,
  warnings: string[],
  errors: string[]
): void {
  switch (handling) {
    case 'prefer_official':
      warnings.push(
        'Conflicts detected - preferring official sources. ' +
        conflictDetection.conflicts.map(c => c.description).join('; ')
      );
      break;
    
    case 'require_consensus':
      if (conflictDetection.recommendation !== 'use_consensus') {
        errors.push(
          'Conflicts detected and no consensus found. ' +
          conflictDetection.conflicts.map(c => c.description).join('; ')
        );
      }
      break;
    
    case 'flag_conflict':
      warnings.push(
        'CONFLICT FLAG: ' +
        conflictDetection.conflicts.map(c => c.description).join('; ')
      );
      break;
    
    case 'use_most_recent':
      warnings.push(
        'Conflicts detected - using most recent data. ' +
        conflictDetection.conflicts.map(c => c.description).join('; ')
      );
      break;
    
    case 'fail_safe':
      errors.push(
        'Conflicts detected - fail safe mode prevents response. ' +
        conflictDetection.conflicts.map(c => c.description).join('; ')
      );
      break;
  }
}

/**
 * Generate policy recommendation.
 */
function generateRecommendation(
  valid: boolean,
  officialResults: readonly SearchResultWithMeta[],
  verifiedResults: readonly SearchResultWithMeta[],
  conflictDetection: ConflictDetectionResult,
  warnings: string[],
  errors: string[]
): PolicyRecommendation {
  // Determine action
  let action: 'proceed' | 'proceed_with_caution' | 'require_verification' | 'reject';
  let reason: string;
  const nextSteps: string[] = [];
  
  if (errors.length > 0) {
    action = 'reject';
    reason = errors.join('; ');
    nextSteps.push('Review error conditions');
    nextSteps.push('Obtain additional authoritative sources');
  } else if (conflictDetection.hasConflicts && 
             conflictDetection.conflicts.some(c => c.severity === 'high')) {
    action = 'require_verification';
    reason = 'High severity conflicts detected';
    nextSteps.push('Verify with official source');
    nextSteps.push('Review conflicting information');
  } else if (warnings.length > 0) {
    action = 'proceed_with_caution';
    reason = warnings.join('; ');
    nextSteps.push('Note caveats in response');
  } else {
    action = 'proceed';
    reason = 'All policy requirements met';
  }
  
  // Determine sources to cite
  const sourcesToCite: string[] = [];
  
  // Prefer official sources
  for (const result of officialResults.slice(0, 3)) {
    sourcesToCite.push(result.result.url);
  }
  
  // Add verified if needed
  if (sourcesToCite.length < 2) {
    for (const result of verifiedResults.slice(0, 2)) {
      if (sourcesToCite.length >= 3) break;
      sourcesToCite.push(result.result.url);
    }
  }
  
  return {
    action,
    reason,
    nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
    sourcesToCite: sourcesToCite.length > 0 ? sourcesToCite : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate results for a specific category.
 */
export function validateForCategory(
  results: readonly SearchResult[],
  category: AuthoritativeCategory
): PolicyValidationResult {
  const policy = getPolicy(category);
  return validateAgainstPolicy(results, policy);
}

/**
 * Check if results pass policy validation.
 */
export function passesPolicy(
  results: readonly SearchResult[],
  category: AuthoritativeCategory
): boolean {
  const validation = validateForCategory(results, category);
  return validation.valid;
}

/**
 * Get recommended sources to cite.
 */
export function getSourcesToCite(
  results: readonly SearchResult[],
  category: AuthoritativeCategory
): readonly string[] {
  const validation = validateForCategory(results, category);
  return validation.recommendation.sourcesToCite ?? [];
}

/**
 * Check for conflicts without full validation.
 */
export function quickConflictCheck(
  results: readonly SearchResult[]
): ConflictDetectionResult {
  const processed = processResults(results);
  return detectConflicts(processed);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

// Note: LEADERSHIP_POLICY, REGULATORY_POLICY, SOFTWARE_POLICY, SERVICE_STATUS_POLICY, 
// and POLICIES are already exported inline above
