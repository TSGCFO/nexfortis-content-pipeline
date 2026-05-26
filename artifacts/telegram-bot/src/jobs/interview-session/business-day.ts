/**
 * Business-day arithmetic used by the Haiku 4.5 closing-summary generator.
 *
 * Why local (rather than a `date-fns` import)? The prompt's dependency
 * allowlist for PR 3 is empty — no new top-level deps. The arithmetic
 * is small enough to hand-roll defensively. Pure functions; deterministic
 * for a given `now`.
 *
 * `addBusinessDays(now, n)` advances `now` by `n` calendar days while
 * skipping Saturdays and Sundays. The returned `Date` is at the same
 * UTC clock time as `now` (we only adjust the date component).
 *
 * `nextDraftDay(now)` is the caller convenience: returns the English
 * weekday name (`"Monday"` … `"Friday"`) that PR 3's closing-summary
 * Haiku call interpolates into the message — i.e. `now + 4 business
 * days`. This is the day Hassan should expect the draft to be ready
 * (PRD §7.1 / US-F2-10).
 *
 * Time zone note: we use UTC-day math throughout. Hassan reads the
 * message Monday morning Eastern (8 AM ET = 13:00 UTC) — at that hour,
 * the UTC weekday matches the local weekday, so day arithmetic in UTC
 * produces the right answer. If the session ever runs at a wall-clock
 * time where UTC and local diverge across a midnight boundary, the
 * returned day name would be one off; that's an explicit trade-off vs.
 * pulling in `date-fns-tz`.
 */

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns `now + days` calendar days, but skipping Saturday and Sunday.
 *
 * - `days = 0` returns `now` unchanged.
 * - Negative `days` advances backwards; same Sat/Sun-skip rule applies.
 * - The result preserves the time-of-day component (only the date part
 *   advances). All math is in UTC.
 */
export function addBusinessDays(now: Date, days: number): Date {
  if (!Number.isFinite(days) || days === 0) {
    return new Date(now.getTime());
  }
  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(Math.trunc(days));
  let current = new Date(now.getTime());
  while (remaining > 0) {
    current = new Date(current.getTime() + step * MS_PER_DAY);
    const dow = current.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      remaining -= 1;
    }
  }
  return current;
}

/**
 * Returns the weekday name (`'Friday'` etc.) that is 4 business days
 * after `now`. Used by the closing-summary Haiku prompt to communicate
 * when Hassan should expect the draft ready for review.
 */
export function nextDraftDay(now: Date): string {
  const target = addBusinessDays(now, 4);
  const name = WEEKDAY_NAMES[target.getUTCDay()];
  return name ?? 'soon';
}
