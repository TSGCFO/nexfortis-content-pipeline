/**
 * Integration tests for `runInterviewSession` — the DI-friendly inner core
 * of the interview-session Inngest function (PR 1 of 3).
 *
 * All external dependencies (db, logger, sleepUntil, waitForReply, fetchFn)
 * are mocked via `vi.fn()`. No real network, no real DB, no real Inngest.
 *
 * Mirrors the test pattern in
 * `tests/synthesis-worker/synthesize-weekly/synthesize-weekly.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';

import { runInterviewSession } from '../../../artifacts/telegram-bot/src/jobs/interview-session/index.js';
import type {
  IncomingReplyEvent,
  InterviewSessionEnv,
  RunOutcome,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';
import type { Logger } from '@ncp/logger';
import type { Database } from '@ncp/db';

// --- DB mock --------------------------------------------------------------

interface CandidateRow {
  id: string;
  status: string;
  pillar: 'quickbooks' | 'managed-it' | 'cybersecurity';
  proposedTitle: string;
  primaryKeyword: string;
  evidenceChunkIds: string[] | null;
}

interface FakeDbState {
  candidateRows: CandidateRow[];
  insertCalls: Array<{ table: string; values: Record<string, unknown> }>;
  updateCalls: Array<{ table: string; set: Record<string, unknown> }>;
  /** Per-table queue of `.returning()` results. */
  returningQueues: Map<string, Array<Array<{ id: string }>>>;
}

function inferTableName(table: unknown): string {
  if (table && typeof table === 'object') {
    for (const sym of Object.getOwnPropertySymbols(table)) {
      const desc = sym.description ?? '';
      if (desc.includes('Name')) {
        const v = (table as Record<symbol, unknown>)[sym];
        if (typeof v === 'string') return v;
      }
    }
  }
  return 'unknown';
}

interface MakeFakeDbOptions {
  candidateRows: CandidateRow[];
  sessionId?: string;
}

function makeFakeDb(opts: MakeFakeDbOptions): {
  db: Database;
  state: FakeDbState;
} {
  const state: FakeDbState = {
    candidateRows: opts.candidateRows,
    insertCalls: [],
    updateCalls: [],
    returningQueues: new Map(),
  };
  state.returningQueues.set('interview_sessions', [
    [{ id: opts.sessionId ?? 'sess-1' }],
  ]);

  const db = {
    select(_cols: unknown) {
      return {
        from(_table: unknown) {
          return {
            where(_w: unknown) {
              // The only `select` in runInterviewSession is from
              // article_candidates filtered by id.
              return Promise.resolve(state.candidateRows);
            },
          };
        },
      };
    },
    insert(table: unknown) {
      const tableName = inferTableName(table);
      return {
        values(values: unknown) {
          state.insertCalls.push({
            table: tableName,
            values: values as Record<string, unknown>,
          });
          const queue = state.returningQueues.get(tableName);
          const nextReturning = queue?.shift() ?? [];
          return {
            returning(_cols: unknown) {
              return Promise.resolve(nextReturning);
            },
            then(onFulfilled: (v: unknown) => unknown) {
              return Promise.resolve(undefined).then(onFulfilled);
            },
          };
        },
      };
    },
    update(table: unknown) {
      const tableName = inferTableName(table);
      return {
        set(values: unknown) {
          state.updateCalls.push({
            table: tableName,
            set: values as Record<string, unknown>,
          });
          return {
            where(_w: unknown) {
              return Promise.resolve(undefined);
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Database, state };
}

// --- Logger mock ----------------------------------------------------------

interface MockLogger extends Logger {
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  trace: ReturnType<typeof vi.fn>;
  fatal: ReturnType<typeof vi.fn>;
}

function makeLogger(): MockLogger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}

// --- Fetch mock helpers ---------------------------------------------------

function makeFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

function makeFetchSequence(
  ...responses: Array<{ status: number; body: Record<string, unknown> }>
): ReturnType<typeof vi.fn> {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

// --- makeDeps factory -----------------------------------------------------

const DEFAULT_NOW = new Date('2026-05-24T18:00:00Z'); // Sunday afternoon UTC
const DEFAULT_ENV: InterviewSessionEnv = {
  databaseUrl: 'postgres://x',
  telegramBotToken: 'TOK',
  telegramChatId: 'CHAT',
  openaiApiKey: 'oai',
  anthropicApiKey: 'anth',
};

function defaultCandidate(): CandidateRow {
  return {
    id: 'cand-1',
    status: 'pending',
    pillar: 'managed-it',
    proposedTitle: 'Conditional Access for iOS',
    primaryKeyword: 'intune',
    evidenceChunkIds: ['s1', 's2', 's3', 's4', 's5'],
  };
}

interface MakeDepsOverrides {
  candidateRows?: CandidateRow[];
  sessionId?: string;
  now?: Date;
  env?: InterviewSessionEnv;
  sleepUntil?: ReturnType<typeof vi.fn>;
  waitForReply?: ReturnType<typeof vi.fn>;
  waitForLoopReply?: ReturnType<typeof vi.fn>;
  fetchFn?: ReturnType<typeof vi.fn>;
  logger?: MockLogger;
  sendInngestEvent?: ReturnType<typeof vi.fn>;
  /**
   * PR 2 backport: the integration test scaffold stubs the confirmation
   * loop to a fixed `{ kind: 'completed', confirmedCount: 0,
   * excludedCount: 0 }` so PR 1's assertions still focus on the preview
   * / skip / timeout transitions rather than the Q&A inner loop. The
   * confirmation loop has its own dedicated test file.
   */
  runConfirmationLoop?: ReturnType<typeof vi.fn>;
}

interface BuiltDeps {
  deps: {
    db: Database;
    logger: MockLogger;
    now: Date;
    env: InterviewSessionEnv;
    sleepUntil: ReturnType<typeof vi.fn>;
    waitForReply: ReturnType<typeof vi.fn>;
    waitForLoopReply: ReturnType<typeof vi.fn>;
    fetchFn: typeof fetch;
    sendInngestEvent: ReturnType<typeof vi.fn>;
    anthropic: { messages: { create: ReturnType<typeof vi.fn> } };
    runConfirmationLoop: ReturnType<typeof vi.fn>;
  };
  state: FakeDbState;
  logger: MockLogger;
  sleepUntil: ReturnType<typeof vi.fn>;
  waitForReply: ReturnType<typeof vi.fn>;
  waitForLoopReply: ReturnType<typeof vi.fn>;
  fetchFn: ReturnType<typeof vi.fn>;
  sendInngestEvent: ReturnType<typeof vi.fn>;
  runConfirmationLoop: ReturnType<typeof vi.fn>;
}

function makeDeps(overrides: MakeDepsOverrides = {}): BuiltDeps {
  const { db, state } = makeFakeDb({
    candidateRows: overrides.candidateRows ?? [defaultCandidate()],
    ...(overrides.sessionId !== undefined
      ? { sessionId: overrides.sessionId }
      : {}),
  });
  const logger = overrides.logger ?? makeLogger();
  const sleepUntil = overrides.sleepUntil ?? vi.fn(async () => undefined);
  const waitForReply =
    overrides.waitForReply ??
    vi.fn(
      async (): Promise<IncomingReplyEvent | null> => ({
        data: { text: 'ok lets do it', chatId: 'CHAT', sessionId: 'sess-1' },
      }),
    );
  const waitForLoopReply =
    overrides.waitForLoopReply ?? vi.fn(async () => null);
  const fetchFn = overrides.fetchFn ?? makeFetchOk();
  const sendInngestEvent =
    overrides.sendInngestEvent ?? vi.fn(async () => undefined);
  const runConfirmationLoop =
    overrides.runConfirmationLoop ??
    vi.fn(async (context: { sessionId: string; candidate: { id: string } }) => ({
      kind: 'completed' as const,
      sessionId: context.sessionId,
      candidateId: context.candidate.id,
      confirmedCount: 0,
      excludedCount: 0,
    }));
  const anthropic = { messages: { create: vi.fn() } };
  const deps = {
    db,
    logger,
    now: overrides.now ?? DEFAULT_NOW,
    env: overrides.env ?? DEFAULT_ENV,
    sleepUntil,
    waitForReply,
    waitForLoopReply,
    fetchFn: fetchFn as unknown as typeof fetch,
    sendInngestEvent,
    anthropic,
    runConfirmationLoop,
  };
  return {
    deps,
    state,
    logger,
    sleepUntil,
    waitForReply,
    waitForLoopReply,
    fetchFn,
    sendInngestEvent,
    runConfirmationLoop,
  };
}

function getFetchBodies(
  fetchFn: ReturnType<typeof vi.fn>,
): Array<Record<string, unknown>> {
  return fetchFn.mock.calls.map((call) => {
    const init = call[1] as RequestInit;
    return JSON.parse(init.body as string) as Record<string, unknown>;
  });
}

// --- Test cases -----------------------------------------------------------

describe('runInterviewSession', () => {
  it('happy path: preview acknowledged → completed via stubbed loop, full transitions', async () => {
    const { deps, state, sleepUntil, fetchFn, sendInngestEvent } = makeDeps();

    const outcome = await runInterviewSession(deps, 'cand-1');

    // PR 2: the stubbed confirmation loop returns `completed` with zero
    // confirmations. The integration shape mirrors the old PR 1
    // `preview_acknowledged` outcome plus the new counts.
    expect(outcome).toEqual({
      kind: 'completed',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      confirmedCount: 0,
      excludedCount: 0,
    } satisfies RunOutcome);

    // PR 2 backport: `interview.session.opened` is dispatched after the
    // session insert so the grammY bot can attach the sessionId to
    // subsequent `telegram.message.received` events.
    expect(sendInngestEvent).toHaveBeenCalledTimes(1);
    expect(sendInngestEvent.mock.calls[0]![0]).toEqual({
      name: 'interview.session.opened',
      data: { chatId: 'CHAT', sessionId: 'sess-1', candidateId: 'cand-1' },
    });

    // sleepUntil called exactly once with the Mon-after-NOW Date.
    // 2026-05-24 (Sun) → next Mon 2026-05-25 08:00 EDT = 12:00 UTC.
    expect(sleepUntil).toHaveBeenCalledTimes(1);
    expect((sleepUntil.mock.calls[0]![0] as Date).toISOString()).toBe(
      '2026-05-25T12:00:00.000Z',
    );

    // article_candidates updated once to status='awaiting_interview'.
    const candidateUpdates = state.updateCalls.filter(
      (u) => u.table === 'article_candidates',
    );
    expect(candidateUpdates).toHaveLength(1);
    expect(candidateUpdates[0]!.set).toEqual({ status: 'awaiting_interview' });

    // interview_sessions inserted once with status='preview_sent'.
    const sessionInserts = state.insertCalls.filter(
      (i) => i.table === 'interview_sessions',
    );
    expect(sessionInserts).toHaveLength(1);
    expect(sessionInserts[0]!.values).toMatchObject({
      candidateId: 'cand-1',
      telegramChatId: 'CHAT',
      status: 'preview_sent',
    });
    expect(sessionInserts[0]!.values['startedAt']).toBeInstanceOf(Date);

    // Exactly one Telegram fetch with the preview body containing the title.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [body] = getFetchBodies(fetchFn);
    expect(body!['text']).toContain('Conditional Access for iOS');
    expect(body!['chat_id']).toBe('CHAT');
    expect(body!['parse_mode']).toBe('HTML');
  });

  it('/skip path: transitions session+candidate to skipped, sends preview + skip ack', async () => {
    const { deps, state, fetchFn } = makeDeps({
      waitForReply: vi.fn(
        async (): Promise<IncomingReplyEvent | null> => ({
          data: { text: '/skip', chatId: 'CHAT', sessionId: 'sess-1' },
        }),
      ),
    });

    const outcome = await runInterviewSession(deps, 'cand-1');

    expect(outcome).toEqual({
      kind: 'skipped',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
    } satisfies RunOutcome);

    // Two candidate updates: awaiting_interview, then skipped.
    const candidateUpdates = state.updateCalls.filter(
      (u) => u.table === 'article_candidates',
    );
    expect(candidateUpdates.map((u) => u.set)).toEqual([
      { status: 'awaiting_interview' },
      { status: 'skipped' },
    ]);

    // Session updated to skipped.
    const sessionUpdates = state.updateCalls.filter(
      (u) => u.table === 'interview_sessions',
    );
    expect(sessionUpdates).toHaveLength(1);
    expect(sessionUpdates[0]!.set).toEqual({ status: 'skipped' });

    // Two fetches: preview + skip ack. Both contain the title.
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const bodies = getFetchBodies(fetchFn);
    expect(bodies[0]!['text']).toContain('Conditional Access for iOS');
    expect(bodies[1]!['text']).toContain('Conditional Access for iOS');
    expect(bodies[1]!['text']).toMatch(/Skipped/);
  });

  it('timeout path: transitions session to timed_out + candidate to archived, sends preview + timeout msg', async () => {
    const { deps, state, fetchFn } = makeDeps({
      waitForReply: vi.fn(
        async (): Promise<IncomingReplyEvent | null> => null,
      ),
    });

    const outcome = await runInterviewSession(deps, 'cand-1');

    expect(outcome).toEqual({
      kind: 'timed_out',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
    } satisfies RunOutcome);

    const candidateUpdates = state.updateCalls.filter(
      (u) => u.table === 'article_candidates',
    );
    expect(candidateUpdates.map((u) => u.set)).toEqual([
      { status: 'awaiting_interview' },
      { status: 'archived' },
    ]);

    const sessionUpdates = state.updateCalls.filter(
      (u) => u.table === 'interview_sessions',
    );
    expect(sessionUpdates).toHaveLength(1);
    expect(sessionUpdates[0]!.set).toEqual({ status: 'timed_out' });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const bodies = getFetchBodies(fetchFn);
    expect(bodies[0]!['text']).toContain('Conditional Access for iOS');
    expect(bodies[1]!['text']).toContain('Conditional Access for iOS');
    expect(bodies[1]!['text']).toMatch(/timed out/);
  });

  it('candidate row missing: returns no_candidate, no writes, no fetches, single warn log', async () => {
    const { deps, state, logger, fetchFn, waitForReply } = makeDeps({
      candidateRows: [],
    });

    const outcome = await runInterviewSession(deps, 'cand-missing');

    expect(outcome).toEqual({
      kind: 'no_candidate',
      candidateId: 'cand-missing',
    } satisfies RunOutcome);

    expect(state.insertCalls).toEqual([]);
    expect(state.updateCalls).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(waitForReply).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warnCall = logger.warn.mock.calls[0]!;
    const warnCtx = warnCall[0] as Record<string, unknown>;
    expect(warnCtx['candidateId']).toBe('cand-missing');
    expect(warnCtx['status']).toBe('not_found');
  });

  it('candidate already in terminal status (archived): returns no_candidate, no writes, warn includes the actual status', async () => {
    const archived = { ...defaultCandidate(), status: 'archived' };
    const { deps, state, logger, fetchFn } = makeDeps({
      candidateRows: [archived],
    });

    const outcome = await runInterviewSession(deps, 'cand-1');

    expect(outcome).toEqual({
      kind: 'no_candidate',
      candidateId: 'cand-1',
    } satisfies RunOutcome);
    expect(state.insertCalls).toEqual([]);
    expect(state.updateCalls).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warnCtx = logger.warn.mock.calls[0]![0] as Record<string, unknown>;
    expect(warnCtx['status']).toBe('archived');
  });

  it('candidate already in awaiting_interview: does NOT update candidate status, still inserts session + sends preview', async () => {
    const awaiting = { ...defaultCandidate(), status: 'awaiting_interview' };
    const { deps, state, fetchFn } = makeDeps({ candidateRows: [awaiting] });

    const outcome = await runInterviewSession(deps, 'cand-1');

    expect(outcome.kind).toBe('completed');

    // Zero updates to article_candidates (no redundant write).
    const candidateUpdates = state.updateCalls.filter(
      (u) => u.table === 'article_candidates',
    );
    expect(candidateUpdates).toHaveLength(0);

    // Session was still inserted.
    const sessionInserts = state.insertCalls.filter(
      (i) => i.table === 'interview_sessions',
    );
    expect(sessionInserts).toHaveLength(1);

    // Preview was still sent.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('telegram preview send fails (HTTP 500): does not throw, logs error, continues to wait for reply', async () => {
    const fetchFn = makeFetchSequence(
      { status: 500, body: { ok: false, description: 'internal' } },
      // any subsequent calls (none expected in happy path) succeed
      { status: 200, body: { ok: true, result: {} } },
    );
    const { deps, state, logger, waitForReply } = makeDeps({ fetchFn });

    const outcome = await runInterviewSession(deps, 'cand-1');

    // PR 2: with the stubbed confirmation loop, the outcome is `completed`.
    expect(outcome.kind).toBe('completed');
    expect(waitForReply).toHaveBeenCalledTimes(1);

    // Session was inserted; candidate was updated to awaiting_interview.
    expect(
      state.insertCalls.filter((i) => i.table === 'interview_sessions'),
    ).toHaveLength(1);
    expect(
      state.updateCalls.filter((u) => u.table === 'article_candidates'),
    ).toHaveLength(1);

    // Error log captured the preview failure.
    expect(logger.error).toHaveBeenCalledTimes(1);
    const errCtx = logger.error.mock.calls[0]![0] as Record<string, unknown>;
    expect(errCtx['action']).toBe('preview_send_failed');
    expect(String(errCtx['reason'])).toMatch(/500|internal/);
  });

  it('skip-ack send fails: session+candidate still transition to skipped, warn logged, does not throw', async () => {
    const fetchFn = makeFetchSequence(
      { status: 200, body: { ok: true, result: {} } }, // preview ok
      { status: 500, body: { ok: false, description: 'boom' } }, // skip ack fails
    );
    const { deps, state, logger } = makeDeps({
      fetchFn,
      waitForReply: vi.fn(
        async (): Promise<IncomingReplyEvent | null> => ({
          data: { text: '/skip', chatId: 'CHAT', sessionId: 'sess-1' },
        }),
      ),
    });

    const outcome = await runInterviewSession(deps, 'cand-1');

    expect(outcome.kind).toBe('skipped');

    const sessionUpdates = state.updateCalls.filter(
      (u) => u.table === 'interview_sessions',
    );
    expect(sessionUpdates).toHaveLength(1);
    expect(sessionUpdates[0]!.set).toEqual({ status: 'skipped' });

    const candidateUpdates = state.updateCalls.filter(
      (u) => u.table === 'article_candidates',
    );
    expect(candidateUpdates[1]!.set).toEqual({ status: 'skipped' });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warnCtx = logger.warn.mock.calls[0]![0] as Record<string, unknown>;
    expect(warnCtx['action']).toBe('skip_ack_send_failed');
  });

  it('timeout-ack send fails: session+candidate still transition, warn logged, does not throw', async () => {
    const fetchFn = makeFetchSequence(
      { status: 200, body: { ok: true, result: {} } }, // preview ok
      { status: 500, body: { ok: false, description: 'boom' } }, // timeout ack fails
    );
    const { deps, state, logger } = makeDeps({
      fetchFn,
      waitForReply: vi.fn(
        async (): Promise<IncomingReplyEvent | null> => null,
      ),
    });

    const outcome = await runInterviewSession(deps, 'cand-1');

    expect(outcome.kind).toBe('timed_out');

    const sessionUpdates = state.updateCalls.filter(
      (u) => u.table === 'interview_sessions',
    );
    expect(sessionUpdates[0]!.set).toEqual({ status: 'timed_out' });
    const candidateUpdates = state.updateCalls.filter(
      (u) => u.table === 'article_candidates',
    );
    expect(candidateUpdates[1]!.set).toEqual({ status: 'archived' });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warnCtx = logger.warn.mock.calls[0]![0] as Record<string, unknown>;
    expect(warnCtx['action']).toBe('timeout_ack_send_failed');
  });

  it('HTML injection regression: malicious title is escaped in preview + skip-ack bodies', async () => {
    const malicious = {
      ...defaultCandidate(),
      proposedTitle: '<script>alert(1)</script>',
    };
    const { deps, fetchFn } = makeDeps({
      candidateRows: [malicious],
      waitForReply: vi.fn(
        async (): Promise<IncomingReplyEvent | null> => ({
          data: { text: '/skip', chatId: 'CHAT', sessionId: 'sess-1' },
        }),
      ),
    });

    await runInterviewSession(deps, 'cand-1');

    const bodies = getFetchBodies(fetchFn);
    expect(bodies).toHaveLength(2);
    for (const b of bodies) {
      const text = b['text'] as string;
      expect(text).toContain('&lt;script&gt;');
      expect(text).not.toContain('<script>');
      expect(text).not.toContain('</script>');
    }
  });

  it('HTML injection regression: malicious title is escaped in timeout body', async () => {
    const malicious = {
      ...defaultCandidate(),
      proposedTitle: '<script>alert(1)</script>',
    };
    const { deps, fetchFn } = makeDeps({
      candidateRows: [malicious],
      waitForReply: vi.fn(
        async (): Promise<IncomingReplyEvent | null> => null,
      ),
    });

    await runInterviewSession(deps, 'cand-1');

    const bodies = getFetchBodies(fetchFn);
    expect(bodies).toHaveLength(2);
    for (const b of bodies) {
      const text = b['text'] as string;
      expect(text).toContain('&lt;script&gt;');
      expect(text).not.toContain('<script>');
    }
  });

  it('determinism: identical now + identical mocks produce identical outcomes and call counts across runs', async () => {
    async function runOnce(): Promise<{
      outcome: RunOutcome;
      insertCount: number;
      updateCount: number;
      fetchCount: number;
      sleepCount: number;
    }> {
      const built = makeDeps();
      const outcome = await runInterviewSession(built.deps, 'cand-1');
      return {
        outcome,
        insertCount: built.state.insertCalls.length,
        updateCount: built.state.updateCalls.length,
        fetchCount: built.fetchFn.mock.calls.length,
        sleepCount: built.sleepUntil.mock.calls.length,
      };
    }
    const a = await runOnce();
    const b = await runOnce();
    expect(a).toEqual(b);
  });

  it('sleepUntil receives the correct next-Monday-08:00-Eastern Date for a known now', async () => {
    // Sunday 2026-01-11 08:00 EST = 13:00 UTC. Next Mon 08:00 EST = 2026-01-12T13:00:00Z.
    const { deps, sleepUntil } = makeDeps({
      now: new Date('2026-01-11T13:00:00Z'),
    });
    await runInterviewSession(deps, 'cand-1');
    expect(sleepUntil).toHaveBeenCalledTimes(1);
    const arg = sleepUntil.mock.calls[0]![0] as Date;
    expect(arg.toISOString()).toBe('2026-01-12T13:00:00.000Z');
  });
});
