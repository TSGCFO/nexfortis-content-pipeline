# Microsoft Graph `Message` Resource — Response Contract

**Source:** Microsoft Graph v1.0 official docs, fetched 2026-05-11
- https://learn.microsoft.com/en-us/graph/api/resources/message
- https://learn.microsoft.com/en-us/graph/api/resources/recipient
- https://learn.microsoft.com/en-us/graph/api/resources/emailaddress
- https://learn.microsoft.com/en-us/graph/api/resources/itembody

This document is the ground truth for what `/users/{upn}/messages` returns. Every test fixture must conform to this shape. Every field the pipeline extracts must be listed in the "Fields We Use" section below with the exact dotted path.

---

## Full `Message` Properties (returned by default unless noted)

| Property | Type | Returned by default? | Use in pipeline |
|---|---|---|---|
| `id` | String (unique, stable) | ✅ | ✅ source_id derivation |
| `subject` | String | ✅ | ✅ blocklist input + redaction subject |
| `body` | `itemBody` (see below) | ✅ | ✅ primary content for redaction + chunking + embedding |
| `bodyPreview` | String (first 255 chars, plain text) | ✅ | ❌ ignored (we use full body) |
| `from` | `recipient` (see below) | ✅ | ✅ blocklist input `senderEmail` |
| `sender` | `recipient` | ✅ | ❌ ignored (`from` is what we care about) |
| `toRecipients` | `recipient` collection | ✅ | ✅ blocklist input `recipientEmails` |
| `ccRecipients` | `recipient` collection | ✅ | ✅ blocklist input `recipientEmails` (flatten with `toRecipients`) |
| `bccRecipients` | `recipient` collection | ✅ | ✅ blocklist input `recipientEmails` (flatten) |
| `replyTo` | `recipient` collection | ✅ | ❌ ignored |
| `receivedDateTime` | DateTimeOffset (ISO 8601 UTC) | ✅ | ✅ checkpoint update + `captured_at` for *received* mail |
| `sentDateTime` | DateTimeOffset (ISO 8601 UTC) | ✅ | ✅ `captured_at` (preferred — covers both sent and received from this mailbox's perspective) |
| `createdDateTime` | DateTimeOffset | ✅ | ❌ ignored |
| `lastModifiedDateTime` | DateTimeOffset | ✅ | ❌ ignored |
| `conversationId` | String | ✅ | ⚠️ stored as `null` in v2; reserved for synthesis worker thread reconstruction |
| `conversationIndex` | Edm.Binary | ✅ | ❌ ignored (binary, only useful in conjunction with `conversationId`) |
| `webLink` | String (Outlook web URL) | ✅ | ✅ `source_url` column on `capture_signals` |
| `parentFolderId` | String | ✅ | ✅ used by folder-allowlist filtering |
| `hasAttachments` | Boolean | ✅ | ❌ ignored (attachments themselves are out of scope) |
| `importance` | enum (`low`/`normal`/`high`) | ✅ | ❌ ignored |
| `inferenceClassification` | enum (`focused`/`other`) | ✅ | ❌ ignored |
| `isDraft` | Boolean | ✅ | ✅ skip drafts entirely (no expertise content in unsent drafts) |
| `isRead` | Boolean | ✅ | ❌ ignored |
| `isDeliveryReceiptRequested` | Boolean | ✅ | ❌ ignored |
| `isReadReceiptRequested` | Boolean | ✅ | ❌ ignored |
| `internetMessageId` | String (RFC 2822) | ✅ | ❌ ignored (we use `id`) |
| `flag` | `followupFlag` | ✅ | ❌ ignored |
| `changeKey` | String (etag) | ✅ | ❌ ignored |
| `internetMessageHeaders` | collection | ❌ requires `$select` | ❌ ignored |
| `uniqueBody` | `itemBody` | ❌ requires `$select` | ❌ ignored (defer; could be useful for thread deduplication later) |
| `attachments` | navigation property | n/a | ❌ ignored |
| `extensions` | navigation property | n/a | ❌ ignored |
| `multiValueExtendedProperties` | navigation property | n/a | ❌ ignored |
| `singleValueExtendedProperties` | navigation property | n/a | ❌ ignored |

## Sub-resource: `recipient`

```json
{
  "emailAddress": {
    "address": "string",
    "name": "string"
  }
}
```

Pipeline path: `recipient.emailAddress.address` is what we hash and feed to the blocklist. We do NOT use `name` — it's display-only and adversarially-set.

## Sub-resource: `itemBody`

The `itemBody` resource has exactly two properties:

- `content` — string
- `contentType` — enum, one of `"text"` or `"html"`

Example (valid JSON — the real value of `contentType` is one of the two enum values shown above, not the union expression):

```json
{
  "content": "<p>Hi — quick follow-up on Monday's call.</p>",
  "contentType": "html"
}
```

Pipeline behavior:
- If `contentType === 'html'`: strip HTML tags with a simple regex, then feed the resulting plain text to `redact()`.
- If `contentType === 'text'`: feed `content` directly to `redact()`.
- If `content` is empty or null: skip the message entirely (no row stored).

---

## Fields the Pipeline Uses (Dotted-Path Contract)

The unit-test mocks and the integration-test fixtures **must include all of these fields with valid values**. The unit tests **must assert** that the code reads from exactly these paths.

| Used as | Dotted path |
|---|---|
| Source ID | `message.id` |
| Subject (blocklist + display) | `message.subject` |
| Body content | `message.body.content` |
| Body content type | `message.body.contentType` |
| Sender email | `message.from.emailAddress.address` |
| Recipient emails | concat: `message.toRecipients[].emailAddress.address`, `message.ccRecipients[].emailAddress.address`, `message.bccRecipients[].emailAddress.address` |
| Captured-at timestamp | `message.sentDateTime` (UTC ISO) — fallback to `message.receivedDateTime` if `sentDateTime` is missing |
| Source URL | `message.webLink` |
| Folder ID (for allowlist) | `message.parentFolderId` |
| Skip draft? | `message.isDraft === true → skip` |

## Fields the Pipeline Explicitly Ignores

These are returned by Graph but the pipeline must NOT extract them. If a future PR adds them to the pipeline, it must update this contract first.

- `bodyPreview` (truncated; we use full `body`)
- `sender` (we use `from`)
- `replyTo` (not relevant for capture)
- `createdDateTime`, `lastModifiedDateTime` (not signals of content recency)
- `conversationId`, `conversationIndex` (deferred to synthesis worker)
- `hasAttachments`, `importance`, `inferenceClassification` (metadata noise)
- `isRead`, `isDeliveryReceiptRequested`, `isReadReceiptRequested` (telemetry noise)
- `internetMessageId`, `flag`, `changeKey` (orthogonal IDs / metadata)

---

## Suggested `$select` Query

To minimize payload size and avoid pulling noise we don't use, the worker should request:

```
GET /users/{upn}/messages
  ?$select=id,subject,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,webLink,parentFolderId,isDraft
  &$filter=sentDateTime ge {lastIngestedAtISO}
  &$top=100
  &$orderby=sentDateTime asc
```

**Why filter on `sentDateTime` rather than `receivedDateTime`:** The pipeline reads Hassan's own mailbox, which contains both received messages (Inbox) and sent messages (Sent Items). `sentDateTime` is set on **both** — it is the moment the original sender (Hassan for outbound, the counterparty for inbound) released the message. `receivedDateTime` is only meaningful for messages that arrived in the mailbox (it's the moment Exchange recorded delivery into Hassan's inbox). Using `sentDateTime` gives a single uniform timestamp across both folders, which keeps the checkpoint logic simple and matches the `captured_at` semantics in `capture_signals` ("when did this content come into existence," not "when did it arrive in storage"). The capture-synthesis-layer planning PRD originally specified `receivedDateTime` for the inbox-only path; that guidance is superseded by this contract once the worker is implemented against this contract.

(Prompt 3b's original version did NOT use `$select`. The follow-up implementation of prompt 3b should adopt the `$select` projection above.)

---

## Sample Real-World Response Shape

**Authoritative fixture:** [`./fixtures/msgraph-message-sample.json`](./fixtures/msgraph-message-sample.json)

That file is the committed, scrubbed copy of a real `GET /users/{upn}/messages?$top=1` response captured from the NexFortis tenant on 2026-05-21. All personal identifiers have been replaced with synthetic placeholders (see the `_fixture_metadata` block at the top of the file for the exact scrubbing log). Field shape, types, and structural details (including `@odata.context`, `@odata.etag`, `@odata.nextLink`, empty array conventions, and `null` handling for `isDeliveryReceiptRequested`) are preserved exactly as Graph returned them.

Unit-test mocks for the MS Graph email ingester MUST be built against this fixture rather than against handwritten approximations. When the fixture needs to evolve (because a new field becomes relevant, or Microsoft adds something), it gets updated in a dedicated PR that also updates this contract and any consumers.

A short inline summary of the structurally-notable fields is below for quick reference. For the full shape, read the JSON fixture.

- Top-level envelope: `{ "@odata.context": ..., "@odata.nextLink": ..., "value": [Message, ...] }`. Tests must mock this envelope, not a bare message array.
- Every message has `@odata.etag`. Treat as opaque, ignore.
- `body.contentType` is `"html"` in practice for almost all real-world mail. Plain-text emails are rare. HTML stripping is the common code path.
- `categories` is typically an empty array but is always present. Out of scope for ingestion.
- `from.emailAddress.address` is lowercase by convention but Graph does not normalize; the redaction module's blocklist lowercases before hashing.
- `name` fields on recipient sub-objects can be set to anything by the sender — never use them for logic decisions (adversarial input).
- `isDraft: false` is the common case; `isDraft: true` means the message lives in Drafts and is skipped by the ingester.
- `isDeliveryReceiptRequested` may come back as `null` (not `false`) on some messages — Graph does not normalize this. Treat any non-`true` value as "not requested."

---

## What to Do With This Document

1. **For new ingester prompts:** the prompt's `Spec reference` section must link to this contract. The unit-test mocks specified in the prompt must use `./fixtures/msgraph-message-sample.json` as their source of truth (loaded into the test, not hand-rewritten in test code).
2. **For PR reviews:** strategist cross-checks the diff against this contract. Any mismatch between extracted-field-paths in code and dotted paths in this contract is a review blocker.
3. **For integration tests (future):** the smoke test asserts that a fresh `GET /users/{upn}/messages` response from the real tenant still matches every field documented here. If Microsoft changes a field name, the smoke test fails immediately rather than silently corrupting the corpus.
4. **For Teams transcripts, Telegram, Perplexity Spaces, etc.:** repeat the same exercise — fetch the official schema, capture one real response, scrub it, commit alongside a sister contract document. Schema first, prompt second.

This document is updated whenever a pipeline change starts using a new field, stops using a tracked field, or detects a schema change in the upstream API.
