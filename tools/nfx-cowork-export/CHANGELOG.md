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

### Tool (post-slice-6 data-contract fixes; no schemaVersion bump)

Four bugs Perplexity caught reviewing Hassan's runs 1–4. All four are data-contract issues — wrong values in fields that already exist in the schema. `schemaVersion` stays at `1`.

**Bug 1: `subagentSlug` contained the full source file path** (`stitch.ts:186`). Old code did `matched.file.split('/').pop()` which only handles POSIX separators. On Windows hosts, the source path uses `\` and passes through unchanged — so emitted JSONs carried strings like `"C:\\Users\\HassanSadiq\\AppData\\...\\subagents\\agent-a68b00e493569b47e"` instead of just `"agent-a68b00e493569b47e"`. Three concrete problems: Windows-specific paths embedded in cross-platform JSON; the user's Windows account name leaked into every subagent envelope; the ingester couldn't correlate by slug because the path isn't a stable identifier. Fix normalizes backslashes to forward slashes before splitting, matching the pattern already used by `workspaceIdFromPath`.

**Bug 2: `continuationGroupId` was per-transcript instead of per-chain** (`run-discovery.ts` + `continuation.ts`). Old behavior computed each transcript's groupId from its OWN first user message after scaffold strip. The 3 continuations of `cool-great-franklin` happened to share a hash (their first messages were all `"done"` after scaffold strip — Hassan's brief replies), but the original had a different first message and therefore a different hash — splitting one conversation arc into "1 + 3" downstream. The fix changes the spec: continuations now share ONE groupId derived from the ORIGINAL transcript's first user message, and the original itself carries no groupId. The "original" is identified by `scaffoldStripped === false`. Extracted the assignment logic into a pure helper `assignContinuationGroupIds(transcripts, slug)` in `continuation.ts` for testability.

**Bug 3a: `lastActivityAt` and `createdAt` silently dropped when source meta stored them as numbers.** Cowork's meta JSON stores both as epoch-ms numbers (e.g. `1776112559346`), not as ISO strings. The old `extractSessionMeta` in `discovery.ts:243` only assigned values when `typeof v === 'string'`, so the numbers fell through unhandled and the fields were absent on every emitted JSON. Fix adds an `assignTimestamp(key, v)` helper that accepts both strings and finite numbers and converts numbers to ISO UTC ms via `new Date(v).toISOString()`.

**Bug 3b: `mcpServers` never populated.** Cowork stores remote MCP config under `remoteMcpServersConfig` as an array of `{ uuid, name, tools: [...] }` objects. The old extractor didn't read this field at all. Fix extracts the `name` field from each entry and surfaces them as `meta.mcpServers: string[]`, which `buildSessionDocument` then maps to the schema's `mcpServers: z.array(z.string()).optional()` field. Defensive about malformed entries (missing name, non-object, empty string) — those are skipped.

**Bug 4: `title` absence is intentional behavior.** Cowork generates titles asynchronously after a session is created. Newly-created sessions with no AI-generated title yet legitimately have no `title` field in their source meta JSON. The current `buildSessionDocument` already handles this correctly — `if (meta?.title !== undefined) doc.title = meta.title;` — so the field is emitted only when the source has it. Added an inline comment explaining the optional behavior so future maintainers understand. The PR description includes a PowerShell one-liner for Hassan to run on his actual untitled sessions to confirm the source meta has no title field. If any of them DO have a title in source and weren't surfaced, that's a real parser miss and we'd open a follow-up.

### Real-data verification (May 11 backup, full run)

| Metric | Before | After |
|---|---|---|
| `subagentSlug` containing path/username | 9 envelopes | **0** |
| `cool-great-franklin` chain groupId | 3-1 split | **3 share `sha256:8e60b32c…`, original has no groupId** |
| Files with `lastActivityAt` | 0/35 | **35/35** |
| Files with `mcpServers` | 0/35 | **35/35** (sample: `['composio', 'Gmail', 'Google Calendar']`) |
| Files with `title` (informational) | 29/35 | 29/35 (unchanged — see Bug 4) |
| Validation failures | 0 | 0 |

### Tests added (+19 → workspace total 402)

- `tests/cowork-export/stitch.test.ts` (+3): POSIX path, Windows backslash path (Bug 1 reproducer with username-leak check), mixed-separator path.
- `tests/cowork-export/continuation.test.ts` (+9): formula stability + v1 prefix lock + chain-level rule (3 continuations share one hash, original has no hash, empty-slug graceful, no-first-msg graceful, preset-value preservation).
- `tests/cowork-export/discovery.test.ts` (+7): number-format timestamps for createdAt/lastActivityAt, string format back-compat, malformed timestamp drop, `mcpServers` from `remoteMcpServersConfig`, absent handling, empty-array handling, malformed-entry skipping.

### Schema (unchanged from slice 1.5)

No emitted-JSON shape changes. `schemaVersion` stays at `1`. The four fields touched (`subagentSlug`, `continuationGroupId`, `lastActivityAt`, `mcpServers`) all existed in the schema already; this PR fixes their values, not their existence.

---

### Tool (post-slice-6 fix: remove account-allowlist filter; no schemaVersion bump)

The `account-allowlist.json` config file and the `--account-allowlist` flag are removed. The session-level filter no longer drops sessions based on `meta.emailAddress`.

**Why.** Hassan caught this during his first production end-to-end run on 2026-05-23: 18 sessions were dropped as `account_not_allowlisted` even though they were legitimate work sessions. The cause was a design assumption that doesn't hold: when you change your Cowork account (e.g. switching from an old work email to a new personal email), Cowork retains the OLD sessions on disk under their original account label. Those sessions are still yours — the disk is yours — and the exporter has no business filtering them out. Every session under the user's `local-agent-mode-sessions` folder belongs to that user by definition.

**What changes.**

- Removed: `tools/nfx-cowork-export/account-allowlist.example.json`
- Removed: `package.json` files list no longer includes `account-allowlist.example.json`
- Removed: `--account-allowlist <path>` CLI flag
- Removed: `accountAllowlist` field on the `CliDefaults` interface
- Removed: `accountAllowlistPath` option on `loadExporterConfig` (signature: now takes only `cwdAllowlistPath` + `familyLawSlugsPath`)
- Removed: `accountAllowlist` field on the `ExporterConfig` interface
- Removed: `account_not_allowlisted` member from the `SessionDropReason` union
- Removed: the account-check block (~13 lines) in `filter-session.ts`
- Removed: `account_not_allowlisted` from the audit's `ALL_DROP_REASONS` list

**What does NOT change.**

- The `account` field in the emitted JSON schema (`SessionDocument.account: string | undefined`) stays. It's metadata, populated from `meta.emailAddress` in `buildSessionDocument`, surfaced for the ingester to use however it wants. The schema is unchanged; `schemaVersion` stays at `1`.
- The `cwd-allowlist` and `family-law-slugs` filters are unchanged. Those are content-policy concerns (which directories are NexFortis project folders; which session slugs are family-law-related), not identity concerns.
- Existing emitted JSONs from prior runs are still valid against the v1 schema.

**Tests.**

- `tests/cowork-export/filter-session.test.ts` — removed the `drops when account is not on the allowlist`, `allows when account allowlist is empty`, and `scheduled_task wins over account_not_allowlisted` tests. Added a new describe block (`filterSession — account is no longer a filter`) with 4 cases asserting: sessions under the current email pass through, sessions under an old/defunct email pass through (this was the bug), sessions with no `emailAddress` in meta pass through, and no `FilterDecision` ever returns `reason: 'account_not_allowlisted'`.
- `tests/cowork-export/config.test.ts` — rewrote to drop all account-allowlist coverage. New tests for the two-file loader signature plus a regression assert that the returned `ExporterConfig` does not have an `accountAllowlist` field.
- `tests/cowork-export/cli-defaults.test.ts` — removed `accountAllowlist` assertions.
- `tests/cowork-export/post-check.test.ts` — removed `accountAllowlist` from the `EMPTY_CONFIG` fixture.
- Test count: 360 → 376 net after this change (was 379 before this change branched off integration; the audit-fix branch added 4 tests that are in PR #21 separately).

**Real-data smoke-test.** Against Hassan's full backup with the same `cwd-allowlist` he used before:

| Metric | Run with old account-allowlist | Run without (this change) |
|---|---|---|
| Sessions discovered | 69 | 69 |
| Kept (passed filters) | 14 | (will be higher — exact count depends on what's left after cwd + post-check) |
| Validation failures | 0 | 0 (expected) |

**Migration.** Existing installs that have `%APPDATA%\nfx-cowork-export\account-allowlist.json` lying around: the file is now ignored. Safe to delete; harmless if left in place. The install kit's `install.ps1` no longer creates it for new installs.

---

### Tool (slice 6 — review cleanups + single-binary packaging via `bun build --compile`; no schemaVersion bump)

This is the final slice. After it lands, the `feature/cowork-exporter` integration branch PRs into `main` as one combined review.

**Slice 6 prep — three review cleanups** (commit `5305a73` on this branch)

Addresses the three code-cleanup items Perplexity flagged on slice 5 (PR #18). All behavior-preserving, no schema impact.

- **De-duplicated `workspaceIdFromPath`.** The helper used to live in two near-identical copies — one in `src/emit.ts`, one in `src/audit-extended.ts`. Moved to `src/utils.ts` (where `isValidTimestamp` already lives). Both call sites import from there. Added 9 new tests in `tests/cowork-export/utils.test.ts` covering: live POSIX layout, backup layout with extra prefix segments, Windows-backslash normalization, the closest-UUID-ancestor rule with single and multi-UUID parents, the bare-UUID-leaf edge case, no-ancestor → `null`, empty input → `null`, case-insensitive UUID hex, trailing-slash tolerance.
- **Naming caveat flagged for follow-up:** the function is *named* `workspaceIdFromPath` but actually returns the *closest* UUID-shaped ancestor of the session folder. In the typical Cowork layout `<root>/<outer>/<inner>/local_<session>/` that's the inner UUID — what Cowork sometimes calls the "space" rather than the workspace. Renaming the function would ripple into the `SessionDocument.workspaceId` field and the ingester schema, so it stays out of scope here. Worth a separate conversation.
- **Parameterized `userConfigDir(env)`.** It now takes `env: NodeJS.ProcessEnv = process.env`, matching the convention used by `computeCliDefaults(env)`. `computeCliDefaults` now passes `env` through to `userConfigDir(env)`. Adds 4 new tests in `tests/cowork-export/cli-defaults.test.ts`: signature regression guard, non-Windows env irrelevance, Windows APPDATA propagation (Windows-only assertion), end-to-end env passthrough through `computeCliDefaults`.
- **Fixed the misleading "stable serialization" comment in `emit.ts`.** Previous docstring claimed "we sort keys and use stable serialization" — the code does not sort object keys. Replaced with an accurate explanation: determinism comes from `buildSessionDocument` constructing every field in a fixed order plus `JSON.stringify` preserving insertion order, AND from explicitly-sorted `cwds`/`gitBranches` arrays. Added a note for future maintainers: if byte-exact output across runs is ever needed, add a `sortKeysDeep` helper.

### Tool (slice 6 main — `bun build --compile` packaging)

Produces single-binary distributables that embed the JavaScriptCore runtime, so consumers can run the tool without installing Node, pnpm, or any of its dependencies. This is what closes out the slice 6 roadmap milestone.

- **New scripts in `tools/nfx-cowork-export/package.json`:**
  - `package:bun:linux` — `bun build --compile --minify --sourcemap --target=bun-linux-x64 --outfile=dist/bin/nfx-cowork-export-linux-x64 src/cli.ts`
  - `package:bun:windows` — same flags with `--target=bun-windows-x64 --outfile=dist/bin/nfx-cowork-export-windows-x64.exe`
  - `package:bun` — runs both in sequence
- **Build targets locked at slice 6:** Linux x64 + Windows x64. macOS arm64 deferred until anyone needs it. The build matrix is small on purpose; cross-compiling more targets is `pnpm run package:bun` + extra `--target` flags away.
- **Binary characteristics (from the slice 6 build run):**
  - Linux: 97 MB, ELF64 dynamically-linked, 731 modules bundled.
  - Windows: 101 MB, PE32+ console executable.
  - Most of the size is the embedded JavaScriptCore runtime; minified app code is a few hundred KB.
- **`dist/bin/` is already covered by the root `.gitignore`** (which excludes `dist/`), so the binaries don't accidentally commit. They're release artifacts, not source.
- **Output is identical to the Node CLI.** Byte-diffed all 17 emitted JSON files from a real-data run between (a) the slice 5 Node CLI, (b) the slice 5 dist run through bun's runtime, and (c) the slice 6 compiled binary. All three produce identical content modulo `_exporter.exportedAt`, which is wall-clock and excluded from the comparison by design.

### Real-data smoke-test (slice 6 binary)

Against the full 65-session Cowork backup with the same narrow allowlist used in slice 5 (`hassansadiq73@gmail.com` only, three NexFortis project paths):

| Metric | Node CLI (slice 5) | Linux binary (slice 6) |
|---|---|---|
| Sessions discovered | 61 | 61 |
| Files written | 17 | 17 |
| Validation failures | 0 | 0 |
| Text fields scanned | 1,743 | 1,743 |
| PII replacements | 204 | 204 |
| End-to-end wall-clock | ~1.8s | ~4.2s |

The binary is ~2× slower than the Node CLI on this dataset — that's bun's startup overhead amortized over a short run, not a regression in the core pipeline. For larger inputs the gap closes.

### Tests added (+13 → workspace total 375; +0 in slice 6 main)

The +13 came from slice 6 prep (9 in utils.test.ts + 4 in cli-defaults.test.ts). Slice 6 main adds no new unit tests — the bun packaging is exercised via the real-data smoke-test instead. The slice 5 test suite is the contract for the CLI's behavior; the binary runs that same code path.

### Schema (unchanged from slice 1.5)

No emitted-JSON shape changes. `schemaVersion` stays at `1`.

---

### Tool (slice 5 — PII redaction + JSON emission + audit sidecar + OS defaults; no schemaVersion bump)

The exporter now writes JSON to disk. Slice 5 is the first slice where files actually leave the laptop into the pipeline's import directory. Everything before this slice was discovery + filter + parse + stitch in-memory only.

- **`src/redact-events.ts`** — runs the existing `lib/redaction` regex pass (email / phone / cc / ipv4 / ipv6) across the event tree returned by slice 4. Recurses into `subagent` events. Pure (no mutation of input). Returns a new event tree plus a `RedactionSummary` of replacements by type. This is **defense in depth**: the ingester does its own redaction pass, but doing it here means PII never leaves the laptop in plaintext on disk.
- **Post-redaction 80-char clamp on `tool_call.summary`.** `[REDACTED_EMAIL]` is 16 chars and may replace a shorter email — that can push a summary string past the schema's 80-char cap. The redactor re-clamps to 80 chars after substitution to preserve the invariant. Real-data run before this fix produced 2 validation failures; after this fix, 0.
- **`src/emit.ts`** — `emitParsedSessions(sessions, outputDir)` walks each parsed session, **filters on `postCheck.keep`** (honoring the slice-3 review note), builds a `SessionDocument` per surviving transcript via `buildSessionDocument()`, validates against the v1 schema, and writes atomically (`tmp` file + `rename`). Filename is `<transcriptId>.json`. Returns an `EmissionResult` with `filesWritten` / `validationFailures` / per-file diagnostics.
- **`src/run-export.ts`** — top-level orchestrator: `runDiscovery → redactEventTree → emitParsedSessions → renderExtendedAuditReport → writeAuditSidecar`. The CLI now calls this single function in NORMAL mode and the same function with a `dryRun: true` switch.
- **`src/audit-extended.ts`** — `renderExtendedAuditReport()` extends the slice-2 stdout audit with: per-session compression ratios, zero-event-kept sessions, per-source-branch counts, per-account counts, family-law SHA-256 hashes, parse-failure totals, redaction summary, JSON emission stats. `writeAuditSidecar(text, outputDir)` writes the full text to `<output-dir>/_audit-<ISO-timestamp>.txt` so audit history persists.
- **`src/cli-defaults.ts`** — OS-specific config-path defaults. Windows: `%APPDATA%\Claude\local-agent-mode-sessions` for `--input` and `%APPDATA%\nfx-cowork-export\` for config files. Linux/macOS: `~/.config/nfx-cowork-export/` for config files and no default `--input` (must be supplied explicitly because the laptop layout varies). Falls back to environment-variable-aware lookups.
- **`--validate-output <path>` flag** — standalone mode. Loads a single emitted JSON file, validates against the v1 schema, prints OK + sessionId/event-count or the schema error path, exits 0 / 5. Useful for ingester smoke tests and Hassan running ad-hoc sanity checks on a single file without re-running the full pipeline.
- **`--dry-run` now actually works.** Parses → filters → redacts → validates → writes audit to stdout only. No files written. Useful for previewing what would happen before running for real.
- **Exit codes locked in:** 0 = success, 1 = unhandled error, 2 = missing config, 3 = invalid config, 4 = validation failure on emitted documents (NORMAL mode — one or more files failed the schema check after redaction), 5 = `--validate-output` reported the target file invalid (or unparseable JSON in the target). The earlier draft of these notes called code 5 `no kept sessions` — that's wrong; the code/CLI doc header (`src/cli.ts`) is authoritative.

### Real-data sanity check

Against the full 65-session Cowork backup with a narrow account+cwd allowlist (`hassansadiq73@gmail.com` only, the three NexFortis project paths from `cwd-allowlist.example.json`):

| Metric | Value |
|---|---|
| Sessions discovered | 61 |
| Files written | 17 |
| Validation failures | **0** (was 2 before the post-redaction clamp fix) |
| Text fields scanned for PII | 1,743 |
| Total PII replacements | 204 (143 email, 37 phone, 22 cc, 2 ipv6) |
| Audit sidecar | written to `<output-dir>/_audit-<timestamp>.txt` |

A broader account allowlist (matching the multi-account variant the earlier dev run used) produces 35 files written; the count varies with the config, but the 0-validation-failure result is invariant.

### Tests added (30 new — workspace total 330 → 360)

- `tests/cowork-export/redact-events.test.ts` — 13 tests across email/phone/cc/ipv4/ipv6 patterns in user/assistant/tool_call events, subagent recursion (single + nested), purity, **post-redaction 80-char summary re-clamp** (regression test for the schema-cap-violation bug surfaced by the real-data run), and short-summary natural-length sanity.
- `tests/cowork-export/emit.test.ts` — 13 tests across `buildSessionDocument()` (provenance block, sessionId pinning, optional metadata fields), `emitParsedSessions()` (postCheck.keep filtering, atomic write, validation-failure reporting), output-directory creation, idempotent reruns.
- `tests/cowork-export/cli-defaults.test.ts` — 4 tests for Windows / Linux / macOS / unknown-platform defaults paths.

### Schema (unchanged from slice 1.5)

No emitted-JSON shape changes. `schemaVersion` stays at `1`.

---

### Fix (slice 4 review — PR #17 follow-up; no schemaVersion bump)

Addresses the critical correctness bug Perplexity caught in slice 4's stitcher. The original implementation walked stitchables in array order and matched any stitchable whose firstUserPrefix existed ANYWHERE in `agentDispatchMap` — silently swapping subagents between dispatches when filesystem ordering of subagent files didn't match the order of `Agent` dispatches in the parent. The `beautiful-blissful-volta` brand-kit session (5 Agent dispatches) was the highest-risk real-data session.

**Fix:** parser now captures the raw `toolu_<id>` of each `tool_use` block into a side map (`ParseResult.toolUseIdsByEventUuid`). The stitcher uses this map to look up the per-event dispatch prompt, then matches against subagent `firstUserPrefix` for THAT specific prompt. Each `Agent` `tool_call` is now correctly correlated to its specific dispatch regardless of filesystem ordering.

**Secondary improvement:** the emitted `parentToolUseId` field on `subagent` events now carries the actual `toolu_<id>` from the source rather than the synthesized event uuid the previous slice 4 was emitting. Downstream consumers get the real id.

**Tests:**
- New: `mismatched-order` regression test — two Agent dispatches with stitchables in reverse array order, asserts each `tool_call` stitches to its CORRECT subagent (this is the exact scenario Perplexity's probe demonstrated was broken).
- New: `mismatched-order + missing subagent` graceful-degradation test.
- New: `same-order baseline` (sanity check that the easy case still works).
- New: parser/stitcher integration test — `parseTranscript` populates `toolUseIdsByEventUuid` correctly.
- New: `tool_call without map entry` no-match test — defensive behavior when the parser couldn't capture an id.
- Updated: the existing "multiple subagents" test was passing by coincidence because stitchables and dispatches were in matching order. Replaced by the new tests above.

**Real-data verification:** ran the fixed code against `beautiful-blissful-volta`'s 5 Agent dispatches. Every subagent's `parentToolUseId` now matches the ground-truth `toolu_<id>` from the parent transcript exactly. The first-user-message prefix of each stitched subagent matches the first 50 chars of its dispatch's `input.prompt`.

### Tool (slice 4 — subagent stitching + auto-continuation handling; no schemaVersion bump)

Wires the subagent and continuation rules. Still no JSON written to disk — slice 5 adds that.

- **`src/continuation.ts`.** `stripContinuationScaffold(events)` drops the leading user_text event when its text begins with the canonical scaffold prefix (`"This session is being continued from a previous conversation that ran out of context."`). `computeContinuationGroupId(slug, firstUserMsg)` hashes `sha256("v1|" + slug + "|" + firstUserMsg.trim().slice(0, 200))` per the locked v1 formula. `firstUserText(events)` picks the first `user_text` event's text from a filtered stream.
- **`src/stitch.ts`.** `doStitch(parentEvents, stitchables, agentDispatchMap)` replaces each `Agent` `tool_call` event with a `subagent` event whose nested `events` array carries the (filtered) subagent's events. `readAgentDispatchMap(parentFile)` builds the `toolu_<id> → input.prompt` lookup table needed for matching. **`AGENT_TOOL_NAME = "Agent"`** is now a constant — empirically confirmed to be the correct Cowork dispatching-tool name across all 9 non-acompact subagent files in the real data (the spec originally said `Task`, which doesn't appear in Hassan's data).
- **Empty-envelope rule honored.** Per Perplexity's confirmation on slice 3: when a matched subagent's filtered events array is empty, the envelope is still emitted so the parent's `tool_call` for the `Agent` dispatch is replaced cleanly. Dropping the envelope would orphan the dispatch.
- **`src/types.ts` restructured.** `ParsedSession` now carries `transcripts: ParsedTranscript[]` instead of a flat `events: Event[]`. Each `ParsedTranscript` has its own `transcriptId` (the .jsonl filename's UUID — becomes the emitted document's `sessionId`), its own `events` array post-stitching, and an optional `continuationGroupId`. Multi-transcript sessions are auto-continuation chains; each transcript gets its own emitted JSON in slice 5. Added one-line constraint comment on `ParsedSession.postCheck` per Perplexity slice-3 review note: *Slice 5 emit-loop must filter on `s.postCheck.keep`*.
- **`src/discovery.ts`** adds two small helpers: `subagentsDirectoryForParent(parent)` and `transcriptIdFromPath(transcript)` so the orchestrator can pair parent transcripts with their subagents and derive emitted `sessionId` from disk paths.
- **`src/run-discovery.ts`** rewired to: per parent transcript, parse → scaffold-strip → stitch subagents → record on `ParsedTranscript`. Per session, run `postCheckSession` against the union of all transcripts' events.
- **isSidechain handling:** subagent transcripts have `isSidechain: true` on every event; the existing per-event filter doesn't depend on that flag and processes them correctly. No special handling needed.

### Real-data sanity check (against the full 65-session Cowork backup)

| Metric | Value |
|---|---|
| Sessions discovered | 61 |
| Parsed sessions emitted | 34 |
| Continuation chains | 2 (`cool-great-franklin` has 4 transcripts; one other has 2) |
| Transcripts with continuation scaffold stripped | 3 |
| Total `subagent` events stitched into parent streams | 9 (matches the 9 non-acompact subagent files exactly) |

Sessions that gained subagent events:
- `beautiful-blissful-volta`: 5 subagent events (the brand-kit creation session)
- `friendly-vigilant-noether`: 2
- `beautiful-elegant-fermat`: 1
- `zen-sweet-bohr`: 1

### Tests added (26 new — workspace total 304 → 330)

- `tests/cowork-export/continuation.test.ts` — 14 tests across scaffold strip + groupId computation + firstUserText
- `tests/cowork-export/stitch.test.ts` — 12 tests across happy path + no-match + empty-envelope + multi-subagent + `readAgentDispatchMap`

### Schema (unchanged from slice 1.5)

No emitted-JSON shape changes. `schemaVersion` stays at `1`.

---

## [Previously released]

## Tool (slice 3 — per-event filter + tool-call summary registry + post-check; no schemaVersion bump)

Reads each kept session's parent transcripts, applies the per-event filter table from the locked spec, converts raw lines into the v1 `Event[]` shape, and applies two post-filter checks. No JSON is emitted yet — that's slice 5.

- **Per-event filter and normalizer (`src/parser.ts`).** Streams JSONL line by line via `node:readline`. Drops queue-operation / last-prompt / ai-title / attachment / system (every subtype) / progress / thinking events. Keeps user_text (string content), drops user events with tool_result list content or `isMeta: true`. Converts assistant text blocks to `assistant_text` events and assistant tool_use blocks to `tool_call` events with optional summary. Multi-block assistant lines emit one event per kept block with synthesized child UUIDs.
- **`local_command` system subtype confirmed dropped.** Per Perplexity's slice-2 review confirmation, all `system` events drop regardless of subtype.
- **Tool-call summary registry (`src/tool-summary.ts`).** Ten bespoke extractors per the locked spec: Bash + `mcp__workspace__bash` (first command line), Edit/Write/Read (file_path), `mcp__Claude_in_Chrome__navigate` + WebFetch + `mcp__workspace__web_fetch` (URL), WebSearch + `mcp__*__search` regex (query), Glob/Grep (pattern), `mcp__cowork__present_files` (joined file paths), TaskCreate/TaskUpdate (subject), AskUserQuestion (first question text). Every summary capped at 80 chars. Tools without a registered extractor emit `tool_call` with no `summary` field at all — no generic placeholder per the spec.
- **Post-filter checks (`src/post-check.ts`).** Two rules: tiny-session (drop sessions with <3 events OR <500 chars of user_text + assistant_text text) and cwd-majority (drop sessions where <80% of text chars are in allowlisted cwds, using `matchesAnyPrefix` against the same alwaysAllow / allowPrefixes / alwaysDeny buckets as slice 2). Tool-call events have a cwd but no text — they're excluded from both numerator and denominator. Events with no cwd are ignored in the ratio (the session-level pre-check from slice 2 already vetted them).
- **Bad-line handling.** Parser skips unparseable lines and counts them. If >5% of a file's lines fail to parse, the file is abandoned (empty events array returned, abandonment flagged in the audit).
- **Orchestrator updated.** `runDiscovery()` now parses each kept session's parent transcripts, runs post-check, surfaces tiny_session and cwd_majority_outside_allowlist as additional drop reasons in the audit. The returned `ParsedSession[]` carries `events` + `postCheck` + parse stats per session, ready for slice 5 to serialize.
- **Two new drop reasons surface in the audit summary:** `tiny_session`, `cwd_majority_outside_allowlist`.

### Real-data sanity check

Against the full 65-session Cowork backup:
- 61 sessions discovered, 31 kept after session+post filtering
- 12 dropped as scheduled_task, 15 as cwd_always_denied (Cowork-internal-data sessions), 3 as tiny_session
- Average events/line ratio across kept sessions: ~42% (higher than slice 1's 7% estimate because slice 3 also keeps `tool_call` events, which slice 1's analysis classified as throw)
- Biggest kept sessions: `cool-great-franklin` (4605 lines → 1800 events), `friendly-zealous-galileo` (4081 → 1603), `zen-nifty-fermat` (3118 → 1244)

### Tests added (69 new — workspace total 304 → ?)

- `tests/cowork-export/tool-summary.test.ts` — 28 tests across all 10 extractors + unknown-tool fallthrough + whitespace and 80-char ceiling.
- `tests/cowork-export/parser.test.ts` — 31 tests covering every line in the per-event filter table, multi-block assistant lines, child-UUID synthesis, the bad-line policy (under-5%, over-5%, threshold), empty-line tolerance.
- `tests/cowork-export/post-check.test.ts` — 10 tests covering tiny-session thresholds, cwd-majority math (under 80, exactly 80, no-cwd events excluded from ratio, all-deny vs all-allow), alwaysDeny precedence over alwaysAllow, edge cases including empty event list.

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
