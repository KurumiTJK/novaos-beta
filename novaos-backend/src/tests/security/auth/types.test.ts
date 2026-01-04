// ═══════════════════════════════════════════════════════════════════════════════
// AUTH TYPES TESTS — JWT Payload, User Types, Token Configuration
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PERMISSIONS,
  ROLE_PERMISSIONS,
  getDefaultPermissions,
  getRoleForTier,
  type UserTier,
  type UserRole,
  type JWTPayload,
  type AuthenticatedUser,
  type TokenType,
  type TokenConfig,
  type GeneratedToken,
  type TokenVerificationResult,
  type TokenError,
  type AuthEventType,
  type AuthEvent,
  type AuthMiddlewareOptions,
} from '../../../security/auth/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// USER TIER & ROLE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('UserTier', () => {
  it('should accept valid tiers', () => {
    const tiers: UserTier[] = ['free', 'pro', 'enterprise'];
    expect(tiers).toHaveLength(3);
  });
});

describe('UserRole', () => {
  it('should accept valid roles', () => {
    const roles: UserRole[] = ['user', 'premium', 'admin', 'service'];
    expect(roles).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT_PERMISSIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_PERMISSIONS', () => {
  it('should have permissions for all tiers', () => {
    expect(DEFAULT_PERMISSIONS.free).toBeDefined();
    expect(DEFAULT_PERMISSIONS.pro).toBeDefined();
    expect(DEFAULT_PERMISSIONS.enterprise).toBeDefined();
  });

  describe('Free Tier', () => {
    it('should have basic chat permissions', () => {
      expect(DEFAULT_PERMISSIONS.free).toContain('chat:send');
      expect(DEFAULT_PERMISSIONS.free).toContain('conversation:read');
      expect(DEFAULT_PERMISSIONS.free).toContain('conversation:create');
      expect(DEFAULT_PERMISSIONS.free).toContain('conversation:delete');
    });

    it('should not have goal permissions', () => {
      expect(DEFAULT_PERMISSIONS.free).not.toContain('goal:create');
    });
  });

  describe('Pro Tier', () => {
    it('should have all free permissions plus goal permissions', () => {
      expect(DEFAULT_PERMISSIONS.pro).toContain('chat:send');
      expect(DEFAULT_PERMISSIONS.pro).toContain('goal:create');
      expect(DEFAULT_PERMISSIONS.pro).toContain('goal:read');
      expect(DEFAULT_PERMISSIONS.pro).toContain('goal:update');
      expect(DEFAULT_PERMISSIONS.pro).toContain('goal:delete');
      expect(DEFAULT_PERMISSIONS.pro).toContain('memory:read');
    });
  });

  describe('Enterprise Tier', () => {
    it('should have all pro permissions plus admin permissions', () => {
      expect(DEFAULT_PERMISSIONS.enterprise).toContain('chat:send');
      expect(DEFAULT_PERMISSIONS.enterprise).toContain('goal:create');
      expect(DEFAULT_PERMISSIONS.enterprise).toContain('memory:write');
      expect(DEFAULT_PERMISSIONS.enterprise).toContain('admin:read');
      expect(DEFAULT_PERMISSIONS.enterprise).toContain('webhook:manage');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ROLE_PERMISSIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ROLE_PERMISSIONS', () => {
  it('should have permissions for all roles', () => {
    expect(ROLE_PERMISSIONS.user).toBeDefined();
    expect(ROLE_PERMISSIONS.premium).toBeDefined();
    expect(ROLE_PERMISSIONS.admin).toBeDefined();
    expect(ROLE_PERMISSIONS.service).toBeDefined();
  });

  describe('User Role', () => {
    it('should have no additional permissions', () => {
      expect(ROLE_PERMISSIONS.user).toEqual([]);
    });
  });

  describe('Premium Role', () => {
    it('should have priority permission', () => {
      expect(ROLE_PERMISSIONS.premium).toContain('priority:high');
    });
  });

  describe('Admin Role', () => {
    it('should have admin wildcard permission', () => {
      expect(ROLE_PERMISSIONS.admin).toContain('admin:*');
      expect(ROLE_PERMISSIONS.admin).toContain('user:manage');
      expect(ROLE_PERMISSIONS.admin).toContain('audit:read');
    });
  });

  describe('Service Role', () => {
    it('should have service wildcard permission', () => {
      expect(ROLE_PERMISSIONS.service).toContain('service:*');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getDefaultPermissions()', () => {
  it('should return tier permissions for user role', () => {
    const perms = getDefaultPermissions('free', 'user');
    
    expect(perms).toContain('chat:send');
    expect(perms).toContain('conversation:read');
  });

  it('should combine tier and role permissions', () => {
    const perms = getDefaultPermissions('free', 'admin');
    
    // Should have tier permissions
    expect(perms).toContain('chat:send');
    
    // Should have role permissions
    expect(perms).toContain('admin:*');
    expect(perms).toContain('user:manage');
  });

  it('should return unique permissions', () => {
    const perms = getDefaultPermissions('enterprise', 'admin');
    
    // Should not have duplicates
    const uniquePerms = [...new Set(perms)];
    expect(perms.length).toBe(uniquePerms.length);
  });

  it('should return empty array for unknown tier/role', () => {
    const perms = getDefaultPermissions('unknown' as UserTier, 'unknown' as UserRole);
    
    // Should return empty arrays or default behavior
    expect(Array.isArray(perms)).toBe(true);
  });
});

describe('getRoleForTier()', () => {
  it('should return user for free tier', () => {
    expect(getRoleForTier('free')).toBe('user');
  });

  it('should return premium for pro tier', () => {
    expect(getRoleForTier('pro')).toBe('premium');
  });

  it('should return premium for enterprise tier', () => {
    expect(getRoleForTier('enterprise')).toBe('premium');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('JWTPayload', () => {
    it('should accept valid payload', () => {
      const payload: JWTPayload = {
        sub: 'user-123',
        iat: 1234567890,
        exp: 1234567890 + 3600,
        iss: 'novaos',
        aud: 'novaos-api',
        jti: 'token-id',
        email: 'user@example.com',
        tier: 'pro',
        role: 'user',
        permissions: ['chat:send'],
      };
      
      expect(payload.sub).toBe('user-123');
      expect(payload.tier).toBe('pro');
    });

    it('should allow optional fields', () => {
      const payload: JWTPayload = {
        sub: 'user-123',
        iat: 1234567890,
        exp: 1234567890 + 3600,
        iss: 'novaos',
        aud: 'novaos-api',
        tier: 'free',
        role: 'user',
      };
      
      expect(payload.jti).toBeUndefined();
      expect(payload.email).toBeUndefined();
      expect(payload.permissions).toBeUndefined();
    });
  });

  describe('AuthenticatedUser', () => {
    it('should accept valid user', () => {
      const user: AuthenticatedUser = {
        userId: 'user-123',
        email: 'user@example.com',
        tier: 'pro',
        role: 'user',
        permissions: ['chat:send'],
        tokenId: 'token-123',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      
      expect(user.userId).toBe('user-123');
    });
  });

  describe('TokenType', () => {
    it('should accept valid token types', () => {
      const types: TokenType[] = ['access', 'refresh', 'api_key'];
      expect(types).toHaveLength(3);
    });
  });

  describe('TokenConfig', () => {
    it('should accept valid config', () => {
      const config: TokenConfig = {
        secret: 'my-secret',
        issuer: 'novaos',
        audience: 'novaos-api',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        apiKeyExpiry: '365d',
      };
      
      expect(config.secret).toBe('my-secret');
    });
  });

  describe('GeneratedToken', () => {
    it('should accept valid generated token', () => {
      const token: GeneratedToken = {
        token: 'jwt-token-string',
        type: 'access',
        expiresAt: Date.now() + 900000,
        tokenId: 'token-123',
      };
      
      expect(token.type).toBe('access');
    });
  });

  describe('TokenVerificationResult', () => {
    it('should accept valid result', () => {
      const validResult: TokenVerificationResult = {
        valid: true,
        user: {
          userId: 'user-123',
          tier: 'free',
          role: 'user',
          permissions: [],
          issuedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
      };
      
      expect(validResult.valid).toBe(true);
    });

    it('should accept invalid result', () => {
      const invalidResult: TokenVerificationResult = {
        valid: false,
        error: 'TOKEN_EXPIRED',
      };
      
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('TOKEN_EXPIRED');
    });
  });

  describe('TokenError', () => {
    it('should accept valid error types', () => {
      const errors: TokenError[] = [
        'TOKEN_MISSING',
        'TOKEN_INVALID',
        'TOKEN_EXPIRED',
        'TOKEN_REVOKED',
        'TOKEN_MALFORMED',
        'SIGNATURE_INVALID',
      ];
      
      expect(errors).toHaveLength(6);
    });
  });

  describe('AuthEventType', () => {
    it('should accept valid event types', () => {
      const types: AuthEventType[] = [
        'login_success',
        'login_failure',
        'logout',
        'token_refresh',
        'token_revoked',
        'token_invalid',
        'api_key_created',
        'api_key_revoked',
      ];
      
      expect(types).toHaveLength(8);
    });
  });

  describe('AuthEvent', () => {
    it('should accept valid event', () => {
      const event: AuthEvent = {
        type: 'login_success',
        userId: 'user-123',
        timestamp: Date.now(),
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        details: { method: 'password' },
      };
      
      expect(event.type).toBe('login_success');
    });
  });

  describe('AuthMiddlewareOptions', () => {
    it('should accept valid options', () => {
      const options: AuthMiddlewareOptions = {
        required: true,
        allowApiKey: true,
        skipPaths: ['/health', '/ready'],
      };
      
      expect(options.required).toBe(true);
    });

    it('should allow all optional', () => {
      const options: AuthMiddlewareOptions = {};
      
      expect(options.required).toBeUndefined();
    });
  });
});
