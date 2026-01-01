// ═══════════════════════════════════════════════════════════════════════════════
// STOCK CAPABILITY
// Fetches live stock prices
// ═══════════════════════════════════════════════════════════════════════════════

import type { EvidenceItem } from '../types.js';
import { getProviderForCategory } from '../../../services/data-providers/registry.js';
import type { StockData } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TICKER EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

function extractTicker(message: string): string | null {
  // Look for explicit ticker patterns
  const patterns = [
    /\$([A-Z]{1,5})\b/,
    /\b([A-Z]{1,5})\s+stock\b/i,
    /\bstock\s+([A-Z]{1,5})\b/i,
    /\b([A-Z]{1,5})\s+price\b/i,
    /\bprice\s+(?:of\s+)?([A-Z]{1,5})\b/i,
    /\b([A-Z]{1,5})\s+trading\b/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  // Company name mapping
  const companyMap: Record<string, string> = {
    'apple': 'AAPL',
    'microsoft': 'MSFT',
    'google': 'GOOGL',
    'alphabet': 'GOOGL',
    'amazon': 'AMZN',
    'meta': 'META',
    'facebook': 'META',
    'tesla': 'TSLA',
    'nvidia': 'NVDA',
    'netflix': 'NFLX',
  };

  const lower = message.toLowerCase();
  for (const [company, ticker] of Object.entries(companyMap)) {
    if (lower.includes(company)) {
      return ticker;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

function formatStockEvidence(data: StockData): string {
  const parts = [
    `${data.symbol} (${data.exchange})`,
    `Price: $${data.price.toFixed(2)} ${data.currency}`,
  ];

  if (data.change !== undefined && data.changePercent !== undefined) {
    const sign = data.change >= 0 ? '+' : '';
    parts.push(`Change: ${sign}$${data.change.toFixed(2)} (${sign}${data.changePercent.toFixed(2)}%)`);
  }

  if (data.dayHigh !== undefined && data.dayLow !== undefined) {
    parts.push(`Day Range: $${data.dayLow.toFixed(2)} - $${data.dayHigh.toFixed(2)}`);
  }

  if (data.previousClose !== undefined) {
    parts.push(`Previous Close: $${data.previousClose.toFixed(2)}`);
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE
// ─────────────────────────────────────────────────────────────────────────────────

export async function execute(userMessage: string): Promise<EvidenceItem | null> {
  const ticker = extractTicker(userMessage);
  if (!ticker) {
    console.log('[STOCK] No ticker found');
    return null;
  }

  const provider = getProviderForCategory('market');
  if (!provider) {
    console.log('[STOCK] No market provider available');
    return null;
  }

  if (!provider.isAvailable()) {
    console.log('[STOCK] Provider not available');
    return null;
  }

  try {
    const fetchResult = await provider.fetch({ query: ticker, bypassCache: true });
    const result = fetchResult.result;

    if (!result.ok) {
      console.log('[STOCK] Fetch failed:', result.error?.message);
      return null;
    }

    const stockData = result.data as StockData;

    return {
      type: 'stock',
      formatted: formatStockEvidence(stockData),
      source: 'stock_fetcher',
      raw: stockData,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    console.error('[STOCK] Error:', error);
    return null;
  }
}
