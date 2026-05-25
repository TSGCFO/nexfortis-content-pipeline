/**
 * Confirmation-question orchestrator (the meat of PR 2).
 *
 * Picks up where `runInterviewSession` leaves off after the preview is
 * acknowledged. Implements PRD §4.3 + §4.5 + §4.6 (CONFIRMING and
 * COMPLETED transitions) + §7.2 (quality gate + corpus-quality alert).
 *
 * Two-phase design (see PLAN.md §2.5):
 *
 *   Phase 1 — generate-and-gate (synchronous, no Telegram I/O)
 *     - For each selected signal (max 5), call Opus 4.7 → quality gate.
 *       Regenerate once on QG failure. Record exclusions.
 *     - Persist exclusions to `interview_sessions.signal_exclusions`.
 *     - If > 2 signals were excluded, send the one-time corpus-quality
 *       alert message NOW (between the preview and the first question,
 *       per PRD §7.2 final paragraph).
 *
 *   Phase 2 — send-and-wait (per surviving question)
 *     - Format + send the question with the inline keyboard.
 *     - Append to `interview_sessions.questions`. Transition status
 *       `preview_sent` → `confirming` on the first question.
 *     - `waitForReply` up to 7 days. Null → mid-interview timeout.
 *     - Parse the reply: callback / text / voice. Record answer to
 *       `interview_sessions.answers`. If choice ∈ {yes, anon}, append
 *       signal id to `interview_sessions.confirmed_chunk_ids`.
 *
 * After the loop, the orchestrator returns a discriminated outcome — the
 * caller (`runInterviewSession`) handles the terminal DB writes
 * (`completed` status, completion message, etc.).
 *
 * Never throws — every external failure path is captured in a logged
 * `Result`-style value or surfaced through the discriminated outcome.
 */

import { eq } from 'drizzle-orm';

import {
  articleCandidates,
  interviewSessions,
  type Database,
  type InterviewAnswer,
  type InterviewQuestion,
  type InterviewSignalExclusion,
} from '@ncp/db';
import type { Logger } from '@ncp/logger';

import { buildConfirmationKeyboard } from '../../lib/build-confirmation-keyboard.js';
import { formatConfirmationMessage } from '../../lib/format-confirmation-message.js';
import {
  selectSignalsForCluster,
  type SelectedSignal,
} from '../../lib/select-signals-for-cluster.js';
import type { OpusAnthropicLike } from './anthropic-shapes.js';
import { buildTimeoutMessage } from './build-timeout-message.js';
import { generateQuestion } from './generate-question.js';
import {
  buildCorpusQualityAlertMessage,
  buildVoiceTranscriptionFailureMessage,
} from './messages.js';
import { qualityGate } from './quality-gate.js';
import type {
  ConfirmationLoopOutcome,
  IncomingReplyEvent,
  InterviewSessionEnv,
  QuestionResponse,
  SessionContext,
} from './types.js';

const SOURCE = 'telegram_bot' as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Threshold from PRD §7.2 — strictly greater than 2 triggers the alert. */
const CORPUS_QUALITY_EXCLUSION_THRESHOLD = 2;

// ─────────────────────────────────────────────────────────────────────────
// Public DI surface
// ─────────────────────────────────────────────────────────────────────────

export interface ConfirmationLoopDeps {
  db: Database;
  logger: Logger;
  now: Date;
  env: InterviewSessionEnv;
  anthropic: OpusAnthropicLike;
  fetchFn: typeof fetch;
  /** Defaults to `selectSignalsForCluster`. Injectable for tests. */
  selectSignalsFn?: typeof selectSignalsForCluster;
  /** Defaults to `generateQuestion`. Injectable for tests. */
  generateQuestionFn?: typeof generateQuestion;
  /** Same signature as PR 1's deps. Returns null on timeout. */
  waitForReply: (
    sessionId: string,
    timeoutMs: number,
  ) => Promise<IncomingReplyEvent | null>;
}

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

interface SurvivingQuestion {
  signal: SelectedSignal;
  question: QuestionResponse;
}

function buildClusterContextBlock(signals: readonly SelectedSignal[]): string {
  const lines: string[] = [];
  lines.push('# Cluster context — all signals being considered for this article');
  lines.push('');
  for (const s of signals) {
    lines.push(`-- signal_id: ${s.id}`);
    lines.push(`   source: ${s.source}`);
    lines.push(`   captured_at_iso: ${s.capturedAt.toISOString()}`);
    lines.push(`   redacted_text:`);
    lines.push(s.redactedText);
    lines.push('');
  }
  return lines.join('\n');
}

interface TrySendOptions {
  fetchFn: typeof fetch;
  token: string;
  chatId: string;
  text: string;
  replyMarkup?: unknown;
}

interface SendResult {
  ok: boolean;
  error: string | undefined;
}

/**
 * Local Telegram sender that supports `reply_markup`. Mirrors
 * `send-telegram-message.ts`'s contract (never throws, returns
 * discriminated result) but cannot reuse that file because PR 1's helper
 * doesn't accept a keyboard. Inlined here per PLAN.md §2.4.
 */
async function trySendTelegram(opts: TrySendOptions): Promise<SendResult> {
  const url = `https://api.telegram.org/bot${opts.token}/sendMessage`;
  const body: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: opts.text,
    parse_mode: 'HTML',
  };
  if (opts.replyMarkup !== undefined) {
    body['reply_markup'] = opts.replyMarkup;
  }
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
// Phase 1 — generate-and-gate
// ─────────────────────────────────────────────────────────────────────────

interface Phase1Output {
  survivors: SurvivingQuestion[];
  exclusions: InterviewSignalExclusion[];
}

async function runPhase1(
  deps: ConfirmationLoopDeps,
  ctx: SessionContext,
  signals: SelectedSignal[],
): Promise<Phase1Output> {
  const generateFn = deps.generateQuestionFn ?? generateQuestion;
  const clusterContextBlock = buildClusterContextBlock(signals);

  const survivors: SurvivingQuestion[] = [];
  const exclusions: InterviewSignalExclusion[] = [];

  for (const signal of signals) {
    // First attempt
    const first = await generateFn({
      signal,
      candidate: {
        proposedTitle: ctx.candidate.proposedTitle,
        primaryKeyword: ctx.candidate.primaryKeyword,
      },
      anthropic: deps.anthropic,
      logger: deps.logger,
      clusterContextBlock,
    });
    if (!first.ok) {
      exclusions.push({
        signal_id: signal.id,
        reason: first.reason,
      });
      continue;
    }

    let qg = qualityGate({
      question: first.question,
      signal,
      primaryKeyword: ctx.candidate.primaryKeyword,
    });
    let chosen: QuestionResponse | undefined =
      qg.ok ? first.question : undefined;

    if (!qg.ok) {
      // One retry with an instruction that names the failure modes.
      const retryReason = qg.failures.join('+');
      const second = await generateFn({
        signal,
        candidate: {
          proposedTitle: ctx.candidate.proposedTitle,
          primaryKeyword: ctx.candidate.primaryKeyword,
        },
        anthropic: deps.anthropic,
        logger: deps.logger,
        clusterContextBlock,
        retryReason,
      });
      if (!second.ok) {
        exclusions.push({
          signal_id: signal.id,
          reason: second.reason,
        });
        continue;
      }
      qg = qualityGate({
        question: second.question,
        signal,
        primaryKeyword: ctx.candidate.primaryKeyword,
      });
      if (!qg.ok) {
        exclusions.push({
          signal_id: signal.id,
          reason: 'quality_gate',
        });
        continue;
      }
      chosen = second.question;
    }

    // Defensive: `chosen` is assigned in every non-`continue` branch
    // above. The narrowing is for the TypeScript checker.
    if (chosen === undefined) continue;
    survivors.push({ signal, question: chosen });
  }

  return { survivors, exclusions };
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 — send-and-wait
// ─────────────────────────────────────────────────────────────────────────

interface LoopState {
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  confirmedChunkIds: string[];
}

async function persistQuestion(
  deps: ConfirmationLoopDeps,
  sessionId: string,
  state: LoopState,
  isFirstQuestion: boolean,
): Promise<void> {
  if (isFirstQuestion) {
    await deps.db
      .update(interviewSessions)
      .set({
        status: 'confirming',
        questions: state.questions,
      })
      .where(eq(interviewSessions.id, sessionId));
    return;
  }
  await deps.db
    .update(interviewSessions)
    .set({ questions: state.questions })
    .where(eq(interviewSessions.id, sessionId));
}

async function persistAnswer(
  deps: ConfirmationLoopDeps,
  sessionId: string,
  state: LoopState,
): Promise<void> {
  await deps.db
    .update(interviewSessions)
    .set({
      answers: state.answers,
      confirmedChunkIds: state.confirmedChunkIds,
    })
    .where(eq(interviewSessions.id, sessionId));
}

interface AnswerRecord {
  answer: InterviewAnswer;
  /** True if this answer means the signal should be added to confirmed_chunk_ids. */
  confirmsSignal: boolean;
}

function recordAnswerFromReply(
  reply: IncomingReplyEvent,
  questionIndex: number,
  now: Date,
): AnswerRecord | { needsTextFallback: true; failureAudioUrl: string | undefined } {
  const data = reply.data;
  const timestamp = now.toISOString();

  if (data.messageType === 'callback' && data.callbackData !== undefined) {
    const choice = data.callbackData.choice;
    const answer: InterviewAnswer = {
      question_index: questionIndex,
      response: choice,
      timestamp,
    };
    return {
      answer,
      confirmsSignal: choice === 'yes' || choice === 'anon',
    };
  }

  if (data.messageType === 'voice') {
    const transcript =
      typeof data.transcript === 'string' ? data.transcript : null;
    if (transcript === null) {
      // Voice answer with no transcript — fall back to text reply.
      return {
        needsTextFallback: true,
        failureAudioUrl: data.audioUrl,
      };
    }
    const answer: InterviewAnswer = {
      question_index: questionIndex,
      response: 'voice',
      text: transcript,
      transcript,
      timestamp,
      ...(typeof data.audioUrl === 'string' ? { audio_url: data.audioUrl } : {}),
    };
    return { answer, confirmsSignal: false };
  }

  // Treat anything else (text / unspecified messageType) as a text answer.
  const answer: InterviewAnswer = {
    question_index: questionIndex,
    response: 'text',
    text: data.text,
    timestamp,
  };
  return { answer, confirmsSignal: false };
}

async function resolveMidLoopTimeout(
  deps: ConfirmationLoopDeps,
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
        action: 'mid_loop_timeout_ack_failed',
        sessionId: ctx.sessionId,
        candidateId: ctx.candidateId,
        reason: send.error,
      },
      'mid-interview timeout ack send failed',
    );
  }
}

async function runPhase2(
  deps: ConfirmationLoopDeps,
  ctx: SessionContext,
  survivors: SurvivingQuestion[],
): Promise<{ outcome: ConfirmationLoopOutcome; state: LoopState }> {
  const state: LoopState = {
    questions: [],
    answers: [],
    confirmedChunkIds: [],
  };

  for (let i = 0; i < survivors.length; i++) {
    const { signal, question } = survivors[i]!;
    const questionIndex = i + 1;
    const text = formatConfirmationMessage({
      questionIndex,
      totalQuestions: survivors.length,
      questionText: question.question_text,
      signalRedactedText: signal.redactedText,
    });
    const keyboard = buildConfirmationKeyboard({ questionIndex });

    const send = await trySendTelegram({
      fetchFn: deps.fetchFn,
      token: deps.env.telegramBotToken,
      chatId: deps.env.telegramChatId,
      text,
      replyMarkup: keyboard,
    });
    if (!send.ok) {
      // Mirror PR 1's policy: log + continue (do not abort an open session).
      deps.logger.error(
        {
          source: SOURCE,
          action: 'question_send_failed',
          sessionId: ctx.sessionId,
          questionIndex,
          signalId: signal.id,
          reason: send.error,
        },
        'confirmation question send failed; still waiting for reply',
      );
    }

    state.questions.push({
      index: questionIndex,
      signal_id: signal.id,
      question_text: question.question_text,
      sent_at: deps.now.toISOString(),
    });
    await persistQuestion(deps, ctx.sessionId, state, /* first */ i === 0);

    // Wait for the answer.
    let reply = await deps.waitForReply(ctx.sessionId, SEVEN_DAYS_MS);
    if (reply === null) {
      await resolveMidLoopTimeout(deps, ctx);
      return { outcome: { kind: 'timed_out' }, state };
    }

    let recorded = recordAnswerFromReply(reply, questionIndex, deps.now);

    if ('needsTextFallback' in recorded) {
      // Whisper failed on the voice note. Send the fallback prompt and
      // wait once more for a text reply. Per PRD §6.5: "Continue waiting
      // for a text reply. Do not crash."
      const audioUrl = recorded.failureAudioUrl;
      const fallback = await trySendTelegram({
        fetchFn: deps.fetchFn,
        token: deps.env.telegramBotToken,
        chatId: deps.env.telegramChatId,
        text: buildVoiceTranscriptionFailureMessage(),
      });
      if (!fallback.ok) {
        deps.logger.warn(
          {
            source: SOURCE,
            action: 'voice_fallback_send_failed',
            sessionId: ctx.sessionId,
            questionIndex,
            reason: fallback.error,
          },
          'voice-transcription-failure fallback message send failed',
        );
      }
      reply = await deps.waitForReply(ctx.sessionId, SEVEN_DAYS_MS);
      if (reply === null) {
        // Record an audio-only answer so the corpus still captures the
        // failed-transcription event, then transition to timeout.
        // `transcript` is intentionally OMITTED (not null) to match the
        // `InterviewAnswer.transcript?: string` shape — absence is the
        // signal that transcription failed.
        state.answers.push({
          question_index: questionIndex,
          response: 'voice',
          timestamp: deps.now.toISOString(),
          ...(typeof audioUrl === 'string' ? { audio_url: audioUrl } : {}),
        });
        await persistAnswer(deps, ctx.sessionId, state);
        await resolveMidLoopTimeout(deps, ctx);
        return { outcome: { kind: 'timed_out' }, state };
      }
      recorded = recordAnswerFromReply(reply, questionIndex, deps.now);
      if ('needsTextFallback' in recorded) {
        // Two voice-with-failed-transcription replies in a row — record
        // an audio-only entry and continue rather than recursively
        // re-prompting indefinitely.
        state.answers.push({
          question_index: questionIndex,
          response: 'voice',
          timestamp: deps.now.toISOString(),
          ...(typeof recorded.failureAudioUrl === 'string'
            ? { audio_url: recorded.failureAudioUrl }
            : {}),
        });
        await persistAnswer(deps, ctx.sessionId, state);
        continue;
      }
    }

    state.answers.push(recorded.answer);
    if (recorded.confirmsSignal) {
      state.confirmedChunkIds.push(signal.id);
    }
    await persistAnswer(deps, ctx.sessionId, state);
  }

  // TODO(pr3): follow-up question loop entry point — when PR 3 adds the
  // PRD §4.4 SERP-gap follow-up flow, branch here on whether the
  // candidate's serp_gaps are covered by `confirmed_chunk_ids` and emit
  // 1–2 open-ended follow-up questions before returning `completed`.
  return {
    outcome: {
      kind: 'completed',
      confirmedCount: state.confirmedChunkIds.length,
      excludedCount: 0, // overwritten by caller using phase1 exclusions
    },
    state,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Orchestrator entry point
// ─────────────────────────────────────────────────────────────────────────

export async function runConfirmationLoop(
  deps: ConfirmationLoopDeps,
  ctx: SessionContext,
): Promise<ConfirmationLoopOutcome> {
  const selectFn = deps.selectSignalsFn ?? selectSignalsForCluster;

  const signals = await selectFn(deps.db, {
    evidenceChunkIds: ctx.candidate.evidenceChunkIds,
  });
  if (signals.length === 0) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'confirmation_loop_no_signals',
        sessionId: ctx.sessionId,
        candidateId: ctx.candidateId,
      },
      'no selectable signals for cluster; ending session before any questions',
    );
    return { kind: 'no_signals' };
  }

  // Phase 1
  const phase1 = await runPhase1(deps, ctx, signals);

  // Persist exclusions even if there are zero survivors — keeps the
  // audit row complete for post-mortem analysis.
  if (phase1.exclusions.length > 0) {
    await deps.db
      .update(interviewSessions)
      .set({ signalExclusions: phase1.exclusions })
      .where(eq(interviewSessions.id, ctx.sessionId));
  }

  // Corpus-quality alert — sent ONCE per session, BEFORE the first
  // question, when exclusions exceeded the threshold.
  if (phase1.exclusions.length > CORPUS_QUALITY_EXCLUSION_THRESHOLD) {
    const alert = await trySendTelegram({
      fetchFn: deps.fetchFn,
      token: deps.env.telegramBotToken,
      chatId: deps.env.telegramChatId,
      text: buildCorpusQualityAlertMessage(),
    });
    if (!alert.ok) {
      deps.logger.warn(
        {
          source: SOURCE,
          action: 'corpus_quality_alert_send_failed',
          sessionId: ctx.sessionId,
          reason: alert.error,
        },
        'corpus-quality alert send failed; loop continues',
      );
    }
  }

  // If every signal was excluded, return `completed` with zero
  // confirmations rather than asking nothing. The caller will still
  // transition the session to `completed` and send the placeholder.
  if (phase1.survivors.length === 0) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'confirmation_loop_all_excluded',
        sessionId: ctx.sessionId,
        excludedCount: phase1.exclusions.length,
      },
      'all signals excluded by phase 1; no questions will be sent',
    );
    return {
      kind: 'completed',
      confirmedCount: 0,
      excludedCount: phase1.exclusions.length,
    };
  }

  // Phase 2
  const phase2 = await runPhase2(deps, ctx, phase1.survivors);

  if (phase2.outcome.kind === 'timed_out') {
    return phase2.outcome;
  }
  // Stitch in the phase 1 exclusion count.
  return {
    kind: 'completed',
    confirmedCount: phase2.state.confirmedChunkIds.length,
    excludedCount: phase1.exclusions.length,
  };
}

