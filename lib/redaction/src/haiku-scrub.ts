import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@ncp/logger';

import type { RedactionLogEntry } from './types.js';

const logger = createLogger({ source: 'redaction' });

/**
 * Default scrub model. `claude-3-5-haiku-latest` (the original default) was
 * retired by Anthropic on 2026-02-19 and now 404s, which made every scrub
 * fail and — because redaction is fail-closed — silently blocked all email
 * ingestion. Default is now Claude Fable 5 per Hassan's directive
 * (2026-06-12); override via `ANTHROPIC_MODEL` or `opts.model`.
 */
const SCRUB_DEFAULT_MODEL =
  process.env['ANTHROPIC_MODEL']?.trim() || 'claude-fable-5';

/**
 * Claude Fable 5's thinking is always on and its (invisible) thinking
 * tokens bill into `max_tokens`, so the budget needs headroom beyond the
 * redacted text + entity list themselves.
 */
const SCRUB_MAX_TOKENS = 8192;

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

/**
 * Structural slice of the Anthropic client wide enough to carry
 * `output_config` (structured outputs) and read `stop_reason`.
 * `@anthropic-ai/sdk@^0.28.0` does not type either at the TypeScript
 * level, but the wire-level API accepts/returns them — the SDK forwards
 * unknown keys to the HTTP layer. Same pattern as
 * `artifacts/telegram-bot/.../anthropic-shapes.ts`; the cast below is the
 * single permitted cast site in this module.
 */
interface ScrubMessagesCreateArgs {
  model: string;
  max_tokens: number;
  system: string;
  output_config: {
    format: { type: 'json_schema'; schema: unknown };
  };
  messages: Array<{ role: 'user'; content: string }>;
}

interface ScrubMessagesResponse {
  stop_reason?: string | null;
  content: Array<{ type: string; text?: string }>;
}

interface ScrubAnthropicLike {
  messages: {
    create(args: ScrubMessagesCreateArgs): Promise<ScrubMessagesResponse>;
  };
}

/**
 * Grammar-enforced response schema. Mirrors `HaikuJsonResponse` exactly.
 * Replaces the assistant-turn `'{'` prefill the original implementation
 * used — last-assistant-turn prefills return a 400 on Claude Fable 5 and
 * the whole 4.6+ family, and structured outputs are the documented
 * replacement.
 */
const SCRUB_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['redacted', 'entities'],
  properties: {
    redacted: { type: 'string' },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'offset', 'length', 'replacement'],
        properties: {
          type: { type: 'string', enum: ['person', 'company', 'address'] },
          offset: { type: 'integer' },
          length: { type: 'integer' },
          replacement: { type: 'string' },
        },
      },
    },
  },
} as const;

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
 * Pass 2 of the redaction pipeline. Uses Claude (default: Fable 5) to
 * identify and replace named entities (person names, company names, street
 * addresses) the regex pass cannot catch. The function name is historical —
 * it originally ran on Claude 3.5 Haiku — and is kept to avoid churning
 * `redact()` and its tests. Throws on any non-recoverable error — the caller
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
  const model = opts.model ?? SCRUB_DEFAULT_MODEL;
  const client = new Anthropic({
    apiKey: opts.anthropicApiKey,
  }) as unknown as ScrubAnthropicLike;

  let raw: string;
  try {
    const response = await client.messages.create({
      model,
      max_tokens: SCRUB_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: 'json_schema', schema: SCRUB_JSON_SCHEMA },
      },
      messages: [{ role: 'user', content: buildUserPrompt(text) }],
    });
    // Fable 5's safety classifiers can decline a request (HTTP 200 with
    // stop_reason 'refusal' and empty/partial content). Treat it like any
    // other scrub failure: throw, so redact() fails closed.
    if (response.stop_reason === 'refusal') {
      throw new Error('haiku_scrub: model refused (safety classifier)');
    }
    const block = response.content?.find((b) => b.type === 'text');
    if (!block || typeof block.text !== 'string') {
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
