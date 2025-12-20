// ═══════════════════════════════════════════════════════════════════════════════
// FX PROVIDER — Frankfurter API (Free, No Key Required)
// PATCHED VERSION - Compatible with existing NovaOS types
// ═══════════════════════════════════════════════════════════════════════════════

import {
  BaseProvider,
  type ProviderFetchParams,
} from './base-provider.js';

import type {
  ProviderResult,
  FxData,
} from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const FRANKFURTER_BASE_URL = 'https://api.frankfurter.app';

const SUPPORTED_CURRENCIES: ReadonlySet<string> = new Set([
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
]);

const CURRENCY_NAMES: Readonly<Record<string, string>> = {
  'AUD': 'Australian Dollar', 'BGN': 'Bulgarian Lev', 'BRL': 'Brazilian Real',
  'CAD': 'Canadian Dollar', 'CHF': 'Swiss Franc', 'CNY': 'Chinese Yuan',
  'CZK': 'Czech Koruna', 'DKK': 'Danish Krone', 'EUR': 'Euro',
  'GBP': 'British Pound', 'HKD': 'Hong Kong Dollar', 'HUF': 'Hungarian Forint',
  'IDR': 'Indonesian Rupiah', 'ILS': 'Israeli Shekel', 'INR': 'Indian Rupee',
  'ISK': 'Icelandic Króna', 'JPY': 'Japanese Yen', 'KRW': 'South Korean Won',
  'MXN': 'Mexican Peso', 'MYR': 'Malaysian Ringgit', 'NOK': 'Norwegian Krone',
  'NZD': 'New Zealand Dollar', 'PHP': 'Philippine Peso', 'PLN': 'Polish Zloty',
  'RON': 'Romanian Leu', 'SEK': 'Swedish Krona', 'SGD': 'Singapore Dollar',
  'THB': 'Thai Baht', 'TRY': 'Turkish Lira', 'USD': 'US Dollar', 'ZAR': 'South African Rand',
};

// ─────────────────────────────────────────────────────────────────────────────────
// CURRENCY PAIR PARSING
// ─────────────────────────────────────────────────────────────────────────────────

function parseCurrencyPair(query: string): { base: string; quote: string } | null {
  if (!query || typeof query !== 'string') return null;
  
  const normalized = query.trim().toUpperCase();
  
  const slashMatch = normalized.match(/^([A-Z]{3})[\/\-]([A-Z]{3})$/);
  if (slashMatch) return { base: slashMatch[1]!, quote: slashMatch[2]! };
  
  if (/^[A-Z]{6}$/.test(normalized)) {
    return { base: normalized.slice(0, 3), quote: normalized.slice(3, 6) };
  }
  
  const toMatch = normalized.match(/^([A-Z]{3})\s*(?:TO|IN|->|=>)\s*([A-Z]{3})$/);
  if (toMatch) return { base: toMatch[1]!, quote: toMatch[2]! };
  
  const amountMatch = normalized.match(/^\d+(?:\.\d+)?\s*([A-Z]{3})\s*(?:TO|IN|\/|-|->|=>)\s*([A-Z]{3})$/);
  if (amountMatch) return { base: amountMatch[1]!, quote: amountMatch[2]! };
  
  return null;
}

function validateCurrencyPair(base: string, quote: string): { valid: boolean; error?: string } {
  if (!SUPPORTED_CURRENCIES.has(base)) return { valid: false, error: `Unsupported base currency: ${base}` };
  if (!SUPPORTED_CURRENCIES.has(quote)) return { valid: false, error: `Unsupported quote currency: ${quote}` };
  if (base === quote) return { valid: false, error: `Base and quote currencies cannot be the same: ${base}` };
  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────────
// FX PROVIDER CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface FxProviderConfig {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FX PROVIDER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class FxProvider extends BaseProvider {
  readonly name = 'frankfurter';
  readonly categories = ['fx'] as const;
  readonly reliabilityTier = 'official' as const;
  
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  
  constructor(config?: FxProviderConfig) {
    super();
    this.baseUrl = config?.baseUrl ?? FRANKFURTER_BASE_URL;
    this.timeoutMs = config?.timeoutMs ?? 10000;
  }
  
  override isAvailable(): boolean {
    return true;
  }
  
  protected async fetchInternal(params: ProviderFetchParams): Promise<ProviderResult> {
    const { query } = params;
    const startTime = Date.now();
    
    const pair = parseCurrencyPair(query);
    
    if (!pair) {
      return this.createFailResult(
        'INVALID_CURRENCY_PAIR',
        `Invalid currency pair format: "${query}". Use formats like USD/EUR, USD-EUR, or USDEUR.`,
        false
      );
    }
    
    const validation = validateCurrencyPair(pair.base, pair.quote);
    if (!validation.valid) {
      return this.createFailResult('INVALID_CURRENCY', validation.error!, false);
    }
    
    const url = `${this.baseUrl}/latest?from=${pair.base}&to=${pair.quote}`;
    
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
        const retryable = response.status >= 500 || response.status === 429;
        return this.createFailResult(
          `HTTP_${response.status}`,
          `Frankfurter API error: ${response.status} ${response.statusText}`,
          retryable
        );
      }
      
      const data = await response.json() as { amount: number; base: string; date: string; rates: Record<string, number> };
      const rate = data.rates[pair.quote];
      
      if (rate === undefined) {
        return this.createFailResult('RATE_NOT_FOUND', `Exchange rate not found for ${pair.base}/${pair.quote}`, true);
      }
      
      // Build FxData matching the actual interface
      const fxData: FxData = {
        type: 'fx',
        baseCurrency: pair.base,
        quoteCurrency: pair.quote,
        rate,
        // Optional fields - Frankfurter doesn't provide these
        change24h: undefined,
        changePercent24h: undefined,
      };
      
      const latencyMs = Date.now() - startTime;
      return this.createOkResult(fxData, latencyMs);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.createFailResult('TIMEOUT', `Request timed out after ${this.timeoutMs}ms`, true);
      }
      return this.createFailResult(
        'FETCH_ERROR',
        `Failed to fetch exchange rate: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }
  
  protected override getCacheKey(params: ProviderFetchParams): string {
    const pair = parseCurrencyPair(params.query);
    if (pair) return `${this.name}:${pair.base}/${pair.quote}`;
    return `${this.name}:${params.query.toLowerCase().trim()}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  parseCurrencyPair,
  validateCurrencyPair,
  SUPPORTED_CURRENCIES,
  CURRENCY_NAMES,
};
