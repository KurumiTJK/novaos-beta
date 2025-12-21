// ═══════════════════════════════════════════════════════════════════════════════
// ALERT SERVICE — Central Alert Management
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Alert,
  AlertInput,
  AlertStatus,
  AlertServiceConfig,
  NotificationResult,
  AlertSeverity,
  SEVERITY_LEVELS,
} from './types.js';
import {
  getAllChannels,
  getChannel,
  type NotificationChannel,
} from './channels.js';
import { getLogger } from '../logging/index.js';
import { incCounter } from '../metrics/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AlertServiceConfig = {
  enabled: true,
  defaultCooldown: '15m',
  maxAlerts: 1000,
  retentionPeriod: '24h',
  minSeverity: 'info',
};

let serviceConfig: AlertServiceConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the alert service.
 */
export function configureAlertService(config: Partial<AlertServiceConfig>): void {
  serviceConfig = { ...serviceConfig, ...config };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ALERT STORAGE
// ─────────────────────────────────────────────────────────────────────────────────

const activeAlerts = new Map<string, Alert>();
const alertHistory: Alert[] = [];
const cooldowns = new Map<string, number>();

const logger = getLogger({ component: 'alert-service' });

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate alert fingerprint for deduplication.
 */
function generateFingerprint(input: AlertInput): string {
  const parts = [
    input.name,
    input.source,
    ...Object.entries(input.labels ?? {}).sort().map(([k, v]) => `${k}=${v}`),
  ];
  return parts.join(':');
}

/**
 * Generate unique alert ID.
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse duration string to milliseconds.
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 0;
  
  const value = parseInt(match[1]!, 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

/**
 * Check if alert is in cooldown.
 */
function isInCooldown(fingerprint: string): boolean {
  const cooldownUntil = cooldowns.get(fingerprint);
  if (!cooldownUntil) return false;
  
  if (Date.now() > cooldownUntil) {
    cooldowns.delete(fingerprint);
    return false;
  }
  
  return true;
}

/**
 * Set cooldown for alert.
 */
function setCooldown(fingerprint: string, duration: string = serviceConfig.defaultCooldown): void {
  const cooldownMs = parseDuration(duration);
  if (cooldownMs > 0) {
    cooldowns.set(fingerprint, Date.now() + cooldownMs);
  }
}

/**
 * Trim alert history to max size.
 */
function trimAlertHistory(): void {
  while (alertHistory.length > serviceConfig.maxAlerts) {
    alertHistory.shift();
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// ALERT OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fire an alert.
 */
export async function fireAlert(input: AlertInput): Promise<Alert | null> {
  if (!serviceConfig.enabled) {
    return null;
  }
  
  const fingerprint = generateFingerprint(input);
  
  // Check cooldown
  if (isInCooldown(fingerprint)) {
    logger.debug('Alert in cooldown, skipping', { name: input.name, fingerprint });
    return null;
  }
  
  // Check if already firing
  const existing = activeAlerts.get(fingerprint);
  if (existing) {
    // Update fire count
    const updated: Alert = {
      ...existing,
      fireCount: existing.fireCount + 1,
    };
    activeAlerts.set(fingerprint, updated);
    
    logger.info('Alert re-fired', {
      alertId: updated.id,
      name: updated.name,
      fireCount: updated.fireCount,
    });
    
    return updated;
  }
  
  // Create new alert
  const alert: Alert = {
    id: generateAlertId(),
    name: input.name,
    summary: input.summary,
    description: input.description,
    severity: input.severity,
    status: 'firing',
    source: input.source,
    firedAt: new Date().toISOString(),
    labels: input.labels ?? {},
    annotations: input.annotations ?? {},
    fireCount: 1,
    fingerprint,
  };
  
  // Store alert
  activeAlerts.set(fingerprint, alert);
  alertHistory.push(alert);
  trimAlertHistory();
  
  // Record metric
  incCounter('alerts_fired_total', {
    severity: alert.severity,
    source: alert.source,
  });
  
  logger.warn('Alert fired', {
    alertId: alert.id,
    name: alert.name,
    severity: alert.severity,
    source: alert.source,
  });
  
  // Send notifications
  await notifyChannels(alert);
  
  return alert;
}

/**
 * Resolve an alert.
 */
export async function resolveAlert(fingerprint: string): Promise<Alert | null> {
  const alert = activeAlerts.get(fingerprint);
  if (!alert) {
    return null;
  }
  
  const resolved: Alert = {
    ...alert,
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
  };
  
  // Remove from active
  activeAlerts.delete(fingerprint);
  
  // Update in history
  const historyIndex = alertHistory.findIndex(a => a.id === alert.id);
  if (historyIndex >= 0) {
    alertHistory[historyIndex] = resolved;
  }
  
  // Set cooldown
  setCooldown(fingerprint);
  
  // Record metric
  incCounter('alerts_resolved_total', {
    severity: resolved.severity,
    source: resolved.source,
  });
  
  logger.info('Alert resolved', {
    alertId: resolved.id,
    name: resolved.name,
  });
  
  // Send resolution notification
  await notifyChannels(resolved);
  
  return resolved;
}

/**
 * Acknowledge an alert.
 */
export function acknowledgeAlert(fingerprint: string, acknowledgedBy?: string): Alert | null {
  const alert = activeAlerts.get(fingerprint);
  if (!alert) {
    return null;
  }
  
  const acknowledged: Alert = {
    ...alert,
    status: 'acknowledged',
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy,
  };
  
  activeAlerts.set(fingerprint, acknowledged);
  
  logger.info('Alert acknowledged', {
    alertId: acknowledged.id,
    name: acknowledged.name,
    acknowledgedBy,
  });
  
  return acknowledged;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Send alert to all applicable channels.
 */
async function notifyChannels(alert: Alert): Promise<NotificationResult[]> {
  const channels = getAllChannels().filter(ch => ch.isEnabled());
  
  if (channels.length === 0) {
    logger.debug('No notification channels configured');
    return [];
  }
  
  const results: NotificationResult[] = [];
  
  for (const channel of channels) {
    try {
      const result = await channel.send(alert);
      results.push(result);
      
      incCounter('alert_notifications_total', {
        channel: channel.type,
        success: String(result.success),
      });
    } catch (error) {
      logger.error('Channel notification failed', error, {
        channelId: channel.id,
        alertId: alert.id,
      });
      
      results.push({
        channelId: channel.id,
        channelType: channel.type,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sentAt: new Date().toISOString(),
      });
    }
  }
  
  return results;
}

/**
 * Send alert to specific channel.
 */
export async function notifyChannel(
  alert: Alert,
  channelId: string
): Promise<NotificationResult | null> {
  const channel = getChannel(channelId);
  if (!channel) {
    logger.warn('Channel not found', { channelId });
    return null;
  }
  
  return channel.send(alert);
}

// ─────────────────────────────────────────────────────────────────────────────────
// QUERY ALERTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get all active alerts.
 */
export function getActiveAlerts(): Alert[] {
  return Array.from(activeAlerts.values());
}

/**
 * Get active alert by fingerprint.
 */
export function getActiveAlert(fingerprint: string): Alert | undefined {
  return activeAlerts.get(fingerprint);
}

/**
 * Get alert by ID.
 */
export function getAlertById(id: string): Alert | undefined {
  return alertHistory.find(a => a.id === id);
}

/**
 * Get alert history.
 */
export function getAlertHistory(options?: {
  limit?: number;
  severity?: AlertSeverity;
  source?: string;
  status?: AlertStatus;
}): Alert[] {
  let results = [...alertHistory];
  
  if (options?.severity) {
    results = results.filter(a => a.severity === options.severity);
  }
  
  if (options?.source) {
    results = results.filter(a => a.source === options.source);
  }
  
  if (options?.status) {
    results = results.filter(a => a.status === options.status);
  }
  
  if (options?.limit) {
    results = results.slice(-options.limit);
  }
  
  return results.reverse(); // Most recent first
}

/**
 * Get alert counts by severity.
 */
export function getAlertCounts(): Record<AlertSeverity, number> {
  const alerts = getActiveAlerts();
  
  return {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fire a critical alert.
 */
export async function fireCritical(
  name: string,
  summary: string,
  options?: Partial<Omit<AlertInput, 'name' | 'summary' | 'severity'>>
): Promise<Alert | null> {
  return fireAlert({
    name,
    summary,
    severity: 'critical',
    source: options?.source ?? 'custom',
    ...options,
  });
}

/**
 * Fire a warning alert.
 */
export async function fireWarning(
  name: string,
  summary: string,
  options?: Partial<Omit<AlertInput, 'name' | 'summary' | 'severity'>>
): Promise<Alert | null> {
  return fireAlert({
    name,
    summary,
    severity: 'warning',
    source: options?.source ?? 'custom',
    ...options,
  });
}

/**
 * Fire an info alert.
 */
export async function fireInfo(
  name: string,
  summary: string,
  options?: Partial<Omit<AlertInput, 'name' | 'summary' | 'severity'>>
): Promise<Alert | null> {
  return fireAlert({
    name,
    summary,
    severity: 'info',
    source: options?.source ?? 'custom',
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Clear all alerts (for testing).
 */
export function clearAlerts(): void {
  activeAlerts.clear();
  alertHistory.length = 0;
  cooldowns.clear();
}

/**
 * Get service status.
 */
export function getAlertServiceStatus(): {
  enabled: boolean;
  activeAlerts: number;
  historySize: number;
  cooldownsActive: number;
} {
  return {
    enabled: serviceConfig.enabled,
    activeAlerts: activeAlerts.size,
    historySize: alertHistory.length,
    cooldownsActive: cooldowns.size,
  };
}
