/**
 * Select up to 5 `capture_signals` rows to use as confirmation-question
 * sources for an `article_candidates` row.
 *
 * Rules per PRD §4.3 and the PR 2 prompt:
 *   - Filter by `evidence_chunk_ids` — only signals whose `id` appears in
 *     the candidate's array are considered.
 *   - Filter to `is_deleted = false` (already enforced by the loop's
 *     read; we re-check defensively in the in-memory filter so DI tests
 *     can pass un-prefiltered rows).
 *   - Order `captured_at DESC` (newest first).
 *   - Cap at 5 rows.
 *
 * The function is DI-friendly: callers pass an opaque `SignalQueryFn` that
 * returns the rows. The default impl in the loop binds it to a Drizzle
 * query against `capture_signals`.
 */

import type { SignalForInterview } from '../jobs/interview-session/types.js';

const MAX_SIGNALS = 5;

export interface SelectSignalsInput {
  /** `article_candidates.evidence_chunk_ids` — may be null or empty. */
  evidenceChunkIds: readonly string[] | null;
  /** Pulls rows from the DB (or test fixture) for the given ids. */
  queryFn: (ids: readonly string[]) => Promise<readonly SignalForInterview[]>;
}

export async function selectSignalsForCluster(
  input: SelectSignalsInput,
): Promise<SignalForInterview[]> {
  const ids = input.evidenceChunkIds;
  if (ids === null || ids.length === 0) {
    return [];
  }
  const rows = await input.queryFn(ids);
  return rows
    .filter((r) => r.isDeleted !== true)
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())
    .slice(0, MAX_SIGNALS);
}
