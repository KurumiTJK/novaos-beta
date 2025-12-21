// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION CHANNELS — Slack, PagerDuty, Webhook Implementations
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Alert,
  ChannelType,
  AnyChannelConfig,
  SlackChannelConfig,
  PagerDutyChannelConfig,
  WebhookChannelConfig,
  ConsoleChannelConfig,
  NotificationResult,
  AlertSeverity,
  SEVERITY_LEVELS,
} from './types.js';
import { getLogger } from '../logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CHANNEL INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Notification channel interface.
 */
export interface NotificationChannel {
  /** Channel ID */
  readonly id: string;
  
  /** Channel type */
  readonly type: ChannelType;
  
  /** Send an alert notification */
  send(alert: Alert): Promise<NotificationResult>;
  
  /** Test the channel connectivity */
  test(): Promise<boolean>;
  
  /** Check if channel is enabled */
  isEnabled(): boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEVERITY COLORS
// ─────────────────────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: '#FF0000',
  warning: '#FFA500',
  info: '#0000FF',
};

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  critical: '🚨',
  warning: '⚠️',
  info: 'ℹ️',
};

// ─────────────────────────────────────────────────────────────────────────────────
// SLACK CHANNEL
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Slack notification channel.
 */
export class SlackChannel implements NotificationChannel {
  readonly id: string;
  readonly type: ChannelType = 'slack';
  private readonly config: SlackChannelConfig;
  private readonly logger = getLogger({ component: 'slack-channel' });
  
  constructor(config: SlackChannelConfig) {
    this.id = config.id;
    this.config = config;
  }
  
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  async send(alert: Alert): Promise<NotificationResult> {
    const start = Date.now();
    
    try {
      const payload = this.buildSlackPayload(alert);
      
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const latencyMs = Date.now() - start;
      
      if (!response.ok) {
        const error = await response.text();
        this.logger.error('Slack notification failed', undefined, {
          status: response.status,
          error,
          alertId: alert.id,
        });
        
        return {
          channelId: this.id,
          channelType: 'slack',
          success: false,
          error: `HTTP ${response.status}: ${error}`,
          sentAt: new Date().toISOString(),
          latencyMs,
        };
      }
      
      this.logger.info('Slack notification sent', {
        alertId: alert.id,
        alertName: alert.name,
        latencyMs,
      });
      
      return {
        channelId: this.id,
        channelType: 'slack',
        success: true,
        sentAt: new Date().toISOString(),
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Slack notification error', error);
      
      return {
        channelId: this.id,
        channelType: 'slack',
        success: false,
        error: errorMessage,
        sentAt: new Date().toISOString(),
        latencyMs,
      };
    }
  }
  
  async test(): Promise<boolean> {
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🔔 NovaOS Alert Channel Test - Connection successful!',
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  private buildSlackPayload(alert: Alert): Record<string, unknown> {
    const emoji = SEVERITY_EMOJI[alert.severity];
    const color = SEVERITY_COLORS[alert.severity];
    const status = alert.status === 'resolved' ? '✅ Resolved' : '🔥 Firing';
    
    return {
      channel: this.config.channel,
      username: this.config.username ?? 'NovaOS Alerts',
      icon_emoji: this.config.iconEmoji ?? ':bell:',
      attachments: [
        {
          color,
          title: `${emoji} [${alert.severity.toUpperCase()}] ${alert.name}`,
          text: alert.summary,
          fields: [
            { title: 'Status', value: status, short: true },
            { title: 'Source', value: alert.source, short: true },
            { title: 'Fired At', value: alert.firedAt, short: true },
            { title: 'Fire Count', value: String(alert.fireCount), short: true },
          ],
          footer: `Alert ID: ${alert.id}`,
          ts: Math.floor(new Date(alert.firedAt).getTime() / 1000),
        },
      ],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// PAGERDUTY CHANNEL
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * PagerDuty notification channel.
 */
export class PagerDutyChannel implements NotificationChannel {
  readonly id: string;
  readonly type: ChannelType = 'pagerduty';
  private readonly config: PagerDutyChannelConfig;
  private readonly logger = getLogger({ component: 'pagerduty-channel' });
  
  private static readonly EVENTS_URL = 'https://events.pagerduty.com/v2/enqueue';
  
  constructor(config: PagerDutyChannelConfig) {
    this.id = config.id;
    this.config = config;
  }
  
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  async send(alert: Alert): Promise<NotificationResult> {
    const start = Date.now();
    
    try {
      const payload = this.buildPagerDutyPayload(alert);
      
      const response = await fetch(PagerDutyChannel.EVENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const latencyMs = Date.now() - start;
      
      if (!response.ok) {
        const error = await response.text();
        this.logger.error('PagerDuty notification failed', undefined, {
          status: response.status,
          error,
          alertId: alert.id,
        });
        
        return {
          channelId: this.id,
          channelType: 'pagerduty',
          success: false,
          error: `HTTP ${response.status}: ${error}`,
          sentAt: new Date().toISOString(),
          latencyMs,
        };
      }
      
      this.logger.info('PagerDuty notification sent', {
        alertId: alert.id,
        alertName: alert.name,
        latencyMs,
      });
      
      return {
        channelId: this.id,
        channelType: 'pagerduty',
        success: true,
        sentAt: new Date().toISOString(),
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('PagerDuty notification error', error);
      
      return {
        channelId: this.id,
        channelType: 'pagerduty',
        success: false,
        error: errorMessage,
        sentAt: new Date().toISOString(),
        latencyMs,
      };
    }
  }
  
  async test(): Promise<boolean> {
    // PagerDuty doesn't have a simple test endpoint
    // We'd need to send a test event and check for success
    return this.config.enabled && !!this.config.routingKey;
  }
  
  private buildPagerDutyPayload(alert: Alert): Record<string, unknown> {
    const eventAction = alert.status === 'resolved' ? 'resolve' : 'trigger';
    const severity = this.mapSeverity(alert.severity);
    
    return {
      routing_key: this.config.routingKey,
      event_action: eventAction,
      dedup_key: alert.fingerprint,
      payload: {
        summary: `[${alert.severity.toUpperCase()}] ${alert.name}: ${alert.summary}`,
        source: `novaos-${alert.source}`,
        severity,
        timestamp: alert.firedAt,
        custom_details: {
          alert_id: alert.id,
          fire_count: alert.fireCount,
          labels: alert.labels,
          ...alert.annotations,
        },
      },
      links: [],
      images: [],
    };
  }
  
  private mapSeverity(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return 'critical';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// WEBHOOK CHANNEL
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generic webhook notification channel.
 */
export class WebhookChannel implements NotificationChannel {
  readonly id: string;
  readonly type: ChannelType = 'webhook';
  private readonly config: WebhookChannelConfig;
  private readonly logger = getLogger({ component: 'webhook-channel' });
  
  constructor(config: WebhookChannelConfig) {
    this.id = config.id;
    this.config = config;
  }
  
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  async send(alert: Alert): Promise<NotificationResult> {
    const start = Date.now();
    
    try {
      const response = await fetch(this.config.url, {
        method: this.config.method ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(alert),
      });
      
      const latencyMs = Date.now() - start;
      
      if (!response.ok) {
        return {
          channelId: this.id,
          channelType: 'webhook',
          success: false,
          error: `HTTP ${response.status}`,
          sentAt: new Date().toISOString(),
          latencyMs,
        };
      }
      
      return {
        channelId: this.id,
        channelType: 'webhook',
        success: true,
        sentAt: new Date().toISOString(),
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      
      return {
        channelId: this.id,
        channelType: 'webhook',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sentAt: new Date().toISOString(),
        latencyMs,
      };
    }
  }
  
  async test(): Promise<boolean> {
    try {
      const response = await fetch(this.config.url, {
        method: 'HEAD',
        headers: this.config.headers,
      });
      return response.ok || response.status === 405; // 405 = method not allowed but URL works
    } catch {
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSOLE CHANNEL (Development)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Console notification channel for development.
 */
export class ConsoleChannel implements NotificationChannel {
  readonly id: string;
  readonly type: ChannelType = 'console';
  private readonly config: ConsoleChannelConfig;
  
  constructor(config: ConsoleChannelConfig) {
    this.id = config.id;
    this.config = config;
  }
  
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  async send(alert: Alert): Promise<NotificationResult> {
    const emoji = SEVERITY_EMOJI[alert.severity];
    const status = alert.status === 'resolved' ? '✅' : '🔥';
    
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║ ${emoji} ALERT: ${alert.name.padEnd(52)} ║
╠══════════════════════════════════════════════════════════════════╣
║ Severity: ${alert.severity.toUpperCase().padEnd(54)} ║
║ Status:   ${status} ${alert.status.padEnd(52)} ║
║ Source:   ${alert.source.padEnd(54)} ║
║ Summary:  ${alert.summary.slice(0, 54).padEnd(54)} ║
║ Fired:    ${alert.firedAt.padEnd(54)} ║
║ Count:    ${String(alert.fireCount).padEnd(54)} ║
╚══════════════════════════════════════════════════════════════════╝
    `.trim());
    
    return {
      channelId: this.id,
      channelType: 'console',
      success: true,
      sentAt: new Date().toISOString(),
    };
  }
  
  async test(): Promise<boolean> {
    console.log('🔔 Console alert channel test - OK');
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CHANNEL FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a notification channel from configuration.
 */
export function createChannel(config: AnyChannelConfig): NotificationChannel {
  switch (config.type) {
    case 'slack':
      return new SlackChannel(config);
    case 'pagerduty':
      return new PagerDutyChannel(config);
    case 'webhook':
      return new WebhookChannel(config);
    case 'console':
      return new ConsoleChannel(config);
    default:
      throw new Error(`Unknown channel type: ${(config as AnyChannelConfig).type}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CHANNEL REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

const channels = new Map<string, NotificationChannel>();

/**
 * Register a notification channel.
 */
export function registerChannel(channel: NotificationChannel): void {
  channels.set(channel.id, channel);
}

/**
 * Register a channel from configuration.
 */
export function registerChannelConfig(config: AnyChannelConfig): NotificationChannel {
  const channel = createChannel(config);
  registerChannel(channel);
  return channel;
}

/**
 * Get a registered channel.
 */
export function getChannel(id: string): NotificationChannel | undefined {
  return channels.get(id);
}

/**
 * Get all registered channels.
 */
export function getAllChannels(): NotificationChannel[] {
  return Array.from(channels.values());
}

/**
 * Unregister a channel.
 */
export function unregisterChannel(id: string): boolean {
  return channels.delete(id);
}

/**
 * Clear all channels.
 */
export function clearChannels(): void {
  channels.clear();
}
