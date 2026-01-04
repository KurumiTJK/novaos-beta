// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES — Express Endpoints for NovaOS
// ═══════════════════════════════════════════════════════════════════════════════
//
// MIGRATED TO NEW SECURITY MODULE
//
// WORKING ENDPOINTS:
// - /health, /version, /providers (public)
// - /auth/* (authentication)
// - /chat (main pipeline)
// - /parse-command (action parsing)
// - /conversations/* (working memory)
// - /config (safe config view)
// - /admin/* (user management)
//
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from 'express';
import { ExecutionPipeline } from '../pipeline/execution-pipeline.js';
import { pipeline_model, model_llm, isOpenAIAvailable } from '../pipeline/llm_engine.js';
import type { PipelineContext, ActionSource } from '../types/index.js';
import { storeManager } from '../storage/index.js';
import { workingMemory } from '../core/memory/working_memory/index.js';
import { loadConfig, canVerify } from '../config/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// NEW SECURITY MODULE IMPORTS
// ─────────────────────────────────────────────────────────────────────────────────

import {
  // Auth
  type AuthenticatedRequest,
  authenticate,
  generateAccessToken,
  generateApiKey,
  getAckTokenStore,
  generateAckToken,
  
  // Rate limiting
  rateLimit,
  
  // Validation
  validateBody,
  validateQuery,
  validateParams,
  ChatMessageSchema,
  ParseCommandSchema,
  RegisterSchema,
  ConversationIdParamSchema,
  UpdateConversationSchema,
  ConversationQuerySchema,
  
  // Abuse detection
  abuseProtection,
  blockUser,
  unblockUser,
  isUserBlocked,
  trackVeto,
  getRecentVetoCount,
  
  // Audit
  logAudit,
  getAuditStore,
} from '../security/index.js';

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

export interface RouterConfig {
  requireAuth?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION STORE (simple in-memory, replace with Redis if needed)
// ─────────────────────────────────────────────────────────────────────────────────

const sessions = new Map<string, {
  userId: string;
  conversationId: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  tokenCount: number;
}>();

const sessionManager = {
  async create(userId: string, conversationId: string) {
    const session = {
      userId,
      conversationId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      tokenCount: 0,
    };
    sessions.set(conversationId, session);
    return session;
  },
  async get(conversationId: string) {
    return sessions.get(conversationId) ?? null;
  },
  async update(conversationId: string, updates: { messageCount?: number; tokenCount?: number }) {
    const session = sessions.get(conversationId);
    if (session) {
      session.lastActivity = Date.now();
      if (updates.messageCount) session.messageCount += updates.messageCount;
      if (updates.tokenCount) session.tokenCount += updates.tokenCount;
      sessions.set(conversationId, session);
    }
    return session;
  },
  async delete(conversationId: string) {
    sessions.delete(conversationId);
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTER FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Creates the API router with all endpoints.
 */
export async function createRouterAsync(config: RouterConfig = {}): Promise<Router> {
  const router = Router();
  const requireAuth = config.requireAuth ?? false;

  // Create pipeline (uses llm_engine.ts for model config)
  const pipeline = new ExecutionPipeline();

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC ENDPOINTS (no auth)
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      storage: storeManager.isUsingRedis() ? 'redis' : 'memory',
      verification: canVerify() ? 'enabled' : 'disabled',
    });
  });

  router.get('/version', (_req: Request, res: Response) => {
    const appConfig = loadConfig();
    res.json({
      api: '1.0.0',
      constitution: '1.2',
      gates: ['intent', 'shield', 'tools', 'stance', 'capability', 'response', 'constitution', 'memory'],
      models: {
        pipeline: pipeline_model,
        generation: model_llm,
      },
      features: [
        'auth',
        'rate-limiting',
        'abuse-detection',
        'redis-persistence',
        'audit-logging',
        'conversation-history',
        'structured-logging',
        'pipeline-integration',
        appConfig.verification.enabled ? 'verification' : null,
        appConfig.webFetch.enabled ? 'web-fetch' : null,
      ].filter(Boolean),
    });
  });

  router.get('/providers', (_req: Request, res: Response) => {
    res.json({
      available: isOpenAIAvailable() ? ['openai'] : [],
      models: {
        pipeline: pipeline_model,
        generation: model_llm,
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTH ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/auth/register',
    validateBody(RegisterSchema),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, tier = 'free' } = req.body;
        const userId = `user_${Buffer.from(email).toString('base64').slice(0, 16)}`;

        const accessToken = generateAccessToken(userId, tier, { email });
        const apiKey = generateApiKey(userId, tier, { email });

        res.json({
          userId,
          token: accessToken.token,
          apiKey: apiKey.token,
          tier,
          expiresAt: accessToken.expiresAt,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/auth/verify',
    authenticate({ required: true }),
    (req: AuthenticatedRequest, res: Response) => {
      res.json({
        valid: true,
        user: req.user,
      });
    }
  );

  router.get('/auth/status',
    authenticate({ required: false }),
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.userId ?? 'anonymous';
      const blocked = await isUserBlocked(userId);
      const recentVetos = await getRecentVetoCount(userId);

      res.json({
        authenticated: !!req.user && req.userId !== 'anonymous',
        userId,
        tier: req.user?.tier ?? 'free',
        blocked: blocked.blocked,
        blockedReason: blocked.reason,
        blockedUntil: blocked.until,
        recentVetos,
        storage: storeManager.isUsingRedis() ? 'redis' : 'memory',
      });
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PROTECTED MIDDLEWARE STACK
  // ─────────────────────────────────────────────────────────────────────────────

  // Chat endpoint middleware
  const chatMiddleware = [
    authenticate({ required: requireAuth }),
    rateLimit({ category: 'chat' }),
    validateBody(ChatMessageSchema),
    abuseProtection(),
  ];

  // Parse command middleware
  const parseCommandMiddleware = [
    authenticate({ required: requireAuth }),
    rateLimit({ category: 'chat' }),
    validateBody(ParseCommandSchema),
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // CHAT ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/chat',
    ...chatMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { message, conversationId, stance, actionSource } = req.body;
        const userId = req.userId ?? 'anonymous';

        // Build pipeline context
        const context: PipelineContext = {
          userId,
          conversationId,
          message,
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId ?? crypto.randomUUID(),
          requestedStance: stance,
          actionSource: actionSource as ActionSource,
          metadata: {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          },
        };

        // Execute pipeline
        const result = await pipeline.execute(context);

        // Log audit
        await logAudit({
          category: 'chat',
          action: 'chat_message',
          userId,
          details: {
            conversationId,
            stance: result.stance,
            mode: result.mode,
            hasVeto: !!result.veto,
          },
        });

        // Track veto if present
        if (result.veto) {
          await trackVeto(userId, result.veto.reason);
        }

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PARSE COMMAND ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/parse-command',
    ...parseCommandMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { message, conversationId } = req.body;
        const userId = req.userId ?? 'anonymous';

        const context: PipelineContext = {
          userId,
          conversationId,
          message,
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId ?? crypto.randomUUID(),
          actionSource: 'command',
          metadata: {},
        };

        const result = await pipeline.execute(context);

        res.json({
          parsed: true,
          intent: result.intent,
          stance: result.stance,
          response: result.response,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERSATION ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/conversations',
    authenticate({ required: true }),
    validateQuery(ConversationQuerySchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { limit = 50, offset = 0 } = req.query;
        const conversations = await workingMemory.listByUser(req.userId!, Number(limit), Number(offset));
        
        res.json({
          conversations,
          count: conversations.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/conversations/:id',
    authenticate({ required: true }),
    validateParams(ConversationIdParamSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;
        const { messagesLimit = 100 } = req.query;

        const conversation = await workingMemory.get(id);
        if (!conversation) {
          throw new ClientError('Conversation not found', 404);
        }

        if (conversation.userId !== req.userId) {
          throw new ClientError('Conversation not found', 404);
        }

        const messages = await workingMemory.getMessages(id, Number(messagesLimit));

        res.json({
          ...conversation,
          messages,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/conversations/:id/messages',
    authenticate({ required: true }),
    validateParams(ConversationIdParamSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;
        const { limit = 100, offset = 0 } = req.query;

        const conversation = await workingMemory.get(id);
        if (!conversation || conversation.userId !== req.userId) {
          throw new ClientError('Conversation not found', 404);
        }

        const messages = await workingMemory.getMessages(id, Number(limit));

        res.json({
          conversationId: id,
          messages: messages.slice(Number(offset)),
          count: messages.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch('/conversations/:id',
    authenticate({ required: true }),
    validateParams(ConversationIdParamSchema),
    validateBody(UpdateConversationSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;
        const { title, tags } = req.body;

        const conversation = await workingMemory.get(id);
        if (!conversation || conversation.userId !== req.userId) {
          throw new ClientError('Conversation not found', 404);
        }

        let updated = conversation;
        if (title) {
          updated = await workingMemory.updateTitle(id, title) ?? conversation;
        }
        if (tags && Array.isArray(tags)) {
          for (const tag of tags) {
            updated = await workingMemory.addTag(id, tag as string) ?? updated;
          }
        }

        res.json(updated);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete('/conversations/:id',
    authenticate({ required: true }),
    validateParams(ConversationIdParamSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;

        const conversation = await workingMemory.get(id);
        if (!conversation || conversation.userId !== req.userId) {
          throw new ClientError('Conversation not found', 404);
        }

        await workingMemory.delete(id);

        await logAudit({
          category: 'auth',
          action: 'delete_conversation',
          userId: req.userId!,
          details: { conversationId: id },
        });

        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIG ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/config',
    authenticate({ required: true }),
    async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const appConfig = loadConfig();
        
        res.json({
          environment: appConfig.environment,
          features: {
            verificationEnabled: appConfig.verification.enabled,
            webFetchEnabled: appConfig.webFetch.enabled,
            authRequired: appConfig.auth.required,
            debugMode: appConfig.observability.debugMode,
            redactPII: appConfig.observability.redactPII,
          },
          verification: {
            enabled: appConfig.verification.enabled,
            required: appConfig.verification.required,
            cacheTTLSeconds: appConfig.verification.cacheTTLSeconds,
            maxVerificationsPerRequest: appConfig.verification.maxVerificationsPerRequest,
          },
          webFetch: {
            enabled: appConfig.webFetch.enabled,
            maxSizeBytes: appConfig.webFetch.maxSizeBytes,
            maxRedirects: appConfig.webFetch.maxRedirects,
            totalTimeoutMs: appConfig.webFetch.totalTimeoutMs,
            allowlistEnabled: appConfig.webFetch.allowlist.length > 0,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/admin/block-user',
    authenticate({ required: true }),
    // TODO: Add requireAdmin() middleware
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { targetUserId, reason, durationMinutes } = req.body;
        
        if (!targetUserId || !reason) {
          throw new ClientError('targetUserId and reason required');
        }

        const durationSeconds = (durationMinutes ?? 60) * 60;
        await blockUser(targetUserId, reason, durationSeconds);

        await logAudit({
          category: 'admin',
          severity: 'warning',
          action: 'admin_block_user',
          userId: req.userId!,
          details: { targetUserId, reason, durationMinutes },
        });

        res.json({
          success: true,
          blockedUntil: Date.now() + durationSeconds * 1000,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/admin/unblock-user',
    authenticate({ required: true }),
    // TODO: Add requireAdmin() middleware
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { targetUserId } = req.body;
        
        if (!targetUserId) {
          throw new ClientError('targetUserId required');
        }

        const unblocked = await unblockUser(targetUserId);

        await logAudit({
          category: 'admin',
          action: 'admin_unblock_user',
          userId: req.userId!,
          details: { targetUserId },
        });

        res.json({
          success: unblocked,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/admin/audit-logs',
    authenticate({ required: true }),
    // TODO: Add requireAdmin() middleware
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { userId: targetUserId, limit = 100 } = req.query;

        const auditStore = getAuditStore();
        let logs;
        if (targetUserId && typeof targetUserId === 'string') {
          logs = await auditStore.getUserLogs(targetUserId, Number(limit));
        } else {
          logs = await auditStore.getGlobalLogs(Number(limit));
        }

        res.json({
          logs,
          count: logs.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

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

  const appConfig = loadConfig();
  const message = appConfig.environment === 'production'
    ? 'Internal server error'
    : error.message;

  res.status(500).json({
    error: message,
    code: 'INTERNAL_ERROR',
  });
}
