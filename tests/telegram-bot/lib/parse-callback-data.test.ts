/**
 * Tests for the `cnfm:<idx>:<choice>` callback-data parser.
 */

import { describe, expect, it } from 'vitest';

import { parseCallbackData } from '../../../artifacts/telegram-bot/src/lib/parse-callback-data.js';

describe('parseCallbackData', () => {
  it('returns { questionIndex: 3, choice: "yes" } for "cnfm:3:y"', () => {
    const result = parseCallbackData('cnfm:3:y');
    expect(result).toEqual({
      ok: true,
      parsed: { questionIndex: 3, choice: 'yes' },
    });
  });

  it('returns choice="anon" for "cnfm:3:a"', () => {
    const result = parseCallbackData('cnfm:3:a');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.choice).toBe('anon');
      expect(result.parsed.questionIndex).toBe(3);
    }
  });

  it('returns choice="skip" for "cnfm:3:s"', () => {
    const result = parseCallbackData('cnfm:3:s');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parsed.choice).toBe('skip');
  });

  it('returns { ok: false } for "cnfm:3:x" (unknown suffix)', () => {
    const result = parseCallbackData('cnfm:3:x');
    expect(result.ok).toBe(false);
  });

  it('returns { ok: false } for "foo:3:y" (unknown prefix)', () => {
    const result = parseCallbackData('foo:3:y');
    expect(result.ok).toBe(false);
  });

  it('returns { ok: false } for the empty string', () => {
    const result = parseCallbackData('');
    expect(result.ok).toBe(false);
  });

  it('returns { ok: false } for "cnfm:0:y" (zero index)', () => {
    const result = parseCallbackData('cnfm:0:y');
    expect(result.ok).toBe(false);
  });

  it('returns { ok: false } for "cnfm:abc:y" (non-numeric index)', () => {
    const result = parseCallbackData('cnfm:abc:y');
    expect(result.ok).toBe(false);
  });

  it('returns { ok: false } for malformed "cnfm:1" (no choice)', () => {
    const result = parseCallbackData('cnfm:1');
    expect(result.ok).toBe(false);
  });

  it('parses two-digit indexes correctly', () => {
    const result = parseCallbackData('cnfm:42:y');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parsed.questionIndex).toBe(42);
  });
});
