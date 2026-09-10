import { env } from "./env";

/**
 * All "daily" logic keys off the calendar date in the configured timezone
 * (Asia/Jerusalem by default). We derive it with Intl so DST is handled by the
 * platform's tz database rather than by hand-rolled offsets.
 */

export function nowInTz(date = new Date()): Date {
  return date;
}

/** YYYY-MM-DD for the given instant in the app timezone. */
export function jerusalemDateString(date = new Date(), tz = env.TIMEZONE): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA yields YYYY-MM-DD
  return fmt.format(date);
}

/** Human date+time in the app timezone, for logs and admin display. */
export function jerusalemDateTime(date = new Date(), tz = env.TIMEZONE): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Add N days to a YYYY-MM-DD string (UTC-noon anchored to avoid DST edges). */
export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

/** The last N calendar dates strictly before `dateStr`, newest first. */
export function previousDates(dateStr: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(dateStr, -(i + 1)));
}

/** The UTC instant of 00:00 on `dateStr` (YYYY-MM-DD) in the app timezone. */
export function jerusalemDayStartUtc(dateStr: string, tz = env.TIMEZONE): Date {
  const asUtc = new Date(`${dateStr}T00:00:00Z`);
  const local = new Date(asUtc.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc.getTime() - (local.getTime() - utc.getTime()));
}

/**
 * Milliseconds until the next 00:00 in the app timezone. Used by the scheduler
 * as a sanity value and by the admin dashboard countdown.
 */
export function msUntilNextMidnight(tz = env.TIMEZONE, from = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(from);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const h = get("hour") % 24;
  const min = get("minute");
  const s = get("second");
  const elapsed = ((h * 60 + min) * 60 + s) * 1000 + from.getMilliseconds();
  const dayMs = 24 * 60 * 60 * 1000;
  return dayMs - elapsed;
}
