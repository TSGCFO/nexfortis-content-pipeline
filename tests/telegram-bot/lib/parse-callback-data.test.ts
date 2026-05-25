import { describe, expect, it } from 'vitest';

import { parseCallbackData } from '../../../artifacts/telegram-bot/src/lib/parse-callback-data.js';

describe('parseCallbackData', () => {
  it('parses cnfm:3:y to { questionIndex: 3, choice: "yes" }', () => {
    const r = parseCallbackData('cnfm:3:y');
    expect(r).toEqual({
      ok: true,
      parsed: { questionIndex: 3, choice: 'yes' },
    });
  });

  it('parses cnfm:1:a to choice "anon"', () => {
    const r = parseCallbackData('cnfm:1:a');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parsed.choice).toBe('anon');
      expect(r.parsed.questionIndex).toBe(1);
    }
  });

  it('parses cnfm:5:s to choice "skip"', () => {
    const r = parseCallbackData('cnfm:5:s');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parsed.choice).toBe('skip');
    }
  });

  it('rejects unknown choice code (cnfm:3:x)', () => {
    const r = parseCallbackData('cnfm:3:x');
    expect(r).toEqual({ ok: false, error: 'invalid_callback_data' });
  });

  it('rejects wrong prefix (foo:3:y)', () => {
    const r = parseCallbackData('foo:3:y');
    expect(r).toEqual({ ok: false, error: 'invalid_callback_data' });
  });

  it('rejects empty string', () => {
    const r = parseCallbackData('');
    expect(r).toEqual({ ok: false, error: 'invalid_callback_data' });
  });

  it('rejects non-numeric index (cnfm:abc:y)', () => {
    const r = parseCallbackData('cnfm:abc:y');
    expect(r).toEqual({ ok: false, error: 'invalid_callback_data' });
  });

  it('rejects index of 0 (one-based per state machine)', () => {
    const r = parseCallbackData('cnfm:0:y');
    expect(r).toEqual({ ok: false, error: 'invalid_callback_data' });
  });

  it('rejects extra trailing characters (cnfm:3:y:extra)', () => {
    const r = parseCallbackData('cnfm:3:y:extra');
    expect(r).toEqual({ ok: false, error: 'invalid_callback_data' });
  });
});
