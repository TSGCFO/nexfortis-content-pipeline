import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  classifyAndConvert,
  parseTranscript,
} from '../../tools/nfx-cowork-export/src/parser.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nfx-parser-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writeJsonl(name: string, objs: unknown[]): Promise<string> {
  const p = path.join(tmp, name);
  await fs.writeFile(p, objs.map((o) => JSON.stringify(o)).join('\n'), 'utf8');
  return p;
}

const baseLine = (overrides: Record<string, unknown> = {}) => ({
  timestamp: '2026-04-08T14:23:11.000Z',
  uuid: 'evt-001',
  cwd: '/sessions/test-slug',
  gitBranch: 'HEAD',
  ...overrides,
});

describe('classifyAndConvert — type-based drops', () => {
  it('drops queue-operation events', () => {
    expect(classifyAndConvert(baseLine({ type: 'queue-operation' }))).toEqual([]);
  });

  it('drops last-prompt events', () => {
    expect(classifyAndConvert(baseLine({ type: 'last-prompt' }))).toEqual([]);
  });

  it('drops ai-title events', () => {
    expect(classifyAndConvert(baseLine({ type: 'ai-title' }))).toEqual([]);
  });

  it('drops attachment events', () => {
    expect(classifyAndConvert(baseLine({ type: 'attachment' }))).toEqual([]);
  });

  it('drops system events (every subtype, including compact_boundary and local_command)', () => {
    expect(classifyAndConvert(baseLine({ type: 'system', subtype: 'compact_boundary' }))).toEqual([]);
    expect(classifyAndConvert(baseLine({ type: 'system', subtype: 'local_command' }))).toEqual([]);
    expect(classifyAndConvert(baseLine({ type: 'system', subtype: 'anything' }))).toEqual([]);
  });

  it('drops progress events', () => {
    expect(classifyAndConvert(baseLine({ type: 'progress', data: { type: 'hook_progress' } }))).toEqual([]);
  });

  it('drops unknown top-level types defensively', () => {
    expect(classifyAndConvert(baseLine({ type: 'something-new' }))).toEqual([]);
  });

  it('drops non-object inputs', () => {
    expect(classifyAndConvert(null)).toEqual([]);
    expect(classifyAndConvert('string')).toEqual([]);
    expect(classifyAndConvert(42)).toEqual([]);
  });
});

describe('classifyAndConvert — user events', () => {
  it('keeps a user event with string content as user_text', () => {
    const out = classifyAndConvert(baseLine({ type: 'user', message: { role: 'user', content: 'hello world' } }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'user_text', text: 'hello world', uuid: 'evt-001', cwd: '/sessions/test-slug' });
  });

  it('drops a user event with isMeta: true', () => {
    const out = classifyAndConvert(
      baseLine({ type: 'user', isMeta: true, message: { role: 'user', content: 'system-injected' } })
    );
    expect(out).toEqual([]);
  });

  it('drops a user event whose list content contains tool_result blocks', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: 'output' }],
        },
      })
    );
    expect(out).toEqual([]);
  });

  it('keeps a user event whose list content has a text block', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: 'typed via list' }] },
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'user_text', text: 'typed via list' });
  });

  it('drops user events with empty string content', () => {
    expect(
      classifyAndConvert(baseLine({ type: 'user', message: { role: 'user', content: '' } }))
    ).toEqual([]);
  });

  it('drops user events missing timestamp or uuid', () => {
    expect(classifyAndConvert({ type: 'user', uuid: 'x', message: { content: 'hi' } })).toEqual([]);
    expect(classifyAndConvert({ type: 'user', timestamp: 't', message: { content: 'hi' } })).toEqual([]);
  });
});

describe('classifyAndConvert — assistant events', () => {
  it('keeps an assistant text block as assistant_text', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'reply' }] },
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'assistant_text', text: 'reply' });
  });

  it('drops assistant thinking blocks', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'inner reasoning' }] },
      })
    );
    expect(out).toEqual([]);
  });

  it('converts a tool_use block into a tool_call event', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls /tmp' } }],
        },
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'tool_call', tool: 'Bash', summary: 'ls /tmp' });
  });

  it('emits a tool_call WITHOUT summary for tools without a registered extractor', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'UnknownTool', input: { x: 1 } }],
        },
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('tool_call');
    if (out[0]!.kind === 'tool_call') {
      expect(out[0]!.tool).toBe('UnknownTool');
      expect((out[0]! as Record<string, unknown>)['summary']).toBeUndefined();
    }
  });

  it('emits multiple events from a single line with mixed blocks (text + tool_use + thinking)', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'inner' },
            { type: 'text', text: 'I will run a command.' },
            { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
          ],
        },
      })
    );
    expect(out).toHaveLength(2);
    expect(out[0]!.kind).toBe('assistant_text');
    expect(out[1]!.kind).toBe('tool_call');
  });

  it('synthesizes child uuids when one line produces multiple events', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'assistant',
        uuid: 'parent-uuid',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'first block' },
            { type: 'text', text: 'second block' },
          ],
        },
      })
    );
    expect(out).toHaveLength(2);
    expect(out[0]!.uuid).toBe('parent-uuid');
    expect(out[1]!.uuid).toBe('parent-uuid#1');
  });

  it('skips empty text blocks', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: '' }, { type: 'text', text: 'real content' }],
        },
      })
    );
    expect(out).toHaveLength(1);
    if (out[0]!.kind === 'assistant_text') {
      expect(out[0]!.text).toBe('real content');
    }
  });

  it('drops tool_use blocks with no name', () => {
    const out = classifyAndConvert(
      baseLine({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', input: {} }],
        },
      })
    );
    expect(out).toEqual([]);
  });
});

describe('parseTranscript — file streaming', () => {
  it('parses a simple file with mixed event types', async () => {
    const file = await writeJsonl('a.jsonl', [
      { type: 'queue-operation', operation: 'enqueue', timestamp: 't', uuid: 'u1' },
      baseLine({ type: 'user', uuid: 'u2', message: { role: 'user', content: 'hello' } }),
      baseLine({
        type: 'assistant',
        uuid: 'u3',
        message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
      }),
      { type: 'last-prompt', timestamp: 't', uuid: 'u4' },
    ]);

    const result = await parseTranscript(file);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({ kind: 'user_text', text: 'hello' });
    expect(result.events[1]).toMatchObject({ kind: 'assistant_text', text: 'hi' });
    expect(result.linesRead).toBe(4);
    expect(result.linesFailedToParse).toBe(0);
    expect(result.abandoned).toBe(false);
  });

  it('skips empty lines without counting them', async () => {
    const file = path.join(tmp, 'b.jsonl');
    await fs.writeFile(file, '\n\n' + JSON.stringify(baseLine({ type: 'user', message: { content: 'hi' } })) + '\n\n', 'utf8');
    const result = await parseTranscript(file);
    expect(result.linesRead).toBe(1);
    expect(result.events).toHaveLength(1);
  });

  it('tolerates a small number of unparseable lines (under 5%)', async () => {
    const goodLines = Array.from({ length: 30 }, (_, i) =>
      JSON.stringify(baseLine({ type: 'user', uuid: `u${i}`, message: { content: `hi-${i}` } }))
    );
    // 1 bad line out of 31 = 3.2% — under threshold
    const allLines = [...goodLines, 'NOT JSON {{{'];
    const file = path.join(tmp, 'c.jsonl');
    await fs.writeFile(file, allLines.join('\n'), 'utf8');

    const result = await parseTranscript(file);
    expect(result.abandoned).toBe(false);
    expect(result.events).toHaveLength(30);
    expect(result.linesFailedToParse).toBe(1);
  });

  it('abandons the file when >5% of lines fail to parse', async () => {
    const goodLines = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify(baseLine({ type: 'user', uuid: `u${i}`, message: { content: 'hi' } }))
    );
    const badLines = ['{{{', 'not json', '}}}']; // 3/13 = 23% — over threshold
    const allLines = [...goodLines, ...badLines];
    const file = path.join(tmp, 'd.jsonl');
    await fs.writeFile(file, allLines.join('\n'), 'utf8');

    const result = await parseTranscript(file);
    expect(result.abandoned).toBe(true);
    expect(result.events).toEqual([]);
    expect(result.linesFailedToParse).toBe(3);
  });

  it('returns empty result when file does not exist', async () => {
    const result = await parseTranscript(path.join(tmp, 'does-not-exist.jsonl'));
    expect(result.events).toEqual([]);
    expect(result.linesRead).toBe(0);
  });
});
