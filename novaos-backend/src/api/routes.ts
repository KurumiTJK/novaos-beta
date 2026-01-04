// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES — Express Endpoints for NovaOS
// ═══════════════════════════════════════════════════════════════════════════════
//
// CLEANED: Removed dead Sword and Semantic Memory endpoints
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
import { z } from 'zod';
import { ExecutionPipeline } from '../pipeline/execution-pipeline.js';
import { pipeline_model, model_llm, isOpenAIAvailable } from '../pipeline/llm_engine.js';
import type { PipelineContext, ActionSource } from '../types/index.js';
import { storeManager } from '../storage/index.js';
import {
  auth,
  type AuthenticatedRequest,
  trackVeto,
  getRecentVetoCount,
} from '../auth/index.js';
import { workingMemory } from '../core/memory/working_memory/index.js';
import { loadConfig, canVerify } from '../config/index.js';

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

export interface RouterConfig {
  requireAuth?: boolean;
}

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
        appConfig.features.verificationEnabled ? 'verification' : null,
        appConfig.features.webFetchEnabled ? 'web-fetch' : null,
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

  router.get('/auth/verify', auth.middleware(true), (req: AuthenticatedRequest, res: Response) => {
    res.json({
      valid: true,
      user: req.user,
    });
  });

  router.get('/auth/status', auth.middleware(false), async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId ?? 'anonymous';
    const blocked = await auth.isUserBlocked(userId);
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
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PROTECTED ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

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
      const parseResult = ChatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ClientError(
          `Invalid request: ${parseResult.error.issues.map(i => i.message).join(', ')}`
        );
      }

      const { message, conversationId, ackToken, context: reqContext } = parseResult.data;
      const userId = req.userId ?? 'anonymous';
      const requestId = crypto.randomUUID();

      const convId = conversationId ?? crypto.randomUUID();
      
      // SECURITY: Verify ownership if conversationId provided
      if (conversationId) {
        const isOwner = await workingMemory.verifyOwnership(conversationId, userId);
        if (!isOwner) {
          const existing = await workingMemory.get(conversationId);
          if (existing) {
            throw new ClientError('Conversation not found', 404);
          }
        }
      }
      
      const conversation = await workingMemory.getOrCreate(userId, convId);
      
      let session = await auth.session.get(convId);
      if (!session) {
        session = await auth.session.create(userId, convId);
      }

      await workingMemory.addUserMessage(convId, message);

      const contextWindow = await workingMemory.buildContext(convId);

      const pipelineContext: PipelineContext = {
        userId,
        conversationId: convId,
        requestId,
        timestamp: Date.now(),
        actionSources: [],
        timezone: reqContext?.timezone,
        locale: reqContext?.locale,
        conversationHistory: contextWindow.messages.slice(0, -1).map(m => ({
          role: m.role,
          content: m.content,
          metadata: m.metadata ? { liveData: m.metadata.liveData } : undefined,
        })),
      };

      if (ackToken) {
        const valid = await auth.ackTokens.validate(ackToken, userId);
        if (valid) {
          pipelineContext.ackTokenValid = true;
        } else {
          throw new ClientError('Invalid or expired acknowledgment token');
        }
      }

      const result = await pipeline.process(message, pipelineContext);

      if (result.response) {
        await workingMemory.addAssistantMessage(convId, result.response, {
          stance: result.stance,
          status: result.status,
          tokensUsed: result.gateResults.model?.output?.tokensUsed,
          liveData: result.gateResults.intent?.output?.live_data,
        });
      }

      if (result.status === 'stopped' || result.status === 'await_ack') {
        await trackVeto(userId);
      }

      await auth.session.update(convId, {
        messageCount: 1,
        tokenCount: result.gateResults.model?.output?.tokensUsed ?? 0,
      });

      if (result.gateResults.model?.output?.tokensUsed) {
        await auth.trackTokenUsage(userId, result.gateResults.model.output.tokensUsed);
      }

      if (result.ackToken) {
        await auth.ackTokens.store(result.ackToken, userId);
      }

      await auth.audit.log({
        userId,
        action: 'chat',
        requestId,
        stance: result.stance,
        status: result.status,
        details: {
          messageLength: message.length,
          tokensUsed: result.gateResults.model?.output?.tokensUsed,
          contextTruncated: contextWindow.truncated,
        },
      });

      const updatedConv = await workingMemory.get(convId);

      res.json({
        ...result,
        conversation: {
          id: convId,
          title: updatedConv?.title ?? conversation.title,
          messageCount: updatedConv?.messageCount ?? conversation.messageCount + 2,
          contextTruncated: contextWindow.truncated,
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

      const result = await pipeline.process(command, pipelineContext);

      res.json({
        ...result,
        parsedAction: actionSource,
      });
    } catch (error) {
      next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERSATION ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/conversations', auth.middleware(true), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.userId!;

      const convList = await workingMemory.list(userId, Number(limit), Number(offset));

      res.json({
        conversations: convList,
        count: convList.length,
        offset: Number(offset),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/conversations/:id', auth.middleware(true), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
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
  });

  router.get('/conversations/:id/messages', auth.middleware(true), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
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
  });

  router.patch('/conversations/:id', auth.middleware(true), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
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
  });

  router.delete('/conversations/:id', auth.middleware(true), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const conversation = await workingMemory.get(id);
      if (!conversation || conversation.userId !== req.userId) {
        throw new ClientError('Conversation not found', 404);
      }

      await workingMemory.delete(id);

      await auth.audit.log({
        userId: req.userId!,
        action: 'delete_conversation',
        details: { conversationId: id },
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIG ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/config', auth.middleware(true), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const config = loadConfig();
      
      res.json({
        environment: config.env.environment,
        features: {
          verificationEnabled: config.features.verificationEnabled,
          webFetchEnabled: config.features.webFetchEnabled,
          authRequired: config.features.authRequired,
          debugMode: config.features.debugMode,
          redactPII: config.features.redactPII,
        },
        verification: {
          enabled: config.verification.enabled,
          required: config.verification.required,
          cacheTTLSeconds: config.verification.cacheTTLSeconds,
          maxVerificationsPerRequest: config.verification.maxVerificationsPerRequest,
        },
        webFetch: {
          maxResponseSizeBytes: config.webFetch.maxResponseSizeBytes,
          maxRedirects: config.webFetch.maxRedirects,
          totalTimeoutMs: config.webFetch.totalTimeoutMs,
          allowlistEnabled: config.webFetch.allowlist.length > 0,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/admin/block-user', auth.middleware(true), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { targetUserId, reason, durationMinutes } = req.body;
      
      if (!targetUserId || !reason) {
        throw new ClientError('targetUserId and reason required');
      }

      const durationMs = (durationMinutes ?? 60) * 60 * 1000;
      await auth.blockUser(targetUserId, reason, durationMs);

      await auth.audit.log({
        userId: req.userId!,
        action: 'admin_block_user',
        details: { targetUserId, reason, durationMinutes },
      });

      res.json({
        success: true,
        blockedUntil: Date.now() + durationMs,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/unblock-user', auth.middleware(true), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { targetUserId } = req.body;
      
      if (!targetUserId) {
        throw new ClientError('targetUserId required');
      }

      const unblocked = await auth.unblockUser(targetUserId);

      await auth.audit.log({
        userId: req.userId!,
        action: 'admin_unblock_user',
        details: { targetUserId },
      });

      res.json({
        success: unblocked,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/audit-logs', auth.middleware(true), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId: targetUserId, limit = 100 } = req.query;

      let logs;
      if (targetUserId && typeof targetUserId === 'string') {
        logs = await auth.audit.getUserLogs(targetUserId, Number(limit));
      } else {
        logs = await auth.audit.getGlobalLogs(Number(limit));
      }

      res.json({
        logs,
        count: logs.length,
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
