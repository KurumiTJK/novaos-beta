// ═══════════════════════════════════════════════════════════════════════════════
// JOB DEFINITIONS — All Scheduled Jobs Configuration
// NovaOS Scheduler — Phase 15: Enhanced Scheduler & Jobs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Contains definitions for:
// - Core scheduler jobs (memory, sessions, cleanup, health)
// - Sword system jobs (daily steps, sparks, reminders, reconciliation)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { JobDefinition, JobId } from './types.js';
import { CRON_PRESETS } from './cron.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CORE JOB DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────

export const CORE_JOB_DEFINITIONS: Record<string, JobDefinition> = {
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
// SWORD JOB DEFINITIONS (Phase 15)
// ─────────────────────────────────────────────────────────────────────────────────

export const SWORD_JOB_DEFINITIONS: Record<string, JobDefinition> = {
  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATE DAILY STEPS
  // Creates next day's learning steps at midnight
  // ─────────────────────────────────────────────────────────────────────────────
  generate_daily_steps: {
    id: 'generate_daily_steps',
    name: 'Generate Daily Steps',
    description: 'Generates learning steps for the next day for all users with active goals',
    schedule: { cron: CRON_PRESETS.DAILY_MIDNIGHT },
    handler: 'generate_daily_steps',
    priority: 'high',
    timeout: 300000,       // 5 minutes
    retryAttempts: 3,
    retryDelayMs: 30000,
    maxRetryDelayMs: 120000,
    exponentialBackoff: true,
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
    alertOnFailure: true,
    deadLetterOnFailure: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MORNING SPARKS
  // Creates initial sparks at 9 AM
  // ─────────────────────────────────────────────────────────────────────────────
  morning_sparks: {
    id: 'morning_sparks',
    name: 'Morning Sparks',
    description: 'Creates initial spark actions for users with today\'s steps',
    schedule: { cron: CRON_PRESETS.DAILY_9AM },
    handler: 'morning_sparks',
    priority: 'high',
    timeout: 180000,       // 3 minutes
    retryAttempts: 2,
    retryDelayMs: 15000,
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
    alertOnFailure: true,
    deadLetterOnFailure: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // REMINDER ESCALATION
  // Processes reminders every 3 hours
  // ─────────────────────────────────────────────────────────────────────────────
  reminder_escalation: {
    id: 'reminder_escalation',
    name: 'Reminder Escalation',
    description: 'Escalates unacknowledged sparks through the reminder ladder',
    schedule: { cron: '0 */3 * * *' }, // Every 3 hours
    handler: 'reminder_escalation',
    priority: 'high',
    timeout: 120000,       // 2 minutes
    retryAttempts: 2,
    retryDelayMs: 10000,
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
    alertOnFailure: true,
    deadLetterOnFailure: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DAY END RECONCILIATION
  // Marks incomplete steps at 11 PM
  // ─────────────────────────────────────────────────────────────────────────────
  day_end_reconciliation: {
    id: 'day_end_reconciliation',
    name: 'Day End Reconciliation',
    description: 'Marks incomplete steps as missed, updates streaks, generates daily summary',
    schedule: { cron: '0 23 * * *' }, // 11 PM
    handler: 'day_end_reconciliation',
    priority: 'high',
    timeout: 180000,       // 3 minutes
    retryAttempts: 2,
    retryDelayMs: 20000,
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
    alertOnFailure: true,
    deadLetterOnFailure: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // KNOWN SOURCES HEALTH
  // Weekly health check for data sources
  // ─────────────────────────────────────────────────────────────────────────────
  known_sources_health: {
    id: 'known_sources_health',
    name: 'Known Sources Health Check',
    description: 'Verifies health of registered data sources and updates status',
    schedule: { cron: '0 2 * * 0' }, // Sunday 2 AM
    handler: 'known_sources_health',
    priority: 'normal',
    timeout: 600000,       // 10 minutes
    retryAttempts: 2,
    retryDelayMs: 60000,
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
    alertOnFailure: true,
    deadLetterOnFailure: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // RETENTION ENFORCEMENT
  // Daily cleanup of expired data
  // ─────────────────────────────────────────────────────────────────────────────
  retention_enforcement: {
    id: 'retention_enforcement',
    name: 'Retention Enforcement',
    description: 'Enforces data retention policies, deletes expired data, archives old records',
    schedule: { cron: CRON_PRESETS.DAILY_3AM },
    handler: 'retention_enforcement',
    priority: 'normal',
    timeout: 900000,       // 15 minutes
    retryAttempts: 2,
    retryDelayMs: 60000,
    enabled: true,
    requiresRedis: false,
    runOnStartup: false,
    exclusive: true,
    alertOnFailure: true,
    deadLetterOnFailure: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED JOB DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────

export const JOB_DEFINITIONS: Record<JobId, JobDefinition> = {
  ...CORE_JOB_DEFINITIONS,
  ...SWORD_JOB_DEFINITIONS,
} as Record<JobId, JobDefinition>;

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

/**
 * Get all Sword system jobs.
 */
export function getSwordJobs(): JobDefinition[] {
  return Object.values(SWORD_JOB_DEFINITIONS);
}

/**
 * Get all core scheduler jobs.
 */
export function getCoreJobs(): JobDefinition[] {
  return Object.values(CORE_JOB_DEFINITIONS);
}

/**
 * Get all job definitions as array.
 */
export function getAllJobDefinitions(): JobDefinition[] {
  return Object.values(JOB_DEFINITIONS);
}
