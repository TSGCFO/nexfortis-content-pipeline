/**
 * Error classes for the draft-generator job.
 *
 * Each carries a stable, machine-readable `code`. Pattern matches
 * `artifacts/synthesis-worker/src/jobs/synthesize-weekly/errors.ts`.
 */

export class EnvNotConfiguredError extends Error {
  public readonly code = 'ENV_NOT_CONFIGURED' as const;
  public readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(
      `draft-generator: required env var(s) missing or empty: ${missing.join(
        ', ',
      )}`,
    );
    this.name = 'EnvNotConfiguredError';
    this.missing = missing;
  }
}

export class InvalidDraftRequestedEventError extends Error {
  public readonly code = 'INVALID_DRAFT_REQUESTED_EVENT' as const;
  constructor(message: string) {
    super(`draft-generator: ${message}`);
    this.name = 'InvalidDraftRequestedEventError';
  }
}
