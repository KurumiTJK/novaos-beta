// ═══════════════════════════════════════════════════════════════════════════════
// JOB DEFINITIONS — All Scheduled Jobs Configuration
// ═══════════════════════════════════════════════════════════════════════════════

import type { JobDefinition, JobId } from './types.js';
import { CRON_PRESETS } from './cron.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT JOB DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────

export const JOB_DEFINITIONS: Record<JobId, JobDefinition> = {
  // ─────────────────────────────────────────────────────────────────────────────
  // MEMORY DECAY
  // Applies decay to memory reinforcement scores
  // ─────────────────────────────────────────────────────────────────────────────
  memory_decay: {
    id: 'memory_decay',
    name: 'Memory Decay',
    description: 'Applies decay to memory reinforcement scores, removing stale memories',
    schedule: { cron: CRON_PRESETS.DAILY_3AM },
    priority: 'normal',
    timeout: 300000,       // 5 minutes
    retryAttempts: 3,
    retryDelayMs: 60000,   // 1 minute
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SPARK REMINDERS
  // Sends notifications for pending sparks
  // ─────────────────────────────────────────────────────────────────────────────
  spark_reminders: {
    id: 'spark_reminders',
    name: 'Spark Reminders',
    description: 'Generates reminder notifications for pending and expiring sparks',
    schedule: { cron: CRON_PRESETS.EVERY_HOUR },
    priority: 'normal',
    timeout: 120000,       // 2 minutes
    retryAttempts: 2,
    retryDelayMs: 30000,   // 30 seconds
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GOAL DEADLINE CHECK-INS
  // Monitors goals and generates check-in prompts
  // ─────────────────────────────────────────────────────────────────────────────
  goal_deadline_checkins: {
    id: 'goal_deadline_checkins',
    name: 'Goal Deadline Check-ins',
    description: 'Monitors goal deadlines and generates check-in prompts for users',
    schedule: { cron: CRON_PRESETS.DAILY_9AM },
    priority: 'normal',
    timeout: 180000,       // 3 minutes
    retryAttempts: 2,
    retryDelayMs: 60000,   // 1 minute
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SESSION CLEANUP
  // Removes expired session data
  // ─────────────────────────────────────────────────────────────────────────────
  session_cleanup: {
    id: 'session_cleanup',
    name: 'Session Cleanup',
    description: 'Removes expired session data and cleans up inactive sessions',
    schedule: { cron: CRON_PRESETS.EVERY_6_HOURS },
    priority: 'low',
    timeout: 120000,       // 2 minutes
    retryAttempts: 2,
    retryDelayMs: 30000,   // 30 seconds
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERSATION CLEANUP
  // Archives or removes old conversations
  // ─────────────────────────────────────────────────────────────────────────────
  conversation_cleanup: {
    id: 'conversation_cleanup',
    name: 'Conversation Cleanup',
    description: 'Archives old conversations and removes orphaned data',
    schedule: { cron: CRON_PRESETS.WEEKLY_SUNDAY },
    priority: 'low',
    timeout: 600000,       // 10 minutes
    retryAttempts: 3,
    retryDelayMs: 120000,  // 2 minutes
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPIRED TOKENS CLEANUP
  // Removes expired auth tokens and ack tokens
  // ─────────────────────────────────────────────────────────────────────────────
  expired_tokens_cleanup: {
    id: 'expired_tokens_cleanup',
    name: 'Expired Tokens Cleanup',
    description: 'Removes expired authentication and acknowledgment tokens',
    schedule: { cron: CRON_PRESETS.EVERY_HOUR },
    priority: 'normal',
    timeout: 60000,        // 1 minute
    retryAttempts: 2,
    retryDelayMs: 15000,   // 15 seconds
    enabled: true,
    requiresRedis: false,
    runOnStartup: true,
    exclusive: false,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // METRICS AGGREGATION
  // Aggregates and summarizes metrics data
  // ─────────────────────────────────────────────────────────────────────────────
  metrics_aggregation: {
    id: 'metrics_aggregation',
    name: 'Metrics Aggregation',
    description: 'Aggregates detailed metrics into summary data for dashboards',
    schedule: { cron: CRON_PRESETS.EVERY_5_MINUTES },
    priority: 'low',
    timeout: 30000,        // 30 seconds
    retryAttempts: 1,
    retryDelayMs: 10000,   // 10 seconds
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: false,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HEALTH CHECK
  // Internal health monitoring
  // ─────────────────────────────────────────────────────────────────────────────
  health_check: {
    id: 'health_check',
    name: 'Health Check',
    description: 'Internal health monitoring and alerting',
    schedule: { intervalMs: 60000 }, // Every minute
    priority: 'critical',
    timeout: 10000,        // 10 seconds
    retryAttempts: 0,      // No retries for health check
    retryDelayMs: 0,
    enabled: true,
    requiresRedis: false,
    runOnStartup: true,
    exclusive: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get job definition by ID.
 */
export function getJobDefinition(jobId: JobId): JobDefinition | undefined {
  return JOB_DEFINITIONS[jobId];
}

/**
 * Get all enabled job definitions.
 */
export function getEnabledJobs(): JobDefinition[] {
  return Object.values(JOB_DEFINITIONS).filter(job => job.enabled);
}

/**
 * Get jobs that should run on startup.
 */
export function getStartupJobs(): JobDefinition[] {
  return Object.values(JOB_DEFINITIONS).filter(job => job.enabled && job.runOnStartup);
}

/**
 * Get jobs by priority.
 */
export function getJobsByPriority(priority: JobDefinition['priority']): JobDefinition[] {
  return Object.values(JOB_DEFINITIONS).filter(job => job.enabled && job.priority === priority);
}
