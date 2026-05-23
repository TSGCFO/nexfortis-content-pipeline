/**
 * Serialize a `ParsedTranscript` into a v1 `SessionDocument`, validate against
 * the locked schema, and (optionally) write to disk.
 *
 * Order of operations is strict:
 *   1. Build the document object.
 *   2. Run the validator. If it fails, throw — do NOT write a bad file.
 *      The orchestrator catches and logs to the audit; the affected
 *      transcript is skipped.
 *   3. Write the file atomically (write temp, rename).
 *
 * Filename: `<transcriptId>.json` in the output directory.
 *
 * Idempotency: re-running on the same data produces the same JSON content,
 * EXCEPT `_exporter.exportedAt`. The ingester dedupes on `sessionId` and
 * ignores `_exporter.*` for that purpose.
 *
 * Determinism comes from two things, NOT from object-key sorting:
 *   1. `buildSessionDocument` constructs every field in a fixed order, and
 *      `JSON.stringify` preserves insertion order for string-keyed
 *      properties — so the output object's key order is stable.
 *   2. The `cwds` and `gitBranches` arrays are explicitly sorted before
 *      they go into the document, so set membership produces the same
 *      sequence on every run.
 *
 * We do NOT sort keys at serialization time. The ingester doesn't care
 * about key order; it parses to a logical document and dedupes on
 * `sessionId`. If a future consumer needs byte-exact output across runs,
 * add a `sortKeysDeep` helper here — don't rely on the current setup.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { validateSession, SessionValidationError } from './validator.js';
import type { SessionDocument, Event } from './schema.js';
import { SCHEMA_VERSION } from './schema.js';
import type { ParsedSession, ParsedTranscript, SessionDiscovery } from './types.js';
import { workspaceIdFromPath } from './utils.js';

/** Package metadata baked into `_exporter`. */
export const EXPORTER_NAME = 'nfx-cowork-export';
export const EXPORTER_VERSION = '0.0.6';
export const SOURCE_FORMAT = 'cowork-jsonl-v1';

export interface EmitOptions {
  /** Output directory; created recursively if missing. */
  outputDir: string;
  /** When true, validate but do NOT write. Used by `--dry-run`. */
  dryRun: boolean;
  /** Wall-clock timestamp embedded in `_exporter.exportedAt`. Defaults to now. */
  exportedAt?: Date;
}

export interface EmitResult {
  /** Number of JSON files written to disk. Zero when `dryRun: true`. */
  filesWritten: number;
  /** Documents that failed validation; they were never written even when not in dry-run. */
  validationFailures: { transcriptId: string; issues: string[] }[];
  /** Per-transcript output paths (or where they WOULD have been written in dry-run). */
  outputs: { transcriptId: string; outputPath: string; bytesWritten: number; dryRun: boolean }[];
}

/**
 * Top-level entry: emit JSON for every transcript across every ParsedSession
 * whose post-check passed. Sessions whose `postCheck.keep === false` are
 * skipped entirely (slice-3 review constraint).
 */
export async function emitParsedSessions(
  sessions: readonly ParsedSession[],
  options: EmitOptions
): Promise<EmitResult> {
  const result: EmitResult = {
    filesWritten: 0,
    validationFailures: [],
    outputs: [],
  };

  if (!options.dryRun) {
    await fs.mkdir(options.outputDir, { recursive: true });
  }

  for (const session of sessions) {
    // Slice-3 review constraint: post-check-dropped sessions MUST NOT emit.
    if (!session.postCheck.keep) continue;

    for (const transcript of session.transcripts) {
      const outcome = await emitOneTranscript(session, transcript, options);
      if (outcome.kind === 'validation_failed') {
        result.validationFailures.push({
          transcriptId: transcript.transcriptId,
          issues: outcome.issues,
        });
        continue;
      }
      result.outputs.push({
        transcriptId: transcript.transcriptId,
        outputPath: outcome.outputPath,
        bytesWritten: outcome.bytesWritten,
        dryRun: options.dryRun,
      });
      if (!options.dryRun) result.filesWritten += 1;
    }
  }

  return result;
}

type EmitOutcome =
  | { kind: 'written'; outputPath: string; bytesWritten: number }
  | { kind: 'validation_failed'; issues: string[]; outputPath: string; bytesWritten: 0 };

async function emitOneTranscript(
  session: ParsedSession,
  transcript: ParsedTranscript,
  options: EmitOptions
): Promise<EmitOutcome> {
  const doc = buildSessionDocument(session, transcript, options.exportedAt ?? new Date());
  const validation = validateSession(doc);
  const outputPath = path.join(options.outputDir, `${transcript.transcriptId}.json`);

  if (!validation.ok) {
    const issues = validation.errors.map((e) => `${e.path || '<root>'}: ${e.message}`);
    return { kind: 'validation_failed', issues, outputPath, bytesWritten: 0 };
  }

  const json = JSON.stringify(validation.document, null, 2);
  const bytes = Buffer.byteLength(json, 'utf8');

  if (!options.dryRun) {
    // Atomic write: tmpfile then rename. Avoids leaving a half-written file
    // on disk if the process is interrupted.
    const tmp = outputPath + '.tmp-' + process.pid;
    await fs.writeFile(tmp, json, 'utf8');
    await fs.rename(tmp, outputPath);
  }

  return { kind: 'written', outputPath, bytesWritten: bytes };
}

/**
 * Build a SessionDocument from a ParsedTranscript + its containing session.
 * Exported so tests can construct documents without writing them.
 */
export function buildSessionDocument(
  session: ParsedSession,
  transcript: ParsedTranscript,
  exportedAt: Date
): SessionDocument {
  const events = transcript.events;
  const meta = session.discovery.meta;

  const doc: SessionDocument = {
    schemaVersion: SCHEMA_VERSION,
    _exporter: {
      name: EXPORTER_NAME,
      version: EXPORTER_VERSION,
      sourceFormat: SOURCE_FORMAT,
      exportedAt: toIsoUtcMs(exportedAt),
    },
    source: 'claude_cowork',
    sessionId: transcript.transcriptId,
    createdAt: pickCreatedAt(meta, events),
    events,
  };

  // Slug from the discovery's parent transcript record. Optional.
  const slug = primarySlug(session.discovery);
  if (slug !== null) doc.sessionSlug = slug;

  if (transcript.continuationGroupId !== undefined) {
    doc.continuationGroupId = transcript.continuationGroupId;
  }

  const workspaceId = workspaceIdFromPath(session.discovery.sessionFolder);
  if (workspaceId !== null) doc.workspaceId = workspaceId;

  // title is optional in source meta — Cowork generates titles
  // asynchronously after a session starts, so newly-created sessions can have
  // no title yet. Absence here means "source meta had no title field"; the
  // ingester treats the absent field as "unnamed session".
  if (meta?.title !== undefined) doc.title = meta.title;

  if (meta?.lastActivityAt !== undefined) {
    const norm = normalizeTimestamp(meta.lastActivityAt);
    if (norm !== null) doc.lastActivityAt = norm;
  }
  if (meta?.model !== undefined) doc.model = meta.model;
  if (meta?.emailAddress !== undefined) doc.account = meta.emailAddress;
  if (meta?.mcpServers !== undefined && meta.mcpServers.length > 0) {
    doc.mcpServers = [...meta.mcpServers];
  }

  // Unique cwds and gitBranches seen across all events (recurse into subagents).
  const { cwds, gitBranches } = collectCwdsAndBranches(events);
  if (cwds.length > 0) doc.cwds = cwds;
  if (gitBranches.length > 0) doc.gitBranches = gitBranches;

  return doc;
}

function pickCreatedAt(meta: ParsedSession['discovery']['meta'], events: readonly Event[]): string {
  const normalizedMeta = meta?.createdAt !== undefined ? normalizeTimestamp(meta.createdAt) : null;
  if (normalizedMeta !== null) return normalizedMeta;
  for (const e of events) {
    const norm = normalizeTimestamp(e.ts);
    if (norm !== null) return norm;
  }
  // Fallback: epoch — should never trigger since the schema requires `createdAt`.
  return '1970-01-01T00:00:00.000Z';
}

function primarySlug(d: SessionDiscovery): string | null {
  for (const t of d.transcripts) {
    if (!t.isSubagent && !t.isAcompact && t.slug) return t.slug;
  }
  return null;
}


function collectCwdsAndBranches(events: readonly Event[]): { cwds: string[]; gitBranches: string[] } {
  const cwdSet = new Set<string>();
  const branchSet = new Set<string>();

  function walk(input: readonly Event[]): void {
    for (const e of input) {
      if (e.cwd !== undefined) cwdSet.add(e.cwd);
      if (e.gitBranch !== undefined) branchSet.add(e.gitBranch);
      if (e.kind === 'subagent') walk(e.events);
    }
  }

  walk(events);
  return { cwds: [...cwdSet].sort(), gitBranches: [...branchSet].sort() };
}

const ISO_UTC_MS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function normalizeTimestamp(raw: string): string | null {
  if (ISO_UTC_MS_REGEX.test(raw)) return raw;
  // Try to parse and re-emit as ISO 8601 UTC with ms. If parsing fails, return null.
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return toIsoUtcMs(new Date(ms));
}

function toIsoUtcMs(d: Date): string {
  // Date.prototype.toISOString already gives ms precision + Z suffix.
  return d.toISOString();
}

// Re-export for advanced uses (the orchestrator may want to handle
// validation errors without going through emitParsedSessions).
export { SessionValidationError };
