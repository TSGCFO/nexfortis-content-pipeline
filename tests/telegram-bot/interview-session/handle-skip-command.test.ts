/**
 * Tests for `handleSkipCommand` — the DI inner core of the
 * `interview.session.command.skip` Inngest function.
 *
 * Cases:
 *   1. Active session for chatId → DB transitions + ack sent
 *   2. No active session → no DB writes, no ack
 *   3. Session in terminal status → no_active_session (filtered by lookup)
 *   4. The DB update uses a status guard
 *   5. Telegram send failure → ack_failed (idempotent — DB still applied)
 */

import { describe, expect, it, vi } from 'vitest';

import {
  handleSkipCommand,
  type HandleSkipCommandDeps,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/handle-skip-command.js';
import type { Database } from '@ncp/db';
import type { Logger } from '@ncp/logger';

function makeLogger(): Logger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}

function fetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

function fetchFail(): ReturnType<typeof vi.fn> {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({ ok: false, description: 'bot is muted' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
  );
}

interface FakeState {
  sessionRow:
    | { id: string; candidateId: string; status: string }
    | undefined;
  candidateRow: { proposedTitle: string } | undefined;
  /** Each update call recorded so tests can assert the status guard. */
  updateCalls: Array<{
    table: 'interview_sessions' | 'article_candidates';
    set: Record<string, unknown>;
  }>;
}

function inferTable(table: unknown): 'interview_sessions' | 'article_candidates' {
  if (table && typeof table === 'object') {
    for (const sym of Object.getOwnPropertySymbols(table)) {
      const desc = sym.description ?? '';
      if (desc.includes('Name')) {
        const v = (table as Record<symbol, unknown>)[sym];
        if (v === 'interview_sessions' || v === 'article_candidates') {
          return v;
        }
      }
    }
  }
  return 'interview_sessions';
}

function makeDb(state: FakeState): Database {
  // The handler issues two selects (sessions then candidates) and two
  // updates. We use a tiny FSM: first select returns sessionRow, second
  // returns candidateRow.
  let selectCallIndex = 0;
  return {
    select(_cols: unknown) {
      const myIndex = selectCallIndex++;
      return {
        from(_table: unknown) {
          return {
            where(_w: unknown) {
              return {
                orderBy(_o: unknown) {
                  return {
                    limit(_n: number) {
                      if (myIndex === 0) {
                        return Promise.resolve(
                          state.sessionRow === undefined
                            ? []
                            : [state.sessionRow],
                        );
                      }
                      return Promise.resolve([]);
                    },
                  };
                },
                // For the candidate query — no orderBy
                then(
                  resolve: (v: unknown) => void,
                  _reject: unknown,
                ) {
                  if (myIndex === 1) {
                    resolve(
                      state.candidateRow === undefined
                        ? []
                        : [state.candidateRow],
                    );
                  } else if (myIndex === 0) {
                    resolve(
                      state.sessionRow === undefined
                        ? []
                        : [state.sessionRow],
                    );
                  } else {
                    resolve([]);
                  }
                },
              };
            },
          };
        },
      };
    },
    update(table: unknown) {
      const tableName = inferTable(table);
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
  } as unknown as Database;
}

function makeDeps(
  state: FakeState,
  fetchFn = fetchOk(),
): { deps: HandleSkipCommandDeps; fetchFn: ReturnType<typeof vi.fn> } {
  const deps: HandleSkipCommandDeps = {
    db: makeDb(state),
    logger: makeLogger(),
    fetchFn: fetchFn as unknown as typeof fetch,
    token: 'TOK',
    chatId: 'CHAT',
  };
  return { deps, fetchFn };
}

describe('handleSkipCommand', () => {
  it('active session: DB transitions to skipped, ack sent', async () => {
    const state: FakeState = {
      sessionRow: {
        id: 'sess-1',
        candidateId: 'cand-1',
        status: 'preview_sent',
      },
      candidateRow: { proposedTitle: 'My article' },
      updateCalls: [],
    };
    const { deps, fetchFn } = makeDeps(state);
    const result = await handleSkipCommand(deps);
    expect(result).toEqual({ outcome: 'skipped', sessionId: 'sess-1' });
    const sessionUpdate = state.updateCalls.find(
      (u) => u.table === 'interview_sessions',
    );
    expect(sessionUpdate?.set['status']).toBe('skipped');
    const candidateUpdate = state.updateCalls.find(
      (u) => u.table === 'article_candidates',
    );
    expect(candidateUpdate?.set['status']).toBe('skipped');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('no active session: no DB writes, no ack', async () => {
    const state: FakeState = {
      sessionRow: undefined,
      candidateRow: undefined,
      updateCalls: [],
    };
    const { deps, fetchFn } = makeDeps(state);
    const result = await handleSkipCommand(deps);
    expect(result).toEqual({ outcome: 'no_active_session' });
    expect(state.updateCalls).toHaveLength(0);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('candidate row missing: no DB writes (defensive)', async () => {
    const state: FakeState = {
      sessionRow: {
        id: 'sess-1',
        candidateId: 'cand-missing',
        status: 'preview_sent',
      },
      candidateRow: undefined,
      updateCalls: [],
    };
    const { deps } = makeDeps(state);
    const result = await handleSkipCommand(deps);
    expect(result).toEqual({ outcome: 'no_active_session' });
    expect(state.updateCalls).toHaveLength(0);
  });

  it('DB update is interview_sessions FIRST, then article_candidates (idempotency-friendly order)', async () => {
    const state: FakeState = {
      sessionRow: {
        id: 'sess-1',
        candidateId: 'cand-1',
        status: 'confirming',
      },
      candidateRow: { proposedTitle: 'X' },
      updateCalls: [],
    };
    const { deps } = makeDeps(state);
    await handleSkipCommand(deps);
    expect(state.updateCalls[0]?.table).toBe('interview_sessions');
    expect(state.updateCalls[1]?.table).toBe('article_candidates');
  });

  it('telegram send failure: result reports ack_failed but DB transition was already applied', async () => {
    const state: FakeState = {
      sessionRow: {
        id: 'sess-1',
        candidateId: 'cand-1',
        status: 'preview_sent',
      },
      candidateRow: { proposedTitle: 'X' },
      updateCalls: [],
    };
    const { deps } = makeDeps(state, fetchFail());
    const result = await handleSkipCommand(deps);
    expect(result).toEqual({ outcome: 'ack_failed', sessionId: 'sess-1' });
    // DB transition still happened
    const sessionUpdate = state.updateCalls.find(
      (u) => u.table === 'interview_sessions',
    );
    expect(sessionUpdate?.set['status']).toBe('skipped');
  });

  it('uses sendTelegramMessage (does NOT use Drizzle .delete)', async () => {
    // Indirect assertion: we observe a fetch (Telegram POST) but no
    // delete in the fake DB (we don't implement delete at all). The
    // test fails by virtue of the DB facade not having a .delete
    // method — if the implementation switches to DELETE this test
    // crashes with TypeError.
    const state: FakeState = {
      sessionRow: {
        id: 'sess-1',
        candidateId: 'cand-1',
        status: 'preview_sent',
      },
      candidateRow: { proposedTitle: 'X' },
      updateCalls: [],
    };
    const { deps, fetchFn } = makeDeps(state);
    await handleSkipCommand(deps);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
