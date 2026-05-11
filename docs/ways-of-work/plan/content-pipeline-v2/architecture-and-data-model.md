# Architecture & Data Model Spec — NexFortis Content Pipeline v2

**Document Owner:** Hassan Sadiq, NexFortis  
**Parent Epic:** [NexFortis Automated Content Pipeline v2](./epic-prd.md)  
**Status:** Production Spec — Ready for Implementation  
**Version:** 1.0  
**Created:** May 10, 2026  
**Audience:** Hassan Sadiq, Cursor agents / Claude Code (primary implementer), Computer (orchestrator), future contractors

---

## Table of Contents

1. [Repository Topology](#1-repository-topology)
2. [Shared Types Management](#2-shared-types-management)
3. [System Overview Diagram](#3-system-overview-diagram)
4. [Service Topology](#4-service-topology)
5. [Complete Postgres Schemas (DDL)](#5-complete-postgres-schemas-ddl)
6. [Pgvector Specifics](#6-pgvector-specifics)
7. [Integration Points](#7-integration-points)
8. [Environment Variables — Complete List](#8-environment-variables--complete-list)
9. [Secrets Handling](#9-secrets-handling)
10. [Observability](#10-observability)
11. [Security & Privacy](#11-security--privacy)

---

## 1. Repository Topology

### Decision

The content pipeline is built in a **separate GitHub repository**: `TSGCFO/nexfortis-content-pipeline`. It is NOT a package added to the existing `TSGCFO/NexFortis-Website-Design-pro` monorepo.

### Boundary Diagram

```
┌─────────────────────────────────────────────────┐
│  GitHub: TSGCFO/NexFortis-Website-Design-pro     │
│  (existing — DO NOT MODIFY from pipeline work)   │
│                                                   │
│  artifacts/nexfortis/      Next.js blog + site    │
│  artifacts/api-server/     API service            │
│  artifacts/qb-portal/      QB portal              │
│  lib/db/                   Drizzle (blog tables)  │
│  lib/shared-types/         Pillar, Article, etc.  │
│                                                   │
│  ┌──────────────────────┐                         │
│  │  Render (prod)       │                         │
│  │  nexfortis.com       │◄──── ISR revalidate     │
│  │  /api/revalidate     │     (HTTP call only)    │
│  └──────────────────────┘                         │
└─────────────────────────────────────────────────┘
             │                         │
             │    SHARED SERVICES      │
             │  (not owned by either   │
             │       repo)             │
             ▼                         ▼
┌────────────────────────┐  ┌────────────────────────┐
│  Supabase (SAME proj)  │  │  Sanity (SAME proj)     │
│  • blog tables (exist) │  │  • Studio + content API │
│  • capture_signals     │  │  • post documents       │
│  • synthesis_clusters  │  │  • same dataset         │
│  • article_candidates  │  └────────────────────────┘
│  • interview_sessions  │
│  • drafts              │
│  • published_articles  │
│  • source_filters      │
└────────────────────────┘

┌─────────────────────────────────────────────────┐
│  GitHub: TSGCFO/nexfortis-content-pipeline       │
│  (NEW — this is where ALL pipeline code lives)  │
│                                                   │
│  artifacts/                                       │
│    capture-worker/    Inngest ingestion jobs      │
│    synthesis-worker/  nightly clustering          │
│    telegram-bot/      long-poll bot + interviews  │
│    gate-worker/       quality gate orchestration  │
│    sanity-bridge/     Sanity push + publish hook  │
│  lib/                                             │
│    db/                Drizzle schemas (pipeline   │
│                       tables; same Supabase proj) │
│    embeddings/        OpenAI embed + Whisper      │
│    redaction/         PII regex + LLM scrub       │
│    shared-types/      Inlined copy from main repo │
│    logger/            pino + Sentry               │
│  .env.example                                     │
│  pnpm-workspace.yaml                              │
│  tsconfig.base.json                               │
└─────────────────────────────────────────────────┘
```

### Why Separate Repo

The initial epic PRD recommended adding `artifacts/content-pipeline/` to the existing monorepo. That recommendation was reversed after recognizing that the content pipeline is an independent backend automation system with its own deployment lifecycle, unrelated to the Next.js blog rendering code.

Separate repo gives:
- **Clean CI:** A broken test in the pipeline does not block a deploy of the production site.
- **Independent deployment:** The five pipeline Render services deploy independently of the blog.
- **No cross-contamination:** Any dependency bump or type change in the content-pipeline repo has zero blast radius to the live NexFortis site, QB Portal, or shared API server.

Accepted trade-offs: two CI configs, two Render service setups, two dependency upgrade flows. For a solo operator with a live production site, this is the correct trade.

### Behavioral Constraint Files

The `nexfortis-content-pipeline` repo contains two behavioral constraint files that Cursor agents and Claude Code reliably respect as stable system-prompt injection:

- **`AGENTS.md`** (repo root) — defines the purpose of this repo, the high-level architecture, conventions (naming, error handling, logging), and pointers to key decisions (ADRs, Feature PRDs). Every Cursor agent prompt instructs the implementer to follow this file.
- **`.cursorrules`** (repo root) — Cursor-specific behavioral rules: no auto-formatting outside the prompt's scope, no unsolicited refactors, no changes to files outside the prompt's explicit allowlist, mandatory test additions, required PR description template, no dependency upgrades without explicit permission.

These files are written once in Prompt 1 and treated as stable. Neither Cursor agents nor Claude Code overwrite them. Hassan should not edit these files in ways that conflict with the prompt library.

---

## 2. Shared Types Management

### The Problem

Both repos reference some of the same domain types: `Pillar`, `Article`, `Author`. These must stay consistent.

### Chosen Approach: Inlined Copy (Option 2)

The type files in `nexfortis-content-pipeline/lib/shared-types/` are manually kept in sync with their counterparts in `NexFortis-Website-Design-pro/lib/shared-types/`.

**Why not a published npm package:** Publishing `@nexfortis/blog-types` adds a publish step and version pinning to every type change. For 3–5 stable type definitions that change at most a few times a year, the overhead is not worth it for v2. This is the v3 upgrade path.

**Why not a git submodule:** More maintenance pain than it saves for a small number of types.

### Shared Type Files

| Type | File in content-pipeline repo | Counterpart in main repo |
|---|---|---|
| `Pillar` | `lib/shared-types/pillar.ts` | `lib/shared-types/pillar.ts` |
| `Article` | `lib/shared-types/article.ts` | `lib/shared-types/article.ts` |
| `Author` | `lib/shared-types/author.ts` | `lib/shared-types/author.ts` |

Each file starts with:
```typescript
// INLINED COPY — keep in sync with NexFortis-Website-Design-pro/lib/shared-types/[filename]
// Last synced: [date]
// If the main repo changes these types, update this file in the same PR or next available PR.
```

**Sync policy:**
- Types change rarely (Pillar is an enum; Article has stable fields).
- When the main site changes a shared type, Hassan or the parent agent notes it and updates the copy in a separate PR to `nexfortis-content-pipeline`.
- No automated sync mechanism in v2. Human responsibility, documented here.

---

## 3. System Overview Diagram

```
CAPTURE LAYER (daily crons — capture-worker + telegram-bot)
─────────────────────────────────────────────────────────────
Claude export ──┐
Perplexity ─────┤
MS Graph email ─┼──► Inngest ingestion jobs ──► redaction ──► embed ──► capture_signals (Supabase)
Teams transcripts┤
Telegram voice ─┘

SYNTHESIS LAYER (Sunday 2 AM Eastern — synthesis-worker)
─────────────────────────────────────────────────────────────
capture_signals ──► cosine clustering ──► article_candidates ──► Telegram preview to Hassan

INTERVIEW LAYER (Monday 8 AM Eastern — telegram-bot)
─────────────────────────────────────────────────────────────
article_candidates ──► Claude Sonnet question gen ──► Telegram bot ──► Hassan answers
                                                                          │
                                                              interview_sessions (Supabase)

DRAFTING LAYER (triggered by interview completion — gate-worker)
─────────────────────────────────────────────────────────────
interview_sessions ──► SEOwind brief assembly ──► SEOwind draft ──► Gate A (rules)
                                                                      │
                                                              Gate B (Clearscope ≥80)
                                                                      │
                                                              Gate C (Aleyda GPT, manual)
                                                                      │
                                                             drafts (Supabase) ──► draft.gate_passed

PUBLISH LAYER (triggered by gate_passed — sanity-bridge)
─────────────────────────────────────────────────────────────
drafts ──► Sanity post doc (draft) ──► Telegram notify Hassan
                                              │
                                      Hassan Approve (Sanity action)
                                              │
                              ┌───────────────┼────────────────────┐
                              ▼               ▼                    ▼
                    ISR revalidate    Indexing API ping    Social queue entry
                              │
                    nexfortis.com/blog/[slug] live
                              │
                    T+14d: Medium import reminder
```

---

## 4. Service Topology

### Render Services (nexfortis-content-pipeline)

| Service | Artifact | Type | Always On? |
|---|---|---|---|
| capture-worker | `artifacts/capture-worker/` | Background Worker (Inngest serve) | Yes |
| synthesis-worker | `artifacts/synthesis-worker/` | Background Worker (Inngest serve) | Yes |
| telegram-bot | `artifacts/telegram-bot/` | Background Worker (long-poll) | Yes |
| gate-worker | `artifacts/gate-worker/` | Background Worker (Inngest serve) | Yes |
| sanity-bridge | `artifacts/sanity-bridge/` | Web Service (webhook receiver) | Yes |

All five services run on Render. Each is a separate Render service with its own env vars. The `sanity-bridge` is the only one that needs a public HTTP URL (for Sanity webhooks); the others are background workers.

**Inngest:** All Inngest-backed services (capture-worker, synthesis-worker, gate-worker, sanity-bridge) register their functions with the same Inngest app. They communicate via Inngest events — no direct service-to-service HTTP calls.

**Shared Supabase project:** All five services use the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. They are logically separated by which tables they read/write (enforced by application code, not by Postgres permissions in v2; RLS enforcement is a v2.1 hardening step).

### CI/CD

- GitHub Actions (or Render's built-in Git deploy).
- Each `artifacts/<service>/` directory triggers its own Render deploy on push to `main`.
- No cross-artifact deploys.
- Vitest tests run on every PR.

---

## 5. Complete Postgres Schemas (DDL)

All migrations run against the **shared Supabase project** using Drizzle's migration tooling from `lib/db/`. They are additive — existing blog tables are not modified.

Prerequisite: Enable `pgvector` extension in the Supabase project. Run once:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

### 5.1 `capture_signals`

```sql
CREATE TYPE pii_status_enum AS ENUM ('clean', 'redacted', 'blocked', 'pending');

CREATE TABLE capture_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,                     -- 'claude_export' | 'perplexity' | 'msgraph_email' | 'msgraph_teams' | 'telegram_voice'
  source_id       TEXT NOT NULL UNIQUE,              -- hash(source + content fingerprint) — deduplication key
  source_url      TEXT,                              -- original URL if applicable
  captured_at     TIMESTAMPTZ NOT NULL,              -- when the source content was created (NOT ingestion time)
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_text        TEXT,                              -- pre-redaction; for Hassan's manual review only; never embedded
  redacted_text   TEXT NOT NULL,                     -- post two-pass redaction; used for embedding
  embedding       VECTOR(3072),                      -- text-embedding-3-large; NULL until embedding job runs
  token_count     INTEGER,                           -- tiktoken count of redacted_text
  language        TEXT DEFAULT 'en',
  topic_tags      TEXT[],                            -- populated by synthesis job
  pii_status      pii_status_enum NOT NULL DEFAULT 'pending',
  redaction_log   JSONB DEFAULT '[]',                -- array of { type, offset, replacement }
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,    -- soft delete; excluded from all synthesis queries
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_capture_signals_source ON capture_signals(source);
CREATE INDEX idx_capture_signals_captured_at ON capture_signals(captured_at DESC);
CREATE INDEX idx_capture_signals_is_deleted ON capture_signals(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_capture_signals_embedding ON capture_signals
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

### 5.2 `synthesis_clusters`

```sql
CREATE TYPE cluster_status_enum AS ENUM ('active', 'used', 'discarded');

CREATE TABLE synthesis_clusters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cluster_label    TEXT NOT NULL,                    -- short human-readable label from Claude
  signal_ids       UUID[] NOT NULL,                  -- array of capture_signal IDs in this cluster
  topic_keywords   TEXT[] NOT NULL,                  -- extracted by Claude Sonnet
  serp_gap         JSONB DEFAULT '{}',               -- gap topics from SEOwind brief preview
  surfaced_for_week DATE NOT NULL,                   -- the Monday this cluster was surfaced for
  status           cluster_status_enum NOT NULL DEFAULT 'active'
);

CREATE INDEX idx_synthesis_clusters_week ON synthesis_clusters(surfaced_for_week DESC);
CREATE INDEX idx_synthesis_clusters_status ON synthesis_clusters(status);
```

---

### 5.3 `article_candidates`

```sql
CREATE TYPE candidate_status_enum AS ENUM (
  'pending',          -- created by synthesis; not yet interviewed
  'awaiting_interview',
  'interview_complete',
  'skipped',          -- Hassan /skip'd
  'timed_out',        -- interview timed out
  'draft_requested',
  'shelved',          -- 3 draft attempts failed
  'published',        -- final state
  'archived'          -- manually archived
);

CREATE TABLE article_candidates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id        UUID REFERENCES synthesis_clusters(id),
  primary_keyword   TEXT NOT NULL,
  pillar            TEXT NOT NULL CHECK (pillar IN ('quickbooks', 'managed-it', 'cybersecurity')),
  proposed_title    TEXT NOT NULL,
  evidence_chunk_ids UUID[],                         -- confirmed chunk IDs after interview
  serp_gaps         JSONB DEFAULT '[]',              -- array of gap topic strings
  status            candidate_status_enum NOT NULL DEFAULT 'pending',
  low_corpus_confidence BOOLEAN DEFAULT FALSE,       -- true if all confirmations were skipped
  drafted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_article_candidates_status ON article_candidates(status);
CREATE INDEX idx_article_candidates_pillar ON article_candidates(pillar);
CREATE INDEX idx_article_candidates_created_at ON article_candidates(created_at DESC);
```

---

### 5.4 `interview_sessions`

```sql
CREATE TYPE session_status_enum AS ENUM (
  'pending',          -- not yet opened
  'preview_sent',
  'confirming',
  'follow_up',
  'completed',
  'skipped',
  'timed_out'
);

CREATE TABLE interview_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     UUID NOT NULL REFERENCES article_candidates(id),
  started_at       TIMESTAMPTZ,                      -- when preview was sent
  completed_at     TIMESTAMPTZ,
  telegram_chat_id TEXT NOT NULL,
  questions        JSONB DEFAULT '[]',               -- array of { index, signal_id, question_text, sent_at }
  answers          JSONB DEFAULT '[]',               -- array of { question_index, response, text, audio_url, transcript, timestamp }
  confirmed_chunk_ids UUID[] DEFAULT '{}',
  reminder_sent    BOOLEAN DEFAULT FALSE,
  escalation_sent_at TIMESTAMPTZ,
  status           session_status_enum NOT NULL DEFAULT 'pending',
  signal_exclusions JSONB DEFAULT '[]',              -- signals excluded from this session + reason
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_sessions_candidate ON interview_sessions(candidate_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);
```

---

### 5.5 `drafts`

```sql
CREATE TYPE draft_status_enum AS ENUM (
  'generating',
  'gate_a_fail',
  'gate_b_fail',
  'awaiting_manual_clearscope',
  'gate_passed',
  'in_sanity_review',
  'rejected_by_hassan',
  'shelved',
  'published'         -- set when sanity-bridge confirms publish
);

CREATE TABLE drafts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      UUID NOT NULL REFERENCES article_candidates(id),
  session_id        UUID REFERENCES interview_sessions(id),
  attempt_number    INTEGER NOT NULL DEFAULT 1,
  seowind_brief     JSONB NOT NULL,                  -- assembled brief payload
  seowind_draft_url TEXT,                            -- URL to draft in SEOwind
  draft_text        TEXT,                            -- full draft text (stored if URL unreliable)
  seowind_score     NUMERIC,
  clearscope_score  NUMERIC,
  eeat_score        TEXT,                            -- Stage C qualitative result
  gate_a_failures   JSONB DEFAULT '[]',              -- array of GateAFailure objects
  rejection_reason  TEXT,                            -- Hassan's rejection reason if rejected
  sanity_doc_id     TEXT,                            -- Sanity _id
  status            draft_status_enum NOT NULL DEFAULT 'generating',
  escalation_sent_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drafts_candidate ON drafts(candidate_id);
CREATE INDEX idx_drafts_status ON drafts(status);
CREATE INDEX idx_drafts_attempt ON drafts(candidate_id, attempt_number);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER drafts_updated_at
  BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### 5.6 `published_articles`

```sql
CREATE TABLE published_articles (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id                  UUID NOT NULL REFERENCES drafts(id),
  sanity_doc_id             TEXT NOT NULL,
  slug                      TEXT NOT NULL UNIQUE,
  published_at              TIMESTAMPTZ NOT NULL,
  last_revalidated_at       TIMESTAMPTZ,
  indexing_api_ping_at      TIMESTAMPTZ,
  social_distribution_status JSONB DEFAULT '{}',     -- { missinglettr: 'queued' | 'sent', queued_at, sent_at }
  medium_import_reminded_at TIMESTAMPTZ,
  medium_imported_at        TIMESTAMPTZ,             -- set manually by Hassan after import
  gsc_first_impression_at   TIMESTAMPTZ,             -- set manually or via GSC API when first impression detected
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_published_articles_slug ON published_articles(slug);
CREATE INDEX idx_published_articles_published_at ON published_articles(published_at DESC);
```

---

### 5.7 `source_filters`

```sql
CREATE TABLE source_filters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL UNIQUE,            -- 'claude_export' | 'perplexity' | 'msgraph_email' | etc.
  source_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  allowlist_patterns JSONB DEFAULT '[]',             -- patterns for folders/senders to INCLUDE
  blocklist_patterns JSONB DEFAULT '[]',             -- patterns to ALWAYS EXCLUDE (family-law, legal counsel)
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed data (run once):
INSERT INTO source_filters (source, source_enabled, blocklist_patterns) VALUES
  ('claude_export',    TRUE, '[]'),
  ('perplexity',       TRUE, '[]'),
  ('msgraph_email',    TRUE, '[{"type":"email_address","values":["[REDACTED_LEGAL_EMAIL_1]","[REDACTED_LEGAL_EMAIL_2]"]},{"type":"subject_regex","pattern":"(custody|mediator|settlement|family court|divorce|separation agreement)"}]'),
  ('msgraph_teams',    TRUE, '[]'),
  ('telegram_voice',   TRUE, '[]');
```

**Note:** The actual legal counsel and mediator email addresses are stored as hashed values in the blocklist_patterns JSON. They are never stored in plaintext in the database. The hash comparison logic lives in `lib/redaction/blocklist.ts`.

---

## 6. Pgvector Specifics

### Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
-- Run on the shared Supabase project; requires superuser (Supabase dashboard → Extensions)
```

### Index Type: HNSW

HNSW (Hierarchical Navigable Small World) is preferred over IVFFlat for this use case because:
- No training step required (IVFFlat requires `VACUUM` after significant data changes).
- Better recall at the projected corpus size (< 100,000 vectors in v2).
- Supabase supports HNSW as of pgvector 0.5.0.

```sql
CREATE INDEX idx_capture_signals_embedding ON capture_signals
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

- `m = 16`: number of connections per layer. Suitable for < 100K vectors.
- `ef_construction = 64`: build-time quality. Increase to 128 if recall drops.

### Distance Metric: Cosine

All similarity queries use the `<=>` operator (cosine distance):

```sql
SELECT id, redacted_text, 1 - (embedding <=> $1::vector) AS similarity
FROM capture_signals
WHERE is_deleted = FALSE
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

### Maintenance

```sql
-- After bulk inserts (e.g., initial Claude export ingestion):
REINDEX INDEX CONCURRENTLY idx_capture_signals_embedding;

-- Monitor index bloat quarterly:
SELECT pg_size_pretty(pg_relation_size('idx_capture_signals_embedding'));
```

### Embedding Dimensions

`text-embedding-3-large` produces 3072-dimensional vectors by default. Do not reduce dimensions using the `dimensions` parameter for v2 — full dimensionality provides the best cosine similarity at this corpus size.

---

## 7. Integration Points

### 7.1 Microsoft Graph API

| Item | Detail |
|---|---|
| App registration | Shared with `NexFortis-Website-Design-pro` Entra ID app |
| Required scopes | `mail.read` (delegated), `callRecords.read.all` (delegated) |
| Auth flow | Authorization Code → refresh token stored in `MSGRAPH_REFRESH_TOKEN` |
| Token refresh | Refresh token has 90-day sliding window; rotate the stored env var quarterly |
| Rate limits | 10,000 requests/10 minutes for mail API; daily batch is well under this for a solo operator |
| Error handling | 429 → exponential backoff starting at 5s, max 5 retries; 401 → refresh token, then retry once |
| Idempotency | `source_id` hash prevents re-ingesting already-processed emails |

### 7.2 Telegram Bot API

| Item | Detail |
|---|---|
| Library | `grammy` v1.31.0 |
| Mode | Long-polling (not webhook) |
| Bot token | `TELEGRAM_BOT_TOKEN` — from BotFather |
| Chat ID | `TELEGRAM_CHAT_ID` — Hassan's personal chat ID with the bot; hardcoded to one user |
| Rate limits | 30 messages/second global; 1 message/second per chat — well within limits for solo operator |
| Error handling | Network errors: exponential backoff; Telegram 429: honor `retry_after` field |
| Security | Bot only responds to messages from `TELEGRAM_CHAT_ID`; all others ignored |

### 7.3 OpenAI (Embeddings + Whisper)

| Item | Detail |
|---|---|
| Embeddings model | `text-embedding-3-large` |
| Whisper model | `whisper-1` |
| Key | `OPENAI_API_KEY` (recommend separate key per repo from same account) |
| Org | `OPENAI_ORG_ID` |
| Rate limits | Embeddings: 3,000 RPM on Tier 1; batch up to 100 texts per call to stay under |
| Error handling | 429 → exponential backoff; 500 → retry once after 10s |
| Budget cap | Set a monthly spend cap in OpenAI settings: $30/month recommended for v2 |
| Idempotency | Only embed signals that have `embedding IS NULL`; never re-embed |

### 7.4 Anthropic Claude

| Item | Detail |
|---|---|
| Models used | Sonnet (synthesis, question gen, titles), Haiku (redaction scrub, classification, formatting) |
| Key | `ANTHROPIC_API_KEY` |
| Rate limits | Tier 1: 50 RPM for Sonnet, 100 RPM for Haiku — adequate for nightly batch |
| Error handling | 529 (overloaded) → retry with exponential backoff, max 3 retries; alert if all fail |
| Key rotation | Rotate quarterly; update Render env var; no code change required |
| Context window | Sonnet 200K tokens — more than sufficient for synthesis over 30 days of signals |

### 7.5 SEOwind

| Item | Detail |
|---|---|
| Plan | Pro ($219/month) |
| Integration | Path A: REST API (`SEOWIND_API_KEY`); Path B: Playwright fallback |
| Known risk | Public API surface as of May 2026 is limited; Path B may be required at launch |
| Brand Voice ID | `SEOWIND_BRAND_VOICE_ID` — one-time setup by Hassan before first draft |
| Error handling | API 5xx → retry once after 30s; Path B script failure → alert Hassan |
| Fallback threshold | If Path B breaks due to UI change and cannot be fixed within 48h, pause drafting and alert Hassan |

### 7.6 Clearscope

| Item | Detail |
|---|---|
| Plan | Essentials |
| Integration | REST API if available at plan tier; manual fallback via `/set_clearscope_score` Telegram command |
| Key | `CLEARSCOPE_API_KEY` |
| Threshold | Score ≥ 80 required |
| Error handling | API unavailable → send Telegram manual-score request; wait for `/set_clearscope_score` reply |

### 7.7 Sanity

| Item | Detail |
|---|---|
| Project | SAME project as main `NexFortis-Website-Design-pro` site |
| Dataset | `production` |
| Write token | Scoped to `post` document type only (`SANITY_WRITE_TOKEN`) |
| API version | `2021-06-07` |
| Webhook secret | `SANITY_WEBHOOK_SECRET` — set in Sanity dashboard |
| Rate limits | Free tier: 100K API requests/month; pipeline uses ~30–50/month |
| Idempotency | Check `drafts.sanity_doc_id IS NOT NULL` before pushing; skip if already pushed |

### 7.8 Medium

| Item | Detail |
|---|---|
| Integration | Manual — Hassan uses Medium Import Tool at medium.com/p/import |
| Automation | Reminder dispatched via Inngest 14 days after publish; Hassan performs the import |
| Canonical | Medium's Import Tool auto-sets canonical to the source URL; no additional configuration needed |
| Full API | Not available for programmatic article creation in a maintainable form; v3 upgrade path |

### 7.9 Inngest

| Item | Detail |
|---|---|
| Plan | Free tier (10K function runs/month; adequate for projected volume) |
| Events key | `INNGEST_EVENT_KEY` |
| Signing key | `INNGEST_SIGNING_KEY` |
| Dev server | `npx inngest-cli@latest dev` — used locally for testing |
| Crons | All crons defined in their respective artifact's `index.ts` |
| Retry policy | Default: 3 retries with exponential backoff |
| Step granularity | Use `step.run()` for every discrete operation to enable retry at step level |

---

## 8. Environment Variables — Complete List

All variables set in Render's environment variable panel per service. Never in code, never in `.env` files committed to git.

### Shared Across All Services

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (not anon) |
| `ANTHROPIC_API_KEY` | Claude API key |
| `TELEGRAM_BOT_TOKEN` | grammY bot token |
| `TELEGRAM_CHAT_ID` | Hassan's personal chat ID |
| `INNGEST_EVENT_KEY` | Inngest event signing key |
| `INNGEST_SIGNING_KEY` | Inngest signing key |
| `NODE_ENV` | `production` |

### capture-worker

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | For embeddings |
| `OPENAI_ORG_ID` | OpenAI org ID |
| `MSGRAPH_CLIENT_ID` | Azure app client ID |
| `MSGRAPH_CLIENT_SECRET` | Azure app client secret |
| `MSGRAPH_TENANT_ID` | Azure tenant ID |
| `MSGRAPH_REFRESH_TOKEN` | Delegated auth refresh token (rotate quarterly) |
| `CLAUDE_EXPORT_DROP_PATH` | Absolute path to Claude export watch folder |
| `PERPLEXITY_EXPORT_DROP_PATH` | Absolute path to Perplexity export watch folder |

### telegram-bot

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | For Whisper transcription |

### gate-worker

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | For Stage C Custom GPT API attempt |
| `SEOWIND_API_KEY` | SEOwind Pro API key |
| `SEOWIND_BRAND_VOICE_ID` | Pre-trained brand voice profile ID |
| `CLEARSCOPE_API_KEY` | Clearscope API key |

### sanity-bridge

| Variable | Description |
|---|---|
| `SANITY_PROJECT_ID` | Sanity project ID |
| `SANITY_DATASET` | Sanity dataset (`production`) |
| `SANITY_WRITE_TOKEN` | Scoped write token |
| `SANITY_WEBHOOK_SECRET` | Webhook signature secret |
| `NEXT_REVALIDATE_SECRET` | Secret for main site's `/api/revalidate` endpoint |
| `NEXFORTIS_SITE_URL` | `https://nexfortis.com` |
| `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` | Base64-encoded service account JSON |

---

## 9. Secrets Handling

1. **Never commit secrets to git.** The `.env.example` file in the repo root contains placeholder values only (e.g., `SUPABASE_URL=your_supabase_url_here`). `.env` and `.env.local` are in `.gitignore`.

2. **Render env vars** are the production secret store. Each service has its own env var panel. No cross-service env var inheritance (set each variable explicitly per service).

3. **Local development:** Copy `.env.example` to `.env` and populate values. Never share `.env` files. Use the Inngest dev server (`npx inngest-cli@latest dev`) for local function testing.

4. **Refresh token rotation:** `MSGRAPH_REFRESH_TOKEN` must be rotated quarterly. Calendar reminder: first Monday of each quarter, Hassan updates the Render env var. The token is not code; no PR required.

5. **Implementer guardrail:** Every Cursor agent / Claude Code prompt explicitly states: "Do not log, print, or expose the values of any environment variable. Do not hard-code any secret value. If you need a secret, reference it via `process.env.VARIABLE_NAME`. This requirement is also enforced in `AGENTS.md` and `.cursorrules`."

6. **Service account keys:** The Google Indexing API service account JSON is base64-encoded before being stored as an env var. The `indexing-api.ts` integration decodes it at runtime. The raw JSON file is never committed.

---

## 10. Observability

### Logging

- Library: `pino` (from `lib/logger/`) across all services.
- Log level: `info` in production, `debug` locally.
- Every Inngest function run logs: function ID, trigger, step names, duration, exit status.
- Every ingestion run logs: source, `signals_fetched`, `signals_new`, `signals_skipped_duplicate`, `signals_blocked_pii`, errors.
- Every gate run logs: draft ID, rules evaluated, pass/fail per rule, Stage B score.

### Error Reporting

- Library: Sentry (`@sentry/node`).
- DSN stored as `SENTRY_DSN` env var.
- Unhandled exceptions and Inngest step failures are captured automatically.
- PII must not appear in Sentry events. The Sentry `beforeSend` hook scrubs email addresses and the standard PII patterns before transmission.

### Key Metrics to Track (Manual Dashboard v2; Automated v2.1)

| Metric | Source | Check Frequency |
|---|---|---|
| `capture_signals` row count | Supabase | Weekly |
| Distinct sources in last 7 days | Supabase query | Weekly |
| `article_candidates` count by status | Supabase | Weekly |
| Bot session completion rate | `interview_sessions` count by status | Weekly |
| Gate A pass rate | `drafts` count by status | Monthly |
| Clearscope average score | `drafts.clearscope_score` avg | Monthly |
| Published articles count | `published_articles` | Monthly |

---

## 11. Security & Privacy

### PII Redaction

Two-pass process (full spec in F1 PRD §6.3):
1. Regex pass: emails, phone numbers, SINs, credit cards, IPs.
2. Claude Haiku scrub: named entities (person names, company names, addresses).

`raw_text` is stored for Hassan's manual review only. `redacted_text` is what gets embedded and surfaced in articles. The separation is enforced at the application layer. No Postgres RLS rules in v2 (RLS hardening is a v2.1 task).

### Family-Law / Personal Content Hard Blocklist

The following sources are **permanently and unconditionally excluded** from the corpus, enforced at the ingestion layer before any processing:

- All emails from legal counsel email addresses (stored as hashed values in `source_filters.blocklist_patterns`)
- All emails from family-law mediator email addresses (same)
- All email subjects matching the regex: `/(custody|mediator|settlement|family court|divorce|separation agreement)/i`
- All emails from or to the blocklisted addresses, regardless of subject

These rules are hardcoded in `lib/redaction/blocklist.ts` and cannot be disabled via the `source_filters` table. The `source_filters` table controls Tier 1/2 source toggling; it cannot override the family-law blocklist. This is a code-level constraint, not a configuration constraint.

The specific email addresses are never stored in plaintext anywhere in the system — only as SHA-256 hashes in the blocklist, compared against SHA-256 hashes of incoming addresses.

### Data Retention

- `capture_signals`: kept indefinitely unless soft-deleted (`is_deleted = true`).
- `synthesis_clusters`, `article_candidates`, `interview_sessions`, `drafts`: kept indefinitely for audit trail.
- `published_articles`: kept indefinitely.
- Soft-delete only in v2. Hard-delete is a future admin endpoint.
- No automatic purge policy in v2. If corpus size becomes a concern (> 1 million rows), a purge policy is a v2.1 decision.

### Access Control

- Only one user interacts with this system: Hassan.
- Supabase service role key grants full DB access — treated as a root credential. Never exposed to clients.
- Telegram bot responds only to `TELEGRAM_CHAT_ID`. All other chat IDs receive no response.
- Sanity write token is scoped to `post` document type.
- Google service account is scoped to `indexing.googleapis.com` only.
