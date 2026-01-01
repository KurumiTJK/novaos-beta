// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO CAPABILITY
// Fetches cryptocurrency prices
// ═══════════════════════════════════════════════════════════════════════════════

import type { EvidenceItem } from '../types.js';
import { getProviderForCategory } from '../../../services/data-providers/registry.js';
import type { CryptoData } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CRYPTO SYMBOL EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

function extractCryptoSymbol(message: string): string | null {
  const symbolMap: Record<string, string> = {
    'bitcoin': 'BTC',
    'btc': 'BTC',
    'ethereum': 'ETH',
    'eth': 'ETH',
    'solana': 'SOL',
    'sol': 'SOL',
    'dogecoin': 'DOGE',
    'doge': 'DOGE',
    'ripple': 'XRP',
    'xrp': 'XRP',
    'cardano': 'ADA',
    'ada': 'ADA',
    'polkadot': 'DOT',
    'litecoin': 'LTC',
    'chainlink': 'LINK',
    'polygon': 'MATIC',
    'avalanche': 'AVAX',
    'uniswap': 'UNI',
    'shiba': 'SHIB',
    'bnb': 'BNB',
    'binance': 'BNB',
  };

  const lower = message.toLowerCase();

  for (const [key, symbol] of Object.entries(symbolMap)) {
    if (lower.includes(key)) {
      return symbol;
    }
  }

  // Pattern matching
  const patterns = [
    /\b(BTC|ETH|SOL|DOGE|XRP|ADA|DOT|LTC|LINK|MATIC|AVAX|UNI|SHIB)\b/i,
    /crypto\s+([A-Z]{2,5})\b/i,
    /([A-Z]{2,5})\s+price/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return num.toLocaleString('en-US');
}

function formatCryptoEvidence(data: CryptoData): string {
  const parts = [
    `${data.name} (${data.symbol})`,
    `Price: $${formatNumber(data.priceUsd)}`,
  ];

  if (data.change24h !== undefined) {
    const sign = data.change24h >= 0 ? '+' : '';
    parts.push(`24h Change: ${sign}${data.change24h.toFixed(2)}%`);
  }

  if (data.marketCapUsd !== undefined) {
    parts.push(`Market Cap: $${formatLargeNumber(data.marketCapUsd)}`);
  }

  if (data.volume24hUsd !== undefined) {
    parts.push(`24h Volume: $${formatLargeNumber(data.volume24hUsd)}`);
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE
// ─────────────────────────────────────────────────────────────────────────────────

export async function execute(userMessage: string): Promise<EvidenceItem | null> {
  const symbol = extractCryptoSymbol(userMessage);
  if (!symbol) {
    console.log('[CRYPTO] No crypto symbol found');
    return null;
  }

  const provider = getProviderForCategory('crypto');
  if (!provider) {
    console.log('[CRYPTO] No crypto provider available');
    return null;
  }

  if (!provider.isAvailable()) {
    console.log('[CRYPTO] Provider not available');
    return null;
  }

  try {
    const fetchResult = await provider.fetch({ query: symbol, bypassCache: true });
    const result = fetchResult.result;

    if (!result.ok) {
      console.log('[CRYPTO] Fetch failed:', result.error?.message);
      return null;
    }

    const cryptoData = result.data as CryptoData;

    return {
      type: 'crypto',
      formatted: formatCryptoEvidence(cryptoData),
      source: 'crypto_fetcher',
      raw: cryptoData,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    console.error('[CRYPTO] Error:', error);
    return null;
  }
}
