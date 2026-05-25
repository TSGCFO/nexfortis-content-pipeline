/**
 * Claude Opus 4.7 confirmation-question generator.
 *
 * Per `docs/ways-of-work/anthropic-claude-integration-guide.md`:
 *
 *   - model: 'claude-opus-4-7'
 *   - thinking: { type: 'adaptive' }            (footgun 1: NOT 'enabled' + budget_tokens)
 *   - output_config.effort: 'xhigh'             (footgun 3: never at top-level)
 *   - output_config.format: { type: 'json_schema', schema }   (footgun 2: replaces prefill)
 *   - system + cluster context blocks carry cache_control: { type: 'ephemeral' }
 *   - stop_reason inspected on every call
 *
 * The function returns a discriminated `Result` and NEVER throws:
 *   - { ok: true, question }                     — schema-valid response
 *   - { ok: false, reason: 'no_specifics' }      — Claude declined (returned no_specifics: true)
 *   - { ok: false, reason: 'api_error', detail } — network/SDK/schema failure
 *
 * The `retryReason` parameter is appended to the per-signal user
 * instruction on the regenerate attempt — it gives Claude a structured
 * hint about WHY the first attempt failed quality.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { Logger } from '@ncp/logger';

import type {
  CandidateForInterview,
  GeneratedQuestion,
  QualityGateFailure,
  QuestionGenerationResult,
  SignalForInterview,
} from './types.js';

const SOURCE = 'telegram_bot' as const;
export const QUESTION_MODEL = 'claude-opus-4-7' as const;
export const QUESTION_MAX_TOKENS = 1024;

// ---------------------------------------------------------------------------
// Schema for the structured-outputs JSON the model returns.
// ---------------------------------------------------------------------------

export const QuestionResponseSchema = z.object({
  question_text: z.string().min(1).max(500),
  signal_id: z.string().uuid(),
  evidence_phrase: z.string().min(1).max(200),
  detected_specifics: z.array(z.string()).min(0),
  no_specifics: z.boolean(),
});

export type QuestionResponse = z.infer<typeof QuestionResponseSchema>;

// JSON Schema fed to Anthropic. Anthropic's structured outputs ignore
// `minLength`/`maxLength`; we keep the original Zod schema for post-
// validation (see §5 of the integration guide).
const QUESTION_JSON_SCHEMA = zodToJsonSchema(QuestionResponseSchema, {
  $refStrategy: 'none',
});

// ---------------------------------------------------------------------------
// AnthropicLike DI surface (Opus 4.7).
//
// Wider than synthesis-worker's AnthropicLike — adds `thinking`,
// `output_config`, content-block arrays, `stop_reason`, and `refusal_message`.
// ---------------------------------------------------------------------------

export type AnthropicMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
      | { type: string; [key: string]: unknown }
    >;

export interface AnthropicMessageParam {
  role: 'user' | 'assistant';
  content: AnthropicMessageContent;
}

export interface AnthropicSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface AnthropicOutputConfig {
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  format?: {
    type: 'json_schema';
    schema: unknown;
  };
}

export interface AnthropicCreateParams {
  model: string;
  max_tokens: number;
  thinking: { type: 'adaptive' | 'enabled'; budget_tokens?: number };
  output_config: AnthropicOutputConfig;
  system: AnthropicSystemBlock[];
  messages: AnthropicMessageParam[];
}

export interface AnthropicResponseBlock {
  type: string;
  text?: string;
}

export interface AnthropicResponse {
  content: AnthropicResponseBlock[];
  stop_reason?: string;
  refusal_message?: string;
}

export interface OpusAnthropicLike {
  messages: {
    create(params: AnthropicCreateParams): Promise<AnthropicResponse>;
  };
}

// ---------------------------------------------------------------------------
// Prompt construction.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = [
  'You are writing a confirmation question for Hassan Sadiq, an IT consultant.',
  'He will receive this via Telegram on his phone on Monday morning.',
  '',
  'Your job is to confirm — NOT discover — something Hassan already worked',
  'on this week. Every question MUST cite a concrete detail from the signal',
  '(an error code, a config name, a time/day, a tech name, a verbatim',
  'phrase) so Hassan can answer in 15–30 seconds.',
  '',
  'Rules:',
  '  1. ≤80 words.',
  "  2. Reference at least one concrete specific from the signal's redacted",
  '     text — return that string in `detected_specifics`.',
  '  3. Do NOT ask generic questions. If you cannot find a concrete',
  '     specific in the signal, set `no_specifics: true` and return a short',
  "     `question_text` sentinel ('no specifics available').",
  '  4. Output ONLY the structured JSON. Do not narrate.',
].join('\n');

function buildClusterContextText(candidate: CandidateForInterview): string {
  return [
    `Article candidate:`,
    `  Pillar: ${candidate.pillar}`,
    `  Proposed title: ${candidate.proposedTitle}`,
    `  Primary keyword: ${candidate.primaryKeyword}`,
  ].join('\n');
}

function buildSignalPrompt(
  signal: SignalForInterview,
  candidate: CandidateForInterview,
  retryReason: readonly QualityGateFailure[] | undefined,
): string {
  const dayTime = signal.capturedAt.toISOString();
  const redacted = signal.redactedText.slice(0, 500);
  const lines = [
    `Signal id: ${signal.id}`,
    `Signal source: ${signal.source}`,
    `Captured at: ${dayTime}`,
    `Signal content (redacted, first 500 chars): ${redacted}`,
    '',
    `Primary keyword reminder: ${candidate.primaryKeyword}`,
    '',
    'Produce one confirmation question for this signal.',
  ];
  if (retryReason && retryReason.length > 0) {
    lines.push(
      '',
      `Previous attempt failed quality gate (${retryReason.join(', ')}). Try again, citing a concrete detail from the signal.`,
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Stop-reason handling (per integration guide §7).
// ---------------------------------------------------------------------------

function handleNonEndTurn(
  stopReason: string | undefined,
  refusalMessage: string | undefined,
): { ok: false; reason: 'api_error'; detail: string } {
  switch (stopReason) {
    case 'max_tokens':
      return { ok: false, reason: 'api_error', detail: 'truncated' };
    case 'refusal':
      return {
        ok: false,
        reason: 'api_error',
        detail: `refusal: ${refusalMessage ?? 'unknown'}`,
      };
    case 'model_context_window_exceeded':
      return {
        ok: false,
        reason: 'api_error',
        detail: 'context_window_exceeded',
      };
    default:
      return {
        ok: false,
        reason: 'api_error',
        detail: `unexpected stop_reason: ${stopReason ?? 'undefined'}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Public surface.
// ---------------------------------------------------------------------------

export interface GenerateQuestionInput {
  signal: SignalForInterview;
  candidate: CandidateForInterview;
  anthropic: OpusAnthropicLike;
  logger: Logger;
  /**
   * When set, the call is treated as a regenerate-after-quality-gate
   * retry. The `QualityGateFailure[]` values are surfaced to Claude as a
   * structured hint appended to the user message.
   */
  retryReason?: readonly QualityGateFailure[];
}

export async function generateQuestion(
  input: GenerateQuestionInput,
): Promise<QuestionGenerationResult> {
  const { signal, candidate, anthropic, logger } = input;

  const clusterContextBlock = {
    type: 'text' as const,
    text: buildClusterContextText(candidate),
    cache_control: { type: 'ephemeral' as const },
  };
  const perSignalInstruction = {
    type: 'text' as const,
    text: buildSignalPrompt(signal, candidate, input.retryReason),
  };

  const params: AnthropicCreateParams = {
    model: QUESTION_MODEL,
    max_tokens: QUESTION_MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'xhigh',
      format: { type: 'json_schema', schema: QUESTION_JSON_SCHEMA },
    },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [clusterContextBlock, perSignalInstruction],
      },
    ],
  };

  let response: AnthropicResponse;
  try {
    response = await anthropic.messages.create(params);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      {
        source: SOURCE,
        action: 'claude_question_generation_threw',
        signalId: signal.id,
        candidateId: candidate.id,
        reason: message,
      },
      'Claude messages.create threw',
    );
    return { ok: false, reason: 'api_error', detail: message };
  }

  // Stop-reason check FIRST — per integration guide §7.
  if (response.stop_reason !== 'end_turn') {
    const failure = handleNonEndTurn(
      response.stop_reason,
      response.refusal_message,
    );
    logger.error(
      {
        source: SOURCE,
        action: 'claude_question_generation_bad_stop_reason',
        signalId: signal.id,
        candidateId: candidate.id,
        stop_reason: response.stop_reason,
        detail: failure.detail,
      },
      'Claude returned non-end_turn stop_reason',
    );
    return failure;
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text' || typeof textBlock.text !== 'string') {
    logger.error(
      {
        source: SOURCE,
        action: 'claude_question_generation_no_text_block',
        signalId: signal.id,
        candidateId: candidate.id,
      },
      'Claude response had no text block',
    );
    return { ok: false, reason: 'api_error', detail: 'no_text_block' };
  }

  let parsed: QuestionResponse;
  try {
    parsed = QuestionResponseSchema.parse(JSON.parse(textBlock.text));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      {
        source: SOURCE,
        action: 'claude_question_generation_schema_invalid',
        signalId: signal.id,
        candidateId: candidate.id,
        reason: message,
      },
      'Claude response failed Zod schema validation',
    );
    return { ok: false, reason: 'api_error', detail: `schema_invalid: ${message}` };
  }

  if (parsed.no_specifics === true) {
    return { ok: false, reason: 'no_specifics' };
  }

  const question: GeneratedQuestion = {
    questionText: parsed.question_text,
    signalId: parsed.signal_id,
    evidencePhrase: parsed.evidence_phrase,
    detectedSpecifics: parsed.detected_specifics,
  };
  return { ok: true, question };
}
