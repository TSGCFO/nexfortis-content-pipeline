/**
 * Confirmation-question loop (PRD §4.3 + §7.2).
 *
 * Runs after PR 1's preview-acknowledged branch. For each selected signal
 * (max 5):
 *
 *   1. Generate a confirmation question via Claude Opus 4.7
 *      (`generate-question.ts`).
 *   2. Run the quality gate. On failure, regenerate exactly once; if the
 *      retry also fails, exclude the signal and continue.
 *   3. On `no_specifics` or `api_error` from Claude — exclude.
 *   4. Append the question to `interview_sessions.questions`, transition
 *      session→'confirming' on the first send, send to Telegram, and
 *      wait for a reply (button / text / voice) via the injected
 *      `waitForReply`.
 *   5. Record the answer in `interview_sessions.answers`. If the answer
 *      is `yes` or `anon`, add the signal id to
 *      `interview_sessions.confirmed_chunk_ids`.
 *   6. If a mid-loop `waitForReply` returns null → 7-day timeout: run
 *      PR 1's timeout transition and return `{ kind: 'timed_out' }`.
 *
 * After the loop:
 *   - If `excludedCount > 2`, send the corpus-quality alert exactly once
 *     (sent BEFORE the first question — see `maybeSendCorpusQualityAlert`).
 *   - Transition session→'completed', candidate→'interview_complete',
 *     send the hardcoded completion placeholder.
 *
 * The loop is DI-friendly. All external dependencies (db, anthropic,
 * openai, fetch, waitForReply, ...) are injected via `deps`; the loop
 * never reaches out to its own module imports for IO.
 *
 * TODO(pr3): the call site where follow-up SERP-gap questions plug in
 * (see PRD §4.4) is marked with a `// TODO(pr3):` comment below.
 * TODO(pr3): the closing-summary Claude Haiku call replaces the hardcoded
 * placeholder built by `buildCompletionPlaceholderMessage`.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Logger } from '@ncp/logger';

import {
  articleCandidates,
  captureSignals,
  interviewSessions,
  type Database,
  type InterviewAnswer,
  type InterviewQuestion,
} from '@ncp/db';

import { buildConfirmationKeyboard } from '../../lib/build-confirmation-keyboard.js';
import { formatConfirmationMessage } from '../../lib/format-confirmation-message.js';
import {
  selectSignalsForCluster,
} from '../../lib/select-signals-for-cluster.js';

import { buildTimeoutMessage } from './build-timeout-message.js';
import { generateQuestion } from './generate-question.js';
import type { OpusAnthropicLike } from './generate-question.js';
import {
  buildCompletionPlaceholderMessage,
  buildCorpusQualityAlertMessage,
  buildVoiceTranscriptionFailureMessage,
} from './messages.js';
import { checkQualityGate } from './quality-gate.js';
import { sendTelegramMessage } from './send-telegram-message.js';
import type {
  CandidateForInterview,
  ConfirmationLoopOutcome,
  IncomingReplyEvent,
  InterviewSessionEnv,
  QualityGateFailure,
  QualityGateResult,
  QuestionGenerationResult,
  SessionContext,
  SignalExclusionEntry,
  SignalExclusionReason,
  SignalForInterview,
} from './types.js';

const SOURCE = 'telegram_bot' as const;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SIGNALS = 5;
const QUALITY_EXCLUSION_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Loop dependency surface.
// ---------------------------------------------------------------------------

/**
 * Reply shape expected from the bot. The `confirmation-loop` is agnostic
 * to how the bot resolves voice→transcript — the bot does that work and
 * forwards the structured event.
 */
export type LoopReply = IncomingReplyEvent;

export interface RunConfirmationLoopDeps {
  db: Database;
  logger: Logger;
  env: InterviewSessionEnv;
  anthropic: OpusAnthropicLike;
  /**
   * Maps to `step.waitForEvent('await-confirmation-N', ...)`. Returns
   * null on timeout.
   */
  waitForReply: (
    sessionId: string,
    questionIndex: number,
    timeoutMs: number,
  ) => Promise<LoopReply | null>;
  fetchFn: typeof fetch;
  now: Date;
  /**
   * Optional override for the signal selector. Tests inject a fixture-
   * backed function. Production calls into Drizzle.
   */
  selectSignals?: (
    candidate: CandidateForInterview,
  ) => Promise<readonly SignalForInterview[]>;
}

// ---------------------------------------------------------------------------
// Public surface.
// ---------------------------------------------------------------------------

export async function runConfirmationLoop(
  deps: RunConfirmationLoopDeps,
  context: SessionContext,
): Promise<ConfirmationLoopOutcome> {
  const signals = await loadSignals(deps, context.candidate);
  const totalSignals = signals.length;

  let confirmedCount = 0;
  let excludedCount = 0;
  let questionsSent = 0;
  let corpusAlertSent = false;

  const questions: InterviewQuestion[] = [];
  const answers: InterviewAnswer[] = [];
  const exclusions: SignalExclusionEntry[] = [];
  const confirmedChunkIds: string[] = [];

  for (const signal of signals) {
    if (questionsSent >= MAX_SIGNALS) break;

    const generated = await generateOrRetry({
      deps,
      candidate: context.candidate,
      signal,
    });

    if (!generated.ok) {
      excludedCount += 1;
      exclusions.push({
        signal_id: signal.id,
        reason: mapExclusionReason(generated),
      });
      await persistExclusion(deps, context.sessionId, exclusions);
      // Corpus-quality alert is fired on the FIRST exclusion that crosses
      // the threshold — see prompt: "between the preview and the first
      // question". Since the alert may fire after we've already sent
      // questions, we still want exactly one alert per session.
      if (
        !corpusAlertSent &&
        excludedCount > QUALITY_EXCLUSION_THRESHOLD
      ) {
        await sendCorpusQualityAlert(deps);
        corpusAlertSent = true;
      }
      continue;
    }

    const question = generated.question;
    const questionIndex = questionsSent + 1;
    const sendOutcome = await sendConfirmationQuestion({
      deps,
      questionIndex,
      totalQuestions: Math.min(MAX_SIGNALS, totalSignals),
      questionText: question.questionText,
      signal,
      candidate: context.candidate,
    });
    if (!sendOutcome.ok) {
      deps.logger.warn(
        {
          source: SOURCE,
          action: 'confirmation_question_send_failed',
          sessionId: context.sessionId,
          candidateId: context.candidate.id,
          signalId: signal.id,
          questionIndex,
          reason: sendOutcome.error,
        },
        'confirmation question send failed; continuing to wait for reply',
      );
    }
    questions.push({
      index: questionIndex,
      signal_id: signal.id,
      question_text: question.questionText,
      sent_at: deps.now.toISOString(),
    });
    await persistQuestions(deps, context.sessionId, questions);
    if (questionsSent === 0) {
      await deps.db
        .update(interviewSessions)
        .set({ status: 'confirming' })
        .where(eq(interviewSessions.id, context.sessionId));
    }
    questionsSent += 1;

    const reply = await deps.waitForReply(
      context.sessionId,
      questionIndex,
      SEVEN_DAYS_MS,
    );
    if (reply === null) {
      return handleMidLoopTimeout(deps, context);
    }

    const recorded = recordAnswer({
      reply,
      questionIndex,
      now: deps.now,
    });
    answers.push(recorded.answer);
    await persistAnswers(deps, context.sessionId, answers);

    if (recorded.confirmsSignal) {
      confirmedChunkIds.push(signal.id);
      await persistConfirmed(deps, context.sessionId, confirmedChunkIds);
    }

    if (recorded.transcriptionFailed) {
      await sendVoiceFailureFallback(deps);
      // Loop continues — the bot will deliver a follow-up text answer as
      // a fresh `telegram.message.received` event. We need to wait again.
      const followUp = await deps.waitForReply(
        context.sessionId,
        questionIndex,
        SEVEN_DAYS_MS,
      );
      if (followUp === null) {
        return handleMidLoopTimeout(deps, context);
      }
      const followAnswer = recordAnswer({
        reply: followUp,
        questionIndex,
        now: deps.now,
      });
      answers.push(followAnswer.answer);
      await persistAnswers(deps, context.sessionId, answers);
      if (followAnswer.confirmsSignal) {
        confirmedChunkIds.push(signal.id);
        await persistConfirmed(deps, context.sessionId, confirmedChunkIds);
      }
    }
  }

  // TODO(pr3): if PR 3 detects an unfilled SERP gap in
  // `context.candidate`, plug 1–2 open-ended follow-up questions in
  // here. PR 2 always exits straight to the completed branch.

  // Final exclusion-alert flush in case the threshold was crossed on the
  // very last signal (defensive — also covered inside the loop).
  if (!corpusAlertSent && excludedCount > QUALITY_EXCLUSION_THRESHOLD) {
    await sendCorpusQualityAlert(deps);
    corpusAlertSent = true;
  }

  // Confirmed count is the size of the confirmedChunkIds array, not the
  // number of questions sent.
  confirmedCount = confirmedChunkIds.length;

  await finalizeCompleted(deps, context, confirmedCount);
  return {
    kind: 'completed',
    sessionId: context.sessionId,
    candidateId: context.candidate.id,
    confirmedCount,
    excludedCount,
  };
}

// ---------------------------------------------------------------------------
// Helpers — generation + quality gate.
// ---------------------------------------------------------------------------

async function generateOrRetry(args: {
  deps: RunConfirmationLoopDeps;
  candidate: CandidateForInterview;
  signal: SignalForInterview;
}): Promise<QuestionGenerationResult> {
  const { deps, candidate, signal } = args;
  const first = await generateQuestion({
    signal,
    candidate,
    anthropic: deps.anthropic,
    logger: deps.logger,
  });
  if (!first.ok) return first;

  const firstGate: QualityGateResult = checkQualityGate({
    question: first.question,
    signal: { redactedText: signal.redactedText },
    primaryKeyword: candidate.primaryKeyword,
  });
  if (firstGate.ok) return first;

  // Regenerate ONCE with retryReason hint.
  const failures: readonly QualityGateFailure[] = firstGate.failures;
  const second = await generateQuestion({
    signal,
    candidate,
    anthropic: deps.anthropic,
    logger: deps.logger,
    retryReason: failures,
  });
  if (!second.ok) return second;

  const secondGate = checkQualityGate({
    question: second.question,
    signal: { redactedText: signal.redactedText },
    primaryKeyword: candidate.primaryKeyword,
  });
  if (secondGate.ok) return second;

  return { ok: false, reason: 'api_error', detail: 'quality_gate_exhausted' };
}

function mapExclusionReason(
  result: QuestionGenerationResult & { ok: false },
): SignalExclusionReason {
  if (result.reason === 'no_specifics') return 'no_specifics';
  if (result.reason === 'api_error') {
    if (result.detail === 'quality_gate_exhausted') return 'quality_gate';
    return 'api_error';
  }
  return 'api_error';
}

// ---------------------------------------------------------------------------
// Helpers — send + persist.
// ---------------------------------------------------------------------------

async function sendConfirmationQuestion(args: {
  deps: RunConfirmationLoopDeps;
  questionIndex: number;
  totalQuestions: number;
  questionText: string;
  signal: SignalForInterview;
  candidate: CandidateForInterview;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = formatConfirmationMessage({
    questionIndex: args.questionIndex,
    totalQuestions: args.totalQuestions,
    questionText: args.questionText,
    redactedText: args.signal.redactedText,
    capturedAt: args.signal.capturedAt,
    tokenCount: args.signal.tokenCount,
    topic: args.candidate.primaryKeyword,
  });
  const keyboard = buildConfirmationKeyboard({
    questionIndex: args.questionIndex,
    signalId: args.signal.id,
  });
  // grammY's `InlineKeyboard.inline_keyboard` is a 2D array of buttons,
  // each of which is a discriminated union (CallbackButton | LoginButton |
  // ...). Every button this factory emits is a CallbackButton, so the
  // narrow `{ text, callback_data }` shape is correct. We project to that
  // shape explicitly because the sender accepts only callback buttons.
  const rows = keyboard.inline_keyboard.map((row) =>
    row.map((btn) => {
      const b = btn as { text: string; callback_data?: string };
      return { text: b.text, callback_data: b.callback_data ?? '' };
    }),
  );
  const result = await sendTelegramMessage({
    token: args.deps.env.telegramBotToken,
    chatId: args.deps.env.telegramChatId,
    message,
    fetchFn: args.deps.fetchFn,
    replyMarkup: rows,
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? 'unknown error' };
  }
  return { ok: true };
}

async function persistQuestions(
  deps: RunConfirmationLoopDeps,
  sessionId: string,
  questions: readonly InterviewQuestion[],
): Promise<void> {
  await deps.db
    .update(interviewSessions)
    .set({ questions: [...questions] })
    .where(eq(interviewSessions.id, sessionId));
}

async function persistAnswers(
  deps: RunConfirmationLoopDeps,
  sessionId: string,
  answers: readonly InterviewAnswer[],
): Promise<void> {
  await deps.db
    .update(interviewSessions)
    .set({ answers: [...answers] })
    .where(eq(interviewSessions.id, sessionId));
}

async function persistConfirmed(
  deps: RunConfirmationLoopDeps,
  sessionId: string,
  confirmedChunkIds: readonly string[],
): Promise<void> {
  await deps.db
    .update(interviewSessions)
    .set({ confirmedChunkIds: [...confirmedChunkIds] })
    .where(eq(interviewSessions.id, sessionId));
}

async function persistExclusion(
  deps: RunConfirmationLoopDeps,
  sessionId: string,
  exclusions: readonly SignalExclusionEntry[],
): Promise<void> {
  await deps.db
    .update(interviewSessions)
    .set({ signalExclusions: [...exclusions] })
    .where(eq(interviewSessions.id, sessionId));
}

async function sendCorpusQualityAlert(
  deps: RunConfirmationLoopDeps,
): Promise<void> {
  const result = await sendTelegramMessage({
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    message: buildCorpusQualityAlertMessage(),
    fetchFn: deps.fetchFn,
  });
  if (!result.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'corpus_quality_alert_send_failed',
        reason: result.error,
      },
      'corpus-quality alert send failed',
    );
  }
}

async function sendVoiceFailureFallback(
  deps: RunConfirmationLoopDeps,
): Promise<void> {
  const result = await sendTelegramMessage({
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    message: buildVoiceTranscriptionFailureMessage(),
    fetchFn: deps.fetchFn,
  });
  if (!result.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'voice_failure_fallback_send_failed',
        reason: result.error,
      },
      'voice-failure fallback send failed',
    );
  }
}

async function finalizeCompleted(
  deps: RunConfirmationLoopDeps,
  context: SessionContext,
  confirmedCount: number,
): Promise<void> {
  await deps.db
    .update(interviewSessions)
    .set({ status: 'completed', completedAt: deps.now })
    .where(eq(interviewSessions.id, context.sessionId));
  await deps.db
    .update(articleCandidates)
    .set({ status: 'interview_complete' })
    .where(eq(articleCandidates.id, context.candidate.id));
  const ack = await sendTelegramMessage({
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    // TODO(pr3): replace this hardcoded placeholder with the
    // Claude-Haiku-generated closing summary.
    message: buildCompletionPlaceholderMessage({ confirmedCount }),
    fetchFn: deps.fetchFn,
  });
  if (!ack.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'completion_ack_send_failed',
        sessionId: context.sessionId,
        candidateId: context.candidate.id,
        reason: ack.error,
      },
      'completion ack send failed',
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers — answer parsing.
// ---------------------------------------------------------------------------

interface RecordedAnswer {
  answer: InterviewAnswer;
  confirmsSignal: boolean;
  transcriptionFailed: boolean;
}

function recordAnswer(args: {
  reply: LoopReply;
  questionIndex: number;
  now: Date;
}): RecordedAnswer {
  const d = args.reply.data;
  const timestamp = args.now.toISOString();

  if (d.messageType === 'callback' && typeof d.callbackData === 'string') {
    // Suffix → response. `yes` / `anon` confirm; `skip` does not.
    const last = d.callbackData.slice(-2); // e.g. ':y'
    const code = last.startsWith(':') ? last.slice(1) : last;
    const response =
      code === 'y' ? 'yes' : code === 'a' ? 'anon' : code === 's' ? 'skip' : 'unknown';
    return {
      answer: {
        question_index: args.questionIndex,
        response,
        timestamp,
      },
      confirmsSignal: response === 'yes' || response === 'anon',
      transcriptionFailed: false,
    };
  }

  if (d.messageType === 'voice') {
    const transcriptionFailed = typeof d.transcriptionError === 'string';
    const answer: InterviewAnswer = {
      question_index: args.questionIndex,
      response: 'voice',
      timestamp,
      ...(typeof d.audioUrl === 'string' ? { audio_url: d.audioUrl } : {}),
      ...(typeof d.transcript === 'string' ? { transcript: d.transcript } : {}),
    };
    return {
      answer,
      confirmsSignal: false,
      transcriptionFailed,
    };
  }

  // Default: text reply (also covers PR 1's legacy shape with no
  // `messageType`).
  return {
    answer: {
      question_index: args.questionIndex,
      response: 'text',
      text: d.text,
      timestamp,
    },
    confirmsSignal: false,
    transcriptionFailed: false,
  };
}

// ---------------------------------------------------------------------------
// Mid-loop timeout transition. Mirrors PR 1's `resolveTimeout`.
// ---------------------------------------------------------------------------

async function handleMidLoopTimeout(
  deps: RunConfirmationLoopDeps,
  context: SessionContext,
): Promise<ConfirmationLoopOutcome> {
  await deps.db
    .update(interviewSessions)
    .set({ status: 'timed_out' })
    .where(eq(interviewSessions.id, context.sessionId));
  await deps.db
    .update(articleCandidates)
    .set({ status: 'archived' })
    .where(eq(articleCandidates.id, context.candidate.id));
  const ack = await sendTelegramMessage({
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    message: buildTimeoutMessage({
      proposedTitle: context.candidate.proposedTitle,
    }),
    fetchFn: deps.fetchFn,
  });
  if (!ack.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'mid_loop_timeout_ack_send_failed',
        sessionId: context.sessionId,
        candidateId: context.candidate.id,
        reason: ack.error,
      },
      'mid-loop timeout ack send failed',
    );
  }
  return {
    kind: 'timed_out',
    sessionId: context.sessionId,
    candidateId: context.candidate.id,
  };
}

// ---------------------------------------------------------------------------
// Signal-loading.
// ---------------------------------------------------------------------------

async function loadSignals(
  deps: RunConfirmationLoopDeps,
  candidate: CandidateForInterview,
): Promise<SignalForInterview[]> {
  if (deps.selectSignals !== undefined) {
    const rows = await deps.selectSignals(candidate);
    return [...rows];
  }
  return selectSignalsForCluster({
    evidenceChunkIds: candidate.evidenceChunkIds,
    queryFn: (ids) => defaultSignalQuery(deps.db, ids),
  });
}

async function defaultSignalQuery(
  db: Database,
  ids: readonly string[],
): Promise<readonly SignalForInterview[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: captureSignals.id,
      source: captureSignals.source,
      capturedAt: captureSignals.capturedAt,
      redactedText: captureSignals.redactedText,
      tokenCount: captureSignals.tokenCount,
      isDeleted: captureSignals.isDeleted,
    })
    .from(captureSignals)
    .where(
      and(
        inArray(captureSignals.id, [...ids]),
        eq(captureSignals.isDeleted, false),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    capturedAt: r.capturedAt,
    redactedText: r.redactedText,
    tokenCount: r.tokenCount,
    isDeleted: r.isDeleted,
  }));
}

// Mark as used so noUnusedImports doesn't trip on `sql` import which is
// reserved for future raw-jsonb append optimizations (jsonb_set).
void sql;
