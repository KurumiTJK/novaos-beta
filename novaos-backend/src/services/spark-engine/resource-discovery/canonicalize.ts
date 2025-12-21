// ═══════════════════════════════════════════════════════════════════════════════
// URL CANONICALIZATION — Normalization for Deduplication
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module handles URL normalization with two outputs:
//   1. Canonical URL — For deduplication (stripped, normalized)
//   2. Display URL — For users (clean but recognizable)
//
// Canonicalization rules:
//   - Remove tracking parameters (utm_*, fbclid, etc.)
//   - Normalize scheme to lowercase
//   - Normalize hostname to lowercase
//   - Remove default ports (80 for http, 443 for https)
//   - Sort query parameters alphabetically
//   - Remove trailing slashes (except root)
//   - Normalize percent encoding
//   - Handle provider-specific normalization
//
// ═══════════════════════════════════════════════════════════════════════════════

import {
  type CanonicalURL,
  type DisplayURL,
  createCanonicalURL,
  createDisplayURL,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TRACKING PARAMETERS TO STRIP
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Tracking parameters that should be removed for canonicalization.
 * These don't affect content but are used for analytics.
 */
const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  // Google Analytics / Ads
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
  'gclid',
  'gclsrc',
  'dclid',
  
  // Facebook
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_source',
  'fb_ref',
  
  // Twitter
  'twclid',
  
  // Microsoft / Bing
  'msclkid',
  
  // Mailchimp
  'mc_cid',
  'mc_eid',
  
  // HubSpot
  'hsa_acc',
  'hsa_cam',
  'hsa_grp',
  'hsa_ad',
  'hsa_src',
  'hsa_tgt',
  'hsa_kw',
  'hsa_mt',
  'hsa_net',
  'hsa_ver',
  
  // General tracking
  'ref',
  'ref_src',
  'ref_url',
  'source',
  'campaign',
  'affiliate',
  'partner',
  
  // Session/user tracking
  '_ga',
  '_gl',
  '_ke',
  'trk',
  'trk_contact',
  'trk_msg',
  'trk_module',
  'trk_sid',
  
  // Email tracking
  'oly_enc_id',
  'oly_anon_id',
  'vero_id',
  'vero_conv',
  
  // Misc
  'igshid',        // Instagram
  'si',            // Spotify
  'feature',       // YouTube (sometimes)
  'app',           // Various apps
  'share',         // Share tracking
]);

/**
 * Tracking parameter prefixes (match any param starting with these).
 */
const TRACKING_PREFIXES: readonly string[] = [
  'utm_',
  'pk_',      // Piwik/Matomo
  'mtm_',     // Matomo
  'hsa_',     // HubSpot
  'trk_',     // Various
  '__hs',     // HubSpot
  '_openstat',
];

/**
 * Parameters that should always be kept (override tracking removal).
 */
const PRESERVED_PARAMS: ReadonlySet<string> = new Set([
  // YouTube
  'v',        // Video ID
  't',        // Timestamp
  'list',     // Playlist ID
  'index',    // Playlist index
  'start',    // Start time
  'end',      // End time
  
  // GitHub
  'tab',      // Tab selection
  'q',        // Search query
  'type',     // Search type
  
  // General
  'page',     // Pagination
  'p',        // Page number
  'id',       // Resource ID
  'q',        // Query
  'query',    // Query
  'search',   // Search term
  'lang',     // Language
  'locale',   // Locale
  'version',  // Version
  'v',        // Version (also YouTube video)
]);

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Result of URL canonicalization.
 */
export interface CanonicalizationResult {
  /** Canonical URL for deduplication */
  readonly canonical: CanonicalURL;
  
  /** Display URL for users */
  readonly display: DisplayURL;
  
  /** Original URL */
  readonly original: string;
  
  /** Whether any changes were made */
  readonly modified: boolean;
  
  /** Parameters that were removed */
  readonly removedParams: readonly string[];
  
  /** Warnings during canonicalization */
  readonly warnings: readonly string[];
}

/**
 * Canonicalization options.
 */
export interface CanonicalizationOptions {
  /** Remove fragment/hash (default: true for canonical, false for display) */
  readonly removeFragment?: boolean;
  
  /** Remove trailing slash (default: true) */
  readonly removeTrailingSlash?: boolean;
  
  /** Sort query parameters (default: true) */
  readonly sortParams?: boolean;
  
  /** Remove empty query parameters (default: true) */
  readonly removeEmptyParams?: boolean;
  
  /** Force lowercase path (default: false, some paths are case-sensitive) */
  readonly lowercasePath?: boolean;
  
  /** Additional parameters to remove */
  readonly additionalTrackingParams?: readonly string[];
  
  /** Parameters to preserve (override default removal) */
  readonly preserveParams?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// URL PARSING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Safely parse a URL.
 */
function parseURL(urlString: string): URL | null {
  try {
    // Handle protocol-relative URLs
    if (urlString.startsWith('//')) {
      return new URL(`https:${urlString}`);
    }
    
    // Handle URLs without protocol
    if (!urlString.includes('://')) {
      return new URL(`https://${urlString}`);
    }
    
    return new URL(urlString);
  } catch {
    return null;
  }
}

/**
 * Check if a parameter is a tracking parameter.
 */
function isTrackingParam(
  param: string,
  additionalParams?: readonly string[]
): boolean {
  const lowerParam = param.toLowerCase();
  
  // Check preserved params first
  if (PRESERVED_PARAMS.has(lowerParam)) {
    return false;
  }
  
  // Check exact matches
  if (TRACKING_PARAMS.has(lowerParam)) {
    return true;
  }
  
  // Check additional params
  if (additionalParams?.some(p => p.toLowerCase() === lowerParam)) {
    return true;
  }
  
  // Check prefixes
  return TRACKING_PREFIXES.some(prefix => lowerParam.startsWith(prefix));
}

/**
 * Normalize percent encoding (uppercase hex digits, only encode necessary chars).
 */
function normalizePercentEncoding(str: string): string {
  try {
    // Decode then re-encode to normalize
    const decoded = decodeURIComponent(str);
    return encodeURIComponent(decoded)
      // Don't encode safe characters
      .replace(/%2F/gi, '/')
      .replace(/%40/g, '@')
      .replace(/%3A/gi, ':')
      .replace(/%2C/gi, ',')
      .replace(/%3B/gi, ';')
      .replace(/%2B/gi, '+')
      .replace(/%3D/gi, '=')
      .replace(/%26/gi, '&')
      .replace(/%24/gi, '$')
      .replace(/%21/gi, '!')
      .replace(/%27/gi, "'")
      .replace(/%28/gi, '(')
      .replace(/%29/gi, ')')
      .replace(/%2A/gi, '*');
  } catch {
    // If decoding fails, return original
    return str;
  }
}

/**
 * Remove default port from host.
 */
function removeDefaultPort(url: URL): void {
  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }
}

/**
 * Remove trailing slash from pathname (except root).
 */
function removeTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER-SPECIFIC NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Normalize YouTube URLs to consistent format.
 */
function normalizeYouTubeURL(url: URL): URL {
  const hostname = url.hostname.toLowerCase();
  
  // Convert youtu.be to youtube.com/watch
  if (hostname === 'youtu.be') {
    const videoId = url.pathname.slice(1).split('/')[0];
    if (videoId) {
      const newUrl = new URL('https://www.youtube.com/watch');
      newUrl.searchParams.set('v', videoId);
      
      // Preserve timestamp
      const timestamp = url.searchParams.get('t');
      if (timestamp) {
        newUrl.searchParams.set('t', timestamp);
      }
      
      return newUrl;
    }
  }
  
  // Convert embed URLs to watch URLs
  if (url.pathname.startsWith('/embed/')) {
    const videoId = url.pathname.slice(7).split('/')[0]?.split('?')[0];
    if (videoId) {
      const newUrl = new URL('https://www.youtube.com/watch');
      newUrl.searchParams.set('v', videoId);
      return newUrl;
    }
  }
  
  // Convert shorts URLs to watch URLs
  if (url.pathname.startsWith('/shorts/')) {
    const videoId = url.pathname.slice(8).split('/')[0]?.split('?')[0];
    if (videoId) {
      const newUrl = new URL('https://www.youtube.com/watch');
      newUrl.searchParams.set('v', videoId);
      return newUrl;
    }
  }
  
  // Normalize www vs non-www
  if (hostname === 'youtube.com') {
    url.hostname = 'www.youtube.com';
  }
  
  return url;
}

/**
 * Normalize GitHub URLs.
 */
function normalizeGitHubURL(url: URL): URL {
  // Remove .git suffix from repo URLs
  if (url.pathname.endsWith('.git')) {
    url.pathname = url.pathname.slice(0, -4);
  }
  
  // Normalize raw.githubusercontent.com to github.com
  if (url.hostname === 'raw.githubusercontent.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 3) {
      const [owner, repo, branch, ...rest] = parts;
      url.hostname = 'github.com';
      url.pathname = `/${owner}/${repo}/blob/${branch}/${rest.join('/')}`;
    }
  }
  
  return url;
}

/**
 * Apply provider-specific normalization.
 */
function applyProviderNormalization(url: URL): URL {
  const hostname = url.hostname.toLowerCase();
  
  // YouTube
  if (
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'youtu.be' ||
    hostname === 'm.youtube.com'
  ) {
    return normalizeYouTubeURL(url);
  }
  
  // GitHub
  if (
    hostname === 'github.com' ||
    hostname === 'www.github.com' ||
    hostname === 'raw.githubusercontent.com'
  ) {
    return normalizeGitHubURL(url);
  }
  
  return url;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN CANONICALIZATION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Canonicalize a URL for deduplication and display.
 * 
 * @param urlString - The URL to canonicalize
 * @param options - Canonicalization options
 * @returns Canonicalization result with canonical and display URLs
 */
export function canonicalizeURL(
  urlString: string,
  options: CanonicalizationOptions = {}
): CanonicalizationResult | null {
  const {
    removeFragment = true,
    removeTrailingSlash: removeSlash = true,
    sortParams = true,
    removeEmptyParams = true,
    lowercasePath = false,
    additionalTrackingParams,
    preserveParams,
  } = options;
  
  const warnings: string[] = [];
  const removedParams: string[] = [];
  
  // Parse the URL
  const parsed = parseURL(urlString.trim());
  if (!parsed) {
    return null;
  }
  
  // Store original for comparison
  const original = urlString;
  
  // Create working copy
  let url = new URL(parsed.href);
  
  // Apply provider-specific normalization
  url = applyProviderNormalization(url);
  
  // Normalize scheme to lowercase
  url.protocol = url.protocol.toLowerCase();
  
  // Normalize hostname to lowercase
  url.hostname = url.hostname.toLowerCase();
  
  // Remove default port
  removeDefaultPort(url);
  
  // Normalize path
  let pathname = url.pathname;
  
  // Normalize percent encoding in path
  pathname = normalizePercentEncoding(pathname);
  
  // Optionally lowercase path
  if (lowercasePath) {
    pathname = pathname.toLowerCase();
  }
  
  // Remove trailing slash
  if (removeSlash) {
    pathname = removeTrailingSlash(pathname);
  }
  
  url.pathname = pathname;
  
  // Process query parameters
  const params = new URLSearchParams(url.search);
  const newParams = new URLSearchParams();
  
  // Build preserved params set
  const preservedSet = new Set(PRESERVED_PARAMS);
  if (preserveParams) {
    for (const p of preserveParams) {
      preservedSet.add(p.toLowerCase());
    }
  }
  
  // Filter and collect parameters
  const paramEntries: Array<[string, string]> = [];
  
  for (const [key, value] of params) {
    // Skip empty params
    if (removeEmptyParams && !value) {
      removedParams.push(key);
      continue;
    }
    
    // Check if preserved
    if (preservedSet.has(key.toLowerCase())) {
      paramEntries.push([key, value]);
      continue;
    }
    
    // Skip tracking params
    if (isTrackingParam(key, additionalTrackingParams)) {
      removedParams.push(key);
      continue;
    }
    
    paramEntries.push([key, value]);
  }
  
  // Sort parameters if requested
  if (sortParams) {
    paramEntries.sort((a, b) => a[0].localeCompare(b[0]));
  }
  
  // Build new search params
  for (const [key, value] of paramEntries) {
    newParams.append(key, value);
  }
  
  url.search = newParams.toString();
  
  // Handle fragment
  const fragment = url.hash;
  if (removeFragment) {
    url.hash = '';
  }
  
  // Build canonical URL (no fragment for dedup)
  const canonicalUrl = new URL(url.href);
  canonicalUrl.hash = '';
  
  // Build display URL (may include fragment)
  const displayUrl = new URL(url.href);
  if (!removeFragment && fragment) {
    displayUrl.hash = fragment;
  }
  
  const canonical = createCanonicalURL(canonicalUrl.href);
  const display = createDisplayURL(displayUrl.href);
  const modified = canonical !== original || display !== original;
  
  return {
    canonical,
    display,
    original,
    modified,
    removedParams,
    warnings,
  };
}

/**
 * Quick canonicalization returning just the canonical URL.
 */
export function getCanonicalURL(urlString: string): CanonicalURL | null {
  const result = canonicalizeURL(urlString);
  return result?.canonical ?? null;
}

/**
 * Quick canonicalization returning just the display URL.
 */
export function getDisplayURL(urlString: string): DisplayURL | null {
  const result = canonicalizeURL(urlString, { removeFragment: false });
  return result?.display ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPARISON UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if two URLs are canonically equivalent.
 */
export function urlsAreEquivalent(url1: string, url2: string): boolean {
  const canonical1 = getCanonicalURL(url1);
  const canonical2 = getCanonicalURL(url2);
  
  if (!canonical1 || !canonical2) {
    return false;
  }
  
  return canonical1 === canonical2;
}

/**
 * Deduplicate a list of URLs by canonical form.
 */
export function deduplicateURLs(urls: readonly string[]): string[] {
  const seen = new Set<CanonicalURL>();
  const result: string[] = [];
  
  for (const url of urls) {
    const canonical = getCanonicalURL(url);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      result.push(url);
    }
  }
  
  return result;
}

/**
 * Group URLs by their canonical form.
 */
export function groupByCanonical(
  urls: readonly string[]
): Map<CanonicalURL, string[]> {
  const groups = new Map<CanonicalURL, string[]>();
  
  for (const url of urls) {
    const canonical = getCanonicalURL(url);
    if (canonical) {
      const group = groups.get(canonical) ?? [];
      group.push(url);
      groups.set(canonical, group);
    }
  }
  
  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a string is a valid HTTP/HTTPS URL.
 */
export function isValidURL(urlString: string): boolean {
  const parsed = parseURL(urlString);
  if (!parsed) return false;
  
  // Only allow http and https
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * Extract the domain from a URL.
 */
export function extractDomain(urlString: string): string | null {
  const parsed = parseURL(urlString);
  return parsed?.hostname.toLowerCase() ?? null;
}

/**
 * Extract the registrable domain (eTLD+1) from a URL.
 * Note: This is a simplified implementation. For production,
 * use the Public Suffix List (PSL).
 */
export function extractRegistrableDomain(urlString: string): string | null {
  const hostname = extractDomain(urlString);
  if (!hostname) return null;
  
  // Simple heuristic: take last two parts (or three for co.uk, etc.)
  const parts = hostname.split('.');
  
  // Known two-part TLDs
  const twoPartTLDs = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
    'com.au', 'net.au', 'org.au',
    'co.nz', 'org.nz',
    'co.jp', 'or.jp', 'ne.jp',
    'com.br', 'org.br',
    'co.in', 'org.in', 'net.in',
  ]);
  
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    if (twoPartTLDs.has(lastTwo)) {
      return parts.slice(-3).join('.');
    }
  }
  
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  
  return hostname;
}
