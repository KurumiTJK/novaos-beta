// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION SCHEMA TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  AppConfigSchema,
  ServerConfigSchema,
  RedisConfigSchema,
  EncryptionConfigSchema,
  AuthConfigSchema,
  RateLimitsConfigSchema,
  SSRFConfigSchema,
  LLMConfigSchema,
  SwordLimitsConfigSchema,
  RetentionConfigSchema,
  VerificationConfigSchema,
  WebFetchConfigSchema,
  ObservabilityConfigSchema,
  CorsConfigSchema,
  EnvironmentSchema,
  validateConfig,
  safeValidateConfig,
  formatConfigErrors,
  getDefaultConfig,
} from '../../config/schema.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────────

describe('EnvironmentSchema', () => {
  it('should accept valid environments', () => {
    expect(EnvironmentSchema.parse('development')).toBe('development');
    expect(EnvironmentSchema.parse('staging')).toBe('staging');
    expect(EnvironmentSchema.parse('production')).toBe('production');
  });

  it('should reject invalid environments', () => {
    expect(() => EnvironmentSchema.parse('test')).toThrow(ZodError);
    expect(() => EnvironmentSchema.parse('dev')).toThrow(ZodError);
    expect(() => EnvironmentSchema.parse('')).toThrow(ZodError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SERVER CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('ServerConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = ServerConfigSchema.parse({});
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.shutdownTimeoutMs).toBe(30000);
    expect(config.trustProxy).toBe(false);
  });

  it('should accept valid port numbers', () => {
    expect(ServerConfigSchema.parse({ port: 1 }).port).toBe(1);
    expect(ServerConfigSchema.parse({ port: 8080 }).port).toBe(8080);
    expect(ServerConfigSchema.parse({ port: 65535 }).port).toBe(65535);
  });

  it('should reject invalid port numbers', () => {
    expect(() => ServerConfigSchema.parse({ port: 0 })).toThrow(ZodError);
    expect(() => ServerConfigSchema.parse({ port: 65536 })).toThrow(ZodError);
    expect(() => ServerConfigSchema.parse({ port: -1 })).toThrow(ZodError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// REDIS CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('RedisConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = RedisConfigSchema.parse({});
    expect(config.host).toBe('localhost');
    expect(config.port).toBe(6379);
    expect(config.tls).toBe(false);
    expect(config.keyPrefix).toBe('nova:');
    expect(config.disabled).toBe(false);
  });

  it('should accept URL', () => {
    const config = RedisConfigSchema.parse({
      url: 'redis://localhost:6379',
    });
    expect(config.url).toBe('redis://localhost:6379');
  });

  it('should reject invalid URL', () => {
    expect(() => RedisConfigSchema.parse({ url: 'not-a-url' })).toThrow(ZodError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ENCRYPTION CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('EncryptionConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = EncryptionConfigSchema.parse({});
    expect(config.enabled).toBe(false);
    expect(config.algorithm).toBe('aes-256-gcm');
    expect(config.currentKeyId).toBe('key-1');
  });

  it('should accept valid algorithms', () => {
    expect(EncryptionConfigSchema.parse({ algorithm: 'aes-256-gcm' }).algorithm).toBe('aes-256-gcm');
    expect(EncryptionConfigSchema.parse({ algorithm: 'aes-256-cbc' }).algorithm).toBe('aes-256-cbc');
  });

  it('should reject invalid algorithms', () => {
    expect(() => EncryptionConfigSchema.parse({ algorithm: 'aes-128-gcm' })).toThrow(ZodError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('AuthConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = AuthConfigSchema.parse({});
    expect(config.jwtIssuer).toBe('novaos');
    expect(config.jwtAudience).toBe('novaos-api');
    expect(config.tokenExpirySeconds).toBe(86400);
    expect(config.required).toBe(false);
  });

  it('should require JWT secret to be at least 32 chars', () => {
    expect(() => AuthConfigSchema.parse({ jwtSecret: 'short' })).toThrow(ZodError);
    expect(AuthConfigSchema.parse({ jwtSecret: 'a'.repeat(32) }).jwtSecret).toBe('a'.repeat(32));
  });

  it('should reject token expiry less than 60 seconds', () => {
    expect(() => AuthConfigSchema.parse({ tokenExpirySeconds: 30 })).toThrow(ZodError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// RATE LIMITS CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('RateLimitsConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = RateLimitsConfigSchema.parse({});
    expect(config.api.windowMs).toBe(60000);
    expect(config.api.maxRequests).toBe(60);
    expect(config.multiplier).toBe(1.0);
  });

  it('should accept valid multiplier', () => {
    expect(RateLimitsConfigSchema.parse({ multiplier: 0.5 }).multiplier).toBe(0.5);
    expect(RateLimitsConfigSchema.parse({ multiplier: 5.0 }).multiplier).toBe(5.0);
  });

  it('should reject invalid multiplier', () => {
    expect(() => RateLimitsConfigSchema.parse({ multiplier: 0.05 })).toThrow(ZodError);
    expect(() => RateLimitsConfigSchema.parse({ multiplier: 15 })).toThrow(ZodError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SSRF CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('SSRFConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = SSRFConfigSchema.parse({});
    expect(config.allowedPorts).toEqual([80, 443]);
    expect(config.allowPrivateIps).toBe(false);
    expect(config.allowLocalhost).toBe(false);
    expect(config.validateCerts).toBe(true);
    expect(config.blockedDomains).toContain('169.254.169.254');
  });

  it('should accept custom blocked domains', () => {
    const config = SSRFConfigSchema.parse({
      blockedDomains: ['evil.com', 'bad.org'],
    });
    expect(config.blockedDomains).toEqual(['evil.com', 'bad.org']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// LLM CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('LLMConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = LLMConfigSchema.parse({});
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
    expect(config.temperature).toBe(0.7);
    expect(config.useMock).toBe(false);
  });

  it('should accept valid providers', () => {
    expect(LLMConfigSchema.parse({ provider: 'openai' }).provider).toBe('openai');
    expect(LLMConfigSchema.parse({ provider: 'gemini' }).provider).toBe('gemini');
    expect(LLMConfigSchema.parse({ provider: 'mock' }).provider).toBe('mock');
  });

  it('should accept valid temperature', () => {
    expect(LLMConfigSchema.parse({ temperature: 0 }).temperature).toBe(0);
    expect(LLMConfigSchema.parse({ temperature: 2.0 }).temperature).toBe(2.0);
  });

  it('should reject invalid temperature', () => {
    expect(() => LLMConfigSchema.parse({ temperature: -0.1 })).toThrow(ZodError);
    expect(() => LLMConfigSchema.parse({ temperature: 2.1 })).toThrow(ZodError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SWORD LIMITS CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('SwordLimitsConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = SwordLimitsConfigSchema.parse({});
    expect(config.maxGoalsPerUser).toBe(10);
    expect(config.maxActiveGoals).toBe(3);
    expect(config.minSparkMinutes).toBe(2);
    expect(config.maxSparkMinutes).toBe(30);
  });

  it('should enforce limits', () => {
    expect(() => SwordLimitsConfigSchema.parse({ maxGoalsPerUser: 0 })).toThrow(ZodError);
    expect(() => SwordLimitsConfigSchema.parse({ maxGoalsPerUser: 101 })).toThrow(ZodError);
  });

  it('should accept valid scheduling hours', () => {
    expect(SwordLimitsConfigSchema.parse({ dailyStepGenerationHour: 0 }).dailyStepGenerationHour).toBe(0);
    expect(SwordLimitsConfigSchema.parse({ dailyStepGenerationHour: 23 }).dailyStepGenerationHour).toBe(23);
  });

  it('should reject invalid scheduling hours', () => {
    expect(() => SwordLimitsConfigSchema.parse({ dailyStepGenerationHour: -1 })).toThrow(ZodError);
    expect(() => SwordLimitsConfigSchema.parse({ dailyStepGenerationHour: 24 })).toThrow(ZodError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// RETENTION CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('RetentionConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = RetentionConfigSchema.parse({});
    expect(config.completedGoalsDays).toBe(365);
    expect(config.abandonedGoalsDays).toBe(90);
    expect(config.auditLogDays).toBe(90);
    expect(config.memoryDays).toBe(730);
  });

  it('should require minimum of 1 day', () => {
    expect(() => RetentionConfigSchema.parse({ completedGoalsDays: 0 })).toThrow(ZodError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// OBSERVABILITY CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('ObservabilityConfigSchema', () => {
  it('should parse with defaults', () => {
    const config = ObservabilityConfigSchema.parse({});
    expect(config.debugMode).toBe(false);
    expect(config.redactPII).toBe(true);
    expect(config.logLevel).toBe('info');
  });

  it('should accept valid log levels', () => {
    expect(ObservabilityConfigSchema.parse({ logLevel: 'debug' }).logLevel).toBe('debug');
    expect(ObservabilityConfigSchema.parse({ logLevel: 'info' }).logLevel).toBe('info');
    expect(ObservabilityConfigSchema.parse({ logLevel: 'warn' }).logLevel).toBe('warn');
    expect(ObservabilityConfigSchema.parse({ logLevel: 'error' }).logLevel).toBe('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// COMPLETE APP CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('AppConfigSchema', () => {
  it('should parse empty object with all defaults', () => {
    const config = AppConfigSchema.parse({});
    expect(config.environment).toBe('development');
    expect(config.server.port).toBe(3000);
    expect(config.redis.host).toBe('localhost');
    expect(config.llm.provider).toBe('openai');
  });

  it('should allow overriding nested values', () => {
    const config = AppConfigSchema.parse({
      environment: 'production',
      server: { port: 8080 },
      llm: { model: 'gpt-4o-mini' },
    });
    expect(config.environment).toBe('production');
    expect(config.server.port).toBe(8080);
    expect(config.llm.model).toBe('gpt-4o-mini');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

describe('validateConfig', () => {
  it('should return valid config', () => {
    const config = validateConfig({ environment: 'staging' });
    expect(config.environment).toBe('staging');
  });

  it('should throw on invalid config', () => {
    expect(() => validateConfig({ environment: 'invalid' })).toThrow(ZodError);
  });
});

describe('safeValidateConfig', () => {
  it('should return success for valid config', () => {
    const result = safeValidateConfig({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.environment).toBe('development');
    }
  });

  it('should return error for invalid config', () => {
    const result = safeValidateConfig({ server: { port: -1 } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
    }
  });
});

describe('formatConfigErrors', () => {
  it('should format errors with paths', () => {
    const result = safeValidateConfig({ server: { port: -1 } });
    if (!result.success) {
      const messages = formatConfigErrors(result.error);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('server.port');
    }
  });
});

describe('getDefaultConfig', () => {
  it('should return default config for development', () => {
    const config = getDefaultConfig('development');
    expect(config.environment).toBe('development');
  });

  it('should return default config for production', () => {
    const config = getDefaultConfig('production');
    expect(config.environment).toBe('production');
  });

  it('should default to development', () => {
    const config = getDefaultConfig();
    expect(config.environment).toBe('development');
  });
});
