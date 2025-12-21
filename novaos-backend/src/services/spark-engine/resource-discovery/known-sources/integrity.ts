// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRITY — HMAC Verification for Known Sources
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides cryptographic integrity verification for:
//   - Known source entries (prevent tampering)
//   - Cached resources (detect corruption)
//   - API responses (verify authenticity)
//
// Uses HMAC-SHA256 with a secret key from environment.
//
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import type { Result } from '../../../../types/result.js';
import { ok, err } from '../../../../types/result.js';
import type { HMACSignature } from '../types.js';
import { createHMACSignature } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * HMAC algorithm.
 */
const HMAC_ALGORITHM = 'sha256';

/**
 * Signature encoding.
 */
const SIGNATURE_ENCODING = 'base64';

/**
 * Environment variable for HMAC key.
 */
const HMAC_KEY_ENV = 'NOVA_HMAC_KEY';

/**
 * Fallback key for development (NOT for production).
 */
const DEV_FALLBACK_KEY = 'nova-dev-hmac-key-not-for-production';

/**
 * Minimum key length in bytes.
 */
const MIN_KEY_LENGTH = 32;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Integrity verification error codes.
 */
export type IntegrityErrorCode =
  | 'MISSING_KEY'
  | 'WEAK_KEY'
  | 'INVALID_SIGNATURE'
  | 'SIGNATURE_MISMATCH'
  | 'COMPUTATION_ERROR';

/**
 * Integrity error.
 */
export interface IntegrityError {
  readonly code: IntegrityErrorCode;
  readonly message: string;
}

/**
 * Signed data envelope.
 */
export interface SignedEnvelope<T> {
  readonly data: T;
  readonly signature: HMACSignature;
  readonly signedAt: string; // ISO timestamp
  readonly version: number;
}

/**
 * Integrity service configuration.
 */
export interface IntegrityConfig {
  /** HMAC key (base64 encoded) */
  readonly key?: string;
  
  /** Allow fallback to dev key */
  readonly allowDevKey?: boolean;
  
  /** Key rotation: previous keys for verification */
  readonly previousKeys?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// KEY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get the HMAC key from configuration or environment.
 */
function getKey(config?: IntegrityConfig): Result<Buffer, IntegrityError> {
  // Try explicit key first
  if (config?.key) {
    try {
      const keyBuffer = Buffer.from(config.key, 'base64');
      if (keyBuffer.length < MIN_KEY_LENGTH) {
        return err({
          code: 'WEAK_KEY',
          message: `Key must be at least ${MIN_KEY_LENGTH} bytes`,
        });
      }
      return ok(keyBuffer);
    } catch {
      return err({
        code: 'INVALID_SIGNATURE',
        message: 'Invalid key encoding',
      });
    }
  }
  
  // Try environment variable
  const envKey = process.env[HMAC_KEY_ENV];
  if (envKey) {
    try {
      const keyBuffer = Buffer.from(envKey, 'base64');
      if (keyBuffer.length < MIN_KEY_LENGTH) {
        return err({
          code: 'WEAK_KEY',
          message: `Key must be at least ${MIN_KEY_LENGTH} bytes`,
        });
      }
      return ok(keyBuffer);
    } catch {
      return err({
        code: 'INVALID_SIGNATURE',
        message: 'Invalid key encoding in environment',
      });
    }
  }
  
  // Fallback to dev key if allowed
  if (config?.allowDevKey || process.env.NODE_ENV === 'development') {
    console.warn('[INTEGRITY] Using development fallback key - NOT FOR PRODUCTION');
    return ok(Buffer.from(DEV_FALLBACK_KEY, 'utf8'));
  }
  
  return err({
    code: 'MISSING_KEY',
    message: `HMAC key not configured. Set ${HMAC_KEY_ENV} environment variable.`,
  });
}

/**
 * Generate a new random HMAC key.
 */
export function generateKey(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64');
}

// ─────────────────────────────────────────────────────────────────────────────────
// SIGNATURE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Compute HMAC signature for data.
 */
export function computeSignature(
  data: string | Buffer | object,
  config?: IntegrityConfig
): Result<HMACSignature, IntegrityError> {
  const keyResult = getKey(config);
  if (!keyResult.ok) {
    return keyResult;
  }
  
  try {
    // Normalize data to string
    const dataString = typeof data === 'object' && !Buffer.isBuffer(data)
      ? JSON.stringify(data)
      : data.toString();
    
    // Compute HMAC
    const hmac = crypto.createHmac(HMAC_ALGORITHM, keyResult.value);
    hmac.update(dataString);
    const signature = hmac.digest(SIGNATURE_ENCODING);
    
    return ok(createHMACSignature(signature));
  } catch (error) {
    return err({
      code: 'COMPUTATION_ERROR',
      message: `Failed to compute signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Verify HMAC signature for data.
 */
export function verifySignature(
  data: string | Buffer | object,
  signature: HMACSignature,
  config?: IntegrityConfig
): Result<boolean, IntegrityError> {
  // Compute expected signature
  const computedResult = computeSignature(data, config);
  if (!computedResult.ok) {
    return computedResult;
  }
  
  // Constant-time comparison
  try {
    const expected = Buffer.from(computedResult.value, SIGNATURE_ENCODING);
    const actual = Buffer.from(signature, SIGNATURE_ENCODING);
    
    if (expected.length !== actual.length) {
      return ok(false);
    }
    
    const match = crypto.timingSafeEqual(expected, actual);
    return ok(match);
  } catch {
    return ok(false);
  }
}

/**
 * Verify signature, trying previous keys if current fails.
 */
export function verifySignatureWithRotation(
  data: string | Buffer | object,
  signature: HMACSignature,
  config?: IntegrityConfig
): Result<{ valid: boolean; keyIndex: number }, IntegrityError> {
  // Try current key
  const currentResult = verifySignature(data, signature, config);
  if (currentResult.ok && currentResult.value) {
    return ok({ valid: true, keyIndex: 0 });
  }
  
  // Try previous keys
  if (config?.previousKeys) {
    for (let i = 0; i < config.previousKeys.length; i++) {
      const prevConfig: IntegrityConfig = {
        ...config,
        key: config.previousKeys[i],
      };
      
      const prevResult = verifySignature(data, signature, prevConfig);
      if (prevResult.ok && prevResult.value) {
        return ok({ valid: true, keyIndex: i + 1 });
      }
    }
  }
  
  // No key matched
  return ok({ valid: false, keyIndex: -1 });
}

// ─────────────────────────────────────────────────────────────────────────────────
// SIGNED ENVELOPE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Current envelope version.
 */
const ENVELOPE_VERSION = 1;

/**
 * Sign data and wrap in envelope.
 */
export function signData<T>(
  data: T,
  config?: IntegrityConfig
): Result<SignedEnvelope<T>, IntegrityError> {
  const signedAt = new Date().toISOString();
  
  // Create signable payload (data + timestamp + version)
  const payload = {
    data,
    signedAt,
    version: ENVELOPE_VERSION,
  };
  
  const signatureResult = computeSignature(payload, config);
  if (!signatureResult.ok) {
    return signatureResult;
  }
  
  return ok({
    data,
    signature: signatureResult.value,
    signedAt,
    version: ENVELOPE_VERSION,
  });
}

/**
 * Verify signed envelope.
 */
export function verifyEnvelope<T>(
  envelope: SignedEnvelope<T>,
  config?: IntegrityConfig
): Result<T, IntegrityError> {
  // Reconstruct payload for verification
  const payload = {
    data: envelope.data,
    signedAt: envelope.signedAt,
    version: envelope.version,
  };
  
  const verifyResult = verifySignatureWithRotation(payload, envelope.signature, config);
  if (!verifyResult.ok) {
    return verifyResult;
  }
  
  if (!verifyResult.value.valid) {
    return err({
      code: 'SIGNATURE_MISMATCH',
      message: 'Envelope signature verification failed',
    });
  }
  
  return ok(envelope.data);
}

/**
 * Serialize signed envelope to string.
 */
export function serializeEnvelope<T>(envelope: SignedEnvelope<T>): string {
  return JSON.stringify(envelope);
}

/**
 * Deserialize signed envelope from string.
 */
export function deserializeEnvelope<T>(serialized: string): Result<SignedEnvelope<T>, IntegrityError> {
  try {
    const parsed = JSON.parse(serialized);
    
    // Validate structure
    if (
      typeof parsed !== 'object' ||
      !parsed.data ||
      typeof parsed.signature !== 'string' ||
      typeof parsed.signedAt !== 'string' ||
      typeof parsed.version !== 'number'
    ) {
      return err({
        code: 'INVALID_SIGNATURE',
        message: 'Invalid envelope structure',
      });
    }
    
    return ok({
      data: parsed.data as T,
      signature: createHMACSignature(parsed.signature),
      signedAt: parsed.signedAt,
      version: parsed.version,
    });
  } catch {
    return err({
      code: 'INVALID_SIGNATURE',
      message: 'Failed to parse envelope',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Quick sign: sign data and return serialized envelope.
 */
export function quickSign<T>(data: T, config?: IntegrityConfig): Result<string, IntegrityError> {
  const envelopeResult = signData(data, config);
  if (!envelopeResult.ok) {
    return envelopeResult;
  }
  
  return ok(serializeEnvelope(envelopeResult.value));
}

/**
 * Quick verify: deserialize and verify envelope.
 */
export function quickVerify<T>(serialized: string, config?: IntegrityConfig): Result<T, IntegrityError> {
  const envelopeResult = deserializeEnvelope<T>(serialized);
  if (!envelopeResult.ok) {
    return envelopeResult;
  }
  
  return verifyEnvelope(envelopeResult.value, config);
}

/**
 * Hash data for logging/comparison (not for security).
 */
export function hashForLogging(data: string | Buffer | object): string {
  const dataString = typeof data === 'object' && !Buffer.isBuffer(data)
    ? JSON.stringify(data)
    : data.toString();
  
  return crypto.createHash('sha256')
    .update(dataString)
    .digest('hex')
    .substring(0, 16);
}
