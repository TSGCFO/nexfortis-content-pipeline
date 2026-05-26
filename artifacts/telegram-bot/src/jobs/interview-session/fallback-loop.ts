/**
 * All-skipped fallback loop (PRD §7.2 + AC-F2-07 + US-F2-08).
 *
 * Triggered by `runInterviewSession` after the confirmation loop
 * completes when `allConfirmationsSkipped === true`. Sends Hassan ONE
 * open-ended fallback question:
 *
 *     "Anything on <topic> from your recent work we should know about
 *      before drafting?"
 *
 * waits for any reply (text or voice), records the answer in
 * `interview_sessions.answers` with `question_type: 'fallback'`, flips
 * `article_candidates.low_corpus_confidence = true`, and returns
 * `{ kind: 'completed' }` so the orchestrator can run the closing
 * summary.
 *
 * Mid-loop 7-day timeout follows the same teardown as confirmation-loop
 * (`session → timed_out`, `candidate → archived`, send timeout msg).
 *
 * Voice-handling parity with confirmation-loop:
 *   - successful transcription → store `audio_url` + `transcript`
 *   - failed transcription     → send fallback prompt + wait for text
 *   - double-fail              → record audio-only and finish
 *
 * Never throws — all external failures are logged + folded into the
 * discriminated outcome.
 */

import { eq } from 'drizzle-orm';

import {
  articleCandidates,
  interviewSessions,
  type Database,
  type InterviewAnswer,
  type InterviewQuestion,
} from '@ncp/db';
import type { Logger } from '@ncp/logger';

import { buildTimeoutMessage } from './build-timeout-message.js';
import { buildFallbackQuestion } from './generate-fallback.js';
import {
  buildVoiceTranscriptionFailureMessage,
} from './messages.js';
import type {
  AnswerQuestionType,
  FallbackLoopOutcome,
  IncomingReplyEvent,
  InterviewSessionEnv,
  SessionContext,
} from './types.js';

const SOURCE = 'telegram_bot' as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const QUESTION_TYPE: AnswerQuestionType = 'fallback';

// ─────────────────────────────────────────────────────────────────────────
// Public DI surface
// ─────────────────────────────────────────────────────────────────────────

export interface FallbackLoopDeps {
  db: Database;
  logger: Logger;
  now: Date;
  env: InterviewSessionEnv;
  fetchFn: typeof fetch;
  waitForReply: (
    sessionId: string,
    timeoutMs: number,
  ) => Promise<IncomingReplyEvent | null>;
}

// ─────────────────────────────────────────────────────────────────────────
// Local Telegram sender — mirrors `confirmation-loop.ts`'s inlined helper
// (the existing `send-telegram-message.ts` doesn't take `reply_markup`,
// but the fallback question is text-only so we could reuse it; keeping
// the inline copy for symmetry and the "do not consolidate" rule).
// ─────────────────────────────────────────────────────────────────────────

interface SendResult {
  ok: boolean;
  error: string | undefined;
}

async function trySendTelegram(opts: {
  fetchFn: typeof fetch;
  token: string;
  chatId: string;
  text: string;
}): Promise<SendResult> {
  const url = `https://api.telegram.org/bot${opts.token}/sendMessage`;
  const body = {
    chat_id: opts.chatId,
    text: opts.text,
    parse_mode: 'HTML',
  };
  try {
    const response = await opts.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let parsed: { ok?: boolean; description?: string } | null = null;
    try {
      parsed = (await response.json()) as {
        ok?: boolean;
        description?: string;
      };
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      const desc = parsed?.description ?? `HTTP ${response.status}`;
      return { ok: false, error: `Telegram sendMessage failed: ${desc}` };
    }
    if (parsed === null) {
      return {
        ok: false,
        error: 'Telegram sendMessage returned empty/unparseable body',
      };
    }
    if (parsed.ok !== true) {
      return {
        ok: false,
        error: `Telegram returned ok=false: ${parsed.description ?? 'unknown'}`,
      };
    }
    return { ok: true, error: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Telegram fetch error: ${message}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

interface RecordedAnswer {
  answer: InterviewAnswer & { question_type: AnswerQuestionType };
}

interface NeedsTextFallback {
  needsTextFallback: true;
  failureAudioUrl: string | undefined;
}

function recordAnswerFromReply(
  reply: IncomingReplyEvent,
  questionIndex: number,
  now: Date,
): RecordedAnswer | NeedsTextFallback {
  const data = reply.data;
  const timestamp = now.toISOString();

  if (data.messageType === 'voice') {
    const transcript =
      typeof data.transcript === 'string' ? data.transcript : null;
    if (transcript === null) {
      return {
        needsTextFallback: true,
        failureAudioUrl: data.audioUrl,
      };
    }
    const answer: InterviewAnswer & { question_type: AnswerQuestionType } = {
      question_index: questionIndex,
      response: 'voice',
      text: transcript,
      transcript,
      timestamp,
      question_type: QUESTION_TYPE,
      ...(typeof data.audioUrl === 'string' ? { audio_url: data.audioUrl } : {}),
    };
    return { answer };
  }

  // Everything else — text, callback (shouldn't happen since no buttons),
  // anything unknown — treat as plain text.
  const answer: InterviewAnswer & { question_type: AnswerQuestionType } = {
    question_index: questionIndex,
    response: 'text',
    text: data.text,
    timestamp,
    question_type: QUESTION_TYPE,
  };
  return { answer };
}

async function resolveMidLoopTimeout(
  deps: FallbackLoopDeps,
  ctx: SessionContext,
): Promise<void> {
  await deps.db
    .update(interviewSessions)
    .set({ status: 'timed_out' })
    .where(eq(interviewSessions.id, ctx.sessionId));
  await deps.db
    .update(articleCandidates)
    .set({ status: 'archived' })
    .where(eq(articleCandidates.id, ctx.candidateId));
  const send = await trySendTelegram({
    fetchFn: deps.fetchFn,
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    text: buildTimeoutMessage({ proposedTitle: ctx.candidate.proposedTitle }),
  });
  if (!send.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'fallback_mid_loop_timeout_ack_failed',
        sessionId: ctx.sessionId,
        candidateId: ctx.candidateId,
        reason: send.error,
      },
      'fallback timeout ack send failed',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Orchestrator entry point
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sends the single fixed fallback question, waits for the reply, records
 * the answer, flips `low_corpus_confidence = true`, returns.
 *
 * The fallback question itself goes into `interview_sessions.questions`
 * with the next index after the last confirmation question (or 1 if
 * none were sent). The `signal_id` field is set to the empty string
 * because there is no underlying signal — this is an open-ended
 * fallback.
 */
export async function runFallbackLoop(
  deps: FallbackLoopDeps,
  ctx: SessionContext,
): Promise<FallbackLoopOutcome> {
  // Determine the question index — read the current JSONB length so we
  // append rather than overwrite. If the read fails we default to 1.
  let nextQuestionIndex = 1;
  try {
    const rows = await deps.db
      .select({ questions: interviewSessions.questions })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, ctx.sessionId));
    const existing = rows[0]?.questions;
    if (Array.isArray(existing)) {
      nextQuestionIndex = existing.length + 1;
    }
  } catch (err) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'fallback_question_index_lookup_failed',
        sessionId: ctx.sessionId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'fallback question index lookup failed; defaulting to 1',
    );
  }

  // Transition session to follow_up state and record the question entry.
  const questionText = buildFallbackQuestion(ctx.candidate.proposedTitle);
  const questionRecord: InterviewQuestion & { question_type: AnswerQuestionType } = {
    index: nextQuestionIndex,
    signal_id: '',
    question_text: questionText,
    sent_at: deps.now.toISOString(),
    question_type: QUESTION_TYPE,
  };

  await deps.db
    .update(interviewSessions)
    .set({
      status: 'follow_up',
    })
    .where(eq(interviewSessions.id, ctx.sessionId));

  const send = await trySendTelegram({
    fetchFn: deps.fetchFn,
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    text: questionText,
  });
  if (!send.ok) {
    deps.logger.error(
      {
        source: SOURCE,
        action: 'fallback_question_send_failed',
        sessionId: ctx.sessionId,
        candidateId: ctx.candidateId,
        reason: send.error,
      },
      'fallback question send failed; still waiting for reply',
    );
  }

  // Persist the question entry — append, don't overwrite.
  try {
    const rows = await deps.db
      .select({ questions: interviewSessions.questions })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, ctx.sessionId));
    const existing = (rows[0]?.questions ?? []) as InterviewQuestion[];
    await deps.db
      .update(interviewSessions)
      .set({ questions: [...existing, questionRecord] })
      .where(eq(interviewSessions.id, ctx.sessionId));
  } catch (err) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'fallback_question_persist_failed',
        sessionId: ctx.sessionId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'persisting fallback question entry failed; continuing',
    );
  }

  // Wait for the reply.
  let reply = await deps.waitForReply(ctx.sessionId, SEVEN_DAYS_MS);
  if (reply === null) {
    await resolveMidLoopTimeout(deps, ctx);
    return { kind: 'timed_out' };
  }

  let recorded = recordAnswerFromReply(reply, nextQuestionIndex, deps.now);

  if ('needsTextFallback' in recorded) {
    const audioUrl = recorded.failureAudioUrl;
    const ack = await trySendTelegram({
      fetchFn: deps.fetchFn,
      token: deps.env.telegramBotToken,
      chatId: deps.env.telegramChatId,
      text: buildVoiceTranscriptionFailureMessage(),
    });
    if (!ack.ok) {
      deps.logger.warn(
        {
          source: SOURCE,
          action: 'fallback_voice_fallback_send_failed',
          sessionId: ctx.sessionId,
          reason: ack.error,
        },
        'fallback voice-transcription-failure prompt send failed',
      );
    }
    reply = await deps.waitForReply(ctx.sessionId, SEVEN_DAYS_MS);
    if (reply === null) {
      // Record an audio-only entry then transition to timeout.
      const audioOnlyAnswer: InterviewAnswer & {
        question_type: AnswerQuestionType;
      } = {
        question_index: nextQuestionIndex,
        response: 'voice',
        timestamp: deps.now.toISOString(),
        question_type: QUESTION_TYPE,
        ...(typeof audioUrl === 'string' ? { audio_url: audioUrl } : {}),
      };
      await appendAnswerAndFlipFlag(deps, ctx, audioOnlyAnswer);
      await resolveMidLoopTimeout(deps, ctx);
      return { kind: 'timed_out' };
    }
    const second = recordAnswerFromReply(reply, nextQuestionIndex, deps.now);
    if ('needsTextFallback' in second) {
      const audioOnlyAnswer: InterviewAnswer & {
        question_type: AnswerQuestionType;
      } = {
        question_index: nextQuestionIndex,
        response: 'voice',
        timestamp: deps.now.toISOString(),
        question_type: QUESTION_TYPE,
        ...(typeof second.failureAudioUrl === 'string'
          ? { audio_url: second.failureAudioUrl }
          : {}),
      };
      await appendAnswerAndFlipFlag(deps, ctx, audioOnlyAnswer);
      return { kind: 'completed' };
    }
    recorded = second;
  }

  await appendAnswerAndFlipFlag(deps, ctx, recorded.answer);
  return { kind: 'completed' };
}

async function appendAnswerAndFlipFlag(
  deps: FallbackLoopDeps,
  ctx: SessionContext,
  answer: InterviewAnswer & { question_type: AnswerQuestionType },
): Promise<void> {
  // Append to the existing answers array — read-then-write so we don't
  // overwrite confirmation-loop answers.
  try {
    const rows = await deps.db
      .select({ answers: interviewSessions.answers })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, ctx.sessionId));
    const existing = (rows[0]?.answers ?? []) as InterviewAnswer[];
    await deps.db
      .update(interviewSessions)
      .set({ answers: [...existing, answer] as InterviewAnswer[] })
      .where(eq(interviewSessions.id, ctx.sessionId));
  } catch (err) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'fallback_answer_persist_failed',
        sessionId: ctx.sessionId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'fallback answer persist failed',
    );
  }
  // Flip low_corpus_confidence — the whole point of the fallback path
  // (PRD §7.2 / AC-F2-07). Idempotent — repeating it is harmless.
  try {
    await deps.db
      .update(articleCandidates)
      .set({ lowCorpusConfidence: true })
      .where(eq(articleCandidates.id, ctx.candidateId));
  } catch (err) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'fallback_low_corpus_flag_failed',
        candidateId: ctx.candidateId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'fallback low_corpus_confidence flag write failed',
    );
  }
}
