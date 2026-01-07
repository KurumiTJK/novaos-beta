// ═══════════════════════════════════════════════════════════════════════════════
// SWORD API ROUTES
// Express router for SwordGate endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from 'express';
import { SwordGate, LessonDesigner, LessonRunner } from '../services/sword/index.js';
import {
  StartDesignerSchema,
  ExplorationMessageSchema,
  GoalDefinitionSchema,
  NodeIdParamSchema,
  StartNodeSchema,
  SwitchNodeSchema,
  CompleteAssetSchema,
  SubmitMasterySchema,
  PlanIdParamSchema,
} from '../services/sword/validation.js';

// Import auth types from security module
import type { AuthenticatedRequest } from '../security/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTER SETUP
// ─────────────────────────────────────────────────────────────────────────────────

const router = Router();

// Helper to get userId from request
const getUserId = (req: Request): string => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.userId;
  if (!userId) throw new Error('Authentication required');
  return userId;
};

// Validation middleware factory
const validate = (schema: any) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', details: result.error.issues },
    });
    return;
  }
  req.body = result.data;
  next();
};

const validateParams = (schema: any) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', details: result.error.issues },
    });
    return;
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN STATE
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword - Full SwordGate state
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const state = await SwordGate.getState(userId);
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
});

// GET /sword/today - Today's learning content
router.get('/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    // Note: getToday only takes userId, timezone is handled internally
    const today = await LessonRunner.getToday(userId);
    res.json({ success: true, data: today });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// DESIGNER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/designer - Get designer session state
router.get('/designer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const session = await LessonDesigner.getActiveSession(userId);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// POST /sword/designer/start - Start design session
router.post('/designer/start',
  validate(StartDesignerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { topic } = req.body;
      const session = await LessonDesigner.startSession(userId, topic);
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }
);

// POST /sword/designer/goal - Define goal and trigger phases 2a-2c
router.post('/designer/goal',
  validate(GoalDefinitionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { goal, topic, context } = req.body;
      
      // Get active session
      const session = await LessonDesigner.getActiveSession(userId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No active designer session' },
        });
        return;
      }
      
      // Run define goal phase (capstone + subskills + routing)
      const result = await LessonDesigner.runDefineGoal(session.id, {
        topic: topic || session.explorationData?.learningGoal || 'Unknown Topic',
        goal,
        context,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// POST /sword/designer/research - Run research (phase 3)
router.post('/designer/research', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    // Get active session
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }
    
    const result = await LessonDesigner.runResearch(session.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /sword/designer/review - Run review phase (phase 4: nodes + sequencing + method nodes)
router.post('/designer/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    // Get active session
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }
    
    const result = await LessonDesigner.runReview(session.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /sword/designer/finalize - Finalize and create plan
router.post('/designer/finalize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    // Get active session
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }
    
    const plan = await LessonDesigner.createPlan(session.id);
    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
});

// DELETE /sword/designer - Cancel design session
router.delete('/designer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (session) {
      await LessonDesigner.cancelSession(session.id);
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// PLAN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/plans - List user's plans
router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const plans = await SwordGate.getPlans(userId);
    res.json({ success: true, data: plans });
  } catch (error) {
    next(error);
  }
});

// GET /sword/plans/:planId - Get plan details
router.get('/plans/:planId',
  validateParams(PlanIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { planId } = req.params;
      
      // Get all plans and find the specific one
      const plans = await SwordGate.getPlans(userId);
      const plan = plans.find(p => p.id === planId);
      
      if (!plan) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Plan not found' },
        });
        return;
      }
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }
);

// GET /sword/plans/:planId/nodes - Get nodes for a plan
router.get('/plans/:planId/nodes',
  validateParams(PlanIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { planId } = req.params;
      const nodes = await LessonRunner.getNodes(planId!);
      res.json({ success: true, data: nodes });
    } catch (error) {
      next(error);
    }
  }
);

// POST /sword/plans/:planId/activate - Activate plan
router.post('/plans/:planId/activate',
  validateParams(PlanIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { planId } = req.params;
      const plan = await SwordGate.activatePlan(userId, planId!);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }
);

// POST /sword/plans/:planId/abandon - Abandon plan
router.post('/plans/:planId/abandon',
  validateParams(PlanIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { planId } = req.params;
      await SwordGate.abandonPlan(userId, planId!);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────────
// NODE ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/nodes/:nodeId - Get node details
router.get('/nodes/:nodeId',
  validateParams(NodeIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { nodeId } = req.params;
      const node = await LessonRunner.getNode(nodeId!);
      if (!node) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Node not found' },
        });
        return;
      }
      res.json({ success: true, data: node });
    } catch (error) {
      next(error);
    }
  }
);

// POST /sword/nodes/:nodeId/start - Start working on a node
router.post('/nodes/:nodeId/start',
  validateParams(NodeIdParamSchema),
  validate(StartNodeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { nodeId } = req.params;
      const result = await LessonRunner.startSession(userId, nodeId!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// POST /sword/nodes/:nodeId/check-switch - Check if can switch to this node
router.post('/nodes/:nodeId/check-switch',
  validateParams(NodeIdParamSchema),
  validate(SwitchNodeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { nodeId } = req.params;
      const result = await LessonRunner.checkSwitch(userId, nodeId!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION/PROGRESS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

// POST /sword/sessions/:sessionId/asset/:assetId/complete - Complete an asset
router.post('/sessions/:sessionId/asset/:assetId/complete',
  validate(CompleteAssetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { sessionId, assetId } = req.params;
      const result = await LessonRunner.completeAsset(userId, sessionId!, assetId!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// POST /sword/sessions/:sessionId/spark/complete - Complete today's spark
router.post('/sessions/:sessionId/spark/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const result = await LessonRunner.completeSpark(userId, sessionId!);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /sword/sessions/:sessionId/mastery - Submit mastery reflection
router.post('/sessions/:sessionId/mastery',
  validate(SubmitMasterySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const { reflection } = req.body;
      const result = await LessonRunner.submitMastery(userId, sessionId!, reflection);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────────
// PROGRESS/STATS
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/stats - Get learning statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const stats = await LessonRunner.getStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────────

export { router as swordRoutes };
