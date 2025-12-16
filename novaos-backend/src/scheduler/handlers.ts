// ═══════════════════════════════════════════════════════════════════════════════
// JOB HANDLERS — Implementation of Scheduled Tasks
// ═══════════════════════════════════════════════════════════════════════════════

import type { JobContext, JobResult, JobHandler, SparkReminder, GoalCheckin, JobId } from './types.js';
import { getStore, storeManager, type KeyValueStore } from '../storage/index.js';
import { getMemoryStore, MEMORY_DECAY_CONFIG } from '../core/memory/index.js';
import { getSwordStore } from '../core/sword/index.js';
import { getLogger } from '../logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'job-handlers' });

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY DECAY HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Applies decay to memory reinforcement scores.
 * 
 * Decay formula: score = score * (1 - decayRate * daysSinceAccess)
 * Memories below threshold are marked for deletion.
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
    // Get all user IDs with memories
    const userKeys = await store.keys('memory:user:*:memories');
    const userIds = userKeys.map(key => {
      const match = key.match(/memory:user:([^:]+):memories/);
      return match?.[1];
    }).filter((id): id is string => !!id);
    
    logger.info(`Processing ${userIds.length} users for memory decay`);
    
    for (const userId of userIds) {
      try {
        const memories = await memoryStore.queryMemories(userId, { includeExpired: true });
        const now = Date.now();
        
        for (const memory of memories) {
          itemsProcessed++;
          
          const lastAccess = new Date(memory.lastAccessedAt).getTime();
          const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);
          
          // Apply decay using category-specific multiplier
          const baseDecay = MEMORY_DECAY_CONFIG.baseDecayRate;
          const categoryMultiplier = MEMORY_DECAY_CONFIG.categoryDecay[memory.category] ?? 1.0;
          const decay = baseDecay * categoryMultiplier * daysSinceAccess;
          const newScore = Math.max(0, memory.reinforcementScore - decay);
          
          if (newScore < MEMORY_DECAY_CONFIG.forgetThreshold) {
            // Delete memory
            await memoryStore.deleteMemory(memory.id, userId);
            memoriesDeleted++;
          } else if (newScore !== memory.reinforcementScore) {
            // Update score - use type assertion for extended properties
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
    
    logger.info('Memory decay completed', {
      executionId: context.executionId,
      itemsProcessed,
      memoriesDecayed,
      memoriesDeleted,
    });
    
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

/**
 * Generates reminder notifications for pending and expiring sparks.
 */
export const sparkRemindersHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting spark reminders job', { executionId: context.executionId });
  
  const store = getStore();
  const swordStore = getSwordStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  const reminders: SparkReminder[] = [];
  
  try {
    // Get all user IDs with active sparks
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
        
        // Determine reminder type
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
          
          // Store reminder for notification system
          await store.set(
            `reminders:spark:${userId}:${activeSpark.id}`,
            JSON.stringify(reminder),
            3600 // 1 hour TTL
          );
          
          reminders.push(reminder);
        }
      } catch (error) {
        const msg = `Error processing sparks for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }
    
    logger.info('Spark reminders completed', {
      executionId: context.executionId,
      itemsProcessed,
      remindersGenerated: reminders.length,
    });
    
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

/**
 * Monitors goal deadlines and generates check-in prompts.
 */
export const goalDeadlineCheckinsHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting goal deadline check-ins job', { executionId: context.executionId });
  
  const store = getStore();
  const swordStore = getSwordStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  const checkins: GoalCheckin[] = [];
  
  try {
    // Get all user IDs with goals
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
        const goals = await swordStore.getUserGoals(userId, 'active');
        
        for (const goal of goals) {
          itemsProcessed++;
          
          const path = await swordStore.getPath(goal.id, userId);
          if (!path) continue;
          
          let checkInType: GoalCheckin['checkInType'] | null = null;
          
          // Check deadline
          if (goal.targetDate) {
            const deadline = new Date(goal.targetDate).getTime();
            const daysRemaining = Math.ceil((deadline - now) / oneDay);
            
            if (daysRemaining <= 1) {
              checkInType = 'deadline_approaching';
            } else if (daysRemaining <= 7 && goal.progress < 80) {
              checkInType = 'deadline_approaching';
            }
          }
          
          // Check for stalled progress
          if (!checkInType) {
            const lastUpdated = new Date(goal.updatedAt).getTime();
            const daysSinceUpdate = (now - lastUpdated) / oneDay;
            
            if (daysSinceUpdate > 7 && goal.progress < 100) {
              checkInType = 'stalled';
            }
          }
          
          // Check for milestone (progress % 25)
          if (!checkInType && goal.progress > 0 && goal.progress % 25 === 0) {
            checkInType = 'milestone';
          }
          
          // Regular progress check
          if (!checkInType && goal.progress > 0) {
            checkInType = 'progress';
          }
          
          if (checkInType) {
            const checkin: GoalCheckin = {
              userId,
              goalId: goal.id,
              goalTitle: goal.title,
              progress: goal.progress,
              daysUntilDeadline: goal.targetDate 
                ? Math.ceil((new Date(goal.targetDate).getTime() - now) / oneDay)
                : undefined,
              blockers: path.blockers.map(b => b.description),
              checkInType,
            };
            
            // Store check-in for notification system
            await store.set(
              `checkins:goal:${userId}:${goal.id}`,
              JSON.stringify(checkin),
              86400 // 24 hour TTL
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
    
    logger.info('Goal deadline check-ins completed', {
      executionId: context.executionId,
      itemsProcessed,
      checkinsGenerated: checkins.length,
    });
    
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

/**
 * Removes expired session data.
 */
export const sessionCleanupHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting session cleanup job', { executionId: context.executionId });
  
  const store = getStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  let sessionsDeleted = 0;
  
  try {
    const sessionKeys = await store.keys('session:*');
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const key of sessionKeys) {
      itemsProcessed++;
      
      try {
        const data = await store.get(key);
        if (!data) continue;
        
        const session = JSON.parse(data);
        const lastActivity = new Date(session.lastActivity || session.createdAt).getTime();
        
        if (now - lastActivity > maxAge) {
          await store.delete(key);
          sessionsDeleted++;
        }
      } catch (error) {
        const msg = `Error processing session ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(msg);
      }
    }
    
    logger.info('Session cleanup completed', {
      executionId: context.executionId,
      itemsProcessed,
      sessionsDeleted,
    });
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { sessionsDeleted },
    };
  } catch (error) {
    logger.error('Session cleanup job failed', error instanceof Error ? error : new Error(String(error)));
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

/**
 * Archives old conversations and removes orphaned data.
 */
export const conversationCleanupHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting conversation cleanup job', { executionId: context.executionId });
  
  const store = getStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  let conversationsArchived = 0;
  let orphansDeleted = 0;
  
  try {
    const conversationKeys = await store.keys('conversation:*');
    const now = Date.now();
    const archiveAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    for (const key of conversationKeys) {
      // Skip message keys
      if (key.includes(':messages')) continue;
      
      itemsProcessed++;
      
      try {
        const data = await store.get(key);
        if (!data) {
          // Orphaned key
          await store.delete(key);
          orphansDeleted++;
          continue;
        }
        
        const conversation = JSON.parse(data);
        const lastActivity = new Date(conversation.updatedAt || conversation.createdAt).getTime();
        
        if (now - lastActivity > archiveAge) {
          // Archive conversation (move to archive namespace)
          const conversationId = key.replace('conversation:', '');
          await store.set(`archive:conversation:${conversationId}`, data, 365 * 24 * 60 * 60); // 1 year TTL
          await store.delete(key);
          
          // Archive messages too
          const messageKey = `${key}:messages`;
          const messages = await store.get(messageKey);
          if (messages) {
            await store.set(`archive:${messageKey}`, messages, 365 * 24 * 60 * 60);
            await store.delete(messageKey);
          }
          
          conversationsArchived++;
        }
      } catch (error) {
        const msg = `Error processing conversation ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(msg);
      }
    }
    
    logger.info('Conversation cleanup completed', {
      executionId: context.executionId,
      itemsProcessed,
      conversationsArchived,
      orphansDeleted,
    });
    
    return {
      success: errors.length === 0,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      errors: errors.length > 0 ? errors : undefined,
      metadata: { conversationsArchived, orphansDeleted },
    };
  } catch (error) {
    logger.error('Conversation cleanup job failed', error instanceof Error ? error : new Error(String(error)));
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

/**
 * Removes expired auth and ack tokens.
 */
export const expiredTokensCleanupHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting expired tokens cleanup job', { executionId: context.executionId });
  
  const store = getStore();
  const errors: string[] = [];
  let itemsProcessed = 0;
  let tokensDeleted = 0;
  
  try {
    // Clean up ack tokens
    const ackKeys = await store.keys('ack:*');
    for (const key of ackKeys) {
      itemsProcessed++;
      try {
        const exists = await store.exists(key);
        // If Redis TTL has expired, key won't exist
        if (!exists) {
          tokensDeleted++;
        }
      } catch {
        // Key already expired
        tokensDeleted++;
      }
    }
    
    // Clean up nonce tokens
    const nonceKeys = await store.keys('nonce:*');
    for (const key of nonceKeys) {
      itemsProcessed++;
      try {
        const exists = await store.exists(key);
        if (!exists) {
          tokensDeleted++;
        }
      } catch {
        tokensDeleted++;
      }
    }
    
    logger.info('Expired tokens cleanup completed', {
      executionId: context.executionId,
      itemsProcessed,
      tokensDeleted,
    });
    
    return {
      success: true,
      duration: Date.now() - context.startedAt,
      itemsProcessed,
      metadata: { tokensDeleted },
    };
  } catch (error) {
    logger.error('Expired tokens cleanup job failed', error instanceof Error ? error : new Error(String(error)));
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

/**
 * Aggregates detailed metrics into summary data.
 */
export const metricsAggregationHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  logger.info('Starting metrics aggregation job', { executionId: context.executionId });
  
  const store = getStore();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  try {
    // Aggregate request metrics
    const requestCount = await store.get('metrics:requests:count') ?? '0';
    const errorCount = await store.get('metrics:errors:count') ?? '0';
    
    // Store aggregated snapshot
    const snapshot = {
      timestamp: new Date().toISOString(),
      window: '5m',
      requests: parseInt(requestCount, 10),
      errors: parseInt(errorCount, 10),
      errorRate: parseInt(requestCount, 10) > 0 
        ? (parseInt(errorCount, 10) / parseInt(requestCount, 10)) * 100 
        : 0,
    };
    
    // Store in time-series format
    const hourKey = `metrics:hourly:${Math.floor(now / (60 * 60 * 1000))}`;
    await store.lpush(hourKey, JSON.stringify(snapshot));
    await store.ltrim(hourKey, 0, 11); // Keep 12 snapshots per hour
    
    // Reset counters (optional, depends on strategy)
    // await store.set('metrics:requests:count', '0');
    // await store.set('metrics:errors:count', '0');
    
    logger.info('Metrics aggregation completed', { executionId: context.executionId });
    
    return {
      success: true,
      duration: Date.now() - context.startedAt,
      itemsProcessed: 1,
      metadata: { snapshot },
    };
  } catch (error) {
    logger.error('Metrics aggregation job failed', error instanceof Error ? error : new Error(String(error)));
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

/**
 * Internal health monitoring.
 */
export const healthCheckHandler: JobHandler = async (context: JobContext): Promise<JobResult> => {
  const store = getStore();
  const checks: Record<string, boolean> = {};
  
  try {
    // Storage check
    const testKey = `health:${context.executionId}`;
    await store.set(testKey, 'test', 10);
    const value = await store.get(testKey);
    checks['storage'] = value === 'test';
    await store.delete(testKey);
    
    // Memory check
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks['memory'] = heapUsedPercent < 90;
    
    // All checks passed?
    const allPassed = Object.values(checks).every(v => v);
    
    if (!allPassed) {
      logger.warn('Health check detected issues', { checks });
    }
    
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
    logger.error('Health check failed', error instanceof Error ? error : new Error(String(error)));
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
  memory_decay: memoryDecayHandler,
  spark_reminders: sparkRemindersHandler,
  goal_deadline_checkins: goalDeadlineCheckinsHandler,
  session_cleanup: sessionCleanupHandler,
  conversation_cleanup: conversationCleanupHandler,
  expired_tokens_cleanup: expiredTokensCleanupHandler,
  metrics_aggregation: metricsAggregationHandler,
  health_check: healthCheckHandler,
};

/**
 * Get handler for a job ID.
 */
export function getJobHandler(jobId: JobId): JobHandler | undefined {
  return JOB_HANDLERS[jobId];
}
