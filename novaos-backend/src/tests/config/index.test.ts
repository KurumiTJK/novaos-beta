// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG MODULE INDEX TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import * as config from '../../config/index.js';

describe('Config Module Exports', () => {
  // ─────────────────────────────────────────────────────────────────────────────────
  // CORE LOADER
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('Core Loader Exports', () => {
    it('should export loadConfig', () => {
      expect(config.loadConfig).toBeDefined();
      expect(typeof config.loadConfig).toBe('function');
    });

    it('should export getConfig', () => {
      expect(config.getConfig).toBeDefined();
    });

    it('should export isConfigLoaded', () => {
      expect(config.isConfigLoaded).toBeDefined();
    });

    it('should export resetConfig', () => {
      expect(config.resetConfig).toBeDefined();
    });

    it('should export loadTestConfig', () => {
      expect(config.loadTestConfig).toBeDefined();
    });

    it('should export environment helpers', () => {
      expect(config.getEnvironment).toBeDefined();
      expect(config.isProduction).toBeDefined();
      expect(config.isStaging).toBeDefined();
      expect(config.isDevelopment).toBeDefined();
      expect(config.isProductionLike).toBeDefined();
      expect(config.isDebugMode).toBeDefined();
    });

    it('should export capability checks', () => {
      expect(config.canVerify).toBeDefined();
      expect(config.canFetch).toBeDefined();
    });

    it('should export config accessors', () => {
      expect(config.getLLMConfig).toBeDefined();
      expect(config.getSwordLimits).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // SCHEMA
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('Schema Exports', () => {
    it('should export schema types', () => {
      expect(config.AppConfigSchema).toBeDefined();
      expect(config.ServerConfigSchema).toBeDefined();
      expect(config.RedisConfigSchema).toBeDefined();
      expect(config.LLMConfigSchema).toBeDefined();
      expect(config.SwordLimitsConfigSchema).toBeDefined();
    });

    it('should export validation helpers', () => {
      expect(config.validateConfig).toBeDefined();
      expect(config.safeValidateConfig).toBeDefined();
      expect(config.formatConfigErrors).toBeDefined();
      expect(config.getDefaultConfig).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // DEFAULTS
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('Defaults Exports', () => {
    it('should export getDefaults', () => {
      expect(config.getDefaults).toBeDefined();
    });

    it('should export environment-specific defaults', () => {
      expect(config.getDevelopmentDefaults).toBeDefined();
      expect(config.getStagingDefaults).toBeDefined();
      expect(config.getProductionDefaults).toBeDefined();
    });

    it('should export default helpers', () => {
      expect(config.getDefaultLLMModel).toBeDefined();
      expect(config.getDefaultRateLimitMultiplier).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // SECRETS
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('Secrets Exports', () => {
    it('should export secret providers', () => {
      expect(config.EnvironmentSecretProvider).toBeDefined();
      expect(config.MockSecretProvider).toBeDefined();
      expect(config.AWSSecretsManagerProvider).toBeDefined();
      expect(config.VaultSecretProvider).toBeDefined();
    });

    it('should export SecretsManager', () => {
      expect(config.SecretsManager).toBeDefined();
    });

    it('should export singleton functions', () => {
      expect(config.createSecretsManager).toBeDefined();
      expect(config.initSecrets).toBeDefined();
      expect(config.getSecrets).toBeDefined();
      expect(config.isSecretsInitialized).toBeDefined();
      expect(config.resetSecrets).toBeDefined();
    });

    it('should export convenience functions', () => {
      expect(config.getSecretValue).toBeDefined();
      expect(config.requireSecretValue).toBeDefined();
      expect(config.hasSecretValue).toBeDefined();
    });

    it('should export encryption helpers', () => {
      expect(config.getEncryptionKey).toBeDefined();
      expect(config.getEncryptionKeys).toBeDefined();
    });
  });
});
