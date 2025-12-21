// ═══════════════════════════════════════════════════════════════════════════════
// ALERTING TYPES — Alert Definitions and Configuration
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// SEVERITY LEVELS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Alert severity levels.
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Numeric severity for comparison.
 */
export const SEVERITY_LEVELS: Record<AlertSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

// ─────────────────────────────────────────────────────────────────────────────────
// ALERT STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Alert status.
 */
export type AlertStatus = 'firing' | 'resolved' | 'acknowledged';

/**
 * Alert source categories.
 */
export type AlertSource =
  | 'health'
  | 'metrics'
  | 'security'
  | 'performance'
  | 'business'
  | 'custom';

/**
 * Core alert structure.
 */
export interface Alert {
  /** Unique alert ID */
  readonly id: string;
  
  /** Alert name/type */
  readonly name: string;
  
  /** Human-readable summary */
  readonly summary: string;
  
  /** Detailed description */
  readonly description?: string;
  
  /** Severity level */
  readonly severity: AlertSeverity;
  
  /** Current status */
  readonly status: AlertStatus;
  
  /** Source of the alert */
  readonly source: AlertSource;
  
  /** When the alert started firing */
  readonly firedAt: string;
  
  /** When the alert was resolved (if resolved) */
  readonly resolvedAt?: string;
  
  /** When the alert was acknowledged (if acknowledged) */
  readonly acknowledgedAt?: string;
  
  /** Who acknowledged the alert */
  readonly acknowledgedBy?: string;
  
  /** Labels for grouping/filtering */
  readonly labels: Readonly<Record<string, string>>;
  
  /** Additional context */
  readonly annotations: Readonly<Record<string, unknown>>;
  
  /** Number of times this alert has fired */
  readonly fireCount: number;
  
  /** Fingerprint for deduplication */
  readonly fingerprint: string;
}

/**
 * Alert creation input.
 */
export interface AlertInput {
  readonly name: string;
  readonly summary: string;
  readonly description?: string;
  readonly severity: AlertSeverity;
  readonly source: AlertSource;
  readonly labels?: Record<string, string>;
  readonly annotations?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ALERT RULES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Condition operator for alert rules.
 */
export type ConditionOperator = 
  | 'gt'      // greater than
  | 'gte'     // greater than or equal
  | 'lt'      // less than
  | 'lte'     // less than or equal
  | 'eq'      // equal
  | 'neq'     // not equal
  | 'contains'
  | 'matches'; // regex

/**
 * Alert rule condition.
 */
export interface AlertCondition {
  /** Metric or value name */
  readonly metric: string;
  
  /** Comparison operator */
  readonly operator: ConditionOperator;
  
  /** Threshold value */
  readonly threshold: number | string;
  
  /** Duration the condition must hold (e.g., '5m') */
  readonly for?: string;
  
  /** Labels to match */
  readonly labels?: Record<string, string>;
}

/**
 * Alert rule definition.
 */
export interface AlertRule {
  /** Unique rule ID */
  readonly id: string;
  
  /** Rule name */
  readonly name: string;
  
  /** Description */
  readonly description?: string;
  
  /** Severity when fired */
  readonly severity: AlertSeverity;
  
  /** Source category */
  readonly source: AlertSource;
  
  /** Conditions that trigger the alert */
  readonly conditions: readonly AlertCondition[];
  
  /** How conditions are combined ('and' | 'or') */
  readonly conditionLogic: 'and' | 'or';
  
  /** Labels to add to alerts */
  readonly labels?: Record<string, string>;
  
  /** Annotations to add to alerts */
  readonly annotations?: Record<string, string>;
  
  /** Whether the rule is enabled */
  readonly enabled: boolean;
  
  /** Channels to notify */
  readonly notifyChannels?: readonly string[];
  
  /** Cooldown between alerts (e.g., '15m') */
  readonly cooldown?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NOTIFICATION CHANNELS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Notification channel types.
 */
export type ChannelType = 
  | 'slack'
  | 'pagerduty'
  | 'email'
  | 'webhook'
  | 'console';

/**
 * Base channel configuration.
 */
export interface ChannelConfig {
  /** Channel ID */
  readonly id: string;
  
  /** Channel type */
  readonly type: ChannelType;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Whether the channel is enabled */
  readonly enabled: boolean;
  
  /** Minimum severity to notify */
  readonly minSeverity?: AlertSeverity;
  
  /** Filter by source */
  readonly sources?: readonly AlertSource[];
}

/**
 * Slack channel configuration.
 */
export interface SlackChannelConfig extends ChannelConfig {
  readonly type: 'slack';
  readonly webhookUrl: string;
  readonly channel?: string;
  readonly username?: string;
  readonly iconEmoji?: string;
}

/**
 * PagerDuty channel configuration.
 */
export interface PagerDutyChannelConfig extends ChannelConfig {
  readonly type: 'pagerduty';
  readonly routingKey: string;
  readonly serviceId?: string;
}

/**
 * Email channel configuration.
 */
export interface EmailChannelConfig extends ChannelConfig {
  readonly type: 'email';
  readonly recipients: readonly string[];
  readonly smtpHost?: string;
  readonly smtpPort?: number;
}

/**
 * Webhook channel configuration.
 */
export interface WebhookChannelConfig extends ChannelConfig {
  readonly type: 'webhook';
  readonly url: string;
  readonly method?: 'POST' | 'PUT';
  readonly headers?: Record<string, string>;
}

/**
 * Console channel configuration (for development).
 */
export interface ConsoleChannelConfig extends ChannelConfig {
  readonly type: 'console';
}

/**
 * Union of all channel configs.
 */
export type AnyChannelConfig =
  | SlackChannelConfig
  | PagerDutyChannelConfig
  | EmailChannelConfig
  | WebhookChannelConfig
  | ConsoleChannelConfig;

// ─────────────────────────────────────────────────────────────────────────────────
// NOTIFICATION RESULT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Result of sending a notification.
 */
export interface NotificationResult {
  readonly channelId: string;
  readonly channelType: ChannelType;
  readonly success: boolean;
  readonly error?: string;
  readonly sentAt: string;
  readonly latencyMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SERVICE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Alert service configuration.
 */
export interface AlertServiceConfig {
  /** Enable/disable alerting */
  readonly enabled: boolean;
  
  /** Default cooldown between duplicate alerts */
  readonly defaultCooldown: string;
  
  /** Maximum alerts to keep in memory */
  readonly maxAlerts: number;
  
  /** Alert retention period */
  readonly retentionPeriod: string;
  
  /** Global minimum severity */
  readonly minSeverity: AlertSeverity;
}

export const DEFAULT_ALERT_CONFIG: AlertServiceConfig = {
  enabled: true,
  defaultCooldown: '15m',
  maxAlerts: 1000,
  retentionPeriod: '24h',
  minSeverity: 'info',
};
