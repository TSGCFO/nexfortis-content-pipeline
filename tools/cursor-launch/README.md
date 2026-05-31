# @ncp/cursor-launch

Reusable launcher for Cursor cloud agents working on this repo.

The point of this tool is to **make launching consistent and scriptable**. The repo, the auto-PR behaviour, the verification-that-it-actually-started — those stay the same every time. What varies (model, params, PR attach, env vars, MCP servers) is exposed as CLI flags so you don't get stuck in workflow-stalling situations where the launcher is missing one knob.

The launcher talks to Cursor via plain HTTPS (REST + polling) using Node's global `fetch`. It does not depend on `@cursor/sdk` because the SDK does not respect `HTTPS_PROXY`, which makes it incompatible with credential-proxy setups. Plain REST works through any well-behaved HTTPS proxy (including the Perplexity credential proxy) so the API key never has to leave the proxy.

**Before first use:** read [SETUP.md](./SETUP.md). There are a few one-time settings you need to flip in your Cursor team dashboard, plus instructions for the credential.

## What's hardcoded

| Setting | Value | Why |
|---|---|---|
| Repo | `https://github.com/TSGCFO/nexfortis-content-pipeline` | The only repo this pipeline operates on. |
| Starting ref (no PR) | `main` | Every fresh launch starts from latest `main`. Cursor's cloud agent forks its own `cursor/<branch>` for the work. |
| `autoCreatePR` | `true` | Standard review workflow — agent finishes → PR opens → human reviews. |

## What's exposed as CLI flags

| Flag | Default | What it controls |
|---|---|---|
| `--prompt-file <path>` or `--stdin` | required | The prompt text. |
| `--model <id>` | first available from `[claude-opus-4-8, claude-opus-4-7]` | Override the model. |
| `--model-param <id=value>` | snapped to a valid variant from `[thinking=true, context=1m, effort=max, fast=false]` preferences | Per-model params. Cursor only accepts complete declared variants — the launcher walks `/v1/models` variants and picks the closest match to your preferences, then your CLI flags override on a per-axis basis. Repeatable. |
| `--pr-url <url>` | none | Attach to an existing PR. Auto-enables `workOnCurrentBranch` so commits push back to that PR's branch. |
| `--env KEY=value` | none | Inject a session-scoped env var into the cloud VM. Repeatable. **Beta feature in Cursor.** |
| `--mcp <file.json>` | none | Inline MCP server definitions for this run. |
| `--name <text>` | auto from prompt | Human-readable label in Cursor Web. |
| `--plan` | off | Start in plan mode (research before coding). |
| `--wait` | off | Block until the run terminates. Default exits as soon as `RUNNING`. |

## Common flows

```bash
# Fresh launch from main, latest Opus, thinking=high (the common case):
nfx-cursor-launch --prompt-file ./next-prompt.md

# Fixup prompt on an existing PR — auto pushes commits to that PR's branch:
nfx-cursor-launch --prompt-file ./fixup.md --pr-url https://github.com/TSGCFO/nexfortis-content-pipeline/pull/42

# Force a specific model:
nfx-cursor-launch --prompt-file ./p.md --model claude-opus-4-7

# Override params:
nfx-cursor-launch --prompt-file ./p.md --model-param thinking=high --model-param fast=true

# Inject session env vars (beta):
nfx-cursor-launch --prompt-file ./p.md --env STAGING_TOKEN=abc123 --env DB_URL=postgres://...

# Plan mode for a big refactor:
nfx-cursor-launch --prompt-file ./big-refactor.md --plan

# With inline MCP servers from JSON:
nfx-cursor-launch --prompt-file ./p.md --mcp ./mcp.json
```

Example `mcp.json` (array form, recommended):

```json
[
  {
    "name": "linear",
    "type": "http",
    "url": "https://mcp.linear.app/sse",
    "headers": { "Authorization": "Bearer YOUR_LINEAR_KEY" }
  },
  {
    "name": "github",
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN" }
  }
]
```

Object-map form `{ name: config }` is also accepted for convenience.

## Default mode: verify-started

By default the launcher sends the prompt, then **polls** `GET /v1/agents/{id}/runs/{runId}` every 4 seconds until Cursor confirms the agent has reached `RUNNING`. Only then does the script print the agent ID, run ID, and Cursor Web URL, and exit.

This is the "verification" requirement: just getting an agent ID back from `POST /v1/agents` isn't enough — the VM could still fail to provision. We don't claim success until the agent is actually doing work.

We poll rather than subscribe to Cursor's SSE `/stream` endpoint because SSE doesn't work reliably through every HTTPS proxy. Polling is simpler, fewer moving parts, and the single state transition we care about doesn't need real-time push.

Default timeout for `CREATING → RUNNING`: **5 minutes** (configurable in `src/config.ts`). If exceeded, exits with code 2.

## Optional: `--wait` mode

Pass `--wait` and the launcher blocks until the run terminates (status `finished`, `error`, or `cancelled`). On exit it prints the auto-generated branch name and PR URL in the final JSON output. Useful for CI / batch flows.

## Output

Human-readable logs go to **stderr**. The launcher writes a single JSON object to **stdout** at the end so you can `... | jq` it:

```json
{
  "agentId": "bc-...",
  "runId": "run-...",
  "cursorWebUrl": "https://cursor.com/agents/bc-...",
  "verifiedRunning": true,
  "resolvedModel": {
    "id": "claude-opus-4-8",
    "params": [{ "id": "thinking", "value": "high" }]
  }
}
```

With `--wait` you also get `finalStatus`, `branch`, `prUrl`, and `resultText`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Agent launched and verified RUNNING (or finished cleanly with `--wait`) |
| 1 | Usage error (bad flags, missing prompt, missing API key) |
| 2 | Agent launched but failed to reach RUNNING (timeout or terminal error during startup) |
| 3 | With `--wait`, run terminated with status `error` or `cancelled` |

## Companion utility: `nfx-cursor-list-models`

Dumps `Cursor.models.list()` to a JSON file so we can see exactly which model IDs and per-model params are available on your account.

```bash
CURSOR_API_KEY=... nfx-cursor-list-models ./cursor-models.json
```

Useful when:

- Anthropic releases a new Opus and you want to confirm the ID before adding it to `modelPreferenceOrder` in `config.ts`
- You're not sure which params a model accepts (e.g. `thinking=high` vs `effort=max`)

## Building

```bash
pnpm --filter @ncp/cursor-launch build
```

Then run the CLI directly:

```bash
node tools/cursor-launch/dist/cli.js --help
```

Or after `pnpm install` at the repo root, use the `nfx-cursor-launch` / `nfx-cursor-list-models` bin links.

## Verification against docs and live API

Every REST endpoint used here was verified against:

- The docs snapshot in `docs/external/cursor-docs/cursor.com_docs_cloud-agent_api_endpoints.md` (Create An Agent, List Models, Stream A Run)
- The live `/v1/models` response committed to `docs/external/cursor-models.json` (snapshot 2026-05-29)

Key verified facts:

- Endpoint base: `https://api.cursor.com`
- Auth: `Authorization: Bearer <api_key>`
- Available models on this account include `claude-opus-4-8`, `claude-opus-4-7`, `gpt-5.5`, `composer-2.5`, `claude-sonnet-4-6`
- Opus 4.8 accepts only declared variants of `(thinking, context, effort, fast)` — you cannot send arbitrary param combos
- Default variant for Opus 4.8: `thinking=true, context=1m, effort=high, fast=false`
- Run-status lifecycle: `CREATING | RUNNING | FINISHED | ERROR | CANCELLED | EXPIRED`

If Cursor changes any of these, the launcher will surface the error in its output (Cursor returns clean JSON errors with `code` + `message`) and we'll know what to fix.
