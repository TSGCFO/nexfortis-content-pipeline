-- =============================================================================
-- Migration 0001 — ingest_checkpoints
-- Added by Prompt 3b (capture-worker MS Graph email ingester) to give each
-- per-source ingester a durable place to store its incremental-fetch cursor.
--
-- One row per ingester source name (e.g. 'msgraph-email'). The ingester
-- reads `last_ingested_at` at run start and upserts it at run end. No
-- indexes are required: the table is small (≈1 row per source) and only
-- accessed by `source` PK.
--
-- Running this migration is OUT OF SCOPE for this PR; Hassan applies it
-- manually against the shared Supabase project as a separate deployment
-- step (same convention as 0000_initial.sql).
-- =============================================================================

CREATE TABLE ingest_checkpoints (
  source           TEXT PRIMARY KEY,
  last_ingested_at TIMESTAMPTZ NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
