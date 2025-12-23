// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES — User Fixtures
// NovaOS Phase 17 — Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { createUserId, createTimestamp } from '../../types/branded.js';

// ─────────────────────────────────────────────────────────────────────────────────
// USER IDS
// ─────────────────────────────────────────────────────────────────────────────────

export const TEST_USER_IDS = {
  FREE_USER: createUserId('user_free_test'),
  PRO_USER: createUserId('user_pro_test'),
  ADMIN_USER: createUserId('user_admin_test'),
  NEW_USER: createUserId('user_new_test'),
  LOCKED_USER: createUserId('user_locked_test'),
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// USER FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TestUser {
  id: ReturnType<typeof createUserId>;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  createdAt: ReturnType<typeof createTimestamp>;
  settings?: {
    timezone?: string;
    reminderEnabled?: boolean;
  };
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: TEST_USER_IDS.FREE_USER,
    email: 'test@example.com',
    tier: 'free',
    createdAt: createTimestamp(),
    settings: {
      timezone: 'America/New_York',
      reminderEnabled: true,
    },
    ...overrides,
  };
}

export const TEST_USERS = {
  freeUser: createTestUser({
    id: TEST_USER_IDS.FREE_USER,
    email: 'free@example.com',
    tier: 'free',
  }),
  
  proUser: createTestUser({
    id: TEST_USER_IDS.PRO_USER,
    email: 'pro@example.com',
    tier: 'pro',
  }),
  
  adminUser: createTestUser({
    id: TEST_USER_IDS.ADMIN_USER,
    email: 'admin@example.com',
    tier: 'enterprise',
  }),
  
  newUser: createTestUser({
    id: TEST_USER_IDS.NEW_USER,
    email: 'new@example.com',
    tier: 'free',
    settings: undefined,
  }),
  
  lockedUser: createTestUser({
    id: TEST_USER_IDS.LOCKED_USER,
    email: 'locked@example.com',
    tier: 'free',
  }),
} as const;
