/**
 * Error classes for the synthesize-weekly cron.
 *
 * Each class carries a stable, machine-readable `code` so callers can branch
 * on class without relying on `instanceof` across module boundaries. Pattern
 * matches `artifacts/capture-worker/src/jobs/ingest-msgraph-email/errors.ts`.
 */

export class EnvNotConfiguredError extends Error {
  public readonly code = 'ENV_NOT_CONFIGURED' as const;
  public readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(
      `synthesize-weekly: required env var(s) missing or empty: ${missing.join(
        ', ',
      )}`,
    );
    this.name = 'EnvNotConfiguredError';
    this.missing = missing;
  }
}

export class EmbeddingDimensionMismatchError extends Error {
  public readonly code = 'EMBEDDING_DIM_MISMATCH' as const;
  public readonly expected: number;
  public readonly actual: number;
  constructor(expected: number, actual: number) {
    super(
      `synthesize-weekly: embedding dimension mismatch (expected ${expected}, got ${actual})`,
    );
    this.name = 'EmbeddingDimensionMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

export class CorpusTooLargeForNaiveClusteringError extends Error {
  public readonly code = 'CORPUS_TOO_LARGE' as const;
  public readonly signalCount: number;
  constructor(signalCount: number) {
    super(
      `synthesize-weekly: corpus too large for naive O(n^2) clustering (${signalCount} signals; hard limit 5000). Operator should bump the cosine threshold or migrate to HDBSCAN.`,
    );
    this.name = 'CorpusTooLargeForNaiveClusteringError';
    this.signalCount = signalCount;
  }
}
