// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MODULE INDEX TESTS — Unified Security Infrastructure
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as securityModule from '../../security/index.js';
import type { KeyValueStore } from '../../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK STORE
// ─────────────────────────────────────────────────────────────────────────────────

function createMockStore(): KeyValueStore {
  const data = new Map<string, string>();
  const lists = new Map<string, string[]>();
  
  return {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    delete: vi.fn(async (key: string) => data.delete(key)),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(data.get(key) ?? '0', 10);
      const newValue = current + 1;
      data.set(key, String(newValue));
      return newValue;
    }),
    expire: vi.fn(async () => true),
    exists: vi.fn(async (key: string) => data.has(key)),
    lpush: vi.fn(async (key: string, value: string) => {
      const list = lists.get(key) ?? [];
      list.unshift(value);
      lists.set(key, list);
      return list.length;
    }),
    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    }),
    ltrim: vi.fn(async () => {}),
  } as unknown as KeyValueStore;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Auth Re-exports', () => {
  it('should export auth constants', () => {
    expect(securityModule.DEFAULT_PERMISSIONS).toBeDefined();
    expect(securityModule.ROLE_PERMISSIONS).toBeDefined();
  });

  it('should export auth helper functions', () => {
    expect(typeof securityModule.getDefaultPermissions).toBe('function');
    expect(typeof securityModule.getRoleForTier).toBe('function');
  });

  it('should export token functions', () => {
    expect(typeof securityModule.initTokenConfig).toBe('function');
    expect(typeof securityModule.setRevocationStore).toBe('function');
    expect(typeof securityModule.getTokenConfig).toBe('function');
    expect(typeof securityModule.generateAccessToken).toBe('function');
    expect(typeof securityModule.generateRefreshToken).toBe('function');
    expect(typeof securityModule.generateApiKey).toBe('function');
    expect(typeof securityModule.verifyToken).toBe('function');
    expect(typeof securityModule.verifyTokenSync).toBe('function');
    expect(typeof securityModule.revokeToken).toBe('function');
    expect(typeof securityModule.revokeAllUserTokens).toBe('function');
  });

  it('should export auth middleware', () => {
    expect(typeof securityModule.authenticate).toBe('function');
    expect(typeof securityModule.requireAuth).toBe('function');
    expect(typeof securityModule.optionalAuth).toBe('function');
    expect(typeof securityModule.requirePermission).toBe('function');
    expect(typeof securityModule.requireAnyPermission).toBe('function');
    expect(typeof securityModule.requireAdmin).toBe('function');
    expect(typeof securityModule.requireTier).toBe('function');
  });

  it('should export AuthErrorCode', () => {
    expect(securityModule.AuthErrorCode).toBeDefined();
    expect(securityModule.AuthErrorCode.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
  });

  it('should export ack token functions', () => {
    expect(typeof securityModule.generateAckToken).toBe('function');
    expect(typeof securityModule.verifyAckToken).toBe('function');
    expect(securityModule.AckTokenStore).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMITING RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Rate Limiting Re-exports', () => {
  it('should export rate limit constants', () => {
    expect(securityModule.DEFAULT_TIER_LIMITS).toBeDefined();
    expect(securityModule.ANONYMOUS_LIMIT).toBeDefined();
    expect(securityModule.ENDPOINT_LIMITS).toBeDefined();
  });

  it('should export rate limiter classes', () => {
    expect(securityModule.RateLimiter).toBeDefined();
    expect(securityModule.IpRateLimiter).toBeDefined();
  });

  it('should export rate limiter functions', () => {
    expect(typeof securityModule.initRateLimiter).toBe('function');
    expect(typeof securityModule.getRateLimiter).toBe('function');
    expect(typeof securityModule.initIpRateLimiter).toBe('function');
    expect(typeof securityModule.getIpRateLimiter).toBe('function');
  });

  it('should export rate limit middleware', () => {
    expect(typeof securityModule.rateLimit).toBe('function');
    expect(typeof securityModule.chatRateLimit).toBe('function');
    expect(typeof securityModule.authRateLimit).toBe('function');
    expect(typeof securityModule.adminRateLimit).toBe('function');
    expect(typeof securityModule.expensiveRateLimit).toBe('function');
    expect(typeof securityModule.ipRateLimit).toBe('function');
  });

  it('should export RateLimitErrorCode', () => {
    expect(securityModule.RateLimitErrorCode).toBeDefined();
    expect(securityModule.RateLimitErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Validation Re-exports', () => {
  it('should export validation middleware', () => {
    expect(typeof securityModule.validateBody).toBe('function');
    expect(typeof securityModule.validateQuery).toBe('function');
    expect(typeof securityModule.validateParams).toBe('function');
    expect(typeof securityModule.validateHeaders).toBe('function');
    expect(typeof securityModule.validate).toBe('function');
  });

  it('should export ValidationErrorCode', () => {
    expect(securityModule.ValidationErrorCode).toBeDefined();
    expect(securityModule.ValidationErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
  });

  it('should export common schemas', () => {
    expect(typeof securityModule.nonEmptyString).toBe('function');
    expect(typeof securityModule.boundedString).toBe('function');
    expect(securityModule.email).toBeDefined();
    expect(securityModule.url).toBeDefined();
    expect(securityModule.positiveInt).toBeDefined();
    expect(securityModule.nonNegativeInt).toBeDefined();
    expect(securityModule.IdParamSchema).toBeDefined();
    expect(securityModule.UuidParamSchema).toBeDefined();
    expect(securityModule.PaginationSchema).toBeDefined();
    expect(securityModule.SearchSchema).toBeDefined();
    expect(securityModule.DateRangeSchema).toBeDefined();
    expect(securityModule.StatusSchema).toBeDefined();
    expect(securityModule.PrioritySchema).toBeDefined();
  });

  it('should export chat schemas', () => {
    expect(securityModule.ChatMessageSchema).toBeDefined();
    expect(securityModule.ParseCommandSchema).toBeDefined();
    expect(securityModule.ConversationIdParamSchema).toBeDefined();
    expect(securityModule.UpdateConversationSchema).toBeDefined();
    expect(securityModule.ConversationQuerySchema).toBeDefined();
  });

  it('should export auth schemas', () => {
    expect(securityModule.RegisterSchema).toBeDefined();
    expect(securityModule.LoginSchema).toBeDefined();
    expect(securityModule.RefreshTokenSchema).toBeDefined();
    expect(securityModule.CreateApiKeySchema).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ABUSE DETECTION RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Abuse Detection Re-exports', () => {
  it('should export abuse config', () => {
    expect(securityModule.DEFAULT_ABUSE_CONFIG).toBeDefined();
  });

  it('should export abuse patterns', () => {
    expect(securityModule.PROMPT_INJECTION_PATTERNS).toBeDefined();
    expect(securityModule.HARASSMENT_PATTERNS).toBeDefined();
    expect(securityModule.SPAM_PATTERNS).toBeDefined();
  });

  it('should export abuse detector classes', () => {
    expect(securityModule.AbuseDetector).toBeDefined();
    expect(securityModule.BlockStore).toBeDefined();
    expect(securityModule.VetoHistoryStore).toBeDefined();
  });

  it('should export abuse middleware', () => {
    expect(typeof securityModule.blockCheck).toBe('function');
    expect(typeof securityModule.abuseDetection).toBe('function');
    expect(typeof securityModule.abuseProtection).toBe('function');
  });

  it('should export AbuseErrorCode', () => {
    expect(securityModule.AbuseErrorCode).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SSRF PROTECTION RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('SSRF Protection Re-exports', () => {
  it('should export SSRF config', () => {
    expect(securityModule.DEFAULT_SSRF_CONFIG).toBeDefined();
  });

  it('should export SSRFGuard class', () => {
    expect(securityModule.SSRFGuard).toBeDefined();
  });

  it('should export SSRF functions', () => {
    expect(typeof securityModule.initSSRFGuard).toBe('function');
    expect(typeof securityModule.getSSRFGuard).toBe('function');
    expect(typeof securityModule.validateUrl).toBe('function');
    expect(typeof securityModule.isUrlSafe).toBe('function');
    expect(typeof securityModule.isPrivateIp).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// AUDIT RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Audit Re-exports', () => {
  it('should export AuditStore class', () => {
    expect(securityModule.AuditStore).toBeDefined();
  });

  it('should export audit functions', () => {
    expect(typeof securityModule.initAuditStore).toBe('function');
    expect(typeof securityModule.getAuditStore).toBe('function');
    expect(typeof securityModule.logAudit).toBe('function');
    expect(typeof securityModule.logAuthEvent).toBe('function');
    expect(typeof securityModule.logSecurityWarning).toBe('function');
    expect(typeof securityModule.logSecurityError).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// initSecurity TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('initSecurity()', () => {
  let mockStore: KeyValueStore;

  beforeEach(() => {
    mockStore = createMockStore();
  });

  it('should initialize all security modules', () => {
    expect(() => {
      securityModule.initSecurity(mockStore);
    }).not.toThrow();
  });

  it('should accept custom token config', () => {
    expect(() => {
      securityModule.initSecurity(mockStore, {
        tokenConfig: {
          secret: 'custom-secret',
          accessTokenExpiry: '30m',
        },
      });
    }).not.toThrow();
  });

  it('should accept custom abuse config', () => {
    expect(() => {
      securityModule.initSecurity(mockStore, {
        abuseConfig: {
          blockDurationMs: 7200000,
        },
      });
    }).not.toThrow();
  });

  it('should accept custom SSRF config', () => {
    expect(() => {
      securityModule.initSecurity(mockStore, {
        ssrfConfig: {
          allowHttp: true,
        },
      });
    }).not.toThrow();
  });

  it('should allow getting initialized stores after init', () => {
    securityModule.initSecurity(mockStore);
    
    expect(() => securityModule.getRateLimiter()).not.toThrow();
    expect(() => securityModule.getIpRateLimiter()).not.toThrow();
    expect(() => securityModule.getSSRFGuard()).not.toThrow();
    expect(() => securityModule.getAuditStore()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Integration', () => {
  let mockStore: KeyValueStore;

  beforeEach(() => {
    mockStore = createMockStore();
    securityModule.initSecurity(mockStore);
  });

  it('should allow complete security workflow', async () => {
    // Initialize
    securityModule.initTokenConfig({ secret: 'test-secret' });
    
    // Generate token
    const { token, expiresAt } = securityModule.generateAccessToken('user-123', 'pro');
    expect(token).toBeDefined();
    expect(expiresAt).toBeGreaterThan(Date.now());
    
    // Verify token
    const result = securityModule.verifyTokenSync(token);
    expect(result.valid).toBe(true);
  });

  it('should check URL safety', () => {
    expect(securityModule.isUrlSafe('https://8.8.8.8')).toBe(true);
    expect(securityModule.isUrlSafe('https://127.0.0.1')).toBe(false);
    expect(securityModule.isUrlSafe('https://localhost')).toBe(false);
  });

  it('should detect private IPs', () => {
    expect(securityModule.isPrivateIp('127.0.0.1')).toBe(true);
    expect(securityModule.isPrivateIp('10.0.0.1')).toBe(true);
    expect(securityModule.isPrivateIp('192.168.1.1')).toBe(true);
    expect(securityModule.isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('should validate schemas', () => {
    const validMessage = securityModule.ChatMessageSchema.parse({
      message: 'Hello, Nova!',
    });
    
    expect(validMessage.message).toBe('Hello, Nova!');
  });
});
