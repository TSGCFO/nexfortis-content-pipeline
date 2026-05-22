/**
 * Subagent stitching.
 *
 * Replaces the parent transcript's `tool_call` event for an `Agent` tool_use
 * with a `subagent` event whose nested `events` array contains the (filtered)
 * subagent transcript's events.
 *
 * ## Empirical findings (real-data verification, slice-2 65-session scan + slice-4 follow-up)
 *
 * - The Cowork dispatching tool is named `Agent` (NOT `Task` as the spec
 *   originally suggested). The 9 non-acompact subagent files in Hassan's real
 *   data all map 1:1 to `Agent` tool_use blocks in their parent transcripts.
 *
 * - The `parentToolUseID` field on subagent events does NOT carry parent-
 *   transcript linkage — it carries hook-progress correlation for tools called
 *   INSIDE the subagent. It's not usable for stitching.
 *
 * - The reliable linkage is by content + dispatch id: the `Agent` tool_use
 *   block's `input.prompt` field is the exact prompt sent to the subagent.
 *   The subagent's first user-string message starts with that prompt. To
 *   correlate a SPECIFIC `tool_call` event to its SPECIFIC dispatch (critical
 *   when a parent has multiple Agent dispatches), the parser captures the
 *   raw `toolu_<id>` of each `tool_use` block into a side-map, and the
 *   stitcher uses that map to look up the per-event dispatch prompt before
 *   matching against subagent firstUserPrefix.
 *
 * - Subagent transcripts have `isSidechain: true` on every event. The
 *   per-event filter doesn't care; it processes them the same way as parent
 *   events.
 *
 * ## Slice-4 regression and fix (Perplexity review on PR #17)
 *
 * The original slice-4 stitcher walked stitchables in order and matched any
 * stitchable whose firstUserPrefix existed ANYWHERE in agentDispatchMap. This
 * worked by accident when the filesystem ordering of subagent files matched
 * the order of Agent dispatches in the parent. It silently failed (subagents
 * swapped between Agent dispatches) when the orders differed. The corrected
 * algorithm — per-event correlation via `toolUseIdsByEventUuid` — is what's
 * implemented here.
 *
 * ## The empty-envelope rule (Perplexity confirmed for slice 4)
 *
 * When a subagent's events array ends up empty after per-event filtering, we
 * still emit the `subagent` envelope. The parent's `Agent` tool_use is
 * replaced by the subagent event regardless of whether the subagent had
 * substantive content. Dropping the envelope would orphan the parent's
 * dispatch and lose the audit trail.
 *
 * ## The `Agent` tool_call event is REPLACED, not augmented
 *
 * In the per-event-filtered parent stream, the `Agent` dispatch initially
 * appears as a `tool_call` event with `tool: "Agent"`. Stitching removes
 * that event and inserts a `subagent` event in its place. If no subagent
 * file matches a given `Agent` tool_use, the tool_call event stays.
 */

import { parseTranscript } from './parser.js';
import type { Event, SubagentEvent } from './schema.js';

/** How many characters of the subagent's first user text we match against the parent's Agent prompt. */
const PROMPT_MATCH_PREFIX_LEN = 80;

export const AGENT_TOOL_NAME = 'Agent';

export interface SubagentStitchInput {
  /** Absolute path to a non-acompact subagent .jsonl. */
  path: string;
  /** Slug from `-sessions-<slug>/` parent dir. */
  slug: string;
}

/** A subagent already parsed through the per-event filter, ready to be stitched in. */
export interface Stitchable {
  /** Absolute path to the subagent .jsonl on disk. */
  file: string;
  /** Slug of the subagent (from the `-sessions-<slug>/` parent dir). */
  slug: string;
  /** First `PROMPT_MATCH_PREFIX_LEN` chars of the subagent's first user_text event. */
  firstUserPrefix: string;
  /** Filtered events from the subagent transcript. */
  events: Event[];
}

/**
 * Convenience: parse + classify a list of subagent paths into Stitchable
 * records. The caller (run-discovery) typically uses this rather than
 * constructing Stitchables by hand. Tests can construct Stitchables directly.
 */
export async function loadStitchables(
  inputs: readonly SubagentStitchInput[]
): Promise<Stitchable[]> {
  const out: Stitchable[] = [];
  for (const inp of inputs) {
    const parsed = await parseTranscript(inp.path);
    let firstUserPrefix = '';
    for (const e of parsed.events) {
      if (e.kind === 'user_text') {
        firstUserPrefix = e.text.slice(0, PROMPT_MATCH_PREFIX_LEN);
        break;
      }
    }
    out.push({ file: inp.path, slug: inp.slug, firstUserPrefix, events: parsed.events });
  }
  return out;
}

/**
 * Stitch subagent events into a parent's event stream by per-event correlation.
 *
 * For each `tool_call` event in `parentEvents` whose `tool === "Agent"`:
 *   1. Look up the event's toolu_<id> via `toolUseIdsByEventUuid[event.uuid]`.
 *   2. Look up that toolu_id's dispatch prompt via `agentDispatchMap[toolu_id]`.
 *   3. Find the first unused stitchable whose `firstUserPrefix` is a prefix
 *      of that dispatch prompt.
 *   4. If matched, replace the tool_call event with a `subagent` event whose
 *      `parentToolUseId` is the correlated toolu_id and whose nested
 *      `events` are the stitchable's filtered events. The replacement happens
 *      even when the stitchable's events array is empty (empty-envelope rule).
 *   5. If no match is found, the tool_call event stays as-is. The stitchable
 *      may still be used by a later tool_call (it's only "used" on a real
 *      match).
 *
 * Returns the rewritten event stream plus a list of stitchable files that
 * were never used (caller surfaces these to the audit log).
 *
 * Non-`Agent` tool_call events pass through unchanged regardless of their
 * summaries.
 */
export function doStitch(
  parentEvents: readonly Event[],
  stitchables: readonly Stitchable[],
  agentDispatchMap: ReadonlyMap<string, string>,
  toolUseIdsByEventUuid: ReadonlyMap<string, string>
): { events: Event[]; unmatchedSubagents: string[] } {
  if (stitchables.length === 0) {
    return { events: [...parentEvents], unmatchedSubagents: [] };
  }

  const used = new Set<number>();
  const result: Event[] = [];

  for (const event of parentEvents) {
    if (event.kind !== 'tool_call' || event.tool !== AGENT_TOOL_NAME) {
      result.push(event);
      continue;
    }

    // Look up THIS specific tool_call's source toolu_<id>, then THIS dispatch's
    // prompt. Without this correlation, two stitchables would race and the
    // first-in-array would win regardless of which tool_call we're at.
    const toolUseId = toolUseIdsByEventUuid.get(event.uuid);
    if (toolUseId === undefined) {
      // Parser didn't capture an id for this event (synthetic data, or a
      // tool_use block with no id field). Cannot correlate; leave unchanged.
      result.push(event);
      continue;
    }
    const dispatchPrompt = agentDispatchMap.get(toolUseId);
    if (dispatchPrompt === undefined || dispatchPrompt.length === 0) {
      // Parent transcript didn't have a prompt for this id. Cannot correlate.
      result.push(event);
      continue;
    }

    // Find the first unused stitchable whose firstUserPrefix is a prefix of
    // THIS dispatch's prompt — guaranteed per-event correlation.
    let matchedIdx = -1;
    for (let i = 0; i < stitchables.length; i++) {
      if (used.has(i)) continue;
      const s = stitchables[i]!;
      if (s.firstUserPrefix.length === 0) continue;
      if (dispatchPrompt.startsWith(s.firstUserPrefix)) {
        matchedIdx = i;
        break;
      }
    }

    if (matchedIdx === -1) {
      result.push(event);
      continue;
    }

    const matched = stitchables[matchedIdx]!;
    used.add(matchedIdx);

    const filename = matched.file.split('/').pop() ?? matched.file;
    const subagentSlug = filename.replace(/\.jsonl$/i, '');

    const subagentEvent: SubagentEvent = {
      kind: 'subagent',
      ts: event.ts,
      uuid: event.uuid,
      subagentSlug,
      parentToolUseId: toolUseId, // ← now carries the actual toolu_<id>, not the event uuid
      events: matched.events,
      ...(event.cwd !== undefined ? { cwd: event.cwd } : {}),
      ...(event.gitBranch !== undefined ? { gitBranch: event.gitBranch } : {}),
    };
    result.push(subagentEvent);
  }

  const unmatched: string[] = [];
  for (let i = 0; i < stitchables.length; i++) {
    if (!used.has(i)) unmatched.push(stitchables[i]!.file);
  }

  return { events: result, unmatchedSubagents: unmatched };
}

/**
 * Read a parent .jsonl and build a map of `toolu_<id> → input.prompt` for
 * every `Agent` tool_use block. Used by `run-discovery` to feed `doStitch`.
 */
export async function readAgentDispatchMap(parentFile: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const fs = await import('node:fs');
  let raw: string;
  try {
    raw = await fs.promises.readFile(parentFile, 'utf8');
  } catch {
    return map;
  }

  for (const line of raw.split('\n')) {
    if (line.length === 0) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof obj !== 'object' || obj === null) continue;
    const o = obj as Record<string, unknown>;
    const msg = o['message'];
    if (typeof msg !== 'object' || msg === null) continue;
    const content = (msg as Record<string, unknown>)['content'];
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (typeof b !== 'object' || b === null) continue;
      const block = b as Record<string, unknown>;
      if (block['type'] !== 'tool_use' || block['name'] !== AGENT_TOOL_NAME) continue;
      const id = block['id'];
      const input = block['input'];
      if (typeof id !== 'string' || typeof input !== 'object' || input === null) continue;
      const prompt = (input as Record<string, unknown>)['prompt'];
      if (typeof prompt !== 'string') continue;
      map.set(id, prompt);
    }
  }
  return map;
}
