// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORIZATION MIDDLEWARE — Access Control for Routes
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response, NextFunction } from 'express';
import type { SecureRequest, AuthenticatedUser } from '../auth/types.js';
import type { UserId } from '../../types/branded.js';
import { getLogger } from '../../logging/index.js';
import {
  type ResourceType,
  type ResourceAction,
  type AuthorizationResult,
  type AuthorizationEvent,
  type AuthorizationDenialReason,
} from './types.js';
import { getOwnershipChecker } from './ownership.js';
import { getPolicyManager, hasPermission, hasRole, canPerform } from './policies.js';
import type { UserRole, Permission } from '../auth/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'authorization' });

// ─────────────────────────────────────────────────────────────────────────────────
// EVENT EMITTER
// ─────────────────────────────────────────────────────────────────────────────────

type AuthorizationEventHandler = (event: AuthorizationEvent) => void | Promise<void>;

const eventHandlers: AuthorizationEventHandler[] = [];

/**
 * Register an authorization event handler (for audit logging).
 */
export function onAuthorizationEvent(handler: AuthorizationEventHandler): void {
  eventHandlers.push(handler);
}

/**
 * Emit an authorization event.
 */
async function emitEvent(event: AuthorizationEvent): Promise<void> {
  for (const handler of eventHandlers) {
    try {
      await handler(event);
    } catch (error) {
      logger.error('Authorization event handler error', error instanceof Error ? error : undefined);
    }
  }
}

/**
 * Clear event handlers (for testing).
 * @internal
 */
export function clearAuthorizationEventHandlers(): void {
  eventHandlers.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR RESPONSES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Authorization error codes.
 */
export const AuthzErrorCode = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_OWNER: 'NOT_OWNER',
  MISSING_PERMISSION: 'MISSING_PERMISSION',
  MISSING_ROLE: 'MISSING_ROLE',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
} as const;

export type AuthzErrorCode = typeof AuthzErrorCode[keyof typeof AuthzErrorCode];

/**
 * Send 403 Forbidden response.
 */
function sendForbidden(res: Response, code: AuthzErrorCode, message: string): void {
  res.status(403).json({
    error: message,
    code,
  });
}

/**
 * Send 401 Unauthorized response.
 */
function sendUnauthorized(res: Response, message: string = 'Authentication required'): void {
  res.status(401).json({
    error: message,
    code: 'NOT_AUTHENTICATED',
  });
}

/**
 * Send 404 Not Found response.
 */
function sendNotFound(res: Response, message: string = 'Resource not found'): void {
  res.status(404).json({
    error: message,
    code: 'RESOURCE_NOT_FOUND',
  });
}

/**
 * Map denial reason to error response.
 */
function handleDenial(
  res: Response,
  reason: AuthorizationDenialReason
): void {
  switch (reason.code) {
    case 'NOT_AUTHENTICATED':
      sendUnauthorized(res, reason.message);
      break;
    case 'RESOURCE_NOT_FOUND':
      sendNotFound(res, reason.message);
      break;
    case 'NOT_OWNER':
      sendForbidden(res, 'NOT_OWNER', 'You do not have access to this resource');
      break;
    case 'MISSING_PERMISSION':
      sendForbidden(res, 'MISSING_PERMISSION', 'Insufficient permissions');
      break;
    case 'MISSING_ROLE':
      sendForbidden(res, 'MISSING_ROLE', 'Insufficient privileges');
      break;
    case 'BLOCKED':
      sendForbidden(res, 'FORBIDDEN', reason.message);
      break;
    default:
      sendForbidden(res, 'FORBIDDEN', 'Access denied');
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUIRE AUTHENTICATED
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Middleware that requires authentication.
 * Use after authenticate() middleware.
 */
export function requireAuthenticated() {
  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated || !req.user) {
      sendUnauthorized(res);
      return;
    }
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUIRE OWNERSHIP
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for ownership middleware.
 */
export interface OwnershipOptions {
  /**
   * Request param containing the resource ID.
   * Default: 'id'
   */
  readonly paramName?: string;

  /**
   * Allow admin to bypass ownership check.
   * Default: true
   */
  readonly allowAdmin?: boolean;

  /**
   * Custom error message.
   */
  readonly errorMessage?: string;
}

/**
 * Middleware that requires the user to own the resource.
 * 
 * @example
 * // Check ownership of goal by :id param
 * router.get('/goals/:id', requireOwnership('goal'));
 * 
 * // Check ownership with custom param
 * router.get('/goals/:goalId/quests', requireOwnership('goal', { paramName: 'goalId' }));
 */
export function requireOwnership(
  resourceType: ResourceType,
  options: OwnershipOptions = {}
) {
  const {
    paramName = 'id',
    allowAdmin = true,
    errorMessage,
  } = options;

  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    // Must be authenticated
    if (!req.isAuthenticated || !req.user) {
      await emitDeniedEvent(req, resourceType, 'NOT_AUTHENTICATED');
      sendUnauthorized(res);
      return;
    }

    const user = req.user;
    const resourceId = req.params[paramName];

    if (!resourceId) {
      logger.warn('Ownership check failed: missing resource ID', {
        paramName,
        resourceType,
        userId: user.id as string,
      });
      sendNotFound(res, `Missing ${resourceType} ID`);
      return;
    }

    // Admin bypass
    if (allowAdmin && hasRole(user, 'admin')) {
      logger.debug('Ownership bypassed for admin', {
        userId: user.id as string,
        resourceType,
        resourceId,
      });
      next();
      return;
    }

    // Check ownership
    const checker = getOwnershipChecker();
    const result = await checker.checkByString(user.id as string, resourceType, resourceId);

    if (!result.allowed) {
      await emitDeniedEvent(req, resourceType, result.reason.code, resourceId);
      
      logger.warn('Ownership check failed', {
        userId: user.id as string,
        resourceType,
        resourceId,
        reason: result.reason.code,
      });

      handleDenial(res, result.reason);
      return;
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUIRE PERMISSION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for permission middleware.
 */
export interface PermissionOptions {
  /**
   * Custom error message.
   */
  readonly errorMessage?: string;
}

/**
 * Middleware that requires a specific permission.
 * 
 * @example
 * router.post('/export', requirePermission('export:read'));
 */
export function requirePermission(permission: Permission, options: PermissionOptions = {}) {
  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    // Must be authenticated
    if (!req.isAuthenticated || !req.user) {
      await emitDeniedEvent(req, undefined, 'NOT_AUTHENTICATED');
      sendUnauthorized(res);
      return;
    }

    const user = req.user;

    if (!hasPermission(user, permission)) {
      await emitDeniedEvent(req, undefined, 'MISSING_PERMISSION');
      
      logger.warn('Permission check failed', {
        userId: user.id as string,
        required: permission,
        userPermissions: user.permissions,
      });

      sendForbidden(
        res,
        'MISSING_PERMISSION',
        options.errorMessage ?? 'Insufficient permissions'
      );
      return;
    }

    next();
  };
}

/**
 * Middleware that requires any of the specified permissions.
 */
export function requireAnyPermission(permissions: readonly Permission[], options: PermissionOptions = {}) {
  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.isAuthenticated || !req.user) {
      await emitDeniedEvent(req, undefined, 'NOT_AUTHENTICATED');
      sendUnauthorized(res);
      return;
    }

    const user = req.user;
    const hasAny = permissions.some(p => hasPermission(user, p));

    if (!hasAny) {
      await emitDeniedEvent(req, undefined, 'MISSING_PERMISSION');
      
      logger.warn('Permission check failed (any)', {
        userId: user.id as string,
        required: permissions,
      });

      sendForbidden(
        res,
        'MISSING_PERMISSION',
        options.errorMessage ?? 'Insufficient permissions'
      );
      return;
    }

    next();
  };
}

/**
 * Middleware that requires all specified permissions.
 */
export function requireAllPermissions(permissions: readonly Permission[], options: PermissionOptions = {}) {
  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.isAuthenticated || !req.user) {
      await emitDeniedEvent(req, undefined, 'NOT_AUTHENTICATED');
      sendUnauthorized(res);
      return;
    }

    const user = req.user;
    const missingPermissions = permissions.filter(p => !hasPermission(user, p));

    if (missingPermissions.length > 0) {
      await emitDeniedEvent(req, undefined, 'MISSING_PERMISSION');
      
      logger.warn('Permission check failed (all)', {
        userId: user.id as string,
        required: permissions,
        missing: missingPermissions,
      });

      sendForbidden(
        res,
        'MISSING_PERMISSION',
        options.errorMessage ?? 'Insufficient permissions'
      );
      return;
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUIRE ROLE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for role middleware.
 */
export interface RoleOptions {
  /**
   * Custom error message.
   */
  readonly errorMessage?: string;
}

/**
 * Middleware that requires a specific role.
 * 
 * @example
 * router.get('/admin/users', requireRole('admin'));
 */
export function requireRole(role: UserRole, options: RoleOptions = {}) {
  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.isAuthenticated || !req.user) {
      await emitDeniedEvent(req, undefined, 'NOT_AUTHENTICATED');
      sendUnauthorized(res);
      return;
    }

    const user = req.user;

    if (!hasRole(user, role)) {
      await emitDeniedEvent(req, undefined, 'MISSING_ROLE');
      
      logger.warn('Role check failed', {
        userId: user.id as string,
        required: role,
        userRoles: user.roles,
      });

      sendForbidden(
        res,
        'MISSING_ROLE',
        options.errorMessage ?? 'Insufficient privileges'
      );
      return;
    }

    next();
  };
}

/**
 * Middleware that requires any of the specified roles.
 */
export function requireAnyRole(roles: readonly UserRole[], options: RoleOptions = {}) {
  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.isAuthenticated || !req.user) {
      await emitDeniedEvent(req, undefined, 'NOT_AUTHENTICATED');
      sendUnauthorized(res);
      return;
    }

    const user = req.user;
    const hasAny = roles.some(r => hasRole(user, r));

    if (!hasAny) {
      await emitDeniedEvent(req, undefined, 'MISSING_ROLE');
      
      logger.warn('Role check failed (any)', {
        userId: user.id as string,
        required: roles,
      });

      sendForbidden(
        res,
        'MISSING_ROLE',
        options.errorMessage ?? 'Insufficient privileges'
      );
      return;
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUIRE ACTION ON RESOURCE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Middleware that checks permission for an action on a resource type.
 * 
 * @example
 * router.post('/goals', requireAction('goal', 'write'));
 */
export function requireAction(resourceType: ResourceType, action: ResourceAction) {
  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.isAuthenticated || !req.user) {
      await emitDeniedEvent(req, resourceType, 'NOT_AUTHENTICATED');
      sendUnauthorized(res);
      return;
    }

    const user = req.user;

    if (!canPerform(user, resourceType, action)) {
      await emitDeniedEvent(req, resourceType, 'MISSING_PERMISSION');
      
      logger.warn('Action check failed', {
        userId: user.id as string,
        resourceType,
        action,
      });

      sendForbidden(res, 'MISSING_PERMISSION', `Cannot ${action} ${resourceType}`);
      return;
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Combined ownership + permission check.
 * 
 * @example
 * router.delete('/goals/:id', requireOwnershipAndPermission('goal', 'goals:delete'));
 */
export function requireOwnershipAndPermission(
  resourceType: ResourceType,
  permission: Permission,
  options: OwnershipOptions & PermissionOptions = {}
) {
  const ownershipMiddleware = requireOwnership(resourceType, options);
  const permissionMiddleware = requirePermission(permission, options);

  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    // First check ownership
    await ownershipMiddleware(req, res, (err) => {
      if (err || res.headersSent) {
        if (err) next(err);
        return;
      }
      // Then check permission
      permissionMiddleware(req, res, next);
    });
  };
}

/**
 * Admin-only middleware (shorthand).
 */
export function adminOnly() {
  return requireRole('admin', { errorMessage: 'Admin access required' });
}

/**
 * Premium-only middleware (premium or admin).
 */
export function premiumOnly() {
  return requireAnyRole(['premium', 'admin'], { errorMessage: 'Premium access required' });
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Emit denied event for audit.
 */
async function emitDeniedEvent(
  req: SecureRequest,
  resourceType: ResourceType | undefined,
  reasonCode: string,
  resourceId?: string
): Promise<void> {
  await emitEvent({
    type: 'authorization_denied',
    userId: req.user?.id as string,
    resourceType,
    resourceId,
    timestamp: new Date().toISOString(),
    requestId: req.context?.requestId as string ?? req.requestId,
    reason: { code: reasonCode, message: '' } as AuthorizationDenialReason,
  });
}

/**
 * Get user from request (type-safe).
 */
export function getAuthenticatedUser(req: SecureRequest): AuthenticatedUser | null {
  return req.isAuthenticated ? req.user ?? null : null;
}

/**
 * Get user ID from request.
 */
export function getUserId(req: SecureRequest): UserId | null {
  return req.user?.id ?? null;
}

/**
 * Assert request is authenticated (throws if not).
 */
export function assertAuthenticated(req: SecureRequest): asserts req is SecureRequest & { user: AuthenticatedUser } {
  if (!req.isAuthenticated || !req.user) {
    throw new Error('Request is not authenticated');
  }
}
