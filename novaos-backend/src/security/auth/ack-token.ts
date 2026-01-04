// ═══════════════════════════════════════════════════════════════════════════════
// ACK TOKEN — Acknowledgment Token Generation and Validation
// Prevents replay attacks with one-time-use tokens
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface AckTokenPayload {
  userId: string;
  action: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

export interface AckTokenValidation {
  valid: boolean;
  payload?: AckTokenPayload;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NONCE STORE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Abstract interface for nonce storage.
 * Implementations must be atomic to prevent race conditions.
 */
export interface NonceStore {
  /**
   * Check if a nonce exists and mark it as used atomically.
   * Returns true if nonce was valid (not used before).
   * Returns false if nonce was already used or invalid.
   */
  checkAndMark(nonce: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Check if a nonce has been used (without marking).
   */
  isUsed(nonce: string): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// IN-MEMORY NONCE STORE (Development Only)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * In-memory nonce store for development/testing.
 * NOT SUITABLE FOR PRODUCTION - use Redis implementation instead.
 */
export class InMemoryNonceStore implements NonceStore {
  private usedNonces = new Map<string, number>(); // nonce -> expireAt timestamp

  constructor() {
    // Cleanup expired nonces every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async checkAndMark(nonce: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.usedNonces.get(nonce);

    // If nonce exists and hasn't expired, it's been used
    if (existing && existing > now) {
      return false;
    }

    // Mark as used
    this.usedNonces.set(nonce, now + ttlSeconds * 1000);
    return true;
  }

  async isUsed(nonce: string): Promise<boolean> {
    const expireAt = this.usedNonces.get(nonce);
    if (!expireAt) return false;
    return expireAt > Date.now();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [nonce, expireAt] of this.usedNonces.entries()) {
      if (expireAt < now) {
        this.usedNonces.delete(nonce);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// REDIS NONCE STORE (Production)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Redis-based nonce store for production.
 * Uses SET NX for atomic check-and-set.
 */
export class RedisNonceStore implements NonceStore {
  private prefix = 'nonce:';

  constructor(
    private redis: {
      get(key: string): Promise<string | null>;
      setex(key: string, ttl: number, value: string): Promise<void>;
      set(key: string, value: string, nx?: 'NX', ex?: 'EX', ttl?: number): Promise<'OK' | null>;
    }
  ) {}

  async checkAndMark(nonce: string, ttlSeconds: number): Promise<boolean> {
    const key = `${this.prefix}${nonce}`;
    
    // SET NX returns null if key already exists
    const result = await this.redis.set(key, '1', 'NX', 'EX', ttlSeconds);
    return result === 'OK';
  }

  async isUsed(nonce: string): Promise<boolean> {
    const key = `${this.prefix}${nonce}`;
    const value = await this.redis.get(key);
    return value !== null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACK TOKEN STORE
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

export class AckTokenStore {
  private secret: string;
  private nonceStore: NonceStore;
  private ttlSeconds: number;

  constructor(options: {
    secret?: string;
    nonceStore?: NonceStore;
    ttlSeconds?: number;
  } = {}) {
    this.secret = options.secret ?? process.env.ACK_TOKEN_SECRET ?? crypto.randomBytes(32).toString('hex');
    this.nonceStore = options.nonceStore ?? new InMemoryNonceStore();
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  /**
   * Generate a new acknowledgment token.
   */
  generate(userId: string, action: string, options: {
    conversationId?: string;
    metadata?: Record<string, unknown>;
    ttlSeconds?: number;
  } = {}): string {
    const ttl = options.ttlSeconds ?? this.ttlSeconds;
    const now = Date.now();

    const payload: AckTokenPayload = {
      userId,
      action,
      conversationId: options.conversationId,
      metadata: options.metadata,
      createdAt: now,
      expiresAt: now + ttl * 1000,
    };

    // Generate nonce
    const nonce = crypto.randomBytes(16).toString('hex');

    // Create token data
    const tokenData = JSON.stringify({ ...payload, nonce });
    const signature = this.sign(tokenData);

    // Encode as base64
    const token = Buffer.from(`${tokenData}.${signature}`).toString('base64url');

    return token;
  }

  /**
   * Validate and consume an acknowledgment token.
   * Token can only be used once.
   */
  async validateAndConsume(token: string, expectedUserId: string): Promise<AckTokenValidation> {
    try {
      // Decode token
      const decoded = Buffer.from(token, 'base64url').toString();
      const [tokenData, signature] = decoded.split('.');

      if (!tokenData || !signature) {
        return { valid: false, error: 'Invalid token format' };
      }

      // Verify signature
      const expectedSignature = this.sign(tokenData);
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return { valid: false, error: 'Invalid signature' };
      }

      // Parse payload
      const data = JSON.parse(tokenData) as AckTokenPayload & { nonce: string };

      // Check expiration
      if (Date.now() > data.expiresAt) {
        return { valid: false, error: 'Token expired' };
      }

      // Check user
      if (data.userId !== expectedUserId) {
        return { valid: false, error: 'Token user mismatch' };
      }

      // Check and mark nonce (atomic one-time use)
      const ttlRemaining = Math.ceil((data.expiresAt - Date.now()) / 1000);
      const isFirstUse = await this.nonceStore.checkAndMark(data.nonce, ttlRemaining);

      if (!isFirstUse) {
        return { valid: false, error: 'Token already used' };
      }

      // Remove nonce from payload before returning
      const { nonce: _, ...payload } = data;

      return { valid: true, payload };
    } catch (error) {
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Validate without consuming (for inspection only).
   */
  validate(token: string): AckTokenValidation {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const [tokenData, signature] = decoded.split('.');

      if (!tokenData || !signature) {
        return { valid: false, error: 'Invalid token format' };
      }

      const expectedSignature = this.sign(tokenData);
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return { valid: false, error: 'Invalid signature' };
      }

      const data = JSON.parse(tokenData) as AckTokenPayload & { nonce: string };

      if (Date.now() > data.expiresAt) {
        return { valid: false, error: 'Token expired' };
      }

      const { nonce: _, ...payload } = data;
      return { valid: true, payload };
    } catch {
      return { valid: false, error: 'Token validation failed' };
    }
  }

  private sign(data: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

let ackTokenStore: AckTokenStore | null = null;

export function initAckTokenStore(options?: {
  secret?: string;
  nonceStore?: NonceStore;
  ttlSeconds?: number;
}): AckTokenStore {
  ackTokenStore = new AckTokenStore(options);
  return ackTokenStore;
}

export function getAckTokenStore(): AckTokenStore {
  if (!ackTokenStore) {
    ackTokenStore = new AckTokenStore();
  }
  return ackTokenStore;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function generateAckToken(
  userId: string,
  action: string,
  options?: { conversationId?: string; metadata?: Record<string, unknown> }
): string {
  return getAckTokenStore().generate(userId, action, options);
}

export async function validateAckToken(
  token: string,
  expectedUserId: string
): Promise<AckTokenValidation> {
  return getAckTokenStore().validateAndConsume(token, expectedUserId);
}
