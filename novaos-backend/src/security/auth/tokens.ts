// ═══════════════════════════════════════════════════════════════════════════════
// AUTH TOKENS — JWT Generation, Verification, and Revocation
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { KeyValueStore } from '../../storage/index.js';
import type {
  JWTPayload,
  AuthenticatedUser,
  TokenConfig,
  GeneratedToken,
  TokenVerificationResult,
  TokenType,
  UserTier,
  UserRole,
} from './types.js';
import { getDefaultPermissions, getRoleForTier } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: TokenConfig = {
  secret: process.env.JWT_SECRET ?? 'nova-dev-secret-CHANGE-IN-PRODUCTION',
  issuer: process.env.JWT_ISSUER ?? 'novaos',
  audience: process.env.JWT_AUDIENCE ?? 'novaos-api',
  accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  apiKeyExpiry: process.env.JWT_API_KEY_EXPIRY ?? '365d',
};

let config: TokenConfig = { ...DEFAULT_CONFIG };
let revocationStore: KeyValueStore | null = null;

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

export function initTokenConfig(customConfig: Partial<TokenConfig>): void {
  config = { ...DEFAULT_CONFIG, ...customConfig };
}

export function setRevocationStore(store: KeyValueStore): void {
  revocationStore = store;
}

export function getTokenConfig(): TokenConfig {
  return { ...config };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

function generateTokenId(): string {
  return crypto.randomUUID();
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) return 900; // Default 15 minutes
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 900;
  }
}

export function generateAccessToken(
  userId: string,
  tier: UserTier,
  options?: {
    email?: string;
    role?: UserRole;
    permissions?: string[];
  }
): GeneratedToken {
  const tokenId = generateTokenId();
  const role = options?.role ?? getRoleForTier(tier);
  const permissions = options?.permissions ?? getDefaultPermissions(tier, role);
  const expirySeconds = parseExpiry(config.accessTokenExpiry);
  const now = Math.floor(Date.now() / 1000);
  
  const payload: JWTPayload = {
    sub: userId,
    iat: now,
    exp: now + expirySeconds,
    iss: config.issuer,
    aud: config.audience,
    jti: tokenId,
    email: options?.email,
    tier,
    role,
    permissions,
  };
  
  const token = jwt.sign(payload, config.secret, { algorithm: 'HS256' });
  
  return {
    token,
    type: 'access',
    expiresAt: (now + expirySeconds) * 1000,
    tokenId,
  };
}

export function generateRefreshToken(
  userId: string,
  tier: UserTier
): GeneratedToken {
  const tokenId = generateTokenId();
  const expirySeconds = parseExpiry(config.refreshTokenExpiry);
  const now = Math.floor(Date.now() / 1000);
  
  const payload: JWTPayload = {
    sub: userId,
    iat: now,
    exp: now + expirySeconds,
    iss: config.issuer,
    aud: config.audience,
    jti: tokenId,
    tier,
    role: 'user',
  };
  
  const token = jwt.sign(payload, config.secret, { algorithm: 'HS256' });
  
  return {
    token: `refresh_${token}`,
    type: 'refresh',
    expiresAt: (now + expirySeconds) * 1000,
    tokenId,
  };
}

export function generateApiKey(
  userId: string,
  tier: UserTier,
  options?: { email?: string }
): GeneratedToken {
  const tokenId = generateTokenId();
  const role = getRoleForTier(tier);
  const permissions = getDefaultPermissions(tier, role);
  const expirySeconds = parseExpiry(config.apiKeyExpiry);
  const now = Math.floor(Date.now() / 1000);
  
  const payload: JWTPayload = {
    sub: userId,
    iat: now,
    exp: now + expirySeconds,
    iss: config.issuer,
    aud: config.audience,
    jti: tokenId,
    email: options?.email,
    tier,
    role,
    permissions,
  };
  
  const token = jwt.sign(payload, config.secret, { algorithm: 'HS256' });
  
  return {
    token: `nova_${token}`,
    type: 'api_key',
    expiresAt: (now + expirySeconds) * 1000,
    tokenId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────────

export async function verifyToken(token: string): Promise<TokenVerificationResult> {
  try {
    // Handle different token prefixes
    let actualToken = token;
    if (token.startsWith('nova_')) {
      actualToken = token.slice(5);
    } else if (token.startsWith('refresh_')) {
      actualToken = token.slice(8);
    } else if (token.startsWith('Bearer ')) {
      actualToken = token.slice(7);
    }
    
    // Verify JWT
    const decoded = jwt.verify(actualToken, config.secret, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['HS256'],
    }) as JWTPayload;
    
    // Check if token is revoked
    if (decoded.jti && revocationStore) {
      const isRevoked = await isTokenRevoked(decoded.jti);
      if (isRevoked) {
        return { valid: false, error: 'TOKEN_REVOKED' };
      }
    }
    
    // Build authenticated user
    const user: AuthenticatedUser = {
      userId: decoded.sub,
      email: decoded.email,
      tier: decoded.tier,
      role: decoded.role,
      permissions: decoded.permissions ?? getDefaultPermissions(decoded.tier, decoded.role),
      tokenId: decoded.jti,
      issuedAt: decoded.iat * 1000,
      expiresAt: decoded.exp * 1000,
    };
    
    return { valid: true, user };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      if (error.message.includes('signature')) {
        return { valid: false, error: 'SIGNATURE_INVALID' };
      }
      return { valid: false, error: 'TOKEN_MALFORMED' };
    }
    return { valid: false, error: 'TOKEN_INVALID' };
  }
}

export function verifyTokenSync(token: string): TokenVerificationResult {
  try {
    let actualToken = token;
    if (token.startsWith('nova_')) {
      actualToken = token.slice(5);
    } else if (token.startsWith('refresh_')) {
      actualToken = token.slice(8);
    } else if (token.startsWith('Bearer ')) {
      actualToken = token.slice(7);
    }
    
    const decoded = jwt.verify(actualToken, config.secret, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['HS256'],
    }) as JWTPayload;
    
    const user: AuthenticatedUser = {
      userId: decoded.sub,
      email: decoded.email,
      tier: decoded.tier,
      role: decoded.role,
      permissions: decoded.permissions ?? getDefaultPermissions(decoded.tier, decoded.role),
      tokenId: decoded.jti,
      issuedAt: decoded.iat * 1000,
      expiresAt: decoded.exp * 1000,
    };
    
    return { valid: true, user };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'TOKEN_MALFORMED' };
    }
    return { valid: false, error: 'TOKEN_INVALID' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN REVOCATION
// ─────────────────────────────────────────────────────────────────────────────────

const REVOCATION_PREFIX = 'token:revoked:';
const USER_REVOCATION_PREFIX = 'token:user_revoked:';

export async function revokeToken(
  tokenId: string,
  ttlSeconds: number = 7 * 24 * 60 * 60 // Default 7 days
): Promise<boolean> {
  if (!revocationStore) {
    console.warn('[AUTH] No revocation store configured');
    return false;
  }
  
  await revocationStore.set(
    `${REVOCATION_PREFIX}${tokenId}`,
    JSON.stringify({ revokedAt: Date.now() }),
    ttlSeconds
  );
  
  return true;
}

export async function revokeAllUserTokens(
  userId: string,
  ttlSeconds: number = 7 * 24 * 60 * 60
): Promise<boolean> {
  if (!revocationStore) {
    console.warn('[AUTH] No revocation store configured');
    return false;
  }
  
  // Store a timestamp - any token issued before this is invalid
  await revocationStore.set(
    `${USER_REVOCATION_PREFIX}${userId}`,
    JSON.stringify({ revokedAt: Date.now() }),
    ttlSeconds
  );
  
  return true;
}

export async function isTokenRevoked(tokenId: string): Promise<boolean> {
  if (!revocationStore) return false;
  
  const data = await revocationStore.get(`${REVOCATION_PREFIX}${tokenId}`);
  return data !== null;
}

export async function isUserTokensRevoked(
  userId: string,
  tokenIssuedAt: number
): Promise<boolean> {
  if (!revocationStore) return false;
  
  const data = await revocationStore.get(`${USER_REVOCATION_PREFIX}${userId}`);
  if (!data) return false;
  
  const { revokedAt } = JSON.parse(data);
  return tokenIssuedAt < revokedAt;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN REFRESH
// ─────────────────────────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: GeneratedToken; refreshToken: GeneratedToken } | null> {
  const result = await verifyToken(refreshToken);
  
  if (!result.valid) {
    return null;
  }
  
  const { user } = result;
  
  // Check if user's tokens are revoked
  if (revocationStore) {
    const isRevoked = await isUserTokensRevoked(user.userId, user.issuedAt);
    if (isRevoked) {
      return null;
    }
  }
  
  // Generate new tokens
  const newAccessToken = generateAccessToken(user.userId, user.tier, {
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  });
  
  const newRefreshToken = generateRefreshToken(user.userId, user.tier);
  
  // Revoke old refresh token
  if (user.tokenId) {
    await revokeToken(user.tokenId);
  }
  
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export function extractApiKey(apiKeyHeader?: string): string | null {
  if (!apiKeyHeader || !apiKeyHeader.startsWith('nova_')) {
    return null;
  }
  return apiKeyHeader;
}

export function getTokenRemainingTime(expiresAt: number): number {
  return Math.max(0, expiresAt - Date.now());
}

export function isTokenExpiringSoon(expiresAt: number, thresholdMs: number = 5 * 60 * 1000): boolean {
  return getTokenRemainingTime(expiresAt) < thresholdMs;
}
