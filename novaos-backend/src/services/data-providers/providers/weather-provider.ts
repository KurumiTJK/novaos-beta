// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER PROVIDER — OpenWeatherMap API (Requires API Key)
// PATCHED VERSION - Compatible with existing NovaOS types
// ═══════════════════════════════════════════════════════════════════════════════

import {
  BaseProvider,
  type ProviderFetchParams,
} from './base-provider.js';

import type {
  ProviderResult,
  WeatherData,
} from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const OPENWEATHERMAP_BASE_URL = 'https://api.openweathermap.org/data/2.5';

const CITY_ALIASES: Readonly<Record<string, string>> = {
  'NYC': 'New York,US', 'NY': 'New York,US', 'LA': 'Los Angeles,US',
  'SF': 'San Francisco,US', 'CHI': 'Chicago,US', 'PHILLY': 'Philadelphia,US',
  'VEGAS': 'Las Vegas,US', 'DC': 'Washington,US', 'LONDON UK': 'London,GB',
  'PARIS FRANCE': 'Paris,FR', 'TOKYO JAPAN': 'Tokyo,JP', 'SYDNEY AUSTRALIA': 'Sydney,AU',
  'HONG KONG': 'Hong Kong,HK', 'SINGAPORE': 'Singapore,SG', 'DUBAI UAE': 'Dubai,AE',
};

const WEATHER_CONDITIONS: Readonly<Record<number, string>> = {
  200: 'Thunderstorm with light rain', 201: 'Thunderstorm with rain', 211: 'Thunderstorm',
  300: 'Light drizzle', 301: 'Drizzle', 500: 'Light rain', 501: 'Moderate rain',
  502: 'Heavy rain', 600: 'Light snow', 601: 'Snow', 602: 'Heavy snow',
  701: 'Mist', 711: 'Smoke', 721: 'Haze', 741: 'Fog', 781: 'Tornado',
  800: 'Clear sky', 801: 'Few clouds', 802: 'Scattered clouds', 803: 'Broken clouds', 804: 'Overcast clouds',
};

// ─────────────────────────────────────────────────────────────────────────────────
// CITY NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * US state abbreviations - these should be converted to ",US" for OpenWeatherMap
 */
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', // District of Columbia
]);

/**
 * Full state names → abbreviations
 */
const STATE_NAMES: Readonly<Record<string, string>> = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
  'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
  'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
  'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
  'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
  'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
  'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
  'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
  'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC',
};

/**
 * Check if a string is a US state name and return its abbreviation
 */
function getStateAbbreviation(stateName: string): string | null {
  const upper = stateName.trim().toUpperCase();
  // Check if it's already an abbreviation
  if (US_STATES.has(upper)) {
    return upper;
  }
  // Check if it's a full state name
  return STATE_NAMES[upper] ?? null;
}

function normalizeCity(query: string): string {
  if (!query || typeof query !== 'string') return '';
  
  const trimmed = query.trim();
  const upper = trimmed.toUpperCase();
  
  // Check direct aliases first (NYC, LA, SF, etc.)
  const aliased = CITY_ALIASES[upper];
  if (aliased) return aliased;
  
  const normalized = upper.replace(/\s+/g, ' ');
  const aliasedNormalized = CITY_ALIASES[normalized];
  if (aliasedNormalized) return aliasedNormalized;
  
  // Handle "City, STATE" or "City, State Name" format
  const commaMatch = trimmed.match(/^(.+?),\s*(.+)$/);
  if (commaMatch && commaMatch[1] && commaMatch[2]) {
    const city = commaMatch[1].trim();
    const stateOrCountry = commaMatch[2].trim();
    
    // Check if second part is a US state (abbrev or full name)
    const stateAbbr = getStateAbbreviation(stateOrCountry);
    if (stateAbbr) {
      return `${city},US`;
    }
    
    // If 2-3 letter code, assume country code
    if (/^[A-Za-z]{2,3}$/.test(stateOrCountry)) {
      return `${city},${stateOrCountry.toUpperCase()}`;
    }
    
    // Otherwise pass through as-is (might be "City, Country Name")
    return trimmed;
  }
  
  // Handle "City State" or "City StateName" format without comma
  // Try to find a state name at the end
  const upperTrimmed = trimmed.toUpperCase();
  
  // Check for full state names at END first (e.g., "Irvine California")
  for (const [stateName, abbr] of Object.entries(STATE_NAMES)) {
    if (upperTrimmed.endsWith(` ${stateName}`)) {
      const city = trimmed.slice(0, -(stateName.length + 1)).trim();
      return `${city},US`;
    }
  }
  
  // Check for full state names at START (e.g., "California Irvine")
  for (const [stateName, abbr] of Object.entries(STATE_NAMES)) {
    if (upperTrimmed.startsWith(`${stateName} `)) {
      const city = trimmed.slice(stateName.length + 1).trim();
      return `${city},US`;
    }
  }
  
  // Check for state abbreviations at end (e.g., "Irvine CA")
  const stateAbbrEndMatch = trimmed.match(/^(.+?)\s+([A-Za-z]{2})$/);
  if (stateAbbrEndMatch && stateAbbrEndMatch[1] && stateAbbrEndMatch[2]) {
    const city = stateAbbrEndMatch[1].trim();
    const state = stateAbbrEndMatch[2].toUpperCase();
    
    if (US_STATES.has(state)) {
      return `${city},US`;
    }
  }
  
  // Check for state abbreviations at start (e.g., "CA Irvine")
  const stateAbbrStartMatch = trimmed.match(/^([A-Za-z]{2})\s+(.+)$/);
  if (stateAbbrStartMatch && stateAbbrStartMatch[1] && stateAbbrStartMatch[2]) {
    const state = stateAbbrStartMatch[1].toUpperCase();
    const city = stateAbbrStartMatch[2].trim();
    
    if (US_STATES.has(state)) {
      return `${city},US`;
    }
  }
  
  return trimmed;
}

function getSuggestedCities(): readonly string[] {
  return ['New York', 'Los Angeles', 'London', 'Paris', 'Tokyo', 'Sydney'];
}

// ─────────────────────────────────────────────────────────────────────────────────
// UNIT CONVERSIONS
// ─────────────────────────────────────────────────────────────────────────────────

function kelvinToCelsius(kelvin: number): number {
  return Math.round((kelvin - 273.15) * 10) / 10;
}

function kelvinToFahrenheit(kelvin: number): number {
  return Math.round(((kelvin - 273.15) * 9/5 + 32) * 10) / 10;
}

function msToKmh(ms: number): number {
  return Math.round(ms * 3.6 * 10) / 10;
}

function msToMph(ms: number): number {
  return Math.round(ms * 2.237 * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────────
// WEATHER PROVIDER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export interface WeatherProviderConfig {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly apiKey?: string;
}

export class WeatherProvider extends BaseProvider {
  readonly name = 'openweathermap';
  readonly categories = ['weather'] as const;
  readonly reliabilityTier = 'official' as const;
  
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string | undefined;
  
  constructor(config?: WeatherProviderConfig) {
    super();
    this.baseUrl = config?.baseUrl ?? OPENWEATHERMAP_BASE_URL;
    this.timeoutMs = config?.timeoutMs ?? 10000;
    this.apiKey = config?.apiKey ?? process.env.OPENWEATHERMAP_API_KEY;
  }
  
  override isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  protected async fetchInternal(params: ProviderFetchParams): Promise<ProviderResult> {
    const { query } = params;
    const startTime = Date.now();
    
    if (!this.apiKey) {
      return this.createFailResult(
        'API_KEY_MISSING',
        'OpenWeatherMap API key not configured. Set OPENWEATHERMAP_API_KEY environment variable.',
        false
      );
    }
    
    if (!query || query.trim().length === 0) {
      return this.createFailResult(
        'INVALID_CITY',
        `City name required. Examples: ${getSuggestedCities().slice(0, 3).join(', ')}`,
        false
      );
    }
    
    const city = normalizeCity(query);
    const url = new URL(`${this.baseUrl}/weather`);
    url.searchParams.set('q', city);
    url.searchParams.set('appid', this.apiKey);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? this.timeoutMs);
      
      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': 'NovaOS/1.0' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (!response.ok) {
        if (response.status === 404) {
          return this.createFailResult('CITY_NOT_FOUND', `City not found: "${query}". Try adding country code.`, false);
        }
        if (response.status === 429) {
          return this.createFailResult('RATE_LIMITED', 'OpenWeatherMap rate limit exceeded', true, 60);
        }
        if (response.status === 401) {
          return this.createFailResult('UNAUTHORIZED', 'Invalid OpenWeatherMap API key', false);
        }
        return this.createFailResult(
          `HTTP_${response.status}`,
          `OpenWeatherMap API error: ${response.status} ${response.statusText}`,
          response.status >= 500
        );
      }
      
      interface OWMResponse {
        coord: { lon: number; lat: number };
        weather: Array<{ id: number; main: string; description: string; icon: string }>;
        main: { temp: number; feels_like: number; temp_min: number; temp_max: number; pressure: number; humidity: number };
        visibility: number;
        wind: { speed: number; deg: number; gust?: number };
        clouds: { all: number };
        dt: number;
        sys: { country: string; sunrise: number; sunset: number };
        name: string;
      }
      
      const data = await response.json() as OWMResponse;
      const weatherCondition = data.weather[0];
      const conditionId = weatherCondition?.id ?? 800;
      const description = WEATHER_CONDITIONS[conditionId] ?? weatherCondition?.description ?? 'Unknown';
      
      // Build WeatherData matching the actual interface
      const weatherData: WeatherData = {
        type: 'weather',
        location: data.name,
        latitude: data.coord.lat,
        longitude: data.coord.lon,
        temperatureCelsius: kelvinToCelsius(data.main.temp),
        temperatureFahrenheit: kelvinToFahrenheit(data.main.temp),
        feelsLikeCelsius: kelvinToCelsius(data.main.feels_like),
        feelsLikeFahrenheit: kelvinToFahrenheit(data.main.feels_like),
        humidity: data.main.humidity,
        windSpeedKph: msToKmh(data.wind.speed),
        windSpeedMph: msToMph(data.wind.speed),
        windDirection: this.getWindDirection(data.wind.deg),
        condition: description,
        conditionCode: String(conditionId),
        pressure: data.main.pressure,
        visibility: Math.round(data.visibility / 1000), // Convert to km
        isDay: this.isDay(data.sys.sunrise, data.sys.sunset, data.dt),
        uvIndex: undefined, // Not available in free tier
      };
      
      const latencyMs = Date.now() - startTime;
      return this.createOkResult(weatherData, latencyMs);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.createFailResult('TIMEOUT', `Request timed out after ${this.timeoutMs}ms`, true);
      }
      return this.createFailResult(
        'FETCH_ERROR',
        `Failed to fetch weather: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }
  
  private getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index] ?? 'N';
  }
  
  private isDay(sunrise: number, sunset: number, current: number): boolean {
    return current >= sunrise && current < sunset;
  }
  
  protected override getCacheKey(params: ProviderFetchParams): string {
    const city = normalizeCity(params.query).toLowerCase().replace(/[,\s]+/g, '-');
    return `${this.name}:${city}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  normalizeCity,
  getSuggestedCities,
  kelvinToCelsius,
  kelvinToFahrenheit,
  msToKmh,
  msToMph,
  CITY_ALIASES,
  WEATHER_CONDITIONS,
};
