// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD ROUTES — API Endpoints for Shield Service
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, type Response, type NextFunction } from 'express';
import type { AuthenticatedRequest } from '../security/index.js';
import { logAudit } from '../security/index.js';
import { getShieldService } from '../services/shield/index.js';

export const shieldRoutes = Router();

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
// Called when user dismisses warning overlay
// Records confirmation for audit, no other effect

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
      const success = await shieldService.confirmAcceptance(activationId);
      
      await logAudit({
        category: 'shield',
        action: 'warning_acknowledged',
        userId,
        details: { activationId, success },
      });
      
      res.json({
        success,
        data: { acknowledged: success },
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
