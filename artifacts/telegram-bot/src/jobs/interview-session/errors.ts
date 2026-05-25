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
 * Surface error for callers that prefer hard-fail semantics when Claude
 * question generation fails after retries. `runConfirmationLoop` itself
 * does NOT throw this — a failed generation excludes the signal and
 * continues. The class is exported because the error surface is part of
 * this module's public contract.
 */
export class QuestionGenerationError extends Error {
  public readonly code = 'QUESTION_GENERATION_FAILED' as const;
  public readonly detail: string | undefined;
  constructor(detail?: string) {
    super(
      `interview-session: Claude question generation failed${detail ? ` (${detail})` : ''}`,
    );
    this.name = 'QuestionGenerationError';
    this.detail = detail;
  }
}

/**
 * Surface error for callers that need to react when every selected signal
 * is excluded by the quality gate. `runConfirmationLoop` itself does NOT
 * throw this — it returns `{ kind: 'completed', confirmedCount: 0 }`.
 */
export class QualityGateExhaustedError extends Error {
  public readonly code = 'QUALITY_GATE_EXHAUSTED' as const;
  public readonly excludedCount: number;
  constructor(excludedCount: number) {
    super(
      `interview-session: ${excludedCount} signals excluded by quality gate; none remain`,
    );
    this.name = 'QualityGateExhaustedError';
    this.excludedCount = excludedCount;
  }
}

/**
 * Surface error for Whisper transcription failures. `transcribeWithWhisper`
 * itself returns a `Result` and never throws — this class is for external
 * callers that wrap the result with `if (!ok) throw new ...`.
 */
export class WhisperTranscriptionError extends Error {
  public readonly code = 'WHISPER_TRANSCRIPTION_FAILED' as const;
  public readonly detail: string | undefined;
  constructor(detail?: string) {
    super(
      `interview-session: Whisper transcription failed${detail ? ` (${detail})` : ''}`,
    );
    this.name = 'WhisperTranscriptionError';
    this.detail = detail;
  }
}
