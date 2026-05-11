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
import { articleCandidates } from './article-candidates.js';

export const sessionStatusEnum = pgEnum('session_status_enum', [
  'pending',
  'preview_sent',
  'confirming',
  'follow_up',
  'completed',
  'skipped',
  'timed_out',
]);

export interface InterviewQuestion {
  index: number;
  signal_id: string;
  question_text: string;
  sent_at: string;
}

export interface InterviewAnswer {
  question_index: number;
  response: string;
  text?: string;
  audio_url?: string;
  transcript?: string;
  timestamp: string;
}

export interface InterviewSignalExclusion {
  signal_id: string;
  reason: string;
}

export const interviewSessions = pgTable(
  'interview_sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => articleCandidates.id),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    telegramChatId: text('telegram_chat_id').notNull(),
    questions: jsonb('questions')
      .$type<InterviewQuestion[]>()
      .default(sql`'[]'::jsonb`),
    answers: jsonb('answers')
      .$type<InterviewAnswer[]>()
      .default(sql`'[]'::jsonb`),
    confirmedChunkIds: uuid('confirmed_chunk_ids')
      .array()
      .default(sql`'{}'::uuid[]`),
    reminderSent: boolean('reminder_sent').default(false),
    escalationSentAt: timestamp('escalation_sent_at', { withTimezone: true }),
    status: sessionStatusEnum('status').notNull().default('pending'),
    signalExclusions: jsonb('signal_exclusions')
      .$type<InterviewSignalExclusion[]>()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    candidateIdx: index('idx_interview_sessions_candidate').on(
      table.candidateId,
    ),
    statusIdx: index('idx_interview_sessions_status').on(table.status),
  }),
);
