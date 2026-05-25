/**
 * Shared types for the interview-session Inngest function (Telegram bot PR 1).
 *
 * `TelegramSendResult` is intentionally duplicated from the synthesis-worker
 * sender — this artifact has no shared `lib/telegram` module yet, and the
 * prompt's file allowlist forbids touching synthesis-worker. Per the
 * "do not consolidate" rule, the duplicate is correct.
 */

import type { Pillar } from '@ncp/shared-types';

/** Env vars validated by `readEnv()` for this slice (PR 1). */
export interface InterviewSessionEnv {
  databaseUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
}

/**
 * Discriminated outcome returned by `runInterviewSession`. PR 2 will extend
 * the `'preview_acknowledged'` branch with confirmation-question logic.
 */
export type RunOutcome =
  | { kind: 'no_candidate'; candidateId: string }
  | { kind: 'timed_out'; sessionId: string; candidateId: string }
  | { kind: 'skipped'; sessionId: string; candidateId: string }
  | {
      kind: 'preview_acknowledged';
      sessionId: string;
      candidateId: string;
      replyText: string;
    };

/** Result of an attempted Telegram `sendMessage` call. Never throws. */
export interface TelegramSendResult {
  ok: boolean;
  error: string | undefined;
}

/** Input to `buildPreviewMessage`. Sourced from the `article_candidates` row. */
export interface PreviewMessageInput {
  proposedTitle: string;
  pillar: Pillar;
  primaryKeyword: string;
  signalCount: number;
}

/** Input to the skip-ack / timeout formatters. */
export interface TerminalMessageInput {
  proposedTitle: string;
}

/**
 * Shape of the Telegram message event that PR 2 will dispatch via the
 * grammY long-poller. PR 1 only consumes this shape from
 * `step.waitForEvent`; PR 1 never produces it.
 */
export interface IncomingReplyEvent {
  data: { text: string; chatId: string; sessionId: string };
}
