// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCES FETCHER
// Fetches web articles and YouTube videos for lesson activities
// Uses YouTube Data API v3 for video search
// ═══════════════════════════════════════════════════════════════════════════════

import type { PlanSubskill, LessonPlan } from '../../types.js';
import type { VideoResource, ResourceLink as ArticleResource } from '../types.js';

// Re-export for convenience
export type { VideoResource, ArticleResource };

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface DailyLessonResources {
  articles: ArticleResource[];
  videos: VideoResource[];
  searchedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

// YouTube API
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

// Google Custom Search API (supports both naming conventions)
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_CSE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CSE_ID;
const GOOGLE_SEARCH_URL = 'https://www.googleapis.com/customsearch/v1';

// Cache to avoid burning API quotas
const videoCache = new Map<string, { videos: VideoResource[]; expires: number }>();
const articleCache = new Map<string, { articles: ArticleResource[]; expires: number }>();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// Fetch timeout
const FETCH_TIMEOUT = 8000; // 8 seconds

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate unique activity ID
 */
export function generateActivityId(): string {
  return `a${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fetch resources for a lesson (articles + videos)
 */
export async function fetchResources(
  subskill: PlanSubskill,
  plan: LessonPlan
): Promise<DailyLessonResources> {
  const searchQuery = buildSearchQuery(subskill, plan);
  
  console.log(`[RESOURCES] Fetching for: ${searchQuery}`);
  
  const [articles, videos] = await Promise.all([
    fetchArticles(searchQuery, subskill).catch(err => {
      console.error('[RESOURCES] Article fetch failed:', err);
      return [];
    }),
    fetchYouTubeVideos(searchQuery).catch(err => {
      console.error('[RESOURCES] Video fetch failed:', err);
      return [];
    }),
  ]);
  
  console.log(`[RESOURCES] Found ${articles.length} articles, ${videos.length} videos`);
  
  return {
    articles,
    videos,
    searchedAt: new Date(),
  };
}

/**
 * Fetch a single best YouTube video for an activity
 * Strategy: Get relevant videos, then pick the one with most views
 * Returns fallback search link if no video found
 */
export async function fetchBestVideo(
  query: string,
  options: {
    preferTutorial?: boolean;
    maxDurationMinutes?: number;
    minViewCount?: number;
  } = {}
): Promise<VideoResource> {
  if (!YOUTUBE_API_KEY) {
    console.warn('[YOUTUBE] YOUTUBE_API_KEY not set');
    return createFallbackVideo(query);
  }
  
  // Add "tutorial" to query if preferred
  const searchQuery = options.preferTutorial ? `${query} tutorial` : query;
  
  try {
    const videos = await fetchYouTubeVideos(searchQuery, {
      maxResults: 10,
      videoDuration: options.maxDurationMinutes && options.maxDurationMinutes <= 4 ? 'short' : 'medium',
    });
    
    if (videos.length === 0) {
      return createFallbackVideo(searchQuery);
    }
    
    // Filter by duration if specified
    let filtered = videos;
    if (options.maxDurationMinutes) {
      filtered = videos.filter(v => {
        if (!v.duration) return true;
        const minutes = parseDurationToMinutes(v.duration);
        return minutes <= options.maxDurationMinutes!;
      });
    }
    
    // Filter by minimum view count if specified
    if (options.minViewCount) {
      filtered = filtered.filter(v => (v.viewCount || 0) >= options.minViewCount!);
    }
    
    // Return highest view count (already sorted) or fallback
    return filtered.length > 0 ? filtered[0] : (videos[0] || createFallbackVideo(searchQuery));
    
  } catch (error) {
    console.error('[YOUTUBE] fetchBestVideo error:', error);
    return createFallbackVideo(searchQuery);
  }
}

/**
 * Create a fallback video resource (YouTube search link)
 */
function createFallbackVideo(query: string): VideoResource {
  return {
    title: `Search: "${query}"`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    description: 'Click to search YouTube for relevant videos.',
    channel: 'YouTube Search',
  };
}

/**
 * Fetch a single best article for an activity
 */
export async function fetchBestArticle(
  query: string,
  preferredSources?: string[]
): Promise<ArticleResource | null> {
  const articles = await fetchArticles(query);
  
  if (articles.length === 0) return null;
  
  // Prefer specific sources if provided
  if (preferredSources && preferredSources.length > 0) {
    for (const source of preferredSources) {
      const match = articles.find(a => 
        a.source?.toLowerCase().includes(source.toLowerCase()) ||
        a.url.toLowerCase().includes(source.toLowerCase())
      );
      if (match) return match;
    }
  }
  
  return articles[0];
}

function buildSearchQuery(subskill: PlanSubskill, plan: LessonPlan): string {
  const query = `${subskill.title} ${plan.title}`;
  
  const routeTerms: Record<string, string> = {
    recall: 'explained basics fundamentals',
    practice: 'tutorial how to guide',
    diagnose: 'troubleshoot debug common issues',
    apply: 'examples use cases real world',
    build: 'project tutorial step by step',
    refine: 'best practices tips advanced',
    plan: 'roadmap learning path complete guide',
  };
  
  const routeTerm = routeTerms[subskill.route] || 'tutorial';
  
  return `${query} ${routeTerm}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────────
// YOUTUBE API
// ─────────────────────────────────────────────────────────────────────────────────

interface YouTubeSearchOptions {
  maxResults?: number;
  videoDuration?: 'any' | 'short' | 'medium' | 'long';
  publishedAfter?: string;
  order?: 'relevance' | 'viewCount' | 'date' | 'rating';
}

/**
 * Search YouTube for videos
 * Strategy: Search by relevance, get statistics, sort by view count
 * This gives us the most POPULAR video among RELEVANT results
 * 
 * Uses in-memory cache to protect YouTube quota (10,000 units/day)
 */
async function fetchYouTubeVideos(
  query: string,
  options: YouTubeSearchOptions = {}
): Promise<VideoResource[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn('[YOUTUBE] YOUTUBE_API_KEY not set, skipping video fetch');
    return [];
  }
  
  // Check cache first
  const cacheKey = `${query}|${options.videoDuration || 'medium'}`;
  const cached = videoCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.log(`[YOUTUBE] Cache hit for: "${query}"`);
    return cached.videos;
  }
  
  const maxResults = options.maxResults || 10;
  
  // Default to videos from last 2 years for freshness
  const publishedAfter = options.publishedAfter || (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    return date.toISOString();
  })();
  
  // Build search params
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: maxResults.toString(),
    order: options.order || 'relevance', // Get relevant first
    relevanceLanguage: 'en',
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    videoDuration: options.videoDuration || 'medium', // 4-20 minutes (good for tutorials)
    publishedAfter,
    key: YOUTUBE_API_KEY,
  });
  
  const searchUrl = `${YOUTUBE_SEARCH_URL}?${params.toString()}`;
  
  try {
    console.log(`[YOUTUBE] Searching: "${query}"`);
    
    const response = await fetchWithTimeout(searchUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[YOUTUBE] Search API error:', response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log('[YOUTUBE] No results found');
      return [];
    }
    
    // Map to VideoResource format (without stats yet)
    const videos: VideoResource[] = data.items.map((item: any) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description?.slice(0, 200),
    }));
    
    // Get video IDs for statistics lookup
    const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
    
    // Fetch statistics (view count, duration)
    const videosWithStats = await fetchVideoStatistics(videoIds, videos);
    
    // Sort by view count (most popular first)
    videosWithStats.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    
    console.log(`[YOUTUBE] Found ${videosWithStats.length} videos, top: "${videosWithStats[0]?.title}" (${videosWithStats[0]?.viewCount?.toLocaleString()} views)`);
    
    // Cache the results
    videoCache.set(cacheKey, { videos: videosWithStats, expires: Date.now() + CACHE_TTL });
    
    return videosWithStats;
    
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('[YOUTUBE] Request timed out');
    } else {
      console.error('[YOUTUBE] Fetch error:', error);
    }
    return [];
  }
}

/**
 * Fetch video statistics (duration, view count) using videos.list endpoint
 */
async function fetchVideoStatistics(
  videoIds: string,
  videos: VideoResource[]
): Promise<VideoResource[]> {
  if (!YOUTUBE_API_KEY || !videoIds) return videos;
  
  const params = new URLSearchParams({
    part: 'contentDetails,statistics',
    id: videoIds,
    key: YOUTUBE_API_KEY,
  });
  
  const url = `${YOUTUBE_VIDEOS_URL}?${params.toString()}`;
  
  try {
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.error('[YOUTUBE] Videos API error:', response.status);
      return videos;
    }
    
    const data = await response.json();
    
    if (!data.items) return videos;
    
    // Merge statistics into videos
    for (const item of data.items) {
      const video = videos.find(v => v.url.includes(item.id));
      if (video) {
        video.duration = formatDuration(item.contentDetails?.duration);
        video.viewCount = parseInt(item.statistics?.viewCount || '0', 10);
      }
    }
    
    return videos;
    
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('[YOUTUBE] Statistics request timed out');
    } else {
      console.error('[YOUTUBE] Statistics fetch error:', error);
    }
    return videos;
  }
}

/**
 * Convert ISO 8601 duration to readable format
 * PT4M13S -> "4:13"
 * PT1H30M -> "1:30:00"
 */
function formatDuration(isoDuration?: string): string | undefined {
  if (!isoDuration) return undefined;
  
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse duration string to minutes
 * "4:13" -> 4.22
 * "1:30:00" -> 90
 */
function parseDurationToMinutes(duration: string): number {
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  }
  if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ARTICLE FETCHER
// ─────────────────────────────────────────────────────────────────────────────────

// Trusted sources for technical content
const TRUSTED_SOURCES = [
  'developer.mozilla.org',
  'docs.microsoft.com',
  'learn.microsoft.com',
  'aws.amazon.com',
  'cloud.google.com',
  'kubernetes.io',
  'docker.com',
  'github.com',
  'stackoverflow.com',
  'medium.com',
  'dev.to',
  'freecodecamp.org',
  'digitalocean.com',
  'baeldung.com',
  'geeksforgeeks.org',
  'tutorialspoint.com',
  'w3schools.com',
  'css-tricks.com',
];

async function fetchArticles(
  query: string,
  subskill?: PlanSubskill
): Promise<ArticleResource[]> {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    console.warn('[ARTICLES] GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID not set');
    return [];
  }
  
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  const cached = articleCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.log(`[ARTICLES] Cache hit for: "${query}"`);
    return cached.articles;
  }
  
  // Build search params
  const params = new URLSearchParams({
    key: GOOGLE_SEARCH_API_KEY,
    cx: GOOGLE_SEARCH_ENGINE_ID,
    q: query,
    num: '10', // Max 10 results per query
  });
  
  const url = `${GOOGLE_SEARCH_URL}?${params.toString()}`;
  
  try {
    console.log(`[ARTICLES] Searching: "${query}"`);
    
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ARTICLES] Google Search API error:', response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log('[ARTICLES] No results found');
      return [];
    }
    
    // Map to ArticleResource format
    const articles: ArticleResource[] = data.items.map((item: any) => ({
      title: item.title,
      url: item.link,
      source: extractDomain(item.link),
      snippet: item.snippet,
    }));
    
    // Sort: prioritize trusted sources
    articles.sort((a, b) => {
      const aScore = getTrustScore(a.source || '');
      const bScore = getTrustScore(b.source || '');
      return bScore - aScore;
    });
    
    console.log(`[ARTICLES] Found ${articles.length} articles, top: "${articles[0]?.title}" (${articles[0]?.source})`);
    
    // Cache the results
    articleCache.set(cacheKey, { articles, expires: Date.now() + CACHE_TTL });
    
    return articles;
    
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('[ARTICLES] Request timed out');
    } else {
      console.error('[ARTICLES] Fetch error:', error);
    }
    return [];
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Get trust score for a domain (higher = better)
 */
function getTrustScore(domain: string): number {
  // Official documentation sites get highest score
  if (domain.includes('microsoft.com') || domain.includes('learn.microsoft.com')) return 100;
  if (domain.includes('developer.mozilla.org')) return 100;
  if (domain.includes('docs.') || domain.includes('documentation')) return 95;
  
  // Check against trusted sources list
  const trustedIndex = TRUSTED_SOURCES.findIndex(s => domain.includes(s));
  if (trustedIndex !== -1) {
    // Earlier in list = higher score
    return 90 - trustedIndex;
  }
  
  // Known quality sites
  if (domain.includes('github.com')) return 80;
  if (domain.includes('stackoverflow.com')) return 75;
  
  // Default score
  return 50;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE REFRESH
// ─────────────────────────────────────────────────────────────────────────────────

export async function refreshResources(
  dailyLessonId: string,
  subskill: PlanSubskill,
  plan: LessonPlan
): Promise<DailyLessonResources> {
  const { getSupabase } = await import('../../../../db/index.js');
  const supabase = getSupabase();
  
  const resources = await fetchResources(subskill, plan);
  
  await supabase
    .from('daily_lessons')
    .update({
      resources,
      resources_fetched_at: new Date().toISOString(),
    })
    .eq('id', dailyLessonId);
  
  return resources;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Clear expired cache entries (call periodically if needed)
 */
export function clearExpiredCache(): { videos: number; articles: number } {
  const now = Date.now();
  let videosCleared = 0;
  let articlesCleared = 0;
  
  for (const [key, value] of videoCache.entries()) {
    if (value.expires < now) {
      videoCache.delete(key);
      videosCleared++;
    }
  }
  
  for (const [key, value] of articleCache.entries()) {
    if (value.expires < now) {
      articleCache.delete(key);
      articlesCleared++;
    }
  }
  
  return { videos: videosCleared, articles: articlesCleared };
}

/**
 * Get cache stats
 */
export function getCacheStats(): { 
  videos: { size: number; oldestMs: number };
  articles: { size: number; oldestMs: number };
} {
  let videoOldest = 0;
  let articleOldest = 0;
  
  for (const value of videoCache.values()) {
    const age = Date.now() - (value.expires - CACHE_TTL);
    if (age > videoOldest) videoOldest = age;
  }
  
  for (const value of articleCache.values()) {
    const age = Date.now() - (value.expires - CACHE_TTL);
    if (age > articleOldest) articleOldest = age;
  }
  
  return { 
    videos: { size: videoCache.size, oldestMs: videoOldest },
    articles: { size: articleCache.size, oldestMs: articleOldest },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const ResourcesFetcher = {
  fetch: fetchResources,
  refresh: refreshResources,
  fetchBestVideo,
  fetchBestArticle,
  clearExpiredCache,
  getCacheStats,
};
