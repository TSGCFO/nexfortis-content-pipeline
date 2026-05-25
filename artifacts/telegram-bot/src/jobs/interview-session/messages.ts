/**
 * Message builders introduced in PR 2 (extending PR 1's `build-*-message.ts`
 * files). All builders are pure functions and produce HTML-safe strings for
 * `parse_mode: 'HTML'` Telegram sends.
 *
 * PR 1's three message builders (`buildPreviewMessage`,
 * `buildSkipAckMessage`, `buildTimeoutMessage`) live in their own files;
 * this module deliberately does not re-export them to keep the existing
 * import surface stable.
 *
 * The completion / follow-up placeholders here are temporary text for PR 2.
 * PR 3 will replace them with Claude-Haiku-generated copy and follow-up
 * question prompts respectively.
 */

import { escapeHtml } from './escape-html.js';

/**
 * Placeholder closing message sent when the confirmation loop reaches
 * `completed`. The day-of-week is hardcoded to "Friday" because Claude
 * Haiku won't pick a smarter value until PR 3.
 *
 * Singular / plural noun handling matches the existing PR 1 builders'
 * style ("things" vs. "thing").
 */
export interface CompletionPlaceholderInput {
  confirmedCount: number;
}

export function buildCompletionPlaceholderMessage(
  input: CompletionPlaceholderInput,
): string {
  const noun = input.confirmedCount === 1 ? 'example' : 'examples';
  return `✅ Got it. I&#39;ve confirmed ${input.confirmedCount} ${noun}. I&#39;ll have a draft ready for your review by Friday.`;
}

/**
 * Corpus-quality alert per PRD §7.2 final paragraph. Sent at most once per
 * session when more than 2 signals are excluded by the quality gate. The
 * alert exists so Hassan knows the session will be shorter than expected
 * before the first reduced question lands.
 */
export function buildCorpusQualityAlertMessage(): string {
  return '⚠ Corpus quality may be low for this topic — fewer confirmation questions available than expected.';
}

/**
 * Placeholder follow-up-question message — stubbed for PR 3 wiring. PR 2
 * never sends this; it exists only so the public message surface is
 * complete and PR 3 can plug an LLM call in here without churn.
 *
 * TODO(pr3): replace with Claude Opus 4.7-generated follow-up text per
 * PRD §4.4 (SERP-gap-aware open-ended question).
 */
export interface FollowUpPlaceholderInput {
  primaryKeyword: string;
}

export function buildFollowUpPlaceholderMessage(
  input: FollowUpPlaceholderInput,
): string {
  const kw = escapeHtml(input.primaryKeyword);
  return `One more thing — anything else from your work this week on <b>${kw}</b> we should fold into the draft? Voice or text — there&#39;s no wrong answer.`;
}

/**
 * Voice-transcription-failure fallback sent to the user when Whisper
 * fails on a voice note mid-interview. Keeps the loop alive by inviting
 * Hassan to retype the answer.
 *
 * The apostrophe is rendered as `&#39;` (matching PR 1's escaping
 * convention) so Telegram's HTML parser never trips on it.
 */
export function buildVoiceTranscriptionFailureMessage(): string {
  return "Couldn&#39;t transcribe that voice note — saved the audio. Want to type a short response instead?";
}

/**
 * Format the body text wrapping one Claude-generated confirmation
 * question. The buttons live in `reply_markup`, not in this body. The
 * caller is responsible for HTML-escaping the signal's
 * `redacted_text` before passing it as `evidenceQuote` — the formatter
 * trusts its inputs and only escapes the `questionText` and
 * `evidenceQuote` fields it interpolates.
 *
 * Structure (per PRD §4.3):
 *   [N/M] <question_text>
 *
 *   <first 80 words of redacted_text>
 */
export interface FormatConfirmationBodyInput {
  questionIndex: number;
  totalQuestions: number;
  questionText: string;
  evidenceQuote: string;
}

export function buildConfirmationBody(
  input: FormatConfirmationBodyInput,
): string {
  const q = escapeHtml(input.questionText);
  const e = escapeHtml(input.evidenceQuote);
  return [`[${input.questionIndex}/${input.totalQuestions}] ${q}`, '', e].join(
    '\n',
  );
}
