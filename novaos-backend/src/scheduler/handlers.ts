// ═══════════════════════════════════════════════════════════════════════════════
// JOB HANDLERS — Implementation of Scheduled Tasks
// NovaOS Scheduler — Phase 15: Enhanced Scheduler & Jobs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Contains handlers for:
// - Core scheduler jobs (memory, sessions, cleanup, health)
// - Sword system jobs (imported from ./jobs/ directory)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { JobContext, JobResult, JobHandler, SparkReminder, GoalCheckin, JobId } from './types.js';
import { getStore, storeManager, type KeyValueStore } from '../storage/index.js';
import { getMemoryStore, MEMORY_DECAY_CONFIG } from '../core/memory/index.js';
import { getSwordStore } from '../core/sword/index.js';
import { getLogger } from '../observability/logging/index.js';

// Import Sword job handlers
import {
  generateDailyStepsHandler,
  morningSparksHandler,
  reminderEscalationHandler,
  dayEndReconciliationHandler,
  knownSourcesHealthHandler,
  retentionEnforcementHandler,
} from './jobs/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'job-handlers' });

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY DECAY HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Applies decay to memory reinforcement scores.
 */
export const memoryDecayHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting memory decay job', { executionId: context.executionId });
  
  const store = getStore();
  const memoryStore = getMemoryStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  let memoriesDecayed = 0;
  let memoriesDeleted = 0;
  
  try {
    const userKeys = await store.keys('memory:user:*:memories');
    const userIds = userKeys.map(key => {
      const match = key.match(/memory:user:([^:]+):memories/);
      return match?.[1];
    }).filter((id): id is string => !!id);
    
    for (const userId of userIds) {
      try {
        const memories = await memoryStore.queryMemories(userId, { includeExpired: true });
        const now = Date.now();
        
        for (const memory of memories) {
          itemsProcessed++;
          
          const lastAccess = new Date(memory.lastAccessedAt).getTime();
          const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);
          
          const baseDecay = MEMORY_DECAY_CONFIG.baseDecayRate;
          const categoryMultiplier = MEMORY_DECAY_CONFIG.categoryDecay[memory.category] ?? 1.0;
          const decay = baseDecay * categoryMultiplier * daysSinceAccess;
          const newScore = Math.max(0, memory.reinforcementScore - decay);
          
          if (newScore < MEMORY_DECAY_CONFIG.forgetThreshold) {
            await memoryStore.deleteMemory(memory.id, userId);
            memoriesDeleted++;
          } else if (newScore !== memory.reinforcementScore) {
            await memoryStore.updateMemory(memory.id, userId, {
              reinforcementScore: Math.round(newScore),
            } as Parameters<typeof memoryStore.updateMemory>[2]);
            memoriesDecayed++;
          }
        }
      } catch (error) {
        const msg = `Error processing user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { memoriesDecayed, memoriesDeleted },
    };
  } catch (error) {
    logger.error('Memory decay job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK REMINDERS HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export const sparkRemindersHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting spark reminders job', { executionId: context.executionId });
  
  const store = getStore();
  const swordStore = getSwordStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  const reminders: SparkReminder[] = [];
  
  try {
    const sparkKeys = await store.keys('sword:user:*:sparks');
    const userIds = sparkKeys.map(key => {
      const match = key.match(/sword:user:([^:]+):sparks/);
      return match?.[1];
    }).filter((id): id is string => !!id);
    
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const sixHours = 6 * 60 * 60 * 1000;
    
    for (const userId of userIds) {
      try {
        const activeSpark = await swordStore.getActiveSpark(userId);
        if (!activeSpark) continue;
        
        itemsProcessed++;
        
        const createdAt = new Date(activeSpark.createdAt).getTime();
        const expiresAt = activeSpark.expiresAt ? new Date(activeSpark.expiresAt).getTime() : null;
        const age = now - createdAt;
        
        let reminderType: SparkReminder['reminderType'] | null = null;
        
        if (expiresAt && (expiresAt - now) < oneHour) {
          reminderType = 'expiring';
        } else if (age > sixHours) {
          reminderType = 'deadline';
        } else if (age > oneHour) {
          reminderType = 'gentle';
        }
        
        if (reminderType) {
          const reminder: SparkReminder = {
            userId,
            sparkId: activeSpark.id,
            action: activeSpark.action,
            createdAt: activeSpark.createdAt,
            reminderType,
            delivered: false,
          };
          
          await store.set(
            `reminders:spark:${userId}:${activeSpark.id}`,
            JSON.stringify(reminder),
            3600
          );
          
          reminders.push(reminder);
        }
      } catch (error) {
        const msg = `Error processing sparks for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { 
        remindersGenerated: reminders.length,
        byType: {
          gentle: reminders.filter(r => r.reminderType === 'gentle').length,
          deadline: reminders.filter(r => r.reminderType === 'deadline').length,
          expiring: reminders.filter(r => r.reminderType === 'expiring').length,
        },
      },
    };
  } catch (error) {
    logger.error('Spark reminders job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// GOAL DEADLINE CHECK-INS HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export const goalDeadlineCheckinsHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting goal deadline check-ins job', { executionId: context.executionId });
  
  const store = getStore();
  const swordStore = getSwordStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  const checkins: GoalCheckin[] = [];
  
  try {
    const goalKeys = await store.keys('sword:user:*:goals');
    const userIds = goalKeys.map(key => {
      const match = key.match(/sword:user:([^:]+):goals/);
      return match?.[1];
    }).filter((id): id is string => !!id);
    
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    
    for (const userId of userIds) {
      try {
        const goals = await swordStore.getGoals(userId);
        
        for (const goal of goals) {
          if (goal.status !== 'active') continue;
          
          itemsProcessed++;
          
          // Access optional properties safely (may not be in base type)
          const goalWithOptionals = goal as typeof goal & {
            deadline?: string;
            lastActivityAt?: string;
          };
          
          const deadline = goalWithOptionals.deadline ? new Date(goalWithOptionals.deadline).getTime() : null;
          const daysUntilDeadline = deadline ? Math.ceil((deadline - now) / oneDay) : undefined;
          
          let checkInType: GoalCheckin['checkInType'] | null = null;
          
          if (daysUntilDeadline !== undefined && daysUntilDeadline <= 3) {
            checkInType = 'deadline_approaching';
          } else if (goal.progress >= 50 && goal.progress < 100) {
            checkInType = 'milestone';
          } else if (goalWithOptionals.lastActivityAt) {
            const lastActivity = new Date(goalWithOptionals.lastActivityAt).getTime();
            if (now - lastActivity > oneWeek) {
              checkInType = 'stalled';
            }
          }
          
          if (checkInType) {
            const checkin: GoalCheckin = {
              userId,
              goalId: goal.id,
              goalTitle: goal.title,
              progress: goal.progress ?? 0,
              daysUntilDeadline,
              blockers: [],
              checkInType,
            };
            
            await store.set(
              `checkins:goal:${userId}:${goal.id}`,
              JSON.stringify(checkin),
              86400
            );
            
            checkins.push(checkin);
          }
        }
      } catch (error) {
        const msg = `Error processing goals for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { 
        checkinsGenerated: checkins.length,
        byType: {
          progress: checkins.filter(c => c.checkInType === 'progress').length,
          deadline_approaching: checkins.filter(c => c.checkInType === 'deadline_approaching').length,
          stalled: checkins.filter(c => c.checkInType === 'stalled').length,
          milestone: checkins.filter(c => c.checkInType === 'milestone').length,
        },
      },
    };
  } catch (error) {
    logger.error('Goal deadline check-ins job failed', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION CLEANUP HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export const sessionCleanupHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  const store = getStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  let sessionsDeleted = 0;
  
  try {
    const sessionKeys = await store.keys('session:*');
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;
    
    for (const key of sessionKeys) {
      itemsProcessed++;
      try {
        const data = await store.get(key);
        if (!data) continue;
        
        const session = JSON.parse(data);
        const lastActivity = session.lastActivity ?? session.createdAt;
        
        if (now - lastActivity > maxAge) {
          await store.delete(key);
          sessionsDeleted++;
        }
      } catch (error) {
        errors.push(`Error processing session ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { sessionsDeleted },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION CLEANUP HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export const conversationCleanupHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  const store = getStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  let conversationsArchived = 0;
  let orphansDeleted = 0;
  
  try {
    const conversationKeys = await store.keys('conversation:*');
    const now = Date.now();
    const archiveAge = 30 * 24 * 60 * 60 * 1000;
    
    for (const key of conversationKeys) {
      if (key.includes(':messages') || key.includes(':index')) continue;
      
      itemsProcessed++;
      try {
        const data = await store.get(key);
        if (!data) {
          await store.delete(key);
          orphansDeleted++;
          continue;
        }
        
        const conversation = JSON.parse(data);
        const lastActivity = new Date(conversation.updatedAt ?? conversation.createdAt).getTime();
        
        if (now - lastActivity > archiveAge) {
          const archiveKey = key.replace('conversation:', 'archive:conversation:');
          await store.set(archiveKey, data, 365 * 24 * 60 * 60);
          await store.delete(key);
          conversationsArchived++;
        }
      } catch (error) {
        errors.push(`Error processing conversation ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { conversationsArchived, orphansDeleted },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// EXPIRED TOKENS CLEANUP HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export const expiredTokensCleanupHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  const store = getStore();
  let itemsProcessed = 0;
  let tokensDeleted = 0;
  
  try {
    const ackKeys = await store.keys('ack:*');
    for (const key of ackKeys) {
      itemsProcessed++;
      const exists = await store.exists(key);
      if (!exists) tokensDeleted++;
    }
    
    const nonceKeys = await store.keys('nonce:*');
    for (const key of nonceKeys) {
      itemsProcessed++;
      const exists = await store.exists(key);
      if (!exists) tokensDeleted++;
    }
    
    return {
      success: true,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      metadata: { tokensDeleted },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// METRICS AGGREGATION HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export const metricsAggregationHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  const store = getStore();
  const now = Date.now();
  
  try {
    const requestCount = await store.get('metrics:requests:count') ?? '0';
    const errorCount = await store.get('metrics:errors:count') ?? '0';
    
    const snapshot = {
      timestamp: new Date().toISOString(),
      window: '5m',
      requests: parseInt(requestCount, 10),
      errors: parseInt(errorCount, 10),
      errorRate: parseInt(requestCount, 10) > 0 
        ? (parseInt(errorCount, 10) / parseInt(requestCount, 10)) * 100 
        : 0,
    };
    
    const hourKey = `metrics:hourly:${Math.floor(now / (60 * 60 * 1000))}`;
    await store.lpush(hourKey, JSON.stringify(snapshot));
    await store.ltrim(hourKey, 0, 11);
    
    return {
      success: true,
      duration: Date.now() - context.startedAt,
      itemsProcessed: 1,
      metadata: { snapshot },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - context.startedAt,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

export const healthCheckHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  const store = getStore();
  const checks: Record<string, boolean> = {};
  
  try {
    const testKey = `health:${context.executionId}`;
    await store.set(testKey, 'test', 10);
    const value = await store.get(testKey);
    checks['storage'] = value === 'test';
    await store.delete(testKey);
    
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks['memory'] = heapUsedPercent < 90;
    
    const allPassed = Object.values(checks).every(v => v);
    
    return {
      success: allPassed,
      duration: Date.now() - context.startedAt,
      metadata: { 
        checks,
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        usingRedis: storeManager.isUsingRedis(),
      },
    };
  } catch (error) {
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

export const JOB_HANDLERS: Record<JobId, JobHandler> = {
  // Core handlers
  memory_decay: memoryDecayHandler,
  spark_reminders: sparkRemindersHandler,
  goal_deadline_checkins: goalDeadlineCheckinsHandler,
  session_cleanup: sessionCleanupHandler,
  conversation_cleanup: conversationCleanupHandler,
  expired_tokens_cleanup: expiredTokensCleanupHandler,
  metrics_aggregation: metricsAggregationHandler,
  health_check: healthCheckHandler,
  // Sword handlers (Phase 15)
  generate_daily_steps: generateDailyStepsHandler,
  morning_sparks: morningSparksHandler,
  reminder_escalation: reminderEscalationHandler,
  day_end_reconciliation: dayEndReconciliationHandler,
  known_sources_health: knownSourcesHealthHandler,
  retention_enforcement: retentionEnforcementHandler,
};

export function getJobHandler(jobId: JobId): JobHandler | undefined {
  return JOB_HANDLERS[jobId];
}

// Re-export Sword handlers
export {
  generateDailyStepsHandler,
  morningSparksHandler,
  reminderEscalationHandler,
  dayEndReconciliationHandler,
  knownSourcesHealthHandler,
  retentionEnforcementHandler,
};
