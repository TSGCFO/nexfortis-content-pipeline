/**
 * Error classes for the Cowork session ingester.
 *
 * Each class carries a stable, machine-readable `code` so callers can branch
 * on classes without relying on `instanceof` across module boundaries (same
 * convention as `ingest-msgraph-email/errors.ts`).
 */

export class InputDirNotConfiguredError extends Error {
  public readonly code = 'INPUT_DIR_NOT_CONFIGURED' as const;
  constructor(message: string, opts?: { cause?: unknown }) {
    super(
      message,
      opts?.cause !== undefined ? { cause: opts.cause } : undefined,
    );
    this.name = 'InputDirNotConfiguredError';
  }
}

export class SchemaVersionMismatchError extends Error {
  public readonly code = 'SCHEMA_VERSION_MISMATCH' as const;
  public readonly filePath: string;
  public readonly actualVersion: unknown;
  public readonly expectedVersion: number;

  constructor(
    filePath: string,
    opts: { actualVersion: unknown; expectedVersion: number; cause?: unknown },
  ) {
    super(
      `Cowork import file ${filePath} has schemaVersion ${String(
        opts.actualVersion,
      )}, but this ingester only accepts schemaVersion ${String(
        opts.expectedVersion,
      )}.`,
      opts.cause !== undefined ? { cause: opts.cause } : undefined,
    );
    this.name = 'SchemaVersionMismatchError';
    this.filePath = filePath;
    this.actualVersion = opts.actualVersion;
    this.expectedVersion = opts.expectedVersion;
  }
}

export interface SchemaValidationIssue {
  path: string;
  message: string;
}

export class SchemaValidationError extends Error {
  public readonly code = 'SCHEMA_VALIDATION' as const;
  public readonly filePath: string;
  public readonly issues: readonly SchemaValidationIssue[];

  constructor(
    filePath: string,
    issues: readonly SchemaValidationIssue[],
    opts?: { cause?: unknown },
  ) {
    const first = issues[0];
    const head =
      first !== undefined
        ? ` (first issue: ${first.path || '<root>'}: ${first.message})`
        : '';
    super(
      `Cowork import file ${filePath} failed schema validation with ${issues.length} issue(s)${head}.`,
      opts?.cause !== undefined ? { cause: opts.cause } : undefined,
    );
    this.name = 'SchemaValidationError';
    this.filePath = filePath;
    this.issues = issues;
  }
}

export class FileReadError extends Error {
  public readonly code = 'FILE_READ' as const;
  public readonly filePath: string;
  constructor(filePath: string, message: string, opts?: { cause?: unknown }) {
    super(
      `Cowork import file ${filePath}: ${message}`,
      opts?.cause !== undefined ? { cause: opts.cause } : undefined,
    );
    this.name = 'FileReadError';
    this.filePath = filePath;
  }
}
