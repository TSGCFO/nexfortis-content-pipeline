# Cowork session exporter — design docs

Source-of-truth specs for the local CLI that reads Cowork on-disk session data and emits normalized JSON for the content pipeline ingester.

Implementation lives at [`tools/nfx-cowork-export/`](../../../../../tools/nfx-cowork-export/).

## Documents

| File | What it is |
|---|---|
| [`brief.md`](./brief.md) | The locked v1 design spec. Authored by Hassan + the strategist AI (Perplexity), with design-partner pushback from Claude in Cowork. Closed schema, closed `kind` set, locked filtering rules. **This file is the contract.** |

## Status

| Slice | Branch | Status |
|---|---|---|
| Slice 1 — schema + validator | `feature/cowork-exporter` (integration) | ✅ Merged |
| Slice 1.5 — strict validation + non-empty continuationGroupId | `feature/cowork-exporter-slice-1-fixes` | ⏳ In review |
| Slice 2 — file discovery + session metadata pre-filter + `--dry-run` | (TBD) | Queued |
| Slice 3 — per-event filtering + tool-call summary registry | (TBD) | Queued |
| Slice 4 — subagent stitching + auto-continuation handling | (TBD) | Queued |
| Slice 5 — PII regex pass + CLI wrapper + audit log | (TBD) | Queued |
| Slice 6 — packaging (single binary via `bun build --compile`) | (TBD) | Queued |

## Relationship to the prompt library

This tool is built **outside** the 15-prompt cursor-claude-prompt-library workflow. It is sliced into 6 sequential PRs against an integration branch (`feature/cowork-exporter`) rather than one-prompt-one-PR against `main`. When the integration branch is fully built and reviewed end-to-end, it PRs to `main` as one final review.

## Sequencing relative to the pipeline

This tool is a **prerequisite to capture-worker's Claude-source ingester** (the pipeline-side consumer of these JSON files). The ingester is not yet specified — it will be designed after this exporter ships.

The cloud-web Claude export (separate, not Cowork) is a **different stream** with its own future exporter and ingester. Do not conflate the two.
