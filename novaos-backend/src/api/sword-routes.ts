// ═══════════════════════════════════════════════════════════════════════════════
// SWORD API ROUTES
// Express router for SwordGate endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from 'express';
import { SwordGate, LessonDesigner, LessonRunner } from '../services/sword/index.js';
import { ExplorationService } from '../services/sword/lesson-designer/exploration.js';
import { CapstoneGenerator } from '../services/sword/lesson-designer/capstone.js';
import { SubskillsGenerator } from '../services/sword/lesson-designer/subskills.js';
import { RoutingGenerator } from '../services/sword/lesson-designer/routing.js';
import { updateSessionPhase } from '../services/sword/lesson-designer/session.js';
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
import type { Route, RouteStatus } from '../services/sword/types.js';

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
// EXPLORATION ENDPOINTS (Two-part flow: Orient + Clarify)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Start exploration (enters Orient mode)
 * POST /sword/explore/start
 * Body: { sessionId?: string, topic?: string }
 * 
 * If sessionId is not provided, creates a new designer session automatically.
 */
router.post('/explore/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    let { sessionId, topic } = req.body;
    
    // If no sessionId provided, create a new session
    if (!sessionId) {
      const session = await LessonDesigner.startSession(userId, topic || 'New Learning Goal');
      sessionId = session.id;
    }

    const result = await ExplorationService.start(sessionId, topic);

    res.json({
      success: true,
      data: {
        sessionId, // Include sessionId so frontend can track it
        message: result.message,
        state: result.state,
      },
    });
  } catch (error) {
    console.error('[EXPLORE] Start error:', error);
    next(error);
  }
});

/**
 * Chat in Orient phase
 * POST /sword/explore/chat
 * Body: { sessionId: string, message: string }
 */
router.post('/explore/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sessionId and message required' },
      });
      return;
    }

    const result = await ExplorationService.chat(sessionId, message);

    res.json({
      success: true,
      data: {
        response: result.response,
        state: result.state,
      },
    });
  } catch (error) {
    console.error('[EXPLORE] Chat error:', error);
    next(error);
  }
});

/**
 * Confirm Orient → move to Clarify (extracts data)
 * POST /sword/explore/confirm
 * Body: { sessionId: string }
 */
router.post('/explore/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sessionId required' },
      });
      return;
    }

    const result = await ExplorationService.confirm(sessionId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[EXPLORE] Confirm error:', error);
    next(error);
  }
});

/**
 * Get Clarify data (extracted + missing fields)
 * GET /sword/explore/clarify?sessionId=xxx
 */
router.get('/explore/clarify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sessionId required' },
      });
      return;
    }

    const result = await ExplorationService.getClarify(sessionId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[EXPLORE] Get clarify error:', error);
    next(error);
  }
});

/**
 * Update a field (fill or edit)
 * PATCH /sword/explore/field
 * Body: { sessionId: string, field: string, value: string }
 */
router.patch('/explore/field', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, field, value } = req.body;
    
    if (!sessionId || !field) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sessionId and field required' },
      });
      return;
    }

    const validFields = ['learningGoal', 'priorKnowledge', 'context'];
    if (!validFields.includes(field)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Invalid field: ${field}` },
      });
      return;
    }

    const result = await ExplorationService.updateField(
      sessionId, 
      field as 'learningGoal' | 'priorKnowledge' | 'context',
      value
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[EXPLORE] Update field error:', error);
    next(error);
  }
});

/**
 * Update constraints array
 * PATCH /sword/explore/constraints
 * Body: { sessionId: string, constraints: string[] }
 */
router.patch('/explore/constraints', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, constraints } = req.body;
    
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sessionId required' },
      });
      return;
    }

    if (!Array.isArray(constraints)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'constraints must be an array' },
      });
      return;
    }

    const result = await ExplorationService.updateConstraints(sessionId, constraints);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[EXPLORE] Update constraints error:', error);
    next(error);
  }
});

/**
 * Go back to Orient phase
 * POST /sword/explore/back
 * Body: { sessionId: string }
 */
router.post('/explore/back', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sessionId required' },
      });
      return;
    }

    const state = await ExplorationService.backToOrient(sessionId);

    res.json({
      success: true,
      data: { state },
    });
  } catch (error) {
    console.error('[EXPLORE] Back error:', error);
    next(error);
  }
});

/**
 * Complete exploration → move to Define Goal
 * POST /sword/explore/continue
 * Body: { sessionId: string }
 */
router.post('/explore/continue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sessionId required' },
      });
      return;
    }

    const explorationData = await ExplorationService.complete(sessionId);

    res.json({
      success: true,
      data: {
        explorationData,
        nextPhase: 'define_goal',
      },
    });
  } catch (error) {
    console.error('[EXPLORE] Continue error:', error);
    next(error);
  }
});

/**
 * Get current exploration state
 * GET /sword/explore/state?sessionId=xxx
 */
router.get('/explore/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sessionId required' },
      });
      return;
    }

    const state = await ExplorationService.getState(sessionId);

    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error('[EXPLORE] Get state error:', error);
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// DEFINE GOAL ENDPOINTS (Phase 2: Capstone → Subskills → Routing)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Run all three Define Goal steps
 * POST /sword/goal/generate
 * 
 * Runs: capstone → subskills → routing
 * Returns full Define Goal state
 */
router.post('/goal/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    if (!session.explorationData) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Exploration must be completed first' },
      });
      return;
    }

    console.log('[DEFINE GOAL] Starting generation for session:', session.id);

    // Step 1: Generate capstone
    console.log('[DEFINE GOAL] Step 1: Generating capstone...');
    const capstoneData = await CapstoneGenerator.generate(session);

    // Refresh session to get updated data
    const sessionAfterCapstone = await LessonDesigner.getActiveSession(userId);
    if (!sessionAfterCapstone) throw new Error('Session lost after capstone');

    // Step 2: Generate subskills
    console.log('[DEFINE GOAL] Step 2: Generating subskills...');
    const subskillsData = await SubskillsGenerator.generate(sessionAfterCapstone);

    // Refresh session
    const sessionAfterSubskills = await LessonDesigner.getActiveSession(userId);
    if (!sessionAfterSubskills) throw new Error('Session lost after subskills');

    // Step 3: Generate routing
    console.log('[DEFINE GOAL] Step 3: Generating routing...');
    const routingData = await RoutingGenerator.generate(sessionAfterSubskills);

    // Get final session state
    const finalSession = await LessonDesigner.getActiveSession(userId);

    // Build summary
    const summary = buildDefineGoalSummary(capstoneData, subskillsData, routingData);

    // Merge subskills with routing for UI
    const subskillsWithRouting = mergeSubskillsWithRouting(
      subskillsData.subskills,
      routingData
    );

    console.log('[DEFINE GOAL] Generation complete');

    res.json({
      success: true,
      data: {
        session: finalSession,
        capstone: capstoneData,
        subskills: subskillsData.subskills,
        subskillsWithRouting,
        routing: routingData,
        summary,
      },
    });
  } catch (error) {
    console.error('[DEFINE GOAL] Generation error:', error);
    next(error);
  }
});

/**
 * Get current Define Goal state
 * GET /sword/goal
 */
router.get('/goal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const capstone = session.capstoneData || null;
    const subskills = session.subskillsData?.subskills || null;
    const routing = session.routingData || null;

    const summary = capstone && subskills && routing
      ? buildDefineGoalSummary(capstone, session.subskillsData!, routing)
      : null;

    // Merge subskills with routing for UI
    const subskillsWithRouting = subskills && routing
      ? mergeSubskillsWithRouting(subskills, routing)
      : null;

    res.json({
      success: true,
      data: {
        session,
        capstone,
        subskills,
        subskillsWithRouting,
        routing,
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Regenerate capstone only
 * POST /sword/goal/capstone/regenerate
 */
router.post('/goal/capstone/regenerate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const capstoneData = await CapstoneGenerator.generate(session);

    res.json({
      success: true,
      data: capstoneData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update capstone
 * PATCH /sword/goal/capstone
 * Body: { title?, statement?, successCriteria?, estimatedTime? }
 */
router.patch('/goal/capstone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { title, statement, successCriteria, estimatedTime } = req.body;
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    if (!session.capstoneData) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'No capstone to update' },
      });
      return;
    }

    // Build updated capstone
    const updated = {
      ...session.capstoneData,
      ...(title && { title }),
      ...(statement && { capstoneStatement: statement }),
      ...(successCriteria && { successCriteria }),
      ...(estimatedTime && { estimatedTime }),
    };

    await updateSessionPhase(session.id, 'capstone', updated);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Refine capstone with feedback
 * POST /sword/goal/capstone/refine
 * Body: { feedback: string }
 */
router.post('/goal/capstone/refine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { feedback } = req.body;
    
    if (!feedback) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'feedback required' },
      });
      return;
    }

    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const refined = await CapstoneGenerator.refine(session, feedback);

    res.json({
      success: true,
      data: refined,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Regenerate subskills
 * POST /sword/goal/subskills/regenerate
 * Body: { guidance?: string }
 */
router.post('/goal/subskills/regenerate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { guidance } = req.body;
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const subskillsData = await SubskillsGenerator.regenerate(session, guidance);

    res.json({
      success: true,
      data: subskillsData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Add a subskill
 * POST /sword/goal/subskills
 * Body: { title, description, subskillType, estimatedComplexity, order }
 */
router.post('/goal/subskills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { title, description, subskillType, estimatedComplexity, order } = req.body;
    
    if (!title || !description || !subskillType) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'title, description, and subskillType required' },
      });
      return;
    }

    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const updated = await SubskillsGenerator.add(session, {
      title,
      description,
      subskillType,
      estimatedComplexity: estimatedComplexity || 2,
      order: order || (session.subskillsData?.subskills.length || 0) + 1,
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a subskill
 * PATCH /sword/goal/subskills/:subskillId
 * Body: { title?, description?, subskillType?, estimatedComplexity?, order? }
 */
router.patch('/goal/subskills/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    const updates = req.body;
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }

    const updated = await SubskillsGenerator.update(session, subskillId, updates);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a subskill
 * DELETE /sword/goal/subskills/:subskillId
 */
router.delete('/goal/subskills/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }

    const updated = await SubskillsGenerator.remove(session, subskillId);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reorder subskills
 * POST /sword/goal/subskills/reorder
 * Body: { orderedIds: string[] }
 */
router.post('/goal/subskills/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { orderedIds } = req.body;
    
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'orderedIds must be an array' },
      });
      return;
    }

    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const updated = await SubskillsGenerator.reorder(session, orderedIds);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Regenerate routing
 * POST /sword/goal/routing/regenerate
 * Body: { guidance?: string }
 */
router.post('/goal/routing/regenerate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { guidance } = req.body;
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const routingData = await RoutingGenerator.regenerate(session, guidance);

    res.json({
      success: true,
      data: routingData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Override status for a subskill
 * PATCH /sword/goal/routing/:subskillId/status
 * Body: { status: 'learn' | 'skip' | 'assess', reason?: string }
 */
router.patch('/goal/routing/:subskillId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    const { status, reason } = req.body;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    if (!['learn', 'skip', 'assess'].includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'status must be learn, skip, or assess' },
      });
      return;
    }

    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const updated = await RoutingGenerator.overrideStatus(session, subskillId, status as RouteStatus, reason);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Override route for a subskill
 * PATCH /sword/goal/routing/:subskillId/route
 * Body: { route: Route, reason?: string }
 */
router.patch('/goal/routing/:subskillId/route', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    const { route, reason } = req.body;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const validRoutes = ['recall', 'practice', 'diagnose', 'apply', 'build', 'refine', 'plan'];
    if (!validRoutes.includes(route)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `route must be one of: ${validRoutes.join(', ')}` },
      });
      return;
    }

    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const updated = await RoutingGenerator.overrideRoute(session, subskillId, route as Route, reason);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Set all subskills to "learn"
 * POST /sword/goal/routing/learn-all
 */
router.post('/goal/routing/learn-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    const updated = await RoutingGenerator.learnAll(session);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Confirm Define Goal and move to Research
 * POST /sword/goal/confirm
 */
router.post('/goal/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    const session = await LessonDesigner.getActiveSession(userId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active designer session' },
      });
      return;
    }

    // Validate we have all required data
    if (!session.capstoneData) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Capstone required before continuing' },
      });
      return;
    }

    if (!session.subskillsData || session.subskillsData.subskills.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Subskills required before continuing' },
      });
      return;
    }

    if (!session.routingData || session.routingData.assignments.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Routing required before continuing' },
      });
      return;
    }

    // Update phase to research
    await updateSessionPhase(session.id, 'research', undefined);

    const updatedSession = await LessonDesigner.getActiveSession(userId);

    res.json({
      success: true,
      data: {
        session: updatedSession,
        nextPhase: 'research',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// DEFINE GOAL HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

function buildDefineGoalSummary(capstone: any, subskillsData: any, routing: any): any {
  const subskills = subskillsData.subskills || [];
  const assignments = routing.assignments || [];

  // Count by type
  const byType: Record<string, number> = {};
  for (const s of subskills) {
    byType[s.subskillType] = (byType[s.subskillType] || 0) + 1;
  }

  // Count by route
  const byRoute: Record<string, number> = {};
  for (const a of assignments) {
    byRoute[a.route] = (byRoute[a.route] || 0) + 1;
  }

  // Count by status
  let learn = 0, skip = 0, assess = 0;
  for (const a of assignments) {
    if (a.status === 'learn') learn++;
    else if (a.status === 'skip') skip++;
    else if (a.status === 'assess') assess++;
  }

  return {
    capstoneTitle: capstone.title,
    estimatedTime: capstone.estimatedTime,
    totalSubskills: subskills.length,
    byType,
    totalToLearn: learn,
    totalToSkip: skip,
    totalToAssess: assess,
    byRoute,
  };
}

interface RoutingAssignment {
  subskillId: string;
  route: Route;
  status: RouteStatus;
  reason?: string;
}

function mergeSubskillsWithRouting(subskills: any[], routing: any): any[] {
  const routingMap = new Map<string, RoutingAssignment>(
    (routing.assignments || []).map((a: RoutingAssignment) => [a.subskillId, a])
  );

  return subskills.map(s => {
    const r: RoutingAssignment = routingMap.get(s.id) || { 
      subskillId: s.id, 
      route: 'practice' as Route, 
      status: 'learn' as RouteStatus, 
      reason: 'Default' 
    };
    return {
      ...s,
      route: r.route,
      status: r.status,
      reason: r.reason,
    };
  });
}

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
    console.log('[DELETE /designer] Cancelling for user:', userId);
    
    const session = await LessonDesigner.getActiveSession(userId);
    console.log('[DELETE /designer] Active session:', session?.id || 'none');
    
    if (session) {
      await LessonDesigner.cancelSession(userId);
      console.log('[DELETE /designer] Session cancelled');
    } else {
      console.log('[DELETE /designer] No active session to cancel');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE /designer] Error:', error);
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
