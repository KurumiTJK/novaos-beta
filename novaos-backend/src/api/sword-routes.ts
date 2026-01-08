// ═══════════════════════════════════════════════════════════════════════════════
// SWORD API ROUTES v3 - SIMPLIFIED
// No Research, Node Gen, Sequencing, or Method Nodes
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from 'express';
import { SwordGate, LessonDesigner, LessonRunner } from '../services/sword/index.js';
import { ExplorationService } from '../services/sword/lesson-designer/exploration.js';
import { CapstoneGenerator } from '../services/sword/lesson-designer/capstone.js';
import { SubskillsGenerator } from '../services/sword/lesson-designer/subskills.js';
import { RoutingGenerator } from '../services/sword/lesson-designer/routing.js';
import { updateSessionPhase, updatePhaseData } from '../services/sword/lesson-designer/session.js';
import { AssessmentHandler } from '../services/sword/lesson-runner/router/assess.js';
import { SparkGenerator } from '../services/sword/spark/index.js';
import { getSupabase } from '../db/index.js';
import { mapSubskillAssessment } from '../services/sword/lesson-runner/types.js';
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
 */
router.post('/explore/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    let { sessionId, topic } = req.body;
    
    if (!sessionId) {
      const existingSession = await LessonDesigner.getActiveSession(userId);
      if (existingSession) {
        sessionId = existingSession.id;
      } else {
        const newSession = await LessonDesigner.startSession(userId, topic || 'New Learning Goal');
        sessionId = newSession.id;
      }
    }

    const result = await ExplorationService.start(sessionId, topic);

    res.json({
      success: true,
      data: {
        sessionId,
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
 * Confirm Orient → move to Clarify
 * POST /sword/explore/confirm
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
 * Get Clarify data
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
 * Update a field
 * PATCH /sword/explore/field
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
 * Update constraints
 * PATCH /sword/explore/constraints
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
    await updatePhaseData(sessionId, 'exploration', explorationData);
    await updateSessionPhase(sessionId, 'capstone', undefined);

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
// DEFINE GOAL ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate all Define Goal steps (capstone → subskills → routing)
 * POST /sword/goal/generate
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

    const sessionAfterCapstone = await LessonDesigner.getActiveSession(userId);
    if (!sessionAfterCapstone) throw new Error('Session lost after capstone');

    // Step 2: Generate subskills
    console.log('[DEFINE GOAL] Step 2: Generating subskills...');
    const subskillsData = await SubskillsGenerator.generate(sessionAfterCapstone);

    const sessionAfterSubskills = await LessonDesigner.getActiveSession(userId);
    if (!sessionAfterSubskills) throw new Error('Session lost after subskills');

    // Step 3: Generate routing
    console.log('[DEFINE GOAL] Step 3: Generating routing...');
    const routingData = await RoutingGenerator.generate(sessionAfterSubskills);

    const finalSession = await LessonDesigner.getActiveSession(userId);

    const summary = buildDefineGoalSummary(capstoneData, subskillsData, routingData);
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
 * Regenerate capstone
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

// ─────────────────────────────────────────────────────────────────────────────────
// REVIEW ENDPOINTS (NEW - replaces research + old review)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get review preview - shows capstone, subskills, and stats
 * GET /sword/review
 */
router.get('/review', async (req: Request, res: Response, next: NextFunction) => {
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

    // Check if we have all required data
    if (!session.capstoneData || !session.subskillsData || !session.routingData) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Define Goal must be completed first' },
      });
      return;
    }

    const preview = await LessonDesigner.getReviewPreview(session.id);

    res.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    console.error('[REVIEW] Get preview error:', error);
    next(error);
  }
});

/**
 * Confirm and create plan
 * POST /sword/review/confirm
 */
router.post('/review/confirm', async (req: Request, res: Response, next: NextFunction) => {
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

    // Check if we have all required data
    if (!session.capstoneData || !session.subskillsData || !session.routingData) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Define Goal must be completed first' },
      });
      return;
    }

    console.log('[REVIEW] Creating plan for session:', session.id);
    
    const plan = await LessonDesigner.createPlan(session.id);

    console.log('[REVIEW] Plan created:', plan.id);

    res.json({
      success: true,
      data: {
        plan,
        message: 'Plan created successfully!',
        redirectTo: '/learn',
      },
    });
  } catch (error) {
    console.error('[REVIEW] Confirm error:', error);
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

function buildDefineGoalSummary(capstone: any, subskillsData: any, routing: any): any {
  const subskills = subskillsData.subskills || [];
  const assignments = routing.assignments || [];

  const byType: Record<string, number> = {};
  for (const s of subskills) {
    byType[s.subskillType] = (byType[s.subskillType] || 0) + 1;
  }

  const byRoute: Record<string, number> = {};
  for (const a of assignments) {
    byRoute[a.route] = (byRoute[a.route] || 0) + 1;
  }

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

// POST /sword/designer/goal - Run Define Goal phase
router.post('/designer/goal',
  validate(GoalDefinitionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { goal, topic, context } = req.body;
      
      const session = await LessonDesigner.getActiveSession(userId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No active designer session' },
        });
        return;
      }
      
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

// POST /sword/designer/finalize - Create plan (convenience alias for /review/confirm)
router.post('/designer/finalize', async (req: Request, res: Response, next: NextFunction) => {
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

// GET /sword/plans/:planId/subskills - Get subskills for a plan
router.get('/plans/:planId/subskills',
  validateParams(PlanIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { planId } = req.params;
      const subskills = await SwordGate.getPlanSubskills(planId!);
      res.json({ success: true, data: subskills });
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

// DELETE /sword/plans/:planId - Delete a single plan
router.delete('/plans/:planId',
  validateParams(PlanIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { planId } = req.params;
      
      await SwordGate.deletePlan(userId, planId!);
      
      res.json({ 
        success: true, 
        message: 'Plan deleted successfully' 
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /sword/plans - Delete all plans for user
router.delete('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { confirm } = req.query;
    
    // Require confirmation query param
    if (confirm !== 'true') {
      res.status(400).json({
        success: false,
        error: { 
          code: 'CONFIRMATION_REQUIRED', 
          message: 'Add ?confirm=true to delete all plans' 
        },
      });
      return;
    }
    
    const count = await SwordGate.deleteAllPlans(userId);
    
    res.json({ 
      success: true, 
      message: `Deleted ${count} plan(s)`,
      deletedCount: count,
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// STATS
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
// LESSON RUNNER - SUBSKILL MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

// POST /sword/runner/subskill/:subskillId/start - Start a subskill (routes to skip/assess/learn)
router.post('/runner/subskill/:subskillId/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const result = await LessonRunner.startSubskill(userId, subskillId);
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /sword/runner/subskill/:subskillId - Get subskill details
router.get('/runner/subskill/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const subskill = await LessonRunner.getSubskill(subskillId);
    
    if (!subskill) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subskill not found' },
      });
      return;
    }
    
    res.json({ success: true, data: subskill });
  } catch (error) {
    next(error);
  }
});

// GET /sword/runner/subskills/:planId - Get all subskills for a plan
router.get('/runner/subskills/:planId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = req.params;
    
    if (!planId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'planId required' },
      });
      return;
    }
    
    const subskills = await LessonRunner.getAllSubskills(planId);
    
    res.json({ success: true, data: subskills });
  } catch (error) {
    next(error);
  }
});

// GET /sword/runner/subskill/current/:planId - Get current subskill for a plan
router.get('/runner/subskill/current/:planId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = req.params;
    
    if (!planId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'planId required' },
      });
      return;
    }
    
    const subskill = await LessonRunner.getCurrentSubskill(planId);
    
    res.json({ success: true, data: subskill });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON RUNNER - DIAGNOSTIC (Assessment)
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/runner/diagnostic/:subskillId - Get diagnostic test
router.get('/runner/diagnostic/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const assessment = await LessonRunner.getDiagnostic(userId, subskillId);
    
    res.json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
});

// POST /sword/runner/diagnostic/submit - Submit diagnostic answers
router.post('/runner/diagnostic/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { assessmentId, answers } = req.body;
    
    if (!assessmentId || !answers) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'assessmentId and answers required' },
      });
      return;
    }
    
    const result = await LessonRunner.submitDiagnostic(userId, { assessmentId, answers });
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON RUNNER - DAILY LESSONS (Sessions)
// ─────────────────────────────────────────────────────────────────────────────────

// POST /sword/runner/session/start - Start a learning session
router.post('/runner/session/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.body;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const result = await LessonRunner.startSession(userId, subskillId);
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /sword/runner/session/:subskillId/:sessionNumber - Get specific session
router.get('/runner/session/:subskillId/:sessionNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId, sessionNumber } = req.params;
    
    if (!subskillId || !sessionNumber) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId and sessionNumber required' },
      });
      return;
    }
    
    const session = await LessonRunner.getSession(userId, subskillId, parseInt(sessionNumber));
    
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }
    
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// POST /sword/runner/session/:dailyLessonId/complete - Complete a session
router.post('/runner/session/:dailyLessonId/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { dailyLessonId } = req.params;
    
    if (!dailyLessonId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'dailyLessonId required' },
      });
      return;
    }
    
    const result = await LessonRunner.completeSession(userId, dailyLessonId);
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /sword/runner/session/:subskillId/:sessionNumber/regenerate - Regenerate session
router.post('/runner/session/:subskillId/:sessionNumber/regenerate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId, sessionNumber } = req.params;
    
    if (!subskillId || !sessionNumber) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId and sessionNumber required' },
      });
      return;
    }
    
    const session = await LessonRunner.regenerateSession(userId, subskillId, parseInt(sessionNumber));
    
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON RUNNER - KNOWLEDGE CHECK (Mastery Gate)
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/runner/check/:subskillId - Get knowledge check
router.get('/runner/check/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const check = await LessonRunner.getKnowledgeCheck(userId, subskillId);
    
    res.json({ success: true, data: check });
  } catch (error) {
    next(error);
  }
});

// POST /sword/runner/check/submit - Submit knowledge check answers
router.post('/runner/check/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { checkId, answers } = req.body;
    
    if (!checkId || !answers) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'checkId and answers required' },
      });
      return;
    }
    
    const result = await LessonRunner.submitKnowledgeCheck(userId, { checkId, answers });
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON RUNNER - DIAGNOSTIC ASSESSMENT
// For subskills with routeStatus='assess' - determines if user can skip or needs to learn
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/runner/diagnostic/:subskillId - Get diagnostic assessment (strips correct answers)
router.get('/runner/diagnostic/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    // Start subskill routes to assess flow and returns assessment
    const result = await LessonRunner.startSubskill(userId, subskillId);
    
    if (result.routeType !== 'assess' || !result.assessment) {
      res.status(400).json({
        success: false,
        error: { code: 'NOT_ASSESS', message: 'Subskill is not in assess status' },
      });
      return;
    }
    
    // Strip correct answers before sending to client
    const forUser = AssessmentHandler.getForUser(result.assessment);
    
    res.json({ success: true, data: forUser });
  } catch (error) {
    next(error);
  }
});

// POST /sword/runner/diagnostic/submit - Submit diagnostic assessment answers
router.post('/runner/diagnostic/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { assessmentId, answers } = req.body;
    
    if (!assessmentId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'assessmentId required' },
      });
      return;
    }
    
    if (!answers || !Array.isArray(answers)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'answers array required' },
      });
      return;
    }
    
    const result = await LessonRunner.submitDiagnostic(userId, { assessmentId, answers });
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /sword/runner/diagnostic/:assessmentId/results - Get detailed results after completion
router.get('/runner/diagnostic/:assessmentId/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { assessmentId } = req.params;
    
    if (!assessmentId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'assessmentId required' },
      });
      return;
    }
    
    const supabase = getSupabase();
    
    // Get user's internal ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('external_id', userId)
      .single();
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }
    
    const { data: assessmentRow } = await supabase
      .from('subskill_assessments')
      .select('*')
      .eq('id', assessmentId)
      .eq('user_id', user.id)
      .single();
    
    if (!assessmentRow) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Assessment not found' },
      });
      return;
    }
    
    if (!assessmentRow.completed_at) {
      res.status(400).json({
        success: false,
        error: { code: 'NOT_COMPLETED', message: 'Assessment not completed yet' },
      });
      return;
    }
    
    const assessment = mapSubskillAssessment(assessmentRow);
    const results = AssessmentHandler.getResults(assessment);
    
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON RUNNER - PROGRESS
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/runner/progress/subskill/:subskillId - Get subskill progress
router.get('/runner/progress/subskill/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const progress = await LessonRunner.getSubskillProgress(userId, subskillId);
    
    res.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

// GET /sword/runner/progress/plan/:planId - Get plan progress
router.get('/runner/progress/plan/:planId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { planId } = req.params;
    
    if (!planId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'planId required' },
      });
      return;
    }
    
    const progress = await LessonRunner.getPlanProgress(userId, planId);
    
    res.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

// GET /sword/runner/history/:subskillId - Get session history
router.get('/runner/history/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const history = await LessonRunner.getSessionHistory(userId, subskillId);
    
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON RUNNER - LESSON PLAN
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/runner/lesson-plan/:subskillId - Get lesson plan for a subskill
router.get('/runner/lesson-plan/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const lessonPlan = await LessonRunner.getLessonPlan(subskillId);
    
    if (!lessonPlan) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lesson plan not found' },
      });
      return;
    }
    
    res.json({ success: true, data: lessonPlan });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON RUNNER - REFRESH (Gap Detection)
// ─────────────────────────────────────────────────────────────────────────────────

// GET /sword/runner/refresh/:subskillId - Check if needs refresh
router.get('/runner/refresh/:subskillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const result = await LessonRunner.checkNeedsRefresh(userId, subskillId);
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /sword/runner/refresh/:subskillId/content - Get refresh content
router.get('/runner/refresh/:subskillId/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    const content = await LessonRunner.getRefreshContent(userId, subskillId);
    
    res.json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

// POST /sword/runner/refresh/:subskillId/skip - Skip refresh
router.post('/runner/refresh/:subskillId/skip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { subskillId } = req.params;
    
    if (!subskillId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subskillId required' },
      });
      return;
    }
    
    await LessonRunner.skipRefresh(userId, subskillId);
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

// POST /sword/spark - Generate new spark based on today's context
router.post('/spark', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    const result = await SparkGenerator.generate(userId);
    
    // No active plan → return null
    if (!result) {
      res.json({ success: true, data: null });
      return;
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /sword/spark/current - Get most recent active spark
router.get('/spark/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    
    const spark = await SparkGenerator.getCurrent(userId);
    
    res.json({ success: true, data: spark });
  } catch (error) {
    next(error);
  }
});

// POST /sword/spark/:sparkId/complete - Mark spark complete
router.post('/spark/:sparkId/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { sparkId } = req.params;
    
    if (!sparkId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sparkId required' },
      });
      return;
    }
    
    const spark = await SparkGenerator.complete(userId, sparkId);
    
    res.json({ success: true, data: spark });
  } catch (error) {
    next(error);
  }
});

// POST /sword/spark/:sparkId/skip - Skip spark with optional reason
router.post('/spark/:sparkId/skip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { sparkId } = req.params;
    const { reason } = req.body || {};
    
    if (!sparkId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sparkId required' },
      });
      return;
    }
    
    const spark = await SparkGenerator.skip(userId, sparkId, reason);
    
    res.json({ success: true, data: spark });
  } catch (error) {
    next(error);
  }
});

// GET /sword/sparks - List all user's sparks
router.get('/sparks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as 'active' | 'completed' | 'skipped' | undefined;
    
    const sparks = await SparkGenerator.getAll(userId, limit, status);
    
    res.json({ success: true, data: sparks });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────────

export { router as swordRoutes };
