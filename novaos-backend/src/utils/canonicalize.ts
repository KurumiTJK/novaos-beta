// ═══════════════════════════════════════════════════════════════════════════════
// CANONICALIZATION UTILITIES — Numeric String Normalization
// Critical for LeakGuard: ensures consistent numeric comparison across formats
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Currency symbols to strip during canonicalization.
 */
const CURRENCY_SYMBOLS = new Set([
  '$', '€', '£', '¥', '₹', '₽', '₩', '฿', '₫', '₴', '₱', '₦', '₺', '₵',
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'RUB', 'KRW', 'BTC', 'ETH',
]);

/**
 * Characters that represent negative values.
 */
const NEGATIVE_INDICATORS = new Set([
  '-',   // Standard hyphen-minus
  '−',   // Unicode minus sign (U+2212)
  '–',   // En dash (sometimes used as minus)
  '—',   // Em dash (rare but possible)
]);

/**
 * Thousands separators by locale convention.
 */
const THOUSANDS_SEPARATORS = new Set([',', ' ', "'", '٬']);

/**
 * Decimal separators by locale convention.
 */
const DECIMAL_SEPARATORS = new Set(['.', ',']);

// ─────────────────────────────────────────────────────────────────────────────────
// CORE CANONICALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Canonicalize a numeric string for comparison.
 * 
 * Transforms various numeric representations to a standard form:
 * - "$178.50," → "178.50"
 * - "(−1.23%)" → "-1.23"
 * - "1 234.56" → "1234.56"
 * - "€ 1.234,56" → "1234.56"
 * - "+5.00" → "5"
 * 
 * @param input - The numeric string to canonicalize
 * @returns Canonical form: [-]digits[.digits] or empty string if not numeric
 */
export function canonicalizeNumeric(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let s = input.trim();
  
  // Handle empty string
  if (s.length === 0) {
    return '';
  }

  // Track if negative
  let isNegative = false;

  // Check for parentheses indicating negative: (123.45)
  if (s.startsWith('(') && s.endsWith(')')) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  }

  // Remove currency symbols (both single chars and abbreviations)
  for (const symbol of CURRENCY_SYMBOLS) {
    if (s.startsWith(symbol)) {
      s = s.slice(symbol.length).trim();
    }
    if (s.endsWith(symbol)) {
      s = s.slice(0, -symbol.length).trim();
    }
  }

  // Check for leading negative indicator
  for (const neg of NEGATIVE_INDICATORS) {
    if (s.startsWith(neg)) {
      isNegative = true;
      s = s.slice(neg.length).trim();
      break;
    }
  }

  // Check for trailing negative (rare: "123.45-")
  for (const neg of NEGATIVE_INDICATORS) {
    if (s.endsWith(neg)) {
      isNegative = true;
      s = s.slice(0, -neg.length).trim();
      break;
    }
  }

  // Remove plus sign (positive indicator)
  if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }

  // Remove percentage sign (we keep the number, caller tracks context)
  if (s.endsWith('%')) {
    s = s.slice(0, -1).trim();
  }

  // Remove common trailing punctuation
  s = s.replace(/[,;:]+$/, '');

  // Detect decimal separator by analyzing the string
  // European format: 1.234,56 (dot for thousands, comma for decimal)
  // US format: 1,234.56 (comma for thousands, dot for decimal)
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  let decimalPos = -1;
  let thousandsSep: string | null = null;

  if (lastDot > lastComma) {
    // Dot comes after comma: US format (1,234.56)
    decimalPos = lastDot;
    thousandsSep = ',';
  } else if (lastComma > lastDot) {
    // Comma comes after dot: European format (1.234,56)
    // But only if the part after comma is <= 3 digits (decimal portion)
    const afterComma = s.slice(lastComma + 1);
    if (/^\d{1,3}$/.test(afterComma) && lastDot !== -1) {
      // European format
      decimalPos = lastComma;
      thousandsSep = '.';
    } else if (/^\d+$/.test(afterComma)) {
      // Could be European decimal or US thousands
      // If there are exactly 3 digits after and more digits before, it's US thousands
      if (afterComma.length === 3 && lastComma > 0) {
        // Likely US format thousands separator
        thousandsSep = ',';
        decimalPos = -1;
      } else {
        // Likely European decimal
        decimalPos = lastComma;
        thousandsSep = '.';
      }
    }
  } else if (lastDot !== -1) {
    // Only dots present
    const parts = s.split('.');
    if (parts.length === 2) {
      // Single dot - decimal separator
      decimalPos = lastDot;
    } else {
      // Multiple dots - thousands separator (1.234.567)
      thousandsSep = '.';
      decimalPos = -1;
    }
  } else if (lastComma !== -1) {
    // Only commas present
    const parts = s.split(',');
    if (parts.length === 2 && (parts[1]?.length ?? 0) <= 3) {
      // Single comma with <= 3 digits after - likely decimal
      decimalPos = lastComma;
    } else {
      // Multiple commas or 3+ digits after - thousands separator
      thousandsSep = ',';
      decimalPos = -1;
    }
  }

  // Extract integer and decimal parts
  let integerPart: string;
  let decimalPart = '';

  if (decimalPos !== -1) {
    integerPart = s.slice(0, decimalPos);
    decimalPart = s.slice(decimalPos + 1);
  } else {
    integerPart = s;
  }

  // Remove all thousands separators and spaces from integer part
  integerPart = integerPart.replace(/[,.\s'٬]/g, '');

  // Remove any non-digit characters that slipped through
  integerPart = integerPart.replace(/\D/g, '');
  decimalPart = decimalPart.replace(/\D/g, '');

  // Handle empty integer part
  if (integerPart.length === 0) {
    if (decimalPart.length === 0) {
      return '';
    }
    integerPart = '0';
  }

  // Remove leading zeros from integer part (except for "0" itself)
  integerPart = integerPart.replace(/^0+/, '') || '0';

  // Remove trailing zeros from decimal part
  decimalPart = decimalPart.replace(/0+$/, '');

  // Build canonical form
  let result = integerPart;
  if (decimalPart.length > 0) {
    result += '.' + decimalPart;
  }

  // Apply negative sign
  if (isNegative && result !== '0') {
    result = '-' + result;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NUMERIC EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract a numeric value from a string.
 * 
 * @param input - The string containing a number
 * @returns The extracted number, or NaN if extraction fails
 */
export function extractNumericValue(input: string): number {
  const canonical = canonicalizeNumeric(input);
  if (canonical === '') {
    return NaN;
  }
  return parseFloat(canonical);
}

/**
 * Check if a string contains a valid numeric value.
 * 
 * @param input - The string to check
 * @returns True if the string can be parsed as a number
 */
export function isNumericString(input: string): boolean {
  const value = extractNumericValue(input);
  return !isNaN(value) && isFinite(value);
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPARISON
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Compare two numeric strings for equality after canonicalization.
 * 
 * @param a - First numeric string
 * @param b - Second numeric string
 * @returns True if the canonical forms are equal
 */
export function numericEquals(a: string, b: string): boolean {
  const canonA = canonicalizeNumeric(a);
  const canonB = canonicalizeNumeric(b);
  
  // Empty strings are not equal to anything (including each other)
  if (canonA === '' || canonB === '') {
    return false;
  }
  
  return canonA === canonB;
}

/**
 * Compare two numeric strings with tolerance for floating point precision.
 * 
 * @param a - First numeric string
 * @param b - Second numeric string
 * @param tolerance - Maximum allowed difference (default: 0.0001)
 * @returns True if the values are within tolerance
 */
export function numericApproxEquals(
  a: string,
  b: string,
  tolerance: number = 0.0001
): boolean {
  const valueA = extractNumericValue(a);
  const valueB = extractNumericValue(b);
  
  if (isNaN(valueA) || isNaN(valueB)) {
    return false;
  }
  
  return Math.abs(valueA - valueB) <= tolerance;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VARIANT GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for generating canonical variants.
 */
export interface VariantOptions {
  /** Include currency symbol variants */
  includeCurrency?: boolean;
  /** Currency symbols to use (default: $, €) */
  currencySymbols?: string[];
  /** Include percentage variant */
  includePercentage?: boolean;
  /** Include negative variants (parentheses, minus) */
  includeNegative?: boolean;
  /** Include thousands separator variants */
  includeThousandsSeparators?: boolean;
  /** Maximum decimal places to include */
  maxDecimalPlaces?: number;
  /** Include sign for positive numbers */
  includePositiveSign?: boolean;
}

const DEFAULT_VARIANT_OPTIONS: Required<VariantOptions> = {
  includeCurrency: false,
  currencySymbols: ['$'],
  includePercentage: false,
  includeNegative: false,
  includeThousandsSeparators: true,
  maxDecimalPlaces: 2,
  includePositiveSign: false,
};

/**
 * Generate all valid string representations of a numeric value.
 * Used by LeakGuard to match numbers in various formats.
 * 
 * @param value - The numeric value
 * @param options - Generation options
 * @returns Array of string variants
 */
export function generateCanonicalVariants(
  value: number,
  options: VariantOptions = {}
): string[] {
  const opts = { ...DEFAULT_VARIANT_OPTIONS, ...options };
  const variants = new Set<string>();
  
  if (isNaN(value) || !isFinite(value)) {
    return [];
  }
  
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  // Generate base representations with different decimal places
  const decimalVariants: string[] = [];
  
  // Integer if whole number
  if (Number.isInteger(absValue)) {
    decimalVariants.push(absValue.toString());
  }
  
  // Various decimal place formats
  for (let dp = 0; dp <= opts.maxDecimalPlaces; dp++) {
    const formatted = absValue.toFixed(dp);
    decimalVariants.push(formatted);
    
    // Also add version without trailing zeros
    const trimmed = parseFloat(formatted).toString();
    if (trimmed !== formatted) {
      decimalVariants.push(trimmed);
    }
  }
  
  // Deduplicate decimal variants
  const uniqueDecimals = [...new Set(decimalVariants)];
  
  for (const base of uniqueDecimals) {
    // Add plain number
    addVariant(variants, base, isNegative, opts);
    
    // Add with thousands separators
    if (opts.includeThousandsSeparators) {
      const withCommas = addThousandsSeparator(base, ',');
      const withSpaces = addThousandsSeparator(base, ' ');
      const withDots = addThousandsSeparator(base, '.');
      
      if (withCommas !== base) {
        addVariant(variants, withCommas, isNegative, opts);
      }
      if (withSpaces !== base) {
        addVariant(variants, withSpaces, isNegative, opts);
      }
      // European format with dot thousands and comma decimal
      if (withDots !== base && base.includes('.')) {
        const european = withDots.replace(/\.(?=\d{1,2}$)/, ',');
        addVariant(variants, european, isNegative, opts);
      }
    }
  }
  
  return [...variants];
}

/**
 * Add a variant with negative/positive sign variations.
 */
function addVariant(
  variants: Set<string>,
  base: string,
  isNegative: boolean,
  opts: Required<VariantOptions>
): void {
  if (isNegative && opts.includeNegative) {
    // Standard minus
    variants.add('-' + base);
    variants.add('−' + base); // Unicode minus
    
    // Parentheses
    variants.add('(' + base + ')');
    
    // With currency
    if (opts.includeCurrency) {
      for (const symbol of opts.currencySymbols) {
        variants.add('-' + symbol + base);
        variants.add(symbol + '-' + base);
        variants.add('(' + symbol + base + ')');
        variants.add(symbol + '(' + base + ')');
      }
    }
    
    // With percentage
    if (opts.includePercentage) {
      variants.add('-' + base + '%');
      variants.add('(' + base + '%)');
    }
  } else {
    // Positive number
    variants.add(base);
    
    if (opts.includePositiveSign) {
      variants.add('+' + base);
    }
    
    // With currency
    if (opts.includeCurrency) {
      for (const symbol of opts.currencySymbols) {
        variants.add(symbol + base);
        variants.add(base + ' ' + symbol);
        if (opts.includePositiveSign) {
          variants.add('+' + symbol + base);
        }
      }
    }
    
    // With percentage
    if (opts.includePercentage) {
      variants.add(base + '%');
      if (opts.includePositiveSign) {
        variants.add('+' + base + '%');
      }
    }
  }
}

/**
 * Add thousands separator to a number string.
 */
function addThousandsSeparator(numStr: string, separator: string): string {
  const parts = numStr.split('.');
  const intPart = parts[0] ?? '';
  const decPart = parts[1];
  
  // Add separators from right to left
  let result = '';
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && i % 3 === 0) {
      result = separator + result;
    }
    result = intPart[intPart.length - 1 - i] + result;
  }
  
  if (decPart !== undefined) {
    result += '.' + decPart;
  }
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format a number for display with specified options.
 * 
 * @param value - The numeric value
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatNumeric(
  value: number,
  options: {
    decimalPlaces?: number;
    thousandsSeparator?: string;
    decimalSeparator?: string;
    prefix?: string;
    suffix?: string;
  } = {}
): string {
  const {
    decimalPlaces = 2,
    thousandsSeparator = ',',
    decimalSeparator = '.',
    prefix = '',
    suffix = '',
  } = options;
  
  const fixed = Math.abs(value).toFixed(decimalPlaces);
  const parts = fixed.split('.');
  
  // Add thousands separators
  const intPart = addThousandsSeparator(parts[0] ?? '0', thousandsSeparator);
  
  let result = intPart;
  if (parts[1]) {
    result += decimalSeparator + parts[1];
  }
  
  if (value < 0) {
    result = '-' + result;
  }
  
  return prefix + result + suffix;
}

/**
 * Extract all numbers from a text string.
 * 
 * @param text - The text to search
 * @returns Array of extracted numbers with their positions
 */
export function extractAllNumbers(text: string): Array<{
  value: number;
  original: string;
  canonical: string;
  startIndex: number;
  endIndex: number;
}> {
  const results: Array<{
    value: number;
    original: string;
    canonical: string;
    startIndex: number;
    endIndex: number;
  }> = [];
  
  // Pattern to match various number formats
  // Includes: currency, negatives, decimals, thousands separators, percentages
  const numberPattern = /[$€£¥₹]?\s*[−\-+]?\s*\(?\d[\d,.\s']*\d?\)?%?|\d+(?:\.\d+)?%?/g;
  
  let match;
  while ((match = numberPattern.exec(text)) !== null) {
    const original = match[0];
    const canonical = canonicalizeNumeric(original);
    const value = extractNumericValue(original);
    
    if (!isNaN(value)) {
      results.push({
        value,
        original,
        canonical,
        startIndex: match.index,
        endIndex: match.index + original.length,
      });
    }
  }
  
  return results;
}
