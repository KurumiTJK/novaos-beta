// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTING — Deterministic Number Formatting
// PATCHED STUB: Provides exports needed by numeric-tokens.ts
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Temperature unit.
 */
export type TemperatureUnit = 'C' | 'F';

/**
 * Speed unit.
 */
export type SpeedUnit = 'mph' | 'kph';

// ─────────────────────────────────────────────────────────────────────────────────
// CURRENCY CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Currency symbols map.
 */
export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  CHF: 'CHF',
  CAD: 'C$',
  AUD: 'A$',
  NZD: 'NZ$',
  INR: '₹',
  BTC: '₿',
  ETH: 'Ξ',
};

/**
 * Decimal places for currencies.
 */
export const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  CNY: 2,
  CHF: 2,
  CAD: 2,
  AUD: 2,
  BTC: 8,
  ETH: 8,
};

// ─────────────────────────────────────────────────────────────────────────────────
// BASIC FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format number with commas.
 */
export function formatWithCommas(value: number, decimals: number = 0): string {
  const fixed = value.toFixed(decimals);
  const [whole, frac] = fixed.split('.');
  const withCommas = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${withCommas}.${frac}` : withCommas;
}

/**
 * Format currency value.
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const formatted = formatWithCommas(Math.abs(value), decimals);
  return value < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/**
 * Format percent value.
 */
export function formatPercent(value: number, decimals: number = 2, showSign: boolean = false): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format currency change (with sign).
 */
export function formatCurrencyChange(value: number, currency: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const formatted = formatWithCommas(Math.abs(value), decimals);
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${symbol}${formatted}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TEMPERATURE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format temperature.
 */
export function formatTemperature(value: number, unit: TemperatureUnit = 'C'): string {
  const rounded = Math.round(value);
  return `${rounded}°${unit}`;
}

/**
 * Format temperature with both units.
 */
export function formatTemperatureDual(celsius: number, fahrenheit: number): string {
  return `${Math.round(celsius)}°C (${Math.round(fahrenheit)}°F)`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPEED FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format speed value.
 */
export function formatSpeed(value: number, unit: SpeedUnit = 'kph'): string {
  return `${Math.round(value)} ${unit}`;
}

/**
 * Format wind speed.
 */
export function formatWindSpeed(value: number, unit: SpeedUnit = 'kph'): string {
  return formatSpeed(value, unit);
}

// ─────────────────────────────────────────────────────────────────────────────────
// TIME FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format time in 12-hour format.
 */
export function formatTime12(time: string): string {
  const match = time.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return time;
  
  let hours = parseInt(match[1]!, 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Format time in 24-hour format.
 */
export function formatTime24(time: string): string {
  const match = time.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return time;
  return `${match[1]}:${match[2]}`;
}

/**
 * Format time with timezone.
 */
export function formatTimeWithZone(
  time: string,
  zone: string,
  format: '12h' | '24h' = '12h'
): string {
  const formatted = format === '12h' ? formatTime12(time) : formatTime24(time);
  return `${formatted} ${zone}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// WEATHER FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format pressure.
 */
export function formatPressure(value: number, unit: string = 'mb'): string {
  return `${Math.round(value)} ${unit}`;
}

/**
 * Format humidity.
 */
export function formatHumidity(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Format UV index.
 */
export function formatUvIndex(value: number): string {
  const level = value <= 2 ? 'Low' : value <= 5 ? 'Moderate' : value <= 7 ? 'High' : 'Very High';
  return `${value} (${level})`;
}

/**
 * Format visibility.
 */
export function formatVisibility(value: number, unit: string = 'km'): string {
  return `${value.toFixed(1)} ${unit}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LARGE NUMBER FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format large number with abbreviation.
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

/**
 * Format market cap.
 */
export function formatMarketCap(value: number, currency: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol}${formatLargeNumber(value)}`;
}

/**
 * Format trading volume.
 */
export function formatVolume(value: number): string {
  return formatLargeNumber(value);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXCHANGE RATE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format exchange rate.
 */
export function formatExchangeRate(
  rate: number,
  baseCurrency: string,
  quoteCurrency: string
): string {
  const decimals = rate < 1 ? 6 : rate < 10 ? 4 : 2;
  return `1 ${baseCurrency} = ${rate.toFixed(decimals)} ${quoteCurrency}`;
}

/**
 * Format generic rate.
 */
export function formatRate(value: number, decimals: number = 4): string {
  return value.toFixed(decimals);
}

// ─────────────────────────────────────────────────────────────────────────────────
// CRYPTO FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format crypto price.
 */
export function formatCryptoPrice(value: number, currency: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const decimals = value < 1 ? 6 : value < 10 ? 4 : 2;
  return `${symbol}${formatWithCommas(value, decimals)}`;
}

/**
 * Format crypto supply.
 */
export function formatSupply(value: number): string {
  return formatLargeNumber(value);
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get decimal places from a number.
 */
export function getDecimalPlaces(value: number): number {
  const str = value.toString();
  const dotIndex = str.indexOf('.');
  return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
}

/**
 * Round to significant digits.
 */
export function roundToSignificant(value: number, digits: number = 3): number {
  if (value === 0) return 0;
  const factor = Math.pow(10, digits - Math.ceil(Math.log10(Math.abs(value))));
  return Math.round(value * factor) / factor;
}

/**
 * Check if number should be abbreviated.
 */
export function shouldAbbreviate(value: number): boolean {
  return Math.abs(value) >= 1e6;
}
