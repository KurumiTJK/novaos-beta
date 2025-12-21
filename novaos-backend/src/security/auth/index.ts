// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MODULE INDEX — Authentication Exports
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export {
  type UserTier,
  type UserRole,
  type Permission,
  type UserMetadata,
  type AuthenticatedUser,
  type JWTPayload,
  type ServiceIdentity,
  type RequestContext,
  type SecureRequest,
  type TokenVerificationResult,
  type TokenError,
  type AuthEvent,
  type LegacyUserPayload,
  type GeneratedToken,
  createAnonymousContext,
  createUserContext,
  createServiceContext,
  fromLegacyPayload,
  toLegacyPayload,
  getDefaultPermissions,
} from './types.js';

// Tokens
export {
  type TokenConfig,
  initTokenConfig,
  getTokenConfig,
  generateAccessToken,
  generateRefreshToken,
  generateApiKey,
  generateServiceToken,
  verifyToken,
  verifyTokenSync,
  decodeToken,
  revokeToken,
  revokeTokenByValue,
  revokeAllUserTokens,
  isTokenRevoked,
  areUserTokensRevoked,
  clearUserTokenRevocation,
  refreshToken,
  extractBearerToken,
  extractApiKey,
  getTokenRemainingTime,
  isTokenExpired,
  TokenRevocationStore,
  resetTokenConfig,
  setRevocationStore,
  resetRevocationStore,
} from './tokens.js';

// Middleware
export {
  authenticate,
  requireAuth,
  optionalAuth,
  legacyAuthBridge,
  buildContext,
  onAuthEvent,
  clearAuthEventHandlers,
  AuthErrorCode,
  type AuthErrorCode as AuthErrorCodeType,
  type AuthMiddlewareOptions,
} from './middleware.js';
