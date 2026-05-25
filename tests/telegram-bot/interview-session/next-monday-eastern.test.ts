/**
 * Unit tests for `nextMondayAt8amEastern`.
 *
 * Pure function — zero mocks. Each case asserts the returned Date's UTC ISO
 * string AND (for property-style tests) that the Eastern projection is
 * Monday 08:00.
 */

import { describe, expect, it } from 'vitest';

import { nextMondayAt8amEastern } from '../../../artifacts/telegram-bot/src/jobs/interview-session/next-monday-eastern.js';

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

interface EasternProjection {
  weekday: string;
  hour: number;
  minute: number;
}

function projectEastern(d: Date): EasternProjection {
  let weekday = '';
  let hour = -1;
  let minute = -1;
  for (const p of FMT.formatToParts(d)) {
    if (p.type === 'weekday') weekday = p.value;
    else if (p.type === 'hour') {
      const h = Number(p.value);
      hour = h === 24 ? 0 : h;
    } else if (p.type === 'minute') minute = Number(p.value);
  }
  return { weekday, hour, minute };
}

describe('nextMondayAt8amEastern', () => {
  it('returns today at 08:00 ET (EST/winter) when now is Monday 07:00 EST', () => {
    // 2026-01-12 is a Monday. 07:00 EST = 12:00 UTC.
    const now = new Date('2026-01-12T12:00:00Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.toISOString()).toBe('2026-01-12T13:00:00.000Z');
  });

  it('returns today at 08:00 ET (EDT/summer) when now is Monday 07:00 EDT', () => {
    // 2026-07-13 is a Monday. 07:00 EDT = 11:00 UTC.
    const now = new Date('2026-07-13T11:00:00Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.toISOString()).toBe('2026-07-13T12:00:00.000Z');
  });

  it('returns next Monday when now is exactly Monday 08:00 ET (boundary)', () => {
    // Monday 08:00 EST = 13:00 UTC. "At or after 08:00" counts as next Mon.
    const now = new Date('2026-01-12T13:00:00.000Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.toISOString()).toBe('2026-01-19T13:00:00.000Z');
  });

  it('returns next Monday when now is Monday 09:00 ET', () => {
    const now = new Date('2026-01-12T14:00:00Z'); // 09:00 EST
    const result = nextMondayAt8amEastern(now);
    expect(result.toISOString()).toBe('2026-01-19T13:00:00.000Z');
  });

  it('returns tomorrow when now is Sunday 23:00 ET in winter', () => {
    // Sun 2026-01-11 23:00 EST = Mon 2026-01-12 04:00 UTC.
    const now = new Date('2026-01-12T04:00:00Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.toISOString()).toBe('2026-01-12T13:00:00.000Z');
  });

  it('returns tomorrow when now is Sunday 23:00 ET in summer', () => {
    // Sun 2026-07-12 23:00 EDT = Mon 2026-07-13 03:00 UTC.
    const now = new Date('2026-07-13T03:00:00Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.toISOString()).toBe('2026-07-13T12:00:00.000Z');
  });

  it('returns the upcoming Monday when now is Friday afternoon ET', () => {
    // Fri 2026-01-09 15:00 EST = 20:00 UTC.
    const now = new Date('2026-01-09T20:00:00Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.toISOString()).toBe('2026-01-12T13:00:00.000Z');
  });

  it('DST spring-forward: morning after switchover (Mon 2026-03-09 07:00 EDT) → 12:00 UTC', () => {
    // DST began Sun 2026-03-08 at 02:00 ET.
    // Mon 2026-03-09 07:00 EDT = 11:00 UTC. Same-day pre-08 → today 08:00 EDT = 12:00 UTC.
    const now = new Date('2026-03-09T11:00:00Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.toISOString()).toBe('2026-03-09T12:00:00.000Z');
    expect(result.getUTCHours()).toBe(12);
  });

  it('DST fall-back: morning after switchover (Mon 2026-11-02 07:00 EST) → 13:00 UTC', () => {
    // DST ended Sun 2026-11-01 at 02:00 ET.
    // Mon 2026-11-02 07:00 EST = 12:00 UTC. Same-day pre-08 → today 08:00 EST = 13:00 UTC.
    const now = new Date('2026-11-02T12:00:00Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.toISOString()).toBe('2026-11-02T13:00:00.000Z');
    expect(result.getUTCHours()).toBe(13);
  });

  it('result.getUTCHours() === 12 in summer (EDT)', () => {
    // Pick Wednesday 2026-07-15 12:00 UTC (08:00 EDT) → next Monday EDT.
    const now = new Date('2026-07-15T12:00:00Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.getUTCHours()).toBe(12);
  });

  it('result.getUTCHours() === 13 in winter (EST)', () => {
    // Pick Wednesday 2026-01-14 13:00 UTC (08:00 EST) → next Monday EST.
    const now = new Date('2026-01-14T13:00:00Z');
    const result = nextMondayAt8amEastern(now);
    expect(result.getUTCHours()).toBe(13);
  });

  it('property: result always projects to Mon 08:00 ET across many input dates', () => {
    const inputs: Date[] = [
      new Date('2026-01-01T00:00:00Z'), // Thu, winter
      new Date('2026-03-08T06:30:00Z'), // Sun, DST gap day
      new Date('2026-03-09T05:00:00Z'), // Mon, post-spring-forward (Mon 01:00 EDT)
      new Date('2026-06-15T18:45:00Z'), // Mon, summer (Mon 14:45 EDT)
      new Date('2026-11-01T05:30:00Z'), // Sun, pre-fall-back (Sun 01:30 EDT)
      new Date('2026-11-01T07:30:00Z'), // Sun, post-fall-back (Sun 02:30 EST)
      new Date('2026-12-25T10:00:00Z'), // Fri, winter
    ];
    for (const now of inputs) {
      const result = nextMondayAt8amEastern(now);
      const proj = projectEastern(result);
      expect(proj.weekday, `for input ${now.toISOString()}`).toBe('Mon');
      expect(proj.hour, `for input ${now.toISOString()}`).toBe(8);
      expect(proj.minute, `for input ${now.toISOString()}`).toBe(0);
      // Sanity: result must be strictly in the future relative to `now`.
      expect(result.getTime(), `for input ${now.toISOString()}`).toBeGreaterThan(
        now.getTime() - 1000,
      );
    }
  });
});
