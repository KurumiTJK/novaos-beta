// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MODULE — Barrel Exports
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export type {
  UserTier,
  UserRole,
  JWTPayload,
  AuthenticatedUser,
  AuthenticatedRequest,
  TokenType,
  TokenConfig,
  GeneratedToken,
  TokenVerificationResult,
  TokenError,
  AuthEventType,
  AuthEvent,
  AuthMiddlewareOptions,
} from './types.js';

export {
  DEFAULT_PERMISSIONS,
  ROLE_PERMISSIONS,
  getDefaultPermissions,
  getRoleForTier,
} from './types.js';

// Tokens
export {
  initTokenConfig,
  setRevocationStore,
  getTokenConfig,
  generateAccessToken,
  generateRefreshToken,
  generateApiKey,
  verifyToken,
  verifyTokenSync,
  revokeToken,
  revokeAllUserTokens,
  isTokenRevoked,
  isUserTokensRevoked,
  refreshAccessToken,
  extractBearerToken,
  extractApiKey,
  getTokenRemainingTime,
  isTokenExpiringSoon,
} from './tokens.js';

// Middleware
export {
  authenticate,
  requireAuth,
  optionalAuth,
  requirePermission,
  requireAnyPermission,
  requireAdmin,
  requireTier,
  onAuthEvent,
  clearAuthEventHandlers,
  getAuthenticatedUser,
  getUserId,
  isAuthenticated,
  AuthErrorCode,
} from './middleware.js';

// Ack Tokens
export {
  generateAckToken,
  verifyAckToken,
  AckTokenStore,
  initAckTokenStore,
  getAckTokenStore,
  type AckTokenPayload,
} from './ack-token.js';
