# Cursor Documentation — Local Snapshot

This folder contains a complete snapshot of Cursor's public documentation, scraped via Firecrawl on 2026-05-28. We keep it in-repo so the Cursor Cloud Agent launcher script (`tools/cursor-launch/`) and any future Cursor automation can be grounded in actual, verified docs rather than hallucinated API shapes.

## What's here

- 116 markdown files (115 unique pages + 1 `.md` mirror of the slash-commands reference)
- `_manifest.json` — machine-readable index mapping source URL → local file
- All files have a `<!-- Source: ... -->` header pointing back to the original URL

## Coverage

- **Cloud Agents API** (`/v1/agents` endpoints, webhooks, OpenAPI v0)
- **TypeScript SDK** (`@cursor/sdk`)
- **Python SDK**
- **CLI** (overview, headless, ACP, GitHub Actions, slash commands, configuration)
- **Models** — every current and recent Claude model page (Opus 4.5/4.6/4.7/4.8, Sonnet 4/4.5/4.6/1m, Haiku 4.5) plus Composer 2.5
- **Customization** (rules, skills, subagents, hooks, MCP, plugins)
- **Cloud Agent operations** (setup, automations, self-hosted pool, K8s, Cloud Run, security, bugbot)
- **Agent** (overview, agents-window, prompting, plan mode, agent-review, security, tools)
- **Integrations** (Slack, MS Teams, Jira, Linear, GitHub, GitLab, JetBrains, Xcode, Cursor Blame)
- **Teams** (setup, members, SSO, SCIM, pricing, dashboard, analytics, admin API, analytics API, AI-code-tracking API)
- **Enterprise** (overview, IAM, network config, endpoint security, LLM safety, model management, pooled usage, compliance, BAA, deployment patterns, service accounts, billing groups)
- **Account & configuration** (regions, update access, request-based legacy pricing, vscode migrations, worktrees, AWS Bedrock)
- **Reference** (deeplinks, ignore-file, keyboard shortcuts, permissions, plugins, sandbox, third-party hooks)

## How to refresh

Re-run the Firecrawl crawl with `https://cursor.com/docs` as the root and the same `includePaths` filter (api/, sdk/, cloud-agent/, cli/, agent/, models/, rules, skills, subagents, hooks, mcp, plugins, reference/).

## What this is NOT

- Not a fork — these are read-only reference copies
- Not auto-updated — refresh manually when Cursor releases something we care about
- Not authoritative for production code — always confirm against the live docs URL in the header before relying on a specific shape

## Why we keep it

The launcher script in `tools/cursor-launch/` reads the `@cursor/sdk` API surface (cloud agent creation, model IDs, repo config) from these docs to stay accurate without re-scraping every time we tweak it.
