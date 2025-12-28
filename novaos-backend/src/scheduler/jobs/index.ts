// ═══════════════════════════════════════════════════════════════════════════════
// SWORD JOB HANDLERS — Phase 15 Job Handler Implementations
// NovaOS Scheduler — Phase 15: Enhanced Scheduler & Jobs
// Phase 18: Deliberate Practice Jobs
// ═══════════════════════════════════════════════════════════════════════════════

import type { JobContext, JobResult, JobHandler, SwordJobId } from '../types.js';
import { getStore } from '../../storage/index.js';
import { getLogger } from '../../observability/logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'sword-jobs' });

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATE DAILY STEPS HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generates learning steps for tomorrow for all users with active goals.
 * Runs at midnight.
 */
export const generateDailyStepsHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting generate daily steps job', { executionId: context.executionId });
  
  const store = getStore();
  const errors: string[] = [];
  let usersProcessed = 0;
  let stepsGenerated = 0;
  let usersSkipped = 0;
  
  try {
    // Get all users with active goals
    const goalKeys = await store.keys('sword:goal:*');
    const userIds = new Set<string>();
    
    for (const key of goalKeys) {
      const match = key.match(/sword:goal:([^:]+):/);
      if (match?.[1]) userIds.add(match[1]);
    }
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    for (const userId of userIds) {
      try {
        // Find active goals for this user
        const userGoalKeys = await store.keys(`sword:goal:${userId}:*`);
        let hasActiveGoal = false;
        
        for (const goalKey of userGoalKeys) {
          const goalData = await store.get(goalKey);
          if (!goalData) continue;
          
          const goal = JSON.parse(goalData);
          if (goal.status !== 'active') continue;
          
          hasActiveGoal = true;
          
          // Find active quest for this goal
          const questKeys = await store.keys(`sword:quest:${userId}:${goal.id}:*`);
          for (const questKey of questKeys) {
            const questData = await store.get(questKey);
            if (!questData) continue;
            
            const quest = JSON.parse(questData);
            if (quest.status !== 'active') continue;
            
            // Generate step for tomorrow
            const stepId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const step = {
              id: stepId,
              questId: quest.id,
              goalId: goal.id,
              userId,
              title: `Day ${quest.currentDay || 1} - ${quest.title}`,
              description: 'Auto-generated daily step',
              scheduledDate: tomorrowDate,
              status: 'pending',
              createdAt: new Date().toISOString(),
            };
            
            await store.set(`sword:step:${stepId}`, JSON.stringify(step));
            await store.set(`sword:step:date:${tomorrowDate}:${quest.id}`, stepId);
            stepsGenerated++;
          }
        }
        
        if (hasActiveGoal) {
          usersProcessed++;
        } else {
          usersSkipped++;
        }
      } catch (error) {
        const msg = `Error processing user ${userId}: ${error instanceof Error ? error.message : 'Unknown'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    logger.info('Generate daily steps completed', {
      executionId: context.executionId,
      usersProcessed,
      stepsGenerated,
      usersSkipped,
    });
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed: usersProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { usersProcessed, stepsGenerated, usersSkipped },
    };
  } catch (error) {
    logger.error('Generate daily steps job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// MORNING SPARKS HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Creates initial spark actions for today's steps.
 * Runs at 9 AM.
 */
export const morningSparksHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting morning sparks job', { executionId: context.executionId });
  
  const store = getStore();
  const errors: string[] = [];
  let usersProcessed = 0;
  let sparksCreated = 0;
  let usersWithNoSteps = 0;
  let usersWithExistingSparks = 0;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find all steps scheduled for today
    const stepDateKeys = await store.keys(`sword:step:date:${today}:*`);
    const processedUsers = new Set<string>();
    
    for (const dateKey of stepDateKeys) {
      const stepId = await store.get(dateKey);
      if (!stepId) continue;
      
      const stepData = await store.get(`sword:step:${stepId}`);
      if (!stepData) continue;
      
      const step = JSON.parse(stepData);
      if (processedUsers.has(step.userId)) continue;
      processedUsers.add(step.userId);
      
      try {
        // Check if user already has active spark
        const activeSparkKeys = await store.keys(`sword:spark:active:${step.userId}:*`);
        if (activeSparkKeys.length > 0) {
          usersWithExistingSparks++;
          continue;
        }
        
        // Check if step is already completed
        if (step.status === 'completed') {
          continue;
        }
        
        // Create spark
        const sparkId = `spark_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const spark = {
          id: sparkId,
          stepId: step.id,
          userId: step.userId,
          action: `Start: ${step.title}`,
          status: 'active',
          escalationLevel: 0,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        
        await store.set(`sword:spark:${sparkId}`, JSON.stringify(spark), 86400);
        await store.set(`sword:spark:active:${step.userId}:${sparkId}`, sparkId, 86400);
        
        sparksCreated++;
        usersProcessed++;
      } catch (error) {
        const msg = `Error creating spark for user ${step.userId}: ${error instanceof Error ? error.message : 'Unknown'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    usersWithNoSteps = processedUsers.size === 0 ? 0 : 
      (processedUsers.size - usersProcessed - usersWithExistingSparks);
    
    logger.info('Morning sparks completed', {
      executionId: context.executionId,
      usersProcessed,
      sparksCreated,
    });
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed: usersProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { usersProcessed, sparksCreated, usersWithNoSteps, usersWithExistingSparks },
    };
  } catch (error) {
    logger.error('Morning sparks job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// REMINDER ESCALATION HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Escalates unacknowledged sparks through reminder levels.
 * Runs every 3 hours.
 */
export const reminderEscalationHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting reminder escalation job', { executionId: context.executionId });
  
  const store = getStore();
  const errors: string[] = [];
  let sparksProcessed = 0;
  let remindersEscalated = 0;
  let sparksExpired = 0;
  let remindersQueued = 0;
  
  const MAX_ESCALATION = 3;
  
  try {
    // Find all active sparks
    const sparkKeys = await store.keys('sword:spark:spark_*');
    
    for (const key of sparkKeys) {
      const sparkData = await store.get(key);
      if (!sparkData) continue;
      
      const spark = JSON.parse(sparkData);
      if (spark.status !== 'active') continue;
      
      sparksProcessed++;
      
      try {
        const createdAt = new Date(spark.createdAt).getTime();
        const expiresAt = spark.expiresAt ? new Date(spark.expiresAt).getTime() : null;
        const now = Date.now();
        
        // Check if expired
        if (expiresAt && now > expiresAt) {
          spark.status = 'expired';
          await store.set(key, JSON.stringify(spark));
          sparksExpired++;
          continue;
        }
        
        // Calculate escalation level based on age
        const ageHours = (now - createdAt) / (1000 * 60 * 60);
        const targetLevel = Math.min(Math.floor(ageHours / 3), MAX_ESCALATION);
        
        if (targetLevel > (spark.escalationLevel || 0)) {
          spark.escalationLevel = targetLevel;
          spark.lastEscalatedAt = new Date().toISOString();
          await store.set(key, JSON.stringify(spark));
          remindersEscalated++;
          
          // Queue reminder notification
          const reminder = {
            sparkId: spark.id,
            userId: spark.userId,
            level: targetLevel,
            action: spark.action,
            queuedAt: new Date().toISOString(),
          };
          await store.lpush(`notifications:queue:${spark.userId}`, JSON.stringify(reminder));
          remindersQueued++;
        }
      } catch (error) {
        const msg = `Error processing spark ${spark.id}: ${error instanceof Error ? error.message : 'Unknown'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    logger.info('Reminder escalation completed', {
      executionId: context.executionId,
      sparksProcessed,
      remindersEscalated,
      sparksExpired,
    });
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed: sparksProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { sparksProcessed, remindersEscalated, sparksExpired, remindersQueued },
    };
  } catch (error) {
    logger.error('Reminder escalation job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// DAY END RECONCILIATION HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Marks incomplete steps as missed at end of day.
 * Runs at 11 PM.
 */
export const dayEndReconciliationHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting day end reconciliation job', { executionId: context.executionId });
  
  const store = getStore();
  const errors: string[] = [];
  let usersProcessed = 0;
  let stepsMarkedMissed = 0;
  let stepsCompleted = 0;
  let streaksBroken = 0;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find all steps for today
    const stepDateKeys = await store.keys(`sword:step:date:${today}:*`);
    const processedUsers = new Set<string>();
    
    for (const dateKey of stepDateKeys) {
      const stepId = await store.get(dateKey);
      if (!stepId) continue;
      
      const stepData = await store.get(`sword:step:${stepId}`);
      if (!stepData) continue;
      
      const step = JSON.parse(stepData);
      
      if (!processedUsers.has(step.userId)) {
        processedUsers.add(step.userId);
        usersProcessed++;
      }
      
      try {
        if (step.status === 'completed') {
          stepsCompleted++;
          continue;
        }
        
        // Mark as missed
        step.status = 'missed';
        step.missedAt = new Date().toISOString();
        await store.set(`sword:step:${stepId}`, JSON.stringify(step));
        stepsMarkedMissed++;
        
        // Check and update streak
        const streakKey = `sword:streak:${step.userId}:${step.goalId}`;
        const streakData = await store.get(streakKey);
        if (streakData) {
          const streak = JSON.parse(streakData);
          if (streak.current > 0) {
            streak.current = 0;
            streak.brokenAt = new Date().toISOString();
            await store.set(streakKey, JSON.stringify(streak));
            streaksBroken++;
          }
        }
        
        // Expire associated spark
        const sparkKeys = await store.keys(`sword:spark:active:${step.userId}:*`);
        for (const sparkKey of sparkKeys) {
          const sparkId = await store.get(sparkKey);
          if (!sparkId) continue;
          
          const sparkData = await store.get(`sword:spark:${sparkId}`);
          if (!sparkData) continue;
          
          const spark = JSON.parse(sparkData);
          if (spark.stepId === stepId) {
            spark.status = 'expired';
            spark.expiredAt = new Date().toISOString();
            await store.set(`sword:spark:${sparkId}`, JSON.stringify(spark));
            await store.delete(sparkKey);
          }
        }
      } catch (error) {
        const msg = `Error reconciling step ${stepId}: ${error instanceof Error ? error.message : 'Unknown'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    logger.info('Day end reconciliation completed', {
      executionId: context.executionId,
      usersProcessed,
      stepsMarkedMissed,
      stepsCompleted,
      streaksBroken,
    });
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed: usersProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { usersProcessed, stepsMarkedMissed, stepsCompleted, streaksBroken },
    };
  } catch (error) {
    logger.error('Day end reconciliation job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// KNOWN SOURCES HEALTH HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Verifies health of registered data sources.
 * Runs weekly on Sundays.
 */
export const knownSourcesHealthHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting known sources health check job', { executionId: context.executionId });
  
  const store = getStore();
  const errors: string[] = [];
  let sourcesChecked = 0;
  let sourcesHealthy = 0;
  let sourcesDegraded = 0;
  let sourcesFailed = 0;
  let newlyDisabled = 0;
  
  const MAX_CONSECUTIVE_FAILURES = 3;
  
  try {
    // Get all registered sources
    const sourceKeys = await store.keys('lens:source:*');
    
    for (const key of sourceKeys) {
      const sourceData = await store.get(key);
      if (!sourceData) continue;
      
      const source = JSON.parse(sourceData);
      sourcesChecked++;
      
      try {
        // Skip disabled sources unless it's time to re-check
        if (source.status === 'disabled') {
          const disabledAt = source.disabledAt ? new Date(source.disabledAt).getTime() : 0;
          const daysSinceDisabled = (Date.now() - disabledAt) / (1000 * 60 * 60 * 24);
          if (daysSinceDisabled < 7) {
            continue;
          }
        }
        
        // Static sources are always healthy
        if (source.type === 'static') {
          source.status = 'active';
          source.consecutiveFailures = 0;
          source.lastCheckedAt = new Date().toISOString();
          await store.set(key, JSON.stringify(source));
          sourcesHealthy++;
          continue;
        }
        
        // For API sources, check health status
        if ((source.consecutiveFailures || 0) === 0) {
          source.status = 'active';
          sourcesHealthy++;
        } else if (source.consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
          source.status = 'degraded';
          sourcesDegraded++;
        } else {
          source.status = 'failed';
          sourcesFailed++;
          
          // Auto-disable after max failures
          if (source.status !== 'disabled') {
            source.status = 'disabled';
            source.disabledAt = new Date().toISOString();
            newlyDisabled++;
          }
        }
        
        source.lastCheckedAt = new Date().toISOString();
        await store.set(key, JSON.stringify(source));
      } catch (error) {
        const msg = `Error checking source ${source.id}: ${error instanceof Error ? error.message : 'Unknown'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    logger.info('Known sources health check completed', {
      executionId: context.executionId,
      sourcesChecked,
      sourcesHealthy,
      sourcesDegraded,
      sourcesFailed,
    });
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed: sourcesChecked,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { sourcesChecked, sourcesHealthy, sourcesDegraded, sourcesFailed, newlyDisabled },
    };
  } catch (error) {
    logger.error('Known sources health check job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// RETENTION ENFORCEMENT HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Enforces data retention policies.
 * Runs daily at 3 AM.
 */
export const retentionEnforcementHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting retention enforcement job', { executionId: context.executionId });
  
  const store = getStore();
  const errors: string[] = [];
  let keysScanned = 0;
  let keysDeleted = 0;
  let keysArchived = 0;
  let bytesReclaimed = 0;
  let policiesApplied = 0;
  
  // Retention policies (days)
  const POLICIES: Record<string, { pattern: string; retentionDays: number; archive?: boolean }> = {
    sessions: { pattern: 'session:*', retentionDays: 7 },
    notifications: { pattern: 'notifications:*', retentionDays: 30 },
    sparks: { pattern: 'sword:spark:spark_*', retentionDays: 14 },
    steps: { pattern: 'sword:step:step_*', retentionDays: 90 },
    summaries: { pattern: 'sword:summary:*', retentionDays: 365, archive: true },
    cache: { pattern: 'cache:*', retentionDays: 1 },
    temp: { pattern: 'temp:*', retentionDays: 1 },
    // Deliberate Practice retention (Phase 18)
    drills: { pattern: 'practice:drill:*', retentionDays: 90 },
    practiceCarryforward: { pattern: 'practice:carryforward:*', retentionDays: 14 },
  };
  
  try {
    for (const [policyName, policy] of Object.entries(POLICIES)) {
      logger.debug(`Applying retention policy: ${policyName}`, { pattern: policy.pattern });
      
      try {
        const keys = await store.keys(policy.pattern);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
        const cutoff = cutoffDate.getTime();
        
        for (const key of keys) {
          keysScanned++;
          
          try {
            const data = await store.get(key);
            if (!data) continue;
            
            const parsed = JSON.parse(data);
            const dateField = parsed.createdAt || parsed.cachedAt || parsed.timestamp || parsed.generatedAt;
            
            if (!dateField) continue;
            
            const itemDate = new Date(dateField).getTime();
            
            if (itemDate < cutoff) {
              if (policy.archive) {
                // Archive instead of delete
                const archiveKey = key.replace(/^([^:]+):/, '$1:archive:');
                await store.set(archiveKey, data, 365 * 24 * 60 * 60); // 1 year archive
                keysArchived++;
              }
              
              await store.delete(key);
              keysDeleted++;
              bytesReclaimed += data.length;
            }
          } catch {
            // Skip malformed entries
          }
        }
        
        policiesApplied++;
      } catch (error) {
        const msg = `Error applying policy ${policyName}: ${error instanceof Error ? error.message : 'Unknown'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    logger.info('Retention enforcement completed', {
      executionId: context.executionId,
      keysScanned,
      keysDeleted,
      keysArchived,
      bytesReclaimed,
      policiesApplied,
    });
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed: keysScanned,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { keysScanned, keysDeleted, keysArchived, bytesReclaimed, policiesApplied },
    };
  } catch (error) {
    logger.error('Retention enforcement job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// HANDLER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

export const SWORD_JOB_HANDLERS: Map<SwordJobId, JobHandler> = new Map([
  ['generate_daily_steps', generateDailyStepsHandler],
  ['morning_sparks', morningSparksHandler],
  ['reminder_escalation', reminderEscalationHandler],
  ['day_end_reconciliation', dayEndReconciliationHandler],
  ['known_sources_health', knownSourcesHealthHandler],
  ['retention_enforcement', retentionEnforcementHandler],
  // Deliberate Practice handlers (Phase 18) - imported from practice-handlers.ts
  // Note: These are registered in the main handlers.ts file
]);

export const swordJobHandlers = {
  generateDailyStepsHandler,
  morningSparksHandler,
  reminderEscalationHandler,
  dayEndReconciliationHandler,
  knownSourcesHealthHandler,
  retentionEnforcementHandler,
};

export function getSwordJobHandler(jobId: SwordJobId): JobHandler | undefined {
  return SWORD_JOB_HANDLERS.get(jobId);
}

export function getSwordRegisteredJobIds(): SwordJobId[] {
  return Array.from(SWORD_JOB_HANDLERS.keys());
}

export function hasSwordJobHandler(jobId: string): boolean {
  return SWORD_JOB_HANDLERS.has(jobId as SwordJobId);
}

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS (Phase 18)
// ─────────────────────────────────────────────────────────────────────────────────

// Re-export practice handlers for convenience
export {
  generateDailyDrillsHandler,
  weekTransitionHandler,
  drillReconciliationHandler,
  PRACTICE_JOB_HANDLERS,
  getPracticeJobHandler,
} from './practice-handlers.js';
