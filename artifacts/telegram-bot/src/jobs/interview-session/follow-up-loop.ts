/**
 * Open-ended SERP-gap follow-up loop (PRD §4.4 + US-F2-05).
 *
 * Triggered by `runInterviewSession` after the confirmation loop
 * completes when `allConfirmationsSkipped === false` AND
 * `computeUncoveredGaps(candidate, confirmedSignals).length > 0`.
 *
 * Behaviour:
 *   1. Compute uncovered gaps via `serp-gap-coverage.ts`.
 *   2. If > 2, alphabetically sort and take the first 2 (deterministic
 *      truncation); log the truncation count.
 *   3. For each gap (max 2):
 *      a. Generate the follow-up via Claude Opus 4.7 (`generateFollowUp`).
 *      b. On generation failure, log + skip this gap (continue with the
 *         next).
 *      c. Format the Telegram message + send (no buttons).
 *      d. Append the question to `interview_sessions.questions` with
 *         `question_type: 'follow_up'`.
 *      e. Wait for the reply (7d). Null → timeout teardown + bail.
 *      f. Voice → store transcript + audio_url. Voice fail → fallback
 *         prompt + wait. Double-fail → audio-only entry.
 *      g. Append to `interview_sessions.answers` with
 *         `question_type: 'follow_up'`.
 *   4. Return `{ kind: 'completed', followUpsAnswered }`.
 *
 * Transitions session.status `confirming` → `follow_up` on first
 * follow-up sent.
 *
 * Never throws — external failures are folded into the discriminated
 * outcome and structured logs.
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
import type { Pillar } from '@ncp/shared-types';

import { escapeHtml } from './escape-html.js';
import type { OpusAnthropicLike } from './anthropic-shapes.js';
import { buildTimeoutMessage } from './build-timeout-message.js';
import { generateFollowUp } from './generate-follow-up.js';
import {
  buildVoiceTranscriptionFailureMessage,
} from './messages.js';
import { computeUncoveredGaps } from './serp-gap-coverage.js';
import type {
  AnswerQuestionType,
  ConfirmedSignalSummary,
  FollowUpLoopOutcome,
  IncomingReplyEvent,
  InterviewSessionEnv,
} from './types.js';

const SOURCE = 'telegram_bot' as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const QUESTION_TYPE: AnswerQuestionType = 'follow_up';

/** Hard cap on follow-ups per session (PRD §4.4: "1–2 open-ended
 *  follow-up questions"). */
export const MAX_FOLLOW_UPS = 2;

// ─────────────────────────────────────────────────────────────────────────
// Public DI surface
// ─────────────────────────────────────────────────────────────────────────

export interface FollowUpSessionContext {
  sessionId: string;
  candidateId: string;
  candidate: {
    proposedTitle: string;
    pillar: Pillar;
    primaryKeyword: string;
    serpGaps: string[] | null;
  };
  /** Signals Hassan confirmed in the confirmation loop. Used to
   *  compute SERP-gap coverage and provide grounding to Opus. */
  confirmedSignals: ConfirmedSignalSummary[];
  /** The cluster context block reused across Opus calls — keeps the
   *  prompt cache warm. */
  clusterContextBlock: string;
}

export interface FollowUpLoopDeps {
  db: Database;
  logger: Logger;
  now: Date;
  env: InterviewSessionEnv;
  anthropic: OpusAnthropicLike;
  fetchFn: typeof fetch;
  waitForReply: (
    sessionId: string,
    timeoutMs: number,
  ) => Promise<IncomingReplyEvent | null>;
  /** Defaults to `generateFollowUp`. Injectable for tests. */
  generateFollowUpFn?: typeof generateFollowUp;
}

// ─────────────────────────────────────────────────────────────────────────
// Local Telegram sender — same pattern as confirmation-loop/fallback-loop
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
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

function formatFollowUpTelegramMessage(args: {
  primaryKeyword: string;
  gap: string;
  followUpText: string;
}): string {
  const kw = escapeHtml(args.primaryKeyword);
  const gap = escapeHtml(args.gap);
  const txt = escapeHtml(args.followUpText);
  return [
    `One more thing — the top-ranking articles on <i>${kw}</i> don&#39;t cover <i>${gap}</i>.`,
    '',
    `From your experience, ${txt}`,
    '',
    'Answer via voice or text. There&#39;s no wrong answer.',
  ].join('\n');
}

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

  const answer: InterviewAnswer & { question_type: AnswerQuestionType } = {
    question_index: questionIndex,
    response: 'text',
    text: data.text,
    timestamp,
    question_type: QUESTION_TYPE,
  };
  return { answer };
}

async function persistQuestionEntry(
  deps: FollowUpLoopDeps,
  sessionId: string,
  entry: InterviewQuestion & { question_type: AnswerQuestionType },
): Promise<void> {
  try {
    const rows = await deps.db
      .select({ questions: interviewSessions.questions })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, sessionId));
    const existing = (rows[0]?.questions ?? []) as InterviewQuestion[];
    await deps.db
      .update(interviewSessions)
      .set({ questions: [...existing, entry] as InterviewQuestion[] })
      .where(eq(interviewSessions.id, sessionId));
  } catch (err) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'follow_up_question_persist_failed',
        sessionId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'follow-up question persist failed',
    );
  }
}

async function persistAnswerEntry(
  deps: FollowUpLoopDeps,
  sessionId: string,
  answer: InterviewAnswer & { question_type: AnswerQuestionType },
): Promise<void> {
  try {
    const rows = await deps.db
      .select({ answers: interviewSessions.answers })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, sessionId));
    const existing = (rows[0]?.answers ?? []) as InterviewAnswer[];
    await deps.db
      .update(interviewSessions)
      .set({ answers: [...existing, answer] as InterviewAnswer[] })
      .where(eq(interviewSessions.id, sessionId));
  } catch (err) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'follow_up_answer_persist_failed',
        sessionId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'follow-up answer persist failed',
    );
  }
}

async function getNextQuestionIndex(
  deps: FollowUpLoopDeps,
  sessionId: string,
): Promise<number> {
  try {
    const rows = await deps.db
      .select({ questions: interviewSessions.questions })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, sessionId));
    const existing = rows[0]?.questions;
    if (Array.isArray(existing)) {
      return existing.length + 1;
    }
  } catch {
    // Fall through to default below.
  }
  return 1;
}

async function resolveMidLoopTimeout(
  deps: FollowUpLoopDeps,
  ctx: FollowUpSessionContext,
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
        action: 'follow_up_mid_loop_timeout_ack_failed',
        sessionId: ctx.sessionId,
        candidateId: ctx.candidateId,
        reason: send.error,
      },
      'follow-up timeout ack send failed',
    );
  }
}

/**
 * Determine which uncovered gaps to ask about. Truncates to
 * `MAX_FOLLOW_UPS` via alphabetic sort for deterministic ordering when
 * we have more gaps than budget — that's the v2.1 simplification call
 * the prompt explicitly endorses.
 */
function selectGapsToAsk(
  uncoveredGaps: readonly string[],
  logger: Logger,
  sessionId: string,
): string[] {
  if (uncoveredGaps.length <= MAX_FOLLOW_UPS) {
    return [...uncoveredGaps];
  }
  const sorted = [...uncoveredGaps].sort();
  const chosen = sorted.slice(0, MAX_FOLLOW_UPS);
  logger.info(
    {
      source: SOURCE,
      action: 'follow_up_gap_truncation',
      sessionId,
      totalUncovered: uncoveredGaps.length,
      asking: chosen.length,
      droppedGaps: sorted.slice(MAX_FOLLOW_UPS),
    },
    `truncating to ${MAX_FOLLOW_UPS} follow-ups (alphabetic sort)`,
  );
  return chosen;
}

// ─────────────────────────────────────────────────────────────────────────
// Orchestrator entry point
// ─────────────────────────────────────────────────────────────────────────

export async function runFollowUpLoop(
  deps: FollowUpLoopDeps,
  ctx: FollowUpSessionContext,
): Promise<FollowUpLoopOutcome> {
  const generateFn = deps.generateFollowUpFn ?? generateFollowUp;

  // TODO(v2.1): replace this naive keyword-overlap heuristic with an
  // embedding-cosine coverage check once the synthesis worker stores
  // gap embeddings alongside the candidate row. The current heuristic
  // is conservative (over-triggers follow-ups when gap + signal share
  // no literal token) which is the right direction for content quality
  // but produces some noise.
  const uncovered = computeUncoveredGaps(
    { serpGaps: ctx.candidate.serpGaps },
    ctx.confirmedSignals,
  );

  if (uncovered.length === 0) {
    deps.logger.info(
      {
        source: SOURCE,
        action: 'follow_up_loop_no_uncovered_gaps',
        sessionId: ctx.sessionId,
        candidateId: ctx.candidateId,
      },
      'no uncovered SERP gaps; skipping follow-up loop',
    );
    return { kind: 'completed', followUpsAnswered: 0 };
  }

  const gapsToAsk = selectGapsToAsk(uncovered, deps.logger, ctx.sessionId);

  // Flip session → follow_up on entry (before any per-gap I/O).
  await deps.db
    .update(interviewSessions)
    .set({ status: 'follow_up' })
    .where(eq(interviewSessions.id, ctx.sessionId));

  let followUpsAnswered = 0;

  for (const gap of gapsToAsk) {
    // ── Generate
    const gen = await generateFn({
      uncoveredGap: gap,
      candidate: {
        proposedTitle: ctx.candidate.proposedTitle,
        primaryKeyword: ctx.candidate.primaryKeyword,
      },
      confirmedSignals: ctx.confirmedSignals,
      anthropic: deps.anthropic,
      logger: deps.logger,
      clusterContextBlock: ctx.clusterContextBlock,
    });
    if (!gen.ok) {
      deps.logger.warn(
        {
          source: SOURCE,
          action: 'follow_up_generation_failed',
          sessionId: ctx.sessionId,
          gap,
          reason: gen.reason,
          detail: gen.detail,
        },
        'follow-up generation failed; skipping this gap',
      );
      continue;
    }

    // ── Format + send
    const questionIndex = await getNextQuestionIndex(deps, ctx.sessionId);
    const messageText = formatFollowUpTelegramMessage({
      primaryKeyword: ctx.candidate.primaryKeyword,
      gap,
      followUpText: gen.question.follow_up_text,
    });
    const send = await trySendTelegram({
      fetchFn: deps.fetchFn,
      token: deps.env.telegramBotToken,
      chatId: deps.env.telegramChatId,
      text: messageText,
    });
    if (!send.ok) {
      deps.logger.error(
        {
          source: SOURCE,
          action: 'follow_up_send_failed',
          sessionId: ctx.sessionId,
          gap,
          reason: send.error,
        },
        'follow-up question send failed; still waiting for reply',
      );
    }

    // Persist the question entry.
    await persistQuestionEntry(deps, ctx.sessionId, {
      index: questionIndex,
      signal_id: '',
      question_text: gen.question.follow_up_text,
      sent_at: deps.now.toISOString(),
      question_type: QUESTION_TYPE,
    });

    // ── Wait for the reply
    let reply = await deps.waitForReply(ctx.sessionId, SEVEN_DAYS_MS);
    if (reply === null) {
      await resolveMidLoopTimeout(deps, ctx);
      return { kind: 'timed_out' };
    }

    let recorded = recordAnswerFromReply(reply, questionIndex, deps.now);

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
            action: 'follow_up_voice_fallback_send_failed',
            sessionId: ctx.sessionId,
            reason: ack.error,
          },
          'follow-up voice-transcription-failure prompt send failed',
        );
      }
      reply = await deps.waitForReply(ctx.sessionId, SEVEN_DAYS_MS);
      if (reply === null) {
        const audioOnlyAnswer: InterviewAnswer & {
          question_type: AnswerQuestionType;
        } = {
          question_index: questionIndex,
          response: 'voice',
          timestamp: deps.now.toISOString(),
          question_type: QUESTION_TYPE,
          ...(typeof audioUrl === 'string' ? { audio_url: audioUrl } : {}),
        };
        await persistAnswerEntry(deps, ctx.sessionId, audioOnlyAnswer);
        await resolveMidLoopTimeout(deps, ctx);
        return { kind: 'timed_out' };
      }
      const second = recordAnswerFromReply(reply, questionIndex, deps.now);
      if ('needsTextFallback' in second) {
        const audioOnlyAnswer: InterviewAnswer & {
          question_type: AnswerQuestionType;
        } = {
          question_index: questionIndex,
          response: 'voice',
          timestamp: deps.now.toISOString(),
          question_type: QUESTION_TYPE,
          ...(typeof second.failureAudioUrl === 'string'
            ? { audio_url: second.failureAudioUrl }
            : {}),
        };
        await persistAnswerEntry(deps, ctx.sessionId, audioOnlyAnswer);
        followUpsAnswered += 1;
        continue;
      }
      recorded = second;
    }

    await persistAnswerEntry(deps, ctx.sessionId, recorded.answer);
    followUpsAnswered += 1;
  }

  return { kind: 'completed', followUpsAnswered };
}
