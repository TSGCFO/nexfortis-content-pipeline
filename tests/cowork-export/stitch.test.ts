import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AGENT_TOOL_NAME,
  doStitch,
  readAgentDispatchMap,
  type Stitchable,
} from '../../tools/nfx-cowork-export/src/stitch.js';
import type { Event } from '../../tools/nfx-cowork-export/src/schema.js';

const userText = (text: string): Event => ({
  kind: 'user_text',
  ts: '2026-04-08T14:23:11.000Z',
  uuid: `u-${text.slice(0, 6)}`,
  text,
});

const asstText = (text: string): Event => ({
  kind: 'assistant_text',
  ts: '2026-04-08T14:23:12.000Z',
  uuid: `a-${text.slice(0, 6)}`,
  text,
});

const toolCall = (tool: string, uuid: string): Event => ({
  kind: 'tool_call',
  ts: '2026-04-08T14:23:13.000Z',
  uuid,
  tool,
});

describe('doStitch — happy path', () => {
  it('replaces an Agent tool_call with a subagent event when a stitchable matches the dispatch prompt', () => {
    const parentEvents: Event[] = [
      userText('parent prompt'),
      toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1'),
      asstText('parent reply'),
    ];
    const stitchables: Stitchable[] = [
      {
        file: '/x/agent-abc.jsonl',
        slug: 'test-slug',
        firstUserPrefix: 'Search Hassan',
        events: [userText('Search Hassan for X'), asstText('subagent result')],
      },
    ];
    // The parent's Agent dispatch at agent-call-uuid-1 used toolu_111, whose prompt is "Search Hassan for X — full prompt with details"
    const toolUseIds = new Map([['agent-call-uuid-1', 'toolu_111']]);
    const dispatchMap = new Map([['toolu_111', 'Search Hassan for X — full prompt with details']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);
    expect(r.unmatchedSubagents).toEqual([]);
    expect(r.events).toHaveLength(3);
    expect(r.events[0]!.kind).toBe('user_text');
    expect(r.events[1]!.kind).toBe('subagent');
    if (r.events[1]!.kind === 'subagent') {
      expect(r.events[1]!.subagentSlug).toBe('agent-abc');
      expect(r.events[1]!.events).toHaveLength(2);
      // parentToolUseId now carries the ACTUAL toolu_<id>, not the synthesized event uuid
      expect(r.events[1]!.parentToolUseId).toBe('toolu_111');
    }
    expect(r.events[2]!.kind).toBe('assistant_text');
  });

  it('emits an empty subagent envelope when the subagent has zero filtered events (empty-envelope rule)', () => {
    const parentEvents: Event[] = [toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1')];
    const stitchables: Stitchable[] = [
      { file: '/x/agent-empty.jsonl', slug: 'slug', firstUserPrefix: 'kick off', events: [] },
    ];
    const toolUseIds = new Map([['agent-call-uuid-1', 'toolu_111']]);
    const dispatchMap = new Map([['toolu_111', 'kick off the subagent']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.kind).toBe('subagent');
    if (r.events[0]!.kind === 'subagent') {
      expect(r.events[0]!.events).toEqual([]);
    }
  });
});

describe('doStitch — no-match scenarios', () => {
  it('leaves the Agent tool_call untouched when no stitchable prompt prefix matches its dispatch', () => {
    const parentEvents: Event[] = [toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1')];
    const stitchables: Stitchable[] = [
      {
        file: '/x/agent-unrelated.jsonl',
        slug: 'slug',
        firstUserPrefix: 'completely different prefix',
        events: [userText('sub')],
      },
    ];
    const toolUseIds = new Map([['agent-call-uuid-1', 'toolu_111']]);
    const dispatchMap = new Map([['toolu_111', 'some other prompt']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.kind).toBe('tool_call');
    expect(r.unmatchedSubagents).toEqual(['/x/agent-unrelated.jsonl']);
  });

  it('leaves the Agent tool_call untouched when the dispatch map is empty', () => {
    const parentEvents: Event[] = [toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1')];
    const stitchables: Stitchable[] = [
      { file: '/x/agent-1.jsonl', slug: 's', firstUserPrefix: 'kick', events: [] },
    ];
    const toolUseIds = new Map([['agent-call-uuid-1', 'toolu_111']]);
    const dispatchMap = new Map<string, string>();
    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);
    expect(r.events[0]!.kind).toBe('tool_call');
    expect(r.unmatchedSubagents).toEqual(['/x/agent-1.jsonl']);
  });

  it('leaves the Agent tool_call untouched when toolUseIdsByEventUuid has no entry for this event', () => {
    // The parser may have failed to capture an id (e.g. malformed source data).
    // Without a correlation, the stitcher cannot reliably match — must leave alone.
    const parentEvents: Event[] = [toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1')];
    const stitchables: Stitchable[] = [
      { file: '/x/agent-1.jsonl', slug: 's', firstUserPrefix: 'kick', events: [userText('kick')] },
    ];
    const toolUseIds = new Map<string, string>(); // no entry for agent-call-uuid-1
    const dispatchMap = new Map([['toolu_111', 'kick this off']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);
    expect(r.events[0]!.kind).toBe('tool_call');
    expect(r.unmatchedSubagents).toEqual(['/x/agent-1.jsonl']);
  });

  it('does NOT stitch over non-Agent tool_call events even if their summary prefix matches', () => {
    const parentEvents: Event[] = [toolCall('Bash', 'bash-call-uuid')];
    const stitchables: Stitchable[] = [
      { file: '/x/agent-1.jsonl', slug: 's', firstUserPrefix: 'ls', events: [userText('ls -la')] },
    ];
    const toolUseIds = new Map([['bash-call-uuid', 'toolu_bash']]);
    const dispatchMap = new Map([['toolu_bash', 'ls -la /tmp']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);
    expect(r.events[0]!.kind).toBe('tool_call');
    expect((r.events[0]! as { tool: string }).tool).toBe('Bash');
    expect(r.unmatchedSubagents).toEqual(['/x/agent-1.jsonl']);
  });

  it('skips stitchables with empty firstUserPrefix (cannot match anything)', () => {
    const parentEvents: Event[] = [toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1')];
    const stitchables: Stitchable[] = [
      { file: '/x/agent-empty-prefix.jsonl', slug: 's', firstUserPrefix: '', events: [] },
    ];
    const toolUseIds = new Map([['agent-call-uuid-1', 'toolu_111']]);
    const dispatchMap = new Map([['toolu_111', 'anything']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);
    expect(r.events[0]!.kind).toBe('tool_call');
    expect(r.unmatchedSubagents).toEqual(['/x/agent-empty-prefix.jsonl']);
  });
});

describe('doStitch — multiple subagents in one parent (per-event correlation)', () => {
  // REGRESSION TEST for the slice-4 review bug. The original implementation walked
  // stitchables in array order and used the FIRST one whose prefix matched ANY
  // prompt — even if that prompt belonged to a different Agent tool_call. When
  // filesystem ordering of subagent files didn't match the dispatch order in
  // the parent, two subagents would get silently swapped between their Agent
  // dispatches. The corrected algorithm correlates per tool_call event via
  // toolUseIdsByEventUuid.

  it('mismatched-order: stitchables in reverse order from dispatches → each tool_call still stitches its CORRECT subagent', () => {
    // Parent has TWO Agent tool_calls. The FIRST dispatch should pair with agent-2;
    // the SECOND with agent-1 — but the stitchables array intentionally lists
    // agent-1 BEFORE agent-2.
    const parentEvents: Event[] = [
      toolCall(AGENT_TOOL_NAME, 'first-tool-call'),
      asstText('between'),
      toolCall(AGENT_TOOL_NAME, 'second-tool-call'),
    ];

    const stitchables: Stitchable[] = [
      // Note: stitchables array order is REVERSED from the parent's dispatch order
      {
        file: '/x/agent-1.jsonl',
        slug: 's',
        firstUserPrefix: 'first-task',
        events: [userText('first-task instructions')],
      },
      {
        file: '/x/agent-2.jsonl',
        slug: 's',
        firstUserPrefix: 'second-task',
        events: [userText('second-task instructions')],
      },
    ];

    // first-tool-call carries toolu_A whose prompt starts with "second-task"
    // second-tool-call carries toolu_B whose prompt starts with "first-task"
    // i.e. the dispatch order is reverse of the stitchable array order.
    const toolUseIds = new Map([
      ['first-tool-call', 'toolu_A'],
      ['second-tool-call', 'toolu_B'],
    ]);
    const dispatchMap = new Map([
      ['toolu_A', 'second-task: do something for the second case'],
      ['toolu_B', 'first-task: do something for the first case'],
    ]);

    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);

    expect(r.events).toHaveLength(3);
    expect(r.events[0]!.kind).toBe('subagent');
    expect(r.events[2]!.kind).toBe('subagent');

    if (r.events[0]!.kind === 'subagent' && r.events[2]!.kind === 'subagent') {
      // first-tool-call (the FIRST event in the parent) should map to agent-2
      expect(r.events[0]!.subagentSlug).toBe('agent-2');
      expect(r.events[0]!.parentToolUseId).toBe('toolu_A');

      // second-tool-call (the SECOND event in the parent) should map to agent-1
      expect(r.events[2]!.subagentSlug).toBe('agent-1');
      expect(r.events[2]!.parentToolUseId).toBe('toolu_B');
    }

    expect(r.unmatchedSubagents).toEqual([]);
  });

  it('mismatched-order + missing subagent: tool_call without a matching subagent stays unchanged, the other still matches correctly', () => {
    // Two Agent tool_calls in the parent. Only ONE has a corresponding
    // stitchable. Verify:
    //   - the matched tool_call gets its subagent
    //   - the unmatched tool_call stays as a tool_call (graceful degradation)
    //   - no swap with the unrelated stitchable
    const parentEvents: Event[] = [
      toolCall(AGENT_TOOL_NAME, 'first-tool-call'),
      toolCall(AGENT_TOOL_NAME, 'second-tool-call'),
    ];

    // Stitchable order is reversed AND there's only one
    const stitchables: Stitchable[] = [
      {
        file: '/x/agent-only.jsonl',
        slug: 's',
        firstUserPrefix: 'second-task',
        events: [userText('second-task instructions')],
      },
    ];

    const toolUseIds = new Map([
      ['first-tool-call', 'toolu_A'],
      ['second-tool-call', 'toolu_B'],
    ]);
    const dispatchMap = new Map([
      ['toolu_A', 'first-task: did not export this subagent'],
      ['toolu_B', 'second-task: this one was exported'],
    ]);

    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);

    expect(r.events).toHaveLength(2);
    // first-tool-call: no matching subagent → tool_call stays
    expect(r.events[0]!.kind).toBe('tool_call');
    // second-tool-call: matched to agent-only
    expect(r.events[1]!.kind).toBe('subagent');
    if (r.events[1]!.kind === 'subagent') {
      expect(r.events[1]!.subagentSlug).toBe('agent-only');
      expect(r.events[1]!.parentToolUseId).toBe('toolu_B');
    }
    expect(r.unmatchedSubagents).toEqual([]);
  });

  it('same-order baseline: stitchables in the SAME order as dispatches still works (no regression)', () => {
    // Sanity-check the "easy" case — stitchables[0] dispatches first,
    // stitchables[1] dispatches second.
    const parentEvents: Event[] = [
      toolCall(AGENT_TOOL_NAME, 'first-tool-call'),
      toolCall(AGENT_TOOL_NAME, 'second-tool-call'),
    ];
    const stitchables: Stitchable[] = [
      { file: '/x/agent-1.jsonl', slug: 's', firstUserPrefix: 'first-task', events: [userText('first-task')] },
      { file: '/x/agent-2.jsonl', slug: 's', firstUserPrefix: 'second-task', events: [userText('second-task')] },
    ];
    const toolUseIds = new Map([
      ['first-tool-call', 'toolu_A'],
      ['second-tool-call', 'toolu_B'],
    ]);
    const dispatchMap = new Map([
      ['toolu_A', 'first-task: kick'],
      ['toolu_B', 'second-task: kick'],
    ]);
    const r = doStitch(parentEvents, stitchables, dispatchMap, toolUseIds);
    expect(r.events[0]!.kind).toBe('subagent');
    expect(r.events[1]!.kind).toBe('subagent');
    if (r.events[0]!.kind === 'subagent' && r.events[1]!.kind === 'subagent') {
      expect(r.events[0]!.subagentSlug).toBe('agent-1');
      expect(r.events[1]!.subagentSlug).toBe('agent-2');
    }
  });
});

describe('readAgentDispatchMap', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nfx-stitch-'));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('extracts every Agent tool_use\'s (id → input.prompt) from a parent transcript', async () => {
    const file = path.join(tmp, 'parent.jsonl');
    const lines = [
      JSON.stringify({
        type: 'assistant',
        uuid: 'a1',
        timestamp: '2026-04-08T14:23:11.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_AAA', name: 'Agent', input: { prompt: 'do task X' } },
          ],
        },
      }),
      JSON.stringify({
        type: 'assistant',
        uuid: 'a2',
        timestamp: '2026-04-08T14:23:12.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_BBB', name: 'Bash', input: { command: 'ls' } },
            { type: 'tool_use', id: 'toolu_CCC', name: 'Agent', input: { prompt: 'do task Y' } },
          ],
        },
      }),
    ];
    await fs.writeFile(file, lines.join('\n'), 'utf8');
    const map = await readAgentDispatchMap(file);
    expect(map.get('toolu_AAA')).toBe('do task X');
    expect(map.get('toolu_CCC')).toBe('do task Y');
    expect(map.has('toolu_BBB')).toBe(false);
    expect(map.size).toBe(2);
  });

  it('returns an empty map for a non-existent file', async () => {
    const map = await readAgentDispatchMap(path.join(tmp, 'does-not-exist.jsonl'));
    expect(map.size).toBe(0);
  });

  it('skips lines that fail to parse', async () => {
    const file = path.join(tmp, 'partial.jsonl');
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Agent', input: { prompt: 'p1' } }] },
      }),
      'NOT JSON',
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'Agent', input: { prompt: 'p2' } }] },
      }),
    ];
    await fs.writeFile(file, lines.join('\n'), 'utf8');
    const map = await readAgentDispatchMap(file);
    expect(map.size).toBe(2);
    expect(map.get('t1')).toBe('p1');
    expect(map.get('t2')).toBe('p2');
  });

  it('ignores tool_use blocks without a prompt field', async () => {
    const file = path.join(tmp, 'no-prompt.jsonl');
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 't1', name: 'Agent', input: { description: 'no prompt here' } }],
      },
    });
    await fs.writeFile(file, line, 'utf8');
    const map = await readAgentDispatchMap(file);
    expect(map.size).toBe(0);
  });
});

describe('parser → stitcher: toolUseIdsByEventUuid integration', () => {
  it('parser captures toolu_<id> on tool_call events when a collector is provided', async () => {
    const { parseTranscript } = await import('../../tools/nfx-cowork-export/src/parser.js');
    let tmp: string;
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nfx-parser-int-'));
    try {
      const file = path.join(tmp, 'parent.jsonl');
      const line = JSON.stringify({
        type: 'assistant',
        uuid: 'asst-1',
        timestamp: '2026-04-08T14:23:11.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'toolu_XYZ', name: 'Agent', input: { prompt: 'x' } }],
        },
      });
      await fs.writeFile(file, line, 'utf8');
      const result = await parseTranscript(file);
      expect(result.events).toHaveLength(1);
      const event = result.events[0]!;
      expect(event.kind).toBe('tool_call');
      // Key invariant: the parser's map links the event's uuid to the original toolu_<id>
      expect(result.toolUseIdsByEventUuid.get(event.uuid)).toBe('toolu_XYZ');
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
