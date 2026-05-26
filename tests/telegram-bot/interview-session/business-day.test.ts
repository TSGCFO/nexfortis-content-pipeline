/**
 * Tests for the `business-day` helper.
 *
 * Covers the four shapes the closing-summary call exercises: Monday-base,
 * Wednesday-base (weekend skip mid-range), Friday-base (weekend
 * straddle), and the convenience `nextDraftDay` wrapper.
 */

import { describe, expect, it } from 'vitest';

import {
  addBusinessDays,
  nextDraftDay,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/business-day.js';

// Reference dates are anchored at 13:00 UTC (8 AM Eastern, when the
// preview message is sent on Monday morning).
const MONDAY = new Date('2026-05-25T13:00:00Z'); // Monday
const WEDNESDAY = new Date('2026-05-27T13:00:00Z'); // Wednesday
const FRIDAY = new Date('2026-05-29T13:00:00Z'); // Friday
const SUNDAY = new Date('2026-05-31T13:00:00Z'); // Sunday

describe('addBusinessDays', () => {
  it('Monday + 4 business days lands on Friday (same week)', () => {
    const result = addBusinessDays(MONDAY, 4);
    expect(result.getUTCDay()).toBe(5); // Friday
    expect(result.toISOString()).toBe('2026-05-29T13:00:00.000Z');
  });

  it('Wednesday + 4 business days lands on Tuesday (skipping Sat+Sun)', () => {
    const result = addBusinessDays(WEDNESDAY, 4);
    expect(result.getUTCDay()).toBe(2); // Tuesday
    expect(result.toISOString()).toBe('2026-06-02T13:00:00.000Z');
  });

  it('Friday + 4 business days lands on Thursday (skipping Sat+Sun once)', () => {
    const result = addBusinessDays(FRIDAY, 4);
    expect(result.getUTCDay()).toBe(4); // Thursday
    expect(result.toISOString()).toBe('2026-06-04T13:00:00.000Z');
  });

  it('Sunday + 1 business day lands on Monday', () => {
    const result = addBusinessDays(SUNDAY, 1);
    expect(result.getUTCDay()).toBe(1); // Monday
  });

  it('+0 business days returns the same instant', () => {
    const result = addBusinessDays(MONDAY, 0);
    expect(result.getTime()).toBe(MONDAY.getTime());
  });

  it('non-finite / NaN day count returns now unchanged (defence)', () => {
    expect(addBusinessDays(MONDAY, Number.NaN).getTime()).toBe(
      MONDAY.getTime(),
    );
  });
});

describe('nextDraftDay', () => {
  it('returns "Friday" for a Monday base', () => {
    expect(nextDraftDay(MONDAY)).toBe('Friday');
  });

  it('returns "Tuesday" for a Wednesday base (skip weekend)', () => {
    expect(nextDraftDay(WEDNESDAY)).toBe('Tuesday');
  });

  it('returns "Thursday" for a Friday base (skip weekend)', () => {
    expect(nextDraftDay(FRIDAY)).toBe('Thursday');
  });

  it('is deterministic across calls (no Date.now reads)', () => {
    const a = nextDraftDay(MONDAY);
    const b = nextDraftDay(MONDAY);
    expect(a).toBe(b);
  });
});
