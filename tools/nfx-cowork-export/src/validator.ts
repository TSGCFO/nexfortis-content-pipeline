/**
 * Validation entry point.
 *
 * Every emitted JSON file is run through `validateSession()` before it touches
 * disk. If validation fails, the writer logs the errors and refuses to write
 * the file. This guards against an exporter bug silently corrupting the
 * downstream corpus.
 *
 * Also reachable standalone via `nfx-cowork-export --validate-output <path>`
 * for debugging emitted files in the wild.
 */

import { sessionSchema, type SessionDocument } from "./schema.js";

/**
 * Result of validating an arbitrary parsed JSON value against the session
 * schema.
 *
 * Discriminated on `ok`. On success, `document` carries the fully typed
 * `SessionDocument`. On failure, `errors` carries a list of human-readable
 * messages annotated with their JSON path (e.g. `at events.3.text: expected ...`).
 */
export type ValidationResult =
  | { ok: true; document: SessionDocument }
  | { ok: false; errors: ValidationIssue[] };

export interface ValidationIssue {
  /** Dotted path to the offending field, e.g. "events.3.text". Empty for top-level. */
  path: string;
  /** Human-readable message from zod. */
  message: string;
  /** Zod issue code, e.g. "invalid_literal", "invalid_type". Useful for programmatic handling. */
  code: string;
}

/**
 * Validate a parsed JSON value against the session schema.
 *
 * @param raw - The result of `JSON.parse(...)` on a candidate session file.
 *              Pass `unknown`; this function narrows it.
 * @returns Discriminated result. On success the typed document is returned
 *          (a structural clone of the input with extra fields stripped by zod).
 */
export function validateSession(raw: unknown): ValidationResult {
  const parsed = sessionSchema.safeParse(raw);

  if (parsed.success) {
    return { ok: true, document: parsed.data };
  }

  const errors: ValidationIssue[] = parsed.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return { ok: false, errors };
}

/**
 * Throwing version for use at write-time, where any validation failure is a
 * fatal bug we want to halt on rather than silently emit malformed JSON.
 *
 * The caller is expected to handle the thrown error by logging it to the
 * audit log and skipping the affected session — never by emitting the file
 * anyway.
 */
export class SessionValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(
      `Session document failed schema validation (${issues.length} issue${issues.length === 1 ? "" : "s"}):\n` +
        issues.map((i) => `  - ${i.path || "<root>"}: ${i.message} [${i.code}]`).join("\n")
    );
    this.name = "SessionValidationError";
  }
}

export function validateSessionOrThrow(raw: unknown): SessionDocument {
  const result = validateSession(raw);
  if (!result.ok) {
    throw new SessionValidationError(result.errors);
  }
  return result.document;
}

/**
 * Format a validation result as a multi-line string for stdout / audit log.
 * Returns an empty string on success.
 */
export function formatValidationResult(result: ValidationResult): string {
  if (result.ok) return "";
  return result.errors
    .map((e) => `  ${e.path || "<root>"}: ${e.message} [${e.code}]`)
    .join("\n");
}
