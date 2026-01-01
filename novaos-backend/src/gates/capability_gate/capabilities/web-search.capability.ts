// ═══════════════════════════════════════════════════════════════════════════════
// WEB SEARCH CAPABILITY
// Searches the web for current information (stub)
// ═══════════════════════════════════════════════════════════════════════════════

import type { EvidenceItem } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE
// ─────────────────────────────────────────────────────────────────────────────────

export async function execute(userMessage: string): Promise<EvidenceItem | null> {
  // TODO: Wire to actual web search service
  // Options:
  // 1. Tavily API
  // 2. SerpAPI
  // 3. Bing Search API

  console.log('[WEB_SEARCH] Stub - not yet implemented');
  console.log('[WEB_SEARCH] Would search for:', userMessage);

  return null;
}
