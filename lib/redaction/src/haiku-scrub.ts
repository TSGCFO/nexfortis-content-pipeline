import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@ncp/logger';

import type { RedactionLogEntry } from './types.js';

const logger = createLogger({ source: 'redaction' });

const HAIKU_DEFAULT_MODEL = 'claude-3-5-haiku-latest';
const HAIKU_MAX_TOKENS = 4096;

type HaikuEntityType = 'person' | 'company' | 'address';

interface HaikuEntity {
  type: HaikuEntityType;
  offset: number;
  length: number;
  replacement: string;
}

interface HaikuJsonResponse {
  redacted: string;
  entities: HaikuEntity[];
}

const ENTITY_TOKEN: Record<HaikuEntityType, string> = {
  person: '[REDACTED_PERSON]',
  company: '[REDACTED_COMPANY]',
  address: '[REDACTED_ADDRESS]',
};

const SYSTEM_PROMPT = [
  'You are a privacy-preserving redaction assistant.',
  'Identify named entities in text and produce a JSON object describing the redactions.',
  'Allowed names that must NEVER be redacted: NexFortis, qbportal, Talencor.',
  'Return ONLY a single JSON object — no prose, no markdown fences, no commentary.',
].join(' ');

function buildUserPrompt(text: string): string {
  return [
    'Redact the following text. Replace person names, company names',
    "(other than the allowed names 'NexFortis', 'qbportal', 'Talencor'),",
    'and street addresses with these replacement tokens:',
    `- person → ${ENTITY_TOKEN.person}`,
    `- company → ${ENTITY_TOKEN.company}`,
    `- address → ${ENTITY_TOKEN.address}`,
    '',
    'Return ONLY a JSON object with this exact schema:',
    '{',
    '  "redacted": "<the fully redacted text>",',
    '  "entities": [',
    '    { "type": "person" | "company" | "address",',
    '      "offset": <number>,',
    '      "length": <number>,',
    '      "replacement": "<the replacement token>" }',
    '  ]',
    '}',
    '',
    'Offsets MUST refer to character positions in the ORIGINAL text below.',
    'If no entities are found, return an empty entities array and the original text unchanged.',
    '',
    'Original text:',
    '"""',
    text,
    '"""',
  ].join('\n');
}

export interface HaikuScrubOptions {
  anthropicApiKey: string;
  model?: string;
}

export interface HaikuScrubResult {
  redacted: string;
  log: RedactionLogEntry[];
}

/**
 * Pass 2 of the redaction pipeline. Uses Claude Haiku to identify and replace
 * named entities (person names, company names, street addresses) the regex
 * pass cannot catch. Throws on any non-recoverable error — the caller
 * (`redact()`) is responsible for translating the throw into a
 * `{ status: 'blocked', reason: 'redaction_failed' }` result. There is no
 * retry logic here; callers retry at the ingester level.
 */
export async function haikuScrub(
  text: string,
  opts: HaikuScrubOptions,
): Promise<HaikuScrubResult> {
  if (!opts.anthropicApiKey) {
    throw new Error('haiku_scrub: anthropicApiKey is required');
  }
  const model = opts.model ?? HAIKU_DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: opts.anthropicApiKey });

  let raw: string;
  try {
    const response = await client.messages.create({
      model,
      max_tokens: HAIKU_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(text) }],
    });
    const block = response.content?.[0];
    if (!block || block.type !== 'text') {
      throw new Error('haiku_scrub: unexpected response shape (no text block)');
    }
    raw = block.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { source: 'redaction', action: 'haiku_scrub' },
      `haiku_scrub: anthropic call failed: ${message}`,
    );
    throw err instanceof Error ? err : new Error(message);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { source: 'redaction', action: 'haiku_scrub' },
      `haiku_scrub: failed to parse JSON: ${message}`,
    );
    throw new Error('haiku_scrub: failed to parse JSON response');
  }

  const validated = validateResponse(parsed, text);

  const log: RedactionLogEntry[] = validated.entities.map((e) => ({
    type: e.type,
    offset: e.offset,
    replacement: ENTITY_TOKEN[e.type],
  }));

  return { redacted: validated.redacted, log };
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch && typeof fenceMatch[1] === 'string') return fenceMatch[1];
  return trimmed;
}

function validateResponse(parsed: unknown, originalText: string): HaikuJsonResponse {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('haiku_scrub: response is not an object');
  }
  const obj = parsed as Record<string, unknown>;
  const redacted = obj['redacted'];
  if (typeof redacted !== 'string') {
    throw new Error('haiku_scrub: missing "redacted" string');
  }
  const entitiesRaw = obj['entities'];
  if (!Array.isArray(entitiesRaw)) {
    throw new Error('haiku_scrub: missing "entities" array');
  }

  const entities: HaikuEntity[] = entitiesRaw.map((e, idx) => {
    if (!e || typeof e !== 'object') {
      throw new Error(`haiku_scrub: entity[${idx}] is not an object`);
    }
    const ent = e as Record<string, unknown>;
    const type = ent['type'];
    if (type !== 'person' && type !== 'company' && type !== 'address') {
      throw new Error(`haiku_scrub: entity[${idx}] has invalid type "${String(type)}"`);
    }
    const offset = ent['offset'];
    const length = ent['length'];
    if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
      throw new Error(`haiku_scrub: entity[${idx}] has invalid offset`);
    }
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) {
      throw new Error(`haiku_scrub: entity[${idx}] has invalid length`);
    }
    if (offset + length > originalText.length) {
      throw new Error(`haiku_scrub: entity[${idx}] offset+length out of range`);
    }
    const replacement = ent['replacement'];
    if (typeof replacement !== 'string') {
      throw new Error(`haiku_scrub: entity[${idx}] replacement must be string`);
    }
    return { type, offset, length, replacement };
  });

  return { redacted, entities };
}
