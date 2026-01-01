// ═══════════════════════════════════════════════════════════════════════════════
// FX CAPABILITY
// Fetches foreign exchange rates
// ═══════════════════════════════════════════════════════════════════════════════

import type { EvidenceItem } from '../types.js';
import { getProviderForCategory } from '../../../services/data-providers/registry.js';
import type { FxData } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CURRENCY PAIR EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

function extractCurrencyPair(message: string): string | null {
  // Direct pair patterns
  const patterns = [
    /\b([A-Z]{3})[\/\-]([A-Z]{3})\b/,
    /\b([A-Z]{3})\s+to\s+([A-Z]{3})\b/i,
    /\b([A-Z]{3})\s+in\s+([A-Z]{3})\b/i,
    /convert\s+([A-Z]{3})\s+to\s+([A-Z]{3})/i,
    /\b([A-Z]{3})([A-Z]{3})\b/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1] && match?.[2]) {
      return `${match[1].toUpperCase()}/${match[2].toUpperCase()}`;
    }
  }

  // Currency name mapping
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
    'chf': 'CHF',
    'canadian': 'CAD',
    'cad': 'CAD',
    'australian': 'AUD',
    'aud': 'AUD',
    'rupee': 'INR',
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

  const inverse = 1 / data.rate;
  parts.push(`Inverse: 1 ${data.quoteCurrency} = ${inverse.toFixed(4)} ${data.baseCurrency}`);

  if (data.change24h !== undefined) {
    const sign = data.change24h >= 0 ? '+' : '';
    parts.push(`24h Change: ${sign}${data.change24h.toFixed(4)}`);
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE
// ─────────────────────────────────────────────────────────────────────────────────

export async function execute(userMessage: string): Promise<EvidenceItem | null> {
  const pair = extractCurrencyPair(userMessage);
  if (!pair) {
    console.log('[FX] No currency pair found');
    return null;
  }

  const provider = getProviderForCategory('fx');
  if (!provider) {
    console.log('[FX] No fx provider available');
    return null;
  }

  if (!provider.isAvailable()) {
    console.log('[FX] Provider not available');
    return null;
  }

  try {
    const fetchResult = await provider.fetch({ query: pair, bypassCache: true });
    const result = fetchResult.result;

    if (!result.ok) {
      console.log('[FX] Fetch failed:', result.error?.message);
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
    console.error('[FX] Error:', error);
    return null;
  }
}
