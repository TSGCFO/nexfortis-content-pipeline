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
