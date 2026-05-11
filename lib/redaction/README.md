# @ncp/redaction

PII redaction + family-law / personal-content hard blocklist for the NexFortis
Automated Content Pipeline v2. Every capture-source ingester MUST route raw
text through `redact()` before anything else touches it.

## Usage

```ts
import { redact } from '@ncp/redaction';

const result = await redact({
  source: 'msgraph_email',
  senderEmail: 'someone@example.com',
  recipientEmails: ['hassan@nexfortis.com'],
  subject: 'Re: QuickBooks export question',
  body: 'Call me at (555) 555-1234 or email me at someone@example.com.',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
});

if (result.status === 'blocked') {
  // DO NOT INGEST. The blocklist (family-law or fail-closed redaction error)
  // explicitly opted this capture out of the corpus.
  return;
}

// result.redactedText is safe to embed and store as `redacted_text`.
// result.log contains one entry per replacement, with original-body offsets.
```

## What pass 1 (regex) catches

| Pattern        | Token             |
| -------------- | ----------------- |
| Email          | `[REDACTED_EMAIL]` |
| Phone (NANP)   | `[REDACTED_PHONE]` |
| Phone (E.164)  | `[REDACTED_PHONE]` |
| Canadian SIN   | `[REDACTED_SIN]`   |
| Credit card    | `[REDACTED_CC]`    |
| IPv4 / IPv6    | `[REDACTED_IP]`    |

Credit cards and SINs are Luhn-validated to reduce false positives on
arbitrary 9–19 digit sequences. IPv4 octets are bounded 0–255. Phone numbers
require a 2–9 leading area-code digit so they do not over-match version
numbers, dates, or ISBNs.

## What pass 2 (Claude Haiku) catches

Pass 2 runs over the post-regex text and uses Claude Haiku to identify and
replace:

| Entity type | Token                  |
| ----------- | ---------------------- |
| Person name | `[REDACTED_PERSON]`    |
| Company     | `[REDACTED_COMPANY]`   |
| Address     | `[REDACTED_ADDRESS]`   |

The Haiku prompt includes an allowlist: `NexFortis`, `qbportal`, and
`Talencor` are never redacted.

Haiku is asked to return strict JSON
(`{ "redacted": "...", "entities": [...] }`). If parsing fails, that counts as
a non-retryable error and `redact()` fails closed
(`{ status: 'blocked', reason: 'redaction_failed' }`).

This module does **not** retry on API errors — that's the caller's job.

## Family-law / personal-content blocklist — fail-closed and hardcoded

The blocklist runs **before** the regex pass. It checks:

1. **Sender email** (and each recipient email) — SHA-256 hashed (lowercased,
   trimmed) and compared in constant time (`crypto.timingSafeEqual`) against
   `BLOCKLIST_EMAIL_HASHES`.
2. **Subject line** against `BLOCKLIST_SUBJECT_REGEX`:
   `/(custody|mediator|settlement|family court|divorce|separation agreement)/i`.
3. **Body** against `BLOCKLIST_BODY_KEYWORDS` (a small high-confidence list).

If any check matches, `redact()` returns `{ status: 'blocked', reason: ... }`
immediately and never invokes the regex or Haiku passes. The hardcoded
`BLOCKLIST_EMAIL_HASHES`, `BLOCKLIST_SUBJECT_REGEX`, and
`BLOCKLIST_BODY_KEYWORDS` constants are intentionally not configurable at
runtime: this is a **code-level constraint**, not a feature flag.

If the blocklist function itself throws, the orchestrator catches and returns
`{ status: 'blocked', reason: 'redaction_failed' }`. There is no path through
this module that returns `status: 'redacted'` for an input the blocklist could
not classify.

## Result shape

```ts
type RedactionResult =
  | { status: 'redacted'; redactedText: string; log: RedactionLogEntry[] }
  | {
      status: 'blocked';
      reason: 'email_address' | 'subject_keyword' | 'body_keyword' | 'redaction_failed';
      redactedText: '';
      log: RedactionLogEntry[];
    };

interface RedactionLogEntry {
  type: string;
  offset: number;
  replacement: string;
}
```

`log[].offset` is measured in the **original** (pre-redaction) body text. The
Haiku-pass offsets are remapped back through the regex-pass replacement table
before they are returned.
