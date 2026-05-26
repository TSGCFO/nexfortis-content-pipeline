/**
 * Pure(ish) helper for the `/delete_signal <id>` command (PRD §4.8).
 *
 * Soft-deletes a capture_signals row by flipping `is_deleted = true`.
 * Validates the input is a UUID and the row exists before issuing the
 * UPDATE. Returns a discriminated outcome that the grammY command
 * handler then renders into a Telegram reply.
 *
 * Never throws — DB errors are caught and surfaced as a discriminated
 * `{ ok: false, reason: 'db_error' }`. Same policy as the rest of this
 * artifact: a flaky DB must not crash the grammY long-poll loop.
 *
 * The DB action is an UPDATE, never a DELETE — soft-delete preserves
 * the row for audit and downstream pipelines that already exclude
 * `is_deleted = true` rows. The signal becomes invisible to future
 * synthesis runs immediately.
 *
 * Security: the handler does NOT check the requester's chat_id — that
 * check is enforced globally by grammY's per-update middleware on bot
 * setup. The `TELEGRAM_CHAT_ID` env var hardcodes Hassan's chat; any
 * future multi-chat support needs a separate authorization layer.
 */

import { and, eq } from 'drizzle-orm';

import { captureSignals, type Database } from '@ncp/db';
import type { Logger } from '@ncp/logger';

import { escapeHtml } from '../../jobs/interview-session/escape-html.js';

const SOURCE = 'telegram_bot' as const;

/**
 * Loose UUID matcher. Accepts UUIDs of any version (1-7) because the
 * `gen_random_uuid()` Postgres function returns v4 but external tooling
 * occasionally uses v7 for `created_at`-sortable IDs. We accept both
 * and rely on the DB lookup as the final ground truth.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DeleteSignalDeps {
  db: Database;
  logger: Logger;
  /** Identifier of the requester (Hassan's chat id), captured for audit. */
  deletedByChatId: string;
}

export type DeleteSignalResult =
  | { ok: true; message: string; signalId: string }
  | {
      ok: false;
      reason:
        | 'invalid_uuid'
        | 'not_found'
        | 'already_deleted'
        | 'db_error';
      message: string;
      detail?: string;
    };

interface SignalRow {
  id: string;
  isDeleted: boolean;
}

/**
 * Soft-deletes the capture_signals row with the given id. Wrapped in
 * try/catch — never throws to the caller.
 */
export async function softDeleteSignal(
  deps: DeleteSignalDeps,
  rawSignalId: string,
): Promise<DeleteSignalResult> {
  const trimmed = rawSignalId.trim();
  if (!UUID_REGEX.test(trimmed)) {
    return {
      ok: false,
      reason: 'invalid_uuid',
      message:
        "That doesn&#39;t look like a valid signal id. Use /status to see recent ids.",
    };
  }

  // Look up the row to disambiguate not_found vs already_deleted, and
  // to log the action with the *true* DB-stored id.
  let row: SignalRow | undefined;
  try {
    const rows = await deps.db
      .select({
        id: captureSignals.id,
        isDeleted: captureSignals.isDeleted,
      })
      .from(captureSignals)
      .where(eq(captureSignals.id, trimmed));
    row = rows[0];
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    deps.logger.error(
      {
        source: SOURCE,
        action: 'delete_signal_lookup_failed',
        signalId: trimmed,
        deletedByChatId: deps.deletedByChatId,
        reason: detail,
      },
      'capture_signals lookup failed in /delete_signal handler',
    );
    return {
      ok: false,
      reason: 'db_error',
      message: 'Something went wrong looking up that signal. Try again in a minute.',
      detail,
    };
  }

  if (row === undefined) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Signal not found. Maybe it was already deleted?',
    };
  }
  if (row.isDeleted) {
    return {
      ok: false,
      reason: 'already_deleted',
      message: 'That signal was already deleted.',
    };
  }

  // Perform the soft-delete. The `is_deleted = false` guard prevents a
  // concurrent delete from being silently double-applied (Drizzle's
  // UPDATE doesn't return affected-row count by default, but the guard
  // keeps the action idempotent at the SQL layer).
  try {
    await deps.db
      .update(captureSignals)
      .set({ isDeleted: true })
      .where(
        and(
          eq(captureSignals.id, trimmed),
          eq(captureSignals.isDeleted, false),
        ),
      );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    deps.logger.error(
      {
        source: SOURCE,
        action: 'delete_signal_update_failed',
        signalId: trimmed,
        deletedByChatId: deps.deletedByChatId,
        reason: detail,
      },
      'capture_signals UPDATE failed in /delete_signal handler',
    );
    return {
      ok: false,
      reason: 'db_error',
      message: 'Something went wrong deleting that signal. Try again in a minute.',
      detail,
    };
  }

  // Audit log per PRD §4.8 — structured fields so a downstream log
  // pipeline can index by signal_id / deleted_by_chat_id.
  deps.logger.info(
    {
      source: SOURCE,
      action: 'signal_deleted',
      signalId: trimmed,
      deletedByChatId: deps.deletedByChatId,
    },
    'capture_signals row soft-deleted via /delete_signal',
  );

  return {
    ok: true,
    signalId: trimmed,
    message: `Signal <code>${escapeHtml(trimmed)}</code> deleted. It will be excluded from future syntheses.`,
  };
}
