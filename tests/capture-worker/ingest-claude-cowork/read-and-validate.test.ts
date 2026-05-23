import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FileReadError,
  SchemaValidationError,
  SchemaVersionMismatchError,
} from '../../../artifacts/capture-worker/src/jobs/ingest-claude-cowork/errors.js';
import { readAndValidate } from '../../../artifacts/capture-worker/src/jobs/ingest-claude-cowork/read-and-validate.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-ingest-rav-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function writeJson(name: string, body: unknown): Promise<string> {
  const full = path.join(tmpDir, name);
  await fs.writeFile(full, JSON.stringify(body), 'utf-8');
  return full;
}

async function writeRaw(name: string, body: string): Promise<string> {
  const full = path.join(tmpDir, name);
  await fs.writeFile(full, body, 'utf-8');
  return full;
}

function freshSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    _exporter: {
      name: 'nfx-cowork-export',
      version: '0.0.6',
      sourceFormat: 'cowork-jsonl-v1',
      exportedAt: '2026-05-22T13:45:00.000Z',
    },
    source: 'claude_cowork',
    sessionId: 'synthetic-session-rav-001',
    createdAt: '2026-04-08T14:23:11.000Z',
    events: [
      {
        kind: 'user_text',
        ts: '2026-04-08T14:23:11.000Z',
        uuid: 'evt-001',
        text: 'Hello synthetic world.',
      },
    ],
    ...overrides,
  };
}

describe('readAndValidate', () => {
  it('parses and validates a well-formed v1 session', async () => {
    const filePath = await writeJson('ok.json', freshSession());
    const doc = await readAndValidate(filePath);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.source).toBe('claude_cowork');
    expect(doc.sessionId).toBe('synthetic-session-rav-001');
    expect(doc.events).toHaveLength(1);
  });

  it('throws SchemaVersionMismatchError for schemaVersion: 99', async () => {
    const filePath = await writeJson('v99.json', freshSession({ schemaVersion: 99 }));
    let caught: unknown = null;
    try {
      await readAndValidate(filePath);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SchemaVersionMismatchError);
    if (caught instanceof SchemaVersionMismatchError) {
      expect(caught.actualVersion).toBe(99);
      expect(caught.expectedVersion).toBe(1);
      expect(caught.message).toContain('99');
      expect(caught.filePath).toBe(filePath);
    }
  });

  it('throws FileReadError wrapping a JSON parse failure with file path context', async () => {
    const filePath = await writeRaw('bad.json', '{not-valid-json');
    let caught: unknown = null;
    try {
      await readAndValidate(filePath);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(FileReadError);
    if (caught instanceof FileReadError) {
      expect(caught.message).toContain(filePath);
      expect(caught.message).toContain('JSON parse failed');
    }
  });

  it('throws FileReadError when the file does not exist', async () => {
    const filePath = path.join(tmpDir, 'missing.json');
    await expect(readAndValidate(filePath)).rejects.toBeInstanceOf(FileReadError);
  });

  it('throws SchemaValidationError listing the missing sessionId path', async () => {
    const doc = freshSession();
    delete doc['sessionId'];
    const filePath = await writeJson('no-session-id.json', doc);
    let caught: unknown = null;
    try {
      await readAndValidate(filePath);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SchemaValidationError);
    if (caught instanceof SchemaValidationError) {
      expect(caught.filePath).toBe(filePath);
      expect(caught.issues.length).toBeGreaterThan(0);
      const paths = caught.issues.map((i) => i.path);
      expect(paths).toContain('sessionId');
    }
  });

  it('validates a session with events: [] (zero-event sessions are schema-legal)', async () => {
    const filePath = await writeJson('empty-events.json', freshSession({ events: [] }));
    const doc = await readAndValidate(filePath);
    expect(doc.events).toEqual([]);
  });
});
