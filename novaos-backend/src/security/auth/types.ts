// ═══════════════════════════════════════════════════════════════════════════════
// AUTH TYPES — JWT Payload, User Types, Token Configuration
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request } from 'express';

// ─────────────────────────────────────────────────────────────────────────────────
// USER TIERS & ROLES
// ─────────────────────────────────────────────────────────────────────────────────

export type UserTier = 'free' | 'pro' | 'enterprise';

export type UserRole = 'user' | 'premium' | 'admin' | 'service';

// ─────────────────────────────────────────────────────────────────────────────────
// JWT PAYLOAD
// ─────────────────────────────────────────────────────────────────────────────────

export interface JWTPayload {
  // Standard JWT claims
  sub: string;           // User ID
  iat: number;           // Issued at (seconds)
  exp: number;           // Expiration (seconds)
  iss: string;           // Issuer
  aud: string;           // Audience
  jti?: string;          // JWT ID (for revocation)
  
  // Custom claims
  email?: string;
  tier: UserTier;
  role: UserRole;
  permissions?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED USER
// ─────────────────────────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  tier: UserTier;
  role: UserRole;
  permissions: string[];
  tokenId?: string;      // JWT ID for revocation
  issuedAt: number;
  expiresAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST EXTENSION
// ─────────────────────────────────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  userId?: string;
  requestId?: string;
  startTime?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type TokenType = 'access' | 'refresh' | 'api_key';

export interface TokenConfig {
  secret: string;
  issuer: string;
  audience: string;
  accessTokenExpiry: string;    // e.g., '15m'
  refreshTokenExpiry: string;   // e.g., '7d'
  apiKeyExpiry: string;         // e.g., '365d'
}

export interface GeneratedToken {
  token: string;
  type: TokenType;
  expiresAt: number;
  tokenId: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN VERIFICATION RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export type TokenVerificationResult =
  | { valid: true; user: AuthenticatedUser }
  | { valid: false; error: TokenError };

export type TokenError =
  | 'TOKEN_MISSING'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'TOKEN_MALFORMED'
  | 'SIGNATURE_INVALID';

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH EVENTS
// ─────────────────────────────────────────────────────────────────────────────────

export type AuthEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'token_refresh'
  | 'token_revoked'
  | 'token_invalid'
  | 'api_key_created'
  | 'api_key_revoked';

export interface AuthEvent {
  type: AuthEventType;
  userId?: string;
  timestamp: number;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export interface AuthMiddlewareOptions {
  required?: boolean;
  allowApiKey?: boolean;
  skipPaths?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT PERMISSIONS BY TIER
// ─────────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PERMISSIONS: Record<UserTier, string[]> = {
  free: [
    'chat:send',
    'conversation:read',
    'conversation:create',
    'conversation:delete',
  ],
  pro: [
    'chat:send',
    'conversation:read',
    'conversation:create',
    'conversation:delete',
    'goal:create',
    'goal:read',
    'goal:update',
    'goal:delete',
    'memory:read',
  ],
  enterprise: [
    'chat:send',
    'conversation:read',
    'conversation:create',
    'conversation:delete',
    'goal:create',
    'goal:read',
    'goal:update',
    'goal:delete',
    'memory:read',
    'memory:write',
    'admin:read',
    'webhook:manage',
  ],
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  user: [],
  premium: ['priority:high'],
  admin: ['admin:*', 'user:manage', 'audit:read'],
  service: ['service:*'],
};

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function getDefaultPermissions(tier: UserTier, role: UserRole): string[] {
  const tierPerms = DEFAULT_PERMISSIONS[tier] ?? [];
  const rolePerms = ROLE_PERMISSIONS[role] ?? [];
  return [...new Set([...tierPerms, ...rolePerms])];
}

export function getRoleForTier(tier: UserTier): UserRole {
  switch (tier) {
    case 'enterprise':
      return 'premium';
    case 'pro':
      return 'premium';
    default:
      return 'user';
  }
}
