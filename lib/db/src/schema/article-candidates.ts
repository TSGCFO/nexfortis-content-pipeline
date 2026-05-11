import type { Pillar } from '@ncp/shared-types';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { synthesisClusters } from './synthesis-clusters.js';

export const candidateStatusEnum = pgEnum('candidate_status_enum', [
  'pending',
  'awaiting_interview',
  'interview_complete',
  'skipped',
  'timed_out',
  'draft_requested',
  'shelved',
  'published',
  'archived',
]);

// SERP gap entries surfaced from SEOwind brief previews. Kept as a string list
// to match the spec's "array of gap topic strings".
export type ArticleCandidateSerpGap = string[];

export const articleCandidates = pgTable(
  'article_candidates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    clusterId: uuid('cluster_id').references(() => synthesisClusters.id),
    primaryKeyword: text('primary_keyword').notNull(),
    // NOTE: The `pillar IN ('quickbooks', 'managed-it', 'cybersecurity')` CHECK
    // constraint is declared as a raw `ALTER TABLE ... ADD CONSTRAINT` statement
    // in src/migrations/0000_initial.sql. Drizzle v0.36's check-constraint DSL
    // is still evolving and we keep the migration as the source of truth.
    // The TS-level narrowing to `Pillar` is enforced via `.$type<Pillar>()`.
    pillar: text('pillar').notNull().$type<Pillar>(),
    proposedTitle: text('proposed_title').notNull(),
    evidenceChunkIds: uuid('evidence_chunk_ids').array(),
    serpGaps: jsonb('serp_gaps')
      .$type<ArticleCandidateSerpGap>()
      .default(sql`'[]'::jsonb`),
    status: candidateStatusEnum('status').notNull().default('pending'),
    lowCorpusConfidence: boolean('low_corpus_confidence').default(false),
    draftedAt: timestamp('drafted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusIdx: index('idx_article_candidates_status').on(table.status),
    pillarIdx: index('idx_article_candidates_pillar').on(table.pillar),
    createdAtIdx: index('idx_article_candidates_created_at').on(
      sql`${table.createdAt} DESC`,
    ),
  }),
);
