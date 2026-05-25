import { describe, expect, it } from 'vitest';

import { estimateDurationMinutes } from '../../../artifacts/telegram-bot/src/lib/estimate-duration-minutes.js';

describe('estimateDurationMinutes', () => {
  it('returns 1 when tokenCount is null (unknown source)', () => {
    expect(estimateDurationMinutes(null)).toBe(1);
  });

  it('returns 1 when tokenCount is exactly 0 (minimum floor)', () => {
    expect(estimateDurationMinutes(0)).toBe(1);
  });

  it('returns 1 for negative input (defensive minimum floor)', () => {
    expect(estimateDurationMinutes(-500)).toBe(1);
  });

  it('returns 1 for 125 tokens (rounds 1.0 to 1, then floored)', () => {
    expect(estimateDurationMinutes(125)).toBe(1);
  });

  it('returns 8 for exactly 1,000 tokens (canonical mapping)', () => {
    expect(estimateDurationMinutes(1000)).toBe(8);
  });

  it('returns 12 for 1,500 tokens (rounds 12.0)', () => {
    expect(estimateDurationMinutes(1500)).toBe(12);
  });

  it('returns 100 for 12,500 tokens (rounds 100.0)', () => {
    expect(estimateDurationMinutes(12500)).toBe(100);
  });
});
