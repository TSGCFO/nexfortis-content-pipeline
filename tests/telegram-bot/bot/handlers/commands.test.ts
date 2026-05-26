/**
 * Tests for the PR 3 grammY command surface.
 *
 * Cases:
 *   1. /skip dispatches interview.session.command.skip with chatId
 *   2. /status fetches snapshot and sends formatted message (no DB writes)
 *   3. /help sends static message (no DB writes)
 *   4. /delete_signal <valid-uuid> → soft-delete + confirmation
 *   5. /delete_signal <invalid-uuid> → error reply, no DB writes
 *   6. /delete_signal <uuid-not-found> → not-found reply
 *   7. Command handlers take precedence (text handler `/`-early-return is verified separately)
 *   8. HTML-escape regression on /status output (proposed_title with <script>)
 */

import { describe, expect, it, vi } from 'vitest';

import {
  registerCommands,
  type RegisterCommandsDeps,
  type BotCommandRegistry,
  type CommandCtxLike,
} from '../../../../artifacts/telegram-bot/src/bot/handlers/commands.js';
import { SessionMap } from '../../../../artifacts/telegram-bot/src/bot/session-map.js';
import type { Database } from '@ncp/db';
import type { Logger } from '@ncp/logger';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const NOT_FOUND_UUID = '22222222-2222-4222-8222-222222222222';
const FIXED_NOW = new Date('2026-05-25T13:00:00Z');

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

interface FakeDbState {
  signalRows: Array<{ id: string; isDeleted: boolean }>;
  candidateRow: { proposedTitle: string; status: string } | undefined;
  sessionRow:
    | { status: string; questions: Array<unknown> | null }
    | undefined;
  /** Synthesis cluster rows ordered by createdAt DESC; tests pass [] for "no rows". */
  clusterRows: Array<{ createdAt: Date }>;
  /** All capture_signals rows returned by the count query for /status. */
  signalsCountRows: Array<{ id: string }>;
  updateCalls: Array<{ table: string; set: Record<string, unknown> }>;
}

function inferTable(table: unknown): string {
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

function makeDb(state: FakeDbState): Database {
  // Chainable builder — supports .where().orderBy().limit() and direct
  // await. Returns the same builder from .where/.orderBy so Drizzle's
  // variable call patterns all resolve to `baseResult`.
  function buildChain(baseResult: unknown[]): unknown {
    const builder: Record<string, unknown> = {};
    builder['where'] = (_w: unknown) => builder;
    builder['orderBy'] = (_o: unknown) => builder;
    builder['limit'] = (_n: number) => Promise.resolve(baseResult);
    builder['then'] = (resolve: (v: unknown) => void) => resolve(baseResult);
    return builder;
  }

  return {
    select(_cols: unknown) {
      return {
        from(table: unknown) {
          const tableName = inferTable(table);
          const baseResult =
            tableName === 'synthesis_clusters'
              ? state.clusterRows
              : tableName === 'article_candidates'
                ? state.candidateRow === undefined
                  ? []
                  : [state.candidateRow]
                : tableName === 'interview_sessions'
                  ? state.sessionRow === undefined
                    ? []
                    : [state.sessionRow]
                  : tableName === 'capture_signals'
                    ? state.signalRows.length > 0 &&
                      state.signalsCountRows.length === 0
                      ? state.signalRows
                      : state.signalsCountRows
                    : [];
          return buildChain(baseResult);
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
  state: FakeDbState,
  sessionMap = new SessionMap(),
  fetchFn = fetchOk(),
): {
  deps: RegisterCommandsDeps;
  sendInngestEvent: ReturnType<typeof vi.fn>;
  fetchFn: ReturnType<typeof vi.fn>;
  sessionMap: SessionMap;
} {
  const sendInngestEvent = vi.fn(async () => undefined);
  const deps: RegisterCommandsDeps = {
    db: makeDb(state),
    logger: makeLogger(),
    sessionMap,
    sendInngestEvent: sendInngestEvent as unknown as RegisterCommandsDeps['sendInngestEvent'],
    token: 'TOK',
    chatId: 'CHAT',
    fetchFn: fetchFn as unknown as typeof fetch,
    now: () => FIXED_NOW,
  };
  return { deps, sendInngestEvent, fetchFn, sessionMap };
}

interface RegisteredCommands {
  skip?: (ctx: CommandCtxLike) => Promise<void>;
  status?: (ctx: CommandCtxLike) => Promise<void>;
  help?: (ctx: CommandCtxLike) => Promise<void>;
  delete_signal?: (ctx: CommandCtxLike) => Promise<void>;
}

function makeBot(): {
  bot: BotCommandRegistry;
  registered: RegisteredCommands;
} {
  const registered: RegisteredCommands = {};
  const bot: BotCommandRegistry = {
    command(name, handler) {
      switch (name) {
        case 'skip':
          registered.skip = handler;
          break;
        case 'status':
          registered.status = handler;
          break;
        case 'help':
          registered.help = handler;
          break;
        case 'delete_signal':
          registered.delete_signal = handler;
          break;
      }
      return undefined;
    },
  };
  return { bot, registered };
}

function freshState(over: Partial<FakeDbState> = {}): FakeDbState {
  return {
    signalRows: [],
    candidateRow: undefined,
    sessionRow: undefined,
    clusterRows: [],
    signalsCountRows: [],
    updateCalls: [],
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('registerCommands', () => {
  it('/skip dispatches interview.session.command.skip with chatId', async () => {
    const state = freshState();
    const { deps, sendInngestEvent } = makeDeps(state);
    const { bot, registered } = makeBot();
    registerCommands(bot, deps);

    await registered.skip!({ chat: { id: 999 } });
    expect(sendInngestEvent).toHaveBeenCalledWith({
      name: 'interview.session.command.skip',
      data: { chatId: '999' },
    });
  });

  it('/status fetches snapshot and sends formatted message; no DB writes', async () => {
    const state = freshState({
      signalsCountRows: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
      clusterRows: [{ createdAt: new Date('2026-05-24T18:00:00Z') }],
    });
    const sessionMap = new SessionMap();
    const { deps, fetchFn } = makeDeps(state, sessionMap);
    const { bot, registered } = makeBot();
    registerCommands(bot, deps);

    await registered.status!({ chat: { id: 'CHAT' } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(String(body['text'])).toContain('Pipeline status');
    expect(String(body['text'])).toContain('3'); // signal count
    expect(state.updateCalls).toHaveLength(0);
  });

  it('/help sends static message; no DB writes', async () => {
    const state = freshState();
    const { deps, fetchFn } = makeDeps(state);
    const { bot, registered } = makeBot();
    registerCommands(bot, deps);

    await registered.help!({ chat: { id: 'CHAT' } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(String(body['text'])).toContain('/skip');
    expect(String(body['text'])).toContain('/status');
    expect(String(body['text'])).toContain('/help');
    expect(String(body['text'])).toContain('/delete_signal');
    expect(state.updateCalls).toHaveLength(0);
  });

  it('/delete_signal <valid-uuid>: soft-deletes signal and sends confirmation', async () => {
    const state = freshState({
      signalRows: [{ id: VALID_UUID, isDeleted: false }],
    });
    const { deps, fetchFn } = makeDeps(state);
    const { bot, registered } = makeBot();
    registerCommands(bot, deps);

    await registered.delete_signal!({
      chat: { id: 'CHAT' },
      match: VALID_UUID,
    });
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]!.set['isDeleted']).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(String(body['text'])).toContain(VALID_UUID);
    expect(String(body['text'])).toContain('deleted');
  });

  it('/delete_signal <invalid-uuid>: error reply, no DB writes', async () => {
    const state = freshState();
    const { deps, fetchFn } = makeDeps(state);
    const { bot, registered } = makeBot();
    registerCommands(bot, deps);

    await registered.delete_signal!({
      chat: { id: 'CHAT' },
      match: 'not-a-uuid',
    });
    expect(state.updateCalls).toHaveLength(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(String(body['text'])).toMatch(/doesn&#39;t look like a valid signal id/);
  });

  it('/delete_signal <uuid-not-found>: not-found reply', async () => {
    const state = freshState({ signalRows: [] });
    const { deps, fetchFn } = makeDeps(state);
    const { bot, registered } = makeBot();
    registerCommands(bot, deps);

    await registered.delete_signal!({
      chat: { id: 'CHAT' },
      match: NOT_FOUND_UUID,
    });
    expect(state.updateCalls).toHaveLength(0);
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(String(body['text'])).toMatch(/Signal not found/);
  });

  it('command handlers register four distinct commands (skip / status / help / delete_signal)', () => {
    const state = freshState();
    const { deps } = makeDeps(state);
    const commandSpy = vi.fn();
    const bot: BotCommandRegistry = { command: commandSpy };
    registerCommands(bot, deps);
    const names = commandSpy.mock.calls.map((c) => c[0]);
    expect(names).toEqual(['skip', 'status', 'help', 'delete_signal']);
  });

  it('HTML-escape regression: /status output escapes a malicious proposed_title', async () => {
    const sessionMap = new SessionMap();
    sessionMap.recordOpened('CHAT', {
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      openedAt: new Date(),
    });
    const state = freshState({
      candidateRow: {
        proposedTitle: '<script>alert(1)</script>',
        status: 'awaiting_interview',
      },
      sessionRow: { status: 'confirming', questions: [{}, {}] },
    });
    const { deps, fetchFn } = makeDeps(state, sessionMap);
    const { bot, registered } = makeBot();
    registerCommands(bot, deps);

    await registered.status!({ chat: { id: 'CHAT' } });
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    const text = String(body['text']);
    expect(text).toContain('&lt;script&gt;');
    expect(text).not.toContain('<script>alert');
  });
});
