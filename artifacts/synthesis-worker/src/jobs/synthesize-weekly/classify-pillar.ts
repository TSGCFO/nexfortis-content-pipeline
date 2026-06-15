/**
 * Claude pillar classifier.
 *
 * Maps a labeled cluster onto one of three pillars
 * (`quickbooks`, `managed-it`, `cybersecurity`) or returns `null` for
 * off-pillar / unrecoverable failures. The caller distinguishes the two
 * `null` cases via `rawResponse`:
 *   - rawResponse === 'OFF_PILLAR' → off-pillar discard
 *   - rawResponse === 'ERROR' or any other invalid value → pillar_classification_failed
 *
 * One retry on transient/invalid output, then surface the failure as a
 * `null` pillar so the caller can persist a discard audit row and continue.
 */

import type { Pillar } from '@ncp/shared-types';

import type { AnthropicLike } from './types.js';

/**
 * `claude-3-5-haiku-latest` (the original default) was retired by Anthropic
 * on 2026-02-19 and 404s. Default is now Claude Opus 4.8 per Hassan's
 * directive (2026-06-12); override via `ANTHROPIC_MODEL` or `opts.model`.
 */
export const CLASSIFY_DEFAULT_MODEL =
  process.env['ANTHROPIC_MODEL']?.trim() || 'claude-opus-4-8';
/**
 * The visible answer is one word; this `max_tokens` is headroom (the old
 * budget of 32 was too tight). Opus 4.8 runs this with thinking off
 * (effort 'low').
 */
export const CLASSIFY_MAX_TOKENS = 1024;
export const RETRY_BACKOFF_MS = 5000;

const VALID_PILLARS: ReadonlySet<Pillar> = new Set([
  'quickbooks',
  'managed-it',
  'cybersecurity',
]);

export interface ClassifyPillarOptions {
  model?: string;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface ClassifyPillarResult {
  pillar: Pillar | null;
  rawResponse: string;
}

function buildPrompt(label: string, topicKeywords: readonly string[]): string {
  return [
    'Classify the following IT consulting topic into exactly one of these three categories:',
    '- quickbooks   (QuickBooks accounting software, payroll, Intuit ecosystem)',
    '- managed-it   (Microsoft 365, Azure, Intune, Entra ID, networking, devices)',
    '- cybersecurity (security policies, threat detection, compliance, penetration testing)',
    '',
    'If the topic does not fit any of the three, output exactly "OFF_PILLAR".',
    '',
    `Topic label: ${label}`,
    `Keywords: ${topicKeywords.join(', ')}`,
    '',
    'Output one of: quickbooks | managed-it | cybersecurity | OFF_PILLAR',
    'Nothing else.',
  ].join('\n');
}

function parseResponse(text: string): { pillar: Pillar | null; rawResponse: string } {
  const trimmed = text.trim();
  if (trimmed === 'OFF_PILLAR') {
    return { pillar: null, rawResponse: 'OFF_PILLAR' };
  }
  if (isPillar(trimmed)) {
    return { pillar: trimmed, rawResponse: trimmed };
  }
  return { pillar: null, rawResponse: trimmed };
}

function isPillar(value: string): value is Pillar {
  return VALID_PILLARS.has(value as Pillar);
}

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function callOnce(
  client: AnthropicLike,
  model: string,
  prompt: string,
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: CLASSIFY_MAX_TOKENS,
    // Single-word classification — cap thinking spend on Opus 4.8.
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('classify-pillar: model refused (safety classifier)');
  }
  const block = response.content?.find((b) => b.type === 'text');
  if (!block || typeof block.text !== 'string') {
    throw new Error('classify-pillar: unexpected response shape (no text block)');
  }
  return block.text;
}

export async function classifyPillar(
  label: string,
  topicKeywords: readonly string[],
  client: AnthropicLike,
  opts: ClassifyPillarOptions = {},
): Promise<ClassifyPillarResult> {
  const model = opts.model ?? CLASSIFY_DEFAULT_MODEL;
  const sleep = opts.sleepFn ?? defaultSleep;
  const prompt = buildPrompt(label, topicKeywords);

  // Attempt 1
  let firstResult: ClassifyPillarResult | undefined;
  try {
    const text = await callOnce(client, model, prompt);
    const parsed = parseResponse(text);
    // OFF_PILLAR is a valid final answer — do not retry.
    if (parsed.pillar !== null || parsed.rawResponse === 'OFF_PILLAR') {
      return parsed;
    }
    firstResult = parsed;
  } catch {
    // fall through to retry
  }

  await sleep(RETRY_BACKOFF_MS);

  // Attempt 2
  try {
    const text = await callOnce(client, model, prompt);
    const parsed = parseResponse(text);
    if (parsed.pillar !== null || parsed.rawResponse === 'OFF_PILLAR') {
      return parsed;
    }
    return parsed;
  } catch {
    if (firstResult !== undefined) {
      // First attempt parsed but was invalid; preserve that rawResponse so
      // the caller can see what the model said.
      return firstResult;
    }
    return { pillar: null, rawResponse: 'ERROR' };
  }
}
