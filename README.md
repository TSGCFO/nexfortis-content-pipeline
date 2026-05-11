# nexfortis-content-pipeline

Backend automation system that produces SEO-ranked blog content for [nexfortis.com](https://nexfortis.com) by continuously capturing Hassan's daily expertise (Claude chats, Perplexity threads, Microsoft 365 email, Teams call transcripts, voice notes) and turning it into draft articles with a journalist-mode interview bot, SEOwind drafting, and a multi-stage quality gate before final human approval in Sanity CMS.

> **Status: Specification complete. Implementation not yet started.**
> All planning docs live under [`docs/ways-of-work/plan/content-pipeline-v2/`](./docs/ways-of-work/plan/content-pipeline-v2/). Start with the [Epic PRD](./docs/ways-of-work/plan/content-pipeline-v2/epic-prd.md).

---

## Where to start

| If you want to... | Read |
|---|---|
| Understand the whole project at a glance | [Epic PRD](./docs/ways-of-work/plan/content-pipeline-v2/epic-prd.md) |
| Understand what each subsystem does | The four Feature PRDs in `docs/ways-of-work/plan/content-pipeline-v2/<feature>/prd.md` |
| Understand the technical architecture | [Architecture & Data Model](./docs/ways-of-work/plan/content-pipeline-v2/architecture-and-data-model.md) |
| Understand why we picked the tools we did | [Tool Stack Decision Record](./docs/ways-of-work/plan/content-pipeline-v2/tool-stack-decision-record.md) |
| Start building | [Implementation Roadmap](./docs/ways-of-work/plan/content-pipeline-v2/implementation-roadmap.md) → then [Cursor / Claude Code Prompt Library](./docs/ways-of-work/plan/content-pipeline-v2/cursor-claude-prompt-library.md) → Prompt 1 |
| Understand why v2 supersedes v1 | [v1 Amendment Note](./docs/ways-of-work/plan/content-pipeline-v2/v1-amendment-note.md) |

---

## Implementer model

This project is implemented by **Cursor agents (cloud + local) and Claude Code**, with prompts authored by Hassan and Computer (the orchestrating AI). PRs are reviewed by Hassan before merge. See ADR-010 in the Tool Stack Decision Record for why Replit Agent was deliberately not used here.

Behavioral constraint files are **already authored and committed** at the repo root. They are strategist-authored — implementing agents (Cursor, Claude Code) must never modify them:

- [`AGENTS.md`](./AGENTS.md) — repo-level instructions for any AI agent (purpose, architecture, hard rules)
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code-specific quick-read
- [`.cursorrules`](./.cursorrules) — legacy Cursor pointer file
- [`.cursor/rules/repo-conventions.mdc`](./.cursor/rules/repo-conventions.mdc) — always-on conventions
- [`.cursor/rules/prompt-discipline.mdc`](./.cursor/rules/prompt-discipline.mdc) — how to execute prompts from the library
- [`.cursor/rules/context-files.mdc`](./.cursor/rules/context-files.mdc) — explicit "do not edit context files" rule
- [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md) — PR description template referenced by every prompt
- [`.editorconfig`](./.editorconfig), [`.gitignore`](./.gitignore), [`.env.example`](./.env.example) — formatting, ignores, env var documentation

These files are stable system-prompt injection. Cursor and Claude Code respect them reliably. If an implementing agent thinks one needs to change, the rule is: **stop and add a `// TODO(hassan):` note in the PR description** — do not edit the file. Prompt 1 (Initial Scaffold) explicitly excludes all of these from its allowed-file list.

---

## Shared resources (services, not code)

| Resource | Shared with | Notes |
|---|---|---|
| Supabase project / database | Main NexFortis monorepo (`NexFortis-Website-Design-pro`) | New tables live alongside existing blog tables |
| Sanity project / dataset | Main monorepo | Pipeline writes drafts; blog reads as it already does |
| Microsoft Entra app registration | Main monorepo | Additional Graph scopes added |
| OpenAI / Anthropic / Telegram accounts | Hassan's accounts | Separate API keys per project |
| Render hosting account | Hassan's account | New Render service for pipeline workers |

The code, CI, and deployment for this repo are fully isolated from the main monorepo.

---

## Next step

Run [Prompt 1: Initial Scaffold](./docs/ways-of-work/plan/content-pipeline-v2/cursor-claude-prompt-library.md#prompt-1-initial-scaffold) in Cursor or Claude Code.
