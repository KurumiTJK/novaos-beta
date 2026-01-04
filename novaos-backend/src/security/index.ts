// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MODULE — Unified Security Infrastructure
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides comprehensive security infrastructure for NovaOS:
//
// - Authentication: JWT tokens, verification, revocation, refresh
// - Authorization: Permission checks, ownership verification
// - Rate Limiting: Token bucket algorithm, tiered limits
// - Validation: Zod-based input validation
// - Abuse Detection: Prompt injection, harassment, blocking
// - SSRF Protection: Prevent internal network access
// - Audit Logging: Security event tracking
//
// Usage:
//
//   import { 
//     initSecurity,
//     authenticate, 
//     rateLimit, 
//     validateBody,
//     abuseProtection,
//   } from './security/index.js';
//
//   // Initialize on startup
//   await initSecurity(store);
//
//   // Apply middleware
//   router.post('/chat',
//     authenticate(),
//     rateLimit({ category: 'chat' }),
//     validateBody(ChatMessageSchema),
//     abuseProtection(),
//     chatHandler
//   );
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS: AUTH
// ─────────────────────────────────────────────────────────────────────────────────

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
} from './auth/index.js';

export {
  DEFAULT_PERMISSIONS,
  ROLE_PERMISSIONS,
  getDefaultPermissions,
  getRoleForTier,
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
  generateAckToken,
  verifyAckToken,
  AckTokenStore,
  initAckTokenStore,
  getAckTokenStore,
} from './auth/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS: RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  RateLimitConfig,
  TierRateLimits,
  RateLimitResult,
  RateLimitContext,
  RateLimitMiddlewareOptions,
  RateLimitEventType,
  RateLimitEvent,
  EndpointCategory,
} from './rate-limiting/index.js';

export {
  DEFAULT_TIER_LIMITS,
  ANONYMOUS_LIMIT,
  ENDPOINT_LIMITS,
  RateLimiter,
  IpRateLimiter,
  initRateLimiter,
  getRateLimiter,
  initIpRateLimiter,
  getIpRateLimiter,
  rateLimit,
  chatRateLimit,
  authRateLimit,
  adminRateLimit,
  expensiveRateLimit,
  ipRateLimit,
  onRateLimitEvent,
  clearRateLimitEventHandlers,
  resetUserRateLimit,
  resetIpRateLimit,
  getRateLimitStatus,
  RateLimitErrorCode,
} from './rate-limiting/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS: VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validate,
  ValidationErrorCode,
} from './validation/index.js';

export type {
  ValidationError,
  FieldError,
  ValidationOptions,
  RequestSchemas,
} from './validation/index.js';

// Schemas
export {
  // Common
  nonEmptyString,
  boundedString,
  email,
  url,
  positiveInt,
  nonNegativeInt,
  isoDateString,
  slug,
  IdParamSchema,
  UuidParamSchema,
  PaginationSchema,
  SearchSchema,
  DateRangeSchema,
  StatusSchema,
  PrioritySchema,
  // Chat
  ChatMessageSchema,
  ParseCommandSchema,
  ConversationIdParamSchema,
  UpdateConversationSchema,
  ConversationQuerySchema,
  // Auth
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  CreateApiKeySchema,
} from './validation/index.js';

export type {
  PaginationInput,
  SearchInput,
  DateRangeInput,
  Status,
  Priority,
  ChatMessageInput,
  ParseCommandInput,
  UpdateConversationInput,
  ConversationQueryInput,
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  CreateApiKeyInput,
} from './validation/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS: ABUSE DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  AbuseType,
  AbuseSeverity,
  AbuseAction,
  AbusePattern,
  AbuseCheckResult,
  BlockStatus,
  VetoStatus,
  AbuseConfig,
  AbuseEventType,
  AbuseEvent,
  AbuseMiddlewareOptions,
} from './abuse/index.js';

export {
  DEFAULT_ABUSE_CONFIG,
  PROMPT_INJECTION_PATTERNS,
  HARASSMENT_PATTERNS,
  SPAM_PATTERNS,
  AbuseDetector,
  BlockStore,
  VetoHistoryStore,
  initAbuseDetector,
  getAbuseDetector,
  initBlockStore,
  getBlockStore,
  initVetoHistoryStore,
  getVetoHistoryStore,
  checkForAbuse,
  blockUser,
  unblockUser,
  isUserBlocked,
  trackVeto,
  getRecentVetoCount,
  onAbuseEvent,
  clearAbuseEventHandlers,
  blockCheck,
  abuseDetection,
  abuseProtection,
  AbuseErrorCode,
} from './abuse/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS: SSRF PROTECTION
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  SSRFValidationResult,
  SSRFConfig,
} from './ssrf/index.js';

export {
  DEFAULT_SSRF_CONFIG,
  SSRFGuard,
  initSSRFGuard,
  getSSRFGuard,
  validateUrl,
  isUrlSafe,
  isPrivateIp,
} from './ssrf/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS: AUDIT
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  AuditCategory,
  AuditSeverity,
  AuditEvent,
  CreateAuditEventOptions,
} from './audit/index.js';

export {
  AuditStore,
  initAuditStore,
  getAuditStore,
  logAudit,
  logAuthEvent,
  logSecurityWarning,
  logSecurityError,
} from './audit/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface SecurityInitOptions {
  /** Token configuration */
  tokenConfig?: Partial<import('./auth/types.js').TokenConfig>;
  
  /** Abuse detection configuration */
  abuseConfig?: Partial<import('./abuse/types.js').AbuseConfig>;
  
  /** SSRF protection configuration */
  ssrfConfig?: Partial<import('./ssrf/index.js').SSRFConfig>;
}

/**
 * Initialize all security modules.
 * Call this on server startup.
 * 
 * @example
 * import { initSecurity } from './security/index.js';
 * import { getStore } from './storage/index.js';
 * 
 * await initSecurity(getStore());
 */
export function initSecurity(
  store: KeyValueStore,
  options: SecurityInitOptions = {}
): void {
  // Initialize token config
  if (options.tokenConfig) {
    initTokenConfig(options.tokenConfig);
  }
  
  // Set revocation store for tokens
  setRevocationStore(store);
  
  // Initialize rate limiter
  initRateLimiter(store);
  initIpRateLimiter(store);
  
  // Initialize abuse detection
  if (options.abuseConfig) {
    initAbuseDetector(options.abuseConfig);
  }
  initBlockStore(store);
  initVetoHistoryStore(store);
  
  // Initialize ack token store (uses defaults, not the KeyValueStore)
  initAckTokenStore();
  
  // Initialize SSRF guard
  if (options.ssrfConfig) {
    initSSRFGuard(options.ssrfConfig);
  }
  
  // Initialize audit store
  initAuditStore(store);
  
  console.log('[SECURITY] All security modules initialized');
}

// Import for init function
import { initTokenConfig, setRevocationStore } from './auth/index.js';
import { initRateLimiter, initIpRateLimiter } from './rate-limiting/index.js';
import { initAbuseDetector, initBlockStore, initVetoHistoryStore } from './abuse/index.js';
import { initAckTokenStore } from './auth/index.js';
import { initSSRFGuard } from './ssrf/index.js';
import { initAuditStore } from './audit/index.js';
