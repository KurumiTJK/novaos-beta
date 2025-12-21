// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE — JWT Verification & Context Building
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response, NextFunction } from 'express';
import {
  createRequestId,
  createCorrelationId,
  createTimestamp,
  type UserId,
} from '../../types/branded.js';
import { getLogger } from '../../logging/index.js';
import {
  type SecureRequest,
  type RequestContext,
  type AuthenticatedUser,
  type AuthEvent,
  type TokenError,
  createAnonymousContext,
  createUserContext,
  fromLegacyPayload,
  type LegacyUserPayload,
} from './types.js';
import {
  verifyToken,
  extractBearerToken,
  extractApiKey,
  areUserTokensRevoked,
} from './tokens.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'auth' });

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH EVENT EMITTER (for audit logging)
// ─────────────────────────────────────────────────────────────────────────────────

type AuthEventHandler = (event: AuthEvent) => void | Promise<void>;

const eventHandlers: AuthEventHandler[] = [];

/**
 * Register an auth event handler (for audit logging).
 */
export function onAuthEvent(handler: AuthEventHandler): void {
  eventHandlers.push(handler);
}

/**
 * Emit an auth event to all handlers.
 */
async function emitAuthEvent(event: AuthEvent): Promise<void> {
  for (const handler of eventHandlers) {
    try {
      await handler(event);
    } catch (error) {
      logger.error('Auth event handler error', error instanceof Error ? error : undefined);
    }
  }
}

/**
 * Clear all event handlers (for testing).
 * @internal
 */
export function clearAuthEventHandlers(): void {
  eventHandlers.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT BUILDER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Build request context from Express request.
 */
function buildRequestContext(req: SecureRequest): Omit<RequestContext, 'user' | 'service' | 'isAuthenticated' | 'isService' | 'isAnonymous'> {
  // Use existing requestId from request middleware, or generate new one
  const requestId = createRequestId(req.requestId ?? req.headers['x-request-id'] as string);
  
  // Correlation ID for distributed tracing (propagate from header or use requestId)
  const correlationId = createCorrelationId(
    req.headers['x-correlation-id'] as string ?? requestId
  );

  return {
    requestId,
    correlationId,
    timestamp: createTimestamp(),
    startTime: req.startTime ?? Date.now(),
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
  };
}

/**
 * Extract client IP, handling proxies.
 */
function getClientIp(req: SecureRequest): string {
  // Trust X-Forwarded-For if behind proxy (configured in Express)
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    // Take first IP in chain (original client)
    const first = forwarded.split(',')[0];
    return first?.trim() ?? 'unknown';
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(',')[0];
    return first?.trim() ?? 'unknown';
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR RESPONSES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Authentication error codes for API responses.
 */
export const AuthErrorCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  TOKEN_MALFORMED: 'TOKEN_MALFORMED',
  USER_BLOCKED: 'USER_BLOCKED',
} as const;

export type AuthErrorCode = typeof AuthErrorCode[keyof typeof AuthErrorCode];

/**
 * Map internal token error to API error code.
 * Sanitizes internal details for external responses.
 */
function tokenErrorToApiError(error: TokenError): { code: AuthErrorCode; message: string } {
  switch (error.code) {
    case 'EXPIRED':
      return { code: 'TOKEN_EXPIRED', message: 'Token has expired' };
    case 'REVOKED':
      return { code: 'TOKEN_REVOKED', message: 'Token has been revoked' };
    case 'INVALID_SIGNATURE':
    case 'INVALID_ISSUER':
    case 'INVALID_AUDIENCE':
      return { code: 'TOKEN_INVALID', message: 'Invalid token' };
    case 'MALFORMED':
      return { code: 'TOKEN_MALFORMED', message: 'Malformed token' };
    case 'MISSING':
      return { code: 'AUTH_REQUIRED', message: 'Authentication required' };
    default:
      return { code: 'TOKEN_INVALID', message: 'Invalid token' };
  }
}

/**
 * Send 401 response with sanitized error.
 */
function sendAuthError(
  res: Response,
  code: AuthErrorCode,
  message: string
): void {
  res.status(401).json({
    error: message,
    code,
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for authentication middleware.
 */
export interface AuthMiddlewareOptions {
  /**
   * Whether authentication is required.
   * If false, unauthenticated requests proceed with anonymous context.
   */
  readonly required?: boolean;

  /**
   * Custom error message for missing auth.
   */
  readonly missingAuthMessage?: string;

  /**
   * Skip authentication for specific paths.
   */
  readonly skipPaths?: readonly string[];

  /**
   * Check if user tokens are globally revoked.
   */
  readonly checkUserRevocation?: boolean;
}

/**
 * Create authentication middleware.
 * 
 * @example
 * // Required auth
 * app.use('/api', authenticate({ required: true }));
 * 
 * // Optional auth (anonymous allowed)
 * app.use('/public', authenticate({ required: false }));
 */
export function authenticate(options: AuthMiddlewareOptions = {}) {
  const {
    required = true,
    missingAuthMessage = 'Authentication required',
    skipPaths = [],
    checkUserRevocation = true,
  } = options;

  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    const contextBase = buildRequestContext(req);

    // Check skip paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      req.context = createAnonymousContext(contextBase);
      req.isAuthenticated = false;
      next();
      return;
    }

    // Extract token from headers
    const bearerToken = extractBearerToken(req.headers.authorization);
    const apiKey = extractApiKey(req.headers['x-api-key'] as string);
    const token = bearerToken ?? apiKey;

    // No token provided
    if (!token) {
      if (required) {
        await emitAuthEvent({
          type: 'login_failure',
          timestamp: contextBase.timestamp,
          requestId: contextBase.requestId,
          ip: contextBase.ip,
          userAgent: contextBase.userAgent,
          details: { reason: 'missing_token' },
        });

        sendAuthError(res, 'AUTH_REQUIRED', missingAuthMessage);
        return;
      }

      // Anonymous access allowed
      req.context = createAnonymousContext(contextBase);
      req.isAuthenticated = false;
      req.userId = 'anonymous';
      next();
      return;
    }

    // Verify token
    const verification = await verifyToken(token);

    if (!verification.valid) {
      const apiError = tokenErrorToApiError(verification.error);

      await emitAuthEvent({
        type: 'token_invalid',
        timestamp: contextBase.timestamp,
        requestId: contextBase.requestId,
        ip: contextBase.ip,
        userAgent: contextBase.userAgent,
        details: { 
          errorCode: verification.error.code,
          // Don't log the actual token
        },
      });

      logger.warn('Authentication failed', {
        errorCode: verification.error.code,
        ip: contextBase.ip,
        requestId: contextBase.requestId as string,
      });

      sendAuthError(res, apiError.code, apiError.message);
      return;
    }

    const user = verification.user;

    // Check if all user tokens are revoked
    if (checkUserRevocation) {
      const userRevoked = await areUserTokensRevoked(user.id);
      if (userRevoked) {
        await emitAuthEvent({
          type: 'token_invalid',
          timestamp: contextBase.timestamp,
          requestId: contextBase.requestId,
          userId: user.id,
          ip: contextBase.ip,
          userAgent: contextBase.userAgent,
          details: { reason: 'user_tokens_revoked' },
        });

        sendAuthError(res, 'TOKEN_REVOKED', 'Session has been invalidated');
        return;
      }
    }

    // Build authenticated context
    req.context = createUserContext(contextBase, user);
    req.user = user;
    req.userId = user.id as string;
    req.isAuthenticated = true;

    // Log successful authentication (debug level to reduce noise)
    logger.debug('Authentication successful', {
      userId: user.id as string,
      tier: user.tier,
      requestId: contextBase.requestId as string,
    });

    next();
  };
}

/**
 * Shorthand for required authentication.
 */
export function requireAuth(): ReturnType<typeof authenticate> {
  return authenticate({ required: true });
}

/**
 * Shorthand for optional authentication.
 */
export function optionalAuth(): ReturnType<typeof authenticate> {
  return authenticate({ required: false });
}

// ─────────────────────────────────────────────────────────────────────────────────
// LEGACY COMPATIBILITY MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Middleware that provides backward compatibility with existing auth module.
 * Converts legacy UserPayload to AuthenticatedUser format.
 * 
 * Use this as a bridge during migration from src/auth to src/security.
 */
export function legacyAuthBridge() {
  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    // Check if legacy auth has already attached a user
    const legacyUser = (req as any).user as LegacyUserPayload | undefined;
    
    if (legacyUser && typeof legacyUser.userId === 'string') {
      // Convert to new format
      const user = fromLegacyPayload(legacyUser);
      const contextBase = buildRequestContext(req);
      
      req.context = createUserContext(contextBase, user);
      req.user = user;
      req.userId = user.id as string;
      req.isAuthenticated = true;
    } else if (!req.context) {
      // No auth, create anonymous context
      const contextBase = buildRequestContext(req);
      req.context = createAnonymousContext(contextBase);
      req.isAuthenticated = false;
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT MIDDLEWARE (standalone)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Middleware that only builds request context without authentication.
 * Use when you need context but handle auth separately.
 */
export function buildContext() {
  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    if (!req.context) {
      const contextBase = buildRequestContext(req);
      req.context = createAnonymousContext(contextBase);
      req.isAuthenticated = false;
    }
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE AUGMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
      user?: AuthenticatedUser;
      isAuthenticated?: boolean;
    }
  }
}
