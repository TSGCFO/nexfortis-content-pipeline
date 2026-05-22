import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  computeContinuationGroupId,
  firstUserText,
  SCAFFOLD_PREFIX,
  stripContinuationScaffold,
} from '../../tools/nfx-cowork-export/src/continuation.js';
import type { Event } from '../../tools/nfx-cowork-export/src/schema.js';

const userText = (text: string): Event => ({
  kind: 'user_text',
  ts: '2026-04-08T14:23:11.000Z',
  uuid: `u-${Math.random().toString(36).slice(2)}`,
  text,
});

const asstText = (text: string): Event => ({
  kind: 'assistant_text',
  ts: '2026-04-08T14:23:12.000Z',
  uuid: `a-${Math.random().toString(36).slice(2)}`,
  text,
});

const toolCall = (tool: string): Event => ({
  kind: 'tool_call',
  ts: '2026-04-08T14:23:13.000Z',
  uuid: `t-${Math.random().toString(36).slice(2)}`,
  tool,
});

describe('stripContinuationScaffold', () => {
  it('removes the first user_text when it begins with the canonical scaffold prefix', () => {
    const events = [
      userText(SCAFFOLD_PREFIX + ' The summary below covers the earlier portion of the conversation.'),
      asstText('reply'),
    ];
    const r = stripContinuationScaffold(events);
    expect(r.stripped).toBe(true);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.kind).toBe('assistant_text');
  });

  it('leaves events unchanged when first event is not the scaffold', () => {
    const events = [userText('Hello, real question.'), asstText('reply')];
    const r = stripContinuationScaffold(events);
    expect(r.stripped).toBe(false);
    expect(r.events).toHaveLength(2);
  });

  it('leaves events unchanged when first event is not a user_text', () => {
    const events = [toolCall('Bash'), userText(SCAFFOLD_PREFIX)];
    const r = stripContinuationScaffold(events);
    expect(r.stripped).toBe(false);
    expect(r.events).toHaveLength(2);
  });

  it('handles an empty event list cleanly', () => {
    const r = stripContinuationScaffold([]);
    expect(r.stripped).toBe(false);
    expect(r.events).toEqual([]);
  });

  it('is case-sensitive on the scaffold prefix (matches the canonical wording exactly)', () => {
    const events = [userText('this session is being continued from a previous conversation that ran out of context. blah')];
    const r = stripContinuationScaffold(events);
    expect(r.stripped).toBe(false);
  });

  it('only strips one scaffold event, not subsequent ones', () => {
    const events = [
      userText(SCAFFOLD_PREFIX + ' summary 1'),
      userText(SCAFFOLD_PREFIX + ' summary 2'),
    ];
    const r = stripContinuationScaffold(events);
    expect(r.stripped).toBe(true);
    expect(r.events).toHaveLength(1);
    expect((r.events[0]! as { text: string }).text).toContain('summary 2');
  });
});

describe('computeContinuationGroupId', () => {
  const sha = (s: string): string => 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex');

  it('produces a stable hex hash of the v1-prefixed input', () => {
    const id = computeContinuationGroupId('my-slug', 'my first user message');
    expect(id).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(id).toBe(sha('v1|my-slug|my first user message'));
  });

  it('is deterministic — same input produces same output', () => {
    const a = computeContinuationGroupId('s', 'msg');
    const b = computeContinuationGroupId('s', 'msg');
    expect(a).toBe(b);
  });

  it('trims and slices the user message to 200 chars before hashing', () => {
    const long = '   ' + 'x'.repeat(300) + '   ';
    const id = computeContinuationGroupId('s', long);
    // Expected: trim, then take first 200 chars
    expect(id).toBe(sha('v1|s|' + 'x'.repeat(200)));
  });

  it('differs when slug differs', () => {
    expect(computeContinuationGroupId('a', 'm')).not.toBe(computeContinuationGroupId('b', 'm'));
  });

  it('differs when first user message differs', () => {
    expect(computeContinuationGroupId('s', 'one')).not.toBe(computeContinuationGroupId('s', 'two'));
  });

  it('v1 prefix is present (so future formula changes don\'t collide)', () => {
    const id = computeContinuationGroupId('s', 'm');
    expect(id).toBe(sha('v1|s|m'));
  });
});

describe('firstUserText', () => {
  it('returns the text of the first user_text event in order', () => {
    const events = [toolCall('Bash'), userText('user-1'), asstText('reply'), userText('user-2')];
    expect(firstUserText(events)).toBe('user-1');
  });

  it('returns empty string when no user_text events exist', () => {
    expect(firstUserText([toolCall('Bash'), asstText('reply')])).toBe('');
  });

  it('returns empty string for an empty list', () => {
    expect(firstUserText([])).toBe('');
  });
});
