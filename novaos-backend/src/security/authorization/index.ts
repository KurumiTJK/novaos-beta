// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORIZATION MODULE INDEX — Authorization Exports
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export {
  type ResourceType,
  type ResourceIdMap,
  type OwnedResource,
  type ResourceAction,
  type PermissionString,
  type AuthorizationResult,
  type AuthorizationDenialReason,
  type AuthorizationContext,
  type OwnershipLookup,
  type OwnershipRegistry,
  type RolePolicy,
  type PolicyConfig,
  type AuthorizationEvent,
  allowed,
  denied,
  createAuthContext,
  withResource,
} from './types.js';

// Ownership
export {
  OwnershipChecker,
  getOwnershipChecker,
  initOwnershipChecker,
  resetOwnershipChecker,
  userOwnsGoal,
  userOwnsQuest,
  userOwnsStep,
  userOwnsSpark,
  userOwnsReminder,
} from './ownership.js';

// Policies
export {
  DEFAULT_ROLE_POLICIES,
  DEFAULT_POLICY_CONFIG,
  PolicyManager,
  getPolicyManager,
  initPolicyManager,
  resetPolicyManager,
  hasPermission,
  hasRole,
  canPerform,
  isAdmin,
  isPremium,
  getRoleForTier,
  getPermissionsForTier,
} from './policies.js';

// Middleware
export {
  requireAuthenticated,
  requireOwnership,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  requireAnyRole,
  requireAction,
  requireOwnershipAndPermission,
  adminOnly,
  premiumOnly,
  onAuthorizationEvent,
  clearAuthorizationEventHandlers,
  getAuthenticatedUser,
  getUserId,
  assertAuthenticated,
  AuthzErrorCode,
  type AuthzErrorCode as AuthzErrorCodeType,
  type OwnershipOptions,
  type PermissionOptions,
  type RoleOptions,
} from './middleware.js';
