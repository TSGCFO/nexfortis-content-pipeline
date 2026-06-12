/**
 * Claude confirmation-question generator (PRD §6.4 + §7.1).
 *
 * Follows `docs/ways-of-work/anthropic-claude-integration-guide.md`
 * (authored for Opus 4.7; model since retargeted to Claude Fable 5 per
 * Hassan's directive, 2026-06-12 — the guide's call-shape rules carry
 * over unchanged):
 *   - `model: 'claude-fable-5'` (default; env-overridable)  (guide §1)
 *   - `thinking: { type: 'adaptive' }`                     (guide §3, §4.1)
 *   - `output_config.effort: 'xhigh'`                      (guide §3, §4.3)
 *   - `output_config.format`: JSON schema for structured  (guide §5)
 *     outputs (no prefilled-`{` trick, no Zod cast — see
 *     `anthropic-shapes.ts` for the schema and parser)
 *   - `cache_control: { type: 'ephemeral' }` on the system (guide §6)
 *     block AND the cluster-context user-content block
 *   - `stop_reason` switch on the response                 (guide §7)
 *
 * NONE of the five §4 footguns are present:
 *   - no `thinking.type === 'enabled'` / `budget_tokens`
 *   - no assistant prefilling
 *   - no top-level `effort:` (always inside `output_config`)
 *   - no legacy beta headers (the SDK doesn't accept them on `create()`)
 *   - we leave the thinking display `omitted` (the default on Fable 5,
 *     as it was on Opus 4.7) since we don't need to inspect thinking
 *     content for confirmation-question generation
 *
 * Never throws — returns a discriminated `QuestionGenerationResult` so the
 * orchestrator can record `signal_exclusions` and continue the loop.
 */

import type { Logger } from '@ncp/logger';

import type { SelectedSignal } from '../../lib/select-signals-for-cluster.js';
import {
  QUESTION_JSON_SCHEMA,
  parseQuestionResponse,
  type OpusAnthropicLike,
  type OpusUserMessage,
} from './anthropic-shapes.js';
import type { QuestionGenerationResult, QuestionResponse } from './types.js';

const SOURCE = 'telegram_bot' as const;

/**
 * Anthropic model id for confirmation-question generation. The guide
 * originally locked this to Opus 4.7; retargeted to Claude Fable 5 on
 * Hassan's explicit directive (2026-06-12). Override via
 * `ANTHROPIC_MODEL` to tier down without a code change.
 */
export const QUESTION_MODEL =
  process.env['ANTHROPIC_MODEL']?.trim() || 'claude-fable-5';

/**
 * `max_tokens` budget for one question. Fable 5's thinking is always on
 * and bills into `max_tokens`, so the budget carries headroom well beyond
 * the ≤80-word question + structured-output overhead.
 */
export const MAX_TOKENS = 4096;

/**
 * System prompt — kept constant across the entire confirmation loop so
 * Anthropic's prompt cache (`cache_control: ephemeral`) deduplicates the
 * cost across the 3–5 per-cluster calls.
 *
 * Engineering notes (PR follow-up to PR #34):
 *   - Role + voice calibration up front so Claude doesn't default to a
 *     corporate-survey tone.
 *   - Chain-of-thought structure — "identify the single most concrete
 *     detail first, then write" — exploits adaptive thinking instead of
 *     spending tokens on rule recitation.
 *   - Three worked positive examples covering distinct signal sources
 *     (Microsoft Graph email, Claude session, Microsoft Teams chat) so the
 *     model can pattern-match rather than reason from a rule list.
 *   - Two worked negative examples teach the quality gate's banned
 *     patterns (generic openers, asking for new information) from
 *     examples rather than from rule descriptions.
 *   - The `NO_SPECIFICS` branch is its own labelled section, not buried
 *     in a rule list.
 *
 * The prompt deliberately does NOT mention: the answer-choice buttons
 * (rendered by `buildConfirmationKeyboard`), word count (enforced by the
 * structured-output schema + `qualityGate`), HTML escaping (handled by
 * `formatConfirmationMessage`), or "return JSON" (the
 * `output_config.format` JSON schema is grammar-enforced).
 *
 * Example signals here are SYNTHETIC. They sound plausible but must
 * never reference real Hassan or client data — `lib/redaction` produces
 * `<REDACTED:person>`-style markers and these examples carry the same
 * shape so the model learns to ignore those markers when grounding.
 */
export const SYSTEM_PROMPT = `You are writing a confirmation question for Hassan Sadiq, an IT consultant
in Ontario who runs NexFortis. Hassan spent the past week working through
client problems with Claude, Perplexity, Outlook, and Microsoft Teams. He
will read your question on his phone on Monday morning.

Voice
-----
Hassan talks plainly. He'd rather a question be too short than too polished.
Write the way a knowledgeable colleague checks a detail mid-conversation —
not a survey, not a marketing intro, not a chatbot. No corporate softeners.
No fourth-wall talk about being a model.

The job
-------
Confirm a specific situation that is already in the signal text below. Cite
what you actually see. Do not ask Hassan for new information. Do not ask
generic "what were you working on" questions — those get silently dropped
by a downstream quality gate.

How to think before writing
---------------------------
Before you write a single word, silently identify:
  1. The single most concrete detail in the signal — an error code, a
     config name, a client situation, a tool, a technology.
  2. Why that detail matters for the article's primary_keyword.
  3. The day-of-week and approximate time the signal was captured.
  4. Whether the most concrete detail is too sensitive — if the only
     concrete thing is a client identity that has already been replaced
     by a <REDACTED:...> marker, ground the question on a less-sensitive
     technical detail instead.

Then write the question.

Target shape
------------
Most well-formed questions look something like:

  Looks like last <day> around <time>, you spent some time on <specific>.
  Was that real client work that fits "<primary_keyword>"?

This is a target, not a template — vary the phrasing. But almost every
well-formed question contains: a day/time anchor, a concrete detail copied
from the signal, a light reference to the primary_keyword, and a casual
second-person past-tense close.

Positive example 1 — Microsoft Graph email signal
-------------------------------------------------
SIGNAL (redacted_text):
2026-05-20T14:23:00Z Subject: Re: Conditional Access AADSTS50158 retry loop
From: <REDACTED:person>
Body: Confirmed — adding the device-compliance grant solved it. Took about
40 min to track down. The Intune compliance policy was missing the
registry value.

GOOD QUESTION:
Looks like last Wednesday around 2pm you cleaned up an AADSTS50158 loop —
sounds like you traced it to a missing Intune compliance registry value
and the device-compliance grant fix took about 40 minutes. Was that real
client work that fits "Conditional Access for iOS"?

WHY IT WORKS: Specific error code (AADSTS50158), specific fix (device-
compliance grant), specific detail (missing Intune compliance registry
value), exact day and time anchor, light keyword reference, casual
second-person past-tense close.

Positive example 2 — Claude session about a QuickBooks Online migration
-----------------------------------------------------------------------
SIGNAL (redacted_text):
2026-05-21T10:05:00Z Source: claude_session
Topic: QuickBooks Desktop → QBO migration for <REDACTED:client>. Worked
through sales tax mapping for ON-HST vs QBO's combined-rate model,
multicurrency exposure on USD vendor bills, and how to preserve historical
aging buckets. Settled on a phased cutover with a parallel run through one
full month-end.

GOOD QUESTION:
Last Thursday around 10am you worked the QuickBooks Desktop to QBO move
with Claude — sales tax mapping for ON-HST, the multicurrency USD vendor
bills, and a phased cutover with a parallel run through month-end. Was
that real client work that fits "QuickBooks Online migration"?

WHY IT WORKS: Multiple specific mechanisms cited (ON-HST sales tax mapping,
USD multicurrency exposure, phased cutover with parallel run), specific
migration path (QuickBooks Desktop to QBO), exact day and approximate
time, direct keyword fit. The question lists what was actually worked on
rather than paraphrasing it abstractly.

Positive example 3 — Microsoft Teams chat about a cybersecurity audit finding
-----------------------------------------------------------------------------
SIGNAL (redacted_text):
2026-05-22T15:48:00Z Source: msteams_chat
From: <REDACTED:person>
Body: CIS Control 6 audit finding for <REDACTED:client> — five privileged
accounts without MFA enforcement and three service accounts on password
auth instead of managed identities. Drafted the remediation memo: enforce
MFA via CA policy, migrate service accounts to managed identities by Q3.

GOOD QUESTION:
Looks like last Friday around 4pm you walked through a CIS Control 6
finding in Teams — five privileged accounts missing MFA enforcement and
three service accounts still on password auth instead of managed
identities. Was that real client work that fits "privileged access audit
remediation"?

WHY IT WORKS: Specific framework reference (CIS Control 6), specific
counts (five privileged accounts, three service accounts), specific
mechanisms (MFA enforcement, password auth vs managed identities), exact
day and time anchor, accurate keyword fit. The question reads as a
colleague confirming what the audit found, not as a survey.

Bad example 1 — generic opener
------------------------------
SIGNAL:
2026-05-21T09:15:00Z Subject: Re: M365 setup
From: <REDACTED:person>
Body: Helped a new client onboard. Set up E3 licenses, configured SSO,
no issues.

BAD QUESTION:
What did you work on this week related to Microsoft 365 setup?

WHY IT FAILS: "What did you work on this week" is a banned generic opener.
The question cites nothing concrete from the signal — E3 licenses, SSO
configuration, the onboarding context all went unused. There is no
day-of-week or time anchor.

Bad example 2 — asking for new information
------------------------------------------
SIGNAL:
2026-05-19T11:30:00Z Source: claude_session
Topic: Designed an Intune autopilot enrollment profile for
<REDACTED:client>. Group tag "FIN-LAP-W11", user-driven mode, Microsoft
Entra join, ESP blocking with apps required: Defender, Edge for Business,
Company Portal.

BAD QUESTION:
You set up an Intune autopilot profile last Tuesday — what other autopilot
scenarios do you think clients in finance need?

WHY IT FAILS: The signal already contains the concrete details (group tag
FIN-LAP-W11, ESP blocking apps, user-driven mode, Entra join). A good
question confirms those. Asking what Hassan "thinks clients need" is a
request for new information that defeats the corpus-grounded interview.

NO_SPECIFICS branch
-------------------
If the signal genuinely contains nothing concrete to confirm — for example:
  - The redacted_text is under ~50 characters of meaningful content.
  - The signal is small talk with no technical detail.
  - Every concrete detail in the signal has been replaced by a
    <REDACTED:...> marker.
  - The signal is off-topic from the article's primary_keyword.

…then return no_specifics: true and set question_text to the exact
sentinel string "NO_SPECIFICS". The orchestrator will drop the signal
cleanly. This is a legitimate, expected outcome — do not stretch to write
a generic question to avoid it.

NO_SPECIFICS example:
SIGNAL:
2026-05-23T20:10:00Z Source: claude_session
Topic: Quick "thanks" from <REDACTED:person>. <REDACTED:person>. End of
chat.

CORRECT RESPONSE: no_specifics: true, question_text "NO_SPECIFICS",
detected_specifics: []. There is nothing concrete to confirm.`;

/** Per-signal input — assembled by `runConfirmationLoop` for each call. */
export interface GenerateQuestionInput {
  signal: SelectedSignal;
  candidate: {
    proposedTitle: string;
    primaryKeyword: string;
  };
  anthropic: OpusAnthropicLike;
  logger: Logger;
  /**
   * Cluster-wide context block, computed ONCE by the loop and reused for
   * every signal in the same cluster. Carries the prompt cache hit.
   */
  clusterContextBlock: string;
  /**
   * On a retry-after-quality-gate-failure call, the caller passes a
   * compact reason string (e.g. `'word_count+generic_phrase'`) so the
   * model can correct course. Included as a trailing sentence in the
   * per-signal instruction so the cache hit on the cluster context is
   * preserved.
   */
  retryReason?: string;
}

function dayOfWeekUTC(d: Date): string {
  const names = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return names[d.getUTCDay()] ?? 'unknown day';
}

function approxTimeUTC(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm} UTC`;
}

/**
 * Per-signal instruction — appended after the cluster-context block on
 * every per-signal call. Pure function: deterministic output for a given
 * input, no I/O. Exported so the snapshot tests can lock its shape and
 * future regressions surface loudly.
 *
 * Shape is deliberately uniform across the 3–5 sequential calls so the
 * model can pattern-match. The retry branch is a single appended
 * paragraph that names the quality-gate failure modes to fix; it lives
 * AFTER the signal content so the cluster-context cache hit is preserved
 * (only the trailing per-signal block changes between calls).
 */
export function buildPerSignalInstruction(input: GenerateQuestionInput): string {
  const lines: string[] = [];
  lines.push('# Signal under consideration');
  lines.push('');
  lines.push(`signal_id: ${input.signal.id}`);
  lines.push(`source: ${input.signal.source}`);
  lines.push(
    `captured_at: ${dayOfWeekUTC(input.signal.capturedAt)} at ${approxTimeUTC(input.signal.capturedAt)}`,
  );
  lines.push('');
  lines.push('Article candidate:');
  lines.push(`  proposed_title: ${input.candidate.proposedTitle}`);
  lines.push(`  primary_keyword: ${input.candidate.primaryKeyword}`);
  lines.push('');
  lines.push('Signal content (redacted, first 500 chars):');
  lines.push(input.signal.redactedText.slice(0, 500));
  lines.push('');
  lines.push(
    'Set signal_id to the exact UUID above. Copy the evidence_phrase verbatim from the signal content. If nothing concrete is present, use the NO_SPECIFICS branch.',
  );
  if (
    typeof input.retryReason === 'string' &&
    input.retryReason.length > 0
  ) {
    lines.push('');
    lines.push(
      `Previous attempt failed the quality gate (${input.retryReason}). Anchor on a concrete detail copied from the signal content above; do not paraphrase generically.`,
    );
  }
  return lines.join('\n');
}

export async function generateQuestion(
  input: GenerateQuestionInput,
): Promise<QuestionGenerationResult> {
  const perSignalInstruction = buildPerSignalInstruction(input);

  const userMessage: OpusUserMessage = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: input.clusterContextBlock,
        cache_control: { type: 'ephemeral' },
      },
      { type: 'text', text: perSignalInstruction },
    ],
  };

  let response;
  try {
    response = await input.anthropic.messages.create({
      model: QUESTION_MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'xhigh',
        format: {
          type: 'json_schema',
          schema: QUESTION_JSON_SCHEMA,
        },
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
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
        action: 'generate_question_threw',
        signalId: input.signal.id,
        reason: detail,
      },
      'anthropic messages.create threw — recording api_error and continuing',
    );
    return { ok: false, reason: 'api_error', detail };
  }

  const stop = response.stop_reason;
  switch (stop) {
    case 'end_turn':
      // Fall through to parsing below.
      break;
    case 'max_tokens':
    case 'model_context_window_exceeded':
      input.logger.warn(
        {
          source: SOURCE,
          action: 'generate_question_truncated',
          signalId: input.signal.id,
          stop_reason: stop,
        },
        'model output truncated; treating as api_error',
      );
      return { ok: false, reason: 'api_error', detail: 'truncated' };
    case 'refusal': {
      const message = response.refusal_message ?? 'unknown';
      input.logger.warn(
        {
          source: SOURCE,
          action: 'generate_question_refused',
          signalId: input.signal.id,
          refusal: message,
        },
        'model refused; treating as api_error',
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
          action: 'generate_question_unexpected_stop',
          signalId: input.signal.id,
          stop_reason: stop,
        },
        'model returned unexpected stop_reason; treating as api_error',
      );
      return { ok: false, reason: 'api_error', detail };
    }
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || typeof textBlock.text !== 'string') {
    input.logger.warn(
      {
        source: SOURCE,
        action: 'generate_question_no_text_block',
        signalId: input.signal.id,
      },
      'model returned no text block; treating as api_error',
    );
    return {
      ok: false,
      reason: 'api_error',
      detail: 'no_text_block',
    };
  }

  const parsed = parseQuestionResponse(textBlock.text);
  if (parsed === null) {
    input.logger.warn(
      {
        source: SOURCE,
        action: 'generate_question_schema_mismatch',
        signalId: input.signal.id,
        rawLength: textBlock.text.length,
      },
      'model response did not match QuestionResponse shape; treating as api_error',
    );
    return {
      ok: false,
      reason: 'api_error',
      detail: 'schema_mismatch',
    };
  }

  if (parsed.no_specifics) {
    return { ok: false, reason: 'no_specifics' };
  }

  // Be defensive: even with structured outputs, force signal_id to the
  // one we passed in. Claude could echo it correctly per the prompt
  // requirement, but we don't trust schema-conforming-but-wrong values
  // (the model could conceivably switch IDs across batched calls).
  const question: QuestionResponse = {
    ...parsed,
    signal_id: input.signal.id,
  };

  return { ok: true, question };
}
