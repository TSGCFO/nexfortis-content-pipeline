/**
 * Selects up to 5 `capture_signals` rows for a given `article_candidates`
 * row, in the shape expected by the confirmation-loop.
 *
 * Source of truth for "which signals does this candidate include?" is
 * `article_candidates.evidence_chunk_ids` — a `uuid[]` populated by the
 * synthesis worker when it picks the top-scoring cluster. We trust that
 * list and only filter for soft-deleted signals
 * (`capture_signals.is_deleted = false`).
 *
 * Ordering: `captured_at DESC` so the most recent expertise comes first
 * (PRD §4.3's "Last <day> at around <time>…" pattern reads more naturally
 * with the newest signal in question #1).
 *
 * The cap of 5 is enforced via SQL `LIMIT 5` so we never pull more than we
 * need (even if a candidate has more than 5 evidence chunks).
 */

import { and, desc, eq, inArray } from 'drizzle-orm';

import { captureSignals, type Database } from '@ncp/db';

export interface SelectedSignal {
  id: string;
  capturedAt: Date;
  redactedText: string;
  source: string;
  tokenCount: number | null;
}

export interface SelectSignalsForClusterInput {
  evidenceChunkIds: readonly string[] | null;
}

export const MAX_SELECTED_SIGNALS = 5;

export async function selectSignalsForCluster(
  db: Database,
  input: SelectSignalsForClusterInput,
): Promise<SelectedSignal[]> {
  const ids = input.evidenceChunkIds;
  if (ids === null || ids === undefined || ids.length === 0) {
    return [];
  }
  const rows = await db
    .select({
      id: captureSignals.id,
      capturedAt: captureSignals.capturedAt,
      redactedText: captureSignals.redactedText,
      source: captureSignals.source,
      tokenCount: captureSignals.tokenCount,
    })
    .from(captureSignals)
    .where(
      and(
        inArray(captureSignals.id, [...ids]),
        eq(captureSignals.isDeleted, false),
      ),
    )
    .orderBy(desc(captureSignals.capturedAt))
    .limit(MAX_SELECTED_SIGNALS);

  return rows.map((r) => ({
    id: r.id,
    capturedAt: r.capturedAt,
    redactedText: r.redactedText,
    source: r.source,
    tokenCount: r.tokenCount,
  }));
}
