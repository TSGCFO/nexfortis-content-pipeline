/**
 * Shared types for the interview-session Inngest function.
 *
 * `TelegramSendResult` is intentionally duplicated from the synthesis-worker
 * sender — this artifact has no shared `lib/telegram` module yet, and the
 * prompt's file allowlist forbids touching synthesis-worker. Per the
 * "do not consolidate" rule, the duplicate is correct.
 */

import type { InterviewAnswer, InterviewQuestion } from '@ncp/db';
import type { Pillar } from '@ncp/shared-types';

/**
 * Env vars validated by `readEnv()`. PR 2 extends PR 1's three vars with
 * `OPENAI_API_KEY` (Whisper) and `ANTHROPIC_API_KEY` (Claude Opus 4.7).
 */
export interface InterviewSessionEnv {
  databaseUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  openaiApiKey: string;
  anthropicApiKey: string;
}

/**
 * Discriminated outcome returned by `runInterviewSession`.
 *
 * `preview_acknowledged` exists for PR 1 fallback shape; PR 2 normally
 * proceeds straight from a non-/skip reply into the confirmation loop and
 * returns `completed` or `timed_out` instead.
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
 * Shape of the Telegram message event that PR 2 dispatches via the
 * grammY long-poller. The bot includes `messageType` and optional
 * `voiceFileId` so the Inngest handler can branch on text vs. voice vs.
 * button callbacks.
 *
 * Voice-note events carry the Whisper transcript and Telegram CDN audio
 * URL inline so the Inngest handler does not need to re-download.
 */
export type IncomingReplyMessageType = 'text' | 'voice' | 'callback';

export interface IncomingReplyEvent {
  data: {
    text: string;
    chatId: string;
    sessionId: string;
    messageType?: IncomingReplyMessageType;
    voiceFileId?: string;
    audioUrl?: string;
    transcript?: string | null;
    transcriptionError?: string;
    callbackData?: string;
  };
}

/**
 * A capture_signals row reduced to the fields the interview loop needs.
 * Selecting a narrow projection keeps the test mocks readable.
 */
export interface SignalForInterview {
  id: string;
  source: string;
  capturedAt: Date;
  redactedText: string;
  tokenCount: number | null;
  isDeleted: boolean;
}

/** The candidate row fields the loop needs after PR 1 already loaded them. */
export interface CandidateForInterview {
  id: string;
  pillar: Pillar;
  proposedTitle: string;
  primaryKeyword: string;
  evidenceChunkIds: string[] | null;
}

/** Result of one Claude question-generation call. Never throws. */
export type QuestionGenerationResult =
  | { ok: true; question: GeneratedQuestion }
  | { ok: false; reason: 'no_specifics' }
  | { ok: false; reason: 'api_error'; detail?: string };

/** Parsed (and quality-gateable) Claude response. */
export interface GeneratedQuestion {
  questionText: string;
  signalId: string;
  evidencePhrase: string;
  detectedSpecifics: readonly string[];
}

/** Quality gate result. Failures are accumulated, not short-circuited. */
export type QualityGateFailure =
  | 'word_count'
  | 'no_specifics'
  | 'hallucinated_specific'
  | 'generic_phrase';

export type QualityGateResult =
  | { ok: true }
  | { ok: false; failures: readonly QualityGateFailure[] };

/** Discriminated outcome returned by `runConfirmationLoop`. */
export type ConfirmationLoopOutcome =
  | {
      kind: 'completed';
      sessionId: string;
      candidateId: string;
      confirmedCount: number;
      excludedCount: number;
    }
  | { kind: 'timed_out'; sessionId: string; candidateId: string };

/**
 * Per-invocation context the loop needs alongside its DI deps. Mirrors the
 * "candidate is per-invocation; deps is ambient" split in PR 1's
 * `runInterviewSession`.
 */
export interface SessionContext {
  sessionId: string;
  candidate: CandidateForInterview;
}

/**
 * In-memory representation of an open interview session, used by the
 * bot/session-map to attach `sessionId` to outbound Inngest events.
 */
export interface ActiveSession {
  sessionId: string;
  candidateId: string;
  openedAt: Date;
}

/**
 * Reason a signal was excluded from a confirmation session. Persisted in
 * `interview_sessions.signal_exclusions` JSONB.
 */
export type SignalExclusionReason =
  | 'no_specifics'
  | 'quality_gate'
  | 'api_error';

/** Shape of one entry inside `interview_sessions.signal_exclusions`. */
export interface SignalExclusionEntry {
  signal_id: string;
  reason: SignalExclusionReason;
}

/**
 * Re-export the DB-side JSONB row shapes so loop / test code can import
 * them from a single module without reaching into `@ncp/db` directly.
 */
export type { InterviewAnswer, InterviewQuestion };
