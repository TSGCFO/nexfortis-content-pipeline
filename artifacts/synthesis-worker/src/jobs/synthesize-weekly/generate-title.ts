/**
 * Claude title generator for the top-scoring cluster.
 *
 * Failure modes (per spec — never throws):
 *   - whitespace-only response → fall back to `cluster.label`
 *   - any thrown error from the SDK → fall back to `cluster.label`
 *   - response > TITLE_MAX_CHARS → truncated
 */

import type { AnthropicLike, ClassifiedCluster } from './types.js';

/**
 * `claude-3-5-sonnet-latest` (the original default) was retired by
 * Anthropic on 2025-10-28 and 404s. Default is now Claude Fable 5 per
 * Hassan's directive (2026-06-12); override via `ANTHROPIC_MODEL` or
 * `opts.model`.
 */
export const TITLE_DEFAULT_MODEL =
  process.env['ANTHROPIC_MODEL']?.trim() || 'claude-fable-5';
/**
 * The visible answer is ≤80 chars, but Fable 5's always-on thinking bills
 * into `max_tokens` — the old budget of 128 would truncate mid-thought.
 */
export const TITLE_MAX_TOKENS = 1024;
export const TITLE_MAX_CHARS = 80;

export interface GenerateTitleOptions {
  model?: string;
}

function buildPrompt(cluster: ClassifiedCluster): string {
  return [
    'You are writing a proposed blog article title for an IT services blog.',
    '',
    `Topic label: ${cluster.label}`,
    `Topic keywords: ${cluster.topicKeywords.join(', ')}`,
    `Pillar: ${cluster.pillar}`,
    '',
    'Write ONE proposed title, max 80 characters. Requirements:',
    '1. Descriptive and concrete; no clickbait, no superlatives.',
    '2. Reflects the topic specifically; do NOT use words like "Ultimate", "Complete", "Best", "Shocking", "Amazing".',
    '3. Output the title text only, no quotes, no commentary.',
    '',
    'Title:',
  ].join('\n');
}

function truncate(s: string): string {
  return s.length > TITLE_MAX_CHARS ? s.slice(0, TITLE_MAX_CHARS) : s;
}

export async function generateTitle(
  cluster: ClassifiedCluster,
  client: AnthropicLike,
  opts: GenerateTitleOptions = {},
): Promise<string> {
  const model = opts.model ?? TITLE_DEFAULT_MODEL;
  const fallback = truncate(cluster.label);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: TITLE_MAX_TOKENS,
      // One-line title — cap thinking spend on Fable 5.
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: buildPrompt(cluster) }],
    });
    // A Fable 5 safety-classifier refusal returns empty/partial content;
    // fall back to the cluster label like every other failure mode here.
    if (response.stop_reason === 'refusal') {
      return fallback;
    }
    const block = response.content?.find((b) => b.type === 'text');
    if (!block || typeof block.text !== 'string') {
      return fallback;
    }
    // Strip wrapping quotes the model sometimes adds despite the instructions.
    const cleaned = block.text.trim().replace(/^["']+|["']+$/g, '').trim();
    if (cleaned.length === 0) {
      return fallback;
    }
    return truncate(cleaned);
  } catch {
    return fallback;
  }
}
