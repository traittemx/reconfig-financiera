import {
  addBusinessDays,
  differenceInBusinessDays,
  isWeekend,
  nextMonday,
  startOfDay,
} from 'date-fns';

/**
 * Number of business days (Mon–Fri) between start and end, inclusive of start.
 * If end is before start, returns 0.
 */
export function businessDaysBetween(start: Date, end: Date): number {
  const s = startOfDay(start);
  const e = startOfDay(end);
  if (e < s) return 0;
  return differenceInBusinessDays(e, s) + 1;
}

/**
 * Day (1..23) unlocked for a user based on start_date: day_unlocked = min(23, business_days_since(start_date, today) + 1).
 * Assumes day 1 = first business day after (or on) start_date.
 */
export function getDayUnlocked(startDate: Date | null): number {
  if (!startDate) return 0;
  const today = startOfDay(new Date());
  const start = startOfDay(startDate);
  if (today < start) return 0;
  const n = businessDaysBetween(start, today) + 1;
  return Math.min(23, Math.max(1, n));
}

/**
 * Next business day (skip weekend).
 */
export function nextBusinessDay(date: Date): Date {
  const d = startOfDay(date);
  if (isWeekend(d)) return nextMonday(d);
  return addBusinessDays(d, 1);
}
