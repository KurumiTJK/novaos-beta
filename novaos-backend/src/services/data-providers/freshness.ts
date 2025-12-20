// ═══════════════════════════════════════════════════════════════════════════════
// FRESHNESS — Data Freshness Validation per Category
// PATCHED VERSION - Uses fetchedAt from actual ProviderOkResult
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  LiveCategory,
  ProviderOkResult,
} from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type FreshnessStatus = 'fresh' | 'acceptable' | 'stale' | 'expired';

export interface FreshnessPolicy {
  readonly category: LiveCategory;
  readonly freshMaxAgeSec: number;
  readonly acceptableMaxAgeSec: number;
  readonly expiredAfterSec: number;
  readonly description: string;
}

export interface FreshnessCheckResult {
  readonly status: FreshnessStatus;
  readonly ageSec: number;
  readonly policy: FreshnessPolicy;
  readonly freshMaxAgeSec: number;
  readonly expiredAfterSec: number;
  readonly usable: boolean;
  readonly message: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FRESHNESS POLICIES BY CATEGORY
// ─────────────────────────────────────────────────────────────────────────────────

export const FRESHNESS_POLICIES: Readonly<Record<LiveCategory, FreshnessPolicy>> = {
  time: {
    category: 'time',
    freshMaxAgeSec: 2,
    acceptableMaxAgeSec: 5,
    expiredAfterSec: 30,
    description: 'Time data must be near real-time',
  },
  market: {
    category: 'market',
    freshMaxAgeSec: 30,
    acceptableMaxAgeSec: 60,
    expiredAfterSec: 300,
    description: 'Stock prices should be within 30-60 seconds during market hours',
  },
  crypto: {
    category: 'crypto',
    freshMaxAgeSec: 30,
    acceptableMaxAgeSec: 60,
    expiredAfterSec: 300,
    description: 'Crypto prices should be within 30-60 seconds (24/7 market)',
  },
  weather: {
    category: 'weather',
    freshMaxAgeSec: 300,
    acceptableMaxAgeSec: 900,
    expiredAfterSec: 3600,
    description: 'Weather data typically updates every 10-15 minutes',
  },
  fx: {
    category: 'fx',
    freshMaxAgeSec: 3600,
    acceptableMaxAgeSec: 7200,
    expiredAfterSec: 86400,
    description: 'FX rates from ECB update daily, hourly freshness acceptable',
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// FRESHNESS CHECK FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function checkFreshness(
  result: ProviderOkResult,
  category: LiveCategory,
  referenceTimeMs: number = Date.now()
): FreshnessCheckResult {
  const policy = FRESHNESS_POLICIES[category];
  // Use fetchedAt from the actual ProviderOkResult interface
  const ageSec = Math.floor((referenceTimeMs - result.fetchedAt) / 1000);
  
  let status: FreshnessStatus;
  let message: string;
  
  if (ageSec < 0) {
    status = 'fresh';
    message = 'Data timestamp is in the future (clock skew?)';
  } else if (ageSec <= policy.freshMaxAgeSec) {
    status = 'fresh';
    message = `Data is fresh (${ageSec}s old, limit ${policy.freshMaxAgeSec}s)`;
  } else if (ageSec <= policy.acceptableMaxAgeSec) {
    status = 'acceptable';
    message = `Data is acceptable (${ageSec}s old, limit ${policy.acceptableMaxAgeSec}s)`;
  } else if (ageSec <= policy.expiredAfterSec) {
    status = 'stale';
    message = `Data is stale (${ageSec}s old, expires at ${policy.expiredAfterSec}s)`;
  } else {
    status = 'expired';
    message = `Data is expired (${ageSec}s old, limit was ${policy.expiredAfterSec}s)`;
  }
  
  return {
    status,
    ageSec: Math.max(0, ageSec),
    policy,
    freshMaxAgeSec: policy.freshMaxAgeSec,
    expiredAfterSec: policy.expiredAfterSec,
    usable: status !== 'expired',
    message,
  };
}

export function isFreshEnough(result: ProviderOkResult, category: LiveCategory): boolean {
  return checkFreshness(result, category).usable;
}

export function isStrictlyFresh(result: ProviderOkResult, category: LiveCategory): boolean {
  return checkFreshness(result, category).status === 'fresh';
}

export function getDataAgeSec(result: ProviderOkResult, referenceTimeMs: number = Date.now()): number {
  return Math.max(0, Math.floor((referenceTimeMs - result.fetchedAt) / 1000));
}

export function getTimeUntilExpirySec(result: ProviderOkResult, category: LiveCategory): number {
  const policy = FRESHNESS_POLICIES[category];
  const ageSec = getDataAgeSec(result);
  return policy.expiredAfterSec - ageSec;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FRESHNESS POLICY HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

export function getFreshnessPolicy(category: LiveCategory): FreshnessPolicy {
  return FRESHNESS_POLICIES[category];
}

export function getAllFreshnessPolicies(): readonly FreshnessPolicy[] {
  return Object.values(FRESHNESS_POLICIES);
}

export function createFreshnessPolicy(
  category: LiveCategory,
  freshMaxAgeSec: number,
  acceptableMaxAgeSec: number,
  expiredAfterSec: number,
  description: string
): FreshnessPolicy {
  if (freshMaxAgeSec > acceptableMaxAgeSec) {
    throw new Error('freshMaxAgeSec must be <= acceptableMaxAgeSec');
  }
  if (acceptableMaxAgeSec > expiredAfterSec) {
    throw new Error('acceptableMaxAgeSec must be <= expiredAfterSec');
  }
  
  return { category, freshMaxAgeSec, acceptableMaxAgeSec, expiredAfterSec, description };
}

export function checkFreshnessWithPolicy(
  result: ProviderOkResult,
  policy: FreshnessPolicy,
  referenceTimeMs: number = Date.now()
): FreshnessCheckResult {
  const ageSec = Math.floor((referenceTimeMs - result.fetchedAt) / 1000);
  
  let status: FreshnessStatus;
  let message: string;
  
  if (ageSec < 0) {
    status = 'fresh';
    message = 'Data timestamp is in the future (clock skew?)';
  } else if (ageSec <= policy.freshMaxAgeSec) {
    status = 'fresh';
    message = `Data is fresh (${ageSec}s old)`;
  } else if (ageSec <= policy.acceptableMaxAgeSec) {
    status = 'acceptable';
    message = `Data is acceptable (${ageSec}s old)`;
  } else if (ageSec <= policy.expiredAfterSec) {
    status = 'stale';
    message = `Data is stale (${ageSec}s old)`;
  } else {
    status = 'expired';
    message = `Data is expired (${ageSec}s old)`;
  }
  
  return {
    status,
    ageSec: Math.max(0, ageSec),
    policy,
    freshMaxAgeSec: policy.freshMaxAgeSec,
    expiredAfterSec: policy.expiredAfterSec,
    usable: status !== 'expired',
    message,
  };
}

export function getMarketAwarePolicy(category: LiveCategory, isMarketOpen: boolean): FreshnessPolicy {
  const basePolicy = FRESHNESS_POLICIES[category];
  
  if (category !== 'market') return basePolicy;
  
  if (isMarketOpen) return basePolicy;
  
  return {
    ...basePolicy,
    freshMaxAgeSec: 300,
    acceptableMaxAgeSec: 900,
    expiredAfterSec: 3600,
    description: 'Market is closed - relaxed freshness requirements',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// FRESHNESS STATUS UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

export function getFreshnessScore(status: FreshnessStatus): number {
  switch (status) {
    case 'fresh': return 3;
    case 'acceptable': return 2;
    case 'stale': return 1;
    case 'expired': return 0;
  }
}

export function compareFreshness(a: FreshnessCheckResult, b: FreshnessCheckResult): number {
  const scoreA = getFreshnessScore(a.status);
  const scoreB = getFreshnessScore(b.status);
  
  if (scoreA !== scoreB) return scoreB - scoreA;
  return a.ageSec - b.ageSec;
}

export function formatFreshness(result: FreshnessCheckResult): string {
  const ageStr = result.ageSec < 60
    ? `${result.ageSec}s`
    : result.ageSec < 3600
      ? `${Math.floor(result.ageSec / 60)}m`
      : `${Math.floor(result.ageSec / 3600)}h`;
  
  const statusEmoji = {
    fresh: '🟢',
    acceptable: '🟡',
    stale: '🟠',
    expired: '🔴',
  }[result.status];
  
  return `${statusEmoji} ${result.status} (${ageStr} old)`;
}
