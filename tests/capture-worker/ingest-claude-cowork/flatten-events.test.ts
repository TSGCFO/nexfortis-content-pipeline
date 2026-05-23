import { describe, expect, it } from 'vitest';

import { flattenEvents } from '../../../artifacts/capture-worker/src/jobs/ingest-claude-cowork/flatten-events.js';
import type { Event } from '../../../artifacts/capture-worker/src/jobs/ingest-claude-cowork/types.js';

function user(uuid: string, ts: string, text: string): Event {
  return { kind: 'user_text', uuid, ts, text };
}
function assistant(uuid: string, ts: string, text: string): Event {
  return { kind: 'assistant_text', uuid, ts, text };
}
function tool(
  uuid: string,
  ts: string,
  toolName: string,
  summary?: string,
): Event {
  return summary === undefined
    ? { kind: 'tool_call', uuid, ts, tool: toolName }
    : { kind: 'tool_call', uuid, ts, tool: toolName, summary };
}
function subagent(
  uuid: string,
  ts: string,
  slug: string,
  parentToolUseId: string,
  events: Event[],
): Event {
  return {
    kind: 'subagent',
    uuid,
    ts,
    subagentSlug: slug,
    parentToolUseId,
    events,
  };
}

describe('flattenEvents', () => {
  it('flattens single-level events in input order', async () => {
    const events: Event[] = [
      user('u-1', '2026-04-08T14:23:11.000Z', 'hello'),
      assistant('a-1', '2026-04-08T14:23:12.000Z', 'hi'),
    ];
    const flat = flattenEvents(events);
    expect(flat.map((e) => e.uuid)).toEqual(['u-1', 'a-1']);
    expect(flat[0]?.kind).toBe('user_text');
    expect(flat[1]?.kind).toBe('assistant_text');
  });

  it('walks subagent envelopes recursively (depth-first at envelope position) and does not include the envelope itself', async () => {
    const events: Event[] = [
      user('u-1', '2026-04-08T14:23:11.000Z', 'parent question'),
      subagent('sub-env', '2026-04-08T14:25:00.000Z', 'agent-x', 'toolu_1', [
        assistant('a-sub', '2026-04-08T14:25:01.000Z', 'sub answer'),
        tool('t-sub', '2026-04-08T14:25:02.000Z', 'mcp__x__op', 's'),
      ]),
      user('u-2', '2026-04-08T14:25:10.000Z', 'follow up'),
    ];
    const flat = flattenEvents(events);
    expect(flat.map((e) => e.uuid)).toEqual(['u-1', 'a-sub', 't-sub', 'u-2']);
    // Envelope's own UUID never appears
    expect(flat.map((e) => e.uuid)).not.toContain('sub-env');
  });

  it('handles two-level nesting (subagent-of-subagent)', async () => {
    const events: Event[] = [
      subagent('outer', '2026-04-08T14:25:00.000Z', 'outer-agent', 'toolu_o', [
        subagent(
          'inner',
          '2026-04-08T14:25:01.000Z',
          'inner-agent',
          'toolu_i',
          [assistant('deep', '2026-04-08T14:25:02.000Z', 'deep reply')],
        ),
      ]),
    ];
    const flat = flattenEvents(events);
    expect(flat.map((e) => e.uuid)).toEqual(['deep']);
    expect(flat[0]?.kind).toBe('assistant_text');
  });

  it('includes tool_call events that have no summary in the flat stream count', async () => {
    const events: Event[] = [
      tool('t-1', '2026-04-08T14:25:00.000Z', 'mcp__y__op'),
      tool('t-2', '2026-04-08T14:25:01.000Z', 'mcp__y__op', 'has summary'),
    ];
    const flat = flattenEvents(events);
    expect(flat).toHaveLength(2);
    const first = flat[0];
    expect(first?.kind).toBe('tool_call');
    if (first?.kind === 'tool_call') {
      expect(first.summary).toBeUndefined();
    }
    const second = flat[1];
    if (second?.kind === 'tool_call') {
      expect(second.summary).toBe('has summary');
    }
  });

  it('treats an empty subagent envelope (events: []) as contributing nothing without throwing', async () => {
    const events: Event[] = [
      user('u-1', '2026-04-08T14:23:11.000Z', 'before'),
      subagent('empty', '2026-04-08T14:24:00.000Z', 'noop', 'toolu_n', []),
      user('u-2', '2026-04-08T14:25:00.000Z', 'after'),
    ];
    const flat = flattenEvents(events);
    expect(flat.map((e) => e.uuid)).toEqual(['u-1', 'u-2']);
  });

  it('produces the expected ordered sequence for a hand-traced mixed tree', async () => {
    const events: Event[] = [
      user('U1', '2026-04-08T14:23:11.000Z', 'first user'),
      assistant('A1', '2026-04-08T14:23:12.000Z', 'first assistant'),
      tool('T1', '2026-04-08T14:23:13.000Z', 'mcp__a__op', 'tool one'),
      subagent('SUB-OUTER', '2026-04-08T14:23:14.000Z', 'outer', 'toolu_a', [
        assistant('A2', '2026-04-08T14:23:15.000Z', 'sub assistant'),
        subagent(
          'SUB-INNER',
          '2026-04-08T14:23:16.000Z',
          'inner',
          'toolu_b',
          [user('U-INNER', '2026-04-08T14:23:17.000Z', 'inner user')],
        ),
        tool('T2', '2026-04-08T14:23:18.000Z', 'mcp__a__op'),
      ]),
      user('U2', '2026-04-08T14:23:19.000Z', 'last user'),
    ];
    const flat = flattenEvents(events);
    expect(flat.map((e) => e.uuid)).toEqual([
      'U1',
      'A1',
      'T1',
      'A2',
      'U-INNER',
      'T2',
      'U2',
    ]);
  });
});
