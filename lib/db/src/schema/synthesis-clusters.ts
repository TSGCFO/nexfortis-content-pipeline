import { sql } from 'drizzle-orm';
import {
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const clusterStatusEnum = pgEnum('cluster_status_enum', [
  'active',
  'used',
  'discarded',
]);

// Shape of the serp_gap JSONB document. Kept as a permissive record because
// the exact gap schema is owned by the synthesis-worker and may evolve.
export type SynthesisClusterSerpGap = Record<string, unknown>;

export const synthesisClusters = pgTable(
  'synthesis_clusters',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    clusterLabel: text('cluster_label').notNull(),
    signalIds: uuid('signal_ids').array().notNull(),
    topicKeywords: text('topic_keywords').array().notNull(),
    serpGap: jsonb('serp_gap')
      .$type<SynthesisClusterSerpGap>()
      .default(sql`'{}'::jsonb`),
    surfacedForWeek: date('surfaced_for_week').notNull(),
    status: clusterStatusEnum('status').notNull().default('active'),
  },
  (table) => ({
    weekIdx: index('idx_synthesis_clusters_week').on(
      sql`${table.surfacedForWeek} DESC`,
    ),
    statusIdx: index('idx_synthesis_clusters_status').on(table.status),
  }),
);
