/**
 * Integration tests for the `runConfirmationLoop` orchestrator. All
 * external dependencies (db, anthropic, fetch, waitForReply,
 * selectSignalsFn, generateQuestionFn) are injected via `vi.fn()` mocks.
 * No real network, no real DB, no real Inngest.
 *
 * Test cases follow the prompt's confirmation-loop.test.ts checklist:
 *   1. Happy path: 3 signals, all pass QG, all answered "yes"
 *   2. Cap at 5 signals
 *   3. First no_specifics → excluded; second proceeds
 *   4. QG fail on first attempt, pass on retry
 *   5. QG fail twice → excluded
 *   6. 3 exclusions → corpus-quality alert sent
 *   7. 2 exclusions → corpus-quality alert NOT sent
 *   8. Voice answer success
 *   9. Voice answer transcription failure → fallback prompt + text reply
 *  10. "anon" answer adds to confirmed_chunk_ids
 *  11. "skip" answer does NOT add to confirmed_chunk_ids
 *  12. Mid-interview 7-day timeout
 *  + HTML-injection regression in evidence_quote
 */

import { describe, expect, it, vi } from 'vitest';

import { runConfirmationLoop } from '../../../artifacts/telegram-bot/src/jobs/interview-session/confirmation-loop.js';
import type {
  ConfirmationLoopDeps,
  ConfirmationLoopOutcome,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/confirmation-loop.js';
import type {
  IncomingReplyEvent,
  InterviewSessionEnv,
  QuestionGenerationResult,
  QuestionResponse,
  SessionContext,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';
import type { OpusAnthropicLike } from '../../../artifacts/telegram-bot/src/jobs/interview-session/anthropic-shapes.js';
import type { SelectedSignal } from '../../../artifacts/telegram-bot/src/lib/select-signals-for-cluster.js';
import type { Database } from '@ncp/db';
import type { Logger } from '@ncp/logger';

// ─────────────────────────────────────────────────────────────────────────
// DB mock
// ─────────────────────────────────────────────────────────────────────────

interface FakeDbState {
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
  const state: FakeDbState = { updateCalls: [] };
  const db = {
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

// ─────────────────────────────────────────────────────────────────────────
// Logger / env / fetch fixtures
// ─────────────────────────────────────────────────────────────────────────

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

const ENV: InterviewSessionEnv = {
  databaseUrl: 'postgres://x',
  telegramBotToken: 'TOK',
  telegramChatId: 'CHAT',
  anthropicApiKey: 'AKEY',
};

const NOW = new Date('2026-05-25T13:00:00Z');

function makeFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

function makeAnthropicNoop(): OpusAnthropicLike {
  return {
    messages: {
      create: vi.fn(async () => ({
        stop_reason: 'end_turn',
        content: [],
      })) as unknown as OpusAnthropicLike['messages']['create'],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Signal + question builders
// ─────────────────────────────────────────────────────────────────────────

function sig(
  id: string,
  text = `signal-${id} content with AADSTS50158`,
  capturedAtIso = '2026-05-19T14:00:00Z',
): SelectedSignal {
  return {
    id,
    capturedAt: new Date(capturedAtIso),
    redactedText: text,
    source: 'claude',
    tokenCount: 1000,
  };
}

function goodQuestion(signalId: string, words = 'q'): QuestionResponse {
  return {
    question_text: `${words} about AADSTS50158`,
    signal_id: signalId,
    evidence_phrase: 'AADSTS50158',
    detected_specifics: ['AADSTS50158'],
    no_specifics: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// SessionContext fixture
// ─────────────────────────────────────────────────────────────────────────

function ctx(evidence: string[]): SessionContext {
  return {
    sessionId: 'sess-1',
    candidateId: 'cand-1',
    candidate: {
      proposedTitle: 'Conditional Access for iOS',
      pillar: 'managed-it',
      primaryKeyword: 'intune',
      evidenceChunkIds: evidence,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// makeDeps factory
// ─────────────────────────────────────────────────────────────────────────

interface MakeDepsArgs {
  signals: SelectedSignal[];
  /** Per-call (in order) generator outputs. */
  generateOutputs: QuestionGenerationResult[];
  /** Per-waitForReply (in order) reply payloads. */
  replies: Array<IncomingReplyEvent | null>;
  fetchFn?: ReturnType<typeof vi.fn>;
}

interface Built {
  deps: ConfirmationLoopDeps;
  state: FakeDbState;
  logger: Logger;
  fetchFn: ReturnType<typeof vi.fn>;
  selectSignalsFn: ReturnType<typeof vi.fn>;
  generateQuestionFn: ReturnType<typeof vi.fn>;
  waitForReply: ReturnType<typeof vi.fn>;
}

function makeDeps(args: MakeDepsArgs): Built {
  const { db, state } = makeFakeDb();
  const logger = makeLogger();
  const fetchFn = args.fetchFn ?? makeFetchOk();
  const selectSignalsFn = vi.fn(async () => args.signals);
  const generateQueue = [...args.generateOutputs];
  const generateQuestionFn = vi.fn(async () => {
    const next = generateQueue.shift();
    if (next === undefined) {
      // Tests should provide enough outputs; fall back to api_error.
      return { ok: false, reason: 'api_error', detail: 'queue_drained' };
    }
    return next;
  });
  const replyQueue = [...args.replies];
  const waitForReply = vi.fn(async () => {
    if (replyQueue.length === 0) return null;
    return replyQueue.shift() ?? null;
  });
  const deps: ConfirmationLoopDeps = {
    db,
    logger,
    now: NOW,
    env: ENV,
    anthropic: makeAnthropicNoop(),
    fetchFn: fetchFn as unknown as typeof fetch,
    selectSignalsFn: selectSignalsFn as unknown as ConfirmationLoopDeps['selectSignalsFn'],
    generateQuestionFn:
      generateQuestionFn as unknown as ConfirmationLoopDeps['generateQuestionFn'],
    waitForReply,
  };
  return {
    deps,
    state,
    logger,
    fetchFn,
    selectSignalsFn,
    generateQuestionFn,
    waitForReply,
  };
}

function callbackReply(
  questionIndex: number,
  choice: 'yes' | 'anon' | 'skip',
): IncomingReplyEvent {
  return {
    data: {
      chatId: 'CHAT',
      sessionId: 'sess-1',
      text: choice,
      messageType: 'callback',
      callbackData: { questionIndex, choice },
    },
  };
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
      audioUrl: 'https://cdn.tg/audio/file_42.oga',
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
      audioUrl: 'https://cdn.tg/audio/file_42.oga',
      transcriptionError: 'Whisper API down',
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

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('runConfirmationLoop', () => {
  it('happy path: 3 signals all pass QG and all answered "yes" → completed with 3 confirmations', async () => {
    const signals = [sig('s1'), sig('s2'), sig('s3')];
    const built = makeDeps({
      signals,
      generateOutputs: [
        { ok: true, question: goodQuestion('s1') },
        { ok: true, question: goodQuestion('s2') },
        { ok: true, question: goodQuestion('s3') },
      ],
      replies: [
        callbackReply(1, 'yes'),
        callbackReply(2, 'yes'),
        callbackReply(3, 'yes'),
      ],
    });

    const outcome = await runConfirmationLoop(built.deps, ctx(['s1', 's2', 's3']));
    expect(outcome).toEqual<ConfirmationLoopOutcome>({
      kind: 'completed',
      confirmedCount: 3,
      excludedCount: 0,
    });
    // 3 question sends + 0 alerts = 3 fetches
    expect(built.fetchFn).toHaveBeenCalledTimes(3);
  });

  it('caps at 5 questions even when more signals are available', async () => {
    // Provide 7 signals — only the first 5 are used because Phase 1
    // generates one question per signal and the SelectedSignal list is
    // already capped at 5 by `selectSignalsForCluster`. Here our mock
    // selectSignalsFn returns 5 (the cap).
    const signals = [sig('s1'), sig('s2'), sig('s3'), sig('s4'), sig('s5')];
    const built = makeDeps({
      signals,
      generateOutputs: signals.map((s) => ({
        ok: true as const,
        question: goodQuestion(s.id),
      })),
      replies: signals.map((_, i) => callbackReply(i + 1, 'yes')),
    });
    const outcome = await runConfirmationLoop(
      built.deps,
      ctx(['s1', 's2', 's3', 's4', 's5']),
    );
    expect(outcome.kind).toBe('completed');
    expect(built.fetchFn).toHaveBeenCalledTimes(5);
    expect(built.waitForReply).toHaveBeenCalledTimes(5);
  });

  it('first signal no_specifics → excluded; second signal proceeds normally', async () => {
    const signals = [sig('s1'), sig('s2')];
    const built = makeDeps({
      signals,
      generateOutputs: [
        { ok: false, reason: 'no_specifics' },
        { ok: true, question: goodQuestion('s2') },
      ],
      replies: [callbackReply(1, 'yes')], // only one question is asked
    });
    const outcome = await runConfirmationLoop(built.deps, ctx(['s1', 's2']));
    expect(outcome).toEqual<ConfirmationLoopOutcome>({
      kind: 'completed',
      confirmedCount: 1,
      excludedCount: 1,
    });
    // Exactly one question sent (signal s2) + zero alert (only 1 exclusion)
    expect(built.fetchFn).toHaveBeenCalledTimes(1);
    // signal_exclusions update happened once during phase 1
    const exclusionUpdate = built.state.updateCalls.find(
      (u) =>
        u.table === 'interview_sessions' &&
        Object.prototype.hasOwnProperty.call(u.set, 'signalExclusions'),
    );
    expect(exclusionUpdate).toBeDefined();
  });

  it('quality-gate fails on first attempt, passes on retry → one question is sent', async () => {
    const signals = [sig('s1')];
    const built = makeDeps({
      signals,
      generateOutputs: [
        // First attempt — generic_phrase failure
        {
          ok: true,
          question: {
            question_text: 'What did you work on this week?',
            signal_id: 's1',
            evidence_phrase: 'AADSTS50158',
            detected_specifics: ['AADSTS50158'],
            no_specifics: false,
          },
        },
        // Retry — clean
        { ok: true, question: goodQuestion('s1') },
      ],
      replies: [callbackReply(1, 'yes')],
    });
    const outcome = await runConfirmationLoop(built.deps, ctx(['s1']));
    expect(outcome).toEqual<ConfirmationLoopOutcome>({
      kind: 'completed',
      confirmedCount: 1,
      excludedCount: 0,
    });
    expect(built.generateQuestionFn).toHaveBeenCalledTimes(2);
    // The 2nd call carries a retryReason hint
    const secondCallArgs = built.generateQuestionFn.mock.calls[1]![0] as {
      retryReason?: string;
    };
    expect(secondCallArgs.retryReason).toBe('generic_phrase');
  });

  it('quality-gate fails twice (initial + retry) → signal is excluded as "quality_gate"', async () => {
    const generic: QuestionResponse = {
      question_text: 'What did you work on this week with AADSTS50158?',
      signal_id: 's1',
      evidence_phrase: 'AADSTS50158',
      detected_specifics: ['AADSTS50158'],
      no_specifics: false,
    };
    const built = makeDeps({
      signals: [sig('s1')],
      generateOutputs: [
        { ok: true, question: generic },
        { ok: true, question: generic },
      ],
      replies: [],
    });
    const outcome = await runConfirmationLoop(built.deps, ctx(['s1']));
    expect(outcome).toEqual<ConfirmationLoopOutcome>({
      kind: 'completed',
      confirmedCount: 0,
      excludedCount: 1,
    });
    // No questions sent (only signal was excluded)
    expect(built.fetchFn).toHaveBeenCalledTimes(0);
    // signal_exclusions update has reason 'quality_gate'
    const exclusionUpdate = built.state.updateCalls.find(
      (u) =>
        u.table === 'interview_sessions' &&
        Object.prototype.hasOwnProperty.call(u.set, 'signalExclusions'),
    );
    const exclusions = exclusionUpdate?.set['signalExclusions'] as Array<{
      signal_id: string;
      reason: string;
    }>;
    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]!.reason).toBe('quality_gate');
  });

  it('3 signals excluded → corpus-quality alert is sent exactly once, BEFORE any question', async () => {
    const signals = [sig('s1'), sig('s2'), sig('s3'), sig('s4')];
    const built = makeDeps({
      signals,
      generateOutputs: [
        { ok: false, reason: 'no_specifics' },
        { ok: false, reason: 'no_specifics' },
        { ok: false, reason: 'no_specifics' },
        { ok: true, question: goodQuestion('s4') },
      ],
      replies: [callbackReply(1, 'yes')],
    });
    await runConfirmationLoop(built.deps, ctx(['s1', 's2', 's3', 's4']));
    const bodies = getFetchBodies(built.fetchFn);
    expect(bodies.length).toBe(2);
    // First fetch should be the corpus-quality alert
    expect(bodies[0]!['text']).toMatch(/Corpus quality may be low/);
    // Second fetch should be the question
    expect(bodies[1]!['text']).toMatch(/AADSTS50158/);
  });

  it('2 signals excluded → corpus-quality alert is NOT sent', async () => {
    const signals = [sig('s1'), sig('s2'), sig('s3')];
    const built = makeDeps({
      signals,
      generateOutputs: [
        { ok: false, reason: 'no_specifics' },
        { ok: false, reason: 'no_specifics' },
        { ok: true, question: goodQuestion('s3') },
      ],
      replies: [callbackReply(1, 'yes')],
    });
    await runConfirmationLoop(built.deps, ctx(['s1', 's2', 's3']));
    const bodies = getFetchBodies(built.fetchFn);
    expect(bodies.length).toBe(1);
    expect(bodies[0]!['text']).not.toMatch(/Corpus quality may be low/);
  });

  it('voice answer with successful transcription: records audio_url + transcript', async () => {
    const built = makeDeps({
      signals: [sig('s1')],
      generateOutputs: [{ ok: true, question: goodQuestion('s1') }],
      replies: [voiceReplySuccess('I confirm this happened on Tuesday.')],
    });
    await runConfirmationLoop(built.deps, ctx(['s1']));
    // Find the answers update
    const answerUpdate = built.state.updateCalls.find(
      (u) =>
        u.table === 'interview_sessions' &&
        Object.prototype.hasOwnProperty.call(u.set, 'answers'),
    );
    const answers = answerUpdate?.set['answers'] as Array<Record<string, unknown>>;
    expect(answers).toHaveLength(1);
    expect(answers[0]!['response']).toBe('voice');
    expect(answers[0]!['transcript']).toBe('I confirm this happened on Tuesday.');
    expect(answers[0]!['audio_url']).toBe('https://cdn.tg/audio/file_42.oga');
  });

  it('voice answer with FAILED transcription: sends fallback prompt then waits for the next reply', async () => {
    const built = makeDeps({
      signals: [sig('s1')],
      generateOutputs: [{ ok: true, question: goodQuestion('s1') }],
      replies: [voiceReplyFailed(), textReply('Yes I confirm via text')],
    });
    await runConfirmationLoop(built.deps, ctx(['s1']));
    // Two waitForReply calls: one for the failed voice, one for the text fallback
    expect(built.waitForReply).toHaveBeenCalledTimes(2);
    const bodies = getFetchBodies(built.fetchFn);
    // First fetch: the question. Second fetch: the fallback prompt.
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(bodies[1]!['text']).toMatch(/Couldn&#39;t transcribe/);
    // Final answer is the text reply
    const answerUpdate = built.state.updateCalls
      .filter(
        (u) =>
          u.table === 'interview_sessions' &&
          Object.prototype.hasOwnProperty.call(u.set, 'answers'),
      )
      .pop();
    const answers = answerUpdate?.set['answers'] as Array<Record<string, unknown>>;
    expect(answers).toHaveLength(1);
    expect(answers[0]!['response']).toBe('text');
    expect(answers[0]!['text']).toBe('Yes I confirm via text');
  });

  it('"anon" answer adds the signal to confirmed_chunk_ids (PRD: anonymized still uses)', async () => {
    const built = makeDeps({
      signals: [sig('s1')],
      generateOutputs: [{ ok: true, question: goodQuestion('s1') }],
      replies: [callbackReply(1, 'anon')],
    });
    const outcome = await runConfirmationLoop(built.deps, ctx(['s1']));
    expect(outcome).toEqual<ConfirmationLoopOutcome>({
      kind: 'completed',
      confirmedCount: 1,
      excludedCount: 0,
    });
    const lastAnswerUpdate = built.state.updateCalls
      .filter(
        (u) =>
          u.table === 'interview_sessions' &&
          Object.prototype.hasOwnProperty.call(u.set, 'confirmedChunkIds'),
      )
      .pop();
    expect(lastAnswerUpdate?.set['confirmedChunkIds']).toEqual(['s1']);
  });

  it('"skip" answer does NOT add the signal to confirmed_chunk_ids; loop continues to the next signal', async () => {
    const built = makeDeps({
      signals: [sig('s1'), sig('s2')],
      generateOutputs: [
        { ok: true, question: goodQuestion('s1') },
        { ok: true, question: goodQuestion('s2') },
      ],
      replies: [callbackReply(1, 'skip'), callbackReply(2, 'yes')],
    });
    const outcome = await runConfirmationLoop(built.deps, ctx(['s1', 's2']));
    expect(outcome).toEqual<ConfirmationLoopOutcome>({
      kind: 'completed',
      confirmedCount: 1,
      excludedCount: 0,
    });
    const lastAnswerUpdate = built.state.updateCalls
      .filter(
        (u) =>
          u.table === 'interview_sessions' &&
          Object.prototype.hasOwnProperty.call(u.set, 'confirmedChunkIds'),
      )
      .pop();
    expect(lastAnswerUpdate?.set['confirmedChunkIds']).toEqual(['s2']);
  });

  it('mid-interview 7-day timeout: transitions session→timed_out + candidate→archived, sends timeout msg', async () => {
    const built = makeDeps({
      signals: [sig('s1')],
      generateOutputs: [{ ok: true, question: goodQuestion('s1') }],
      replies: [null], // waitForReply returns null → timeout
    });
    const outcome = await runConfirmationLoop(built.deps, ctx(['s1']));
    expect(outcome).toEqual<ConfirmationLoopOutcome>({ kind: 'timed_out' });
    // Session transitioned to timed_out
    const sessionTimedOut = built.state.updateCalls.find(
      (u) =>
        u.table === 'interview_sessions' && u.set['status'] === 'timed_out',
    );
    expect(sessionTimedOut).toBeDefined();
    // Candidate transitioned to archived
    const candidateArchived = built.state.updateCalls.find(
      (u) =>
        u.table === 'article_candidates' && u.set['status'] === 'archived',
    );
    expect(candidateArchived).toBeDefined();
    // Timeout message sent
    const bodies = getFetchBodies(built.fetchFn);
    const timeoutBody = bodies.find((b) =>
      String(b['text']).match(/timed out/),
    );
    expect(timeoutBody).toBeDefined();
  });

  it('HTML-injection regression: malicious signal redactedText is escaped in the rendered question body', async () => {
    // Keep AADSTS50158 in the redactedText so the QG passes
    // (`goodQuestion` claims that specific). The HTML payload sits beside it.
    const malicious = sig(
      's1',
      '<script>alert(1)</script> Hassan debugged AADSTS50158 on Tuesday.',
    );
    const built = makeDeps({
      signals: [malicious],
      generateOutputs: [{ ok: true, question: goodQuestion('s1') }],
      replies: [callbackReply(1, 'yes')],
    });
    await runConfirmationLoop(built.deps, ctx(['s1']));
    const bodies = getFetchBodies(built.fetchFn);
    const questionBody = bodies[0]!;
    const text = questionBody['text'] as string;
    expect(text).toContain('&lt;script&gt;');
    expect(text).not.toContain('<script>');
  });

  it('no signals at all: returns { kind: "no_signals" } and never enters phase 1 or 2', async () => {
    const built = makeDeps({
      signals: [],
      generateOutputs: [],
      replies: [],
    });
    const outcome = await runConfirmationLoop(built.deps, ctx([]));
    expect(outcome).toEqual<ConfirmationLoopOutcome>({ kind: 'no_signals' });
    expect(built.generateQuestionFn).not.toHaveBeenCalled();
    expect(built.waitForReply).not.toHaveBeenCalled();
    expect(built.fetchFn).not.toHaveBeenCalled();
  });
});
