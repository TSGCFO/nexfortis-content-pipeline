/**
 * 48-hour soft-reminder step (PRD §4.7 / AC-F2-05).
 *
 * If 48h after the preview-sent timestamp the session is still in
 * `preview_sent` or `confirming` state AND `reminder_sent` is still
 * false, send Hassan exactly one reminder and flip the flag.
 *
 * Idempotency contract:
 *   - Re-running the same step over and over MUST never produce a
 *     second reminder.
 *   - The flag flip is the source of truth — even if the Telegram send
 *     succeeded but the flag write failed on the previous attempt, we
 *     accept the small risk of a second reminder rather than the much
 *     larger UX hit of NEVER sending one. (The current implementation
 *     only flips on send success, so the worst-case under flap is one
 *     extra reminder per session, which is still bounded.)
 *
 * Where it lives:
 *   - Inside the main `interview-session` Inngest function. The factory
 *     invokes it in parallel with the reply loop via `Promise.all`.
 *     The 48h `step.sleep` is durable so the reminder fires even
 *     across worker restarts; the post-sleep DB check ensures the
 *     reminder is a no-op when the session has already finished
 *     (completed / skipped / timed_out).
 *
 * Never throws. All external failures are folded into structured logs.
 */

import { eq } from 'drizzle-orm';

import {
  interviewSessions,
  type Database,
} from '@ncp/db';
import type { Logger } from '@ncp/logger';

import { escapeHtml } from './escape-html.js';
import { sendTelegramMessage } from './send-telegram-message.js';

const SOURCE = 'telegram_bot' as const;

/** 48 hours in milliseconds — exported so tests can pin the exact sleep. */
export const REMINDER_DELAY_MS = 48 * 60 * 60 * 1000;

/** Session statuses where the reminder is still warranted. Anything
 *  else (completed / skipped / timed_out) → no-op. */
const PENDING_STATUSES: ReadonlySet<string> = new Set([
  'preview_sent',
  'confirming',
]);

export interface ReminderStepDeps {
  db: Database;
  logger: Logger;
  fetchFn: typeof fetch;
  token: string;
  chatId: string;
  /** Durable sleep — production wiring passes Inngest's
   *  `step.sleep('reminder-delay', '48h')` adapted to ms. Tests pass a
   *  `vi.fn()` that resolves immediately. */
  sleep: (durationMs: number) => Promise<void>;
}

/**
 * Pure formatter for the reminder message body. Exposed so tests can
 * assert the exact wire shape without needing to read it back from the
 * fetch spy.
 */
export function buildReminderMessage(proposedTitle: string): string {
  const title = escapeHtml(proposedTitle);
  return `No rush — your article on <i>${title}</i> is waiting whenever you have 5 min.`;
}

interface SessionRow {
  status: string;
  reminderSent: boolean | null;
}

export interface RunReminderStepInput {
  sessionId: string;
  proposedTitle: string;
}

/**
 * Sleeps for 48h, then re-reads the session and conditionally sends the
 * reminder. Never throws.
 */
export async function runReminderStep(
  deps: ReminderStepDeps,
  input: RunReminderStepInput,
): Promise<void> {
  await deps.sleep(REMINDER_DELAY_MS);

  // Re-fetch session state.
  let session: SessionRow | undefined;
  try {
    const rows = await deps.db
      .select({
        status: interviewSessions.status,
        reminderSent: interviewSessions.reminderSent,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, input.sessionId));
    session = rows[0];
  } catch (err) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'reminder_session_lookup_failed',
        sessionId: input.sessionId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'reminder session lookup failed; skipping reminder',
    );
    return;
  }

  if (session === undefined) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'reminder_session_not_found',
        sessionId: input.sessionId,
      },
      'reminder target session not found in DB; skipping',
    );
    return;
  }

  if (!PENDING_STATUSES.has(session.status)) {
    deps.logger.info(
      {
        source: SOURCE,
        action: 'reminder_skipped_terminal_status',
        sessionId: input.sessionId,
        status: session.status,
      },
      'session no longer pending; reminder is a no-op',
    );
    return;
  }

  if (session.reminderSent === true) {
    deps.logger.info(
      {
        source: SOURCE,
        action: 'reminder_skipped_already_sent',
        sessionId: input.sessionId,
      },
      'reminder already sent for this session; no-op',
    );
    return;
  }

  // Send the reminder.
  const send = await sendTelegramMessage({
    token: deps.token,
    chatId: deps.chatId,
    message: buildReminderMessage(input.proposedTitle),
    fetchFn: deps.fetchFn,
  });
  if (!send.ok) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'reminder_send_failed',
        sessionId: input.sessionId,
        reason: send.error,
      },
      'reminder Telegram send failed; flag remains false for potential retry',
    );
    return;
  }

  // Flip the flag — only on send success. If this write fails we accept
  // the small risk of a duplicate reminder on a subsequent reminder run
  // (which, in the current architecture, never happens — `step.sleep`
  // fires once per Inngest invocation).
  try {
    await deps.db
      .update(interviewSessions)
      .set({ reminderSent: true })
      .where(eq(interviewSessions.id, input.sessionId));
  } catch (err) {
    deps.logger.warn(
      {
        source: SOURCE,
        action: 'reminder_flag_persist_failed',
        sessionId: input.sessionId,
        reason: err instanceof Error ? err.message : String(err),
      },
      'reminder flag write failed; reminder was sent but flag may stay false',
    );
  }

  deps.logger.info(
    {
      source: SOURCE,
      action: 'reminder_sent',
      sessionId: input.sessionId,
    },
    'session reminder sent at 48h mark',
  );
}
