# `@ncp/redaction`

Two-pass PII redaction with a fail-closed family-law / legal-counsel hard
blocklist. Used by every capture-source ingester before any text is embedded
or stored.

## Usage

```ts
import { redact } from '@ncp/redaction';

const result = await redact({
  source: 'msgraph_email',
  senderEmail: 'colleague@example.com',
  recipientEmails: ['hassan@nexfortis.com'],
  subject: 'Quick question about QuickBooks reconciliation',
  body: 'Hey Hassan, my email is colleague@example.com and my number is +14165551234.',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
});

if (result.status === 'blocked') {
  // Do not ingest. Log the reason and abort.
  return;
}

// result.redactedText is safe to embed and store.
// result.log is an array of { type, offset, replacement } entries with
// offsets in the ORIGINAL pre-redaction text.
```

## Pipeline

The pipeline runs in this exact order. **Do not reorder.**

1. **Hard blocklist check** (synchronous, fail-closed).
   - SHA-256 hash of any sender/recipient email vs. a hardcoded list of
     pre-computed legal-counsel / mediator hashes (constant-time compare).
   - Subject vs. the regex `/(custody|mediator|settlement|family court|divorce|separation agreement)/i`.
   - Body vs. a small list of high-confidence family-law keywords.
   - **Match → return `{ status: 'blocked', reason }` immediately. The regex
     pass never runs, so personal-content patterns never appear in any log.**
2. **Regex pass** (`regex-pass.ts`). Catches:
   - Email addresses → `[REDACTED_EMAIL]`
   - Phone numbers (NANP and E.164) → `[REDACTED_PHONE]`
   - Canadian SINs (`XXX-XXX-XXX`, Luhn-validated) → `[REDACTED_SIN]`
   - Credit card numbers (13–19 digits, Luhn-validated) → `[REDACTED_CC]`
   - IPv4 addresses (each octet 0–255) and IPv6 addresses → `[REDACTED_IP]`
3. **Haiku scrub** (`haiku-scrub.ts`). Catches:
   - Person names → `[REDACTED_PERSON]`
   - Company names (excluding `NexFortis`, `qbportal`, `Talencor`) → `[REDACTED_COMPANY]`
   - Street addresses → `[REDACTED_ADDRESS]`

## Fail-closed guarantees

The blocklist is hardcoded in `blocklist.ts`. It cannot be disabled via
configuration, environment variables, or feature flags. Any change requires
a code edit, a PR, and Hassan's review.

If either pass throws (Haiku API error, malformed JSON, schema validation
failure), `redact()` returns
`{ status: 'blocked', reason: 'redaction_failed', redactedText: '', log: ... }`.
**Partially-redacted text is never returned as if it were clean.**

The hash comparison uses `crypto.timingSafeEqual` to avoid leaking which
specific blocklist entry matched via timing side-channels.

## Placeholder hashes — manual edit required before any ingester ships

`BLOCKLIST_EMAIL_HASHES` currently contains placeholder strings
(`__PLACEHOLDER_LEGAL_HASH_1__`, `__PLACEHOLDER_MEDIATOR_HASH_2__`). They
are not valid 64-char hex digests, so the constant-time hash comparison will
always reject any incoming email — fail-closed by design.

Hassan must replace the placeholders with real SHA-256 hex digests of the
lower-cased, trimmed email addresses via a separate manual edit before any
ingester is enabled in production.

## Testing

Tests live under `tests/redaction/`. The Anthropic SDK is fully mocked via
`vi.mock('@anthropic-ai/sdk', ...)` — no test ever hits the real API. Test
fixtures use the `blocklistHashes` override on `checkBlocklist` to exercise
match logic without touching `BLOCKLIST_EMAIL_HASHES`.
