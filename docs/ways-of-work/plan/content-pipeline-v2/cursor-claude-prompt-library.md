> ## ⚠️ HISTORICAL REFERENCE — DO NOT USE THESE PROMPTS DIRECTLY
>
> The prompts below were drafted at planning time to validate that the v2 architecture is implementable. They are **not** authoritative and are **not** the prompts that will be run against this repo.
>
> **How prompts actually work in this project:**
>
> 1. **Computer (the strategist AI)** reads the current repo state — what's merged, what's open, what each PR shipped, any `// TODO(hassan):` notes, any drift from spec.
> 2. **Computer picks the next task** based on real state, the roadmap, the Feature PRDs, and the architecture spec — not based on a pre-written list.
> 3. **Computer writes the prompt fresh in chat** with Hassan, tailored to the actual state of the repo at that moment. The prompt includes corrected file allowlists, references to what just merged, and edge cases informed by anything learned from the prior PR.
> 4. **Hassan copies the prompt** from the chat (Computer shares it as a file) and pastes it into Cursor or Claude Code.
> 5. **Cursor / Claude Code execute and open a PR.**
> 6. **Hassan and Computer review the PR**, merge or request changes.
> 7. **Repeat from step 1.**
>
> **Why this file remains:** It is preserved as historical reference for the rough shape and sequence of work. Anyone reading the spec can see the original prompt structure that was used to validate the architecture's implementability. The actual prompts that ship in PRs will differ — sometimes substantially — because real implementation surfaces real edge cases.
>
> **Do not copy-paste these prompts into Cursor.** Use them only as one input among many when Computer authors the next prompt fresh.

---

# Cursor / Claude Code Prompt Library — NexFortis Content Pipeline v2 (HISTORICAL REFERENCE)

**Document Owner:** Hassan Sadiq, NexFortis  
**Parent Epic:** [NexFortis Automated Content Pipeline v2](./epic-prd.md)  
**Status:** Historical reference — not authoritative. See banner above. Prompts are authored fresh per task in chat.  
**Version:** 1.0  
**Created:** May 10, 2026  
**Audience:** Hassan Sadiq (prompt executor), Computer (prompt author + QA), future contractors

---

## Introduction

### What This Is

This library contains 15 reusable prompts for Cursor agents (cloud or local) and Claude Code to implement the NexFortis Content Pipeline v2, one well-scoped task at a time. Each prompt is self-contained: it tells the implementer exactly what to build, which files it may touch, which files it must not touch, what edge cases to handle, what tests to write, and what "done" means.

The prompts are numbered 1–15 and intended to be run in sequence. Some can be run in parallel (noted where relevant). The full implementation sequence maps to the roadmap in `./implementation-roadmap.md`.

### How to Use This Library

1. Hassan opens the prompt for the current task.
2. He copies the full prompt text.
3. He pastes it into Cursor (cloud agent or local mode) or Claude Code, with the `nexfortis-content-pipeline` repo open.
4. The implementer executes the task, opens a draft PR, and reports completion.
5. Hassan and Computer review the PR. Hassan approves and merges if passing.
6. Computer authors the next prompt (or Hassan proceeds to the next numbered prompt in this library if already written).

**Never skip the review step.** Cursor agents and Claude Code follow precise instructions well, but the Definition of Done checklist and PR review are the safety net that catches any deviation.

### Why Prompts Are This Rigorous

Cursor agents and Claude Code follow precise instructions reliably — but they need that precision. Vague prompts produce drift: out-of-scope file changes, missing edge cases, unapproved dependencies. The prompts in this library are 300–600 words each because:

- **Edge cases must be spelled out.** Cursor does not infer "skip blocklisted emails" unless you say it.
- **Type safety must be required.** Without explicit instructions, `any` types accumulate and create maintenance debt.
- **File scope must be explicit.** An allowlist and blocklist in every prompt is what keeps the implementer inside bounds across 15+ sessions.
- **Forward context prevents pre-building.** Each prompt names what's coming next so the implementer doesn't speculatively implement future features.

### Key Constraint Files in the Repo

Two files govern all implementer behavior in `nexfortis-content-pipeline`. They are created in Prompt 1 and must not be overwritten:

- **`AGENTS.md`** — repo-level instructions: the purpose of this repo, the architecture, conventions (naming, error handling, logging patterns), and pointers to key decisions in the docs. Every prompt instructs the implementer to follow this file.
- **`.cursorrules`** — Cursor-specific behavioral rules:
  - No auto-formatting of files outside the prompt's explicit allowlist
  - No unsolicited refactors of existing code
  - No changes to any file not named in the prompt's allowed list
  - Mandatory test additions for every new function
  - PR description must follow `.github/PULL_REQUEST_TEMPLATE.md`
  - No dependency upgrades or additions without explicit permission

**Critical:** These files are stable. Cursor agents and Claude Code do not overwrite them. Hassan should not edit them in ways that conflict with the prompts in this library. If a convention needs to change, update `AGENTS.md` in a separate PR, then note the change in the next prompt's strategic context.

---

## Prompt Template

Every prompt in this library follows this structure:

```
# Prompt N: <name>

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`.
Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- This prompt is part of a 15-prompt sequence implementing the NexFortis Content Pipeline v2.
- Decisions already made in prior prompts: <list relevant ones>
- Decisions coming in future prompts: <list relevant ones — IMPORTANT for "DO NOT pre-build" warnings>

**Objective:** <one sentence>

**Spec reference:** `<path to feature PRD section>`

**Allowed files (create or modify):** <explicit list>
**MUST NOT touch:** <explicit list>

**Dependencies allowed (pinned versions):**
- <package@version>

**Dependencies NOT allowed without explicit approval:**
- React, Vue, any UI framework (we're backend-only)
- ORM other than Drizzle
- <etc.>

**Edge cases to handle:**
- <explicit list>

**Type safety:**
- All exported types must be defined in `lib/shared-types` if shared
- Discriminated unions for all multi-state types
- No `any`. Use `unknown` then narrow.

**Error handling:**
- All async operations wrapped in try/catch
- Errors logged via `lib/logger` with `{ correlationId, source, action }` context
- Retry policy per integration: <spec>

**Tests required:**
- Path: `tests/<service>/<test-name>.test.ts`
- Assertions: <list>
- Coverage: critical happy path + at least 2 edge cases per requirement

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] No new `any` types
- [ ] Lint passes (`pnpm lint`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] No changes to files outside the allowed list
- [ ] PR opened with title `<prefix>: <description>` matching `<convention>`
- [ ] PR description follows template in `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] No new dependencies installed outside the allowed list

**Out of scope (do NOT implement in this prompt):**
- <explicit list>
```

---

## The 15 Prompts

---

### Prompt 1: Initial Scaffold

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Read `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/*.mdc` before doing anything. These files **already exist and are strategist-authored** — you do NOT create or modify them in this prompt.

**Strategic context (do not deviate):**
- This is Prompt 1 of 15. No prior implementation exists.
- The repo already contains: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.cursor/rules/repo-conventions.mdc`, `.cursor/rules/prompt-discipline.mdc`, `.cursor/rules/context-files.mdc`, `.github/PULL_REQUEST_TEMPLATE.md`, `.editorconfig`, `.gitignore`, `.env.example`, `README.md`, and all planning docs under `docs/`. **Do not modify any of these.** They are the behavioral contract for this entire project. If you believe one is wrong, stop and add a `// TODO(hassan):` note in your PR description.
- This prompt creates the foundational pnpm workspace, build/test/CI infrastructure, and a hello-world Inngest function that every subsequent prompt depends on. Do not build any business logic — only the workspace skeleton.
- Decisions coming in future prompts: Drizzle schemas (Prompt 2), redaction module (Prompt 3), embeddings (Prompt 4), individual ingesters (Prompts 5–8), synthesis (Prompt 9), Telegram bot (Prompt 10), quality gate (Prompts 11–12), Sanity bridge (Prompt 13), distribution (Prompt 14), observability (Prompt 15). DO NOT pre-build any of these.

**Objective:** Create the pnpm workspace, root tooling (TypeScript config, Vitest, ESLint, Prettier), CI pipeline, package skeletons for the 5 artifacts and 5 lib modules, inlined shared-types files, and one passing hello-world Inngest function in `artifacts/capture-worker/`.

**Spec reference:** [`architecture-and-data-model.md`](../architecture-and-data-model.md) §1 (Overview), §4 (Service Topology), §8 (Environment Variables — reference only; the `.env.example` file already exists, do not modify).

**Allowed files (create or modify):**
- Workspace root tooling only:
  - `pnpm-workspace.yaml`
  - `package.json` (root, private, scripts: `build`, `typecheck`, `test`, `lint`, `format`)
  - `tsconfig.base.json`
  - `tsconfig.json` (workspace project references)
  - `.npmrc` (if needed for pnpm config)
  - `vitest.config.ts` (workspace-wide)
  - `eslint.config.mjs` (flat config)
  - `.prettierrc.json`
  - `.github/workflows/ci.yml`
- Per-package skeletons (each: `package.json`, `tsconfig.json`, `src/index.ts` placeholder):
  - `artifacts/capture-worker/` — plus a real hello-world Inngest function and a test
  - `artifacts/synthesis-worker/` (placeholder only)
  - `artifacts/telegram-bot/` (placeholder only)
  - `artifacts/gate-worker/` (placeholder only)
  - `artifacts/sanity-bridge/` (placeholder only)
  - `lib/db/` (empty placeholder — no schemas yet, deferred to Prompt 2)
  - `lib/embeddings/` (empty placeholder, deferred to Prompt 4)
  - `lib/redaction/` (empty placeholder, deferred to Prompt 3)
  - `lib/logger/` — implement: pino-based logger with `{ correlationId, source, action }` context, exported typed `Logger` interface, Sentry initialization gated on `SENTRY_DSN` env var
  - `lib/shared-types/` — create `article.ts`, `pillar.ts`, `author.ts` as inlined copies (see Edge cases below)
- `tests/capture-worker/hello-world.test.ts`

**MUST NOT touch:**
- `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, anything under `.cursor/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.editorconfig`, `.gitignore`, `.env.example`, `README.md`, anything under `docs/`. **These already exist and are strategist-authored.** If you spot something you think is wrong in any of them, stop and add a `// TODO(hassan):` note in your PR description. Do not edit the file.
- Anything in the `NexFortis-Website-Design-pro` repository — it is a separate repo and not accessible from here.
- No actual business logic. No Drizzle schemas, no API clients beyond Inngest's, no cron jobs beyond hello-world.

**Dependencies allowed (pinned versions — use these exact versions; if any is yanked, stop and ask):**
- `inngest@^3.22.0` (root + `artifacts/capture-worker`)
- `pino@^9.3.0` (`lib/logger`)
- `@sentry/node@^8.18.0` (`lib/logger`)
- `typescript@5.5.3` (root dev dep)
- `vitest@^2.0.0` (root dev dep)
- `@types/node@^22.5.0` (root dev dep; Node 22+)
- `tsx@^4.16.0` (root dev dep)
- `eslint@^9.7.0` (root dev dep)
- `@typescript-eslint/eslint-plugin@^8.0.0`, `@typescript-eslint/parser@^8.0.0` (root dev dep)
- `prettier@^3.3.0` (root dev dep)

**Dependencies NOT allowed without explicit approval:**
- React, Vue, Svelte, or any frontend framework (this is backend-only)
- Any database client — Drizzle is deferred to Prompt 2
- Any HTTP client library (use native `fetch`)
- Turbo, Nx, or any monorepo orchestrator beyond pnpm workspaces
- ts-node (use `tsx`)

**Edge cases to handle:**
- **`pnpm-workspace.yaml`** must declare both `artifacts/*` and `lib/*` as workspaces.
- **Node version pin:** add `"engines": { "node": ">=22.0.0", "pnpm": ">=10.0.0" }` to root `package.json`, and add a `preinstall` script that blocks `npm` and `yarn` (mirror the pattern from the main NexFortis monorepo).
- **Workspace project references:** root `tsconfig.json` uses `references: []` pointing to each package's `tsconfig.json`. Root `pnpm typecheck` runs `tsc --build`.
- **CI workflow** (`.github/workflows/ci.yml`) must run on `pull_request` and `push` to `main`. Steps: checkout, setup-node@v4 with `node-version: 22`, setup-pnpm@v4 with version 10, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. Fail the workflow if any step fails.
- **Inlined shared types:** `lib/shared-types/article.ts`, `pillar.ts`, `author.ts` must each begin with this exact header comment:
  ```
  // INLINED COPY — source of truth: TSGCFO/NexFortis-Website-Design-pro
  // When this type changes in the main repo, manually re-sync here.
  // Last synced: 2026-05-10
  ```
  For Prompt 1, define minimal interfaces: `Pillar = 'quickbooks' | 'managed-it' | 'cybersecurity'`; `Author = { id: string; name: string; bio: string; linkedinUrl?: string }`; `Article = { id: string; slug: string; title: string; pillar: Pillar; authorId: string; publishedAt: string | null }`. Future prompts will extend these.
- **Logger:** `lib/logger/index.ts` exports `createLogger(opts: { source: string }): Logger` returning a pino instance with bound `{ source }`. Sentry init runs at module load only if `process.env.SENTRY_DSN` is set; otherwise the module loads without error.
- **Hello-world Inngest function:** in `artifacts/capture-worker/src/index.ts`, register one function with id `hello-world` triggered by event `ping/hello`. It logs `"capture-worker alive"` via `lib/logger` and returns `{ ok: true }`. Errors are caught and re-thrown after logging.
- **No `.env` file is committed.** The `.env.example` exists already; CI provides env vars via repo secrets when needed.

**Type safety:**
- TypeScript `strict: true` in `tsconfig.base.json`. Also enable `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.
- All exports typed. No `any`. No `// @ts-ignore`.
- `Logger` interface is exported and used by the hello-world function.

**Error handling:**
- Hello-world Inngest function wraps its work in `try { ... } catch (err) { logger.error({ err }, 'hello-world failed'); throw err }`.
- Logger module catches Sentry init failure and logs a warning rather than crashing.

**Tests required:**
- Path: `tests/capture-worker/hello-world.test.ts`
- Assertions:
  - The hello-world Inngest function is registered with id `hello-world`.
  - Invoking the function's handler with a fake event returns `{ ok: true }`.
  - The logger is called with `source: 'capture-worker'` context.
- Use Vitest mocks for `lib/logger`; do not start a real Inngest server in tests.

**Definition of Done:**
- [ ] `pnpm install` runs clean with `--frozen-lockfile` failing only if the lockfile is missing (first run will create it)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (the one hello-world test)
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes
- [ ] All 5 `artifacts/*/package.json` files exist with correct `name`, `version`, `private: true`, and matching workspace pattern
- [ ] All 5 `lib/*/package.json` files exist
- [ ] `lib/shared-types/{article,pillar,author}.ts` exist with the sync header comment
- [ ] `lib/logger/index.ts` exports `createLogger` and a typed `Logger`
- [ ] `.github/workflows/ci.yml` runs typecheck + lint + test + build on PR and push to main
- [ ] **Zero modifications** to `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.cursor/**`, `.github/PULL_REQUEST_TEMPLATE.md`, `.editorconfig`, `.gitignore`, `.env.example`, `README.md`, or anything under `docs/`
- [ ] PR opened with title `Prompt 1: Initial Scaffold` and the PR description follows `.github/PULL_REQUEST_TEMPLATE.md`

**Out of scope (do NOT implement in this prompt):**
- Any Drizzle schema or database connection (deferred to Prompt 2)
- Any API client (OpenAI, Anthropic, Telegram, MS Graph, Sanity, SEOwind, Clearscope) — all deferred to their respective prompts
- Any actual ingestion, synthesis, gating, or distribution logic
- Any Render deployment configuration (deferred)
- Editing or improving any context/constraint file

---

### Prompt 2: lib/db Setup — Drizzle Schemas + Migrations

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompt 1 (scaffold) is complete. This prompt adds the database layer only.
- Decisions already made: pnpm workspace structure, lib/logger, shared-types.
- Decisions coming in future prompts: individual ingesters write to these tables (Prompts 5–8); synthesis reads and writes (Prompt 9); gate-worker writes `drafts` (Prompts 11–12); sanity-bridge writes `published_articles` (Prompt 13). DO NOT add any query logic beyond schema definition and the Drizzle client.

**Objective:** Define all 7 Drizzle schemas, enable pgvector, and run the initial migration against the shared Supabase project.

**Spec reference:** `architecture-and-data-model.md §5, §6`

**Allowed files (create or modify):**
- `lib/db/schema.ts` — all 7 table schemas
- `lib/db/client.ts` — Drizzle + Supabase client setup
- `lib/db/index.ts` — re-export
- `lib/db/package.json` — add drizzle-orm, drizzle-kit, postgres
- `lib/db/drizzle.config.ts`
- `lib/db/migrations/` — generated migration files
- `tests/db/schema.test.ts`

**MUST NOT touch:**
- Any file in `artifacts/`
- `lib/embeddings/`, `lib/redaction/`, `lib/logger/`, `lib/shared-types/`
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- `drizzle-orm@0.32.1`
- `drizzle-kit@0.23.0`
- `postgres@3.4.4`
- `@electric-sql/pglite@0.1.5` (for test fixtures only)

**Dependencies NOT allowed without explicit approval:**
- Prisma, TypeORM, or any other ORM
- `pg` (use `postgres` package, not `pg`)

**Edge cases to handle:**
- `capture_signals.embedding` column must be `VECTOR(3072)` — do not use a generic JSONB fallback.
- pgvector extension must be enabled via a raw SQL migration step: `CREATE EXTENSION IF NOT EXISTS vector;` — include this as the first migration file.
- HNSW index on `capture_signals.embedding` must be created with `m = 16, ef_construction = 64` as specified in the architecture doc.
- All 7 enum types (`pii_status_enum`, `cluster_status_enum`, `candidate_status_enum`, `session_status_enum`, `draft_status_enum`) must be defined as Postgres enums, not TypeScript string unions — Drizzle's `pgEnum` helper.
- The `drafts_updated_at` trigger must be included in the migration.
- Seed data for `source_filters` table (5 rows) must be in a separate seed script `lib/db/seed.ts` — not in the schema migration itself.

**Type safety:**
- Export a `DB` type from `lib/db/index.ts` for use in all other libs.
- All table insert and select types must be exported as `NewCaptureSigal`, `CaptureSignal`, etc. following Drizzle conventions.
- No `any`. Use Drizzle's inferred types.

**Error handling:**
- Database connection errors: throw with a descriptive message including the `SUPABASE_URL` host (not the full key).
- Migration failures: log the failing migration file name and the Postgres error before throwing.

**Tests required:**
- Path: `tests/db/schema.test.ts`
- Assertions: all 7 tables can be introspected after migration; `capture_signals` has an `embedding` column of type `vector`; inserting a row with a duplicate `source_id` throws a unique constraint error.
- Use `@electric-sql/pglite` for in-memory Postgres in tests. Do not run tests against the real Supabase project.

**Definition of Done:**
- [ ] `pnpm test` passes with in-memory database tests
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] All 7 tables defined in `lib/db/schema.ts`
- [ ] pgvector extension migration present as the first migration file
- [ ] HNSW index migration present
- [ ] `lib/db/seed.ts` creates the 5 `source_filters` rows
- [ ] No changes to files outside the allowed list
- [ ] PR opened: `feat(db): Drizzle schemas for all 7 tables + pgvector migration`

**Out of scope (do NOT implement in this prompt):**
- Any query helper functions (deferred to feature-specific prompts)
- Supabase Row Level Security (v2.1)
- Any ingestion logic

---

### Prompt 3: lib/redaction Module

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–2 complete. This prompt implements the redaction library used by all ingesters.
- Decisions already made: Drizzle schemas (Prompt 2).
- Decisions coming in future prompts: all ingesters (Prompts 5–8) will call `lib/redaction`. DO NOT build any ingester logic here.

**Objective:** Build the two-pass PII redaction pipeline and family-law hard blocklist in `lib/redaction/`.

**Spec reference:** `capture-synthesis-layer/prd.md §4.3, §6.3`; `architecture-and-data-model.md §11`

**Allowed files (create or modify):**
- `lib/redaction/regex-pass.ts` — Pass 1: deterministic regex redaction
- `lib/redaction/llm-scrub.ts` — Pass 2: Claude Haiku named entity scrub
- `lib/redaction/blocklist.ts` — family-law hard blocklist; SHA-256 hash comparison
- `lib/redaction/index.ts` — orchestrates both passes; exports `redactText`
- `lib/redaction/package.json` — add `@anthropic-ai/sdk`
- `tests/redaction/regex-pass.test.ts`
- `tests/redaction/blocklist.test.ts`
- `tests/redaction/integration.test.ts`

**MUST NOT touch:**
- `lib/db/`, `lib/embeddings/`, `lib/logger/`, `lib/shared-types/`
- Any file in `artifacts/`
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- `@anthropic-ai/sdk@0.24.3`

**Edge cases to handle:**
- Regex pass must handle: email addresses, Canadian/US phone numbers, SIN numbers, credit card patterns, IP addresses — see exact patterns in `capture-synthesis-layer/prd.md §6.3`.
- Blocklist comparison must use SHA-256 hashes of sender addresses — never store or log plaintext legal counsel emails.
- If Claude Haiku LLM scrub returns a non-200 response or times out after 10s, the function must **fail closed**: return `{ error: 'llm_scrub_failed', rawText }` — never return partially-scrubbed text as if it were clean.
- If the input text is empty or shorter than 10 characters, skip both passes and return `{ redactedText: input, redactionLog: [] }`.
- Redaction log must record: `{ type: 'EMAIL'|'PHONE'|'SIN'|'CARD'|'IP'|'LLM_ENTITY', offset: number, replacement: string }` for each replacement.
- Claude Haiku prompt must explicitly say: "Return only the cleaned text. Do not add commentary, headers, or explanations." If Claude adds anything other than cleaned text, strip the wrapper before returning.

**Type safety:**
- Export `RedactionResult` type: `{ redactedText: string; rawText: string; redactionLog: RedactionLogEntry[]; piiStatus: 'clean' | 'redacted' | 'blocked' }`
- Export `BlocklistCheckResult` type: `{ blocked: boolean; matchedPattern?: string }`
- No `any`.

**Error handling:**
- All async operations (Claude API call) wrapped in try/catch.
- On LLM failure: log via `lib/logger` with `{ correlationId, source: 'redaction', action: 'llm_scrub' }` and fail closed (do not proceed with unredacted text).

**Tests required:**
- `tests/redaction/regex-pass.test.ts`: email replaced with `[EMAIL]`; phone replaced with `[PHONE]`; IP replaced with `[IP]`; text with no PII returns unchanged; empty string handled.
- `tests/redaction/blocklist.test.ts`: SHA-256 hash of known blocklisted address returns `blocked: true`; unknown address returns `blocked: false`.
- `tests/redaction/integration.test.ts`: mock Claude Haiku; given text with email + person name, both are redacted; `raw_text` retains original; `redaction_log` contains 2 entries.

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] `pnpm typecheck` passes — no `any`
- [ ] `pnpm lint` passes
- [ ] Fail-closed behavior verified: mocked Claude 500 → function throws, does not return partial result
- [ ] Blocklist uses SHA-256 hashing — no plaintext legal email stored
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(redaction): two-pass PII redaction + family-law hard blocklist`

**Out of scope (do NOT implement in this prompt):**
- Integration with any ingester
- Chunking or embedding
- Any database writes

---

### Prompt 4: lib/embeddings Module

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–3 complete. This prompt adds the embeddings library.
- Decisions already made: redaction module (Prompt 3).
- Decisions coming in future prompts: all ingesters call `lib/embeddings` (Prompts 5–8); Whisper transcription is also in this module (used by Prompt 8 and 10). DO NOT build any ingester logic here.

**Objective:** Build the OpenAI `text-embedding-3-large` wrapper with token-aware chunking and rate limiting, plus the Whisper transcription helper.

**Spec reference:** `capture-synthesis-layer/prd.md §6.4, §6.5`; `journalist-mode-interview/prd.md §6.5`; `architecture-and-data-model.md §7.3`

**Allowed files (create or modify):**
- `lib/embeddings/chunker.ts` — 500–800 token chunker with 100-token overlap
- `lib/embeddings/openai.ts` — `text-embedding-3-large` wrapper + Whisper transcription
- `lib/embeddings/index.ts` — re-export
- `lib/embeddings/package.json` — add `openai`, `tiktoken`
- `tests/embeddings/chunker.test.ts`
- `tests/embeddings/openai.test.ts`

**MUST NOT touch:**
- `lib/db/`, `lib/redaction/`, `lib/logger/`, `lib/shared-types/`
- Any file in `artifacts/`
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- `openai@4.52.7`
- `tiktoken@1.0.15`

**Edge cases to handle:**
- Chunks shorter than 50 tokens must be discarded, not stored.
- Chunking must split on sentence boundaries where possible; fall back to character boundary at 3,000 chars if no sentence boundary found within range.
- Embedding batch size: max 100 chunks per OpenAI API call.
- Rate limiting: max 100 embed requests per minute; implement a token bucket or simple queue with exponential backoff on 429 errors.
- On OpenAI 429: retry with backoff starting at 1s, doubling, max 5 retries. On 5th failure: throw `EmbeddingRateLimitExhausted`.
- On OpenAI 500: retry once after 10s. If still failing: throw `EmbeddingServerError`.
- Whisper: if the audio file URL is unreachable (404 from Telegram CDN), throw `TranscriptionSourceError` — do not attempt to transcribe.
- `text-embedding-3-large` dimensions must be 3072 (do not pass the `dimensions` parameter to reduce — full dimensionality required per architecture spec).

**Type safety:**
- Export `Chunk` type: `{ text: string; tokenCount: number; startIndex: number; endIndex: number }`
- Export `EmbedResult` type: `{ chunks: Chunk[]; embeddings: number[][]; model: 'text-embedding-3-large' }`
- Export `TranscriptionResult` type: `{ transcript: string; durationSeconds?: number }`
- No `any`.

**Error handling:**
- All async operations wrapped in try/catch.
- Errors logged via `lib/logger` with `{ correlationId, source: 'embeddings', action: 'embed'|'transcribe' }`.

**Tests required:**
- `tests/embeddings/chunker.test.ts`: text of 1,200 tokens produces exactly 2 chunks with 100-token overlap; text of 40 tokens produces 0 chunks (below minimum); empty string produces 0 chunks.
- `tests/embeddings/openai.test.ts`: mock OpenAI client; `embedChunks` called with 150 chunks batches into 2 API calls; 429 response triggers retry; result has correct dimensions (3072).

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] `pnpm typecheck` passes — no `any`
- [ ] `pnpm lint` passes
- [ ] Chunk minimum size (50 tokens) enforced and tested
- [ ] Embedding dimensions are 3072 — no `dimensions` parameter override
- [ ] Rate limiting logic present and tested
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(embeddings): text-embedding-3-large wrapper + chunker + Whisper`

**Out of scope (do NOT implement in this prompt):**
- Any database writes
- Any ingester or capture logic
- Cosine similarity queries (deferred to synthesis-worker, Prompt 9)

---

### Prompt 5: capture-worker — Claude Export Ingester

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–4 complete. lib/db, lib/redaction, lib/embeddings are all available.
- Decisions already made: all library modules.
- Decisions coming in future prompts: MS Graph email (Prompt 6), Teams transcripts (Prompt 7), Telegram voice (Prompt 8). DO NOT build those here.

**Objective:** Build the Inngest job that reads a Claude monthly export JSON from the file drop folder, parses it, redacts, chunks, embeds, and inserts into `capture_signals`.

**Spec reference:** `capture-synthesis-layer/prd.md §4.1 CS-01, §4.2, §8 AC-F1-01`

**Allowed files (create or modify):**
- `artifacts/capture-worker/src/jobs/ingest-claude.ts` — Inngest function (create)
- `artifacts/capture-worker/src/parsers/claude-export.ts` — JSON parser (create)
- `artifacts/capture-worker/src/index.ts` — register new function
- `tests/capture-worker/ingest-claude.test.ts`
- `tests/capture-worker/parsers/claude-export.test.ts`

**MUST NOT touch:**
- `lib/` (read-only — import from it, do not modify)
- `artifacts/synthesis-worker/`, `artifacts/telegram-bot/`, `artifacts/gate-worker/`, `artifacts/sanity-bridge/`
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- None new — use `inngest`, `lib/db`, `lib/redaction`, `lib/embeddings`, `lib/logger` already installed.

**Edge cases to handle:**
- Claude export format change: if the top-level JSON structure doesn't match the expected shape (missing `conversations` key or wrong types), throw `ClaudeExportFormatError` with a structured message and send a Telegram alert via `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
- Duplicate `source_id`: if a chunk's `source_id` already exists in `capture_signals`, skip it without error. Log as `signals_skipped_duplicate`.
- Blocklist match: if a conversation matches `source_filters.blocklist_patterns`, set `pii_status = 'blocked'` and do not proceed to embedding. Log as `signals_blocked_pii`.
- Empty export: 0 conversations → complete successfully, log `signals_fetched: 0`.
- After successful ingestion, move the processed file to `$CLAUDE_EXPORT_DROP_PATH/processed/` — do not delete it.
- Very large exports (>1,000 conversations): process in batches of 100 using `step.run()` for each batch to avoid timeout.

**Type safety:**
- Define `ClaudeExportDocument` type from the known JSON shape. Use `unknown` initially and narrow.
- `IngestionRunLog` type: `{ source: string; signals_fetched: number; signals_new: number; signals_skipped_duplicate: number; signals_blocked_pii: number; errors: string[] }`.
- No `any`.

**Error handling:**
- Per-conversation errors: log and skip that conversation; do not abort the entire job.
- Embedding failures: log and mark the signal with `pii_status = 'pending'` for retry.
- All errors logged via `lib/logger` with `{ correlationId, source: 'claude_export', action }`.

**Tests required:**
- `tests/capture-worker/parsers/claude-export.test.ts`: given fixture export JSON with 3 conversations, produces correct number of parsed units; unknown field is handled gracefully.
- `tests/capture-worker/ingest-claude.test.ts`: given fixture export, signals are inserted; duplicate source_id is skipped; blocklisted conversation is not embedded; file is moved to processed/ after run.

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] `pnpm typecheck` passes — no `any`
- [ ] `pnpm lint` passes
- [ ] Duplicate detection tested and working
- [ ] Blocklist check tested and working
- [ ] Format-change error throws `ClaudeExportFormatError` + Telegram alert
- [ ] Processed file moved, not deleted
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(capture): Claude export ingester`

**Out of scope (do NOT implement in this prompt):**
- Perplexity export ingester
- MS Graph email, Teams, or Telegram ingesters
- Synthesis logic

---

### Prompt 6: capture-worker — MS Graph Email Ingester

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–5 complete. Claude ingester is live.
- Decisions coming in future prompts: Teams transcripts (Prompt 7), Telegram voice (Prompt 8). DO NOT build those here.

**Objective:** Build the Inngest job that fetches Hassan's IT-topic Outlook emails from the past 24 hours via MS Graph, redacts, chunks, and embeds into `capture_signals`.

**Spec reference:** `capture-synthesis-layer/prd.md §4.1 CS-03, §4.3, §6.3, §8 AC-F1-02`; `architecture-and-data-model.md §7.1`

**Allowed files (create or modify):**
- `artifacts/capture-worker/src/jobs/ingest-msgraph-email.ts` (create)
- `artifacts/capture-worker/src/integrations/msgraph.ts` (create)
- `artifacts/capture-worker/src/index.ts` (add new function registration only)
- `lib/redaction/blocklist.ts` (add subject regex check if not already present)
- `tests/capture-worker/ingest-msgraph-email.test.ts`

**MUST NOT touch:**
- `lib/db/schema.ts`
- `lib/redaction/regex-pass.ts` (read only)
- `lib/embeddings/` (read only)
- Any other artifact services
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- `@microsoft/microsoft-graph-client@3.0.7`
- `@azure/msal-node@2.7.0`

**Edge cases to handle:**
- Email from blocklisted sender address: skip before any processing; log as blocked.
- Email subject matching family-law regex `/(custody|mediator|settlement|family court|divorce|separation agreement)/i`: skip before any processing.
- Email already in `capture_signals` (duplicate `source_id`): skip without error.
- MS Graph 429: exponential backoff starting at 5s, max 5 retries.
- MS Graph 401: attempt token refresh using `MSGRAPH_REFRESH_TOKEN`; if refresh fails, send Telegram alert and abort job.
- Empty inbox (0 new emails in past 24h): complete successfully with `signals_fetched: 0`.
- Subject line + body concatenated before redaction; subject is the first line.
- Only fetch emails from the past 24 hours — use `$filter=receivedDateTime ge <timestamp>` in the Graph query.

**Type safety:**
- Discriminated union `GraphEmailIngestionResult`: `{ status: 'success' | 'blocked' | 'duplicate' | 'error'; signalId?: string; reason?: string }`.
- No `any`.

**Error handling:**
- Per-email errors: log and skip; do not abort entire job.
- Auth failures: alert via Telegram before throwing.

**Tests required:**
- `tests/capture-worker/ingest-msgraph-email.test.ts`:
  - Email from blocklisted sender → 0 rows inserted, logged as blocked
  - Email with "custody" in subject → 0 rows inserted
  - Valid IT-topic email → 1 or more rows inserted in `capture_signals`
  - Duplicate `source_id` → skipped without error

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Blocklist address hashing confirmed (no plaintext)
- [ ] Subject regex confirmed blocking family-law keywords
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(capture): MS Graph email ingester`

**Out of scope:**
- Teams transcripts (Prompt 7)
- Calendar events ingestion (not in spec)
- Any change to synthesis-worker

---

### Prompt 7: capture-worker — Teams Transcripts Ingester

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–6 complete. MS Graph email ingester is live.
- Decisions coming in future prompts: Telegram voice endpoint (Prompt 8). DO NOT build that here.

**Objective:** Build the Inngest job that fetches Microsoft Teams call records and transcript files via MS Graph, transcribes any untranscribed audio (if needed), redacts, and embeds into `capture_signals`.

**Spec reference:** `capture-synthesis-layer/prd.md §4.1 CS-04, §4.2, §8`; `architecture-and-data-model.md §7.1`

**Allowed files (create or modify):**
- `artifacts/capture-worker/src/jobs/ingest-msgraph-teams.ts` (create)
- `artifacts/capture-worker/src/integrations/msgraph.ts` (extend — add Teams call records query)
- `artifacts/capture-worker/src/index.ts` (add new function registration)
- `tests/capture-worker/ingest-msgraph-teams.test.ts`

**MUST NOT touch:**
- `lib/db/schema.ts`
- `lib/embeddings/` (read only)
- `lib/redaction/` (read only)
- Any other artifact services
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- None new — use existing `@microsoft/microsoft-graph-client`, `@azure/msal-node`, `openai` (for Whisper if needed).

**Edge cases to handle:**
- Teams may generate transcripts automatically if recording was enabled; if transcript file already exists, use it directly — do not re-transcribe.
- If no transcript file exists and the audio URL is available, transcribe via Whisper using `lib/embeddings`.
- If neither transcript nor audio is available for a call record, skip with log: `no_transcript_available`.
- Meeting participants are named in transcripts — redaction is critical; names must be caught by LLM scrub.
- Only process calls from the past 7 days (weekly batch, not daily like email).
- Duplicate detection by call record ID hashed as `source_id`.
- Graph scope required: `callRecords.read.all` — if scope is missing, send Telegram alert and abort.

**Type safety:**
- `TeamsCallRecord` type from Graph API response narrowed from `unknown`.
- `TranscriptIngestionResult` discriminated union: `{ status: 'success' | 'no_transcript' | 'duplicate' | 'blocked' | 'error' }`.
- No `any`.

**Error handling:**
- Per-call errors: log and skip; do not abort the batch.
- Missing scope: Telegram alert, abort with structured error.

**Tests required:**
- `tests/capture-worker/ingest-msgraph-teams.test.ts`:
  - Call with existing transcript → ingested and embedded
  - Call with no transcript, no audio → skipped with `no_transcript_available`
  - Duplicate call record ID → skipped without error
  - Graph API 403 (missing scope) → Telegram alert sent, job aborted

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Duplicate detection working
- [ ] Missing-scope handling working
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(capture): MS Graph Teams transcripts ingester`

**Out of scope:**
- Telegram voice notes (Prompt 8)
- Perplexity export ingester
- Any synthesis logic

---

### Prompt 8: capture-worker — Telegram Voice/Text Capture Endpoint

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–7 complete. All file-drop and Graph ingesters are live.
- Decisions coming in future prompts: synthesis-worker (Prompt 9), telegram-bot journalist interview (Prompt 10). The bot infrastructure created here is shared with F2 (journalist mode). DO NOT build the journalist interview flow in this prompt.

**Objective:** Build the webhook handler in the telegram-bot artifact that receives ad-hoc voice notes from Hassan, transcribes via Whisper, redacts, and inserts into `capture_signals`.

**Spec reference:** `capture-synthesis-layer/prd.md §4.1 CS-05, §4.2`; `journalist-mode-interview/prd.md §6.2`; `architecture-and-data-model.md §7.2`

**Allowed files (create or modify):**
- `artifacts/telegram-bot/src/bot.ts` — grammY bot instance setup
- `artifacts/telegram-bot/src/handlers/voice.ts` — voice note handler
- `artifacts/telegram-bot/src/handlers/text.ts` — text capture handler (for IT-topic text notes)
- `artifacts/telegram-bot/src/index.ts` — start long-poll
- `artifacts/telegram-bot/package.json` — add grammy
- `tests/telegram-bot/voice-handler.test.ts`

**MUST NOT touch:**
- `lib/` (read only)
- `artifacts/capture-worker/`, `artifacts/synthesis-worker/`, `artifacts/gate-worker/`, `artifacts/sanity-bridge/`
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- `grammy@1.31.0`

**Edge cases to handle:**
- Bot must only respond to messages from `TELEGRAM_CHAT_ID` — all other chat IDs receive no response (security boundary).
- Voice note audio file URL retrieved from Telegram's file API; if file API returns 404, log error and send Hassan: "Could not retrieve audio. Try again or resend."
- Voice note longer than 10 minutes (Telegram's limit): Whisper handles this; no special case needed.
- Text message received from Hassan outside of an active interview session: capture as a text signal in `capture_signals` with `source = 'telegram_voice'` (same source tag for both voice and ad-hoc text).
- Transcription takes > 90 seconds: send interim acknowledgment "Transcribing..." immediately on receipt; send final confirmation when done.
- Duplicate detection: if the same audio file (same `file_id`) has been ingested before, skip.

**Type safety:**
- No `any` on grammy context objects — use `Context` from grammy.
- `VoiceCaptureResult` type: `{ signalId: string; transcript: string; durationSeconds: number }`.

**Error handling:**
- Audio fetch failure: Telegram alert to Hassan, log error, do not crash the bot process.
- Whisper failure: Telegram alert, log, do not store unredacted text.

**Tests required:**
- `tests/telegram-bot/voice-handler.test.ts`:
  - Voice note from correct chat ID → transcribed and inserted
  - Voice note from unknown chat ID → ignored with no response
  - Duplicate file_id → skipped

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Chat ID guard working (non-Hassan messages ignored)
- [ ] Interim "Transcribing..." acknowledgment sent within 5 seconds of receipt
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(telegram-bot): ad-hoc voice/text capture endpoint`

**Out of scope:**
- Journalist interview state machine (Prompt 10)
- Any bot commands beyond basic voice/text capture
- Perplexity export ingester

---

### Prompt 9: synthesis-worker — Nightly Clustering Cron

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–8 complete. All capture sources are live.
- Decisions coming in future prompts: journalist interview bot (Prompt 10) consumes the `article_candidates` row and `interview.session.requested` event produced here. DO NOT build the bot session here.

**Objective:** Build the Sunday-night synthesis cron that clusters recent `capture_signals` by cosine similarity, generates `synthesis_clusters` rows, and creates the top `article_candidates` row, then dispatches `interview.session.requested`.

**Spec reference:** `capture-synthesis-layer/prd.md §4.4, §6.6, §6.7, §8 AC-F1-05`; `architecture-and-data-model.md §3`

**Allowed files (create or modify):**
- `artifacts/synthesis-worker/src/jobs/synthesize-weekly.ts` (create)
- `artifacts/synthesis-worker/src/clustering.ts` (cosine similarity + cluster merging)
- `artifacts/synthesis-worker/src/pillar-classifier.ts` (Claude Haiku pillar classification)
- `artifacts/synthesis-worker/src/index.ts` (register Inngest function)
- `tests/synthesis-worker/clustering.test.ts`
- `tests/synthesis-worker/synthesize-weekly.test.ts`

**MUST NOT touch:**
- `lib/db/schema.ts`
- Any file in `artifacts/capture-worker/`, `artifacts/telegram-bot/`, `artifacts/gate-worker/`, `artifacts/sanity-bridge/`
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- None new — use `@anthropic-ai/sdk`, `lib/db`, `lib/logger` already installed.

**Edge cases to handle:**
- No signals in the past 30 days: send Hassan a Telegram alert "No capture signals found for synthesis this week. Check that ingestion jobs are running." Do not create a cluster or candidate.
- No cluster meets the quality floor (≥3 signals, cosine similarity > 0.72): send Hassan a Telegram alert "Synthesis found no qualifying clusters this week. Consider adding more capture signals or lowering the threshold." Do not create a candidate.
- Off-pillar cluster (Claude Haiku cannot classify into quickbooks/managed-it/cybersecurity): discard the cluster and log to `off_pillar_discards` field in the `synthesis_clusters` row's metadata JSONB.
- Large corpus (>500 signals): cosine similarity matrix O(n²) will be slow. For MVP (corpus < 2,000 signals), the naive approach is acceptable. Log a warning if corpus exceeds 1,000 signals to flag for future HDBSCAN migration.
- Claude Haiku API failure during pillar classification: retry once after 5s. If second attempt fails, skip the cluster and log.
- The dispatch of `interview.session.requested` must use `step.run()` to be retried independently if it fails.

**Type safety:**
- `Cluster` type: `{ signalIds: string[]; label: string; topicKeywords: string[]; pillar: Pillar | null; score: number }`.
- No `any`.

**Error handling:**
- Per-cluster Claude failures: log and skip that cluster; do not abort the synthesis job.
- Job-level failure (DB unavailable): Inngest retries 3 times; on 3rd failure, send Telegram alert.

**Tests required:**
- `tests/synthesis-worker/clustering.test.ts`: 5 fixture signals with cosine similarity > 0.72 → 1 cluster; 5 signals with similarity < 0.5 → 0 clusters.
- `tests/synthesis-worker/synthesize-weekly.test.ts`: mock Claude Haiku; mock DB; given qualifying cluster → `synthesis_clusters` and `article_candidates` rows created; `interview.session.requested` event dispatched.

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Cron scheduled at `0 7 * * 0` UTC (Sunday 2 AM Eastern)
- [ ] No-cluster alert tested
- [ ] Off-pillar discard logged
- [ ] `interview.session.requested` event dispatched after candidate creation
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(synthesis): nightly clustering cron + article candidate generation`

**Out of scope:**
- HDBSCAN clustering (deferred to v2.1)
- Question generation (Prompt 10)
- Any drafting or gate logic

---

### Prompt 10: telegram-bot — Journalist-Mode Interview Flow

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–9 complete. Bot infrastructure (Prompt 8) and synthesis (Prompt 9) are live.
- Decisions coming in future prompts: gate-worker (Prompt 11) consumes the `draft.requested` event dispatched when a session completes. DO NOT build gate logic here.

**Objective:** Build the journalist-mode interview session Inngest function: Monday morning delivery, confirmation questions from corpus, voice/button/text answer handling, state machine, reminder/timeout logic, and session completion.

**Spec reference:** `journalist-mode-interview/prd.md §4, §6, §7, §8`

**Allowed files (create or modify):**
- `artifacts/telegram-bot/src/jobs/interview-session.ts` (create — Inngest handler)
- `artifacts/telegram-bot/src/handlers/confirmation.ts` (inline button callbacks)
- `artifacts/telegram-bot/src/handlers/commands.ts` (/skip, /status, /help, /delete_signal)
- `artifacts/telegram-bot/src/lib/question-generator.ts` (Claude Sonnet question generation)
- `artifacts/telegram-bot/src/lib/session-state.ts` (state machine transitions)
- `artifacts/telegram-bot/src/index.ts` (register interview-session Inngest function)
- `tests/telegram-bot/interview-session.test.ts`
- `tests/telegram-bot/question-generator.test.ts`

**MUST NOT touch:**
- `lib/db/schema.ts`
- `artifacts/capture-worker/`, `artifacts/synthesis-worker/`, `artifacts/gate-worker/`, `artifacts/sanity-bridge/`
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- None new — use `grammy`, `@anthropic-ai/sdk`, `lib/db`, `lib/logger` already installed.

**Edge cases to handle:**
- Interview must not start Sunday night — use `step.sleepUntil()` for Monday 8:00 AM Eastern (13:00 UTC).
- Hassan replies `/skip` to preview: archive candidate as `status = 'skipped'`, send no further messages.
- Hassan clicks ⏭ Skip on ALL confirmation questions: send exactly 1 open-ended fallback question; flag candidate `low_corpus_confidence = true`.
- 48-hour soft reminder: if in `preview_sent` or `confirming` state and no activity for 48h, send exactly 1 reminder. Set `reminder_sent = true` in session JSONB to prevent double-sending.
- 7-day timeout: Inngest `step.waitForEvent` with 7-day timeout. On timeout, set `status = 'timed_out'`, archive candidate, send Telegram message.
- Question quality gate: if Claude Sonnet returns `ERROR:NO_SPECIFICS`, regenerate once. If second attempt also fails, exclude that signal from the session and log `signal_excluded_quality_gate`. If >2 signals excluded from one session, alert Hassan.
- Session state must persist in Supabase `interview_sessions` — not in-memory. Bot restarts must be safe.
- On session complete: dispatch `draft.requested` Inngest event.

**Type safety:**
- `SessionStatus` discriminated union matches the `session_status_enum` in the DB schema exactly.
- No `any` on Claude API responses — parse with `unknown` then narrow.

**Error handling:**
- Claude question generation failure: retry once; if fails again, exclude signal.
- Whisper failure on voice answer: send "Couldn't transcribe — please type your answer or resend the voice note."
- DB write failure: log and retry via Inngest step retry.

**Tests required:**
- `tests/telegram-bot/interview-session.test.ts`: state machine transitions from `pending` → `preview_sent` → `confirming` → `completed`; `/skip` → `skipped`; 7-day timeout → `timed_out`; all-skip fallback question sent.
- `tests/telegram-bot/question-generator.test.ts`: mock Claude; question references specific signal detail; `ERROR:NO_SPECIFICS` triggers regeneration; second failure excludes signal.

**Definition of Done:**
- [ ] All tests pass (`pnpm test`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Monday 8 AM Eastern delivery confirmed in test
- [ ] 48h reminder fires exactly once
- [ ] `draft.requested` event dispatched on completion
- [ ] `low_corpus_confidence` flag set when all confirmations skipped
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(telegram-bot): journalist-mode interview session`

**Out of scope:**
- Draft generation (Prompt 11)
- Quality gate (Prompts 11–12)
- Any ingestion logic

---

### Prompt 11: gate-worker — Stage A Rule-Based Gate

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–10 complete. Interview session dispatches `draft.requested`.
- Decisions coming in future prompts: Clearscope Stage B (Prompt 12) consumes the `draft.generated` event produced here. DO NOT build Stage B or SEOwind here — this prompt is Stage A rule evaluation only. SEOwind brief assembly and API call are also part of this prompt.

**Objective:** Build the gate-worker's draft generation flow: receive `draft.requested`, assemble SEOwind brief, call SEOwind (Path A API preferred, Path B Playwright fallback if needed), then run Stage A rule-based auto-reject on the resulting draft.

**Spec reference:** `seowind-drafting-quality-gate/prd.md §4.1–§4.5, §6.1–§6.2, §8 AC-F3-01 through AC-F3-03`

**Allowed files (create or modify):**
- `artifacts/gate-worker/src/jobs/draft-generator.ts` (create — handles `draft.requested`)
- `artifacts/gate-worker/src/gates/stage-a.ts` (create — all 8 rules)
- `artifacts/gate-worker/src/integrations/seowind.ts` (create — Path A API)
- `artifacts/gate-worker/src/integrations/seowind-playwright.ts` (create — Path B fallback, with WARNING header comment)
- `artifacts/gate-worker/src/index.ts` (register functions)
- `tests/gate-worker/stage-a.test.ts`
- `tests/gate-worker/draft-generator.test.ts`

**MUST NOT touch:**
- `lib/db/schema.ts`
- Any other artifact services
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- `playwright@1.45.1` (for Path B fallback only — do not install if Path A works)

**Edge cases to handle:**
- SEOwind API unavailable (5xx): retry once after 30s; if still failing and Path B is implemented, fall back to Playwright. If Path B also fails, send Telegram alert and set `drafts.status = 'generating'` with a retry scheduled for 2 hours later.
- Generic phrase blocklist (GA-02): all 30 phrases from the spec, case-insensitive. Partial matches within longer phrases count.
- Clickbait title check (GA-04): `best` triggers only when not followed by "practice" — implement the regex from the spec exactly.
- Unsourced statistic (GA-07): any number ≥4 digits with no adjacent URL or named source within 200 chars. This is a heuristic — false positives are acceptable at <5% rate (reviewed monthly).
- First-person E-E-A-T check (GA-08): check for `\b(I|we|my client|in my experience|our)\b` — case-insensitive.
- Stage A fail-fast: stop at first failure for MVP. Return the first `GateAFailure` only.
- Rewrite loop: increment `attempt_number`; if `> 3`, set `status = 'shelved'`, notify Hassan, dispatch `draft.shelved`.

**Type safety:**
- `GateAFailure` and `GateAResult` types as specified in the PRD §6.2 — exported from `stage-a.ts`.
- No `any`.

**Error handling:**
- SEOwind Path B script must have a header comment exactly as specified in PRD §4.4.
- Per-rule evaluation wrapped in try/catch — a bug in one rule must not prevent other rules from running (log the rule error and treat as a pass for that rule to avoid false reject).

**Tests required:**
- `tests/gate-worker/stage-a.test.ts`: all 8 rules tested with passing and failing fixture drafts; GA-02 case-insensitive match; GA-04 "best practice" exception; GA-07 number near URL → passes; GA-07 bare number → fails.
- `tests/gate-worker/draft-generator.test.ts`: mock SEOwind API; `draft.requested` event → `drafts` row created; stage A pass → `draft.generated` event dispatched; stage A fail → Hassan Telegram message within 2 minutes.

**Definition of Done:**
- [ ] All 8 Stage A rules implemented and tested
- [ ] GA-02 30-phrase blocklist complete (count the list)
- [ ] Rewrite loop with 3-attempt shelf limit working
- [ ] Telegram rejection notification includes quoted violation
- [ ] SEOwind Path B fallback script has WARNING header comment
- [ ] `pnpm test` passes, `pnpm typecheck` passes, `pnpm lint` passes
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(gate): Stage A rule-based auto-reject + SEOwind brief assembly`

**Out of scope:**
- Clearscope Stage B (Prompt 12)
- Stage C E-E-A-T notification (Prompt 12)
- Any Sanity bridge logic

---

### Prompt 12: gate-worker — Stage B Clearscope + Stage C Notification

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–11 complete. Stage A is working.
- Decisions coming in future prompts: sanity-bridge (Prompt 13) receives the `draft.gate_passed` event dispatched here. DO NOT build the Sanity push here.

**Objective:** Build Stage B (Clearscope re-scoring) and Stage C (Aleyda Solis E-E-A-T GPT notification) in the gate-worker.

**Spec reference:** `seowind-drafting-quality-gate/prd.md §4.6–§4.7, §8 AC-F3-04 through AC-F3-07`

**Allowed files (create or modify):**
- `artifacts/gate-worker/src/gates/stage-b.ts` (create)
- `artifacts/gate-worker/src/integrations/clearscope.ts` (create)
- `artifacts/gate-worker/src/integrations/openai-eeat.ts` (create — Stage C API attempt)
- `artifacts/gate-worker/src/jobs/gate-runner.ts` (create — orchestrates A → B → C)
- `artifacts/gate-worker/src/jobs/rewrite-handler.ts` (create — handles `draft.rewrite_requested`)
- `artifacts/gate-worker/src/index.ts` (register gate-runner and rewrite-handler)
- `tests/gate-worker/stage-b.test.ts`
- `tests/gate-worker/gate-runner.test.ts`

**MUST NOT touch:**
- `artifacts/gate-worker/src/gates/stage-a.ts` (read only — do not modify Stage A)
- `lib/db/schema.ts`
- Any other artifact services
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- None new — use `openai`, `lib/logger` already installed.

**Edge cases to handle:**
- Clearscope API unavailable (5xx or not available at Essentials plan tier): send Hassan a Telegram message exactly as specified in PRD §4.6: "Clearscope API unavailable. Please score manually at app.clearscope.io and reply `/set_clearscope_score [draft_id] [score]`." Set `drafts.status = 'awaiting_manual_clearscope'`. The `/set_clearscope_score` bot command must be added to `artifacts/telegram-bot/src/handlers/commands.ts` — add that file to the allowed list.
- Stage C Custom GPT API: attempt the OpenAI Assistants API call with the known GPT assistant ID. If it fails or is unavailable, fall back to the manual notification format (no hard failure — Stage C is always manual-fallback-capable).
- Clearscope score < 80: dispatch `draft.rewrite_requested` with the score shortfall. Increment `attempt_number`.
- Rewrite handler: append `corrections` to the SEOwind brief (as per PRD §4.8 format). Re-dispatch `draft.requested` (which triggers Stage A again).
- `draft.gate_passed` event: dispatched only when Stage A and Stage B both pass.

**Type safety:**
- `GateBResult` type: `{ passed: boolean; score: number; threshold: 80; evaluatedAt: string }`.
- No `any`.

**Error handling:**
- Clearscope API timeout (>60s): treat as unavailable; send manual-score request.
- `/set_clearscope_score` command handling: validate that score is a number 0–100; reject otherwise.

**Tests required:**
- `tests/gate-worker/stage-b.test.ts`: mock Clearscope API; score 82 → pass; score 75 → fail with `draft.rewrite_requested` dispatch; API 5xx → manual fallback Telegram message sent.
- `tests/gate-worker/gate-runner.test.ts`: Stage A pass + Stage B pass → `draft.gate_passed` event dispatched; Stage B fail → `drafts.attempt_number` incremented; 3rd attempt fail → `drafts.status = 'shelved'`.

**Definition of Done:**
- [ ] Stage B Clearscope integration working (or manual fallback)
- [ ] `/set_clearscope_score` command handled in telegram-bot
- [ ] Stage C notification includes GPT URL + exact paste instructions
- [ ] `draft.gate_passed` dispatched on A+B pass
- [ ] 3-attempt shelf limit tested end-to-end through A and B
- [ ] `pnpm test` passes, `pnpm typecheck` passes, `pnpm lint` passes
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(gate): Stage B Clearscope + Stage C notification + rewrite loop`

**Out of scope:**
- Sanity bridge (Prompt 13)
- Social distribution (Prompt 14)
- Any changes to Stage A logic

---

### Prompt 13: sanity-bridge — Draft Push + Approve Webhook

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–12 complete. Gate produces `draft.gate_passed`.
- Decisions coming in future prompts: distribution automations (Prompt 14) depend on the `medium.import.scheduled` event dispatched here. The social queue entry is also initiated here.

**Objective:** Build the sanity-bridge: push gate-passed drafts to Sanity as draft documents, handle the Approve/Reject/Re-publish webhooks, trigger ISR revalidation, Indexing API ping, and schedule distribution.

**Spec reference:** `sanity-review-publish/prd.md §4, §6, §8`; `architecture-and-data-model.md §7.7`

**Allowed files (create or modify):**
- `artifacts/sanity-bridge/src/jobs/push-to-sanity.ts`
- `artifacts/sanity-bridge/src/jobs/stale-draft.ts`
- `artifacts/sanity-bridge/src/jobs/medium-reminder.ts`
- `artifacts/sanity-bridge/src/webhooks/sanity-webhook.ts`
- `artifacts/sanity-bridge/src/integrations/sanity-client.ts`
- `artifacts/sanity-bridge/src/integrations/revalidate.ts`
- `artifacts/sanity-bridge/src/integrations/indexing-api.ts`
- `artifacts/sanity-bridge/src/integrations/social-queue.ts`
- `artifacts/sanity-bridge/src/index.ts`
- `artifacts/sanity-bridge/sanity/schemas/post.ts`
- `artifacts/sanity-bridge/sanity/schemas/actions/approve.ts`
- `artifacts/sanity-bridge/sanity/schemas/actions/reject.ts`
- `artifacts/sanity-bridge/sanity/schemas/actions/republish.ts`
- `artifacts/sanity-bridge/package.json`
- `tests/sanity-bridge/push-to-sanity.test.ts`
- `tests/sanity-bridge/sanity-webhook.test.ts`

**MUST NOT touch:**
- Any file in `NexFortis-Website-Design-pro` — the bridge calls the revalidate endpoint but does NOT modify the main repo.
- `lib/db/schema.ts`
- Any other artifact services

**Dependencies allowed (pinned versions):**
- `@sanity/client@6.20.1`
- `@portabletext/to-portable-text@0.1.0` (if available; otherwise implement a simple Markdown-to-PT converter)
- `google-auth-library@9.12.0`
- `@sanity/webhook@3.0.3`
- `hono@4.5.0` (HTTP server for webhook endpoint)

**Edge cases to handle:**
- Idempotent webhook: if the same `pipeline_draft_id` webhook arrives twice, acknowledge with 200 and log as duplicate — do not publish twice. Check `drafts.sanity_doc_id IS NOT NULL` before pushing.
- ISR revalidate failure: retry 3 times at 5-minute intervals (Inngest steps). On 3rd failure, send Hassan a Telegram alert.
- Google Indexing API 429: schedule a retry for the next day via `step.sleepUntil()`.
- Sanity draft push: check that Hassan has confirmed the existing `post` schema before implementation. If `SANITY_POST_SCHEMA_CONFIRMED` env var is not set, throw with message: "Set SANITY_POST_SCHEMA_CONFIRMED=true after reviewing the existing Sanity post schema."
- Webhook secret verification: every incoming webhook must be verified using `@sanity/webhook` `isValidSignature`. Reject unsigned webhooks with 401.
- 7-day stale draft: Inngest step fires 7 days after push. If still in `in_sanity_review`, send escalation Telegram. Set `escalation_sent_at`. Do not send twice.
- Medium reminder: dispatch `medium.import.scheduled` Inngest event at publish time, scheduled for 14 days later.

**Type safety:**
- `SanityWebhookPayload` type narrowed from `unknown`.
- `PublishSequenceResult` type: `{ sanityPublished: boolean; isrRevalidated: boolean; indexingApiPinged: boolean; socialQueued: boolean }`.
- No `any`.

**Error handling:**
- Social queue failure (Missinglettr/SocialBee): log and continue — do not block publish on social queue.
- Indexing API quota: retry next day, alert Hassan.

**Tests required:**
- `tests/sanity-bridge/push-to-sanity.test.ts`: mock Sanity client; `draft.gate_passed` → Sanity document created; Telegram notification sent; `drafts.sanity_doc_id` set.
- `tests/sanity-bridge/sanity-webhook.test.ts`: valid Approve webhook → publish sequence; invalid signature → 401; duplicate webhook → 200 + no re-publish; Reject webhook → `drafts.status = 'rejected_by_hassan'`; `draft.rewrite_requested` dispatched.

**Definition of Done:**
- [ ] Idempotent webhook tested
- [ ] ISR revalidate retry (3 attempts, 5-minute intervals) tested
- [ ] Webhook signature verification working
- [ ] 7-day stale escalation working
- [ ] `medium.import.scheduled` event dispatched at publish time
- [ ] `pnpm test` passes, `pnpm typecheck` passes, `pnpm lint` passes
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(sanity-bridge): draft push + approve webhook + publish sequence`

**Out of scope:**
- Medium auto-import (manual reminder only — Prompt 14)
- Social post copy generation
- Scheduled publication (v2.1)

---

### Prompt 14: Distribution Automations

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–13 complete. Full publish pipeline is working.
- Decisions coming in future prompts: GEO tracking (Prompt 15) is separate. DO NOT build Otterly/Semrush integration here.

**Objective:** Implement the distribution automations: Medium import reminder (T+14 days), Missinglettr social drip trigger (T+24h), and Telegram status notifications for each distribution step.

**Spec reference:** `sanity-review-publish/prd.md §4.7`; `epic-prd.md §6 (System Overview — Distribution layer)`; `architecture-and-data-model.md §7.8`

**Allowed files (create or modify):**
- `artifacts/sanity-bridge/src/jobs/medium-reminder.ts` (extend — add reminder Telegram message)
- `artifacts/sanity-bridge/src/integrations/social-queue.ts` (extend — implement Missinglettr webhook or RSS trigger)
- `tests/sanity-bridge/medium-reminder.test.ts`
- `tests/sanity-bridge/social-queue.test.ts`

**MUST NOT touch:**
- `lib/db/schema.ts`
- Any other artifact services besides `sanity-bridge`
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- None new — use existing HTTP `fetch` for Missinglettr webhook.

**Edge cases to handle:**
- Medium reminder: fires exactly 14 days after `published_articles.published_at`. Message format must include the import URL and the blog post URL. Log `medium_import_reminded_at` in `published_articles`.
- If Hassan has already manually set `medium_imported_at` (logged via a `/mark_medium_imported` Telegram command), skip the reminder.
- Missinglettr/SocialBee webhook: if the webhook endpoint is not configured (`MISSINGLETTR_WEBHOOK_URL` env var not set), log a warning and skip without error — do not block publish.
- Social queue entry created within 1 hour of publish: Inngest `step.run()` immediately after ISR revalidation.
- Telegram notification for each distribution step: update the publish confirmation message or send a follow-up when each step completes.
- `/mark_medium_imported` Telegram command: sets `published_articles.medium_imported_at` for the most recent published article.

**Type safety:**
- `DistributionStatus` type: `{ missinglettr: 'queued' | 'skipped' | 'error'; mediumReminder: 'scheduled' | 'sent' | 'skipped' }`.
- No `any`.

**Error handling:**
- Missing `MISSINGLETTR_WEBHOOK_URL`: log warning, do not throw.
- Missinglettr webhook 5xx: log error, do not retry (Missinglettr will pick up via RSS detection).

**Tests required:**
- `tests/sanity-bridge/medium-reminder.test.ts`: mock Inngest; reminder fires 14 days after publish; already-imported article is skipped.
- `tests/sanity-bridge/social-queue.test.ts`: webhook URL configured → request sent; URL not configured → warning logged, no error thrown.

**Definition of Done:**
- [ ] Medium reminder Telegram message includes correct URLs
- [ ] `medium_import_reminded_at` set after reminder
- [ ] Social queue triggered within 1 hour of publish
- [ ] Missing webhook URL handled gracefully
- [ ] `/mark_medium_imported` command working
- [ ] `pnpm test` passes, `pnpm typecheck` passes, `pnpm lint` passes
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(distribution): Medium reminder + social drip automations`

**Out of scope:**
- Full Medium API integration (manual reminder only)
- GEO tracking (Prompt 15)
- Automated social post copy generation

---

### Prompt 15: GEO Tracking + Observability

**Role:** Senior implementer working on `TSGCFO/nexfortis-content-pipeline`. Follow `AGENTS.md` and `.cursorrules`.

**Strategic context (do not deviate):**
- Prompts 1–14 complete. The full pipeline is operational.
- This is the final prompt. It adds monitoring, error reporting, and GEO tracking integration. Do not modify any existing business logic.

**Objective:** Integrate Sentry error reporting across all services, add Otterly (or Semrush AI Visibility) GEO tracking webhook, and set up basic operational metrics emission to a simple dashboard.

**Spec reference:** `architecture-and-data-model.md §10`; `epic-prd.md §1 SC7 (AI Visibility)`

**Allowed files (create or modify):**
- `lib/logger/index.ts` (extend — add Sentry `beforeSend` hook for PII scrubbing)
- `lib/logger/sentry.ts` (create — Sentry initialization)
- `artifacts/*/src/index.ts` in each of the 5 services (add Sentry init call at startup — minimal change)
- `artifacts/gate-worker/src/integrations/otterly.ts` (create — GEO tracking webhook; if Otterly API is not available as of implementation date, stub with a clear TODO comment and document the manual alternative)
- `tests/logger/sentry.test.ts`
- `tests/gate-worker/otterly.test.ts`

**MUST NOT touch:**
- `lib/db/schema.ts`
- Any business logic in existing jobs, handlers, or integrations
- Anything in `NexFortis-Website-Design-pro`

**Dependencies allowed (pinned versions):**
- `@sentry/node@8.18.0` (already in package.json from Prompt 1 — do not upgrade)

**Edge cases to handle:**
- Sentry `beforeSend` hook must scrub: email addresses (regex), the patterns from `lib/redaction/regex-pass.ts`, and any key named `raw_text` from Sentry event data. Never send `raw_text` to Sentry.
- Otterly integration: if `OTTERLY_API_KEY` env var is not set, log a warning and skip GEO tracking calls without error. Document the manual Otterly dashboard setup in a comment in `otterly.ts`.
- If Otterly's API is not yet publicly available or has changed since the spec was written, implement a stub that logs `{ action: 'geo_track', url, keyword }` and returns immediately. Add a TODO comment with the Otterly API docs URL.
- Semrush AI Visibility is the alternative if Otterly is unavailable — implement the same stub pattern for it in a separate `semrush-geo.ts` file if needed.
- Sentry DSN: if `SENTRY_DSN` env var is not set, Sentry must initialize in no-op mode (not crash).

**Type safety:**
- `GeoTrackingResult` type: `{ tracked: boolean; provider: 'otterly' | 'semrush' | 'none'; reason?: string }`.
- No `any`.

**Error handling:**
- All Sentry calls wrapped to never throw — Sentry failures must not affect pipeline operation.
- GEO tracking failures: log and continue.

**Tests required:**
- `tests/logger/sentry.test.ts`: PII scrub in `beforeSend` removes email addresses from event data; `raw_text` key removed from event data.
- `tests/gate-worker/otterly.test.ts`: `OTTERLY_API_KEY` set → request sent (mocked); not set → warning logged, no error.

**Definition of Done:**
- [ ] Sentry initialized in all 5 services at startup
- [ ] `beforeSend` PII scrub tested and working
- [ ] GEO tracking stub or real integration present in `otterly.ts`
- [ ] Missing API key handled gracefully (no crash)
- [ ] `SENTRY_DSN` missing → no-op mode, not crash
- [ ] `pnpm test` passes, `pnpm typecheck` passes, `pnpm lint` passes
- [ ] No business logic changed — observability layer only
- [ ] No changes outside the allowed list
- [ ] PR opened: `feat(observability): Sentry error reporting + GEO tracking stub`

**Out of scope:**
- Building a custom metrics dashboard (manual Supabase queries suffice for v2)
- Automated GSC data ingestion
- Any change to business logic in existing jobs

---

*End of Prompt Library — 15 prompts covering the full NexFortis Content Pipeline v2 implementation.*
