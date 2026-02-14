import { DateTime } from 'luxon';
import { ValidationError } from './errors';

/**
 * Time model for Blueth City.
 *
 * Game time = real time (1:1). No acceleration.
 * However, "daily reset" is at 00:00 *in the player's local timezone*.
 * We use Luxon for timezone-safe date math (DST, leap seconds, etc.).
 *
 * Default timezone: Asia/Dubai (UTC+4, no DST — simplest case).
 */

export const DEFAULT_TIMEZONE = 'Asia/Dubai';

/**
 * Get the local date (YYYY-MM-DD) for a UTC instant in a given timezone.
 *
 * @param now - UTC Date or ISO string
 * @param timezone - IANA timezone, e.g. 'Asia/Dubai', 'America/New_York'
 * @returns string in YYYY-MM-DD format
 */
export function getLocalDate(now: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
  const dt = toDateTime(now, timezone);
  return dt.toFormat('yyyy-MM-dd');
}

/**
 * Get the next local midnight as a UTC Date.
 *
 * "Next midnight" = start of the next calendar day in the player's timezone.
 * If it's 23:50 Dubai time, the next midnight is 00:00 Dubai time (next day).
 * If it's exactly 00:00 Dubai time, the next midnight is 00:00 the day after.
 *
 * @param now - UTC Date or ISO string
 * @param timezone - IANA timezone
 * @returns Date object in UTC representing that midnight instant
 */
export function getNextLocalMidnight(
  now: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const dt = toDateTime(now, timezone);
  // Start of tomorrow in the player's timezone
  const tomorrow = dt.plus({ days: 1 }).startOf('day');
  return tomorrow.toJSDate();
}

/**
 * Get the previous local midnight as a UTC Date.
 *
 * @param now - UTC Date or ISO string
 * @param timezone - IANA timezone
 * @returns Date object in UTC representing the start of today in that timezone
 */
export function getPreviousLocalMidnight(
  now: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const dt = toDateTime(now, timezone);
  return dt.startOf('day').toJSDate();
}

/**
 * Check if a daily reset should fire for this player.
 * Compares the current local date against the player's lastDailyReset date string.
 *
 * @param now - current UTC time
 * @param lastDailyReset - YYYY-MM-DD string of last reset, or null if never
 * @param timezone - player's timezone
 * @returns true if the local date has advanced past the last reset date
 */
export function shouldDailyReset(
  now: Date | string,
  lastDailyReset: string | null,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const today = getLocalDate(now, timezone);
  if (lastDailyReset === null) return true;
  return today > lastDailyReset;
}

/**
 * Compute the number of full hours elapsed between two UTC timestamps.
 * Useful for calculating how many hourly ticks are due.
 * Always returns an integer >= 0.
 */
export function fullHoursElapsed(from: Date | string, to: Date | string): number {
  const fromMs = toMs(from);
  const toMs_ = toMs(to);
  const diff = toMs_ - fromMs;
  if (diff < 0) return 0;
  return Math.floor(diff / (60 * 60 * 1000));
}

// ── internal helpers ──────────────────────────────────────────

function toDateTime(input: Date | string, timezone: string): DateTime {
  const dt =
    input instanceof Date
      ? DateTime.fromJSDate(input, { zone: timezone })
      : DateTime.fromISO(input, { zone: timezone });

  if (!dt.isValid) {
    throw new ValidationError(`Invalid date/timezone: ${String(input)}, ${timezone}`);
  }
  return dt;
}

function toMs(input: Date | string): number {
  if (input instanceof Date) return input.getTime();
  const ms = new Date(input).getTime();
  if (isNaN(ms)) throw new ValidationError(`Invalid date: ${input}`);
  return ms;
}
