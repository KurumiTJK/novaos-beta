// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE INDEX — All API Middleware Exports
// Phase 20: Production Hardening
// ═══════════════════════════════════════════════════════════════════════════════

// Request handling
export {
  requestMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
} from './request.js';

// Security
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

// Input sanitization
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
