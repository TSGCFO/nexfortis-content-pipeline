-- =============================================================================
-- Initial migration for the NexFortis Automated Content Pipeline v2
-- Source: docs/ways-of-work/plan/content-pipeline-v2/architecture-and-data-model.md §5 + §6
-- All DDL below mirrors the spec exactly. Running this migration is OUT OF
-- SCOPE for the prompt that introduced this file; Hassan will execute it
-- manually against the shared Supabase project as a separate step.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------

-- Required for the `halfvec(3072)` column on capture_signals and the HNSW
-- index. We use `halfvec` (16-bit float per component) instead of full
-- `vector` because pgvector caps HNSW indexes on the full `vector` type at
-- 2000 dimensions; `halfvec` supports up to 4000 dims at the cost of <0.5%
-- recall. The Supabase project must have superuser access to enable this
-- (Dashboard → Database → Extensions). `halfvec` ships in the same
-- `vector` extension (pgvector ≥ 0.7), so only one CREATE EXTENSION needed.
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------

CREATE TYPE pii_status_enum AS ENUM ('clean', 'redacted', 'blocked', 'pending');

CREATE TYPE cluster_status_enum AS ENUM ('active', 'used', 'discarded');

CREATE TYPE candidate_status_enum AS ENUM (
  'pending',
  'awaiting_interview',
  'interview_complete',
  'skipped',
  'timed_out',
  'draft_requested',
  'shelved',
  'published',
  'archived'
);

CREATE TYPE session_status_enum AS ENUM (
  'pending',
  'preview_sent',
  'confirming',
  'follow_up',
  'completed',
  'skipped',
  'timed_out'
);

CREATE TYPE draft_status_enum AS ENUM (
  'generating',
  'gate_a_fail',
  'gate_b_fail',
  'awaiting_manual_clearscope',
  'gate_passed',
  'in_sanity_review',
  'rejected_by_hassan',
  'shelved',
  'published'
);

-- -----------------------------------------------------------------------------
-- 5.1 capture_signals
-- -----------------------------------------------------------------------------

CREATE TABLE capture_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,
  source_id       TEXT NOT NULL UNIQUE,
  source_url      TEXT,
  captured_at     TIMESTAMPTZ NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_text        TEXT,
  redacted_text   TEXT NOT NULL,
  embedding       HALFVEC(3072),
  token_count     INTEGER,
  language        TEXT DEFAULT 'en',
  topic_tags      TEXT[],
  pii_status      pii_status_enum NOT NULL DEFAULT 'pending',
  redaction_log   JSONB DEFAULT '[]',
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_capture_signals_source ON capture_signals(source);
CREATE INDEX idx_capture_signals_captured_at ON capture_signals(captured_at DESC);
CREATE INDEX idx_capture_signals_is_deleted ON capture_signals(is_deleted) WHERE is_deleted = FALSE;

-- HNSW pgvector index — see §6. Kept as raw SQL because Drizzle's index DSL
-- in v0.36 cannot express `WITH (m = 16, ef_construction = 64)` cleanly.
-- Uses `halfvec_cosine_ops` (not `vector_cosine_ops`) because the column
-- type is `halfvec(3072)`; pgvector caps HNSW on full `vector` at 2000 dims.
CREATE INDEX idx_capture_signals_embedding ON capture_signals
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- 5.2 synthesis_clusters
-- -----------------------------------------------------------------------------

CREATE TABLE synthesis_clusters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  cluster_label     TEXT NOT NULL,
  signal_ids        UUID[] NOT NULL,
  topic_keywords    TEXT[] NOT NULL,
  serp_gap          JSONB DEFAULT '{}',
  surfaced_for_week DATE NOT NULL,
  status            cluster_status_enum NOT NULL DEFAULT 'active'
);

CREATE INDEX idx_synthesis_clusters_week ON synthesis_clusters(surfaced_for_week DESC);
CREATE INDEX idx_synthesis_clusters_status ON synthesis_clusters(status);

-- -----------------------------------------------------------------------------
-- 5.3 article_candidates
-- -----------------------------------------------------------------------------

CREATE TABLE article_candidates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id            UUID REFERENCES synthesis_clusters(id),
  primary_keyword       TEXT NOT NULL,
  pillar                TEXT NOT NULL,
  proposed_title        TEXT NOT NULL,
  evidence_chunk_ids    UUID[],
  serp_gaps             JSONB DEFAULT '[]',
  status                candidate_status_enum NOT NULL DEFAULT 'pending',
  low_corpus_confidence BOOLEAN DEFAULT FALSE,
  drafted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHECK constraint declared as a separate ALTER TABLE statement because
-- Drizzle v0.36's check-constraint DSL is still evolving; keeping it as raw
-- SQL keeps the migration the source of truth.
ALTER TABLE article_candidates
  ADD CONSTRAINT article_candidates_pillar_check
  CHECK (pillar IN ('quickbooks', 'managed-it', 'cybersecurity'));

CREATE INDEX idx_article_candidates_status ON article_candidates(status);
CREATE INDEX idx_article_candidates_pillar ON article_candidates(pillar);
CREATE INDEX idx_article_candidates_created_at ON article_candidates(created_at DESC);

-- -----------------------------------------------------------------------------
-- 5.4 interview_sessions
-- -----------------------------------------------------------------------------

CREATE TABLE interview_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID NOT NULL REFERENCES article_candidates(id),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  telegram_chat_id    TEXT NOT NULL,
  questions           JSONB DEFAULT '[]',
  answers             JSONB DEFAULT '[]',
  confirmed_chunk_ids UUID[] DEFAULT '{}',
  reminder_sent       BOOLEAN DEFAULT FALSE,
  escalation_sent_at  TIMESTAMPTZ,
  status              session_status_enum NOT NULL DEFAULT 'pending',
  signal_exclusions   JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_sessions_candidate ON interview_sessions(candidate_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);

-- -----------------------------------------------------------------------------
-- 5.5 drafts
-- -----------------------------------------------------------------------------

CREATE TABLE drafts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID NOT NULL REFERENCES article_candidates(id),
  session_id          UUID REFERENCES interview_sessions(id),
  attempt_number      INTEGER NOT NULL DEFAULT 1,
  seowind_brief       JSONB NOT NULL,
  seowind_draft_url   TEXT,
  draft_text          TEXT,
  seowind_score       NUMERIC,
  clearscope_score    NUMERIC,
  eeat_score          TEXT,
  gate_a_failures     JSONB DEFAULT '[]',
  rejection_reason    TEXT,
  sanity_doc_id       TEXT,
  status              draft_status_enum NOT NULL DEFAULT 'generating',
  escalation_sent_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drafts_candidate ON drafts(candidate_id);
CREATE INDEX idx_drafts_status ON drafts(status);
CREATE INDEX idx_drafts_attempt ON drafts(candidate_id, attempt_number);

-- Auto-update updated_at on every UPDATE. Drizzle does not generate trigger
-- functions, so the function + trigger are declared here as raw SQL — the
-- migration is the source of truth.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER drafts_updated_at
  BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- 5.6 published_articles
-- -----------------------------------------------------------------------------

CREATE TABLE published_articles (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id                   UUID NOT NULL REFERENCES drafts(id),
  sanity_doc_id              TEXT NOT NULL,
  slug                       TEXT NOT NULL UNIQUE,
  published_at               TIMESTAMPTZ NOT NULL,
  last_revalidated_at        TIMESTAMPTZ,
  indexing_api_ping_at       TIMESTAMPTZ,
  social_distribution_status JSONB DEFAULT '{}',
  medium_import_reminded_at  TIMESTAMPTZ,
  medium_imported_at         TIMESTAMPTZ,
  gsc_first_impression_at    TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_published_articles_slug ON published_articles(slug);
CREATE INDEX idx_published_articles_published_at ON published_articles(published_at DESC);

-- -----------------------------------------------------------------------------
-- 5.7 source_filters
-- -----------------------------------------------------------------------------

CREATE TABLE source_filters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source             TEXT NOT NULL UNIQUE,
  source_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  allowlist_patterns JSONB DEFAULT '[]',
  blocklist_patterns JSONB DEFAULT '[]',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed data is intentionally NOT inserted by this migration. The seed rows
-- live in `src/schema/source-filters.ts` as `sourceFiltersSeed` and are
-- inserted once, manually, by Hassan during deployment — the real legal
-- counsel hashes never appear in committed SQL.
