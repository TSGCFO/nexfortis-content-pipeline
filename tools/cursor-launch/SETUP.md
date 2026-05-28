# One-time setup for the Cursor launcher

A few things have to be configured in your Cursor team dashboard before this launcher can do what you want. These are **team-level settings, not per-launch API fields** — Cursor does not expose them as request parameters, so the launcher cannot set them programmatically. Once flipped, they apply to every cloud agent.

## In Cursor Web

Go to [cursor.com/dashboard](https://cursor.com/dashboard) and:

### 1. Cloud Agents → Settings → Team feature settings

- **Long running agents** → **on**. Without this, big multi-hour refactors can get cut off. The doc that confirms this is `cursor.com/docs/cloud-agent/settings` (also mirrored in `docs/external/cursor-docs/cursor.com_docs_cloud-agent_settings.md`).

### 2. Cloud Agents → Settings → Security settings

- **Display agent summary** → **on**. So the agent's file-diff images and code snippets show up in the sidebar / external channels.
- **Display agent summary in external channels** → **on**. If you have Slack/Teams hooked up and want PR notifications to include the diff preview.

### 3. Cloud Agents → Settings → Network access settings

Decide between:

- **Allow all network access** — simplest. The agent can talk to anything during the run.
- **Default + allowlist** — Cursor's default safe set, plus whatever you add.
- **Allowlist only** — strictest. You curate every domain.

The launcher does not set this; it uses whatever your team has configured.

### 4. (Optional) Cloud Agents → Webhooks

If you want a webhook to fire on `statusChange` (ERROR / FINISHED), set a URL once at the team level. We don't use one yet but it's useful if you build automated PR-monitoring later. Verified at `cursor.com/docs/cloud-agent/api/webhooks`.

### 5. Generate an API key

Go to [Integrations](https://cursor.com/dashboard/integrations) and create a Cursor API key. Save it somewhere safe — you'll either:

- Export it as `CURSOR_API_KEY` in your shell before running the launcher, OR
- Save it as a Computer custom credential and have me inject it (preferred — keeps it out of your shell history)

## In the repo

Already done — these are committed:

- `tools/cursor-launch/` — the launcher
- `docs/external/cursor-docs/` — 116-file snapshot of Cursor's docs
- `pnpm.onlyBuiltDependencies` in root `package.json` — so `@cursor/sdk`'s native bindings build on `pnpm install`

## Quick verification once everything is in place

```bash
# 1. Capture the authoritative model + params snapshot
CURSOR_API_KEY=... pnpm --filter @ncp/cursor-launch start:list-models docs/external/cursor-models.json

# 2. Trivial test launch (with --wait so we see the full lifecycle)
echo "Add a one-line comment to README.md explaining what this repo is about. Open a PR." \
  | CURSOR_API_KEY=... pnpm --filter @ncp/cursor-launch exec nfx-cursor-launch --stdin --wait
```

If step 2 reaches `RUNNING` and eventually opens a PR, the launcher is wired up correctly.
