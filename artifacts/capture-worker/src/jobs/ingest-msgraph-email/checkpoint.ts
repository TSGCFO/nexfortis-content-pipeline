/**
 * Per-source incremental-fetch checkpoint helpers backed by the
 * `ingest_checkpoints` table (see `lib/db/src/schema/ingest-checkpoints.ts`).
 *
 * `getLastIngestedAt` returns the last successfully processed message
 * timestamp for `source = 'msgraph-email'`, falling back to `now() - 7 days`
 * when no row exists (initial-run safety net per the prompt's edge cases).
 *
 * `setLastIngestedAt` upserts the row via `ON CONFLICT (source) DO UPDATE`
 * so concurrent runs (which should not happen — Inngest serializes cron
 * functions by id — but defense in depth) stay consistent.
 */

import { ingestCheckpoints, type Database } from '@ncp/db';

const SOURCE = 'msgraph-email' as const;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type DbForCheckpoint = Pick<Database, 'select' | 'insert'>;

/**
 * The `ingest_checkpoints` table is small (≈1 row per source — currently 1
 * total) and only queried at run start. We fetch all rows and filter in JS
 * rather than importing drizzle-orm's `eq`/`sql` helpers directly into this
 * package — `@ncp/db` does not re-export them and adding `drizzle-orm` as a
 * direct dependency here is outside this prompt's allowlist.
 */
export async function getLastIngestedAt(
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

export async function setLastIngestedAt(
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
