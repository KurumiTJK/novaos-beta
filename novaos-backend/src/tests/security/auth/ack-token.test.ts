// ═══════════════════════════════════════════════════════════════════════════════
// ACK TOKEN TESTS — Acknowledgment Token Generation and Validation
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AckTokenStore,
  InMemoryNonceStore,
  RedisNonceStore,
  initAckTokenStore,
  getAckTokenStore,
  generateAckToken,
  validateAckToken,
  verifyAckToken,
  type AckTokenPayload,
  type AckTokenValidation,
  type NonceStore,
} from '../../../security/auth/ack-token.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  initAckTokenStore({
    secret: 'test-ack-token-secret',
    ttlSeconds: 300,
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// InMemoryNonceStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('InMemoryNonceStore', () => {
  let store: InMemoryNonceStore;

  beforeEach(() => {
    store = new InMemoryNonceStore();
  });

  describe('checkAndMark()', () => {
    it('should return true for new nonce', async () => {
      const result = await store.checkAndMark('nonce-123', 300);
      
      expect(result).toBe(true);
    });

    it('should return false for used nonce', async () => {
      await store.checkAndMark('nonce-123', 300);
      const result = await store.checkAndMark('nonce-123', 300);
      
      expect(result).toBe(false);
    });

    it('should allow reuse after expiry', async () => {
      await store.checkAndMark('nonce-123', 0); // Immediate expiry
      
      // Wait a bit for expiry
      await new Promise(r => setTimeout(r, 50));
      
      const result = await store.checkAndMark('nonce-123', 300);
      expect(result).toBe(true);
    });
  });

  describe('isUsed()', () => {
    it('should return false for unused nonce', async () => {
      const result = await store.isUsed('unused-nonce');
      
      expect(result).toBe(false);
    });

    it('should return true for used nonce', async () => {
      await store.checkAndMark('used-nonce', 300);
      const result = await store.isUsed('used-nonce');
      
      expect(result).toBe(true);
    });

    it('should return false for expired nonce', async () => {
      await store.checkAndMark('expired-nonce', 0);
      
      await new Promise(r => setTimeout(r, 50));
      
      const result = await store.isUsed('expired-nonce');
      expect(result).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// RedisNonceStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RedisNonceStore', () => {
  let store: RedisNonceStore;
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    setex: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      set: vi.fn(),
    };
    store = new RedisNonceStore(mockRedis);
  });

  describe('checkAndMark()', () => {
    it('should return true when SET NX succeeds', async () => {
      mockRedis.set.mockResolvedValue('OK');
      
      const result = await store.checkAndMark('nonce-123', 300);
      
      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'nonce:nonce-123',
        '1',
        'NX',
        'EX',
        300
      );
    });

    it('should return false when SET NX fails (key exists)', async () => {
      mockRedis.set.mockResolvedValue(null);
      
      const result = await store.checkAndMark('nonce-123', 300);
      
      expect(result).toBe(false);
    });
  });

  describe('isUsed()', () => {
    it('should return false when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const result = await store.isUsed('nonce-123');
      
      expect(result).toBe(false);
    });

    it('should return true when key exists', async () => {
      mockRedis.get.mockResolvedValue('1');
      
      const result = await store.isUsed('nonce-123');
      
      expect(result).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// AckTokenStore TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AckTokenStore', () => {
  let tokenStore: AckTokenStore;

  beforeEach(() => {
    tokenStore = new AckTokenStore({
      secret: 'test-secret',
      ttlSeconds: 300,
    });
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const store = new AckTokenStore();
      expect(store).toBeDefined();
    });

    it('should accept custom options', () => {
      const store = new AckTokenStore({
        secret: 'custom-secret',
        ttlSeconds: 600,
      });
      expect(store).toBeDefined();
    });

    it('should use custom nonce store', () => {
      const customNonceStore = new InMemoryNonceStore();
      const store = new AckTokenStore({
        nonceStore: customNonceStore,
      });
      expect(store).toBeDefined();
    });
  });

  describe('generate()', () => {
    it('should generate a token string', () => {
      const token = tokenStore.generate('user-123', 'acknowledge_veto');
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens each time', () => {
      const token1 = tokenStore.generate('user-123', 'action1');
      const token2 = tokenStore.generate('user-123', 'action1');
      
      expect(token1).not.toBe(token2);
    });

    it('should include optional conversationId', () => {
      const token = tokenStore.generate('user-123', 'action', {
        conversationId: 'conv-456',
      });
      
      const validation = tokenStore.validate(token);
      if (validation.valid && validation.payload) {
        expect(validation.payload.conversationId).toBe('conv-456');
      }
    });

    it('should include optional metadata', () => {
      const token = tokenStore.generate('user-123', 'action', {
        metadata: { custom: 'data' },
      });
      
      const validation = tokenStore.validate(token);
      if (validation.valid && validation.payload) {
        expect(validation.payload.metadata?.custom).toBe('data');
      }
    });

    it('should use custom TTL', async () => {
      const shortLivedStore = new AckTokenStore({
        secret: 'test',
        ttlSeconds: 1,
      });
      
      const token = shortLivedStore.generate('user-123', 'action', {
        ttlSeconds: 1,
      });
      
      const validationBefore = shortLivedStore.validate(token);
      expect(validationBefore.valid).toBe(true);
      
      // Wait for expiry
      await new Promise(r => setTimeout(r, 1100));
      
      const validationAfter = shortLivedStore.validate(token);
      expect(validationAfter.valid).toBe(false);
    });
  });

  describe('validateAndConsume()', () => {
    it('should validate and consume valid token', async () => {
      const token = tokenStore.generate('user-123', 'acknowledge');
      const result = await tokenStore.validateAndConsume(token, 'user-123');
      
      expect(result.valid).toBe(true);
      expect(result.payload?.userId).toBe('user-123');
      expect(result.payload?.action).toBe('acknowledge');
    });

    it('should reject already consumed token', async () => {
      const token = tokenStore.generate('user-123', 'acknowledge');
      
      // First use
      const first = await tokenStore.validateAndConsume(token, 'user-123');
      expect(first.valid).toBe(true);
      
      // Second use should fail
      const second = await tokenStore.validateAndConsume(token, 'user-123');
      expect(second.valid).toBe(false);
      expect(second.error).toBe('Token already used');
    });

    it('should reject token for wrong user', async () => {
      const token = tokenStore.generate('user-123', 'acknowledge');
      const result = await tokenStore.validateAndConsume(token, 'user-456');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token user mismatch');
    });

    it('should reject expired token', async () => {
      const shortStore = new AckTokenStore({
        secret: 'test',
        ttlSeconds: 1,
      });
      
      const token = shortStore.generate('user-123', 'acknowledge');
      
      await new Promise(r => setTimeout(r, 1100));
      
      const result = await shortStore.validateAndConsume(token, 'user-123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should reject invalid token format', async () => {
      const result = await tokenStore.validateAndConsume('invalid-token', 'user-123');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject tampered token', async () => {
      const token = tokenStore.generate('user-123', 'acknowledge');
      const tampered = token.slice(0, -5) + 'xxxxx';
      
      const result = await tokenStore.validateAndConsume(tampered, 'user-123');
      
      expect(result.valid).toBe(false);
    });

    it('should include payload fields', async () => {
      const token = tokenStore.generate('user-123', 'veto_acknowledge', {
        conversationId: 'conv-789',
        metadata: { reason: 'test' },
      });
      
      const result = await tokenStore.validateAndConsume(token, 'user-123');
      
      if (result.valid && result.payload) {
        expect(result.payload.userId).toBe('user-123');
        expect(result.payload.action).toBe('veto_acknowledge');
        expect(result.payload.conversationId).toBe('conv-789');
        expect(result.payload.metadata?.reason).toBe('test');
        expect(result.payload.createdAt).toBeDefined();
        expect(result.payload.expiresAt).toBeDefined();
      }
    });
  });

  describe('validate()', () => {
    it('should validate without consuming', () => {
      const token = tokenStore.generate('user-123', 'action');
      
      const result1 = tokenStore.validate(token);
      const result2 = tokenStore.validate(token);
      
      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const token = tokenStore.generate('user-123', 'action');
      const tampered = token.slice(0, -10) + 'xxxxxxxxxx';
      
      const result = tokenStore.validate(tampered);
      
      expect(result.valid).toBe(false);
    });

    it('should reject expired token', async () => {
      const shortStore = new AckTokenStore({
        secret: 'test',
        ttlSeconds: 1,
      });
      
      const token = shortStore.generate('user-123', 'action');
      
      await new Promise(r => setTimeout(r, 1100));
      
      const result = shortStore.validate(token);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should return payload on success', () => {
      const token = tokenStore.generate('user-123', 'my_action', {
        conversationId: 'conv-123',
      });
      
      const result = tokenStore.validate(token);
      
      if (result.valid && result.payload) {
        expect(result.payload.userId).toBe('user-123');
        expect(result.payload.action).toBe('my_action');
        expect(result.payload.conversationId).toBe('conv-123');
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Singleton Functions', () => {
  describe('initAckTokenStore()', () => {
    it('should initialize and return store', () => {
      const store = initAckTokenStore({
        secret: 'test-secret',
      });
      
      expect(store).toBeInstanceOf(AckTokenStore);
    });
  });

  describe('getAckTokenStore()', () => {
    it('should return initialized store', () => {
      initAckTokenStore();
      const store = getAckTokenStore();
      
      expect(store).toBeInstanceOf(AckTokenStore);
    });

    it('should create store if not initialized', () => {
      const store = getAckTokenStore();
      expect(store).toBeInstanceOf(AckTokenStore);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Convenience Functions', () => {
  beforeEach(() => {
    initAckTokenStore({
      secret: 'test-secret',
      ttlSeconds: 300,
    });
  });

  describe('generateAckToken()', () => {
    it('should generate token using singleton', () => {
      const token = generateAckToken('user-123', 'acknowledge');
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should accept options', () => {
      const token = generateAckToken('user-123', 'acknowledge', {
        conversationId: 'conv-123',
        metadata: { key: 'value' },
      });
      
      expect(typeof token).toBe('string');
    });
  });

  describe('validateAckToken()', () => {
    it('should validate token using singleton', async () => {
      const token = generateAckToken('user-123', 'acknowledge');
      const result = await validateAckToken(token, 'user-123');
      
      expect(result.valid).toBe(true);
    });

    it('should be one-time use', async () => {
      const token = generateAckToken('user-123', 'acknowledge');
      
      const first = await validateAckToken(token, 'user-123');
      expect(first.valid).toBe(true);
      
      const second = await validateAckToken(token, 'user-123');
      expect(second.valid).toBe(false);
    });
  });

  describe('verifyAckToken()', () => {
    it('should be an alias for validateAckToken', async () => {
      const token = generateAckToken('user-123', 'action');
      const result = await verifyAckToken(token, 'user-123');
      
      expect(result.valid).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('AckTokenPayload', () => {
    it('should accept valid payload', () => {
      const payload: AckTokenPayload = {
        userId: 'user-123',
        action: 'acknowledge_veto',
        conversationId: 'conv-456',
        metadata: { severity: 'high' },
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };
      
      expect(payload.userId).toBe('user-123');
    });
  });

  describe('AckTokenValidation', () => {
    it('should accept valid result', () => {
      const result: AckTokenValidation = {
        valid: true,
        payload: {
          userId: 'user-123',
          action: 'action',
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
      };
      
      expect(result.valid).toBe(true);
    });

    it('should accept invalid result', () => {
      const result: AckTokenValidation = {
        valid: false,
        error: 'Token expired',
      };
      
      expect(result.valid).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Integration', () => {
  it('should handle complete veto acknowledgment flow', async () => {
    // Generate token for veto acknowledgment
    const token = generateAckToken('user-123', 'veto_acknowledge', {
      conversationId: 'conv-789',
      metadata: {
        vetoReason: 'policy_violation',
        messageId: 'msg-456',
      },
    });
    
    // Validate token (user clicks acknowledge)
    const result = await validateAckToken(token, 'user-123');
    
    expect(result.valid).toBe(true);
    if (result.payload) {
      expect(result.payload.action).toBe('veto_acknowledge');
      expect(result.payload.conversationId).toBe('conv-789');
      expect(result.payload.metadata?.vetoReason).toBe('policy_violation');
    }
    
    // Token cannot be reused
    const replay = await validateAckToken(token, 'user-123');
    expect(replay.valid).toBe(false);
  });
});
