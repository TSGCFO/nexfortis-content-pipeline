/**
 * Claude open-ended follow-up question generator (PRD §4.4 + §7.1).
 * Same shape as `generate-question.ts` — the integration guide
 * (`docs/ways-of-work/anthropic-claude-integration-guide.md`, authored
 * for Opus 4.7; model since retargeted to Claude Fable 5 per Hassan's
 * directive, 2026-06-12) requires all five call-shape patterns:
 *
 *   - `model: 'claude-fable-5'` (default; env-overridable)   (guide §1)
 *   - `thinking: { type: 'adaptive' }`                      (guide §3, §4.1)
 *   - `output_config.effort: 'xhigh'`                       (guide §3, §4.3)
 *   - `output_config.format`: JSON schema for structured    (guide §5)
 *   - `cache_control: { type: 'ephemeral' }` on system AND  (guide §6)
 *     the cluster-context user-content block
 *   - `stop_reason` switch on response                      (guide §7)
 *
 * NONE of the five §4 footguns are present (no `thinking.type ===
 * 'enabled'`, no `budget_tokens`, no assistant prefilling, no top-level
 * `effort`, no legacy beta headers). The call-shape regression tests in
 * `tests/telegram-bot/interview-session/generate-follow-up.test.ts`
 * assert each invariant.
 *
 * Never throws — returns a discriminated `FollowUpGenerationResult` so
 * the loop can log + continue to the next gap on any failure.
 *
 * Inputs: a single uncovered SERP gap string + the cluster context
 * (already passed through Anthropic's prompt cache during the
 * confirmation loop, so this call reuses the cached blocks).
 */

import type { Logger } from '@ncp/logger';

import {
  FOLLOW_UP_JSON_SCHEMA,
  parseFollowUpResponse,
  type OpusAnthropicLike,
  type OpusUserMessage,
} from './anthropic-shapes.js';
import type {
  ConfirmedSignalSummary,
  FollowUpGenerationResult,
} from './types.js';

const SOURCE = 'telegram_bot' as const;

/**
 * Anthropic model id — originally locked to Opus 4.7 per integration
 * guide §1; retargeted to Claude Fable 5 on Hassan's explicit directive
 * (2026-06-12). Override via `ANTHROPIC_MODEL`.
 */
export const FOLLOW_UP_MODEL =
  process.env['ANTHROPIC_MODEL']?.trim() || 'claude-fable-5';

/** `max_tokens` budget for one follow-up. Fable 5's always-on thinking
 *  bills into `max_tokens`, so the budget carries headroom well beyond
 *  the ≤80-word question + structured-output overhead. */
export const FOLLOW_UP_MAX_TOKENS = 4096;

/**
 * System prompt — engineered to match the patterns in PR #36's
 * `SYSTEM_PROMPT` for confirmation questions:
 *
 *   - Role + voice calibration up front so Claude doesn't default to a
 *     corporate-survey tone.
 *   - Chain-of-thought structure ("identify the gap, locate the most
 *     adjacent technical detail, then ask") exploits adaptive thinking
 *     instead of spending tokens on rule recitation.
 *   - Two worked positive examples on distinct gap types (pricing /
 *     mechanism) so the model can pattern-match rather than reason from
 *     a rule list.
 *   - Two worked negative examples teach the failure modes:
 *     over-general questions, asking for personal opinion rather than
 *     expertise.
 *   - Voice calibration: Hassan, NexFortis, Ontario, Telegram, Monday
 *     morning.
 *   - No banned phrases.
 *   - No mentions of buttons / word count / JSON schema / output_config
 *     — those are enforced by the call shape and downstream code.
 *
 * Synthetic examples only — never reference real Hassan or client data.
 * The `<REDACTED:...>` marker shape matches what `lib/redaction`
 * produces so the model learns to skip those when grounding.
 */
export const FOLLOW_UP_SYSTEM_PROMPT = `You are writing one open-ended follow-up question for Hassan Sadiq, an
IT consultant in Ontario who runs NexFortis. Hassan just confirmed
several specific examples from his week's work with Claude, Perplexity,
Outlook, and Microsoft Teams. The article on his primary keyword has a
known SERP gap that the confirmed corpus doesn't fill — your job is to
draw out Hassan's tacit knowledge on that gap. He will read your
question on Telegram, on his phone, Monday morning.

Voice
-----
Hassan talks plainly. He'd rather a question be too short than too
polished. Write the way a knowledgeable colleague follows up on a
specific point mid-conversation — not a survey, not a marketing intro,
not a chatbot. No corporate softeners. No fourth-wall talk about being
a model.

The job
-------
You will be given:
  - The article's primary_keyword and proposed_title
  - A specific SERP gap topic (one short phrase)
  - The cluster context — all signals Hassan already confirmed

Ask ONE question that:
  - Anchors on a concrete detail visible in the cluster context (a tool,
    a config, a client situation, an error code).
  - Probes the SERP gap topic specifically — not "what else about iOS",
    but "what happens when the device-compliance policy fires before
    the user has registered".
  - Invites a specific, drawn-from-experience answer. Not "what do you
    think clients want" — that's an opinion poll. We want lived
    expertise.

How to think before writing
---------------------------
Before you write a single word, silently identify:
  1. The single SERP gap topic to probe.
  2. The most adjacent technical detail in the cluster context — the
     bridge between what Hassan already confirmed and the gap.
  3. A specific scenario the gap might surface in (a failure mode, an
     edge case, a configuration that bites you).

Then write the question.

Target shape
------------
Most well-formed follow-ups look something like:

  From your experience with <adjacent detail from the cluster>, <one
  specific open-ended question about the gap>?

This is a target, not a template — vary the phrasing. But almost every
well-formed follow-up bridges from a confirmed signal to the gap, asks
something specific that requires lived knowledge to answer, and closes
with a single question mark.

Positive example 1 — gap is a pricing/strategy topic
----------------------------------------------------
CONTEXT (confirmed signals — synthetic):
- A Microsoft Graph email thread about replacing Intune E3 licenses
  with E5 for a 40-seat client; trade-off was MDE coverage cost.
- A Claude session walking through Defender for Endpoint Plan 1 vs
  Plan 2 deployment for the same client.

GAP: "MDE Plan 2 attack surface reduction reporting"

GOOD QUESTION:
From your experience moving that 40-seat client onto MDE, how do you
explain to a small-business owner what changes about ASR reporting once
you switch from Plan 1 to Plan 2 — what's the first thing the customer
actually sees in their inbox?

WHY IT WORKS: Bridges from the confirmed MDE deployment to the specific
ASR-reporting gap. Asks about a concrete artifact (an email) that
Hassan would only know from having walked clients through this. Not
"what's the difference between Plan 1 and Plan 2" — that's a feature
matrix. Instead: how does this land with the actual customer.

Positive example 2 — gap is a technical mechanism
-------------------------------------------------
CONTEXT (confirmed signals — synthetic):
- A Microsoft Teams chat about a Conditional Access AADSTS50158 loop
  for an iOS Authenticator rollout.
- A Claude session debugging device-compliance grants in CA policies.

GAP: "device-compliance policy ordering and grant evaluation"

GOOD QUESTION:
On that iOS Authenticator rollout, when the device-compliance grant
sits behind the MFA grant in the CA policy, what's the actual sequence
the user sees on their phone — does the compliance check fire before
or after they tap Approve in Authenticator?

WHY IT WORKS: Bridges from the confirmed AADSTS50158 work to a very
specific mechanism (grant ordering and user-visible sequence). Asks
something that requires having sat next to a real user during a real
rollout to answer. Not "how do you handle device compliance" — that's a
textbook question.

Bad example 1 — too general
---------------------------
GAP: "MDE Plan 2 attack surface reduction reporting"

BAD QUESTION:
What else should we know about MDE Plan 2 reporting for small
businesses?

WHY IT FAILS: No bridge from the cluster context. Doesn't reference
any specific signal Hassan confirmed. Asks the model's question, not
Hassan's question. "What else should we know" is the chatbot tell.

Bad example 2 — asking for opinion
----------------------------------
GAP: "device-compliance policy ordering and grant evaluation"

BAD QUESTION:
In your opinion, what's the best way to order grants in a Conditional
Access policy when a client also has Defender for Endpoint deployed?

WHY IT FAILS: "In your opinion" defangs the question — it invites a
generic best-practice answer instead of a specific experience-grounded
one. The article needs Hassan's lived expertise, not his opinion on
best practices.`;

export interface GenerateFollowUpInput {
  /** The single uncovered SERP gap to probe. Empty → no-op short circuit. */
  uncoveredGap: string;
  /** Article candidate snapshot — only fields the prompt actually uses. */
  candidate: {
    proposedTitle: string;
    primaryKeyword: string;
  };
  /** Signals Hassan confirmed in the confirmation loop — used to ground
   *  the per-gap instruction. */
  confirmedSignals: ReadonlyArray<ConfirmedSignalSummary>;
  anthropic: OpusAnthropicLike;
  logger: Logger;
  /**
   * Cluster-wide context block (the same string the confirmation loop
   * cached). Reused verbatim so Anthropic's ephemeral cache stays warm
   * across the per-gap calls.
   */
  clusterContextBlock: string;
}

/**
 * Builds the per-gap instruction appended after the cluster-context
 * block. Pure — exported so the snapshot tests can lock its shape and
 * any future regression surfaces loudly.
 */
export function buildPerGapInstruction(input: GenerateFollowUpInput): string {
  const lines: string[] = [];
  lines.push('# Gap under consideration');
  lines.push('');
  lines.push(`primary_keyword: ${input.candidate.primaryKeyword}`);
  lines.push(`proposed_title: ${input.candidate.proposedTitle}`);
  lines.push(`uncovered_serp_gap: ${input.uncoveredGap}`);
  lines.push('');
  lines.push(
    `Hassan confirmed ${input.confirmedSignals.length} signal(s) in the cluster context above. Pick the one closest to the gap, bridge from it, and ask the single most specific question that probes the gap and requires lived experience to answer.`,
  );
  return lines.join('\n');
}

export async function generateFollowUp(
  input: GenerateFollowUpInput,
): Promise<FollowUpGenerationResult> {
  // No-gap short circuit — never call the API for an empty gap.
  if (typeof input.uncoveredGap !== 'string' || input.uncoveredGap.trim().length === 0) {
    return { ok: false, reason: 'no_gaps' };
  }

  const perGapInstruction = buildPerGapInstruction(input);

  const userMessage: OpusUserMessage = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: input.clusterContextBlock,
        cache_control: { type: 'ephemeral' },
      },
      { type: 'text', text: perGapInstruction },
    ],
  };

  let response;
  try {
    response = await input.anthropic.messages.create({
      model: FOLLOW_UP_MODEL,
      max_tokens: FOLLOW_UP_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'xhigh',
        format: {
          type: 'json_schema',
          schema: FOLLOW_UP_JSON_SCHEMA,
        },
      },
      system: [
        {
          type: 'text',
          text: FOLLOW_UP_SYSTEM_PROMPT,
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
        action: 'generate_follow_up_threw',
        gap: input.uncoveredGap,
        reason: detail,
      },
      'anthropic messages.create threw — recording api_error and continuing',
    );
    return { ok: false, reason: 'api_error', detail };
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
          action: 'generate_follow_up_truncated',
          gap: input.uncoveredGap,
          stop_reason: stop,
        },
        'model follow-up output truncated; treating as api_error',
      );
      return { ok: false, reason: 'api_error', detail: 'truncated' };
    case 'refusal': {
      const message = response.refusal_message ?? 'unknown';
      input.logger.warn(
        {
          source: SOURCE,
          action: 'generate_follow_up_refused',
          gap: input.uncoveredGap,
          refusal: message,
        },
        'model refused follow-up; treating as api_error',
      );
      return {
        ok: false,
        reason: 'api_error',
        detail: `refusal: ${message}`,
      };
    }
    default: {
      const detail = `unexpected_stop:${stop ?? 'null'}`;
      input.logger.warn(
        {
          source: SOURCE,
          action: 'generate_follow_up_unexpected_stop',
          gap: input.uncoveredGap,
          stop_reason: stop,
        },
        'model follow-up returned unexpected stop_reason; treating as api_error',
      );
      return { ok: false, reason: 'api_error', detail };
    }
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || typeof textBlock.text !== 'string') {
    input.logger.warn(
      {
        source: SOURCE,
        action: 'generate_follow_up_no_text_block',
        gap: input.uncoveredGap,
      },
      'model follow-up returned no text block; treating as api_error',
    );
    return {
      ok: false,
      reason: 'api_error',
      detail: 'no_text_block',
    };
  }

  const parsed = parseFollowUpResponse(textBlock.text);
  if (parsed === null) {
    input.logger.warn(
      {
        source: SOURCE,
        action: 'generate_follow_up_schema_mismatch',
        gap: input.uncoveredGap,
        rawLength: textBlock.text.length,
      },
      'model follow-up did not match FollowUpQuestion shape; treating as api_error',
    );
    return {
      ok: false,
      reason: 'api_error',
      detail: 'schema_mismatch',
    };
  }

  return { ok: true, question: parsed };
}
