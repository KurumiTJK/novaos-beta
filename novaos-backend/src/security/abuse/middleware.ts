// ═══════════════════════════════════════════════════════════════════════════════
// ABUSE MIDDLEWARE — Express Abuse Detection Middleware
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/types.js';
import type { AbuseCheckResult } from './types.js';
import {
  getAbuseDetector,
  getBlockStore,
  getVetoHistoryStore,
  blockUser,
} from './detector.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────────

export const AbuseErrorCode = {
  USER_BLOCKED: 'USER_BLOCKED',
  ABUSE_DETECTED: 'ABUSE_DETECTED',
  ABUSE_WARNING: 'ABUSE_WARNING',
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export interface AbuseMiddlewareOptions {
  /** Skip paths */
  skipPaths?: string[];
  
  /** Field to check for content (default: 'message') */
  contentField?: string;
  
  /** Block duration in seconds when abuse detected */
  blockDurationSeconds?: number;
  
  /** Custom handler for abuse detection */
  onAbuse?: (req: AuthenticatedRequest, result: AbuseCheckResult) => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// BLOCK CHECK MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if user is blocked before processing request.
 * 
 * @example
 * app.use(blockCheck());
 */
export function blockCheck(options: { skipPaths?: string[] } = {}) {
  const { skipPaths = ['/health', '/ready'] } = options;
  
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Skip paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    const userId = req.userId ?? req.user?.userId ?? 'anonymous';
    
    // Anonymous users can't be blocked
    if (userId === 'anonymous') {
      return next();
    }
    
    try {
      const blockStatus = await getBlockStore().isBlocked(userId);
      
      if (blockStatus.blocked) {
        const retryAfter = blockStatus.remainingMs
          ? Math.ceil(blockStatus.remainingMs / 1000)
          : 3600;
        
        res.status(403).json({
          error: `Temporarily blocked: ${blockStatus.reason}`,
          code: AbuseErrorCode.USER_BLOCKED,
          retryAfter,
          until: blockStatus.until,
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('[ABUSE] Block check error:', error);
      next();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ABUSE DETECTION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check request content for abuse patterns.
 * 
 * @example
 * router.post('/chat', abuseDetection(), handler);
 * 
 * @example
 * router.post('/chat', abuseDetection({ contentField: 'text' }), handler);
 */
export function abuseDetection(options: AbuseMiddlewareOptions = {}) {
  const {
    skipPaths = [],
    contentField = 'message',
    blockDurationSeconds = 3600,
    onAbuse,
  } = options;
  
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Skip paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    const userId = req.userId ?? req.user?.userId ?? 'anonymous';
    const content = req.body?.[contentField];
    
    // No content to check
    if (!content || typeof content !== 'string') {
      return next();
    }
    
    try {
      // Get recent veto count
      let recentVetos = 0;
      if (userId !== 'anonymous') {
        recentVetos = await getVetoHistoryStore().getCount(userId);
      }
      
      // Check for abuse
      const result = getAbuseDetector().check(content, recentVetos);
      
      // Call custom handler if provided
      if (result.detected && onAbuse) {
        onAbuse(req, result);
      }
      
      // Attach result to request for downstream use
      (req as any).abuseCheck = result;
      
      // Block if necessary
      if (result.shouldBlock) {
        // Block the user
        if (userId !== 'anonymous') {
          const reason = `Abuse detected: ${result.patterns.map(p => p.type).join(', ')}`;
          await blockUser(userId, reason, blockDurationSeconds);
        }
        
        res.status(403).json({
          error: result.message ?? 'Request blocked due to policy violation',
          code: AbuseErrorCode.ABUSE_DETECTED,
          patterns: result.patterns.map(p => p.type),
        });
        return;
      }
      
      // Warn but allow (attach warning to response)
      if (result.shouldWarn && result.severity !== 'low') {
        res.setHeader('X-Abuse-Warning', 'true');
      }
      
      next();
    } catch (error) {
      console.error('[ABUSE] Detection error:', error);
      next();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Combined block check + abuse detection.
 * 
 * @example
 * router.post('/chat', abuseProtection(), handler);
 */
export function abuseProtection(options: AbuseMiddlewareOptions = {}) {
  const blockCheckMiddleware = blockCheck({ skipPaths: options.skipPaths });
  const abuseDetectionMiddleware = abuseDetection(options);
  
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // First check if blocked
    await new Promise<void>((resolve) => {
      blockCheckMiddleware(req, res, (err?: any) => {
        if (err || res.headersSent) {
          resolve();
        } else {
          resolve();
        }
      });
    });
    
    // If response already sent (user is blocked), don't continue
    if (res.headersSent) {
      return;
    }
    
    // Then check for abuse
    abuseDetectionMiddleware(req, res, next);
  };
}
