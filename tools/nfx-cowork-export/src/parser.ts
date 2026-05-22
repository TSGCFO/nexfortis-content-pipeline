/**
 * Per-event filter + normalizer.
 *
 * Reads a Cowork JSONL transcript file line by line, applies the per-event
 * filter table from the locked spec, and emits an `Event[]` matching the
 * v1 output schema. Does not write JSON to disk — that's slice 5.
 *
 * Filter table (matches the spec verbatim):
 *
 * | Raw event                                 | Decision                         |
 * |-------------------------------------------|----------------------------------|
 * | type: "queue-operation"                   | Drop                             |
 * | type: "last-prompt"                       | Drop                             |
 * | type: "ai-title"                          | Drop                             |
 * | type: "attachment"                        | Drop                             |
 * | type: "system" (any subtype)              | Drop                             |
 * | type: "progress"                          | Drop                             |
 * | type: "user", content: string             | Keep → user_text                 |
 * | type: "user", content: list of tool_result| Drop entirely                    |
 * | type: "user", isMeta: true                | Drop                             |
 * | type: "user", content: list with text     | Keep → user_text per text block  |
 * | type: "assistant", content[].type=text    | Keep → assistant_text            |
 * | type: "assistant", content[].type=tool_use| Keep → tool_call (+ optional summary) |
 * | type: "assistant", content[].type=thinking| Drop                             |
 *
 * Bad-line policy:
 *   - Skip the bad line, count it.
 *   - If >5% of a file's lines fail to parse, treat the whole file as
 *     suspect and return an empty event array with the failure ratio in
 *     the result.
 */

import { createReadStream, promises as fs } from 'node:fs';
import { createInterface } from 'node:readline';

import { extractToolSummary } from './tool-summary.js';
import type { Event } from './schema.js';

export interface ParseResult {
  events: Event[];
  /** Total lines read (excluding empty lines). */
  linesRead: number;
  /** Lines that failed JSON.parse. */
  linesFailedToParse: number;
  /** True if the file was abandoned because >5% of lines failed to parse. */
  abandoned: boolean;
}

/** Maximum acceptable fraction of un-parseable lines. */
const MAX_PARSE_FAILURE_RATIO = 0.05;

/**
 * Parse a `.jsonl` transcript file, applying the per-event filter, and return
 * the kept event list along with parse statistics.
 *
 * Streams the file line-by-line via `readline` so files of any size are safe.
 */
export async function parseTranscript(filePath: string): Promise<ParseResult> {
  // First pass: count lines and parse-failures to decide whether to abandon.
  // We use a single streaming pass and keep a buffer of events; if we cross
  // the threshold we discard the buffer.

  const events: Event[] = [];
  let linesRead = 0;
  let linesFailedToParse = 0;
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return { events: [], linesRead: 0, linesFailedToParse: 0, abandoned: false };
  }
  if (!stat.isFile()) {
    return { events: [], linesRead: 0, linesFailedToParse: 0, abandoned: false };
  }

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const rawLine of rl) {
    if (rawLine.length === 0) continue;
    linesRead++;

    let obj: unknown;
    try {
      obj = JSON.parse(rawLine);
    } catch {
      linesFailedToParse++;
      continue;
    }

    const produced = classifyAndConvert(obj);
    for (const e of produced) events.push(e);
  }

  const ratio = linesRead === 0 ? 0 : linesFailedToParse / linesRead;
  const abandoned = ratio > MAX_PARSE_FAILURE_RATIO;

  return {
    events: abandoned ? [] : events,
    linesRead,
    linesFailedToParse,
    abandoned,
  };
}

/**
 * Convert one raw transcript line (already parsed from JSON) into zero or
 * more emitted `Event` objects. Drop-events return an empty array.
 *
 * One assistant line can produce MULTIPLE events because its `content` is a
 * list of blocks (`text`, `tool_use`, `thinking`) — each block we keep
 * becomes its own emitted event. The order matches the source.
 */
export function classifyAndConvert(raw: unknown): Event[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const obj = raw as Record<string, unknown>;
  const type = obj['type'];

  // Drop by top-level type.
  if (
    type === 'queue-operation' ||
    type === 'last-prompt' ||
    type === 'ai-title' ||
    type === 'attachment' ||
    type === 'system' ||
    type === 'progress'
  ) {
    return [];
  }

  if (type === 'user') return convertUserEvent(obj);
  if (type === 'assistant') return convertAssistantEvent(obj);

  // Unknown top-level types: drop. The slice-2 scan confirmed there are no
  // unknown top-level types in real data, so this is purely defensive.
  return [];
}

function readStringField(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}

function readMessageContent(obj: Record<string, unknown>): unknown {
  const msg = obj['message'];
  if (typeof msg !== 'object' || msg === null) return undefined;
  return (msg as Record<string, unknown>)['content'];
}

function convertUserEvent(obj: Record<string, unknown>): Event[] {
  // Framework-injected — drop regardless of content shape.
  if (obj['isMeta'] === true) return [];

  const ts = readStringField(obj, 'timestamp');
  const uuid = readStringField(obj, 'uuid');
  if (ts === undefined || uuid === undefined) return [];

  const content = readMessageContent(obj);
  const common = baseEventFields(obj, ts, uuid);

  // Case 1: content is a plain string — Hassan's typed input.
  if (typeof content === 'string') {
    if (content.length === 0) return [];
    return [{ kind: 'user_text', ...common, text: content }];
  }

  // Case 2: content is a list of blocks.
  if (Array.isArray(content)) {
    const blocks = content;
    // If any block is a tool_result, drop the entire event.
    if (blocks.some((b) => isObj(b) && b['type'] === 'tool_result')) {
      return [];
    }
    // Otherwise emit one user_text per text block (typical case: exactly one
    // text block, but the schema supports more).
    const out: Event[] = [];
    for (const b of blocks) {
      if (!isObj(b)) continue;
      if (b['type'] === 'text') {
        const text = typeof b['text'] === 'string' ? b['text'] : '';
        if (text.length === 0) continue;
        out.push({ kind: 'user_text', ...common, text });
      }
      // Other block types in user events (rare) are ignored.
    }
    return out;
  }

  return [];
}

function convertAssistantEvent(obj: Record<string, unknown>): Event[] {
  const ts = readStringField(obj, 'timestamp');
  const uuid = readStringField(obj, 'uuid');
  if (ts === undefined || uuid === undefined) return [];

  const content = readMessageContent(obj);
  if (!Array.isArray(content)) return [];

  const common = baseEventFields(obj, ts, uuid);
  const out: Event[] = [];

  // A single assistant line can have N content blocks. We synthesize child
  // event UUIDs by suffixing the source UUID with a stable index — this keeps
  // emitted UUIDs unique even when multiple events come from one source line.
  let blockIndex = 0;
  for (const b of content) {
    if (!isObj(b)) continue;
    const blockType = b['type'];
    const childUuid = blockIndex === 0 ? uuid : `${uuid}#${blockIndex}`;
    blockIndex++;

    if (blockType === 'text') {
      const text = typeof b['text'] === 'string' ? b['text'] : '';
      if (text.length === 0) continue;
      out.push({ kind: 'assistant_text', ...common, uuid: childUuid, text });
    } else if (blockType === 'tool_use') {
      const name = typeof b['name'] === 'string' ? b['name'] : '';
      if (name.length === 0) continue;
      const summary = extractToolSummary(name, b['input']);
      const event: Event = {
        kind: 'tool_call',
        ...common,
        uuid: childUuid,
        tool: name,
        ...(summary !== null ? { summary } : {}),
      };
      out.push(event);
    }
    // thinking blocks dropped per spec
  }

  return out;
}

function baseEventFields(
  obj: Record<string, unknown>,
  ts: string,
  uuid: string
): { ts: string; uuid: string; cwd?: string; gitBranch?: string } {
  const cwd = readStringField(obj, 'cwd');
  const gitBranch = readStringField(obj, 'gitBranch');
  const base: { ts: string; uuid: string; cwd?: string; gitBranch?: string } = { ts, uuid };
  if (cwd !== undefined) base.cwd = cwd;
  if (gitBranch !== undefined) base.gitBranch = gitBranch;
  return base;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
