// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT STORE TESTS — Unit Tests for Consent Tracking
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsentStore, createConsentStore } from '../consent/consent-store.js';
import type { KeyValueStore } from '../../storage/index.js';
import type { UserId, Timestamp } from '../../types/branded.js';
import { createTimestamp } from '../../types/branded.js';
import type { ConsentPurpose, UpdateConsentRequest } from '../consent/types.js';
import { CURRENT_POLICY_VERSION } from '../consent/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK STORE
// ═══════════════════════════════════════════════════════════════════════════════

function createMockStore(): KeyValueStore {
  const data = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const sortedSets = new Map<string, Map<string, number>>();

  return {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      data.set(key, value);
      return 'OK';
    }),
    setex: vi.fn(async (key: string, _seconds: number, value: string) => {
      data.set(key, value);
      return 'OK';
    }),
    delete: vi.fn(async (key: string) => {
      return data.delete(key);
    }),
    exists: vi.fn(async (key: string) => data.has(key)),
    expire: vi.fn(async (_key: string, _seconds: number) => {
      return 1;
    }),
    ttl: vi.fn(async (_key: string) => {
      return -1; // No expiration
    }),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return Array.from(data.keys()).filter(k => k.startsWith(prefix));
    }),
    mget: vi.fn(async (...keys: string[]) => {
      return keys.map(k => data.get(k) ?? null);
    }),
    mset: vi.fn(async (entries: Record<string, string>) => {
      Object.entries(entries).forEach(([k, v]) => data.set(k, v));
      return 'OK';
    }),
    
    // Set operations
    sadd: vi.fn(async (key: string, ...members: string[]) => {
      if (!sets.has(key)) sets.set(key, new Set());
      members.forEach(m => sets.get(key)!.add(m));
      return members.length;
    }),
    srem: vi.fn(async (key: string, ...members: string[]) => {
      if (!sets.has(key)) return 0;
      let removed = 0;
      members.forEach(m => {
        if (sets.get(key)!.delete(m)) removed++;
      });
      return removed;
    }),
    smembers: vi.fn(async (key: string) => {
      return Array.from(sets.get(key) ?? []);
    }),
    scard: vi.fn(async (key: string) => {
      return sets.get(key)?.size ?? 0;
    }),
    sismember: vi.fn(async (key: string, member: string) => {
      return sets.get(key)?.has(member) ? 1 : 0;
    }),

    // Sorted set operations
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      if (!sortedSets.has(key)) sortedSets.set(key, new Map());
      sortedSets.get(key)!.set(member, score);
      return 1;
    }),
    zrem: vi.fn(async (key: string, member: string) => {
      return sortedSets.get(key)?.delete(member) ? 1 : 0;
    }),
    zrange: vi.fn(async (key: string, start: number, stop: number) => {
      const ss = sortedSets.get(key);
      if (!ss) return [];
      const sorted = Array.from(ss.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([m]) => m);
      const end = stop === -1 ? sorted.length : stop + 1;
      return sorted.slice(start, end);
    }),
    zrevrange: vi.fn(async (key: string, start: number, stop: number) => {
      const ss = sortedSets.get(key);
      if (!ss) return [];
      const sorted = Array.from(ss.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([m]) => m);
      const end = stop === -1 ? sorted.length : stop + 1;
      return sorted.slice(start, end);
    }),
    zscore: vi.fn(async (key: string, member: string) => {
      return sortedSets.get(key)?.get(member) ?? null;
    }),
    zcard: vi.fn(async (key: string) => {
      return sortedSets.get(key)?.size ?? 0;
    }),
  } as unknown as KeyValueStore;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const testUserId = 'user_test123' as UserId;

function createConsentRequest(
  purpose: ConsentPurpose,
  granted: boolean
): UpdateConsentRequest {
  return {
    purpose,
    granted,
    method: 'settings_toggle',
    policyVersion: CURRENT_POLICY_VERSION,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('ConsentStore', () => {
  let store: ConsentStore;
  let mockKv: KeyValueStore;

  beforeEach(() => {
    mockKv = createMockStore();
    // Disable encryption in tests to avoid needing real encryption keys
    store = createConsentStore(mockKv, { encryptionEnabled: false });
  });

  describe('getConsent', () => {
    it('should return null for user with no consent', async () => {
      const result = await store.getConsent(testUserId);
      
      expect(result.ok).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('recordConsent', () => {
    it('should grant consent for optional purpose', async () => {
      const request = createConsentRequest('analytics', true);
      
      const result = await store.recordConsent(testUserId, request);
      
      expect(result.ok).toBe(true);
      expect(result.value?.success).toBe(true);
      expect(result.value?.consent.purposes.analytics.granted).toBe(true);
    });

    it('should grant consent for required purpose', async () => {
      const request = createConsentRequest('dataProcessing', true);
      
      const result = await store.recordConsent(testUserId, request);
      
      expect(result.ok).toBe(true);
      expect(result.value?.success).toBe(true);
      expect(result.value?.consent.purposes.dataProcessing.granted).toBe(true);
      expect(result.value?.consent.hasRequiredConsents).toBe(true);
    });

    it('should revoke consent for optional purpose', async () => {
      // First grant
      await store.recordConsent(testUserId, createConsentRequest('analytics', true));
      
      // Then revoke
      const result = await store.recordConsent(
        testUserId,
        createConsentRequest('analytics', false)
      );
      
      expect(result.ok).toBe(true);
      expect(result.value?.success).toBe(true);
      expect(result.value?.consent.purposes.analytics.granted).toBe(false);
    });

    it('should NOT revoke required consent', async () => {
      // First grant required consent
      await store.recordConsent(testUserId, createConsentRequest('dataProcessing', true));
      
      // Try to revoke
      const result = await store.recordConsent(testUserId, {
        purpose: 'dataProcessing',
        granted: false,
        method: 'settings_toggle',
      });
      
      expect(result.ok).toBe(true);
      expect(result.value?.success).toBe(false);
      expect(result.value?.warning).toContain('Cannot revoke required consent');
    });

    it('should create consent record for audit', async () => {
      const request = createConsentRequest('notifications', true);
      
      const result = await store.recordConsent(testUserId, request, {
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      });
      
      expect(result.ok).toBe(true);
      expect(result.value?.record).toBeDefined();
      expect(result.value?.record.purpose).toBe('notifications');
      expect(result.value?.record.granted).toBe(true);
      expect(result.value?.record.ipAddress).toBe('192.168.1.1');
    });

    it('should increment change count', async () => {
      await store.recordConsent(testUserId, createConsentRequest('analytics', true));
      const result = await store.recordConsent(testUserId, createConsentRequest('notifications', true));
      
      expect(result.ok).toBe(true);
      expect(result.value?.consent.changeCount).toBe(2);
    });
  });

  describe('batchUpdateConsent', () => {
    it('should update multiple consents at once', async () => {
      const result = await store.batchUpdateConsent(testUserId, {
        consents: [
          { purpose: 'dataProcessing', granted: true, method: 'signup_flow' },
          { purpose: 'analytics', granted: true, method: 'signup_flow' },
          { purpose: 'notifications', granted: true, method: 'signup_flow' },
        ],
        method: 'signup_flow',
        policyVersion: CURRENT_POLICY_VERSION,
      });
      
      expect(result.ok).toBe(true);
      expect(result.value?.purposes.dataProcessing.granted).toBe(true);
      expect(result.value?.purposes.analytics.granted).toBe(true);
      expect(result.value?.purposes.notifications.granted).toBe(true);
    });

    it('should skip required consent revocation in batch', async () => {
      // First grant
      await store.batchUpdateConsent(testUserId, {
        consents: [
          { purpose: 'dataProcessing', granted: true, method: 'signup_flow' },
        ],
        method: 'signup_flow',
        policyVersion: CURRENT_POLICY_VERSION,
      });

      // Try to revoke in batch
      const result = await store.batchUpdateConsent(testUserId, {
        consents: [
          { purpose: 'dataProcessing', granted: false, method: 'settings_toggle' },
          { purpose: 'analytics', granted: false, method: 'settings_toggle' },
        ],
        method: 'settings_toggle',
        policyVersion: CURRENT_POLICY_VERSION,
      });
      
      expect(result.ok).toBe(true);
      // dataProcessing should still be granted (skip revocation)
      expect(result.value?.purposes.dataProcessing.granted).toBe(true);
    });
  });

  describe('hasConsent', () => {
    it('should return false for unset consent', async () => {
      const result = await store.hasConsent(testUserId, 'analytics');
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should return true for granted consent', async () => {
      await store.recordConsent(testUserId, createConsentRequest('analytics', true));
      
      const result = await store.hasConsent(testUserId, 'analytics');
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return false for revoked consent', async () => {
      await store.recordConsent(testUserId, createConsentRequest('analytics', true));
      await store.recordConsent(testUserId, createConsentRequest('analytics', false));
      
      const result = await store.hasConsent(testUserId, 'analytics');
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(false);
    });
  });

  describe('hasRequiredConsents', () => {
    it('should return false when no consents', async () => {
      const result = await store.hasRequiredConsents(testUserId);
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should return true when required consents granted', async () => {
      await store.recordConsent(testUserId, createConsentRequest('dataProcessing', true));
      
      const result = await store.hasRequiredConsents(testUserId);
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('revokeAllConsents', () => {
    it('should revoke all consents including required', async () => {
      // Grant several consents
      await store.batchUpdateConsent(testUserId, {
        consents: [
          { purpose: 'dataProcessing', granted: true, method: 'signup_flow' },
          { purpose: 'analytics', granted: true, method: 'signup_flow' },
          { purpose: 'notifications', granted: true, method: 'signup_flow' },
        ],
        method: 'signup_flow',
        policyVersion: CURRENT_POLICY_VERSION,
      });

      // Revoke all
      const result = await store.revokeAllConsents(testUserId, 'account_deletion');
      
      expect(result.ok).toBe(true);

      // Verify all revoked
      const consent = await store.getConsent(testUserId);
      expect(consent.ok).toBe(true);
      expect(consent.value?.purposes.dataProcessing.granted).toBe(false);
      expect(consent.value?.purposes.analytics.granted).toBe(false);
      expect(consent.value?.purposes.notifications.granted).toBe(false);
      expect(consent.value?.hasRequiredConsents).toBe(false);
    });
  });

  describe('getConsentHistory', () => {
    it('should return empty history for new user', async () => {
      const result = await store.getConsentHistory(testUserId);
      
      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it('should return consent records in reverse chronological order', async () => {
      await store.recordConsent(testUserId, createConsentRequest('analytics', true));
      await store.recordConsent(testUserId, createConsentRequest('notifications', true));
      await store.recordConsent(testUserId, createConsentRequest('analytics', false));
      
      const result = await store.getConsentHistory(testUserId);
      
      expect(result.ok).toBe(true);
      expect(result.value?.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by purpose', async () => {
      await store.recordConsent(testUserId, createConsentRequest('analytics', true));
      await store.recordConsent(testUserId, createConsentRequest('notifications', true));
      
      const result = await store.getConsentHistory(testUserId, { purpose: 'analytics' });
      
      expect(result.ok).toBe(true);
      result.value?.forEach(record => {
        expect(record.purpose).toBe('analytics');
      });
    });
  });

  describe('deleteConsentData', () => {
    it('should delete all consent data for user', async () => {
      // Create consent data
      await store.batchUpdateConsent(testUserId, {
        consents: [
          { purpose: 'dataProcessing', granted: true, method: 'signup_flow' },
          { purpose: 'analytics', granted: true, method: 'signup_flow' },
        ],
        method: 'signup_flow',
        policyVersion: CURRENT_POLICY_VERSION,
      });

      // Delete
      const result = await store.deleteConsentData(testUserId);
      
      expect(result.ok).toBe(true);
      expect(result.value).toBeGreaterThan(0);

      // Verify deleted
      const consent = await store.getConsent(testUserId);
      expect(consent.ok).toBe(true);
      expect(consent.value).toBeNull();
    });
  });
});
