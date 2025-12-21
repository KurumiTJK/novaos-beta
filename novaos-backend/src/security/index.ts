// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MODULE INDEX — NovaOS Security Infrastructure
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides comprehensive security infrastructure for NovaOS:
//
// - Authentication: JWT tokens, verification, revocation
// - Authorization: Ownership checks, permissions, roles
// - Rate Limiting: Token bucket algorithm, tiered limits
// - Validation: Zod-based input validation
// - Encryption: AES-256-GCM encryption at rest
// - Audit: Security event logging
//
// Usage:
//
//   import { 
//     authenticate, 
//     requireOwnership, 
//     rateLimit, 
//     validateBody 
//   } from './security/index.js';
//
//   router.post('/goals',
//     authenticate(),
//     rateLimit({ category: 'GOAL_CREATION' }),
//     validateBody(CreateGoalSchema),
//     createGoalHandler
//   );
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
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
  type TokenConfig,
  type AuthMiddlewareOptions,
  // Context helpers
  createAnonymousContext,
  createUserContext,
  createServiceContext,
  fromLegacyPayload,
  toLegacyPayload,
  getDefaultPermissions,
  // Token management
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
  // Middleware
  authenticate,
  requireAuth,
  optionalAuth,
  legacyAuthBridge,
  buildContext,
  onAuthEvent,
  clearAuthEventHandlers,
  AuthErrorCode,
} from './auth/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHORIZATION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
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
  type OwnershipOptions,
  type PermissionOptions,
  type RoleOptions,
  // Result helpers
  allowed,
  denied,
  createAuthContext,
  withResource,
  // Ownership
  OwnershipChecker,
  getOwnershipChecker,
  initOwnershipChecker,
  resetOwnershipChecker,
  userOwnsGoal,
  userOwnsQuest,
  userOwnsStep,
  userOwnsSpark,
  userOwnsReminder,
  // Policies
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
  // Middleware
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
} from './authorization/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type RateLimitConfig,
  type TierRateLimits,
  type RateLimitContext,
  type RateLimitResult,
  type RateLimiter,
  type RateLimitEvent,
  type RateLimitOptions,
  type EndpointCategory,
  // Result helpers
  createAllowedResult,
  createDeniedResult,
  // Key generators
  keyByUser,
  keyByIp,
  keyByUserAndPath,
  keyByIpAndPath,
  keyByUserOrIp,
  // Limiters
  TokenBucketLimiter,
  SlidingWindowLimiter,
  getTokenBucketLimiter,
  getSlidingWindowLimiter,
  getRateLimiter,
  initRateLimiter,
  resetRateLimiter,
  // Config
  DEFAULT_TIER_LIMITS,
  ANONYMOUS_LIMIT,
  EndpointLimits,
  PATH_PATTERNS,
  SKIP_PATHS,
  getCategoryForPath,
  getLimitForPath,
  getAnonymousLimit,
  getRateLimitMultiplier,
  applyMultiplier,
  isRateLimitingEnabled,
  shouldSkipRateLimit,
  // Middleware
  rateLimit,
  chatRateLimit,
  goalCreationRateLimit,
  sparkGenerationRateLimit,
  webFetchRateLimit,
  authRateLimit,
  adminRateLimit,
  strictRateLimit,
  ipRateLimit,
  getRateLimitStatus,
  resetUserRateLimit,
  resetIpRateLimit,
  onRateLimitEvent,
  clearRateLimitEventHandlers,
} from './rate-limiting/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Middleware
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validate,
  ValidationErrorCode,
  type ValidationError,
  type FieldError,
  type ValidationOptions,
  type RequestSchema,
  type ValidatedRequest,
  type InferSchema,
  // Common schemas
  IdParamSchema,
  UuidParamSchema,
  PaginationSchema,
  SearchSchema,
  DateRangeSchema,
  // Custom validators
  nonEmptyString,
  boundedString,
  email,
  url,
  positiveInt,
  nonNegativeInt,
  isoDateString,
  slug,
  // Entity schemas
  BaseEntitySchema,
  StatusSchema,
  PrioritySchema,
  type Status,
  type Priority,
  // Goal schemas
  CreateGoalSchema,
  UpdateGoalSchema,
  GoalQuerySchema,
  type CreateGoalInput,
  type UpdateGoalInput,
  type GoalQuery,
  // Quest schemas
  CreateQuestSchema,
  UpdateQuestSchema,
  type CreateQuestInput,
  type UpdateQuestInput,
  // Step schemas
  CreateStepSchema,
  UpdateStepSchema,
  type CreateStepInput,
  type UpdateStepInput,
  // Spark schemas
  SparkTypeSchema,
  CreateSparkSchema,
  GenerateSparkSchema,
  SparkResponseSchema,
  type SparkType,
  type CreateSparkInput,
  type GenerateSparkInput,
  type SparkResponseInput,
  // Reminder schemas
  ReminderFrequencySchema,
  CreateReminderSchema,
  type ReminderFrequency,
  type CreateReminderInput,
  // Chat schemas
  ChatMessageSchema,
  type ChatMessageInput,
  // Memory schemas
  MemoryTypeSchema,
  CreateMemorySchema,
  MemoryQuerySchema,
  type MemoryType,
  type CreateMemoryInput,
  type MemoryQuery,
  // Preferences
  UserPreferencesSchema,
  type UserPreferencesInput,
  // Auth schemas
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  type LoginInput,
  type RegisterInput,
  type RefreshTokenInput,
  // Param schemas
  GoalIdParamSchema,
  QuestIdParamSchema,
  StepIdParamSchema,
  SparkIdParamSchema,
} from './validation/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENCRYPTION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type EncryptionKey,
  type EncryptedEnvelope,
  type SerializedEnvelope,
  type KeyDerivationOptions,
  type EncryptionOptions,
  type DecryptionOptions,
  // Key Manager
  KeyManager,
  // Encryption Service
  EncryptionService,
  getEncryptionService,
  initEncryptionService,
  resetEncryptionService,
  // Convenience functions
  encrypt,
  decrypt,
  generateKeyBase64,
  hashForLogging,
} from './encryption/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// AUDIT
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Types
  type AuditSeverity,
  type AuditCategory,
  type AuditEvent,
  type CreateAuditEventOptions,
  // Store
  SecurityAuditStore,
  // Logger
  SecurityAuditLogger,
  getSecurityAuditLogger,
  initSecurityAuditLogger,
  resetSecurityAuditLogger,
  wireSecurityAuditLogger,
} from './audit/index.js';
