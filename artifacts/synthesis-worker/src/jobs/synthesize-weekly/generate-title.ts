/**
 * Claude Sonnet title generator for the top-scoring cluster.
 *
 * Failure modes (per spec — never throws):
 *   - whitespace-only response → fall back to `cluster.label`
 *   - any thrown error from the SDK → fall back to `cluster.label`
 *   - response > TITLE_MAX_CHARS → truncated
 */

import type { AnthropicLike, ClassifiedCluster } from './types.js';

export const SONNET_DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
export const SONNET_MAX_TOKENS = 128;
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
  const model = opts.model ?? SONNET_DEFAULT_MODEL;
  const fallback = truncate(cluster.label);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: SONNET_MAX_TOKENS,
      messages: [{ role: 'user', content: buildPrompt(cluster) }],
    });
    const block = response.content?.[0];
    if (!block || block.type !== 'text' || typeof block.text !== 'string') {
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
