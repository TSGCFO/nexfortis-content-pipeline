/**
 * Shared types for the Cowork session ingester.
 *
 * Upstream `Event` and `SessionDocument` come from `@ncp/cowork-export`
 * (the locked v1 schema). This module re-exports them under their canonical
 * names so siblings in this directory have a single import location and we
 * do not duplicate any type definitions.
 */

import type { Event, SessionDocument } from '@ncp/cowork-export';

export type { Event, SessionDocument };

/**
 * One file discovered by `discoverFiles`. Used by `index.ts` to schedule
 * per-file `step.run` calls and to compute the new checkpoint timestamp.
 */
export interface DiscoveredFile {
  path: string;
  mtime: Date;
}

/**
 * Serializable shape used as the return type of `step.run('discover-files')`.
 * Inngest JSON-serializes step return values, so we send `mtime` as an ISO
 * string and re-hydrate to a `Date` on the receiving side.
 */
export interface SerializableDiscoveredFile {
  path: string;
  mtime: string;
}

/**
 * One event after flattening the recursive subagent tree.
 *
 * Subagent envelopes themselves do NOT appear in the flat stream — only
 * their children, depth-first, at the envelope's position. `tool_call`
 * events ARE included even when they have no `summary`; downstream
 * composition skips them but the flat stream count still reflects them.
 */
export type FlatEvent =
  | {
      kind: 'user_text';
      ts: string;
      uuid: string;
      text: string;
    }
  | {
      kind: 'assistant_text';
      ts: string;
      uuid: string;
      text: string;
    }
  | {
      kind: 'tool_call';
      ts: string;
      uuid: string;
      tool: string;
      summary: string | undefined;
    };

/**
 * Final outcome of `processSession` for a single session JSON file.
 *
 * Discriminated on `status` so callers handle each outcome explicitly.
 * `blocked` carries the `reason` from `lib/redaction` for the run-summary
 * log (but never the content — redaction text never leaves this module).
 */
export type ProcessResult =
  | {
      status: 'stored';
      signalsInserted: number;
      signalsSkippedDuplicate: number;
    }
  | { status: 'skipped_empty_events' }
  | { status: 'skipped_no_embeddable' }
  | { status: 'blocked'; reason: string }
  | { status: 'failed'; error: string };

/**
 * Aggregate counters across one run. Serialized into the run-summary log
 * line on completion.
 */
export interface RunSummary {
  source: 'claude_cowork';
  filesDiscovered: number;
  filesProcessed: number;
  filesFailedValidation: number;
  filesFailedSchemaVersion: number;
  filesFailedRead: number;
  sessionsSkippedEmptyEvents: number;
  sessionsSkippedNoEmbeddable: number;
  sessionsBlocked: number;
  signalsInserted: number;
  signalsSkippedDuplicate: number;
  errors: number;
}
