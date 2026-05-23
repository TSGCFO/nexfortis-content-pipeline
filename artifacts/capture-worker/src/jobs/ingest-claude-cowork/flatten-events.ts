/**
 * Flatten the recursive Cowork event tree into an ordered stream of
 * embeddable-event records.
 *
 * Subagent envelopes themselves contribute nothing — they are walked
 * depth-first at the envelope's position so their children appear inline
 * with the surrounding events. The flat stream therefore preserves the
 * conversation's logical timestamp order (depth-first at the position of
 * each subagent envelope).
 *
 * `tool_call` events are included in the flat stream regardless of whether
 * a `summary` is present. Composition (in `process.ts`) decides whether
 * each flat event contributes text. Pre-merging or pre-skipping here would
 * lose the per-event identity and the ability to count tool activity in
 * the flat stream length for diagnostics.
 *
 * Pure function: no I/O, no logger, fully deterministic.
 */

import type { Event, FlatEvent } from './types.js';

export function flattenEvents(events: readonly Event[]): FlatEvent[] {
  const out: FlatEvent[] = [];
  walk(events, out);
  return out;
}

function walk(events: readonly Event[], out: FlatEvent[]): void {
  for (const e of events) {
    switch (e.kind) {
      case 'user_text':
        out.push({ kind: 'user_text', ts: e.ts, uuid: e.uuid, text: e.text });
        break;
      case 'assistant_text':
        out.push({
          kind: 'assistant_text',
          ts: e.ts,
          uuid: e.uuid,
          text: e.text,
        });
        break;
      case 'tool_call':
        out.push({
          kind: 'tool_call',
          ts: e.ts,
          uuid: e.uuid,
          tool: e.tool,
          summary: e.summary,
        });
        break;
      case 'subagent':
        // Envelope itself contributes nothing to the flat stream — only
        // its children, depth-first, at this position.
        walk(e.events, out);
        break;
      default: {
        // The discriminated union from @ncp/cowork-export is closed.
        // `never` here makes future schema additions a compile error.
        const _never: never = e;
        throw new Error(
          `flattenEvents: unexpected event kind: ${JSON.stringify(_never)}`,
        );
      }
    }
  }
}
