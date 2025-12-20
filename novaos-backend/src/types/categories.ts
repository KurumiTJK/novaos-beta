// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES — Live Data and Authoritative Categories (CORRECTED)
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LIVE CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────────

export type LiveCategory =
  | 'market'
  | 'crypto'
  | 'fx'
  | 'weather'
  | 'time';

export const LIVE_CATEGORIES: ReadonlySet<LiveCategory> = new Set([
  'market',
  'crypto',
  'fx',
  'weather',
  'time',
]);

export function isLiveCategory(value: string): value is LiveCategory {
  return LIVE_CATEGORIES.has(value as LiveCategory);
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE CATEGORIES (includes all values used in code)
// ─────────────────────────────────────────────────────────────────────────────────

export type AuthoritativeCategory =
  | 'financial'
  | 'scientific'
  | 'news'
  | 'sports'
  | 'legal'
  | 'medical'
  | 'government'
  | 'academic'
  | 'leadership'
  | 'regulatory'
  | 'software'
  | 'service_status';

export const AUTHORITATIVE_CATEGORIES: ReadonlySet<AuthoritativeCategory> = new Set([
  'financial',
  'scientific',
  'news',
  'sports',
  'legal',
  'medical',
  'government',
  'academic',
  'leadership',
  'regulatory',
  'software',
  'service_status',
]);

export function isAuthoritativeCategory(value: string): value is AuthoritativeCategory {
  return AUTHORITATIVE_CATEGORIES.has(value as AuthoritativeCategory);
}

// ─────────────────────────────────────────────────────────────────────────────────
// DATA CATEGORY (union of live and authoritative, plus general)
// ─────────────────────────────────────────────────────────────────────────────────

export type DataCategory = LiveCategory | AuthoritativeCategory | 'general';

export const DATA_CATEGORIES: ReadonlySet<DataCategory> = new Set([
  ...LIVE_CATEGORIES,
  ...AUTHORITATIVE_CATEGORIES,
  'general',
]);

export function isDataCategory(value: string): value is DataCategory {
  return DATA_CATEGORIES.has(value as DataCategory);
}

// ─────────────────────────────────────────────────────────────────────────────────
// CATEGORY METADATA
// ─────────────────────────────────────────────────────────────────────────────────

export interface LiveCategoryMetadata {
  readonly name: string;
  readonly description: string;
  readonly defaultFreshnessMs: number;
  readonly hasQualitativeFallback: boolean;
  readonly keywords: readonly string[];
}

export const LIVE_CATEGORY_METADATA: Record<LiveCategory, LiveCategoryMetadata> = {
  market: {
    name: 'Stock Market',
    description: 'Stock prices, indices, and market data',
    defaultFreshnessMs: 60000,
    hasQualitativeFallback: true,
    keywords: ['stock', 'share', 'price', 'trading', 'market', 'nasdaq', 'nyse', 'dow', 's&p'],
  },
  crypto: {
    name: 'Cryptocurrency',
    description: 'Cryptocurrency prices and market caps',
    defaultFreshnessMs: 60000,
    hasQualitativeFallback: true,
    keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'coin', 'token'],
  },
  fx: {
    name: 'Foreign Exchange',
    description: 'Currency exchange rates',
    defaultFreshnessMs: 300000,
    hasQualitativeFallback: true,
    keywords: ['exchange', 'rate', 'currency', 'forex', 'usd', 'eur', 'gbp', 'jpy'],
  },
  weather: {
    name: 'Weather',
    description: 'Current weather conditions',
    defaultFreshnessMs: 900000,
    hasQualitativeFallback: true,
    keywords: ['weather', 'temperature', 'forecast', 'rain', 'sunny', 'cloudy'],
  },
  time: {
    name: 'Time',
    description: 'Current time in various timezones',
    defaultFreshnessMs: 1000,
    hasQualitativeFallback: false,
    keywords: ['time', 'clock', 'hour', 'timezone'],
  },
};

export interface AuthoritativeCategoryMetadata {
  readonly name: string;
  readonly description: string;
  readonly officialSources: readonly string[];
  readonly requiresVerification: boolean;
}

export const AUTHORITATIVE_CATEGORY_METADATA: Record<AuthoritativeCategory, AuthoritativeCategoryMetadata> = {
  financial: {
    name: 'Financial',
    description: 'Financial data, SEC filings, earnings',
    officialSources: ['sec.gov', 'investor.gov', 'finra.org'],
    requiresVerification: true,
  },
  scientific: {
    name: 'Scientific',
    description: 'Scientific research and studies',
    officialSources: ['pubmed.gov', 'nature.com', 'science.org', 'arxiv.org'],
    requiresVerification: true,
  },
  news: {
    name: 'News',
    description: 'Current events and breaking news',
    officialSources: ['reuters.com', 'apnews.com', 'bbc.com'],
    requiresVerification: true,
  },
  sports: {
    name: 'Sports',
    description: 'Sports scores, standings, and statistics',
    officialSources: ['espn.com', 'nba.com', 'nfl.com', 'mlb.com'],
    requiresVerification: true,
  },
  legal: {
    name: 'Legal',
    description: 'Legal information, court decisions, statutes',
    officialSources: ['supremecourt.gov', 'uscourts.gov', 'justice.gov', 'law.cornell.edu'],
    requiresVerification: true,
  },
  medical: {
    name: 'Medical',
    description: 'Medical and health information',
    officialSources: ['nih.gov', 'cdc.gov', 'fda.gov', 'who.int', 'pubmed.gov'],
    requiresVerification: true,
  },
  government: {
    name: 'Government',
    description: 'Government data, policies, and statistics',
    officialSources: ['usa.gov', 'whitehouse.gov', 'congress.gov', 'data.gov'],
    requiresVerification: true,
  },
  academic: {
    name: 'Academic',
    description: 'Academic papers and scholarly citations',
    officialSources: ['scholar.google.com', 'jstor.org', 'arxiv.org', 'doi.org'],
    requiresVerification: true,
  },
  leadership: {
    name: 'Leadership',
    description: 'Company leadership and executive information',
    officialSources: ['linkedin.com', 'crunchbase.com', 'bloomberg.com'],
    requiresVerification: true,
  },
  regulatory: {
    name: 'Regulatory',
    description: 'Regulatory filings and compliance',
    officialSources: ['sec.gov', 'ftc.gov', 'fcc.gov'],
    requiresVerification: true,
  },
  software: {
    name: 'Software',
    description: 'Software versions and releases',
    officialSources: ['github.com', 'npmjs.com', 'pypi.org'],
    requiresVerification: true,
  },
  service_status: {
    name: 'Service Status',
    description: 'Service availability and status',
    officialSources: ['status.aws.amazon.com', 'status.cloud.google.com'],
    requiresVerification: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function getLiveCategoryMetadata(category: LiveCategory): LiveCategoryMetadata {
  return LIVE_CATEGORY_METADATA[category];
}

export function getAuthoritativeCategoryMetadata(category: AuthoritativeCategory): AuthoritativeCategoryMetadata {
  return AUTHORITATIVE_CATEGORY_METADATA[category];
}

export function hasQualitativeFallback(category: LiveCategory): boolean {
  return LIVE_CATEGORY_METADATA[category].hasQualitativeFallback;
}

export function getDefaultFreshnessMs(category: LiveCategory): number {
  return LIVE_CATEGORY_METADATA[category].defaultFreshnessMs;
}

export function sortCategoriesByPriority(categories: readonly DataCategory[]): DataCategory[] {
  const priority: Record<DataCategory, number> = {
    time: 0,
    market: 1,
    crypto: 2,
    fx: 3,
    weather: 4,
    financial: 5,
    medical: 6,
    legal: 7,
    government: 8,
    news: 9,
    scientific: 10,
    academic: 11,
    sports: 12,
    leadership: 13,
    regulatory: 14,
    software: 15,
    service_status: 16,
    general: 99,
  };
  return [...categories].sort((a, b) => (priority[a] ?? 99) - (priority[b] ?? 99));
}

export function getHighestPriorityCategory(categories: readonly DataCategory[]): DataCategory | null {
  const sorted = sortCategoriesByPriority(categories);
  return sorted[0] ?? null;
}
