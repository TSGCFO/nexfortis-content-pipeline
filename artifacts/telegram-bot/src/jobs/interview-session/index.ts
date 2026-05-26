/**
 * Inngest function: `interview-session` (PR 2 of 3 — F2 Telegram bot).
 *
 * Triggered by the synthesis worker's `interview.session.requested` event
 * (`{ candidateId: string }`). Sleeps until the next Monday 08:00
 * America/New_York (Eastern, DST-correct), sends a topic preview to
 * Hassan's Telegram chat, waits for a reply, then runs the confirmation
 * loop (up to 5 Claude-Opus-4.7-generated questions with three-button
 * answers / voice / text), and finally transitions the session +
 * candidate to terminal status.
 *
 * --- Scope (PR 2) ---------------------------------------------------------
 *
 *  Implemented:
 *    - readEnv() validation for the 4 vars actually used (PR 1's 3 +
 *      ANTHROPIC_API_KEY)
 *    - Monday-morning preview send (PR 1)
 *    - candidate / terminal-status guard (PR 1)
 *    - interview_sessions row insert with status='preview_sent' (PR 1)
 *    - PR 2 backport: dispatch `interview.session.opened` so the
 *      grammY long-poller populates its in-memory `chatId → ActiveSession`
 *      map
 *    - PR 1 terminal branches preserved: timeout (null reply), '/skip',
 *      candidate missing / already terminal
 *    - PR 2 new branch: confirmation loop (Phase 1 generate-and-gate +
 *      Phase 2 send-and-wait per question), terminating in `completed`
 *      or `timed_out` (mid-loop)
 *
 *  NOT in PR 2 (left for PR 3):
 *    - 48-hour soft reminder (PRD §4.7 / AC-F2-05)
 *    - All-skipped fallback open-ended question (US-F2-08 / AC-F2-07)
 *    - Open-ended SERP-gap follow-up question (PRD §4.4)
 *    - Claude Haiku closing summary (PRD §4.5 / §7.1) — PR 2 sends the
 *      hardcoded placeholder via `buildCompletionPlaceholderMessage`
 *    - /status, /help, /delete_signal commands
 *    - Mid-session /skip handler (PR 2 leaves it falling through as a
 *      plain text answer to the current question)
 *
 * --- Architecture ---------------------------------------------------------
 *
 * The DI core `runInterviewSession(deps, candidateId)` is exported for
 * testing — it has no Inngest dependency. The factory
 * `createInterviewSessionJob(inngest)` plumbs Inngest's step primitives
 * (`step.sleepUntil`, `step.waitForEvent`, `step.sendEvent`) through the
 * deps object, plus an `Anthropic` SDK instance cast to the local
 * `OpusAnthropicLike` structural type (see `anthropic-shapes.ts` for the
 * cast rationale).
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

import Anthropic from '@anthropic-ai/sdk';

import type { OpusAnthropicLike } from './anthropic-shapes.js';
import { buildPreviewMessage } from './build-preview-message.js';
import { buildSkipAckMessage } from './build-skip-ack-message.js';
import { buildTimeoutMessage } from './build-timeout-message.js';
import { nextDraftDay } from './business-day.js';
import { runConfirmationLoop } from './confirmation-loop.js';
import { EnvNotConfiguredError } from './errors.js';
import { runFallbackLoop } from './fallback-loop.js';
import { runFollowUpLoop } from './follow-up-loop.js';
import { generateClosingSummary } from './generate-closing-summary.js';
import { buildCompletionPlaceholderMessage } from './messages.js';
import { nextMondayAt8amEastern } from './next-monday-eastern.js';
import { runReminderStep } from './reminder.js';
import { sendTelegramMessage } from './send-telegram-message.js';
import type {
  IncomingReplyEvent,
  InterviewSessionEnv,
  RunOutcome,
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
 * Read and validate the env vars this Inngest function uses.
 *
 * PR 1 required `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
 * PR 2 adds `ANTHROPIC_API_KEY` (Claude Opus 4.7 question generation).
 * The bot process itself reads additional vars (`OPENAI_API_KEY` for
 * Whisper) via `bot/env.ts::readBotEnv()` — that surface is separate
 * because the Inngest function never transcribes voice notes itself.
 */
export function readEnv(): InterviewSessionEnv {
  const databaseUrl = process.env['DATABASE_URL'];
  const telegramBotToken = process.env['TELEGRAM_BOT_TOKEN'];
  const telegramChatId = process.env['TELEGRAM_CHAT_ID'];
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
   * Dispatches `interview.session.opened` so the bot process's in-memory
   * `chatId → ActiveSession` map can include this newly-created session.
   * Maps to `step.sendEvent('open-session', ...)` in the Inngest wiring.
   * PR 2 backport — never throws on send failure; the loop logs and
   * continues so a flaky Inngest dispatch doesn't orphan the session row.
   */
  sendInngestEvent: (payload: {
    name: 'interview.session.opened';
    data: { chatId: string; sessionId: string; candidateId: string };
  }) => Promise<void>;
  /**
   * Claude Opus 4.7 client (structurally typed wider than @anthropic-ai/sdk
   * @0.28's surface to expose `thinking`, `output_config`, and
   * `cache_control` — see `anthropic-shapes.ts` for the cast rationale).
   * Tests inject a `{ messages: { create: vi.fn() } }` mock.
   */
  anthropic: OpusAnthropicLike;
  /** Injectable for tests. Defaults to global `fetch`. */
  fetchFn?: typeof fetch;
  /** PR 3: scheduled reminder runner — wired to step.sleep + step.run. */
  scheduleReminder?: (input: {
    sessionId: string;
    proposedTitle: string;
  }) => Promise<void>;
  /** PR 3: DI hooks for the follow-up / fallback / closing-summary
   *  branches. Production wiring leaves them undefined. */
  runFollowUpLoopFn?: typeof runFollowUpLoop;
  runFallbackLoopFn?: typeof runFallbackLoop;
  generateClosingSummaryFn?: typeof generateClosingSummary;
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

  // 5b. PR 2 backport — dispatch `interview.session.opened` so the bot's
  // in-memory chatId→ActiveSession map can record this fresh session.
  // The dispatch is best-effort: a failed send must not orphan the
  // already-inserted session row (which would otherwise leak into the
  // pipeline without ever being interviewable).
  // TODO(pr3): once mid-session command handlers (/status, /help,
  // /delete_signal) and the 48-hour reminder scheduler land, the
  // dispatch will also need to seed scheduler entries.
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
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'session_opened_dispatch_failed',
        sessionId,
        candidateId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'interview.session.opened dispatch failed; bot may miss in-memory mapping until restart',
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

  // 7. Schedule the 48-hour soft reminder IN PARALLEL with the reply
  // wait (PRD §4.7 / AC-F2-05).
  const reminderPromise: Promise<void> =
    deps.scheduleReminder !== undefined
      ? deps.scheduleReminder({
          sessionId,
          proposedTitle: candidate.proposedTitle,
        }).catch((err: unknown) => {
          deps.logger.warn(
            {
              source: SOURCE,
              action: 'reminder_schedule_threw',
              sessionId,
              reason: err instanceof Error ? err.message : String(err),
            },
            'reminder schedule threw; ignoring',
          );
        })
      : Promise.resolve();

  // 8. Wait for Hassan's reply (or 7-day timeout).
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

  // 9. Hand off to the confirmation loop (PR 2).
  const loopOutcome = await runConfirmationLoop(
    {
      db: deps.db,
      logger: deps.logger,
      now: deps.now,
      env: deps.env,
      anthropic: deps.anthropic,
      fetchFn,
      waitForReply: deps.waitForReply,
    },
    {
      sessionId,
      candidateId,
      candidate: {
        proposedTitle: candidate.proposedTitle,
        pillar: candidate.pillar,
        primaryKeyword: candidate.primaryKeyword,
        evidenceChunkIds: candidate.evidenceChunkIds,
      },
    },
  );

  // 10. Resolve the loop outcome to a terminal RunOutcome.
  if (loopOutcome.kind === 'timed_out') {
    return { kind: 'timed_out', sessionId, candidateId };
  }

  const confirmedCount =
    loopOutcome.kind === 'completed' ? loopOutcome.confirmedCount : 0;
  const excludedCount =
    loopOutcome.kind === 'completed' ? loopOutcome.excludedCount : 0;
  const allConfirmationsSkipped =
    loopOutcome.kind === 'completed'
      ? loopOutcome.allConfirmationsSkipped
      : false;
  const confirmedSignals =
    loopOutcome.kind === 'completed' ? loopOutcome.confirmedSignals : [];

  // 10a. PR 3 branch: fallback / follow-up / neither.
  const runFollowUpLoopFn = deps.runFollowUpLoopFn ?? runFollowUpLoop;
  const runFallbackLoopFn = deps.runFallbackLoopFn ?? runFallbackLoop;
  const clusterContextBlock = buildClusterContextBlock(confirmedSignals);

  let followUpsAnswered = 0;
  let fallbackAnswered = false;

  if (allConfirmationsSkipped) {
    const fallback = await runFallbackLoopFn(
      {
        db: deps.db,
        logger: deps.logger,
        now: deps.now,
        env: deps.env,
        fetchFn,
        waitForReply: deps.waitForReply,
      },
      {
        sessionId,
        candidateId,
        candidate: {
          proposedTitle: candidate.proposedTitle,
          pillar: candidate.pillar,
          primaryKeyword: candidate.primaryKeyword,
          evidenceChunkIds: candidate.evidenceChunkIds,
        },
      },
    );
    if (fallback.kind === 'timed_out') {
      return { kind: 'timed_out', sessionId, candidateId };
    }
    fallbackAnswered = true;
  } else if (
    loopOutcome.kind === 'completed' &&
    confirmedSignals.length > 0
  ) {
    let serpGaps: string[] | null = null;
    try {
      const candidateRows = await deps.db
        .select({ serpGaps: articleCandidates.serpGaps })
        .from(articleCandidates)
        .where(eq(articleCandidates.id, candidateId));
      serpGaps = candidateRows[0]?.serpGaps ?? null;
    } catch (err) {
      deps.logger.warn(
        {
          source: SOURCE,
          action: 'follow_up_serp_gap_lookup_failed',
          sessionId,
          reason: err instanceof Error ? err.message : String(err),
        },
        'serp_gaps read failed; follow-up loop skipped',
      );
    }
    if (serpGaps !== null && serpGaps.length > 0) {
      const followUp = await runFollowUpLoopFn(
        {
          db: deps.db,
          logger: deps.logger,
          now: deps.now,
          env: deps.env,
          anthropic: deps.anthropic,
          fetchFn,
          waitForReply: deps.waitForReply,
        },
        {
          sessionId,
          candidateId,
          candidate: {
            proposedTitle: candidate.proposedTitle,
            pillar: candidate.pillar,
            primaryKeyword: candidate.primaryKeyword,
            serpGaps,
          },
          confirmedSignals,
          clusterContextBlock,
        },
      );
      if (followUp.kind === 'timed_out') {
        return { kind: 'timed_out', sessionId, candidateId };
      }
      followUpsAnswered = followUp.followUpsAnswered;
    }
  }

  // 10b. Terminal DB writes.
  await deps.db
    .update(interviewSessions)
    .set({ status: 'completed', completedAt: deps.now })
    .where(eq(interviewSessions.id, sessionId));
  await deps.db
    .update(articleCandidates)
    .set({ status: 'interview_complete' })
    .where(eq(articleCandidates.id, candidateId));

  // 10c. Closing summary via Claude Haiku 4.5.
  const generateClosingSummaryFn =
    deps.generateClosingSummaryFn ?? generateClosingSummary;
  const { anonymizeCount, skipCount } = await readAnswerCounts(
    deps.db,
    sessionId,
  );
  const draftDayName = nextDraftDay(deps.now);
  const summaryResult = await generateClosingSummaryFn({
    sessionState: {
      confirmedCount,
      anonymizeCount,
      skipCount,
      followUpsAnswered,
      fallbackAnswered,
      proposedTitle: candidate.proposedTitle,
      draftDayName,
    },
    anthropic: deps.anthropic,
    logger: deps.logger,
  });
  const summaryText = summaryResult.ok
    ? summaryResult.summaryText
    : (summaryResult.fallbackText ??
        buildCompletionPlaceholderMessage({ confirmedCount }));

  const ack = await sendTelegramMessage({
    token: deps.env.telegramBotToken,
    chatId: deps.env.telegramChatId,
    message: summaryText,
    fetchFn,
  });
  if (!ack.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'completion_ack_send_failed',
        sessionId,
        candidateId,
        reason: ack.error,
      },
      'telegram completion ack send failed',
    );
  }

  await reminderPromise;

  return {
    kind: 'completed',
    sessionId,
    candidateId,
    confirmedCount,
    excludedCount,
    followUpsAnswered,
    fallbackAnswered,
    closingSummarySource: summaryResult.ok ? 'haiku' : 'fallback',
  };
}

async function readAnswerCounts(
  db: Database,
  sessionId: string,
): Promise<{ anonymizeCount: number; skipCount: number }> {
  try {
    const rows = await db
      .select({ answers: interviewSessions.answers })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, sessionId));
    const answers = rows[0]?.answers ?? [];
    let anonymizeCount = 0;
    let skipCount = 0;
    for (const a of answers) {
      const r = (a as { response?: unknown }).response;
      if (r === 'anon') anonymizeCount += 1;
      else if (r === 'skip') skipCount += 1;
    }
    return { anonymizeCount, skipCount };
  } catch {
    return { anonymizeCount: 0, skipCount: 0 };
  }
}

function buildClusterContextBlock(
  signals: ReadonlyArray<import('./types.js').ConfirmedSignalSummary>,
): string {
  if (signals.length === 0) {
    return '# Cluster context\n\n(no confirmed signals)\n';
  }
  const lines: string[] = [];
  lines.push('# Cluster context — signals confirmed by Hassan');
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

      const data = event.data as { candidateId?: unknown };
      const candidateId = data.candidateId;
      if (typeof candidateId !== 'string' || candidateId.length === 0) {
        throw new Error(
          'interview-session: event payload missing string `candidateId`',
        );
      }

      // Construct the Anthropic client. The single `as unknown as
      // OpusAnthropicLike` cast site permitted by the prompt's "DI test
      // mock boundaries" carve-out — the SDK 0.28's TypeScript surface
      // does not surface `thinking` / `output_config` / `cache_control`,
      // but the wire protocol forwards unknown keys correctly.
      const anthropic = new Anthropic({
        apiKey: env.anthropicApiKey,
      }) as unknown as OpusAnthropicLike;

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
          sendInngestEvent: async (payload) => {
            // step.sendEvent is durable and cannot nest inside
            // step.run — same constraint as `waitForReply` below. The
            // body of `runInterviewSession` is intentionally not
            // wrapped in step.run, so a direct call here is correct.
            await step.sendEvent('open-session', payload);
          },
          // PR 3: scheduled reminder via durable step.sleep + step.run.
          scheduleReminder: async ({ sessionId, proposedTitle }) => {
            await step.sleep('reminder-delay', '48h');
            await step.run('reminder-check-and-send', async () => {
              await runReminderStep(
                {
                  db,
                  logger,
                  fetchFn: fetch,
                  token: env.telegramBotToken,
                  chatId: env.telegramChatId,
                  // Inside step.run we are already past the 48h sleep,
                  // so the inner sleep is a no-op.
                  sleep: async () => undefined,
                },
                { sessionId, proposedTitle },
              );
            });
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
            //
            // The same CEL filter is reused inside `confirmation-loop` via
            // this same `waitForReply` closure — there is only one
            // step.waitForEvent in this Inngest function and Inngest's
            // durable replays correctly distinguish multiple calls by
            // their step name. We use the same name on each call because
            // they are sequential, not concurrent.
            const result = await step.waitForEvent(
              'await-preview-response',
              {
                event: 'telegram.message.received',
                timeout: `${timeoutMs}ms`,
                if: `event.data.chatId == "${env.telegramChatId}" && event.data.sessionId == "${sessionId}"`,
              },
            );
            if (result === null) return null;
            const r = result as {
              data?: {
                text?: unknown;
                chatId?: unknown;
                sessionId?: unknown;
                messageType?: unknown;
                callbackData?: unknown;
                transcript?: unknown;
                audioUrl?: unknown;
                voiceFileId?: unknown;
                transcriptionError?: unknown;
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
            const data: IncomingReplyEvent['data'] = {
              text,
              chatId,
              sessionId: sId,
            };
            // Narrow each optional discriminator before passing through.
            const mt = r.data?.messageType;
            if (mt === 'text' || mt === 'voice' || mt === 'callback') {
              data.messageType = mt;
            }
            const cb = r.data?.callbackData;
            if (cb !== undefined && cb !== null && typeof cb === 'object') {
              const cbo = cb as Record<string, unknown>;
              const qi = cbo['questionIndex'];
              const ch = cbo['choice'];
              if (
                typeof qi === 'number' &&
                (ch === 'yes' || ch === 'anon' || ch === 'skip')
              ) {
                data.callbackData = { questionIndex: qi, choice: ch };
              }
            }
            const tr = r.data?.transcript;
            if (typeof tr === 'string' || tr === null) {
              data.transcript = tr;
            }
            const au = r.data?.audioUrl;
            if (typeof au === 'string') {
              data.audioUrl = au;
            }
            const vf = r.data?.voiceFileId;
            if (typeof vf === 'string') {
              data.voiceFileId = vf;
            }
            const te = r.data?.transcriptionError;
            if (typeof te === 'string') {
              data.transcriptionError = te;
            }
            return { data };
          },
          fetchFn: fetch,
        },
        candidateId,
      );
      return { outcome };
    },
  );
}
