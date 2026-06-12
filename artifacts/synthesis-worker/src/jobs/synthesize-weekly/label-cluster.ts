/**
 * Claude cluster labeler.
 *
 * Concatenates the cluster's redacted texts (capped at 8,000 chars) and
 * asks the model for a JSON object describing the topic, grammar-enforced
 * via structured outputs (`output_config.format`). The original
 * assistant-turn `'{'` prefill was removed: prefills 400 on Claude Fable 5
 * and the 4.6+ family, and the original `claude-3-5-sonnet-latest` default
 * was retired by Anthropic on 2025-10-28 (calls 404ed in production).
 *
 * Returns the parsed `{ label, topicKeywords }`. The caller is responsible
 * for handling the special `label === 'ERROR:INCOHERENT'` discard signal
 * and for retrying on thrown errors.
 */

import { z } from 'zod';

import type { AnthropicLike, Cluster } from './types.js';

export const LABEL_DEFAULT_MODEL =
  process.env['ANTHROPIC_MODEL']?.trim() || 'claude-fable-5';
/** Fable 5's always-on thinking bills into `max_tokens` — keep headroom. */
export const LABEL_MAX_TOKENS = 2048;
export const TEXT_CONCAT_CAP = 8000;
export const LABEL_MAX_CHARS = 80;
export const INCOHERENT_SENTINEL = 'ERROR:INCOHERENT';

const ResponseSchema = z.object({
  label: z.string().min(1).max(200),
  topicKeywords: z.array(z.string().min(1)).max(8),
});

/**
 * Grammar-enforced response shape (structured outputs). Length/count
 * constraints are unsupported there, so the Zod schema above remains the
 * authoritative post-validation.
 */
const LABEL_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'topicKeywords'],
  properties: {
    label: { type: 'string' },
    topicKeywords: { type: 'array', items: { type: 'string' } },
  },
} as const;

export interface LabelClusterOptions {
  model?: string;
}

export interface LabelResult {
  label: string;
  topicKeywords: string[];
}

function buildPrompt(concatenated: string): string {
  return [
    'You are analyzing a cluster of related work conversations from an IT consultant.',
    'The texts below are excerpts from real conversations the consultant has had this week.',
    '',
    'Texts:',
    concatenated,
    '',
    'Output JSON only, no commentary, matching:',
    '{',
    '  "label": "Short human-readable label, max 80 chars",',
    '  "topicKeywords": ["keyword 1", "keyword 2", "..."]',
    '}',
    '',
    'Use 3 to 8 keywords.',
    '',
    'If you cannot identify a coherent topic across these texts, return:',
    `{ "label": "${INCOHERENT_SENTINEL}", "topicKeywords": [] }`,
  ].join('\n');
}

function concatTexts(cluster: Cluster): string {
  const joined = cluster.members.map((m) => m.redactedText).join('\n---\n');
  return joined.length > TEXT_CONCAT_CAP
    ? joined.slice(0, TEXT_CONCAT_CAP)
    : joined;
}

export async function labelCluster(
  cluster: Cluster,
  client: AnthropicLike,
  opts: LabelClusterOptions = {},
): Promise<LabelResult> {
  const model = opts.model ?? LABEL_DEFAULT_MODEL;
  const userPrompt = buildPrompt(concatTexts(cluster));

  const response = await client.messages.create({
    model,
    max_tokens: LABEL_MAX_TOKENS,
    output_config: {
      format: { type: 'json_schema', schema: LABEL_JSON_SCHEMA },
    },
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Fable 5 safety classifiers can decline with stop_reason 'refusal'
  // (HTTP 200, empty/partial content). Throw so the caller's retry/discard
  // path handles it like any other labeling failure.
  if (response.stop_reason === 'refusal') {
    throw new Error('label-cluster: model refused (safety classifier)');
  }

  const block = response.content?.find((b) => b.type === 'text');
  if (!block || typeof block.text !== 'string') {
    throw new Error('label-cluster: unexpected response shape (no text block)');
  }
  const raw = block.text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`label-cluster: failed to parse JSON: ${message}`);
  }

  const result = ResponseSchema.parse(parsed);

  return {
    label:
      result.label.length > LABEL_MAX_CHARS
        ? result.label.slice(0, LABEL_MAX_CHARS)
        : result.label,
    topicKeywords: result.topicKeywords,
  };
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch && typeof fenceMatch[1] === 'string') return fenceMatch[1];
  return trimmed;
}
