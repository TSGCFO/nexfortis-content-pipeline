# Integration Contracts

Response-shape contracts for every external API the content pipeline reads from or writes to.

## What lives here

One Markdown file per external resource type we integrate with. Each file documents:

1. **Full property list** of the resource as returned by the external API
2. **Pipeline usage** for each field: which we extract (with the exact dotted path), which we deliberately ignore as noise
3. **A suggested `$select` / projection** to minimize payload
4. **An anonymized real-world sample response** captured from the actual API
5. **Notable handling rules** discovered during integration

## Why this exists

A test that mocks an API call without verifying the real response shape is worse than no test — it gives false confidence while letting the real-world response surprise the pipeline at runtime. Every ingester in this repo must build its mocks and assertions against the contract documented here, not against the agent's guess.

## The schema-first discipline

Before authoring a Cursor / Claude Code prompt that integrates a new external API:

1. **Fetch the published schema** from the vendor's official documentation
2. **Build a contract file in this directory** listing every field, what we extract, what we ignore
3. **Capture one real anonymized response** as a permanent fixture (commit alongside the contract)
4. **Reference the contract from the prompt's "Spec reference" section** so the agent reads it before writing code
5. **Reference the captured fixture in the prompt's test requirements** so the unit-test mocks are built against verified shape

When a vendor changes their API, the contract is updated in a dedicated PR before any ingester code touches it.

## Current contracts

| File | API | Source resource | Used by |
|---|---|---|---|
| [msgraph-message.md](./msgraph-message.md) | Microsoft Graph v1.0 | `Message` (Outlook email) | `artifacts/capture-worker/src/jobs/ingest-msgraph-email/` (planned) |
| _(future)_ msgraph-call-transcript.md | Microsoft Graph v1.0 beta | `callTranscript` | `artifacts/capture-worker/src/jobs/ingest-teams-transcripts/` (planned) |
| _(future)_ telegram-message.md | Telegram Bot API | `Message` + `Voice` | `artifacts/capture-worker/src/jobs/ingest-telegram-voice/` (planned) |
| _(future)_ claude-export-conversation.md | Anthropic account export | `conversation` JSON shape | `artifacts/capture-worker/src/jobs/ingest-claude/` (planned) |
| _(future)_ claude-cowork-conversation.md | Claude Co-Work / Claude Code local files | _(format TBD pending research)_ | local exporter tool (planned) |
| _(future)_ sanity-draft.md | Sanity Content API | `post` document | `artifacts/sanity-bridge/` (planned) |

## Updating a contract

A contract is **never** edited speculatively. It is updated when:

- A new field is added to the pipeline (the prompt or PR updates the contract first, then the code references it)
- A vendor schema change is detected (typically via integration tests; the contract update is its own PR, then dependent code follows)
- A new realistic response example is captured (append to the existing sample section, don't replace — history is useful)
