// ═══════════════════════════════════════════════════════════════════════════════
// ABUSE DETECTION TYPES — Pattern Matching and Blocking
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// ABUSE PATTERN TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type AbuseType =
  | 'prompt_injection'
  | 'jailbreak'
  | 'harassment'
  | 'spam'
  | 'repeated_veto'
  | 'rate_abuse';

export type AbuseSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AbuseAction = 'warn' | 'throttle' | 'block' | 'ban';

// ─────────────────────────────────────────────────────────────────────────────────
// ABUSE PATTERN
// ─────────────────────────────────────────────────────────────────────────────────

export interface AbusePattern {
  type: AbuseType;
  severity: AbuseSeverity;
  action: AbuseAction;
  pattern?: RegExp;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ABUSE CHECK RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export interface AbuseCheckResult {
  detected: boolean;
  patterns: AbusePattern[];
  severity: AbuseSeverity | null;
  action: AbuseAction | null;
  shouldBlock: boolean;
  shouldWarn: boolean;
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// BLOCK STATUS
// ─────────────────────────────────────────────────────────────────────────────────

export interface BlockStatus {
  blocked: boolean;
  reason?: string;
  until?: number;
  remainingMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ABUSE EVENTS
// ─────────────────────────────────────────────────────────────────────────────────

export type AbuseEventType =
  | 'abuse_detected'
  | 'abuse_warning'
  | 'user_blocked'
  | 'user_unblocked';

export interface AbuseEvent {
  type: AbuseEventType;
  userId: string;
  timestamp: number;
  abuseType?: AbuseType;
  severity?: AbuseSeverity;
  action?: AbuseAction;
  reason?: string;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VETO TRACKING
// ─────────────────────────────────────────────────────────────────────────────────

export interface VetoStatus {
  count: number;
  windowSeconds: number;
  isAbusive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface AbuseConfig {
  /** Veto threshold before warning */
  vetoWarningThreshold: number;
  
  /** Veto threshold before blocking */
  vetoBlockThreshold: number;
  
  /** Veto tracking window in seconds */
  vetoWindowSeconds: number;
  
  /** Default block duration in seconds */
  defaultBlockDurationSeconds: number;
  
  /** Enable prompt injection detection */
  detectPromptInjection: boolean;
  
  /** Enable harassment detection */
  detectHarassment: boolean;
}

export const DEFAULT_ABUSE_CONFIG: AbuseConfig = {
  vetoWarningThreshold: 3,
  vetoBlockThreshold: 5,
  vetoWindowSeconds: 300, // 5 minutes
  defaultBlockDurationSeconds: 3600, // 1 hour
  detectPromptInjection: true,
  detectHarassment: true,
};
