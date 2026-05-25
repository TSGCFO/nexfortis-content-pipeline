/**
 * Inverse parser for the `cnfm:<questionIndex>:<choice>` callback_data
 * format emitted by `buildConfirmationKeyboard`.
 *
 * Result type:
 *   { ok: true, parsed: { questionIndex: number, choice: ConfirmationChoice } }
 *   { ok: false, error: string }
 *
 * Pure — never throws on malformed input. The bot's callback handler is
 * expected to log a warning and ignore unknown prefixes rather than
 * crashing.
 */

import type { ConfirmationChoice } from './build-confirmation-keyboard.js';

const PREFIX = 'cnfm:';

const SUFFIX_TO_CHOICE: Record<string, ConfirmationChoice> = {
  y: 'yes',
  a: 'anon',
  s: 'skip',
};

export interface ParsedCallback {
  questionIndex: number;
  choice: ConfirmationChoice;
}

export type ParseCallbackResult =
  | { ok: true; parsed: ParsedCallback }
  | { ok: false; error: string };

export function parseCallbackData(input: string): ParseCallbackResult {
  if (typeof input !== 'string' || input.length === 0) {
    return { ok: false, error: 'empty callback_data' };
  }
  if (!input.startsWith(PREFIX)) {
    return { ok: false, error: 'unknown prefix' };
  }
  const rest = input.slice(PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 2) {
    return { ok: false, error: 'invalid callback_data shape' };
  }
  const [indexRaw, suffix] = parts as [string, string];
  // Strict integer pattern; rejects '', '-1', '1.5', '01a', etc.
  if (!/^\d+$/.test(indexRaw)) {
    return { ok: false, error: 'invalid question index' };
  }
  const questionIndex = Number(indexRaw);
  if (!Number.isFinite(questionIndex) || questionIndex < 1) {
    return { ok: false, error: 'invalid question index' };
  }
  const choice = SUFFIX_TO_CHOICE[suffix];
  if (choice === undefined) {
    return { ok: false, error: 'invalid choice suffix' };
  }
  return { ok: true, parsed: { questionIndex, choice } };
}
