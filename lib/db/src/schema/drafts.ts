import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { articleCandidates } from './article-candidates.js';
import { interviewSessions } from './interview-sessions.js';

export const draftStatusEnum = pgEnum('draft_status_enum', [
  'generating',
  'gate_a_fail',
  'gate_b_fail',
  'awaiting_manual_clearscope',
  'gate_passed',
  'in_sanity_review',
  'rejected_by_hassan',
  'shelved',
  'published',
]);

// Shape of an individual Stage A failure record. Kept permissive because the
// gate-worker owns the precise schema (defined in a later prompt).
export interface GateAFailure {
  rule: string;
  message: string;
  context?: Record<string, unknown>;
}

// Shape of the assembled SEOwind brief payload. Kept permissive because the
// gate-worker / synthesis-worker own the precise schema (defined in a later
// prompt).
export type SeowindBrief = Record<string, unknown>;

export const drafts = pgTable(
  'drafts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => articleCandidates.id),
    sessionId: uuid('session_id').references(() => interviewSessions.id),
    attemptNumber: integer('attempt_number').notNull().default(1),
    seowindBrief: jsonb('seowind_brief').$type<SeowindBrief>().notNull(),
    seowindDraftUrl: text('seowind_draft_url'),
    draftText: text('draft_text'),
    seowindScore: numeric('seowind_score'),
    clearscopeScore: numeric('clearscope_score'),
    eeatScore: text('eeat_score'),
    gateAFailures: jsonb('gate_a_failures')
      .$type<GateAFailure[]>()
      .default(sql`'[]'::jsonb`),
    rejectionReason: text('rejection_reason'),
    sanityDocId: text('sanity_doc_id'),
    status: draftStatusEnum('status').notNull().default('generating'),
    escalationSentAt: timestamp('escalation_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    candidateIdx: index('idx_drafts_candidate').on(table.candidateId),
    statusIdx: index('idx_drafts_status').on(table.status),
    attemptIdx: index('idx_drafts_attempt').on(
      table.candidateId,
      table.attemptNumber,
    ),
    // NOTE: The `drafts_updated_at` BEFORE UPDATE trigger and the
    // `update_updated_at()` PL/pgSQL function are declared as raw SQL in
    // src/migrations/0000_initial.sql. Drizzle does not generate trigger
    // functions, so the migration is the source of truth.
  }),
);
