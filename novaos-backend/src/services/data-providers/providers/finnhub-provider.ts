// ═══════════════════════════════════════════════════════════════════════════════
// FINNHUB PROVIDER — Finnhub API (Requires API Key)
// PATCHED VERSION - Compatible with existing NovaOS types
// ═══════════════════════════════════════════════════════════════════════════════

import {
  BaseProvider,
  type ProviderFetchParams,
} from './base-provider.js';

import type {
  ProviderResult,
  StockData,
} from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

const SYMBOL_ALIASES: Readonly<Record<string, string>> = {
  // Company names → tickers (these should silently resolve)
  'APPLE': 'AAPL', 'MICROSOFT': 'MSFT', 'GOOGLE': 'GOOGL', 'ALPHABET': 'GOOGL',
  'AMAZON': 'AMZN', 'META': 'META', 'FACEBOOK': 'META', 'TESLA': 'TSLA',
  'NVIDIA': 'NVDA', 'NETFLIX': 'NFLX', 'PAYPAL': 'PYPL', 'UBER': 'UBER',
  'AIRBNB': 'ABNB', 'COINBASE': 'COIN', 'SHOPIFY': 'SHOP', 'SPOTIFY': 'SPOT',
  'JPMORGAN': 'JPM', 'GOLDMAN': 'GS', 'VISA': 'V', 'MASTERCARD': 'MA',
  'WALMART': 'WMT', 'DISNEY': 'DIS', 'NIKE': 'NKE', 'STARBUCKS': 'SBUX',
  'SP500': 'SPY', 'S&P': 'SPY', 'S&P500': 'SPY', 'DOW': 'DIA', 'NASDAQ': 'QQQ',
  // Alternate ticker classes (silent resolve)
  'GOOG': 'GOOGL',
};

/**
 * Common typos/misspellings → suggested correction + company name
 * These should NOT silently resolve - instead show a suggestion to the user
 */
const TYPO_SUGGESTIONS: Readonly<Record<string, { ticker: string; company: string }>> = {
  'APPL': { ticker: 'AAPL', company: 'Apple' },
  'APLE': { ticker: 'AAPL', company: 'Apple' },
  'GOGL': { ticker: 'GOOGL', company: 'Google/Alphabet' },
  'GOGGLE': { ticker: 'GOOGL', company: 'Google/Alphabet' },
  'AMAZ': { ticker: 'AMZN', company: 'Amazon' },
  'AMAZN': { ticker: 'AMZN', company: 'Amazon' },
  'TELA': { ticker: 'TSLA', company: 'Tesla' },
  'TELSA': { ticker: 'TSLA', company: 'Tesla' },
  'TESLE': { ticker: 'TSLA', company: 'Tesla' },
  'NVID': { ticker: 'NVDA', company: 'NVIDIA' },
  'NVIIDA': { ticker: 'NVDA', company: 'NVIDIA' },
  'MIRCOSOFT': { ticker: 'MSFT', company: 'Microsoft' },
  'MICROSFOT': { ticker: 'MSFT', company: 'Microsoft' },
  'NETFLEX': { ticker: 'NFLX', company: 'Netflix' },
  'NETFLX': { ticker: 'NFLX', company: 'Netflix' },
  'FACEBOK': { ticker: 'META', company: 'Meta/Facebook' },
  'FACBOOK': { ticker: 'META', company: 'Meta/Facebook' },
  'STARBUKS': { ticker: 'SBUX', company: 'Starbucks' },
  'WALMAT': { ticker: 'WMT', company: 'Walmart' },
  'DISNY': { ticker: 'DIS', company: 'Disney' },
};

/**
 * Check if input is a typo and get suggestion
 */
function getTypoSuggestion(query: string): { ticker: string; company: string } | null {
  const upper = query.trim().toUpperCase();
  return TYPO_SUGGESTIONS[upper] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SYMBOL NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

function normalizeSymbol(query: string): string | null {
  if (!query || typeof query !== 'string') return null;
  
  const trimmed = query.trim().toUpperCase();
  const aliased = SYMBOL_ALIASES[trimmed];
  if (aliased) return aliased;
  
  const withoutDollar = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed;
  const aliasedAfter = SYMBOL_ALIASES[withoutDollar];
  if (aliasedAfter) return aliasedAfter;
  
  if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(withoutDollar)) return withoutDollar;
  
  return null;
}

function getSuggestedSymbols(): readonly string[] {
  return ['AAPL (Apple)', 'MSFT (Microsoft)', 'GOOGL (Google)', 'AMZN (Amazon)', 'TSLA (Tesla)'];
}

// ─────────────────────────────────────────────────────────────────────────────────
// FINNHUB PROVIDER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export interface FinnhubProviderConfig {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly apiKey?: string;
}

export class FinnhubProvider extends BaseProvider {
  readonly name = 'finnhub';
  readonly categories = ['market'] as const;
  readonly reliabilityTier = 'feed' as const;
  
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string | undefined;
  
  constructor(config?: FinnhubProviderConfig) {
    super();
    this.baseUrl = config?.baseUrl ?? FINNHUB_BASE_URL;
    this.timeoutMs = config?.timeoutMs ?? 10000;
    this.apiKey = config?.apiKey ?? process.env.FINNHUB_API_KEY;
  }
  
  override isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  protected async fetchInternal(params: ProviderFetchParams): Promise<ProviderResult> {
    const { query } = params;
    const startTime = Date.now();
    
    if (!this.apiKey) {
      return this.createFailResult(
        'API_KEY_MISSING',
        'Finnhub API key not configured. Set FINNHUB_API_KEY environment variable.',
        false
      );
    }
    
    // Check for typos BEFORE normalizing - return helpful suggestion
    const typoSuggestion = getTypoSuggestion(query);
    if (typoSuggestion) {
      return this.createFailResult(
        'SYMBOL_TYPO',
        `Symbol "${query.toUpperCase()}" not found. Did you mean "${typoSuggestion.ticker}" (${typoSuggestion.company})?`,
        false
      );
    }
    
    const symbol = normalizeSymbol(query);
    
    if (!symbol) {
      return this.createFailResult(
        'INVALID_SYMBOL',
        `Invalid stock symbol: "${query}". Examples: ${getSuggestedSymbols().slice(0, 3).join(', ')}`,
        false
      );
    }
    
    const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? this.timeoutMs);
      
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': 'NovaOS/1.0' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (!response.ok) {
        if (response.status === 429) {
          return this.createFailResult('RATE_LIMITED', 'Finnhub rate limit exceeded', true, 60);
        }
        if (response.status === 401 || response.status === 403) {
          return this.createFailResult('UNAUTHORIZED', 'Invalid Finnhub API key', false);
        }
        return this.createFailResult(
          `HTTP_${response.status}`,
          `Finnhub API error: ${response.status} ${response.statusText}`,
          response.status >= 500
        );
      }
      
      const data = await response.json() as { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number };
      
      // Finnhub returns zeros for invalid symbols
      if (data.c === 0 && data.h === 0 && data.l === 0 && data.o === 0) {
        return this.createFailResult('SYMBOL_NOT_FOUND', `Stock symbol not found: "${symbol}"`, false);
      }
      
      // Build StockData matching the actual interface
      const stockData: StockData = {
        type: 'stock',
        symbol,
        exchange: this.inferExchange(symbol),
        price: data.c,
        currency: 'USD',
        change: data.d,
        changePercent: data.dp,
        previousClose: data.pc,
        open: data.o,
        dayHigh: data.h,
        dayLow: data.l,
      };
      
      const latencyMs = Date.now() - startTime;
      return this.createOkResult(stockData, latencyMs);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.createFailResult('TIMEOUT', `Request timed out after ${this.timeoutMs}ms`, true);
      }
      return this.createFailResult(
        'FETCH_ERROR',
        `Failed to fetch stock quote: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }
  
  private inferExchange(symbol: string): string {
    if (['SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO'].includes(symbol)) return 'NYSE Arca';
    if (symbol.startsWith('BRK.')) return 'NYSE';
    
    const nasdaqStocks = new Set([
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA',
      'NFLX', 'ADBE', 'INTC', 'AMD', 'QCOM', 'CSCO', 'PYPL', 'COST',
    ]);
    
    if (nasdaqStocks.has(symbol)) return 'NASDAQ';
    return 'NYSE';
  }
  
  protected override getCacheKey(params: ProviderFetchParams): string {
    const symbol = normalizeSymbol(params.query) ?? params.query.toUpperCase();
    return `${this.name}:${symbol}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export { normalizeSymbol, getSuggestedSymbols, getTypoSuggestion, SYMBOL_ALIASES, TYPO_SUGGESTIONS };
