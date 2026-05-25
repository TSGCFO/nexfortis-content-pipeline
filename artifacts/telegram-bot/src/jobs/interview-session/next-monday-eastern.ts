/**
 * Returns the next instant in time that, when displayed in
 * America/New_York, is **Monday 08:00**.
 *
 * Pure function — caller passes `now` so tests can be deterministic without
 * touching the system clock.
 *
 * --- DST-handling ---------------------------------------------------------
 *
 * America/New_York alternates between EST (UTC-5) and EDT (UTC-4). The
 * UTC time corresponding to "Monday 08:00 Eastern" therefore varies between
 * 12:00 UTC (EDT, summer) and 13:00 UTC (EST, winter). A hardcoded offset
 * would silently produce a 1-hour-wrong cron firing twice a year.
 *
 * Algorithm (zero deps):
 *   1. Read Eastern wall-clock parts of `now` via Intl.DateTimeFormat with
 *      `timeZone: 'America/New_York'`.
 *   2. Compute the target Eastern Y-M-D for "this or next Monday at 08:00":
 *        - if `now` is Mon AND hour < 8 → today
 *        - if `now` is Mon AND hour >= 8 → today + 7 days
 *        - else → days = 7 - dowMon0
 *      (dowMon0 maps Mon=0..Sun=6.)
 *   3. To convert target Eastern Y-M-D 08:00:00 back to UTC without a
 *      timezone library: construct a candidate `Date.UTC(y, m, d, 8, 0, 0)`,
 *      ask Intl what HOUR that displays as in Eastern (will be 03 in EST or
 *      04 in EDT — both < 8), then add the delta. Verify the result
 *      projects back to Mon 08:00 ET and throw otherwise. (Defensive guard
 *      against future Olson-database changes; not expected to trigger.)
 *
 *   Crossover correctness verified:
 *     - 2026-03-08 (Sun, spring-forward at 02:00 ET): subsequent Monday
 *       2026-03-09 08:00 EDT = 12:00 UTC. ✓
 *     - 2026-11-01 (Sun, fall-back at 02:00 ET): subsequent Monday
 *       2026-11-02 08:00 EST = 13:00 UTC. ✓
 *
 * --------------------------------------------------------------------------
 */

const TZ = 'America/New_York';

type WeekdayShort = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

interface EasternParts {
  weekday: WeekdayShort;
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

const WEEKDAY_SET: ReadonlySet<string> = new Set([
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
]);

const DOW_MON0: Record<WeekdayShort, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

const FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function isWeekdayShort(value: string): value is WeekdayShort {
  return WEEKDAY_SET.has(value);
}

function readEasternParts(d: Date): EasternParts {
  const parts = FORMATTER.formatToParts(d);
  let weekday: WeekdayShort | undefined;
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  let hour: number | undefined;
  let minute: number | undefined;
  let second: number | undefined;
  for (const p of parts) {
    if (p.type === 'weekday' && isWeekdayShort(p.value)) {
      weekday = p.value;
    } else if (p.type === 'year') {
      year = Number(p.value);
    } else if (p.type === 'month') {
      month = Number(p.value);
    } else if (p.type === 'day') {
      day = Number(p.value);
    } else if (p.type === 'hour') {
      // Intl's `hour12: false` returns '24' for midnight in some runtimes.
      // Normalise to 0.
      const h = Number(p.value);
      hour = h === 24 ? 0 : h;
    } else if (p.type === 'minute') {
      minute = Number(p.value);
    } else if (p.type === 'second') {
      second = Number(p.value);
    }
  }
  if (
    weekday === undefined ||
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new Error(
      `nextMondayAt8amEastern: failed to read Eastern parts from ${d.toISOString()}`,
    );
  }
  return { weekday, year, month, day, hour, minute, second };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function nextMondayAt8amEastern(now: Date): Date {
  const parts = readEasternParts(now);
  const dowMon0 = DOW_MON0[parts.weekday];

  let daysToAdd: number;
  if (dowMon0 === 0) {
    daysToAdd = parts.hour < 8 ? 0 : 7;
  } else {
    daysToAdd = 7 - dowMon0;
  }

  // Compute target Eastern Y-M-D by advancing the Eastern calendar date.
  // We use Date.UTC arithmetic on the Eastern wall-clock date as a pure
  // calendar (no DST relevance for the day-of-month calculation itself).
  const baseUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const targetMidnightProxy = new Date(baseUtc + daysToAdd * DAY_MS);
  const targetY = targetMidnightProxy.getUTCFullYear();
  const targetM = targetMidnightProxy.getUTCMonth();
  const targetD = targetMidnightProxy.getUTCDate();

  // Convert Eastern (targetY, targetM, targetD, 08:00) → UTC by reading the
  // Eastern projection of a candidate UTC instant and correcting.
  const candidate = new Date(Date.UTC(targetY, targetM, targetD, 8, 0, 0));
  const candidateEastern = readEasternParts(candidate);
  // candidateEastern.hour will be 3 (EST: UTC-5) or 4 (EDT: UTC-4).
  // delta = 8 - candidateEastern.hour, mod 24 in case of edge wrap.
  const delta = ((8 - candidateEastern.hour) % 24 + 24) % 24;
  const result = new Date(candidate.getTime() + delta * HOUR_MS);

  // Defensive post-condition.
  const check = readEasternParts(result);
  if (check.weekday !== 'Mon' || check.hour !== 8 || check.minute !== 0) {
    throw new Error(
      `nextMondayAt8amEastern: post-condition failed (got ${check.weekday} ${check.hour}:${check.minute} ET for input ${now.toISOString()})`,
    );
  }
  return result;
}
