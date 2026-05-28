# @ncp/cursor-launch

Reusable launcher for Cursor cloud agents working on this repo.

The whole point of this tool is that **the only thing that changes between runs is the prompt**. Everything else — model, repo, starting branch, auto-PR — is hardcoded in `src/config.ts` so we don't accidentally drift between launches.

## What gets hardcoded

| Setting | Value | Why |
|---|---|---|
| Model | `claude-opus-4-8` | Hassan asked for Opus 4.8 (or 4.7 if 4.8 unavailable). 4.8 is live in Cursor's docs as of 2026-05-28. |
| Repo | `https://github.com/TSGCFO/nexfortis-content-pipeline` | The only repo this pipeline operates on. |
| Starting ref | `main` | Every prompt is launched from latest `main`. Cursor's cloud agent forks its own `cursor/<branch>` for the work. |
| autoCreatePR | `true` | Standard review workflow — agent finishes → PR opens → Computer reviews. |

## What does change per run

Just one thing: **the prompt text**.

## Usage

```bash
# From a file (typical — Computer drafts a prompt and Hassan reviews it before launch)
nfx-cursor-launch --prompt-file ./next-prompt.md

# From stdin (handy for piping out of another script)
cat ./next-prompt.md | nfx-cursor-launch --stdin

# Block until the cloud agent's run terminates and dump branch + PR URL
nfx-cursor-launch --prompt-file ./next-prompt.md --wait
```

Set `CURSOR_API_KEY` in the environment first. The script refuses to launch without it.

## Default mode: verify-started

By default the script launches the cloud agent and then **waits** until Cursor confirms the agent has actually started a session (status transitions from `CREATING` → `RUNNING`). Only then does the script print the agent ID, run ID, and Cursor Web URL, and exit.

This is the "verification" the user asked for. Just getting an agent ID back from `Agent.create` isn't enough — the VM could still fail to provision. We don't claim success until the agent is actually doing work.

Default timeout for the `CREATING → RUNNING` transition: **5 minutes**. If the agent doesn't reach `RUNNING` in that window, the script exits with code 2.

## Optional: `--wait` mode

Pass `--wait` and the script will block until the run terminates (status `finished`, `error`, or `cancelled`). On exit it prints the auto-generated branch name and PR URL in the final JSON output.

This is useful for CI / batch flows. For interactive use, leave it off — the default mode hands you back to your terminal in under a minute.

## Output

Human-readable logs go to **stderr**. The script writes a single JSON object to **stdout** at the end so you can `... | jq` it:

```json
{
  "agentId": "bc-...",
  "runId": "run-...",
  "cursorWebUrl": "https://cursor.com/agents/bc-...",
  "verifiedRunning": true
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

## Building

```bash
pnpm --filter @ncp/cursor-launch build
```

Then either run `node tools/cursor-launch/dist/cli.js ...` or, after `pnpm install` at the repo root, use the `nfx-cursor-launch` bin link.

## Verification against docs

The shape of `Agent.create({ cloud: { repos, autoCreatePR } })`, the `SDKStatusMessage` lifecycle (`CREATING | RUNNING | FINISHED | ERROR | CANCELLED | EXPIRED`), and the model ID `claude-opus-4-8` were all verified against the snapshot in `docs/external/cursor-docs/` on 2026-05-28. If Cursor changes any of those, the script will surface the error in its output and we'll know to refresh.
