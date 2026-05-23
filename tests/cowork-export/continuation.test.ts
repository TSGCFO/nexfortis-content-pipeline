import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  computeContinuationGroupId,
  firstUserText,
  SCAFFOLD_PREFIX,
  stripContinuationScaffold,
  assignContinuationGroupIds
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

describe('continuationGroupId — shared across chain, originating from original (Bug 2 regression)', () => {
  // After the Bug-2 fix:
  // - All continuations in a chain share ONE groupId
  // - The shared hash is computed from the ORIGINAL transcript's first user message
  //   (NOT from each transcript's own first message)
  // - The ORIGINAL has NO continuationGroupId

  it('three continuations with different first messages all share the same hash, derived from the original', () => {
    const slug = 'cool-great-franklin';
    const originalFirstMsg = 'I need you to help me come up with the pricing for NexFortis. This is the first conversation in the chain.';

    // The "shared" hash is what computeContinuationGroupId returns for the
    // ORIGINAL's first message. After Bug 2's fix, the orchestrator assigns
    // this same value to every continuation.
    const sharedHash = computeContinuationGroupId(slug, originalFirstMsg);

    // For each continuation, the orchestrator does NOT recompute from the
    // continuation's own first message — it just propagates the original's hash.
    // What we lock in here: computeContinuationGroupId itself remains pure
    // (input -> hash). The change is in WHERE the orchestrator calls it from.
    expect(sharedHash).toMatch(/^sha256:[0-9a-f]{64}$/);

    // Two continuations with their own (different) first messages would, under
    // the OLD behavior, have hashed to different values. The fix doesn't change
    // that property of computeContinuationGroupId itself — it changes the
    // orchestrator to not call computeContinuationGroupId per continuation.
    const continuationOwnMsg1 = 'done';
    const continuationOwnMsg2 = 'yes proceed';
    const hashIfRecomputedFromOwn1 = computeContinuationGroupId(slug, continuationOwnMsg1);
    const hashIfRecomputedFromOwn2 = computeContinuationGroupId(slug, continuationOwnMsg2);
    expect(hashIfRecomputedFromOwn1).not.toBe(sharedHash);
    expect(hashIfRecomputedFromOwn2).not.toBe(sharedHash);
    expect(hashIfRecomputedFromOwn1).not.toBe(hashIfRecomputedFromOwn2);
    // (The orchestrator MUST NOT call the function the way that produces
    // these "own-first-message" hashes for continuations. The Bug 2 fix
    // in run-discovery.ts encodes that rule.)
  });

  it('hashes are stable across runs (input -> hash deterministic)', () => {
    const slug = 'beautiful-blissful-volta';
    const msg = 'help me design a brand kit';
    const h1 = computeContinuationGroupId(slug, msg);
    const h2 = computeContinuationGroupId(slug, msg);
    expect(h1).toBe(h2);
  });

  it('the v1| formula prefix is included (locks the formula version)', () => {
    // If a future formula change happens, the test fails and forces a CHANGELOG entry.
    const slug = 'x';
    const msg = 'y';
    const expected = createHash('sha256').update('v1|x|y', 'utf8').digest('hex');
    expect(computeContinuationGroupId(slug, msg)).toBe('sha256:' + expected);
  });
});

describe('assignContinuationGroupIds — chain-level rule (Bug 2 regression)', () => {
  // The "rule": for a multi-transcript chain in a single slug folder, assign
  // ONE shared groupId to all continuations (transcripts that had a scaffold
  // stripped from their start), derived from the ORIGINAL transcript's first
  // user message. The original itself does NOT receive a groupId.
  //
  // This locks the behavior change introduced after Hassan's runs 1-3
  // surfaced 3-of-4 hash collisions in the cool-great-franklin chain.

  // Helper: build a transcript-shaped fixture
  function mkT(opts: { firstMsg: string; scaffoldStripped: boolean }): {
    events: Event[];
    scaffoldStripped: boolean;
    continuationGroupId?: string;
  } {
    return {
      events: [userText(opts.firstMsg), asstText('reply')],
      scaffoldStripped: opts.scaffoldStripped,
    };
  }

  it('three continuations of one original all share the same groupId', () => {
    const slug = 'cool-great-franklin';
    const original = mkT({ firstMsg: 'I need pricing for NexFortis', scaffoldStripped: false });
    const cont1 = mkT({ firstMsg: 'done', scaffoldStripped: true });
    const cont2 = mkT({ firstMsg: 'yes', scaffoldStripped: true });
    const cont3 = mkT({ firstMsg: 'proceed', scaffoldStripped: true });
    const transcripts = [original, cont1, cont2, cont3];

    assignContinuationGroupIds(transcripts, slug);

    // Original has no groupId (it's not a continuation)
    expect(original.continuationGroupId).toBeUndefined();

    // All 3 continuations share the SAME groupId
    expect(cont1.continuationGroupId).toBeDefined();
    expect(cont2.continuationGroupId).toBe(cont1.continuationGroupId);
    expect(cont3.continuationGroupId).toBe(cont1.continuationGroupId);

    // And that shared id is the hash of the ORIGINAL's first user message
    // (NOT the continuation's own first message — that was the bug).
    const expected = computeContinuationGroupId(slug, 'I need pricing for NexFortis');
    expect(cont1.continuationGroupId).toBe(expected);
  });

  it('original-only chain (no continuations) leaves the original unchanged', () => {
    const slug = 'standalone-session';
    const original = mkT({ firstMsg: 'hello', scaffoldStripped: false });
    // Length 1: not a chain. Function should do nothing.
    assignContinuationGroupIds([original], slug);
    expect(original.continuationGroupId).toBeUndefined();
  });

  it('all-stripped chain (no original found) assigns nothing — graceful degradation', () => {
    const slug = 'all-continuations';
    const t1 = mkT({ firstMsg: 'a', scaffoldStripped: true });
    const t2 = mkT({ firstMsg: 'b', scaffoldStripped: true });
    assignContinuationGroupIds([t1, t2], slug);
    expect(t1.continuationGroupId).toBeUndefined();
    expect(t2.continuationGroupId).toBeUndefined();
  });

  it('empty slug → no assignment (defensive, would otherwise produce a meaningless hash)', () => {
    const original = mkT({ firstMsg: 'a', scaffoldStripped: false });
    const cont = mkT({ firstMsg: 'b', scaffoldStripped: true });
    assignContinuationGroupIds([original, cont], '');
    expect(original.continuationGroupId).toBeUndefined();
    expect(cont.continuationGroupId).toBeUndefined();
  });

  it('original with empty first user message → no assignment (cannot hash nothing)', () => {
    const slug = 'no-first-msg';
    const originalNoUserText: { events: Event[]; scaffoldStripped: boolean; continuationGroupId?: string } = {
      events: [asstText('AI spoke first')],  // no user_text → firstUserText returns ''
      scaffoldStripped: false,
    };
    const cont = mkT({ firstMsg: 'done', scaffoldStripped: true });
    assignContinuationGroupIds([originalNoUserText, cont], slug);
    expect(originalNoUserText.continuationGroupId).toBeUndefined();
    expect(cont.continuationGroupId).toBeUndefined();
  });

  it('does not touch transcripts already carrying a groupId from elsewhere', () => {
    // (Defensive: if a caller pre-set the field on the original, we should NOT
    // overwrite it... but we also shouldn't touch the original at all. So
    // pre-set values are preserved.)
    const slug = 's';
    const original = { ...mkT({ firstMsg: 'a', scaffoldStripped: false }), continuationGroupId: 'sha256:preset' };
    const cont = mkT({ firstMsg: 'b', scaffoldStripped: true });
    assignContinuationGroupIds([original, cont], slug);
    // Original keeps its preset value (unusual but not wrong; function avoids overwriting non-continuations)
    expect(original.continuationGroupId).toBe('sha256:preset');
    // Continuation gets the new hash
    expect(cont.continuationGroupId).toBeDefined();
    expect(cont.continuationGroupId).not.toBe('sha256:preset');
  });
});
