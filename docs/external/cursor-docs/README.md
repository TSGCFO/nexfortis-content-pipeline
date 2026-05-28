# Cursor Documentation — Local Snapshot

This folder contains a complete snapshot of Cursor's public documentation, scraped via Firecrawl on 2026-05-28. We keep it in-repo so the Cursor Cloud Agent launcher script (`tools/cursor-launch/`) and any future Cursor automation can be grounded in actual, verified docs rather than hallucinated API shapes.

## What's here

- 69 markdown files, one per Cursor docs page
- `_manifest.json` — machine-readable index mapping source URL → local file
- All files have a `<!-- Source: ... -->` header pointing back to the original URL

## Coverage

- **Cloud Agents API** (`/v1/agents` endpoints, webhooks, OpenAPI v0)
- **TypeScript SDK** (`@cursor/sdk`)
- **Python SDK**
- **CLI** (overview, headless, ACP, GitHub Actions, slash commands, configuration)
- **Models** (Claude Opus 4.7, 4.8, Composer 2.5, etc. — model IDs, pricing, capabilities)
- **Customization** (rules, skills, subagents, hooks, MCP)
- **Cloud Agent operations** (setup, automations, self-hosted pool, K8s, Cloud Run, security)
- **Teams/Enterprise** (admin API, analytics API, AI-code-tracking API, service accounts)
- **Agent** (overview, prompting, plan mode, tools — browser/canvas/search/terminal)

## How to refresh

Re-run the Firecrawl crawl with `https://cursor.com/docs` as the root and the same `includePaths` filter (api/, sdk/, cloud-agent/, cli/, agent/, models/, rules, skills, subagents, hooks, mcp, plugins, reference/).

## What this is NOT

- Not a fork — these are read-only reference copies
- Not auto-updated — refresh manually when Cursor releases something we care about
- Not authoritative for production code — always confirm against the live docs URL in the header before relying on a specific shape

## Why we keep it

The launcher script in `tools/cursor-launch/` reads the `@cursor/sdk` API surface (cloud agent creation, model IDs, repo config) from these docs to stay accurate without re-scraping every time we tweak it.
