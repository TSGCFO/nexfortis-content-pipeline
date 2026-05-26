/**
 * grammY command registrations (PRD §4.8).
 *
 *   /skip             → dispatches `interview.session.command.skip`
 *                       Inngest event (handled by the sibling
 *                       `handle-skip-command` function).
 *   /status           → read-only snapshot via DB queries; sends the
 *                       formatted message inline.
 *   /help             → sends the static help message.
 *   /delete_signal id → validates the UUID, soft-deletes the signal
 *                       via `softDeleteSignal`, sends ack/error.
 *
 * grammY's command-parser fires BEFORE the generic `message:text`
 * handler (composer order is set in `grammy-instance.ts`), AND the text
 * handler's `startsWith('/')` early-return ensures commands aren't
 * double-dispatched as text answers to the active confirmation
 * question.
 *
 * Every command handler is wrapped in try/catch — a flaky DB or
 * Telegram send must not crash the grammY long-poll loop.
 */

import { and, desc, eq, gte } from 'drizzle-orm';

import {
  articleCandidates,
  captureSignals,
  interviewSessions,
  synthesisClusters,
  type Database,
} from '@ncp/db';
import type { Logger } from '@ncp/logger';

import { sendTelegramMessage } from '../../jobs/interview-session/send-telegram-message.js';
import type { StatusSnapshot } from '../../jobs/interview-session/types.js';
import type { SessionMap } from '../session-map.js';
import { softDeleteSignal } from './delete-signal.js';
import { buildStatusMessage } from './status-builder.js';

const SOURCE = 'telegram_bot' as const;

// ─────────────────────────────────────────────────────────────────────────
// Public DI surface
// ─────────────────────────────────────────────────────────────────────────

export interface SkipCommandSendInngestFn {
  (payload: {
    name: 'interview.session.command.skip';
    data: { chatId: string };
  }): Promise<void>;
}

export interface RegisterCommandsDeps {
  db: Database;
  logger: Logger;
  sessionMap: SessionMap;
  sendInngestEvent: SkipCommandSendInngestFn;
  token: string;
  chatId: string;
  fetchFn?: typeof fetch;
  /** Injectable clock for `/status`'s "last 7 days" window. */
  now?: () => Date;
}

/**
 * Structural slice of grammY's `Context` — just the fields the command
 * handlers read.
 */
export interface CommandCtxLike {
  chat?: { id: number | string } | undefined;
  message?: { text?: string | undefined } | undefined;
  /** grammY supplies `ctx.match` for command args — the substring after
   *  `/cmd `. */
  match?: string | undefined;
}

/**
 * Tiny composer interface — `Bot` from grammY conforms to this, and
 * tests inject a `{ command: vi.fn() }` mock.
 */
export interface BotCommandRegistry {
  command: (
    name: string,
    handler: (ctx: CommandCtxLike) => Promise<void>,
  ) => unknown;
}

// ─────────────────────────────────────────────────────────────────────────
// Static help text
// ─────────────────────────────────────────────────────────────────────────

const HELP_MESSAGE = [
  '🤖 <b>NexFortis content pipeline bot</b>',
  '',
  'Commands:',
  '/skip — skip this week&#39;s interview',
  '/status — pipeline snapshot (last 7 days)',
  '/help — show this message',
  '/delete_signal &lt;id&gt; — soft-delete a captured signal',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────
// Status snapshot fetcher (read-only)
// ─────────────────────────────────────────────────────────────────────────

interface FetchStatusSnapshotDeps {
  db: Database;
  sessionMap: SessionMap;
  chatId: string;
  now: Date;
}

export async function fetchStatusSnapshot(
  deps: FetchStatusSnapshotDeps,
): Promise<StatusSnapshot> {
  const sevenDaysAgo = new Date(
    deps.now.getTime() - 7 * 24 * 60 * 60 * 1000,
  );

  const signalsRows = await deps.db
    .select({ id: captureSignals.id })
    .from(captureSignals)
    .where(
      and(
        gte(captureSignals.capturedAt, sevenDaysAgo),
        eq(captureSignals.isDeleted, false),
      ),
    );
  const signalsLast7Days = signalsRows.length;

  const clusterRows = await deps.db
    .select({ createdAt: synthesisClusters.createdAt })
    .from(synthesisClusters)
    .orderBy(desc(synthesisClusters.createdAt))
    .limit(1);
  const lastSynthesisAt = clusterRows[0]?.createdAt ?? null;

  const active = deps.sessionMap.getActiveSessionForChat(deps.chatId);
  let activeCandidate: StatusSnapshot['activeCandidate'] = null;
  let activeSessionStatus: StatusSnapshot['activeSessionStatus'] = null;
  let questionsSentThisSession = 0;

  if (active !== undefined) {
    const candidateRows = await deps.db
      .select({
        proposedTitle: articleCandidates.proposedTitle,
        status: articleCandidates.status,
      })
      .from(articleCandidates)
      .where(eq(articleCandidates.id, active.candidateId));
    const candidate = candidateRows[0];
    if (candidate !== undefined) {
      activeCandidate = {
        proposedTitle: candidate.proposedTitle,
        status: candidate.status,
      };
    }
    const sessionRows = await deps.db
      .select({
        status: interviewSessions.status,
        questions: interviewSessions.questions,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, active.sessionId));
    const session = sessionRows[0];
    if (session !== undefined) {
      activeSessionStatus = session.status;
      questionsSentThisSession = Array.isArray(session.questions)
        ? session.questions.length
        : 0;
    }
  }

  return {
    signalsLast7Days,
    lastSynthesisAt,
    activeCandidate,
    activeSessionStatus,
    questionsSentThisSession,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Per-command handler factories
// ─────────────────────────────────────────────────────────────────────────

interface SendReplyOptions {
  fetchFn: typeof fetch;
  token: string;
  chatId: string;
  message: string;
}

async function sendReply(opts: SendReplyOptions): Promise<void> {
  await sendTelegramMessage({
    token: opts.token,
    chatId: opts.chatId,
    message: opts.message,
    fetchFn: opts.fetchFn,
  });
}

function makeSkipHandler(deps: RegisterCommandsDeps) {
  return async (ctx: CommandCtxLike): Promise<void> => {
    try {
      const chatRaw = ctx.chat?.id;
      if (chatRaw === undefined) return;
      const chatId = String(chatRaw);
      await deps.sendInngestEvent({
        name: 'interview.session.command.skip',
        data: { chatId },
      });
    } catch (err) {
      deps.logger.error(
        {
          source: SOURCE,
          action: 'skip_command_dispatch_failed',
          reason: err instanceof Error ? err.message : String(err),
        },
        'skip command dispatch failed; not propagating',
      );
    }
  };
}

function makeStatusHandler(deps: RegisterCommandsDeps) {
  const fetchFn = deps.fetchFn ?? fetch;
  const nowFn = deps.now ?? (() => new Date());
  return async (ctx: CommandCtxLike): Promise<void> => {
    try {
      const chatRaw = ctx.chat?.id;
      if (chatRaw === undefined) return;
      const chatId = String(chatRaw);
      const snapshot = await fetchStatusSnapshot({
        db: deps.db,
        sessionMap: deps.sessionMap,
        chatId,
        now: nowFn(),
      });
      await sendReply({
        fetchFn,
        token: deps.token,
        chatId: deps.chatId,
        message: buildStatusMessage(snapshot),
      });
    } catch (err) {
      deps.logger.error(
        {
          source: SOURCE,
          action: 'status_command_failed',
          reason: err instanceof Error ? err.message : String(err),
        },
        'status command failed; not propagating',
      );
    }
  };
}

function makeHelpHandler(deps: RegisterCommandsDeps) {
  const fetchFn = deps.fetchFn ?? fetch;
  return async (_ctx: CommandCtxLike): Promise<void> => {
    try {
      await sendReply({
        fetchFn,
        token: deps.token,
        chatId: deps.chatId,
        message: HELP_MESSAGE,
      });
    } catch (err) {
      deps.logger.error(
        {
          source: SOURCE,
          action: 'help_command_failed',
          reason: err instanceof Error ? err.message : String(err),
        },
        'help command failed; not propagating',
      );
    }
  };
}

function makeDeleteSignalHandler(deps: RegisterCommandsDeps) {
  const fetchFn = deps.fetchFn ?? fetch;
  return async (ctx: CommandCtxLike): Promise<void> => {
    try {
      const chatRaw = ctx.chat?.id;
      if (chatRaw === undefined) return;
      const chatId = String(chatRaw);
      const arg = typeof ctx.match === 'string' ? ctx.match.trim() : '';
      const result = await softDeleteSignal(
        {
          db: deps.db,
          logger: deps.logger,
          deletedByChatId: chatId,
        },
        arg,
      );
      await sendReply({
        fetchFn,
        token: deps.token,
        chatId: deps.chatId,
        message: result.message,
      });
    } catch (err) {
      deps.logger.error(
        {
          source: SOURCE,
          action: 'delete_signal_command_failed',
          reason: err instanceof Error ? err.message : String(err),
        },
        'delete_signal command failed; not propagating',
      );
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────

export function registerCommands(
  bot: BotCommandRegistry,
  deps: RegisterCommandsDeps,
): void {
  bot.command('skip', makeSkipHandler(deps));
  bot.command('status', makeStatusHandler(deps));
  bot.command('help', makeHelpHandler(deps));
  bot.command('delete_signal', makeDeleteSignalHandler(deps));
}

// Re-exports for testing.
export {
  makeSkipHandler as _makeSkipHandlerForTests,
  makeStatusHandler as _makeStatusHandlerForTests,
  makeHelpHandler as _makeHelpHandlerForTests,
  makeDeleteSignalHandler as _makeDeleteSignalHandlerForTests,
  HELP_MESSAGE as _HELP_MESSAGE_FOR_TESTS,
};
