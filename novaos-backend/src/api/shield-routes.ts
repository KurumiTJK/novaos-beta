// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD ROUTES — API Endpoints for Shield Service
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, type Response, type NextFunction } from 'express';
import type { AuthenticatedRequest } from '../security/index.js';
import { logAudit } from '../security/index.js';
import { getShieldService } from '../services/shield/index.js';
import { ExecutionPipeline } from '../pipeline/execution-pipeline.js';
import { workingMemory } from '../core/memory/working_memory/index.js';
import type { PipelineContext, ConversationMessage } from '../types/index.js';

export const shieldRoutes = Router();

// Create pipeline instance for confirm endpoint
const pipeline = new ExecutionPipeline();

// ─────────────────────────────────────────────────────────────────────────────────
// GET /shield/status — Check for active crisis session
// ─────────────────────────────────────────────────────────────────────────────────

shieldRoutes.get('/status',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const shieldService = getShieldService();
      
      const status = await shieldService.getStatus(userId);
      
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────────
// POST /shield/confirm — Confirm warning acknowledgment (medium)
// ─────────────────────────────────────────────────────────────────────────────────
// Called when user clicks "I Understand" on warning overlay
// 
// NEW BEHAVIOR:
// 1. Retrieves pending message from Redis
// 2. Runs pipeline with shieldBypassed: true
// 3. Returns full pipeline response
//
// This allows the original message to be processed after user confirms

shieldRoutes.post('/confirm',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { activationId } = req.body;
      
      if (!activationId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'activationId required' },
        });
        return;
      }
      
      const shieldService = getShieldService();
      
      // ═══════════════════════════════════════════════════════════════════════
      // GET PENDING MESSAGE AND MARK AS ACKNOWLEDGED
      // ═══════════════════════════════════════════════════════════════════════
      
      const { success, pendingMessage } = await shieldService.confirmAcceptanceAndGetMessage(activationId);
      
      if (!success || !pendingMessage) {
        // No pending message found - maybe expired or already processed
        await logAudit({
          category: 'shield',
          action: 'warning_acknowledged',
          userId,
          details: { activationId, success: false, reason: 'no_pending_message' },
        });
        
        res.status(400).json({
          success: false,
          error: { 
            code: 'SHIELD_EXPIRED', 
            message: 'Warning confirmation expired. Please send your message again.' 
          },
        });
        return;
      }
      
      // Verify pending message belongs to this user
      if (pendingMessage.userId !== userId) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not authorized' },
        });
        return;
      }
      
      await logAudit({
        category: 'shield',
        action: 'warning_acknowledged',
        userId,
        details: { activationId, success: true, conversationId: pendingMessage.conversationId },
      });
      
      // ═══════════════════════════════════════════════════════════════════════
      // LOAD CONVERSATION HISTORY
      // ═══════════════════════════════════════════════════════════════════════
      
      const messages = await workingMemory.getMessages(pendingMessage.conversationId, 20);
      
      const conversationHistory: ConversationMessage[] = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.timestamp,
        metadata: msg.metadata ? { liveData: msg.metadata.liveData } : undefined,
      }));
      
      // ═══════════════════════════════════════════════════════════════════════
      // RUN PIPELINE WITH BYPASS FLAG
      // ═══════════════════════════════════════════════════════════════════════
      
      const context: PipelineContext = {
        userId,
        conversationId: pendingMessage.conversationId,
        message: pendingMessage.message,
        timestamp: Date.now(),
        requestId: `req-confirm-${Date.now()}`,
        conversationHistory,
        shieldBypassed: true, // Skip shield evaluation
      };
      
      console.log(`[SHIELD] Running pipeline for confirmed message: ${pendingMessage.conversationId}`);
      
      const result = await pipeline.process(pendingMessage.message, context);
      
      // ═══════════════════════════════════════════════════════════════════════
      // SAVE MESSAGES TO WORKING MEMORY
      // ═══════════════════════════════════════════════════════════════════════
      
      if (result.status === 'success' || result.status === 'degraded') {
        const capabilityOutput = result.gateResults?.capability?.output;
        const usedLiveData = capabilityOutput?.provider === 'gemini_grounded';
        
        // Save user message
        await workingMemory.addUserMessage(pendingMessage.conversationId, pendingMessage.message);
        
        // Save assistant response with metadata
        await workingMemory.addAssistantMessage(
          pendingMessage.conversationId,
          result.response,
          {
            liveData: usedLiveData,
            stance: result.stance,
            tokensUsed: result.gateResults?.model?.output?.tokensUsed,
          }
        );
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // RETURN PIPELINE RESPONSE
      // ═══════════════════════════════════════════════════════════════════════
      
      await logAudit({
        category: 'chat',
        action: 'chat_message_after_shield_confirm',
        userId,
        details: {
          conversationId: pendingMessage.conversationId,
          activationId,
          stance: result.stance,
          status: result.status,
        },
      });
      
      res.json({
        success: true,
        data: {
          ...result,
          conversationId: pendingMessage.conversationId,
          shieldConfirmed: true,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────────
// POST /shield/safe — Confirm safety (high) — End crisis session
// ─────────────────────────────────────────────────────────────────────────────────
// Called when user confirms they are safe
// Resolves crisis session, allows normal operation

shieldRoutes.post('/safe',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'sessionId required' },
        });
        return;
      }
      
      const shieldService = getShieldService();
      const success = await shieldService.confirmSafety(userId, sessionId);
      
      if (!success) {
        res.status(400).json({
          success: false,
          error: { code: 'SHIELD_SESSION_ERROR', message: 'Failed to resolve crisis session' },
        });
        return;
      }
      
      await logAudit({
        category: 'shield',
        severity: 'info',
        action: 'crisis_resolved',
        userId,
        details: { sessionId },
      });
      
      res.json({
        success: true,
        data: { resolved: true },
      });
    } catch (error) {
      next(error);
    }
  }
);
