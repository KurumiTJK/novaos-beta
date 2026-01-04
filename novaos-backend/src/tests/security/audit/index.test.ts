// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT MODULE TESTS — Security Event Logging
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AuditStore,
  initAuditStore,
  getAuditStore,
  logAudit,
  logAuthEvent,
  logSecurityWarning,
  logSecurityError,
  type AuditCategory,
  type AuditSeverity,
  type AuditEvent,
} from '../../../security/audit/index.js';
import type { KeyValueStore } from '../../../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK STORE
// ─────────────────────────────────────────────────────────────────────────────────

function createMockStore(): KeyValueStore {
  const lists = new Map<string, string[]>();
  
  return {
    lpush: vi.fn(async (key: string, value: string) => {
      const list = lists.get(key) ?? [];
      list.unshift(value);
      lists.set(key, list);
      return list.length;
    }),
    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      const end = stop === -1 ? list.length : stop + 1;
      return list.slice(start, end);
    }),
    ltrim: vi.fn(async () => {}),
  } as unknown as KeyValueStore;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

let mockStore: KeyValueStore;

beforeEach(() => {
  mockStore = createMockStore();
  initAuditStore(mockStore);
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Types', () => {
  describe('AuditCategory', () => {
    it('should accept valid categories', () => {
      const categories: AuditCategory[] = [
        'auth',
        'authorization',
        'rate_limit',
        'abuse',
        'ssrf',
        'validation',
        'system',
        'chat',
        'admin',
      ];
      
      expect(categories).toHaveLength(9);
    });
  });

  describe('AuditSeverity', () => {
    it('should accept valid severities', () => {
      const severities: AuditSeverity[] = ['info', 'warning', 'error', 'critical'];
      
      expect(severities).toHaveLength(4);
    });
  });

  describe('AuditEvent', () => {
    it('should accept valid event', () => {
      const event: AuditEvent = {
        id: '123',
        timestamp: Date.now(),
        category: 'auth',
        severity: 'info',
        action: 'login',
        userId: 'user-123',
        ip: '127.0.0.1',
        userAgent: 'Test Agent',
        requestId: 'req-123',
        details: { foo: 'bar' },
      };
      
      expect(event.category).toBe('auth');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// AuditStore CLASS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AuditStore', () => {
  let auditStore: AuditStore;

  beforeEach(() => {
    auditStore = new AuditStore(mockStore);
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const store = new AuditStore(mockStore);
      expect(store).toBeDefined();
    });

    it('should accept custom options', () => {
      const store = new AuditStore(mockStore, {
        userPrefix: 'custom:user:',
        globalKey: 'custom:global',
        maxUserLogs: 500,
        maxGlobalLogs: 5000,
      });
      expect(store).toBeDefined();
    });
  });

  describe('log()', () => {
    it('should log an audit event and return ID', async () => {
      const id = await auditStore.log({
        category: 'auth',
        action: 'login',
        userId: 'user-123',
      });
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should use default severity of info', async () => {
      await auditStore.log({
        category: 'auth',
        action: 'login',
      });
      
      expect(mockStore.lpush).toHaveBeenCalled();
      const call = (mockStore.lpush as any).mock.calls[0];
      const event = JSON.parse(call[1]);
      expect(event.severity).toBe('info');
    });

    it('should include all provided fields', async () => {
      await auditStore.log({
        category: 'abuse',
        severity: 'warning',
        action: 'block',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'req-456',
        details: { reason: 'spam' },
      });
      
      const call = (mockStore.lpush as any).mock.calls[0];
      const event = JSON.parse(call[1]);
      
      expect(event.category).toBe('abuse');
      expect(event.severity).toBe('warning');
      expect(event.action).toBe('block');
      expect(event.userId).toBe('user-123');
      expect(event.ip).toBe('192.168.1.1');
      expect(event.userAgent).toBe('Mozilla/5.0');
      expect(event.requestId).toBe('req-456');
      expect(event.details.reason).toBe('spam');
    });

    it('should store in user-specific list when userId provided', async () => {
      await auditStore.log({
        category: 'auth',
        action: 'login',
        userId: 'user-123',
      });
      
      // Should have two lpush calls - one for user, one for global
      expect(mockStore.lpush).toHaveBeenCalledTimes(2);
      
      const calls = (mockStore.lpush as any).mock.calls;
      const userCall = calls.find((c: any) => c[0].includes('user'));
      expect(userCall[0]).toContain('user-123');
    });

    it('should store in global list', async () => {
      await auditStore.log({
        category: 'system',
        action: 'startup',
      });
      
      const calls = (mockStore.lpush as any).mock.calls;
      const globalCall = calls.find((c: any) => c[0].includes('global'));
      expect(globalCall).toBeDefined();
    });

    it('should trim lists to max size', async () => {
      await auditStore.log({
        category: 'auth',
        action: 'login',
        userId: 'user-123',
      });
      
      expect(mockStore.ltrim).toHaveBeenCalled();
    });

    it('should include timestamp', async () => {
      const before = Date.now();
      await auditStore.log({
        category: 'auth',
        action: 'login',
      });
      const after = Date.now();
      
      const call = (mockStore.lpush as any).mock.calls[0];
      const event = JSON.parse(call[1]);
      
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('getUserLogs()', () => {
    it('should get logs for a user', async () => {
      await auditStore.log({
        category: 'auth',
        action: 'login',
        userId: 'user-123',
      });
      
      const logs = await auditStore.getUserLogs('user-123');
      
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should return empty array for user with no logs', async () => {
      const logs = await auditStore.getUserLogs('unknown-user');
      
      expect(logs).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await auditStore.log({
          category: 'auth',
          action: `action-${i}`,
          userId: 'user-123',
        });
      }
      
      const logs = await auditStore.getUserLogs('user-123', 3);
      
      expect(mockStore.lrange).toHaveBeenCalledWith(
        expect.stringContaining('user-123'),
        0,
        2
      );
    });
  });

  describe('getGlobalLogs()', () => {
    it('should get global logs', async () => {
      await auditStore.log({
        category: 'system',
        action: 'test',
      });
      
      const logs = await auditStore.getGlobalLogs();
      
      expect(Array.isArray(logs)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const logs = await auditStore.getGlobalLogs(50);
      
      expect(mockStore.lrange).toHaveBeenCalledWith(
        expect.stringContaining('global'),
        0,
        49
      );
    });
  });

  describe('getLogsByCategory()', () => {
    it('should filter logs by category', async () => {
      await auditStore.log({ category: 'auth', action: 'login' });
      await auditStore.log({ category: 'abuse', action: 'block' });
      await auditStore.log({ category: 'auth', action: 'logout' });
      
      const logs = await auditStore.getLogsByCategory('auth');
      
      expect(Array.isArray(logs)).toBe(true);
      for (const log of logs) {
        expect(log.category).toBe('auth');
      }
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await auditStore.log({ category: 'auth', action: `login-${i}` });
      }
      
      const logs = await auditStore.getLogsByCategory('auth', 5);
      
      expect(logs.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getLogsBySeverity()', () => {
    it('should filter logs by severity', async () => {
      await auditStore.log({ category: 'auth', severity: 'info', action: 'login' });
      await auditStore.log({ category: 'abuse', severity: 'warning', action: 'warn' });
      await auditStore.log({ category: 'abuse', severity: 'error', action: 'block' });
      
      const logs = await auditStore.getLogsBySeverity('warning');
      
      expect(Array.isArray(logs)).toBe(true);
      for (const log of logs) {
        expect(log.severity).toBe('warning');
      }
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await auditStore.log({ category: 'system', severity: 'error', action: `error-${i}` });
      }
      
      const logs = await auditStore.getLogsBySeverity('error', 5);
      
      expect(logs.length).toBeLessThanOrEqual(5);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Singleton Functions', () => {
  describe('initAuditStore()', () => {
    it('should initialize and return store', () => {
      const store = initAuditStore(mockStore);
      expect(store).toBeInstanceOf(AuditStore);
    });
  });

  describe('getAuditStore()', () => {
    it('should return initialized store', () => {
      initAuditStore(mockStore);
      const store = getAuditStore();
      expect(store).toBeInstanceOf(AuditStore);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Convenience Functions', () => {
  describe('logAudit()', () => {
    it('should log an audit event', async () => {
      const id = await logAudit({
        category: 'auth',
        action: 'login',
        userId: 'user-123',
      });
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should accept all options', async () => {
      const id = await logAudit({
        category: 'abuse',
        severity: 'critical',
        action: 'ban',
        userId: 'user-123',
        ip: '10.0.0.1',
        userAgent: 'TestAgent',
        requestId: 'req-789',
        details: { permanent: true },
      });
      
      expect(id).toBeDefined();
    });
  });

  describe('logAuthEvent()', () => {
    it('should log auth category event', async () => {
      const id = await logAuthEvent('login', 'user-123', { method: 'password' });
      
      expect(id).toBeDefined();
      
      const call = (mockStore.lpush as any).mock.calls.find((c: any) => 
        c[0].includes('global')
      );
      const event = JSON.parse(call[1]);
      expect(event.category).toBe('auth');
      expect(event.action).toBe('login');
    });

    it('should work without userId', async () => {
      const id = await logAuthEvent('logout');
      expect(id).toBeDefined();
    });

    it('should work without details', async () => {
      const id = await logAuthEvent('login', 'user-123');
      expect(id).toBeDefined();
    });
  });

  describe('logSecurityWarning()', () => {
    it('should log abuse category warning', async () => {
      const id = await logSecurityWarning('suspicious_activity', 'user-123', { ip: '10.0.0.1' });
      
      expect(id).toBeDefined();
      
      const call = (mockStore.lpush as any).mock.calls.find((c: any) => 
        c[0].includes('global')
      );
      const event = JSON.parse(call[1]);
      expect(event.category).toBe('abuse');
      expect(event.severity).toBe('warning');
    });
  });

  describe('logSecurityError()', () => {
    it('should log abuse category error', async () => {
      const id = await logSecurityError('attack_detected', 'user-123', { type: 'injection' });
      
      expect(id).toBeDefined();
      
      const call = (mockStore.lpush as any).mock.calls.find((c: any) => 
        c[0].includes('global')
      );
      const event = JSON.parse(call[1]);
      expect(event.category).toBe('abuse');
      expect(event.severity).toBe('error');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Integration', () => {
  it('should allow complete audit workflow', async () => {
    await logAuthEvent('login', 'user-123');
    await logSecurityWarning('rate_limit', 'user-123');
    await logSecurityError('abuse_detected', 'user-123');
    
    const store = getAuditStore();
    const userLogs = await store.getUserLogs('user-123');
    
    expect(userLogs.length).toBeGreaterThan(0);
  });

  it('should maintain chronological order', async () => {
    const store = getAuditStore();
    
    await store.log({ category: 'auth', action: 'first' });
    await new Promise(r => setTimeout(r, 10));
    await store.log({ category: 'auth', action: 'second' });
    
    const logs = await store.getGlobalLogs();
    
    if (logs.length >= 2) {
      expect(logs[0].action).toBe('second');
      expect(logs[1].action).toBe('first');
    }
  });
});
