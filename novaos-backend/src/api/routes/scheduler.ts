// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER ROUTES — API Endpoints for Job Management
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from 'express';
import { auth, type AuthenticatedRequest } from '../../auth/index.js';
import {
  getScheduler,
  getJobDefinition,
  getEnabledJobs,
  describeCron,
  type JobId,
} from '../../scheduler/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTER FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

export function createSchedulerRouter(): Router {
  const router = Router();
  const scheduler = getScheduler();

  // ─────────────────────────────────────────────────────────────────────────────
  // SCHEDULER STATUS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /scheduler/status
   * Get scheduler status and all job states
   */
  router.get('/status', auth.middleware(true), async (_req: AuthenticatedRequest, res: Response) => {
    const state = scheduler.getState();
    
    // Enrich job states with definitions
    const jobs = Object.entries(state.jobs).map(([id, jobState]) => {
      const definition = getJobDefinition(id as JobId);
      return {
        ...jobState,
        name: definition?.name,
        description: definition?.description,
        schedule: definition?.schedule.cron 
          ? describeCron(definition.schedule.cron)
          : `Every ${definition?.schedule.intervalMs}ms`,
        priority: definition?.priority,
        enabled: definition?.enabled,
      };
    });
    
    res.json({
      running: state.running,
      startedAt: state.startedAt,
      instanceId: state.instanceId,
      statistics: {
        totalExecutions: state.totalExecutions,
        totalSuccesses: state.totalSuccesses,
        totalFailures: state.totalFailures,
        successRate: state.totalExecutions > 0 
          ? ((state.totalSuccesses / state.totalExecutions) * 100).toFixed(2) + '%'
          : 'N/A',
      },
      jobs,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // JOB DETAILS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /scheduler/jobs/:jobId
   * Get detailed information about a specific job
   */
  router.get('/jobs/:jobId', auth.middleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const jobId = req.params.jobId as JobId;
    const definition = getJobDefinition(jobId);
    const state = scheduler.getJobState(jobId);
    
    if (!definition || !state) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    const history = scheduler.getExecutionHistory(jobId, 20);
    
    res.json({
      definition: {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        schedule: definition.schedule,
        scheduleDescription: definition.schedule.cron 
          ? describeCron(definition.schedule.cron)
          : `Every ${definition.schedule.intervalMs}ms`,
        priority: definition.priority,
        timeout: definition.timeout,
        retryAttempts: definition.retryAttempts,
        retryDelayMs: definition.retryDelayMs,
        enabled: definition.enabled,
        requiresRedis: definition.requiresRedis,
        runOnStartup: definition.runOnStartup,
        exclusive: definition.exclusive,
      },
      state,
      recentExecutions: history,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // JOB CONTROL
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /scheduler/jobs/:jobId/trigger
   * Manually trigger a job
   */
  router.post('/jobs/:jobId/trigger', auth.middleware(true), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobId = req.params.jobId as JobId;
      const definition = getJobDefinition(jobId);
      
      if (!definition) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }
      
      const result = await scheduler.triggerJob(jobId);
      
      if (!result) {
        res.status(400).json({ error: 'Failed to trigger job' });
        return;
      }
      
      res.json({
        triggered: true,
        jobId,
        result,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /scheduler/jobs/:jobId/enable
   * Enable a disabled job
   */
  router.post('/jobs/:jobId/enable', auth.middleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const jobId = req.params.jobId as JobId;
    const success = scheduler.enableJob(jobId);
    
    if (!success) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    res.json({ enabled: true, jobId });
  });

  /**
   * POST /scheduler/jobs/:jobId/disable
   * Disable a job
   */
  router.post('/jobs/:jobId/disable', auth.middleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const jobId = req.params.jobId as JobId;
    const success = scheduler.disableJob(jobId);
    
    if (!success) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    res.json({ disabled: true, jobId });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EXECUTION HISTORY
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /scheduler/history
   * Get recent execution history across all jobs
   */
  router.get('/history', auth.middleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const jobId = req.query.jobId as JobId | undefined;
    
    const history = scheduler.getExecutionHistory(jobId, limit);
    
    res.json({
      executions: history,
      count: history.length,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCHEDULER CONTROL (Admin only)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /scheduler/start
   * Start the scheduler
   */
  router.post('/start', auth.middleware(true), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (scheduler.isRunning()) {
        res.status(400).json({ error: 'Scheduler already running' });
        return;
      }
      
      await scheduler.start();
      res.json({ started: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /scheduler/stop
   * Stop the scheduler
   */
  router.post('/stop', auth.middleware(true), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!scheduler.isRunning()) {
        res.status(400).json({ error: 'Scheduler not running' });
        return;
      }
      
      await scheduler.stop();
      res.json({ stopped: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
