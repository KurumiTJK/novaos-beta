// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER ID EXTRACTION — YouTube, GitHub, and Other Providers
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// Extracts provider-specific identifiers from URLs:
//   - YouTube: video ID, playlist ID, channel ID
//   - GitHub: owner/repo, branch, path, gist ID
//   - Stack Overflow: question ID, answer ID
//   - npm/crates.io/PyPI: package name, version
//
// These IDs are used to:
//   1. Call provider APIs for metadata
//   2. Deduplicate resources across URL variants
//   3. Build canonical URLs
//
// ═══════════════════════════════════════════════════════════════════════════════

import { type ResourceProvider } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * YouTube resource identification.
 */
export interface YouTubeId {
  readonly provider: 'youtube';
  readonly type: 'video' | 'playlist' | 'channel' | 'shorts';
  readonly videoId?: string;
  readonly playlistId?: string;
  readonly channelId?: string;
  readonly channelHandle?: string;
  readonly timestamp?: number; // seconds
}

/**
 * GitHub resource identification.
 */
export interface GitHubId {
  readonly provider: 'github';
  readonly type: 'repo' | 'file' | 'directory' | 'gist' | 'issue' | 'pull' | 'release' | 'user' | 'org';
  readonly owner: string;
  readonly repo?: string;
  readonly branch?: string;
  readonly path?: string;
  readonly gistId?: string;
  readonly issueNumber?: number;
  readonly pullNumber?: number;
  readonly releaseTag?: string;
}

/**
 * Stack Overflow resource identification.
 */
export interface StackOverflowId {
  readonly provider: 'stackoverflow';
  readonly type: 'question' | 'answer' | 'user' | 'tag';
  readonly questionId?: number;
  readonly answerId?: number;
  readonly userId?: number;
  readonly tag?: string;
}

/**
 * Package registry resource identification.
 */
export interface PackageId {
  readonly provider: 'npm' | 'crates_io' | 'pypi';
  readonly type: 'package' | 'version';
  readonly packageName: string;
  readonly version?: string;
  readonly scope?: string; // npm scoped packages
}

/**
 * MDN resource identification.
 */
export interface MDNId {
  readonly provider: 'mdn';
  readonly type: 'docs' | 'api' | 'css' | 'html' | 'javascript';
  readonly path: string;
  readonly locale?: string;
}

/**
 * Generic web resource (no specific provider).
 */
export interface GenericId {
  readonly provider: 'unknown';
  readonly type: 'page';
  readonly domain: string;
  readonly path: string;
}

/**
 * Union of all provider IDs.
 */
export type ProviderId =
  | YouTubeId
  | GitHubId
  | StackOverflowId
  | PackageId
  | MDNId
  | GenericId;

/**
 * Result of provider detection.
 */
export interface ProviderDetectionResult {
  readonly provider: ResourceProvider;
  readonly providerId: ProviderId;
  readonly confidence: 'high' | 'medium' | 'low';
}

// ─────────────────────────────────────────────────────────────────────────────────
// YOUTUBE ID EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * YouTube video ID pattern (11 characters, alphanumeric + _ and -).
 */
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

/**
 * YouTube playlist ID pattern (starts with PL, OL, UU, etc.).
 */
const YOUTUBE_PLAYLIST_ID_PATTERN = /^(PL|OL|UU|FL|RD|LL)[a-zA-Z0-9_-]+$/;

/**
 * YouTube channel ID pattern (starts with UC).
 */
const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{22}$/;

/**
 * Parse timestamp string (e.g., "1h2m3s", "123", "1:23:45").
 */
function parseYouTubeTimestamp(timestamp: string): number | undefined {
  if (!timestamp) return undefined;
  
  // Pure seconds
  if (/^\d+$/.test(timestamp)) {
    return parseInt(timestamp, 10);
  }
  
  // Format: 1h2m3s
  const hmsMatch = timestamp.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
    const hours = parseInt(hmsMatch[1] || '0', 10);
    const minutes = parseInt(hmsMatch[2] || '0', 10);
    const seconds = parseInt(hmsMatch[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // Format: 1:23:45 or 1:23
  const colonMatch = timestamp.match(/^(?:(\d+):)?(\d+):(\d+)$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1] || '0', 10);
    const minutes = parseInt(colonMatch[2] || '0', 10);
    const seconds = parseInt(colonMatch[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  return undefined;
}

/**
 * Extract YouTube ID from URL.
 */
export function extractYouTubeId(url: string): YouTubeId | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  const params = parsed.searchParams;
  
  // Check if it's a YouTube domain
  const isYouTube = 
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'youtu.be' ||
    hostname === 'youtube-nocookie.com' ||
    hostname === 'www.youtube-nocookie.com';
  
  if (!isYouTube) {
    return null;
  }
  
  // Get timestamp if present
  const timestampParam = params.get('t') || params.get('start');
  const timestamp = timestampParam ? parseYouTubeTimestamp(timestampParam) : undefined;
  
  // Get playlist ID if present
  const playlistId = params.get('list') || undefined;
  
  // youtu.be short URLs
  if (hostname === 'youtu.be') {
    const videoId = pathname.slice(1).split('/')[0]?.split('?')[0];
    if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return {
        provider: 'youtube',
        type: 'video',
        videoId,
        playlistId,
        timestamp,
      };
    }
    return null;
  }
  
  // /watch?v=VIDEO_ID
  if (pathname === '/watch') {
    const videoId = params.get('v');
    if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return {
        provider: 'youtube',
        type: 'video',
        videoId,
        playlistId,
        timestamp,
      };
    }
  }
  
  // /embed/VIDEO_ID
  if (pathname.startsWith('/embed/')) {
    const videoId = pathname.slice(7).split('/')[0]?.split('?')[0];
    if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return {
        provider: 'youtube',
        type: 'video',
        videoId,
        playlistId,
        timestamp,
      };
    }
  }
  
  // /v/VIDEO_ID (old embed format)
  if (pathname.startsWith('/v/')) {
    const videoId = pathname.slice(3).split('/')[0]?.split('?')[0];
    if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return {
        provider: 'youtube',
        type: 'video',
        videoId,
        playlistId,
        timestamp,
      };
    }
  }
  
  // /shorts/VIDEO_ID
  if (pathname.startsWith('/shorts/')) {
    const videoId = pathname.slice(8).split('/')[0]?.split('?')[0];
    if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return {
        provider: 'youtube',
        type: 'shorts',
        videoId,
        timestamp,
      };
    }
  }
  
  // /live/VIDEO_ID
  if (pathname.startsWith('/live/')) {
    const videoId = pathname.slice(6).split('/')[0]?.split('?')[0];
    if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return {
        provider: 'youtube',
        type: 'video',
        videoId,
        timestamp,
      };
    }
  }
  
  // /playlist?list=PLAYLIST_ID
  if (pathname === '/playlist') {
    const listId = params.get('list');
    if (listId && YOUTUBE_PLAYLIST_ID_PATTERN.test(listId)) {
      return {
        provider: 'youtube',
        type: 'playlist',
        playlistId: listId,
      };
    }
  }
  
  // /channel/CHANNEL_ID
  if (pathname.startsWith('/channel/')) {
    const channelId = pathname.slice(9).split('/')[0];
    if (channelId && YOUTUBE_CHANNEL_ID_PATTERN.test(channelId)) {
      return {
        provider: 'youtube',
        type: 'channel',
        channelId,
      };
    }
  }
  
  // /@handle (channel handle)
  if (pathname.startsWith('/@')) {
    const handle = pathname.slice(2).split('/')[0];
    if (handle && handle.length > 0) {
      return {
        provider: 'youtube',
        type: 'channel',
        channelHandle: handle,
      };
    }
  }
  
  // /c/CUSTOM_NAME or /user/USERNAME (legacy)
  if (pathname.startsWith('/c/') || pathname.startsWith('/user/')) {
    const name = pathname.split('/')[2];
    if (name) {
      return {
        provider: 'youtube',
        type: 'channel',
        channelHandle: name,
      };
    }
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GITHUB ID EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * GitHub username/org pattern.
 */
const GITHUB_OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

/**
 * GitHub repo name pattern.
 */
const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Reserved GitHub paths (not owner/repo).
 */
const GITHUB_RESERVED_PATHS = new Set([
  'about',
  'contact',
  'explore',
  'features',
  'login',
  'logout',
  'marketplace',
  'new',
  'notifications',
  'organizations',
  'pricing',
  'search',
  'security',
  'settings',
  'sponsors',
  'topics',
  'trending',
  'collections',
  'events',
  'enterprise',
  'team',
  'customer-stories',
]);

/**
 * Extract GitHub ID from URL.
 */
export function extractGitHubId(url: string): GitHubId | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  
  // Check for gist.github.com
  if (hostname === 'gist.github.com') {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 1) {
      // /USERNAME/GIST_ID or /GIST_ID
      const gistId = parts.length >= 2 ? parts[1] : parts[0];
      const owner = parts.length >= 2 ? parts[0] : undefined;
      if (gistId && /^[a-f0-9]+$/i.test(gistId)) {
        return {
          provider: 'github',
          type: 'gist',
          owner: owner || 'unknown',
          gistId,
        };
      }
    }
    return null;
  }
  
  // Check for github.com
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    // Also handle raw.githubusercontent.com
    if (hostname === 'raw.githubusercontent.com') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 3) {
        const [owner, repo, branch, ...rest] = parts;
        if (owner && repo && GITHUB_OWNER_PATTERN.test(owner) && GITHUB_REPO_PATTERN.test(repo)) {
          return {
            provider: 'github',
            type: 'file',
            owner,
            repo,
            branch,
            path: rest.length > 0 ? rest.join('/') : undefined,
          };
        }
      }
    }
    return null;
  }
  
  const parts = pathname.split('/').filter(Boolean);
  
  if (parts.length === 0) {
    return null;
  }
  
  const [first, second, third, fourth, ...rest] = parts;
  
  // Skip reserved paths
  if (first && GITHUB_RESERVED_PATHS.has(first.toLowerCase())) {
    return null;
  }
  
  // Validate owner
  if (!first || !GITHUB_OWNER_PATTERN.test(first)) {
    return null;
  }
  
  const owner = first;
  
  // Just /owner (user or org page)
  if (!second) {
    return {
      provider: 'github',
      type: 'user',
      owner,
    };
  }
  
  // Validate repo name
  if (!GITHUB_REPO_PATTERN.test(second)) {
    return null;
  }
  
  const repo = second.replace(/\.git$/, ''); // Remove .git suffix
  
  // /owner/repo
  if (!third) {
    return {
      provider: 'github',
      type: 'repo',
      owner,
      repo,
    };
  }
  
  // /owner/repo/blob/BRANCH/PATH
  if (third === 'blob' || third === 'tree') {
    const branch = fourth;
    const path = rest.length > 0 ? rest.join('/') : undefined;
    return {
      provider: 'github',
      type: third === 'blob' ? 'file' : 'directory',
      owner,
      repo,
      branch,
      path,
    };
  }
  
  // /owner/repo/issues/NUMBER
  if (third === 'issues') {
    const issueNum = fourth ? parseInt(fourth, 10) : undefined;
    return {
      provider: 'github',
      type: 'issue',
      owner,
      repo,
      issueNumber: issueNum && !isNaN(issueNum) ? issueNum : undefined,
    };
  }
  
  // /owner/repo/pull/NUMBER
  if (third === 'pull') {
    const pullNum = fourth ? parseInt(fourth, 10) : undefined;
    return {
      provider: 'github',
      type: 'pull',
      owner,
      repo,
      pullNumber: pullNum && !isNaN(pullNum) ? pullNum : undefined,
    };
  }
  
  // /owner/repo/releases/tag/TAG
  if (third === 'releases') {
    if (fourth === 'tag' && rest.length > 0) {
      return {
        provider: 'github',
        type: 'release',
        owner,
        repo,
        releaseTag: rest[0],
      };
    }
    return {
      provider: 'github',
      type: 'release',
      owner,
      repo,
    };
  }
  
  // Default: treat as repo with subpath
  return {
    provider: 'github',
    type: 'repo',
    owner,
    repo,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STACK OVERFLOW ID EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract Stack Overflow ID from URL.
 */
export function extractStackOverflowId(url: string): StackOverflowId | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  
  // Check for Stack Overflow domains
  const isStackOverflow =
    hostname === 'stackoverflow.com' ||
    hostname === 'www.stackoverflow.com' ||
    hostname.endsWith('.stackexchange.com');
  
  if (!isStackOverflow) {
    return null;
  }
  
  const parts = pathname.split('/').filter(Boolean);
  
  // /questions/ID/slug
  if (parts[0] === 'questions' && parts[1]) {
    const questionId = parseInt(parts[1], 10);
    if (!isNaN(questionId)) {
      // Check for answer anchor
      const hash = parsed.hash;
      let answerId: number | undefined;
      if (hash) {
        const answerMatch = hash.match(/^#(\d+)$/) || hash.match(/^#answer-(\d+)$/);
        if (answerMatch) {
          answerId = parseInt(answerMatch[1]!, 10);
        }
      }
      
      return {
        provider: 'stackoverflow',
        type: answerId ? 'answer' : 'question',
        questionId,
        answerId,
      };
    }
  }
  
  // /a/ID (answer shortlink)
  if (parts[0] === 'a' && parts[1]) {
    const answerId = parseInt(parts[1], 10);
    if (!isNaN(answerId)) {
      return {
        provider: 'stackoverflow',
        type: 'answer',
        answerId,
      };
    }
  }
  
  // /q/ID (question shortlink)
  if (parts[0] === 'q' && parts[1]) {
    const questionId = parseInt(parts[1], 10);
    if (!isNaN(questionId)) {
      return {
        provider: 'stackoverflow',
        type: 'question',
        questionId,
      };
    }
  }
  
  // /users/ID/name
  if (parts[0] === 'users' && parts[1]) {
    const userId = parseInt(parts[1], 10);
    if (!isNaN(userId)) {
      return {
        provider: 'stackoverflow',
        type: 'user',
        userId,
      };
    }
  }
  
  // /questions/tagged/TAG
  if (parts[0] === 'questions' && parts[1] === 'tagged' && parts[2]) {
    return {
      provider: 'stackoverflow',
      type: 'tag',
      tag: parts[2],
    };
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PACKAGE REGISTRY ID EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract npm package ID from URL.
 */
export function extractNpmId(url: string): PackageId | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  
  if (hostname !== 'www.npmjs.com' && hostname !== 'npmjs.com') {
    return null;
  }
  
  const parts = pathname.split('/').filter(Boolean);
  
  // /package/NAME or /package/@SCOPE/NAME
  if (parts[0] === 'package') {
    if (parts[1]?.startsWith('@') && parts[2]) {
      // Scoped package
      const scope = parts[1];
      const packageName = parts[2];
      const version = parts[3]?.startsWith('v') ? parts[3].slice(1) : undefined;
      return {
        provider: 'npm',
        type: version ? 'version' : 'package',
        packageName: `${scope}/${packageName}`,
        scope,
        version,
      };
    } else if (parts[1]) {
      // Unscoped package
      const packageName = parts[1];
      const version = parts[2]?.startsWith('v') ? parts[2].slice(1) : undefined;
      return {
        provider: 'npm',
        type: version ? 'version' : 'package',
        packageName,
        version,
      };
    }
  }
  
  return null;
}

/**
 * Extract crates.io package ID from URL.
 */
export function extractCratesId(url: string): PackageId | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  
  if (hostname !== 'crates.io') {
    return null;
  }
  
  const parts = pathname.split('/').filter(Boolean);
  
  // /crates/NAME or /crates/NAME/VERSION
  if (parts[0] === 'crates' && parts[1]) {
    const packageName = parts[1];
    const version = parts[2];
    return {
      provider: 'crates_io',
      type: version ? 'version' : 'package',
      packageName,
      version,
    };
  }
  
  return null;
}

/**
 * Extract PyPI package ID from URL.
 */
export function extractPyPIId(url: string): PackageId | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  
  if (hostname !== 'pypi.org') {
    return null;
  }
  
  const parts = pathname.split('/').filter(Boolean);
  
  // /project/NAME or /project/NAME/VERSION
  if (parts[0] === 'project' && parts[1]) {
    const packageName = parts[1];
    const version = parts[2];
    return {
      provider: 'pypi',
      type: version ? 'version' : 'package',
      packageName,
      version,
    };
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MDN ID EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract MDN ID from URL.
 */
export function extractMDNId(url: string): MDNId | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  
  if (hostname !== 'developer.mozilla.org') {
    return null;
  }
  
  const parts = pathname.split('/').filter(Boolean);
  
  // /en-US/docs/... or /docs/...
  let locale: string | undefined;
  let docsIndex = parts.indexOf('docs');
  
  if (docsIndex === 1) {
    locale = parts[0];
  } else if (docsIndex !== 0) {
    return null;
  }
  
  const docParts = parts.slice(docsIndex + 1);
  if (docParts.length === 0) {
    return null;
  }
  
  const path = docParts.join('/');
  
  // Determine type based on path
  let type: MDNId['type'] = 'docs';
  if (path.startsWith('Web/API/')) {
    type = 'api';
  } else if (path.startsWith('Web/CSS/')) {
    type = 'css';
  } else if (path.startsWith('Web/HTML/')) {
    type = 'html';
  } else if (path.startsWith('Web/JavaScript/')) {
    type = 'javascript';
  }
  
  return {
    provider: 'mdn',
    type,
    path,
    locale,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// UNIFIED PROVIDER DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Detect provider and extract ID from any URL.
 */
export function detectProvider(url: string): ProviderDetectionResult | null {
  // Try each provider in order of specificity
  
  // YouTube
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    return {
      provider: 'youtube',
      providerId: youtubeId,
      confidence: youtubeId.videoId ? 'high' : 'medium',
    };
  }
  
  // GitHub
  const githubId = extractGitHubId(url);
  if (githubId) {
    return {
      provider: 'github',
      providerId: githubId,
      confidence: githubId.repo ? 'high' : 'medium',
    };
  }
  
  // Stack Overflow
  const stackOverflowId = extractStackOverflowId(url);
  if (stackOverflowId) {
    return {
      provider: 'stackoverflow',
      providerId: stackOverflowId,
      confidence: stackOverflowId.questionId ? 'high' : 'medium',
    };
  }
  
  // npm
  const npmId = extractNpmId(url);
  if (npmId) {
    return {
      provider: 'npm',
      providerId: npmId,
      confidence: 'high',
    };
  }
  
  // crates.io
  const cratesId = extractCratesId(url);
  if (cratesId) {
    return {
      provider: 'crates_io',
      providerId: cratesId,
      confidence: 'high',
    };
  }
  
  // PyPI
  const pypiId = extractPyPIId(url);
  if (pypiId) {
    return {
      provider: 'pypi',
      providerId: pypiId,
      confidence: 'high',
    };
  }
  
  // MDN
  const mdnId = extractMDNId(url);
  if (mdnId) {
    return {
      provider: 'mdn',
      providerId: mdnId,
      confidence: 'high',
    };
  }
  
  // Generic fallback
  try {
    const parsed = new URL(url);
    return {
      provider: 'unknown',
      providerId: {
        provider: 'unknown',
        type: 'page',
        domain: parsed.hostname.toLowerCase(),
        path: parsed.pathname,
      },
      confidence: 'low',
    };
  } catch {
    return null;
  }
}

/**
 * Get provider from hostname.
 */
export function getProviderFromHostname(hostname: string): ResourceProvider {
  const lower = hostname.toLowerCase();
  
  if (lower.includes('youtube.com') || lower === 'youtu.be') {
    return 'youtube';
  }
  if (lower.includes('github.com') || lower === 'gist.github.com') {
    return 'github';
  }
  if (lower.includes('stackoverflow.com') || lower.includes('stackexchange.com')) {
    return 'stackoverflow';
  }
  if (lower === 'developer.mozilla.org') {
    return 'mdn';
  }
  if (lower === 'npmjs.com' || lower === 'www.npmjs.com') {
    return 'npm';
  }
  if (lower === 'crates.io') {
    return 'crates_io';
  }
  if (lower === 'pypi.org') {
    return 'pypi';
  }
  if (lower.includes('docs.rs')) {
    return 'rust_docs';
  }
  if (lower.includes('docs.python.org')) {
    return 'python_docs';
  }
  if (lower === 'medium.com' || lower.endsWith('.medium.com')) {
    return 'medium';
  }
  if (lower === 'dev.to') {
    return 'dev_to';
  }
  
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────────
// ID TO STRING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Convert a provider ID to a unique string identifier.
 * Useful for caching and deduplication.
 */
export function providerIdToString(id: ProviderId): string {
  switch (id.provider) {
    case 'youtube':
      if (id.videoId) return `youtube:video:${id.videoId}`;
      if (id.playlistId) return `youtube:playlist:${id.playlistId}`;
      if (id.channelId) return `youtube:channel:${id.channelId}`;
      if (id.channelHandle) return `youtube:handle:${id.channelHandle}`;
      return 'youtube:unknown';
      
    case 'github':
      if (id.gistId) return `github:gist:${id.gistId}`;
      if (!id.repo) return `github:user:${id.owner}`;
      if (id.path) return `github:${id.type}:${id.owner}/${id.repo}/${id.branch || 'main'}/${id.path}`;
      return `github:${id.type}:${id.owner}/${id.repo}`;
      
    case 'stackoverflow':
      if (id.answerId) return `stackoverflow:answer:${id.answerId}`;
      if (id.questionId) return `stackoverflow:question:${id.questionId}`;
      if (id.userId) return `stackoverflow:user:${id.userId}`;
      if (id.tag) return `stackoverflow:tag:${id.tag}`;
      return 'stackoverflow:unknown';
      
    case 'npm':
    case 'crates_io':
    case 'pypi':
      if (id.version) return `${id.provider}:${id.packageName}@${id.version}`;
      return `${id.provider}:${id.packageName}`;
      
    case 'mdn':
      return `mdn:${id.path}`;
      
    case 'unknown':
      return `unknown:${id.domain}${id.path}`;
  }
}
