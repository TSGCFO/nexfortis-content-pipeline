/**
 * Pure factory for the inline-keyboard attached to every confirmation
 * question. Returns a grammY `InlineKeyboard` carrying three buttons:
 *
 *   ✅ Yes, use it           → cnfm:<questionIndex>:y
 *   🔒 Anonymize client      → cnfm:<questionIndex>:a
 *   ⏭ Skip this one          → cnfm:<questionIndex>:s
 *
 * Telegram caps callback_data at 64 bytes; the encoding above is ~14
 * bytes for two-digit question indexes. `signalId` is deliberately NOT
 * embedded — the loop resolves it via
 * `interview_sessions.questions[questionIndex - 1].signal_id` after
 * parsing the callback.
 *
 * Pure — does not call grammY's network APIs; only builds the keyboard
 * object. The bot's callback handler matches the prefix `cnfm:` to know
 * the callback is one of ours.
 */

import { InlineKeyboard } from 'grammy';

export interface BuildConfirmationKeyboardInput {
  questionIndex: number;
  /**
   * Stored alongside the inline-keyboard send by the caller in
   * `interview_sessions.questions[].signal_id`. Not used inside this
   * function — accepted only for caller-side correlation.
   */
  signalId: string;
}

export type ConfirmationChoice = 'yes' | 'anon' | 'skip';

const CHOICE_TO_SUFFIX: Record<ConfirmationChoice, string> = {
  yes: 'y',
  anon: 'a',
  skip: 's',
};

export function callbackDataFor(
  questionIndex: number,
  choice: ConfirmationChoice,
): string {
  return `cnfm:${questionIndex}:${CHOICE_TO_SUFFIX[choice]}`;
}

export function buildConfirmationKeyboard(
  input: BuildConfirmationKeyboardInput,
): InlineKeyboard {
  // `signalId` is intentionally not embedded in callback_data because
  // Telegram caps it at 64 bytes. Reference it through the session row.
  void input.signalId;
  return new InlineKeyboard()
    .text('✅ Yes, use it', callbackDataFor(input.questionIndex, 'yes'))
    .text('🔒 Anonymize client', callbackDataFor(input.questionIndex, 'anon'))
    .text('⏭ Skip this one', callbackDataFor(input.questionIndex, 'skip'));
}
