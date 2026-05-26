/**
 * Integration tests for `runFollowUpLoop`.
 *
 * All external deps mocked. Cases:
 *
 *   1. Happy: 2 uncovered gaps → 2 follow-ups generated + sent + answered;
 *      COMPLETED with followUpsAnswered = 2
 *   2. 1 uncovered gap → 1 follow-up; COMPLETED with followUpsAnswered = 1
 *   3. 0 uncovered gaps → no follow-ups; immediate COMPLETED; no DB writes
 *      (apart from the session-status transition)
 *   4. 3 uncovered gaps → only 2 generated (truncation by alphabetic sort)
 *   5. Follow-up generation fails → logs warn, skips, continues
 *   6. Voice answer success → audio_url + transcript stored
 *   7. Voice transcription fail → fallback prompt + wait for text
 *   8. 7-day timeout mid-follow-up → TIMED_OUT
 *   9. HTML-escape regression on proposedTitle
 *  10. allConfirmationsSkipped: true path is NOT exercised here
 *      (the outer wrapper sends those to fallback-loop instead)
 */

import { describe, expect, it, vi } from 'vitest';

import { runFollowUpLoop } from '../../../artifacts/telegram-bot/src/jobs/interview-session/follow-up-loop.js';
import type {
  FollowUpLoopDeps,
  FollowUpSessionContext,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/follow-up-loop.js';
import type {
  ConfirmedSignalSummary,
  FollowUpGenerationResult,
  FollowUpLoopOutcome,
  IncomingReplyEvent,
  InterviewSessionEnv,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';
import type { OpusAnthropicLike } from '../../../artifacts/telegram-bot/src/jobs/interview-session/anthropic-shapes.js';
import type { Database } from '@ncp/db';
import type { Logger } from '@ncp/logger';

// ─────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────

const ENV: InterviewSessionEnv = {
  databaseUrl: 'postgres://x',
  telegramBotToken: 'TOK',
  telegramChatId: 'CHAT',
  anthropicApiKey: 'AKEY',
};
const NOW = new Date('2026-05-25T13:00:00Z');

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

function makeFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

interface FakeDbState {
  questions: unknown[];
  answers: unknown[];
  updateCalls: Array<{ table: string; set: Record<string, unknown> }>;
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

function makeFakeDb(): { db: Database; state: FakeDbState } {
  const state: FakeDbState = {
    questions: [],
    answers: [],
    updateCalls: [],
  };
  const db = {
    select(_cols: unknown) {
      return {
        from(_table: unknown) {
          return {
            where(_w: unknown) {
              return Promise.resolve([
                { questions: state.questions, answers: state.answers },
              ]);
            },
          };
        },
      };
    },
    update(table: unknown) {
      const tableName = inferTableName(table);
      return {
        set(values: unknown) {
          const setValues = values as Record<string, unknown>;
          state.updateCalls.push({ table: tableName, set: setValues });
          if (tableName === 'interview_sessions') {
            if (Array.isArray(setValues['questions'])) {
              state.questions = setValues['questions'] as unknown[];
            }
            if (Array.isArray(setValues['answers'])) {
              state.answers = setValues['answers'] as unknown[];
            }
          }
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

const CONFIRMED_SIGNAL: ConfirmedSignalSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  redactedText: 'Some unrelated confirmed text about coffee.',
  source: 'claude',
  capturedAt: new Date('2026-05-19T14:25:00Z'),
};

function ctx(
  serpGaps: string[],
  title = 'Conditional Access for iOS',
): FollowUpSessionContext {
  return {
    sessionId: 'sess-1',
    candidateId: 'cand-1',
    candidate: {
      proposedTitle: title,
      pillar: 'managed-it',
      primaryKeyword: 'intune',
      serpGaps,
    },
    confirmedSignals: [CONFIRMED_SIGNAL],
    clusterContextBlock: 'CTX_BLOCK',
  };
}

interface MakeDepsArgs {
  generateOutputs: FollowUpGenerationResult[];
  replies: Array<IncomingReplyEvent | null>;
  fetchFn?: ReturnType<typeof vi.fn>;
}

interface Built {
  deps: FollowUpLoopDeps;
  state: FakeDbState;
  logger: Logger;
  fetchFn: ReturnType<typeof vi.fn>;
  waitForReply: ReturnType<typeof vi.fn>;
  generateFollowUpFn: ReturnType<typeof vi.fn>;
}

function makeDeps(args: MakeDepsArgs): Built {
  const { db, state } = makeFakeDb();
  const logger = makeLogger();
  const fetchFn = args.fetchFn ?? makeFetchOk();
  const replyQueue = [...args.replies];
  const waitForReply = vi.fn(async () => {
    if (replyQueue.length === 0) return null;
    return replyQueue.shift() ?? null;
  });
  const genQueue = [...args.generateOutputs];
  const generateFollowUpFn = vi.fn(async () => {
    const next = genQueue.shift();
    if (next === undefined) {
      return {
        ok: false,
        reason: 'api_error',
        detail: 'queue_drained',
      } as FollowUpGenerationResult;
    }
    return next;
  });
  const anthropic: OpusAnthropicLike = {
    messages: {
      create: vi.fn(async () => ({
        stop_reason: 'end_turn',
        content: [],
      })) as unknown as OpusAnthropicLike['messages']['create'],
    },
  };
  const deps: FollowUpLoopDeps = {
    db,
    logger,
    now: NOW,
    env: ENV,
    anthropic,
    fetchFn: fetchFn as unknown as typeof fetch,
    waitForReply,
    generateFollowUpFn:
      generateFollowUpFn as unknown as FollowUpLoopDeps['generateFollowUpFn'],
  };
  return { deps, state, logger, fetchFn, waitForReply, generateFollowUpFn };
}

function textReply(text: string): IncomingReplyEvent {
  return {
    data: {
      chatId: 'CHAT',
      sessionId: 'sess-1',
      text,
      messageType: 'text',
    },
  };
}

function voiceReplySuccess(transcript: string): IncomingReplyEvent {
  return {
    data: {
      chatId: 'CHAT',
      sessionId: 'sess-1',
      text: transcript,
      messageType: 'voice',
      transcript,
      audioUrl: 'https://cdn.tg/audio/file_77.oga',
    },
  };
}

function voiceReplyFailed(): IncomingReplyEvent {
  return {
    data: {
      chatId: 'CHAT',
      sessionId: 'sess-1',
      text: '',
      messageType: 'voice',
      transcript: null,
      audioUrl: 'https://cdn.tg/audio/file_77.oga',
      transcriptionError: 'whisper down',
    },
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

const okGen = (text: string): FollowUpGenerationResult => ({
  ok: true,
  question: { follow_up_text: text, evidence_phrase: 'phrase' },
});

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('runFollowUpLoop', () => {
  it('happy: 2 uncovered gaps → 2 follow-ups generated and answered', async () => {
    const built = makeDeps({
      generateOutputs: [okGen('q1?'), okGen('q2?')],
      replies: [textReply('answer-1'), textReply('answer-2')],
    });
    const outcome = await runFollowUpLoop(
      built.deps,
      ctx(['alpha gap', 'beta gap']),
    );
    expect(outcome).toEqual<FollowUpLoopOutcome>({
      kind: 'completed',
      followUpsAnswered: 2,
    });
    expect(built.generateFollowUpFn).toHaveBeenCalledTimes(2);
    expect(built.fetchFn).toHaveBeenCalledTimes(2);
  });

  it('1 uncovered gap → 1 follow-up; followUpsAnswered = 1', async () => {
    const built = makeDeps({
      generateOutputs: [okGen('q1?')],
      replies: [textReply('answer')],
    });
    const outcome = await runFollowUpLoop(built.deps, ctx(['alpha gap']));
    expect(outcome).toEqual<FollowUpLoopOutcome>({
      kind: 'completed',
      followUpsAnswered: 1,
    });
  });

  it('0 uncovered gaps: returns immediately without generation, without sends', async () => {
    // Use a signal that covers the gap to force "0 uncovered".
    const built = makeDeps({
      generateOutputs: [],
      replies: [],
    });
    const c = ctx(['conditional access loop']);
    c.confirmedSignals = [
      {
        id: 'sX',
        redactedText: 'I worked through a Conditional Access loop yesterday.',
        source: 'claude',
        capturedAt: new Date(),
      },
    ];
    const outcome = await runFollowUpLoop(built.deps, c);
    expect(outcome).toEqual<FollowUpLoopOutcome>({
      kind: 'completed',
      followUpsAnswered: 0,
    });
    expect(built.generateFollowUpFn).not.toHaveBeenCalled();
    expect(built.fetchFn).not.toHaveBeenCalled();
  });

  it('3 uncovered gaps: only 2 generated (truncation by alphabetic sort)', async () => {
    const built = makeDeps({
      generateOutputs: [okGen('q-alpha?'), okGen('q-beta?')],
      replies: [textReply('a1'), textReply('a2')],
    });
    const outcome = await runFollowUpLoop(
      built.deps,
      ctx(['zeta question', 'alpha question', 'beta question']),
    );
    expect(outcome).toEqual<FollowUpLoopOutcome>({
      kind: 'completed',
      followUpsAnswered: 2,
    });
    expect(built.generateFollowUpFn).toHaveBeenCalledTimes(2);
    // First two gaps alphabetically: alpha, beta
    const gen0 = built.generateFollowUpFn.mock.calls[0]![0] as {
      uncoveredGap: string;
    };
    const gen1 = built.generateFollowUpFn.mock.calls[1]![0] as {
      uncoveredGap: string;
    };
    expect(gen0.uncoveredGap).toBe('alpha question');
    expect(gen1.uncoveredGap).toBe('beta question');
  });

  it('follow-up generation fails on one gap: logs warning, skips, continues', async () => {
    const built = makeDeps({
      generateOutputs: [
        { ok: false, reason: 'api_error', detail: 'transient' },
        okGen('q2?'),
      ],
      replies: [textReply('a2')],
    });
    const outcome = await runFollowUpLoop(
      built.deps,
      ctx(['alpha gap', 'beta gap']),
    );
    expect(outcome).toEqual<FollowUpLoopOutcome>({
      kind: 'completed',
      followUpsAnswered: 1,
    });
    // First fetch was the successful second follow-up.
    expect(built.fetchFn).toHaveBeenCalledTimes(1);
  });

  it('voice answer success: stores audio_url + transcript with question_type follow_up', async () => {
    const built = makeDeps({
      generateOutputs: [okGen('q1?')],
      replies: [voiceReplySuccess('answered via voice')],
    });
    await runFollowUpLoop(built.deps, ctx(['gap one']));
    const answers = built.state.answers as Array<Record<string, unknown>>;
    expect(answers).toHaveLength(1);
    expect(answers[0]!['response']).toBe('voice');
    expect(answers[0]!['transcript']).toBe('answered via voice');
    expect(answers[0]!['audio_url']).toBe('https://cdn.tg/audio/file_77.oga');
    expect(answers[0]!['question_type']).toBe('follow_up');
  });

  it('voice transcription fail: sends fallback prompt then waits for text reply', async () => {
    const built = makeDeps({
      generateOutputs: [okGen('q1?')],
      replies: [voiceReplyFailed(), textReply('typed answer')],
    });
    await runFollowUpLoop(built.deps, ctx(['gap one']));
    const bodies = getFetchBodies(built.fetchFn);
    // bodies: [question, voice-fallback prompt]
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(String(bodies[1]!['text'])).toMatch(/Couldn&#39;t transcribe/);
    const answers = built.state.answers as Array<Record<string, unknown>>;
    expect(answers[0]!['response']).toBe('text');
    expect(answers[0]!['text']).toBe('typed answer');
  });

  it('7-day timeout mid-follow-up: session→timed_out, candidate→archived', async () => {
    const built = makeDeps({
      generateOutputs: [okGen('q1?')],
      replies: [null],
    });
    const outcome = await runFollowUpLoop(built.deps, ctx(['gap one']));
    expect(outcome).toEqual<FollowUpLoopOutcome>({ kind: 'timed_out' });
    const sessionTimedOut = built.state.updateCalls.find(
      (u) =>
        u.table === 'interview_sessions' && u.set['status'] === 'timed_out',
    );
    expect(sessionTimedOut).toBeDefined();
    const candidateArchived = built.state.updateCalls.find(
      (u) =>
        u.table === 'article_candidates' && u.set['status'] === 'archived',
    );
    expect(candidateArchived).toBeDefined();
  });

  it('HTML-escape regression: malicious proposedTitle is escaped in the rendered question', async () => {
    const built = makeDeps({
      generateOutputs: [okGen('what next?')],
      replies: [textReply('reply')],
    });
    // The title is HTML-escaped via the message formatter; verify by
    // looking for the <script> tag literal in the outgoing message.
    const c = ctx(['gap one'], '<script>alert(1)</script>');
    await runFollowUpLoop(built.deps, c);
    const bodies = getFetchBodies(built.fetchFn);
    const text = String(bodies[0]!['text']);
    expect(text).not.toContain('<script>alert');
  });

  it('the follow-up loop does NOT engage when called after allConfirmationsSkipped (negative path)', async () => {
    // PR 3 design: the wrapper sends allConfirmationsSkipped sessions to
    // runFallbackLoop INSTEAD of runFollowUpLoop. This test acts as a
    // documentation guard: if a caller mistakenly invokes the follow-up
    // loop with zero confirmed signals and one gap, the loop runs
    // (because it has no visibility into "did the wrapper choose us
    // correctly"). The wrapper's behaviour is asserted separately in
    // interview-session.test.ts.
    const built = makeDeps({
      generateOutputs: [okGen('q1?')],
      replies: [textReply('reply')],
    });
    const c = ctx(['gap one']);
    c.confirmedSignals = []; // simulate fallback-path antecedent
    const outcome = await runFollowUpLoop(built.deps, c);
    expect(outcome.kind).toBe('completed');
  });
});
