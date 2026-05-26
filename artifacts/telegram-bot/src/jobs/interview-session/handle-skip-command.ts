/**
 * Sibling Inngest function for the mid-session `/skip` command
 * (PRD §4.8).
 *
 * Triggered by `interview.session.command.skip` events emitted by the
 * grammY `/skip` command handler. Looks up the active session for the
 * given chat id and idempotently flips it to `skipped` + archives the
 * candidate to `skipped`. Sends Hassan a skip-ack message reusing the
 * PR 1 `buildSkipAckMessage` formatter.
 *
 * The DB update uses a status guard (`WHERE status IN
 * ('preview_sent','confirming','follow_up','pending')`) so the write
 * is idempotent — if the main `runInterviewSession` durable run
 * already advanced the session past those states (e.g. completed mid-
 * race), this no-ops cleanly.
 *
 * Why a sibling function (rather than modifying the confirmation loop)?
 * - The PR 3 backport budget is reserved for `ConfirmationLoopOutcome`.
 * - The main interview-session function holds a long-running
 *   `waitForReply` durable step; cancelling cross-step requires either
 *   Inngest `cancelOn` (with a chatId filter that we don't have at
 *   function-start) or a sibling write to the DB plus status guards on
 *   any later writes from the main function. We use the sibling-write
 *   pattern: this function handles the user-visible work; the main
 *   function's eventual 7d timeout will still try to write `timed_out`
 *   but the `WHERE status = 'preview_sent' OR status = 'confirming'`
 *   guards added in `index.ts` prevent it from clobbering `skipped`.
 *
 * Never throws — Inngest will retry transient errors automatically;
 * idempotency is enforced by the status guard.
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Inngest, InngestFunction } from 'inngest';

import {
  articleCandidates,
  createDbClient,
  interviewSessions,
} from '@ncp/db';
import { createLogger } from '@ncp/logger';

import { buildSkipAckMessage } from './build-skip-ack-message.js';
import { EnvNotConfiguredError } from './errors.js';
import { readEnv } from './index.js';
import { sendTelegramMessage } from './send-telegram-message.js';

const SOURCE = 'telegram_bot' as const;

/** Non-terminal session statuses where a /skip is still meaningful. */
const PENDING_STATUSES = [
  'pending',
  'preview_sent',
  'confirming',
  'follow_up',
] as const;

interface SkipCommandEvent {
  data: {
    chatId?: unknown;
  };
}

interface ActiveSessionLookup {
  id: string;
  candidateId: string;
  proposedTitle: string;
}

/**
 * Inngest factory. Mirrors the pattern in
 * `createInterviewSessionJob` — factory rather than top-level
 * `inngest.createFunction(...)` so `src/index.ts` can construct it.
 */
export function createHandleSkipCommandJob(
  inngest: Inngest.Any,
): InngestFunction.Any {
  return inngest.createFunction(
    {
      id: 'handle-skip-command',
      name: 'Handle Mid-Session /skip Command',
    },
    { event: 'interview.session.command.skip' },
    async ({ event, step }) => {
      const logger = createLogger({ source: SOURCE });

      let env;
      try {
        env = readEnv();
      } catch (err) {
        if (err instanceof EnvNotConfiguredError) {
          logger.error(
            {
              source: SOURCE,
              action: 'skip_handler_env_missing',
              missing: err.missing,
            },
            'env not configured; skip-command handler cannot run',
          );
          throw err;
        }
        throw err;
      }
      const db = createDbClient({ connectionString: env.databaseUrl });

      const data = (event as SkipCommandEvent).data;
      const chatIdRaw = data.chatId;
      if (typeof chatIdRaw !== 'string' || chatIdRaw.length === 0) {
        logger.warn(
          {
            source: SOURCE,
            action: 'skip_handler_missing_chat_id',
          },
          'interview.session.command.skip arrived without a string chatId; ignoring',
        );
        return { outcome: 'no_chat_id' as const };
      }
      const chatId = chatIdRaw;

      const active = await step.run('lookup-active-session', async () => {
        const rows = await db
          .select({
            id: interviewSessions.id,
            candidateId: interviewSessions.candidateId,
            status: interviewSessions.status,
          })
          .from(interviewSessions)
          .where(
            and(
              eq(interviewSessions.telegramChatId, chatId),
              inArray(interviewSessions.status, [...PENDING_STATUSES]),
            ),
          )
          .orderBy(desc(interviewSessions.startedAt))
          .limit(1);
        const row = rows[0];
        if (row === undefined) return null;

        const candidateRows = await db
          .select({
            proposedTitle: articleCandidates.proposedTitle,
          })
          .from(articleCandidates)
          .where(eq(articleCandidates.id, row.candidateId));
        const candidate = candidateRows[0];
        if (candidate === undefined) return null;

        return {
          id: row.id,
          candidateId: row.candidateId,
          proposedTitle: candidate.proposedTitle,
        } satisfies ActiveSessionLookup;
      });

      if (active === null) {
        logger.info(
          {
            source: SOURCE,
            action: 'skip_handler_no_active_session',
            chatId,
          },
          'no active session for chat; /skip is a no-op',
        );
        return { outcome: 'no_active_session' as const };
      }

      await step.run('update-session-and-candidate', async () => {
        // Idempotent transitions — status guards prevent clobbering
        // already-terminal rows under races with the main run.
        await db
          .update(interviewSessions)
          .set({ status: 'skipped' })
          .where(
            and(
              eq(interviewSessions.id, active.id),
              inArray(interviewSessions.status, [...PENDING_STATUSES]),
            ),
          );
        await db
          .update(articleCandidates)
          .set({ status: 'skipped' })
          .where(eq(articleCandidates.id, active.candidateId));
      });

      const ack = await step.run('send-skip-ack', async () => {
        return sendTelegramMessage({
          token: env.telegramBotToken,
          chatId: env.telegramChatId,
          message: buildSkipAckMessage({ proposedTitle: active.proposedTitle }),
        });
      });
      if (!ack.ok) {
        logger.warn(
          {
            source: SOURCE,
            action: 'skip_handler_ack_send_failed',
            sessionId: active.id,
            candidateId: active.candidateId,
            reason: ack.error,
          },
          'skip-ack send failed; DB transition already applied',
        );
      }

      logger.info(
        {
          source: SOURCE,
          action: 'skip_handler_completed',
          sessionId: active.id,
          candidateId: active.candidateId,
          chatId,
        },
        'mid-session /skip applied',
      );

      return { outcome: 'skipped' as const, sessionId: active.id };
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DI inner core — exported for unit tests so we can drive the logic
// without needing to construct an Inngest function.
// ─────────────────────────────────────────────────────────────────────────

import type { Database } from '@ncp/db';
import type { Logger } from '@ncp/logger';

export interface HandleSkipCommandDeps {
  db: Database;
  logger: Logger;
  fetchFn: typeof fetch;
  token: string;
  chatId: string;
}

export type HandleSkipCommandOutcome =
  | { outcome: 'no_active_session' }
  | { outcome: 'skipped'; sessionId: string }
  | { outcome: 'ack_failed'; sessionId: string };

/**
 * Inner DI core — same behaviour as the Inngest factory but takes the
 * `db`/`logger`/`fetchFn` directly. Production wiring still uses the
 * factory; this is the unit-test entry point.
 */
export async function handleSkipCommand(
  deps: HandleSkipCommandDeps,
): Promise<HandleSkipCommandOutcome> {
  let active: ActiveSessionLookup | null = null;
  try {
    const rows = await deps.db
      .select({
        id: interviewSessions.id,
        candidateId: interviewSessions.candidateId,
        status: interviewSessions.status,
      })
      .from(interviewSessions)
      .where(
        and(
          eq(interviewSessions.telegramChatId, deps.chatId),
          inArray(interviewSessions.status, [...PENDING_STATUSES]),
        ),
      )
      .orderBy(desc(interviewSessions.startedAt))
      .limit(1);
    const row = rows[0];
    if (row !== undefined) {
      const candidateRows = await deps.db
        .select({ proposedTitle: articleCandidates.proposedTitle })
        .from(articleCandidates)
        .where(eq(articleCandidates.id, row.candidateId));
      const candidate = candidateRows[0];
      if (candidate !== undefined) {
        active = {
          id: row.id,
          candidateId: row.candidateId,
          proposedTitle: candidate.proposedTitle,
        };
      }
    }
  } catch (err) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'skip_handler_lookup_failed',
        chatId: deps.chatId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'skip handler lookup failed',
    );
    return { outcome: 'no_active_session' };
  }

  if (active === null) {
    deps.logger.info(
      {
        source: SOURCE,
        action: 'skip_handler_no_active_session',
        chatId: deps.chatId,
      },
      'no active session for chat; /skip is a no-op',
    );
    return { outcome: 'no_active_session' };
  }

  try {
    await deps.db
      .update(interviewSessions)
      .set({ status: 'skipped' })
      .where(
        and(
          eq(interviewSessions.id, active.id),
          inArray(interviewSessions.status, [...PENDING_STATUSES]),
        ),
      );
    await deps.db
      .update(articleCandidates)
      .set({ status: 'skipped' })
      .where(eq(articleCandidates.id, active.candidateId));
  } catch (err) {
    deps.logger.error(
      {
        source: SOURCE,
        action: 'skip_handler_update_failed',
        sessionId: active.id,
        reason: err instanceof Error ? err.message : String(err),
      },
      'skip handler DB update failed',
    );
    return { outcome: 'no_active_session' };
  }

  const ack = await sendTelegramMessage({
    token: deps.token,
    chatId: deps.chatId,
    message: buildSkipAckMessage({ proposedTitle: active.proposedTitle }),
    fetchFn: deps.fetchFn,
  });
  if (!ack.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'skip_handler_ack_send_failed',
        sessionId: active.id,
        reason: ack.error,
      },
      'skip-ack send failed; DB transition already applied',
    );
    return { outcome: 'ack_failed', sessionId: active.id };
  }

  deps.logger.info(
    {
      source: SOURCE,
      action: 'skip_handler_completed',
      sessionId: active.id,
      candidateId: active.candidateId,
      chatId: deps.chatId,
    },
    'mid-session /skip applied',
  );

  return { outcome: 'skipped', sessionId: active.id };
}
