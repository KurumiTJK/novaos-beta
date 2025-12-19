// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH TYPES — Live Data Router Search Results
// Type-level enforcement to prevent numeric contamination from web snippets
// ═══════════════════════════════════════════════════════════════════════════════

import type { DataCategory, LiveCategory, AuthoritativeCategory } from './categories.js';
import { isLiveCategory } from './categories.js';

// ─────────────────────────────────────────────────────────────────────────────────
// BRANDED TYPES — Compile-time distinction between search result types
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Brand for LiveCategorySearchResult.
 * This is a phantom type that exists only at compile time.
 */
declare const LiveCategorySearchResultBrand: unique symbol;

/**
 * Brand for FullSearchResult.
 * This is a phantom type that exists only at compile time.
 */
declare const FullSearchResultBrand: unique symbol;

// ─────────────────────────────────────────────────────────────────────────────────
// LIVE CATEGORY SEARCH RESULT — NO SNIPPET (Critical for leak prevention)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Search result for live data categories.
 * 
 * CRITICAL: This type intentionally OMITS the snippet field.
 * 
 * Web search snippets often contain stale numeric data (yesterday's stock price,
 * last week's weather, etc.). For live categories where we fetch real-time data
 * from providers, including snippets would risk numeric contamination.
 * 
 * The model should NEVER see snippet text for live categories - only the
 * verified provider data via NumericTokens.
 * 
 * @example
 * // Search for "AAPL stock price" returns:
 * {
 *   _brand: 'LiveCategorySearchResult',
 *   title: "Apple Inc. (AAPL) Stock Price, News, Quote & History",
 *   url: "https://finance.yahoo.com/quote/AAPL",
 *   domain: "finance.yahoo.com",
 *   category: "market",
 *   // NO snippet - intentionally omitted to prevent stale price leakage
 * }
 */
export interface LiveCategorySearchResult {
  /** Brand for type discrimination (phantom type) */
  readonly _brand: typeof LiveCategorySearchResultBrand;
  
  /** Page title */
  readonly title: string;
  
  /** Full URL */
  readonly url: string;
  
  /** Domain name (e.g., "finance.yahoo.com") */
  readonly domain: string;
  
  /** The live category this result relates to */
  readonly category: LiveCategory;
  
  /** Relevance score (0-1) */
  readonly relevance: number;
  
  /** When this result was fetched */
  readonly fetchedAt: number;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NO SNIPPET FIELD - This is intentional and critical for safety
  // ═══════════════════════════════════════════════════════════════════════════
}

// ─────────────────────────────────────────────────────────────────────────────────
// FULL SEARCH RESULT — With snippet (for non-live categories)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Full search result with snippet.
 * 
 * Used for:
 * - Authoritative categories (leadership, regulatory, etc.)
 * - General knowledge queries
 * - Any query where live numeric data is not the concern
 * 
 * The snippet field is safe here because:
 * 1. These categories don't have real-time numeric data
 * 2. Or the numeric data doesn't change frequently enough to matter
 * 3. Or we're explicitly doing web research (not provider-backed)
 */
export interface FullSearchResult {
  /** Brand for type discrimination (phantom type) */
  readonly _brand: typeof FullSearchResultBrand;
  
  /** Page title */
  readonly title: string;
  
  /** Full URL */
  readonly url: string;
  
  /** Domain name */
  readonly domain: string;
  
  /** The category this result relates to */
  readonly category: DataCategory;
  
  /** Relevance score (0-1) */
  readonly relevance: number;
  
  /** When this result was fetched */
  readonly fetchedAt: number;
  
  /** Search result snippet - contains text from the page */
  readonly snippet: string;
  
  /** Whether the snippet may contain numeric data */
  readonly snippetHasNumbers: boolean;
  
  /** Detected numbers in snippet (for audit/debugging) */
  readonly detectedNumbers?: readonly number[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// UNION TYPE — All search result types
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Union of all search result types.
 * Use type guards to narrow.
 */
export type SearchResult = LiveCategorySearchResult | FullSearchResult;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Type guard for LiveCategorySearchResult.
 * Checks both the brand and that snippet is NOT present.
 */
export function isLiveCategorySearchResult(
  result: SearchResult
): result is LiveCategorySearchResult {
  return (
    isLiveCategory(result.category) &&
    !('snippet' in result)
  );
}

/**
 * Type guard for FullSearchResult.
 * Checks that snippet IS present.
 */
export function isFullSearchResult(
  result: SearchResult
): result is FullSearchResult {
  return 'snippet' in result && typeof result.snippet === 'string';
}

/**
 * Check if a search result has a snippet (regardless of type).
 */
export function hasSnippet(result: SearchResult): result is FullSearchResult {
  return 'snippet' in result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RUNTIME ASSERTION — Invariant checking
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Runtime assertion that a result is a valid LiveCategorySearchResult.
 * Throws if the invariant is violated (snippet present for live category).
 * 
 * Use this at trust boundaries (e.g., after receiving search results from
 * an external service) to enforce the type-level guarantee at runtime.
 * 
 * @throws Error if result has a snippet field
 */
export function assertLiveCategoryResult(
  result: unknown,
  context?: string
): asserts result is LiveCategorySearchResult {
  if (typeof result !== 'object' || result === null) {
    throw new Error(
      `[LiveCategorySearchResult Invariant Violation]${context ? ` (${context})` : ''}: ` +
      `Expected object, got ${typeof result}`
    );
  }
  
  const obj = result as Record<string, unknown>;
  
  // Check required fields
  if (typeof obj['title'] !== 'string') {
    throw new Error(
      `[LiveCategorySearchResult Invariant Violation]${context ? ` (${context})` : ''}: ` +
      `Missing or invalid 'title' field`
    );
  }
  
  if (typeof obj['url'] !== 'string') {
    throw new Error(
      `[LiveCategorySearchResult Invariant Violation]${context ? ` (${context})` : ''}: ` +
      `Missing or invalid 'url' field`
    );
  }
  
  if (typeof obj['category'] !== 'string' || !isLiveCategory(obj['category'])) {
    throw new Error(
      `[LiveCategorySearchResult Invariant Violation]${context ? ` (${context})` : ''}: ` +
      `Missing or invalid 'category' field (must be a LiveCategory)`
    );
  }
  
  // CRITICAL: Check that snippet is NOT present
  if ('snippet' in obj) {
    throw new Error(
      `[LiveCategorySearchResult Invariant Violation]${context ? ` (${context})` : ''}: ` +
      `CRITICAL: 'snippet' field present on LiveCategorySearchResult. ` +
      `This violates the numeric contamination prevention invariant. ` +
      `Category: ${obj['category']}, URL: ${obj['url']}`
    );
  }
}

/**
 * Assert that an array of results are all valid LiveCategorySearchResults.
 */
export function assertAllLiveCategoryResults(
  results: unknown[],
  context?: string
): asserts results is LiveCategorySearchResult[] {
  for (let i = 0; i < results.length; i++) {
    assertLiveCategoryResult(results[i], `${context ?? 'results'}[${i}]`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSION FUNCTIONS — Safe transformations
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Convert a FullSearchResult to a LiveCategorySearchResult by stripping the snippet.
 * Use when you need to downgrade a result for safety.
 */
export function stripSnippet(
  result: FullSearchResult,
  category: LiveCategory
): LiveCategorySearchResult {
  return {
    _brand: undefined as unknown as typeof LiveCategorySearchResultBrand,
    title: result.title,
    url: result.url,
    domain: result.domain,
    category,
    relevance: result.relevance,
    fetchedAt: result.fetchedAt,
  };
}

/**
 * Create a LiveCategorySearchResult from raw data.
 * Ensures no snippet can be accidentally included.
 */
export function createLiveCategorySearchResult(
  title: string,
  url: string,
  domain: string,
  category: LiveCategory,
  relevance: number = 0.5,
  fetchedAt: number = Date.now()
): LiveCategorySearchResult {
  return {
    _brand: undefined as unknown as typeof LiveCategorySearchResultBrand,
    title,
    url,
    domain,
    category,
    relevance,
    fetchedAt,
  };
}

/**
 * Create a FullSearchResult from raw data.
 */
export function createFullSearchResult(
  title: string,
  url: string,
  domain: string,
  category: DataCategory,
  snippet: string,
  relevance: number = 0.5,
  fetchedAt: number = Date.now()
): FullSearchResult {
  // Detect numbers in snippet for auditing
  const numberPattern = /\d+(?:\.\d+)?/g;
  const matches = snippet.match(numberPattern);
  const detectedNumbers = matches ? matches.map(Number) : [];
  
  return {
    _brand: undefined as unknown as typeof FullSearchResultBrand,
    title,
    url,
    domain,
    category,
    relevance,
    fetchedAt,
    snippet,
    snippetHasNumbers: detectedNumbers.length > 0,
    detectedNumbers: detectedNumbers.length > 0 ? detectedNumbers : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH RESULT COLLECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Collection of search results with category separation.
 */
export interface SearchResultCollection {
  /** All results */
  readonly all: readonly SearchResult[];
  
  /** Live category results (snippet-free) */
  readonly live: readonly LiveCategorySearchResult[];
  
  /** Full results (with snippets) */
  readonly full: readonly FullSearchResult[];
  
  /** Results by category */
  readonly byCategory: ReadonlyMap<DataCategory, readonly SearchResult[]>;
  
  /** Total result count */
  readonly count: number;
  
  /** Search query that produced these results */
  readonly query: string;
  
  /** When search was performed */
  readonly searchedAt: number;
}

/**
 * Create a SearchResultCollection from raw results.
 * Automatically separates live vs full results.
 */
export function createSearchResultCollection(
  results: readonly SearchResult[],
  query: string
): SearchResultCollection {
  const live: LiveCategorySearchResult[] = [];
  const full: FullSearchResult[] = [];
  const byCategory = new Map<DataCategory, SearchResult[]>();
  
  for (const result of results) {
    // Separate by type
    if (isLiveCategorySearchResult(result)) {
      live.push(result);
    } else {
      full.push(result);
    }
    
    // Group by category
    const existing = byCategory.get(result.category);
    if (existing) {
      existing.push(result);
    } else {
      byCategory.set(result.category, [result]);
    }
  }
  
  return {
    all: results,
    live,
    full,
    byCategory,
    count: results.length,
    query,
    searchedAt: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SANITIZATION — Remove snippets from live category results
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize search results by removing snippets from live category results.
 * Use when you receive results from an untrusted source.
 */
export function sanitizeSearchResults(
  results: readonly Record<string, unknown>[]
): SearchResult[] {
  return results.map(raw => {
    const category = raw['category'] as DataCategory;
    
    if (isLiveCategory(category)) {
      // For live categories, explicitly strip snippet and return LiveCategorySearchResult
      return createLiveCategorySearchResult(
        String(raw['title'] ?? ''),
        String(raw['url'] ?? ''),
        String(raw['domain'] ?? ''),
        category,
        Number(raw['relevance'] ?? 0.5),
        Number(raw['fetchedAt'] ?? Date.now())
      );
    } else {
      // For other categories, include snippet
      return createFullSearchResult(
        String(raw['title'] ?? ''),
        String(raw['url'] ?? ''),
        String(raw['domain'] ?? ''),
        category,
        String(raw['snippet'] ?? ''),
        Number(raw['relevance'] ?? 0.5),
        Number(raw['fetchedAt'] ?? Date.now())
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// DOMAIN CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Known authoritative domains by category.
 */
export const AUTHORITATIVE_DOMAINS: ReadonlyMap<AuthoritativeCategory, readonly string[]> = new Map([
  ['leadership', [
    'linkedin.com',
    'bloomberg.com',
    'reuters.com',
    'sec.gov',
    'crunchbase.com',
  ]],
  ['regulatory', [
    'sec.gov',
    'ftc.gov',
    'fda.gov',
    'congress.gov',
    'regulations.gov',
    'law.cornell.edu',
  ]],
  ['software', [
    'github.com',
    'npmjs.com',
    'pypi.org',
    'docs.microsoft.com',
    'developer.apple.com',
    'developers.google.com',
  ]],
  ['service_status', [
    'status.aws.amazon.com',
    'status.cloud.google.com',
    'status.azure.com',
    'githubstatus.com',
    'status.stripe.com',
  ]],
]);

/**
 * Check if a domain is authoritative for a category.
 */
export function isAuthoritativeDomain(
  domain: string,
  category: AuthoritativeCategory
): boolean {
  const domains = AUTHORITATIVE_DOMAINS.get(category);
  if (!domains) return false;
  
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
  return domains.some(d => normalizedDomain === d || normalizedDomain.endsWith(`.${d}`));
}
