// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION LOADER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadConfig,
  getConfig,
  isConfigLoaded,
  resetConfig,
  loadTestConfig,
  getEnvironment,
  isProduction,
  isStaging,
  isDevelopment,
  isProductionLike,
  isDebugMode,
  canVerify,
  canFetch,
  getLLMConfig,
  getSwordLimits,
} from '../../config/loader.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SETUP / TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────────

describe('Config Loader', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfig();
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    resetConfig();
    process.env = originalEnv;
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('loadConfig', () => {
    it('should load config with defaults', () => {
      const config = loadConfig();
      expect(config).toBeDefined();
      expect(config.environment).toBe('development');
      expect(config.server.port).toBe(3000);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      const config = loadConfig();
      expect(config.environment).toBe('production');
    });

    it('should detect staging environment', () => {
      process.env.NODE_ENV = 'staging';
      const config = loadConfig();
      expect(config.environment).toBe('staging');
    });

    it('should read PORT from environment', () => {
      process.env.PORT = '8080';
      const config = loadConfig();
      expect(config.server.port).toBe(8080);
    });

    it('should read REDIS_HOST from environment', () => {
      process.env.REDIS_HOST = 'redis.example.com';
      const config = loadConfig();
      expect(config.redis.host).toBe('redis.example.com');
    });

    it('should read DISABLE_REDIS from environment', () => {
      process.env.DISABLE_REDIS = 'true';
      const config = loadConfig();
      expect(config.redis.disabled).toBe(true);
    });

    it('should read LLM config from environment', () => {
      process.env.OPENAI_MODEL = 'gpt-4o-mini';
      process.env.LLM_TEMPERATURE = '0.5';
      const config = loadConfig();
      expect(config.llm.model).toBe('gpt-4o-mini');
      expect(config.llm.temperature).toBe(0.5);
    });

    it('should read rate limits from environment', () => {
      process.env.RATE_LIMIT_API_MAX = '100';
      process.env.RATE_LIMIT_MULTIPLIER = '2.0';
      const config = loadConfig();
      expect(config.rateLimits.api.maxRequests).toBe(100);
      expect(config.rateLimits.multiplier).toBe(2.0);
    });

    it('should be frozen after loading', () => {
      const config = loadConfig();
      expect(() => {
        (config as any).environment = 'production';
      }).toThrow();
    });

    it('should return same instance on multiple calls', () => {
      const config1 = loadConfig();
      const config2 = loadConfig();
      expect(config1).toBe(config2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // STATE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('getConfig', () => {
    it('should throw if not loaded', () => {
      expect(() => getConfig()).toThrow('Configuration not loaded');
    });

    it('should return config after loading', () => {
      loadConfig();
      const config = getConfig();
      expect(config).toBeDefined();
    });
  });

  describe('isConfigLoaded', () => {
    it('should return false before loading', () => {
      expect(isConfigLoaded()).toBe(false);
    });

    it('should return true after loading', () => {
      loadConfig();
      expect(isConfigLoaded()).toBe(true);
    });

    it('should return false after reset', () => {
      loadConfig();
      resetConfig();
      expect(isConfigLoaded()).toBe(false);
    });
  });

  describe('resetConfig', () => {
    it('should reset loaded config', () => {
      loadConfig();
      resetConfig();
      expect(isConfigLoaded()).toBe(false);
    });
  });

  describe('loadTestConfig', () => {
    it('should load with overrides', () => {
      const config = loadTestConfig({
        environment: 'production',
        server: { port: 9999 },
      });
      expect(config.environment).toBe('production');
      expect(config.server.port).toBe(9999);
    });

    it('should reset before loading', () => {
      loadConfig();
      loadTestConfig({ environment: 'staging' });
      expect(getConfig().environment).toBe('staging');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // ENVIRONMENT HELPERS
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('Environment Helpers', () => {
    describe('getEnvironment', () => {
      it('should return current environment', () => {
        loadConfig();
        expect(getEnvironment()).toBe('development');
      });
    });

    describe('isProduction', () => {
      it('should return true for production', () => {
        loadTestConfig({ environment: 'production' });
        expect(isProduction()).toBe(true);
      });

      it('should return false for development', () => {
        loadTestConfig({ environment: 'development' });
        expect(isProduction()).toBe(false);
      });
    });

    describe('isStaging', () => {
      it('should return true for staging', () => {
        loadTestConfig({ environment: 'staging' });
        expect(isStaging()).toBe(true);
      });
    });

    describe('isDevelopment', () => {
      it('should return true for development', () => {
        loadTestConfig({ environment: 'development' });
        expect(isDevelopment()).toBe(true);
      });
    });

    describe('isProductionLike', () => {
      it('should return true for production', () => {
        loadTestConfig({ environment: 'production' });
        expect(isProductionLike()).toBe(true);
      });

      it('should return true for staging', () => {
        loadTestConfig({ environment: 'staging' });
        expect(isProductionLike()).toBe(true);
      });

      it('should return false for development', () => {
        loadTestConfig({ environment: 'development' });
        expect(isProductionLike()).toBe(false);
      });
    });

    describe('isDebugMode', () => {
      it('should return true when debug mode enabled', () => {
        loadTestConfig({ observability: { debugMode: true } });
        expect(isDebugMode()).toBe(true);
      });

      it('should return false when debug mode disabled', () => {
        loadTestConfig({ observability: { debugMode: false } });
        expect(isDebugMode()).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // CAPABILITY CHECKS
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('Capability Checks', () => {
    describe('canVerify', () => {
      it('should return true when verification and web fetch enabled', () => {
        loadTestConfig({
          verification: { enabled: true },
          webFetch: { enabled: true },
        });
        expect(canVerify()).toBe(true);
      });

      it('should return false when verification disabled', () => {
        loadTestConfig({
          verification: { enabled: false },
          webFetch: { enabled: true },
        });
        expect(canVerify()).toBe(false);
      });

      it('should return false when web fetch disabled', () => {
        loadTestConfig({
          verification: { enabled: true },
          webFetch: { enabled: false },
        });
        expect(canVerify()).toBe(false);
      });
    });

    describe('canFetch', () => {
      it('should return true when web fetch enabled', () => {
        loadTestConfig({ webFetch: { enabled: true } });
        expect(canFetch()).toBe(true);
      });

      it('should return false when web fetch disabled', () => {
        loadTestConfig({ webFetch: { enabled: false } });
        expect(canFetch()).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // CONFIG ACCESSORS
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('Config Accessors', () => {
    describe('getLLMConfig', () => {
      it('should return LLM config section', () => {
        loadTestConfig({ llm: { model: 'gpt-4o-mini' } });
        const llm = getLLMConfig();
        expect(llm.model).toBe('gpt-4o-mini');
      });
    });

    describe('getSwordLimits', () => {
      it('should return Sword limits section', () => {
        loadTestConfig({ swordLimits: { maxGoalsPerUser: 20 } });
        const limits = getSwordLimits();
        expect(limits.maxGoalsPerUser).toBe(20);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // ENVIRONMENT VARIABLE PARSING
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('Environment Variable Parsing', () => {
    it('should parse boolean true values', () => {
      process.env.REQUIRE_AUTH = 'true';
      const config = loadConfig();
      expect(config.auth.required).toBe(true);
    });

    it('should parse boolean 1 as true', () => {
      resetConfig();
      process.env.REQUIRE_AUTH = '1';
      const config = loadConfig();
      expect(config.auth.required).toBe(true);
    });

    it('should parse boolean yes as true', () => {
      resetConfig();
      process.env.REQUIRE_AUTH = 'yes';
      const config = loadConfig();
      expect(config.auth.required).toBe(true);
    });

    it('should parse boolean false values', () => {
      process.env.REQUIRE_AUTH = 'false';
      const config = loadConfig();
      expect(config.auth.required).toBe(false);
    });

    it('should parse number list', () => {
      process.env.SSRF_ALLOWED_PORTS = '80,443,8080';
      const config = loadConfig();
      expect(config.ssrf.allowedPorts).toEqual([80, 443, 8080]);
    });

    it('should parse string list', () => {
      process.env.WEB_FETCH_BLOCKLIST = 'evil.com, bad.org';
      const config = loadConfig();
      expect(config.ssrf.blockedDomains).toContain('evil.com');
      expect(config.ssrf.blockedDomains).toContain('bad.org');
    });
  });
});
