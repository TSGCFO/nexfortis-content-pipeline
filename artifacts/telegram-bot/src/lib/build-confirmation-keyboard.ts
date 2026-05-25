/**
 * Pure builder for the three-button inline keyboard that accompanies every
 * confirmation question (PRD §4.3 / §4.4).
 *
 * Returns a plain `InlineKeyboardMarkup` JSON shape — NOT a grammY
 * `InlineKeyboard` instance — so the same shape can be serialised into
 * (a) grammY `bot.api.sendMessage(...)` calls from the bot process AND
 * (b) raw `fetch` POST bodies sent from the Inngest function context
 *     (where the grammY instance is not available).
 *
 * Callback-data shape: `cnfm:<questionIndex>:<choiceCode>` where
 * `choiceCode ∈ {y, a, s}`. Telegram caps `callback_data` at 64 bytes;
 * the longest payload here (`cnfm:9999999999:s` = 17 bytes) is well under
 * the limit. Test #3 enforces the ceiling defensively.
 *
 * The `signalId` for a given `questionIndex` is recovered after parsing
 * via `interview_sessions.questions[questionIndex - 1].signal_id`; it is
 * intentionally NOT stuffed into callback_data because a UUID
 * (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` = 36 bytes) plus the prefix and
 * choice would blow the 64-byte budget.
 */

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface BuildConfirmationKeyboardInput {
  questionIndex: number;
}

export function buildConfirmationKeyboard(
  input: BuildConfirmationKeyboardInput,
): InlineKeyboardMarkup {
  const idx = input.questionIndex;
  return {
    inline_keyboard: [
      [
        { text: '✅ Yes, use it', callback_data: `cnfm:${idx}:y` },
        { text: '🔒 Anonymize client', callback_data: `cnfm:${idx}:a` },
        { text: '⏭ Skip this one', callback_data: `cnfm:${idx}:s` },
      ],
    ],
  };
}
