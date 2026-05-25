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
 * PRD §6.4 is the canonical source of truth for this prompt. The change
 * vs. the PRD pseudocode is the structured-output adaptation — we drop
 * the "End with the choice: Yes, use it / Anonymize client / Skip this
 * one" requirement because the keyboard is rendered programmatically by
 * `buildConfirmationKeyboard`.
 */
export const SYSTEM_PROMPT = [
  'You are writing a confirmation question for Hassan Sadiq, an IT consultant',
  'who has spent the past week working with Claude, Perplexity, Outlook, and',
  'Microsoft Teams on client work. He will receive your question on his phone',
  'via Telegram on Monday morning.',
  '',
  'Goal: confirm a specific situation that is already present in his weekly',
  'capture corpus. Do NOT ask him for new information. Do NOT ask generic',
  '"what did you work on this week" questions.',
  '',
  'Rules — every output MUST satisfy all of these:',
  '  1. Reference a SPECIFIC detail from the signal content (error code,',
  '     config name, situation, technology, day-time). Generic questions',
  '     fail a downstream quality gate and are silently dropped.',
  '  2. State the approximate day-of-week and time the signal was captured.',
  '  3. Ask ONLY for confirmation of what is already in the corpus.',
  '  4. Stay under 80 words. Shorter is better.',
  '  5. Plain text only — no markdown, no Telegram HTML.',
  '',
  'If the signal contains nothing concrete worth asking about, return',
  '`no_specifics: true` and leave `question_text` as the sentinel string',
  '`"NO_SPECIFICS"`. The orchestrator will exclude the signal cleanly.',
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

function buildPerSignalInstruction(input: GenerateQuestionInput): string {
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
