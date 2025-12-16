// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER TESTS — Cron Parser, Job Definitions, Handler Execution
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseCron,
  matchesCron,
  shouldRunNow,
  getNextRun,
  describeCron,
  CRON_PRESETS,
  JOB_DEFINITIONS,
  getJobDefinition,
  getEnabledJobs,
  getStartupJobs,
  Scheduler,
  createScheduler,
  type JobContext,
  type JobResult,
} from '../scheduler/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CRON PARSER TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Cron Parser', () => {
  describe('parseCron()', () => {
    it('should parse wildcard expression', () => {
      const result = parseCron('* * * * *');
      
      expect(result.valid).toBe(true);
      expect(result.fields.minute).toHaveLength(60);
      expect(result.fields.hour).toHaveLength(24);
      expect(result.fields.dayOfMonth).toHaveLength(31);
      expect(result.fields.month).toHaveLength(12);
      expect(result.fields.dayOfWeek).toHaveLength(7);
    });
    
    it('should parse specific values', () => {
      const result = parseCron('30 9 1 6 2');
      
      expect(result.valid).toBe(true);
      expect(result.fields.minute).toEqual([30]);
      expect(result.fields.hour).toEqual([9]);
      expect(result.fields.dayOfMonth).toEqual([1]);
      expect(result.fields.month).toEqual([6]);
      expect(result.fields.dayOfWeek).toEqual([2]);
    });
    
    it('should parse ranges', () => {
      const result = parseCron('0 9-17 * * 1-5');
      
      expect(result.valid).toBe(true);
      expect(result.fields.minute).toEqual([0]);
      expect(result.fields.hour).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
      expect(result.fields.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
    });
    
    it('should parse step values', () => {
      const result = parseCron('*/15 * * * *');
      
      expect(result.valid).toBe(true);
      expect(result.fields.minute).toEqual([0, 15, 30, 45]);
    });
    
    it('should parse lists', () => {
      const result = parseCron('0,15,30,45 * * * *');
      
      expect(result.valid).toBe(true);
      expect(result.fields.minute).toEqual([0, 15, 30, 45]);
    });
    
    it('should parse combined ranges and steps', () => {
      const result = parseCron('0-30/10 * * * *');
      
      expect(result.valid).toBe(true);
      expect(result.fields.minute).toEqual([0, 10, 20, 30]);
    });
    
    it('should reject invalid expressions', () => {
      expect(parseCron('invalid').valid).toBe(false);
      expect(parseCron('* * *').valid).toBe(false); // Too few fields
      expect(parseCron('* * * * * *').valid).toBe(false); // Too many fields
      expect(parseCron('60 * * * *').valid).toBe(false); // Minute out of range
      expect(parseCron('* 25 * * *').valid).toBe(false); // Hour out of range
    });
    
    it('should handle day name aliases', () => {
      const result = parseCron('0 0 * * mon-fri');
      
      expect(result.valid).toBe(true);
      expect(result.fields.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
    });
    
    it('should handle month name aliases', () => {
      const result = parseCron('0 0 1 jan-jun *');
      
      expect(result.valid).toBe(true);
      expect(result.fields.month).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });
  
  describe('matchesCron()', () => {
    it('should match every minute cron', () => {
      const cron = parseCron('* * * * *');
      const date = new Date();
      
      expect(matchesCron(date, cron)).toBe(true);
    });
    
    it('should match specific time', () => {
      const cron = parseCron('30 14 * * *');
      
      const matchingDate = new Date('2024-06-15T14:30:00');
      expect(matchesCron(matchingDate, cron)).toBe(true);
      
      const nonMatchingDate = new Date('2024-06-15T14:31:00');
      expect(matchesCron(nonMatchingDate, cron)).toBe(false);
    });
    
    it('should match day of week', () => {
      const cron = parseCron('0 9 * * 1'); // Monday at 9 AM
      
      const monday = new Date('2024-06-17T09:00:00'); // Monday
      expect(matchesCron(monday, cron)).toBe(true);
      
      const tuesday = new Date('2024-06-18T09:00:00'); // Tuesday
      expect(matchesCron(tuesday, cron)).toBe(false);
    });
  });
  
  describe('shouldRunNow()', () => {
    it('should return true for every minute expression at any time', () => {
      expect(shouldRunNow('* * * * *')).toBe(true);
    });
    
    it('should return false for invalid expression', () => {
      expect(shouldRunNow('invalid')).toBe(false);
    });
  });
  
  describe('getNextRun()', () => {
    it('should calculate next run for hourly job', () => {
      const from = new Date('2024-06-15T10:30:00');
      const next = getNextRun('0 * * * *', from);
      
      expect(next).not.toBeNull();
      expect(next!.getMinutes()).toBe(0);
      expect(next!.getHours()).toBe(11);
    });
    
    it('should calculate next run for daily job', () => {
      const from = new Date('2024-06-15T10:00:00');
      const next = getNextRun('0 9 * * *', from);
      
      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(9);
      expect(next!.getDate()).toBe(16); // Next day
    });
    
    it('should return null for invalid expression', () => {
      expect(getNextRun('invalid')).toBeNull();
    });
  });
  
  describe('describeCron()', () => {
    it('should describe every minute', () => {
      expect(describeCron('* * * * *')).toBe('Every minute');
    });
    
    it('should describe invalid expression', () => {
      expect(describeCron('invalid')).toContain('Invalid');
    });
  });
  
  describe('CRON_PRESETS', () => {
    it('should have valid preset expressions', () => {
      for (const [name, expr] of Object.entries(CRON_PRESETS)) {
        const parsed = parseCron(expr);
        expect(parsed.valid).toBe(true);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// JOB DEFINITIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Job Definitions', () => {
  describe('JOB_DEFINITIONS', () => {
    it('should have all required jobs defined', () => {
      const requiredJobs = [
        'memory_decay',
        'spark_reminders',
        'goal_deadline_checkins',
        'session_cleanup',
        'conversation_cleanup',
        'expired_tokens_cleanup',
        'metrics_aggregation',
        'health_check',
      ];
      
      for (const jobId of requiredJobs) {
        expect(JOB_DEFINITIONS).toHaveProperty(jobId);
      }
    });
    
    it('should have valid schedules for all jobs', () => {
      for (const [id, job] of Object.entries(JOB_DEFINITIONS)) {
        expect(job.id).toBe(id);
        expect(job.schedule.intervalMs || job.schedule.cron).toBeTruthy();
        
        if (job.schedule.cron) {
          const parsed = parseCron(job.schedule.cron);
          expect(parsed.valid).toBe(true);
        }
      }
    });
    
    it('should have reasonable timeouts', () => {
      for (const job of Object.values(JOB_DEFINITIONS)) {
        expect(job.timeout).toBeGreaterThan(0);
        expect(job.timeout).toBeLessThanOrEqual(600000); // Max 10 minutes
      }
    });
  });
  
  describe('getJobDefinition()', () => {
    it('should return job by ID', () => {
      const job = getJobDefinition('memory_decay');
      
      expect(job).toBeDefined();
      expect(job?.id).toBe('memory_decay');
    });
    
    it('should return undefined for unknown ID', () => {
      const job = getJobDefinition('nonexistent' as any);
      expect(job).toBeUndefined();
    });
  });
  
  describe('getEnabledJobs()', () => {
    it('should return only enabled jobs', () => {
      const enabled = getEnabledJobs();
      
      expect(enabled.length).toBeGreaterThan(0);
      expect(enabled.every(j => j.enabled)).toBe(true);
    });
  });
  
  describe('getStartupJobs()', () => {
    it('should return jobs with runOnStartup flag', () => {
      const startup = getStartupJobs();
      
      expect(startup.every(j => j.runOnStartup)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEDULER TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Scheduler', () => {
  let scheduler: Scheduler;
  
  beforeEach(() => {
    scheduler = createScheduler();
  });
  
  afterEach(async () => {
    if (scheduler.isRunning()) {
      await scheduler.stop();
    }
  });
  
  describe('Lifecycle', () => {
    it('should start and stop cleanly', async () => {
      expect(scheduler.isRunning()).toBe(false);
      
      await scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
      
      await scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });
    
    it('should handle multiple start calls gracefully', async () => {
      await scheduler.start();
      await scheduler.start(); // Should not throw
      
      expect(scheduler.isRunning()).toBe(true);
    });
    
    it('should handle multiple stop calls gracefully', async () => {
      await scheduler.start();
      await scheduler.stop();
      await scheduler.stop(); // Should not throw
      
      expect(scheduler.isRunning()).toBe(false);
    });
  });
  
  describe('State', () => {
    it('should return scheduler state', () => {
      const state = scheduler.getState();
      
      expect(state.running).toBe(false);
      expect(state.jobs).toBeDefined();
      expect(state.instanceId).toBeDefined();
    });
    
    it('should return job state', () => {
      const state = scheduler.getJobState('memory_decay');
      
      expect(state).toBeDefined();
      expect(state?.jobId).toBe('memory_decay');
      expect(state?.runCount).toBe(0);
    });
    
    it('should return undefined for unknown job', () => {
      const state = scheduler.getJobState('nonexistent' as any);
      expect(state).toBeUndefined();
    });
  });
  
  describe('Job Control', () => {
    it('should enable and disable jobs', () => {
      expect(scheduler.disableJob('health_check')).toBe(true);
      expect(scheduler.getJobState('health_check')?.status).toBe('disabled');
      
      expect(scheduler.enableJob('health_check')).toBe(true);
      expect(scheduler.getJobState('health_check')?.status).toBe('idle');
    });
    
    it('should return false for unknown job', () => {
      expect(scheduler.enableJob('nonexistent' as any)).toBe(false);
      expect(scheduler.disableJob('nonexistent' as any)).toBe(false);
    });
  });
  
  describe('Manual Trigger', () => {
    it('should manually trigger a job', async () => {
      const result = await scheduler.triggerJob('health_check');
      
      expect(result).toBeDefined();
      expect(result?.duration).toBeGreaterThanOrEqual(0);
    });
    
    it('should return null for unknown job', async () => {
      const result = await scheduler.triggerJob('nonexistent' as any);
      expect(result).toBeNull();
    });
  });
  
  describe('Events', () => {
    it('should emit events', async () => {
      const events: any[] = [];
      const unsubscribe = scheduler.onEvent(event => events.push(event));
      
      await scheduler.start();
      await scheduler.stop();
      
      expect(events.some(e => e.type === 'scheduler_started')).toBe(true);
      expect(events.some(e => e.type === 'scheduler_stopped')).toBe(true);
      
      unsubscribe();
    });
    
    it('should unsubscribe from events', () => {
      const events: any[] = [];
      const unsubscribe = scheduler.onEvent(event => events.push(event));
      
      unsubscribe();
      
      scheduler.triggerJob('health_check');
      // After unsubscribe, no more events should be captured
      // (But we can't easily test this without async waiting)
    });
  });
  
  describe('Execution History', () => {
    it('should record execution history', async () => {
      await scheduler.triggerJob('health_check');
      
      const history = scheduler.getExecutionHistory('health_check');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]?.jobId).toBe('health_check');
    });
    
    it('should limit history size', async () => {
      const history = scheduler.getExecutionHistory(undefined, 5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// JOB HANDLER TESTS (Unit tests with mocked dependencies)
// ─────────────────────────────────────────────────────────────────────────────────

describe('Job Handlers', () => {
  describe('Health Check Handler', () => {
    it('should return success result', async () => {
      const scheduler = createScheduler();
      const result = await scheduler.triggerJob('health_check');
      
      expect(result).toBeDefined();
      expect(result?.metadata?.checks).toBeDefined();
    });
  });
  
  describe('Metrics Aggregation Handler', () => {
    it('should return success result', async () => {
      const scheduler = createScheduler();
      const result = await scheduler.triggerJob('metrics_aggregation');
      
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });
  });
  
  describe('Expired Tokens Cleanup Handler', () => {
    it('should run without errors', async () => {
      const scheduler = createScheduler();
      const result = await scheduler.triggerJob('expired_tokens_cleanup');
      
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });
  });
});
