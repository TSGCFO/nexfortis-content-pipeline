/**
 * Tests for `buildConfirmationKeyboard`. Asserts the returned grammY
 * keyboard's button shape and callback_data encoding.
 */

import { describe, expect, it } from 'vitest';

import { buildConfirmationKeyboard } from '../../../artifacts/telegram-bot/src/lib/build-confirmation-keyboard.js';

interface ButtonShape {
  text: string;
  callback_data?: string;
}

function extractRows(
  keyboard: ReturnType<typeof buildConfirmationKeyboard>,
): ButtonShape[][] {
  // grammY's InlineKeyboard exposes `inline_keyboard` as a 2D array of
  // InlineKeyboardButton-union members. All buttons emitted by this
  // factory are CallbackButton, but the type union forces us to widen
  // here.
  return keyboard.inline_keyboard.map((row) =>
    row.map((b) => {
      const btn = b as { text: string; callback_data?: string };
      const out: ButtonShape = { text: btn.text };
      if (btn.callback_data !== undefined)
        out.callback_data = btn.callback_data;
      return out;
    }),
  );
}

describe('buildConfirmationKeyboard', () => {
  it('returns a keyboard with exactly three buttons in one row', () => {
    const kb = buildConfirmationKeyboard({
      questionIndex: 1,
      signalId: 'sig-1',
    });
    const rows = extractRows(kb);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(3);
  });

  it('encodes callback_data with the cnfm: prefix and 1-char suffixes', () => {
    const kb = buildConfirmationKeyboard({
      questionIndex: 2,
      signalId: 'sig-2',
    });
    const rows = extractRows(kb);
    expect(rows[0]!.map((b) => b.callback_data)).toEqual([
      'cnfm:2:y',
      'cnfm:2:a',
      'cnfm:2:s',
    ]);
  });

  it('keeps each callback_data payload well under Telegram\'s 64-byte cap', () => {
    const kb = buildConfirmationKeyboard({
      questionIndex: 99,
      signalId: '00000000-0000-0000-0000-000000000000',
    });
    const rows = extractRows(kb);
    for (const btn of rows[0]!) {
      expect((btn.callback_data ?? '').length).toBeLessThan(64);
    }
  });

  it('does NOT embed the signalId in any callback_data string', () => {
    const kb = buildConfirmationKeyboard({
      questionIndex: 1,
      signalId: 'secret-signal-uuid',
    });
    const rows = extractRows(kb);
    for (const btn of rows[0]!) {
      expect(btn.callback_data).not.toContain('secret-signal-uuid');
    }
  });
});
