import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { halfvec } from './_vector.js';

export const piiStatusEnum = pgEnum('pii_status_enum', [
  'clean',
  'redacted',
  'blocked',
  'pending',
]);

// Shape of a single entry in the `redaction_log` JSONB array.
export interface RedactionLogEntry {
  type: string;
  offset: number;
  replacement: string;
}

export const captureSignals = pgTable(
  'capture_signals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull().unique(),
    sourceUrl: text('source_url'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    rawText: text('raw_text'),
    redactedText: text('redacted_text').notNull(),
    embedding: halfvec('embedding', 3072),
    tokenCount: integer('token_count'),
    language: text('language').default('en'),
    topicTags: text('topic_tags').array(),
    piiStatus: piiStatusEnum('pii_status').notNull().default('pending'),
    redactionLog: jsonb('redaction_log')
      .$type<RedactionLogEntry[]>()
      .default(sql`'[]'::jsonb`),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sourceIdx: index('idx_capture_signals_source').on(table.source),
    capturedAtIdx: index('idx_capture_signals_captured_at').on(
      sql`${table.capturedAt} DESC`,
    ),
    isDeletedIdx: index('idx_capture_signals_is_deleted')
      .on(table.isDeleted)
      .where(sql`${table.isDeleted} = FALSE`),
    // NOTE: The HNSW pgvector index `idx_capture_signals_embedding` is created
    // via raw SQL in src/migrations/0000_initial.sql because the
    // `USING hnsw (... halfvec_cosine_ops) WITH (m = 16, ef_construction = 64)`
    // form is not cleanly expressible through Drizzle's index DSL in v0.36.
    // The column is `halfvec(3072)` (not `vector(3072)`) because pgvector
    // caps HNSW indexes on the full `vector` type at 2000 dimensions —
    // `halfvec` supports up to 4000 dims at the cost of <0.5% recall.
  }),
);
