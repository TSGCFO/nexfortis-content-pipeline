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
