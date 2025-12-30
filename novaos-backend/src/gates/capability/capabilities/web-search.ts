// ═══════════════════════════════════════════════════════════════════════════════
// WEB SEARCH CAPABILITY — Stub (TODO: Wire to search service)
// ═══════════════════════════════════════════════════════════════════════════════

import type { Capability, SelectorInput, EvidenceItem } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY
// ─────────────────────────────────────────────────────────────────────────────────

export const webSearchCapability: Capability = {
  name: 'web_searcher',
  description: 'Searches the web for current information, news, and facts',

  async execute(input: SelectorInput): Promise<EvidenceItem | null> {
    // TODO: Wire to actual web search service
    // Options:
    // 1. Tavily API
    // 2. SerpAPI
    // 3. Bing Search API
    // 4. Custom scraper

    console.log('[WEB_SEARCHER] Stub - not yet implemented');
    console.log('[WEB_SEARCHER] Would search for:', input.userMessage);

    // Return null for now - this capability is not functional
    // When implemented, return:
    // return {
    //   type: 'web_result',
    //   formatted: formatSearchResults(results),
    //   source: 'web_searcher',
    //   raw: results,
    //   fetchedAt: Date.now(),
    // };

    return null;
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// FUTURE: Web Search Implementation
// ─────────────────────────────────────────────────────────────────────────────────

// interface SearchResult {
//   title: string;
//   url: string;
//   snippet: string;
//   publishedDate?: string;
// }

// function formatSearchResults(results: SearchResult[]): string {
//   return results
//     .slice(0, 5)
//     .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   Source: ${r.url}`)
//     .join('\n\n');
// }

// async function searchWeb(query: string): Promise<SearchResult[]> {
//   // Implementation here
// }
