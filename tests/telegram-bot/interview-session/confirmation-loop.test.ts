/**
 * Integration tests for `runConfirmationLoop`.
 *
 * The loop is fully DI'd: db, anthropic, fetch, waitForReply, and
 * selectSignals are all injected. Each test is a deterministic scenario
 * that asserts ONE logical thing.
 *
 * No real network, no real DB, no real Inngest.
 */

import { describe, expect, it, vi } from 'vitest';

import { runConfirmationLoop } from '../../../artifacts/telegram-bot/src/jobs/interview-session/confirmation-loop.js';
import type {
  AnthropicCreateParams,
  AnthropicResponse,
  OpusAnthropicLike,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-question.js';
import type {
  CandidateForInterview,
  IncomingReplyEvent,
  InterviewSessionEnv,
  SessionContext,
  SignalForInterview,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';
import type { Database } from '@ncp/db';
import type { Logger } from '@ncp/logger';

// --- Fake DB ---------------------------------------------------------------

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

// --- Fake Anthropic --------------------------------------------------------

function validResponse(opts: {
  signalId: string;
  questionText?: string;
  specifics?: string[];
  noSpecifics?: boolean;
}): AnthropicResponse {
  // If the caller passed a UUID, use it; otherwise treat as a handle and
  // expand. This keeps tests readable when the test only cares about
  // identity ("s1") vs. tests that pin the actual UUID.
  const signalId = opts.signalId.includes('-')
    ? opts.signalId
    : uuidFor(opts.signalId);
  return {
    stop_reason: 'end_turn',
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          question_text:
            opts.questionText ?? 'Was AADSTS50158 the actual blocker?',
          signal_id: signalId,
          evidence_phrase: 'AADSTS50158',
          detected_specifics: opts.specifics ?? ['AADSTS50158'],
          no_specifics: opts.noSpecifics ?? false,
        }),
      },
    ],
  };
}

function makeAnthropic(
  impl: (
    params: AnthropicCreateParams,
    callIndex: number,
  ) => AnthropicResponse | Promise<AnthropicResponse>,
): { client: OpusAnthropicLike; create: ReturnType<typeof vi.fn> } {
  let i = 0;
  const create = vi.fn(async (params: AnthropicCreateParams) => {
    const idx = i;
    i += 1;
    return impl(params, idx);
  });
  return { client: { messages: { create } }, create };
}

// --- Helpers ---------------------------------------------------------------

const ENV: InterviewSessionEnv = {
  databaseUrl: 'postgres://x',
  telegramBotToken: 'TOK',
  telegramChatId: 'CHAT',
  openaiApiKey: 'oai',
  anthropicApiKey: 'anth',
};

/**
 * Convert a short test handle ('s1', 's2', …) into a deterministic UUID.
 * Claude's structured-output schema requires `signal_id` to be a UUID, so
 * test fixtures need to use real UUID strings even when the test cares
 * only about identity.
 */
function uuidFor(handle: string): string {
  // 12 hex digits encoded from the handle, padded.
  const hex = Buffer.from(handle).toString('hex').padEnd(12, '0').slice(0, 12);
  return `00000000-0000-0000-0000-${hex}`;
}

function makeSignal(
  id: string,
  partial: Partial<SignalForInterview> = {},
): SignalForInterview {
  return {
    id: uuidFor(id),
    source: 'claude_cowork',
    capturedAt: partial.capturedAt ?? new Date('2026-05-12T18:48:00Z'),
    redactedText:
      partial.redactedText ??
      'AADSTS50158 conditional access policy iOS Authenticator.',
    tokenCount: partial.tokenCount ?? 1000,
    isDeleted: false,
  };
}

function makeCandidate(): CandidateForInterview {
  return {
    id: 'cand-1',
    pillar: 'managed-it',
    proposedTitle: 'iOS Authenticator and Conditional Access',
    primaryKeyword: 'intune',
    evidenceChunkIds: ['s1', 's2', 's3', 's4', 's5'],
  };
}

function makeContext(): SessionContext {
  return { sessionId: 'sess-1', candidate: makeCandidate() };
}

function makeFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }),
  );
}

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

function yesReply(): IncomingReplyEvent {
  return {
    data: {
      text: 'yes',
      chatId: 'CHAT',
      sessionId: 'sess-1',
      messageType: 'callback',
      callbackData: 'cnfm:1:y',
    },
  };
}

function skipReply(): IncomingReplyEvent {
  return {
    data: {
      text: 'skip',
      chatId: 'CHAT',
      sessionId: 'sess-1',
      messageType: 'callback',
      callbackData: 'cnfm:1:s',
    },
  };
}

function anonReply(): IncomingReplyEvent {
  return {
    data: {
      text: 'anon',
      chatId: 'CHAT',
      sessionId: 'sess-1',
      messageType: 'callback',
      callbackData: 'cnfm:1:a',
    },
  };
}

function voiceReply(opts: {
  transcript: string | null;
  audioUrl: string;
  transcriptionError?: string;
}): IncomingReplyEvent {
  const data: IncomingReplyEvent['data'] = {
    text: opts.transcript ?? '',
    chatId: 'CHAT',
    sessionId: 'sess-1',
    messageType: 'voice',
    audioUrl: opts.audioUrl,
    transcript: opts.transcript,
  };
  if (opts.transcriptionError !== undefined) {
    data.transcriptionError = opts.transcriptionError;
  }
  return { data };
}

// --- Tests -----------------------------------------------------------------

describe('runConfirmationLoop', () => {
  it('happy path: 3 signals, all yes → 3 confirmations, status completed', async () => {
    const { db, state } = makeFakeDb();
    const { client } = makeAnthropic((_p, i) =>
      validResponse({ signalId: `s${i + 1}` }),
    );
    const fetchFn = makeFetchOk();
    const waitForReply = vi
      .fn<
        (
          sessionId: string,
          questionIndex: number,
          timeoutMs: number,
        ) => Promise<IncomingReplyEvent | null>
      >()
      .mockResolvedValue(yesReply());
    const outcome = await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: fetchFn as unknown as typeof fetch,
        now: new Date('2026-05-25T12:00:00Z'),
        selectSignals: async () => [
          makeSignal('s1'),
          makeSignal('s2'),
          makeSignal('s3'),
        ],
      },
      makeContext(),
    );
    expect(outcome).toEqual({
      kind: 'completed',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      confirmedCount: 3,
      excludedCount: 0,
    });
    // Session was transitioned to 'confirming' once on the first send.
    expect(
      state.updateCalls.filter(
        (u) => u.table === 'interview_sessions' && u.set['status'] === 'confirming',
      ),
    ).toHaveLength(1);
    // ...and then to 'completed' once at the end.
    expect(
      state.updateCalls.filter(
        (u) => u.table === 'interview_sessions' && u.set['status'] === 'completed',
      ),
    ).toHaveLength(1);
    // Candidate was transitioned to interview_complete.
    expect(
      state.updateCalls.filter(
        (u) =>
          u.table === 'article_candidates' &&
          u.set['status'] === 'interview_complete',
      ),
    ).toHaveLength(1);
  });

  it('cluster has 7 signals — only 5 questions are sent', async () => {
    const { db } = makeFakeDb();
    const { client, create } = makeAnthropic((_p, i) =>
      validResponse({ signalId: `s${i + 1}` }),
    );
    const fetchFn = makeFetchOk();
    const waitForReply = vi.fn<
      (
        sessionId: string,
        questionIndex: number,
        timeoutMs: number,
      ) => Promise<IncomingReplyEvent | null>
    >(async () => yesReply());
    const outcome = await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: fetchFn as unknown as typeof fetch,
        now: new Date('2026-05-25T12:00:00Z'),
        selectSignals: async () =>
          Array.from({ length: 7 }, (_, i) => makeSignal(`s${i + 1}`)),
      },
      makeContext(),
    );
    expect(outcome.kind).toBe('completed');
    // selectSignals returns 7, but the loop caps at 5.
    expect(waitForReply).toHaveBeenCalledTimes(5);
    expect(create.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('first signal returns no_specifics → excluded, next signal proceeds normally', async () => {
    const { db, state } = makeFakeDb();
    const { client } = makeAnthropic((_p, i) =>
      i === 0
        ? validResponse({ signalId: 's1', noSpecifics: true })
        : validResponse({ signalId: 's2' }),
    );
    const waitForReply = vi.fn<
      (
        sessionId: string,
        questionIndex: number,
        timeoutMs: number,
      ) => Promise<IncomingReplyEvent | null>
    >(async () => yesReply());
    const outcome = await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: makeFetchOk() as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [makeSignal('s1'), makeSignal('s2')],
      },
      makeContext(),
    );
    expect(outcome.kind).toBe('completed');
    if (outcome.kind === 'completed') {
      expect(outcome.confirmedCount).toBe(1);
      expect(outcome.excludedCount).toBe(1);
    }
    // signal_exclusions persisted.
    const exclusionUpdates = state.updateCalls.filter(
      (u) =>
        u.table === 'interview_sessions' &&
        Array.isArray(u.set['signalExclusions']),
    );
    expect(exclusionUpdates.length).toBeGreaterThanOrEqual(1);
  });

  it('first attempt fails quality gate; retry passes → question sent (1 per signal)', async () => {
    const { db } = makeFakeDb();
    // First call: question with no detected specifics → fails 'no_specifics'.
    // Second call: passes.
    const { client, create } = makeAnthropic((_p, i) =>
      i === 0
        ? validResponse({ signalId: 's1', specifics: [] })
        : validResponse({ signalId: 's1', specifics: ['AADSTS50158'] }),
    );
    const waitForReply = vi.fn<
      (
        sessionId: string,
        questionIndex: number,
        timeoutMs: number,
      ) => Promise<IncomingReplyEvent | null>
    >(async () => yesReply());
    const outcome = await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: makeFetchOk() as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [makeSignal('s1')],
      },
      makeContext(),
    );
    expect(outcome.kind).toBe('completed');
    if (outcome.kind === 'completed') expect(outcome.confirmedCount).toBe(1);
    // Anthropic was called twice — once initial, once for the retry.
    expect(create).toHaveBeenCalledTimes(2);
    // waitForReply was called only once: 1 question per signal.
    expect(waitForReply).toHaveBeenCalledTimes(1);
  });

  it('quality gate fails twice → signal excluded', async () => {
    const { db } = makeFakeDb();
    // Both attempts return responses with no detected specifics.
    const { client } = makeAnthropic((_p) =>
      validResponse({ signalId: 's1', specifics: [] }),
    );
    const waitForReply = vi.fn(async (): Promise<IncomingReplyEvent | null> => yesReply());
    const outcome = await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: makeFetchOk() as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [makeSignal('s1')],
      },
      makeContext(),
    );
    expect(outcome.kind).toBe('completed');
    if (outcome.kind === 'completed') {
      expect(outcome.confirmedCount).toBe(0);
      expect(outcome.excludedCount).toBe(1);
    }
  });

  it('3 signals excluded by quality gate → corpus-quality alert sent exactly once', async () => {
    const { db } = makeFakeDb();
    const { client } = makeAnthropic((_p) =>
      validResponse({ signalId: 's', specifics: [] }),
    );
    const fetchFn = makeFetchOk();
    const waitForReply = vi.fn(async (): Promise<IncomingReplyEvent | null> => yesReply());
    await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: fetchFn as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [
          makeSignal('s1'),
          makeSignal('s2'),
          makeSignal('s3'),
          makeSignal('s4'),
        ],
      },
      makeContext(),
    );
    const alertBodies = fetchFn.mock.calls
      .map((c) => JSON.parse((c[1] as RequestInit).body as string) as { text: string })
      .filter((b) => b.text.includes('Corpus quality may be low'));
    expect(alertBodies).toHaveLength(1);
  });

  it('2 signals excluded → corpus-quality alert NOT sent', async () => {
    const { db } = makeFakeDb();
    let calls = 0;
    const { client } = makeAnthropic((_p) => {
      const c = calls++;
      // Signals s1 + s2 fail (both attempts return no specifics), s3 succeeds.
      // s1: call 0 + 1 → fail
      // s2: call 2 + 3 → fail
      // s3: call 4 → success
      if (c < 4) {
        return validResponse({ signalId: 's', specifics: [] });
      }
      return validResponse({ signalId: 's3' });
    });
    const fetchFn = makeFetchOk();
    const waitForReply = vi.fn(async (): Promise<IncomingReplyEvent | null> => yesReply());
    await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: fetchFn as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [
          makeSignal('s1'),
          makeSignal('s2'),
          makeSignal('s3'),
        ],
      },
      makeContext(),
    );
    const alertBodies = fetchFn.mock.calls
      .map((c) => JSON.parse((c[1] as RequestInit).body as string) as { text: string })
      .filter((b) => b.text.includes('Corpus quality may be low'));
    expect(alertBodies).toHaveLength(0);
  });

  it('voice answer: transcription succeeds → answer stored with audio_url + transcript', async () => {
    const { db, state } = makeFakeDb();
    const { client } = makeAnthropic((_p) => validResponse({ signalId: 's1' }));
    const fetchFn = makeFetchOk();
    const waitForReply = vi
      .fn<
        (
          sessionId: string,
          questionIndex: number,
          timeoutMs: number,
        ) => Promise<IncomingReplyEvent | null>
      >()
      .mockResolvedValue(
        voiceReply({
          transcript: 'yes that one was real',
          audioUrl: 'https://api.telegram.org/file/botTOK/voice/v1.oga',
        }),
      );
    const outcome = await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: fetchFn as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [makeSignal('s1')],
      },
      makeContext(),
    );
    expect(outcome.kind).toBe('completed');
    // The most recent `answers` update should be a single-entry array with
    // audio_url + transcript.
    const answerUpdates = state.updateCalls.filter(
      (u) => u.table === 'interview_sessions' && Array.isArray(u.set['answers']),
    );
    expect(answerUpdates.length).toBeGreaterThanOrEqual(1);
    const lastAnswers = answerUpdates[answerUpdates.length - 1]!.set['answers'] as Array<
      Record<string, unknown>
    >;
    expect(lastAnswers[0]?.['audio_url']).toBe(
      'https://api.telegram.org/file/botTOK/voice/v1.oga',
    );
    expect(lastAnswers[0]?.['transcript']).toBe('yes that one was real');
  });

  it('voice answer: transcription fails → fallback message sent, loop waits for text retry', async () => {
    const { db } = makeFakeDb();
    const { client } = makeAnthropic((_p) => validResponse({ signalId: 's1' }));
    const fetchFn = makeFetchOk();
    let call = 0;
    const waitForReply = vi.fn(async (): Promise<IncomingReplyEvent | null> => {
      call += 1;
      if (call === 1)
        return voiceReply({
          transcript: null,
          audioUrl: 'https://api.telegram.org/file/botTOK/voice/v1.oga',
          transcriptionError: 'whisper error: 500',
        });
      // Second wait: a text retry.
      return {
        data: {
          text: 'sorry typing now: yes',
          chatId: 'CHAT',
          sessionId: 'sess-1',
          messageType: 'text',
        },
      };
    });
    const outcome = await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: fetchFn as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [makeSignal('s1')],
      },
      makeContext(),
    );
    expect(outcome.kind).toBe('completed');
    // Fallback message was sent.
    const fallback = fetchFn.mock.calls
      .map((c) => JSON.parse((c[1] as RequestInit).body as string) as { text: string })
      .filter((b) => b.text.includes('Couldn&#39;t transcribe'));
    expect(fallback).toHaveLength(1);
    expect(waitForReply).toHaveBeenCalledTimes(2);
  });

  it('answer "anon" → signal IS added to confirmed_chunk_ids', async () => {
    const { db, state } = makeFakeDb();
    const { client } = makeAnthropic((_p) => validResponse({ signalId: 's1' }));
    const waitForReply = vi
      .fn<
        (
          sessionId: string,
          questionIndex: number,
          timeoutMs: number,
        ) => Promise<IncomingReplyEvent | null>
      >()
      .mockResolvedValue(anonReply());
    await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: makeFetchOk() as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [makeSignal('s1')],
      },
      makeContext(),
    );
    const confirmedUpdates = state.updateCalls.filter(
      (u) =>
        u.table === 'interview_sessions' &&
        Array.isArray(u.set['confirmedChunkIds']),
    );
    expect(confirmedUpdates.length).toBeGreaterThanOrEqual(1);
    const last = confirmedUpdates[confirmedUpdates.length - 1]!.set[
      'confirmedChunkIds'
    ] as string[];
    expect(last).toContain(uuidFor('s1'));
  });

  it('answer "skip" → signal NOT added to confirmed_chunk_ids; loop continues', async () => {
    const { db, state } = makeFakeDb();
    const { client } = makeAnthropic((_p, i) =>
      validResponse({ signalId: `s${i + 1}` }),
    );
    const waitForReply = vi
      .fn<
        (
          sessionId: string,
          questionIndex: number,
          timeoutMs: number,
        ) => Promise<IncomingReplyEvent | null>
      >()
      .mockResolvedValueOnce(skipReply())
      .mockResolvedValueOnce(yesReply());
    const outcome = await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: makeFetchOk() as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [makeSignal('s1'), makeSignal('s2')],
      },
      makeContext(),
    );
    expect(outcome.kind).toBe('completed');
    if (outcome.kind === 'completed') expect(outcome.confirmedCount).toBe(1);
    // The last `confirmedChunkIds` write does not contain s1.
    const confirmedUpdates = state.updateCalls.filter(
      (u) =>
        u.table === 'interview_sessions' &&
        Array.isArray(u.set['confirmedChunkIds']),
    );
    const last = confirmedUpdates[confirmedUpdates.length - 1]!.set[
      'confirmedChunkIds'
    ] as string[];
    expect(last).not.toContain(uuidFor('s1'));
    expect(last).toContain(uuidFor('s2'));
  });

  it('mid-loop 7-day timeout: waitForReply returns null → session→timed_out + candidate→archived', async () => {
    const { db, state } = makeFakeDb();
    const { client } = makeAnthropic((_p) => validResponse({ signalId: 's1' }));
    const fetchFn = makeFetchOk();
    const waitForReply = vi
      .fn<
        (
          sessionId: string,
          questionIndex: number,
          timeoutMs: number,
        ) => Promise<IncomingReplyEvent | null>
      >()
      .mockResolvedValue(null);
    const outcome = await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: fetchFn as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [makeSignal('s1'), makeSignal('s2')],
      },
      makeContext(),
    );
    expect(outcome).toEqual({
      kind: 'timed_out',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
    });
    expect(
      state.updateCalls.filter(
        (u) =>
          u.table === 'interview_sessions' && u.set['status'] === 'timed_out',
      ),
    ).toHaveLength(1);
    expect(
      state.updateCalls.filter(
        (u) => u.table === 'article_candidates' && u.set['status'] === 'archived',
      ),
    ).toHaveLength(1);
    const timeoutBody = fetchFn.mock.calls
      .map((c) => JSON.parse((c[1] as RequestInit).body as string) as { text: string })
      .find((b) => /timed out/.test(b.text));
    expect(timeoutBody).toBeDefined();
  });

  it('HTML injection regression: signal redacted_text with <script> is escaped in the sent body', async () => {
    const { db } = makeFakeDb();
    const { client } = makeAnthropic((_p) => validResponse({ signalId: 's1' }));
    const fetchFn = makeFetchOk();
    const waitForReply = vi
      .fn<
        (
          sessionId: string,
          questionIndex: number,
          timeoutMs: number,
        ) => Promise<IncomingReplyEvent | null>
      >()
      .mockResolvedValue(yesReply());
    await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: fetchFn as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [
          makeSignal('s1', {
            redactedText:
              '<script>alert(1)</script> AADSTS50158 came up Monday morning.',
          }),
        ],
      },
      makeContext(),
    );
    const confirmationBody = fetchFn.mock.calls
      .map((c) => JSON.parse((c[1] as RequestInit).body as string) as { text: string })
      .find((b) => b.text.includes('AADSTS50158'));
    expect(confirmationBody).toBeDefined();
    expect(confirmationBody!.text).toContain('&lt;script&gt;');
    expect(confirmationBody!.text).not.toContain('<script>');
  });

  it('completion placeholder is sent at the end with the correct example count', async () => {
    const { db } = makeFakeDb();
    const { client } = makeAnthropic((_p, i) =>
      validResponse({ signalId: `s${i + 1}` }),
    );
    const fetchFn = makeFetchOk();
    const waitForReply = vi
      .fn<
        (
          sessionId: string,
          questionIndex: number,
          timeoutMs: number,
        ) => Promise<IncomingReplyEvent | null>
      >()
      .mockResolvedValue(yesReply());
    await runConfirmationLoop(
      {
        db,
        logger: makeLogger(),
        env: ENV,
        anthropic: client,
        waitForReply,
        fetchFn: fetchFn as unknown as typeof fetch,
        now: new Date(),
        selectSignals: async () => [makeSignal('s1'), makeSignal('s2')],
      },
      makeContext(),
    );
    const completionBody = fetchFn.mock.calls
      .map((c) => JSON.parse((c[1] as RequestInit).body as string) as { text: string })
      .find((b) => /Got it. I&#39;ve confirmed/.test(b.text));
    expect(completionBody).toBeDefined();
    expect(completionBody!.text).toMatch(/confirmed 2 examples/);
  });
});
