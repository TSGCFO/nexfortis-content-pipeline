# CHANGELOG — @ncp/cowork-export

All notable changes to the output schema and CLI surface of this exporter are documented here.

The output schema is versioned by the integer `schemaVersion` field at the top of every emitted JSON document. The pipeline ingester refuses to consume documents with a `schemaVersion` it does not recognize. Therefore any change to the shape of emitted JSON requires bumping `schemaVersion`, adding an entry below, and shipping all of it in a single commit.

CLI flag changes, internal refactors, and dependency bumps do not require a `schemaVersion` bump but should still be noted under the appropriate version's "Tool" subsection.

## Format

Each released version has the following subsections (omit any that are empty):

- **Schema** — output JSON shape changes. Required when `schemaVersion` bumps.
- **Tool** — CLI flags, package surface, behavior changes that do not alter emitted JSON.
- **Migration** — what consumers (pipeline ingester) need to do to handle the new shape.

---

## [Unreleased]

### Tool (slice 2 — discovery + session-level filter + dry-run CLI; no schemaVersion bump)

This slice does not change the shape of emitted JSON — no JSON is emitted yet. It adds the file walker and the session-level filter pipeline. Output is a dry-run audit report to stdout. Per-event filtering and JSON emission come in slices 3-5.

- **File discovery (`src/discovery.ts`).** Walks a Cowork data root and produces one `SessionDiscovery` per `local_<uuid>` session folder found. Classifies transcripts as parent / subagent / acompact. Excludes `audit.jsonl` (runtime log, not chat). Tolerant of missing / unparseable meta sidecars.
- **Session-level filter (`src/filter-session.ts`).** Eight drop reasons evaluated in priority order: family-law slug match → scheduled-task / command-message / system-path-cwd `initialMessage` prefixes → account allowlist → cwd allowlist (alwaysDeny / alwaysAllow / allowPrefixes three-bucket model with Windows-aware path normalization).
- **Config loader (`src/config.ts`).** Loads three required config files (cwd-allowlist, family-law-slugs, account-allowlist). Fail-closed: throws `ConfigMissingError` on any missing file with a friendly message pointing at the `.example.json` files.
- **Audit module (`src/audit.ts`).** Produces a stdout decision table: header summary (totals + per-reason counts), then per-session rows. Stable ordering. Slice 5 will extend with sidecar file + compression-ratio + zero-event-kept-list.
- **CLI entry point (`src/cli.ts`).** `nfx-cowork-export --input <dir> --cwd-allowlist <path> --family-law-blocklist <path> --account-allowlist <path>`. Reports the audit table to stdout, exits 0 on success, 2 on missing config, 3 on invalid config, 1 on unhandled error.
- **`runDiscovery()` orchestrator** in `src/run-discovery.ts` — exposed so integration tests and (future) the ingester's pre-flight check can use the same pipeline without going through the CLI.
- **New dependencies added to `tools/nfx-cowork-export/package.json`:** `@ncp/redaction` (workspace), `commander` (CLI parsing). Both pinned. `zod` carried forward from slice 1.
- **Workspace integration:** root `vitest.config.ts` adds `@ncp/cowork-export` alias mapping to `tools/nfx-cowork-export/src/index.ts`.

### Library — lib/redaction (slug-blocklist mechanism)

Per the spec ("Family-law blocklist mechanism lives in `lib/redaction` as code"), the slug-matching helper lives in the shared library, not in the exporter package.

- **New: `lib/redaction/src/slug-blocklist.ts`** — exports `checkSlugBlocklist(slug, options)` and `hashSlug(slug)`. Constant-time comparison via `timingSafeEqual`. Returns SHA-256 hex hashes for any matched slug (the slug itself never appears in the result), so the audit log can record matches without leaking personal-context slugs.
- 12 unit tests in `tests/redaction/slug-blocklist.test.ts` covering empty list, non-match, exact match, case-sensitivity, substring rejection, empty-entry tolerance, and the hash-never-leaks-slug invariant.

### Empirical system/progress scan (per spec obligation)

Scanned all 27,803 events across the 65 parent transcripts in Hassan's actual Cowork backup. Findings:

- `system.subtype: compact_boundary` — 30 occurrences. **Matches spec. Drop in slice 3.**
- `system.subtype: local_command` — 1 occurrence. **NOT in spec. New finding.** Content is the stdout of a `/context` slash command (token-usage diagnostic dump). Same category as `compact_boundary`: framework noise, not conversation content. **Decision: drop in slice 3 alongside `compact_boundary`.** Flagged to Hassan in the slice 2 PR description.
- `progress.data.type: hook_progress` — 1 occurrence. **Matches spec ("hook callback plumbing"). Drop in slice 3.**
- No unknown top-level event types.

### Schema (unchanged from slice 1.5)

No emitted-JSON shape changes. `schemaVersion` stays at `1`.

---

## [Previously released]

### Validator (post-slice-1 fix, no schemaVersion bump)

Addresses second-reviewer findings on slice 1. None of these change the shape of emitted JSON — they only change which inputs the validator rejects. `schemaVersion` stays at 1.

- **Strict mode on every object schema.** Previously, zod's default `.object()` silently stripped unknown fields. The validator now uses `.strict()` everywhere (`sessionSchema`, `exporterMetaSchema`, all four event variants including the recursive subagent). Unknown fields are rejected with a clear error path. Rationale: this validator's job is to catch exporter bugs (e.g. a future code change emitting `txt` instead of `text`). Strip mode swallows that silently; strict mode surfaces it immediately. Forward-compatibility for genuinely new fields is handled by `schemaVersion` bumps, not by lax validation.
- **`continuationGroupId` must be non-empty when present.** Changed from `z.string().optional()` to `nonEmptyString.optional()`. An empty string is a bug (the hash failed to compute), not a "no continuation group" signal — omit the field entirely instead.
- **Tests added.** Seven new strictness tests + three continuationGroupId edge-case tests, all in `tests/cowork-export/schema.test.ts`.

### Schema (v1, initial)

- **`schemaVersion`** — `1`. Closed `kind` set for events: `user_text`, `assistant_text`, `tool_call`, `subagent`. Closed `source` value: `claude_cowork`.
- **`_exporter`** — provenance block carrying `name`, `version`, `sourceFormat`, `exportedAt`. Required at top level. Ingester ignores it for dedup purposes (dedup key is `sessionId`).
- **`continuationGroupId`** — optional, present on auto-continuation sessions. Hash formula (locked in v1):
    `sha256("v1|" + sessionSlug + "|" + firstUserMessageAfterScaffoldStrip.trim().slice(0, 200))`
  The `"v1|"` prefix is intentional so a future formula change does not collide. The 200-char slice keeps the hash stable even if the message is long.
- **`cwd` / `gitBranch`** — per-event, not session-level. Sessions legitimately switch directories mid-flow. Session-level `cwds` / `gitBranches` arrays carry uniques seen.
- **All timestamps** — ISO 8601 UTC with millisecond precision and `Z` suffix (`2026-04-08T14:23:11.000Z`). Validation regex pinned in `schema.ts`.
- **`tool_call.summary`** — optional. Omitted entirely when no bespoke extractor exists for the tool (no generic placeholder). Max 80 chars when present.
- **Subagent events** — nested (`events: Event[]` inside `kind: "subagent"`). Recursion supported (subagents-of-subagents).
- **Self-validation** — every emitted file is validated against the zod schema before it touches disk.

### Tool (v0.0.1, initial)

- Slice 1 of the build: schema, validator, package skeleton, example config files. No parser, no CLI runtime yet.
