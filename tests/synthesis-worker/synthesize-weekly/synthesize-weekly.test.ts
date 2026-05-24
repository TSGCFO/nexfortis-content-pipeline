/**
 * Integration tests for `runSynthesizeWeekly` — the DI-friendly inner core
 * of the synthesize-weekly cron. Tests inject `db`, `anthropic`, `fetchFn`,
 * and `sendInngestEvent` so no real network or DB is touched.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readEnv, runSynthesizeWeekly } from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/index.js';
import { EnvNotConfiguredError } from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/errors.js';
import type {
  AnthropicLike,
  RunSynthesizeWeeklyDeps,
} from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/index.js';
import type { Logger } from '@ncp/logger';

// --- DB mock --------------------------------------------------------------

interface FakeDb {
  selectRows: Array<{
    id: string;
    capturedAt: Date;
    redactedText: string;
    embedding: number[] | null;
  }>;
  insertCalls: Array<{ table: string; values: unknown[] }>;
  returningQueues: Map<string, Array<Array<{ id: string }>>>;
}

function makeFakeDb(opts: {
  selectRows: FakeDb['selectRows'];
  topClusterId?: string;
  candidateId?: string;
}): { db: unknown; state: FakeDb } {
  const state: FakeDb = {
    selectRows: opts.selectRows,
    insertCalls: [],
    returningQueues: new Map(),
  };
  state.returningQueues.set('synthesis_clusters', [
    [{ id: opts.topClusterId ?? 'cluster-uuid-top' }],
  ]);
  state.returningQueues.set('article_candidates', [
    [{ id: opts.candidateId ?? 'candidate-uuid-1' }],
  ]);

  // Build a chainable mock matching drizzle's select(...).from(...).where(...)
  // and insert(...).values(...).returning(...) shapes.
  const db = {
    select(_cols: unknown) {
      return {
        from(_table: unknown) {
          return {
            where(_w: unknown) {
              return Promise.resolve(state.selectRows);
            },
          };
        },
      };
    },
    insert(table: { _: { name?: string } } | unknown) {
      // drizzle tables expose a Symbol-keyed name; for our test simply
      // capture by reference to inspect call ordering.
      const tableName = inferTableName(table);
      return {
        values(values: unknown) {
          const valuesArr = Array.isArray(values) ? values : [values];
          state.insertCalls.push({ table: tableName, values: valuesArr });
          const queue = state.returningQueues.get(tableName);
          const nextReturning = queue?.shift() ?? [];
          return {
            returning(_cols: unknown) {
              return Promise.resolve(nextReturning);
            },
            then(onFulfilled: (v: unknown) => unknown) {
              // Allow `await db.insert(...).values(...)` (no .returning()).
              return Promise.resolve(undefined).then(onFulfilled);
            },
          };
        },
      };
    },
  };

  return { db, state };
}

function inferTableName(table: unknown): string {
  // Look up the Drizzle internal symbol name; fall back to a best-effort
  // string. The two tables we touch are synthesisClusters and
  // articleCandidates, each set up by the schema with a fixed name.
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

// --- Anthropic mock -------------------------------------------------------

interface ScriptedAnthropic {
  client: AnthropicLike;
  calls: Array<{ model: string; content: string }>;
}

function makeAnthropic(
  responder: (model: string, content: string, callIndex: number) => string | Error,
): ScriptedAnthropic {
  const calls: ScriptedAnthropic['calls'] = [];
  const client: AnthropicLike = {
    messages: {
      create: vi.fn(async (args) => {
        const userMsg = args.messages.find((m) => m.role === 'user');
        const content = userMsg?.content ?? '';
        calls.push({ model: args.model, content });
        const r = responder(args.model, content, calls.length - 1);
        if (r instanceof Error) throw r;
        return { content: [{ type: 'text', text: r }] };
      }),
    },
  };
  return { client, calls };
}

// --- Logger mock ----------------------------------------------------------

function makeLogger(): Logger {
  const noop = vi.fn();
  return {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
  };
}

// --- Embedding helper -----------------------------------------------------

function unitVec(theta: number): number[] {
  return [Math.cos(theta), Math.sin(theta), 0, 0];
}

// Build N signals clustered at angle theta_base with tiny perturbations so
// they all pairwise-similarity above the 0.72 threshold. (cos(0.1)≈0.995.)
function clusteredSignals(
  prefix: string,
  count: number,
  capturedAt: Date,
  thetaBase: number,
): FakeDb['selectRows'] {
  const rows: FakeDb['selectRows'] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: `${prefix}-${i.toString().padStart(2, '0')}`,
      capturedAt,
      redactedText: `text from ${prefix} ${i}`,
      embedding: unitVec(thetaBase + i * 0.01),
    });
  }
  return rows;
}

// --- Common helpers -------------------------------------------------------

function makeFetchOk(): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ ok: true, result: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

interface BuildDepsInput {
  selectRows: FakeDb['selectRows'];
  anthropic: AnthropicLike;
  fetchFn?: typeof fetch;
  now?: Date;
  topClusterId?: string;
  candidateId?: string;
}

function buildDeps(input: BuildDepsInput): {
  deps: RunSynthesizeWeeklyDeps;
  fakeDb: FakeDb;
  sendInngestEvent: ReturnType<typeof vi.fn>;
  fetchFn: typeof fetch;
} {
  const { db, state } = makeFakeDb({
    selectRows: input.selectRows,
    ...(input.topClusterId !== undefined ? { topClusterId: input.topClusterId } : {}),
    ...(input.candidateId !== undefined ? { candidateId: input.candidateId } : {}),
  });
  const sendInngestEvent = vi.fn(async () => undefined);
  const fetchFn = input.fetchFn ?? makeFetchOk();
  const deps: RunSynthesizeWeeklyDeps = {
    db: db as RunSynthesizeWeeklyDeps['db'],
    anthropic: input.anthropic,
    logger: makeLogger(),
    fetchFn,
    sendInngestEvent,
    env: { telegramBotToken: 'TOKEN', telegramChatId: 'CHATID' },
    ...(input.now !== undefined ? { now: input.now } : {}),
  };
  return { deps, fakeDb: state, sendInngestEvent, fetchFn };
}

// --- Test cases -----------------------------------------------------------

const NOW = new Date('2026-05-24T07:00:00Z'); // Sunday

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-05-24T07:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('runSynthesizeWeekly', () => {
  it('happy path: clusters → labels → classifies in-pillar → persists + dispatches + sends Telegram', async () => {
    // 10 signals captured yesterday, all near same angle → 1 cluster of 10.
    const yesterday = new Date('2026-05-23T12:00:00Z');
    const selectRows = clusteredSignals('sig', 10, yesterday, 0.1);

    const { client, calls } = makeAnthropic((_model, content) => {
      // Use prompt content to dispatch.
      if (content.includes('Output JSON only')) {
        // Sonnet labeler (assistant turn was prefilled with '{').
        return '"label":"Intune CA for iOS","topicKeywords":["intune","aad","ios"]}';
      }
      if (content.includes('OFF_PILLAR')) {
        // Haiku classifier.
        return 'managed-it';
      }
      if (content.includes('Write ONE proposed title')) {
        // Sonnet title generator.
        return 'Configuring Conditional Access for iOS Authenticator';
      }
      return 'UNEXPECTED';
    });

    const { deps, fakeDb, sendInngestEvent, fetchFn } = buildDeps({
      selectRows,
      anthropic: client,
      now: NOW,
      candidateId: 'happy-candidate',
    });

    const { outcome, summary } = await runSynthesizeWeekly(deps);

    // Inspect Anthropic call sequence.
    expect(calls.length).toBeGreaterThanOrEqual(3); // labeler + classifier + title

    // synthesis_clusters insert called twice (top alone, then nothing else
    // since there are no other active clusters and no discards). With one
    // cluster and no discards, the "others batch" insert is skipped.
    const clusterInserts = fakeDb.insertCalls.filter(
      (c) => c.table === 'synthesis_clusters',
    );
    expect(clusterInserts.length).toBeGreaterThanOrEqual(1);
    const topRow = clusterInserts[0]!.values[0] as Record<string, unknown>;
    expect(topRow['status']).toBe('active');
    expect(topRow['clusterLabel']).toBe('Intune CA for iOS');

    const candidateInserts = fakeDb.insertCalls.filter(
      (c) => c.table === 'article_candidates',
    );
    expect(candidateInserts).toHaveLength(1);
    const candidate = candidateInserts[0]!.values[0] as Record<string, unknown>;
    expect(candidate['pillar']).toBe('managed-it');
    expect(candidate['proposedTitle']).toBe(
      'Configuring Conditional Access for iOS Authenticator',
    );
    expect(candidate['primaryKeyword']).toBe('intune');
    expect(Array.isArray(candidate['evidenceChunkIds'])).toBe(true);
    expect((candidate['evidenceChunkIds'] as string[]).length).toBe(10);
    expect(candidate['serpGaps']).toEqual([]);

    expect(sendInngestEvent).toHaveBeenCalledTimes(1);
    expect(sendInngestEvent.mock.calls[0]?.[0]).toEqual({
      name: 'interview.session.requested',
      data: { candidateId: 'happy-candidate' },
    });

    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

    expect(outcome.kind).toBe('success');
    if (outcome.kind === 'success') {
      expect(outcome.candidateId).toBe('happy-candidate');
      expect(outcome.clusterCount).toBe(1);
      expect(outcome.telegramSent).toBe(true);
    }
    expect(summary.signalsConsidered).toBe(10);
    expect(summary.clustersActive).toBe(1);
    expect(summary.outcome).toBe('success');
  });

  it('zero signals: returns no_signals, sends Telegram alert, no DB writes, no event', async () => {
    const { client } = makeAnthropic(() => 'never called');
    const { deps, fakeDb, sendInngestEvent, fetchFn } = buildDeps({
      selectRows: [],
      anthropic: client,
      now: NOW,
    });

    const { outcome } = await runSynthesizeWeekly(deps);

    expect(outcome).toEqual({ kind: 'no_signals' });
    expect(fakeDb.insertCalls).toEqual([]);
    expect(sendInngestEvent).not.toHaveBeenCalled();
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    const initBody = JSON.parse(
      ((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit)
        .body as string,
    ) as Record<string, unknown>;
    expect(initBody['text']).toMatch(/No capture signals/);
  });

  it('all off-pillar: persists discarded rows + no candidate, returns no_qualifying_clusters', async () => {
    const yesterday = new Date('2026-05-23T12:00:00Z');
    // Two well-separated clusters that each have 3+ signals.
    const c1 = clusteredSignals('aa', 3, yesterday, 0.0);
    const c2 = clusteredSignals('bb', 3, yesterday, 2.5);
    const c3 = clusteredSignals('cc', 3, yesterday, 5.0); // 5.0 rad
    const selectRows = [...c1, ...c2, ...c3];

    const { client } = makeAnthropic((_model, content) => {
      if (content.includes('Output JSON only')) {
        return '"label":"Some off-pillar topic","topicKeywords":["k1","k2","k3"]}';
      }
      if (content.includes('OFF_PILLAR')) {
        return 'OFF_PILLAR';
      }
      return 'UNEXPECTED';
    });

    const { deps, fakeDb, sendInngestEvent } = buildDeps({
      selectRows,
      anthropic: client,
      now: NOW,
    });

    const { outcome } = await runSynthesizeWeekly(deps);
    expect(outcome).toEqual({ kind: 'no_qualifying_clusters' });

    const clusterInserts = fakeDb.insertCalls.filter(
      (c) => c.table === 'synthesis_clusters',
    );
    expect(clusterInserts).toHaveLength(1);
    const inserted = clusterInserts[0]!.values as Array<Record<string, unknown>>;
    expect(inserted.length).toBeGreaterThanOrEqual(3);
    for (const row of inserted) {
      expect(row['status']).toBe('discarded');
      const gap = row['serpGap'] as Record<string, unknown>;
      expect(gap['discarded_reason']).toBe('off_pillar');
      expect(gap['haiku_classification']).toBe('OFF_PILLAR');
    }

    const candidateInserts = fakeDb.insertCalls.filter(
      (c) => c.table === 'article_candidates',
    );
    expect(candidateInserts).toHaveLength(0);
    expect(sendInngestEvent).not.toHaveBeenCalled();
  });

  it('one labeling failure + one valid cluster: persists 1 discarded + 1 active + 1 candidate', async () => {
    const yesterday = new Date('2026-05-23T12:00:00Z');
    const goodCluster = clusteredSignals('good', 4, yesterday, 0.0);
    const badCluster = clusteredSignals('bad', 3, yesterday, 2.5);
    const selectRows = [...goodCluster, ...badCluster];

    let labelCallIndex = 0;
    const { client } = makeAnthropic((_model, content) => {
      if (content.includes('Output JSON only')) {
        labelCallIndex += 1;
        // First cluster is labeled coherently; second returns the incoherent sentinel.
        if (labelCallIndex === 1) {
          return '"label":"Valid topic","topicKeywords":["kw1","kw2","kw3"]}';
        }
        return '"label":"ERROR:INCOHERENT","topicKeywords":[]}';
      }
      if (content.includes('OFF_PILLAR')) {
        return 'quickbooks';
      }
      if (content.includes('Write ONE proposed title')) {
        return 'A good title';
      }
      return 'UNEXPECTED';
    });

    const { deps, fakeDb, sendInngestEvent } = buildDeps({
      selectRows,
      anthropic: client,
      now: NOW,
    });

    const { outcome } = await runSynthesizeWeekly(deps);
    expect(outcome.kind).toBe('success');

    const clusterInserts = fakeDb.insertCalls.filter(
      (c) => c.table === 'synthesis_clusters',
    );
    // Two insert calls: the top-cluster insert + the "others" batch.
    expect(clusterInserts).toHaveLength(2);
    const top = clusterInserts[0]!.values[0] as Record<string, unknown>;
    expect(top['status']).toBe('active');
    const others = clusterInserts[1]!.values as Array<Record<string, unknown>>;
    expect(others).toHaveLength(1);
    expect(others[0]!['status']).toBe('discarded');
    const otherGap = others[0]!['serpGap'] as Record<string, unknown>;
    expect(otherGap['discarded_reason']).toBe('label_incoherent');

    expect(sendInngestEvent).toHaveBeenCalledTimes(1);
  });

  it('telegram fails: run still returns success with telegramSent=false', async () => {
    const yesterday = new Date('2026-05-23T12:00:00Z');
    const selectRows = clusteredSignals('sig', 4, yesterday, 0.1);

    const { client } = makeAnthropic((_model, content) => {
      if (content.includes('Output JSON only')) {
        return '"label":"Good topic","topicKeywords":["k1","k2","k3"]}';
      }
      if (content.includes('OFF_PILLAR')) return 'cybersecurity';
      if (content.includes('Write ONE proposed title')) return 'Title';
      return 'UNEXPECTED';
    });

    const failingFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, description: 'boom' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { deps, sendInngestEvent } = buildDeps({
      selectRows,
      anthropic: client,
      fetchFn: failingFetch,
      now: NOW,
    });

    const { outcome, summary } = await runSynthesizeWeekly(deps);
    expect(outcome.kind).toBe('success');
    if (outcome.kind === 'success') {
      expect(outcome.telegramSent).toBe(false);
    }
    expect(sendInngestEvent).toHaveBeenCalledTimes(1); // event still dispatched
    expect(summary.warnings.length).toBe(1);
    expect(summary.warnings[0]).toMatch(/telegram_send_failed/);
  });
});

// EnvNotConfiguredError test exercises readEnv via the public Inngest factory
// path. The DI helper runSynthesizeWeekly accepts env as a typed dep so it
// never reads process.env directly — that is exactly the contract under
// test here.
describe('readEnv', () => {
  const REQUIRED = [
    'DATABASE_URL',
    'ANTHROPIC_API_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
  ] as const;

  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws EnvNotConfiguredError listing every missing variable', () => {
    for (const name of REQUIRED) delete process.env[name];
    try {
      readEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.code).toBe('ENV_NOT_CONFIGURED');
      expect(e.missing).toEqual([...REQUIRED]);
      expect(e.message).toMatch(/DATABASE_URL/);
      expect(e.message).toMatch(/TELEGRAM_CHAT_ID/);
    }
  });

  it('throws only for empty / missing vars when others are set', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['ANTHROPIC_API_KEY'] = 'k';
    delete process.env['TELEGRAM_BOT_TOKEN'];
    process.env['TELEGRAM_CHAT_ID'] = '';
    try {
      readEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.missing).toEqual(['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']);
    }
  });

  it('returns the typed env when all are present', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['ANTHROPIC_API_KEY'] = 'akey';
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    const env = readEnv();
    expect(env).toEqual({
      databaseUrl: 'postgres://x',
      anthropicApiKey: 'akey',
      telegramBotToken: 'btoken',
      telegramChatId: 'chat',
    });
  });
});
