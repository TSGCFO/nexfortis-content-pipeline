/**
 * Error classes for the interview-session Inngest function.
 *
 * Pattern mirrors `artifacts/synthesis-worker/src/jobs/synthesize-weekly/errors.ts`:
 * each class carries a stable, machine-readable `code` so callers can branch
 * on class without relying on `instanceof` across module boundaries.
 */

export class EnvNotConfiguredError extends Error {
  public readonly code = 'ENV_NOT_CONFIGURED' as const;
  public readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(
      `interview-session: required env var(s) missing or empty: ${missing.join(', ')}`,
    );
    this.name = 'EnvNotConfiguredError';
    this.missing = missing;
  }
}

/**
 * Thrown by external callers (future PRs) that prefer hard-fail semantics
 * when a referenced `article_candidates` row is missing.
 *
 * `runInterviewSession` itself does NOT throw this — per the spec, a missing
 * or terminal-status candidate returns `{ kind: 'no_candidate' }` and logs a
 * warning. The class is exported because the error surface is part of this
 * module's public contract.
 */
export class CandidateNotFoundError extends Error {
  public readonly code = 'CANDIDATE_NOT_FOUND' as const;
  public readonly candidateId: string;
  constructor(candidateId: string) {
    super(
      `interview-session: article_candidate not found for id ${candidateId}`,
    );
    this.name = 'CandidateNotFoundError';
    this.candidateId = candidateId;
  }
}

/**
 * Thrown by external callers (future PRs) that prefer hard-fail semantics
 * when Claude Opus 4.7 cannot produce a valid confirmation question for a
 * given signal.
 *
 * `runConfirmationLoop` itself does NOT throw this — per the spec, a
 * failed generation returns `{ ok: false, reason }` and the loop records
 * a `signal_exclusion`. The class is exported because the error surface
 * is part of this module's public contract.
 */
export class QuestionGenerationError extends Error {
  public readonly code = 'QUESTION_GENERATION_FAILED' as const;
  public readonly signalId: string;
  public readonly reason: 'no_specifics' | 'api_error';
  constructor(signalId: string, reason: 'no_specifics' | 'api_error') {
    super(
      `interview-session: question generation failed for signal ${signalId}: ${reason}`,
    );
    this.name = 'QuestionGenerationError';
    this.signalId = signalId;
    this.reason = reason;
  }
}

/**
 * Thrown by external callers when both quality-gate attempts (initial +
 * regenerate-once) fail for a given signal. The orchestrator itself does
 * NOT throw — it records a `signal_exclusion` with `reason:
 * 'quality_gate'` and continues. Exported for downstream `instanceof`.
 */
export class QualityGateExhaustedError extends Error {
  public readonly code = 'QUALITY_GATE_EXHAUSTED' as const;
  public readonly signalId: string;
  public readonly failures: readonly string[];
  constructor(signalId: string, failures: readonly string[]) {
    super(
      `interview-session: quality gate exhausted for signal ${signalId} (${failures.join(', ')})`,
    );
    this.name = 'QualityGateExhaustedError';
    this.signalId = signalId;
    this.failures = failures;
  }
}

/**
 * Thrown by external callers when Whisper transcription fails. The voice
 * handler itself does NOT throw — it dispatches a `telegram.message.received`
 * event with `{ transcript: null, transcriptionError: <reason> }` so the
 * confirmation loop can decide whether to send the fallback text-only
 * prompt. Exported for downstream `instanceof`.
 */
export class WhisperTranscriptionError extends Error {
  public readonly code = 'WHISPER_TRANSCRIPTION_FAILED' as const;
  public readonly reason: string;
  constructor(reason: string) {
    super(`interview-session: whisper transcription failed: ${reason}`);
    this.name = 'WhisperTranscriptionError';
    this.reason = reason;
  }
}
