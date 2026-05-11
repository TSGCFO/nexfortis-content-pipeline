import Anthropic from '@anthropic-ai/sdk';
import type { RedactionLogEntry } from './types.js';

/**
 * Minimal structural type for the bits of the Anthropic SDK we use. Keeps
 * tests decoupled from the concrete SDK class — important because
 * `@anthropic-ai/sdk` is only installed in `lib/redaction/node_modules/` and
 * is therefore not resolvable from the root `tests/` directory via
 * `vi.mock('@anthropic-ai/sdk', ...)`.
 */
export interface AnthropicLike {
  messages: {
    create: (
      request: Anthropic.Messages.MessageCreateParamsNonStreaming,
    ) => Promise<Anthropic.Messages.Message>;
  };
}

type AnthropicFactory = (apiKey: string) => AnthropicLike;

const defaultFactory: AnthropicFactory = (apiKey) =>
  new Anthropic({ apiKey }) as unknown as AnthropicLike;

let currentFactory: AnthropicFactory = defaultFactory;

/**
 * Test-only: override the Anthropic client factory. Production callers MUST
 * NOT call this. Test cleanup MUST call `__resetAnthropicFactory()` to
 * prevent state bleed between specs. Intentionally not re-exported from the
 * package barrel; tests must import via the file path directly.
 */
export function __setAnthropicFactory(factory: AnthropicFactory): void {
  currentFactory = factory;
}

/**
 * Test-only: restore the production factory.
 */
export function __resetAnthropicFactory(): void {
  currentFactory = defaultFactory;
}

export interface HaikuScrubOptions {
  anthropicApiKey: string;
  model?: string;
}

export interface HaikuScrubResult {
  redacted: string;
  log: RedactionLogEntry[];
}

export interface HaikuEntity {
  type: 'person' | 'company' | 'address';
  offset: number;
  length: number;
  replacement: string;
}

export interface HaikuStructuredOutput {
  redacted: string;
  entities: HaikuEntity[];
}

export const DEFAULT_HAIKU_MODEL = 'claude-3-5-haiku-latest';

const SYSTEM_PROMPT = `You are a PII redaction assistant. Your job is to identify any remaining personal identifiers in the provided text after a first-pass regex redaction has already replaced emails, phone numbers, SINs, credit cards, and IP addresses with bracketed tokens.

Find and redact ONLY these entity types:
- Person names (first, last, or full names of real people)
- Company / organization names (with the allowlist exception below)
- Street addresses (street number + street name; do not redact city or country alone)

ALLOWLIST — never redact these tokens, even if they look like company names:
- "NexFortis" (the user's own brand)
- "qbportal" (NexFortis product)
- "Talencor" (the user's other business)

REPLACEMENT TOKENS — use exactly these strings:
- Person names: [REDACTED_PERSON]
- Company / organization names: [REDACTED_COMPANY]
- Street addresses: [REDACTED_ADDRESS]

OUTPUT FORMAT — return ONLY a JSON object, no prose, no markdown fences. The schema is strict:

{
  "redacted": "<the input text with each identified entity replaced inline with its replacement token>",
  "entities": [
    { "type": "person" | "company" | "address", "offset": <integer character offset of the entity in the INPUT text>, "length": <integer character length of the entity in the INPUT text>, "replacement": "<the token used>" }
  ]
}

Rules:
- "offset" and "length" refer to the INPUT text (before your replacement), not the redacted output.
- If there is nothing to redact, return { "redacted": "<input verbatim>", "entities": [] }.
- Do NOT add commentary, do NOT explain, do NOT wrap the JSON in backticks.
- Do NOT redact tokens that already look like [REDACTED_*]; leave those alone.`;

interface ParsedResponse {
  ok: true;
  data: HaikuStructuredOutput;
}

interface ParseFailure {
  ok: false;
  reason: string;
}

function parseHaikuResponse(raw: string): ParsedResponse | ParseFailure {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, reason: 'No JSON object found in Haiku response' };
  }
  const slice = trimmed.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch (err) {
    return { ok: false, reason: `JSON parse failure: ${(err as Error).message}` };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'Parsed value is not an object' };
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj['redacted'] !== 'string') {
    return { ok: false, reason: 'Missing or non-string "redacted" field' };
  }
  if (!Array.isArray(obj['entities'])) {
    return { ok: false, reason: 'Missing or non-array "entities" field' };
  }
  const entities: HaikuEntity[] = [];
  for (const e of obj['entities']) {
    if (typeof e !== 'object' || e === null) {
      return { ok: false, reason: 'Entity is not an object' };
    }
    const entity = e as Record<string, unknown>;
    const t = entity['type'];
    const offset = entity['offset'];
    const length = entity['length'];
    const replacement = entity['replacement'];
    if (t !== 'person' && t !== 'company' && t !== 'address') {
      return { ok: false, reason: `Invalid entity type: ${String(t)}` };
    }
    if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
      return { ok: false, reason: 'Invalid entity offset' };
    }
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) {
      return { ok: false, reason: 'Invalid entity length' };
    }
    if (typeof replacement !== 'string') {
      return { ok: false, reason: 'Invalid entity replacement' };
    }
    entities.push({ type: t, offset, length, replacement });
  }
  return {
    ok: true,
    data: { redacted: obj['redacted'], entities },
  };
}

function extractTextFromMessage(response: Anthropic.Messages.Message): string {
  const parts: string[] = [];
  for (const block of response.content) {
    if (block.type === 'text') {
      parts.push(block.text);
    }
  }
  return parts.join('');
}

/**
 * Pass-2 redaction using Claude Haiku. The caller is expected to have already
 * run regex-pass over the text. Returns the post-Haiku text and a log of
 * entities Haiku replaced. The log offsets are relative to the INPUT passed to
 * this function (i.e. post-regex text); the orchestrator in redact.ts is
 * responsible for remapping them back to the original body if needed.
 *
 * No retry logic — the caller (an ingester) handles retries. Any parse or API
 * failure raises an Error, which the orchestrator treats as fail-closed.
 */
export async function haikuScrub(
  text: string,
  opts: HaikuScrubOptions,
): Promise<HaikuScrubResult> {
  const client: AnthropicLike = currentFactory(opts.anthropicApiKey);

  const response = await client.messages.create({
    model: opts.model ?? DEFAULT_HAIKU_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: text },
      { role: 'assistant', content: '{' },
    ],
  });

  const rawText = extractTextFromMessage(response);
  const candidate = rawText.trimStart().startsWith('{') ? rawText : `{${rawText}`;
  const parsed = parseHaikuResponse(candidate);
  if (!parsed.ok) {
    throw new Error(`Haiku response parse failure: ${parsed.reason}`);
  }

  const log: RedactionLogEntry[] = parsed.data.entities.map((e) => ({
    type: `haiku_${e.type}`,
    offset: e.offset,
    replacement: e.replacement,
  }));

  return { redacted: parsed.data.redacted, log };
}
