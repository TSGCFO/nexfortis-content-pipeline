import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processMessage } from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/process.js';
import type {
  GraphMessage,
} from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/types.js';

const FIXTURE_PATH = resolve(
  __dirname,
  '../../../docs/integration-contracts/fixtures/msgraph-message-sample.json',
);
interface FixtureEnvelope {
  '@odata.context': string;
  '@odata.nextLink'?: string;
  value: GraphMessage[];
}
const fixture: FixtureEnvelope = JSON.parse(
  readFileSync(FIXTURE_PATH, 'utf-8'),
) as FixtureEnvelope;

function freshMessage(): GraphMessage {
  // Clone the single fixture message so individual tests can mutate without
  // bleeding state into others.
  return JSON.parse(JSON.stringify(fixture.value[0])) as GraphMessage;
}

interface InsertChainSpy {
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
}

function makeInsertSpy(
  returningResults: Array<unknown[]>,
): InsertChainSpy {
  let callIndex = 0;
  const returning = vi.fn(() =>
    Promise.resolve(returningResults[callIndex++] ?? []),
  );
  const onConflictDoNothing = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values }));
  return { insert, values, onConflictDoNothing, returning };
}

function makeDeps(opts: {
  insertSpy: InsertChainSpy;
  redactImpl?: typeof import('@ncp/redaction').redact;
  chunkImpl?: typeof import('@ncp/embeddings').chunk;
  embedImpl?: typeof import('@ncp/embeddings').embed;
  loggerInfo?: ReturnType<typeof vi.fn>;
  loggerDebug?: ReturnType<typeof vi.fn>;
  loggerError?: ReturnType<typeof vi.fn>;
}): Parameters<typeof processMessage>[1] {
  const infoMock = opts.loggerInfo ?? vi.fn();
  const debugMock = opts.loggerDebug ?? vi.fn();
  const errorMock = opts.loggerError ?? vi.fn();
  return {
    db: { insert: opts.insertSpy.insert } as unknown as Parameters<
      typeof processMessage
    >[1]['db'],
    redactFn:
      opts.redactImpl ??
      (vi.fn(async () => ({
        status: 'redacted',
        redactedText: 'clean text body for testing',
        log: [],
      })) as unknown as typeof import('@ncp/redaction').redact),
    chunkFn:
      opts.chunkImpl ??
      (vi.fn(() => [
        {
          text: 'chunk 0',
          tokenCount: 2,
          startTokenOffset: 0,
          endTokenOffset: 2,
        },
      ]) as unknown as typeof import('@ncp/embeddings').chunk),
    embedFn:
      opts.embedImpl ??
      (vi.fn(async () => ({
        embeddings: [[0.1, 0.2, 0.3]],
        tokenCounts: [2],
        model: 'text-embedding-3-large',
        usage: { totalTokens: 2, promptTokens: 2 },
      })) as unknown as typeof import('@ncp/embeddings').embed),
    logger: { info: infoMock, debug: debugMock, error: errorMock },
    anthropicApiKey: 'test-anthropic',
    openaiApiKey: 'test-openai',
  };
}

describe('processMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the fixture message end-to-end and reports the chunk count', async () => {
    const insertSpy = makeInsertSpy([[{ id: 'row-id-1' }]]);
    const redactFn = vi.fn(async () => ({
      status: 'redacted' as const,
      redactedText: 'this is the redacted body',
      log: [],
    }));
    const deps = makeDeps({
      insertSpy,
      redactImpl: redactFn as unknown as typeof import('@ncp/redaction').redact,
    });
    const result = await processMessage(freshMessage(), deps);
    expect(result).toEqual({
      status: 'stored',
      signalsInserted: 1,
      signalsSkippedDuplicate: 0,
    });

    // Redaction inputs come from the contract-documented paths.
    expect(redactFn).toHaveBeenCalledTimes(1);
    const arg = redactFn.mock.calls[0]?.[0];
    expect(arg).toBeDefined();
    expect(arg?.source).toBe('msgraph-email');
    expect(arg?.senderEmail).toBe('sender@example.com');
    expect(arg?.recipientEmails).toEqual([
      'user@example.com',
      'recipient2@example.com',
    ]);
    expect(arg?.subject).toBe(fixture.value[0]?.subject);
    // The body passed to redact() must be the HTML-stripped plain text.
    expect(arg?.body).not.toContain('<');
    expect(arg?.body).not.toContain('>');
    expect(arg?.body).not.toContain('<p>');
    expect(arg?.body).not.toContain('<html>');
  });

  it('returns { status: "skipped_empty" } when the body is empty and inserts nothing', async () => {
    const insertSpy = makeInsertSpy([]);
    const msg = freshMessage();
    if (msg.body) msg.body.content = '';
    const result = await processMessage(msg, makeDeps({ insertSpy }));
    expect(result).toEqual({ status: 'skipped_empty' });
    expect(insertSpy.insert).not.toHaveBeenCalled();
  });

  it('returns { status: "skipped_draft" } when isDraft=true and inserts nothing', async () => {
    const insertSpy = makeInsertSpy([]);
    const msg = freshMessage();
    msg.isDraft = true;
    const result = await processMessage(msg, makeDeps({ insertSpy }));
    expect(result).toEqual({ status: 'skipped_draft' });
    expect(insertSpy.insert).not.toHaveBeenCalled();
  });

  it('drops blocked messages: returns blocked, no DB insert, logs only source/action/reason', async () => {
    const insertSpy = makeInsertSpy([]);
    const infoMock = vi.fn();
    const blockedRedact = vi.fn(async () => ({
      status: 'blocked' as const,
      reason: 'subject_keyword' as const,
      redactedText: '' as const,
      log: [],
    }));
    const deps = makeDeps({
      insertSpy,
      redactImpl:
        blockedRedact as unknown as typeof import('@ncp/redaction').redact,
      loggerInfo: infoMock,
    });
    const result = await processMessage(freshMessage(), deps);
    expect(result).toEqual({ status: 'blocked' });
    expect(insertSpy.insert).not.toHaveBeenCalled();
    expect(infoMock).toHaveBeenCalledTimes(1);
    const ctx = infoMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(ctx).toEqual({
      source: 'capture-worker',
      action: 'block_email',
      reason: 'subject_keyword',
    });
    // Defense in depth: assert the context object has no other keys.
    expect(Object.keys(ctx).sort()).toEqual(
      ['action', 'reason', 'source'].sort(),
    );
  });

  it('stores HTML-stripped text in the chunk (no raw HTML reaches redact)', async () => {
    const insertSpy = makeInsertSpy([[{ id: 'r' }]]);
    const redactFn = vi.fn(async () => ({
      status: 'redacted' as const,
      redactedText: 'plain text',
      log: [],
    }));
    const deps = makeDeps({
      insertSpy,
      redactImpl: redactFn as unknown as typeof import('@ncp/redaction').redact,
    });
    await processMessage(freshMessage(), deps);
    const bodyArg = redactFn.mock.calls[0]?.[0]?.body ?? '';
    expect(bodyArg).not.toMatch(/<[^>]+>/);
    expect(bodyArg).not.toContain('<p>');
    expect(bodyArg).not.toContain('<html>');
  });

  it('builds source_id as msgraph-email:<id>:chunk-NNNN with 4-digit padding', async () => {
    const insertSpy = makeInsertSpy([[{ id: 'r0' }], [{ id: 'r1' }]]);
    const chunkFn = vi.fn(() => [
      { text: 'a', tokenCount: 1, startTokenOffset: 0, endTokenOffset: 1 },
      { text: 'b', tokenCount: 1, startTokenOffset: 1, endTokenOffset: 2 },
    ]);
    const embedFn = vi.fn(async () => ({
      embeddings: [[0.1], [0.2]],
      tokenCounts: [1, 1],
      model: 'text-embedding-3-large',
      usage: { totalTokens: 2, promptTokens: 2 },
    }));
    const deps = makeDeps({
      insertSpy,
      chunkImpl: chunkFn as unknown as typeof import('@ncp/embeddings').chunk,
      embedImpl: embedFn as unknown as typeof import('@ncp/embeddings').embed,
    });
    await processMessage(freshMessage(), deps);
    expect(insertSpy.values).toHaveBeenCalledTimes(2);
    const sourceId0 = (
      insertSpy.values.mock.calls[0]?.[0] as { sourceId: string }
    ).sourceId;
    const sourceId1 = (
      insertSpy.values.mock.calls[1]?.[0] as { sourceId: string }
    ).sourceId;
    const expectedPrefix = `msgraph-email:${fixture.value[0]?.id}:chunk-`;
    expect(sourceId0).toBe(`${expectedPrefix}0000`);
    expect(sourceId1).toBe(`${expectedPrefix}0001`);
  });

  it('returns failed on embed error without partial DB inserts', async () => {
    const insertSpy = makeInsertSpy([]);
    const embedFn = vi.fn(async () => {
      throw new Error('embed exceeded 8191 tokens');
    });
    const deps = makeDeps({
      insertSpy,
      embedImpl: embedFn as unknown as typeof import('@ncp/embeddings').embed,
    });
    const result = await processMessage(freshMessage(), deps);
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toContain('embed');
    }
    expect(insertSpy.insert).not.toHaveBeenCalled();
  });

  it('contract conformance: reads body from message.body.content (not bodyPreview)', async () => {
    const insertSpy = makeInsertSpy([[{ id: 'r' }]]);
    const redactFn = vi.fn(async () => ({
      status: 'redacted' as const,
      redactedText: 'x',
      log: [],
    }));
    const deps = makeDeps({
      insertSpy,
      redactImpl: redactFn as unknown as typeof import('@ncp/redaction').redact,
    });
    const msg = freshMessage();
    // Set bodyPreview to a sentinel string; the pipeline must NOT read it.
    msg.bodyPreview = 'PIPELINE-MUST-NOT-READ-THIS';
    await processMessage(msg, deps);
    const body = redactFn.mock.calls[0]?.[0]?.body ?? '';
    expect(body).not.toContain('PIPELINE-MUST-NOT-READ-THIS');
  });

  it('contract conformance: reads sender from message.from (not message.sender)', async () => {
    const insertSpy = makeInsertSpy([[{ id: 'r' }]]);
    const redactFn = vi.fn(async () => ({
      status: 'redacted' as const,
      redactedText: 'x',
      log: [],
    }));
    const deps = makeDeps({
      insertSpy,
      redactImpl: redactFn as unknown as typeof import('@ncp/redaction').redact,
    });
    const msg = freshMessage();
    msg.from = {
      emailAddress: { name: 'F', address: 'from-addr@example.com' },
    };
    msg.sender = {
      emailAddress: { name: 'S', address: 'sender-addr@example.com' },
    };
    await processMessage(msg, deps);
    const sender = redactFn.mock.calls[0]?.[0]?.senderEmail;
    expect(sender).toBe('from-addr@example.com');
    expect(sender).not.toBe('sender-addr@example.com');
  });

  it('contract conformance: uses sentDateTime for captured_at (not receivedDateTime)', async () => {
    const insertSpy = makeInsertSpy([[{ id: 'r' }]]);
    const deps = makeDeps({ insertSpy });
    const msg = freshMessage();
    msg.sentDateTime = '2026-05-21T22:00:07Z';
    msg.receivedDateTime = '2026-05-21T22:00:14Z';
    await processMessage(msg, deps);
    const valuesArg = insertSpy.values.mock.calls[0]?.[0] as {
      capturedAt: Date;
    };
    expect(valuesArg.capturedAt.toISOString()).toBe('2026-05-21T22:00:07.000Z');
  });
});
