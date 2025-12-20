// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN FILTER — Filter and Classify Search Results by Domain
// Phase 4: Entity System
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  SearchResult,
  FullSearchResult,
  LiveCategorySearchResult,
  AuthoritativeCategory,
} from '../../types/index.js';

import {
  isLiveCategorySearchResult,
  isFullSearchResult,
  AUTHORITATIVE_DOMAINS,
} from '../../types/index.js';

import type {
  SourceTier,
  SearchResultWithMeta,
  FilteredResults,
  FilterStats,
  DomainInfo,
  SearchFilters,
  ExtractedValue,
} from './types.js';

import {
  TIER_PRIORITY,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// KNOWN DOMAIN CLASSIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Known official/authoritative domains by category.
 */
export const OFFICIAL_DOMAINS: Readonly<Record<string, readonly string[]>> = {
  // Government
  government: [
    'sec.gov',
    'ftc.gov',
    'fda.gov',
    'cdc.gov',
    'nih.gov',
    'whitehouse.gov',
    'congress.gov',
    'regulations.gov',
    'usa.gov',
    'irs.gov',
    'treasury.gov',
    'justice.gov',
    'state.gov',
    'defense.gov',
    'energy.gov',
    'epa.gov',
    'fcc.gov',
    'hhs.gov',
    'dhs.gov',
    'dot.gov',
    'ed.gov',
    'hud.gov',
    'dol.gov',
    'usda.gov',
    'commerce.gov',
    'interior.gov',
    'va.gov',
    'sba.gov',
    'opm.gov',
    'gsa.gov',
    'nasa.gov',
    'nsf.gov',
    'ssa.gov',
    'fema.gov',
    'bls.gov',
    'census.gov',
    'federalreserve.gov',
    'fdic.gov',
    'finra.org',
    'cftc.gov',
  ],
  
  // International Government
  international_gov: [
    'gov.uk',
    'gov.au',
    'gc.ca',
    'europa.eu',
    'un.org',
    'who.int',
    'worldbank.org',
    'imf.org',
    'wto.org',
  ],
  
  // Financial News
  financial: [
    'bloomberg.com',
    'reuters.com',
    'wsj.com',
    'ft.com',
    'cnbc.com',
    'marketwatch.com',
    'finance.yahoo.com',
    'investors.com',
    'barrons.com',
    'morningstar.com',
    'seekingalpha.com',
    'fool.com',
  ],
  
  // Tech/Software
  software: [
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
    'developer.android.com',
    'docs.aws.amazon.com',
    'cloud.google.com',
    'docs.oracle.com',
    'docs.python.org',
    'nodejs.org',
    'rust-lang.org',
    'golang.org',
    'go.dev',
    'kotlinlang.org',
    'swift.org',
    'typescriptlang.org',
    'reactjs.org',
    'react.dev',
    'vuejs.org',
    'angular.io',
    'nextjs.org',
    'vercel.com',
    'netlify.com',
    'heroku.com',
    'docker.com',
    'kubernetes.io',
    'terraform.io',
    'ansible.com',
    'jenkins.io',
    'circleci.com',
    'travis-ci.com',
  ],
  
  // Service Status
  service_status: [
    'status.aws.amazon.com',
    'status.cloud.google.com',
    'status.azure.com',
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
    'downdetector.com',
  ],
  
  // Business/Corporate
  business: [
    'linkedin.com',
    'crunchbase.com',
    'glassdoor.com',
    'indeed.com',
    'dnb.com',
    'hoovers.com',
    'zoominfo.com',
    'pitchbook.com',
    'cbinsights.com',
  ],
  
  // Academic/Research
  academic: [
    'arxiv.org',
    'scholar.google.com',
    'pubmed.ncbi.nlm.nih.gov',
    'jstor.org',
    'researchgate.net',
    'academia.edu',
    'sciencedirect.com',
    'nature.com',
    'science.org',
    'ieee.org',
    'acm.org',
    'springer.com',
    'wiley.com',
    'elsevier.com',
    'ssrn.com',
  ],
  
  // Reference
  reference: [
    'wikipedia.org',
    'britannica.com',
    'merriam-webster.com',
    'dictionary.com',
    'law.cornell.edu',
    'investopedia.com',
  ],
  
  // News
  news: [
    'nytimes.com',
    'washingtonpost.com',
    'theguardian.com',
    'bbc.com',
    'bbc.co.uk',
    'cnn.com',
    'apnews.com',
    'npr.org',
    'pbs.org',
    'politico.com',
    'thehill.com',
    'axios.com',
    'vox.com',
    'theatlantic.com',
    'newyorker.com',
    'economist.com',
    'time.com',
    'forbes.com',
    'businessinsider.com',
    'techcrunch.com',
    'wired.com',
    'arstechnica.com',
    'theverge.com',
    'engadget.com',
    'cnet.com',
    'zdnet.com',
  ],
};

/**
 * Domains that should be blocked for certain queries.
 */
export const DISALLOWED_DOMAINS: readonly string[] = [
  // Social Media (not authoritative for factual data)
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'snapchat.com',
  'pinterest.com',
  'tumblr.com',
  
  // User-generated content (unreliable for authoritative data)
  'reddit.com',
  'quora.com',
  'answers.yahoo.com',
  'answers.com',
  
  // Forums (except for specific technical topics)
  'boards.4chan.org',
  '4chan.org',
  '8kun.top',
  
  // Known misinformation vectors
  'infowars.com',
  'breitbart.com',
  'naturalnews.com',
  
  // Content farms
  'ehow.com',
  'wikihow.com',
  'hubpages.com',
  'squidoo.com',
  
  // Aggregators that may have stale data
  'thefreelibrary.com',
  'scribd.com',
];

/**
 * Domains that provide context but are not authoritative.
 */
export const CONTEXT_DOMAINS: readonly string[] = [
  'wikipedia.org',
  'britannica.com',
  'investopedia.com',
  'law.cornell.edu',
  'medium.com',
  'substack.com',
  'dev.to',
  'hackernoon.com',
  'towardsdatascience.com',
];

// ─────────────────────────────────────────────────────────────────────────────────
// DOMAIN PARSING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Government TLDs.
 */
const GOV_TLDS = new Set(['.gov', '.mil', '.gov.uk', '.gov.au', '.gc.ca']);

/**
 * Educational TLDs.
 */
const EDU_TLDS = new Set(['.edu', '.ac.uk', '.edu.au', '.edu.cn']);

/**
 * Parse domain information from a URL or domain string.
 */
export function parseDomain(input: string): DomainInfo {
  let domain: string;
  
  // Extract domain from URL if needed
  try {
    if (input.includes('://')) {
      const url = new URL(input);
      domain = url.hostname;
    } else {
      domain = input;
    }
  } catch {
    domain = input;
  }
  
  // Normalize
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  
  // Extract parts
  const parts = normalized.split('.');
  const tld = parts.length >= 2 ? `.${parts.slice(-1).join('.')}` : '';
  
  // Handle compound TLDs (co.uk, com.au, etc.)
  let rootDomain: string;
  let subdomain: string | undefined;
  
  const compoundTlds = ['.co.uk', '.com.au', '.co.nz', '.co.jp', '.com.br', '.com.mx'];
  const isCompoundTld = compoundTlds.some(ct => normalized.endsWith(ct));
  
  if (isCompoundTld && parts.length > 2) {
    rootDomain = parts.slice(-3).join('.');
    subdomain = parts.length > 3 ? parts.slice(0, -3).join('.') : undefined;
  } else if (parts.length > 2) {
    rootDomain = parts.slice(-2).join('.');
    subdomain = parts.slice(0, -2).join('.');
  } else {
    rootDomain = normalized;
    subdomain = undefined;
  }
  
  // Check special TLDs
  const fullTld = isCompoundTld 
    ? `.${parts.slice(-2).join('.')}`
    : tld;
  
  const isGovernment = GOV_TLDS.has(fullTld) || normalized.endsWith('.gov') || normalized.endsWith('.mil');
  const isEducational = EDU_TLDS.has(fullTld) || normalized.endsWith('.edu');
  
  // Try to identify organization
  const organization = identifyOrganization(normalized);
  
  return {
    original: domain,
    normalized,
    root: rootDomain,
    subdomain,
    tld: fullTld,
    isGovernment,
    isEducational,
    organization,
  };
}

/**
 * Identify known organization from domain.
 */
function identifyOrganization(domain: string): string | undefined {
  const orgMap: Record<string, string> = {
    'amazon.com': 'Amazon',
    'aws.amazon.com': 'Amazon Web Services',
    'google.com': 'Google',
    'cloud.google.com': 'Google Cloud',
    'microsoft.com': 'Microsoft',
    'azure.com': 'Microsoft Azure',
    'apple.com': 'Apple',
    'meta.com': 'Meta',
    'facebook.com': 'Meta',
    'github.com': 'GitHub',
    'twitter.com': 'X (Twitter)',
    'x.com': 'X (Twitter)',
    'linkedin.com': 'LinkedIn',
    'netflix.com': 'Netflix',
    'salesforce.com': 'Salesforce',
    'oracle.com': 'Oracle',
    'ibm.com': 'IBM',
    'intel.com': 'Intel',
    'nvidia.com': 'NVIDIA',
    'tesla.com': 'Tesla',
    'sec.gov': 'U.S. Securities and Exchange Commission',
    'ftc.gov': 'U.S. Federal Trade Commission',
    'fda.gov': 'U.S. Food and Drug Administration',
    'cdc.gov': 'U.S. Centers for Disease Control',
    'nih.gov': 'U.S. National Institutes of Health',
    'federalreserve.gov': 'U.S. Federal Reserve',
    'reuters.com': 'Reuters',
    'bloomberg.com': 'Bloomberg',
    'wsj.com': 'The Wall Street Journal',
    'nytimes.com': 'The New York Times',
    'bbc.com': 'BBC',
    'bbc.co.uk': 'BBC',
    'cnn.com': 'CNN',
    'wikipedia.org': 'Wikipedia',
  };
  
  return orgMap[domain];
}

/**
 * Normalize a domain for comparison.
 */
export function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '');
}

/**
 * Check if a domain matches a pattern (handles subdomains).
 */
export function domainMatches(domain: string, pattern: string): boolean {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedPattern = normalizeDomain(pattern);
  
  // Exact match
  if (normalizedDomain === normalizedPattern) {
    return true;
  }
  
  // Subdomain match (e.g., status.aws.amazon.com matches amazon.com)
  if (normalizedDomain.endsWith(`.${normalizedPattern}`)) {
    return true;
  }
  
  return false;
}

/**
 * Check if domain is in a list (handles subdomains).
 */
export function isInDomainList(domain: string, list: readonly string[]): boolean {
  return list.some(pattern => domainMatches(domain, pattern));
}

// ─────────────────────────────────────────────────────────────────────────────────
// TIER ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for tier assignment.
 */
export interface TierAssignmentOptions {
  /** Additional official domains */
  readonly additionalOfficial?: readonly string[];
  
  /** Additional verified domains */
  readonly additionalVerified?: readonly string[];
  
  /** Additional context domains */
  readonly additionalContext?: readonly string[];
  
  /** Additional disallowed domains */
  readonly additionalDisallowed?: readonly string[];
  
  /** Category for authoritative domain lookup */
  readonly category?: AuthoritativeCategory;
}

/**
 * Assign a source tier to a domain.
 */
export function assignTier(domain: string, options?: TierAssignmentOptions): SourceTier {
  const normalized = normalizeDomain(domain);
  const info = parseDomain(normalized);
  
  // Check disallowed first
  const disallowed = [
    ...DISALLOWED_DOMAINS,
    ...(options?.additionalDisallowed ?? []),
  ];
  if (isInDomainList(normalized, disallowed)) {
    return 'disallowed';
  }
  
  // Check official sources
  const officialLists = [
    ...Object.values(OFFICIAL_DOMAINS).flat(),
    ...(options?.additionalOfficial ?? []),
  ];
  
  // Add category-specific authoritative domains
  if (options?.category) {
    const categoryDomains = AUTHORITATIVE_DOMAINS.get(options.category);
    if (categoryDomains) {
      officialLists.push(...categoryDomains);
    }
  }
  
  if (isInDomainList(normalized, officialLists)) {
    return 'official';
  }
  
  // Government and educational domains are official by default
  if (info.isGovernment) {
    return 'official';
  }
  
  // Check verified sources (financial news, major tech docs)
  const verified = [
    ...OFFICIAL_DOMAINS.financial ?? [],
    ...OFFICIAL_DOMAINS.news ?? [],
    ...(options?.additionalVerified ?? []),
  ];
  if (isInDomainList(normalized, verified)) {
    return 'verified';
  }
  
  // Educational domains are verified
  if (info.isEducational) {
    return 'verified';
  }
  
  // Check context sources
  const context = [
    ...CONTEXT_DOMAINS,
    ...(options?.additionalContext ?? []),
  ];
  if (isInDomainList(normalized, context)) {
    return 'context';
  }
  
  // Everything else is general
  return 'general';
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALUE EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract potential values from a search result for conflict detection.
 */
export function extractValues(result: SearchResult): readonly ExtractedValue[] {
  const values: ExtractedValue[] = [];
  
  // Extract from title
  const titleValues = extractValuesFromText(result.title, 'title');
  values.push(...titleValues);
  
  // Extract from snippet if available
  if (isFullSearchResult(result)) {
    const snippetValues = extractValuesFromText(result.snippet, 'snippet');
    values.push(...snippetValues);
  }
  
  return values;
}

/**
 * Extract values from text.
 */
function extractValuesFromText(
  text: string,
  source: 'title' | 'snippet' | 'url'
): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  
  // Extract names (Title Case words that might be names)
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let match;
  while ((match = namePattern.exec(text)) !== null) {
    values.push({
      type: 'name',
      value: match[1]!,
      confidence: 0.7,
      source,
    });
  }
  
  // Extract titles (CEO, CFO, President, etc.)
  const titlePattern = /\b(CEO|CFO|COO|CTO|CIO|CISO|President|Chairman|Director|VP|Vice President|Chief\s+\w+\s+Officer)\b/gi;
  while ((match = titlePattern.exec(text)) !== null) {
    values.push({
      type: 'title',
      value: match[1]!,
      confidence: 0.9,
      source,
    });
  }
  
  // Extract dates
  const datePatterns = [
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
    /\b(\d{4}-\d{2}-\d{2})\b/g,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi,
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b/gi,
  ];
  
  for (const pattern of datePatterns) {
    while ((match = pattern.exec(text)) !== null) {
      values.push({
        type: 'date',
        value: match[1]!,
        confidence: 0.85,
        source,
      });
    }
  }
  
  // Extract version numbers
  const versionPattern = /\b[vV]?(\d+(?:\.\d+)+(?:-[a-zA-Z0-9]+)?)\b/g;
  while ((match = versionPattern.exec(text)) !== null) {
    values.push({
      type: 'version',
      value: match[1]!,
      confidence: 0.8,
      source,
    });
  }
  
  // Extract status indicators
  const statusPattern = /\b(operational|degraded|outage|down|up|available|unavailable|maintenance|incident|resolved)\b/gi;
  while ((match = statusPattern.exec(text)) !== null) {
    values.push({
      type: 'status',
      value: match[1]!.toLowerCase(),
      confidence: 0.85,
      source,
    });
  }
  
  return values;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESULT PROCESSING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Process a search result into SearchResultWithMeta.
 */
export function processResult(
  result: SearchResult,
  options?: TierAssignmentOptions
): SearchResultWithMeta {
  const domainInfo = parseDomain(result.url);
  const domain = (result as any).domain ?? domainInfo.normalized;
  const tier = assignTier(domain, options);
  const extractedValues = extractValues(result);
  
  const isAuthoritative = tier === 'official' || tier === 'verified';
  const include = tier !== 'disallowed';
  
  return {
    result,
    tier,
    isAuthoritative,
    normalizedDomain: domainInfo.normalized,
    rootDomain: domainInfo.root,
    include,
    excludeReason: include ? undefined : 'Domain is in disallowed list',
    extractedValues,
    processedAt: Date.now(),
  };
}

/**
 * Process multiple search results.
 */
export function processResults(
  results: readonly SearchResult[],
  options?: TierAssignmentOptions
): readonly SearchResultWithMeta[] {
  return results.map(r => processResult(r, options));
}

// ─────────────────────────────────────────────────────────────────────────────────
// DOMAIN FILTERING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Filter search results by domain lists.
 */
export function filterByDomains(
  results: readonly SearchResult[],
  filters?: SearchFilters,
  options?: TierAssignmentOptions
): FilteredResults {
  const processed = processResults(results, options);
  
  const included: SearchResultWithMeta[] = [];
  const excluded: SearchResultWithMeta[] = [];
  const byTier: Record<SourceTier, SearchResultWithMeta[]> = {
    official: [],
    verified: [],
    context: [],
    general: [],
    disallowed: [],
  };
  
  const excludedByReason: Record<string, number> = {};
  
  for (const meta of processed) {
    let shouldInclude = meta.include;
    let excludeReason = meta.excludeReason;
    
    // Apply allow list filter
    if (shouldInclude && filters?.allowDomains && filters.allowDomains.length > 0) {
      if (!isInDomainList(meta.normalizedDomain, filters.allowDomains)) {
        shouldInclude = false;
        excludeReason = 'Not in allow list';
      }
    }
    
    // Apply block list filter
    if (shouldInclude && filters?.blockDomains) {
      if (isInDomainList(meta.normalizedDomain, filters.blockDomains)) {
        shouldInclude = false;
        excludeReason = 'In block list';
      }
    }
    
    // Apply minimum tier filter
    if (shouldInclude && filters?.minTier) {
      const minPriority = TIER_PRIORITY[filters.minTier];
      const resultPriority = TIER_PRIORITY[meta.tier];
      if (resultPriority < minPriority) {
        shouldInclude = false;
        excludeReason = `Tier ${meta.tier} below minimum ${filters.minTier}`;
      }
    }
    
    // Update the result with final include status
    const finalMeta: SearchResultWithMeta = {
      ...meta,
      include: shouldInclude,
      excludeReason: shouldInclude ? undefined : excludeReason,
    };
    
    // Categorize
    if (shouldInclude) {
      included.push(finalMeta);
    } else {
      excluded.push(finalMeta);
      const reason = excludeReason ?? 'Unknown';
      excludedByReason[reason] = (excludedByReason[reason] ?? 0) + 1;
    }
    
    byTier[finalMeta.tier].push(finalMeta);
  }
  
  // Build stats
  const stats: FilterStats = {
    total: processed.length,
    included: included.length,
    excluded: excluded.length,
    excludedByReason,
    byTier: {
      official: byTier.official.length,
      verified: byTier.verified.length,
      context: byTier.context.length,
      general: byTier.general.length,
      disallowed: byTier.disallowed.length,
    },
  };
  
  return {
    all: processed,
    included,
    excluded,
    byTier,
    stats,
  };
}

/**
 * Filter to only authoritative results.
 */
export function filterToAuthoritative(
  results: readonly SearchResult[],
  options?: TierAssignmentOptions
): FilteredResults {
  return filterByDomains(results, { minTier: 'verified' }, options);
}

/**
 * Filter to only official results.
 */
export function filterToOfficial(
  results: readonly SearchResult[],
  options?: TierAssignmentOptions
): FilteredResults {
  return filterByDomains(results, { minTier: 'official' }, options);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

// Note: OFFICIAL_DOMAINS, DISALLOWED_DOMAINS, CONTEXT_DOMAINS are already exported inline above
