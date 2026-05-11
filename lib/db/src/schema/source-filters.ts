import { sql } from 'drizzle-orm';
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { InferInsertModel } from 'drizzle-orm';

// Discriminated union of blocklist pattern shapes. Specific ingesters may add
// new variants; consumers should treat unknown `type` values as opaque.
export type SourceFilterBlocklistPattern =
  | { type: 'email_address'; values: string[] }
  | { type: 'subject_regex'; pattern: string }
  | { type: string; [k: string]: unknown };

export type SourceFilterAllowlistPattern = {
  type: string;
  [k: string]: unknown;
};

export const sourceFilters = pgTable('source_filters', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  source: text('source').notNull().unique(),
  sourceEnabled: boolean('source_enabled').notNull().default(true),
  allowlistPatterns: jsonb('allowlist_patterns')
    .$type<SourceFilterAllowlistPattern[]>()
    .default(sql`'[]'::jsonb`),
  blocklistPatterns: jsonb('blocklist_patterns')
    .$type<SourceFilterBlocklistPattern[]>()
    .default(sql`'[]'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Seed rows defined in architecture-and-data-model.md §5.7. EXPORTED ONLY —
// inserting these rows is a manual one-time operation Hassan performs during
// deployment. This module never runs `INSERT INTO source_filters` itself.
//
// The legal-counsel email values are intentionally placeholders. The real
// SHA-256 hashes are stored only in deployment secrets and inserted manually
// by Hassan during the one-time seed step — they are never committed to git.
export const sourceFiltersSeed: ReadonlyArray<
  InferInsertModel<typeof sourceFilters>
> = [
  {
    source: 'claude_export',
    sourceEnabled: true,
    blocklistPatterns: [],
  },
  {
    source: 'perplexity',
    sourceEnabled: true,
    blocklistPatterns: [],
  },
  {
    source: 'msgraph_email',
    sourceEnabled: true,
    blocklistPatterns: [
      {
        type: 'email_address',
        values: ['[REDACTED_LEGAL_EMAIL_1]', '[REDACTED_LEGAL_EMAIL_2]'],
      },
      {
        type: 'subject_regex',
        pattern:
          '(custody|mediator|settlement|family court|divorce|separation agreement)',
      },
    ],
  },
  {
    source: 'msgraph_teams',
    sourceEnabled: true,
    blocklistPatterns: [],
  },
  {
    source: 'telegram_voice',
    sourceEnabled: true,
    blocklistPatterns: [],
  },
];
