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
| Subagent stitching (recursive, non-acompact only) | ✅ slice 4 |
| Auto-continuation scaffold strip + `continuationGroupId` | ✅ slice 4 |
| PII regex pass (shared `@ncp/redaction`) | ✅ slice 5 |
| JSON emission (atomic write, schema-validated, one file per transcript) | ✅ slice 5 |
| CLI wrapper (`--input`, `--output`, `--dry-run`, `--validate-output`, etc.) | ✅ slice 5 |
| Audit log (stdout + sidecar `_audit-<ts>.txt`) | ✅ slice 5 |
| OS-specific config-path defaults (Windows / Linux / macOS) | ✅ slice 5 |
| Single-binary packaging via `bun build --compile` (Linux x64 + Windows x64) | ✅ slice 6 |

## Install

Inside the `nexfortis-content-pipeline` pnpm workspace:

```bash
pnpm install
pnpm --filter @ncp/cowork-export build
```

## Quick start

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

## CLI surface

```
nfx-cowork-export
  --input <cowork-data-dir>          [default: %APPDATA%\Claude\local-agent-mode-sessions on Windows]
  --output <dir>                      [default: data/imports/claude-cowork/]
  --cwd-allowlist <path>              [default: ~/.config/nfx-cowork-export/cwd-allowlist.json on Linux/macOS;
                                       %APPDATA%\nfx-cowork-export\cwd-allowlist.json on Windows]
  --family-law-blocklist <path>       [default: ~/.config/nfx-cowork-export/family-law-slugs.json on Linux/macOS;
                                       %APPDATA%\nfx-cowork-export\family-law-slugs.json on Windows]
  --account-allowlist <path>          [default: ~/.config/nfx-cowork-export/account-allowlist.json on Linux/macOS;
                                       %APPDATA%\nfx-cowork-export\account-allowlist.json on Windows]
  --dry-run                           [parse, filter, validate, write nothing]
  --verbose                           [per-session decisions to stdout]
  --validate-output <path>            [validate an existing emitted JSON file against the schema; standalone mode]
```

## Output schema

See `src/schema.ts` for the source-of-truth zod schema, and `CHANGELOG.md` for the version history.

## Audit log

Every run writes a human-readable audit report to stdout AND to a sidecar file
`<output-dir>/_audit-<ISO-timestamp>.txt`. The sidecar persists run history so
you can answer questions like "what got dropped last Tuesday" without re-running.
The audit covers:

- Total sessions discovered + kept + dropped-by-reason
- Per-session compression ratios (lines in → events out)
- Per-account and per-source-branch counts of kept sessions
- Family-law slug matches (SHA-256 hashes only — slugs never logged)
- Parse failures (counted, file abandoned if >5% of lines fail to parse)
- PII redaction summary by type (email / phone / cc / ipv4 / ipv6)
- JSON emission stats (files written + validation failures)

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Unhandled error |
| 2 | Missing config file (one of the three allowlists) |
| 3 | Invalid config file (JSON parse error or shape mismatch) |
| 4 | At least one emitted file failed schema validation (NORMAL mode) |
| 5 | `--validate-output` reported the target file invalid (or unparseable JSON in the target) |

## Standalone validation

To check that a previously emitted file still validates against the v1 schema
(useful after pulling new ingester code that bumped its expectations):

```bash
nfx-cowork-export --validate-output path/to/some-session.json
```

Exits 0 on pass, 5 on fail. Prints sessionId + event count on pass, schema
error path on fail.

## Binary releases

Slice 6 ships single-binary distributables that embed the JavaScriptCore
runtime, so you can use the tool without installing Node, pnpm, or any
dependencies.

### Build

From the repo root:

```bash
pnpm --filter @ncp/cowork-export run package:bun        # both targets
pnpm --filter @ncp/cowork-export run package:bun:linux  # Linux x64 only
pnpm --filter @ncp/cowork-export run package:bun:windows # Windows x64 only
```

Build prerequisites: [bun](https://bun.sh/) installed on the build host
(used as the bundler/cross-compiler; the resulting binary does not depend
on bun being installed on the target machine).

### Output

Binaries land in `tools/nfx-cowork-export/dist/bin/`:

| Target | Filename | Size |
|---|---|---|
| Linux x64 | `nfx-cowork-export-linux-x64` | ~97 MB |
| Windows x64 | `nfx-cowork-export-windows-x64.exe` | ~101 MB |

The size is dominated by the embedded runtime; the minified application
code is a few hundred KB.

`dist/` is `.gitignore`d, so binaries are release artifacts only — they
do not commit. Distribute via GitHub Releases attached to the slice 6
integration PR (or whatever release mechanism comes after slice 6).

### Usage

The binary takes the same flags as the Node CLI documented above:

```bash
# Linux / WSL
./nfx-cowork-export-linux-x64 --input /path/to/cowork --output ./out

# Windows (PowerShell)
.\nfx-cowork-export-windows-x64.exe --input "$env:APPDATA\Claude\local-agent-mode-sessions" --output .\out
```

### Install-from-source fallback

If you can't or don't want to use the prebuilt binary, the Node CLI
still works:

```bash
pnpm install
pnpm --filter @ncp/cowork-export build
node tools/nfx-cowork-export/dist/cli.js --input ... --output ...
```

The binary and the Node CLI produce byte-identical JSON output modulo
the `_exporter.exportedAt` timestamp.

## Read-only

This tool never writes back to Cowork's data folders. All output goes to the configured output directory.

## Testing

```bash
pnpm test   # runs the workspace-wide vitest suite, including this package
```

Tests live at the repo root under `tests/cowork-export/` per the workspace convention. The slice 1–6 suite covers: schema acceptance/rejection across all event kinds (slice 1), discovery + session-level filter (slice 2), per-event filter + tool-call summary extractors + post-check (slice 3), subagent stitching + auto-continuation handling (slice 4), PII redaction with the post-redaction 80-char clamp + JSON emission + atomic-write + CLI defaults (slice 5), and the shared utils helpers + env-parameterized CLI defaults (slice 6). 375 tests as of slice 6.

Real-data sanity checks run against Hassan's actual Cowork backup are documented in the slice 5 and slice 6 CHANGELOG entries — those are not part of the automated test suite (they require a local Cowork data folder) but the result counts (files written, validation failures, PII redactions) are recorded so future changes can be checked against them.
