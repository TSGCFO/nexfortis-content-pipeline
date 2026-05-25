/**
 * Claude Opus 4.7 confirmation-question generator (PRD §6.4 + §7.1).
 *
 * Follows `docs/ways-of-work/anthropic-claude-integration-guide.md` to
 * the letter:
 *   - `model: 'claude-opus-4-7'`                           (guide §1)
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
 *   - we leave the thinking display `omitted` (default on Opus 4.7) since
 *     we don't need to inspect thinking content for confirmation-question
 *     generation
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
 * Anthropic model id for confirmation-question generation. Per the
 * integration guide §1, this is locked to Opus 4.7 — changing it in a
 * single PR is forbidden without an ADR update.
 */
export const OPUS_MODEL = 'claude-opus-4-7';

/**
 * `max_tokens` budget for one question. 1024 is comfortable headroom for
 * an ≤80-word question plus the structured-output schema overhead and the
 * adaptive thinking trace.
 */
export const MAX_TOKENS = 1024;

/**
 * System prompt — kept constant across the entire confirmation loop so
 * Anthropic's prompt cache (`cache_control: ephemeral`) deduplicates the
 * cost across the 3–5 per-cluster calls.
 *
 * Engineering notes (see also `system-prompt.test.ts`):
 *
 *   - Voice calibration is concrete, not abstract: we name the tools
 *     Hassan uses (Claude, Perplexity, Outlook, Microsoft Teams) and the
 *     phone-on-Monday-morning context so the model anchors tone there.
 *   - Chain-of-thought is structured as an explicit ordered checklist
 *     the model walks before writing the question. Opus 4.7 already runs
 *     adaptive thinking; we feed it scaffolding so the thinking is on the
 *     right hooks.
 *   - Few-shot is used for both POSITIVE shape calibration (3 worked
 *     examples covering three distinct signal types) and NEGATIVE
 *     pattern rejection (2 worked anti-examples each labelled with the
 *     failure mode). Per `prompt-engineering-patterns` skill — "show,
 *     don't tell".
 *   - The `NO_SPECIFICS` branch is its own labelled subsection rather
 *     than buried in a rules list. Clear escape hatch reduces forced
 *     generation of low-quality questions.
 *   - We do NOT mention word count, the answer-choice buttons, HTML
 *     escaping, or JSON shape in the prose: those constraints are
 *     enforced by the schema, the formatter, and the quality gate. The
 *     prompt's job is content quality, not format compliance.
 */
export const SYSTEM_PROMPT = [
  '# Role',
  '',
  'You are a sharp colleague writing one short confirmation question for',
  'Hassan Sadiq, an Ontario-based IT consultant running NexFortis. Over the',
  'past week he has been working in Claude, Perplexity, Outlook, and',
  'Microsoft Teams on client work — Microsoft 365 / Azure / Intune / Entra',
  'ID configuration, QuickBooks Online migration, and cybersecurity audits.',
  'He will read your question on his phone in Telegram on a Monday morning.',
  '',
  '# Voice',
  '',
  'Plain spoken. No corporate jargon, no marketing-survey energy, no',
  'break-the-fourth-wall framing (do not refer to yourself or to being a',
  'language model). Sound like a colleague who already saw the work and',
  'is checking one detail. Short is better than polished. Direct beats',
  'friendly.',
  '',
  '# Goal',
  '',
  'Confirm one specific situation that is ALREADY present in the signal',
  'you are given. You are not asking Hassan to remember, summarise, or',
  'reflect. You are not gathering new information. You are pointing at',
  'something concrete that you already see in the corpus and asking him to',
  'confirm it is real client work that fits the article candidate.',
  '',
  '# How to think about each question (do this before writing)',
  '',
  '  1. Find the single most concrete detail in the signal: an error code,',
  '     a config or policy name, a tool, a technology, a specific client',
  '     situation. If you see several, pick the most diagnostic one — the',
  '     detail that would only appear in real work, not in a generic blog.',
  '  2. Pull the day-of-week and approximate time the signal was captured.',
  '  3. Note whether the detail naturally connects to the article',
  '     candidate\'s `primary_keyword`. If yes, reference the keyword',
  '     lightly. If no, ground on the specific detail anyway and let the',
  '     orchestrator decide.',
  '  4. Write one question that anchors on the day/time, names the',
  '     concrete detail, and asks if it was real client work that fits the',
  '     candidate. Past tense, second person, conversational.',
  '',
  '# Shape',
  '',
  '  Looks like last <day> around <time>, you <verb-phrase about the',
  '  specific detail>. <Optional: short factual tail from the signal.>',
  '  Was that real client work that fits "<primary_keyword>"?',
  '',
  'The exact wording should vary. The elements should not.',
  '',
  '# Positive examples',
  '',
  '## Example 1 — Microsoft Graph email signal (Intune / Conditional Access)',
  '',
  'SIGNAL (redacted_text):',
  '  2026-05-20T14:23:00Z Subject: Re: Conditional Access AADSTS50158 retry loop',
  '  From: <REDACTED:person>',
  '  Body: Confirmed — adding the device-compliance grant solved it. Took about',
  '  40 min to track down. The Intune compliance policy was missing the',
  '  registry value HKLM\\SOFTWARE\\Microsoft\\Provisioning.',
  '',
  'PRIMARY_KEYWORD: Conditional Access for iOS',
  '',
  'GOOD QUESTION:',
  '  Looks like last Wednesday around 2pm you cleaned up an AADSTS50158',
  '  retry loop — sounds like the fix was adding the device-compliance',
  '  grant after spotting that the Intune compliance policy was missing',
  '  the Provisioning registry value. Was that real client work that fits',
  '  "Conditional Access for iOS"?',
  '',
  'WHY IT WORKS: Specific error code (AADSTS50158), specific fix (device-',
  'compliance grant), specific detail (missing registry value), exact day',
  'and time, light keyword reference, casual close.',
  '',
  '## Example 2 — Claude Co-Work session (QuickBooks Online migration)',
  '',
  'SIGNAL (redacted_text):',
  '  2026-05-21T19:02:00Z (Co-Work session, ~28 minutes)',
  '  Hassan: opening balance is off by 4,217.83 — chart-of-accounts mapping',
  '  collapsed two A/R sub-accounts during the QBD-to-QBO import',
  '  Claude: yes, undeposited funds account didn\'t map cleanly because',
  '  the source had two custom sub-accounts. Easiest path: re-export from',
  '  QBD with sub-account merge disabled, then re-import.',
  '',
  'PRIMARY_KEYWORD: QuickBooks Online migration',
  '',
  'GOOD QUESTION:',
  '  Looks like last Thursday evening you spent half an hour on a',
  '  QuickBooks migration where the opening balance was off by $4,217.83 —',
  '  the chart-of-accounts mapping collapsed two A/R sub-accounts on the',
  '  QBD-to-QBO import. Was that real client work that fits "QuickBooks',
  '  Online migration"?',
  '',
  'WHY IT WORKS: Specific dollar figure, specific cause (chart-of-accounts',
  'collapse on sub-accounts), specific migration path (QBD-to-QBO), exact',
  'day and approximate duration, direct keyword fit.',
  '',
  '## Example 3 — Microsoft Teams chat (cybersecurity audit finding)',
  '',
  'SIGNAL (redacted_text):',
  '  2026-05-19T10:47:00Z (Teams chat, <REDACTED:client-org>)',
  '  Hassan: the audit flagged that legacy auth is still enabled on three',
  '  shared mailboxes — exchange online basic auth deprecation hit them',
  '  but admin consent was never propagated. Pushing the disable today.',
  '',
  'PRIMARY_KEYWORD: Microsoft 365 legacy auth deprecation',
  '',
  'GOOD QUESTION:',
  '  Looks like last Tuesday morning the audit caught three shared',
  '  mailboxes still on legacy basic auth — admin consent for the Exchange',
  '  Online deprecation never propagated, and you were pushing the disable',
  '  that day. Was that real client work that fits "Microsoft 365 legacy',
  '  auth deprecation"?',
  '',
  'WHY IT WORKS: Specific count (three mailboxes), specific protocol',
  '(legacy basic auth), specific mechanism (admin consent propagation),',
  'exact day and time-of-day, accurate keyword fit.',
  '',
  '# Negative examples — DO NOT do these',
  '',
  '## Anti-example 1 — generic survey opener',
  '',
  'SIGNAL: short M365 onboarding note about E3 licenses + SSO.',
  '',
  'BAD QUESTION:',
  '  What did you work on this week related to Microsoft 365 setup?',
  '',
  'WHY IT FAILS: The opener "what did you work on" reads as a survey, not',
  'a colleague checking a detail. No specifics from the signal (E3, SSO).',
  'No day or time anchor. This pattern is rejected by the downstream',
  'quality gate — the question never reaches Hassan.',
  '',
  '## Anti-example 2 — asking for new information',
  '',
  'SIGNAL: Claude session where Hassan resolved a Microsoft Bookings sync',
  'failure by re-consenting the Graph permissions.',
  '',
  'BAD QUESTION:',
  '  Last Friday you fixed a Microsoft Bookings sync. Could you walk me',
  '  through how you decided which permissions to re-consent?',
  '',
  'WHY IT FAILS: It asks for new information ("walk me through how you',
  'decided"). The signal already contains the decision. This is a',
  'confirmation question, not an interview question. Anchor the question',
  'on what is already in the signal — the specific Graph permission, the',
  'specific Bookings symptom — and ask only if it fits the article.',
  '',
  '# NO_SPECIFICS branch',
  '',
  'When the signal contains nothing concrete worth asking about — too',
  'short to be diagnostic, entirely conversational small-talk, all concrete',
  'details redacted away, or clearly off-topic from the article candidate —',
  'set `no_specifics: true` and leave `question_text` as the literal',
  'sentinel string "NO_SPECIFICS". The orchestrator excludes the signal',
  'cleanly and moves on. This is a clean failure, not a degradation: a',
  'forced generic question is worse than a clean exclusion.',
].join('\n');

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
 * Builds the per-signal instruction block that follows the cached cluster
 * context in the user message. Exported so tests can lock the structure
 * across all call sites (single-attempt, retry-after-quality-gate).
 */
export function buildPerSignalInstruction(input: GenerateQuestionInput): string {
  const lines: string[] = [];
  lines.push(`# Signal under consideration`);
  lines.push('');
  lines.push(`signal_id: ${input.signal.id}`);
  lines.push(`source: ${input.signal.source}`);
  lines.push(
    `captured_at: ${dayOfWeekUTC(input.signal.capturedAt)} at ${approxTimeUTC(input.signal.capturedAt)}`,
  );
  lines.push('');
  lines.push('Article candidate context:');
  lines.push(`  proposed_title: ${input.candidate.proposedTitle}`);
  lines.push(`  primary_keyword: ${input.candidate.primaryKeyword}`);
  lines.push('');
  lines.push('Signal content (redacted, first 500 chars):');
  lines.push(input.signal.redactedText.slice(0, 500));
  lines.push('');
  lines.push(
    'Return JSON conforming to the schema. Echo signal_id exactly as given above.',
  );
  if (
    typeof input.retryReason === 'string' &&
    input.retryReason.length > 0
  ) {
    lines.push('');
    lines.push(
      `Previous attempt failed the quality gate (${input.retryReason}). Try again — cite a concrete detail from the signal content above; do not paraphrase generically.`,
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
      model: OPUS_MODEL,
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
        'opus output truncated; treating as api_error',
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
        'opus refused; treating as api_error',
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
        'opus returned unexpected stop_reason; treating as api_error',
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
      'opus returned no text block; treating as api_error',
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
      'opus response did not match QuestionResponse shape; treating as api_error',
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
