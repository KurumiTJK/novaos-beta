// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MODULE — JWT Authentication, Rate Limiting, Abuse Detection
// ═══════════════════════════════════════════════════════════════════════════════

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface UserPayload {
  userId: string;
  email?: string;
  tier: 'free' | 'pro' | 'enterprise';
  createdAt: number;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
  userId?: string;
}

export interface RateLimitConfig {
  windowMs: number;      // Time window in ms
  maxRequests: number;   // Max requests per window
  maxTokens?: number;    // Max tokens per window (optional)
}

export interface RateLimitEntry {
  requests: number;
  tokens: number;
  windowStart: number;
  violations: number;
}

export interface AbusePattern {
  type: 'rapid_fire' | 'token_flood' | 'repeated_veto' | 'prompt_injection' | 'harassment';
  severity: 'low' | 'medium' | 'high';
  action: 'warn' | 'throttle' | 'block';
}

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMIT TIERS
// ─────────────────────────────────────────────────────────────────────────────────

export const RATE_LIMITS: Record<UserPayload['tier'], RateLimitConfig> = {
  free: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,          // 10 requests per minute
    maxTokens: 10000,         // 10k tokens per minute
  },
  pro: {
    windowMs: 60 * 1000,
    maxRequests: 60,          // 60 requests per minute
    maxTokens: 100000,        // 100k tokens per minute
  },
  enterprise: {
    windowMs: 60 * 1000,
    maxRequests: 300,         // 300 requests per minute
    maxTokens: 500000,        // 500k tokens per minute
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// IN-MEMORY STORES (Redis in Phase 4)
// ─────────────────────────────────────────────────────────────────────────────────

const rateLimitStore = new Map<string, RateLimitEntry>();
const blockedUsers = new Map<string, { until: number; reason: string }>();
const vetoHistory = new Map<string, { count: number; timestamps: number[] }>();

// ─────────────────────────────────────────────────────────────────────────────────
// JWT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'nova-dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '24h';

export function generateToken(payload: Omit<UserPayload, 'createdAt'>): string {
  const fullPayload: UserPayload = {
    ...payload,
    createdAt: Date.now(),
  };
  return jwt.sign(fullPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}

export function generateApiKey(userId: string, tier: UserPayload['tier']): string {
  // API keys are long-lived tokens with a specific prefix
  const payload: UserPayload = {
    userId,
    tier,
    createdAt: Date.now(),
  };
  return 'nova_' + jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

export function authMiddleware(required: boolean = true) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string | undefined;

    let token: string | undefined;

    // Check for Bearer token
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
    // Check for API key
    else if (apiKey?.startsWith('nova_')) {
      token = apiKey.slice(5);
    }

    if (!token) {
      if (required) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }
      // Anonymous user
      req.userId = 'anonymous';
      req.user = { userId: 'anonymous', tier: 'free', createdAt: Date.now() };
      next();
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({
        error: 'Invalid or expired token',
        code: 'AUTH_INVALID',
      });
      return;
    }

    req.user = payload;
    req.userId = payload.userId;
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMITING MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

export function rateLimitMiddleware() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = req.userId ?? 'anonymous';
    const tier = req.user?.tier ?? 'free';
    const config = RATE_LIMITS[tier];
    const now = Date.now();

    // Check if user is blocked
    const blocked = blockedUsers.get(userId);
    if (blocked && blocked.until > now) {
      res.status(429).json({
        error: `Temporarily blocked: ${blocked.reason}`,
        code: 'USER_BLOCKED',
        retryAfter: Math.ceil((blocked.until - now) / 1000),
      });
      return;
    } else if (blocked) {
      blockedUsers.delete(userId);
    }

    // Get or create rate limit entry
    let entry = rateLimitStore.get(userId);
    
    if (!entry || now - entry.windowStart >= config.windowMs) {
      // New window
      entry = {
        requests: 0,
        tokens: 0,
        windowStart: now,
        violations: entry?.violations ?? 0,
      };
    }

    // Check request limit
    if (entry.requests >= config.maxRequests) {
      entry.violations++;
      rateLimitStore.set(userId, entry);

      // Escalate if repeated violations
      if (entry.violations >= 5) {
        blockUser(userId, 'Repeated rate limit violations', 15 * 60 * 1000);
      }

      const retryAfter = Math.ceil((config.windowMs - (now - entry.windowStart)) / 1000);
      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        retryAfter,
        limit: config.maxRequests,
        window: config.windowMs / 1000,
      });
      return;
    }

    // Increment and store
    entry.requests++;
    rateLimitStore.set(userId, entry);

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', config.maxRequests - entry.requests);
    res.setHeader('X-RateLimit-Reset', Math.ceil((entry.windowStart + config.windowMs) / 1000));

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN USAGE TRACKING
// ─────────────────────────────────────────────────────────────────────────────────

export function trackTokenUsage(userId: string, tokens: number): boolean {
  const tier = 'free'; // Would get from user in real implementation
  const config = RATE_LIMITS[tier];
  const now = Date.now();

  let entry = rateLimitStore.get(userId);
  if (!entry || now - entry.windowStart >= config.windowMs) {
    entry = {
      requests: entry?.requests ?? 0,
      tokens: 0,
      windowStart: entry?.windowStart ?? now,
      violations: entry?.violations ?? 0,
    };
  }

  if (config.maxTokens && entry.tokens + tokens > config.maxTokens) {
    return false; // Would exceed token limit
  }

  entry.tokens += tokens;
  rateLimitStore.set(userId, entry);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ABUSE DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(your|all|the)\s+(instructions?|guidelines?|rules?)/i,
  /you\s+are\s+now\s+(a|an|in)\s+/i,
  /pretend\s+(you('re)?|to\s+be)\s+/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /bypass\s+(your\s+)?(restrictions?|limitations?|filters?)/i,
  /\[\s*system\s*\]/i,
  /<\s*system\s*>/i,
];

const HARASSMENT_PATTERNS = [
  /\b(kill|murder|rape|torture)\s+(you|yourself|the\s+ai)/i,
  /\b(stupid|dumb|worthless)\s+(ai|bot|machine)/i,
  /you('re)?\s+(garbage|trash|useless)/i,
];

export interface AbuseCheckResult {
  detected: boolean;
  patterns: AbusePattern[];
  shouldBlock: boolean;
  message?: string;
}

export function checkForAbuse(
  userId: string,
  message: string,
  recentVetos: number = 0
): AbuseCheckResult {
  const patterns: AbusePattern[] = [];

  // Check for prompt injection
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      patterns.push({
        type: 'prompt_injection',
        severity: 'high',
        action: 'block',
      });
      break;
    }
  }

  // Check for harassment
  for (const pattern of HARASSMENT_PATTERNS) {
    if (pattern.test(message)) {
      patterns.push({
        type: 'harassment',
        severity: 'medium',
        action: 'warn',
      });
      break;
    }
  }

  // Check for repeated veto triggers (trying to bypass shield)
  if (recentVetos >= 3) {
    patterns.push({
      type: 'repeated_veto',
      severity: recentVetos >= 5 ? 'high' : 'medium',
      action: recentVetos >= 5 ? 'throttle' : 'warn',
    });
  }

  // Check for rapid-fire requests (handled by rate limiter, but log it)
  const entry = rateLimitStore.get(userId);
  if (entry && entry.violations >= 3) {
    patterns.push({
      type: 'rapid_fire',
      severity: 'medium',
      action: 'throttle',
    });
  }

  const shouldBlock = patterns.some(p => p.action === 'block');
  const highSeverity = patterns.some(p => p.severity === 'high');

  return {
    detected: patterns.length > 0,
    patterns,
    shouldBlock,
    message: shouldBlock
      ? 'This request has been blocked due to policy violations.'
      : highSeverity
        ? 'Warning: Your request contains potentially problematic content.'
        : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// VETO TRACKING (for repeated bypass attempts)
// ─────────────────────────────────────────────────────────────────────────────────

export function trackVeto(userId: string): number {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minute window

  let history = vetoHistory.get(userId);
  if (!history) {
    history = { count: 0, timestamps: [] };
  }

  // Remove old timestamps
  history.timestamps = history.timestamps.filter(t => now - t < windowMs);
  
  // Add new
  history.timestamps.push(now);
  history.count = history.timestamps.length;
  
  vetoHistory.set(userId, history);

  return history.count;
}

export function getRecentVetoCount(userId: string): number {
  const history = vetoHistory.get(userId);
  if (!history) return 0;

  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  return history.timestamps.filter(t => now - t < windowMs).length;
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER BLOCKING
// ─────────────────────────────────────────────────────────────────────────────────

export function blockUser(userId: string, reason: string, durationMs: number): void {
  blockedUsers.set(userId, {
    until: Date.now() + durationMs,
    reason,
  });
  console.log(`[AUTH] Blocked user ${userId}: ${reason} for ${durationMs / 1000}s`);
}

export function unblockUser(userId: string): boolean {
  return blockedUsers.delete(userId);
}

export function isUserBlocked(userId: string): { blocked: boolean; reason?: string; until?: number } {
  const blocked = blockedUsers.get(userId);
  if (!blocked) return { blocked: false };
  
  if (blocked.until <= Date.now()) {
    blockedUsers.delete(userId);
    return { blocked: false };
  }
  
  return { blocked: true, reason: blocked.reason, until: blocked.until };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ABUSE DETECTION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

export function abuseDetectionMiddleware() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = req.userId ?? 'anonymous';
    const message = req.body?.message ?? '';

    if (!message) {
      next();
      return;
    }

    const recentVetos = getRecentVetoCount(userId);
    const abuseCheck = checkForAbuse(userId, message, recentVetos);

    if (abuseCheck.shouldBlock) {
      // Block user for 1 hour on severe abuse
      blockUser(userId, 'Abuse detected: ' + abuseCheck.patterns.map(p => p.type).join(', '), 60 * 60 * 1000);
      
      res.status(403).json({
        error: abuseCheck.message,
        code: 'ABUSE_DETECTED',
        patterns: abuseCheck.patterns.map(p => p.type),
      });
      return;
    }

    // Attach abuse info to request for logging
    (req as any).abuseCheck = abuseCheck;

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

interface Session {
  userId: string;
  conversationId: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  tokenCount: number;
}

const sessions = new Map<string, Session>();

export function createSession(userId: string, conversationId: string): Session {
  const session: Session = {
    userId,
    conversationId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    messageCount: 0,
    tokenCount: 0,
  };
  sessions.set(conversationId, session);
  return session;
}

export function getSession(conversationId: string): Session | undefined {
  return sessions.get(conversationId);
}

export function updateSession(
  conversationId: string,
  updates: Partial<Pick<Session, 'messageCount' | 'tokenCount'>>
): Session | undefined {
  const session = sessions.get(conversationId);
  if (!session) return undefined;

  session.lastActivity = Date.now();
  if (updates.messageCount !== undefined) {
    session.messageCount += updates.messageCount;
  }
  if (updates.tokenCount !== undefined) {
    session.tokenCount += updates.tokenCount;
  }

  sessions.set(conversationId, session);
  return session;
}

export function cleanupSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActivity > maxAgeMs) {
      sessions.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const auth = {
  generateToken,
  verifyToken,
  generateApiKey,
  middleware: authMiddleware,
  rateLimit: rateLimitMiddleware,
  abuseDetection: abuseDetectionMiddleware,
  trackVeto,
  trackTokenUsage,
  blockUser,
  unblockUser,
  isUserBlocked,
  session: {
    create: createSession,
    get: getSession,
    update: updateSession,
    cleanup: cleanupSessions,
  },
};
