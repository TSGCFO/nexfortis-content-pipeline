/**
 * Format the full confirmation-question message body that wraps the
 * Claude-generated `question_text` for delivery via Telegram.
 *
 * Output shape (per PRD §4.3):
 *
 *   [N/M] Last <day> at around <time>, you worked through <topic> with
 *   Claude for about <duration> minute(s). Looks like a real client
 *   situation.
 *
 *   <question_text>
 *
 *   <first 80 words of redacted_text>
 *
 * The buttons are NOT part of this body — they're attached as
 * `reply_markup` by the caller via `buildConfirmationKeyboard`.
 *
 * Escaping: every user-derived value is HTML-escaped here. The Telegram
 * sender does NOT re-escape (avoiding double-encoding), matching PR 1's
 * convention.
 *
 * Pure function — no clock, no DB, no LLM.
 */

import { escapeHtml } from '../jobs/interview-session/escape-html.js';
import { estimateDurationMinutes } from './estimate-duration-minutes.js';

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  timeZone: 'America/New_York',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  hour12: true,
  timeZone: 'America/New_York',
});

const EIGHTY_WORD_LIMIT = 80;

export interface FormatConfirmationMessageInput {
  /** 1-based index of the question in the session. */
  questionIndex: number;
  /** Total number of questions in the session (denominator of "N/M"). */
  totalQuestions: number;
  /** Claude-generated question text. */
  questionText: string;
  /** The signal's `redacted_text`. First 80 words are quoted verbatim. */
  redactedText: string;
  /** The signal's `captured_at` timestamp. */
  capturedAt: Date;
  /** The signal's `tokenCount` (nullable). */
  tokenCount: number | null;
  /** Free-form topic snippet (typically the candidate's `primaryKeyword`). */
  topic: string;
}

function firstNWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= n) return text.trim();
  return words.slice(0, n).join(' ');
}

function formatDay(d: Date): string {
  return WEEKDAY_FORMATTER.format(d);
}

function formatTime(d: Date): string {
  // Examples: "2 PM", "11 AM". Intl emits "2 PM" / "11 AM" already.
  return TIME_FORMATTER.format(d);
}

export function formatConfirmationMessage(
  input: FormatConfirmationMessageInput,
): string {
  const day = escapeHtml(formatDay(input.capturedAt));
  const time = escapeHtml(formatTime(input.capturedAt));
  const topic = escapeHtml(input.topic);
  const duration = estimateDurationMinutes(input.tokenCount);
  const durationWord = duration === 1 ? 'minute' : 'minutes';
  const question = escapeHtml(input.questionText);
  const quote = escapeHtml(firstNWords(input.redactedText, EIGHTY_WORD_LIMIT));

  return [
    `[${input.questionIndex}/${input.totalQuestions}] Last ${day} at around ${time}, you worked through <b>${topic}</b> with Claude for about ${duration} ${durationWord}. Looks like a real client situation.`,
    '',
    question,
    '',
    quote,
  ].join('\n');
}
