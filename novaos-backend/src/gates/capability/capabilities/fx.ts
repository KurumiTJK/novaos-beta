// ═══════════════════════════════════════════════════════════════════════════════
// FX CAPABILITY — Wraps FxProvider
// ═══════════════════════════════════════════════════════════════════════════════

import type { Capability, SelectorInput, EvidenceItem } from '../types.js';
import { getProviderForCategory } from '../../../services/data-providers/registry.js';
import type { FxData } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CURRENCY PAIR EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract currency pair from user message.
 */
function extractCurrencyPair(message: string): string | null {
  // Direct pair patterns
  const patterns = [
    /\b([A-Z]{3})[\/\-]([A-Z]{3})\b/,         // USD/EUR or USD-EUR
    /\b([A-Z]{3})\s+to\s+([A-Z]{3})\b/i,      // USD to EUR
    /\b([A-Z]{3})\s+in\s+([A-Z]{3})\b/i,      // USD in EUR
    /convert\s+([A-Z]{3})\s+to\s+([A-Z]{3})/i, // convert USD to EUR
    /\b([A-Z]{3})([A-Z]{3})\b/,               // USDEUR
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1] && match?.[2]) {
      return `${match[1].toUpperCase()}/${match[2].toUpperCase()}`;
    }
  }

  // Currency name to code mapping
  const currencyNames: Record<string, string> = {
    'dollar': 'USD',
    'dollars': 'USD',
    'usd': 'USD',
    'euro': 'EUR',
    'euros': 'EUR',
    'eur': 'EUR',
    'pound': 'GBP',
    'pounds': 'GBP',
    'sterling': 'GBP',
    'gbp': 'GBP',
    'yen': 'JPY',
    'jpy': 'JPY',
    'yuan': 'CNY',
    'renminbi': 'CNY',
    'cny': 'CNY',
    'franc': 'CHF',
    'francs': 'CHF',
    'chf': 'CHF',
    'canadian': 'CAD',
    'cad': 'CAD',
    'australian': 'AUD',
    'aud': 'AUD',
    'rupee': 'INR',
    'rupees': 'INR',
    'inr': 'INR',
  };

  const lower = message.toLowerCase();
  const found: string[] = [];

  for (const [name, code] of Object.entries(currencyNames)) {
    if (lower.includes(name) && !found.includes(code)) {
      found.push(code);
    }
  }

  if (found.length >= 2) {
    return `${found[0]}/${found[1]}`;
  }

  // Default: if only one currency mentioned, assume USD as base
  if (found.length === 1 && found[0] !== 'USD') {
    return `USD/${found[0]}`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

function formatFxEvidence(data: FxData): string {
  const parts = [
    `Exchange Rate: ${data.baseCurrency}/${data.quoteCurrency}`,
    `Rate: 1 ${data.baseCurrency} = ${data.rate.toFixed(4)} ${data.quoteCurrency}`,
  ];

  // Inverse rate for convenience
  const inverse = 1 / data.rate;
  parts.push(`Inverse: 1 ${data.quoteCurrency} = ${inverse.toFixed(4)} ${data.baseCurrency}`);

  if (data.change24h !== undefined) {
    const sign = data.change24h >= 0 ? '+' : '';
    parts.push(`24h Change: ${sign}${data.change24h.toFixed(4)}`);
  }

  if (data.changePercent24h !== undefined) {
    const sign = data.changePercent24h >= 0 ? '+' : '';
    parts.push(`24h Change %: ${sign}${data.changePercent24h.toFixed(2)}%`);
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY
// ─────────────────────────────────────────────────────────────────────────────────

export const fxCapability: Capability = {
  name: 'fx_fetcher',
  description: 'Fetches foreign exchange rates between currencies (e.g., USD/EUR, GBP/JPY)',

  async execute(input: SelectorInput): Promise<EvidenceItem | null> {
    const pair = extractCurrencyPair(input.userMessage);
    if (!pair) {
      console.log('[FX_FETCHER] No currency pair found in message');
      return null;
    }

    const provider = getProviderForCategory('fx');
    if (!provider) {
      console.log('[FX_FETCHER] No fx provider available');
      return null;
    }

    if (!provider.isAvailable()) {
      console.log('[FX_FETCHER] Provider not available');
      return null;
    }

    try {
      const fetchResult = await provider.fetch({ query: pair, bypassCache: true });
      const result = fetchResult.result;

      if (!result.ok) {
        console.log('[FX_FETCHER] Fetch failed:', result.error?.message);
        return null;
      }

      const fxData = result.data as FxData;

      return {
        type: 'fx',
        formatted: formatFxEvidence(fxData),
        source: 'fx_fetcher',
        raw: fxData,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      console.error('[FX_FETCHER] Error:', error);
      return null;
    }
  },
};
