/**
 * Claude Sonnet cluster labeler.
 *
 * Concatenates the cluster's redacted texts (capped at 8,000 chars) and
 * asks Sonnet for a JSON object describing the topic. The assistant-turn
 * is prefilled with '{' to force a JSON-only response — same trick used by
 * `lib/redaction/haiku-scrub.ts`.
 *
 * Returns the parsed `{ label, topicKeywords }`. The caller is responsible
 * for handling the special `label === 'ERROR:INCOHERENT'` discard signal
 * and for retrying on thrown errors.
 */

import { z } from 'zod';

import type { AnthropicLike, Cluster } from './types.js';

export const SONNET_DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
export const SONNET_MAX_TOKENS = 1024;
export const TEXT_CONCAT_CAP = 8000;
export const LABEL_MAX_CHARS = 80;
export const INCOHERENT_SENTINEL = 'ERROR:INCOHERENT';

const ResponseSchema = z.object({
  label: z.string().min(1).max(200),
  topicKeywords: z.array(z.string().min(1)).max(8),
});

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
  const model = opts.model ?? SONNET_DEFAULT_MODEL;
  const userPrompt = buildPrompt(concatTexts(cluster));

  // Prefill the assistant turn with '{' to force a JSON-only response.
  // See lib/redaction/haiku-scrub.ts for the same pattern.
  const response = await client.messages.create({
    model,
    max_tokens: SONNET_MAX_TOKENS,
    messages: [
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: '{' },
    ],
  });

  const block = response.content?.[0];
  if (!block || block.type !== 'text' || typeof block.text !== 'string') {
    throw new Error('label-cluster: unexpected response shape (no text block)');
  }
  const responseText = block.text;
  const raw = responseText.trimStart().startsWith('{')
    ? responseText
    : `{${responseText}`;

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
