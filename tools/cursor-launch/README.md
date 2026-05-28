# @ncp/cursor-launch

Reusable launcher for Cursor cloud agents working on this repo.

The point of this tool is to **make launching consistent and scriptable**. The repo, the auto-PR behaviour, the verification-that-it-actually-started — those stay the same every time. What varies (model, params, PR attach, env vars, MCP servers) is exposed as CLI flags so you don't get stuck in workflow-stalling situations where the launcher is missing one knob.

**Before first use:** read [SETUP.md](./SETUP.md). There are a few one-time settings you need to flip in your Cursor team dashboard.

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
| `--model-param <id=value>` | `thinking=high` if the model accepts it | Per-model params. Repeatable. |
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

Example `mcp.json`:

```json
{
  "linear": {
    "type": "http",
    "url": "https://mcp.linear.app/sse",
    "headers": { "Authorization": "Bearer YOUR_LINEAR_KEY" }
  },
  "github": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN" }
  }
}
```

## Default mode: verify-started

By default the launcher sends the prompt, then **waits** until Cursor confirms the agent has actually started a session — status transitions from `CREATING` → `RUNNING`. Only then does the script print the agent ID, run ID, and Cursor Web URL, and exit.

This is the "verification" requirement: just getting an agent ID back from `Agent.create` isn't enough — the VM could still fail to provision. We don't claim success until the agent is actually doing work.

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

## Verification against docs

Every API shape used here was verified against the Cursor docs snapshot in `docs/external/cursor-docs/` on 2026-05-28:

- `Agent.create({ cloud: { repos, autoCreatePR, workOnCurrentBranch, envVars } })` — `cursor.com_docs_sdk_typescript.md` (CloudOptions table)
- `repos[0].prUrl` — `cursor.com_docs_cloud-agent_api_endpoints.md` (Create An Agent → Request Body)
- `mode: "plan" | "agent"` — `cursor.com_docs_sdk_typescript.md` (Conversation mode)
- `mcpServers` (inline) — `cursor.com_docs_sdk_typescript.md` (McpServerConfig)
- `Cursor.models.list()` — `cursor.com_docs_sdk_typescript.md` (Cursor.models.list)
- `SDKStatusMessage` lifecycle (`CREATING | RUNNING | FINISHED | ERROR | CANCELLED | EXPIRED`) — same file

If Cursor changes any of these, the launcher will surface the error in its output and we'll know to refresh.
