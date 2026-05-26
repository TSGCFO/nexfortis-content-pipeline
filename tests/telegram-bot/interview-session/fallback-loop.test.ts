/**
 * Integration tests for `runFallbackLoop`.
 *
 * All external deps mocked via `vi.fn()` — no real network/DB/Inngest.
 *
 * Cases:
 *   1. Happy: text answer → low_corpus_confidence flipped, COMPLETED
 *   2. Voice answer success → audio_url + transcript stored
 *   3. Voice transcription fail → fallback prompt + wait for text
 *   4. Reply contains "/skip" → still recorded as the text answer
 *   5. 7-day timeout → TIMED_OUT
 *   6. Fallback question text matches AC-F2-07 with HTML-escaped title
 *   7. low_corpus_confidence is set to true (DB update verified)
 *   8. HTML-escape regression on candidate title
 */

import { describe, expect, it, vi } from 'vitest';

import { runFallbackLoop } from '../../../artifacts/telegram-bot/src/jobs/interview-session/fallback-loop.js';
import type {
  FallbackLoopDeps,
  FallbackLoopOutcome,
  IncomingReplyEvent,
  InterviewSessionEnv,
  SessionContext,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';
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
              // Read-back of current questions/answers used by the loop
              // for append-not-overwrite persistence.
              return Promise.resolve([
                {
                  questions: state.questions,
                  answers: state.answers,
                },
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
          // Track JSONB writes so subsequent read-backs see the latest.
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

function ctx(title = 'Conditional Access for iOS'): SessionContext {
  return {
    sessionId: 'sess-1',
    candidateId: 'cand-1',
    candidate: {
      proposedTitle: title,
      pillar: 'managed-it',
      primaryKeyword: 'intune',
      evidenceChunkIds: ['s1'],
    },
  };
}

interface MakeDepsArgs {
  replies: Array<IncomingReplyEvent | null>;
  fetchFn?: ReturnType<typeof vi.fn>;
}

interface Built {
  deps: FallbackLoopDeps;
  state: FakeDbState;
  logger: Logger;
  fetchFn: ReturnType<typeof vi.fn>;
  waitForReply: ReturnType<typeof vi.fn>;
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
  const deps: FallbackLoopDeps = {
    db,
    logger,
    now: NOW,
    env: ENV,
    fetchFn: fetchFn as unknown as typeof fetch,
    waitForReply,
  };
  return { deps, state, logger, fetchFn, waitForReply };
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
      audioUrl: 'https://cdn.tg/audio/file_88.oga',
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
      audioUrl: 'https://cdn.tg/audio/file_88.oga',
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

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('runFallbackLoop', () => {
  it('happy: text answer → low_corpus_confidence flipped, COMPLETED', async () => {
    const built = makeDeps({ replies: [textReply('Sure, here is more info...')] });
    const outcome = await runFallbackLoop(built.deps, ctx());
    expect(outcome).toEqual<FallbackLoopOutcome>({ kind: 'completed' });
    const flagged = built.state.updateCalls.find(
      (u) =>
        u.table === 'article_candidates' &&
        u.set['lowCorpusConfidence'] === true,
    );
    expect(flagged).toBeDefined();
  });

  it('voice answer success: stores audio_url + transcript', async () => {
    const built = makeDeps({ replies: [voiceReplySuccess('Yes I have more')] });
    await runFallbackLoop(built.deps, ctx());
    const lastAnswers = built.state.answers as Array<Record<string, unknown>>;
    expect(lastAnswers).toHaveLength(1);
    expect(lastAnswers[0]!['response']).toBe('voice');
    expect(lastAnswers[0]!['transcript']).toBe('Yes I have more');
    expect(lastAnswers[0]!['audio_url']).toBe('https://cdn.tg/audio/file_88.oga');
    expect(lastAnswers[0]!['question_type']).toBe('fallback');
  });

  it('voice transcription fail: fallback prompt sent, then text reply recorded', async () => {
    const built = makeDeps({
      replies: [voiceReplyFailed(), textReply('text fallback answer')],
    });
    await runFallbackLoop(built.deps, ctx());
    const bodies = getFetchBodies(built.fetchFn);
    // body 0 = the fallback question; body 1 = voice-transcription-failure prompt
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(bodies[1]!['text']).toMatch(/Couldn&#39;t transcribe/);
    const lastAnswers = built.state.answers as Array<Record<string, unknown>>;
    expect(lastAnswers[0]!['response']).toBe('text');
    expect(lastAnswers[0]!['text']).toBe('text fallback answer');
    expect(lastAnswers[0]!['question_type']).toBe('fallback');
  });

  it('reply contains "/skip": still recorded as the text answer', async () => {
    const built = makeDeps({ replies: [textReply('/skip')] });
    const outcome = await runFallbackLoop(built.deps, ctx());
    expect(outcome).toEqual({ kind: 'completed' });
    const answers = built.state.answers as Array<Record<string, unknown>>;
    expect(answers[0]!['text']).toBe('/skip');
    expect(answers[0]!['response']).toBe('text');
  });

  it('7-day timeout: session→timed_out, candidate→archived, timeout msg sent', async () => {
    const built = makeDeps({ replies: [null] });
    const outcome = await runFallbackLoop(built.deps, ctx());
    expect(outcome).toEqual<FallbackLoopOutcome>({ kind: 'timed_out' });
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

  it('fallback question text matches AC-F2-07 with HTML-escaped title', async () => {
    const built = makeDeps({ replies: [textReply('reply')] });
    await runFallbackLoop(built.deps, ctx('My <special> Title'));
    const bodies = getFetchBodies(built.fetchFn);
    const text = String(bodies[0]!['text']);
    expect(text).toContain('Anything on');
    expect(text).toContain('from your recent work we should know about before drafting?');
    expect(text).toContain('&lt;special&gt;');
    expect(text).not.toContain('<special>');
  });

  it('low_corpus_confidence is explicitly set to true on the article_candidates row', async () => {
    const built = makeDeps({ replies: [textReply('any answer')] });
    await runFallbackLoop(built.deps, ctx());
    const writes = built.state.updateCalls.filter(
      (u) =>
        u.table === 'article_candidates' && 'lowCorpusConfidence' in u.set,
    );
    expect(writes.length).toBeGreaterThanOrEqual(1);
    expect(writes[0]!.set['lowCorpusConfidence']).toBe(true);
  });

  it('HTML-injection regression: malicious title is escaped in question text', async () => {
    const built = makeDeps({ replies: [textReply('ok')] });
    await runFallbackLoop(built.deps, ctx('<script>alert(1)</script>'));
    const bodies = getFetchBodies(built.fetchFn);
    const text = String(bodies[0]!['text']);
    expect(text).toContain('&lt;script&gt;');
    expect(text).not.toContain('<script>alert');
  });
});
