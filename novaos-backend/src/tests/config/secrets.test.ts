// ═══════════════════════════════════════════════════════════════════════════════
// SECRETS MANAGEMENT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentSecretProvider,
  MockSecretProvider,
  AWSSecretsManagerProvider,
  VaultSecretProvider,
  SecretsManager,
  createSecretsManager,
  initSecrets,
  getSecrets,
  isSecretsInitialized,
  resetSecrets,
  getSecretValue,
  requireSecretValue,
  hasSecretValue,
  getEncryptionKey,
  getEncryptionKeys,
  type SecretKey,
} from '../../config/secrets.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT SECRET PROVIDER
// ─────────────────────────────────────────────────────────────────────────────────

describe('EnvironmentSecretProvider', () => {
  const originalEnv = { ...process.env };
  const provider = new EnvironmentSecretProvider();

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should have name "environment"', () => {
    expect(provider.name).toBe('environment');
  });

  it('should return secret when env var exists', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-123';
    const result = await provider.getSecret('openaiApiKey');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.secret.value).toBe('sk-test-123');
      expect(result.secret.version).toBe('env');
    }
  });

  it('should return error when env var missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await provider.getSecret('openaiApiKey');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not found');
      expect(result.error).toContain('OPENAI_API_KEY');
    }
  });

  it('should return error for empty env var', async () => {
    process.env.OPENAI_API_KEY = '';
    const result = await provider.getSecret('openaiApiKey');
    expect(result.success).toBe(false);
  });

  it('should always be available', async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it('should map all known secret keys', async () => {
    const keys: SecretKey[] = [
      'encryptionKey',
      'jwtSigningKey',
      'openaiApiKey',
      'geminiApiKey',
      'redisPassword',
    ];

    for (const key of keys) {
      const result = await provider.getSecret(key);
      // Should attempt to fetch (will fail since env vars aren't set)
      expect(result.success).toBe(false);
      // But should not throw
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK SECRET PROVIDER
// ─────────────────────────────────────────────────────────────────────────────────

describe('MockSecretProvider', () => {
  it('should have name "mock"', () => {
    const provider = new MockSecretProvider();
    expect(provider.name).toBe('mock');
  });

  it('should return configured secrets', async () => {
    const provider = new MockSecretProvider({
      openaiApiKey: 'mock-key-123',
    });

    const result = await provider.getSecret('openaiApiKey');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.secret.value).toBe('mock-key-123');
    }
  });

  it('should return error for unconfigured secrets', async () => {
    const provider = new MockSecretProvider();
    const result = await provider.getSecret('openaiApiKey');
    expect(result.success).toBe(false);
  });

  it('should allow setting secrets after creation', async () => {
    const provider = new MockSecretProvider();
    provider.setSecret('openaiApiKey', 'new-key');
    const result = await provider.getSecret('openaiApiKey');
    expect(result.success).toBe(true);
  });

  it('should allow removing secrets', async () => {
    const provider = new MockSecretProvider({ openaiApiKey: 'key' });
    provider.removeSecret('openaiApiKey');
    const result = await provider.getSecret('openaiApiKey');
    expect(result.success).toBe(false);
  });

  it('should be available by default', async () => {
    const provider = new MockSecretProvider();
    expect(await provider.isAvailable()).toBe(true);
  });

  it('should allow toggling availability', async () => {
    const provider = new MockSecretProvider();
    provider.setAvailable(false);
    expect(await provider.isAvailable()).toBe(false);
    provider.setAvailable(true);
    expect(await provider.isAvailable()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// AWS SECRETS MANAGER PROVIDER (STUB)
// ─────────────────────────────────────────────────────────────────────────────────

describe('AWSSecretsManagerProvider', () => {
  it('should have name "aws-secrets-manager"', () => {
    const provider = new AWSSecretsManagerProvider({ region: 'us-east-1' });
    expect(provider.name).toBe('aws-secrets-manager');
  });

  it('should return not implemented error', async () => {
    const provider = new AWSSecretsManagerProvider({ region: 'us-east-1' });
    const result = await provider.getSecret('openaiApiKey');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not implemented');
    }
  });

  it('should not be available (stub)', async () => {
    const provider = new AWSSecretsManagerProvider({ region: 'us-east-1' });
    expect(await provider.isAvailable()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// VAULT SECRET PROVIDER (STUB)
// ─────────────────────────────────────────────────────────────────────────────────

describe('VaultSecretProvider', () => {
  it('should have name "vault"', () => {
    const provider = new VaultSecretProvider({ address: 'https://vault.example.com' });
    expect(provider.name).toBe('vault');
  });

  it('should return not implemented error', async () => {
    const provider = new VaultSecretProvider({ address: 'https://vault.example.com' });
    const result = await provider.getSecret('openaiApiKey');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not implemented');
    }
  });

  it('should not be available (stub)', async () => {
    const provider = new VaultSecretProvider({ address: 'https://vault.example.com' });
    expect(await provider.isAvailable()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SECRETS MANAGER
// ─────────────────────────────────────────────────────────────────────────────────

describe('SecretsManager', () => {
  let provider: MockSecretProvider;
  let manager: SecretsManager;

  beforeEach(() => {
    provider = new MockSecretProvider({
      openaiApiKey: 'test-openai-key',
      encryptionKey: Buffer.from('test-encryption-key-32bytes!!!!').toString('base64'),
    });
    manager = new SecretsManager({ provider, cacheTTLMs: 0 }); // Disable cache for testing
  });

  describe('getProviderName', () => {
    it('should return provider name', () => {
      expect(manager.getProviderName()).toBe('mock');
    });
  });

  describe('getSecret', () => {
    it('should return secret value', async () => {
      const value = await manager.getSecret('openaiApiKey');
      expect(value).toBe('test-openai-key');
    });

    it('should return null for missing secret', async () => {
      const value = await manager.getSecret('geminiApiKey');
      expect(value).toBeNull();
    });

    it('should cache secrets', async () => {
      const cachedManager = new SecretsManager({ provider, cacheTTLMs: 60000 });
      
      await cachedManager.getSecret('openaiApiKey');
      provider.removeSecret('openaiApiKey');
      
      // Should still return cached value
      const value = await cachedManager.getSecret('openaiApiKey');
      expect(value).toBe('test-openai-key');
    });

    it('should expire cache', async () => {
      const cachedManager = new SecretsManager({ provider, cacheTTLMs: 1 }); // 1ms cache
      
      await cachedManager.getSecret('openaiApiKey');
      provider.removeSecret('openaiApiKey');
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const value = await cachedManager.getSecret('openaiApiKey');
      expect(value).toBeNull();
    });
  });

  describe('requireSecret', () => {
    it('should return secret value', async () => {
      const value = await manager.requireSecret('openaiApiKey');
      expect(value).toBe('test-openai-key');
    });

    it('should throw for missing secret', async () => {
      await expect(manager.requireSecret('geminiApiKey')).rejects.toThrow('Required secret');
    });
  });

  describe('getSecrets', () => {
    it('should return multiple secrets', async () => {
      const results = await manager.getSecrets(['openaiApiKey', 'geminiApiKey']);
      expect(results.get('openaiApiKey')).toBe('test-openai-key');
      expect(results.get('geminiApiKey')).toBeNull();
    });
  });

  describe('hasSecret', () => {
    it('should return true for existing secret', async () => {
      expect(await manager.hasSecret('openaiApiKey')).toBe(true);
    });

    it('should return false for missing secret', async () => {
      expect(await manager.hasSecret('geminiApiKey')).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('should delegate to provider', async () => {
      expect(await manager.isAvailable()).toBe(true);
      provider.setAvailable(false);
      expect(await manager.isAvailable()).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      const cachedManager = new SecretsManager({ provider, cacheTTLMs: 60000 });
      
      await cachedManager.getSecret('openaiApiKey');
      provider.removeSecret('openaiApiKey');
      cachedManager.clearCache();
      
      const value = await cachedManager.getSecret('openaiApiKey');
      expect(value).toBeNull();
    });
  });

  describe('refresh', () => {
    it('should clear cache on refresh', async () => {
      const cachedManager = new SecretsManager({ provider, cacheTTLMs: 60000 });
      
      await cachedManager.getSecret('openaiApiKey');
      provider.setSecret('openaiApiKey', 'new-key');
      await cachedManager.refresh();
      
      const value = await cachedManager.getSecret('openaiApiKey');
      expect(value).toBe('new-key');
    });
  });

  describe('throwOnMissing', () => {
    it('should throw when enabled and secret missing', async () => {
      const strictManager = new SecretsManager({
        provider,
        throwOnMissing: true,
      });
      
      await expect(strictManager.getSecret('geminiApiKey')).rejects.toThrow();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON & FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

describe('Singleton Functions', () => {
  beforeEach(() => {
    resetSecrets();
  });

  afterEach(() => {
    resetSecrets();
  });

  describe('createSecretsManager', () => {
    it('should create manager with default provider', () => {
      const manager = createSecretsManager();
      expect(manager.getProviderName()).toBe('environment');
    });

    it('should create manager with custom provider', () => {
      const provider = new MockSecretProvider();
      const manager = createSecretsManager({ provider });
      expect(manager.getProviderName()).toBe('mock');
    });
  });

  describe('initSecrets', () => {
    it('should initialize singleton', () => {
      expect(isSecretsInitialized()).toBe(false);
      initSecrets();
      expect(isSecretsInitialized()).toBe(true);
    });
  });

  describe('getSecrets', () => {
    it('should auto-initialize with environment provider', () => {
      const manager = getSecrets();
      expect(manager.getProviderName()).toBe('environment');
      expect(isSecretsInitialized()).toBe(true);
    });

    it('should return same instance', () => {
      const manager1 = getSecrets();
      const manager2 = getSecrets();
      expect(manager1).toBe(manager2);
    });
  });

  describe('resetSecrets', () => {
    it('should reset singleton', () => {
      initSecrets();
      resetSecrets();
      expect(isSecretsInitialized()).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Convenience Functions', () => {
  beforeEach(() => {
    resetSecrets();
    initSecrets({
      provider: new MockSecretProvider({
        openaiApiKey: 'convenience-test-key',
      }),
    });
  });

  afterEach(() => {
    resetSecrets();
  });

  describe('getSecretValue', () => {
    it('should return secret value', async () => {
      const value = await getSecretValue('openaiApiKey');
      expect(value).toBe('convenience-test-key');
    });
  });

  describe('requireSecretValue', () => {
    it('should return secret value', async () => {
      const value = await requireSecretValue('openaiApiKey');
      expect(value).toBe('convenience-test-key');
    });

    it('should throw for missing secret', async () => {
      await expect(requireSecretValue('geminiApiKey')).rejects.toThrow();
    });
  });

  describe('hasSecretValue', () => {
    it('should return true for existing', async () => {
      expect(await hasSecretValue('openaiApiKey')).toBe(true);
    });

    it('should return false for missing', async () => {
      expect(await hasSecretValue('geminiApiKey')).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ENCRYPTION KEY HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Encryption Key Helpers', () => {
  const testKey = Buffer.from('test-encryption-key-32bytes!!!!').toString('base64');
  const testPrevKey = Buffer.from('prev-encryption-key-32bytes!!!!').toString('base64');

  beforeEach(() => {
    resetSecrets();
    initSecrets({
      provider: new MockSecretProvider({
        encryptionKey: testKey,
        encryptionKeyPrevious: testPrevKey,
      }),
    });
  });

  afterEach(() => {
    resetSecrets();
  });

  describe('getEncryptionKey', () => {
    it('should return encryption key', async () => {
      const key = await getEncryptionKey('key-1');
      expect(key).not.toBeNull();
      expect(key?.id).toBe('key-1');
      expect(key?.algorithm).toBe('aes-256-gcm');
      expect(key?.key).toBeInstanceOf(Buffer);
    });

    it('should return null when no key configured', async () => {
      resetSecrets();
      initSecrets({ provider: new MockSecretProvider() });
      const key = await getEncryptionKey('key-1');
      expect(key).toBeNull();
    });
  });

  describe('getEncryptionKeys', () => {
    it('should return current and previous keys', async () => {
      const keys = await getEncryptionKeys('key-1');
      expect(keys.length).toBe(2);
      expect(keys[0]?.id).toBe('key-1');
      expect(keys[1]?.id).toBe('key-1-previous');
    });

    it('should return only current key if no previous', async () => {
      resetSecrets();
      initSecrets({
        provider: new MockSecretProvider({ encryptionKey: testKey }),
      });
      const keys = await getEncryptionKeys('key-1');
      expect(keys.length).toBe(1);
    });
  });
});
