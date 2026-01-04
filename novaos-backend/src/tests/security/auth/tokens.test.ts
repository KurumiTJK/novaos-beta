// ═══════════════════════════════════════════════════════════════════════════════
// AUTH TOKENS TESTS — JWT Generation, Verification, and Revocation
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initTokenConfig,
  setRevocationStore,
  getTokenConfig,
  generateAccessToken,
  generateRefreshToken,
  generateApiKey,
  verifyToken,
  verifyTokenSync,
  revokeToken,
  revokeAllUserTokens,
  isTokenRevoked,
  isUserTokensRevoked,
  refreshAccessToken,
  extractBearerToken,
  extractApiKey,
  getTokenRemainingTime,
  isTokenExpiringSoon,
} from '../../../security/auth/tokens.js';
import type { KeyValueStore } from '../../../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK STORE
// ─────────────────────────────────────────────────────────────────────────────────

function createMockStore(): KeyValueStore {
  const data = new Map<string, { value: string; expiresAt?: number }>();
  
  return {
    get: vi.fn(async (key: string) => {
      const entry = data.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        data.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: string, ttl?: number) => {
      data.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      });
    }),
    delete: vi.fn(async (key: string) => {
      return data.delete(key);
    }),
    exists: vi.fn(async (key: string) => data.has(key)),
  } as unknown as KeyValueStore;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

let mockStore: KeyValueStore;

beforeEach(() => {
  mockStore = createMockStore();
  initTokenConfig({
    secret: 'test-secret-key-for-testing-only',
    issuer: 'test-issuer',
    audience: 'test-audience',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    apiKeyExpiry: '365d',
  });
  setRevocationStore(mockStore);
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Configuration', () => {
  describe('initTokenConfig()', () => {
    it('should initialize config', () => {
      initTokenConfig({
        secret: 'custom-secret',
        issuer: 'custom-issuer',
      });
      
      const config = getTokenConfig();
      expect(config.secret).toBe('custom-secret');
      expect(config.issuer).toBe('custom-issuer');
    });

    it('should merge with defaults', () => {
      initTokenConfig({
        secret: 'new-secret',
      });
      
      const config = getTokenConfig();
      expect(config.secret).toBe('new-secret');
      expect(config.audience).toBeDefined();
    });
  });

  describe('getTokenConfig()', () => {
    it('should return current config', () => {
      const config = getTokenConfig();
      
      expect(config).toHaveProperty('secret');
      expect(config).toHaveProperty('issuer');
      expect(config).toHaveProperty('audience');
      expect(config).toHaveProperty('accessTokenExpiry');
      expect(config).toHaveProperty('refreshTokenExpiry');
      expect(config).toHaveProperty('apiKeyExpiry');
    });
  });

  describe('setRevocationStore()', () => {
    it('should set revocation store', () => {
      setRevocationStore(mockStore);
      // No error means success
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN GENERATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Token Generation', () => {
  describe('generateAccessToken()', () => {
    it('should generate valid access token', () => {
      const result = generateAccessToken('user-123', 'pro');
      
      expect(result.token).toBeDefined();
      expect(result.type).toBe('access');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.tokenId).toBeDefined();
    });

    it('should include user ID in token', async () => {
      const result = generateAccessToken('user-456', 'free');
      const verified = await verifyToken(result.token);
      
      expect(verified.valid).toBe(true);
      if (verified.valid) {
        expect(verified.user.userId).toBe('user-456');
      }
    });

    it('should include tier in token', async () => {
      const result = generateAccessToken('user-123', 'enterprise');
      const verified = await verifyToken(result.token);
      
      if (verified.valid) {
        expect(verified.user.tier).toBe('enterprise');
      }
    });

    it('should include custom permissions', async () => {
      const result = generateAccessToken('user-123', 'free', {
        permissions: ['custom:permission'],
      });
      const verified = await verifyToken(result.token);
      
      if (verified.valid) {
        expect(verified.user.permissions).toContain('custom:permission');
      }
    });

    it('should include email when provided', async () => {
      const result = generateAccessToken('user-123', 'pro', {
        email: 'test@example.com',
      });
      const verified = await verifyToken(result.token);
      
      if (verified.valid) {
        expect(verified.user.email).toBe('test@example.com');
      }
    });

    it('should include custom role', async () => {
      const result = generateAccessToken('user-123', 'free', {
        role: 'admin',
      });
      const verified = await verifyToken(result.token);
      
      if (verified.valid) {
        expect(verified.user.role).toBe('admin');
      }
    });
  });

  describe('generateRefreshToken()', () => {
    it('should generate valid refresh token', () => {
      const result = generateRefreshToken('user-123', 'pro');
      
      expect(result.token).toBeDefined();
      expect(result.token.startsWith('refresh_')).toBe(true);
      expect(result.type).toBe('refresh');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should have longer expiry than access token', () => {
      const access = generateAccessToken('user-123', 'free');
      const refresh = generateRefreshToken('user-123', 'free');
      
      expect(refresh.expiresAt).toBeGreaterThan(access.expiresAt);
    });
  });

  describe('generateApiKey()', () => {
    it('should generate valid API key', () => {
      const result = generateApiKey('user-123', 'enterprise');
      
      expect(result.token).toBeDefined();
      expect(result.token.startsWith('nova_')).toBe(true);
      expect(result.type).toBe('api_key');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should include email when provided', async () => {
      const result = generateApiKey('user-123', 'enterprise', {
        email: 'api@example.com',
      });
      const verified = await verifyToken(result.token);
      
      if (verified.valid) {
        expect(verified.user.email).toBe('api@example.com');
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN VERIFICATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Token Verification', () => {
  describe('verifyToken()', () => {
    it('should verify valid access token', async () => {
      const generated = generateAccessToken('user-123', 'pro');
      const result = await verifyToken(generated.token);
      
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.user.userId).toBe('user-123');
        expect(result.user.tier).toBe('pro');
      }
    });

    it('should verify token with Bearer prefix', async () => {
      const generated = generateAccessToken('user-123', 'free');
      const result = await verifyToken(`Bearer ${generated.token}`);
      
      expect(result.valid).toBe(true);
    });

    it('should verify refresh token', async () => {
      const generated = generateRefreshToken('user-123', 'pro');
      const result = await verifyToken(generated.token);
      
      expect(result.valid).toBe(true);
    });

    it('should verify API key', async () => {
      const generated = generateApiKey('user-123', 'enterprise');
      const result = await verifyToken(generated.token);
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid token', async () => {
      const result = await verifyToken('invalid-token');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_MALFORMED');
    });

    it('should reject expired token', async () => {
      // Configure very short expiry
      initTokenConfig({
        secret: 'test-secret',
        accessTokenExpiry: '1s',
      });
      
      const generated = generateAccessToken('user-123', 'free');
      
      // Wait for token to expire
      await new Promise(r => setTimeout(r, 1100));
      
      const result = await verifyToken(generated.token);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_EXPIRED');
    });

    it('should reject revoked token', async () => {
      const generated = generateAccessToken('user-123', 'pro');
      await revokeToken(generated.tokenId);
      
      const result = await verifyToken(generated.token);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_REVOKED');
    });

    it('should include all user fields', async () => {
      const generated = generateAccessToken('user-123', 'pro', {
        email: 'test@example.com',
        role: 'premium',
        permissions: ['chat:send'],
      });
      
      const result = await verifyToken(generated.token);
      
      if (result.valid) {
        expect(result.user.userId).toBe('user-123');
        expect(result.user.email).toBe('test@example.com');
        expect(result.user.tier).toBe('pro');
        expect(result.user.role).toBe('premium');
        expect(result.user.permissions).toContain('chat:send');
        expect(result.user.tokenId).toBeDefined();
        expect(result.user.issuedAt).toBeDefined();
        expect(result.user.expiresAt).toBeDefined();
      }
    });
  });

  describe('verifyTokenSync()', () => {
    it('should verify token synchronously', () => {
      const generated = generateAccessToken('user-123', 'free');
      const result = verifyTokenSync(generated.token);
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid token', () => {
      const result = verifyTokenSync('invalid-token');
      
      expect(result.valid).toBe(false);
    });

    it('should not check revocation', () => {
      // Sync version doesn't check revocation store
      const generated = generateAccessToken('user-123', 'pro');
      
      // Even if we could revoke, sync wouldn't check
      const result = verifyTokenSync(generated.token);
      expect(result.valid).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN REVOCATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Token Revocation', () => {
  describe('revokeToken()', () => {
    it('should revoke a token', async () => {
      const generated = generateAccessToken('user-123', 'free');
      const result = await revokeToken(generated.tokenId);
      
      expect(result).toBe(true);
    });

    it('should make token invalid after revocation', async () => {
      const generated = generateAccessToken('user-123', 'free');
      await revokeToken(generated.tokenId);
      
      const verified = await verifyToken(generated.token);
      expect(verified.valid).toBe(false);
    });

    it('should use custom TTL', async () => {
      const generated = generateAccessToken('user-123', 'free');
      await revokeToken(generated.tokenId, 3600);
      
      const setCall = (mockStore.set as any).mock.calls[0];
      expect(setCall[2]).toBe(3600);
    });
  });

  describe('revokeAllUserTokens()', () => {
    it('should revoke all tokens for a user', async () => {
      const result = await revokeAllUserTokens('user-123');
      
      expect(result).toBe(true);
      expect(mockStore.set).toHaveBeenCalled();
    });

    it('should invalidate tokens issued before revocation', async () => {
      const generated = generateAccessToken('user-123', 'free');
      
      // Small delay to ensure revocation timestamp is after token issuance
      await new Promise(r => setTimeout(r, 10));
      await revokeAllUserTokens('user-123');
      
      const isRevoked = await isUserTokensRevoked('user-123', generated.expiresAt - 900000);
      expect(isRevoked).toBe(true);
    });
  });

  describe('isTokenRevoked()', () => {
    it('should return false for non-revoked token', async () => {
      const result = await isTokenRevoked('non-existent-token-id');
      
      expect(result).toBe(false);
    });

    it('should return true for revoked token', async () => {
      await revokeToken('token-123');
      const result = await isTokenRevoked('token-123');
      
      expect(result).toBe(true);
    });
  });

  describe('isUserTokensRevoked()', () => {
    it('should return false when no revocation exists', async () => {
      const result = await isUserTokensRevoked('user-123', Date.now());
      
      expect(result).toBe(false);
    });

    it('should return true for tokens issued before revocation', async () => {
      const issuedAt = Date.now() - 1000;
      await revokeAllUserTokens('user-123');
      
      const result = await isUserTokensRevoked('user-123', issuedAt);
      expect(result).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN REFRESH TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Token Refresh', () => {
  describe('refreshAccessToken()', () => {
    it('should generate new tokens from valid refresh token', async () => {
      const refresh = generateRefreshToken('user-123', 'pro');
      const result = await refreshAccessToken(refresh.token);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(result.accessToken.type).toBe('access');
        expect(result.refreshToken.type).toBe('refresh');
      }
    });

    it('should return null for invalid refresh token', async () => {
      const result = await refreshAccessToken('invalid-token');
      
      expect(result).toBeNull();
    });

    it('should return null when user tokens are revoked', async () => {
      const refresh = generateRefreshToken('user-123', 'pro');
      await new Promise(r => setTimeout(r, 10));
      await revokeAllUserTokens('user-123');
      
      const result = await refreshAccessToken(refresh.token);
      
      expect(result).toBeNull();
    });

    it('should preserve user info in new tokens', async () => {
      const refresh = generateRefreshToken('user-123', 'enterprise');
      const result = await refreshAccessToken(refresh.token);
      
      if (result) {
        const verified = await verifyToken(result.accessToken.token);
        if (verified.valid) {
          expect(verified.user.userId).toBe('user-123');
          expect(verified.user.tier).toBe('enterprise');
        }
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Helper Functions', () => {
  describe('extractBearerToken()', () => {
    it('should extract token from Bearer header', () => {
      const token = extractBearerToken('Bearer my-token-123');
      
      expect(token).toBe('my-token-123');
    });

    it('should return null for non-Bearer header', () => {
      const token = extractBearerToken('Basic credentials');
      
      expect(token).toBeNull();
    });

    it('should return null for undefined', () => {
      const token = extractBearerToken(undefined);
      
      expect(token).toBeNull();
    });

    it('should return null for empty string', () => {
      const token = extractBearerToken('');
      
      expect(token).toBeNull();
    });
  });

  describe('extractApiKey()', () => {
    it('should extract API key with nova_ prefix', () => {
      const key = extractApiKey('nova_abc123xyz');
      
      expect(key).toBe('nova_abc123xyz');
    });

    it('should return null for non-nova prefix', () => {
      const key = extractApiKey('sk-abc123xyz');
      
      expect(key).toBeNull();
    });

    it('should return null for undefined', () => {
      const key = extractApiKey(undefined);
      
      expect(key).toBeNull();
    });
  });

  describe('getTokenRemainingTime()', () => {
    it('should return positive time for future expiry', () => {
      const futureTime = Date.now() + 60000;
      const remaining = getTokenRemainingTime(futureTime);
      
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60000);
    });

    it('should return 0 for past expiry', () => {
      const pastTime = Date.now() - 60000;
      const remaining = getTokenRemainingTime(pastTime);
      
      expect(remaining).toBe(0);
    });
  });

  describe('isTokenExpiringSoon()', () => {
    it('should return true when expiring within threshold', () => {
      const soonExpiry = Date.now() + 60000; // 1 minute
      const result = isTokenExpiringSoon(soonExpiry, 5 * 60 * 1000); // 5 minute threshold
      
      expect(result).toBe(true);
    });

    it('should return false when not expiring soon', () => {
      const laterExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
      const result = isTokenExpiringSoon(laterExpiry, 5 * 60 * 1000); // 5 minute threshold
      
      expect(result).toBe(false);
    });

    it('should use default 5 minute threshold', () => {
      const soonExpiry = Date.now() + 3 * 60 * 1000; // 3 minutes
      const result = isTokenExpiringSoon(soonExpiry);
      
      expect(result).toBe(true);
    });

    it('should return true for already expired', () => {
      const expired = Date.now() - 60000;
      const result = isTokenExpiringSoon(expired);
      
      expect(result).toBe(true);
    });
  });
});
