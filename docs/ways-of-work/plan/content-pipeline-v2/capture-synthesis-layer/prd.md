# Feature PRD — Continuous Capture & Synthesis Layer (F1)

**Document Owner:** Hassan Sadiq, NexFortis  
**Parent Epic:** [NexFortis Automated Content Pipeline v2](../epic-prd.md)  
**Status:** Production Spec — Ready for Implementation  
**Version:** 1.0  
**Created:** May 10, 2026  
**Audience:** Hassan Sadiq, Cursor agents / Claude Code (primary implementer), Computer (orchestrator), future contractors

---

## Table of Contents

1. [Goal](#1-goal)
2. [User Personas](#2-user-personas)
3. [User Stories](#3-user-stories)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Specifications](#6-technical-specifications)
7. [AI System Requirements](#7-ai-system-requirements)
8. [Acceptance Criteria](#8-acceptance-criteria)
9. [Out of Scope](#9-out-of-scope)

---

## 1. Goal

### Problem

Hassan produces hundreds of tokens of genuine technical expertise every week — inside Claude conversations, Perplexity research threads, Microsoft 365 email replies, Teams call transcripts, and voice notes. As of v1, none of this is captured. Each article starts cold, relying entirely on whatever Hassan can summon on a given Monday morning. The result is content that sounds like an IT consultant but lacks the specific evidence — exact error codes, real client configurations, specific timelines — that Google's information gain scoring and human readers actually reward.

### Solution

Build a continuous, nightly ingestion pipeline that captures the raw material Hassan is already producing and converts it into a searchable, embeddable corpus in Supabase. Every piece of content he generates in his normal workflow becomes a potential evidence source for future articles. A nightly synthesis job clusters signals into article candidates and surfaces them to the journalist-mode interview bot every Sunday night.

### Impact

| Outcome | How Measured | Target |
|---|---|---|
| Capture corpus grows organically | Supabase `capture_signals` row count | ≥200 new signals/month by month 2 |
| All Tier-1 sources are active | Distinct `source` values in `capture_signals` | 5 unique sources |
| Synthesis surfaces usable candidates | Manual sampling of `article_candidates` table | ≥80% of candidates are editorially usable |
| Hassan's input is protected | PII audit of stored records | Zero unscrubbed client names or emails in `redacted_text` |

---

## 2. User Personas

### Hassan Sadiq — Content Owner

Solo operator. He does not interact with this feature directly — it runs invisibly in the background during his normal workday. He needs confidence that: (a) only the sources he has authorized are being captured, (b) personal/family-law content is impossible to enter the corpus, and (c) he can toggle any source off without touching code.

### Cursor Agents / Claude Code — Primary Implementer

Receives structured prompts authored by Computer and pasted in by Hassan. Operates inside the **`nexfortis-content-pipeline` repository** — a separate repo from the main NexFortis monorepo (`NexFortis-Website-Design-pro`). Must not read, modify, or reference files in the main monorepo. Must not deviate from the Supabase schema or Inngest cron setup defined in this document. Each prompt includes an explicit allowlist of files it may touch, a blocklist of files it must not touch, pinned dependencies, required tests, edge cases to handle, and a Definition of Done checklist. The implementer (Cursor agent / Claude Code) opens draft PRs; it does not merge. Respects `AGENTS.md` and `.cursorrules` reliably as stable system-prompt injection.

### Future Contractor

May be handed a single ingester to build (e.g., Teams transcripts). Must be able to understand their scope without reading the entire monorepo. This PRD is designed to be self-contained for that purpose.

---

## 3. User Stories

**US-F1-01 — Passive capture (happy path)**  
As Hassan, I want my Claude conversations from the past month to be automatically ingested into the corpus each time I export them, so that every piece of technical thinking I've done with Claude is available as evidence for future articles — without any manual action on my part.

**US-F1-00 — Implementer clarity (Cursor agent / Claude Code)**  
As the implementer (Cursor agent / Claude Code) receiving a prompt for this feature, I want acceptance criteria expressed as testable Given/When/Then statements, an explicit list of files I may create or modify, and an explicit blocklist of files I must not touch, so I can verify completion without ambiguity and stay within the assigned scope.

**US-F1-02 — Source toggle**  
As Hassan, I want to be able to toggle any capture source off (e.g., pause MS Graph email ingestion) by changing a single value in a config table, so that I don't have to redeploy code to disable a source if something sensitive is coming through.

**US-F1-03 — PII safety**  
As Hassan, I want every signal to go through a redaction step before its embedding is stored, so that a client's name, company name, or email address cannot be retrieved via a vector search and injected into an article without my knowledge.

**US-F1-04 — Family-law hard block**  
As Hassan, I want all content from my legal-counsel email addresses and family-law inbox folders to be permanently excluded from ingestion at the source filter level — not just redacted but never ingested at all — so that there is zero risk of custody or mediation context entering the content corpus.

**US-F1-05 — Duplicate detection**  
As the pipeline system, when the same conversation appears in both a Claude monthly export and a Telegram capture (e.g., a voice note where Hassan summarizes a Claude session), I want the system to detect the overlap and keep only one canonical version, so that the synthesis job does not over-weight topics that happen to appear in multiple sources.

**US-F1-06 — Sunday synthesis surfaces actionable candidates**  
As Hassan, I want the Sunday-night synthesis job to produce ≥1 ranked article candidate per week by clustering recent signals, so that the journalist-mode bot always has a well-evidenced topic to ask about on Monday morning.

**US-F1-07 — Corpus pruning on demand**  
As Hassan, I want to be able to soft-delete a specific signal (e.g., a conversation that turned out to include client details I didn't want in the corpus) by setting `is_deleted = true` on its row in Supabase, so that it is excluded from future synthesis runs without permanently erasing the audit record.

**US-F1-08 — Edge case: Claude export format changes**  
As the pipeline system, if the Claude monthly export format changes (e.g., JSON schema updates), I want the ingester to fail loudly with a structured error and send a Telegram alert to Hassan, rather than silently importing malformed data into the corpus.

---

## 4. Functional Requirements

### 4.1 Capture Sources

| ID | Source | Ingestion Method | Tier | Toggle |
|---|---|---|---|---|
| CS-01 | Claude monthly export | File drop to `artifacts/capture-worker/data/imports/claude/` | 1 | `source_filters` table |
| CS-02 | Perplexity Spaces export | File drop to `artifacts/capture-worker/data/imports/perplexity/` | 1 | `source_filters` table |
| CS-03 | Microsoft Graph — Outlook email | Graph API, `mail.read` scope, filtered by `sentItems` + IT-topic inboxes | 1 | `source_filters` table |
| CS-04 | Microsoft Teams transcripts | Graph API, `callRecords.read.all` scope, auto-generated transcripts only | 1 | `source_filters` table |
| CS-05 | Telegram voice notes | Bot API webhook, audio files streamed to Whisper | 1 | Always on (bot-controlled) |
| CS-06 | Cursor conversation history | Cursor export; file drop | 2 (post-MVP) | `source_filters` table |
| CS-07 | Perplexity Spaces (full API) | Pending API availability | 2 (post-MVP) | `source_filters` table |

### 4.2 Ingestion Pipeline (per source)

For each enabled source, the ingestion job must:

1. **Fetch** raw content (file read or API call).
2. **Parse** into discrete conversation/document units. Each unit becomes one or more `capture_signals` rows.
3. **Deduplicate** against existing signals using `source_id` (hash of source + content fingerprint). Skip if already present.
4. **Redact PII** — run the redaction pipeline (§6.3) before storing any text.
5. **Blocklist check** — if the signal matches any entry in `source_filters.blocklist_patterns`, set `pii_status = 'blocked'` and do not proceed to embedding. Log the match.
6. **Chunk** the redacted text into 500–800 token segments with 100-token overlap (§6.4).
7. **Embed** each chunk using OpenAI `text-embedding-3-large` (§6.5).
8. **Store** each chunk as a row in `capture_signals` with full metadata.

### 4.3 Source Filters

The `source_filters` table controls what enters the corpus. Two categories:

**Allowlist:** Only ingest from these Graph API folders/addresses (IT-topic email labels, specific Teams meeting types).

**Blocklist patterns:** Hard-coded permanent exclusions that Hassan cannot accidentally disable. Includes:
- Email addresses of legal counsel (stored as hashed values — never logged in plaintext)
- Email addresses of family-law mediator(s) (same)
- Folder/label names that contain legal or family-law correspondence (e.g., `"Custody"`, `"Legal"`, `"Mediation"`, `"Settlement"`)
- Any email thread where subject line matches regex: `/(custody|mediator|settlement|family court|divorce|separation agreement)/i`

**Source toggle:** `source_filters.source_enabled` boolean per source. Setting it to `false` stops the next cron run from ingesting that source. No code change required.

### 4.4 Nightly Synthesis Job

Runs every Sunday at `0 2 * * 0` Eastern Time (`0 7 * * 0` UTC).

Steps:
1. Pull all `capture_signals` with `is_deleted = false` from the past 30 days.
2. Compute cosine similarity matrix across all signal embeddings (or use HDBSCAN for larger corpora; see §6.6).
3. Group signals into clusters where cosine similarity > 0.72 threshold.
4. For each cluster with ≥3 signals, generate a `synthesis_clusters` row: label, topic keywords (extracted by Claude Sonnet), SERP gap placeholder.
5. Score each cluster by: (a) number of signals, (b) recency weight, (c) pillar coverage (QB / Managed IT / Cybersecurity only — discard off-pillar clusters).
6. For the top-ranked cluster, generate an `article_candidates` row: primary keyword (derived from topic keywords), proposed title (descriptive, no superlatives), evidence chunk IDs.
7. Send a Telegram preview to Hassan: "This week's article candidate: [proposed title]. [N] signals found. Interview starts Monday morning."

### 4.5 Corpus Pruning Policy

- Records are kept indefinitely by default (`is_deleted = false`).
- Soft-delete: Hassan can set `is_deleted = true` on any row via a `/delete_signal <id>` Telegram bot command or directly in Supabase Studio.
- Soft-deleted rows remain in the table for audit purposes but are excluded from all synthesis and search queries via a `WHERE is_deleted = false` filter on every query.
- Hard-delete is out of scope for v2. A future admin endpoint can provide this.

---

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|---|---|---|
| NFR-01 | Ingestion job completes within time window | All Tier-1 sources ingested within 2 hours of cron trigger |
| NFR-02 | Embedding cost | <$15/month at projected volume (≤200 signals/month × avg 600 tokens/chunk × $0.13/1M tokens for embed-3-large) |
| NFR-03 | PII redaction coverage | ≥99% of obvious PII patterns (name, email, phone) caught by regex; LLM scrub as second pass |
| NFR-04 | Duplicate suppression rate | 0% of duplicate signals (same source_id) stored twice |
| NFR-05 | Synthesis job reliability | Retry up to 3 times on failure; alert Hassan via Telegram on 3rd failure |
| NFR-06 | Source toggle latency | Disabling a source takes effect at the next cron run (≤24h) |
| NFR-07 | Observability | Every ingestion run logs: source, signals_fetched, signals_new, signals_skipped_duplicate, signals_blocked_pii, errors |

---

## 6. Technical Specifications

### 6.1 Repository Placement

This feature lives in the **`nexfortis-content-pipeline`** repository (separate from the main `NexFortis-Website-Design-pro` monorepo). The capture worker and synthesis worker are split into two artifacts for deployment isolation:

```
nexfortis-content-pipeline/
  artifacts/
    capture-worker/          ← Inngest ingestion jobs (this feature)
      src/
        jobs/
          ingest-claude.ts
          ingest-perplexity.ts
          ingest-msgraph-email.ts
          ingest-msgraph-teams.ts
        index.ts             ← Inngest serve handler
    synthesis-worker/        ← nightly clustering + candidate gen (this feature)
      src/
        jobs/
          synthesize-weekly.ts
        index.ts
  lib/
    db/                      ← Drizzle schemas + Supabase client (new repo, SAME Supabase project)
      schema.ts              ← capture_signals, synthesis_clusters, article_candidates, source_filters
      client.ts
    embeddings/              ← OpenAI embed wrapper
    redaction/               ← PII regex + LLM scrub
    logger/                  ← pino + Sentry
    shared-types/            ← Article, Pillar, Author (inlined copy — see §6.1a)
```

**`lib/db` in this repo is NOT the `lib/db` from the main monorepo.** It is a new Drizzle schema layer that connects to the **same Supabase project** (same `SUPABASE_URL`, same `SUPABASE_SERVICE_ROLE_KEY`). New tables (`capture_signals`, `synthesis_clusters`, `article_candidates`, etc.) are added via migrations run against that shared project.

#### 6.1a Shared Types (Inlined Copy Policy)

A small number of type definitions must match between this repo and the main site repo (primarily `Pillar`, `Article`, `Author`). These are managed as an **inlined copy**: the type files in `lib/shared-types/` in this repo are manually kept in sync with their counterparts in the main monorepo's `lib/shared-types/`. The sync policy:
- Types change rarely (the Article schema is stable).
- When the main site changes a shared type, Hassan updates the copy here in the same PR.
- The files contain a header comment: `// INLINED COPY — keep in sync with NexFortis-Website-Design-pro/lib/shared-types/`.
- A published npm package (`@nexfortis/blog-types`) is the v3 upgrade path, not required for v2.

### 6.2 Inngest Cron Definitions

```typescript
// artifacts/capture-worker/src/jobs/ingest-claude.ts
export const ingestClaudeCron = inngest.createFunction(
  { id: "ingest-claude-export", name: "Ingest Claude Monthly Export" },
  { cron: "0 3 * * *" },  // 3 AM UTC daily
  async ({ step }) => { ... }
);

// artifacts/synthesis-worker/src/jobs/synthesize-weekly.ts
export const synthesizeWeeklyCron = inngest.createFunction(
  { id: "synthesize-weekly", name: "Weekly Synthesis Job" },
  { cron: "0 7 * * 0" },  // 2 AM Eastern = 7 AM UTC, Sunday
  async ({ step }) => { ... }
);
```

All Inngest functions must use `step.run()` for each discrete operation to enable retry granularity.

### 6.3 Redaction Pipeline

Two-pass process:

**Pass 1 — Regex redaction** (fast, deterministic):
```
Patterns to redact:
- Email addresses: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g → "[EMAIL]"
- Phone numbers (CA/US): /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g → "[PHONE]"
- SIN numbers: /\b\d{3}[-\s]\d{3}[-\s]\d{3}\b/g → "[SIN]"
- Credit card patterns: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g → "[CARD]"
- IP addresses: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g → "[IP]"
```

**Pass 2 — LLM scrub** (Claude Haiku for cost efficiency):
Prompt: "Identify and replace any remaining personal identifiers (person names, company names, addresses, account numbers) with [REDACTED]. Return only the cleaned text. Do not add commentary."

**Output:** Store both `raw_text` (pre-redaction, for Hassan's manual review only, never embedded) and `redacted_text` (post both passes, used for embeddings). Log each redaction event in `redaction_log` JSONB field.

### 6.4 Chunking Strategy

- Target chunk size: 500–800 tokens (measured with `tiktoken` using `cl100k_base` encoding, which matches `text-embedding-3-large`'s tokenizer).
- Overlap: 100 tokens between adjacent chunks.
- Split on: sentence boundaries where possible. Fallback: character boundary at 3000 chars.
- Minimum chunk size: 50 tokens. Discard shorter chunks.
- Each chunk stored as a separate row in `capture_signals`. All chunks from the same source document share a `source_id`.

```typescript
// lib/embeddings/chunker.ts  (shared lib, nexfortis-content-pipeline repo)
import { encoding_for_model } from "tiktoken";

export function chunkText(
  text: string,
  targetTokens = 650,
  overlapTokens = 100
): string[] { ... }
```

### 6.5 Embedding Strategy

- Model: `text-embedding-3-large` (OpenAI)
- Dimensions: 3072 (default; do not reduce — full dimensionality required for accurate cosine similarity at this corpus size)
- Distance metric: cosine (configured on the HNSW index in pgvector)
- Rate limiting: max 100 embed requests per minute; use exponential backoff on 429 errors
- Batching: embed up to 100 chunks per API call

```typescript
// lib/embeddings/openai.ts  (shared lib, nexfortis-content-pipeline repo)
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";
const EMBED_DIMENSIONS = 3072;
```

Environment variable: `OPENAI_API_KEY`, `OPENAI_ORG_ID`

### 6.6 Synthesis Clustering

For MVP (corpus < 2,000 signals): cosine similarity + threshold.

```typescript
// Pseudo-code for synthesis job
const signals = await getRecentSignals(30); // past 30 days
const clusters: Cluster[] = [];

for (let i = 0; i < signals.length; i++) {
  for (let j = i + 1; j < signals.length; j++) {
    const sim = cosineSimilarity(signals[i].embedding, signals[j].embedding);
    if (sim > 0.72) {
      mergeIntoClusters(clusters, signals[i], signals[j]);
    }
  }
}
```

For v2.1 (corpus > 2,000 signals): migrate to HDBSCAN via a Python sidecar or use pgvector's `<=>` operator with a materialized similarity view.

Cluster quality floor: discard any cluster with fewer than 3 signals. A cluster with 1–2 signals is a data point, not a pattern.

### 6.7 Pillar Classifier

Before a cluster enters `article_candidates`, it must be classified into one of the three pillars. Any cluster that cannot be confidently classified is discarded.

```typescript
// Pillar taxonomy
const PILLARS = ["quickbooks", "managed-it", "cybersecurity"] as const;

async function classifyPillar(topicKeywords: string[]): Promise<Pillar | null> {
  // Claude Haiku prompt: "Classify these keywords into one of: quickbooks, managed-it, cybersecurity.
  // If none fits, return null."
}
```

Off-pillar clusters are logged to an `off_pillar_discards` table for Hassan's review (future feature).

### 6.8 Environment Variables

| Variable | Description | Where Set |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key for embeddings + Whisper | Render env vars |
| `OPENAI_ORG_ID` | OpenAI organization ID | Render env vars |
| `ANTHROPIC_API_KEY` | Claude API key for synthesis + redaction LLM scrub | Render env vars |
| `SUPABASE_URL` | Supabase project URL | Render env vars |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (not anon key) | Render env vars |
| `MSGRAPH_CLIENT_ID` | Azure app registration client ID | Render env vars |
| `MSGRAPH_CLIENT_SECRET` | Azure app registration secret | Render env vars |
| `MSGRAPH_TENANT_ID` | Azure tenant ID (Hassan's M365 tenant) | Render env vars |
| `MSGRAPH_REFRESH_TOKEN` | Long-lived refresh token for delegated access | Render env vars — rotate quarterly |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather | Render env vars |
| `TELEGRAM_CHAT_ID` | Hassan's personal chat ID with the bot | Render env vars |
| `INNGEST_EVENT_KEY` | Inngest event signing key | Render env vars |
| `INNGEST_SIGNING_KEY` | Inngest signing key | Render env vars |
| `CLAUDE_EXPORT_DROP_PATH` | Absolute path to Claude export drop folder | Render env vars |
| `PERPLEXITY_EXPORT_DROP_PATH` | Absolute path to Perplexity export drop folder | Render env vars |

---

## 7. AI System Requirements

### 7.1 LLM Usage Map

| Task | Model | Why |
|---|---|---|
| PII scrub (Pass 2) | Claude Haiku (latest) | Cost-effective; handles named entity recognition well |
| Synthesis cluster labeling | Claude Sonnet (latest) | Topic keyword extraction requires more nuance |
| Pillar classification | Claude Haiku (latest) | Simple classification; haiku is sufficient |
| Article candidate title generation | Claude Sonnet (latest) | Title quality matters; invest the compute here |
| Weekly Telegram preview message | Claude Haiku (latest) | Simple formatting task |

### 7.2 Evaluation Strategy

**Retrieval precision@10:** Monthly, Hassan manually reviews a random sample of 10 signals returned by a cosine similarity query for a given article topic. Target: ≥8 of 10 are topically relevant. If precision falls below 7/10 for two consecutive months, the chunking and embedding parameters are reviewed.

**Synthesis cluster quality:** Monthly, Hassan reviews all `article_candidates` from the past month. Target: ≥80% are editorially viable (he would be willing to write an article on the topic). Record and track.

**Redaction accuracy:** Quarterly, Hassan manually inspects 20 random `redacted_text` values for residual PII. Any failures trigger an immediate regex pattern update.

---

## 8. Acceptance Criteria

### AC-F1-01: Claude Export Ingestion

**Given** a valid Claude monthly export JSON file is placed in `$CLAUDE_EXPORT_DROP_PATH`,  
**When** the `ingest-claude-export` Inngest function runs,  
**Then:**
- Every conversation in the export is parsed into discrete turns.
- Each turn longer than 50 tokens is chunked and embedded.
- `capture_signals.source` is set to `"claude_export"`.
- `capture_signals.source_id` is set to a hash of `(conversation_id + turn_index)`.
- Duplicate `source_id` values are skipped without error.
- Blocked signals (matching `source_filters.blocklist_patterns`) are logged with `pii_status = 'blocked'` and not embedded.
- The file is moved to `$CLAUDE_EXPORT_DROP_PATH/processed/` after successful ingestion.

### AC-F1-02: MS Graph Email Ingestion

**Given** the MS Graph email ingester is enabled in `source_filters` and MS Graph credentials are valid,  
**When** the daily ingest cron runs,  
**Then:**
- Only emails from the past 24 hours from allowed folders are fetched.
- Emails from blocklisted sender addresses are skipped before any processing.
- Emails matching the family-law subject regex are skipped before any processing.
- Subject line + body are concatenated and passed through the redaction pipeline before embedding.

### AC-F1-03: PII Redaction

**Given** a raw signal text containing at least one email address and one person name,  
**When** the two-pass redaction pipeline runs,  
**Then:**
- The email address is replaced with `[EMAIL]` in `redacted_text`.
- The person name is replaced with `[REDACTED]` in `redacted_text`.
- `raw_text` retains the original unmodified text.
- `redaction_log` records each replacement with: type, character offset, replacement token.
- `pii_status` is set to `"redacted"`.

### AC-F1-04: Duplicate Detection

**Given** an ingestion job runs against a source that was already ingested yesterday,  
**When** the deduplication check runs,  
**Then:**
- Signals with a `source_id` already present in `capture_signals` are counted as `signals_skipped_duplicate` in the run log.
- No duplicate rows are inserted.
- The run does not error on duplicates.

### AC-F1-05: Sunday Synthesis

**Given** the `synthesize-weekly` cron fires at `0 7 * * 0 UTC`,  
**When** the synthesis job completes,  
**Then:**
- At least 1 `synthesis_clusters` row is created with `status = 'active'`.
- At least 1 `article_candidates` row is created referencing the top cluster.
- The candidate's `pillar` is one of `["quickbooks", "managed-it", "cybersecurity"]`.
- Hassan receives a Telegram message summarizing the candidate within 5 minutes of job completion.
- If no cluster meets the quality threshold (≥3 signals, cosine > 0.72), Hassan receives a Telegram alert: "Synthesis found no qualifying clusters this week. Consider adding more capture signals or lowering the threshold."

### AC-F1-06: Source Toggle

**Given** `source_filters.source_enabled` is set to `false` for `"msgraph_email"`,  
**When** the next daily cron runs,  
**Then:**
- The MS Graph email ingester is skipped entirely.
- The run log records `"msgraph_email": "disabled"`.
- No API calls are made to Microsoft Graph.

### AC-F1-07: Corpus Soft-Delete

**Given** Hassan sends `/delete_signal abc123` via Telegram,  
**When** the bot processes the command,  
**Then:**
- `capture_signals.is_deleted` is set to `true` for the row with `id = 'abc123'`.
- A confirmation message is sent to Hassan: "Signal abc123 soft-deleted. It will be excluded from future synthesis runs."
- The row remains in the table.
- The signal does not appear in any subsequent synthesis query.

---

## 8b. Shared Resources

This feature uses the following external systems that are **shared with the main `NexFortis-Website-Design-pro` monorepo**:

| System | Shared? | Notes |
|---|---|---|
| Supabase project | ✅ Yes — same project | New tables added via migrations; existing blog tables untouched |
| Microsoft Entra ID app registration | ✅ Yes — same app | MS Graph scopes (`mail.read`, `callRecords.read.all`) are additive; no existing scopes removed |
| OpenAI account | Recommended separate key, same account | Separate API key in Render env vars avoids rate-limit contention |
| Anthropic account | Recommended separate key, same account | Same rationale |
| Sanity project | ❌ Not used by this feature | Sanity is used by F3/F4 (quality gate and publish workflow) |
| Telegram bot | ✅ Yes — same bot token shared with F2 | One bot, multiple handlers |

---

## 9. Out of Scope

| Item | Rationale |
|---|---|
| Real-time (streaming) capture | Daily batch is sufficient; streaming adds significant complexity. Revisit in v2.1. |
| Capture of personal messages (SMS, WhatsApp, iMessage) | Out of pillar discipline. These are personal channels, not IT work channels. |
| Hard-delete of corpus records | Audit trail must be preserved. Soft-delete is sufficient for v2. |
| HDBSCAN clustering | Deferred until corpus exceeds 2,000 signals. Simple cosine threshold is sufficient for MVP. |
| Cursor conversation history (Tier-2) | Deferred to v2.1. File export format TBD. |
| Automated export triggering (Claude/Perplexity) | Both require manual export by Hassan. Automated export not currently available via API. |
| Multi-user corpus support | NexFortis is a solo operation. Multi-user is NG6 from Epic PRD. |
