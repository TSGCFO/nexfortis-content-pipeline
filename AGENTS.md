# AGENTS.md

Guide for any AI agent (Cursor, Claude Code, Codex, Copilot) working in this
repository. Cursor IDE also reads structured rules from
[.cursor/rules/](./.cursor/rules/) — those rules and this file are kept in
sync and intentionally repeat the most important conventions.

## Repo at a glance

This is the **NexFortis Automated Content Pipeline v2** — a backend automation
system that produces SEO-ranked blog content for [nexfortis.com](https://nexfortis.com).
It is **not** a website or web app; it has no UI. It is a collection of
workers, cron jobs, and integrations that capture Hassan's daily expertise
(Claude chats, Perplexity threads, Microsoft 365 email, Teams transcripts,
Telegram voice notes), embed it, cluster it, generate draft articles with
SEOwind, gate them through a quality pipeline, and hand them to Sanity CMS
for human approval.

Stack: TypeScript (strict), Node.js 22+, pnpm 10 workspace, Drizzle ORM,
Supabase (Postgres + pgvector), Inngest for orchestration, Vitest for tests.

### Services overview (planned — built one by one via the Prompt Library)

| Service | Package filter | Purpose |
|---|---|---|
| capture-worker | `@ncp/capture-worker` | Ingests Claude/Perplexity/MS Graph/Teams/Telegram → redact → embed → Supabase |
| synthesis-worker | `@ncp/synthesis-worker` | Nightly cron clusters captures into article candidates |
| telegram-bot | `@ncp/telegram-bot` | Monday journalist-mode interview |
| gate-worker | `@ncp/gate-worker` | Stage A (rules) + Stage B (Clearscope) quality gate |
| sanity-bridge | `@ncp/sanity-bridge` | Push drafts to Sanity, handle approve webhook → revalidate + Indexing API |

Shared libs under `lib/`: `db`, `embeddings`, `redaction`, `shared-types`,
`logger`.

### Project planning docs

All planning docs are in [`docs/ways-of-work/plan/content-pipeline-v2/`](./docs/ways-of-work/plan/content-pipeline-v2/).
Read these before doing any implementation work:

1. [`epic-prd.md`](./docs/ways-of-work/plan/content-pipeline-v2/epic-prd.md) — overall epic
2. The four Feature PRDs in `<feature>/prd.md`
3. [`architecture-and-data-model.md`](./docs/ways-of-work/plan/content-pipeline-v2/architecture-and-data-model.md) — full Postgres DDL + integration specs
4. [`tool-stack-decision-record.md`](./docs/ways-of-work/plan/content-pipeline-v2/tool-stack-decision-record.md) — every tool decision and why
5. [`implementation-roadmap.md`](./docs/ways-of-work/plan/content-pipeline-v2/implementation-roadmap.md) — sequenced milestones
6. [`cursor-claude-prompt-library.md`](./docs/ways-of-work/plan/content-pipeline-v2/cursor-claude-prompt-library.md) — 15 prompts. Implementation work happens by running these in order.

## Hard rules — do not violate

- **One prompt = one PR.** Every implementation task in this repo comes from a
  prompt in the Prompt Library. Open a separate PR per prompt. Do not combine
  prompts.
- **Stay strictly inside each prompt's allowed-file list.** Each prompt
  declares the exact files it may create or modify and the exact files it
  must not touch. Do not refactor adjacent code, do not "consolidate"
  duplicate-looking utilities, do not auto-format files outside the
  allowed list.
- **Never edit context files in this directory or its dotfiles**
  (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*`, `.github/PULL_REQUEST_TEMPLATE.md`,
  `.editorconfig`, `.gitignore`). These are authored by Hassan and Computer
  (the strategist). If you believe a behavior change is needed, stop and add
  a `// TODO(hassan):` comment in your PR description — do not modify the
  context file.
- **`docs/` is read-only by repo convention.** Do not modify any file under
  `docs/`. Specs are the source of truth — code follows specs, not the other
  way around. If a spec is wrong, stop and flag it; do not change code to
  match a wrong spec or change a spec to match wrong code.
- **Use pnpm.** `npm` and `yarn` are blocked by the `preinstall` hook.
- **Branch protection on `main`** — all work goes through PRs, squash merges
  only, CI must pass.
- **No `.env` files committed.** `.env.example` is the documentation file;
  real env vars live in Render secrets (production) and Cursor Cloud /
  local shell exports (development).
- **No new top-level dependencies** without an explicit allowlist entry in the
  active prompt. If a prompt does not list a dependency as allowed, do not
  install it. Stop and ask.
- **No dependency version bumps** beyond what the prompt allows.
- **No changes to `lib/db` schemas** unless the active prompt explicitly names
  the table being changed. Schema changes are coordinated — they have
  downstream effects on every worker.
- **Use the words "collect", "extract", "browse", "read"** when describing
  fetching pages or data. Do not use "scrape" or "crawl" anywhere — code,
  comments, commit messages, PR bodies, or docs.
- **No PII or family-law content in the corpus.** The `lib/redaction` module
  is fail-closed: if redaction fails, the ingestion job aborts rather than
  storing un-redacted content. Do not bypass this even for testing — use
  synthetic fixtures instead.

## Conventions

- **TypeScript strict mode.** No `any`. Use `unknown` and narrow. All exported
  types live in `lib/shared-types` if shared across services; service-local
  types stay in their own service.
- **Discriminated unions** for any multi-state value (e.g. `DraftStatus`,
  `IngestSource`, `GateResult`).
- **All async operations wrapped in try/catch.** Errors logged via
  `lib/logger` with `{ correlationId, source, action }` context. Never swallow
  errors silently.
- **Idempotency keys** on every external write (Sanity push, Indexing API
  ping, social-distribution submissions). Same input must never produce
  duplicate side effects.
- **Tests required for every new module.** Path:
  `tests/<service>/<test-name>.test.ts`. Cover happy path + at least 2 edge
  cases per requirement. Tests must run in CI before merge.
- **Pino for logging.** Structured JSON, no `console.log` in source files.
- **Drizzle for DB.** No raw SQL except in migrations.
- **Inngest for cron and async events.** No standalone setTimeout/setInterval
  for scheduling.

## Build and test commands

- `pnpm install` — install deps
- `pnpm typecheck` — workspace-wide TypeScript check
- `pnpm test` — Vitest, all workspaces
- `pnpm lint` — eslint, all workspaces
- `pnpm build` — typecheck + per-package build
- `pnpm --filter @ncp/<service> dev` — run a single service locally with Inngest dev server

All four must pass before a PR is opened.

## PR conventions

- **Title format:** `<prompt-number>: <short description>` (e.g.
  `Prompt 4: Implement lib/embeddings module`)
- **PR description** must follow [`./.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md).
- **Definition of Done** items from the active prompt must all be checked off
  before requesting review.
- **No squash-and-merge without Hassan's review.** Computer (the strategist
  AI) may co-review but does not merge.

## Tools we use (locked — see Tool Stack Decision Record)

- **SEOwind Pro** for drafting (Custom Brand Voice + "Your own insights" + "Statistics & Quotes")
- **Clearscope** for independent SERP-grounded re-scoring
- **Sanity** for CMS / human review
- **Supabase** (existing project, shared with main NexFortis monorepo) for Postgres + pgvector
- **OpenAI** for embeddings (`text-embedding-3-large`) and Whisper transcription
- **Anthropic Claude** for synthesis and question generation
- **Telegram Bot API** for the journalist-mode interview channel
- **Microsoft Graph** for Outlook + Teams capture
- **Inngest** for orchestration
- **Otterly** (or Semrush AI Visibility) for GEO tracking
- **Medium Import Tool** for cross-posting

**Do not introduce alternatives** without an ADR added to the Tool Stack
Decision Record and Hassan's approval.

## Implementer model

This repo is implemented by **Cursor agents (cloud + local) and Claude Code**,
with prompts authored by Computer (the orchestrating AI) and Hassan, executed
by the agent, and PRs reviewed by Hassan before merge. **Replit Agent is not
used in this repo** — see ADR-010 in the Tool Stack Decision Record for
context.

If you are the implementing agent, your job is narrow: execute exactly the
prompt you are given. If the prompt is ambiguous, stop and ask. Do not guess.
Do not improve. Do not refactor. Do not consolidate. Open a PR with the
specified scope, nothing more.

## Cursor Cloud specific instructions

- **Toolchain:** Node 22 and pnpm 10 are pre-installed via nvm. No additional
  runtime setup is needed.
- **Pre-scaffold state:** Until Prompt 1 (Initial Scaffold) is merged, there is
  no `package.json` — `pnpm install` and all build/test/lint commands will fail
  with `ERR_PNPM_NO_PKG_MANIFEST`. This is expected.
- **Update script:** The VM startup script guards `pnpm install` behind
  `test -f package.json` so it is safe in both pre- and post-scaffold states.
- **No external services for local dev (yet):** Supabase, Inngest, and other
  integrations are not required until services are implemented. Tests use
  synthetic fixtures and mocks.
- **Build/test/lint/typecheck commands** are documented in the
  "Build and test commands" section above. All four must pass before opening a PR.
