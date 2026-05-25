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
import { EnvNotConfiguredError } from './errors.js';
import { nextMondayAt8amEastern } from './next-monday-eastern.js';
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
 * Read and validate the env vars this slice (PR 1) actually uses. Future
 * PRs will extend this with `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
 * `INNGEST_*`, `SUPABASE_*` as those integrations land.
 */
export function readEnv(): InterviewSessionEnv {
  const databaseUrl = process.env['DATABASE_URL'];
  const telegramBotToken = process.env['TELEGRAM_BOT_TOKEN'];
  const telegramChatId = process.env['TELEGRAM_CHAT_ID'];

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
  if (missing.length > 0) {
    throw new EnvNotConfiguredError(missing);
  }
  return {
    databaseUrl: databaseUrl as string,
    telegramBotToken: telegramBotToken as string,
    telegramChatId: telegramChatId as string,
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
  /** Injectable for tests. Defaults to global `fetch`. */
  fetchFn?: typeof fetch;
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

  // TODO(pr2): hand off to confirmation question loop. Until PR 2 lands,
  // any non-/skip, non-null reply transitions out of PR 1 with the raw
  // reply text recorded in the outcome.
  return {
    kind: 'preview_acknowledged',
    sessionId,
    candidateId,
    replyText: reply.data.text,
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

      const data = event.data as { candidateId?: unknown };
      const candidateId = data.candidateId;
      if (typeof candidateId !== 'string' || candidateId.length === 0) {
        throw new Error(
          'interview-session: event payload missing string `candidateId`',
        );
      }

      const outcome = await runInterviewSession(
        {
          db,
          logger,
          env,
          now: new Date(),
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
                if: `event.data.chatId == "${env.telegramChatId}" && event.data.sessionId == "${sessionId}"`,
              },
            );
            if (result === null) return null;
            const r = result as {
              data?: { text?: unknown; chatId?: unknown; sessionId?: unknown };
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
            return { data: { text, chatId, sessionId: sId } };
          },
          fetchFn: fetch,
        },
        candidateId,
      );
      return { outcome };
    },
  );
}
