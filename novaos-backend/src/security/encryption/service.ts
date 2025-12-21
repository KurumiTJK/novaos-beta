// ═══════════════════════════════════════════════════════════════════════════════
// ENCRYPTION SERVICE — AES-256-GCM Encryption at Rest
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import { getLogger } from '../../logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'encryption' });

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Algorithm used for encryption.
 */
const ALGORITHM = 'aes-256-gcm';

/**
 * Key length in bytes (256 bits).
 */
const KEY_LENGTH = 32;

/**
 * IV (nonce) length in bytes (96 bits, recommended for GCM).
 */
const IV_LENGTH = 12;

/**
 * Auth tag length in bytes (128 bits).
 */
const AUTH_TAG_LENGTH = 16;

/**
 * Salt length for key derivation.
 */
const SALT_LENGTH = 16;

/**
 * PBKDF2 iterations for key derivation.
 */
const PBKDF2_ITERATIONS = 100000;

/**
 * Current envelope version.
 */
const ENVELOPE_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Encryption key with metadata.
 */
export interface EncryptionKey {
  readonly id: string;
  readonly key: Buffer;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly version: number;
}

/**
 * Encrypted envelope format.
 */
export interface EncryptedEnvelope {
  /** Envelope version for format evolution */
  readonly v: number;
  /** Key ID used for encryption */
  readonly kid: string;
  /** Key version */
  readonly kv: number;
  /** Base64-encoded IV */
  readonly iv: string;
  /** Base64-encoded ciphertext */
  readonly ct: string;
  /** Base64-encoded auth tag */
  readonly tag: string;
  /** Optional associated data hash */
  readonly aad?: string;
}

/**
 * Serialized envelope (for storage).
 */
export type SerializedEnvelope = string;

/**
 * Key derivation options.
 */
export interface KeyDerivationOptions {
  readonly salt?: Buffer;
  readonly iterations?: number;
  readonly keyLength?: number;
}

/**
 * Encryption options.
 */
export interface EncryptionOptions {
  /** Associated authenticated data (not encrypted, but authenticated) */
  readonly aad?: string | Buffer;
  /** Custom IV (normally auto-generated) */
  readonly iv?: Buffer;
}

/**
 * Decryption options.
 */
export interface DecryptionOptions {
  /** Associated authenticated data (must match encryption) */
  readonly aad?: string | Buffer;
}

// ─────────────────────────────────────────────────────────────────────────────────
// KEY MANAGER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Key manager for encryption keys.
 */
export class KeyManager {
  private readonly keys: Map<string, EncryptionKey> = new Map();
  private primaryKeyId: string | null = null;

  /**
   * Generate a new random encryption key.
   */
  generateKey(id?: string, expiresInMs?: number): EncryptionKey {
    const keyId = id ?? crypto.randomUUID();
    const now = new Date();
    
    const key: EncryptionKey = {
      id: keyId,
      key: crypto.randomBytes(KEY_LENGTH),
      createdAt: now,
      expiresAt: expiresInMs ? new Date(now.getTime() + expiresInMs) : undefined,
      version: 1,
    };

    this.keys.set(keyId, key);
    
    // Set as primary if first key
    if (!this.primaryKeyId) {
      this.primaryKeyId = keyId;
    }

    logger.info('Generated new encryption key', { keyId, hasExpiry: !!expiresInMs });
    return key;
  }

  /**
   * Derive a key from a password/passphrase.
   */
  deriveKey(
    passphrase: string,
    id?: string,
    options: KeyDerivationOptions = {}
  ): { key: EncryptionKey; salt: Buffer } {
    const {
      salt = crypto.randomBytes(SALT_LENGTH),
      iterations = PBKDF2_ITERATIONS,
      keyLength = KEY_LENGTH,
    } = options;

    const derivedKey = crypto.pbkdf2Sync(
      passphrase,
      salt,
      iterations,
      keyLength,
      'sha256'
    );

    const keyId = id ?? crypto.randomUUID();
    const key: EncryptionKey = {
      id: keyId,
      key: derivedKey,
      createdAt: new Date(),
      version: 1,
    };

    this.keys.set(keyId, key);

    logger.info('Derived encryption key from passphrase', { keyId });
    return { key, salt };
  }

  /**
   * Import an existing key.
   */
  importKey(
    keyBytes: Buffer | string,
    id?: string,
    version: number = 1
  ): EncryptionKey {
    const keyBuffer = typeof keyBytes === 'string' 
      ? Buffer.from(keyBytes, 'base64')
      : keyBytes;

    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${keyBuffer.length}`);
    }

    const keyId = id ?? crypto.randomUUID();
    const key: EncryptionKey = {
      id: keyId,
      key: keyBuffer,
      createdAt: new Date(),
      version,
    };

    this.keys.set(keyId, key);
    
    logger.info('Imported encryption key', { keyId, version });
    return key;
  }

  /**
   * Get a key by ID.
   */
  getKey(id: string): EncryptionKey | undefined {
    const key = this.keys.get(id);
    
    // Check expiry
    if (key?.expiresAt && key.expiresAt < new Date()) {
      logger.warn('Attempted to use expired key', { keyId: id });
      return undefined;
    }

    return key;
  }

  /**
   * Get the primary (current) key for encryption.
   */
  getPrimaryKey(): EncryptionKey | undefined {
    if (!this.primaryKeyId) return undefined;
    return this.getKey(this.primaryKeyId);
  }

  /**
   * Set the primary key ID.
   */
  setPrimaryKey(id: string): void {
    if (!this.keys.has(id)) {
      throw new Error(`Key not found: ${id}`);
    }
    this.primaryKeyId = id;
    logger.info('Set primary encryption key', { keyId: id });
  }

  /**
   * Rotate to a new primary key.
   */
  rotateKey(expiresInMs?: number): EncryptionKey {
    const newKey = this.generateKey(undefined, expiresInMs);
    this.primaryKeyId = newKey.id;
    logger.info('Rotated to new primary key', { keyId: newKey.id });
    return newKey;
  }

  /**
   * Remove a key (for cleanup after rotation).
   */
  removeKey(id: string): boolean {
    if (id === this.primaryKeyId) {
      throw new Error('Cannot remove primary key');
    }
    const removed = this.keys.delete(id);
    if (removed) {
      logger.info('Removed encryption key', { keyId: id });
    }
    return removed;
  }

  /**
   * List all key IDs.
   */
  listKeyIds(): string[] {
    return Array.from(this.keys.keys());
  }

  /**
   * Clear all keys (for testing).
   * @internal
   */
  clear(): void {
    this.keys.clear();
    this.primaryKeyId = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENCRYPTION SERVICE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Encryption service for data at rest.
 */
export class EncryptionService {
  private readonly keyManager: KeyManager;

  constructor(keyManager?: KeyManager) {
    this.keyManager = keyManager ?? new KeyManager();
  }

  /**
   * Get the key manager.
   */
  getKeyManager(): KeyManager {
    return this.keyManager;
  }

  /**
   * Encrypt data using the primary key.
   */
  encrypt(
    plaintext: string | Buffer,
    options: EncryptionOptions = {}
  ): EncryptedEnvelope {
    const key = this.keyManager.getPrimaryKey();
    if (!key) {
      throw new Error('No primary encryption key available');
    }

    return this.encryptWithKey(plaintext, key, options);
  }

  /**
   * Encrypt data using a specific key.
   */
  encryptWithKey(
    plaintext: string | Buffer,
    key: EncryptionKey,
    options: EncryptionOptions = {}
  ): EncryptedEnvelope {
    const iv = options.iv ?? crypto.randomBytes(IV_LENGTH);
    const plaintextBuffer = typeof plaintext === 'string' 
      ? Buffer.from(plaintext, 'utf8')
      : plaintext;

    const cipher = crypto.createCipheriv(ALGORITHM, key.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Add AAD if provided
    if (options.aad) {
      const aadBuffer = typeof options.aad === 'string'
        ? Buffer.from(options.aad, 'utf8')
        : options.aad;
      cipher.setAAD(aadBuffer);
    }

    const ciphertext = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      v: ENVELOPE_VERSION,
      kid: key.id,
      kv: key.version,
      iv: iv.toString('base64'),
      ct: ciphertext.toString('base64'),
      tag: authTag.toString('base64'),
      aad: options.aad 
        ? crypto.createHash('sha256')
            .update(typeof options.aad === 'string' ? options.aad : options.aad)
            .digest('base64')
        : undefined,
    };
  }

  /**
   * Decrypt an envelope.
   */
  decrypt(
    envelope: EncryptedEnvelope,
    options: DecryptionOptions = {}
  ): Buffer {
    const key = this.keyManager.getKey(envelope.kid);
    if (!key) {
      throw new Error(`Encryption key not found: ${envelope.kid}`);
    }

    if (key.version !== envelope.kv) {
      logger.warn('Key version mismatch', { 
        keyId: envelope.kid, 
        expected: envelope.kv, 
        actual: key.version 
      });
    }

    return this.decryptWithKey(envelope, key, options);
  }

  /**
   * Decrypt with a specific key.
   */
  decryptWithKey(
    envelope: EncryptedEnvelope,
    key: EncryptionKey,
    options: DecryptionOptions = {}
  ): Buffer {
    const iv = Buffer.from(envelope.iv, 'base64');
    const ciphertext = Buffer.from(envelope.ct, 'base64');
    const authTag = Buffer.from(envelope.tag, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    decipher.setAuthTag(authTag);

    // Verify and set AAD if present
    if (options.aad) {
      const aadBuffer = typeof options.aad === 'string'
        ? Buffer.from(options.aad, 'utf8')
        : options.aad;
      
      // Verify AAD hash matches
      if (envelope.aad) {
        const expectedHash = crypto.createHash('sha256')
          .update(aadBuffer)
          .digest('base64');
        if (expectedHash !== envelope.aad) {
          throw new Error('AAD mismatch');
        }
      }
      
      decipher.setAAD(aadBuffer);
    } else if (envelope.aad) {
      throw new Error('Envelope requires AAD for decryption');
    }

    try {
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('auth')) {
        throw new Error('Decryption failed: authentication tag mismatch');
      }
      throw error;
    }
  }

  /**
   * Decrypt to string (UTF-8).
   */
  decryptToString(
    envelope: EncryptedEnvelope,
    options: DecryptionOptions = {}
  ): string {
    return this.decrypt(envelope, options).toString('utf8');
  }

  /**
   * Serialize envelope to string for storage.
   */
  serialize(envelope: EncryptedEnvelope): SerializedEnvelope {
    return JSON.stringify(envelope);
  }

  /**
   * Deserialize envelope from string.
   */
  deserialize(serialized: SerializedEnvelope): EncryptedEnvelope {
    const parsed = JSON.parse(serialized);
    
    // Validate envelope structure
    if (typeof parsed.v !== 'number' ||
        typeof parsed.kid !== 'string' ||
        typeof parsed.kv !== 'number' ||
        typeof parsed.iv !== 'string' ||
        typeof parsed.ct !== 'string' ||
        typeof parsed.tag !== 'string') {
      throw new Error('Invalid envelope format');
    }

    return parsed as EncryptedEnvelope;
  }

  /**
   * Encrypt and serialize in one step.
   */
  encryptToString(
    plaintext: string | Buffer,
    options: EncryptionOptions = {}
  ): SerializedEnvelope {
    const envelope = this.encrypt(plaintext, options);
    return this.serialize(envelope);
  }

  /**
   * Deserialize and decrypt in one step.
   */
  decryptFromString(
    serialized: SerializedEnvelope,
    options: DecryptionOptions = {}
  ): string {
    const envelope = this.deserialize(serialized);
    return this.decryptToString(envelope, options);
  }

  /**
   * Re-encrypt data with a new key (for key rotation).
   */
  reencrypt(
    envelope: EncryptedEnvelope,
    newKey?: EncryptionKey,
    options: DecryptionOptions & EncryptionOptions = {}
  ): EncryptedEnvelope {
    // Decrypt with old key
    const plaintext = this.decrypt(envelope, options);
    
    // Encrypt with new key (or primary)
    if (newKey) {
      return this.encryptWithKey(plaintext, newKey, options);
    } else {
      return this.encrypt(plaintext, options);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Get the encryption service singleton.
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
    
    // Initialize with key from environment if available
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey) {
      encryptionServiceInstance.getKeyManager().importKey(envKey, 'primary');
      encryptionServiceInstance.getKeyManager().setPrimaryKey('primary');
    }
  }
  return encryptionServiceInstance;
}

/**
 * Initialize encryption service with a key manager.
 */
export function initEncryptionService(keyManager: KeyManager): EncryptionService {
  encryptionServiceInstance = new EncryptionService(keyManager);
  return encryptionServiceInstance;
}

/**
 * Reset encryption service (for testing).
 * @internal
 */
export function resetEncryptionService(): void {
  encryptionServiceInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Encrypt a string.
 */
export function encrypt(plaintext: string, aad?: string): SerializedEnvelope {
  return getEncryptionService().encryptToString(plaintext, { aad });
}

/**
 * Decrypt a string.
 */
export function decrypt(serialized: SerializedEnvelope, aad?: string): string {
  return getEncryptionService().decryptFromString(serialized, { aad });
}

/**
 * Generate a random encryption key (for configuration).
 */
export function generateKeyBase64(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Hash sensitive data for logging/comparison.
 */
export function hashForLogging(data: string): string {
  return crypto.createHash('sha256')
    .update(data)
    .digest('hex')
    .substring(0, 16);
}
