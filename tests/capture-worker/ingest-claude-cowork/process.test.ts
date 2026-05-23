import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  composeText,
  processSession,
} from '../../../artifacts/capture-worker/src/jobs/ingest-claude-cowork/process.js';
import type {
  SessionDocument,
} from '../../../artifacts/capture-worker/src/jobs/ingest-claude-cowork/types.js';

interface InsertChainSpy {
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
}

function makeInsertSpy(returningResults: Array<unknown[]>): InsertChainSpy {
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
  loggerWarn?: ReturnType<typeof vi.fn>;
  loggerError?: ReturnType<typeof vi.fn>;
}): Parameters<typeof processSession>[1] {
  const infoMock = opts.loggerInfo ?? vi.fn();
  const debugMock = opts.loggerDebug ?? vi.fn();
  const warnMock = opts.loggerWarn ?? vi.fn();
  const errorMock = opts.loggerError ?? vi.fn();
  return {
    db: { insert: opts.insertSpy.insert } as unknown as Parameters<
      typeof processSession
    >[1]['db'],
    redactFn:
      opts.redactImpl ??
      (vi.fn(async () => ({
        status: 'redacted' as const,
        redactedText: 'clean text from cowork session for testing',
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
    logger: {
      info: infoMock,
      debug: debugMock,
      warn: warnMock,
      error: errorMock,
    },
    anthropicApiKey: 'test-anthropic',
    openaiApiKey: 'test-openai',
  };
}

const FAKE_EXPORTER = {
  name: 'nfx-cowork-export' as const,
  version: '0.0.6',
  sourceFormat: 'cowork-jsonl-v1' as const,
  exportedAt: '2026-05-22T13:45:00.000Z',
};

function buildSession(
  sessionId: string,
  createdAt: string,
  events: SessionDocument['events'],
  overrides: Partial<SessionDocument> = {},
): SessionDocument {
  return {
    schemaVersion: 1,
    _exporter: FAKE_EXPORTER,
    source: 'claude_cowork',
    sessionId,
    createdAt,
    events,
    ...overrides,
  };
}

describe('composeText', () => {
  it('emits TOOL[<tool>]: <summary> for tool_call with an 80-char summary (no truncation)', () => {
    const summary = 'x'.repeat(80);
    const text = composeText([
      {
        kind: 'tool_call',
        uuid: 't-1',
        ts: '2026-04-08T14:23:11.000Z',
        tool: 'mcp__y__op',
        summary,
      },
    ]);
    expect(text).toBe(`TOOL[mcp__y__op]: ${summary}`);
    expect(text.endsWith('x'.repeat(80))).toBe(true);
  });

  it('skips tool_call with no summary entirely', () => {
    const text = composeText([
      {
        kind: 'tool_call',
        uuid: 't-1',
        ts: '2026-04-08T14:23:11.000Z',
        tool: 'mcp__y__op',
        summary: undefined,
      },
    ]);
    expect(text).toBe('');
  });

  it('separates events with double newlines and uses role prefixes', () => {
    const text = composeText([
      {
        kind: 'user_text',
        uuid: 'u-1',
        ts: '2026-04-08T14:23:11.000Z',
        text: 'hi',
      },
      {
        kind: 'assistant_text',
        uuid: 'a-1',
        ts: '2026-04-08T14:23:12.000Z',
        text: 'hello',
      },
    ]);
    expect(text).toBe('USER: hi\n\nASSISTANT: hello');
  });
});

describe('processSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: composes 3 user + 2 assistant events, chunks, embeds, inserts', async () => {
    const insertSpy = makeInsertSpy([[{ id: 'row-1' }]]);
    const redactFn = vi.fn(async (input: { body: string }) => ({
      status: 'redacted' as const,
      redactedText: input.body,
      log: [],
    }));
    const deps = makeDeps({
      insertSpy,
      redactImpl: redactFn as unknown as typeof import('@ncp/redaction').redact,
    });

    const session = buildSession(
      'sess-happy-001',
      '2026-04-08T14:23:11.000Z',
      [
        {
          kind: 'user_text',
          uuid: 'u-1',
          ts: '2026-04-08T14:23:11.000Z',
          text: 'first',
        },
        {
          kind: 'user_text',
          uuid: 'u-2',
          ts: '2026-04-08T14:23:12.000Z',
          text: 'second',
        },
        {
          kind: 'user_text',
          uuid: 'u-3',
          ts: '2026-04-08T14:23:13.000Z',
          text: 'third',
        },
        {
          kind: 'assistant_text',
          uuid: 'a-1',
          ts: '2026-04-08T14:23:14.000Z',
          text: 'reply one',
        },
        {
          kind: 'assistant_text',
          uuid: 'a-2',
          ts: '2026-04-08T14:23:15.000Z',
          text: 'reply two',
        },
      ],
    );

    const result = await processSession(session, deps);

    expect(result).toEqual({
      status: 'stored',
      signalsInserted: 1,
      signalsSkippedDuplicate: 0,
    });
    expect(redactFn).toHaveBeenCalledTimes(1);
    const redactArg = redactFn.mock.calls[0]?.[0];
    expect(redactArg).toBeDefined();
    // Composed text must include both speaker prefixes.
    expect(redactArg?.body).toContain('USER: first');
    expect(redactArg?.body).toContain('ASSISTANT: reply two');

    expect(insertSpy.insert).toHaveBeenCalledTimes(1);
    expect(insertSpy.values).toHaveBeenCalledTimes(1);
    const valuesArg = insertSpy.values.mock.calls[0]?.[0] as {
      source: string;
      sourceId: string;
      sourceUrl: string | null;
      capturedAt: Date;
      piiStatus: string;
    };
    expect(valuesArg.source).toBe('claude_cowork');
    expect(valuesArg.sourceUrl).toBeNull();
    expect(valuesArg.piiStatus).toBe('redacted');
    expect(valuesArg.sourceId).toBe('claude_cowork:sess-happy-001:chunk-0000');
  });

  it('counts duplicate source_id as skipped (returning [] from onConflictDoNothing)', async () => {
    const insertSpy = makeInsertSpy([[]]); // returning yields zero rows = dup
    const deps = makeDeps({ insertSpy });
    const session = buildSession(
      'sess-dup-001',
      '2026-04-08T14:23:11.000Z',
      [
        {
          kind: 'user_text',
          uuid: 'u-1',
          ts: '2026-04-08T14:23:11.000Z',
          text: 'hello',
        },
      ],
    );
    const result = await processSession(session, deps);
    expect(result).toEqual({
      status: 'stored',
      signalsInserted: 0,
      signalsSkippedDuplicate: 1,
    });
  });

  it('returns skipped_no_embeddable when all events are tool_calls without summaries', async () => {
    const insertSpy = makeInsertSpy([]);
    const redactFn = vi.fn();
    const deps = makeDeps({
      insertSpy,
      redactImpl: redactFn as unknown as typeof import('@ncp/redaction').redact,
    });
    const session = buildSession(
      'sess-nochat-001',
      '2026-04-08T14:23:11.000Z',
      [
        {
          kind: 'tool_call',
          uuid: 't-1',
          ts: '2026-04-08T14:23:11.000Z',
          tool: 'mcp__y__op',
        },
        {
          kind: 'tool_call',
          uuid: 't-2',
          ts: '2026-04-08T14:23:12.000Z',
          tool: 'mcp__y__op',
        },
      ],
    );
    const result = await processSession(session, deps);
    expect(result).toEqual({ status: 'skipped_no_embeddable' });
    expect(redactFn).not.toHaveBeenCalled();
    expect(insertSpy.insert).not.toHaveBeenCalled();
  });

  it('returns skipped_empty_events when events: [] and inserts nothing', async () => {
    const insertSpy = makeInsertSpy([]);
    const deps = makeDeps({ insertSpy });
    const session = buildSession(
      'sess-empty-001',
      '2026-04-08T14:23:11.000Z',
      [],
    );
    const result = await processSession(session, deps);
    expect(result).toEqual({ status: 'skipped_empty_events' });
    expect(insertSpy.insert).not.toHaveBeenCalled();
  });

  it('catches a redact() throw, logs it, and returns { status: failed } so the run continues', async () => {
    const insertSpy = makeInsertSpy([]);
    const errorMock = vi.fn();
    const redactFn = vi.fn(async () => {
      throw new Error('redaction module crashed');
    });
    const deps = makeDeps({
      insertSpy,
      redactImpl: redactFn as unknown as typeof import('@ncp/redaction').redact,
      loggerError: errorMock,
    });
    const session = buildSession(
      'sess-redact-001',
      '2026-04-08T14:23:11.000Z',
      [
        {
          kind: 'user_text',
          uuid: 'u-1',
          ts: '2026-04-08T14:23:11.000Z',
          text: 'hello',
        },
      ],
    );
    const result = await processSession(session, deps);
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toContain('redaction module crashed');
    }
    expect(insertSpy.insert).not.toHaveBeenCalled();
    expect(errorMock).toHaveBeenCalledTimes(1);
    const ctx = errorMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(ctx.action).toBe('process_session_failed');
    expect(ctx.sessionId).toBe('sess-redact-001');
  });

  it('uses session.createdAt for capturedAt (not _exporter.exportedAt)', async () => {
    const insertSpy = makeInsertSpy([[{ id: 'r' }]]);
    const deps = makeDeps({ insertSpy });
    const createdAt = '2026-04-08T14:23:11.000Z';
    const session = buildSession('sess-ts-001', createdAt, [
      {
        kind: 'user_text',
        uuid: 'u-1',
        ts: createdAt,
        text: 'hello',
      },
    ]);
    // Set _exporter.exportedAt to a clearly different time
    session._exporter = { ...FAKE_EXPORTER, exportedAt: '2026-05-22T13:45:00.000Z' };

    await processSession(session, deps);
    const valuesArg = insertSpy.values.mock.calls[0]?.[0] as { capturedAt: Date };
    expect(valuesArg.capturedAt.toISOString()).toBe(createdAt);
    // Not the exporter time
    expect(valuesArg.capturedAt.toISOString()).not.toBe(
      session._exporter.exportedAt,
    );
  });

  it('formats source_id as claude_cowork:<sessionId>:chunk-NNNN (zero-padded) for each chunk', async () => {
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
    const session = buildSession(
      'fd55038b-multi-chunk',
      '2026-04-08T14:23:11.000Z',
      [
        {
          kind: 'user_text',
          uuid: 'u-1',
          ts: '2026-04-08T14:23:11.000Z',
          text: 'hi',
        },
      ],
    );
    await processSession(session, deps);
    expect(insertSpy.values).toHaveBeenCalledTimes(2);
    const sid0 = (insertSpy.values.mock.calls[0]?.[0] as { sourceId: string }).sourceId;
    const sid1 = (insertSpy.values.mock.calls[1]?.[0] as { sourceId: string }).sourceId;
    expect(sid0).toBe('claude_cowork:fd55038b-multi-chunk:chunk-0000');
    expect(sid1).toBe('claude_cowork:fd55038b-multi-chunk:chunk-0001');
  });

  it('drops blocked sessions: no insert, log line contains only metadata (no body text)', async () => {
    const insertSpy = makeInsertSpy([]);
    const infoMock = vi.fn();
    const blockedRedact = vi.fn(async () => ({
      status: 'blocked' as const,
      reason: 'body_keyword' as const,
      redactedText: '' as const,
      log: [],
    }));
    const session = buildSession(
      'sess-block-001',
      '2026-04-08T14:23:11.000Z',
      [
        {
          kind: 'user_text',
          uuid: 'u-1',
          ts: '2026-04-08T14:23:11.000Z',
          text: 'sensitive sentinel keyword inside body',
        },
      ],
    );
    const deps = makeDeps({
      insertSpy,
      redactImpl:
        blockedRedact as unknown as typeof import('@ncp/redaction').redact,
      loggerInfo: infoMock,
    });
    const result = await processSession(session, deps);
    expect(result).toEqual({ status: 'blocked', reason: 'body_keyword' });
    expect(insertSpy.insert).not.toHaveBeenCalled();
    expect(infoMock).toHaveBeenCalledTimes(1);
    const ctx = infoMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(ctx).toEqual({
      source: 'capture-worker',
      action: 'block_cowork',
      reason: 'body_keyword',
      sessionId: 'sess-block-001',
    });
    // No body, no redactedText, no chunks reach the log.
    const flatCtx = JSON.stringify(ctx);
    expect(flatCtx).not.toContain('sensitive sentinel keyword');
  });
});
