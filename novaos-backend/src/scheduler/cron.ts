// ═══════════════════════════════════════════════════════════════════════════════
// CRON PARSER — Simple Cron Expression Parser
// ═══════════════════════════════════════════════════════════════════════════════
//
// Supports standard 5-field cron expressions:
//   minute hour dayOfMonth month dayOfWeek
//
// Special characters:
//   * - any value
//   , - list separator (1,15,30)
//   - - range (1-5)
//   / - step values (*/15)
//
// Examples:
//   '* * * * *'      - Every minute
//   '0 * * * *'      - Top of every hour
//   '0 0 * * *'      - Midnight daily
//   '0 3 * * 0'      - 3 AM every Sunday
//   '*/15 * * * *'   - Every 15 minutes
//   '0 9-17 * * 1-5' - 9 AM to 5 PM, Mon-Fri
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface CronFields {
  minute: number[];      // 0-59
  hour: number[];        // 0-23
  dayOfMonth: number[];  // 1-31
  month: number[];       // 1-12
  dayOfWeek: number[];   // 0-6 (Sunday = 0)
}

export interface ParsedCron {
  expression: string;
  fields: CronFields;
  valid: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FIELD DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────

interface FieldDef {
  min: number;
  max: number;
  name: string;
}

const FIELD_DEFS: FieldDef[] = [
  { min: 0, max: 59, name: 'minute' },
  { min: 0, max: 23, name: 'hour' },
  { min: 1, max: 31, name: 'dayOfMonth' },
  { min: 1, max: 12, name: 'month' },
  { min: 0, max: 6, name: 'dayOfWeek' },
];

// Day name aliases
const DAY_NAMES: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

// Month name aliases
const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

// ─────────────────────────────────────────────────────────────────────────────────
// FIELD PARSER
// ─────────────────────────────────────────────────────────────────────────────────

function parseField(
  field: string,
  def: FieldDef,
  aliases?: Record<string, number>
): number[] {
  const values = new Set<number>();
  
  // Replace aliases
  let normalized = field.toLowerCase();
  if (aliases) {
    for (const [name, value] of Object.entries(aliases)) {
      normalized = normalized.replace(new RegExp(`\\b${name}\\b`, 'g'), String(value));
    }
  }
  
  // Split by comma for lists
  const parts = normalized.split(',');
  
  for (const part of parts) {
    // Handle step values (*/15 or 1-10/2)
    const [range, stepStr] = part.split('/');
    const step = stepStr ? parseInt(stepStr, 10) : 1;
    
    if (isNaN(step) || step < 1) {
      throw new Error(`Invalid step value in ${def.name}: ${part}`);
    }
    
    // Handle wildcard
    if (range === '*') {
      for (let i = def.min; i <= def.max; i += step) {
        values.add(i);
      }
      continue;
    }
    
    // Handle range (1-5)
    if (range?.includes('-')) {
      const [startStr, endStr] = range.split('-');
      const start = parseInt(startStr ?? '', 10);
      const end = parseInt(endStr ?? '', 10);
      
      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid range in ${def.name}: ${range}`);
      }
      
      if (start < def.min || end > def.max || start > end) {
        throw new Error(`Range out of bounds in ${def.name}: ${range}`);
      }
      
      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
      continue;
    }
    
    // Handle single value
    const value = parseInt(range ?? '', 10);
    if (isNaN(value) || value < def.min || value > def.max) {
      throw new Error(`Invalid value in ${def.name}: ${range}`);
    }
    values.add(value);
  }
  
  return Array.from(values).sort((a, b) => a - b);
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN PARSER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Parse a cron expression into its component fields.
 */
export function parseCron(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/);
  
  if (parts.length !== 5) {
    return {
      expression,
      fields: { minute: [], hour: [], dayOfMonth: [], month: [], dayOfWeek: [] },
      valid: false,
      error: `Expected 5 fields, got ${parts.length}`,
    };
  }
  
  try {
    const fields: CronFields = {
      minute: parseField(parts[0]!, FIELD_DEFS[0]!),
      hour: parseField(parts[1]!, FIELD_DEFS[1]!),
      dayOfMonth: parseField(parts[2]!, FIELD_DEFS[2]!),
      month: parseField(parts[3]!, FIELD_DEFS[3]!, MONTH_NAMES),
      dayOfWeek: parseField(parts[4]!, FIELD_DEFS[4]!, DAY_NAMES),
    };
    
    return { expression, fields, valid: true };
  } catch (error) {
    return {
      expression,
      fields: { minute: [], hour: [], dayOfMonth: [], month: [], dayOfWeek: [] },
      valid: false,
      error: error instanceof Error ? error.message : 'Parse error',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// MATCHING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a date matches the cron expression.
 */
export function matchesCron(date: Date, cron: ParsedCron): boolean {
  if (!cron.valid) return false;
  
  const { fields } = cron;
  
  return (
    fields.minute.includes(date.getMinutes()) &&
    fields.hour.includes(date.getHours()) &&
    fields.dayOfMonth.includes(date.getDate()) &&
    fields.month.includes(date.getMonth() + 1) &&
    fields.dayOfWeek.includes(date.getDay())
  );
}

/**
 * Check if a cron expression should trigger at the current time.
 * Compares current time (truncated to minute) with cron fields.
 */
export function shouldRunNow(expression: string, now?: Date): boolean {
  const parsed = parseCron(expression);
  if (!parsed.valid) return false;
  
  const date = now ?? new Date();
  return matchesCron(date, parsed);
}

// ─────────────────────────────────────────────────────────────────────────────────
// NEXT RUN CALCULATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the next run time for a cron expression.
 * 
 * @param expression - Cron expression
 * @param from - Start date (defaults to now)
 * @param maxIterations - Max minutes to search (defaults to 525600 = 1 year)
 * @returns Next run date or null if not found
 */
export function getNextRun(
  expression: string,
  from?: Date,
  maxIterations: number = 525600
): Date | null {
  const parsed = parseCron(expression);
  if (!parsed.valid) return null;
  
  // Start from next minute
  const current = from ? new Date(from) : new Date();
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);
  
  for (let i = 0; i < maxIterations; i++) {
    if (matchesCron(current, parsed)) {
      return current;
    }
    current.setMinutes(current.getMinutes() + 1);
  }
  
  return null;
}

/**
 * Calculate time until next run in milliseconds.
 */
export function getTimeUntilNextRun(expression: string, from?: Date): number | null {
  const nextRun = getNextRun(expression, from);
  if (!nextRun) return null;
  
  const now = from ?? new Date();
  return nextRun.getTime() - now.getTime();
}

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEDULE HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Common cron expressions.
 */
export const CRON_PRESETS = {
  EVERY_MINUTE: '* * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_2_HOURS: '0 */2 * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  EVERY_12_HOURS: '0 */12 * * *',
  DAILY_MIDNIGHT: '0 0 * * *',
  DAILY_3AM: '0 3 * * *',
  DAILY_9AM: '0 9 * * *',
  WEEKLY_SUNDAY: '0 0 * * 0',
  WEEKLY_MONDAY: '0 0 * * 1',
  MONTHLY_FIRST: '0 0 1 * *',
} as const;

/**
 * Describe a cron expression in human-readable format.
 */
export function describeCron(expression: string): string {
  const parsed = parseCron(expression);
  if (!parsed.valid) return `Invalid: ${parsed.error}`;
  
  const { fields } = parsed;
  
  // Simple cases
  if (expression === CRON_PRESETS.EVERY_MINUTE) return 'Every minute';
  if (fields.minute.length === 1 && fields.minute[0] === 0 && 
      fields.hour.length === 24) return 'Every hour at :00';
  if (fields.minute.length === 1 && fields.minute[0] === 0 &&
      fields.hour.length === 1 && fields.hour[0] === 0 &&
      fields.dayOfMonth.length === 31 && fields.dayOfWeek.length === 7) {
    return 'Daily at midnight';
  }
  
  // Build description
  const parts: string[] = [];
  
  // Minutes
  if (fields.minute.length === 60) {
    parts.push('Every minute');
  } else if (fields.minute.length === 1) {
    parts.push(`At minute ${fields.minute[0]}`);
  } else {
    parts.push(`At minutes ${fields.minute.join(',')}`);
  }
  
  // Hours
  if (fields.hour.length !== 24) {
    if (fields.hour.length === 1) {
      parts.push(`of hour ${fields.hour[0]}`);
    } else {
      parts.push(`of hours ${fields.hour.join(',')}`);
    }
  }
  
  // Day of week
  if (fields.dayOfWeek.length !== 7) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = fields.dayOfWeek.map(d => dayNames[d]).join(',');
    parts.push(`on ${days}`);
  }
  
  return parts.join(' ');
}
