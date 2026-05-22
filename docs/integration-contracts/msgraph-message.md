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

```json
{
  "content": "string",
  "contentType": "text" | "html"
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

(Cursor's prompt 3b currently does NOT use `$select`. That's acceptable for the first PR — Graph returns the same fields anyway — but is a worthwhile efficiency improvement for a follow-up PR.)

---

## Sample Real-World Response Shape (Anonymized)

```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users('hassan%40hassansadiq.onmicrosoft.com')/messages",
  "@odata.nextLink": "https://graph.microsoft.com/v1.0/users/...$skiptoken=...",
  "value": [
    {
      "@odata.etag": "W/\"CQAAABYAAAB...\"",
      "id": "AAMkAGI...long-base64-string...AAA=",
      "createdDateTime": "2026-05-11T18:32:11Z",
      "lastModifiedDateTime": "2026-05-11T18:32:14Z",
      "changeKey": "CQAAABYAAAB...",
      "categories": [],
      "receivedDateTime": "2026-05-11T18:32:13Z",
      "sentDateTime": "2026-05-11T18:32:10Z",
      "hasAttachments": false,
      "internetMessageId": "<example-id@mail.example.com>",
      "subject": "Re: Conditional Access policy for iOS",
      "bodyPreview": "Hi Hassan — quick follow-up on the AADSTS50158 issue...",
      "importance": "normal",
      "parentFolderId": "AQMkAGI0MDhmZmYxLTk5Nm...",
      "conversationId": "AAQkAGI0MDhmZmY...",
      "conversationIndex": "AQHcab9G...",
      "isDeliveryReceiptRequested": false,
      "isReadReceiptRequested": false,
      "isRead": true,
      "isDraft": false,
      "webLink": "https://outlook.office365.com/owa/?ItemID=AAMkAGI...",
      "inferenceClassification": "focused",
      "body": {
        "contentType": "html",
        "content": "<html><body><p>Hi Hassan — quick follow-up on the AADSTS50158 issue we discussed. The Named Locations fix worked for the recruiter; she's back in the Authenticator app now.</p><p>One thing to confirm — should we apply the same exclusion to the Talencor staff group, or only to verified mobile devices?</p></body></html>"
      },
      "sender": {
        "emailAddress": {
          "name": "Example Sender",
          "address": "sender@example.com"
        }
      },
      "from": {
        "emailAddress": {
          "name": "Example Sender",
          "address": "sender@example.com"
        }
      },
      "toRecipients": [
        {
          "emailAddress": {
            "name": "Hassan Sadiq",
            "address": "hassan@hassansadiq.onmicrosoft.com"
          }
        }
      ],
      "ccRecipients": [],
      "bccRecipients": [],
      "replyTo": [],
      "flag": {
        "flagStatus": "notFlagged"
      }
    }
  ]
}
```

**Notable observations from this real shape that the pipeline must handle:**

1. The response wraps results in `value` array and includes `@odata.context` / `@odata.nextLink` siblings. Tests must mock this envelope, not just bare message arrays.
2. `body.content` is HTML by default for almost all real-world mail. Plain-text emails are rare. HTML stripping is the common path.
3. `@odata.etag` and `@odata.context`-prefixed fields appear on every message and must be ignored without failing strict schema validation.
4. `categories` is an empty array on most messages but is technically present. Out of scope.
5. `from.emailAddress.address` is lowercase by convention but Graph does not normalize — the pipeline's redaction module already lowercases before hashing, which handles this correctly.
6. The display `name` field on recipients can be set to anything by the sender — never use it for any logic decision (it's adversarial input).
7. `isDraft: false` is the common case. `isDraft: true` means the message lives in Drafts and shouldn't be ingested.

---

## What to Do With This Document

1. **Right now:** I cross-check the actively-running prompt 3b PR (when it opens) against this contract. Any mismatch is a review blocker.
2. **For unit tests:** the `__fixtures__/sample-message.json` file in prompt 3b must conform to this shape exactly. If the agent produced a fixture that doesn't include the full envelope structure or uses a different path for any field, that's caught in review.
3. **For integration tests (Prompt 3b-int, future):** the smoke test asserts that a real Graph response from `hassan@hassansadiq.onmicrosoft.com`'s mailbox matches this contract. If Microsoft ever changes a field name, the smoke test fails immediately rather than silently corrupting the corpus.
4. **For Teams transcripts (Prompt 3c, future):** I do the same exercise — fetch the Teams transcript resource schema before writing the prompt, build a sister contract document.
5. **For Telegram, Perplexity Spaces, etc.:** same pattern. Schema first, prompt second.

This document is updated whenever a pipeline change starts using a new field, stops using a tracked field, or detects a schema change in the upstream API.
