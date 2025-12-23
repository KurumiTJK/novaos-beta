// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES — User Fixtures
// NovaOS Sword System v3.0 — Phase 17: Integration & Testing
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides test user fixtures for:
//   - Different tiers (free, pro, enterprise)
//   - Different roles (user, premium, admin)
//   - JWT token generation
//
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createUserId,
  createTimestamp,
  createSessionId,
  createRequestId,
  createCorrelationId,
  type UserId,
  type Timestamp,
} from '../../types/branded.js';
import type {
  AuthenticatedUser,
  UserTier,
  UserRole,
  UserMetadata,
  RequestContext,
  Permission,
} from '../../security/auth/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// USER FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test user with defaults.
 */
export function createTestUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  const userId = overrides?.id ?? createUserId();
  const tier = overrides?.tier ?? 'free';
  
  return {
    id: userId,
    email: overrides?.email ?? `test-${userId.slice(-8)}@example.com`,
    tier,
    roles: overrides?.roles ?? getRolesForTier(tier),
    permissions: overrides?.permissions ?? getPermissionsForTier(tier),
    metadata: overrides?.metadata ?? createUserMetadata(),
  };
}

/**
 * Create a free tier user.
 */
export function createFreeUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return createTestUser({ ...overrides, tier: 'free' });
}

/**
 * Create a pro tier user.
 */
export function createProUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return createTestUser({
    ...overrides,
    tier: 'pro',
    roles: ['user', 'premium'],
    permissions: getPermissionsForTier('pro'),
  });
}

/**
 * Create an enterprise tier user.
 */
export function createEnterpriseUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return createTestUser({
    ...overrides,
    tier: 'enterprise',
    roles: ['user', 'premium'],
    permissions: getPermissionsForTier('enterprise'),
  });
}

/**
 * Create an admin user.
 */
export function createAdminUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return createTestUser({
    ...overrides,
    tier: 'enterprise',
    roles: ['user', 'premium', 'admin'],
    permissions: ['*'],
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER METADATA
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create user metadata with defaults.
 */
export function createUserMetadata(overrides?: Partial<UserMetadata>): UserMetadata {
  return {
    createdAt: overrides?.createdAt ?? createTimestamp(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    lastLoginAt: overrides?.lastLoginAt ?? createTimestamp(),
    loginCount: overrides?.loginCount ?? 10,
    mfaEnabled: overrides?.mfaEnabled ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST CONTEXT FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test request context with user authentication.
 */
export function createTestRequestContext(
  user?: AuthenticatedUser,
  overrides?: Partial<RequestContext>
): RequestContext {
  const authenticatedUser = user ?? createTestUser();
  
  return {
    requestId: overrides?.requestId ?? createRequestId(),
    correlationId: overrides?.correlationId ?? createCorrelationId(),
    sessionId: overrides?.sessionId ?? createSessionId(),
    timestamp: overrides?.timestamp ?? createTimestamp(),
    startTime: overrides?.startTime ?? Date.now(),
    ip: overrides?.ip ?? '127.0.0.1',
    userAgent: overrides?.userAgent ?? 'vitest/1.0',
    origin: overrides?.origin ?? 'http://localhost:3000',
    user: authenticatedUser,
    isAuthenticated: true,
    isService: false,
    isAnonymous: false,
  };
}

/**
 * Create an anonymous request context.
 */
export function createAnonymousRequestContext(
  overrides?: Partial<RequestContext>
): RequestContext {
  return {
    requestId: overrides?.requestId ?? createRequestId(),
    correlationId: overrides?.correlationId ?? createCorrelationId(),
    timestamp: overrides?.timestamp ?? createTimestamp(),
    startTime: overrides?.startTime ?? Date.now(),
    ip: overrides?.ip ?? '127.0.0.1',
    userAgent: overrides?.userAgent ?? 'vitest/1.0',
    origin: overrides?.origin ?? 'http://localhost:3000',
    isAuthenticated: false,
    isService: false,
    isAnonymous: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// PERMISSION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get default roles for a tier.
 */
function getRolesForTier(tier: UserTier): readonly UserRole[] {
  switch (tier) {
    case 'free':
      return ['user'];
    case 'pro':
    case 'enterprise':
      return ['user', 'premium'];
  }
}

/**
 * Get default permissions for a tier.
 */
function getPermissionsForTier(tier: UserTier): readonly Permission[] {
  const base: Permission[] = [
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
    'conversations:read',
    'conversations:write',
  ];
  
  if (tier === 'pro' || tier === 'enterprise') {
    base.push(
      'advanced_features',
      'export:read',
      'analytics:read'
    );
  }
  
  if (tier === 'enterprise') {
    base.push(
      'team:read',
      'team:write',
      'audit:read'
    );
  }
  
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PREDEFINED TEST USERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Well-known test user IDs for consistent testing.
 */
export const TEST_USER_IDS = {
  alice: createUserId('user-alice-test-00000001'),
  bob: createUserId('user-bob-test-000000002'),
  carol: createUserId('user-carol-test-00000003'),
  admin: createUserId('user-admin-test-00000000'),
} as const;

/**
 * Pre-created test users.
 */
export const TEST_USERS = {
  /** Free tier user */
  alice: createTestUser({
    id: TEST_USER_IDS.alice,
    email: 'alice@example.com',
    tier: 'free',
  }),
  
  /** Pro tier user */
  bob: createProUser({
    id: TEST_USER_IDS.bob,
    email: 'bob@example.com',
  }),
  
  /** Enterprise tier user */
  carol: createEnterpriseUser({
    id: TEST_USER_IDS.carol,
    email: 'carol@example.com',
  }),
  
  /** Admin user */
  admin: createAdminUser({
    id: TEST_USER_IDS.admin,
    email: 'admin@example.com',
  }),
} as const;
