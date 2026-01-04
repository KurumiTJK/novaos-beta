// ═══════════════════════════════════════════════════════════════════════════════
// ABUSE DETECTOR — Content Analysis and User Blocking
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../storage/index.js';
import type {
  AbuseCheckResult,
  AbusePattern,
  AbuseSeverity,
  AbuseAction,
  BlockStatus,
  VetoStatus,
  AbuseConfig,
  AbuseEvent,
  AbuseEventType,
} from './types.js';
import { DEFAULT_ABUSE_CONFIG } from './types.js';
import {
  getPromptInjectionPatterns,
  getHarassmentPatterns,
  getSpamPatterns,
} from './patterns.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────────

type AbuseEventHandler = (event: AbuseEvent) => void;
const eventHandlers: AbuseEventHandler[] = [];

export function onAbuseEvent(handler: AbuseEventHandler): void {
  eventHandlers.push(handler);
}

export function clearAbuseEventHandlers(): void {
  eventHandlers.length = 0;
}

function emitEvent(
  type: AbuseEventType,
  userId: string,
  details?: Partial<AbuseEvent>
): void {
  const event: AbuseEvent = {
    type,
    userId,
    timestamp: Date.now(),
    ...details,
  };
  
  for (const handler of eventHandlers) {
    try {
      handler(event);
    } catch (error) {
      console.error('[ABUSE] Event handler error:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ABUSE DETECTOR CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class AbuseDetector {
  private readonly patterns: AbusePattern[];
  private readonly config: AbuseConfig;
  
  constructor(config?: Partial<AbuseConfig>) {
    this.config = { ...DEFAULT_ABUSE_CONFIG, ...config };
    this.patterns = this.buildPatterns();
  }
  
  private buildPatterns(): AbusePattern[] {
    const patterns: AbusePattern[] = [];
    
    if (this.config.detectPromptInjection) {
      patterns.push(...getPromptInjectionPatterns());
    }
    
    if (this.config.detectHarassment) {
      patterns.push(...getHarassmentPatterns());
    }
    
    patterns.push(...getSpamPatterns());
    
    return patterns;
  }
  
  /**
   * Check content for abuse patterns.
   */
  check(content: string, recentVetos: number = 0): AbuseCheckResult {
    const detectedPatterns: AbusePattern[] = [];
    
    // Check all patterns
    for (const pattern of this.patterns) {
      if (pattern.pattern && pattern.pattern.test(content)) {
        detectedPatterns.push(pattern);
      }
    }
    
    // Check for repeated veto abuse
    if (recentVetos >= this.config.vetoBlockThreshold) {
      detectedPatterns.push({
        type: 'repeated_veto',
        severity: 'high',
        action: 'throttle',
        description: `${recentVetos} vetos in ${this.config.vetoWindowSeconds}s`,
      });
    } else if (recentVetos >= this.config.vetoWarningThreshold) {
      detectedPatterns.push({
        type: 'repeated_veto',
        severity: 'medium',
        action: 'warn',
        description: `${recentVetos} vetos in ${this.config.vetoWindowSeconds}s`,
      });
    }
    
    // Determine overall severity and action
    const severity = this.getHighestSeverity(detectedPatterns);
    const action = this.getHighestAction(detectedPatterns);
    const shouldBlock = action === 'block' || action === 'ban';
    const shouldWarn = detectedPatterns.length > 0;
    
    // Generate message
    let message: string | undefined;
    if (shouldBlock) {
      message = 'This request has been blocked due to policy violations.';
    } else if (shouldWarn) {
      message = 'Warning: Your request contains potentially problematic content.';
    }
    
    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns,
      severity,
      action,
      shouldBlock,
      shouldWarn,
      message,
    };
  }
  
  private getHighestSeverity(patterns: AbusePattern[]): AbuseSeverity | null {
    const severityOrder: AbuseSeverity[] = ['low', 'medium', 'high', 'critical'];
    let highest: AbuseSeverity | null = null;
    
    for (const pattern of patterns) {
      if (!highest || severityOrder.indexOf(pattern.severity) > severityOrder.indexOf(highest)) {
        highest = pattern.severity;
      }
    }
    
    return highest;
  }
  
  private getHighestAction(patterns: AbusePattern[]): AbuseAction | null {
    const actionOrder: AbuseAction[] = ['warn', 'throttle', 'block', 'ban'];
    let highest: AbuseAction | null = null;
    
    for (const pattern of patterns) {
      if (!highest || actionOrder.indexOf(pattern.action) > actionOrder.indexOf(highest)) {
        highest = pattern.action;
      }
    }
    
    return highest;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// BLOCK STORE
// ─────────────────────────────────────────────────────────────────────────────────

export class BlockStore {
  private readonly prefix: string;
  
  constructor(
    private readonly store: KeyValueStore,
    options?: { prefix?: string }
  ) {
    this.prefix = options?.prefix ?? 'block:';
  }
  
  private getKey(userId: string): string {
    return `${this.prefix}${userId}`;
  }
  
  /**
   * Block a user.
   */
  async block(
    userId: string,
    reason: string,
    durationSeconds: number
  ): Promise<void> {
    const until = Date.now() + durationSeconds * 1000;
    
    await this.store.set(
      this.getKey(userId),
      JSON.stringify({ reason, until, blockedAt: Date.now() }),
      durationSeconds
    );
    
    emitEvent('user_blocked', userId, { reason });
    console.log(`[ABUSE] Blocked user ${userId}: ${reason} for ${durationSeconds}s`);
  }
  
  /**
   * Check if a user is blocked.
   */
  async isBlocked(userId: string): Promise<BlockStatus> {
    const data = await this.store.get(this.getKey(userId));
    
    if (!data) {
      return { blocked: false };
    }
    
    const { reason, until } = JSON.parse(data);
    const now = Date.now();
    
    if (until && now >= until) {
      // Block has expired
      await this.store.delete(this.getKey(userId));
      return { blocked: false };
    }
    
    return {
      blocked: true,
      reason,
      until,
      remainingMs: until ? until - now : undefined,
    };
  }
  
  /**
   * Unblock a user.
   */
  async unblock(userId: string): Promise<boolean> {
    const wasBlocked = await this.store.exists(this.getKey(userId));
    await this.store.delete(this.getKey(userId));
    
    if (wasBlocked) {
      emitEvent('user_unblocked', userId);
    }
    
    return wasBlocked;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// VETO HISTORY STORE
// ─────────────────────────────────────────────────────────────────────────────────

export class VetoHistoryStore {
  private readonly prefix: string;
  
  constructor(
    private readonly store: KeyValueStore,
    options?: { prefix?: string }
  ) {
    this.prefix = options?.prefix ?? 'veto:';
  }
  
  private getKey(userId: string): string {
    return `${this.prefix}${userId}`;
  }
  
  /**
   * Track a veto and return the count in the window.
   */
  async track(userId: string, windowSeconds: number = 300): Promise<number> {
    const key = this.getKey(userId);
    const now = Date.now();
    
    // Add new timestamp
    await this.store.lpush(key, String(now));
    await this.store.expire(key, windowSeconds);
    
    // Get all timestamps
    const timestamps = await this.store.lrange(key, 0, -1);
    const cutoff = now - windowSeconds * 1000;
    
    // Count recent ones
    const recentCount = timestamps.filter(t => parseInt(t, 10) > cutoff).length;
    
    // Trim old entries (keep last 20)
    await this.store.ltrim(key, 0, 19);
    
    return recentCount;
  }
  
  /**
   * Get the current veto count without tracking.
   */
  async getCount(userId: string, windowSeconds: number = 300): Promise<number> {
    const key = this.getKey(userId);
    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;
    
    const timestamps = await this.store.lrange(key, 0, -1);
    return timestamps.filter(t => parseInt(t, 10) > cutoff).length;
  }
  
  /**
   * Get veto status for a user.
   */
  async getStatus(
    userId: string,
    config: AbuseConfig = DEFAULT_ABUSE_CONFIG
  ): Promise<VetoStatus> {
    const count = await this.getCount(userId, config.vetoWindowSeconds);
    
    return {
      count,
      windowSeconds: config.vetoWindowSeconds,
      isAbusive: count >= config.vetoWarningThreshold,
    };
  }
  
  /**
   * Clear veto history for a user.
   */
  async clear(userId: string): Promise<void> {
    await this.store.delete(this.getKey(userId));
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCES
// ─────────────────────────────────────────────────────────────────────────────────

let abuseDetector: AbuseDetector | null = null;
let blockStore: BlockStore | null = null;
let vetoHistoryStore: VetoHistoryStore | null = null;

export function initAbuseDetector(config?: Partial<AbuseConfig>): AbuseDetector {
  abuseDetector = new AbuseDetector(config);
  return abuseDetector;
}

export function getAbuseDetector(): AbuseDetector {
  if (!abuseDetector) {
    abuseDetector = new AbuseDetector();
  }
  return abuseDetector;
}

export function initBlockStore(store: KeyValueStore): BlockStore {
  blockStore = new BlockStore(store);
  return blockStore;
}

export function getBlockStore(): BlockStore {
  if (!blockStore) {
    throw new Error('BlockStore not initialized. Call initBlockStore() first.');
  }
  return blockStore;
}

export function initVetoHistoryStore(store: KeyValueStore): VetoHistoryStore {
  vetoHistoryStore = new VetoHistoryStore(store);
  return vetoHistoryStore;
}

export function getVetoHistoryStore(): VetoHistoryStore {
  if (!vetoHistoryStore) {
    throw new Error('VetoHistoryStore not initialized. Call initVetoHistoryStore() first.');
  }
  return vetoHistoryStore;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check content for abuse.
 */
export function checkForAbuse(content: string, recentVetos: number = 0): AbuseCheckResult {
  return getAbuseDetector().check(content, recentVetos);
}

/**
 * Block a user.
 */
export async function blockUser(
  userId: string,
  reason: string,
  durationSeconds?: number
): Promise<void> {
  const duration = durationSeconds ?? DEFAULT_ABUSE_CONFIG.defaultBlockDurationSeconds;
  await getBlockStore().block(userId, reason, duration);
}

/**
 * Unblock a user.
 */
export async function unblockUser(userId: string): Promise<boolean> {
  return getBlockStore().unblock(userId);
}

/**
 * Check if a user is blocked.
 */
export async function isUserBlocked(userId: string): Promise<BlockStatus> {
  return getBlockStore().isBlocked(userId);
}

/**
 * Track a veto.
 */
export async function trackVeto(userId: string): Promise<number> {
  return getVetoHistoryStore().track(userId);
}

/**
 * Get recent veto count.
 */
export async function getRecentVetoCount(userId: string): Promise<number> {
  return getVetoHistoryStore().getCount(userId);
}
