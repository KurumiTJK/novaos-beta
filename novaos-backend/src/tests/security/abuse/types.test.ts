// ═══════════════════════════════════════════════════════════════════════════════
// ABUSE TYPES TESTS — Type Definitions and Configuration
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ABUSE_CONFIG,
  type AbuseType,
  type AbuseSeverity,
  type AbuseAction,
  type AbusePattern,
  type AbuseCheckResult,
  type BlockStatus,
  type VetoStatus,
  type AbuseConfig,
  type AbuseEventType,
  type AbuseEvent,
} from '../../../security/abuse/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT_ABUSE_CONFIG TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_ABUSE_CONFIG', () => {
  it('should have veto warning threshold', () => {
    expect(DEFAULT_ABUSE_CONFIG.vetoWarningThreshold).toBe(3);
  });

  it('should have veto block threshold', () => {
    expect(DEFAULT_ABUSE_CONFIG.vetoBlockThreshold).toBe(5);
  });

  it('should have veto window in seconds', () => {
    expect(DEFAULT_ABUSE_CONFIG.vetoWindowSeconds).toBe(300); // 5 minutes
  });

  it('should have default block duration', () => {
    expect(DEFAULT_ABUSE_CONFIG.defaultBlockDurationSeconds).toBe(3600); // 1 hour
  });

  it('should enable prompt injection detection by default', () => {
    expect(DEFAULT_ABUSE_CONFIG.detectPromptInjection).toBe(true);
  });

  it('should enable harassment detection by default', () => {
    expect(DEFAULT_ABUSE_CONFIG.detectHarassment).toBe(true);
  });

  it('should have all required properties', () => {
    expect(DEFAULT_ABUSE_CONFIG).toHaveProperty('vetoWarningThreshold');
    expect(DEFAULT_ABUSE_CONFIG).toHaveProperty('vetoBlockThreshold');
    expect(DEFAULT_ABUSE_CONFIG).toHaveProperty('vetoWindowSeconds');
    expect(DEFAULT_ABUSE_CONFIG).toHaveProperty('defaultBlockDurationSeconds');
    expect(DEFAULT_ABUSE_CONFIG).toHaveProperty('detectPromptInjection');
    expect(DEFAULT_ABUSE_CONFIG).toHaveProperty('detectHarassment');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('AbuseType', () => {
    it('should accept valid abuse types', () => {
      const types: AbuseType[] = [
        'prompt_injection',
        'jailbreak',
        'harassment',
        'spam',
        'repeated_veto',
        'rate_abuse',
      ];
      
      expect(types).toHaveLength(6);
      types.forEach(type => {
        expect(typeof type).toBe('string');
      });
    });
  });

  describe('AbuseSeverity', () => {
    it('should accept valid severity levels', () => {
      const severities: AbuseSeverity[] = ['low', 'medium', 'high', 'critical'];
      
      expect(severities).toHaveLength(4);
    });
  });

  describe('AbuseAction', () => {
    it('should accept valid actions', () => {
      const actions: AbuseAction[] = ['warn', 'throttle', 'block', 'ban'];
      
      expect(actions).toHaveLength(4);
    });
  });

  describe('AbusePattern', () => {
    it('should accept valid pattern object', () => {
      const pattern: AbusePattern = {
        type: 'prompt_injection',
        severity: 'high',
        action: 'block',
        pattern: /test/i,
        description: 'Test pattern',
      };
      
      expect(pattern.type).toBe('prompt_injection');
      expect(pattern.severity).toBe('high');
      expect(pattern.action).toBe('block');
      expect(pattern.pattern).toBeInstanceOf(RegExp);
      expect(pattern.description).toBe('Test pattern');
    });

    it('should allow optional fields', () => {
      const pattern: AbusePattern = {
        type: 'spam',
        severity: 'low',
        action: 'warn',
      };
      
      expect(pattern.pattern).toBeUndefined();
      expect(pattern.description).toBeUndefined();
    });
  });

  describe('AbuseCheckResult', () => {
    it('should accept valid result object', () => {
      const result: AbuseCheckResult = {
        detected: true,
        patterns: [],
        severity: 'high',
        action: 'block',
        shouldBlock: true,
        shouldWarn: true,
        message: 'Test message',
      };
      
      expect(result.detected).toBe(true);
      expect(result.shouldBlock).toBe(true);
    });

    it('should allow null severity and action when not detected', () => {
      const result: AbuseCheckResult = {
        detected: false,
        patterns: [],
        severity: null,
        action: null,
        shouldBlock: false,
        shouldWarn: false,
      };
      
      expect(result.detected).toBe(false);
      expect(result.severity).toBeNull();
      expect(result.action).toBeNull();
    });
  });

  describe('BlockStatus', () => {
    it('should accept blocked status', () => {
      const status: BlockStatus = {
        blocked: true,
        reason: 'Abuse detected',
        until: Date.now() + 3600000,
        remainingMs: 3600000,
      };
      
      expect(status.blocked).toBe(true);
      expect(status.reason).toBeDefined();
    });

    it('should accept not blocked status', () => {
      const status: BlockStatus = {
        blocked: false,
      };
      
      expect(status.blocked).toBe(false);
      expect(status.reason).toBeUndefined();
    });
  });

  describe('VetoStatus', () => {
    it('should accept valid veto status', () => {
      const status: VetoStatus = {
        count: 3,
        windowSeconds: 300,
        isAbusive: true,
      };
      
      expect(status.count).toBe(3);
      expect(status.isAbusive).toBe(true);
    });
  });

  describe('AbuseEvent', () => {
    it('should accept valid event', () => {
      const event: AbuseEvent = {
        type: 'abuse_detected',
        userId: 'user-123',
        timestamp: Date.now(),
        abuseType: 'prompt_injection',
        severity: 'high',
        action: 'block',
        reason: 'Policy violation',
        details: { pattern: 'test' },
      };
      
      expect(event.type).toBe('abuse_detected');
      expect(event.userId).toBe('user-123');
    });

    it('should allow minimal event', () => {
      const event: AbuseEvent = {
        type: 'user_blocked',
        userId: 'user-123',
        timestamp: Date.now(),
      };
      
      expect(event.abuseType).toBeUndefined();
      expect(event.details).toBeUndefined();
    });
  });

  describe('AbuseEventType', () => {
    it('should accept valid event types', () => {
      const types: AbuseEventType[] = [
        'abuse_detected',
        'abuse_warning',
        'user_blocked',
        'user_unblocked',
      ];
      
      expect(types).toHaveLength(4);
    });
  });
});
