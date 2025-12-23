// ═══════════════════════════════════════════════════════════════════════════════
// AUTH FLOW INTEGRATION TESTS — Authentication Flow Verification
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tests the complete authentication flow:
//   - Token generation and validation
//   - Protected route access
//   - Token expiry handling
//   - Token revocation
//   - Request context creation
//
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ok, err } from '../../../types/result.js';
import type { AppError } from '../../../types/result.js';
import {
  createUserId,
  createTimestamp,
  createRequestId,
  createCorrelationId,
  type UserId,
} from '../../../types/branded.js';
import type {
  AuthenticatedUser,
  JWTPayload,
  TokenVerificationResult,
  TokenError,
  RequestContext,
  UserTier,
} from '../../../security/auth/types.js';
import {
  createTestUser,
  createFreeUser,
  createProUser,
  createAdminUser,
  createTestRequestContext,
  TEST_USERS,
  TEST_USER_IDS,
} from '../../fixtures/index.js';
import { getMockRedis, resetMockRedis } from '../../mocks/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK TOKEN SERVICE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mock token service for testing authentication flows.
 * In real tests, this would be imported from the actual auth module.
 */
class MockTokenService {
  private readonly secret = 'test-jwt-secret';
  private readonly issuer = 'novaos-test';
  private readonly audience = 'novaos-test';
  private readonly defaultExpirySeconds = 3600;
  
  private revokedTokens = new Set<string>();
  private tokenCounter = 0;
  
  /**
   * Generate a mock JWT token.
   */
  generateToken(user: AuthenticatedUser, expiresInSeconds?: number): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (expiresInSeconds ?? this.defaultExpirySeconds);
    
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      tier: user.tier,
      roles: user.roles,
      iat: now,
      exp,
      iss: this.issuer,
      aud: this.audience,
      jti: `token-${++this.tokenCounter}`,
    };
    
    // Mock JWT format: base64(header).base64(payload).signature
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(`${header}.${payloadB64}`);
    
    return `${header}.${payloadB64}.${signature}`;
  }
  
  /**
   * Generate an expired token for testing.
   */
  generateExpiredToken(user: AuthenticatedUser): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now - 3600; // Expired 1 hour ago
    
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      tier: user.tier,
      roles: user.roles,
      iat: now - 7200,
      exp,
      iss: this.issuer,
      aud: this.audience,
      jti: `expired-token-${++this.tokenCounter}`,
    };
    
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(`${header}.${payloadB64}`);
    
    return `${header}.${payloadB64}.${signature}`;
  }
  
  /**
   * Verify a token and return the result.
   */
  verifyToken(token: string): TokenVerificationResult {
    if (!token) {
      return {
        valid: false,
        error: { code: 'MISSING', message: 'Token is required' },
      };
    }
    
    // Check if revoked
    if (this.revokedTokens.has(token)) {
      return {
        valid: false,
        error: { code: 'REVOKED', message: 'Token has been revoked' },
      };
    }
    
    // Parse token
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {
        valid: false,
        error: { code: 'MALFORMED', message: 'Invalid token format' },
      };
    }
    
    // Verify signature
    const [header, payloadB64, signature] = parts;
    const expectedSignature = this.sign(`${header}.${payloadB64}`);
    if (signature !== expectedSignature) {
      return {
        valid: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Invalid token signature' },
      };
    }
    
    // Decode payload
    let payload: JWTPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString());
    } catch {
      return {
        valid: false,
        error: { code: 'MALFORMED', message: 'Invalid token payload' },
      };
    }
    
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return {
        valid: false,
        error: {
          code: 'EXPIRED',
          message: 'Token has expired',
          expiredAt: new Date(payload.exp * 1000),
        },
      };
    }
    
    // Check issuer
    if (payload.iss !== this.issuer) {
      return {
        valid: false,
        error: { code: 'INVALID_ISSUER', message: 'Invalid token issuer' },
      };
    }
    
    // Check audience
    if (payload.aud !== this.audience) {
      return {
        valid: false,
        error: { code: 'INVALID_AUDIENCE', message: 'Invalid token audience' },
      };
    }
    
    // Build authenticated user
    const user: AuthenticatedUser = {
      id: payload.sub as UserId,
      email: payload.email,
      tier: payload.tier,
      roles: payload.roles,
      permissions: this.getPermissionsForTier(payload.tier),
      metadata: {
        createdAt: createTimestamp(),
      },
    };
    
    return { valid: true, payload, user };
  }
  
  /**
   * Revoke a token.
   */
  revokeToken(token: string): void {
    this.revokedTokens.add(token);
  }
  
  /**
   * Check if a token is revoked.
   */
  isRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }
  
  /**
   * Reset state (for tests).
   */
  reset(): void {
    this.revokedTokens.clear();
    this.tokenCounter = 0;
  }
  
  private sign(data: string): string {
    // Simple mock signature - in real implementation this would be HMAC-SHA256
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('base64url');
  }
  
  private getPermissionsForTier(tier: UserTier): readonly string[] {
    const base = ['goals:read', 'goals:write', 'sparks:read', 'sparks:write'];
    if (tier === 'pro' || tier === 'enterprise') {
      base.push('advanced_features', 'export:read');
    }
    if (tier === 'enterprise') {
      base.push('team:read', 'team:write');
    }
    return base;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mock authentication middleware for testing.
 */
class MockAuthMiddleware {
  constructor(private readonly tokenService: MockTokenService) {}
  
  /**
   * Authenticate a request using Bearer token.
   */
  authenticate(authorizationHeader?: string): {
    authenticated: boolean;
    user?: AuthenticatedUser;
    error?: TokenError;
    context?: RequestContext;
  } {
    // Extract token from header
    if (!authorizationHeader) {
      return {
        authenticated: false,
        error: { code: 'MISSING', message: 'Authorization header required' },
      };
    }
    
    if (!authorizationHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        error: { code: 'MALFORMED', message: 'Invalid authorization header format' },
      };
    }
    
    const token = authorizationHeader.slice(7);
    const result = this.tokenService.verifyToken(token);
    
    if (!result.valid) {
      return {
        authenticated: false,
        error: result.error,
      };
    }
    
    // Build request context
    const context: RequestContext = {
      requestId: createRequestId(),
      correlationId: createCorrelationId(),
      timestamp: createTimestamp(),
      startTime: Date.now(),
      ip: '127.0.0.1',
      userAgent: 'vitest/1.0',
      user: result.user,
      isAuthenticated: true,
      isService: false,
      isAnonymous: false,
    };
    
    return {
      authenticated: true,
      user: result.user,
      context,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Auth Flow Integration', () => {
  let tokenService: MockTokenService;
  let authMiddleware: MockAuthMiddleware;
  
  beforeEach(() => {
    tokenService = new MockTokenService();
    authMiddleware = new MockAuthMiddleware(tokenService);
    resetMockRedis();
  });
  
  afterEach(() => {
    tokenService.reset();
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Token Generation
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Token Generation', () => {
    it('generates valid token for free user', () => {
      const user = createFreeUser();
      const token = tokenService.generateToken(user);
      
      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
      
      const result = tokenService.verifyToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.user.id).toBe(user.id);
        expect(result.user.tier).toBe('free');
      }
    });
    
    it('generates valid token for pro user', () => {
      const user = createProUser();
      const token = tokenService.generateToken(user);
      
      const result = tokenService.verifyToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.user.tier).toBe('pro');
        expect(result.user.permissions).toContain('advanced_features');
      }
    });
    
    it('generates valid token for admin user', () => {
      const user = createAdminUser();
      const token = tokenService.generateToken(user);
      
      const result = tokenService.verifyToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.user.roles).toContain('admin');
      }
    });
    
    it('includes email in token payload', () => {
      const user = createTestUser({ email: 'test@example.com' });
      const token = tokenService.generateToken(user);
      
      const result = tokenService.verifyToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.email).toBe('test@example.com');
      }
    });
    
    it('respects custom expiry time', () => {
      const user = createTestUser();
      const token = tokenService.generateToken(user, 60); // 60 seconds
      
      const result = tokenService.verifyToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        const expiresIn = result.payload.exp - result.payload.iat;
        expect(expiresIn).toBe(60);
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Token Verification
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Token Verification', () => {
    it('verifies valid token', () => {
      const user = TEST_USERS.alice;
      const token = tokenService.generateToken(user);
      
      const result = tokenService.verifyToken(token);
      
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.user.id).toBe(user.id);
      }
    });
    
    it('rejects expired token', () => {
      const user = createTestUser();
      const token = tokenService.generateExpiredToken(user);
      
      const result = tokenService.verifyToken(token);
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('EXPIRED');
      }
    });
    
    it('rejects malformed token', () => {
      const result = tokenService.verifyToken('not-a-valid-token');
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('MALFORMED');
      }
    });
    
    it('rejects token with invalid signature', () => {
      const user = createTestUser();
      const token = tokenService.generateToken(user);
      
      // Tamper with the signature
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalid-signature`;
      
      const result = tokenService.verifyToken(tamperedToken);
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('INVALID_SIGNATURE');
      }
    });
    
    it('rejects empty token', () => {
      const result = tokenService.verifyToken('');
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('MISSING');
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Token Revocation
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Token Revocation', () => {
    it('revokes token successfully', () => {
      const user = createTestUser();
      const token = tokenService.generateToken(user);
      
      // Token is valid before revocation
      expect(tokenService.verifyToken(token).valid).toBe(true);
      
      // Revoke
      tokenService.revokeToken(token);
      
      // Token is invalid after revocation
      const result = tokenService.verifyToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('REVOKED');
      }
    });
    
    it('tracks revoked tokens', () => {
      const user = createTestUser();
      const token = tokenService.generateToken(user);
      
      expect(tokenService.isRevoked(token)).toBe(false);
      
      tokenService.revokeToken(token);
      
      expect(tokenService.isRevoked(token)).toBe(true);
    });
    
    it('other tokens remain valid after one is revoked', () => {
      const user = createTestUser();
      const token1 = tokenService.generateToken(user);
      const token2 = tokenService.generateToken(user);
      
      tokenService.revokeToken(token1);
      
      expect(tokenService.verifyToken(token1).valid).toBe(false);
      expect(tokenService.verifyToken(token2).valid).toBe(true);
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Auth Middleware
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Auth Middleware', () => {
    it('authenticates valid Bearer token', () => {
      const user = createTestUser();
      const token = tokenService.generateToken(user);
      
      const result = authMiddleware.authenticate(`Bearer ${token}`);
      
      expect(result.authenticated).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user!.id).toBe(user.id);
      expect(result.context).toBeDefined();
      expect(result.context!.isAuthenticated).toBe(true);
    });
    
    it('rejects missing Authorization header', () => {
      const result = authMiddleware.authenticate(undefined);
      
      expect(result.authenticated).toBe(false);
      expect(result.error?.code).toBe('MISSING');
    });
    
    it('rejects non-Bearer authorization', () => {
      const result = authMiddleware.authenticate('Basic dXNlcjpwYXNz');
      
      expect(result.authenticated).toBe(false);
      expect(result.error?.code).toBe('MALFORMED');
    });
    
    it('rejects expired token', () => {
      const user = createTestUser();
      const token = tokenService.generateExpiredToken(user);
      
      const result = authMiddleware.authenticate(`Bearer ${token}`);
      
      expect(result.authenticated).toBe(false);
      expect(result.error?.code).toBe('EXPIRED');
    });
    
    it('rejects revoked token', () => {
      const user = createTestUser();
      const token = tokenService.generateToken(user);
      tokenService.revokeToken(token);
      
      const result = authMiddleware.authenticate(`Bearer ${token}`);
      
      expect(result.authenticated).toBe(false);
      expect(result.error?.code).toBe('REVOKED');
    });
    
    it('creates request context with user info', () => {
      const user = createTestUser({ email: 'context-test@example.com' });
      const token = tokenService.generateToken(user);
      
      const result = authMiddleware.authenticate(`Bearer ${token}`);
      
      expect(result.authenticated).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context!.user).toBeDefined();
      expect(result.context!.user!.email).toBe('context-test@example.com');
      expect(result.context!.requestId).toBeDefined();
      expect(result.context!.correlationId).toBeDefined();
      expect(result.context!.isAnonymous).toBe(false);
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Protected Route Simulation
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Protected Route Access', () => {
    /**
     * Simulate a protected route handler.
     */
    function protectedRouteHandler(
      authHeader?: string
    ): { status: number; body: unknown } {
      const authResult = authMiddleware.authenticate(authHeader);
      
      if (!authResult.authenticated) {
        return {
          status: 401,
          body: {
            error: 'Unauthorized',
            code: authResult.error?.code,
            message: authResult.error?.message,
          },
        };
      }
      
      return {
        status: 200,
        body: {
          message: 'Access granted',
          user: {
            id: authResult.user!.id,
            tier: authResult.user!.tier,
          },
        },
      };
    }
    
    it('grants access with valid token', () => {
      const user = createTestUser();
      const token = tokenService.generateToken(user);
      
      const response = protectedRouteHandler(`Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect((response.body as { message: string }).message).toBe('Access granted');
    });
    
    it('returns 401 without token', () => {
      const response = protectedRouteHandler(undefined);
      
      expect(response.status).toBe(401);
      expect((response.body as { error: string }).error).toBe('Unauthorized');
    });
    
    it('returns 401 with expired token', () => {
      const user = createTestUser();
      const token = tokenService.generateExpiredToken(user);
      
      const response = protectedRouteHandler(`Bearer ${token}`);
      
      expect(response.status).toBe(401);
      expect((response.body as { code: string }).code).toBe('EXPIRED');
    });
    
    it('returns 401 with invalid token', () => {
      const response = protectedRouteHandler('Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // User Tier Verification
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('User Tier Verification', () => {
    it('free user has basic permissions', () => {
      const user = createFreeUser();
      const token = tokenService.generateToken(user);
      
      const result = tokenService.verifyToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.user.permissions).toContain('goals:read');
        expect(result.user.permissions).toContain('goals:write');
        expect(result.user.permissions).not.toContain('advanced_features');
      }
    });
    
    it('pro user has advanced permissions', () => {
      const user = createProUser();
      const token = tokenService.generateToken(user);
      
      const result = tokenService.verifyToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.user.permissions).toContain('advanced_features');
        expect(result.user.permissions).toContain('export:read');
      }
    });
    
    it('enterprise user has team permissions', () => {
      const user = TEST_USERS.carol; // Enterprise user
      const token = tokenService.generateToken(user);
      
      const result = tokenService.verifyToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.user.permissions).toContain('team:read');
        expect(result.user.permissions).toContain('team:write');
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Request Context
  // ─────────────────────────────────────────────────────────────────────────────
  
  describe('Request Context', () => {
    it('creates context with all required fields', () => {
      const user = createTestUser();
      const token = tokenService.generateToken(user);
      
      const result = authMiddleware.authenticate(`Bearer ${token}`);
      
      expect(result.context).toBeDefined();
      const ctx = result.context!;
      
      expect(ctx.requestId).toBeDefined();
      expect(ctx.correlationId).toBeDefined();
      expect(ctx.timestamp).toBeDefined();
      expect(ctx.startTime).toBeGreaterThan(0);
      expect(ctx.ip).toBe('127.0.0.1');
      expect(ctx.userAgent).toBe('vitest/1.0');
      expect(ctx.isAuthenticated).toBe(true);
      expect(ctx.isService).toBe(false);
      expect(ctx.isAnonymous).toBe(false);
    });
    
    it('context user matches token user', () => {
      const user = createTestUser({
        id: TEST_USER_IDS.alice,
        email: 'alice@example.com',
        tier: 'pro',
      });
      const token = tokenService.generateToken(user);
      
      const result = authMiddleware.authenticate(`Bearer ${token}`);
      
      expect(result.context!.user!.id).toBe(TEST_USER_IDS.alice);
      expect(result.context!.user!.email).toBe('alice@example.com');
      expect(result.context!.user!.tier).toBe('pro');
    });
  });
});
