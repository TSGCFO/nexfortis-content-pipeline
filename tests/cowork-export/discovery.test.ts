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

import {
  classifyTranscriptPath,
  toPosixPath,
} from '../../tools/nfx-cowork-export/src/discovery.js';

describe('toPosixPath', () => {
  it('replaces backslashes with forward slashes', () => {
    expect(toPosixPath('C:\\Users\\Hassan\\foo')).toBe('C:/Users/Hassan/foo');
  });

  it('leaves forward-slash paths untouched', () => {
    expect(toPosixPath('/sessions/foo/bar')).toBe('/sessions/foo/bar');
  });

  it('handles mixed separators', () => {
    expect(toPosixPath('C:\\Users/Hassan\\foo')).toBe('C:/Users/Hassan/foo');
  });
});

describe('classifyTranscriptPath — POSIX-style paths', () => {
  it('classifies a parent transcript', () => {
    const result = classifyTranscriptPath(
      '/tmp/local_abc/.claude/projects/-sessions-my-slug/uuid-1.jsonl'
    );
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('my-slug');
    expect(result!.isSubagent).toBe(false);
    expect(result!.isAcompact).toBe(false);
  });

  it('classifies a subagent transcript', () => {
    const result = classifyTranscriptPath(
      '/tmp/local_abc/.claude/projects/-sessions-my-slug/uuid-1/subagents/agent-xyz.jsonl'
    );
    expect(result).not.toBeNull();
    expect(result!.isSubagent).toBe(true);
    expect(result!.isAcompact).toBe(false);
  });

  it('classifies an acompact file by filename', () => {
    const result = classifyTranscriptPath(
      '/tmp/local_abc/.claude/projects/-sessions-my-slug/agent-acompact-xyz.jsonl'
    );
    expect(result).not.toBeNull();
    expect(result!.isAcompact).toBe(true);
  });

  it('returns null for audit.jsonl', () => {
    expect(classifyTranscriptPath('/tmp/local_abc/audit.jsonl')).toBeNull();
  });

  it('returns null for a .jsonl outside any projects/ directory', () => {
    expect(classifyTranscriptPath('/tmp/local_abc/some-other.jsonl')).toBeNull();
  });
});

describe('classifyTranscriptPath — WINDOWS-style paths (regression test)', () => {
  // This is the regression that slipped through slice 2's initial review:
  // `filePath.includes('/projects/')` returns false on Windows because
  // path.sep === '\\'. Below the entire path uses backslashes — if the
  // classifier still works, the bug is fixed.

  it('classifies a parent transcript with backslash separators', () => {
    const result = classifyTranscriptPath(
      'C:\\Users\\HassanSadiq\\AppData\\Roaming\\Claude\\local-agent-mode-sessions\\ws\\sp\\local_abc\\.claude\\projects\\-sessions-my-slug\\uuid-1.jsonl'
    );
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('my-slug');
    expect(result!.isSubagent).toBe(false);
    expect(result!.isAcompact).toBe(false);
  });

  it('classifies a subagent transcript with backslash separators', () => {
    const result = classifyTranscriptPath(
      'C:\\foo\\local_abc\\.claude\\projects\\-sessions-my-slug\\uuid-1\\subagents\\agent-xyz.jsonl'
    );
    expect(result).not.toBeNull();
    expect(result!.isSubagent).toBe(true);
  });

  it('classifies an acompact file with backslash separators', () => {
    const result = classifyTranscriptPath(
      'C:\\foo\\local_abc\\.claude\\projects\\-sessions-my-slug\\agent-acompact-xyz.jsonl'
    );
    expect(result).not.toBeNull();
    expect(result!.isAcompact).toBe(true);
  });

  it('handles mixed separators in a single path', () => {
    const result = classifyTranscriptPath(
      'C:\\foo/local_abc\\.claude/projects\\-sessions-mixed/uuid.jsonl'
    );
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('mixed');
  });

  it('returns null for audit.jsonl in a Windows path', () => {
    expect(
      classifyTranscriptPath('C:\\foo\\local_abc\\audit.jsonl')
    ).toBeNull();
  });
});

describe('extractSessionMeta — number-format timestamps + mcpServers (Bug 3 regression)', () => {
  // Cowork stores createdAt / lastActivityAt as NUMBERS (epoch ms), not as
  // ISO strings. The old extractor only assigned values when `typeof v === 'string'`,
  // so these were silently dropped from emitted JSONs. Bug 3a.
  //
  // Cowork stores MCP servers under `remoteMcpServersConfig` as an array of
  // { uuid, name, tools: [...] } objects. The old extractor didn't read this
  // field at all. Bug 3b.
  //
  // These tests reproduce both via a synthetic meta JSON and assert
  // discoverSessions surfaces the parsed meta correctly.

  it('extracts createdAt + lastActivityAt when source meta stores them as numbers (epoch ms)', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-numbers',
      meta: {
        sessionId: 'session-numbers',
        // Numbers, not strings — this is the real Cowork format
        createdAt: 1776112559346,
        lastActivityAt: 1776112580302,
      },
      transcripts: [{ slug: 'numeric-ts', uuid: 'u-numeric' }],
    });

    const found = await discoverSessions(root);
    const d = found.find((x) => x.sessionId === 'session-numbers')!;
    // After the fix, these come through as ISO strings (toISOString format)
    expect(d.meta?.createdAt).toBe('2026-04-13T20:35:59.346Z');
    expect(d.meta?.lastActivityAt).toBe('2026-04-13T20:36:20.302Z');
  });

  it('still accepts string-format timestamps (back-compat)', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-strings',
      meta: {
        sessionId: 'session-strings',
        createdAt: '2026-04-08T14:00:00.000Z',
        lastActivityAt: '2026-04-08T14:30:00.000Z',
      },
      transcripts: [{ slug: 'string-ts', uuid: 'u-strings' }],
    });

    const found = await discoverSessions(root);
    const d = found.find((x) => x.sessionId === 'session-strings')!;
    expect(d.meta?.createdAt).toBe('2026-04-08T14:00:00.000Z');
    expect(d.meta?.lastActivityAt).toBe('2026-04-08T14:30:00.000Z');
  });

  it('omits the field entirely when source has neither a string nor a finite number', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-bad-ts',
      meta: {
        sessionId: 'session-bad-ts',
        createdAt: null,
        lastActivityAt: 'not a valid timestamp',  // string but malformed — string assign still happens
      },
      transcripts: [{ slug: 'bad-ts', uuid: 'u-bad' }],
    });

    const found = await discoverSessions(root);
    const d = found.find((x) => x.sessionId === 'session-bad-ts')!;
    // null gets dropped (neither string nor number)
    expect(d.meta?.createdAt).toBeUndefined();
    // a malformed string still passes the string check — normalization happens later in emit
    expect(d.meta?.lastActivityAt).toBe('not a valid timestamp');
  });

  it('extracts mcpServers from remoteMcpServersConfig — just the names', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-mcp',
      meta: {
        sessionId: 'session-mcp',
        remoteMcpServersConfig: [
          { uuid: 'aaa', name: 'composio', tools: [{ name: 'X', description: '...', inputSchema: {} }] },
          { uuid: 'bbb', name: 'Gmail',    tools: [{ name: 'send_email', description: '...', inputSchema: {} }] },
          { uuid: 'ccc', name: 'Claude_in_Chrome', tools: [] },
        ],
      },
      transcripts: [{ slug: 'has-mcp', uuid: 'u-mcp' }],
    });

    const found = await discoverSessions(root);
    const d = found.find((x) => x.sessionId === 'session-mcp')!;
    expect(d.meta?.mcpServers).toEqual(['composio', 'Gmail', 'Claude_in_Chrome']);
  });

  it('omits mcpServers when remoteMcpServersConfig is absent', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-no-mcp',
      meta: { sessionId: 'session-no-mcp' },
      transcripts: [{ slug: 'no-mcp', uuid: 'u-no-mcp' }],
    });

    const found = await discoverSessions(root);
    const d = found.find((x) => x.sessionId === 'session-no-mcp')!;
    expect(d.meta?.mcpServers).toBeUndefined();
  });

  it('omits mcpServers when remoteMcpServersConfig is empty array', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-empty-mcp',
      meta: { sessionId: 'session-empty-mcp', remoteMcpServersConfig: [] },
      transcripts: [{ slug: 'empty-mcp', uuid: 'u-empty-mcp' }],
    });

    const found = await discoverSessions(root);
    const d = found.find((x) => x.sessionId === 'session-empty-mcp')!;
    expect(d.meta?.mcpServers).toBeUndefined();
  });

  it('skips malformed server entries (missing name, non-object, etc.)', async () => {
    await makeSession({
      workspaceId: 'ws-1',
      spaceId: 'sp-1',
      sessionId: 'session-bad-mcp',
      meta: {
        sessionId: 'session-bad-mcp',
        remoteMcpServersConfig: [
          { uuid: 'aaa', name: 'good' },
          { uuid: 'bbb' },           // missing name
          'not an object',            // garbage
          null,                       // null
          { uuid: 'ccc', name: '' },  // empty string name
          { uuid: 'ddd', name: 'good2' },
        ],
      },
      transcripts: [{ slug: 'malformed-mcp', uuid: 'u-malformed' }],
    });

    const found = await discoverSessions(root);
    const d = found.find((x) => x.sessionId === 'session-bad-mcp')!;
    expect(d.meta?.mcpServers).toEqual(['good', 'good2']);
  });
});
