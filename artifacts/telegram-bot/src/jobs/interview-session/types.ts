/**
 * Shared types for the interview-session Inngest function.
 *
 * PR 1 introduced `InterviewSessionEnv`, `RunOutcome` (preview slice),
 * `TelegramSendResult`, `PreviewMessageInput`, `TerminalMessageInput`,
 * and `IncomingReplyEvent`. PR 2 extends:
 *   - `InterviewSessionEnv` gains `anthropicApiKey` (Opus 4.7 calls).
 *   - `RunOutcome` gains the terminal `completed` variant.
 *   - `IncomingReplyEvent.data` gains optional `messageType` /
 *     `callbackData` / `transcript` / `audioUrl` / `voiceFileId` /
 *     `transcriptionError` fields that the grammY handlers populate.
 *   - New: `ActiveSession`, `SessionContext`, `QuestionResponse`,
 *     `QuestionGenerationResult`, `QualityGateFailure`,
 *     `QualityGateResult`, `ConfirmationLoopOutcome`.
 *
 * `TelegramSendResult` is intentionally duplicated from the synthesis-worker
 * sender — this artifact has no shared `lib/telegram` module yet, and the
 * prompt's file allowlist forbids touching synthesis-worker. Per the
 * "do not consolidate" rule, the duplicate is correct.
 */

import type { Pillar } from '@ncp/shared-types';

/** Env vars validated by `readEnv()`. PR 2 adds `anthropicApiKey`. */
export interface InterviewSessionEnv {
  databaseUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  anthropicApiKey: string;
}

/**
 * Discriminated outcome returned by `runInterviewSession`.
 *
 * `preview_acknowledged` is retained for backwards type-compat but is no
 * longer reachable in production — the PR 2 confirmation loop runs
 * straight through from preview-ack to `completed` (or `timed_out` /
 * `skipped` / `no_candidate`).
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
    }
  | {
      kind: 'completed';
      sessionId: string;
      candidateId: string;
      confirmedCount: number;
      excludedCount: number;
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
 * Shape of the Telegram message event that the PR 2 grammY long-poller
 * dispatches. PR 1 only consumed `{ text, chatId, sessionId }`; PR 2
 * extends with discriminating fields populated by each handler:
 *
 *   - `messageType: 'text'`    — `text` is the user's typed message
 *   - `messageType: 'voice'`   — `text` is the Whisper transcript (or '' on failure);
 *                                `audioUrl`, `voiceFileId`, `transcript`,
 *                                `transcriptionError` are also populated
 *   - `messageType: 'callback'` — `text` is the canonical choice spelling
 *                                 (`'yes' | 'anon' | 'skip'`) so legacy
 *                                 text-only consumers still match;
 *                                 `callbackData` carries the structured form
 *
 * All new fields are optional to preserve PR 1 wire compatibility.
 */
export interface IncomingReplyEvent {
  data: {
    text: string;
    chatId: string;
    sessionId: string;
    messageType?: 'text' | 'voice' | 'callback';
    callbackData?: {
      questionIndex: number;
      choice: 'yes' | 'anon' | 'skip';
    };
    transcript?: string | null;
    audioUrl?: string;
    voiceFileId?: string;
    transcriptionError?: string;
  };
}

/**
 * One entry in the bot's in-memory `chatId → ActiveSession` map (see
 * `bot/session-map.ts`).
 */
export interface ActiveSession {
  sessionId: string;
  candidateId: string;
  openedAt: Date;
}

/**
 * Per-invocation context for `runConfirmationLoop`. Carries the resolved
 * session + candidate snapshot so the loop never re-reads the candidate
 * mid-execution (mutation safety against concurrent Inngest replays).
 */
export interface SessionContext {
  sessionId: string;
  candidateId: string;
  candidate: {
    proposedTitle: string;
    pillar: Pillar;
    primaryKeyword: string;
    evidenceChunkIds: string[] | null;
  };
}

/**
 * Structured JSON object returned by Claude Opus 4.7 for each
 * confirmation-question call. Schema-constrained by the grammar at the
 * API; post-validated by `parseQuestionResponse` for defence in depth.
 */
export interface QuestionResponse {
  question_text: string;
  signal_id: string;
  evidence_phrase: string;
  detected_specifics: string[];
  no_specifics: boolean;
}

/** Discriminated outcome of one `generateQuestion` call. Never throws. */
export type QuestionGenerationResult =
  | { ok: true; question: QuestionResponse }
  | {
      ok: false;
      reason: 'no_specifics' | 'api_error';
      detail?: string;
    };

/** Reasons the §7.2 quality gate may reject a generated question. */
export type QualityGateFailure =
  | 'word_count'
  | 'no_specifics'
  | 'hallucinated_specific'
  | 'generic_phrase';

/** Discriminated outcome of one `qualityGate` call. */
export type QualityGateResult =
  | { ok: true }
  | { ok: false; failures: QualityGateFailure[] };

/** Discriminated outcome of `runConfirmationLoop`. */
export type ConfirmationLoopOutcome =
  | {
      kind: 'completed';
      confirmedCount: number;
      excludedCount: number;
    }
  | { kind: 'timed_out' }
  | { kind: 'no_signals' };
