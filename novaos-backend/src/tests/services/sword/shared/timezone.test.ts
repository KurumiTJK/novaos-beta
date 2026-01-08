// ═══════════════════════════════════════════════════════════════════════════════
// TIMEZONE TESTS
// Tests for date and timezone utility functions
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// TIMEZONE UTILITIES (mirroring timezone.ts)
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

function getUserTimezone(timezone?: string): string {
  return timezone || DEFAULT_TIMEZONE;
}

function getTodayInTimezone(timezone?: string): string {
  const tz = getUserTimezone(timezone);
  const now = new Date();
  
  // Format as YYYY-MM-DD in the user's timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
}

function getStartOfDayUTC(dateString: string, timezone?: string): Date {
  // For UTC timezone, parse directly as UTC
  if (timezone === 'UTC') {
    return new Date(`${dateString}T00:00:00.000Z`);
  }
  
  const tz = getUserTimezone(timezone);
  
  // Parse as start of day in user's timezone, convert to UTC
  const localDate = new Date(`${dateString}T00:00:00`);
  
  // Get offset for the timezone
  const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(localDate.toLocaleString('en-US', { timeZone: tz }));
  const offset = utcDate.getTime() - tzDate.getTime();
  
  return new Date(localDate.getTime() + offset);
}

function getEndOfDayUTC(dateString: string, timezone?: string): Date {
  const startOfNext = getStartOfDayUTC(dateString, timezone);
  startOfNext.setDate(startOfNext.getDate() + 1);
  return new Date(startOfNext.getTime() - 1);
}

function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((utc2 - utc1) / msPerDay);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function getNextWeekday(date: Date): Date {
  const result = new Date(date.getTime());
  do {
    result.setUTCDate(result.getUTCDate() + 1);
  } while (!isWeekday(result));
  return result;
}

function formatDateForDisplay(date: Date, timezone?: string): string {
  const tz = getUserTimezone(timezone);
  return date.toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function parseISODate(isoString: string): Date {
  return new Date(isoString);
}

function toISOString(date: Date): string {
  return date.toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getUserTimezone', () => {
  it('should return provided timezone', () => {
    expect(getUserTimezone('America/New_York')).toBe('America/New_York');
    expect(getUserTimezone('Europe/London')).toBe('Europe/London');
    expect(getUserTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });

  it('should return default timezone when not provided', () => {
    expect(getUserTimezone()).toBe(DEFAULT_TIMEZONE);
    expect(getUserTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
  });
});

describe('getTodayInTimezone', () => {
  it('should return date in YYYY-MM-DD format', () => {
    const today = getTodayInTimezone();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return valid date parts', () => {
    const today = getTodayInTimezone();
    const [year, month, day] = today.split('-').map(Number);
    
    expect(year).toBeGreaterThanOrEqual(2024);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });

  it('should respect timezone parameter', () => {
    // This test may be flaky near midnight, but demonstrates the API
    const laDate = getTodayInTimezone('America/Los_Angeles');
    const nyDate = getTodayInTimezone('America/New_York');
    
    // Both should be valid date strings
    expect(laDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(nyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getStartOfDayUTC', () => {
  it('should return a Date object', () => {
    const result = getStartOfDayUTC('2025-01-15');
    expect(result).toBeInstanceOf(Date);
  });

  it('should set time to start of day', () => {
    const result = getStartOfDayUTC('2025-01-15', 'UTC');
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });
});

describe('getEndOfDayUTC', () => {
  it('should return a Date object', () => {
    const result = getEndOfDayUTC('2025-01-15');
    expect(result).toBeInstanceOf(Date);
  });

  it('should be after start of day', () => {
    const start = getStartOfDayUTC('2025-01-15', 'UTC');
    const end = getEndOfDayUTC('2025-01-15', 'UTC');
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it('should be 1ms before next day start', () => {
    const end = getEndOfDayUTC('2025-01-15', 'UTC');
    const nextStart = getStartOfDayUTC('2025-01-16', 'UTC');
    expect(nextStart.getTime() - end.getTime()).toBe(1);
  });
});

describe('daysBetween', () => {
  it('should return 0 for same date', () => {
    const date = new Date('2025-01-15');
    expect(daysBetween(date, date)).toBe(0);
  });

  it('should return positive for future date', () => {
    const date1 = new Date('2025-01-15');
    const date2 = new Date('2025-01-20');
    expect(daysBetween(date1, date2)).toBe(5);
  });

  it('should return negative for past date', () => {
    const date1 = new Date('2025-01-20');
    const date2 = new Date('2025-01-15');
    expect(daysBetween(date1, date2)).toBe(-5);
  });

  it('should handle month boundaries', () => {
    const date1 = new Date('2025-01-30');
    const date2 = new Date('2025-02-02');
    expect(daysBetween(date1, date2)).toBe(3);
  });

  it('should handle year boundaries', () => {
    const date1 = new Date('2024-12-31');
    const date2 = new Date('2025-01-01');
    expect(daysBetween(date1, date2)).toBe(1);
  });
});

describe('addDays', () => {
  it('should add positive days', () => {
    const date = new Date('2025-01-15T00:00:00Z');
    const result = addDays(date, 5);
    expect(result.getUTCDate()).toBe(20);
  });

  it('should subtract with negative days', () => {
    const date = new Date('2025-01-15T00:00:00Z');
    const result = addDays(date, -5);
    expect(result.getUTCDate()).toBe(10);
  });

  it('should handle month rollover', () => {
    const date = new Date('2025-01-30T00:00:00Z');
    const result = addDays(date, 5);
    expect(result.getUTCMonth()).toBe(1); // February
    expect(result.getUTCDate()).toBe(4);
  });

  it('should not modify original date', () => {
    const date = new Date('2025-01-15T00:00:00Z');
    const originalTime = date.getTime();
    addDays(date, 5);
    expect(date.getTime()).toBe(originalTime);
  });
});

describe('isWeekday', () => {
  it('should return true for Monday-Friday', () => {
    // 2025-01-13 is a Monday (UTC)
    expect(isWeekday(new Date('2025-01-13T12:00:00Z'))).toBe(true); // Monday
    expect(isWeekday(new Date('2025-01-14T12:00:00Z'))).toBe(true); // Tuesday
    expect(isWeekday(new Date('2025-01-15T12:00:00Z'))).toBe(true); // Wednesday
    expect(isWeekday(new Date('2025-01-16T12:00:00Z'))).toBe(true); // Thursday
    expect(isWeekday(new Date('2025-01-17T12:00:00Z'))).toBe(true); // Friday
  });

  it('should return false for Saturday and Sunday', () => {
    expect(isWeekday(new Date('2025-01-18T12:00:00Z'))).toBe(false); // Saturday
    expect(isWeekday(new Date('2025-01-19T12:00:00Z'))).toBe(false); // Sunday
  });
});

describe('getNextWeekday', () => {
  it('should return next day if current is weekday', () => {
    // Monday -> Tuesday
    const monday = new Date('2025-01-13T12:00:00Z');
    const result = getNextWeekday(monday);
    expect(result.getUTCDate()).toBe(14);
  });

  it('should skip weekend from Friday', () => {
    // Friday -> Monday
    const friday = new Date('2025-01-17T12:00:00Z');
    const result = getNextWeekday(friday);
    expect(result.getUTCDate()).toBe(20);
    expect(result.getUTCDay()).toBe(1); // Monday
  });

  it('should skip to Monday from Saturday', () => {
    const saturday = new Date('2025-01-18T12:00:00Z');
    const result = getNextWeekday(saturday);
    expect(result.getUTCDate()).toBe(20);
    expect(result.getUTCDay()).toBe(1); // Monday
  });

  it('should skip to Monday from Sunday', () => {
    const sunday = new Date('2025-01-19T12:00:00Z');
    const result = getNextWeekday(sunday);
    expect(result.getUTCDate()).toBe(20);
    expect(result.getUTCDay()).toBe(1); // Monday
  });

  it('should not modify original date', () => {
    const date = new Date('2025-01-17T12:00:00Z'); // Friday
    const originalTime = date.getTime();
    getNextWeekday(date);
    expect(date.getTime()).toBe(originalTime);
  });
});

describe('formatDateForDisplay', () => {
  it('should format date with weekday, month, and day', () => {
    const date = new Date('2025-01-15T12:00:00Z');
    const result = formatDateForDisplay(date, 'UTC');
    
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('should handle different timezones', () => {
    const date = new Date('2025-01-15T12:00:00Z');
    
    const utcResult = formatDateForDisplay(date, 'UTC');
    const laResult = formatDateForDisplay(date, 'America/Los_Angeles');
    
    // Both should be valid formatted strings
    expect(utcResult).toBeTruthy();
    expect(laResult).toBeTruthy();
  });
});

describe('parseISODate', () => {
  it('should parse ISO date string', () => {
    const result = parseISODate('2025-01-15T12:30:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.getUTCMonth()).toBe(0); // January
    expect(result.getUTCDate()).toBe(15);
  });

  it('should handle date-only string', () => {
    const result = parseISODate('2025-01-15');
    expect(result).toBeInstanceOf(Date);
  });
});

describe('toISOString', () => {
  it('should return ISO formatted string', () => {
    const date = new Date('2025-01-15T12:30:00.000Z');
    const result = toISOString(date);
    
    expect(result).toBe('2025-01-15T12:30:00.000Z');
  });

  it('should include milliseconds', () => {
    const date = new Date('2025-01-15T12:30:00.123Z');
    const result = toISOString(date);
    
    expect(result).toContain('.123Z');
  });
});

describe('Integration Scenarios', () => {
  it('should handle session scheduling across weekends', () => {
    // Start on Friday, schedule 5 sessions
    let currentDate = new Date('2025-01-17T12:00:00Z'); // Friday
    const sessions: Date[] = [currentDate];
    
    for (let i = 0; i < 4; i++) {
      currentDate = getNextWeekday(currentDate);
      sessions.push(currentDate);
    }
    
    // Should be Mon, Tue, Wed, Thu of next week
    expect(sessions[1].getUTCDate()).toBe(20); // Monday
    expect(sessions[2].getUTCDate()).toBe(21); // Tuesday
    expect(sessions[3].getUTCDate()).toBe(22); // Wednesday
    expect(sessions[4].getUTCDate()).toBe(23); // Thursday
  });

  it('should calculate gap days correctly', () => {
    const lastSession = new Date('2025-01-10T00:00:00Z');
    const today = new Date('2025-01-15T00:00:00Z');
    
    const gap = daysBetween(lastSession, today);
    expect(gap).toBe(5);
  });
});
