// ═══════════════════════════════════════════════════════════════════════════════
// BRUTE FORCE PROTECTION — Rate limiting for authentication attempts
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface BruteForceConfig {
  /** Maximum failed attempts before lockout */
  maxAttempts: number;
  /** Lockout duration in seconds */
  lockoutDurationSeconds: number;
  /** Window for counting attempts in seconds */
  windowSeconds: number;
}

const DEFAULT_CONFIG: BruteForceConfig = {
  maxAttempts: 5,
  lockoutDurationSeconds: 15 * 60, // 15 minutes
  windowSeconds: 15 * 60, // 15 minutes
};

let config: BruteForceConfig = { ...DEFAULT_CONFIG };
let store: KeyValueStore | null = null;

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the brute force protection store.
 * Must be called before using any brute force functions.
 */
export function initBruteForceStore(
  kvStore: KeyValueStore,
  customConfig?: Partial<BruteForceConfig>
): void {
  store = kvStore;
  if (customConfig) {
    config = { ...DEFAULT_CONFIG, ...customConfig };
  }
  console.log('[SECURITY] Brute force protection initialized', {
    maxAttempts: config.maxAttempts,
    lockoutDuration: `${config.lockoutDurationSeconds}s`,
    window: `${config.windowSeconds}s`,
  });
}

/**
 * Get the current brute force configuration.
 */
export function getBruteForceConfig(): BruteForceConfig {
  return { ...config };
}

// ─────────────────────────────────────────────────────────────────────────────────
// KEY GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

function getKey(ip: string, identifier: string): string {
  // Normalize IP and identifier to prevent bypass attempts
  const normalizedIp = ip.replace(/[^a-zA-Z0-9.:]/g, '');
  const normalizedId = identifier.toLowerCase().trim();
  return `bruteforce:${normalizedIp}:${normalizedId}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface BruteForceStatus {
  /** Whether the IP/identifier is currently locked out */
  locked: boolean;
  /** Number of failed attempts */
  attempts?: number;
  /** When the lockout ends (if locked) */
  lockoutEndsAt?: Date;
  /** Remaining attempts before lockout */
  remainingAttempts?: number;
}

interface StoredBruteForceData {
  attempts: number;
  lockedUntil: number | null;
  firstAttemptAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CORE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if an IP/identifier combination is currently locked out.
 * 
 * @param ip - The IP address
 * @param identifier - The identifier (usually email or username)
 * @returns The current brute force status
 * 
 * @example
 * const status = await checkBruteForce(req.ip, email);
 * if (status.locked) {
 *   return res.status(423).json({
 *     error: 'Account locked',
 *     retryAfter: status.lockoutEndsAt
 *   });
 * }
 */
export async function checkBruteForce(
  ip: string,
  identifier: string
): Promise<BruteForceStatus> {
  if (!store) {
    console.warn('[BRUTE_FORCE] Store not initialized');
    return { locked: false };
  }

  const key = getKey(ip, identifier);
  const data = await store.get(key);

  if (!data) {
    return { 
      locked: false, 
      attempts: 0,
      remainingAttempts: config.maxAttempts,
    };
  }

  const parsed: StoredBruteForceData = JSON.parse(data);

  // Check if currently locked
  if (parsed.lockedUntil && Date.now() < parsed.lockedUntil) {
    return {
      locked: true,
      attempts: parsed.attempts,
      lockoutEndsAt: new Date(parsed.lockedUntil),
      remainingAttempts: 0,
    };
  }

  // Check if lock has expired - reset if so
  if (parsed.lockedUntil && Date.now() >= parsed.lockedUntil) {
    await store.delete(key);
    return { 
      locked: false, 
      attempts: 0,
      remainingAttempts: config.maxAttempts,
    };
  }

  // Check if window has expired
  const windowExpired = Date.now() - parsed.firstAttemptAt > config.windowSeconds * 1000;
  if (windowExpired) {
    await store.delete(key);
    return { 
      locked: false, 
      attempts: 0,
      remainingAttempts: config.maxAttempts,
    };
  }

  return {
    locked: false,
    attempts: parsed.attempts,
    remainingAttempts: Math.max(0, config.maxAttempts - parsed.attempts),
  };
}

/**
 * Record a failed authentication attempt.
 * Returns the new status after recording.
 * 
 * @param ip - The IP address
 * @param identifier - The identifier (usually email or username)
 * @returns The updated brute force status
 * 
 * @example
 * // After failed login:
 * const status = await recordFailedAttempt(req.ip, email);
 * if (status.locked) {
 *   return res.status(423).json({
 *     error: 'Too many failed attempts. Account locked.',
 *     retryAfter: status.lockoutEndsAt
 *   });
 * }
 */
export async function recordFailedAttempt(
  ip: string,
  identifier: string
): Promise<BruteForceStatus> {
  if (!store) {
    console.warn('[BRUTE_FORCE] Store not initialized');
    return { locked: false };
  }

  const key = getKey(ip, identifier);
  const data = await store.get(key);
  const now = Date.now();

  let parsed: StoredBruteForceData;

  if (data) {
    parsed = JSON.parse(data);
    
    // Check if window expired - reset if so
    const windowExpired = now - parsed.firstAttemptAt > config.windowSeconds * 1000;
    if (windowExpired || (parsed.lockedUntil && now >= parsed.lockedUntil)) {
      parsed = {
        attempts: 1,
        lockedUntil: null,
        firstAttemptAt: now,
      };
    } else {
      parsed.attempts += 1;
    }
  } else {
    parsed = {
      attempts: 1,
      lockedUntil: null,
      firstAttemptAt: now,
    };
  }

  // Check if should lock
  const shouldLock = parsed.attempts >= config.maxAttempts;
  if (shouldLock) {
    parsed.lockedUntil = now + config.lockoutDurationSeconds * 1000;
  }

  // Store with TTL (lockout duration + window, whichever is longer)
  const ttl = Math.max(config.lockoutDurationSeconds, config.windowSeconds) * 2;
  await store.set(key, JSON.stringify(parsed), ttl);

  if (shouldLock) {
    console.log(`[BRUTE_FORCE] Locked out: ${identifier} from ${ip} after ${parsed.attempts} attempts`);
    return {
      locked: true,
      attempts: parsed.attempts,
      lockoutEndsAt: new Date(parsed.lockedUntil!),
      remainingAttempts: 0,
    };
  }

  return {
    locked: false,
    attempts: parsed.attempts,
    remainingAttempts: config.maxAttempts - parsed.attempts,
  };
}

/**
 * Clear failed attempts for an IP/identifier (call on successful login).
 * 
 * @param ip - The IP address
 * @param identifier - The identifier (usually email or username)
 * 
 * @example
 * // After successful login:
 * await clearFailedAttempts(req.ip, email);
 */
export async function clearFailedAttempts(
  ip: string,
  identifier: string
): Promise<void> {
  if (!store) {
    return;
  }

  const key = getKey(ip, identifier);
  await store.delete(key);
}

/**
 * Manually unlock an IP/identifier combination (admin function).
 * 
 * @param ip - The IP address
 * @param identifier - The identifier (usually email or username)
 * @returns true if an entry was deleted, false otherwise
 */
export async function forceUnlock(
  ip: string,
  identifier: string
): Promise<boolean> {
  if (!store) {
    return false;
  }

  const key = getKey(ip, identifier);
  return store.delete(key);
}

/**
 * Get remaining lockout time in seconds.
 * Returns 0 if not locked.
 */
export async function getRemainingLockoutTime(
  ip: string,
  identifier: string
): Promise<number> {
  const status = await checkBruteForce(ip, identifier);
  if (!status.locked || !status.lockoutEndsAt) {
    return 0;
  }
  return Math.max(0, Math.ceil((status.lockoutEndsAt.getTime() - Date.now()) / 1000));
}
