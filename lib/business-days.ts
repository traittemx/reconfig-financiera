import {
  addBusinessDays,
  differenceInBusinessDays,
  isWeekend,
  nextMonday,
  startOfDay,
} from 'date-fns';

/**
 * Parses a "YYYY-MM-DD" string as local midnight (avoids UTC shift when using new Date(str)).
 */
export function parseLocalDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Returns "YYYY-MM-DD" for the given date in the user's local timezone.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
 * Day (1..23) unlocked for a user based on start_date.
 * Day 1 is unlocked on the registration day (start_date); each following business day unlocks the next.
 */
export function getDayUnlocked(startDate: Date | null): number {
  if (!startDate) return 0;
  const today = startOfDay(new Date());
  const start = startOfDay(startDate);
  if (today < start) return 0;
  const n = businessDaysBetween(start, today);
  return Math.min(23, Math.max(1, n));
}

/**
 * Calendar date when lesson N (1..23) unlocks for a user who started on startDate.
 * Lesson 1 unlocks on start_date; each following business day unlocks the next.
 */
export function getUnlockDateForLesson(startDate: Date, lessonNumber: number): Date {
  const start = startOfDay(startDate);
  return addBusinessDays(start, lessonNumber - 1);
}

/**
 * Next business day (skip weekend).
 */
export function nextBusinessDay(date: Date): Date {
  const d = startOfDay(date);
  if (isWeekend(d)) return nextMonday(d);
  return addBusinessDays(d, 1);
}
