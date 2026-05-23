/**
 * Read one Cowork session JSON file from disk and validate it against the
 * locked v1 schema in `@ncp/cowork-export`.
 *
 * Order of operations is deliberate:
 *   1. Read the file as UTF-8 text. fs errors → `FileReadError`.
 *   2. `JSON.parse`. Syntax errors → `FileReadError` (caller treats parse
 *      and read failures the same way — the file is unusable).
 *   3. Pre-check the top-level `schemaVersion`. If it does not equal
 *      `SCHEMA_VERSION`, throw `SchemaVersionMismatchError` and DO NOT
 *      run zod — the schema only accepts a literal version and we want a
 *      distinct error class for the version-mismatch case so the
 *      orchestrator can count it separately.
 *   4. Run `validateSession` from `@ncp/cowork-export`. On failure, throw
 *      `SchemaValidationError` carrying the first 5 issue paths from zod
 *      (more than that is rarely useful for triage).
 *
 * The returned `SessionDocument` is the type-narrowed v1 document; callers
 * can rely on every required field being present.
 */

import { promises as fs } from 'node:fs';

import {
  SCHEMA_VERSION,
  validateSession,
} from '@ncp/cowork-export';

import {
  FileReadError,
  SchemaValidationError,
  SchemaVersionMismatchError,
  type SchemaValidationIssue,
} from './errors.js';
import type { SessionDocument } from './types.js';

/**
 * Maximum number of zod issue paths to carry forward in
 * `SchemaValidationError.issues`. The full list is rarely useful for triage;
 * the first few issues are almost always what the operator needs to fix the
 * upstream file. This is an internal cap — not part of the package's public
 * API.
 */
const MAX_ISSUE_DEPTH = 5;

export async function readAndValidate(
  filePath: string,
): Promise<SessionDocument> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new FileReadError(filePath, `read failed: ${message}`, { cause: err });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new FileReadError(filePath, `JSON parse failed: ${message}`, {
      cause: err,
    });
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new SchemaValidationError(filePath, [
      {
        path: '<root>',
        message: `expected an object at the top level, got ${parsed === null ? 'null' : typeof parsed}`,
      },
    ]);
  }

  if (!('schemaVersion' in parsed)) {
    throw new SchemaValidationError(filePath, [
      { path: 'schemaVersion', message: 'missing required field' },
    ]);
  }

  const actualVersion = (parsed as { schemaVersion: unknown }).schemaVersion;
  if (actualVersion !== SCHEMA_VERSION) {
    throw new SchemaVersionMismatchError(filePath, {
      actualVersion,
      expectedVersion: SCHEMA_VERSION,
    });
  }

  const result = validateSession(parsed);
  if (!result.ok) {
    const issues: SchemaValidationIssue[] = result.errors
      .slice(0, MAX_ISSUE_DEPTH)
      .map((e) => ({ path: e.path, message: e.message }));
    throw new SchemaValidationError(filePath, issues);
  }

  return result.document;
}
