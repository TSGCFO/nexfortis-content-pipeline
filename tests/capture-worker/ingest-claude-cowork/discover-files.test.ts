import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { discoverFiles } from '../../../artifacts/capture-worker/src/jobs/ingest-claude-cowork/discover-files.js';
import { InputDirNotConfiguredError } from '../../../artifacts/capture-worker/src/jobs/ingest-claude-cowork/errors.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-ingest-discover-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function touch(name: string, mtime: Date, body = '{}'): Promise<string> {
  const full = path.join(tmpDir, name);
  await fs.writeFile(full, body, 'utf-8');
  await fs.utimes(full, mtime, mtime);
  return full;
}

describe('discoverFiles', () => {
  it('returns [] for an empty directory', async () => {
    const result = await discoverFiles(tmpDir, new Date(0));
    expect(result).toEqual([]);
  });

  it('throws InputDirNotConfiguredError when the directory does not exist', async () => {
    const missing = path.join(tmpDir, 'no-such-subdir');
    await expect(discoverFiles(missing, new Date(0))).rejects.toBeInstanceOf(
      InputDirNotConfiguredError,
    );
  });

  it('returns only *.json files and ignores _audit-*.txt, hidden, and other extensions', async () => {
    const since = new Date('2026-01-01T00:00:00.000Z');
    const future = new Date('2026-05-01T00:00:00.000Z');

    const keepA = await touch('session-aaa.json', future);
    const keepB = await touch('Mixed.JSON', future); // case-insensitive
    await touch('_audit-2026-05-22T00-00-00Z.txt', future);
    await touch('notes.md', future);
    await touch('readme.txt', future);
    await touch('.hidden.json', future);

    // also create a subdirectory — should not be returned
    await fs.mkdir(path.join(tmpDir, 'subdir'), { recursive: true });

    const result = await discoverFiles(tmpDir, since);
    const paths = result.map((r) => r.path).sort();
    expect(paths).toEqual([keepA, keepB].sort());
  });

  it('filters out files with mtime strictly older than the checkpoint', async () => {
    const since = new Date('2026-05-10T00:00:00.000Z');
    const older = new Date(since.getTime() - 1);
    await touch('old.json', older);

    const result = await discoverFiles(tmpDir, since);
    expect(result).toEqual([]);
  });

  it('includes files whose mtime equals the checkpoint (inclusive boundary)', async () => {
    const since = new Date('2026-05-10T00:00:00.000Z');
    const exact = await touch('exact.json', since);

    const result = await discoverFiles(tmpDir, since);
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe(exact);
    expect(result[0]?.mtime.getTime()).toBe(since.getTime());
  });

  it('returns files sorted ascending by mtime then by path', async () => {
    const since = new Date('2026-01-01T00:00:00.000Z');
    const tA = new Date('2026-05-01T12:00:00.000Z');
    const tB = new Date('2026-05-02T12:00:00.000Z');
    const tC = new Date('2026-05-02T12:00:00.000Z'); // ties with tB

    const fileC = await touch('c-session.json', tC);
    const fileA = await touch('a-session.json', tA);
    const fileB = await touch('b-session.json', tB);

    const result = await discoverFiles(tmpDir, since);
    const paths = result.map((r) => r.path);
    // Expected: fileA (earliest), then fileB/fileC in path-asc order for tie.
    expect(paths).toEqual([fileA, fileB, fileC]);
  });
});
