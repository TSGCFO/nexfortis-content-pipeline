/**
 * Claude closing-summary generator (PRD §7.1 + US-F2-10).
 *
 * Pattern source: `docs/ways-of-work/anthropic-claude-integration-guide.md`
 * sections 1 (model assignment), 5 (structured outputs), 6 (prompt
 * caching), 7 (stop-reason handling). The guide originally assigned
 * Haiku 4.5 to this task; the model was retargeted to Claude Opus 4.8 on
 * Hassan's explicit directive (2026-06-12).
 *
 * Differences from `generate-question.ts` / `generate-follow-up.ts`:
 *   - NO `thinking` field. Omitting it leaves thinking off on Opus 4.8 —
 *     fine for a paraphrase task where we don't inspect thinking content.
 *   - `output_config.effort: 'low'` (not `xhigh`) — a 1–2 sentence
 *     paraphrase doesn't warrant deep thinking.
 *   - Schema is small: `{ summary_text: string }`.
 *   - `system` block uses `cache_control: { type: 'ephemeral' }` — same
 *     pattern as the Opus calls so a follow-up summary call for a
 *     different session (within 5 min) gets the cache hit.
 *
 * NONE of the five §4 footguns appear here either: no
 * `thinking.budget_tokens`, no assistant prefilling, no top-level
 * `effort`, no legacy beta headers, no `thinking.type === 'enabled'`.
 *
 * Never throws. Returns `{ ok: true, summaryText } | { ok: false,
 * reason, fallbackText }` — the fallback text is always populated so
 * the orchestrator can always send SOMETHING to Hassan.
 */

import type { Logger } from '@ncp/logger';

import {
  CLOSING_SUMMARY_JSON_SCHEMA,
  parseClosingSummaryResponse,
  type OpusAnthropicLike,
  type OpusUserMessage,
} from './anthropic-shapes.js';
import { buildCompletionPlaceholderMessage } from './messages.js';
import type { ClosingSummaryResult } from './types.js';

const SOURCE = 'telegram_bot' as const;

/**
 * Anthropic model id — originally Haiku 4.5 per integration guide §1;
 * retargeted to Claude Opus 4.8 on Hassan's explicit directive
 * (2026-06-12). Override via `ANTHROPIC_MODEL`.
 */
export const CLOSING_SUMMARY_MODEL =
  process.env['ANTHROPIC_MODEL']?.trim() || 'claude-opus-4-8';

/** `max_tokens` for one closing summary. The paraphrase itself is ≤300
 *  chars, but Opus 4.8's always-on thinking bills into `max_tokens`. */
export const CLOSING_SUMMARY_MAX_TOKENS = 2048;

/**
 * Engineered system prompt — mirrors PR #36's `SYSTEM_PROMPT` style:
 *   - Labelled sections (Role, Voice, The job, Shape, Examples).
 *   - 2 positive examples with WHY IT WORKS rationale.
 *   - 1 negative example with WHY IT FAILS.
 *   - Voice calibration: Hassan, NexFortis, Telegram, Monday morning.
 *   - No banned phrases.
 *   - No mention of word count, JSON schema, or output_config.
 *   - Length > 1500 chars — engineered, not a 100-char wrapper.
 *
 * The prompt does NOT compute the draft day itself — the orchestrator
 * passes a precomputed `draft_day_name` in the user-content JSON and
 * the model interpolates it verbatim. That keeps the day deterministic
 * (testable via fixed `now`).
 */
export const CLOSING_SUMMARY_SYSTEM_PROMPT = `You are writing a short closing acknowledgement for Hassan Sadiq, an
IT consultant in Ontario who runs NexFortis. He has just finished a
Monday-morning Telegram interview that gathered evidence for this
week's article. Your job is to paraphrase the session state in 1-2
sentences and tell him when the draft will be ready.

Voice
-----
Plain-spoken, warm, like a colleague closing a quick check-in. Hassan
already gave you his time — do not waste any of his attention with
softeners or pleasantries. No corporate filler. No "thank you for
participating" energy. No fourth-wall talk about being a model.

The job
-------
You will be given a session-state JSON with these fields:
  - confirmedCount       — number of signals Hassan confirmed (Yes or Anonymize)
  - anonymizeCount       — subset of confirmedCount that asked for anonymization
  - skipCount            — number of confirmation questions he skipped
  - followUpsAnswered    — number of open-ended follow-ups he answered
  - fallbackAnswered     — true if the all-skipped fallback path ran
  - proposedTitle        — the article title being interviewed for
  - draftDayName         — the weekday the draft will be ready (e.g. "Friday")

Use exactly the fields that matter. If a count is 0, do not pad the
sentence by mentioning it. If anonymizeCount equals confirmedCount,
roll it into the same clause ("3 anonymized examples"). If
fallbackAnswered is true, acknowledge the fallback specifically.

Always close with the day. Use draftDayName VERBATIM — do not compute
the day yourself.

Shape
-----
1-2 sentences. No bullet lists. No headings. No emoji prefix (the
orchestrator adds one if needed).

Positive example 1 — straightforward confirmation session
---------------------------------------------------------
INPUT JSON:
{ "confirmedCount": 3, "anonymizeCount": 0, "skipCount": 0,
  "followUpsAnswered": 0, "fallbackAnswered": false,
  "proposedTitle": "Conditional Access for iOS",
  "draftDayName": "Friday" }

GOOD SUMMARY:
Got it — 3 examples confirmed. I'll have your draft on Conditional
Access for iOS ready for review by Friday.

WHY IT WORKS: Acknowledges what Hassan actually did. Names the article.
Names the day. Two short sentences. No softener. No "thanks for taking
the time" filler.

Positive example 2 — mixed session with follow-up
-------------------------------------------------
INPUT JSON:
{ "confirmedCount": 2, "anonymizeCount": 1, "skipCount": 1,
  "followUpsAnswered": 1, "fallbackAnswered": false,
  "proposedTitle": "MDE Plan 2 ASR reporting",
  "draftDayName": "Thursday" }

GOOD SUMMARY:
Got it — 2 examples confirmed (1 anonymized) and your follow-up on the
ASR reporting gap. Draft ready by Thursday.

WHY IT WORKS: Mentions the anonymization without making a thing of it.
Names the follow-up to show the gap got addressed. Keeps the day-of
commitment short.

Positive example 3 — all-skipped fallback path
----------------------------------------------
INPUT JSON:
{ "confirmedCount": 0, "anonymizeCount": 0, "skipCount": 3,
  "followUpsAnswered": 0, "fallbackAnswered": true,
  "proposedTitle": "QuickBooks migration cutover",
  "draftDayName": "Tuesday" }

GOOD SUMMARY:
Noted — none of the confirmation examples landed, but your fallback
answer on the QuickBooks migration cutover gives us something to draft
from. Ready by Tuesday.

WHY IT WORKS: Doesn't pretend the skips didn't happen. Names what
Hassan DID contribute (the fallback). Commits to the day. No apology,
no softener.

Bad example — over-formal corporate close
-----------------------------------------
INPUT JSON: (same as positive example 1)

BAD SUMMARY:
Thank you for taking the time to confirm 3 examples this morning. I
appreciate your input and will diligently prepare your draft for
Conditional Access for iOS, which will be available for your review by
Friday at the latest.

WHY IT FAILS: "Thank you for taking the time", "I appreciate your
input", and the trailing-sign-off softener style are all chatbot
tells. Long-winded for no signal. Hassan does not want a corporate
close.`;

export interface GenerateClosingSummaryInput {
  /** Raw session-state snapshot passed straight to the model as JSON. */
  sessionState: {
    confirmedCount: number;
    anonymizeCount: number;
    skipCount: number;
    followUpsAnswered: number;
    fallbackAnswered: boolean;
    proposedTitle: string;
    /** Deterministic weekday name computed by the orchestrator via
     *  `business-day.ts::nextDraftDay(now)`. Haiku interpolates this
     *  verbatim — does NOT compute its own day. */
    draftDayName: string;
  };
  anthropic: OpusAnthropicLike;
  logger: Logger;
}

/**
 * Builds the hardcoded fallback summary string the orchestrator falls
 * back to when Haiku errors. Reuses PR 2's existing placeholder builder
 * so the wire shape is unchanged on failure.
 */
function buildFallbackSummary(
  state: GenerateClosingSummaryInput['sessionState'],
): string {
  return buildCompletionPlaceholderMessage({
    confirmedCount: state.confirmedCount,
  });
}

export async function generateClosingSummary(
  input: GenerateClosingSummaryInput,
): Promise<ClosingSummaryResult> {
  const fallbackText = buildFallbackSummary(input.sessionState);

  const userMessage: OpusUserMessage = {
    role: 'user',
    content: JSON.stringify(input.sessionState),
  };

  let response;
  try {
    response = await input.anthropic.messages.create({
      model: CLOSING_SUMMARY_MODEL,
      max_tokens: CLOSING_SUMMARY_MAX_TOKENS,
      // NB: no `thinking` field — omitting it leaves thinking off on
      // Opus 4.8, which is what we want for this cheap paraphrase.
      output_config: {
        // Cap thinking spend — this is a 1–2 sentence paraphrase.
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: CLOSING_SUMMARY_JSON_SCHEMA,
        },
      },
      system: [
        {
          type: 'text',
          text: CLOSING_SUMMARY_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [userMessage],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    input.logger.error(
      {
        source: SOURCE,
        action: 'closing_summary_threw',
        reason: detail,
      },
      'model messages.create threw — falling back to placeholder',
    );
    return { ok: false, reason: 'api_error', detail, fallbackText };
  }

  const stop = response.stop_reason;
  switch (stop) {
    case 'end_turn':
      break;
    case 'max_tokens':
    case 'model_context_window_exceeded':
      input.logger.warn(
        {
          source: SOURCE,
          action: 'closing_summary_truncated',
          stop_reason: stop,
        },
        'model output truncated; falling back to placeholder',
      );
      return {
        ok: false,
        reason: 'truncated',
        detail: stop ?? 'unknown',
        fallbackText,
      };
    case 'refusal': {
      const message = response.refusal_message ?? 'unknown';
      input.logger.warn(
        {
          source: SOURCE,
          action: 'closing_summary_refused',
          refusal: message,
        },
        'model refused; falling back to placeholder',
      );
      return {
        ok: false,
        reason: 'refusal',
        detail: message,
        fallbackText,
      };
    }
    default: {
      const detail = `unexpected_stop:${stop ?? 'null'}`;
      input.logger.warn(
        {
          source: SOURCE,
          action: 'closing_summary_unexpected_stop',
          stop_reason: stop,
        },
        'model returned unexpected stop_reason; falling back to placeholder',
      );
      return {
        ok: false,
        reason: 'api_error',
        detail,
        fallbackText,
      };
    }
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || typeof textBlock.text !== 'string') {
    input.logger.warn(
      {
        source: SOURCE,
        action: 'closing_summary_no_text_block',
      },
      'model returned no text block; falling back to placeholder',
    );
    return {
      ok: false,
      reason: 'api_error',
      detail: 'no_text_block',
      fallbackText,
    };
  }

  const parsed = parseClosingSummaryResponse(textBlock.text);
  if (parsed === null) {
    input.logger.warn(
      {
        source: SOURCE,
        action: 'closing_summary_schema_mismatch',
        rawLength: textBlock.text.length,
      },
      'model response did not match ClosingSummary shape; falling back to placeholder',
    );
    return {
      ok: false,
      reason: 'schema_mismatch',
      fallbackText,
    };
  }

  return { ok: true, summaryText: parsed.summary_text };
}
