# `@ncp/capture-worker`

Inngest worker that ingests Hassan's expertise from each capture source
into the shared Supabase `capture_signals` corpus. Cron-driven, idempotent,
fail-closed on PII.

Built from the prompt sequence in
[`docs/ways-of-work/plan/content-pipeline-v2/cursor-claude-prompt-library.md`](../../docs/ways-of-work/plan/content-pipeline-v2/cursor-claude-prompt-library.md).

## MS Graph email ingestion (application scope)

Daily at `0 4 * * *` UTC, the `ingest-msgraph-email` Inngest function:

1. Acquires a Microsoft Entra ID access token via the
   `client_credentials` flow (application permissions, single tenant).
2. Reads the `last_ingested_at` cursor from `ingest_checkpoints`
   (initial run: `now() - 7 days`).
3. Resolves the folder allowlist from `source_filters` (default:
   `Inbox` + `Sent Items`).
4. Iterates `/users/{MS_GRAPH_USER_UPN}/messages` page by page with the
   `$select` projection documented in
   [`docs/integration-contracts/msgraph-message.md`](../../docs/integration-contracts/msgraph-message.md),
   capped at 500 messages per run.
5. For each message: skips drafts, strips HTML, runs the full
   `@ncp/redaction` pipeline (blocklist → regex → Haiku scrub),
   **drops blocked messages entirely** (no DB row, no audit row — only a
   PII-free log line), chunks the redacted text with `@ncp/embeddings`,
   embeds each chunk with `text-embedding-3-large`, and inserts rows
   into `capture_signals` keyed by
   `source_id = 'msgraph-email:{messageId}:chunk-{NNNN}'` with
   `ON CONFLICT (source_id) DO NOTHING`.
6. Upserts the checkpoint to the `sentDateTime` of the most recent
   successfully processed message.

### Azure / Entra ID setup

The worker assumes the following has already been completed (a one-time
manual step performed by Hassan):

- A single-tenant app registration in the NexFortis Entra ID tenant.
- Application-scope `Mail.Read` permission granted with admin consent.
- A client secret generated and stored in Cursor Cloud / Render secrets.
- The target mailbox (`MS_GRAPH_USER_UPN`) has an active Exchange Online
  license.

The worker never performs delegated authentication and never holds a
refresh token. Every Graph call is application-scope against
`/users/{upn}/messages` — there is no user-context endpoint in use.

### Required env vars

| Variable | Purpose |
|---|---|
| `MS_GRAPH_TENANT_ID` | Azure tenant ID for the token endpoint |
| `MS_GRAPH_CLIENT_ID` | App registration client ID |
| `MS_GRAPH_CLIENT_SECRET` | App registration client secret (rotate quarterly) |
| `MS_GRAPH_USER_UPN` | UPN of the mailbox to ingest |
| `OPENAI_API_KEY` | Required by `@ncp/embeddings` |
| `OPENAI_ORG_ID` | Optional; passed to `@ncp/embeddings` when set |
| `ANTHROPIC_API_KEY` | Required by `@ncp/redaction` for the Haiku scrub pass |
| `DATABASE_URL` | Required by `@ncp/db` for Supabase connectivity |

Missing or empty values cause the function to throw `AccessTokenError`
before any HTTP call — the run aborts and no state is mutated.

### Operational notes

- **Rate limits.** 429 responses honor `Retry-After` and retry up to
  five times. Sustained throttling throws `MsGraphRateLimitError`.
- **5xx.** Retried exactly once after a 10-second pause.
- **401.** The token is refreshed once and the request retried; a
  second 401 throws `MsGraphAuthError` and aborts the run.
- **Cap.** The 500-message per-run cap protects budget on a first run
  after a long pause; the next run picks up from the unchanged
  checkpoint.
- **Privacy.** Blocked messages leave no audit trail in the database.
  The log line emitted at block time contains only
  `{ source, action, reason }` — no IDs, no subjects, no addresses.
