// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MODULE INDEX TESTS — Export Verification
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import * as authModule from '../../../security/auth/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Exports', () => {
  it('should export DEFAULT_PERMISSIONS', () => {
    expect(authModule.DEFAULT_PERMISSIONS).toBeDefined();
    expect(authModule.DEFAULT_PERMISSIONS.free).toBeDefined();
    expect(authModule.DEFAULT_PERMISSIONS.pro).toBeDefined();
    expect(authModule.DEFAULT_PERMISSIONS.enterprise).toBeDefined();
  });

  it('should export ROLE_PERMISSIONS', () => {
    expect(authModule.ROLE_PERMISSIONS).toBeDefined();
    expect(authModule.ROLE_PERMISSIONS.user).toBeDefined();
    expect(authModule.ROLE_PERMISSIONS.admin).toBeDefined();
  });

  it('should export getDefaultPermissions', () => {
    expect(typeof authModule.getDefaultPermissions).toBe('function');
  });

  it('should export getRoleForTier', () => {
    expect(typeof authModule.getRoleForTier).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Token Exports', () => {
  it('should export token configuration functions', () => {
    expect(typeof authModule.initTokenConfig).toBe('function');
    expect(typeof authModule.setRevocationStore).toBe('function');
    expect(typeof authModule.getTokenConfig).toBe('function');
  });

  it('should export token generation functions', () => {
    expect(typeof authModule.generateAccessToken).toBe('function');
    expect(typeof authModule.generateRefreshToken).toBe('function');
    expect(typeof authModule.generateApiKey).toBe('function');
  });

  it('should export token verification functions', () => {
    expect(typeof authModule.verifyToken).toBe('function');
    expect(typeof authModule.verifyTokenSync).toBe('function');
  });

  it('should export token revocation functions', () => {
    expect(typeof authModule.revokeToken).toBe('function');
    expect(typeof authModule.revokeAllUserTokens).toBe('function');
    expect(typeof authModule.isTokenRevoked).toBe('function');
    expect(typeof authModule.isUserTokensRevoked).toBe('function');
  });

  it('should export token refresh function', () => {
    expect(typeof authModule.refreshAccessToken).toBe('function');
  });

  it('should export token helper functions', () => {
    expect(typeof authModule.extractBearerToken).toBe('function');
    expect(typeof authModule.extractApiKey).toBe('function');
    expect(typeof authModule.getTokenRemainingTime).toBe('function');
    expect(typeof authModule.isTokenExpiringSoon).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Middleware Exports', () => {
  it('should export authenticate middleware', () => {
    expect(typeof authModule.authenticate).toBe('function');
  });

  it('should export shorthand middleware', () => {
    expect(typeof authModule.requireAuth).toBe('function');
    expect(typeof authModule.optionalAuth).toBe('function');
  });

  it('should export permission middleware', () => {
    expect(typeof authModule.requirePermission).toBe('function');
    expect(typeof authModule.requireAnyPermission).toBe('function');
  });

  it('should export role/tier middleware', () => {
    expect(typeof authModule.requireAdmin).toBe('function');
    expect(typeof authModule.requireTier).toBe('function');
  });

  it('should export event handlers', () => {
    expect(typeof authModule.onAuthEvent).toBe('function');
    expect(typeof authModule.clearAuthEventHandlers).toBe('function');
  });

  it('should export helper functions', () => {
    expect(typeof authModule.getAuthenticatedUser).toBe('function');
    expect(typeof authModule.getUserId).toBe('function');
    expect(typeof authModule.isAuthenticated).toBe('function');
  });

  it('should export AuthErrorCode', () => {
    expect(authModule.AuthErrorCode).toBeDefined();
    expect(authModule.AuthErrorCode.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ACK TOKEN EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Ack Token Exports', () => {
  it('should export AckTokenStore class', () => {
    expect(authModule.AckTokenStore).toBeDefined();
    expect(typeof authModule.AckTokenStore).toBe('function');
  });

  it('should export singleton functions', () => {
    expect(typeof authModule.initAckTokenStore).toBe('function');
    expect(typeof authModule.getAckTokenStore).toBe('function');
  });

  it('should export convenience functions', () => {
    expect(typeof authModule.generateAckToken).toBe('function');
    expect(typeof authModule.verifyAckToken).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Module Integration', () => {
  it('should allow complete auth workflow', () => {
    // Configure tokens
    authModule.initTokenConfig({
      secret: 'test-secret',
    });
    
    // Generate token
    const { token, expiresAt } = authModule.generateAccessToken('user-123', 'pro');
    
    expect(token).toBeDefined();
    expect(expiresAt).toBeGreaterThan(Date.now());
    
    // Verify token synchronously
    const result = authModule.verifyTokenSync(token);
    
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.user.userId).toBe('user-123');
      expect(result.user.tier).toBe('pro');
    }
  });

  it('should allow complete ack token workflow', async () => {
    // Initialize ack token store
    authModule.initAckTokenStore({
      secret: 'test-ack-secret',
    });
    
    // Generate ack token
    const token = authModule.generateAckToken('user-123', 'veto_acknowledge');
    
    expect(token).toBeDefined();
    
    // Verify ack token
    const result = await authModule.verifyAckToken(token, 'user-123');
    
    expect(result.valid).toBe(true);
  });

  it('should work with permission helpers', () => {
    const permissions = authModule.getDefaultPermissions('enterprise', 'admin');
    
    expect(permissions).toContain('chat:send');
    expect(permissions).toContain('admin:*');
  });

  it('should work with role helpers', () => {
    const role = authModule.getRoleForTier('enterprise');
    expect(role).toBe('premium');
  });
});
