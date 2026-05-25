import { describe, expect, it } from 'vitest';

import { buildConfirmationKeyboard } from '../../../artifacts/telegram-bot/src/lib/build-confirmation-keyboard.js';

describe('buildConfirmationKeyboard', () => {
  it('returns three buttons in a single row', () => {
    const kb = buildConfirmationKeyboard({ questionIndex: 1 });
    expect(kb.inline_keyboard).toHaveLength(1);
    expect(kb.inline_keyboard[0]).toHaveLength(3);
  });

  it('encodes callback_data as cnfm:<idx>:<y|a|s> in order yes, anon, skip', () => {
    const kb = buildConfirmationKeyboard({ questionIndex: 4 });
    const row = kb.inline_keyboard[0]!;
    expect(row[0]!.callback_data).toBe('cnfm:4:y');
    expect(row[1]!.callback_data).toBe('cnfm:4:a');
    expect(row[2]!.callback_data).toBe('cnfm:4:s');
  });

  it('uses the exact PRD button labels with the leading emoji', () => {
    const kb = buildConfirmationKeyboard({ questionIndex: 2 });
    const row = kb.inline_keyboard[0]!;
    expect(row[0]!.text).toBe('✅ Yes, use it');
    expect(row[1]!.text).toBe('🔒 Anonymize client');
    expect(row[2]!.text).toBe('⏭ Skip this one');
  });

  it('every callback_data payload fits within Telegram\'s 64-byte limit', () => {
    // Test with a pathologically large question index that we'd never
    // realistically hit (sessions cap at 5 questions in PR 2), as a
    // forward-compat regression guard.
    const kb = buildConfirmationKeyboard({ questionIndex: 9999999999 });
    for (const row of kb.inline_keyboard) {
      for (const btn of row) {
        expect(Buffer.byteLength(btn.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }
  });
});
