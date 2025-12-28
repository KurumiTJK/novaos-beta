// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE ROUTES — Daily Practice API Endpoints
// NovaOS API Layer — Phase 18: Deliberate Practice Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// Endpoints for the Deliberate Practice flow:
//
//   GET  /practice/today        — Get today's practice (drill + skill + context)
//   POST /practice/complete     — Complete today's practice with outcome
//   POST /practice/skip         — Skip today's practice
//   GET  /practice/progress     — Get goal progress
//   GET  /practice/week         — Get current week plan
//
// These endpoints use PracticeOrchestrator which coordinates between
// the Deliberate Practice Engine and SparkEngine.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { GoalId, UserId } from '../../types/branded.js';
import type { PracticeOrchestrator } from '../../services/deliberate-practice-engine/practice-orchestrator.js';
import type { IDeliberatePracticeEngine } from '../../services/deliberate-practice-engine/interfaces.js';
import { isOk } from '../../types/result.js';
import { auth, type AuthenticatedRequest } from '../../auth/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

const GetTodayPracticeSchema = z.object({
  goalId: z.string().min(1),
});

const CompletePracticeSchema = z.object({
  goalId: z.string().min(1),
  passSignalMet: z.boolean(),
  observation: z.string().optional(),
});

const SkipPracticeSchema = z.object({
  goalId: z.string().min(1),
  reason: z.string().optional(),
});

const GetProgressSchema = z.object({
  goalId: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR CLASS
// ─────────────────────────────────────────────────────────────────────────────────

class PracticeApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'PracticeApiError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface PracticeRouterConfig {
  practiceEngine?: IDeliberatePracticeEngine;
  practiceOrchestrator?: PracticeOrchestrator;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create practice routes.
 */
export function createPracticeRoutes(config: PracticeRouterConfig): Router {
  const router = Router();
  const { practiceEngine, practiceOrchestrator } = config;

  // Middleware to ensure practice engine is available
  const requirePracticeEngine = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (!practiceEngine && !practiceOrchestrator) {
      res.status(503).json({
        error: 'Practice engine not available',
        code: 'PRACTICE_ENGINE_UNAVAILABLE',
      });
      return;
    }
    next();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /practice/today — Get today's practice
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/practice/today',
    auth.middleware(true),
    requirePracticeEngine,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const parseResult = GetTodayPracticeSchema.safeParse(req.query);
        if (!parseResult.success) {
          throw new PracticeApiError(400, 'Missing or invalid goalId', 'INVALID_REQUEST');
        }

        const { goalId } = parseResult.data;
        const userId = req.user!.id as UserId;

        // Use orchestrator if available (preferred), otherwise use engine directly
        if (practiceOrchestrator) {
          const result = await practiceOrchestrator.getTodayPractice(
            userId,
            goalId as GoalId
          );

          if (!isOk(result)) {
            throw new PracticeApiError(500, result.error.message, result.error.code);
          }

          const practice = result.value;
          res.json({
            hasContent: practice.hasContent,
            date: practice.date,
            drill: practice.drill
              ? {
                  id: practice.drill.id,
                  action: practice.drill.action,
                  passSignal: practice.drill.passSignal,
                  constraint: practice.drill.constraint,
                  outcome: practice.drill.outcome,
                }
              : null,
            skill: practice.skill
              ? {
                  id: practice.skill.id,
                  action: practice.skill.action,
                  successSignal: practice.skill.successSignal,
                  mastery: practice.skill.mastery,
                }
              : null,
            weekPlan: practice.weekPlan
              ? {
                  id: practice.weekPlan.id,
                  weekNumber: practice.weekPlan.weekNumber,
                  status: practice.weekPlan.status,
                }
              : null,
            goal: practice.goal
              ? {
                  id: practice.goal.id,
                  title: practice.goal.title,
                }
              : null,
            context: practice.context,
            isRetry: practice.isRetry,
            retryCount: practice.retryCount,
          });
        } else if (practiceEngine) {
          const result = await practiceEngine.getTodayPractice(
            userId,
            goalId as GoalId
          );

          if (!isOk(result)) {
            throw new PracticeApiError(500, result.error.message, result.error.code);
          }

          const practice = result.value;
          res.json({
            hasContent: practice.hasContent,
            date: practice.date,
            drill: practice.drill,
            skill: practice.skill,
            weekPlan: practice.weekPlan,
            spark: practice.spark,
          });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /practice/complete — Complete today's practice
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/practice/complete',
    auth.middleware(true),
    requirePracticeEngine,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const parseResult = CompletePracticeSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new PracticeApiError(400, 'Invalid request body', 'INVALID_REQUEST');
        }

        const { goalId, passSignalMet, observation } = parseResult.data;
        const userId = req.user!.id as UserId;

        if (practiceOrchestrator) {
          const result = await practiceOrchestrator.completeTodayPractice(
            userId,
            goalId as GoalId,
            {
              passSignalMet,
              observation,
            }
          );

          if (!isOk(result)) {
            throw new PracticeApiError(500, result.error.message, result.error.code);
          }

          res.json({
            success: true,
            drill: result.value.drill,
            message: result.value.message,
            nextAction: result.value.nextAction,
          });
        } else if (practiceEngine) {
          // Get today's drill first
          const todayResult = await practiceEngine.getTodayPractice(
            userId,
            goalId as GoalId
          );

          if (!isOk(todayResult) || !todayResult.value.drill) {
            throw new PracticeApiError(404, 'No drill found for today', 'NO_DRILL');
          }

          const drillId = todayResult.value.drill.id;
          const outcome = passSignalMet ? 'pass' as const : 'fail' as const;

          const result = await practiceEngine.recordOutcome(drillId, {
            outcome,
            observation,
          });

          if (!isOk(result)) {
            throw new PracticeApiError(500, result.error.message, result.error.code);
          }

          res.json({
            success: true,
            drill: result.value,
          });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /practice/skip — Skip today's practice
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/practice/skip',
    auth.middleware(true),
    requirePracticeEngine,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const parseResult = SkipPracticeSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new PracticeApiError(400, 'Invalid request body', 'INVALID_REQUEST');
        }

        const { goalId, reason } = parseResult.data;
        const userId = req.user!.id as UserId;

        if (practiceOrchestrator) {
          const result = await practiceOrchestrator.skipTodayPractice(
            userId,
            goalId as GoalId,
            reason
          );

          if (!isOk(result)) {
            throw new PracticeApiError(500, result.error.message, result.error.code);
          }

          res.json({
            success: true,
            skipped: true,
            message: 'Practice skipped. Will retry tomorrow.',
          });
        } else if (practiceEngine) {
          const todayResult = await practiceEngine.getTodayPractice(
            userId,
            goalId as GoalId
          );

          if (!isOk(todayResult) || !todayResult.value.drill) {
            throw new PracticeApiError(404, 'No drill found for today', 'NO_DRILL');
          }

          const drillId = todayResult.value.drill.id;
          const result = await practiceEngine.skipDrill(drillId, reason);

          if (!isOk(result)) {
            throw new PracticeApiError(500, result.error.message, result.error.code);
          }

          res.json({
            success: true,
            skipped: true,
            drill: result.value,
          });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /practice/progress — Get goal progress
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/practice/progress',
    auth.middleware(true),
    requirePracticeEngine,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const parseResult = GetProgressSchema.safeParse(req.query);
        if (!parseResult.success) {
          throw new PracticeApiError(400, 'Missing or invalid goalId', 'INVALID_REQUEST');
        }

        const { goalId } = parseResult.data;

        if (!practiceEngine) {
          throw new PracticeApiError(503, 'Practice engine not available', 'UNAVAILABLE');
        }

        const result = await practiceEngine.getProgress(goalId as GoalId);

        if (!isOk(result)) {
          throw new PracticeApiError(500, result.error.message, result.error.code);
        }

        res.json(result.value);
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /practice/week — Get current week plan
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/practice/week',
    auth.middleware(true),
    requirePracticeEngine,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const parseResult = GetProgressSchema.safeParse(req.query);
        if (!parseResult.success) {
          throw new PracticeApiError(400, 'Missing or invalid goalId', 'INVALID_REQUEST');
        }

        const { goalId } = parseResult.data;

        if (!practiceEngine) {
          throw new PracticeApiError(503, 'Practice engine not available', 'UNAVAILABLE');
        }

        const result = await practiceEngine.getCurrentWeek(goalId as GoalId);

        if (!isOk(result)) {
          throw new PracticeApiError(500, result.error.message, result.error.code);
        }

        res.json({
          weekPlan: result.value,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /practice/plan — Get full learning plan
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/practice/plan',
    auth.middleware(true),
    requirePracticeEngine,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const parseResult = GetProgressSchema.safeParse(req.query);
        if (!parseResult.success) {
          throw new PracticeApiError(400, 'Missing or invalid goalId', 'INVALID_REQUEST');
        }

        const { goalId } = parseResult.data;

        if (!practiceEngine) {
          throw new PracticeApiError(503, 'Practice engine not available', 'UNAVAILABLE');
        }

        const result = await practiceEngine.getLearningPlan(goalId as GoalId);

        if (!isOk(result)) {
          throw new PracticeApiError(500, result.error.message, result.error.code);
        }

        res.json({
          learningPlan: result.value,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR HANDLER
  // ─────────────────────────────────────────────────────────────────────────────

  router.use(
    (
      error: Error,
      _req: Request,
      res: Response,
      _next: NextFunction
    ): void => {
      if (error instanceof PracticeApiError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      console.error('[PRACTICE_ROUTES] Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  );

  return router;
}

export default createPracticeRoutes;
