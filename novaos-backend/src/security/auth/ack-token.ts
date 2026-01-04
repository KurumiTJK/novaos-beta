// ═══════════════════════════════════════════════════════════════════════════════
// ACK TOKEN — Soft Veto Acknowledgment Tokens
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════
//
// When Shield Gate issues a soft veto, the user must acknowledge before proceeding.
// This module generates time-limited, single-use acknowledgment tokens.
//
// Flow:
// 1. Shield Gate vetoes → Response includes ackToken
// 2. User acknowledges → Sends ackToken with retry
// 3. Server validates → Token is consumed (single-use)
// 4. Request proceeds
//
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';
import type { KeyValueStore } from '../../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

const ACK_TOKEN_PREFIX = 'ack:';
const ACK_TOKEN_TTL_SECONDS = 300; // 5 minutes
const ACK_TOKEN_SECRET = process.env.ACK_TOKEN_SECRET ?? 'nova-ack-secret';

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface AckTokenPayload {
  userId: string;
  conversationId?: string;
  reason: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Generate a signed acknowledgment token.
 */
export function generateAckToken(
  userId: string,
  reason: string,
  options?: {
    conversationId?: string;
    ttlSeconds?: number;
  }
): string {
  const ttl = options?.ttlSeconds ?? ACK_TOKEN_TTL_SECONDS;
  const now = Date.now();
  
  const payload: AckTokenPayload = {
    userId,
    conversationId: options?.conversationId,
    reason,
    createdAt: now,
    expiresAt: now + ttl * 1000,
  };
  
  // Create signature
  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', ACK_TOKEN_SECRET)
    .update(data)
    .digest('hex')
    .slice(0, 16);
  
  // Encode token
  const encoded = Buffer.from(data).toString('base64url');
  
  return `ack_${encoded}.${signature}`;
}

/**
 * Verify an acknowledgment token (without consuming it).
 */
export function verifyAckToken(
  token: string,
  expectedUserId: string
): { valid: true; payload: AckTokenPayload } | { valid: false; error: string } {
  try {
    // Parse token
    if (!token.startsWith('ack_')) {
      return { valid: false, error: 'Invalid token format' };
    }
    
    const [encoded, signature] = token.slice(4).split('.');
    if (!encoded || !signature) {
      return { valid: false, error: 'Invalid token format' };
    }
    
    // Decode payload
    const data = Buffer.from(encoded, 'base64url').toString('utf-8');
    const payload: AckTokenPayload = JSON.parse(data);
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', ACK_TOKEN_SECRET)
      .update(data)
      .digest('hex')
      .slice(0, 16);
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    // Check expiration
    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'Token expired' };
    }
    
    // Check user
    if (payload.userId !== expectedUserId) {
      return { valid: false, error: 'Token not for this user' };
    }
    
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Invalid token' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// NONCE STORE — Single-Use Token Tracking
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Store for tracking used tokens (nonces).
 * Ensures tokens can only be used once.
 */
export class AckTokenStore {
  constructor(private store: KeyValueStore) {}
  
  private getKey(token: string): string {
    // Hash the token for storage key
    const hash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
    return `${ACK_TOKEN_PREFIX}${hash}`;
  }
  
  /**
   * Validate and consume an ack token.
   * Returns true if valid and not yet used, false otherwise.
   * This is atomic - token is consumed on successful validation.
   */
  async validateAndConsume(
    token: string,
    userId: string
  ): Promise<{ valid: true; payload: AckTokenPayload } | { valid: false; error: string }> {
    // First verify the token itself
    const verification = verifyAckToken(token, userId);
    if (!verification.valid) {
      return verification;
    }
    
    // Check if already used (atomically mark as used)
    const key = this.getKey(token);
    const exists = await this.store.exists(key);
    
    if (exists) {
      return { valid: false, error: 'Token already used' };
    }
    
    // Mark as used
    await this.store.set(
      key,
      JSON.stringify({ usedAt: Date.now(), userId }),
      ACK_TOKEN_TTL_SECONDS
    );
    
    return verification;
  }
  
  /**
   * Check if a token has been used (without consuming).
   */
  async isUsed(token: string): Promise<boolean> {
    const key = this.getKey(token);
    return this.store.exists(key);
  }
  
  /**
   * Manually invalidate a token.
   */
  async invalidate(token: string): Promise<void> {
    const key = this.getKey(token);
    await this.store.set(
      key,
      JSON.stringify({ invalidatedAt: Date.now() }),
      ACK_TOKEN_TTL_SECONDS
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let ackTokenStore: AckTokenStore | null = null;

export function initAckTokenStore(store: KeyValueStore): AckTokenStore {
  ackTokenStore = new AckTokenStore(store);
  return ackTokenStore;
}

export function getAckTokenStore(): AckTokenStore {
  if (!ackTokenStore) {
    throw new Error('AckTokenStore not initialized. Call initAckTokenStore() first.');
  }
  return ackTokenStore;
}
