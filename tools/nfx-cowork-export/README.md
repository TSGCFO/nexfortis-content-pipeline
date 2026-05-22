# @ncp/cowork-export

Local CLI that reads Cowork on-disk session data and emits one normalized, redacted, schema-validated JSON file per session for the NexFortis content pipeline ingester.

## What this is

The NexFortis content pipeline ingests Hassan's daily expertise from several sources. Cowork (Anthropic's desktop AI tool) accounts for roughly 90% of his real technical work, but Anthropic's web export does not include Cowork sessions — those live only on the local machine.

This tool walks the local Cowork data folder, filters out family-law content, scheduled-task runs, system noise, and tool-call payloads, and produces one clean JSON file per kept session. The output is then picked up by the pipeline ingester (separate, not yet implemented).

## Status

| Component | Status |
|---|---|
| Output schema (`src/schema.ts`) | ✅ v1 locked |
| Schema validator (`src/validator.ts`) | ✅ shipped |
| File discovery / walker | ✅ slice 2 |
| Session metadata pre-filter (slug blocklist, account allowlist, cwd pre-check) | ✅ slice 2 |
| `--dry-run` audit report (stdout) | ✅ slice 2 |
| Per-event filtering and normalization | ✅ slice 3 |
| Tool-call summary registry (10 bespoke extractors) | ✅ slice 3 |
| Post-filter checks (tiny-session + cwd-majority) | ✅ slice 3 |
| Subagent stitching (recursive, non-acompact only) | ⏳ slice 4 |
| Auto-continuation scaffold strip + `continuationGroupId` | ⏳ slice 4 |
| PII regex pass (shared `@ncp/redaction`) | ⏳ slice 5 |
| CLI wrapper (`--input`, `--output`, `--dry-run`, etc.) | ⏳ slice 5 |
| Audit log (stdout + sidecar) | ⏳ slice 5 |
| Single-binary packaging via `bun build --compile` | ⏳ slice 6 |

## Install

Inside the `nexfortis-content-pipeline` pnpm workspace:

```bash
pnpm install
pnpm --filter @ncp/cowork-export build
```

## Quick start (planned, not yet functional)

```powershell
# 1. Create your allowlist files (one-time).
mkdir $env:APPDATA\nfx-cowork-export
cp cwd-allowlist.example.json    $env:APPDATA\nfx-cowork-export\cwd-allowlist.json
cp account-allowlist.example.json $env:APPDATA\nfx-cowork-export\account-allowlist.json
cp family-law-slugs.example.json  $env:APPDATA\nfx-cowork-export\family-law-slugs.json
# Then edit each file to fit your environment.

# 2. Dry-run against your live Cowork data to see what would be exported.
nfx-cowork-export --dry-run

# 3. If the dry-run summary looks right, run for real.
nfx-cowork-export
```

## Configuration

Three configuration files live outside the repo so personal data never lands in version control:

| File | Purpose | Default location |
|---|---|---|
| `cwd-allowlist.json` | Allow / deny lists for which working directories' sessions to ingest | `%APPDATA%\nfx-cowork-export\cwd-allowlist.json` on Windows; `~/.config/nfx-cowork-export/cwd-allowlist.json` on Linux/macOS |
| `family-law-slugs.json` | List of session slugs whose content must be excluded | same dir |
| `account-allowlist.json` | List of Cowork account emails to ingest from | same dir |

The example files in this directory document the shape of each. The exporter ships **fail-closed** — if `cwd-allowlist.json` does not exist, the tool refuses to run and prints the example path.

## CLI surface (planned)

```
nfx-cowork-export
  --input <cowork-data-dir>          [default: %APPDATA%\Claude\local-agent-mode-sessions on Windows]
  --output <dir>                      [default: data/imports/claude-cowork/]
  --cwd-allowlist <path>              [default: ~/.config/nfx-cowork-export/cwd-allowlist.json]
  --family-law-blocklist <path>       [default: ~/.config/nfx-cowork-export/family-law-slugs.json]
  --account-allowlist <path>          [default: ~/.config/nfx-cowork-export/account-allowlist.json]
  --dry-run                           [parse, filter, validate, write nothing]
  --verbose                           [per-session decisions to stdout]
  --validate-output <path>            [validate an existing emitted JSON file against the schema; standalone mode]
```

## Output schema

See `src/schema.ts` for the source-of-truth zod schema, and `CHANGELOG.md` for the version history.

## Read-only

This tool never writes back to Cowork's data folders. All output goes to the configured output directory.

## Testing

```bash
pnpm test   # runs the workspace-wide vitest suite, including this package
```

Tests live at the repo root under `tests/cowork-export/` per the workspace convention. Slice 1 tests cover schema acceptance/rejection across all event kinds and the validator's success/failure paths. Real-data round-trip tests come in slice 2+.
