// ═══════════════════════════════════════════════════════════════════════════════
// TIMEZONE UTILITIES
// User-local date handling for learning schedules
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// USER TIMEZONE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get user's timezone from settings
 */
export async function getUserTimezone(userId: string): Promise<string> {
  if (!isSupabaseInitialized()) {
    return 'UTC';
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('settings')
      .select('timezone')
      .eq('user_id', userId)
      .single();

    if (error || !data?.timezone) {
      return 'UTC';
    }

    return data.timezone;
  } catch {
    return 'UTC';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// DATE CALCULATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get today's date in user's timezone as YYYY-MM-DD
 */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // Returns YYYY-MM-DD
}

/**
 * Get current time in user's timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  const tzString = now.toLocaleString('en-US', { timeZone: timezone });
  return new Date(tzString);
}

/**
 * Add days to a date string
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  const isoString = date.toISOString();
  const datePart = isoString.split('T')[0];
  return datePart ?? dateStr; // Fallback to original if split fails
}

/**
 * Calculate difference in days between two dates
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate day number within a plan
 * Day 1 = first day of plan
 */
export function calculateDayNumber(
  planStartDate: string,
  currentDate: string
): number {
  return daysBetween(planStartDate, currentDate) + 1;
}

/**
 * Get dates for prefetch (next N days)
 */
export function getPrefetchDates(timezone: string, days: number): string[] {
  const today = getTodayInTimezone(timezone);
  const dates: string[] = [];
  
  for (let i = 1; i <= days; i++) {
    dates.push(addDays(today, i));
  }
  
  return dates;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GAP DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

const GAP_THRESHOLD_DAYS = 7;

/**
 * Check if there's a learning gap requiring refresh
 */
export function checkLearningGap(lastSessionAt: Date | undefined): {
  hasGap: boolean;
  gapDays: number;
} {
  if (!lastSessionAt) {
    return { hasGap: false, gapDays: 0 };
  }

  const gapMs = Date.now() - lastSessionAt.getTime();
  const gapDays = Math.floor(gapMs / (1000 * 60 * 60 * 24));

  return {
    hasGap: gapDays >= GAP_THRESHOLD_DAYS,
    gapDays,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEDULE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if a day is a learning day based on weekly cadence
 * Assumes learning days are consecutive starting from Monday
 */
export function isLearningDay(
  dateStr: string,
  weeklyCadence: number,
  timezone: string
): boolean {
  const date = new Date(dateStr + 'T12:00:00Z');
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  
  // Convert to Monday = 0 basis
  const mondayBased = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  return mondayBased < weeklyCadence;
}

/**
 * Get next learning day
 */
export function getNextLearningDay(
  fromDate: string,
  weeklyCadence: number,
  timezone: string
): string {
  let current = fromDate;
  let attempts = 0;
  
  while (attempts < 14) { // Max 2 weeks forward
    current = addDays(current, 1);
    if (isLearningDay(current, weeklyCadence, timezone)) {
      return current;
    }
    attempts++;
  }
  
  // Fallback: just return tomorrow
  return addDays(fromDate, 1);
}

/**
 * Calculate estimated completion date
 */
export function calculateCompletionDate(
  startDate: string,
  totalSessions: number,
  weeklyCadence: number,
  timezone: string
): string {
  const weeks = Math.ceil(totalSessions / weeklyCadence);
  return addDays(startDate, weeks * 7);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const Timezone = {
  getUserTimezone,
  getTodayInTimezone,
  getCurrentTimeInTimezone,
  addDays,
  daysBetween,
  calculateDayNumber,
  getPrefetchDates,
  checkLearningGap,
  isLearningDay,
  getNextLearningDay,
  calculateCompletionDate,
  GAP_THRESHOLD_DAYS,
};

export default Timezone;
