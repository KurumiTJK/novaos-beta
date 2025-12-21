// ═══════════════════════════════════════════════════════════════════════════════
// ALERTING MODULE INDEX — Alert Management Exports
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Severity
  type AlertSeverity,
  SEVERITY_LEVELS,
  
  // Alert types
  type AlertStatus,
  type AlertSource,
  type Alert,
  type AlertInput,
  
  // Rule types
  type ConditionOperator,
  type AlertCondition,
  type AlertRule,
  
  // Channel types
  type ChannelType,
  type ChannelConfig,
  type SlackChannelConfig,
  type PagerDutyChannelConfig,
  type EmailChannelConfig,
  type WebhookChannelConfig,
  type ConsoleChannelConfig,
  type AnyChannelConfig,
  
  // Result types
  type NotificationResult,
  
  // Service types
  type AlertServiceConfig,
  DEFAULT_ALERT_CONFIG,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CHANNELS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Channel interface
  type NotificationChannel,
  
  // Channel implementations
  SlackChannel,
  PagerDutyChannel,
  WebhookChannel,
  ConsoleChannel,
  
  // Factory
  createChannel,
  
  // Registry
  registerChannel,
  registerChannelConfig,
  getChannel,
  getAllChannels,
  unregisterChannel,
  clearChannels,
} from './channels.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RULES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Rule sets
  HEALTH_RULES,
  PERFORMANCE_RULES,
  SECURITY_RULES,
  ERROR_RULES,
  BUSINESS_RULES,
  ALL_ALERT_RULES,
  
  // Utilities
  getRulesBySource,
  getRulesBySeverity,
  getEnabledRules,
  getRuleById,
} from './rules.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Configuration
  configureAlertService,
  
  // Alert operations
  fireAlert,
  resolveAlert,
  acknowledgeAlert,
  
  // Notifications
  notifyChannel,
  
  // Query
  getActiveAlerts,
  getActiveAlert,
  getAlertById,
  getAlertHistory,
  getAlertCounts,
  
  // Convenience
  fireCritical,
  fireWarning,
  fireInfo,
  
  // Management
  clearAlerts,
  getAlertServiceStatus,
} from './service.js';
