/**
 * Inngest function: `interview-session` (PR 1 of 3 — F2 Telegram bot).
 *
 * Triggered by the synthesis worker's `interview.session.requested` event
 * (`{ candidateId: string }`). Sleeps until the next Monday 08:00
 * America/New_York (Eastern, DST-correct), sends a topic preview to
 * Hassan's Telegram chat, then waits up to 7 days for a reply.
 *
 * --- Scope (PR 1 only) ----------------------------------------------------
 *
 *  Implemented:
 *    - readEnv() validation for the 3 vars actually used in this slice
 *    - Monday-morning preview send
 *    - candidate status guard (missing / terminal → return no_candidate)
 *    - candidate status transition to 'awaiting_interview'
 *    - interview_sessions row insert with status='preview_sent'
 *    - waitForReply with three terminal branches: null (timeout) /
 *      '/skip' / anything else (preview_acknowledged → handoff to PR 2)
 *
 *  NOT in PR 1:
 *    - grammY long-poll listener that produces `telegram.message.received`
 *    - Confirmation questions, voice transcription, LLM calls
 *    - 48-hour reminder, all-skipped fallback
 *    - /status, /help, /delete_signal commands
 *    - Closing summary
 *
 * --- Architecture ---------------------------------------------------------
 *
 * The DI core `runInterviewSession(deps, candidateId)` is exported for
 * testing — it has no Inngest dependency. The factory
 * `createInterviewSessionJob(inngest)` plumbs Inngest's step primitives
 * (`step.sleepUntil`, `step.waitForEvent`) through the deps object.
 *
 * Note: `step.sleepUntil` and `step.waitForEvent` cannot nest inside
 * `step.run`, so the body of `runInterviewSession` is not wrapped in a
 * `step.run` block — Inngest's retry semantics operate on the whole
 * function. For a single-candidate, low-cadence job this is acceptable;
 * see the docstring in the synthesis-worker's index.ts for the same
 * trade-off written long-form.
 */

import { eq } from 'drizzle-orm';
import type { Inngest, InngestFunction } from 'inngest';

import {
  articleCandidates,
  createDbClient,
  interviewSessions,
  type Database,
} from '@ncp/db';
import { createLogger, type Logger } from '@ncp/logger';

import { buildPreviewMessage } from './build-preview-message.js';
import { buildSkipAckMessage } from './build-skip-ack-message.js';
import { buildTimeoutMessage } from './build-timeout-message.js';
import { runConfirmationLoop } from './confirmation-loop.js';
import type { OpusAnthropicLike } from './generate-question.js';
import { EnvNotConfiguredError } from './errors.js';
import { nextMondayAt8amEastern } from './next-monday-eastern.js';
import { sendTelegramMessage } from './send-telegram-message.js';
import type {
  CandidateForInterview,
  ConfirmationLoopOutcome,
  IncomingReplyEvent,
  InterviewSessionEnv,
  RunOutcome,
  SessionContext,
  SignalForInterview,
} from './types.js';

const SOURCE = 'telegram_bot' as const;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Candidate statuses that mean "this candidate is done and should not be
 * re-interviewed". A candidate in any of these states aborts the run with
 * `{ kind: 'no_candidate' }` (and a warn log).
 */
const TERMINAL_CANDIDATE_STATUSES: ReadonlySet<string> = new Set([
  'skipped',
  'timed_out',
  'interview_complete',
  'shelved',
  'published',
  'archived',
]);

/**
 * Read and validate the env vars the interview-session function uses.
 *
 * PR 2 extends PR 1's three vars with `OPENAI_API_KEY` (Whisper) and
 * `ANTHROPIC_API_KEY` (Claude Opus 4.7 question generation). Both are
 * required because the confirmation loop cannot proceed without them.
 */
export function readEnv(): InterviewSessionEnv {
  const databaseUrl = process.env['DATABASE_URL'];
  const telegramBotToken = process.env['TELEGRAM_BOT_TOKEN'];
  const telegramChatId = process.env['TELEGRAM_CHAT_ID'];
  const openaiApiKey = process.env['OPENAI_API_KEY'];
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];

  const missing: string[] = [];
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    missing.push('DATABASE_URL');
  }
  if (typeof telegramBotToken !== 'string' || telegramBotToken.length === 0) {
    missing.push('TELEGRAM_BOT_TOKEN');
  }
  if (typeof telegramChatId !== 'string' || telegramChatId.length === 0) {
    missing.push('TELEGRAM_CHAT_ID');
  }
  if (typeof openaiApiKey !== 'string' || openaiApiKey.length === 0) {
    missing.push('OPENAI_API_KEY');
  }
  if (typeof anthropicApiKey !== 'string' || anthropicApiKey.length === 0) {
    missing.push('ANTHROPIC_API_KEY');
  }
  if (missing.length > 0) {
    throw new EnvNotConfiguredError(missing);
  }
  return {
    databaseUrl: databaseUrl as string,
    telegramBotToken: telegramBotToken as string,
    telegramChatId: telegramChatId as string,
    openaiApiKey: openaiApiKey as string,
    anthropicApiKey: anthropicApiKey as string,
  };
}

/**
 * Dependencies for the DI core. The factory below maps these to Inngest's
 * step primitives; tests inject fakes.
 */
export interface RunInterviewSessionDeps {
  db: Database;
  logger: Logger;
  now: Date;
  env: InterviewSessionEnv;
  /** Maps to `step.sleepUntil('wait-monday-morning', when)`. */
  sleepUntil: (when: Date) => Promise<void>;
  /**
   * Maps to `step.waitForEvent('await-preview-response', { event:
   * 'telegram.message.received', timeout, if })`. Returns `null` on
   * timeout, otherwise the typed event payload.
   */
  waitForReply: (
    sessionId: string,
    timeoutMs: number,
  ) => Promise<IncomingReplyEvent | null>;
  /**
   * Dispatches an Inngest event. PR 2 uses this for the
   * `interview.session.opened` notification that the grammY bot consumes
   * to populate its in-memory session map.
   */
  sendInngestEvent: (event: {
    name: 'interview.session.opened';
    data: { chatId: string; sessionId: string; candidateId: string };
  }) => Promise<void>;
  /** Injectable for tests. Defaults to global `fetch`. */
  fetchFn?: typeof fetch;
  /**
   * Anthropic Opus 4.7 client used by the confirmation-loop. Required in
   * production; tests inject a `vi.fn()`-backed mock.
   */
  anthropic: OpusAnthropicLike;
  /**
   * Per-question wait. Same shape as `waitForReply` but the loop names
   * each wait with a different Inngest step id (`await-confirmation-N`)
   * so retries are isolated per question.
   */
  waitForLoopReply: (
    sessionId: string,
    questionIndex: number,
    timeoutMs: number,
  ) => Promise<IncomingReplyEvent | null>;
  /**
   * Optional override for the confirmation loop. Production uses
   * `runConfirmationLoop`; tests inject a stub that returns a fixed
   * outcome to keep PR 1's integration tests focused.
   */
  runConfirmationLoop?: (
    context: SessionContext,
    selectSignals?: (
      candidate: CandidateForInterview,
    ) => Promise<readonly SignalForInterview[]>,
  ) => Promise<ConfirmationLoopOutcome>;
  /**
   * Optional override for the per-cluster signal selection. Production
   * binds this to the captureSignals Drizzle query; tests inject a
   * fixture-backed function.
   */
  selectSignals?: (
    candidate: CandidateForInterview,
  ) => Promise<readonly SignalForInterview[]>;
}

/**
 * Inner, dependency-injected business logic. `candidateId` is a positional
 * argument (not part of `deps`) because it is per-invocation data, while
 * `deps` is the ambient runtime context.
 */
export async function runInterviewSession(
  deps: RunInterviewSessionDeps,
  candidateId: string,
): Promise<RunOutcome> {
  const fetchFn = deps.fetchFn ?? fetch;

  // 1. Sleep until Monday 08:00 ET.
  await deps.sleepUntil(nextMondayAt8amEastern(deps.now));

  // 2. Load the candidate row.
  const rows = await deps.db
    .select({
      id: articleCandidates.id,
      status: articleCandidates.status,
      pillar: articleCandidates.pillar,
      proposedTitle: articleCandidates.proposedTitle,
      primaryKeyword: articleCandidates.primaryKeyword,
      evidenceChunkIds: articleCandidates.evidenceChunkIds,
    })
    .from(articleCandidates)
    .where(eq(articleCandidates.id, candidateId));
  const candidate = rows[0];

  // 3. Missing / terminal guard.
  if (!candidate) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'candidate_unavailable',
        candidateId,
        status: 'not_found',
      },
      'article_candidate row missing; aborting interview session',
    );
    return { kind: 'no_candidate', candidateId };
  }
  if (TERMINAL_CANDIDATE_STATUSES.has(candidate.status)) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'candidate_unavailable',
        candidateId,
        status: candidate.status,
      },
      'article_candidate in terminal status; aborting interview session',
    );
    return { kind: 'no_candidate', candidateId };
  }

  // 4. Transition candidate status to 'awaiting_interview' (idempotent).
  if (candidate.status !== 'awaiting_interview') {
    await deps.db
      .update(articleCandidates)
      .set({ status: 'awaiting_interview' })
      .where(eq(articleCandidates.id, candidateId));
  }

  // 5. Create the interview_sessions row.
  const sessionRows = await deps.db
    .insert(interviewSessions)
    .values({
      candidateId,
      telegramChatId: deps.env.telegramChatId,
      startedAt: deps.now,
      status: 'preview_sent',
    })
    .returning({ id: interviewSessions.id });
  const sessionId = sessionRows[0]?.id;
  if (typeof sessionId !== 'string') {
    throw new Error(
      'interview-session: failed to capture inserted interview_sessions id',
    );
  }

  // 5b. (PR 2 backport) Dispatch `interview.session.opened` so the grammY
  // bot's in-memory session map can attach `sessionId` to subsequent
  // outbound `telegram.message.received` events. Done BEFORE the preview
  // send so the bot is ready to accept Hassan's reply.
  try {
    await deps.sendInngestEvent({
      name: 'interview.session.opened',
      data: {
        chatId: deps.env.telegramChatId,
        sessionId,
        candidateId,
      },
    });
  } catch (err) {
    // A failed event dispatch is recoverable on Inngest's retry of the
    // whole function — we do NOT abort the run here because the session
    // row has already been inserted. Log and continue.
    const reason = err instanceof Error ? err.message : String(err);
    deps.logger.error(
      {
        source: SOURCE,
        action: 'session_opened_dispatch_failed',
        sessionId,
        candidateId,
        reason,
      },
      'interview.session.opened dispatch failed; continuing',
    );
  }

  // 6. Send the preview message.
  const signalCount = candidate.evidenceChunkIds?.length ?? 0;
  const previewMessage = buildPreviewMessage({
    proposedTitle: candidate.proposedTitle,
    pillar: candidate.pillar,
    primaryKeyword: candidate.primaryKeyword,
    signalCount,
  });
  const previewResult = await sendTelegramMessage({
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    message: previewMessage,
    fetchFn,
  });
  if (!previewResult.ok) {
    // A preview send failure is recoverable on retry; we do not want to
    // abort and orphan the session row. Continue to waitForReply.
    deps.logger.error(
      {
        source: SOURCE,
        action: 'preview_send_failed',
        sessionId,
        candidateId,
        reason: previewResult.error,
      },
      'telegram preview send failed; continuing to wait for reply',
    );
  }

  // 7. Wait for Hassan's reply (or 7-day timeout).
  const reply = await deps.waitForReply(sessionId, SEVEN_DAYS_MS);

  // 8. Resolve terminal branch.
  if (reply === null) {
    return resolveTimeout({
      deps,
      fetchFn,
      sessionId,
      candidateId,
      proposedTitle: candidate.proposedTitle,
    });
  }

  if (reply.data.text === '/skip') {
    return resolveSkip({
      deps,
      fetchFn,
      sessionId,
      candidateId,
      proposedTitle: candidate.proposedTitle,
    });
  }

  // 9. Hand off to the confirmation-question loop. Per PR 2, any non-
  // /skip, non-null reply transitions PR 1's `preview_sent` state into
  // the confirming phase and runs the per-signal Q&A loop until either
  // completion or a mid-loop 7-day timeout.
  const context: SessionContext = {
    sessionId,
    candidate: {
      id: candidate.id,
      pillar: candidate.pillar,
      proposedTitle: candidate.proposedTitle,
      primaryKeyword: candidate.primaryKeyword,
      evidenceChunkIds: candidate.evidenceChunkIds,
    },
  };
  const loop = deps.runConfirmationLoop ?? defaultRunConfirmationLoop(deps);
  const loopOutcome = await loop(context, deps.selectSignals);
  if (loopOutcome.kind === 'timed_out') {
    return {
      kind: 'timed_out',
      sessionId: loopOutcome.sessionId,
      candidateId: loopOutcome.candidateId,
    };
  }
  return {
    kind: 'completed',
    sessionId: loopOutcome.sessionId,
    candidateId: loopOutcome.candidateId,
    confirmedCount: loopOutcome.confirmedCount,
    excludedCount: loopOutcome.excludedCount,
  };
}

/**
 * Default loop binding — calls the in-tree `runConfirmationLoop` with the
 * deps PR 2 wires from the Inngest factory. Hoisted out of
 * `runInterviewSession` so test code can ignore it by passing
 * `deps.runConfirmationLoop` explicitly.
 */
function defaultRunConfirmationLoop(
  deps: RunInterviewSessionDeps,
): (
  context: SessionContext,
  selectSignals?: (
    candidate: CandidateForInterview,
  ) => Promise<readonly SignalForInterview[]>,
) => Promise<ConfirmationLoopOutcome> {
  return (context, selectSignals) => {
    const fetchFn = deps.fetchFn ?? fetch;
    return runConfirmationLoop(
      {
        db: deps.db,
        logger: deps.logger,
        env: deps.env,
        anthropic: deps.anthropic,
        waitForReply: deps.waitForLoopReply,
        fetchFn,
        now: deps.now,
        ...(selectSignals !== undefined ? { selectSignals } : {}),
      },
      context,
    );
  };
}

interface ResolveTerminalArgs {
  deps: RunInterviewSessionDeps;
  fetchFn: typeof fetch;
  sessionId: string;
  candidateId: string;
  proposedTitle: string;
}

async function resolveTimeout(args: ResolveTerminalArgs): Promise<RunOutcome> {
  const { deps, fetchFn, sessionId, candidateId, proposedTitle } = args;
  await deps.db
    .update(interviewSessions)
    .set({ status: 'timed_out' })
    .where(eq(interviewSessions.id, sessionId));
  await deps.db
    .update(articleCandidates)
    .set({ status: 'archived' })
    .where(eq(articleCandidates.id, candidateId));
  const ack = await sendTelegramMessage({
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    message: buildTimeoutMessage({ proposedTitle }),
    fetchFn,
  });
  if (!ack.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'timeout_ack_send_failed',
        sessionId,
        candidateId,
        reason: ack.error,
      },
      'telegram timeout message send failed',
    );
  }
  return { kind: 'timed_out', sessionId, candidateId };
}

async function resolveSkip(args: ResolveTerminalArgs): Promise<RunOutcome> {
  const { deps, fetchFn, sessionId, candidateId, proposedTitle } = args;
  await deps.db
    .update(interviewSessions)
    .set({ status: 'skipped' })
    .where(eq(interviewSessions.id, sessionId));
  await deps.db
    .update(articleCandidates)
    .set({ status: 'skipped' })
    .where(eq(articleCandidates.id, candidateId));
  const ack = await sendTelegramMessage({
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    message: buildSkipAckMessage({ proposedTitle }),
    fetchFn,
  });
  if (!ack.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'skip_ack_send_failed',
        sessionId,
        candidateId,
        reason: ack.error,
      },
      'telegram skip-ack message send failed',
    );
  }
  return { kind: 'skipped', sessionId, candidateId };
}

/**
 * Inngest factory. Mirrors the pattern in
 * `artifacts/synthesis-worker/src/jobs/synthesize-weekly/index.ts` —
 * factory rather than top-level `inngest.createFunction(...)` call so
 * `src/index.ts` (which owns the `Inngest` instance) can construct the
 * function without a circular import.
 */
export function createInterviewSessionJob(
  inngest: Inngest.Any,
): InngestFunction.Any {
  return inngest.createFunction(
    {
      id: 'interview-session',
      name: 'Journalist-Mode Interview Session',
    },
    { event: 'interview.session.requested' },
    async ({ event, step }) => {
      const env = readEnv();
      const logger = createLogger({ source: SOURCE });
      const db = createDbClient({ connectionString: env.databaseUrl });
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({
        apiKey: env.anthropicApiKey,
      }) as unknown as OpusAnthropicLike;

      const data = event.data as { candidateId?: unknown };
      const candidateId = data.candidateId;
      if (typeof candidateId !== 'string' || candidateId.length === 0) {
        throw new Error(
          'interview-session: event payload missing string `candidateId`',
        );
      }

      const buildIfFilter = (sessionId: string): string =>
        // Safe-by-construction interpolation: see PR 1's note in the
        // waitForReply helper below for the safety argument.
        `event.data.chatId == "${env.telegramChatId}" && event.data.sessionId == "${sessionId}"`;

      const decodeReply = (
        result: unknown,
      ): IncomingReplyEvent | null => {
        if (result === null) return null;
        const r = result as {
          data?: {
            text?: unknown;
            chatId?: unknown;
            sessionId?: unknown;
            messageType?: unknown;
            voiceFileId?: unknown;
            audioUrl?: unknown;
            transcript?: unknown;
            transcriptionError?: unknown;
            callbackData?: unknown;
          };
        };
        const text = r.data?.text;
        const chatId = r.data?.chatId;
        const sId = r.data?.sessionId;
        if (
          typeof text !== 'string' ||
          typeof chatId !== 'string' ||
          typeof sId !== 'string'
        ) {
          return null;
        }
        const messageType = r.data?.messageType;
        const decoded: IncomingReplyEvent = {
          data: {
            text,
            chatId,
            sessionId: sId,
            ...(messageType === 'text' ||
            messageType === 'voice' ||
            messageType === 'callback'
              ? { messageType }
              : {}),
            ...(typeof r.data?.voiceFileId === 'string'
              ? { voiceFileId: r.data.voiceFileId }
              : {}),
            ...(typeof r.data?.audioUrl === 'string'
              ? { audioUrl: r.data.audioUrl }
              : {}),
            ...(typeof r.data?.transcript === 'string'
              ? { transcript: r.data.transcript }
              : r.data?.transcript === null
                ? { transcript: null }
                : {}),
            ...(typeof r.data?.transcriptionError === 'string'
              ? { transcriptionError: r.data.transcriptionError }
              : {}),
            ...(typeof r.data?.callbackData === 'string'
              ? { callbackData: r.data.callbackData }
              : {}),
          },
        };
        return decoded;
      };

      const outcome = await runInterviewSession(
        {
          db,
          logger,
          env,
          now: new Date(),
          anthropic,
          sleepUntil: async (when) => {
            await step.sleepUntil('wait-monday-morning', when);
          },
          waitForReply: async (sessionId, timeoutMs) => {
            // Inngest's typed `match` is @deprecated in v3.54.x and only
            // accepts a single dotted property name. For the combined
            // (chatId + sessionId) filter we need the supported CEL-style
            // `if` expression instead.
            //
            // Safe-by-construction interpolation: `sessionId` is a UUID
            // generated by Postgres `gen_random_uuid()` (hex digits + dashes
            // only); `env.telegramChatId` is Telegram's numeric chat ID
            // (digits, optional leading `-`). Neither will ever contain a
            // `"` character, so direct interpolation into the CEL string
            // literal cannot break the expression. If this ever changes
            // (e.g. session ids become opaque strings), escape both values
            // before interpolation.
            const result = await step.waitForEvent(
              'await-preview-response',
              {
                event: 'telegram.message.received',
                timeout: `${timeoutMs}ms`,
                if: buildIfFilter(sessionId),
              },
            );
            return decodeReply(result);
          },
          waitForLoopReply: async (sessionId, questionIndex, timeoutMs) => {
            const result = await step.waitForEvent(
              `await-confirmation-${questionIndex}`,
              {
                event: 'telegram.message.received',
                timeout: `${timeoutMs}ms`,
                if: buildIfFilter(sessionId),
              },
            );
            return decodeReply(result);
          },
          sendInngestEvent: async (payload) => {
            await step.sendEvent('dispatch-session-opened', payload);
          },
          fetchFn: fetch,
        },
        candidateId,
      );
      return { outcome };
    },
  );
}
