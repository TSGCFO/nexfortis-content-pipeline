# Implementation Roadmap — NexFortis Content Pipeline v2

**Document Owner:** Hassan Sadiq, NexFortis  
**Parent Epic:** [NexFortis Automated Content Pipeline v2](./epic-prd.md)  
**Status:** Production Spec — implementation in progress (see Implementation Status below)  
**Version:** 1.1  
**Created:** May 10, 2026  
**Updated:** June 12, 2026  
**Audience:** Hassan Sadiq, Cursor agents + Claude Code (prompt recipients), Computer (prompt author)

---

## Implementation Status (as of 2026-06-12)

This roadmap was written before implementation began; the repo has since moved well past Prompt 1.
Shipped and tested (~80 test files, CI green through PR #38):

| Layer | State |
|---|---|
| Shared libs (`lib/db`, `lib/embeddings`, `lib/redaction`, `lib/logger`, `lib/shared-types`) | **Built** |
| `artifacts/capture-worker` — Claude Cowork ingest + MS Graph email ingest | **Built** (Perplexity + Teams ingesters not started) |
| `artifacts/synthesis-worker` — weekly clustering → candidate → Telegram preview | **Built** |
| `artifacts/telegram-bot` — interview session orchestration (confirmation / follow-up / closing / reminders) | **Built** |
| `tools/nfx-cowork-export` — laptop CLI | **Built** |
| `artifacts/gate-worker` — Stage A/B/C quality gates | **Stub** (empty `inngestFunctions`) |
| `artifacts/sanity-bridge` — Sanity push, approve webhook, ISR + Indexing API | **Stub** |
| SEOwind drafting automation (F3) | **Not started — approach under re-evaluation.** SEOwind's docs confirm the "Your Insights and Instructions" brief field exists as the F3 PRD assumed, but there is still no API; the Playwright-vs-human-in-the-loop-vs-direct-LLM-drafting decision is pending Hassan's call. |
| Social distribution, GEO tracking | Not started |

Operational notes: all Anthropic call sites default to `claude-fable-5` as of 2026-06-12
(`ANTHROPIC_MODEL` env override; earlier defaults referenced retired model ids that 404ed).
Before live email capture: install real blocklist hashes in `lib/redaction/src/blocklist.ts`
(placeholders match nothing, so the legal-counsel email-hash block is currently inert).

---

## How This Roadmap Works

Hassan copies a prompt (authored by Computer, stored in `./cursor-claude-prompt-library.md`) and pastes it into Cursor (cloud agent or local) or Claude Code. The implementer executes against the `nexfortis-content-pipeline` repo, opens a draft PR, and reports completion. Hassan and Computer review the PR; Hassan approves and merges. Computer authors the next prompt.

**Two tracks are documented below.** Choose one based on how much time Hassan can commit in the first 6 weeks.

- **Track 1 — Aggressive MVP (4–6 weeks):** Get an end-to-end article published by week 6. Some automation is manual or simulated. Designed for "prove it works" velocity.
- **Track 2 — Thorough Full v2 (12–16 weeks):** Build every component to spec, with observability, quality hardening, and full automation. Designed for sustained operation.

For most solo operators in Hassan's situation, **Track 1 is recommended first**, then transition to Track 2 hardening.

---

## Cursor Agent Prompt Template

Every prompt given to Cursor agents or Claude Code must follow this structure. The full prompt library (`./cursor-claude-prompt-library.md`) fills in each field for every task.

```
# Prompt N: <name>

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`.
Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- This prompt is part of a 15-prompt sequence implementing the NexFortis Content Pipeline v2.
- Decisions already made in prior prompts: [list relevant ones]
- Decisions coming in future prompts: [list relevant ones — IMPORTANT for "DO NOT pre-build" warnings]

**Objective:** [one sentence]

**Spec reference:** `[path to feature PRD section]`

**Allowed files (create or modify):** [explicit list]
**MUST NOT touch:** [explicit blocklist — e.g. "anything in lib/db unless this prompt names
  the table; anything in artifacts/ outside <target service>;
  everything in NexFortis-Website-Design-pro (separate repo)"]

**Dependencies allowed (pinned versions):**
- [package@version]

**Dependencies NOT allowed without explicit approval:**
- React, Vue, any UI framework (we're backend-only)
- ORM other than Drizzle
- Any package not in the allowed list above

**Edge cases to handle:** [explicit list — Cursor needs these spelled out]

**Type safety:**
- All exported types must be defined in `lib/shared-types` if shared
- Discriminated unions for all multi-state types
- No `any`. Use `unknown` then narrow.

**Error handling:**
- All async operations wrapped in try/catch
- Errors logged via `lib/logger` with `{ correlationId, source, action }` context
- Retry policy per integration: [spec]

**Tests required:**
- Path: `tests/<service>/<test-name>.test.ts`
- Assertions: [list]
- Coverage: critical happy path + at least 2 edge cases per requirement

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] No new `any` types
- [ ] Lint passes (`pnpm lint`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] No changes to files outside the allowed list
- [ ] PR opened with title matching convention
- [ ] PR description follows template in `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] No new dependencies installed outside the allowed list

**Out of scope (do NOT implement in this prompt):** [explicit list]
```

---

## Track 1 — Aggressive MVP (4–6 Weeks)

Goal: A real article published to nexfortis.com by end of week 6, with corpus grounding, journalist-mode interview, and manual quality gate. Some components will be simulated or manually operated; that is explicitly acceptable.

---

### Week 1: New Repo Scaffold + Database Foundation

**Objective:** The `nexfortis-content-pipeline` repo exists, has the correct pnpm workspace structure, and the Supabase tables are live.

**Deliverables:**
- GitHub repo `TSGCFO/nexfortis-content-pipeline` created (Hassan does this manually before running Prompt 1).
- pnpm workspace scaffold: all five artifact directories + all four lib directories with placeholder `package.json` files.
- `lib/db/schema.ts`: Drizzle schema for all 7 tables (`capture_signals`, `synthesis_clusters`, `article_candidates`, `interview_sessions`, `drafts`, `published_articles`, `source_filters`).
- pgvector enabled on the shared Supabase project (Hassan does this manually in Supabase dashboard → Extensions).
- Drizzle migration run: tables exist in production Supabase.
- Hello-world Inngest function in `artifacts/capture-worker/` that runs and logs "capture-worker alive".
- `AGENTS.md` at repo root: purpose, architecture summary, conventions, pointers to key decisions.
- `.cursorrules` at repo root: no auto-formatting outside scope, no unsolicited refactors, no changes outside allowlist, mandatory test additions, PR description template, no dependency upgrades without permission.
- `.env.example` with all variables from architecture spec §8.
- `README.md` with setup instructions.
- GitHub Actions CI workflow: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` on every PR.

**Acceptance Criteria:**
- `pnpm -r build` succeeds with no TypeScript errors.
- `pnpm test` passes (hello-world Inngest function test).
- Supabase Studio shows all 7 new tables.
- Inngest dev server shows the hello-world function registered.
- `AGENTS.md` and `.cursorrules` present at repo root.

**Prompt:** See Prompt 1 in `./cursor-claude-prompt-library.md`. Run the Cursor agent scaffold prompt against the empty repo Hassan created.

**Hassan's setup tasks before Week 1 prompt:**
1. Create empty GitHub repo `TSGCFO/nexfortis-content-pipeline`.
2. Enable pgvector in Supabase dashboard.
3. Create a Sanity write token scoped to `post` document type.
4. Populate `.env` with real values after the implementer creates `.env.example`.

---

### Week 2: Claude Export Ingester + Embeddings

**Objective:** Hassan can drop a Claude monthly export file into a watched folder, and the capture worker ingests, redacts, chunks, and embeds it into `capture_signals`.

**Deliverables:**
- `artifacts/capture-worker/src/jobs/ingest-claude.ts`: parse Claude export JSON, deduplicate, redact, chunk, embed.
- `lib/redaction/`: regex redaction pass (Pass 1).
- `lib/embeddings/chunker.ts`: 500–800 token chunker with 100-token overlap.
- `lib/embeddings/openai.ts`: embedding wrapper with rate limiting.
- First real ingestion: Hassan drops his most recent Claude export; ≥50 signals embedded.

**Acceptance Criteria:**
- Unit test: given a fixture Claude export JSON, produces the expected number of `capture_signals` rows.
- Unit test: email addresses in raw_text are replaced with `[EMAIL]` in redacted_text.
- Unit test: duplicate source_id is skipped without error.
- Integration: after running against a real export, Supabase shows rows with non-null embeddings.

**Prompt:** See Prompt 2 in `./cursor-claude-prompt-library.md`.

---

### Week 3: Synthesis Cron + First Article Candidate

**Objective:** The Sunday synthesis cron clusters existing signals and produces ≥1 article candidate.

**Deliverables:**
- `artifacts/synthesis-worker/src/jobs/synthesize-weekly.ts`: cosine clustering, cluster labeling, pillar classification, article candidate generation.
- `lib/db/` queries: synthesis reads, article_candidates writes.
- First hand-reviewed candidate: Hassan inspects the output and confirms it looks like a real article topic.

**Acceptance Criteria:**
- Unit test: given 5 fixture signals with known cosine similarity > 0.72, the clustering produces 1 cluster.
- Integration: running the synthesis job against the real corpus produces ≥1 `article_candidates` row.
- The candidate's `pillar` is one of `["quickbooks", "managed-it", "cybersecurity"]`.
- Hassan reviews the candidate in Supabase Studio and confirms it is editorially usable.

**Prompt:** See Prompt 7 in `./cursor-claude-prompt-library.md`.

---

### Week 4: Telegram Bot + First Interview

**Objective:** The Telegram bot sends a topic preview and asks confirmation questions. Hassan completes his first interview session.

**Deliverables:**
- `artifacts/telegram-bot/` scaffold complete.
- Topic preview message sent Monday 8 AM (manually triggered in Week 4, scheduled automatically from Week 5).
- ≥3 confirmation questions generated by Claude Sonnet from real corpus signals.
- Hassan answers via voice and button; session reaches `completed` status.
- Voice transcription working (Whisper).

**Acceptance Criteria:**
- Unit test: state machine transitions from `preview_sent` → `confirming` → `completed` correctly.
- Integration: a completed `interview_sessions` row exists in Supabase with `confirmed_chunk_ids` populated.
- Voice note test: send a voice note, confirm transcript appears in `interview_sessions.answers` within 90 seconds.

**Prompt:** See Prompts 5 and 8 in `./cursor-claude-prompt-library.md`.

---

### Week 5: First Draft + Manual Quality Gate + Sanity Publish

**Objective:** A real draft article is produced, passes a manual quality check, and publishes to nexfortis.com.

**Deliverables:**
- Brief assembled by `brief-assembler.ts` + `insights-assembler.ts` from `confirmed_chunk_ids` (gate-worker stub may log the assembled `SEOwindBriefPayload` without running Playwright yet for Week 5 validation).
- Hassan generates the draft in SEOwind manually using the assembled brief as input — copy `insightsText` to clipboard and paste into the "Your Insights and Instructions" field in the SEOwind UI; toggle on Company Details; use AI Outline generation. Note: SEOwind has no API; Playwright automation comes in Track 2 Phase B Week 7.
- Stage A gate runs on the draft (automated).
- Stage B: Hassan scores manually in Clearscope, enters via `/set_clearscope_score` command.
- Stage C: Hassan runs Aleyda Solis GPT manually.
- Draft pushed to Sanity manually (or via gate-worker stub).
- Hassan approves in Sanity; article publishes to nexfortis.com.
- ISR revalidate and Indexing API ping fired.

**Acceptance Criteria:**
- Article is live at `nexfortis.com/blog/[slug]`.
- Schema markup valid (Google Rich Results Test).
- Hassan receives publish confirmation Telegram message.
- `published_articles` row exists in Supabase.

**Prompts:** See Prompts 10, 12, and 13 in `./cursor-claude-prompt-library.md`.

---

### Week 6: Retro + Hardening Decisions

**Objective:** Review what worked, what was rough, decide which Track 2 components to build first.

**Deliverables:**
- Written retro (Hassan + parent agent): what took longer than expected, what can be automated.
- Priority list for Track 2 components.
- MS Graph email ingester scheduled (Prompt 3).
- Second article started through the full pipeline.

**Acceptance Criteria:**
- ≥2 articles published.
- Capture corpus: ≥100 signals from ≥2 sources.
- All five Render services deployed and healthy.

---

## Track 2 — Thorough Full v2 (12–16 Weeks)

Goal: All components automated, hardened, and observable. Hassan's steady-state is ≤10 minutes/week. Publishing cadence reaches 5–6 articles/month by month 3.

---

### Phase A — Weeks 1–4: All Tier-1 Capture Sources Live

**Focus:** Capture layer is complete, automated, and observable. Brand voice profile trained.

| Week | Deliverable | Acceptance Criteria |
|---|---|---|
| 1 | Repo scaffold + DB (same as Track 1 Week 1) | All 7 tables live; hello-world Inngest function registered |
| 2 | Claude export + Perplexity export ingesters + redaction | ≥2 sources active; ≥100 signals embedded |
| 3 | MS Graph email ingester (Prompt 3) | IT-topic emails from past 30 days ingested; family-law blocklist verified |
| 4 | Teams transcripts ingester (Prompt 4); brand voice profile set up in SEOwind UI | All 4 Graph sources active; Hassan has manually created Brand Voice in SEOwind Projects tab (one-time UI setup — no env var for brand voice ID; brand voice is project-level and auto-applied, per knowledge map §4) |

**Prompt to give to Cursor agent (Week 3 example):**
```
# Prompt 6: MS Graph Email Ingester

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`.
Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- This is Prompt 6 in a 15-prompt sequence.
- Decisions already made: repo scaffold (Prompt 1), lib/db schema (Prompt 2),
  lib/redaction module (Prompt 3), lib/embeddings (Prompt 4),
  Claude export ingester (Prompt 5).
- Decisions coming in future prompts: Teams transcripts ingester (Prompt 7),
  Telegram voice capture (Prompt 8). DO NOT pre-build those.

**Objective:** Build the MS Graph email ingestion Inngest job that fetches
Hassan's IT-topic Outlook emails from the past 24 hours, applies the
redaction pipeline, chunks, and embeds into capture_signals.

**Spec reference:** `capture-synthesis-layer/prd.md §4.1 CS-03, §6.3, §6.4`

**Allowed files (create or modify):**
- `artifacts/capture-worker/src/jobs/ingest-msgraph-email.ts` (create)
- `artifacts/capture-worker/src/integrations/msgraph.ts` (create)
- `artifacts/capture-worker/src/index.ts` (add new function registration only)
- `lib/redaction/blocklist.ts` (add subject regex check)

**MUST NOT touch:**
- `lib/db/schema.ts`
- `lib/redaction/regex-pass.ts` (read only)
- `lib/embeddings/` (read only)
- Anything in `NexFortis-Website-Design-pro` (separate repo)
- `artifacts/synthesis-worker/`, `artifacts/telegram-bot/`, `artifacts/gate-worker/`,
  `artifacts/sanity-bridge/`

**Dependencies allowed (pinned versions):**
- `@microsoft/microsoft-graph-client@3.0.7`
- `@azure/msal-node@2.7.0`

**Edge cases to handle:**
- Email from a blocklisted sender address: skip before any processing, log as blocked.
- Email subject matching family-law regex `/(custody|mediator|settlement|family court|
  divorce|separation agreement)/i`: skip before any processing.
- Email already in capture_signals (duplicate source_id): skip without error.
- MS Graph returns 429: exponential backoff, max 5 retries.
- MS Graph returns 401: refresh the token, retry once, then alert via Telegram.
- Empty inbox (0 new emails): complete successfully, log 0 signals fetched.

**Type safety:**
- All exported types in `lib/shared-types` if shared.
- Discriminated union for `IngestionResult` (success | blocked | duplicate | error).
- No `any`. Use `unknown` then narrow.

**Error handling:**
- All async operations wrapped in try/catch.
- Errors logged via `lib/logger` with `{ correlationId, source: 'msgraph_email', action }`.
- Graph API errors: log structured error and continue to next email (don't abort the whole job).

**Tests required:**
- Path: `artifacts/capture-worker/src/__tests__/ingest-msgraph-email.test.ts`
- Assertions: emails from blocklisted senders return 0 rows; family-law subject regex
  blocks correctly; valid IT email is chunked and produces ≥1 capture_signals row;
  duplicate source_id is skipped without error.

**Definition of Done:**
- [ ] Unit tests pass with fixture email data (`pnpm test`)
- [ ] No new `any` types (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Blocklist check confirmed: blocklisted address → 0 rows
- [ ] Subject regex confirmed: "custody" in subject → 0 rows
- [ ] No changes to files outside the allowed list
- [ ] Draft PR opened, description follows `.github/PULL_REQUEST_TEMPLATE.md`

**Out of scope (do NOT implement in this prompt):**
- Teams transcripts (Prompt 7)
- Perplexity ingester (already done in Prompt 5)
- Any changes to synthesis-worker, telegram-bot, gate-worker, sanity-bridge
```

---

### Phase B — Weeks 5–8: Journalist-Mode Bot + First 5 Articles

**Focus:** Interview bot is fully automated with retrieved context. First 5 articles drafted and published.

| Week | Deliverable | Acceptance Criteria |
|---|---|---|
| 5 | Telegram bot confirmation questions with real corpus retrieval (Prompt 8) | Bot sends context-grounded questions; no generic questions |
| 6 | Voice transcription pipeline hardened; Sunday→Monday session scheduling automated | Sessions open at 8 AM Eastern without manual trigger |
| 7 | SEOwind Playwright automation (Prompt 9) — Playwright is the only integration path; there is no API | Brief assembled by `brief-assembler.ts` + `insights-assembler.ts`; delivered to SEOwind UI by `seowind-playwright.ts` (login → create brief modal → async wait 1–4 min → fill insights textarea → generate article → async wait 10–15 min → extract from AI Editor DOM). Per knowledge map §12.4: SEOwind has no REST API, GraphQL, webhook, Zapier, Make.com, or n8n integration. |
| 8 | First 5 articles drafted, gate A running, Sanity pipeline working | 5 articles published; ≥3 corpus citations each |

**Phase B Definition of Done:**
- Bot completion rate ≥90% for all 5 test sessions.
- Average session duration ≤10 minutes (from Telegram logs).
- All 5 articles pass Gate A on first attempt.
- ≥3 confirmed corpus chunks in each published article's `corpus_citations`.

---

### Phase C — Weeks 9–12: Quality Gate Hardened + Full Automation

**Focus:** All 3 quality gate stages functional. Clearscope integration. Sanity approve webhook end-to-end.

| Week | Deliverable | Acceptance Criteria |
|---|---|---|
| 9 | Stage A all 8 rules automated; structured error messages (Prompt 10) | 0% false positives on 10-article sample |
| 10 | Stage B Clearscope integration (Prompt 11); rewrite loop | Gate B pass rate ≥70% first try |
| 11 | Sanity bridge: approve webhook → ISR revalidate → Indexing API (Prompt 12) | Approve-to-live latency ≤2 minutes |
| 12 | Social distribution queue; Medium 14-day reminder (Prompt 13) | Every published article queued in Missinglettr within 1 hour |

**Phase C Definition of Done:**
- Hassan's weekly time ≤10 minutes (measured across 3 consecutive weeks).
- Gate A pass rate ≥85%.
- Gate B pass rate ≥70%.
- Approve-to-live ≤2 minutes.
- Social posts scheduled for 100% of published articles.

---

### Phase D — Weeks 13–16: GEO Tracking + Tier-2 Sources + Retro

**Focus:** Measurement, distribution expansion, Tier-2 capture sources, v2.1 backlog.

| Week | Deliverable | Acceptance Criteria |
|---|---|---|
| 13 | GEO tracking setup (Otterly or Semrush AI Visibility Toolkit) (Prompt 14) | NexFortis tracked across ≥10 LLM prompts |
| 14 | Medium auto-import reminder automation verified; Cursor history Tier-2 ingester (if Cursor exports available) | Medium import reminded for every article; Tier-2 source adds ≥20 signals/month |
| 15 | Perplexity Spaces full API integration if available; otherwise document as deferred | Tier-1 sources all automated |
| 16 | Full retro; v2.1 backlog written; GSC report reviewed | Publishing cadence ≥5/month; positive GSC impression trend |

**Phase D Definition of Done (v2 complete):**
- All Epic PRD success criteria (SC1–SC7) measured.
- v2.1 backlog written and prioritized.
- Hassan reports ≤10 minutes/week for 3+ consecutive months.

---

## Cursor Agent: Which Files to Read

Every Cursor agent / Claude Code prompt should end with:

```
For full technical spec, read:
- [relevant Feature PRD path]  §[section number]
- architecture-and-data-model.md §[section number]
- cursor-claude-prompt-library.md Prompt [N] (this prompt)
- AGENTS.md (repo-level behavioral constraints)

Do not read other documents in this repo unless explicitly listed above.
Do not read any file in NexFortis-Website-Design-pro.
```
