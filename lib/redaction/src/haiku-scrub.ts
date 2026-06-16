import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@ncp/logger';

import type { RedactionLogEntry } from './types.js';

const logger = createLogger({ source: 'redaction' });

/**
 * Default scrub model. `claude-3-5-haiku-latest` (the original default) was
 * retired by Anthropic on 2026-02-19 and now 404s, which made every scrub
 * fail and — because redaction is fail-closed — silently blocked all email
 * ingestion. Default is now Claude Opus 4.8 per Hassan's directive
 * (2026-06-12); override via `ANTHROPIC_MODEL` or `opts.model`.
 */
const SCRUB_DEFAULT_MODEL =
  process.env['ANTHROPIC_MODEL']?.trim() || 'claude-opus-4-8';

/**
 * `max_tokens` ceiling for a single window response. Each scrub call sees at
 * most `MAX_WINDOW_CHARS` of text (see below), so this comfortably fits that
 * window's redacted text plus its entity list. Opus 4.8 runs this scrub with
 * thinking off (no `thinking` param set).
 */
const SCRUB_MAX_TOKENS = 8192;

/**
 * Maximum characters of input per scrub window.
 *
 * The scrub asks the model to echo a window's redacted text back inside its
 * JSON response. A single call over a long conversation therefore produces a
 * JSON string longer than `SCRUB_MAX_TOKENS` can hold; the response truncates
 * mid-string, `JSON.parse` throws and — because redaction is fail-closed —
 * the entire capture is blocked. (This silently dropped real, long captures.)
 *
 * Windowing bounds every response: 8 000 chars of input yields well under
 * `SCRUB_MAX_TOKENS` of output even for token-dense text, leaving generous
 * headroom for JSON escaping and the entity list.
 */
const MAX_WINDOW_CHARS = 8000;

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

export interface ScrubAnthropicLike {
  messages: {
    create(args: ScrubMessagesCreateArgs): Promise<ScrubMessagesResponse>;
  };
}

/**
 * Grammar-enforced response schema. Mirrors `HaikuJsonResponse` exactly.
 * Replaces the assistant-turn `'{'` prefill the original implementation
 * used — last-assistant-turn prefills return a 400 on Claude Opus 4.8 and
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
  /**
   * Test seam: inject a stand-in Anthropic client so the windowing and
   * offset-stitching logic can be exercised without a network call. Falls
   * back to a real `Anthropic` client built from `anthropicApiKey`.
   */
  client?: ScrubAnthropicLike;
}

export interface HaikuScrubResult {
  redacted: string;
  log: RedactionLogEntry[];
}

/**
 * Pass 2 of the redaction pipeline. Uses Claude (default: Opus 4.8) to
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
  const client =
    opts.client ??
    (new Anthropic({
      apiKey: opts.anthropicApiKey,
    }) as unknown as ScrubAnthropicLike);

  // Scrub the document one bounded window at a time. A single call over a
  // long conversation overruns `max_tokens` (see `MAX_WINDOW_CHARS`), so we
  // slice `text` into contiguous windows and scrub each independently.
  // Because the windows are exact, contiguous slices of `text`, a running
  // `base` offset maps each window-local entity offset back to a position in
  // `text` for the audit log. Any window failure throws, so redaction stays
  // fail-closed for the whole capture.
  const windows = splitIntoWindows(text, MAX_WINDOW_CHARS);
  const redactedParts: string[] = [];
  const log: RedactionLogEntry[] = [];
  let base = 0;
  for (const window of windows) {
    const result = await scrubWindow(window, model, client);
    redactedParts.push(result.redacted);
    for (const e of result.entities) {
      log.push({
        type: e.type,
        offset: base + e.offset,
        replacement: ENTITY_TOKEN[e.type],
      });
    }
    base += window.length;
  }

  return { redacted: redactedParts.join(''), log };
}

/**
 * Scrub one window: a single Anthropic call → parsed, validated
 * `{ redacted, entities }` whose offsets are relative to `windowText`. Any
 * failure (network, safety refusal, malformed/truncated JSON, schema
 * violation) throws so the caller fails closed.
 */
async function scrubWindow(
  windowText: string,
  model: string,
  client: ScrubAnthropicLike,
): Promise<HaikuJsonResponse> {
  let raw: string;
  try {
    const response = await client.messages.create({
      model,
      max_tokens: SCRUB_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: 'json_schema', schema: SCRUB_JSON_SCHEMA },
      },
      messages: [{ role: 'user', content: buildUserPrompt(windowText) }],
    });
    // Opus 4.8's safety classifiers can decline a request (HTTP 200 with
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

  return validateResponse(parsed, windowText);
}

/**
 * Split `text` into contiguous windows of at most `maxChars`, preferring to
 * cut on a paragraph (`\n\n`), then line (`\n`), then any whitespace boundary
 * so a named entity is not split across two windows. The windows concatenate
 * back to exactly `text` (no characters added or dropped) — that invariant is
 * what lets the caller map a window-local offset to a global one by summing
 * window lengths.
 *
 * SECURITY (residual seam risk): each window is scrubbed by an independent
 * model call, so an entity that straddles a window boundary is seen only as
 * fragments and may pass through un-redacted. Cutting on whitespace prevents
 * splitting a single token (e.g. a no-space company name or address number).
 * A multi-word person name whose internal space lands exactly on the chosen
 * cut can still split; that requires a >`maxChars` run with the boundary on
 * that precise space, which is rare for real captures (turns are joined with
 * `\n\n`). The airtight fix is overlap-context scrubbing (re-feed the previous
 * window's tail as read-only context). TODO(hassan): adopt overlap-context if
 * seam leakage is ever observed in practice.
 */
export function splitIntoWindows(text: string, maxChars: number): string[] {
  if (text.length === 0) return [];
  if (text.length <= maxChars) return [text];
  const windows: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(cursor + maxChars, text.length);
    if (end < text.length) {
      const window = text.slice(cursor, end);
      const paraBreak = window.lastIndexOf('\n\n');
      const lineBreak = window.lastIndexOf('\n');
      const wsBreak = window.search(/\s\S*$/); // index of the last whitespace run
      if (paraBreak > 0) {
        end = cursor + paraBreak + 2;
      } else if (lineBreak > 0) {
        end = cursor + lineBreak + 1;
      } else if (wsBreak > 0) {
        end = cursor + wsBreak + 1;
      }
    }
    windows.push(text.slice(cursor, end));
    cursor = end;
  }
  return windows;
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

  // Entity offsets are an AUDIT-ONLY positional hint: `redact()` applies the
  // model's rewritten `redacted` text, never these offsets. LLMs routinely
  // miscount character positions in a long window, so a bad offset must NOT
  // fail the whole capture closed (that silently dropped real conversations).
  // We therefore keep an entity whenever its `type` and `replacement` are
  // valid — those define WHAT was redacted — and defensively clamp the
  // offset/length into range for the log. Entities with an unusable type or
  // replacement are dropped from the log (the redaction itself still stands).
  const max = originalText.length;
  const entities: HaikuEntity[] = [];
  for (const e of entitiesRaw) {
    if (!e || typeof e !== 'object') continue;
    const ent = e as Record<string, unknown>;
    const type = ent['type'];
    if (type !== 'person' && type !== 'company' && type !== 'address') continue;
    const replacement = ent['replacement'];
    if (typeof replacement !== 'string') continue;

    const rawOffset = ent['offset'];
    const rawLength = ent['length'];
    let offset =
      typeof rawOffset === 'number' && Number.isInteger(rawOffset) ? rawOffset : 0;
    let length =
      typeof rawLength === 'number' && Number.isInteger(rawLength) ? rawLength : 0;
    if (offset < 0) offset = 0;
    if (offset > max) offset = max;
    if (length < 0) length = 0;
    if (offset + length > max) length = max - offset;

    entities.push({ type, offset, length, replacement });
  }

  return { redacted, entities };
}
