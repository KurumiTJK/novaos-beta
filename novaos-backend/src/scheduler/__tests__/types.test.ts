// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER TYPES TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  calculateRetryDelay,
  shouldRetry,
  isSwordJobId,
  isJobId,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_LOCK_CONFIG,
  DEFAULT_DEAD_LETTER_CONFIG,
} from '../types.js';

describe('Retry Utilities', () => {
  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      const config = {
        ...DEFAULT_RETRY_CONFIG,
        jitterFactor: 0, // Disable jitter for predictable testing
      };

      expect(calculateRetryDelay(1, config)).toBe(1000);
      expect(calculateRetryDelay(2, config)).toBe(2000);
      expect(calculateRetryDelay(3, config)).toBe(4000);
    });

    it('should cap at maxDelayMs', () => {
      const config = {
        ...DEFAULT_RETRY_CONFIG,
        maxDelayMs: 5000,
        jitterFactor: 0,
      };

      expect(calculateRetryDelay(10, config)).toBe(5000);
    });

    it('should add jitter when configured', () => {
      const config = {
        ...DEFAULT_RETRY_CONFIG,
        jitterFactor: 0.5,
      };

      const delays = Array.from({ length: 10 }, () => calculateRetryDelay(1, config));
      const uniqueDelays = new Set(delays);

      // With jitter, we should get varying delays
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('shouldRetry', () => {
    it('should return true when attempts remaining', () => {
      expect(shouldRetry(1, DEFAULT_RETRY_CONFIG)).toBe(true);
      expect(shouldRetry(2, DEFAULT_RETRY_CONFIG)).toBe(true);
    });

    it('should return false when max attempts reached', () => {
      expect(shouldRetry(3, DEFAULT_RETRY_CONFIG)).toBe(false);
      expect(shouldRetry(4, DEFAULT_RETRY_CONFIG)).toBe(false);
    });
  });
});

describe('Type Guards', () => {
  describe('isSwordJobId', () => {
    it('should return true for Sword job IDs', () => {
      expect(isSwordJobId('generate_daily_steps')).toBe(true);
      expect(isSwordJobId('morning_sparks')).toBe(true);
      expect(isSwordJobId('reminder_escalation')).toBe(true);
      expect(isSwordJobId('day_end_reconciliation')).toBe(true);
      expect(isSwordJobId('known_sources_health')).toBe(true);
      expect(isSwordJobId('retention_enforcement')).toBe(true);
    });

    it('should return false for core job IDs', () => {
      expect(isSwordJobId('memory_decay')).toBe(false);
      expect(isSwordJobId('health_check')).toBe(false);
      expect(isSwordJobId('session_cleanup')).toBe(false);
    });

    it('should return false for invalid IDs', () => {
      expect(isSwordJobId('invalid_job')).toBe(false);
      expect(isSwordJobId('')).toBe(false);
    });
  });

  describe('isJobId', () => {
    it('should return true for all valid job IDs', () => {
      // Core jobs
      expect(isJobId('memory_decay')).toBe(true);
      expect(isJobId('health_check')).toBe(true);
      expect(isJobId('session_cleanup')).toBe(true);

      // Sword jobs
      expect(isJobId('generate_daily_steps')).toBe(true);
      expect(isJobId('morning_sparks')).toBe(true);
    });

    it('should return false for invalid IDs', () => {
      expect(isJobId('invalid_job')).toBe(false);
      expect(isJobId('')).toBe(false);
      expect(isJobId('random')).toBe(false);
    });
  });
});

describe('Default Configs', () => {
  it('should have valid DEFAULT_RETRY_CONFIG', () => {
    expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBeGreaterThan(0);
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBeGreaterThan(0);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBeGreaterThanOrEqual(DEFAULT_RETRY_CONFIG.initialDelayMs);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBeGreaterThan(1);
    expect(DEFAULT_RETRY_CONFIG.jitterFactor).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_RETRY_CONFIG.jitterFactor).toBeLessThanOrEqual(1);
  });

  it('should have valid DEFAULT_LOCK_CONFIG', () => {
    expect(DEFAULT_LOCK_CONFIG.ttlMs).toBeGreaterThan(0);
    expect(DEFAULT_LOCK_CONFIG.retries).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_LOCK_CONFIG.retryDelayMs).toBeGreaterThan(0);
  });

  it('should have valid DEFAULT_DEAD_LETTER_CONFIG', () => {
    expect(DEFAULT_DEAD_LETTER_CONFIG.retentionMs).toBeGreaterThan(0);
    expect(DEFAULT_DEAD_LETTER_CONFIG.maxEntries).toBeGreaterThan(0);
  });
});
