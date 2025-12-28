// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE JOB HANDLERS — Deliberate Practice Scheduled Tasks
// NovaOS Scheduler — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Scheduled jobs for the Deliberate Practice Engine:
//
//   1. generate_daily_drills (6 AM)
//      - Generates drills for all users with active learning plans
//      - Creates sparks and schedules reminders
//
//   2. week_transition (Sunday midnight)
//      - Completes current week plans
//      - Creates next week plans
//      - Identifies carry-forward skills
//
//   3. drill_reconciliation (11 PM)
//      - Marks incomplete drills as missed
//      - Updates skill mastery
//      - Triggers roll-forward logic
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { JobContext, JobResult, JobHandler, PracticeJobId } from '../types.js';
import { getLogger } from '../../observability/logging/index.js';
import { getStore } from '../../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'practice-job-handlers' });

// ─────────────────────────────────────────────────────────────────────────────────
// RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface GenerateDailyDrillsJobResult {
  usersProcessed: number;
  drillsGenerated: number;
  sparksCreated: number;
  usersSkipped: number;
  errorsByUser?: Record<string, string>;
}

export interface WeekTransitionJobResult {
  goalsProcessed: number;
  weeksCompleted: number;
  weeksCreated: number;
  skillsCarriedForward: number;
  goalsCompleted: number;
}

export interface DrillReconciliationJobResult {
  usersProcessed: number;
  drillsMarkedMissed: number;
  drillsAlreadyComplete: number;
  skillMasteryUpdates: number;
  carryForwardsCreated: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATE DAILY DRILLS HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generates daily drills for all users with active learning plans.
 *
 * Schedule: 6 AM daily
 *
 * For each user with an active learning plan:
 * 1. Get today's date in user's timezone
 * 2. Check if drill already exists for today
 * 3. Generate new drill using DrillGenerator (with roll-forward)
 * 4. Create spark for the drill
 * 5. Schedule reminders
 */
export const generateDailyDrillsHandler: JobHandler = async (
  context: JobContext
): Promise<JobResult> => {
  logger.info('Starting generate daily drills job', {
    executionId: context.executionId,
  });

  const store = getStore();
  const errors: string[] = [];
  const errorsByUser: Record<string, string> = {};

  let usersProcessed = 0;
  let drillsGenerated = 0;
  let sparksCreated = 0;
  let usersSkipped = 0;

  try {
    // Get all users with active learning plans
    const planKeys = await store.keys('practice:plan:*');
    const goalIds = planKeys.map(key => {
      const match = key.match(/practice:plan:([^:]+)/);
      return match?.[1];
    }).filter((id): id is string => !!id);

    logger.info('Found active learning plans', { count: goalIds.length });

    for (const goalId of goalIds) {
      try {
        // Get learning plan
        const planData = await store.get(`practice:plan:${goalId}`);
        if (!planData) {
          usersSkipped++;
          continue;
        }

        const plan = JSON.parse(planData);
        if (plan.status !== 'active') {
          usersSkipped++;
          continue;
        }

        usersProcessed++;

        // Get user's timezone from goal config
        const goalData = await store.get(`sword:goal:${goalId}`);
        const goal = goalData ? JSON.parse(goalData) : null;
        const timezone = goal?.reminderConfig?.timezone ?? 'UTC';

        // Get today's date in user's timezone
        const today = getTodayInTimezone(timezone);

        // Check if drill already exists for today
        const existingDrillKey = `practice:drill:${goalId}:${today}`;
        const existingDrill = await store.get(existingDrillKey);
        if (existingDrill) {
          logger.debug('Drill already exists for today', { goalId, date: today });
          continue;
        }

        // Generate drill (placeholder - actual implementation would use DrillGenerator)
        // In production, this would:
        // 1. Get current week plan
        // 2. Call DrillGenerator.generate()
        // 3. Save drill to store
        // 4. Create spark via SparkIntegration
        // 5. Schedule reminders

        const drillId = `drill-${goalId}-${today}-${Date.now().toString(36)}`;
        const drill = {
          id: drillId,
          goalId,
          scheduledDate: today,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        await store.set(existingDrillKey, JSON.stringify(drill));
        drillsGenerated++;

        // Create spark for the drill (placeholder)
        const sparkId = `spark-${drillId}`;
        const spark = {
          id: sparkId,
          drillId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        await store.set(`practice:spark:${sparkId}`, JSON.stringify(spark));
        sparksCreated++;

        logger.debug('Generated drill and spark', { goalId, drillId, sparkId });

      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Goal ${goalId}: ${msg}`);
        errorsByUser[goalId] = msg;
        logger.warn('Error generating drill for goal', { goalId, error: msg });
      }
    }

    const result: JobResult = {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed: usersProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        usersProcessed,
        drillsGenerated,
        sparksCreated,
        usersSkipped,
        errorsByUser: Object.keys(errorsByUser).length > 0 ? errorsByUser : undefined,
      } satisfies GenerateDailyDrillsJobResult,
    };

    logger.info('Generate daily drills job completed', result.metadata);
    return result;

  } catch (error) {
    logger.error('Generate daily drills job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      itemsProcessed: usersProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// WEEK TRANSITION HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Handles weekly transitions for learning plans.
 *
 * Schedule: Sunday midnight
 *
 * For each active learning plan:
 * 1. Complete current week (calculate stats)
 * 2. Identify carry-forward skills
 * 3. Create next week plan
 * 4. Check if goal is complete
 */
export const weekTransitionHandler: JobHandler = async (
  context: JobContext
): Promise<JobResult> => {
  logger.info('Starting week transition job', {
    executionId: context.executionId,
  });

  const store = getStore();
  const errors: string[] = [];

  let goalsProcessed = 0;
  let weeksCompleted = 0;
  let weeksCreated = 0;
  let skillsCarriedForward = 0;
  let goalsCompleted = 0;

  try {
    // Get all active learning plans
    const planKeys = await store.keys('practice:plan:*');

    for (const planKey of planKeys) {
      try {
        const planData = await store.get(planKey);
        if (!planData) continue;

        const plan = JSON.parse(planData);
        if (plan.status !== 'active') continue;

        const goalId = plan.goalId;
        goalsProcessed++;

        // Get current week
        const currentWeekData = await store.get(`practice:week:${goalId}:current`);
        if (!currentWeekData) {
          logger.debug('No current week found', { goalId });
          continue;
        }

        const currentWeek = JSON.parse(currentWeekData);

        // Complete current week (placeholder - actual implementation would use WeekTracker)
        currentWeek.status = 'completed';
        currentWeek.completedAt = new Date().toISOString();

        // Calculate week stats
        const drillKeys = await store.keys(`practice:drill:${goalId}:*`);
        let passed = 0;
        let failed = 0;

        for (const drillKey of drillKeys) {
          const drillData = await store.get(drillKey);
          if (!drillData) continue;
          const drill = JSON.parse(drillData);
          if (drill.weekId === currentWeek.id) {
            if (drill.outcome === 'pass') passed++;
            else if (drill.outcome === 'fail' || drill.outcome === 'skipped') failed++;
          }
        }

        currentWeek.stats = {
          drillsCompleted: passed + failed,
          drillsPassed: passed,
          drillsFailed: failed,
          passRate: (passed + failed) > 0 ? passed / (passed + failed) : 0,
        };

        await store.set(`practice:week:${goalId}:${currentWeek.id}`, JSON.stringify(currentWeek));
        weeksCompleted++;

        // Check for carry-forward skills
        const carryForwardSkills: string[] = [];
        if (currentWeek.stats.passRate < 0.7) {
          // Mark skills that need more practice
          // Placeholder - actual implementation would identify specific skills
          skillsCarriedForward += 1;
          carryForwardSkills.push('placeholder-skill');
        }

        // Check if all weeks complete (goal finished)
        const allWeeksData = await store.get(`practice:plan:${goalId}:weeks`);
        const allWeeks = allWeeksData ? JSON.parse(allWeeksData) : [];
        const pendingWeeks = allWeeks.filter((w: { status: string }) => w.status === 'pending');

        if (pendingWeeks.length === 0) {
          // Goal complete!
          plan.status = 'completed';
          plan.completedAt = new Date().toISOString();
          await store.set(planKey, JSON.stringify(plan));
          goalsCompleted++;
          logger.info('Learning plan completed', { goalId });
        } else {
          // Create next week
          const nextWeek = pendingWeeks[0];
          nextWeek.status = 'active';
          nextWeek.activatedAt = new Date().toISOString();
          nextWeek.carryForwardSkills = carryForwardSkills;

          await store.set(`practice:week:${goalId}:current`, JSON.stringify(nextWeek));
          await store.set(`practice:week:${goalId}:${nextWeek.id}`, JSON.stringify(nextWeek));
          weeksCreated++;

          logger.debug('Created next week', { goalId, weekId: nextWeek.id });
        }

      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(msg);
        logger.warn('Error processing week transition', { error: msg });
      }
    }

    const result: JobResult = {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed: goalsProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        goalsProcessed,
        weeksCompleted,
        weeksCreated,
        skillsCarriedForward,
        goalsCompleted,
      } satisfies WeekTransitionJobResult,
    };

    logger.info('Week transition job completed', result.metadata);
    return result;

  } catch (error) {
    logger.error('Week transition job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      itemsProcessed: goalsProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// DRILL RECONCILIATION HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Reconciles incomplete drills at end of day.
 *
 * Schedule: 11 PM daily
 *
 * For each active learning plan:
 * 1. Get today's drill
 * 2. If not completed, mark as missed
 * 3. Update skill mastery
 * 4. Create carry-forward for tomorrow
 */
export const drillReconciliationHandler: JobHandler = async (
  context: JobContext
): Promise<JobResult> => {
  logger.info('Starting drill reconciliation job', {
    executionId: context.executionId,
  });

  const store = getStore();
  const errors: string[] = [];

  let usersProcessed = 0;
  let drillsMarkedMissed = 0;
  let drillsAlreadyComplete = 0;
  let skillMasteryUpdates = 0;
  let carryForwardsCreated = 0;

  try {
    // Get all active learning plans
    const planKeys = await store.keys('practice:plan:*');

    for (const planKey of planKeys) {
      try {
        const planData = await store.get(planKey);
        if (!planData) continue;

        const plan = JSON.parse(planData);
        if (plan.status !== 'active') continue;

        const goalId = plan.goalId;
        usersProcessed++;

        // Get user's timezone
        const goalData = await store.get(`sword:goal:${goalId}`);
        const goal = goalData ? JSON.parse(goalData) : null;
        const timezone = goal?.reminderConfig?.timezone ?? 'UTC';

        // Get today's date in user's timezone
        const today = getTodayInTimezone(timezone);

        // Get today's drill
        const drillKey = `practice:drill:${goalId}:${today}`;
        const drillData = await store.get(drillKey);

        if (!drillData) {
          logger.debug('No drill found for today', { goalId, date: today });
          continue;
        }

        const drill = JSON.parse(drillData);

        // Check if already completed
        if (drill.status === 'completed') {
          drillsAlreadyComplete++;
          continue;
        }

        // Mark as missed
        drill.status = 'missed';
        drill.outcome = 'skipped';
        drill.missedAt = new Date().toISOString();

        await store.set(drillKey, JSON.stringify(drill));
        drillsMarkedMissed++;

        // Update skill mastery (placeholder)
        // In production, this would:
        // 1. Get the skill for this drill
        // 2. Reduce mastery or keep as "not_started"
        // 3. Save updated skill
        if (drill.skillId) {
          const skillKey = `practice:skill:${drill.skillId}`;
          const skillData = await store.get(skillKey);
          if (skillData) {
            const skill = JSON.parse(skillData);
            skill.consecutiveMisses = (skill.consecutiveMisses ?? 0) + 1;
            await store.set(skillKey, JSON.stringify(skill));
            skillMasteryUpdates++;
          }
        }

        // Create carry-forward for tomorrow
        const tomorrow = getTomorrowInTimezone(timezone);
        const carryForward = {
          fromDrillId: drill.id,
          fromDate: today,
          skillId: drill.skillId,
          reason: 'missed',
          createdAt: new Date().toISOString(),
        };

        await store.set(
          `practice:carryforward:${goalId}:${tomorrow}`,
          JSON.stringify(carryForward)
        );
        carryForwardsCreated++;

        logger.debug('Drill marked missed with carry-forward', {
          goalId,
          drillId: drill.id,
          tomorrow,
        });

      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(msg);
        logger.warn('Error reconciling drill', { error: msg });
      }
    }

    const result: JobResult = {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed: usersProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        usersProcessed,
        drillsMarkedMissed,
        drillsAlreadyComplete,
        skillMasteryUpdates,
        carryForwardsCreated,
      } satisfies DrillReconciliationJobResult,
    };

    logger.info('Drill reconciliation job completed', result.metadata);
    return result;

  } catch (error) {
    logger.error('Drill reconciliation job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      itemsProcessed: usersProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get today's date in YYYY-MM-DD format for a timezone.
 */
function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Get tomorrow's date in YYYY-MM-DD format for a timezone.
 */
function getTomorrowInTimezone(timezone: string): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(tomorrow);
}

// ─────────────────────────────────────────────────────────────────────────────────
// HANDLER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

export const PRACTICE_JOB_HANDLERS: Map<PracticeJobId, JobHandler> = new Map([
  ['generate_daily_drills', generateDailyDrillsHandler],
  ['week_transition', weekTransitionHandler],
  ['drill_reconciliation', drillReconciliationHandler],
]);

export function getPracticeJobHandler(jobId: PracticeJobId): JobHandler | undefined {
  return PRACTICE_JOB_HANDLERS.get(jobId);
}

export function hasPracticeJobHandler(jobId: string): boolean {
  return PRACTICE_JOB_HANDLERS.has(jobId as PracticeJobId);
}

export function getPracticeRegisteredJobIds(): PracticeJobId[] {
  return Array.from(PRACTICE_JOB_HANDLERS.keys());
}
