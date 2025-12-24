// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT MIDDLEWARE — GDPR Consent Enforcement
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// Express middleware for enforcing consent requirements:
//   - requireConsent(): Block requests without required consent
//   - checkConsent(): Add consent status to request
//   - auditConsentAccess(): Log consent-protected access
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { UserId } from '../../types/branded.js';
import type { ConsentPurpose, IConsentStore, UserConsent } from './types.js';
import { REQUIRED_PURPOSES, isRequiredPurpose } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extended request with consent information.
 */
export interface ConsentRequest extends Request {
  /** User ID from auth middleware */
  userId?: string;

  /** User's consent state */
  consent?: UserConsent | null;

  /** Quick access to consent checks */
  hasConsent?: (purpose: ConsentPurpose) => boolean;

  /** Whether all required consents are present */
  hasRequiredConsents?: boolean;
}

/**
 * Options for consent middleware.
 */
export interface ConsentMiddlewareOptions {
  /** Consent store instance */
  store: IConsentStore;

  /** Whether to block on missing consent (default: true) */
  blockOnMissing?: boolean;

  /** Custom error message */
  errorMessage?: string;

  /** Custom error status code (default: 403) */
  errorStatus?: number;

  /** Skip consent check for these paths */
  skipPaths?: readonly string[];

  /** Log consent checks to audit */
  auditLog?: boolean;
}

/**
 * Response for consent errors.
 */
export interface ConsentErrorResponse {
  error: string;
  code: string;
  requiredConsents?: readonly ConsentPurpose[];
  missingConsents?: readonly ConsentPurpose[];
  consentUrl?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create consent middleware factory with shared store.
 */
export function createConsentMiddleware(options: ConsentMiddlewareOptions) {
  const {
    store,
    blockOnMissing = true,
    errorMessage = 'Consent required to access this resource',
    errorStatus = 403,
    skipPaths = [],
    auditLog = false,
  } = options;

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD CONSENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Load consent state into request (always runs, doesn't block).
   */
  const loadConsent: RequestHandler = async (
    req: ConsentRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Skip if no user ID
      if (!req.userId) {
        req.consent = null;
        req.hasRequiredConsents = false;
        req.hasConsent = () => false;
        next();
        return;
      }

      // Get consent from store
      const result = await store.getConsent(req.userId as UserId);
      
      if (result.ok) {
        req.consent = result.value;
        req.hasRequiredConsents = result.value?.hasRequiredConsents ?? false;
        req.hasConsent = (purpose: ConsentPurpose) => {
          return result.value?.purposes[purpose]?.granted ?? false;
        };
      } else {
        req.consent = null;
        req.hasRequiredConsents = false;
        req.hasConsent = () => false;
      }

      next();
    } catch (error) {
      // On error, allow request but mark consent as unknown
      req.consent = null;
      req.hasRequiredConsents = false;
      req.hasConsent = () => false;
      next();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // REQUIRE CONSENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Require specific consent(s) to proceed.
   */
  function requireConsent(
    ...purposes: ConsentPurpose[]
  ): RequestHandler {
    return async (
      req: ConsentRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      // Skip for configured paths
      if (skipPaths.some(path => req.path.startsWith(path))) {
        next();
        return;
      }

      // Ensure consent is loaded
      if (req.consent === undefined) {
        await new Promise<void>((resolve) => {
          loadConsent(req, res, () => resolve());
        });
      }

      // Check if user ID exists
      if (!req.userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      // If no purposes specified, check required consents
      const purposesToCheck = purposes.length > 0 ? purposes : [...REQUIRED_PURPOSES];

      // Check each required purpose
      const missingConsents: ConsentPurpose[] = [];
      for (const purpose of purposesToCheck) {
        if (!req.hasConsent?.(purpose)) {
          missingConsents.push(purpose);
        }
      }

      // If missing consents and blocking is enabled
      if (missingConsents.length > 0 && blockOnMissing) {
        const response: ConsentErrorResponse = {
          error: errorMessage,
          code: 'CONSENT_REQUIRED',
          requiredConsents: purposesToCheck,
          missingConsents,
          consentUrl: '/api/consent', // Where to grant consent
        };

        res.status(errorStatus).json(response);
        return;
      }

      next();
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REQUIRE ALL REQUIRED CONSENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Require all required consents (shortcut).
   */
  const requireRequiredConsents: RequestHandler = async (
    req: ConsentRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    return requireConsent(...REQUIRED_PURPOSES)(req, res, next);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK CONSENT (NON-BLOCKING)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check consent and add to request, but don't block.
   * Use when consent affects behavior but isn't required.
   */
  const checkConsent: RequestHandler = async (
    req: ConsentRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Just load consent, don't block
    return loadConsent(req, res, next);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE-GATED BY CONSENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create middleware that gates a feature based on consent.
   * If consent not granted, returns 403 with feature info.
   */
  function requireFeatureConsent(
    purpose: ConsentPurpose,
    featureName: string
  ): RequestHandler {
    return async (
      req: ConsentRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      // Ensure consent is loaded
      if (req.consent === undefined) {
        await new Promise<void>((resolve) => {
          loadConsent(req, res, () => resolve());
        });
      }

      if (!req.hasConsent?.(purpose)) {
        res.status(403).json({
          error: `Feature "${featureName}" requires consent`,
          code: 'FEATURE_CONSENT_REQUIRED',
          feature: featureName,
          requiredConsent: purpose,
          consentUrl: '/api/consent',
        });
        return;
      }

      next();
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RETURN MIDDLEWARE FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  return {
    /** Load consent into request (non-blocking) */
    loadConsent,

    /** Require specific consent(s) to proceed */
    requireConsent,

    /** Require all required consents */
    requireRequiredConsents,

    /** Check consent but don't block */
    checkConsent,

    /** Gate a feature behind consent */
    requireFeatureConsent,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANDALONE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract missing consents from a request.
 */
export function getMissingConsents(
  req: ConsentRequest,
  required: readonly ConsentPurpose[]
): ConsentPurpose[] {
  const missing: ConsentPurpose[] = [];
  
  for (const purpose of required) {
    if (!req.hasConsent?.(purpose)) {
      missing.push(purpose);
    }
  }
  
  return missing;
}

/**
 * Check if request has consent for personalization features.
 */
export function canPersonalize(req: ConsentRequest): boolean {
  return req.hasConsent?.('personalization') ?? false;
}

/**
 * Check if request has consent for analytics.
 */
export function canTrackAnalytics(req: ConsentRequest): boolean {
  return req.hasConsent?.('analytics') ?? false;
}

/**
 * Check if request has consent for notifications.
 */
export function canSendNotifications(req: ConsentRequest): boolean {
  return req.hasConsent?.('notifications') ?? false;
}

/**
 * Check if request has consent for third-party sharing.
 */
export function canShareWithThirdParties(req: ConsentRequest): boolean {
  return req.hasConsent?.('thirdPartySharing') ?? false;
}

/**
 * Check if request has consent for marketing.
 */
export function canSendMarketing(req: ConsentRequest): boolean {
  return req.hasConsent?.('marketing') ?? false;
}
