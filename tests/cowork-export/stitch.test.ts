import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AGENT_TOOL_NAME,
  doStitch,
  readAgentDispatchMap,
} from '../../tools/nfx-cowork-export/src/stitch.js';
import type { Event } from '../../tools/nfx-cowork-export/src/schema.js';

const userText = (text: string): Event => ({
  kind: 'user_text',
  ts: '2026-04-08T14:23:11.000Z',
  uuid: `u-${text.slice(0, 4)}`,
  text,
});

const asstText = (text: string): Event => ({
  kind: 'assistant_text',
  ts: '2026-04-08T14:23:12.000Z',
  uuid: `a-${text.slice(0, 4)}`,
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
    const stitchables = [
      {
        file: '/x/agent-abc.jsonl',
        slug: 'test-slug',
        firstUserPrefix: 'Search Hassan',
        events: [userText('Search Hassan for X'), asstText('subagent result')],
      },
    ];
    const dispatchMap = new Map([['toolu_1', 'Search Hassan for X — full prompt with details']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap);
    expect(r.unmatchedSubagents).toEqual([]);
    expect(r.events).toHaveLength(3);
    expect(r.events[0]!.kind).toBe('user_text');
    expect(r.events[1]!.kind).toBe('subagent');
    if (r.events[1]!.kind === 'subagent') {
      expect(r.events[1]!.subagentSlug).toBe('agent-abc');
      expect(r.events[1]!.events).toHaveLength(2);
      expect(r.events[1]!.parentToolUseId).toBe('agent-call-uuid-1');
    }
    expect(r.events[2]!.kind).toBe('assistant_text');
  });

  it('emits an empty subagent envelope when the subagent has zero filtered events (empty-envelope rule)', () => {
    const parentEvents: Event[] = [
      toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1'),
    ];
    const stitchables = [
      {
        file: '/x/agent-empty.jsonl',
        slug: 'slug',
        firstUserPrefix: 'kick off',
        events: [],
      },
    ];
    // Empty firstUserPrefix would skip matching; we set it to non-empty even
    // though events is empty. To exercise the empty-envelope path we need a
    // matching dispatch but empty subagent events.
    const dispatchMap = new Map([['toolu_1', 'kick off the subagent']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.kind).toBe('subagent');
    if (r.events[0]!.kind === 'subagent') {
      expect(r.events[0]!.events).toEqual([]);
    }
  });
});

describe('doStitch — no-match scenarios', () => {
  it('leaves the Agent tool_call untouched when no stitchable prompt prefix matches any dispatch', () => {
    const parentEvents: Event[] = [
      toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1'),
    ];
    const stitchables = [
      {
        file: '/x/agent-unrelated.jsonl',
        slug: 'slug',
        firstUserPrefix: 'completely different prefix',
        events: [userText('sub')],
      },
    ];
    const dispatchMap = new Map([['toolu_1', 'some other prompt']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.kind).toBe('tool_call');
    expect(r.unmatchedSubagents).toEqual(['/x/agent-unrelated.jsonl']);
  });

  it('leaves the Agent tool_call untouched when the dispatch map is empty', () => {
    const parentEvents: Event[] = [toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1')];
    const stitchables = [
      { file: '/x/agent-1.jsonl', slug: 's', firstUserPrefix: 'kick', events: [] },
    ];
    const dispatchMap = new Map<string, string>();
    const r = doStitch(parentEvents, stitchables, dispatchMap);
    expect(r.events[0]!.kind).toBe('tool_call');
    expect(r.unmatchedSubagents).toEqual(['/x/agent-1.jsonl']);
  });

  it('does NOT stitch over non-Agent tool_call events even if their summary prefix matches', () => {
    const parentEvents: Event[] = [toolCall('Bash', 'bash-call-uuid')];
    const stitchables = [
      { file: '/x/agent-1.jsonl', slug: 's', firstUserPrefix: 'ls', events: [userText('ls -la')] },
    ];
    const dispatchMap = new Map([['toolu_bash', 'ls -la /tmp']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap);
    expect(r.events[0]!.kind).toBe('tool_call');
    expect((r.events[0]! as { tool: string }).tool).toBe('Bash');
    expect(r.unmatchedSubagents).toEqual(['/x/agent-1.jsonl']);
  });

  it('skips stitchables with empty firstUserPrefix (cannot match anything)', () => {
    const parentEvents: Event[] = [toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1')];
    const stitchables = [
      { file: '/x/agent-empty-prefix.jsonl', slug: 's', firstUserPrefix: '', events: [] },
    ];
    const dispatchMap = new Map([['toolu_1', 'anything']]);
    const r = doStitch(parentEvents, stitchables, dispatchMap);
    expect(r.events[0]!.kind).toBe('tool_call');
    expect(r.unmatchedSubagents).toEqual(['/x/agent-empty-prefix.jsonl']);
  });
});

describe('doStitch — multiple subagents in one parent', () => {
  it('matches each subagent to one Agent tool_call, using each stitchable at most once', () => {
    const parentEvents: Event[] = [
      toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-1'),
      asstText('between'),
      toolCall(AGENT_TOOL_NAME, 'agent-call-uuid-2'),
    ];
    const stitchables = [
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
    const dispatchMap = new Map([
      ['toolu_1', 'first-task: do something'],
      ['toolu_2', 'second-task: do something else'],
    ]);
    const r = doStitch(parentEvents, stitchables, dispatchMap);
    expect(r.events).toHaveLength(3);
    expect(r.events[0]!.kind).toBe('subagent');
    expect(r.events[2]!.kind).toBe('subagent');
    if (r.events[0]!.kind === 'subagent' && r.events[2]!.kind === 'subagent') {
      expect(r.events[0]!.subagentSlug).toBe('agent-1');
      expect(r.events[2]!.subagentSlug).toBe('agent-2');
    }
    expect(r.unmatchedSubagents).toEqual([]);
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
