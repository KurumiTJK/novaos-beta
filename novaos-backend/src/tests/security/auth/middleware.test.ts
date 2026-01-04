// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE TESTS — Express Authentication Middleware
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';
import {
  authenticate,
  requireAuth,
  optionalAuth,
  requirePermission,
  requireAnyPermission,
  requireAdmin,
  requireTier,
  onAuthEvent,
  clearAuthEventHandlers,
  getAuthenticatedUser,
  getUserId,
  isAuthenticated,
  AuthErrorCode,
} from '../../../security/auth/middleware.js';
import {
  initTokenConfig,
  setRevocationStore,
  generateAccessToken,
  revokeAllUserTokens,
} from '../../../security/auth/tokens.js';
import type { KeyValueStore } from '../../../storage/index.js';
import type { AuthenticatedRequest } from '../../../security/auth/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK STORE
// ─────────────────────────────────────────────────────────────────────────────────

function createMockStore(): KeyValueStore {
  const data = new Map<string, { value: string; expiresAt?: number }>();
  
  return {
    get: vi.fn(async (key: string) => {
      const entry = data.get(key);
      if (!entry) return null;
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: string, ttl?: number) => {
      data.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      });
    }),
    delete: vi.fn(async () => true),
    exists: vi.fn(async (key: string) => data.has(key)),
  } as unknown as KeyValueStore;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

let app: Application;
let mockStore: KeyValueStore;

beforeEach(() => {
  app = express();
  mockStore = createMockStore();
  
  initTokenConfig({
    secret: 'test-auth-secret',
    issuer: 'test',
    audience: 'test',
  });
  setRevocationStore(mockStore);
  clearAuthEventHandlers();
});

afterEach(() => {
  clearAuthEventHandlers();
});

// ─────────────────────────────────────────────────────────────────────────────────
// AuthErrorCode TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AuthErrorCode', () => {
  it('should have AUTH_REQUIRED code', () => {
    expect(AuthErrorCode.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
  });

  it('should have TOKEN_INVALID code', () => {
    expect(AuthErrorCode.TOKEN_INVALID).toBe('TOKEN_INVALID');
  });

  it('should have TOKEN_EXPIRED code', () => {
    expect(AuthErrorCode.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
  });

  it('should have TOKEN_REVOKED code', () => {
    expect(AuthErrorCode.TOKEN_REVOKED).toBe('TOKEN_REVOKED');
  });

  it('should have TOKEN_MALFORMED code', () => {
    expect(AuthErrorCode.TOKEN_MALFORMED).toBe('TOKEN_MALFORMED');
  });

  it('should have INSUFFICIENT_PERMISSIONS code', () => {
    expect(AuthErrorCode.INSUFFICIENT_PERMISSIONS).toBe('INSUFFICIENT_PERMISSIONS');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// authenticate MIDDLEWARE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('authenticate()', () => {
  describe('Required Authentication (default)', () => {
    it('should allow request with valid token', async () => {
      const { token } = generateAccessToken('user-123', 'pro');
      
      app.use(authenticate());
      app.get('/test', (req: any, res) => {
        res.json({ userId: req.userId });
      });
      
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.userId).toBe('user-123');
    });

    it('should reject request without token', async () => {
      app.use(authenticate());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/test');
      
      expect(response.status).toBe(401);
      expect(response.body.code).toBe(AuthErrorCode.AUTH_REQUIRED);
    });

    it('should reject invalid token', async () => {
      app.use(authenticate());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });

    it('should set user on request', async () => {
      const { token } = generateAccessToken('user-456', 'enterprise', {
        email: 'test@example.com',
        role: 'admin',
      });
      
      let capturedUser: any;
      
      app.use(authenticate());
      app.get('/test', (req: any, res) => {
        capturedUser = req.user;
        res.json({ ok: true });
      });
      
      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);
      
      expect(capturedUser).toBeDefined();
      expect(capturedUser.userId).toBe('user-456');
      expect(capturedUser.tier).toBe('enterprise');
      expect(capturedUser.email).toBe('test@example.com');
      expect(capturedUser.role).toBe('admin');
    });
  });

  describe('Optional Authentication', () => {
    it('should allow request without token', async () => {
      app.use(authenticate({ required: false }));
      app.get('/test', (req: any, res) => {
        res.json({ userId: req.userId });
      });
      
      const response = await request(app).get('/test');
      
      expect(response.status).toBe(200);
      expect(response.body.userId).toBe('anonymous');
    });

    it('should set anonymous user when no token', async () => {
      let capturedUser: any;
      
      app.use(authenticate({ required: false }));
      app.get('/test', (req: any, res) => {
        capturedUser = req.user;
        res.json({ ok: true });
      });
      
      await request(app).get('/test');
      
      expect(capturedUser).toBeDefined();
      expect(capturedUser.userId).toBe('anonymous');
      expect(capturedUser.tier).toBe('free');
    });

    it('should set real user when token provided', async () => {
      const { token } = generateAccessToken('user-123', 'pro');
      
      app.use(authenticate({ required: false }));
      app.get('/test', (req: any, res) => {
        res.json({ userId: req.userId });
      });
      
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.userId).toBe('user-123');
    });
  });

  describe('API Key Authentication', () => {
    it('should accept API key by default', async () => {
      const { token } = generateAccessToken('user-123', 'enterprise');
      const apiKey = `nova_${token}`;
      
      app.use(authenticate());
      app.get('/test', (req: any, res) => {
        res.json({ userId: req.userId });
      });
      
      const response = await request(app)
        .get('/test')
        .set('x-api-key', apiKey);
      
      expect(response.status).toBe(200);
    });

    it('should reject API key when disabled', async () => {
      const { token } = generateAccessToken('user-123', 'enterprise');
      const apiKey = `nova_${token}`;
      
      app.use(authenticate({ allowApiKey: false }));
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app)
        .get('/test')
        .set('x-api-key', apiKey);
      
      expect(response.status).toBe(401);
    });
  });

  describe('Skip Paths', () => {
    it('should skip configured paths', async () => {
      app.use(authenticate({ skipPaths: ['/health', '/ready'] }));
      app.get('/health', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
    });

    it('should skip paths starting with prefix', async () => {
      app.use(authenticate({ skipPaths: ['/public'] }));
      app.get('/public/resource', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/public/resource');
      
      expect(response.status).toBe(200);
    });

    it('should not skip non-matching paths', async () => {
      app.use(authenticate({ skipPaths: ['/health'] }));
      app.get('/api/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app).get('/api/test');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Token Revocation', () => {
    it('should reject token when user tokens are revoked', async () => {
      const { token } = generateAccessToken('user-123', 'pro');
      
      // Small delay then revoke
      await new Promise(r => setTimeout(r, 10));
      await revokeAllUserTokens('user-123');
      
      app.use(authenticate());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(401);
      expect(response.body.code).toBe(AuthErrorCode.TOKEN_REVOKED);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SHORTHAND MIDDLEWARE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('requireAuth()', () => {
  it('should require authentication', async () => {
    app.use(requireAuth());
    app.get('/test', (req, res) => res.json({ ok: true }));
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(401);
  });

  it('should allow authenticated requests', async () => {
    const { token } = generateAccessToken('user-123', 'free');
    
    app.use(requireAuth());
    app.get('/test', (req, res) => res.json({ ok: true }));
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });
});

describe('optionalAuth()', () => {
  it('should allow unauthenticated requests', async () => {
    app.use(optionalAuth());
    app.get('/test', (req: any, res) => res.json({ userId: req.userId }));
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(200);
    expect(response.body.userId).toBe('anonymous');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PERMISSION MIDDLEWARE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('requirePermission()', () => {
  it('should allow user with required permission', async () => {
    const { token } = generateAccessToken('user-123', 'pro', {
      permissions: ['goal:create'],
    });
    
    app.use(authenticate());
    app.get('/test', requirePermission('goal:create'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });

  it('should reject user without permission', async () => {
    const { token } = generateAccessToken('user-123', 'free', {
      permissions: ['chat:send'],
    });
    
    app.use(authenticate());
    app.get('/test', requirePermission('admin:read'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(AuthErrorCode.INSUFFICIENT_PERMISSIONS);
  });

  it('should require all permissions', async () => {
    const { token } = generateAccessToken('user-123', 'pro', {
      permissions: ['goal:create'],
    });
    
    app.use(authenticate());
    app.get('/test', requirePermission('goal:create', 'goal:delete'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
  });

  it('should allow admin:* to bypass checks', async () => {
    const { token } = generateAccessToken('user-123', 'enterprise', {
      permissions: ['admin:*'],
    });
    
    app.use(authenticate());
    app.get('/test', requirePermission('any:permission'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });

  it('should reject unauthenticated users', async () => {
    app.get('/test', requirePermission('goal:create'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(401);
  });
});

describe('requireAnyPermission()', () => {
  it('should allow user with any of the permissions', async () => {
    const { token } = generateAccessToken('user-123', 'pro', {
      permissions: ['goal:read'],
    });
    
    app.use(authenticate());
    app.get('/test', requireAnyPermission('goal:create', 'goal:read'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });

  it('should reject user with none of the permissions', async () => {
    const { token } = generateAccessToken('user-123', 'free', {
      permissions: ['chat:send'],
    });
    
    app.use(authenticate());
    app.get('/test', requireAnyPermission('goal:create', 'admin:read'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ROLE MIDDLEWARE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('requireAdmin()', () => {
  it('should allow admin role', async () => {
    const { token } = generateAccessToken('user-123', 'enterprise', {
      role: 'admin',
    });
    
    app.use(authenticate());
    app.get('/test', requireAdmin(), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });

  it('should reject non-admin role', async () => {
    const { token } = generateAccessToken('user-123', 'pro', {
      role: 'user',
    });
    
    app.use(authenticate());
    app.get('/test', requireAdmin(), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Admin');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TIER MIDDLEWARE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('requireTier()', () => {
  it('should allow user with required tier', async () => {
    const { token } = generateAccessToken('user-123', 'pro');
    
    app.use(authenticate());
    app.get('/test', requireTier('pro'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });

  it('should allow higher tier', async () => {
    const { token } = generateAccessToken('user-123', 'enterprise');
    
    app.use(authenticate());
    app.get('/test', requireTier('pro'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });

  it('should reject lower tier', async () => {
    const { token } = generateAccessToken('user-123', 'free');
    
    app.use(authenticate());
    app.get('/test', requireTier('pro'), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
    expect(response.body.currentTier).toBe('free');
    expect(response.body.requiredTier).toBe('pro');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EVENT HANDLER TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Event Handlers', () => {
  describe('onAuthEvent()', () => {
    it('should emit login_success event', async () => {
      const handler = vi.fn();
      onAuthEvent(handler);
      
      const { token } = generateAccessToken('user-123', 'pro');
      
      app.use(authenticate());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'login_success',
          userId: 'user-123',
        })
      );
    });

    it('should emit login_failure event', async () => {
      const handler = vi.fn();
      onAuthEvent(handler);
      
      app.use(authenticate());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'login_failure',
        })
      );
    });
  });

  describe('clearAuthEventHandlers()', () => {
    it('should clear all handlers', async () => {
      const handler = vi.fn();
      onAuthEvent(handler);
      clearAuthEventHandlers();
      
      const { token } = generateAccessToken('user-123', 'pro');
      
      app.use(authenticate());
      app.get('/test', (req, res) => res.json({ ok: true }));
      
      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Helper Functions', () => {
  describe('getAuthenticatedUser()', () => {
    it('should return user from request', async () => {
      const { token } = generateAccessToken('user-123', 'pro');
      
      let user: any;
      
      app.use(authenticate());
      app.get('/test', (req: any, res) => {
        user = getAuthenticatedUser(req);
        res.json({ ok: true });
      });
      
      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);
      
      expect(user.userId).toBe('user-123');
    });

    it('should throw for anonymous user', () => {
      const req = {
        user: { userId: 'anonymous', tier: 'free', role: 'user', permissions: [] },
      } as AuthenticatedRequest;
      
      expect(() => getAuthenticatedUser(req)).toThrow('User not authenticated');
    });

    it('should throw when no user', () => {
      const req = {} as AuthenticatedRequest;
      
      expect(() => getAuthenticatedUser(req)).toThrow('User not authenticated');
    });
  });

  describe('getUserId()', () => {
    it('should return userId from request', () => {
      const req = { userId: 'user-123' } as AuthenticatedRequest;
      
      expect(getUserId(req)).toBe('user-123');
    });

    it('should return userId from user object', () => {
      const req = {
        user: { userId: 'user-456' },
      } as unknown as AuthenticatedRequest;
      
      expect(getUserId(req)).toBe('user-456');
    });

    it('should return anonymous when no user', () => {
      const req = {} as AuthenticatedRequest;
      
      expect(getUserId(req)).toBe('anonymous');
    });
  });

  describe('isAuthenticated()', () => {
    it('should return true for authenticated user', () => {
      const req = {
        user: { userId: 'user-123' },
      } as unknown as AuthenticatedRequest;
      
      expect(isAuthenticated(req)).toBe(true);
    });

    it('should return false for anonymous user', () => {
      const req = {
        user: { userId: 'anonymous' },
      } as unknown as AuthenticatedRequest;
      
      expect(isAuthenticated(req)).toBe(false);
    });

    it('should return false when no user', () => {
      const req = {} as AuthenticatedRequest;
      
      expect(isAuthenticated(req)).toBe(false);
    });
  });
});
