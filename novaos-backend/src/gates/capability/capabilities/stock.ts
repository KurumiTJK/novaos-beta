// ═══════════════════════════════════════════════════════════════════════════════
// STOCK CAPABILITY — Wraps FinnhubProvider
// ═══════════════════════════════════════════════════════════════════════════════

import type { Capability, SelectorInput, EvidenceItem } from '../types.js';
import { getProviderForCategory } from '../../../services/data-providers/registry.js';
import type { StockData } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TICKER EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract stock ticker from user message.
 */
function extractTicker(message: string): string | null {
  // Look for explicit ticker patterns
  const patterns = [
    /\$([A-Z]{1,5})\b/,           // $AAPL
    /\b([A-Z]{1,5})\s+stock\b/i,   // AAPL stock
    /\bstock\s+([A-Z]{1,5})\b/i,   // stock AAPL
    /\b([A-Z]{1,5})\s+price\b/i,   // AAPL price
    /\bprice\s+(?:of\s+)?([A-Z]{1,5})\b/i, // price of AAPL
    /\b([A-Z]{1,5})\s+trading\b/i, // AAPL trading
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  // Look for company name mentions
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

  // Last resort: look for standalone 1-5 letter uppercase
  const standaloneMatch = message.match(/\b([A-Z]{1,5})\b/);
  if (standaloneMatch?.[1]) {
    // Exclude common words
    const excluded = new Set(['I', 'A', 'AN', 'THE', 'IS', 'IT', 'AT', 'TO', 'IN', 'ON', 'FOR', 'AND', 'OR', 'BE', 'AM', 'ARE', 'WAS', 'USD', 'EUR', 'GBP']);
    if (!excluded.has(standaloneMatch[1])) {
      return standaloneMatch[1];
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
// CAPABILITY
// ─────────────────────────────────────────────────────────────────────────────────

export const stockCapability: Capability = {
  name: 'stock_fetcher',
  description: 'Fetches live stock/market prices for ticker symbols (e.g., AAPL, TSLA, MSFT)',

  async execute(input: SelectorInput): Promise<EvidenceItem | null> {
    const ticker = extractTicker(input.userMessage);
    if (!ticker) {
      console.log('[STOCK_FETCHER] No ticker found in message');
      return null;
    }

    const provider = getProviderForCategory('market');
    if (!provider) {
      console.log('[STOCK_FETCHER] No market provider available');
      return null;
    }

    if (!provider.isAvailable()) {
      console.log('[STOCK_FETCHER] Provider not available (missing API key?)');
      return null;
    }

    try {
      const fetchResult = await provider.fetch({ query: ticker, bypassCache: true });
      const result = fetchResult.result;

      if (!result.ok) {
        console.log('[STOCK_FETCHER] Fetch failed:', result.error?.message);
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
      console.error('[STOCK_FETCHER] Error:', error);
      return null;
    }
  },
};
