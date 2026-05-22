import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Per-source incremental-fetch checkpoint. One row per ingester source name
// (e.g. 'msgraph-email'). The ingester reads `last_ingested_at` at run start
// to bound the upstream query, then upserts the row at run end with the
// timestamp of the most recent successfully processed signal.
//
// `source` is the natural primary key; there is at most one checkpoint per
// source. Idempotent updates rely on `ON CONFLICT (source) DO UPDATE`.
export const ingestCheckpoints = pgTable('ingest_checkpoints', {
  source: text('source').primaryKey(),
  lastIngestedAt: timestamp('last_ingested_at', {
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
