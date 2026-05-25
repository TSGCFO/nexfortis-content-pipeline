/**
 * Per-PR-2 message builders that are NOT covered by PR 1's three
 * `build-*-message.ts` files (preview / skip-ack / timeout).
 *
 * Per the prompt's "Reuse PR 1's `build-*-message.ts` files where
 * possible" directive, this module only adds NEW builders:
 *
 *   - `buildCompletionPlaceholderMessage`   — sent when the loop ends
 *     (placeholder; PR 3 replaces with a Claude-Haiku-generated summary)
 *   - `buildCorpusQualityAlertMessage`       — sent ONCE per session when
 *     more than 2 signals are excluded by the quality gate (PRD §7.2)
 *   - `buildFollowUpPlaceholderMessage`      — stubbed for PR 3
 *   - `buildVoiceTranscriptionFailureMessage` — sent when Whisper fails
 *     on a voice note so Hassan knows to type instead
 *
 * Escaping policy mirrors PR 1's builders: every user-derived value is
 * HTML-escaped; literal apostrophes are emitted as `&#39;` for HTML mode
 * defensibility.
 */

import { escapeHtml } from './escape-html.js';

/** Day-of-week reference used in the placeholder message body. PR 3 will
 *  compute this dynamically via Claude Haiku. */
const PLACEHOLDER_DRAFT_DAY = 'Friday';

export interface CompletionPlaceholderInput {
  confirmedCount: number;
}

export function buildCompletionPlaceholderMessage(
  input: CompletionPlaceholderInput,
): string {
  // TODO(pr3): replace this hardcoded text with a Claude Haiku-generated
  // summary computed from `interview_sessions.confirmed_chunk_ids` and
  // the candidate's primary_keyword (PRD §4.5 / §7.1 — Haiku is the
  // model assigned to the closing summary per the integration guide §1).
  const count = Number.isFinite(input.confirmedCount)
    ? Math.max(0, Math.floor(input.confirmedCount))
    : 0;
  const noun = count === 1 ? 'example' : 'examples';
  return (
    `✅ Got it. I&#39;ve confirmed ${count} ${noun}. ` +
    `I&#39;ll have a draft ready for your review by ${PLACEHOLDER_DRAFT_DAY}.`
  );
}

export function buildCorpusQualityAlertMessage(): string {
  // Literal per PRD §7.2 final paragraph. No interpolation.
  return (
    '⚠ Corpus quality may be low for this topic — fewer confirmation ' +
    'questions available than expected.'
  );
}

export function buildFollowUpPlaceholderMessage(): string {
  // TODO(pr3): replace with the real PRD §4.4 open-ended follow-up
  // message ("One more thing — the top-ranking articles on
  // <primary_keyword> don't cover <SERP gap topic>. From your
  // experience, <specific open-ended question>?").
  return '<follow-up placeholder — PR 3 will replace this>';
}

export function buildVoiceTranscriptionFailureMessage(): string {
  // Apostrophe escaped for HTML parse mode (matches PR 1 builder
  // policy on `&#39;`).
  return (
    'Couldn&#39;t transcribe that voice note — saved the audio. ' +
    'Want to type a short response instead?'
  );
}

/** Exported for completeness so test files can assert HTML-safety
 *  alongside the message builders. Same one PR 1's builders use. */
export { escapeHtml };
