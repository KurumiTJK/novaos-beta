// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH SERVICE
// Phase 3: Find canonical sources for each subskill
// Runs BEFORE node generation to provide context
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DesignerSession,
  RoutingData,
  ResearchData,
  Resource,
  Subskill,
  Route,
} from '../types.js';
import { updateSessionPhase } from './session.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const MIN_SOURCES_PER_SUBSKILL = 2;
const MAX_SOURCES_PER_SUBSKILL = 5;

// Trusted domains for fallback URLs
const TRUSTED_DOMAINS = [
  'developer.mozilla.org',
  'docs.python.org',
  'reactjs.org',
  'nodejs.org',
  'docs.aws.amazon.com',
  'cloud.google.com',
  'learn.microsoft.com',
  'wikipedia.org',
  'khanacademy.org',
  'coursera.org',
  'youtube.com',
  'github.com',
];

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN RESEARCH FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Run research for all subskills
 */
export async function runResearch(
  session: DesignerSession
): Promise<ResearchData> {
  if (!session.subskillsData || !session.routingData) {
    throw new Error('Subskills and routing data required before research');
  }

  const { subskills } = session.subskillsData;
  const { assignments } = session.routingData;

  // Create subskill-to-route map
  const routeMap = new Map<string, Route>();
  assignments.forEach(a => routeMap.set(a.subskillId, a.route));

  // Research each subskill
  const resources: ResearchData['resources'] = [];

  for (const subskill of subskills) {
    const route = routeMap.get(subskill.id) || 'practice';
    const sources = await researchSubskill(subskill, route);
    
    resources.push({
      subskillId: subskill.id,
      sources,
    });
  }

  const researchData: ResearchData = {
    resources,
    researchComplete: true,
  };

  // Update session
  await updateSessionPhase(session.id, 'research', researchData);

  return researchData;
}

/**
 * Research a single subskill
 */
async function researchSubskill(
  subskill: Subskill,
  route: Route
): Promise<Resource[]> {
  // Generate search queries
  const queries = generateSearchQueries(subskill, route);

  // TODO: Call Gemini grounded search API
  const rawResults = await searchWithGemini(queries);

  // Process and verify results
  const sources = await processSearchResults(rawResults, subskill);

  // Ensure minimum sources (with fallbacks if needed)
  if (sources.length < MIN_SOURCES_PER_SUBSKILL) {
    const fallbacks = generateFallbackSources(subskill, route);
    sources.push(...fallbacks.slice(0, MIN_SOURCES_PER_SUBSKILL - sources.length));
  }

  return sources.slice(0, MAX_SOURCES_PER_SUBSKILL);
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH QUERY GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate search queries for a subskill
 */
function generateSearchQueries(subskill: Subskill, route: Route): string[] {
  const queries: string[] = [];

  // Base query from title
  queries.push(`${subskill.title} tutorial`);
  queries.push(`${subskill.title} guide`);

  // Route-specific queries
  switch (route) {
    case 'recall':
      queries.push(`${subskill.title} concepts explained`);
      queries.push(`${subskill.title} fundamentals`);
      break;
    case 'practice':
      queries.push(`${subskill.title} exercises`);
      queries.push(`${subskill.title} practice problems`);
      break;
    case 'diagnose':
      queries.push(`${subskill.title} common mistakes`);
      queries.push(`${subskill.title} troubleshooting`);
      break;
    case 'apply':
      queries.push(`${subskill.title} real world examples`);
      queries.push(`${subskill.title} case studies`);
      break;
    case 'build':
      queries.push(`${subskill.title} project tutorial`);
      queries.push(`${subskill.title} hands-on`);
      break;
    case 'refine':
      queries.push(`${subskill.title} best practices`);
      queries.push(`${subskill.title} code review`);
      break;
    case 'plan':
      queries.push(`${subskill.title} learning path`);
      queries.push(`${subskill.title} roadmap`);
      break;
  }

  return queries;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

interface RawSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

/**
 * Search with Gemini grounded search
 * 
 * @stub - Implement with actual Gemini API
 */
async function searchWithGemini(queries: string[]): Promise<RawSearchResult[]> {
  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Implement Gemini grounded search
  // 
  // API call structure:
  // ```
  // const response = await gemini.generateContent({
  //   contents: [{ role: 'user', parts: [{ text: query }] }],
  //   tools: [{ googleSearch: {} }],
  // });
  // 
  // Extract grounding sources from response.candidates[0].groundingMetadata
  // ```
  // ═══════════════════════════════════════════════════════════════════════════

  // STUB: Return empty array (will use fallbacks)
  return [];
}

/**
 * Process and verify search results
 */
async function processSearchResults(
  results: RawSearchResult[],
  subskill: Subskill
): Promise<Resource[]> {
  const resources: Resource[] = [];

  for (const result of results) {
    // Verify URL is accessible
    const verified = await verifyUrl(result.url);

    const resource: Resource = {
      id: generateResourceId(),
      title: result.title,
      url: result.url,
      type: inferResourceType(result.url, result.title),
      status: verified ? 'verified' : 'pending',
      verifiedAt: verified ? new Date().toISOString() : undefined,
      fallbackUrl: generateFallbackUrl(subskill, result.domain),
    };

    resources.push(resource);
  }

  return resources;
}

/**
 * Verify URL is accessible
 */
async function verifyUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate fallback sources when search fails
 */
function generateFallbackSources(subskill: Subskill, route: Route): Resource[] {
  const searchTerm = encodeURIComponent(subskill.title);
  const sources: Resource[] = [];

  // YouTube search
  sources.push({
    id: generateResourceId(),
    title: `${subskill.title} - Video Tutorials`,
    url: `https://www.youtube.com/results?search_query=${searchTerm}+tutorial`,
    type: 'video',
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  });

  // Google search
  sources.push({
    id: generateResourceId(),
    title: `${subskill.title} - Web Resources`,
    url: `https://www.google.com/search?q=${searchTerm}+${route}`,
    type: 'article',
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  });

  return sources;
}

/**
 * Generate fallback URL for a specific domain
 */
function generateFallbackUrl(subskill: Subskill, originalDomain: string): string {
  const searchTerm = encodeURIComponent(subskill.title);

  // Try to find a similar trusted domain
  const originalBase = originalDomain.split('.')[0] || '';
  const trustedDomain = TRUSTED_DOMAINS.find(d => {
    const trustedBase = d.split('.')[0] || '';
    return d.includes(originalBase) || originalDomain.includes(trustedBase);
  });

  if (trustedDomain) {
    return `https://${trustedDomain}/search?q=${searchTerm}`;
  }

  // Default to Google search
  return `https://www.google.com/search?q=${searchTerm}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function generateResourceId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function inferResourceType(url: string, title: string): Resource['type'] {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();

  if (urlLower.includes('youtube.com') || urlLower.includes('vimeo.com')) {
    return 'video';
  }
  if (urlLower.includes('docs.') || urlLower.includes('documentation')) {
    return 'documentation';
  }
  if (urlLower.includes('github.com') || titleLower.includes('repository')) {
    return 'tool';
  }
  if (titleLower.includes('exercise') || titleLower.includes('practice')) {
    return 'exercise';
  }

  return 'article';
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const ResearchService = {
  run: runResearch,
  researchSubskill,
  generateQueries: generateSearchQueries,
  verifyUrl,
  generateFallbacks: generateFallbackSources,
  MIN_SOURCES: MIN_SOURCES_PER_SUBSKILL,
  MAX_SOURCES: MAX_SOURCES_PER_SUBSKILL,
  TRUSTED_DOMAINS,
};
