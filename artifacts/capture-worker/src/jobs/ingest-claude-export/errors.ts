/**
 * Error classes for the Claude (claude.ai web) data-export ingester.
 *
 * Each carries a stable, machine-readable `code` so callers can branch on
 * class without `instanceof` across module boundaries — same convention as
 * `ingest-claude-cowork/errors.ts` and `ingest-msgraph-email/errors.ts`.
 */

export class InputDirNotConfiguredError extends Error {
  public readonly code = 'INPUT_DIR_NOT_CONFIGURED' as const;
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'InputDirNotConfiguredError';
  }
}

export class FileReadError extends Error {
  public readonly code = 'FILE_READ' as const;
  public readonly filePath: string;
  constructor(filePath: string, message: string, opts?: { cause?: unknown }) {
    super(
      `Claude export file ${filePath}: ${message}`,
      opts?.cause !== undefined ? { cause: opts.cause } : undefined,
    );
    this.name = 'FileReadError';
    this.filePath = filePath;
  }
}

/**
 * Thrown when the top-level JSON shape of a Claude export doesn't match
 * anything we recognise (neither a top-level array of conversations nor an
 * object carrying a `conversations` array). Per the capture PRD (AC-F1-01 /
 * US-F1-08), the ingester treats this as a format change and alerts Hassan
 * rather than silently ingesting nothing.
 */
export class ClaudeExportFormatError extends Error {
  public readonly code = 'CLAUDE_EXPORT_FORMAT' as const;
  public readonly detail: string;
  constructor(detail: string, opts?: { cause?: unknown }) {
    super(
      `Claude export format error: ${detail}`,
      opts?.cause !== undefined ? { cause: opts.cause } : undefined,
    );
    this.name = 'ClaudeExportFormatError';
    this.detail = detail;
  }
}
