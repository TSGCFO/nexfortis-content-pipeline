/**
 * Local structural slice of the Anthropic SDK we use for Claude Opus 4.7
 * confirmation-question generation, plus the JSON schema literal and
 * post-validation narrower for the structured-output response.
 *
 * Why a local structural type? `@anthropic-ai/sdk@^0.28.0` (the pinned
 * workspace version, shared with `lib/redaction`) does NOT type
 * `thinking`, `output_config`, `cache_control`, or the
 * `claude-opus-4-7` model literal at the TypeScript level. The wire-level
 * API accepts them — the SDK forwards unknown keys to the HTTP layer —
 * but our compile-time surface needs to declare the shape we're sending.
 * `OpusAnthropicLike` is that declaration. At the runtime boundary
 * (`createInterviewSessionJob` factory) we cast a real `new Anthropic(...)`
 * instance to this interface with `as unknown as OpusAnthropicLike` —
 * the single DI-cast site permitted under the prompt's "DI test mock
 * boundaries" carve-out.
 *
 * Why a hand-rolled JSON schema (no `zod` / `zod-to-json-schema`)? The
 * prompt's dep allowlist contains `zod-to-json-schema` but conspicuously
 * omits `zod` itself — and the schema lib is useless without Zod.
 * Adding `zod` would be a fifth top-level dep outside the allowlist
 * (forbidden by prompt-discipline rules). The schema is small enough to
 * hand-write defensively. A `// TODO(hassan):` in the PR description
 * flags this deviation.
 *
 * Pattern source: `docs/ways-of-work/anthropic-claude-integration-guide.md`
 * sections 3 (canonical call shape), 5 (structured outputs), 6 (prompt
 * caching), 7 (stop-reason handling).
 */

import type { QuestionResponse } from './types.js';

// ─────────────────────────────────────────────────────────────────────────
// Structural Opus 4.7 client interface (wider than @anthropic-ai/sdk@0.28
// surfaces, but matching the actual wire shape).
// ─────────────────────────────────────────────────────────────────────────

export interface CacheControl {
  type: 'ephemeral';
}

export interface OpusTextBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

export interface OpusSystemBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

export interface OpusUserMessage {
  role: 'user';
  content: string | OpusTextBlock[];
}

export interface OpusJsonSchemaFormat {
  type: 'json_schema';
  schema: unknown;
}

export interface OpusOutputConfig {
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  format?: OpusJsonSchemaFormat;
}

export interface OpusThinkingAdaptive {
  type: 'adaptive';
  display?: 'omitted' | 'summarized';
}

export interface OpusMessagesCreateArgs {
  model: string;
  max_tokens: number;
  thinking?: OpusThinkingAdaptive;
  output_config?: OpusOutputConfig;
  system?: OpusSystemBlock[];
  messages: OpusUserMessage[];
}

export interface OpusResponseContentBlock {
  type: string;
  text?: string;
}

export interface OpusMessagesResponse {
  stop_reason: string | null;
  content: OpusResponseContentBlock[];
  refusal_message?: string;
}

export interface OpusAnthropicLike {
  messages: {
    create(args: OpusMessagesCreateArgs): Promise<OpusMessagesResponse>;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// JSON schema for the structured response. Hand-written to match
// `QuestionResponse` exactly. All fields are required, no additional
// properties allowed — these constraints are GRAMMAR-enforced by
// Anthropic's structured-outputs implementation (integration guide §5).
// ─────────────────────────────────────────────────────────────────────────

export const QUESTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'question_text',
    'signal_id',
    'evidence_phrase',
    'detected_specifics',
    'no_specifics',
  ],
  properties: {
    question_text: {
      type: 'string',
      description:
        'The confirmation question Hassan will read in Telegram. Past tense, second person, conversational. Anchors on a day/time and at least one concrete detail from the signal. ≤ 80 words; shorter is better. Plain text only — no markdown, no HTML, no answer-choice buttons (those are added programmatically). When no_specifics is true, set this to the literal sentinel string "NO_SPECIFICS".',
    },
    signal_id: {
      type: 'string',
      description:
        'Echo the exact signal_id you were given in the per-signal instruction. UUID v4 format. The orchestrator forcibly overrides this server-side as a defence against schema-conforming-but-wrong values, but the field must still be present and well-formed.',
    },
    evidence_phrase: {
      type: 'string',
      description:
        'A short verbatim substring (≤ 200 chars) of the signal redacted_text that proves the question is anchored to actual corpus content. Must be a literal copy, not a paraphrase. If you paraphrase, the regression check fails. When no_specifics is true, set this to an empty string.',
    },
    detected_specifics: {
      type: 'array',
      description:
        'The concrete specifics you referenced in question_text — error codes (e.g. "AADSTS50158"), config or policy names, dollar figures, tool names, technologies, day-times. Non-empty when no_specifics is false; each entry MUST appear (case-insensitive) in the signal redacted_text. Hallucinated specifics fail the quality gate and the question is silently dropped. When no_specifics is true, this is an empty array.',
      items: { type: 'string' },
    },
    no_specifics: {
      type: 'boolean',
      description:
        'Set to true ONLY when the signal contains nothing concrete worth asking about — too short to be diagnostic, entirely conversational small-talk, all concrete details redacted away, or clearly off-topic from the article candidate. A forced generic question is worse than a clean exclusion. When true, set question_text to "NO_SPECIFICS", evidence_phrase to "", and detected_specifics to [].',
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Defensive post-validation: even with structured outputs we narrow the
// parsed object before trusting it. Returns null on any shape mismatch
// so the caller can return { ok: false, reason: 'api_error' }.
// ─────────────────────────────────────────────────────────────────────────

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((v) => typeof v === 'string')
  );
}

export function parseQuestionResponse(text: string): QuestionResponse | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const question_text = obj['question_text'];
  const signal_id = obj['signal_id'];
  const evidence_phrase = obj['evidence_phrase'];
  const detected_specifics = obj['detected_specifics'];
  const no_specifics = obj['no_specifics'];
  if (
    typeof question_text !== 'string' ||
    typeof signal_id !== 'string' ||
    typeof evidence_phrase !== 'string' ||
    !isStringArray(detected_specifics) ||
    typeof no_specifics !== 'boolean'
  ) {
    return null;
  }
  return {
    question_text,
    signal_id,
    evidence_phrase,
    detected_specifics,
    no_specifics,
  };
}
