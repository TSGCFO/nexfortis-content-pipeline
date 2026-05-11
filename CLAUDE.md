# CLAUDE.md

Instructions for Claude Code when working in this repository. This file is
intentionally short — the canonical agent guide is [AGENTS.md](./AGENTS.md).
Read AGENTS.md first.

## Where to find things

- **Agent guide:** [AGENTS.md](./AGENTS.md)
- **Cursor rules** (also apply to Claude Code conceptually):
  [.cursor/rules/](./.cursor/rules/)
- **Planning docs:** [`docs/ways-of-work/plan/content-pipeline-v2/`](./docs/ways-of-work/plan/content-pipeline-v2/)
- **Prompt library** (the source of all implementation tasks):
  [`docs/ways-of-work/plan/content-pipeline-v2/cursor-claude-prompt-library.md`](./docs/ways-of-work/plan/content-pipeline-v2/cursor-claude-prompt-library.md)

## Hard rules

These are the same rules as `AGENTS.md` and `.cursor/rules/`, restated here
for Claude Code's first-read:

- **One prompt = one PR.** Do not combine prompts.
- **Stay strictly inside each prompt's allowed-file list.** Do not refactor
  adjacent code. Do not auto-format files outside the allowlist.
- **Never edit context files** (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `.editorconfig`, `.gitignore`,
  `.env.example`). If a behavior change is needed, stop and add a
  `// TODO(hassan):` note in the PR description.
- **`docs/` is read-only.** Specs are the source of truth — code follows
  specs.
- **Use pnpm.** Never `npm` or `yarn`.
- **No `.env` files committed.**
- **No new top-level dependencies** outside the active prompt's allowlist.
- **No dependency version bumps** beyond what the prompt allows.
- **No changes to `lib/db` schemas** unless the active prompt explicitly
  names the table.
- **No PII / family-law / personal content** in the corpus. `lib/redaction`
  is fail-closed. Use synthetic fixtures for testing.
- **Use "collect", "extract", "browse", "read"** — never "scrape" or "crawl".
- **TypeScript strict.** No `any`. All async in try/catch with structured
  `lib/logger` calls.
- **Run `pnpm typecheck && pnpm test && pnpm lint && pnpm build`** before
  opening any PR.

## What Claude Code is for in this repo

Claude Code is used for tasks where its CLI-driven, file-aware editing
strengths shine — most prompts in the Prompt Library, plus surgical fixes
to PRs already produced by Cursor agents. Hassan and Computer (the
strategist) author prompts; Claude Code executes them; Hassan reviews PRs.

Claude Code is **not** used for:
- Editing context files (those are strategist-only)
- Making cross-cutting refactors (one-prompt scope only)
- Anything Hassan has not explicitly asked for in an active prompt

## If you are unsure

Stop. Ask. Do not guess. Cursor's track record on unstated assumptions in
this project's pre-history is the reason these rules exist.
