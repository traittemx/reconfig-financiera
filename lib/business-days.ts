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
