// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH — Search Result Types (CORRECTED)
// ═══════════════════════════════════════════════════════════════════════════════

import type { DataCategory, LiveCategory, AuthoritativeCategory } from './categories.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH RESULT BASE
// ─────────────────────────────────────────────────────────────────────────────────

export interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly source?: string;
  readonly publishedAt?: string;
  readonly score?: number;
  readonly domain?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FULL SEARCH RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export interface FullSearchResult extends SearchResult {
  readonly _brand: 'FullSearchResult';
  readonly domain: string;
  readonly category: DataCategory;
  readonly relevance: number;
  readonly authoritative: boolean;
  readonly freshness: 'fresh' | 'recent' | 'stale' | 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────────
// LIVE CATEGORY SEARCH RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export interface LiveCategorySearchResult {
  readonly _brand: 'LiveCategorySearchResult';
  readonly title: string;
  readonly url: string;
  readonly category: LiveCategory;
  readonly data: Record<string, unknown>;
  readonly fetchedAt: number;
  readonly provider: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

export function isFullSearchResult(result: unknown): result is FullSearchResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_brand' in result &&
    (result as FullSearchResult)._brand === 'FullSearchResult'
  );
}

export function isLiveCategorySearchResult(result: unknown): result is LiveCategorySearchResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_brand' in result &&
    (result as LiveCategorySearchResult)._brand === 'LiveCategorySearchResult'
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE DOMAINS MAPPING
// ─────────────────────────────────────────────────────────────────────────────────

export const AUTHORITATIVE_DOMAINS: ReadonlyMap<AuthoritativeCategory, readonly string[]> = new Map<AuthoritativeCategory, readonly string[]>([
  ['financial', ['sec.gov', 'investor.gov', 'finra.org', 'federalreserve.gov', 'treasury.gov']],
  ['scientific', ['pubmed.gov', 'nature.com', 'science.org', 'arxiv.org', 'ncbi.nlm.nih.gov']],
  ['news', ['reuters.com', 'apnews.com', 'bbc.com', 'npr.org', 'pbs.org']],
  ['sports', ['espn.com', 'nba.com', 'nfl.com', 'mlb.com', 'nhl.com']],
  ['legal', ['supremecourt.gov', 'uscourts.gov', 'justice.gov', 'law.cornell.edu']],
  ['medical', ['nih.gov', 'cdc.gov', 'fda.gov', 'who.int', 'mayoclinic.org']],
  ['government', ['usa.gov', 'whitehouse.gov', 'congress.gov', 'data.gov', 'gao.gov']],
  ['academic', ['scholar.google.com', 'jstor.org', 'doi.org', 'researchgate.net']],
]);

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export interface SearchOptions {
  readonly maxResults?: number;
  readonly categories?: readonly DataCategory[];
  readonly authoritativeOnly?: boolean;
  readonly freshnessRequired?: 'fresh' | 'recent' | 'any';
  readonly domainWhitelist?: readonly string[];
  readonly domainBlacklist?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH RESPONSE
// ─────────────────────────────────────────────────────────────────────────────────

export interface SearchResponse {
  readonly query: string;
  readonly results: readonly SearchResult[];
  readonly totalResults: number;
  readonly searchTimeMs: number;
  readonly provider: string;
  readonly cached?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROCESSED SEARCH RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export interface ProcessedSearchResult {
  readonly original: SearchResult;
  readonly domain: string;
  readonly category: DataCategory | null;
  readonly relevanceScore: number;
  readonly authoritative: boolean;
  readonly freshness: 'fresh' | 'recent' | 'stale' | 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH RESULT PROCESSOR OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export interface ProcessResultsOptions {
  readonly boostAuthoritative?: boolean;
  readonly authoritativeBoost?: number;
  readonly freshnessWeight?: number;
  readonly relevanceThreshold?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function createSearchResult(
  title: string,
  url: string,
  snippet: string,
  source?: string
): SearchResult {
  return { title, url, snippet, source };
}

export function createFullSearchResult(
  base: SearchResult,
  domain: string,
  category: DataCategory,
  relevance: number,
  authoritative: boolean,
  freshness: 'fresh' | 'recent' | 'stale' | 'unknown' = 'unknown'
): FullSearchResult {
  return {
    ...base,
    _brand: 'FullSearchResult',
    domain,
    category,
    relevance,
    authoritative,
    freshness,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isAuthoritativeDomain(domain: string, category?: AuthoritativeCategory): boolean {
  if (category) {
    const domains = AUTHORITATIVE_DOMAINS.get(category);
    return domains?.includes(domain) ?? false;
  }
  
  for (const domains of AUTHORITATIVE_DOMAINS.values()) {
    if (domains.includes(domain)) {
      return true;
    }
  }
  return false;
}

export function getCategoryForDomain(domain: string): AuthoritativeCategory | null {
  for (const [category, domains] of AUTHORITATIVE_DOMAINS.entries()) {
    if (domains.includes(domain)) {
      return category;
    }
  }
  return null;
}
