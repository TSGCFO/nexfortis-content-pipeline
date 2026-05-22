import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { discoverSessions } from '../../tools/nfx-cowork-export/src/discovery.js';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nfx-discovery-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** Create a synthetic session folder with optional meta JSON + transcript. */
async function makeSession(opts: {
  workspaceId: string;
  spaceId: string;
  sessionId: string;
  meta?: Record<string, unknown>;
  transcripts?: { slug: string; uuid: string; isSubagent?: boolean; acompact?: boolean; lines?: string[] }[];
  hasAudit?: boolean;
}): Promise<string> {
  const sessionDir = path.join(
    root,
    opts.workspaceId,
    opts.spaceId,
    `local_${opts.sessionId}`
  );
  await fs.mkdir(sessionDir, { recursive: true });

  if (opts.meta) {
    await fs.writeFile(
      path.join(root, opts.workspaceId, opts.spaceId, `local_${opts.sessionId}.json`),
      JSON.stringify(opts.meta),
      'utf8'
    );
  }

  if (opts.hasAudit) {
    await fs.writeFile(path.join(sessionDir, 'audit.jsonl'), '{}\n', 'utf8');
  }

  for (const t of opts.transcripts ?? []) {
    const slugDir = path.join(sessionDir, '.claude', 'projects', `-sessions-${t.slug}`);
    await fs.mkdir(slugDir, { recursive: true });
    const filename = t.acompact ? `agent-acompact-${t.uuid}.jsonl` : `${t.uuid}.jsonl`;
    let filePath: string;
    if (t.isSubagent) {
      const subdir = path.join(slugDir, t.uuid, 'subagents');
      await fs.mkdir(subdir, { recursive: true });
      filePath = path.join(subdir, `agent-${t.uuid}.jsonl`);
    } else {
      filePath = path.join(slugDir, filename);
    }
    await fs.writeFile(filePath, (t.lines ?? []).join('\n'), 'utf8');
  }

  return sessionDir;
}

describe('discoverSessions — happy path', () => {
  it('finds a single session with meta and one transcript', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-a',
      meta: {
        sessionId: 'session-a',
        title: 'Test session',
        emailAddress: 'hassan@example.test',
        cwd: '/sessions/test-slug',
        initialMessage: 'hello',
      },
      transcripts: [{ slug: 'test-slug', uuid: 'abc-123' }],
    });

    const found = await discoverSessions(root);
    expect(found).toHaveLength(1);
    const d = found[0]!;
    expect(d.sessionId).toBe('session-a');
    expect(d.meta?.title).toBe('Test session');
    expect(d.meta?.emailAddress).toBe('hassan@example.test');
    expect(d.transcripts).toHaveLength(1);
    expect(d.transcripts[0]!.slug).toBe('test-slug');
    expect(d.transcripts[0]!.isSubagent).toBe(false);
    expect(d.transcripts[0]!.isAcompact).toBe(false);
  });

  it('classifies acompact subagent transcripts correctly', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-b',
      meta: { sessionId: 'session-b' },
      transcripts: [
        { slug: 'main-slug', uuid: 'parent-1' },
        { slug: 'main-slug', uuid: 'parent-2', acompact: true }, // ← acompact at same level
      ],
    });

    const found = await discoverSessions(root);
    const d = found[0]!;
    expect(d.transcripts).toHaveLength(2);
    const acompact = d.transcripts.find((t) => t.isAcompact);
    const parent = d.transcripts.find((t) => !t.isAcompact);
    expect(acompact).toBeDefined();
    expect(parent).toBeDefined();
  });

  it('classifies subagent transcripts as isSubagent: true', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-c',
      meta: { sessionId: 'session-c' },
      transcripts: [
        { slug: 'sub-slug', uuid: 'parent-1' },
        { slug: 'sub-slug', uuid: 'parent-1', isSubagent: true },
      ],
    });

    const found = await discoverSessions(root);
    const d = found[0]!;
    const sub = d.transcripts.find((t) => t.isSubagent);
    expect(sub).toBeDefined();
    expect(sub!.path).toContain('/subagents/');
  });

  it('finds multiple sessions across multiple workspaces and spaces', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-a',
      meta: { sessionId: 'session-a' },
      transcripts: [{ slug: 's1', uuid: 'u1' }],
    });
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-2',
      sessionId: 'session-b',
      meta: { sessionId: 'session-b' },
      transcripts: [{ slug: 's2', uuid: 'u2' }],
    });
    await makeSession({
      workspaceId: 'ws-2',
      spaceId: 'sp-1',
      sessionId: 'session-c',
      meta: { sessionId: 'session-c' },
      transcripts: [{ slug: 's3', uuid: 'u3' }],
    });

    const found = await discoverSessions(root);
    expect(found.map((d) => d.sessionId).sort()).toEqual([
      'session-a',
      'session-b',
      'session-c',
    ]);
  });
});

describe('discoverSessions — edge cases', () => {
  it('returns a session with meta: null if the meta JSON is missing', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-no-meta',
      // no meta provided — file not written
      transcripts: [{ slug: 'orphan', uuid: 'orph-1' }],
    });

    const found = await discoverSessions(root);
    expect(found).toHaveLength(1);
    expect(found[0]!.meta).toBeNull();
    expect(found[0]!.metaFile).toBeNull();
  });

  it('returns a session with meta: null if the meta JSON is malformed', async () => {
    const sessionDir = path.join(root, 'ws', 'sp', 'local_session-bad');
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(
      path.join(root, 'ws', 'sp', 'local_session-bad.json'),
      '{ not valid json',
      'utf8'
    );

    const found = await discoverSessions(root);
    expect(found).toHaveLength(1);
    expect(found[0]!.meta).toBeNull();
    expect(found[0]!.metaFile).not.toBeNull(); // file exists, just unparseable
  });

  it('excludes audit.jsonl from the transcripts list', async () => {
    await makeSession({
      workspaceId: 'ws',
      spaceId: 'sp',
      sessionId: 'session-x',
      meta: { sessionId: 'session-x' },
      hasAudit: true,
      transcripts: [{ slug: 'real-slug', uuid: 'real-uuid' }],
    });

    const found = await discoverSessions(root);
    const d = found[0]!;
    expect(d.transcripts).toHaveLength(1);
    expect(d.transcripts[0]!.path).not.toContain('audit.jsonl');
  });

  it('returns empty array when input root has no session folders', async () => {
    // Just create some random non-session folders
    await fs.mkdir(path.join(root, 'not-a-session', 'subdir'), { recursive: true });
    await fs.writeFile(path.join(root, 'not-a-session', 'random.txt'), 'x', 'utf8');

    const found = await discoverSessions(root);
    expect(found).toEqual([]);
  });

  it('returns empty array gracefully when input root does not exist', async () => {
    const found = await discoverSessions(path.join(root, 'does-not-exist'));
    expect(found).toEqual([]);
  });
});
