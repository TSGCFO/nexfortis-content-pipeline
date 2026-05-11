import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { drafts } from './drafts.js';

export interface SocialDistributionStatus {
  missinglettr?: 'queued' | 'sent';
  queued_at?: string;
  sent_at?: string;
}

export const publishedArticles = pgTable(
  'published_articles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => drafts.id),
    sanityDocId: text('sanity_doc_id').notNull(),
    slug: text('slug').notNull().unique(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    lastRevalidatedAt: timestamp('last_revalidated_at', {
      withTimezone: true,
    }),
    indexingApiPingAt: timestamp('indexing_api_ping_at', {
      withTimezone: true,
    }),
    socialDistributionStatus: jsonb('social_distribution_status')
      .$type<SocialDistributionStatus>()
      .default(sql`'{}'::jsonb`),
    mediumImportRemindedAt: timestamp('medium_import_reminded_at', {
      withTimezone: true,
    }),
    mediumImportedAt: timestamp('medium_imported_at', { withTimezone: true }),
    gscFirstImpressionAt: timestamp('gsc_first_impression_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    slugIdx: index('idx_published_articles_slug').on(table.slug),
    publishedAtIdx: index('idx_published_articles_published_at').on(
      sql`${table.publishedAt} DESC`,
    ),
  }),
);
