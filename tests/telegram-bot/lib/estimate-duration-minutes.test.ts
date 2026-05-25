/**
 * Tests for `estimateDurationMinutes` (PRD §4.3 heuristic).
 */

import { describe, expect, it } from 'vitest';

import { estimateDurationMinutes } from '../../../artifacts/telegram-bot/src/lib/estimate-duration-minutes.js';

describe('estimateDurationMinutes', () => {
  it('returns 1 when tokenCount is null', () => {
    expect(estimateDurationMinutes(null)).toBe(1);
  });

  it('returns 1 when tokenCount is 0 (minimum floor)', () => {
    expect(estimateDurationMinutes(0)).toBe(1);
  });

  it('returns 1 when tokenCount is negative (minimum floor)', () => {
    expect(estimateDurationMinutes(-100)).toBe(1);
  });

  it('returns 8 for tokenCount=1000', () => {
    expect(estimateDurationMinutes(1000)).toBe(8);
  });

  it('returns 100 for tokenCount=12500', () => {
    expect(estimateDurationMinutes(12500)).toBe(100);
  });

  it('returns 1 for tokenCount=125 (rounded from 1.0)', () => {
    expect(estimateDurationMinutes(125)).toBe(1);
  });

  it('returns 12 for tokenCount=1500', () => {
    expect(estimateDurationMinutes(1500)).toBe(12);
  });
});
