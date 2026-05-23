/**
 * Inngest cron function: ingest Cowork session JSON files dropped by the
 * `@ncp/cowork-export` laptop CLI.
 *
 * Per-run pipeline:
 *   1. Read the `ingest_checkpoints` row for `source = 'claude_cowork'`
 *      (or default to `now() - 7 days` on first run).
 *   2. Discover `*.json` files in `COWORK_IMPORT_DIR` with `mtime >=`
 *      checkpoint.
 *   3. For each file: read → validate against the locked v1 schema in
 *      `@ncp/cowork-export` → flatten events → redact → chunk → embed →
 *      insert into `capture_signals` with `.onConflictDoNothing()`.
 *   4. Update the checkpoint to the largest mtime processed.
 *
 * File-level failures (read, parse, schema-version mismatch, schema
 * validation, processSession exceptions) are caught at the per-file level
 * and logged with structured context. The run continues so a single bad
 * file does not block the rest. Run-level failures (env var missing, DB
 * unreachable, discovery failure) bubble out so Inngest retries.
 *
 * Checkpoint helpers live inline here (not in a sibling `checkpoint.ts`)
 * because the active prompt's file allowlist does not include a
 * `checkpoint.ts` file — staying strictly inside the allowlist.
 */

import path from 'node:path';
import type { Inngest, InngestFunction } from 'inngest';

import {
  createDbClient,
  ingestCheckpoints,
  type Database,
} from '@ncp/db';
import { chunk as chunkText, embed as embedTexts } from '@ncp/embeddings';
import { createLogger } from '@ncp/logger';
import { redact } from '@ncp/redaction';

import { discoverFiles } from './discover-files.js';
import {
  FileReadError,
  InputDirNotConfiguredError,
  SchemaValidationError,
  SchemaVersionMismatchError,
} from './errors.js';
import { processSession } from './process.js';
import { readAndValidate } from './read-and-validate.js';
import type {
  DiscoveredFile,
  RunSummary,
  SerializableDiscoveredFile,
} from './types.js';

const SOURCE = 'claude_cowork' as const;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface CoworkEnv {
  importDir: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  openaiOrgId?: string;
}

function readEnv(): CoworkEnv {
  const importDir = process.env['COWORK_IMPORT_DIR'];
  const openaiApiKey = process.env['OPENAI_API_KEY'];
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
  const openaiOrgId = process.env['OPENAI_ORG_ID'];

  if (typeof importDir !== 'string' || importDir.length === 0) {
    throw new InputDirNotConfiguredError(
      'Cowork ingester: required env var COWORK_IMPORT_DIR is missing or empty.',
    );
  }
  if (typeof openaiApiKey !== 'string' || openaiApiKey.length === 0) {
    throw new InputDirNotConfiguredError(
      'Cowork ingester: required env var OPENAI_API_KEY is missing or empty.',
    );
  }
  if (typeof anthropicApiKey !== 'string' || anthropicApiKey.length === 0) {
    throw new InputDirNotConfiguredError(
      'Cowork ingester: required env var ANTHROPIC_API_KEY is missing or empty.',
    );
  }

  return {
    importDir,
    openaiApiKey,
    anthropicApiKey,
    ...(typeof openaiOrgId === 'string' && openaiOrgId.length > 0
      ? { openaiOrgId }
      : {}),
  };
}

type DbForCheckpoint = Pick<Database, 'select' | 'insert'>;

/**
 * Read the most recent successfully processed file mtime for this source.
 * Defaults to `now() - 7 days` when no row exists (first-run safety net,
 * matching the msgraph ingester's pattern). Fetches all rows and filters
 * in JS for the same reason `ingest-msgraph-email/checkpoint.ts` does —
 * `@ncp/db` does not re-export drizzle-orm's `eq`/`sql` and adding
 * `drizzle-orm` as a direct dep is outside this prompt's allowlist.
 */
export async function getLastIngestedAtCowork(
  db: DbForCheckpoint,
  now: () => number = Date.now,
): Promise<Date> {
  const rows = await db
    .select({
      source: ingestCheckpoints.source,
      lastIngestedAt: ingestCheckpoints.lastIngestedAt,
    })
    .from(ingestCheckpoints);
  for (const row of rows) {
    if (row.source === SOURCE && row.lastIngestedAt instanceof Date) {
      return row.lastIngestedAt;
    }
  }
  return new Date(now() - SEVEN_DAYS_MS);
}

export async function setLastIngestedAtCowork(
  db: DbForCheckpoint,
  ts: Date,
): Promise<void> {
  await db
    .insert(ingestCheckpoints)
    .values({
      source: SOURCE,
      lastIngestedAt: ts,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: ingestCheckpoints.source,
      set: {
        lastIngestedAt: ts,
        updatedAt: new Date(),
      },
    });
}

/**
 * Sanitize a file basename for use inside an Inngest step id. Inngest step
 * ids accept arbitrary strings but must be unique per run; we use the file
 * basename (which is unique per discovery result).
 */
function stepIdForFile(filePath: string): string {
  return `process-${path.basename(filePath)}`;
}

/**
 * Factory: produces the Inngest cron function bound to the given client.
 *
 * Exported as a factory so `src/index.ts` (which owns the `Inngest`
 * instance) constructs the function, avoiding a circular import.
 *
 * Cron: 05:00 UTC daily — one hour after the msgraph ingester at 04:00 UTC
 * so concurrent DB writes don't overlap. The exporter runs manually on
 * Hassan's laptop; this daily cron picks up newly-dropped files without
 * requiring a push event from the laptop.
 */
export function createIngestClaudeCoworkCron(
  inngest: Inngest.Any,
): InngestFunction.Any {
  return inngest.createFunction(
    {
      id: 'ingest-claude-cowork',
      name: 'Ingest Cowork session JSON files',
    },
    { cron: '0 5 * * *' },
    async ({ step }) => {
      const logger = createLogger({ source: 'capture-worker' });
      const env = readEnv();
      const db = createDbClient();

      const sinceISO = await step.run('get-checkpoint', async () => {
        const ts = await getLastIngestedAtCowork(db);
        return ts.toISOString();
      });
      const since = new Date(sinceISO);

      // Inngest JSON-serializes step return values, so the callback returns
      // `SerializableDiscoveredFile[]` (mtime as ISO string) and we re-hydrate
      // to `DiscoveredFile[]` (mtime as Date) on this side.
      const discovered: SerializableDiscoveredFile[] = await step.run(
        'discover-files',
        async (): Promise<SerializableDiscoveredFile[]> => {
          const found = await discoverFiles(env.importDir, since);
          return found.map((f) => ({
            path: f.path,
            mtime: f.mtime.toISOString(),
          }));
        },
      );
      const files: DiscoveredFile[] = discovered.map((f) => ({
        path: f.path,
        mtime: new Date(f.mtime),
      }));

      const summary: RunSummary = {
        source: SOURCE,
        filesDiscovered: files.length,
        filesProcessed: 0,
        filesFailedValidation: 0,
        filesFailedSchemaVersion: 0,
        filesFailedRead: 0,
        sessionsSkippedEmptyEvents: 0,
        sessionsSkippedNoEmbeddable: 0,
        sessionsBlocked: 0,
        signalsInserted: 0,
        signalsSkippedDuplicate: 0,
        errors: 0,
      };

      if (files.length === 0) {
        logger.info(
          { ...summary, action: 'ingest_claude_cowork_completed' },
          'cowork ingest completed: no new files',
        );
        return summary;
      }

      let maxMtimeMs = 0;

      try {
        for (const file of files) {
          const result = await step.run(stepIdForFile(file.path), () =>
            processOneFile(file, db, env, logger),
          );

          summary.filesProcessed += 1;
          switch (result.kind) {
            case 'session':
              switch (result.result.status) {
                case 'stored':
                  summary.signalsInserted += result.result.signalsInserted;
                  summary.signalsSkippedDuplicate +=
                    result.result.signalsSkippedDuplicate;
                  break;
                case 'skipped_empty_events':
                  summary.sessionsSkippedEmptyEvents += 1;
                  break;
                case 'skipped_no_embeddable':
                  summary.sessionsSkippedNoEmbeddable += 1;
                  break;
                case 'blocked':
                  summary.sessionsBlocked += 1;
                  break;
                case 'failed':
                  summary.errors += 1;
                  break;
              }
              break;
            case 'schema_version_mismatch':
              summary.filesFailedSchemaVersion += 1;
              break;
            case 'schema_validation':
              summary.filesFailedValidation += 1;
              break;
            case 'file_read':
              summary.filesFailedRead += 1;
              break;
            case 'unexpected':
              summary.errors += 1;
              break;
          }

          if (file.mtime.getTime() > maxMtimeMs) {
            maxMtimeMs = file.mtime.getTime();
          }
        }

        if (maxMtimeMs > 0) {
          const checkpointTs = new Date(maxMtimeMs);
          await step.run('update-checkpoint', () =>
            setLastIngestedAtCowork(db, checkpointTs),
          );
        }

        logger.info(
          { ...summary, action: 'ingest_claude_cowork_completed' },
          'cowork ingest completed',
        );
        return summary;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          {
            source: 'capture-worker',
            action: 'ingest_claude_cowork_aborted',
            reason: message,
            filesDiscovered: summary.filesDiscovered,
            filesProcessed: summary.filesProcessed,
            signalsInserted: summary.signalsInserted,
            signalsSkippedDuplicate: summary.signalsSkippedDuplicate,
            errors: summary.errors,
          },
          'cowork ingest aborted',
        );
        throw err;
      }
    },
  );
}

/**
 * Discriminated outcome for one file. Used by the orchestrator to update the
 * `RunSummary` without losing typing.
 *
 * EXHAUSTIVENESS CONTRACT — when adding a new error class to `./errors.ts`:
 *   1. Add a new variant here on `FileOutcome` (and to
 *      `ClassifiedFileOutcome` below if it's a known-error class).
 *   2. Add a matching branch inside `classifyFileError` (compile error if
 *      `ClassifiedFileOutcome` grows but the helper doesn't return the new
 *      `kind`).
 *   3. Add a matching `case` to the switch on `result.kind` inside
 *      `createIngestClaudeCoworkCron`'s per-file loop so the new outcome
 *      gets its own `RunSummary` counter.
 *
 * Skipping any of (2) or (3) silently routes the new error to the
 * `unexpected` catch-all and the run summary's `errors` counter absorbs it
 * without distinct accounting.
 */
type FileOutcome =
  | { kind: 'session'; result: Awaited<ReturnType<typeof processSession>> }
  | ClassifiedFileOutcome
  | { kind: 'unexpected'; reason: string };

/**
 * Subset of `FileOutcome` produced by `classifyFileError` — the known-error
 * classes that have their own dedicated `RunSummary` counter. Excludes
 * `session` (success path) and `unexpected` (catch-all).
 */
type ClassifiedFileOutcome =
  | { kind: 'schema_version_mismatch'; actualVersion: unknown }
  | { kind: 'schema_validation'; issueCount: number }
  | { kind: 'file_read'; reason: string };

/**
 * Map a thrown value to a `ClassifiedFileOutcome` if it is one of the known
 * error classes from `./errors.ts`, else `null`. Logs a structured
 * `file_failed` line for every classified error. Never throws.
 *
 * The narrow return type of `ClassifiedFileOutcome | null` (rather than
 * `FileOutcome | null`) is the compile-time guard: if a new known-error
 * variant is added to `ClassifiedFileOutcome`, this helper must grow a new
 * branch to keep the return type satisfiable.
 */
function classifyFileError(
  err: unknown,
  base: string,
  logger: ReturnType<typeof createLogger>,
): ClassifiedFileOutcome | null {
  if (err instanceof SchemaVersionMismatchError) {
    logger.error(
      {
        source: 'capture-worker',
        action: 'file_failed',
        code: err.code,
        file: base,
        actualVersion: String(err.actualVersion),
        expectedVersion: err.expectedVersion,
      },
      'cowork file refused: schemaVersion mismatch',
    );
    return {
      kind: 'schema_version_mismatch',
      actualVersion: err.actualVersion,
    };
  }
  if (err instanceof SchemaValidationError) {
    logger.error(
      {
        source: 'capture-worker',
        action: 'file_failed',
        code: err.code,
        file: base,
        issues: err.issues.map((i) => `${i.path}: ${i.message}`),
      },
      'cowork file refused: schema validation failed',
    );
    return { kind: 'schema_validation', issueCount: err.issues.length };
  }
  if (err instanceof FileReadError) {
    logger.error(
      {
        source: 'capture-worker',
        action: 'file_failed',
        code: err.code,
        file: base,
      },
      `cowork file refused: ${err.message}`,
    );
    return { kind: 'file_read', reason: err.message };
  }
  return null;
}

async function processOneFile(
  file: DiscoveredFile,
  db: Database,
  env: CoworkEnv,
  logger: ReturnType<typeof createLogger>,
): Promise<FileOutcome> {
  const base = path.basename(file.path);
  try {
    const doc = await readAndValidate(file.path);
    const result = await processSession(doc, {
      db,
      redactFn: redact,
      chunkFn: chunkText,
      embedFn: embedTexts,
      logger,
      anthropicApiKey: env.anthropicApiKey,
      openaiApiKey: env.openaiApiKey,
      ...(env.openaiOrgId !== undefined ? { openaiOrgId: env.openaiOrgId } : {}),
    });
    return { kind: 'session', result };
  } catch (err) {
    const classified = classifyFileError(err, base, logger);
    if (classified !== null) return classified;

    // Catch-all for truly unexpected errors. Logged here so it doesn't get
    // lost — and see the EXHAUSTIVENESS CONTRACT on `FileOutcome` above
    // before adding a new error class.
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      {
        source: 'capture-worker',
        action: 'file_failed',
        code: 'UNEXPECTED',
        file: base,
      },
      `cowork file failed unexpectedly: ${message}`,
    );
    return { kind: 'unexpected', reason: message };
  }
}

/** @internal — exposed for tests so they can drive the per-file flow. */
export const __internal = {
  processOneFile,
  readEnv,
  stepIdForFile,
};
