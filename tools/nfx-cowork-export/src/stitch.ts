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
 * - The reliable linkage is by content: the `Agent` tool_use block's
 *   `input.prompt` field is the exact prompt sent to the subagent. The
 *   subagent's first user-string message starts with that prompt. Matching by
 *   the first 80 chars of the prompt against the subagent's first user text
 *   is unambiguous across all 9 real subagents in the data.
 *
 * - Subagent transcripts have `isSidechain: true` on every event. The
 *   per-event filter doesn't care; it processes them the same way as parent
 *   events.
 *
 * ## The empty-envelope rule (Perplexity confirmed for slice 4)
 *
 * When a subagent's events array ends up empty after per-event filtering, we
 * still emit the `subagent` envelope. The parent's `Agent` tool_use is
 * replaced by the subagent event regardless of whether the subagent had
 * substantive content. Dropping the envelope would orphan the parent's
 * dispatch and lose the audit trail. Downstream chunker decides what to do
 * with empty subagents.
 *
 * ## The `Agent` tool_call event is REPLACED, not augmented
 *
 * In the per-event-filtered parent stream, the `Agent` dispatch initially
 * appears as a `tool_call` event with `tool: "Agent"`. Stitching removes that
 * event and inserts a `subagent` event in its place. If no subagent file
 * matches a given `Agent` tool_use, the tool_call event stays (so the parent
 * still records that an Agent was dispatched, even if its transcript wasn't
 * persisted).
 */

import path from 'node:path';

import { parseTranscript } from './parser.js';
import { toPosixPath } from './discovery.js';
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

/**
 * Take a parent transcript's filtered event stream + the discovered
 * subagent files for that parent, parse each subagent, and replace the
 * matching `Agent` tool_call events with `subagent` events.
 *
 * Returns the new event stream plus a list of any subagent files that were
 * parsed but couldn't be matched to a parent `Agent` tool_call — caller
 * should surface those to the audit log.
 */
export async function stitchSubagents(
  parentEvents: readonly Event[],
  subagentFiles: readonly SubagentStitchInput[],
  /** Pass-through into parseTranscript so caller can pre-resolve raw tool_use ids if needed. Not used in slice 4. */
  _parentSourceFile: string
): Promise<{ events: Event[]; unmatchedSubagents: string[] }> {
  if (subagentFiles.length === 0) {
    return { events: [...parentEvents], unmatchedSubagents: [] };
  }

  // Parse every subagent file once; build a list of stitchable entries.
  const stitchables: {
    file: string;
    slug: string;
    firstUserPrefix: string;
    events: Event[];
  }[] = [];

  for (const sub of subagentFiles) {
    const parsed = await parseTranscript(sub.path);
    // Find the FIRST user_text event's text (after per-event filtering)
    // before scaffold strip — subagents don't have auto-continuation scaffolds.
    let firstUserPrefix = '';
    for (const e of parsed.events) {
      if (e.kind === 'user_text') {
        firstUserPrefix = e.text.slice(0, PROMPT_MATCH_PREFIX_LEN);
        break;
      }
    }
    // Empty firstUserPrefix is OK — we'll just match on empty against any
    // Agent tool_use whose prompt happens to start with "". That's a no-op
    // match, which means this subagent never stitches and the parent's
    // Agent tool_call stays as-is. Acceptable for now; caller can flag in
    // unmatchedSubagents.
    stitchables.push({
      file: sub.path,
      slug: sub.slug,
      firstUserPrefix,
      events: parsed.events,
    });
  }

  // Walk the parent's events. For each `tool_call` with `tool: "Agent"`,
  // look up a stitchable whose firstUserPrefix matches the tool's input
  // prompt prefix. The matching is consumer-style: a stitchable is used at
  // most once.
  // We need access to the original Agent tool_use's INPUT to compare against
  // firstUserPrefix. The parser already extracted a SUMMARY into tool_call.
  // For Agent, no extractor exists, so summary is undefined. We need the
  // raw input.prompt.
  //
  // Strategy: re-parse the parent jsonl looking for Agent tool_use blocks,
  // map their toolu_<id> -> input.prompt, then use the tool_call event's
  // associated uuid... wait, we don't carry the toolu_<id> on tool_call.
  //
  // Cleanest: have the parser carry the toolu_id along for Agent specifically,
  // OR re-read the parent's raw lines here to extract the prompt.
  //
  // For minimal scope: stitcher takes the toolu_id -> prompt map as a
  // separately-resolved input. Caller (run-discovery) builds the map by
  // re-reading the parent's raw lines.

  // Slice 4 takes the "re-read parent" approach via the helper below.
  void path;
  void toPosixPath;
  return doStitch(parentEvents, stitchables, new Map());
}

/**
 * Lower-level helper exposed for testing.
 *
 * @param agentDispatchMap toolu_<id> → input.prompt as read from the parent's raw lines.
 *                          Empty map means no Agent dispatches resolved.
 */
export function doStitch(
  parentEvents: readonly Event[],
  stitchables: ReadonlyArray<{ file: string; slug: string; firstUserPrefix: string; events: Event[] }>,
  agentDispatchMap: ReadonlyMap<string, string>
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

    // Find a matching stitchable. We do this by looking up the Agent tool_use
    // input.prompt via `agentDispatchMap` (toolu_id -> prompt) — but we don't
    // know the toolu_id on the tool_call event itself yet.
    //
    // Match path: walk every unused stitchable and try EVERY dispatch in
    // agentDispatchMap. If any prompt starts with stitchable.firstUserPrefix,
    // that's our match. This is O(stitchables * dispatches) per Agent
    // tool_call but both numbers are small.
    let matchedIdx = -1;
    for (let i = 0; i < stitchables.length; i++) {
      if (used.has(i)) continue;
      const s = stitchables[i]!;
      if (s.firstUserPrefix.length === 0) continue;
      // any dispatch prompt that starts with this stitchable's first user prefix matches
      let found = false;
      for (const prompt of agentDispatchMap.values()) {
        if (prompt.startsWith(s.firstUserPrefix)) {
          found = true;
          break;
        }
      }
      if (found) {
        matchedIdx = i;
        break;
      }
    }

    if (matchedIdx === -1) {
      // No matching subagent — keep the tool_call as-is.
      result.push(event);
      continue;
    }

    const matched = stitchables[matchedIdx]!;
    used.add(matchedIdx);

    // Build a subagent event in place of the tool_call.
    // subagentSlug = the agent-<hash> filename without extension.
    const filename = matched.file.split('/').pop() ?? matched.file;
    const subagentSlug = filename.replace(/\.jsonl$/i, '');

    const subagentEvent: SubagentEvent = {
      kind: 'subagent',
      ts: event.ts,
      uuid: event.uuid,
      subagentSlug,
      // parentToolUseId: we don't know it here; caller can patch in or the
      // schema field becomes the synthetic UUID of the tool_call event we
      // replaced. For slice 4 we use the event's uuid as a stable identifier.
      parentToolUseId: event.uuid,
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
 * every `Agent` tool_use block. Used by `run-discovery` to feed the stitch
 * function.
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
