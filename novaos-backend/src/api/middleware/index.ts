// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE INDEX — All API Middleware Exports
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST HANDLING
// ─────────────────────────────────────────────────────────────────────────────────

export {
  requestMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
} from './request.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY
// ─────────────────────────────────────────────────────────────────────────────────

export {
  securityHeaders,
  contentSecurityPolicy,
  corsMiddleware,
  httpsRedirect,
  requestLimits,
  ipFilter,
  applySecurity,
  helmet,
  loadSecurityConfig,
  getClientIP,
  type SecurityConfig,
  type CSPDirectives,
  type CORSConfig,
  type RequestLimits,
  type IPFilterConfig,
  type SecurityOptions,
} from './security.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INPUT SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────────

export {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  sanitizeRequest,
  sanitizeValue,
  sanitizers,
  validators,
  loadSanitizationConfig,
  type SanitizationConfig,
  type SanitizationResult,
} from './sanitization.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Error handler middleware
  errorHandler,
  asyncHandler,
  
  // Error classes
  ApiError,
  ClientError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  InternalError,
  
  // Types
  type ErrorResponse,
} from './error-handler.js';

// ─────────────────────────────────────────────────────────────────────────────────
// NOT FOUND HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export {
  notFound,
  notFoundHandler,
} from './not-found.js';
