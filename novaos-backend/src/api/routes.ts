// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES — Express Endpoints for NovaOS
// ═══════════════════════════════════════════════════════════════════════════════
//
// CONVERSATION MANAGEMENT: Backend-Tracks-Only
//
// Users just send messages. Backend automatically:
//   - Finds user's most recent conversation (within 24hr timeout)
//   - Continues it if found, creates new if not
//   - Optional: { newConversation: true } forces fresh start
//
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from 'express';
import { ExecutionPipeline } from '../pipeline/execution-pipeline.js';
import { pipeline_model, model_llm, isOpenAIAvailable } from '../pipeline/llm_engine.js';
import type { PipelineContext, ActionSource, ConversationMessage, PipelineState } from '../types/index.js';
import { storeManager } from '../storage/index.js';
import { workingMemory } from '../core/memory/working_memory/index.js';
import { loadConfig, canVerify } from '../config/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY MODULE IMPORTS
// ─────────────────────────────────────────────────────────────────────────────────

import {
  // Auth
  type AuthenticatedRequest,
  authenticate,
  generateAccessToken,
  generateApiKey,
  getAckTokenStore,
  generateAckToken,
  
  // Token management
  refreshAccessToken,
  revokeToken,
  revokeAllUserTokens,
  verifyToken,
  
  // Brute force protection
  checkBruteForce,
  recordFailedAttempt,
  clearFailedAttempts,
  
  // Rate limiting
  rateLimit,
  
  // Validation
  validateBody,
  validateQuery,
  validateParams,
  ChatMessageSchema,
  ParseCommandSchema,
  RegisterSchema,
  RefreshTokenSchema,
  UpdateSettingsSchema,
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
// DATABASE IMPORTS (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

import { isSupabaseInitialized } from '../db/index.js';
import {
  createUser,
  getSettings,
  updateSettings,
} from '../services/settings.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SWORDGATE ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

import { swordRoutes } from './sword-routes.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SHIELD ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

import { shieldRoutes } from './shield-routes.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STREAMING IMPORTS
// ─────────────────────────────────────────────────────────────────────────────────

import { 
  executeStreamingResponse,
  executeFakeStreamingResponse,
  sendThinkingEvent,
  isHighRisk,
} from '../gates/response_gate/index.js';
import {
  executeIntentGateAsync,
  executeToolsGate,
  executeStanceGateAsync,
  executeCapabilityGate,
} from '../gates/index.js';
import { executeShieldGateAsync } from '../gates/shield_gate/index.js';
import { executeConstitutionGateAsync } from '../gates/constitution_gate/index.js';
import { executeMemoryGateAsync } from '../gates/memory_gate/index.js';
import { executeResponseGateAsync } from '../gates/response_gate/response-gate.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/** Conversation timeout — if last message was longer ago, start fresh */
const CONVERSATION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

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
      database: isSupabaseInitialized() ? 'connected' : 'not configured',
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
        'swordgate-v2',
        'shield-protection',
        'streaming',
        isSupabaseInitialized() ? 'supabase' : null,
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
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, tier = 'free' } = req.body;
        const userId = `user_${Buffer.from(email).toString('base64').slice(0, 16)}`;

        const accessToken = generateAccessToken(userId, tier, { email });
        const apiKey = generateApiKey(userId, tier, { email });

        // ═══════════════════════════════════════════════════════════════════════
        // NEW: Sync user to Supabase
        // ═══════════════════════════════════════════════════════════════════════
        if (isSupabaseInitialized()) {
          try {
            await createUser(userId, email, tier);
          } catch (err) {
            // Log but don't fail registration if Supabase sync fails
            console.error('[AUTH] Failed to sync user to Supabase:', err);
          }
        }

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
        database: isSupabaseInitialized() ? 'connected' : 'not configured',
      });
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTH: REFRESH TOKEN
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/auth/refresh',
    rateLimit({ category: 'auth' }),
    validateBody(RefreshTokenSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { refreshToken } = req.body;

        const result = await refreshAccessToken(refreshToken);

        if (!result) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTH_REFRESH_INVALID',
              message: 'Invalid or expired refresh token',
            },
          });
          return;
        }

        // Decode the new access token to get userId for audit
        const decoded = await verifyToken(result.accessToken.token);
        await logAudit({
          category: 'auth',
          action: 'token_refresh',
          userId: decoded.valid ? decoded.user.userId : 'unknown',
          details: { success: true },
        });

        res.json({
          success: true,
          data: {
            tokens: {
              accessToken: result.accessToken.token,
              refreshToken: result.refreshToken.token,
              accessExpiresAt: new Date(result.accessToken.expiresAt).toISOString(),
              refreshExpiresAt: new Date(result.refreshToken.expiresAt).toISOString(),
            },
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTH: LOGOUT
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/auth/logout',
    authenticate({ required: true }),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { refreshToken, allDevices = false } = req.body;

        if (allDevices) {
          // Revoke all tokens for this user
          await revokeAllUserTokens(req.userId!);
          
          await logAudit({
            category: 'auth',
            action: 'logout_all_devices',
            userId: req.userId!,
            details: {},
          });

          res.json({
            success: true,
            message: 'Logged out from all devices',
          });
          return;
        }

        if (refreshToken) {
          // Revoke specific refresh token by verifying it first
          const tokenResult = await verifyToken(refreshToken);
          
          if (tokenResult.valid && tokenResult.user.tokenId) {
            await revokeToken(tokenResult.user.tokenId);
          }

          await logAudit({
            category: 'auth',
            action: 'logout',
            userId: req.userId!,
            details: { revokedRefreshToken: true },
          });
        } else if (req.user?.tokenId) {
          // Revoke current access token
          await revokeToken(req.user.tokenId);

          await logAudit({
            category: 'auth',
            action: 'logout',
            userId: req.userId!,
            details: { revokedAccessToken: true },
          });
        }

        res.json({
          success: true,
          message: 'Logged out successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SETTINGS ENDPOINTS (NEW)
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/settings',
    authenticate({ required: true }),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!isSupabaseInitialized()) {
          throw new ClientError('Database not configured', 503);
        }

        const settings = await getSettings(req.userId!);

        res.json({
          success: true,
          data: {
            theme: settings.theme,
            defaultStance: settings.defaultStance,
            hapticFeedback: settings.hapticFeedback,
            notifications: settings.notifications,
            isDefault: settings.isDefault,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch('/settings',
    authenticate({ required: true }),
    validateBody(UpdateSettingsSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!isSupabaseInitialized()) {
          throw new ClientError('Database not configured', 503);
        }

        const updates = req.body;
        const email = req.user?.email ?? `${req.userId}@novaos.local`;

        const settings = await updateSettings(req.userId!, email, updates);

        await logAudit({
          category: 'auth',
          action: 'update_settings',
          userId: req.userId!,
          details: { updates: Object.keys(updates) },
        });

        res.json({
          success: true,
          data: {
            theme: settings.theme,
            defaultStance: settings.defaultStance,
            hapticFeedback: settings.hapticFeedback,
            notifications: settings.notifications,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // SWORDGATE ROUTES
  // ═══════════════════════════════════════════════════════════════════════════════
  // Entry B: Direct API access from frontend
  // All sword endpoints require authentication
  
  router.use('/sword', authenticate({ required: true }), swordRoutes);

  // ═══════════════════════════════════════════════════════════════════════════════
  // SHIELD ROUTES
  // ═══════════════════════════════════════════════════════════════════════════════
  // Shield protection endpoints for warning acknowledgment and crisis resolution
  // All shield endpoints require authentication
  
  router.use('/shield', authenticate({ required: true }), shieldRoutes);

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
  // CHAT ENDPOINT — Backend-Tracks-Only Conversation Management
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/chat',
    ...chatMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { message, newConversation = false, stance, actionSource } = req.body;
        const userId = req.userId ?? 'anonymous';

        // ═════════════════════════════════════════════════════════════════════
        // STEP 1: Resolve conversation (backend-tracks-only logic)
        // ═════════════════════════════════════════════════════════════════════
        let resolvedConversationId: string;
        let isNewConversation = false;

        if (newConversation) {
          // User explicitly wants a fresh start
          resolvedConversationId = `conv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
          await workingMemory.getOrCreate(userId, resolvedConversationId);
          isNewConversation = true;
          console.log('[CHAT] New conversation requested by user:', resolvedConversationId);
        } else {
          // Find user's most recent conversation
          const recentConversations = await workingMemory.list(userId, 1);
          const lastConversation = recentConversations[0];
          
          const now = Date.now();
          const isWithinTimeout = lastConversation && 
            (now - lastConversation.updatedAt) < CONVERSATION_TIMEOUT_MS;

          if (lastConversation && isWithinTimeout) {
            // Continue existing conversation
            resolvedConversationId = lastConversation.id;
            console.log('[CHAT] Continuing conversation:', resolvedConversationId);
          } else {
            // No recent conversation or timed out — create new
            resolvedConversationId = `conv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
            await workingMemory.getOrCreate(userId, resolvedConversationId);
            isNewConversation = true;
            
            if (lastConversation) {
              const hoursAgo = Math.round((now - lastConversation.updatedAt) / (60 * 60 * 1000));
              console.log(`[CHAT] Last conversation was ${hoursAgo}h ago (timeout), creating new:`, resolvedConversationId);
            } else {
              console.log('[CHAT] No previous conversation, creating new:', resolvedConversationId);
            }
          }
        }

        // ═════════════════════════════════════════════════════════════════════
        // STEP 2: Load conversation history
        // ═════════════════════════════════════════════════════════════════════
        const messages = await workingMemory.getMessages(resolvedConversationId, 20);
        
        const conversationHistory: ConversationMessage[] = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp,
          metadata: msg.metadata ? { liveData: msg.metadata.liveData } : undefined,
        }));

        console.log('[CHAT] Loaded conversation history:', conversationHistory.length, 'messages');

        // ═════════════════════════════════════════════════════════════════════
        // STEP 3: Build pipeline context
        // ═════════════════════════════════════════════════════════════════════
        const context: PipelineContext = {
          userId,
          conversationId: resolvedConversationId,
          message,
          timestamp: Date.now(),
          requestId: (req as any).requestId ?? crypto.randomUUID(),
          requestedStance: stance,
          actionSource: actionSource as ActionSource,
          conversationHistory,
          metadata: {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          },
        };

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4: Execute pipeline
        // ═════════════════════════════════════════════════════════════════════
        const result = await pipeline.process(message, context);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5: Handle special pipeline statuses
        // ═════════════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════════════
        // SHIELD BLOCKED — MEDIUM (warn) or HIGH (crisis)
        // ═══════════════════════════════════════════════════════════════════════
        if (result.status === 'blocked' && result.shield) {
          const { shield } = result;
          
          // Don't save messages for blocked requests
          
          // ─────────────────────────────────────────────────────────────────────
          // MEDIUM BLOCK — Return warning message, user must confirm to continue
          // Frontend shows warning overlay with "I Understand" button
          // User clicks button → POST /shield/confirm → Pipeline runs → Response
          // ─────────────────────────────────────────────────────────────────────
          if (shield.action === 'warn') {
            await logAudit({
              category: 'shield',
              severity: 'warning',
              action: 'warning_activated',
              userId,
              details: {
                conversationId: resolvedConversationId,
                activationId: shield.activationId,
              },
            });
            
            res.json({
              response: '', // No response - frontend shows warning
              stance: 'shield',
              status: 'blocked',
              conversationId: resolvedConversationId,
              isNewConversation,
              shield: {
                action: 'warn',
                warningMessage: shield.warningMessage, // Short 2-3 sentence warning
                activationId: shield.activationId,
                // riskAssessment intentionally NOT included - only warningMessage shown
              },
            });
            return;
          }
          
          // ─────────────────────────────────────────────────────────────────────
          // CRISIS BLOCK — High signal or active crisis session
          // Frontend shows crisis UI, user must confirm safety
          // ─────────────────────────────────────────────────────────────────────
          await logAudit({
            category: 'shield',
            severity: shield.crisisBlocked ? 'info' : 'warning',
            action: shield.crisisBlocked ? 'crisis_blocked' : 'crisis_activated',
            userId,
            details: {
              conversationId: resolvedConversationId,
              sessionId: shield.sessionId,
              activationId: shield.activationId,
            },
          });
          
          res.json({
            response: '', // No response for crisis
            stance: 'shield',
            status: 'blocked',
            conversationId: resolvedConversationId,
            isNewConversation,
            shield: {
              action: 'crisis',
              riskAssessment: shield.riskAssessment,
              sessionId: shield.sessionId,
              activationId: shield.activationId,
              crisisBlocked: shield.crisisBlocked,
            },
          });
          return;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // SWORDGATE REDIRECT → PENDING CONFIRMATION
        // When pipeline detects learning intent and returns redirect,
        // convert to pending_confirmation with button text for frontend
        // ═══════════════════════════════════════════════════════════════════════
        if (result.status === 'redirect' && result.redirect) {
          const { redirect } = result;
          
          // Generate contextual response and button text
          const topicText = redirect.topic 
            ? `learn ${redirect.topic}` 
            : 'start learning';
          
          const confirmationResponse = redirect.mode === 'designer'
            ? `I'd love to help you ${topicText}! Would you like me to create a personalized learning plan?`
            : `Ready to continue your learning session? Let's pick up where you left off.`;
          
          const confirmText = redirect.mode === 'designer'
            ? "Yes, let's learn"
            : "Continue learning";
          
          res.json({
            response: confirmationResponse,
            stance: result.stance ?? 'sword',
            status: 'pending_confirmation',
            conversationId: resolvedConversationId,
            isNewConversation,
            pendingAction: {
              type: 'sword_redirect',
              redirect,
              confirmText,
              cancelText: 'No thanks',
            },
          });
          return;
        }

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6: Save messages to working memory (normal flow)
        // ═════════════════════════════════════════════════════════════════════
        const capabilityOutput = result.gateResults?.capability?.output;
        const usedLiveData = capabilityOutput?.provider === 'gemini_grounded';

        // Save user message
        await workingMemory.addUserMessage(resolvedConversationId, message);

        // Save assistant response with metadata
        await workingMemory.addAssistantMessage(
          resolvedConversationId,
          result.response,
          {
            liveData: usedLiveData,
            stance: result.stance,
            tokensUsed: result.gateResults?.model?.output?.tokensUsed,
          }
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7: Audit & respond
        // ═════════════════════════════════════════════════════════════════════
        await logAudit({
          category: 'chat',
          action: 'chat_message',
          userId,
          details: {
            conversationId: resolvedConversationId,
            stance: result.stance,
            status: result.status,
            usedLiveData,
            isNewConversation,
            hasShieldWarning: !!result.shield,
          },
        });


        if (result.status === 'stopped') {
          await trackVeto(userId);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // NORMAL RESPONSE (may include shield warning for medium signals)
        // ═══════════════════════════════════════════════════════════════════════
        res.json({
          ...result,
          conversationId: resolvedConversationId,
          isNewConversation,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // STREAMING CHAT ENDPOINT
  // Same as /chat but streams response via Server-Sent Events
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/chat/stream',
    ...chatMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { message, newConversation = false, stance, actionSource } = req.body;
        const userId = req.userId ?? 'anonymous';

        // ═════════════════════════════════════════════════════════════════════
        // STEP 1: Resolve conversation (same as regular /chat)
        // ═════════════════════════════════════════════════════════════════════
        let resolvedConversationId: string;
        let isNewConversation = false;

        if (newConversation) {
          resolvedConversationId = `conv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
          await workingMemory.getOrCreate(userId, resolvedConversationId);
          isNewConversation = true;
        } else {
          const recentConversations = await workingMemory.list(userId, 1);
          const lastConversation = recentConversations[0];
          
          const now = Date.now();
          const isWithinTimeout = lastConversation && 
            (now - lastConversation.updatedAt) < CONVERSATION_TIMEOUT_MS;

          if (lastConversation && isWithinTimeout) {
            resolvedConversationId = lastConversation.id;
          } else {
            resolvedConversationId = `conv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
            await workingMemory.getOrCreate(userId, resolvedConversationId);
            isNewConversation = true;
          }
        }

        // ═════════════════════════════════════════════════════════════════════
        // STEP 2: Load conversation history
        // ═════════════════════════════════════════════════════════════════════
        const messages = await workingMemory.getMessages(resolvedConversationId, 20);
        
        const conversationHistory: ConversationMessage[] = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp,
          metadata: msg.metadata ? { liveData: msg.metadata.liveData } : undefined,
        }));

        // ═════════════════════════════════════════════════════════════════════
        // STEP 3: Build pipeline context
        // ═════════════════════════════════════════════════════════════════════
        const context: PipelineContext = {
          userId,
          conversationId: resolvedConversationId,
          message,
          timestamp: Date.now(),
          requestId: (req as any).requestId ?? crypto.randomUUID(),
          requestedStance: stance,
          actionSource: actionSource as ActionSource,
          conversationHistory,
          metadata: {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          },
        };

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4: Execute Gates 1-5 (non-streaming)
        // ═════════════════════════════════════════════════════════════════════
        const state: PipelineState = {
          userMessage: message,
          normalizedInput: message.toLowerCase().trim(),
          gateResults: {},
          flags: {},
          timestamps: { pipelineStart: Date.now() },
        };

        // Gate 1: Intent
        state.gateResults.intent = await executeIntentGateAsync(state, context);
        state.intent_summary = state.gateResults.intent.output;

        // Gate 2: Shield
        state.gateResults.shield = await executeShieldGateAsync(state, context);
        state.shieldResult = state.gateResults.shield.output;

        // Check for shield block
        if (state.gateResults.shield.action === 'halt') {
          // Return JSON for blocked requests (not streaming)
          res.json({
            response: '',
            stance: 'shield',
            status: 'blocked',
            conversationId: resolvedConversationId,
            isNewConversation,
            shield: {
              action: state.shieldResult.action,
              warningMessage: state.shieldResult.warningMessage,
              riskAssessment: state.shieldResult.riskAssessment,
              activationId: state.shieldResult.activationId,
              sessionId: state.shieldResult.sessionId,
            },
          });
          return;
        }

        // Gate 3: Tools
        state.gateResults.tools = executeToolsGate(state, context);
        state.toolsResult = state.gateResults.tools.output;

        // Gate 4: Stance
        state.gateResults.stance = await executeStanceGateAsync(state, context);
        state.stanceResult = state.gateResults.stance.output;
        state.stance = state.stanceResult.route as import('../types/index.js').Stance;

        // Check for redirect
        if (state.gateResults.stance.action === 'redirect') {
          res.json({
            response: '',
            stance: 'sword',
            status: 'redirect',
            conversationId: resolvedConversationId,
            isNewConversation,
            redirect: state.stanceResult.redirect,
          });
          return;
        }

        // Gate 5: Capability
        state.gateResults.capability = await executeCapabilityGate(state, context);
        state.capabilityResult = state.gateResults.capability.output;

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5: Determine risk level and execute appropriate path
        // ═════════════════════════════════════════════════════════════════════
        const capabilityOutput = state.gateResults.capability?.output;
        const provider = (capabilityOutput?.provider ?? 'openai') as import('../types/index.js').ProviderName;
        const usedLiveData = provider === 'gemini_grounded';

        if (isHighRisk(state)) {
          // ═══════════════════════════════════════════════════════════════════
          // HIGH RISK PATH: Full pipeline first, then fake stream
          // Gates 6-8 execute hidden, then fake stream validated response
          // ═══════════════════════════════════════════════════════════════════
          console.log('[STREAM] High risk path: executing full pipeline before streaming');

          // Send thinking event IMMEDIATELY to keep nginx alive
          sendThinkingEvent(res, resolvedConversationId, isNewConversation);

          // Gate 6: Response (non-streaming)
          state.gateResults.response = await executeResponseGateAsync(state, context);
          const responseOutput = state.gateResults.response.output;
          state.generation = { 
            text: responseOutput?.text ?? '',
            model: responseOutput?.model ?? 'unknown',
            tokensUsed: responseOutput?.tokensUsed ?? 0,
          };

          // Gate 7: Constitution (will run check for high risk)
          let constitutionAttempts = 0;
          const maxRegenerations = 2;
          
          while (constitutionAttempts <= maxRegenerations) {
            state.gateResults.constitution = await executeConstitutionGateAsync(state, context);
            state.validatedOutput = state.gateResults.constitution.output;

            // Check if regeneration needed
            if (state.gateResults.constitution.action === 'regenerate' && constitutionAttempts < maxRegenerations) {
              console.log(`[STREAM] Constitution failed, regenerating (attempt ${constitutionAttempts + 1}/${maxRegenerations})`);
              
              // Regenerate response
              state.gateResults.response = await executeResponseGateAsync(state, context);
              const regenOutput = state.gateResults.response.output;
              state.generation = { 
                text: regenOutput?.text ?? '',
                model: regenOutput?.model ?? 'unknown',
                tokensUsed: regenOutput?.tokensUsed ?? 0,
              };
              constitutionAttempts++;
            } else {
              break;
            }
          }

          // Gate 8: Memory
          state.gateResults.memory = await executeMemoryGateAsync(state, context);

          // Get final validated text
          const finalText = state.validatedOutput?.text ?? state.generation?.text ?? '';
          const tokensUsed = state.gateResults.response.output?.tokensUsed ?? Math.ceil(finalText.length / 4);

          // Save messages BEFORE fake streaming
          await workingMemory.addUserMessage(resolvedConversationId, message);
          await workingMemory.addAssistantMessage(
            resolvedConversationId,
            finalText,
            {
              liveData: usedLiveData,
              stance: state.stance,
              tokensUsed,
            }
          );

          // Fake stream the validated response
          await executeFakeStreamingResponse(
            res,
            finalText,
            resolvedConversationId,
            isNewConversation,
            state.stance,
            {
              provider,
              tokensUsed,
              model: state.gateResults.response.output?.model ?? 'gpt-4o',
            }
          );

          // Audit logging
          await logAudit({
            category: 'chat',
            action: 'chat_message_stream',
            userId,
            details: {
              conversationId: resolvedConversationId,
              stance: state.stance,
              usedLiveData,
              isNewConversation,
              tokensUsed,
              highRisk: true,
              constitutionAttempts,
            },
          });

        } else {
          // ═══════════════════════════════════════════════════════════════════
          // LOW RISK PATH: Real stream, then Constitution/Memory
          // ═══════════════════════════════════════════════════════════════════
          console.log('[STREAM] Low risk path: streaming response');

          // Gate 6: Streaming Response
          const streamResult = await executeStreamingResponse(
            res,
            state,
            context,
            resolvedConversationId,
            isNewConversation
          );

          // Set generation for downstream gates
          state.generation = { 
            text: streamResult.fullText,
            model: streamResult.model,
            tokensUsed: streamResult.tokensUsed,
          };

          // Gate 7: Constitution (will log skip for low risk)
          state.gateResults.constitution = await executeConstitutionGateAsync(state, context);
          state.validatedOutput = state.gateResults.constitution.output;

          // Gate 8: Memory
          state.gateResults.memory = await executeMemoryGateAsync(state, context);

          // Save messages (after streaming completes)
          await workingMemory.addUserMessage(resolvedConversationId, message);
          await workingMemory.addAssistantMessage(
            resolvedConversationId,
            streamResult.fullText,
            {
              liveData: usedLiveData,
              stance: state.stance,
              tokensUsed: streamResult.tokensUsed,
            }
          );

          // Audit logging
          await logAudit({
            category: 'chat',
            action: 'chat_message_stream',
            userId,
            details: {
              conversationId: resolvedConversationId,
              stance: state.stance,
              usedLiveData,
              isNewConversation,
              tokensUsed: streamResult.tokensUsed,
              highRisk: false,
            },
          });
        }

      } catch (error) {
        // If headers already sent (streaming started), we can't send error response
        if (res.headersSent) {
          console.error('[STREAM] Error after headers sent:', error);
          return;
        }
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

        // Load conversation history if conversationId provided
        let conversationHistory: ConversationMessage[] = [];
        if (conversationId) {
          const messages = await workingMemory.getMessages(conversationId, 10);
          conversationHistory = messages.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: msg.timestamp,
            metadata: msg.metadata ? { liveData: msg.metadata.liveData } : undefined,
          }));
        }

        const context: PipelineContext = {
          userId,
          conversationId,
          message,
          timestamp: Date.now(),
          requestId: (req as any).requestId ?? crypto.randomUUID(),
          actionSource: 'command',
          conversationHistory,
          metadata: {},
        };

        // Execute pipeline
        const result = await pipeline.process(message, context);

        res.json({
          parsed: true,
          intent: result.gateResults.intent?.output,
          stance: result.stance,
          response: result.response,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VETO ENDPOINT (for constitution gate feedback)
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/veto',
    authenticate({ required: true }),
    rateLimit({ category: 'chat' }),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { conversationId, messageIndex, reason } = req.body;
        const userId = req.userId!;

        // Track the veto (only takes userId)
        await trackVeto(userId);

        // Log the veto with reason in audit
        await logAudit({
          category: 'abuse',
          severity: 'warning',
          action: 'user_veto',
          userId,
          details: { conversationId, messageIndex, reason },
        });

        res.json({ success: true });
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
        const conversations = await workingMemory.list(req.userId!, Number(limit), Number(offset));

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
        const id = req.params.id!;
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
        const id = req.params.id!;
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
        const id = req.params.id!;
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
        const id = req.params.id!;

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
            supabase: isSupabaseInitialized(),
            swordgate: true,
            shield: true,
            streaming: true,
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
