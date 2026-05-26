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
      /** PR 3: count of follow-up questions Hassan actually answered
       *  (0 when no SERP gaps were uncovered OR the fallback branch ran). */
      followUpsAnswered: number;
      /** PR 3: true when the all-skipped fallback branch ran AND Hassan
       *  responded to its single open-ended question. */
      fallbackAnswered: boolean;
      /** PR 3: which path produced the closing-summary text. `'haiku'`
       *  when Claude Haiku 4.5 returned a valid summary; `'fallback'`
       *  when the hardcoded placeholder text was used. */
      closingSummarySource: 'haiku' | 'fallback';
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

/** Discriminated outcome of `runConfirmationLoop`.
 *
 * PR 3 backport: the `completed` variant exposes two extra fields the
 * outer wrapper needs to decide which post-confirmation branch (fallback
 * vs. follow-up vs. straight-to-summary) to take.
 *
 *  - `allConfirmationsSkipped` — true when ≥1 confirmation question
 *    was actually asked AND every single one received a `skip` answer
 *    (PRD §7.2 / AC-F2-07). Empty-loop returns false.
 *  - `confirmedSignals` — the signals whose response was `yes` or
 *    `anon`. PR 3's follow-up loop reads `redactedText` from each to
 *    compute SERP-gap coverage via `serp-gap-coverage.ts`.
 */
export type ConfirmationLoopOutcome =
  | {
      kind: 'completed';
      confirmedCount: number;
      excludedCount: number;
      allConfirmationsSkipped: boolean;
      confirmedSignals: ConfirmedSignalSummary[];
    }
  | { kind: 'timed_out' }
  | { kind: 'no_signals' };

/** Minimal projection of a confirmed signal carried into the follow-up
 *  loop — only the fields used for SERP-gap coverage. Keeps the surface
 *  decoupled from `SelectedSignal` (which lives in `lib/`). */
export interface ConfirmedSignalSummary {
  id: string;
  redactedText: string;
  source: string;
  capturedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────
// PR 3 — follow-up + fallback + closing summary + reminder + commands
// ─────────────────────────────────────────────────────────────────────────

/** `interview_sessions.answers[n].question_type` discriminator, set by
 *  the follow-up and fallback loops. Stored as an extra JSONB field —
 *  the lib/db `InterviewAnswer` interface omits it for now (a future
 *  schema PR can promote it). */
export type AnswerQuestionType = 'confirmation' | 'follow_up' | 'fallback';

/** Structured JSON object returned by Claude Opus 4.7 for each
 *  follow-up call. Schema-constrained at the API; post-validated by
 *  `parseFollowUpResponse` in `anthropic-shapes.ts`. */
export interface FollowUpQuestion {
  follow_up_text: string;
  evidence_phrase: string;
}

/** Discriminated outcome of one `generateFollowUp` call. */
export type FollowUpGenerationResult =
  | { ok: true; question: FollowUpQuestion }
  | {
      ok: false;
      reason: 'no_gaps' | 'api_error';
      detail?: string;
    };

/** Discriminated outcome of the follow-up loop. */
export type FollowUpLoopOutcome =
  | { kind: 'completed'; followUpsAnswered: number }
  | { kind: 'timed_out' };

/** Discriminated outcome of the all-skipped fallback loop. */
export type FallbackLoopOutcome =
  | { kind: 'completed' }
  | { kind: 'timed_out' };

/** Structured JSON object returned by Claude Haiku 4.5 for the closing
 *  summary. Schema-constrained at the API; post-validated by
 *  `parseClosingSummaryResponse`. */
export interface ClosingSummary {
  summary_text: string;
}

/** Discriminated outcome of `generateClosingSummary`. `fallbackText`
 *  is always populated so the orchestrator can always send SOMETHING. */
export type ClosingSummaryResult =
  | { ok: true; summaryText: string }
  | {
      ok: false;
      reason: 'api_error' | 'schema_mismatch' | 'refusal' | 'truncated';
      detail?: string;
      fallbackText: string;
    };

/** Read-only snapshot consumed by `/status` command's pure formatter. */
export interface StatusSnapshot {
  signalsLast7Days: number;
  lastSynthesisAt: Date | null;
  activeCandidate:
    | {
        proposedTitle: string;
        status: string;
      }
    | null;
  activeSessionStatus: string | null;
  questionsSentThisSession: number;
}
