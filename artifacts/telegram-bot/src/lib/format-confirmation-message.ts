/**
 * Pure formatter for the per-question Telegram message body (PRD §4.3).
 *
 * Wraps the Claude-generated `question_text` in the canonical envelope
 *
 *     [N/M] <question_text>
 *
 *     <evidence_quote (≤ 80 words, italicised)>
 *
 * The three inline-keyboard buttons are NOT part of the text body — they
 * are attached via `reply_markup` by the sender. Telegram renders them
 * underneath the message.
 *
 * Escaping policy mirrors PR 1's preview / skip-ack / timeout builders:
 * every user-derived string is HTML-escaped here so the sender does not
 * have to (re-escaping would double-encode `&amp;` → `&amp;amp;`).
 *
 * The 80-word evidence quote cap is enforced by splitting on whitespace
 * (matching the §7.2 quality-gate word-count rule) and rejoining with a
 * single space. If truncation happens, a horizontal ellipsis is appended.
 */

import { escapeHtml } from '../jobs/interview-session/escape-html.js';

export interface FormatConfirmationMessageInput {
  questionIndex: number;
  totalQuestions: number;
  questionText: string;
  signalRedactedText: string;
}

const MAX_EVIDENCE_WORDS = 80;

function truncateToWords(text: string, maxWords: number): {
  text: string;
  truncated: boolean;
} {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) {
    return { text: '', truncated: false };
  }
  if (words.length <= maxWords) {
    return { text: words.join(' '), truncated: false };
  }
  return { text: words.slice(0, maxWords).join(' '), truncated: true };
}

export function formatConfirmationMessage(
  input: FormatConfirmationMessageInput,
): string {
  const header = `[${input.questionIndex}/${input.totalQuestions}] ${escapeHtml(input.questionText)}`;
  const { text: quoteWords, truncated } = truncateToWords(
    input.signalRedactedText,
    MAX_EVIDENCE_WORDS,
  );
  if (quoteWords.length === 0) {
    return header;
  }
  const suffix = truncated ? '…' : '';
  const quote = `<i>«${escapeHtml(quoteWords)}${suffix}»</i>`;
  return `${header}\n\n${quote}`;
}
