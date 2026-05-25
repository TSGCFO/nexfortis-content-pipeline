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
import type { OpusAnthropicLike } from '../../../artifacts/telegram-bot/src/jobs/interview-session/anthropic-shapes.js';
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
        from(table: unknown) {
          const tableName = inferTableName(table);
          if (tableName === 'capture_signals') {
            // Confirmation-loop's selectSignalsForCluster reads from
            // capture_signals via .where().orderBy().limit() — return
            // an empty array so the loop sees `no_signals`.
            return {
              where(_w: unknown) {
                return {
                  orderBy(_o: unknown) {
                    return {
                      limit(_n: number) {
                        return Promise.resolve([]);
                      },
                    };
                  },
                };
              },
            };
          }
          // article_candidates: PR 1's lookup.
          return {
            where(_w: unknown) {
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
  anthropicApiKey: 'AKEY',
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

function makeAnthropicMock(): OpusAnthropicLike {
  // PR 1 tests never reach the confirmation loop's Opus calls because
  // their candidate has no selectable signals (the fake DB returns
  // []), but the deps slot must still be populated.
  return {
    messages: {
      create: vi.fn(async () => ({
        stop_reason: 'end_turn',
        content: [],
      })) as unknown as OpusAnthropicLike['messages']['create'],
    },
  };
}

interface MakeDepsOverrides {
  candidateRows?: CandidateRow[];
  sessionId?: string;
  now?: Date;
  env?: InterviewSessionEnv;
  sleepUntil?: ReturnType<typeof vi.fn>;
  waitForReply?: ReturnType<typeof vi.fn>;
  fetchFn?: ReturnType<typeof vi.fn>;
  logger?: MockLogger;
  sendInngestEvent?: ReturnType<typeof vi.fn>;
  anthropic?: OpusAnthropicLike;
}

interface BuiltDeps {
  deps: {
    db: Database;
    logger: MockLogger;
    now: Date;
    env: InterviewSessionEnv;
    sleepUntil: ReturnType<typeof vi.fn>;
    waitForReply: ReturnType<typeof vi.fn>;
    fetchFn: typeof fetch;
    sendInngestEvent: ReturnType<typeof vi.fn>;
    anthropic: OpusAnthropicLike;
  };
  state: FakeDbState;
  logger: MockLogger;
  sleepUntil: ReturnType<typeof vi.fn>;
  waitForReply: ReturnType<typeof vi.fn>;
  fetchFn: ReturnType<typeof vi.fn>;
  sendInngestEvent: ReturnType<typeof vi.fn>;
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
  const fetchFn = overrides.fetchFn ?? makeFetchOk();
  const sendInngestEvent =
    overrides.sendInngestEvent ?? vi.fn(async () => undefined);
  const anthropic = overrides.anthropic ?? makeAnthropicMock();
  const deps = {
    db,
    logger,
    now: overrides.now ?? DEFAULT_NOW,
    env: overrides.env ?? DEFAULT_ENV,
    sleepUntil,
    waitForReply,
    fetchFn: fetchFn as unknown as typeof fetch,
    sendInngestEvent,
    anthropic,
  };
  return {
    deps,
    state,
    logger,
    sleepUntil,
    waitForReply,
    fetchFn,
    sendInngestEvent,
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
  it('happy path: preview acknowledged → confirmation loop → completed', async () => {
    // The default fake DB returns 0 signals for the cluster (capture_signals
    // chain yields []), so the confirmation loop short-circuits to
    // `no_signals` and the orchestrator transitions to `completed` with
    // confirmedCount=0. The preview message + completion placeholder are
    // both sent over the same `fetchFn` (2 calls total).
    const { deps, state, sleepUntil, fetchFn } = makeDeps();

    const outcome = await runInterviewSession(deps, 'cand-1');

    expect(outcome).toEqual({
      kind: 'completed',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      confirmedCount: 0,
      excludedCount: 0,
    } satisfies RunOutcome);

    // sleepUntil called exactly once with the Mon-after-NOW Date.
    // 2026-05-24 (Sun) → next Mon 2026-05-25 08:00 EDT = 12:00 UTC.
    expect(sleepUntil).toHaveBeenCalledTimes(1);
    expect((sleepUntil.mock.calls[0]![0] as Date).toISOString()).toBe(
      '2026-05-25T12:00:00.000Z',
    );

    // article_candidates updated to status='awaiting_interview' then
    // 'interview_complete' (2 updates).
    const candidateUpdates = state.updateCalls.filter(
      (u) => u.table === 'article_candidates',
    );
    expect(candidateUpdates.map((u) => u.set)).toEqual([
      { status: 'awaiting_interview' },
      { status: 'interview_complete' },
    ]);

    // interview_sessions inserted once with status='preview_sent', then
    // updated to completed (+ completedAt timestamp).
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
    const sessionUpdates = state.updateCalls.filter(
      (u) => u.table === 'interview_sessions',
    );
    const completedUpdate = sessionUpdates.find(
      (u) => u.set['status'] === 'completed',
    );
    expect(completedUpdate).toBeDefined();
    expect(completedUpdate!.set['completedAt']).toBeInstanceOf(Date);

    // Two Telegram fetches: preview + completion placeholder.
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const bodies = getFetchBodies(fetchFn);
    expect(bodies[0]!['text']).toContain('Conditional Access for iOS');
    expect(bodies[0]!['chat_id']).toBe('CHAT');
    expect(bodies[0]!['parse_mode']).toBe('HTML');
    expect(bodies[1]!['text']).toMatch(/I&#39;ve confirmed 0 examples/);
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

  it('candidate already in awaiting_interview: does NOT redundantly update status, still inserts session + sends preview, still progresses to completed', async () => {
    const awaiting = { ...defaultCandidate(), status: 'awaiting_interview' };
    const { deps, state } = makeDeps({ candidateRows: [awaiting] });

    const outcome = await runInterviewSession(deps, 'cand-1');

    expect(outcome.kind).toBe('completed');

    // Exactly ONE article_candidates update — the final transition to
    // 'interview_complete' from the loop's completion branch. No
    // redundant 'awaiting_interview' write because the candidate was
    // already in that state.
    const candidateUpdates = state.updateCalls.filter(
      (u) => u.table === 'article_candidates',
    );
    expect(candidateUpdates).toHaveLength(1);
    expect(candidateUpdates[0]!.set).toEqual({ status: 'interview_complete' });

    // Session was still inserted.
    const sessionInserts = state.insertCalls.filter(
      (i) => i.table === 'interview_sessions',
    );
    expect(sessionInserts).toHaveLength(1);
  });

  it('telegram preview send fails (HTTP 500): does not throw, logs error, continues to wait for reply, still progresses to completed', async () => {
    const fetchFn = makeFetchSequence(
      { status: 500, body: { ok: false, description: 'internal' } },
      // subsequent calls (completion placeholder) succeed
      { status: 200, body: { ok: true, result: {} } },
    );
    const { deps, state, logger, waitForReply } = makeDeps({ fetchFn });

    const outcome = await runInterviewSession(deps, 'cand-1');

    expect(outcome.kind).toBe('completed');
    expect(waitForReply).toHaveBeenCalledTimes(1);

    // Session was inserted; candidate transitioned through
    // awaiting_interview → interview_complete (2 updates).
    expect(
      state.insertCalls.filter((i) => i.table === 'interview_sessions'),
    ).toHaveLength(1);
    expect(
      state.updateCalls.filter((u) => u.table === 'article_candidates'),
    ).toHaveLength(2);

    // Error log captured the preview failure.
    const previewErr = logger.error.mock.calls.find(
      (c) =>
        (c[0] as Record<string, unknown>)['action'] === 'preview_send_failed',
    );
    expect(previewErr).toBeDefined();
    const errCtx = previewErr![0] as Record<string, unknown>;
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

  // ----- PR 2 backport tests ---------------------------------------------

  it('dispatches interview.session.opened exactly once after the session insert', async () => {
    const { deps, sendInngestEvent } = makeDeps();
    await runInterviewSession(deps, 'cand-1');
    expect(sendInngestEvent).toHaveBeenCalledTimes(1);
    const payload = sendInngestEvent.mock.calls[0]![0] as {
      name: string;
      data: { chatId: string; sessionId: string; candidateId: string };
    };
    expect(payload.name).toBe('interview.session.opened');
    expect(payload.data.chatId).toBe('CHAT');
    expect(payload.data.sessionId).toBe('sess-1');
    expect(payload.data.candidateId).toBe('cand-1');
  });

  it('does NOT dispatch interview.session.opened when candidate is missing (no session row to advertise)', async () => {
    const { deps, sendInngestEvent } = makeDeps({ candidateRows: [] });
    await runInterviewSession(deps, 'cand-1');
    expect(sendInngestEvent).not.toHaveBeenCalled();
  });

  it('session.opened dispatch failure: warn-logs, does not throw, preview still sends, session still progresses to completed', async () => {
    const failingDispatch = vi.fn(async () => {
      throw new Error('Inngest dispatch unreachable');
    });
    const { deps, logger, fetchFn } = makeDeps({
      sendInngestEvent: failingDispatch,
    });
    const outcome = await runInterviewSession(deps, 'cand-1');
    expect(outcome.kind).toBe('completed');
    expect(failingDispatch).toHaveBeenCalledTimes(1);
    // Warn logged with the right action.
    const warnCalls = logger.warn.mock.calls;
    const dispatchWarn = warnCalls.find(
      (c) =>
        (c[0] as Record<string, unknown>)['action'] ===
        'session_opened_dispatch_failed',
    );
    expect(dispatchWarn).toBeDefined();
    // Preview send still happened (fetchFn was called for preview + completion).
    expect(fetchFn).toHaveBeenCalled();
  });
});
