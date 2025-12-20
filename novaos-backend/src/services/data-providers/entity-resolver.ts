// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY RESOLVER — Resolve Raw Entities to Canonical Identifiers
// Phase 4: Entity System
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  RawEntity,
  ResolvedEntity,
  ResolvedEntities,
  ResolvedEntityAlternative,
  EntityType,
  ResolutionStatus,
  EntityMetadata,
  EntityResolutionTrace,
} from '../../types/entities.js';

import type { LiveCategory } from '../../types/categories.js';

import { ENTITY_TO_CATEGORY } from '../../types/entities.js';

// ─────────────────────────────────────────────────────────────────────────────────
// COMPANY NAME → TICKER MAPPINGS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Common company names mapped to stock tickers.
 * Keys are uppercase for case-insensitive matching.
 */
export const COMPANY_TO_TICKER: Readonly<Record<string, string>> = {
  // Big Tech
  'APPLE': 'AAPL',
  'MICROSOFT': 'MSFT',
  'GOOGLE': 'GOOGL',
  'ALPHABET': 'GOOGL',
  'AMAZON': 'AMZN',
  'META': 'META',
  'FACEBOOK': 'META',
  'NETFLIX': 'NFLX',
  'NVIDIA': 'NVDA',
  'TESLA': 'TSLA',
  'AMD': 'AMD',
  'INTEL': 'INTC',
  'IBM': 'IBM',
  'ORACLE': 'ORCL',
  'SALESFORCE': 'CRM',
  'ADOBE': 'ADBE',
  'CISCO': 'CSCO',
  'QUALCOMM': 'QCOM',
  'BROADCOM': 'AVGO',
  
  // Finance
  'JPMORGAN': 'JPM',
  'JP MORGAN': 'JPM',
  'GOLDMAN SACHS': 'GS',
  'GOLDMAN': 'GS',
  'MORGAN STANLEY': 'MS',
  'BANK OF AMERICA': 'BAC',
  'WELLS FARGO': 'WFC',
  'CITIGROUP': 'C',
  'CITI': 'C',
  'VISA': 'V',
  'MASTERCARD': 'MA',
  'PAYPAL': 'PYPL',
  'SQUARE': 'SQ',
  'BLOCK': 'SQ',
  'BERKSHIRE': 'BRK.B',
  'BERKSHIRE HATHAWAY': 'BRK.B',
  
  // Consumer
  'WALMART': 'WMT',
  'TARGET': 'TGT',
  'COSTCO': 'COST',
  'HOME DEPOT': 'HD',
  'LOWES': 'LOW',
  'NIKE': 'NKE',
  'STARBUCKS': 'SBUX',
  'MCDONALDS': 'MCD',
  'COCA COLA': 'KO',
  'PEPSI': 'PEP',
  'PEPSICO': 'PEP',
  'DISNEY': 'DIS',
  'COMCAST': 'CMCSA',
  
  // Tech Platforms
  'UBER': 'UBER',
  'LYFT': 'LYFT',
  'AIRBNB': 'ABNB',
  'DOORDASH': 'DASH',
  'SPOTIFY': 'SPOT',
  'SNAP': 'SNAP',
  'SNAPCHAT': 'SNAP',
  'PINTEREST': 'PINS',
  'TWITTER': 'X',
  'X': 'X',
  'COINBASE': 'COIN',
  'ROBINHOOD': 'HOOD',
  'SHOPIFY': 'SHOP',
  'ZOOM': 'ZM',
  'SLACK': 'WORK',
  'DROPBOX': 'DBX',
  
  // Healthcare
  'JOHNSON AND JOHNSON': 'JNJ',
  'J&J': 'JNJ',
  'PFIZER': 'PFE',
  'MODERNA': 'MRNA',
  'UNITEDHEALTH': 'UNH',
  'CVS': 'CVS',
  'WALGREENS': 'WBA',
  
  // Energy
  'EXXON': 'XOM',
  'EXXONMOBIL': 'XOM',
  'CHEVRON': 'CVX',
  'CONOCOPHILLIPS': 'COP',
  
  // Indices (ETFs)
  'S&P': 'SPY',
  'S&P 500': 'SPY',
  'S&P500': 'SPY',
  'SP500': 'SPY',
  'DOW': 'DIA',
  'DOW JONES': 'DIA',
  'NASDAQ': 'QQQ',
  'RUSSELL': 'IWM',
  'RUSSELL 2000': 'IWM',
};

/**
 * Ticker display names.
 */
export const TICKER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'AAPL': 'Apple Inc.',
  'MSFT': 'Microsoft Corporation',
  'GOOGL': 'Alphabet Inc.',
  'AMZN': 'Amazon.com Inc.',
  'META': 'Meta Platforms Inc.',
  'NVDA': 'NVIDIA Corporation',
  'TSLA': 'Tesla Inc.',
  'NFLX': 'Netflix Inc.',
  'JPM': 'JPMorgan Chase & Co.',
  'V': 'Visa Inc.',
  'MA': 'Mastercard Inc.',
  'DIS': 'The Walt Disney Company',
  'SPY': 'S&P 500 ETF',
  'QQQ': 'NASDAQ-100 ETF',
  'DIA': 'Dow Jones ETF',
};

// ─────────────────────────────────────────────────────────────────────────────────
// CRYPTO NAME → ID MAPPINGS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Crypto names/symbols mapped to CoinGecko IDs.
 */
export const CRYPTO_TO_ID: Readonly<Record<string, string>> = {
  // By symbol
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'SOL': 'solana',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LTC': 'litecoin',
  'SHIB': 'shiba-inu',
  'AVAX': 'avalanche-2',
  'LINK': 'chainlink',
  'ATOM': 'cosmos',
  'UNI': 'uniswap',
  'XLM': 'stellar',
  'XMR': 'monero',
  'ETC': 'ethereum-classic',
  'BCH': 'bitcoin-cash',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'PEPE': 'pepe',
  'WIF': 'dogwifcoin',
  
  // By name
  'BITCOIN': 'bitcoin',
  'ETHEREUM': 'ethereum',
  'SOLANA': 'solana',
  'CARDANO': 'cardano',
  'DOGECOIN': 'dogecoin',
  'RIPPLE': 'ripple',
  'POLKADOT': 'polkadot',
  'POLYGON': 'matic-network',
  'LITECOIN': 'litecoin',
  'CHAINLINK': 'chainlink',
  'COSMOS': 'cosmos',
  'UNISWAP': 'uniswap',
  'STELLAR': 'stellar',
  'MONERO': 'monero',
  'AVALANCHE': 'avalanche-2',
  'TETHER': 'tether',
};

/**
 * Crypto display names.
 */
export const CRYPTO_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'bitcoin': 'Bitcoin',
  'ethereum': 'Ethereum',
  'solana': 'Solana',
  'cardano': 'Cardano',
  'dogecoin': 'Dogecoin',
  'ripple': 'XRP',
  'polkadot': 'Polkadot',
  'matic-network': 'Polygon',
  'litecoin': 'Litecoin',
  'tether': 'Tether',
  'usd-coin': 'USD Coin',
  'binancecoin': 'BNB',
};

// ─────────────────────────────────────────────────────────────────────────────────
// CURRENCY MAPPINGS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Currency names mapped to ISO codes.
 */
export const CURRENCY_NAME_TO_CODE: Readonly<Record<string, string>> = {
  'DOLLAR': 'USD',
  'DOLLARS': 'USD',
  'USD': 'USD',
  'US DOLLAR': 'USD',
  'EURO': 'EUR',
  'EUROS': 'EUR',
  'EUR': 'EUR',
  'POUND': 'GBP',
  'POUNDS': 'GBP',
  'STERLING': 'GBP',
  'GBP': 'GBP',
  'BRITISH POUND': 'GBP',
  'YEN': 'JPY',
  'JPY': 'JPY',
  'JAPANESE YEN': 'JPY',
  'YUAN': 'CNY',
  'RENMINBI': 'CNY',
  'RMB': 'CNY',
  'CNY': 'CNY',
  'FRANC': 'CHF',
  'SWISS FRANC': 'CHF',
  'CHF': 'CHF',
  'CANADIAN DOLLAR': 'CAD',
  'CAD': 'CAD',
  'LOONIE': 'CAD',
  'AUSTRALIAN DOLLAR': 'AUD',
  'AUD': 'AUD',
  'AUSSIE': 'AUD',
  'RUPEE': 'INR',
  'INDIAN RUPEE': 'INR',
  'INR': 'INR',
  'WON': 'KRW',
  'KOREAN WON': 'KRW',
  'KRW': 'KRW',
  'PESO': 'MXN',
  'MEXICAN PESO': 'MXN',
  'MXN': 'MXN',
  'REAL': 'BRL',
  'BRAZILIAN REAL': 'BRL',
  'BRL': 'BRL',
  'RAND': 'ZAR',
  'SOUTH AFRICAN RAND': 'ZAR',
  'ZAR': 'ZAR',
  'SINGAPORE DOLLAR': 'SGD',
  'SGD': 'SGD',
  'HONG KONG DOLLAR': 'HKD',
  'HKD': 'HKD',
  'KRONA': 'SEK',
  'SWEDISH KRONA': 'SEK',
  'SEK': 'SEK',
  'KRONE': 'NOK',
  'NORWEGIAN KRONE': 'NOK',
  'NOK': 'NOK',
  'DANISH KRONE': 'DKK',
  'DKK': 'DKK',
  'ZLOTY': 'PLN',
  'POLISH ZLOTY': 'PLN',
  'PLN': 'PLN',
  'LIRA': 'TRY',
  'TURKISH LIRA': 'TRY',
  'TRY': 'TRY',
  'BAHT': 'THB',
  'THAI BAHT': 'THB',
  'THB': 'THB',
  'SHEKEL': 'ILS',
  'ISRAELI SHEKEL': 'ILS',
  'ILS': 'ILS',
  'RINGGIT': 'MYR',
  'MALAYSIAN RINGGIT': 'MYR',
  'MYR': 'MYR',
  'RUPIAH': 'IDR',
  'INDONESIAN RUPIAH': 'IDR',
  'IDR': 'IDR',
  // Note: 'PESO' ambiguous - use 'MEXICAN PESO' or 'PHILIPPINE PESO' for specific currencies
  'PHILIPPINE PESO': 'PHP',
  'PHP': 'PHP',
  'FORINT': 'HUF',
  'HUNGARIAN FORINT': 'HUF',
  'HUF': 'HUF',
  'KORUNA': 'CZK',
  'CZECH KORUNA': 'CZK',
  'CZK': 'CZK',
  'LEU': 'RON',
  'ROMANIAN LEU': 'RON',
  'RON': 'RON',
  'LEV': 'BGN',
  'BULGARIAN LEV': 'BGN',
  'BGN': 'BGN',
  'ICELANDIC KRONA': 'ISK',
  'ISK': 'ISK',
  'NEW ZEALAND DOLLAR': 'NZD',
  'NZD': 'NZD',
  'KIWI': 'NZD',
};

/**
 * Currency display names.
 */
export const CURRENCY_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'USD': 'US Dollar',
  'EUR': 'Euro',
  'GBP': 'British Pound',
  'JPY': 'Japanese Yen',
  'CNY': 'Chinese Yuan',
  'CHF': 'Swiss Franc',
  'CAD': 'Canadian Dollar',
  'AUD': 'Australian Dollar',
  'INR': 'Indian Rupee',
  'KRW': 'South Korean Won',
  'MXN': 'Mexican Peso',
  'BRL': 'Brazilian Real',
  'SGD': 'Singapore Dollar',
  'HKD': 'Hong Kong Dollar',
};

// ─────────────────────────────────────────────────────────────────────────────────
// CITY ALIASES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * City aliases and abbreviations.
 */
export const CITY_ALIASES: Readonly<Record<string, { city: string; country?: string; timezone?: string }>> = {
  'NYC': { city: 'New York', country: 'US', timezone: 'America/New_York' },
  'NY': { city: 'New York', country: 'US', timezone: 'America/New_York' },
  'LA': { city: 'Los Angeles', country: 'US', timezone: 'America/Los_Angeles' },
  'SF': { city: 'San Francisco', country: 'US', timezone: 'America/Los_Angeles' },
  'CHI': { city: 'Chicago', country: 'US', timezone: 'America/Chicago' },
  'PHILLY': { city: 'Philadelphia', country: 'US', timezone: 'America/New_York' },
  'VEGAS': { city: 'Las Vegas', country: 'US', timezone: 'America/Los_Angeles' },
  'DC': { city: 'Washington', country: 'US', timezone: 'America/New_York' },
  'ATL': { city: 'Atlanta', country: 'US', timezone: 'America/New_York' },
  'MIAMI': { city: 'Miami', country: 'US', timezone: 'America/New_York' },
  'BOSTON': { city: 'Boston', country: 'US', timezone: 'America/New_York' },
  'SEATTLE': { city: 'Seattle', country: 'US', timezone: 'America/Los_Angeles' },
  'DENVER': { city: 'Denver', country: 'US', timezone: 'America/Denver' },
  'PHOENIX': { city: 'Phoenix', country: 'US', timezone: 'America/Phoenix' },
  'DALLAS': { city: 'Dallas', country: 'US', timezone: 'America/Chicago' },
  'HOUSTON': { city: 'Houston', country: 'US', timezone: 'America/Chicago' },
  
  // International
  'LONDON': { city: 'London', country: 'GB', timezone: 'Europe/London' },
  'PARIS': { city: 'Paris', country: 'FR', timezone: 'Europe/Paris' },
  'BERLIN': { city: 'Berlin', country: 'DE', timezone: 'Europe/Berlin' },
  'TOKYO': { city: 'Tokyo', country: 'JP', timezone: 'Asia/Tokyo' },
  'SYDNEY': { city: 'Sydney', country: 'AU', timezone: 'Australia/Sydney' },
  'MELBOURNE': { city: 'Melbourne', country: 'AU', timezone: 'Australia/Melbourne' },
  'SINGAPORE': { city: 'Singapore', country: 'SG', timezone: 'Asia/Singapore' },
  'HONG KONG': { city: 'Hong Kong', country: 'HK', timezone: 'Asia/Hong_Kong' },
  'HK': { city: 'Hong Kong', country: 'HK', timezone: 'Asia/Hong_Kong' },
  'SHANGHAI': { city: 'Shanghai', country: 'CN', timezone: 'Asia/Shanghai' },
  'BEIJING': { city: 'Beijing', country: 'CN', timezone: 'Asia/Shanghai' },
  'SEOUL': { city: 'Seoul', country: 'KR', timezone: 'Asia/Seoul' },
  'MUMBAI': { city: 'Mumbai', country: 'IN', timezone: 'Asia/Kolkata' },
  'DELHI': { city: 'Delhi', country: 'IN', timezone: 'Asia/Kolkata' },
  'DUBAI': { city: 'Dubai', country: 'AE', timezone: 'Asia/Dubai' },
  'TORONTO': { city: 'Toronto', country: 'CA', timezone: 'America/Toronto' },
  'VANCOUVER': { city: 'Vancouver', country: 'CA', timezone: 'America/Vancouver' },
  'MEXICO CITY': { city: 'Mexico City', country: 'MX', timezone: 'America/Mexico_City' },
  'CDMX': { city: 'Mexico City', country: 'MX', timezone: 'America/Mexico_City' },
  'SAO PAULO': { city: 'São Paulo', country: 'BR', timezone: 'America/Sao_Paulo' },
  'RIO': { city: 'Rio de Janeiro', country: 'BR', timezone: 'America/Sao_Paulo' },
  'AMSTERDAM': { city: 'Amsterdam', country: 'NL', timezone: 'Europe/Amsterdam' },
  'ZURICH': { city: 'Zurich', country: 'CH', timezone: 'Europe/Zurich' },
  'FRANKFURT': { city: 'Frankfurt', country: 'DE', timezone: 'Europe/Berlin' },
  'MADRID': { city: 'Madrid', country: 'ES', timezone: 'Europe/Madrid' },
  'ROME': { city: 'Rome', country: 'IT', timezone: 'Europe/Rome' },
  'MOSCOW': { city: 'Moscow', country: 'RU', timezone: 'Europe/Moscow' },
  'ISTANBUL': { city: 'Istanbul', country: 'TR', timezone: 'Europe/Istanbul' },
  'TEL AVIV': { city: 'Tel Aviv', country: 'IL', timezone: 'Asia/Jerusalem' },
  'CAPE TOWN': { city: 'Cape Town', country: 'ZA', timezone: 'Africa/Johannesburg' },
  'JOHANNESBURG': { city: 'Johannesburg', country: 'ZA', timezone: 'Africa/Johannesburg' },
  'CAIRO': { city: 'Cairo', country: 'EG', timezone: 'Africa/Cairo' },
  'NAIROBI': { city: 'Nairobi', country: 'KE', timezone: 'Africa/Nairobi' },
  'LAGOS': { city: 'Lagos', country: 'NG', timezone: 'Africa/Lagos' },
  'BANGKOK': { city: 'Bangkok', country: 'TH', timezone: 'Asia/Bangkok' },
  'JAKARTA': { city: 'Jakarta', country: 'ID', timezone: 'Asia/Jakarta' },
  'MANILA': { city: 'Manila', country: 'PH', timezone: 'Asia/Manila' },
  'KUALA LUMPUR': { city: 'Kuala Lumpur', country: 'MY', timezone: 'Asia/Kuala_Lumpur' },
  'KL': { city: 'Kuala Lumpur', country: 'MY', timezone: 'Asia/Kuala_Lumpur' },
  'AUCKLAND': { city: 'Auckland', country: 'NZ', timezone: 'Pacific/Auckland' },
  'WELLINGTON': { city: 'Wellington', country: 'NZ', timezone: 'Pacific/Auckland' },
};

// ─────────────────────────────────────────────────────────────────────────────────
// TIMEZONE MAPPINGS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Timezone abbreviations to IANA identifiers.
 */
export const TIMEZONE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  'EST': 'America/New_York',
  'EDT': 'America/New_York',
  'CST': 'America/Chicago',
  'CDT': 'America/Chicago',
  'MST': 'America/Denver',
  'MDT': 'America/Denver',
  'PST': 'America/Los_Angeles',
  'PDT': 'America/Los_Angeles',
  'AKST': 'America/Anchorage',
  'AKDT': 'America/Anchorage',
  'HST': 'Pacific/Honolulu',
  'GMT': 'Etc/GMT',
  'UTC': 'Etc/UTC',
  'BST': 'Europe/London',
  'CET': 'Europe/Paris',
  'CEST': 'Europe/Paris',
  'EET': 'Europe/Helsinki',
  'EEST': 'Europe/Helsinki',
  'IST': 'Asia/Kolkata',
  'JST': 'Asia/Tokyo',
  'KST': 'Asia/Seoul',
  'HKT': 'Asia/Hong_Kong',
  'SGT': 'Asia/Singapore',
  'AEST': 'Australia/Sydney',
  'AEDT': 'Australia/Sydney',
  'AWST': 'Australia/Perth',
  'NZST': 'Pacific/Auckland',
  'NZDT': 'Pacific/Auckland',
  
  // Named aliases
  'EASTERN': 'America/New_York',
  'CENTRAL': 'America/Chicago',
  'MOUNTAIN': 'America/Denver',
  'PACIFIC': 'America/Los_Angeles',
};

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLVER VERSION
// ─────────────────────────────────────────────────────────────────────────────────

const RESOLVER_VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLUTION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a ticker entity.
 */
function resolveTicker(raw: RawEntity): ResolvedEntity {
  const text = raw.rawText.trim().toUpperCase();
  
  // Remove $ prefix if present
  const withoutDollar = text.startsWith('$') ? text.slice(1) : text;
  
  // Check company name mapping
  const tickerFromName = COMPANY_TO_TICKER[withoutDollar];
  if (tickerFromName) {
    return {
      raw,
      status: 'resolved',
      canonicalId: tickerFromName,
      displayName: TICKER_DISPLAY_NAMES[tickerFromName] ?? tickerFromName,
      category: 'market',
      resolutionConfidence: 0.95,
      metadata: { exchange: inferExchange(tickerFromName) },
    };
  }
  
  // Check if it's already a valid ticker format (1-5 uppercase letters)
  if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(withoutDollar)) {
    return {
      raw,
      status: 'resolved',
      canonicalId: withoutDollar,
      displayName: TICKER_DISPLAY_NAMES[withoutDollar] ?? withoutDollar,
      category: 'market',
      resolutionConfidence: 0.8,
      metadata: { exchange: inferExchange(withoutDollar) },
    };
  }
  
  // Try to find partial match in company names
  const partialMatch = findPartialCompanyMatch(withoutDollar);
  if (partialMatch) {
    return {
      raw,
      status: 'resolved',
      canonicalId: partialMatch.ticker,
      displayName: TICKER_DISPLAY_NAMES[partialMatch.ticker] ?? partialMatch.ticker,
      category: 'market',
      resolutionConfidence: partialMatch.confidence,
      metadata: { exchange: inferExchange(partialMatch.ticker) },
    };
  }
  
  return {
    raw,
    status: 'not_found',
    canonicalId: null,
    displayName: null,
    category: 'market',
    resolutionConfidence: 0,
  };
}

/**
 * Infer exchange from ticker.
 */
function inferExchange(ticker: string): string {
  const nasdaqStocks = new Set([
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA',
    'NFLX', 'ADBE', 'INTC', 'AMD', 'QCOM', 'CSCO', 'PYPL', 'COST',
  ]);
  
  if (['SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO'].includes(ticker)) return 'NYSE Arca';
  if (ticker.startsWith('BRK.')) return 'NYSE';
  if (nasdaqStocks.has(ticker)) return 'NASDAQ';
  return 'NYSE';
}

/**
 * Find partial company match.
 */
function findPartialCompanyMatch(text: string): { ticker: string; confidence: number } | null {
  const normalized = text.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
  
  for (const [name, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (normalized.includes(name) || name.includes(normalized)) {
      const confidence = normalized === name ? 0.9 : 0.7;
      return { ticker, confidence };
    }
  }
  
  return null;
}

/**
 * Resolve a crypto entity.
 */
function resolveCrypto(raw: RawEntity): ResolvedEntity {
  const text = raw.rawText.trim().toUpperCase();
  
  const cryptoId = CRYPTO_TO_ID[text];
  if (cryptoId) {
    return {
      raw,
      status: 'resolved',
      canonicalId: cryptoId,
      displayName: CRYPTO_DISPLAY_NAMES[cryptoId] ?? cryptoId,
      category: 'crypto',
      resolutionConfidence: 0.95,
    };
  }
  
  // Try lowercase as CoinGecko ID
  const lowered = raw.rawText.trim().toLowerCase();
  if (CRYPTO_DISPLAY_NAMES[lowered]) {
    return {
      raw,
      status: 'resolved',
      canonicalId: lowered,
      displayName: CRYPTO_DISPLAY_NAMES[lowered],
      category: 'crypto',
      resolutionConfidence: 0.9,
    };
  }
  
  return {
    raw,
    status: 'not_found',
    canonicalId: null,
    displayName: null,
    category: 'crypto',
    resolutionConfidence: 0,
  };
}

/**
 * Resolve a currency entity.
 */
function resolveCurrency(raw: RawEntity): ResolvedEntity {
  const text = raw.rawText.trim().toUpperCase();
  
  const code = CURRENCY_NAME_TO_CODE[text];
  if (code) {
    return {
      raw,
      status: 'resolved',
      canonicalId: code,
      displayName: CURRENCY_DISPLAY_NAMES[code] ?? code,
      category: 'fx',
      resolutionConfidence: 0.95,
      metadata: { currencyCode: code },
    };
  }
  
  // Check if it's already a valid ISO currency code
  if (/^[A-Z]{3}$/.test(text) && CURRENCY_DISPLAY_NAMES[text]) {
    return {
      raw,
      status: 'resolved',
      canonicalId: text,
      displayName: CURRENCY_DISPLAY_NAMES[text] ?? text,
      category: 'fx',
      resolutionConfidence: 0.9,
      metadata: { currencyCode: text },
    };
  }
  
  return {
    raw,
    status: 'not_found',
    canonicalId: null,
    displayName: null,
    category: 'fx',
    resolutionConfidence: 0,
  };
}

/**
 * Resolve a currency pair entity.
 */
function resolveCurrencyPair(raw: RawEntity): ResolvedEntity {
  const text = raw.rawText.trim().toUpperCase();
  
  // Parse formats: USD/EUR, USD-EUR, USDEUR, USD to EUR
  let base: string | null = null;
  let quote: string | null = null;
  
  // Slash or dash format
  const slashMatch = text.match(/^([A-Z]{3})[\/\-]([A-Z]{3})$/);
  if (slashMatch) {
    base = slashMatch[1]!;
    quote = slashMatch[2]!;
  }
  
  // Concatenated format
  if (!base && /^[A-Z]{6}$/.test(text)) {
    base = text.slice(0, 3);
    quote = text.slice(3, 6);
  }
  
  // "X to Y" format
  if (!base) {
    const toMatch = text.match(/^([A-Z]{3})\s*(?:TO|IN|->|=>)\s*([A-Z]{3})$/);
    if (toMatch) {
      base = toMatch[1]!;
      quote = toMatch[2]!;
    }
  }
  
  // Resolve currency names
  if (!base) {
    const words = text.split(/\s+(?:TO|IN|VS|VERSUS|->|=>)\s+/i);
    if (words.length === 2) {
      base = CURRENCY_NAME_TO_CODE[words[0]!.trim()] ?? null;
      quote = CURRENCY_NAME_TO_CODE[words[1]!.trim()] ?? null;
    }
  }
  
  if (base && quote) {
    const canonicalId = `${base}/${quote}`;
    return {
      raw,
      status: 'resolved',
      canonicalId,
      displayName: `${CURRENCY_DISPLAY_NAMES[base] ?? base} to ${CURRENCY_DISPLAY_NAMES[quote] ?? quote}`,
      category: 'fx',
      resolutionConfidence: 0.95,
    };
  }
  
  return {
    raw,
    status: 'not_found',
    canonicalId: null,
    displayName: null,
    category: 'fx',
    resolutionConfidence: 0,
  };
}

/**
 * Resolve a city entity.
 */
function resolveCity(raw: RawEntity): ResolvedEntity {
  const text = raw.rawText.trim().toUpperCase();
  
  const alias = CITY_ALIASES[text];
  if (alias) {
    const canonicalId = alias.country 
      ? `${alias.city},${alias.country}` 
      : alias.city;
    
    return {
      raw,
      status: 'resolved',
      canonicalId,
      displayName: alias.city,
      category: 'weather',
      resolutionConfidence: 0.95,
      metadata: {
        country: alias.country,
        timezoneId: alias.timezone,
      },
    };
  }
  
  // Return the city name as-is (will be validated later)
  return {
    raw,
    status: 'resolved',
    canonicalId: raw.rawText.trim(),
    displayName: raw.rawText.trim(),
    category: 'weather',
    resolutionConfidence: 0.7,
  };
}

/**
 * Resolve a timezone entity.
 */
function resolveTimezone(raw: RawEntity): ResolvedEntity {
  const text = raw.rawText.trim().toUpperCase();
  
  // Check abbreviation
  const ianaFromAbbr = TIMEZONE_ABBREVIATIONS[text];
  if (ianaFromAbbr) {
    return {
      raw,
      status: 'resolved',
      canonicalId: ianaFromAbbr,
      displayName: text,
      category: 'time',
      resolutionConfidence: 0.95,
      metadata: { timezoneId: ianaFromAbbr },
    };
  }
  
  // Check if it's already an IANA format
  if (raw.rawText.includes('/')) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: raw.rawText });
      return {
        raw,
        status: 'resolved',
        canonicalId: raw.rawText,
        displayName: raw.rawText,
        category: 'time',
        resolutionConfidence: 0.95,
        metadata: { timezoneId: raw.rawText },
      };
    } catch {
      // Invalid timezone
    }
  }
  
  // Check city aliases for timezone
  const cityAlias = CITY_ALIASES[text];
  if (cityAlias?.timezone) {
    return {
      raw,
      status: 'resolved',
      canonicalId: cityAlias.timezone,
      displayName: `${cityAlias.city} Time`,
      category: 'time',
      resolutionConfidence: 0.9,
      metadata: { timezoneId: cityAlias.timezone },
    };
  }
  
  return {
    raw,
    status: 'not_found',
    canonicalId: null,
    displayName: null,
    category: 'time',
    resolutionConfidence: 0,
  };
}

/**
 * Resolve an index entity.
 */
function resolveIndex(raw: RawEntity): ResolvedEntity {
  const text = raw.rawText.trim().toUpperCase();
  
  // Map common index names to ETFs
  const indexMap: Record<string, { ticker: string; name: string }> = {
    'S&P': { ticker: 'SPY', name: 'S&P 500' },
    'S&P 500': { ticker: 'SPY', name: 'S&P 500' },
    'S&P500': { ticker: 'SPY', name: 'S&P 500' },
    'SP500': { ticker: 'SPY', name: 'S&P 500' },
    'SPX': { ticker: 'SPY', name: 'S&P 500' },
    'DOW': { ticker: 'DIA', name: 'Dow Jones Industrial Average' },
    'DOW JONES': { ticker: 'DIA', name: 'Dow Jones Industrial Average' },
    'DJI': { ticker: 'DIA', name: 'Dow Jones Industrial Average' },
    'NASDAQ': { ticker: 'QQQ', name: 'NASDAQ-100' },
    'NASDAQ 100': { ticker: 'QQQ', name: 'NASDAQ-100' },
    'NDX': { ticker: 'QQQ', name: 'NASDAQ-100' },
    'RUSSELL': { ticker: 'IWM', name: 'Russell 2000' },
    'RUSSELL 2000': { ticker: 'IWM', name: 'Russell 2000' },
  };
  
  const mapped = indexMap[text];
  if (mapped) {
    return {
      raw,
      status: 'resolved',
      canonicalId: mapped.ticker,
      displayName: mapped.name,
      category: 'market',
      resolutionConfidence: 0.95,
      metadata: { exchange: 'NYSE Arca' },
    };
  }
  
  return {
    raw,
    status: 'not_found',
    canonicalId: null,
    displayName: null,
    category: 'market',
    resolutionConfidence: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN RESOLVER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a single raw entity.
 */
export function resolveEntity(raw: RawEntity): ResolvedEntity {
  switch (raw.type) {
    case 'ticker':
      return resolveTicker(raw);
    case 'crypto':
      return resolveCrypto(raw);
    case 'currency':
      return resolveCurrency(raw);
    case 'currency_pair':
      return resolveCurrencyPair(raw);
    case 'city':
    case 'location':
      return resolveCity(raw);
    case 'timezone':
      return resolveTimezone(raw);
    case 'index':
      return resolveIndex(raw);
    case 'commodity':
      // Commodities not implemented yet
      return {
        raw,
        status: 'unsupported',
        canonicalId: null,
        displayName: null,
        category: null,
        resolutionConfidence: 0,
      };
    default:
      return {
        raw,
        status: 'invalid',
        canonicalId: null,
        displayName: null,
        category: null,
        resolutionConfidence: 0,
      };
  }
}

/**
 * Resolve multiple raw entities.
 */
export function resolveEntities(rawEntities: readonly RawEntity[], originalQuery: string = ''): ResolvedEntities {
  const startTime = Date.now();
  
  const entities: ResolvedEntity[] = [];
  const resolved: ResolvedEntity[] = [];
  const failed: ResolvedEntity[] = [];
  const ambiguous: ResolvedEntity[] = [];
  
  for (const raw of rawEntities) {
    const entity = resolveEntity(raw);
    entities.push(entity);
    
    switch (entity.status) {
      case 'resolved':
        resolved.push(entity);
        break;
      case 'ambiguous':
        ambiguous.push(entity);
        break;
      default:
        failed.push(entity);
        break;
    }
  }
  
  const resolutionTimeMs = Date.now() - startTime;
  
  const trace: EntityResolutionTrace = {
    originalQuery,
    extractionTimeMs: 0, // Set by extractor
    resolutionTimeMs,
    extractedCount: rawEntities.length,
    resolvedCount: resolved.length,
    method: 'regex',
    resolverVersion: RESOLVER_VERSION,
  };
  
  return {
    entities,
    resolved,
    failed,
    ambiguous,
    trace,
  };
}

/**
 * Get category for a resolved entity.
 */
export function getCategoryForEntity(entity: ResolvedEntity): LiveCategory | null {
  if (entity.category) {
    return entity.category;
  }
  
  return ENTITY_TO_CATEGORY.get(entity.raw.type) ?? null;
}
