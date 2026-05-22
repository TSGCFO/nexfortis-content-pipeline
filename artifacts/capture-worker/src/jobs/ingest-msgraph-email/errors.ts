/**
 * Error classes for the MS Graph email ingester.
 *
 * Each class carries a stable, machine-readable `code` so callers can branch
 * on classes without relying on `instanceof` across module boundaries.
 */

export class AccessTokenError extends Error {
  public readonly code = 'ACCESS_TOKEN' as const;
  public readonly status: number | undefined;
  constructor(message: string, opts?: { cause?: unknown; status?: number }) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'AccessTokenError';
    this.status = opts?.status;
  }
}

export class MsGraphAuthError extends Error {
  public readonly code = 'MSGRAPH_AUTH' as const;
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'MsGraphAuthError';
  }
}

export class MsGraphRateLimitError extends Error {
  public readonly code = 'MSGRAPH_RATE_LIMIT' as const;
  public readonly retries: number;
  constructor(message: string, opts: { retries: number; cause?: unknown }) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'MsGraphRateLimitError';
    this.retries = opts.retries;
  }
}

export class MsGraphApiError extends Error {
  public readonly code = 'MSGRAPH_API' as const;
  public readonly status: number;
  constructor(message: string, opts: { status: number; cause?: unknown }) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'MsGraphApiError';
    this.status = opts.status;
  }
}
