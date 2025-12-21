// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORIZATION POLICIES — Role-Permission Mappings
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import type { UserRole, Permission, AuthenticatedUser } from '../auth/types.js';
import type { RolePolicy, PolicyConfig, ResourceAction, ResourceType } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT POLICIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Base permissions for all authenticated users.
 */
const BASE_PERMISSIONS: readonly Permission[] = [
  // Goals (Sword system)
  'goals:read',
  'goals:write',
  
  // Quests (milestones)
  'quests:read',
  'quests:write',
  
  // Steps
  'steps:read',
  'steps:write',
  
  // Sparks (actions)
  'sparks:read',
  'sparks:write',
  
  // Memory system
  'memories:read',
  'memories:write',
  
  // Conversations
  'conversations:read',
  'conversations:write',
  
  // Profile
  'profile:read',
  'profile:write',
  
  // Preferences
  'preferences:read',
  'preferences:write',
];

/**
 * Premium tier additional permissions.
 */
const PREMIUM_PERMISSIONS: readonly Permission[] = [
  ...BASE_PERMISSIONS,
  
  // Advanced features
  'advanced_features',
  'reminders:read',
  'reminders:write',
  
  // Export
  'export:read',
  
  // Analytics
  'analytics:read',
  
  // Higher limits
  'limits:extended',
];

/**
 * Admin permissions (all access).
 */
const ADMIN_PERMISSIONS: readonly Permission[] = [
  '*', // Wildcard - all permissions
];

/**
 * Service account permissions.
 */
const SERVICE_PERMISSIONS: readonly Permission[] = [
  'service:internal',
  'goals:read',
  'goals:write',
  'quests:read',
  'quests:write',
  'steps:read',
  'steps:write',
  'sparks:read',
  'sparks:write',
  'memories:read',
  'memories:write',
];

/**
 * Default role policies.
 */
export const DEFAULT_ROLE_POLICIES: readonly RolePolicy[] = [
  {
    role: 'user',
    permissions: BASE_PERMISSIONS,
  },
  {
    role: 'premium',
    permissions: PREMIUM_PERMISSIONS,
    inherits: ['user'],
  },
  {
    role: 'admin',
    permissions: ADMIN_PERMISSIONS,
    inherits: ['premium'],
  },
  {
    role: 'service',
    permissions: SERVICE_PERMISSIONS,
  },
];

/**
 * Default policy configuration.
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  roles: DEFAULT_ROLE_POLICIES,
  defaultPermissions: [],
};

// ─────────────────────────────────────────────────────────────────────────────────
// POLICY MANAGER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Policy manager for checking permissions.
 */
export class PolicyManager {
  private readonly config: PolicyConfig;
  private readonly rolePermissions: Map<UserRole, Set<Permission>>;

  constructor(config: PolicyConfig = DEFAULT_POLICY_CONFIG) {
    this.config = config;
    this.rolePermissions = this.buildRolePermissions();
  }

  /**
   * Build expanded role permissions with inheritance.
   */
  private buildRolePermissions(): Map<UserRole, Set<Permission>> {
    const map = new Map<UserRole, Set<Permission>>();

    // First pass: direct permissions
    for (const policy of this.config.roles) {
      map.set(policy.role, new Set(policy.permissions));
    }

    // Second pass: resolve inheritance
    for (const policy of this.config.roles) {
      if (policy.inherits) {
        const permissions = map.get(policy.role)!;
        for (const inheritedRole of policy.inherits) {
          const inherited = map.get(inheritedRole);
          if (inherited) {
            for (const perm of inherited) {
              permissions.add(perm);
            }
          }
        }
      }
    }

    return map;
  }

  /**
   * Get all permissions for a role.
   */
  getPermissionsForRole(role: UserRole): readonly Permission[] {
    const permissions = this.rolePermissions.get(role);
    return permissions ? Array.from(permissions) : [...this.config.defaultPermissions];
  }

  /**
   * Get all permissions for a set of roles.
   */
  getPermissionsForRoles(roles: readonly UserRole[]): readonly Permission[] {
    const permissions = new Set<Permission>(this.config.defaultPermissions);
    
    for (const role of roles) {
      const rolePerms = this.rolePermissions.get(role);
      if (rolePerms) {
        for (const perm of rolePerms) {
          permissions.add(perm);
        }
      }
    }

    return Array.from(permissions);
  }

  /**
   * Check if a role has a permission.
   */
  roleHasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = this.rolePermissions.get(role);
    if (!permissions) return false;
    
    // Check for wildcard
    if (permissions.has('*')) return true;
    
    return permissions.has(permission);
  }

  /**
   * Check if any of the roles has a permission.
   */
  hasPermission(roles: readonly UserRole[], permission: Permission): boolean {
    for (const role of roles) {
      if (this.roleHasPermission(role, permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a user has a permission.
   */
  userHasPermission(user: AuthenticatedUser, permission: Permission): boolean {
    // Check explicit permissions first
    if (user.permissions.includes('*') || user.permissions.includes(permission)) {
      return true;
    }
    
    // Check role-based permissions
    return this.hasPermission(user.roles, permission);
  }

  /**
   * Check if a user has a specific role.
   */
  userHasRole(user: AuthenticatedUser, role: UserRole): boolean {
    return user.roles.includes(role);
  }

  /**
   * Check if a user has any of the specified roles.
   */
  userHasAnyRole(user: AuthenticatedUser, roles: readonly UserRole[]): boolean {
    return roles.some(role => user.roles.includes(role));
  }

  /**
   * Check if a user has all of the specified roles.
   */
  userHasAllRoles(user: AuthenticatedUser, roles: readonly UserRole[]): boolean {
    return roles.every(role => user.roles.includes(role));
  }

  /**
   * Build permission string from resource type and action.
   */
  static buildPermission(resourceType: ResourceType, action: ResourceAction): Permission {
    // Map resource types to permission prefixes
    const prefixMap: Record<ResourceType, string> = {
      goal: 'goals',
      quest: 'quests',
      step: 'steps',
      spark: 'sparks',
      reminder: 'reminders',
      memory: 'memories',
      conversation: 'conversations',
      profile: 'profile',
      preference: 'preferences',
    };

    const prefix = prefixMap[resourceType] ?? resourceType;
    return `${prefix}:${action}`;
  }

  /**
   * Check if user can perform action on resource type.
   */
  canPerformAction(
    user: AuthenticatedUser,
    resourceType: ResourceType,
    action: ResourceAction
  ): boolean {
    const permission = PolicyManager.buildPermission(resourceType, action);
    return this.userHasPermission(user, permission);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

let policyManagerInstance: PolicyManager | null = null;

/**
 * Get the policy manager singleton.
 */
export function getPolicyManager(): PolicyManager {
  if (!policyManagerInstance) {
    policyManagerInstance = new PolicyManager();
  }
  return policyManagerInstance;
}

/**
 * Initialize policy manager with custom config.
 */
export function initPolicyManager(config: PolicyConfig): PolicyManager {
  policyManagerInstance = new PolicyManager(config);
  return policyManagerInstance;
}

/**
 * Reset policy manager (for testing).
 * @internal
 */
export function resetPolicyManager(): void {
  policyManagerInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if user has permission.
 */
export function hasPermission(user: AuthenticatedUser, permission: Permission): boolean {
  return getPolicyManager().userHasPermission(user, permission);
}

/**
 * Check if user has role.
 */
export function hasRole(user: AuthenticatedUser, role: UserRole): boolean {
  return getPolicyManager().userHasRole(user, role);
}

/**
 * Check if user can perform action on resource.
 */
export function canPerform(
  user: AuthenticatedUser,
  resourceType: ResourceType,
  action: ResourceAction
): boolean {
  return getPolicyManager().canPerformAction(user, resourceType, action);
}

/**
 * Check if user is admin.
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return hasRole(user, 'admin');
}

/**
 * Check if user is premium (or higher).
 */
export function isPremium(user: AuthenticatedUser): boolean {
  return hasRole(user, 'premium') || hasRole(user, 'admin');
}

// ─────────────────────────────────────────────────────────────────────────────────
// TIER-BASED PERMISSION MAPPING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get default role for a tier.
 */
export function getRoleForTier(tier: 'free' | 'pro' | 'enterprise'): UserRole {
  switch (tier) {
    case 'enterprise':
      return 'premium';
    case 'pro':
      return 'premium';
    case 'free':
    default:
      return 'user';
  }
}

/**
 * Get permissions for a tier.
 */
export function getPermissionsForTier(tier: 'free' | 'pro' | 'enterprise'): readonly Permission[] {
  const role = getRoleForTier(tier);
  return getPolicyManager().getPermissionsForRole(role);
}
