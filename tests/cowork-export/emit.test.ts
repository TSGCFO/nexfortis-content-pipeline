import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildSessionDocument, emitParsedSessions } from '../../tools/nfx-cowork-export/src/emit.js';
import type { ParsedSession, SessionDiscovery } from '../../tools/nfx-cowork-export/src/types.js';
import type { Event } from '../../tools/nfx-cowork-export/src/schema.js';

const baseTs = '2026-04-08T14:23:11.000Z';
const exportedAt = new Date('2026-05-22T18:00:00.000Z');

function userText(text: string, cwd?: string): Event {
  return {
    kind: 'user_text',
    ts: baseTs,
    uuid: `u-${Math.random().toString(36).slice(2)}`,
    text,
    ...(cwd !== undefined ? { cwd } : {}),
  };
}

function asstText(text: string): Event {
  return { kind: 'assistant_text', ts: baseTs, uuid: 'a-1', text };
}

function makeDiscovery(opts: { sessionId: string; slug: string; workspaceUuid?: string; meta?: Record<string, string> }): SessionDiscovery {
  const ws = opts.workspaceUuid ?? 'a169f9c6-6681-4506-b902-2240e9506824';
  const sessionFolder = `/x/${ws}/space-uuid/local_${opts.sessionId}`;
  return {
    sessionId: opts.sessionId,
    sessionFolder,
    metaFile: `/x/${ws}/space-uuid/local_${opts.sessionId}.json`,
    meta: opts.meta ?? null,
    transcripts: [
      {
        path: `${sessionFolder}/.claude/projects/-sessions-${opts.slug}/transcript-1.jsonl`,
        slug: opts.slug,
        isSubagent: false,
        isAcompact: false,
      },
    ],
  };
}

function makeSession(opts: { sessionId: string; slug: string; transcriptId?: string; events: Event[]; postCheckKeep?: boolean }): ParsedSession {
  return {
    discovery: makeDiscovery({
      sessionId: opts.sessionId,
      slug: opts.slug,
      meta: { title: 'Test session', emailAddress: 'hassan@example.test', model: 'claude-opus-4-6' },
    }),
    sessionDecision: { keep: true, reason: 'passed_session_level_filters' },
    transcripts: [
      {
        transcriptId: opts.transcriptId ?? opts.sessionId,
        sourceFile: '/x/source.jsonl',
        events: opts.events,
        scaffoldStripped: false,
        parseStats: { linesRead: 100, linesFailed: 0, abandoned: false },
      },
    ],
    postCheck: opts.postCheckKeep ?? true
      ? { keep: true, reason: 'passed_post_checks', stats: { eventCount: opts.events.length, totalTextChars: 1000, allowedTextChars: 1000, deniedTextChars: 0, noCwdTextChars: 0, cwdAllowedRatio: 1 } }
      : { keep: false, reason: 'tiny_session', stats: { eventCount: opts.events.length, totalTextChars: 50, allowedTextChars: 0, deniedTextChars: 0, noCwdTextChars: 0, cwdAllowedRatio: Number.NaN } },
  };
}

describe('buildSessionDocument', () => {
  it('constructs a valid SessionDocument with required + optional fields', () => {
    const session = makeSession({
      sessionId: 'session-abc',
      slug: 'test-slug',
      transcriptId: 'transcript-xyz',
      events: [userText('hi'), asstText('hello')],
    });
    const doc = buildSessionDocument(session, session.transcripts[0]!, exportedAt);

    expect(doc.schemaVersion).toBe(1);
    expect(doc.source).toBe('claude_cowork');
    expect(doc.sessionId).toBe('transcript-xyz');
    expect(doc.sessionSlug).toBe('test-slug');
    expect(doc.workspaceId).toBe('a169f9c6-6681-4506-b902-2240e9506824');
    expect(doc.title).toBe('Test session');
    expect(doc.account).toBe('hassan@example.test');
    expect(doc.model).toBe('claude-opus-4-6');
    expect(doc.events).toHaveLength(2);
    expect(doc._exporter.name).toBe('nfx-cowork-export');
    expect(doc._exporter.sourceFormat).toBe('cowork-jsonl-v1');
    expect(doc._exporter.exportedAt).toBe('2026-05-22T18:00:00.000Z');
  });

  it('uses the transcript continuationGroupId when set', () => {
    const session = makeSession({ sessionId: 's', slug: 'sl', events: [userText('hi')] });
    session.transcripts[0]!.continuationGroupId = 'sha256:abc';
    const doc = buildSessionDocument(session, session.transcripts[0]!, exportedAt);
    expect(doc.continuationGroupId).toBe('sha256:abc');
  });

  it('omits continuationGroupId when transcript has none', () => {
    const session = makeSession({ sessionId: 's', slug: 'sl', events: [userText('hi')] });
    const doc = buildSessionDocument(session, session.transcripts[0]!, exportedAt);
    expect(doc.continuationGroupId).toBeUndefined();
  });

  it('collects unique cwds and gitBranches across events (incl. subagent recursion)', () => {
    const sub: Event = {
      kind: 'subagent', ts: baseTs, uuid: 's-1', subagentSlug: 'agent-a', parentToolUseId: 'toolu_1',
      events: [userText('inside', '/sessions/inner')],
    };
    const session = makeSession({
      sessionId: 's', slug: 'sl',
      events: [userText('a', '/sessions/outer'), sub, userText('b', '/sessions/outer')],
    });
    const doc = buildSessionDocument(session, session.transcripts[0]!, exportedAt);
    expect(doc.cwds).toEqual(['/sessions/inner', '/sessions/outer']);
  });
});

describe('emitParsedSessions — writes files', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nfx-emit-')); });
  afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

  it('writes one JSON file per transcript of every kept session', async () => {
    const sessions = [
      makeSession({ sessionId: 's1', slug: 'sl1', transcriptId: 't1', events: [userText('hi'), asstText('hello')] }),
      makeSession({ sessionId: 's2', slug: 'sl2', transcriptId: 't2', events: [userText('q'), asstText('a')] }),
    ];
    const result = await emitParsedSessions(sessions, { outputDir: tmp, dryRun: false, exportedAt });
    expect(result.filesWritten).toBe(2);
    expect(result.outputs).toHaveLength(2);
    expect(result.validationFailures).toEqual([]);
    const files = await fs.readdir(tmp);
    expect(files.sort()).toEqual(['t1.json', 't2.json']);

    // Verify the written file is valid JSON matching the schema
    const file1 = await fs.readFile(path.join(tmp, 't1.json'), 'utf8');
    const parsed = JSON.parse(file1);
    expect(parsed.sessionId).toBe('t1');
    expect(parsed.schemaVersion).toBe(1);
  });

  it('writes zero files in dry-run mode (validation still runs)', async () => {
    const sessions = [
      makeSession({ sessionId: 's1', slug: 'sl1', transcriptId: 't1', events: [userText('hi'), asstText('hello')] }),
    ];
    const result = await emitParsedSessions(sessions, { outputDir: tmp, dryRun: true, exportedAt });
    expect(result.filesWritten).toBe(0);
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.dryRun).toBe(true);
    const files = await fs.readdir(tmp).catch(() => []);
    expect(files).toEqual([]);
  });

  it('skips sessions whose postCheck.keep === false (slice-3 review constraint)', async () => {
    const kept = makeSession({ sessionId: 's-kept', slug: 'sl', transcriptId: 't-kept', events: [userText('hi'), asstText('hello')] });
    const dropped = makeSession({ sessionId: 's-dropped', slug: 'sl2', transcriptId: 't-dropped', events: [userText('hi')], postCheckKeep: false });
    const result = await emitParsedSessions([kept, dropped], { outputDir: tmp, dryRun: false, exportedAt });
    expect(result.filesWritten).toBe(1);
    const files = await fs.readdir(tmp);
    expect(files).toEqual(['t-kept.json']);
  });

  it('idempotency: two runs against the same input produce byte-stable files (modulo exportedAt)', async () => {
    const sessions = [
      makeSession({ sessionId: 's1', slug: 'sl', transcriptId: 't1', events: [userText('hi'), asstText('hello')] }),
    ];
    await emitParsedSessions(sessions, { outputDir: tmp, dryRun: false, exportedAt });
    const first = await fs.readFile(path.join(tmp, 't1.json'), 'utf8');
    await emitParsedSessions(sessions, { outputDir: tmp, dryRun: false, exportedAt });
    const second = await fs.readFile(path.join(tmp, 't1.json'), 'utf8');
    expect(first).toBe(second); // same exportedAt → exact same bytes
  });
});

describe('emitParsedSessions — validation gate', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nfx-emit-')); });
  afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

  it('does NOT write a file when the document fails schema validation', async () => {
    // Force a validation failure by passing an event with an empty `text`
    // (the schema requires text to be non-empty).
    const broken = makeSession({ sessionId: 's', slug: 'sl', transcriptId: 't', events: [{ kind: 'user_text', ts: baseTs, uuid: 'u-1', text: '' } as Event] });
    const result = await emitParsedSessions([broken], { outputDir: tmp, dryRun: false, exportedAt });
    expect(result.filesWritten).toBe(0);
    expect(result.validationFailures).toHaveLength(1);
    expect(result.validationFailures[0]!.transcriptId).toBe('t');
    const files = await fs.readdir(tmp).catch(() => []);
    expect(files).toEqual([]);
  });
});
