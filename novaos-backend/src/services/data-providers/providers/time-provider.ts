// ═══════════════════════════════════════════════════════════════════════════════
// TIME PROVIDER — System Clock (Always Available)
// PATCHED VERSION - Compatible with existing NovaOS types
// ═══════════════════════════════════════════════════════════════════════════════

import {
  BaseProvider,
  type ProviderFetchParams,
} from './base-provider.js';

import type {
  ProviderResult,
  TimeData,
} from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TIMEZONE MAPPINGS
// ─────────────────────────────────────────────────────────────────────────────────

const TIMEZONE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  // US Timezones
  'EST': 'America/New_York',
  'EDT': 'America/New_York',
  'CST': 'America/Chicago',
  'CDT': 'America/Chicago',
  'MST': 'America/Denver',
  'MDT': 'America/Denver',
  'PST': 'America/Los_Angeles',
  'PDT': 'America/Los_Angeles',
  'AKST': 'America/Anchorage',
  'AKDT': 'America/Anchorage',
  'HST': 'Pacific/Honolulu',
  
  // Common International
  'GMT': 'Etc/GMT',
  'UTC': 'Etc/UTC',
  'BST': 'Europe/London',
  'CET': 'Europe/Paris',
  'CEST': 'Europe/Paris',
  'EET': 'Europe/Helsinki',
  'EEST': 'Europe/Helsinki',
  'IST': 'Asia/Kolkata',
  'JST': 'Asia/Tokyo',
  'KST': 'Asia/Seoul',
  'HKT': 'Asia/Hong_Kong',
  'SGT': 'Asia/Singapore',
  'AEST': 'Australia/Sydney',
  'AEDT': 'Australia/Sydney',
  'NZST': 'Pacific/Auckland',
  'NZDT': 'Pacific/Auckland',
  
  // Aliases
  'EASTERN': 'America/New_York',
  'CENTRAL': 'America/Chicago',
  'MOUNTAIN': 'America/Denver',
  'PACIFIC': 'America/Los_Angeles',
  'LONDON': 'Europe/London',
  'TOKYO': 'Asia/Tokyo',
  'SYDNEY': 'Australia/Sydney',
};

// ─────────────────────────────────────────────────────────────────────────────────
// TIMEZONE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function normalizeTimezone(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  const trimmed = input.trim();
  
  if (isValidTimezone(trimmed)) {
    return trimmed;
  }
  
  const upper = trimmed.toUpperCase().replace(/[^A-Z_]/g, '_');
  const mapped = TIMEZONE_ABBREVIATIONS[upper];
  
  if (mapped && isValidTimezone(mapped)) {
    return mapped;
  }
  
  const withSlash = trimmed.replace(/_/g, '/');
  if (isValidTimezone(withSlash)) {
    return withSlash;
  }
  
  return null;
}

function getSuggestedTimezones(): readonly string[] {
  return [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Etc/UTC',
  ];
}

// ─────────────────────────────────────────────────────────────────────────────────
// TIME PROVIDER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class TimeProvider extends BaseProvider {
  readonly name = 'system-time';
  readonly categories = ['time'] as const;
  readonly reliabilityTier = 'official' as const;
  
  override isAvailable(): boolean {
    return true;
  }
  
  protected async fetchInternal(params: ProviderFetchParams): Promise<ProviderResult> {
    const { query } = params;
    const startTime = Date.now();
    
    // Default to UTC if no query
    const requestedTimezone = query?.trim() || 'Etc/UTC';
    
    // Normalize the timezone
    const timezone = normalizeTimezone(requestedTimezone);
    
    if (!timezone) {
      return this.createFailResult(
        'INVALID_TIMEZONE',
        `Invalid timezone: "${requestedTimezone}". Valid examples: ${getSuggestedTimezones().slice(0, 5).join(', ')}`,
        false
      );
    }
    
    try {
      const now = new Date();
      
      // Build TimeData matching the actual interface
      const timeData: TimeData = {
        type: 'time',
        timezone,
        utcOffset: this.formatUtcOffset(now, timezone),
        localTime: this.formatLocalTime(now, timezone),
        utcTime: now.toISOString(),
        unixTimestamp: Math.floor(now.getTime() / 1000),
        isDst: this.isDst(now, timezone),
        abbreviation: this.getTimezoneAbbreviation(now, timezone),
      };
      
      const latencyMs = Date.now() - startTime;
      return this.createOkResult(timeData, latencyMs);
    } catch (error) {
      return this.createFailResult(
        'TIME_ERROR',
        `Failed to get time for timezone "${timezone}": ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }
  
  private formatUtcOffset(date: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    const offset = offsetPart?.value ?? 'UTC';
    // Convert "GMT-05:00" to "UTC-05:00"
    return offset.replace('GMT', 'UTC');
  }
  
  private formatLocalTime(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date).replace(',', '');
  }
  
  private getTimezoneAbbreviation(date: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date);
    return parts.find(p => p.type === 'timeZoneName')?.value ?? timezone;
  }
  
  private isDst(date: Date, timezone: string): boolean {
    const year = date.getFullYear();
    const jan = new Date(year, 0, 1);
    const jul = new Date(year, 6, 1);
    const janOffset = this.getTimezoneOffset(jan, timezone);
    const julOffset = this.getTimezoneOffset(jul, timezone);
    const currentOffset = this.getTimezoneOffset(date, timezone);
    return currentOffset !== Math.max(janOffset, julOffset);
  }
  
  private getTimezoneOffset(date: Date, timezone: string): number {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return (utcDate.getTime() - tzDate.getTime()) / 60000;
  }
  
  protected override getCacheKey(params: ProviderFetchParams): string {
    const timezone = normalizeTimezone(params.query) ?? 'Etc/UTC';
    const second = Math.floor(Date.now() / 1000);
    return `${this.name}:${timezone}:${second}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  isValidTimezone,
  normalizeTimezone,
  getSuggestedTimezones,
  TIMEZONE_ABBREVIATIONS,
};
