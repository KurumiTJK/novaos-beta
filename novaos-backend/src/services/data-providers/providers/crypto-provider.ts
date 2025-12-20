// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO PROVIDER — CoinGecko API (Free Tier)
// PATCHED VERSION - Compatible with existing NovaOS types
// ═══════════════════════════════════════════════════════════════════════════════

import {
  BaseProvider,
  type ProviderFetchParams,
} from './base-provider.js';

import type {
  ProviderResult,
  CryptoData,
} from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

const COIN_ID_MAP: Readonly<Record<string, string>> = {
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'USDT': 'tether', 'USDC': 'usd-coin',
  'BNB': 'binancecoin', 'XRP': 'ripple', 'ADA': 'cardano', 'DOGE': 'dogecoin',
  'SOL': 'solana', 'TRX': 'tron', 'DOT': 'polkadot', 'MATIC': 'matic-network',
  'LTC': 'litecoin', 'SHIB': 'shiba-inu', 'AVAX': 'avalanche-2', 'LINK': 'chainlink',
  'ATOM': 'cosmos', 'UNI': 'uniswap', 'XLM': 'stellar', 'XMR': 'monero',
  'ETC': 'ethereum-classic', 'BCH': 'bitcoin-cash', 'APT': 'aptos',
  'ARB': 'arbitrum', 'OP': 'optimism', 'PEPE': 'pepe', 'WIF': 'dogwifcoin',
  'BITCOIN': 'bitcoin', 'ETHEREUM': 'ethereum', 'SOLANA': 'solana',
};

const COIN_NAMES: Readonly<Record<string, string>> = {
  'bitcoin': 'Bitcoin', 'ethereum': 'Ethereum', 'tether': 'Tether',
  'usd-coin': 'USD Coin', 'binancecoin': 'BNB', 'ripple': 'XRP',
  'cardano': 'Cardano', 'dogecoin': 'Dogecoin', 'solana': 'Solana',
  'polkadot': 'Polkadot', 'matic-network': 'Polygon', 'litecoin': 'Litecoin',
  'avalanche-2': 'Avalanche', 'chainlink': 'Chainlink', 'cosmos': 'Cosmos',
  'uniswap': 'Uniswap', 'stellar': 'Stellar', 'monero': 'Monero',
  'pepe': 'Pepe', 'dogwifcoin': 'dogwifhat',
};

const COIN_SYMBOLS: Readonly<Record<string, string>> = {
  'bitcoin': 'BTC', 'ethereum': 'ETH', 'tether': 'USDT', 'usd-coin': 'USDC',
  'binancecoin': 'BNB', 'ripple': 'XRP', 'cardano': 'ADA', 'dogecoin': 'DOGE',
  'solana': 'SOL', 'polkadot': 'DOT', 'matic-network': 'MATIC', 'litecoin': 'LTC',
  'avalanche-2': 'AVAX', 'chainlink': 'LINK', 'cosmos': 'ATOM',
  'uniswap': 'UNI', 'stellar': 'XLM', 'monero': 'XMR', 'pepe': 'PEPE',
};

// ─────────────────────────────────────────────────────────────────────────────────
// COIN ID RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────────

function resolveCoinId(query: string): string | null {
  if (!query || typeof query !== 'string') return null;
  
  const normalized = query.trim().toUpperCase();
  if (COIN_ID_MAP[normalized]) return COIN_ID_MAP[normalized]!;
  
  const lowercased = query.trim().toLowerCase();
  if (COIN_NAMES[lowercased]) return lowercased;
  
  return lowercased;
}

function getSuggestedCoins(): readonly string[] {
  return ['BTC (Bitcoin)', 'ETH (Ethereum)', 'SOL (Solana)', 'USDT (Tether)', 'XRP (Ripple)'];
}

// ─────────────────────────────────────────────────────────────────────────────────
// CRYPTO PROVIDER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export interface CryptoProviderConfig {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly apiKey?: string;
}

export class CryptoProvider extends BaseProvider {
  readonly name = 'coingecko';
  readonly categories = ['crypto'] as const;
  readonly reliabilityTier = 'aggregator' as const;
  
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey?: string;
  
  constructor(config?: CryptoProviderConfig) {
    super();
    this.baseUrl = config?.baseUrl ?? COINGECKO_BASE_URL;
    this.timeoutMs = config?.timeoutMs ?? 10000;
    this.apiKey = config?.apiKey ?? process.env.COINGECKO_API_KEY;
  }
  
  override isAvailable(): boolean {
    return true;
  }
  
  protected async fetchInternal(params: ProviderFetchParams): Promise<ProviderResult> {
    const { query } = params;
    const startTime = Date.now();
    
    const coinId = resolveCoinId(query);
    
    if (!coinId) {
      return this.createFailResult(
        'INVALID_COIN',
        `Invalid cryptocurrency: "${query}". Examples: ${getSuggestedCoins().slice(0, 3).join(', ')}`,
        false
      );
    }
    
    const url = new URL(`${this.baseUrl}/simple/price`);
    url.searchParams.set('ids', coinId);
    url.searchParams.set('vs_currencies', 'usd');
    url.searchParams.set('include_24hr_change', 'true');
    url.searchParams.set('include_market_cap', 'true');
    url.searchParams.set('include_24hr_vol', 'true');
    
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json', 'User-Agent': 'NovaOS/1.0' };
      if (this.apiKey) headers['x-cg-pro-api-key'] = this.apiKey;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? this.timeoutMs);
      
      let response: Response;
      try {
        response = await fetch(url.toString(), { method: 'GET', headers, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (!response.ok) {
        if (response.status === 429) {
          return this.createFailResult('RATE_LIMITED', 'CoinGecko rate limit exceeded', true, 60);
        }
        return this.createFailResult(
          `HTTP_${response.status}`,
          `CoinGecko API error: ${response.status} ${response.statusText}`,
          response.status >= 500
        );
      }
      
      const data = await response.json() as Record<string, { usd: number; usd_24h_change?: number; usd_market_cap?: number; usd_24h_vol?: number }>;
      const coinData = data[coinId];
      
      if (!coinData) {
        return this.createFailResult('COIN_NOT_FOUND', `Cryptocurrency not found: "${query}"`, false);
      }
      
      // Build CryptoData matching the actual interface
      const cryptoData: CryptoData = {
        type: 'crypto',
        symbol: COIN_SYMBOLS[coinId] ?? query.toUpperCase(),
        name: COIN_NAMES[coinId] ?? coinId,
        priceUsd: coinData.usd,
        marketCapUsd: coinData.usd_market_cap,
        volume24hUsd: coinData.usd_24h_vol,
        change24h: coinData.usd_24h_change,
      };
      
      const latencyMs = Date.now() - startTime;
      return this.createOkResult(cryptoData, latencyMs);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.createFailResult('TIMEOUT', `Request timed out after ${this.timeoutMs}ms`, true);
      }
      return this.createFailResult(
        'FETCH_ERROR',
        `Failed to fetch crypto price: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }
  
  protected override getCacheKey(params: ProviderFetchParams): string {
    const coinId = resolveCoinId(params.query) ?? params.query.toLowerCase();
    return `${this.name}:${coinId}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export { resolveCoinId, getSuggestedCoins, COIN_ID_MAP, COIN_NAMES, COIN_SYMBOLS };
