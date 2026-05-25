/**
 * Inverse of `buildConfirmationKeyboard`'s `callback_data` payload.
 *
 * Telegram caps callback_data at 64 bytes total — we use a compact
 * `cnfm:<questionIndex>:<choice>` format where `<choice>` is `y` / `a` / `s`.
 * This module parses that format back into a typed object. The signal id is
 * NOT carried in callback_data (UUIDs blow the byte budget) — callers
 * recover it from `interview_sessions.questions[questionIndex - 1].signal_id`.
 *
 * Returns a discriminated `{ ok, ... }` shape rather than throwing so that
 * malformed callback data (which Telegram should never produce for our
 * keyboards, but third-party clients might) cannot crash the long-poll
 * handler.
 */

export type CallbackChoice = 'yes' | 'anon' | 'skip';

export type ParseCallbackDataResult =
  | {
      ok: true;
      parsed: {
        questionIndex: number;
        choice: CallbackChoice;
      };
    }
  | {
      ok: false;
      error: 'invalid_callback_data';
    };

const PATTERN = /^cnfm:(\d+):(y|a|s)$/;

const CHOICE_MAP: Record<string, CallbackChoice> = {
  y: 'yes',
  a: 'anon',
  s: 'skip',
};

export function parseCallbackData(raw: string): ParseCallbackDataResult {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, error: 'invalid_callback_data' };
  }
  const m = PATTERN.exec(raw);
  if (m === null) {
    return { ok: false, error: 'invalid_callback_data' };
  }
  const indexStr = m[1];
  const choiceCode = m[2];
  if (indexStr === undefined || choiceCode === undefined) {
    return { ok: false, error: 'invalid_callback_data' };
  }
  const questionIndex = Number.parseInt(indexStr, 10);
  if (!Number.isInteger(questionIndex) || questionIndex < 1) {
    return { ok: false, error: 'invalid_callback_data' };
  }
  const choice = CHOICE_MAP[choiceCode];
  if (choice === undefined) {
    return { ok: false, error: 'invalid_callback_data' };
  }
  return { ok: true, parsed: { questionIndex, choice } };
}
