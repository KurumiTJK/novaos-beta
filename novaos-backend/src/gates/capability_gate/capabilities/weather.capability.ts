// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER CAPABILITY
// Fetches current weather for a location
// ═══════════════════════════════════════════════════════════════════════════════

import type { EvidenceItem } from '../types.js';
import { getProviderForCategory } from '../../../services/data-providers/registry.js';
import type { WeatherData } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOCATION EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

function extractLocation(message: string): string | null {
  const patterns = [
    /weather\s+(?:in|at|for)\s+([A-Za-z\s]+?)(?:\?|$|,|\.|!)/i,
    /(?:in|at|for)\s+([A-Za-z\s]+?)\s+weather/i,
    /([A-Za-z\s]+?)\s+weather/i,
    /weather\s+([A-Za-z\s]+?)(?:\?|$)/i,
    /temperature\s+(?:in|at|for)\s+([A-Za-z\s]+?)(?:\?|$|,|\.|!)/i,
    /forecast\s+(?:in|at|for)\s+([A-Za-z\s]+?)(?:\?|$|,|\.|!)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const location = match[1].trim();
      const excluded = ['the', 'today', 'tomorrow', 'now', 'current', 'like', 'going'];
      if (!excluded.includes(location.toLowerCase()) && location.length > 1) {
        return location;
      }
    }
  }

  // Common city names
  const cities = [
    'new york', 'los angeles', 'chicago', 'houston', 'phoenix',
    'san francisco', 'seattle', 'denver', 'miami', 'boston',
    'london', 'paris', 'tokyo', 'sydney', 'berlin', 'toronto',
  ];

  const lower = message.toLowerCase();
  for (const city of cities) {
    if (lower.includes(city)) {
      return city;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

function formatWeatherEvidence(data: WeatherData): string {
  const parts = [
    `Weather in ${data.location}${data.country ? `, ${data.country}` : ''}`,
    `Conditions: ${data.condition}`,
    `Temperature: ${data.temperature}°${data.temperatureUnit}`,
  ];

  if (data.feelsLike !== undefined) {
    parts.push(`Feels Like: ${data.feelsLike}°${data.temperatureUnit}`);
  }

  if (data.humidity !== undefined) {
    parts.push(`Humidity: ${data.humidity}%`);
  }

  if (data.windSpeed !== undefined) {
    parts.push(`Wind: ${data.windSpeed} ${data.windUnit ?? 'mph'}${data.windDirection ? ` ${data.windDirection}` : ''}`);
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE
// ─────────────────────────────────────────────────────────────────────────────────

export async function execute(userMessage: string): Promise<EvidenceItem | null> {
  const location = extractLocation(userMessage);
  if (!location) {
    console.log('[WEATHER] No location found');
    return null;
  }

  const provider = getProviderForCategory('weather');
  if (!provider) {
    console.log('[WEATHER] No weather provider available');
    return null;
  }

  if (!provider.isAvailable()) {
    console.log('[WEATHER] Provider not available');
    return null;
  }

  try {
    const fetchResult = await provider.fetch({ query: location, bypassCache: true });
    const result = fetchResult.result;

    if (!result.ok) {
      console.log('[WEATHER] Fetch failed:', result.error?.message);
      return null;
    }

    const weatherData = result.data as WeatherData;

    return {
      type: 'weather',
      formatted: formatWeatherEvidence(weatherData),
      source: 'weather_fetcher',
      raw: weatherData,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    console.error('[WEATHER] Error:', error);
    return null;
  }
}
