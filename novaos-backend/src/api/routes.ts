// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES — Express Endpoints for NovaOS
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ExecutionPipeline, type PipelineConfig } from '../pipeline/execution-pipeline.js';
import type { PipelineContext, ActionSource } from '../types/index.js';
import {
  auth,
  type AuthenticatedRequest,
  type UserPayload,
  trackVeto,
  getRecentVetoCount,
  checkForAbuse,
} from '../auth/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(100000),
  conversationId: z.string().optional(),
  ackToken: z.string().optional(),
  context: z.object({
    timezone: z.string().optional(),
    locale: z.string().optional(),
  }).optional(),
});

const ParseCommandRequestSchema = z.object({
  command: z.string().min(1).max(10000),
  source: z.enum(['ui_button', 'command_parser', 'api_field']),
  conversationId: z.string().optional(),
});

const RegisterRequestSchema = z.object({
  email: z.string().email(),
  tier: z.enum(['free', 'pro', 'enterprise']).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class ClientError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ClientError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTER CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

export interface RouterConfig extends PipelineConfig {
  requireAuth?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTER FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

export function createRouter(config: RouterConfig = {}): Router {
  const router = Router();
  const pipeline = new ExecutionPipeline(config);
  const requireAuth = config.requireAuth ?? false;

  // Pending ack tokens (simple in-memory store)
  const pendingAckTokens = new Map<string, { createdAt: number; userId: string }>();

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC ENDPOINTS (no auth)
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  router.get('/version', (_req: Request, res: Response) => {
    res.json({
      api: '3.0.0',
      constitution: '1.2',
      gates: ['intent', 'shield', 'lens', 'stance', 'capability', 'model', 'personality', 'spark'],
      features: ['auth', 'rate-limiting', 'abuse-detection'],
    });
  });

  router.get('/providers', (_req: Request, res: Response) => {
    res.json({
      available: pipeline.getAvailableProviders(),
      preferred: config.preferredProvider ?? 'openai',
      useMock: config.useMockProvider ?? false,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTH ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  // Register/get token (simplified - production would use proper auth)
  router.post('/auth/register', (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = RegisterRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ClientError(
          `Invalid request: ${parseResult.error.issues.map(i => i.message).join(', ')}`
        );
      }

      const { email, tier = 'free' } = parseResult.data;
      const userId = `user_${Buffer.from(email).toString('base64').slice(0, 16)}`;

      const token = auth.generateToken({ userId, email, tier });
      const apiKey = auth.generateApiKey(userId, tier);

      res.json({
        userId,
        token,
        apiKey,
        tier,
        expiresIn: '24h',
      });
    } catch (error) {
      next(error);
    }
  });

  // Verify token
  router.get('/auth/verify', auth.middleware(true), (req: AuthenticatedRequest, res: Response) => {
    res.json({
      valid: true,
      user: req.user,
    });
  });

  // Get current user status
  router.get('/auth/status', auth.middleware(false), (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId ?? 'anonymous';
    const blocked = auth.isUserBlocked(userId);
    const recentVetos = getRecentVetoCount(userId);

    res.json({
      authenticated: !!req.user && req.userId !== 'anonymous',
      userId,
      tier: req.user?.tier ?? 'free',
      blocked: blocked.blocked,
      blockedReason: blocked.reason,
      blockedUntil: blocked.until,
      recentVetos,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PROTECTED ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  // Apply auth, rate limiting, and abuse detection to chat endpoints
  const protectedMiddleware = [
    auth.middleware(requireAuth),
    auth.rateLimit(),
    auth.abuseDetection(),
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // CHAT ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/chat', ...protectedMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Validate request
      const parseResult = ChatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ClientError(
          `Invalid request: ${parseResult.error.issues.map(i => i.message).join(', ')}`
        );
      }

      const { message, conversationId, ackToken, context: reqContext } = parseResult.data;
      const userId = req.userId ?? 'anonymous';

      // Get or create session
      const convId = conversationId ?? crypto.randomUUID();
      let session = auth.session.get(convId);
      if (!session) {
        session = auth.session.create(userId, convId);
      }

      // Build pipeline context
      const pipelineContext: PipelineContext = {
        userId,
        conversationId: convId,
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        actionSources: [],
        timezone: reqContext?.timezone,
        locale: reqContext?.locale,
      };

      // Validate ack token if provided
      if (ackToken) {
        const pending = pendingAckTokens.get(ackToken);
        if (pending && pending.userId === userId) {
          pipelineContext.ackTokenValid = true;
          pendingAckTokens.delete(ackToken);
        } else {
          throw new ClientError('Invalid or expired acknowledgment token');
        }
      }

      // Execute pipeline
      const result = await pipeline.execute(message, pipelineContext);

      // Track veto if shield stopped or awaited
      if (result.status === 'stopped' || result.status === 'await_ack') {
        trackVeto(userId);
      }

      // Update session
      auth.session.update(convId, {
        messageCount: 1,
        tokenCount: result.gateResults.model?.output?.tokensUsed ?? 0,
      });

      // Track token usage
      if (result.gateResults.model?.output?.tokensUsed) {
        auth.trackTokenUsage(userId, result.gateResults.model.output.tokensUsed);
      }

      // Store ack token if returned
      if (result.ackToken) {
        pendingAckTokens.set(result.ackToken, {
          createdAt: Date.now(),
          userId,
        });
        
        // Clean old tokens (5 min expiry)
        const now = Date.now();
        for (const [token, data] of pendingAckTokens.entries()) {
          if (now - data.createdAt > 300000) {
            pendingAckTokens.delete(token);
          }
        }
      }

      // Include session info in response
      res.json({
        ...result,
        session: {
          conversationId: convId,
          messageCount: session.messageCount + 1,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PARSE COMMAND ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/parse-command', ...protectedMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = ParseCommandRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ClientError(
          `Invalid request: ${parseResult.error.issues.map(i => i.message).join(', ')}`
        );
      }

      const { command, source, conversationId } = parseResult.data;

      const actionSource: ActionSource = {
        type: source,
        action: command,
        timestamp: Date.now(),
      };

      const pipelineContext: PipelineContext = {
        userId: req.userId ?? 'anonymous',
        conversationId: conversationId ?? crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        actionSources: [actionSource],
      };

      const result = await pipeline.execute(command, pipelineContext);

      res.json({
        ...result,
        parsedAction: actionSource,
      });
    } catch (error) {
      next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS (would be more restricted in production)
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/admin/block-user', auth.middleware(true), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // In production, check for admin role
      const { targetUserId, reason, durationMinutes } = req.body;
      
      if (!targetUserId || !reason) {
        throw new ClientError('targetUserId and reason required');
      }

      const durationMs = (durationMinutes ?? 60) * 60 * 1000;
      auth.blockUser(targetUserId, reason, durationMs);

      res.json({
        success: true,
        blockedUntil: Date.now() + durationMs,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/unblock-user', auth.middleware(true), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { targetUserId } = req.body;
      
      if (!targetUserId) {
        throw new ClientError('targetUserId required');
      }

      const unblocked = auth.unblockUser(targetUserId);

      res.json({
        success: unblocked,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR HANDLER MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[API] Error:', error);

  if (error instanceof ClientError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: 'CLIENT_ERROR',
    });
    return;
  }

  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message;

  res.status(500).json({
    error: message,
    code: 'INTERNAL_ERROR',
  });
}
