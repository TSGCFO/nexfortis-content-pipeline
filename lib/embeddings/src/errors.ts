/**
 * Error classes thrown by `@ncp/embeddings`.
 *
 * Every error from this module is one of these three classes — never a bare
 * `Error`. Discriminate via `instanceof` or via the `code` property.
 */

export class EmbeddingApiError extends Error {
  public readonly code = 'EMBEDDING_API' as const;
  public readonly status: number | undefined;
  public override readonly cause: unknown;

  constructor(message: string, opts?: { cause?: unknown; status?: number }) {
    super(message);
    this.name = 'EmbeddingApiError';
    this.cause = opts?.cause;
    this.status = opts?.status;
    Object.setPrototypeOf(this, EmbeddingApiError.prototype);
  }
}

export class EmbeddingConfigError extends Error {
  public readonly code = 'EMBEDDING_CONFIG' as const;
  public override readonly cause: unknown;

  constructor(message: string, opts?: { cause?: unknown }) {
    super(message);
    this.name = 'EmbeddingConfigError';
    this.cause = opts?.cause;
    Object.setPrototypeOf(this, EmbeddingConfigError.prototype);
  }
}

export class EmbeddingRetryExhaustedError extends Error {
  public readonly code = 'EMBEDDING_RETRY_EXHAUSTED' as const;
  public readonly attempts: number;
  public override readonly cause: unknown;

  constructor(message: string, opts?: { cause?: unknown; attempts?: number }) {
    super(message);
    this.name = 'EmbeddingRetryExhaustedError';
    this.cause = opts?.cause;
    this.attempts = opts?.attempts ?? 0;
    Object.setPrototypeOf(this, EmbeddingRetryExhaustedError.prototype);
  }
}
