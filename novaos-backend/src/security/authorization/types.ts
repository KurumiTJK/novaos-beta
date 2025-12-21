// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORIZATION TYPES — Resource Access Control
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  UserId,
  GoalId,
  QuestId,
  StepId,
  SparkId,
  ReminderId,
  ResourceId,
} from '../../types/branded.js';
import type { UserRole, Permission, AuthenticatedUser } from '../auth/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Resource types that can be authorized.
 */
export type ResourceType =
  | 'goal'
  | 'quest'
  | 'step'
  | 'spark'
  | 'reminder'
  | 'memory'
  | 'conversation'
  | 'profile'
  | 'preference';

/**
 * Map resource type to its ID type.
 */
export interface ResourceIdMap {
  goal: GoalId;
  quest: QuestId;
  step: StepId;
  spark: SparkId;
  reminder: ReminderId;
  memory: ResourceId;
  conversation: ResourceId;
  profile: UserId;
  preference: UserId;
}

/**
 * Resource with ownership information.
 */
export interface OwnedResource<T extends ResourceType = ResourceType> {
  readonly type: T;
  readonly id: ResourceIdMap[T];
  readonly ownerId: UserId;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORIZATION ACTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Actions that can be performed on resources.
 */
export type ResourceAction = 'read' | 'write' | 'delete' | 'admin';

/**
 * Full permission string format.
 */
export type PermissionString = `${ResourceType}:${ResourceAction}` | '*';

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORIZATION RESULT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Result of an authorization check.
 */
export type AuthorizationResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: AuthorizationDenialReason };

/**
 * Reasons why authorization was denied.
 */
export type AuthorizationDenialReason =
  | { readonly code: 'NOT_AUTHENTICATED'; readonly message: string }
  | { readonly code: 'NOT_OWNER'; readonly message: string; readonly resourceType: ResourceType; readonly resourceId: string }
  | { readonly code: 'MISSING_PERMISSION'; readonly message: string; readonly required: Permission }
  | { readonly code: 'MISSING_ROLE'; readonly message: string; readonly required: UserRole }
  | { readonly code: 'RESOURCE_NOT_FOUND'; readonly message: string; readonly resourceType: ResourceType; readonly resourceId: string }
  | { readonly code: 'BLOCKED'; readonly message: string };

/**
 * Create an allowed result.
 */
export function allowed(): AuthorizationResult {
  return { allowed: true };
}

/**
 * Create a denied result.
 */
export function denied(reason: AuthorizationDenialReason): AuthorizationResult {
  return { allowed: false, reason };
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORIZATION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Context for making authorization decisions.
 */
export interface AuthorizationContext {
  readonly user: AuthenticatedUser | null;
  readonly resourceType?: ResourceType;
  readonly resourceId?: string;
  readonly action?: ResourceAction;
}

/**
 * Create authorization context from user.
 */
export function createAuthContext(user: AuthenticatedUser | null | undefined): AuthorizationContext {
  return { user: user ?? null };
}

/**
 * Extend context with resource info.
 */
export function withResource(
  context: AuthorizationContext,
  resourceType: ResourceType,
  resourceId: string,
  action: ResourceAction = 'read'
): AuthorizationContext {
  return {
    ...context,
    resourceType,
    resourceId,
    action,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// OWNERSHIP LOOKUP
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Function that looks up the owner of a resource.
 */
export type OwnershipLookup<T extends ResourceType = ResourceType> = (
  resourceId: ResourceIdMap[T]
) => Promise<UserId | null>;

/**
 * Registry of ownership lookup functions.
 */
export interface OwnershipRegistry {
  readonly goal: OwnershipLookup<'goal'>;
  readonly quest: OwnershipLookup<'quest'>;
  readonly step: OwnershipLookup<'step'>;
  readonly spark: OwnershipLookup<'spark'>;
  readonly reminder: OwnershipLookup<'reminder'>;
  readonly memory: OwnershipLookup<'memory'>;
  readonly conversation: OwnershipLookup<'conversation'>;
  readonly profile: OwnershipLookup<'profile'>;
  readonly preference: OwnershipLookup<'preference'>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// POLICY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Policy that grants permissions based on role.
 */
export interface RolePolicy {
  readonly role: UserRole;
  readonly permissions: readonly Permission[];
  readonly inherits?: readonly UserRole[];
}

/**
 * Policy configuration.
 */
export interface PolicyConfig {
  readonly roles: readonly RolePolicy[];
  readonly defaultPermissions: readonly Permission[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORIZATION EVENTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Authorization event for audit logging.
 */
export interface AuthorizationEvent {
  readonly type: 'authorization_success' | 'authorization_denied';
  readonly userId?: string;
  readonly resourceType?: ResourceType;
  readonly resourceId?: string;
  readonly action?: ResourceAction;
  readonly reason?: AuthorizationDenialReason;
  readonly timestamp: string;
  readonly requestId?: string;
}
