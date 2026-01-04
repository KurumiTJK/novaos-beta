// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE — Express Authentication Middleware
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response, NextFunction } from 'express';
import type {
  AuthenticatedRequest,
  AuthMiddlewareOptions,
  AuthEvent,
  AuthEventType,
  AuthenticatedUser,
  UserTier,
} from './types.js';
import {
  verifyToken,
  extractBearerToken,
  extractApiKey,
  isUserTokensRevoked,
} from './tokens.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────────

type AuthEventHandler = (event: AuthEvent) => void;
const eventHandlers: AuthEventHandler[] = [];

export function onAuthEvent(handler: AuthEventHandler): void {
  eventHandlers.push(handler);
}

export function clearAuthEventHandlers(): void {
  eventHandlers.length = 0;
}

function emitAuthEvent(
  type: AuthEventType,
  req: AuthenticatedRequest,
  details?: Record<string, unknown>
): void {
  const event: AuthEvent = {
    type,
    userId: req.userId,
    timestamp: Date.now(),
    ip: req.ip ?? req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    details,
  };
  
  for (const handler of eventHandlers) {
    try {
      handler(event);
    } catch (error) {
      console.error('[AUTH] Event handler error:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────────

export const AuthErrorCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  TOKEN_MALFORMED: 'TOKEN_MALFORMED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Authentication middleware.
 * 
 * @example
 * // Require authentication
 * router.get('/protected', authenticate(), handler);
 * 
 * // Optional authentication
 * router.get('/public', authenticate({ required: false }), handler);
 * 
 * // Skip certain paths
 * app.use(authenticate({ skipPaths: ['/health', '/version'] }));
 */
export function authenticate(options: AuthMiddlewareOptions = {}) {
  const {
    required = true,
    allowApiKey = true,
    skipPaths = [],
  } = options;
  
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Check if path should be skipped
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // Extract token
    const bearerToken = extractBearerToken(req.headers.authorization);
    const apiKey = allowApiKey ? extractApiKey(req.headers['x-api-key'] as string) : null;
    const token = bearerToken ?? apiKey;
    
    // No token provided
    if (!token) {
      if (required) {
        emitAuthEvent('login_failure', req, { reason: 'no_token' });
        res.status(401).json({
          error: 'Authentication required',
          code: AuthErrorCode.AUTH_REQUIRED,
        });
        return;
      }
      
      // Set anonymous user
      req.user = createAnonymousUser();
      req.userId = 'anonymous';
      return next();
    }
    
    // Verify token
    const result = await verifyToken(token);
    
    if (!result.valid) {
      emitAuthEvent('login_failure', req, { reason: result.error });
      
      const statusCode = result.error === 'TOKEN_EXPIRED' ? 401 : 401;
      const errorMessages: Record<string, string> = {
        TOKEN_EXPIRED: 'Token has expired',
        TOKEN_REVOKED: 'Token has been revoked',
        TOKEN_MALFORMED: 'Invalid token format',
        SIGNATURE_INVALID: 'Invalid token signature',
        TOKEN_INVALID: 'Invalid token',
      };
      
      res.status(statusCode).json({
        error: errorMessages[result.error] ?? 'Invalid token',
        code: result.error,
      });
      return;
    }
    
    // Check if user's tokens are revoked
    const { user } = result;
    const isRevoked = await isUserTokensRevoked(user.userId, user.issuedAt);
    if (isRevoked) {
      emitAuthEvent('token_invalid', req, { reason: 'user_tokens_revoked' });
      res.status(401).json({
        error: 'Session has been invalidated',
        code: AuthErrorCode.TOKEN_REVOKED,
      });
      return;
    }
    
    // Set user on request
    req.user = user;
    req.userId = user.userId;
    
    emitAuthEvent('login_success', req);
    next();
  };
}

/**
 * Shorthand for required authentication.
 */
export function requireAuth() {
  return authenticate({ required: true });
}

/**
 * Shorthand for optional authentication.
 */
export function optionalAuth() {
  return authenticate({ required: false });
}

// ─────────────────────────────────────────────────────────────────────────────────
// PERMISSION CHECKING MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Require specific permission(s).
 * 
 * @example
 * router.post('/goals', authenticate(), requirePermission('goal:create'), handler);
 */
export function requirePermission(...permissions: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: AuthErrorCode.AUTH_REQUIRED,
      });
      return;
    }
    
    const hasAllPermissions = permissions.every(
      perm => user.permissions.includes(perm) || user.permissions.includes('admin:*')
    );
    
    if (!hasAllPermissions) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: AuthErrorCode.INSUFFICIENT_PERMISSIONS,
        required: permissions,
      });
      return;
    }
    
    next();
  };
}

/**
 * Require any of the specified permissions.
 */
export function requireAnyPermission(...permissions: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: AuthErrorCode.AUTH_REQUIRED,
      });
      return;
    }
    
    const hasAnyPermission = permissions.some(
      perm => user.permissions.includes(perm) || user.permissions.includes('admin:*')
    );
    
    if (!hasAnyPermission) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: AuthErrorCode.INSUFFICIENT_PERMISSIONS,
        requiredAny: permissions,
      });
      return;
    }
    
    next();
  };
}

/**
 * Require admin role.
 */
export function requireAdmin() {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: AuthErrorCode.AUTH_REQUIRED,
      });
      return;
    }
    
    if (user.role !== 'admin') {
      res.status(403).json({
        error: 'Admin access required',
        code: AuthErrorCode.INSUFFICIENT_PERMISSIONS,
      });
      return;
    }
    
    next();
  };
}

/**
 * Require specific tier or higher.
 */
export function requireTier(minTier: UserTier) {
  const tierOrder: UserTier[] = ['free', 'pro', 'enterprise'];
  
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: AuthErrorCode.AUTH_REQUIRED,
      });
      return;
    }
    
    const userTierIndex = tierOrder.indexOf(user.tier);
    const requiredTierIndex = tierOrder.indexOf(minTier);
    
    if (userTierIndex < requiredTierIndex) {
      res.status(403).json({
        error: `${minTier} tier or higher required`,
        code: AuthErrorCode.INSUFFICIENT_PERMISSIONS,
        currentTier: user.tier,
        requiredTier: minTier,
      });
      return;
    }
    
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

function createAnonymousUser(): AuthenticatedUser {
  return {
    userId: 'anonymous',
    tier: 'free',
    role: 'user',
    permissions: ['chat:send'],
    issuedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
}

/**
 * Get the authenticated user from request, or throw.
 */
export function getAuthenticatedUser(req: AuthenticatedRequest): AuthenticatedUser {
  if (!req.user || req.user.userId === 'anonymous') {
    throw new Error('User not authenticated');
  }
  return req.user;
}

/**
 * Get user ID from request, or 'anonymous'.
 */
export function getUserId(req: AuthenticatedRequest): string {
  return req.userId ?? req.user?.userId ?? 'anonymous';
}

/**
 * Check if request is from authenticated user.
 */
export function isAuthenticated(req: AuthenticatedRequest): boolean {
  return !!req.user && req.user.userId !== 'anonymous';
}
