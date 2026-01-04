// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION DEFAULTS TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  getDefaults,
  getDevelopmentDefaults,
  getStagingDefaults,
  getProductionDefaults,
  isProductionLike,
  getDefaultLLMModel,
  getDefaultRateLimitMultiplier,
  DEVELOPMENT_DEFAULTS,
  STAGING_DEFAULTS,
  PRODUCTION_DEFAULTS,
} from '../../config/defaults.js';

// ─────────────────────────────────────────────────────────────────────────────────
// GET DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getDefaults', () => {
  it('should return development defaults', () => {
    const defaults = getDefaults('development');
    expect(defaults.environment).toBe('development');
  });

  it('should return staging defaults', () => {
    const defaults = getDefaults('staging');
    expect(defaults.environment).toBe('staging');
  });

  it('should return production defaults', () => {
    const defaults = getDefaults('production');
    expect(defaults.environment).toBe('production');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// DEVELOPMENT DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Development Defaults', () => {
  const defaults = getDevelopmentDefaults();

  it('should have development environment', () => {
    expect(defaults.environment).toBe('development');
  });

  it('should have relaxed rate limits', () => {
    expect(defaults.rateLimits?.api?.maxRequests).toBe(1000);
    expect(defaults.rateLimits?.multiplier).toBe(2.0);
  });

  it('should disable encryption', () => {
    expect(defaults.encryption?.enabled).toBe(false);
  });

  it('should disable required auth', () => {
    expect(defaults.auth?.required).toBe(false);
  });

  it('should allow private IPs for SSRF', () => {
    expect(defaults.ssrf?.allowPrivateIps).toBe(true);
    expect(defaults.ssrf?.allowLocalhost).toBe(true);
  });

  it('should enable debug mode', () => {
    expect(defaults.observability?.debugMode).toBe(true);
  });

  it('should not redact PII', () => {
    expect(defaults.observability?.redactPII).toBe(false);
  });

  it('should have longer token expiry', () => {
    expect(defaults.auth?.tokenExpirySeconds).toBe(86400 * 7); // 7 days
  });

  it('should have relaxed sword limits', () => {
    expect(defaults.swordLimits?.maxGoalsPerUser).toBe(50);
  });

  it('should allow localhost CORS', () => {
    expect(defaults.cors?.allowedOrigins).toContain('http://localhost:3000');
    expect(defaults.cors?.allowedOrigins).toContain('http://localhost:5173');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// STAGING DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Staging Defaults', () => {
  const defaults = getStagingDefaults();

  it('should have staging environment', () => {
    expect(defaults.environment).toBe('staging');
  });

  it('should enable encryption', () => {
    expect(defaults.encryption?.enabled).toBe(true);
  });

  it('should require auth', () => {
    expect(defaults.auth?.required).toBe(true);
  });

  it('should have normal rate limits', () => {
    expect(defaults.rateLimits?.multiplier).toBe(1.0);
  });

  it('should block private IPs for SSRF', () => {
    expect(defaults.ssrf?.allowPrivateIps).toBe(false);
    expect(defaults.ssrf?.allowLocalhost).toBe(false);
  });

  it('should enable debug mode (for extra logging)', () => {
    expect(defaults.observability?.debugMode).toBe(true);
  });

  it('should redact PII', () => {
    expect(defaults.observability?.redactPII).toBe(true);
  });

  it('should use cheaper model', () => {
    expect(defaults.llm?.model).toBe('gpt-4o-mini');
  });

  it('should have staging overrides', () => {
    expect(defaults.stagingOverrides).toBeDefined();
    expect(defaults.stagingOverrides?.openaiModel).toBe('gpt-4o-mini');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// PRODUCTION DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Production Defaults', () => {
  const defaults = getProductionDefaults();

  it('should have production environment', () => {
    expect(defaults.environment).toBe('production');
  });

  it('should enable encryption', () => {
    expect(defaults.encryption?.enabled).toBe(true);
  });

  it('should require auth', () => {
    expect(defaults.auth?.required).toBe(true);
  });

  it('should have strict SSRF settings', () => {
    expect(defaults.ssrf?.allowPrivateIps).toBe(false);
    expect(defaults.ssrf?.allowLocalhost).toBe(false);
    expect(defaults.ssrf?.validateCerts).toBe(true);
    expect(defaults.ssrf?.preventDnsRebinding).toBe(true);
  });

  it('should disable debug mode', () => {
    expect(defaults.observability?.debugMode).toBe(false);
  });

  it('should redact PII', () => {
    expect(defaults.observability?.redactPII).toBe(true);
  });

  it('should use full model', () => {
    expect(defaults.llm?.model).toBe('gpt-4o');
  });

  it('should enable TLS for Redis', () => {
    expect(defaults.redis?.tls).toBe(true);
  });

  it('should trust proxy', () => {
    expect(defaults.server?.trustProxy).toBe(true);
  });

  it('should have longer shutdown timeout', () => {
    expect(defaults.server?.shutdownTimeoutMs).toBe(30000);
  });

  it('should have empty CORS origins (must be configured)', () => {
    expect(defaults.cors?.allowedOrigins).toEqual([]);
  });

  it('should enable verification and web fetch', () => {
    expect(defaults.verification?.enabled).toBe(true);
    expect(defaults.webFetch?.enabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

describe('isProductionLike', () => {
  it('should return false for development', () => {
    expect(isProductionLike('development')).toBe(false);
  });

  it('should return true for staging', () => {
    expect(isProductionLike('staging')).toBe(true);
  });

  it('should return true for production', () => {
    expect(isProductionLike('production')).toBe(true);
  });
});

describe('getDefaultLLMModel', () => {
  it('should return gpt-4o-mini for development', () => {
    expect(getDefaultLLMModel('development')).toBe('gpt-4o-mini');
  });

  it('should return gpt-4o-mini for staging', () => {
    expect(getDefaultLLMModel('staging')).toBe('gpt-4o-mini');
  });

  it('should return gpt-4o for production', () => {
    expect(getDefaultLLMModel('production')).toBe('gpt-4o');
  });
});

describe('getDefaultRateLimitMultiplier', () => {
  it('should return 2.0 for development', () => {
    expect(getDefaultRateLimitMultiplier('development')).toBe(2.0);
  });

  it('should return 1.0 for staging', () => {
    expect(getDefaultRateLimitMultiplier('staging')).toBe(1.0);
  });

  it('should return 1.0 for production', () => {
    expect(getDefaultRateLimitMultiplier('production')).toBe(1.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTED CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Exported Constants', () => {
  it('should export DEVELOPMENT_DEFAULTS', () => {
    expect(DEVELOPMENT_DEFAULTS.environment).toBe('development');
  });

  it('should export STAGING_DEFAULTS', () => {
    expect(STAGING_DEFAULTS.environment).toBe('staging');
  });

  it('should export PRODUCTION_DEFAULTS', () => {
    expect(PRODUCTION_DEFAULTS.environment).toBe('production');
  });
});
