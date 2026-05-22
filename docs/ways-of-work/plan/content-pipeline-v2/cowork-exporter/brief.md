# Co-Work Session Exporter — Locked Design Spec (v1)

> **Status: design phase complete.** This document is the converged spec after Hassan, Computer (Perplexity strategist), and Co-Work iterated on the original brief. Everything below is locked. A separate implementation handoff prompt lives at `cowork-exporter-implementation.md`.

## Product context

`TSGCFO/nexfortis-content-pipeline` is a content pipeline that ingests Hassan's daily expertise from many sources (MS 365 email shipped; Teams transcripts, Telegram voice, Claude data planned), embeds it in Supabase pgvector, clusters it nightly, and surfaces article candidates to a Telegram bot that asks Hassan questions weekly for an SEO blog at nexfortis.com.

Co-Work is the source of ~90% of Hassan's real technical work. This tool — the **Co-Work exporter** — is a local-laptop CLI that reads Co-Work's on-disk session data, filters it, normalizes it, and emits one JSON file per session into a folder the pipeline ingester later consumes. Cloud web Claude is a **separate stream** with its own future exporter and ingester.

## The biggest design principle (Co-Work's framing, adopted)

This exporter is **the choke point** between Hassan's daily AI-assisted work and the corpus that drives the entire content pipeline. Every decision propagates downstream and is essentially impossible to revise once data starts flowing. Therefore:

- **Schema is the contract.** Versioned, validated, documented in a CHANGELOG.
- **Validator is built before the parser.**
- **`--dry-run` ships in v1**, not v2.
- **Family-law blocklist mechanism lives in `lib/redaction` as code** (SHA-256 hashing, fail-closed, deny-list check, unit-tested). Only the specific slugs live in config.

## Architecture (locked)

| Decision | Value |
|---|---|
| Location | `tools/nfx-cowork-export/` inside `TSGCFO/nexfortis-content-pipeline` |
| Why same repo | The exporter lives in the pipeline repo (not a separate repo) because: (a) it shares `lib/redaction` — a safety-critical module enforcing the family-law blocklist — and a separate repo would force either drift-prone inlined duplication or a release-step lag between the two; (b) direct workspace import is the safer posture for safety-critical code; (c) the mixed-dependency risk is managed by package isolation in `tools/nfx-cowork-export/package.json` (no accidental import of `inngest`, `@sanity/client`, etc.) rather than by physical-repo separation. |
| Language | **TypeScript** (matches pipeline repo, shares `lib/redaction` directly, Vitest already in stack) |
| Packaging | Try `bun build --compile --target=bun-windows-x64`. If Windows packaging blows up, fall back to `pnpm install -g` from the repo. **Do not** switch languages if packaging is hard. |
| Distribution | Single binary Hassan runs on his Windows laptop, or `pnpm install -g` fallback |
| Read/write posture | Read-only against Co-Work's data folders, never writes back |
| Output destination | One JSON file per session into a configurable output directory (default `data/imports/claude-cowork/`) |
| Streams model | Co-Work and cloud Claude are **separate streams**: separate exporters, separate ingesters, shared downstream libs (`lib/redaction`, `lib/embeddings`, `lib/db`) |
| Workspace package | `tools/nfx-cowork-export/package.json` has its own deps. No accidental import of `inngest`, `@sanity/client`, etc. |

## Filtering — session level (drop the entire session when)

1. Session slug matches the family-law blocklist (configurable file outside the repo, real identifying slugs)
2. `initialMessage` starts with `<scheduled-task name=`, `<command-message>`, or `<system-path-cwd>`
3. Account is not on the account allowlist (configurable; supports excluding personal Cowork spaces)
4. Initial cwd from the meta-JSON sidecar fails the cwd allowlist pre-check (see below)
5. **Post-filter tiny-session check:** final `events[]` has fewer than 3 events OR fewer than 500 chars of `user_text` + `assistant_text` combined

> **Why this rule for #5** (changed from the original ≥30-char user-string rule): the original threshold privileged Hassan's typing volume over what the session actually produced. Sessions where Hassan delegated a task and the AI did the work would wrongly get dropped. The new rule thresholds on what survives the filter, regardless of who produced it.

## Filtering — file level (drop the entire file when)

- Filename starts with `agent-acompact-*.jsonl` (auto-compaction summaries duplicate parent transcript content)

**Order matters:** `agent-acompact-*` filter runs **before** subagent stitching, so we don't try to stitch what isn't stitchable.

## Filtering — per event (within a kept session)

| Raw event | Decision |
|---|---|
| `type: "queue-operation"` | Drop |
| `type: "last-prompt"` | Drop |
| `type: "ai-title"` | Drop |
| `type: "attachment"` | Drop permanently (not a v2 deferral) |
| `type: "system"` | **Drop all.** Verified empirically in sample data: only `subtype: compact_boundary` appears. No MCP-loaded events exist in this event type. |
| `type: "progress"` | **Drop all.** Hook callback plumbing (e.g. `PreToolUse`). No content. |
| `type: "user"` with `message.content` as a **string** | Keep — Hassan's real typing |
| `type: "user"` with list `tool_result` content | Drop entirely (keep tool calls, not results) |
| `type: "user"` with `isMeta: true` | Drop — framework-injected text |
| `type: "assistant"` with `content[].type == "text"` | Keep — Claude's reply |
| `type: "assistant"` with `content[].type == "tool_use"` | Keep, but emit only as a short `summary` string when bespoke extractor exists; omit `summary` field otherwise |
| `type: "assistant"` with `content[].type == "thinking"` | Drop — internal reasoning, never reached Hassan |

> **Important:** the `system` / `progress` filter was originally specified speculatively. Empirical inspection of sample sessions (4 files, including 4,081-line transcript and acompact + task-tool subagents) confirms the actual shapes. The implementer should grep all 65 sessions during step 4 of the roadmap to confirm no other `system` subtypes exist before locking the final filter. If new subtypes are found, escalate to Hassan — do not silently keep them.

## Auto-continuation handling

Two layers:

1. **Per-session scaffold strip:** when the first user-string event begins with `"This session is being continued from a previous conversation that ran out of context."`, strip the summary scaffold and emit only the continued conversation that follows.
2. **Continuation grouping:** sessions that are part of an auto-continuation chain (e.g. `cool-great-franklin` has 4 separate parent transcript files) are each emitted as their own JSON file with their own `sessionId`. Each one gets a `continuationGroupId` at session level — a stable hash of `(slug + first-real-user-message-of-the-original)`. The ingester chooses whether to stitch them downstream.

## Task-tool subagent stitching

`agent-<hash>.jsonl` files that are **NOT** `acompact-*` are real sub-jobs Claude dispatched via the Task tool.

- Read each task-subagent file alongside its parent transcript
- Match `parentToolUseID` → parent transcript's `Task` tool-use block
- Emit the subagent into the parent's output as a single `kind: "subagent"` event nested at the point where the parent dispatched it
- The subagent's own filtered events live in a nested `events` array
- **Recursion:** subagents-of-subagents exist. The processor must recurse.
- **Order:** acompact file filter runs first, then subagent stitching.

## Cwd allowlist

**Three-bucket model** (verified against actual data):

1. `/sessions/<slug>` — Cowork's internal sandbox (uploaded files, browser tasks, computer-use)
2. `C:\Users\HassanSadiq\Projects\...` — Hassan's real laptop folders mounted into Cowork (**this is what the allowlist is really for**)
3. `C:\Users\HassanSadiq\AppData\Roaming\Claude\...` — Cowork's own system internals (scheduled-task runs, meta-work — generally drop)

**Config shape** at `~/.config/nfx-cowork-export/cwd-allowlist.json` (or Windows equivalent):

```json
{
  "alwaysAllow": ["/sessions/"],
  "allowPrefixes": [
    "C:\\Users\\HassanSadiq\\Projects\\nexfortis content pipeline",
    "C:\\Users\\HassanSadiq\\Projects\\NexFortis-Website-Design-pro",
    "C:\\Users\\HassanSadiq\\Projects\\live-site-verifier"
  ],
  "alwaysDeny": ["C:\\Users\\HassanSadiq\\AppData\\Roaming\\Claude\\"]
}
```

**Path normalization is part of the matcher** (case-insensitive on Windows, forward/backslash agnostic, trailing-slash agnostic). Unit tests must cover case + slash variants.

**Granularity:** session-level by majority of events, measured by `user_text` + `assistant_text` character count (not raw event count — tool_call events would skew it). If ≥80% of the keep-event chars are in allowlisted cwds, keep the whole session. Otherwise drop. **Do not** event-by-event filter — produces Frankenstein transcripts.

**Fail closed:** if no allowlist file exists, exporter refuses to run with a friendly error message pointing to the example file at `tools/nfx-cowork-export/cwd-allowlist.example.json`.

**CLI flags** are override/extend only, not primary input.

**Audit field added:** `cwdSummary: { allowedChars: N, deniedChars: M, mixedRatio: 0.92 }` per session.

## Tool-call summary registry

**Generic default dropped.** If no bespoke extractor exists for a tool, emit `kind: "tool_call"` with `tool: <name>` only and **omit the `summary` field entirely**. Consumers treat absence as "no useful summary."

**Bespoke extractors (v1):**

| Tool name(s) | Extracted summary | Max length |
|---|---|---|
| `Bash` / `mcp__workspace__bash` | First line of command, or `"bash (multi-line)"` if multi-line | 80 chars |
| `Edit` / `Write` | The `file_path` arg | 80 chars |
| `Read` | The `file_path` arg | 80 chars |
| `mcp__Claude_in_Chrome__navigate` | The URL | 80 chars |
| `WebFetch` / `mcp__workspace__web_fetch` | The URL | 80 chars |
| `WebSearch` / `mcp__*__search` | The query string | 80 chars |
| `Glob` / `Grep` | The pattern | 80 chars |
| `mcp__cowork__present_files` | The file paths joined | 80 chars |
| `TaskCreate` / `TaskUpdate` | The subject/title | 80 chars |
| `AskUserQuestion` | The first question text | 80 chars |

Everything else: `tool` only, no `summary`.

## Audit log

**Both stdout AND sidecar file in v1.** Sidecar at `<output-dir>/_audit-<timestamp>.txt`.

**Categories:**

- Found N sessions total
- Kept K sessions
- Dropped per category: family-law slug, scheduled-task, command-message, system-path-cwd, acompact, account not allowlisted, cwd allowlist fail, tiny-session
- Per-source-branch counts (main vs secondary Cowork space)
- Per-account counts
- Compression ratio per kept session (raw `.jsonl` bytes in vs kept-event bytes out); flag deviations from the ~0.9%-1% ballpark
- Zero-event-kept sessions (list by sessionId — almost certainly a bug)
- Family-law slug matches: log **SHA-256 hash** of matched slug, never the slug itself
- Skipped lines / parse failures per file (count + first error)
- Cwd summary per session: allowed/denied char counts, mixed ratio

## Bad-line handling

- Skip the bad line, log to audit, continue
- If >5% of a `.jsonl` file's lines fail to parse, skip the whole file with a clear audit message

## Output schema (v1, frozen)

One JSON file per session, named `<sessionId>.json`.

**Closed kind set for v1:** `user_text`, `assistant_text`, `tool_call`, `subagent`. Adding any new kind requires `schemaVersion` bump.

(Note: `system_mcp_loaded` was removed after empirical confirmation that no such events exist in the source data.)

```json
{
  "schemaVersion": 1,
  "_exporter": {
    "name": "nfx-cowork-export",
    "version": "0.1.0",
    "sourceFormat": "cowork-jsonl-v1",
    "exportedAt": "2026-05-22T13:45:00.000Z"
  },
  "source": "claude_cowork",
  "sessionId": "fd55038b-...",
  "sessionSlug": "eager-sweet-hypatia",
  "continuationGroupId": "sha256:abc...",
  "workspaceId": "a169f9c6-...",
  "title": "NexFortis QA sweep round 2",
  "createdAt": "2026-04-08T14:23:11.000Z",
  "lastActivityAt": "2026-04-08T18:42:55.000Z",
  "model": "claude-opus-4-6",
  "account": "h.sadiq@nexfortis.com",
  "cwds": ["/sessions/eager-sweet-hypatia", "C:\\Users\\HassanSadiq\\Projects\\nexfortis content pipeline"],
  "gitBranches": ["HEAD", "main"],
  "mcpServers": ["Claude_in_Chrome", "Desktop_Commander"],
  "events": [
    {
      "kind": "user_text",
      "ts": "2026-04-08T14:23:11.000Z",
      "uuid": "abc-123",
      "cwd": "/sessions/eager-sweet-hypatia",
      "gitBranch": "HEAD",
      "text": "Okay, the SureHire login is failing again..."
    },
    {
      "kind": "assistant_text",
      "ts": "2026-04-08T14:23:14.000Z",
      "uuid": "def-456",
      "cwd": "/sessions/eager-sweet-hypatia",
      "gitBranch": "HEAD",
      "text": "Let me check the Conditional Access policy state first..."
    },
    {
      "kind": "tool_call",
      "ts": "2026-04-08T14:23:17.000Z",
      "uuid": "ghi-789",
      "cwd": "/sessions/eager-sweet-hypatia",
      "gitBranch": "HEAD",
      "tool": "mcp__Claude_in_Chrome__navigate",
      "summary": "https://entra.microsoft.com/..."
    },
    {
      "kind": "subagent",
      "ts": "2026-04-08T14:25:02.000Z",
      "uuid": "jkl-012",
      "cwd": "/sessions/eager-sweet-hypatia",
      "subagentSlug": "agent-af8855b6e9fcf873a",
      "parentToolUseId": "toolu_01abc...",
      "events": [
        {
          "kind": "assistant_text",
          "ts": "2026-04-08T14:25:03.000Z",
          "uuid": "...",
          "cwd": "C:\\Users\\HassanSadiq\\Downloads",
          "text": "..."
        }
      ]
    }
  ]
}
```

**Schema rules:**

- `cwd` and `gitBranch` are **per-event** (sessions legitimately switch directories mid-flow — Hassan confirmed)
- Session-level `cwds` and `gitBranches` are arrays of uniques seen
- All timestamps are ISO-8601 UTC with `Z` suffix and milliseconds. Convert any local-time timestamps at the boundary.
- Subagent events are **nested**, not flat. Tree → flat is easy downstream; flat → tree is hard.
- **Self-validation:** every emitted JSON is validated against the zod schema before it hits disk. If invalid: fail loudly, log, do not write.
- Required at session level: `schemaVersion`, `_exporter`, `source`, `sessionId`, `createdAt`, `events`. Everything else optional.
- Required on every event: `kind`, `ts`, `uuid`. Other fields depend on kind.

## Idempotency

Re-running the exporter on the same data produces the same outputs. Exception: `_exporter.exportedAt` will differ between runs. The ingester dedupes on `sessionId` and ignores `_exporter.*` fields for dedup. `exportedAt` stays in the file for provenance.

## PII redaction

The shared `lib/redaction/regex-pass.ts` runs **in the exporter**, not just the ingester. Defense in depth, and the intermediate JSON files on Hassan's laptop are already redacted before they leave the machine.

## Schema versioning

- `schemaVersion: 1` for v1
- `CHANGELOG.md` lives in `tools/nfx-cowork-export/`, documents every shape change
- Ingester refuses files with unrecognized `schemaVersion`
- Family-law blocklist *mechanism* (hashing, fail-closed, matching) is code in `lib/redaction`, unit-tested. Only the specific slugs are config.

## CLI surface

```
nfx-cowork-export \
  --input <cowork-data-dir> \
  --output <dir>                          [default: data/imports/claude-cowork/] \
  --cwd-allowlist <path>                  [default: ~/.config/nfx-cowork-export/cwd-allowlist.json] \
  --family-law-blocklist <path>           [default: ~/.config/nfx-cowork-export/family-law-slugs.json] \
  --account-allowlist <path>              [default: ~/.config/nfx-cowork-export/account-allowlist.json] \
  --dry-run                               [parse, filter, validate, but write nothing] \
  --verbose                               [per-session decisions to stdout] \
  --validate-output <path>                [validate an existing emitted JSON file against the schema; standalone mode]
```

## Out of scope for v1

- Binary files in `outputs/` and `uploads/` per-session folders — ignore. The conversation text describes them.
- `audit.jsonl` per-session file — drop, but spot-check one session before locking to confirm there's nothing in it the parent transcript doesn't already have.
- Cloud web Claude — separate stream, separate future tool.
- The Co-Work ingester (pipeline-side consumer) — Hassan and Computer will design later.
