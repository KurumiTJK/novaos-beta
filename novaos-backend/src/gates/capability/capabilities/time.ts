// ═══════════════════════════════════════════════════════════════════════════════
// TIME CAPABILITY — Wraps TimeProvider
// ═══════════════════════════════════════════════════════════════════════════════

import type { Capability, SelectorInput, EvidenceItem } from '../types.js';
import { getProviderForCategory } from '../../../services/data-providers/registry.js';
import type { TimeData } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TIMEZONE EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract timezone from user message.
 */
function extractTimezone(message: string): string {
  // Direct timezone mentions
  const tzPatterns = [
    /time\s+in\s+([A-Za-z_\/]+)/i,
    /([A-Za-z_\/]+)\s+time/i,
    /\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT|GMT|UTC|BST|CET|JST|IST)\b/i,
  ];

  for (const pattern of tzPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  // City to timezone mapping
  const cityMap: Record<string, string> = {
    'new york': 'America/New_York',
    'los angeles': 'America/Los_Angeles',
    'chicago': 'America/Chicago',
    'denver': 'America/Denver',
    'seattle': 'America/Los_Angeles',
    'san francisco': 'America/Los_Angeles',
    'miami': 'America/New_York',
    'boston': 'America/New_York',
    'london': 'Europe/London',
    'paris': 'Europe/Paris',
    'berlin': 'Europe/Berlin',
    'tokyo': 'Asia/Tokyo',
    'sydney': 'Australia/Sydney',
    'singapore': 'Asia/Singapore',
    'hong kong': 'Asia/Hong_Kong',
    'mumbai': 'Asia/Kolkata',
    'dubai': 'Asia/Dubai',
    'toronto': 'America/Toronto',
    'vancouver': 'America/Vancouver',
  };

  const lower = message.toLowerCase();
  for (const [city, tz] of Object.entries(cityMap)) {
    if (lower.includes(city)) {
      return tz;
    }
  }

  // Default to UTC
  return 'UTC';
}

// ─────────────────────────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

function formatTimeEvidence(data: TimeData): string {
  const parts = [
    `Time in ${data.timezone}`,
    `Local Time: ${data.localTime}`,
    `UTC: ${data.utcTime}`,
    `Offset: ${data.utcOffset}`,
  ];

  if (data.abbreviation) {
    parts.push(`Timezone: ${data.abbreviation}`);
  }

  if (data.isDst !== undefined) {
    parts.push(`Daylight Saving: ${data.isDst ? 'Yes' : 'No'}`);
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY
// ─────────────────────────────────────────────────────────────────────────────────

export const timeCapability: Capability = {
  name: 'time_fetcher',
  description: 'Fetches current time for a timezone or city (e.g., Tokyo, EST, America/New_York)',

  async execute(input: SelectorInput): Promise<EvidenceItem | null> {
    const timezone = extractTimezone(input.userMessage);

    const provider = getProviderForCategory('time');
    if (!provider) {
      console.log('[TIME_FETCHER] No time provider available');
      return null;
    }

    if (!provider.isAvailable()) {
      console.log('[TIME_FETCHER] Provider not available');
      return null;
    }

    try {
      const fetchResult = await provider.fetch({ query: timezone, bypassCache: true });
      const result = fetchResult.result;

      if (!result.ok) {
        console.log('[TIME_FETCHER] Fetch failed:', result.error?.message);
        return null;
      }

      const timeData = result.data as TimeData;

      return {
        type: 'time',
        formatted: formatTimeEvidence(timeData),
        source: 'time_fetcher',
        raw: timeData,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      console.error('[TIME_FETCHER] Error:', error);
      return null;
    }
  },
};
