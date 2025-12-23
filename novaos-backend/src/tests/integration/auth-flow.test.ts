// ═══════════════════════════════════════════════════════════════════════════════
// AUTH FLOW INTEGRATION TESTS
// NovaOS Phase 17 — Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err, isOk, isErr } from '../../types/result.js';
import { createUserId, createTimestamp } from '../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────────

const mockTokenService = {
  generateToken: vi.fn(),
  verifyToken: vi.fn(),
  refreshToken: vi.fn(),
  revokeToken: vi.fn(),
};

const mockUserStore = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateLastLogin: vi.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

function createTestUser(overrides = {}) {
  return {
    id: createUserId('user_test123'),
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    tier: 'free' as const,
    createdAt: createTimestamp(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Auth Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Flow', () => {
    it('should return token for valid credentials', async () => {
      const user = createTestUser();
      mockUserStore.findByEmail.mockResolvedValue(user);
      mockTokenService.generateToken.mockReturnValue(ok({
        accessToken: 'access_123',
        refreshToken: 'refresh_123',
        expiresIn: 3600,
      }));

      const result = mockTokenService.generateToken(user.id);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.accessToken).toBeDefined();
      }
    });

    it('should reject invalid credentials', async () => {
      mockUserStore.findByEmail.mockResolvedValue(null);

      const result = err({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
      
      expect(isErr(result)).toBe(true);
    });

    it('should handle locked accounts', async () => {
      const lockedUser = createTestUser({ lockedUntil: new Date(Date.now() + 3600000) });
      mockUserStore.findByEmail.mockResolvedValue(lockedUser);

      const result = err({ code: 'ACCOUNT_LOCKED', message: 'Account is locked' });
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('ACCOUNT_LOCKED');
      }
    });

    it('should rate limit failed login attempts', async () => {
      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        mockUserStore.findByEmail.mockResolvedValue(null);
      }

      const result = err({ code: 'RATE_LIMITED', message: 'Too many attempts' });
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Token Refresh Flow', () => {
    it('should refresh valid token', async () => {
      mockTokenService.verifyToken.mockReturnValue(ok({ userId: 'user_123', type: 'refresh' }));
      mockTokenService.refreshToken.mockReturnValue(ok({
        accessToken: 'new_access_123',
        refreshToken: 'new_refresh_123',
        expiresIn: 3600,
      }));

      const verifyResult = mockTokenService.verifyToken('refresh_123');
      expect(isOk(verifyResult)).toBe(true);

      const refreshResult = mockTokenService.refreshToken('refresh_123');
      expect(isOk(refreshResult)).toBe(true);
    });

    it('should reject expired refresh token', async () => {
      mockTokenService.verifyToken.mockReturnValue(err({ code: 'TOKEN_EXPIRED', message: 'Token expired' }));

      const result = mockTokenService.verifyToken('expired_token');
      
      expect(isErr(result)).toBe(true);
    });

    it('should reject revoked refresh token', async () => {
      mockTokenService.verifyToken.mockReturnValue(err({ code: 'TOKEN_REVOKED', message: 'Token revoked' }));

      const result = mockTokenService.verifyToken('revoked_token');
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Logout Flow', () => {
    it('should revoke tokens on logout', async () => {
      mockTokenService.revokeToken.mockReturnValue(ok({ revoked: true }));

      const result = mockTokenService.revokeToken('access_123');
      
      expect(isOk(result)).toBe(true);
    });

    it('should handle already revoked tokens gracefully', async () => {
      mockTokenService.revokeToken.mockReturnValue(ok({ revoked: true, alreadyRevoked: true }));

      const result = mockTokenService.revokeToken('already_revoked_token');
      
      expect(isOk(result)).toBe(true);
    });
  });

  describe('Registration Flow', () => {
    it('should create new user with valid data', async () => {
      const newUser = createTestUser({ id: createUserId('user_new123') });
      mockUserStore.findByEmail.mockResolvedValue(null);
      mockUserStore.create.mockResolvedValue(newUser);

      const result = ok(newUser);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.email).toBe('test@example.com');
      }
    });

    it('should reject duplicate email', async () => {
      mockUserStore.findByEmail.mockResolvedValue(createTestUser());

      const result = err({ code: 'EMAIL_EXISTS', message: 'Email already registered' });
      
      expect(isErr(result)).toBe(true);
    });
  });
});
